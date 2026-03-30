from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from dotenv import load_dotenv

from backend.pipeline import run_pipeline

load_dotenv()
app = Flask(__name__)
# Enable CORS for frontend integration
CORS(app)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy", "service": "Z-Axis Structural Intelligence"}), 200

@app.route('/pipeline', methods=['POST'])
def pipeline_endpoint():
    """Unified endpoint for structural parsing and 3D generation."""
    if 'file' not in request.files:
        return jsonify({"status": "error", "message": "No file part"}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"status": "error", "message": "No selected file"}), 400
        
    try:
        # Read file bytes and run the modular pipeline
        file_bytes = file.read()
        result = run_pipeline(file_bytes, file.filename)
        return jsonify(result)
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    # Listen on 0.0.0.0 for maximum compatibility in local environments
    app.run(host="0.0.0.0", port=5000, debug=True)
