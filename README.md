# Z-Axis: Autonomous Structural Intelligence

Z-Axis is a high-precision architectural platform that converts 2D floor plans (manual sketches or uploaded images) into structured 3D models with AI-powered material recommendations.

## 🚀 Quick Start Guide

### 1. Backend Setup (AI Core)
The backend manages the OpenCV detection pipeline and material intelligence.

```powershell
# 1. Install dependencies
pip install -r backend/requirements.txt

# 2. Launch the Flask server
# (Ensure you are in the project root directory)
python -m backend.app
```
*Port: 5000 | Host: 127.0.0.1*

### 2. Frontend Launch
You can open the application directly or use a local development server for the best experience.

- **Option A**: Open `frontend/index.html` in your browser.
- **Option B**: Right-click `index.html` in VS Code and select **"Open with Live Server"**.

---

## 🛠 Features & Workflow

### 📋 Image Intelligence (Auto-Detect)
- **How**: Drag-and-drop a clear floor plan image (PNG/JPG) onto the main homepage uploader.
- **Result**: The system automatically detects walls, classifies them (Load-Bearing vs. Partition), infers window/door locations, and builds a 3D wireframe.

### ✍️ Custom Design Studio (Manual Sketch)
- **How**: Click the **"Start Drawing Now"** block on the home page or the floating **"Draw Plan"** button.
- **Result**: Use the interactive grid to draw wall segments, place windows/doors, and export a precision-scaled 3D model.

### 🧱 Material Recommendation
- Once a model is generated, click the **"Materials"** tab or scroll to see the **Bill of Materials**.
- The AI classifies elements and provides specialized material scores (Red Brick, AAC Blocks, etc.).

---

## ⚙️ Advanced Configuration (Gemini AI)
To enable automated construction narratives and structural insights:
1. Go to the **Draw Studio** page.
2. Click the **API Key** button in the navbar.
3. Enter your **Gemini API Key**.
4. Analysis will now include a detailed AI summary for every layout.

---

## 📁 Project Structure
- `/frontend`: Main UI, Logic (`viewer.js`, `draw-app.js`), and Styles.
- `/backend`: Modular CV and Material pipeline (`pipeline.py`, `plan_analysis.py`).
- `/outputs`: Automatically saved historical analysis results (JSON/PNG).

> [!NOTE]
> The backend must be running for the Image Uploader to function reliably. The Draw Studio can function in "Core Engine" mode (standalone) for simple drafting, but requires the backend for Advanced 3D Conversion.
