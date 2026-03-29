import cv2
import numpy as np

def parse_floor_plan(image_path):
    """
    Takes an image path, returns dict with walls, rooms.
    Snaps to 10px grid to prevent drift.
    """
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Could not read image: {image_path}")
        
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Binary thresholding
    _, thresh = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY_INV)
    
    # Edges
    edges = cv2.Canny(thresh, 50, 150, apertureSize=3)
    
    # Line detection (HoughLinesP)
    lines = cv2.HoughLinesP(edges, 1, np.pi/180, threshold=50, minLineLength=50, maxLineGap=10)
    
    walls = []
    if lines is not None:
        for i, line in enumerate(lines):
            x1, y1, x2, y2 = line[0]
            
            # Snap to 10px grid
            x1 = round(x1 / 10.0) * 10
            y1 = round(y1 / 10.0) * 10
            x2 = round(x2 / 10.0) * 10
            y2 = round(y2 / 10.0) * 10
            
            length_px = np.sqrt((x2-x1)**2 + (y2-y1)**2)
            
            if length_px > 0:
                walls.append({
                    "id": f"w{i}",
                    "x1": int(x1), "y1": int(y1),
                    "x2": int(x2), "y2": int(y2),
                    "length_px": float(length_px)
                })
                
    # Detect approximate rooms via contours
    contours, _ = cv2.findContours(thresh, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    
    rooms = []
    r_idx = 0
    for c in contours:
        area = cv2.contourArea(c)
        if area > 1000: # filter noise
            x,y,w,h = cv2.boundingRect(c)
            # snap
            x, y = round(x/10.0)*10, round(y/10.0)*10
            w, h = round(w/10.0)*10, round(h/10.0)*10
            
            if w > 0 and h > 0:
                rooms.append({
                    "id": f"r{r_idx}",
                    "label": f"ROOM {r_idx}",
                    "polygon_points": [[x,y], [x+w,y], [x+w,y+h], [x,y+h]],
                    "area_px": float(w*h)
                })
                r_idx += 1
                
    # Detect Doors (Arcs -> Circles)
    blur = cv2.GaussianBlur(gray, (9, 9), 2)
    circles = cv2.HoughCircles(blur, cv2.HOUGH_GRADIENT, 1, 20,
                               param1=50, param2=30, minRadius=10, maxRadius=80)
    
    openings = []
    if circles is not None:
        circles = np.uint16(np.around(circles))
        for i in circles[0, :]:
            openings.append({
                "type": "Door",
                "x": int(i[0]),
                "y": int(i[1]),
                "radius_px": int(i[2])
            })
            
    # Detect Windows (Thin Rectangles from contours)
    for c in contours:
        area = cv2.contourArea(c)
        if 50 < area < 800:
            x,y,w,h = cv2.boundingRect(c)
            aspect_ratio = float(w)/h if h > 0 else 0
            if aspect_ratio > 3.5 or aspect_ratio < 0.28:
                rx, ry = round(x/10.0)*10, round(y/10.0)*10
                span = max(w, h)
                if span > 0:
                    openings.append({
                        "type": "Window",
                        "x": int(rx + w/2),
                        "y": int(ry + h/2),
                        "span_px": int(span)
                    })
                
    return {
        "image_size_px": {
            "width": img.shape[1],
            "height": img.shape[0]
        },
        "walls": walls,
        "rooms": rooms,
        "openings": openings
    }
