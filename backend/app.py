from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import tempfile
import base64
import cv2
import numpy as np
from dotenv import load_dotenv

from parser.floor_plan_parser import parse_floor_plan
from parser.fallback_coords import get_fallback_geometry
from parser.geometry_builder import build_geometry
from model3d.model_generator import generate_3d_model
from materials.tradeoff_engine import rank_materials
from explainer.llm_explainer import explain_all_recommendations

def encode_png_data_url(image: np.ndarray) -> str:
    success, encoded = cv2.imencode(".png", image)
    if not success:
        return ""
    b64 = base64.b64encode(encoded.tobytes()).decode("ascii")
    return f"data:image/png;base64,{b64}"

def draw_annotated_plan(image_path, walls, rooms, openings):
    img = cv2.imread(image_path)
    if img is None: return None
    
    # Draw rooms
    for r in rooms:
        p = np.array(r["polygon_points"], dtype=np.int32)
        cv2.fillPoly(img, [p], (218, 206, 255))
        
    # Draw walls
    for w in walls:
        c = (40, 40, 220) if w.get("classification") == "LOAD_BEARING" or w.get("type") == "LOAD_BEARING" else (60, 160, 100)
        cv2.line(img, (int(w["x1"]), int(w["y1"])), (int(w["x2"]), int(w["y2"])), c, 4)
        
    # Draw openings
    for o in openings:
        ct = (int(o["x"]), int(o["y"]))
        if o["type"] == "Door":
            cv2.circle(img, ct, 10, (0, 100, 255), -1)
        else:
            cv2.rectangle(img, (ct[0]-15, ct[1]-5), (ct[0]+15, ct[1]+5), (255, 100, 0), -1)
    return img

load_dotenv()
app = Flask(__name__)
# Enable CORS for frontend integration
CORS(app)

@app.route('/parse', methods=['POST'])
def parse():
    """Stage 1: OpenCV Wall & Room Detection"""
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    
    try:
        temp_fd, temp_path = tempfile.mkstemp(suffix=".png")
        os.close(temp_fd)
        file.save(temp_path)
        
        try:
            parsed_data = parse_floor_plan(temp_path)
            if not parsed_data['walls']:
                parsed_data = get_fallback_geometry()
        except Exception as e:
            print(f"OpenCV Error: {e}")
            parsed_data = get_fallback_geometry()
            
        geom_data = build_geometry(parsed_data)
        
        if os.path.exists(temp_path):
            os.remove(temp_path)
            
        return jsonify(geom_data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/model', methods=['POST'])
def model():
    """Stage 3: 3D Model Generation from JSON Geometry"""
    geom_data = request.json
    if not geom_data:
        return jsonify({"error": "No JSON data"}), 400
    model_data = generate_3d_model(geom_data)
    return jsonify(model_data)

@app.route('/materials', methods=['POST'])
def materials():
    """Stage 4: Material Recommendations"""
    model_data = request.json
    if not model_data:
        return jsonify({"error": "No JSON data"}), 400
    
    recommendations = []
    for w in model_data.get('walls', []):
        rec = rank_materials(w['id'], w['type'], w['span_metres'])
        recommendations.append(rec)
    return jsonify({"recommendations": recommendations})

@app.route('/explain', methods=['POST'])
def explain():
    """Stage 5: LLM Explanations"""
    req_data = request.json
    if not req_data:
        return jsonify({"error": "No JSON data"}), 400
        
    recommendations = req_data.get("recommendations", [])
    explanations = explain_all_recommendations(recommendations)
    return jsonify({"explanations": explanations})

@app.route('/pipeline', methods=['POST'])
def pipeline_endpoint():
    """Stage 6: Full End-to-End Pipeline"""
    if 'file' not in request.files:
        return jsonify({"status": "error", "message": "No file part"}), 400
        
    file = request.files['file']
    temp_path = None
    
    try:
        temp_fd, temp_path = tempfile.mkstemp(suffix=".png")
        os.close(temp_fd)
        file.save(temp_path)
        
        # 1. Parse Image
        try:
            parsed_data = parse_floor_plan(temp_path)
            if not parsed_data['walls']:
                parsed_data = get_fallback_geometry()
        except Exception as e:
            print(f"OpenCV Error: {e}")
            parsed_data = get_fallback_geometry()
            
        # 2. Geometry Builder
        geom_data = build_geometry(parsed_data)
            
        # 3. Model Generator
        model_data = generate_3d_model(geom_data)
        
        # 4. Materials Tradeoff
        recommendations = []
        for w in model_data.get('walls', []):
            rec = rank_materials(w['id'], w['type'], w['span_metres'])
            recommendations.append(rec)
            
        # 5. Explanations
        explanations = explain_all_recommendations(recommendations)
        
        # 6. Artifacts for UI Previews
        gray = cv2.imread(temp_path, cv2.IMREAD_GRAYSCALE)
        annotated = draw_annotated_plan(temp_path, parsed_data['walls'], parsed_data['rooms'], parsed_data['openings'])
        
        return jsonify({
            "status": "success",
            "geom": parsed_data,
            "model": model_data,
            "materials": recommendations,
            "explanations": explanations,
            "artifacts": {
                "grayscale_preview": encode_png_data_url(gray) if gray is not None else "",
                "annotated_2d_preview": encode_png_data_url(annotated) if annotated is not None else ""
            }
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)

@app.route('/pipeline-draw', methods=['POST'])
def pipeline_draw():
    """Unified endpoint for sketch-based structural analysis."""
    data = request.json
    if not data:
        return jsonify({"status": "error", "message": "No JSON payload"}), 400
        
    try:
        segments = data.get('segments', [])
        # Provide default scale if not specified (e.g. 20px = 1m as per Draw Studio's snapGrid)
        scale_px_per_m = data.get('scale_px_per_m', 20.0)
        
        # 1. Map segments to backend structures
        walls = []
        openings = []
        for i, s in enumerate(segments):
            if s['type'] == 'wall':
                length = ((s['x2'] - s['x1'])**2 + (s['y2'] - s['y1'])**2)**0.5
                walls.append({
                    "id": f"w{i}",
                    "x1": s['x1'], "y1": s['y1'],
                    "x2": s['x2'], "y2": s['y2'],
                    "length_px": length
                })
            else:
                openings.append({
                    "type": "Window" if s['type'] == 'window' else "Door",
                    "x": (s['x1'] + s['x2']) / 2,
                    "y": (s['y1'] + s['y2']) / 2,
                    "span_px": ((s['x2'] - s['x1'])**2 + (s['y2'] - s['y1'])**2)**0.5
                })
                
        parsed_data = {
            "walls": walls,
            "rooms": [], 
            "openings": openings,
            "scale_px_per_m": scale_px_per_m
        }
        
        # 2. Geometry Builder (Wall classification)
        geom_data = build_geometry(parsed_data)
            
        # 3. Model Generator
        model_data = generate_3d_model(geom_data)
        
        # 4. Materials Tradeoff
        recommendations = []
        for w in model_data.get('walls', []):
            rec = rank_materials(w['id'], w['type'], w['span_metres'])
            recommendations.append(rec)
            
        # 5. Explanations
        explanations = explain_all_recommendations(recommendations)
        
        return jsonify({
            "status": "success",
            "geom": geom_data,
            "model": model_data,
            "materials": recommendations,
            "explanations": explanations
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=5000, debug=True)
