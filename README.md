Z-Axis — Autonomous Structural Intelligence
Converts 2D floor plans into 3D models with material suggestions using AI.

What It Does

Z-Axis takes a floor plan (image or sketch) and processes it through an AI pipeline:
Detects walls, doors, and rooms using OpenCV
Classifies walls (load-bearing / partition)
Generates a 3D model using Three.js
Suggests best construction materials (RCC, Steel, Brick, etc.)
Explains recommendations using AI

Tech Stack
Frontend: HTML, CSS, JS, Three.js
Backend: Flask (Python)
Computer Vision: OpenCV, NumPy
3D Rendering: Three.js
AI/LLM: DeepSeek API
Database/Auth: MongoDB, JWT, Google OAuth
