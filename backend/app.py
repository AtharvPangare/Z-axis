from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import tempfile
from dotenv import load_dotenv

from parser.floor_plan_parser import parse_floor_plan
from parser.fallback_coords import get_fallback_geometry
from parser.geometry_builder import build_geometry
from model3d.model_generator import generate_3d_model
from materials.tradeoff_engine import rank_materials
from explainer.llm_explainer import explain_all_recommendations

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
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)

if __name__ == '__main__':
    app.run(debug=True, port=5000)
