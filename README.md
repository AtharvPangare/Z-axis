Z-Axis — Autonomous Structural Modeling & Analysis
Converts 2D floor plans into 3D structural models with automated material analysis.

What It Does

Z-Axis takes a floor plan (image or sketch) and processes it through a structural engineering pipeline:
1. Detects walls, doors, windows, and rooms using OpenCV
2. Classifies walls:
   - Load-Bearing Walls: walls holding window openings (lintel & stress concentration analysis)
   - Partition Walls: walls without window openings (lightweight infill & acoustic analysis)
3. Generates a 3D structural model using Three.js
4. Generates Bill of Materials and engineering specifications (RCC, Red Brick, AAC Blocks, etc.)

Tech Stack
- Frontend: HTML, CSS, JavaScript, Three.js
- Backend: Flask (Python)
- Computer Vision: OpenCV, NumPy
- 3D Rendering: Three.js
