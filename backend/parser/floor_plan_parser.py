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
    
    # TEXT & NOISE FILTER: Erase "words as walls"
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(thresh, connectivity=8)
    for i in range(1, num_labels):
        area = stats[i, cv2.CC_STAT_AREA]
        w_b = stats[i, cv2.CC_STAT_WIDTH]
        h_b = stats[i, cv2.CC_STAT_HEIGHT]
        # Text characters are typically small and compact. Delete them.
        if area < 500 or (w_b < 40 and h_b < 40):
            thresh[labels == i] = 0
            
    # Morphological Skeleton for cleaner centerlines
    skeleton = np.zeros(thresh.shape, np.uint8)
    element = cv2.getStructuringElement(cv2.MORPH_CROSS, (3,3))
    temp_img = thresh.copy()
    
    while True:
        eroded = cv2.erode(temp_img, element)
        temp = cv2.dilate(eroded, element)
        temp = cv2.subtract(temp_img, temp)
        skeleton = cv2.bitwise_or(skeleton, temp)
        temp_img = eroded.copy()
        if cv2.countNonZero(temp_img) == 0:
            break
            
    # Line detection (HoughLinesP) using skeleton instead of Canny
    lines = cv2.HoughLinesP(skeleton, 1, np.pi/180, threshold=40, minLineLength=40, maxLineGap=20)
    
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
                
    # Detect structured rooms perfectly via inverse voids
    # 1. Close the wall gaps (doors) with a massive structural block
    close_kernel = np.ones((25, 25), np.uint8)
    closed_walls = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, close_kernel)
    
    # 2. Invert so rooms (empty space) become massive white blobs
    rooms_mask = cv2.bitwise_not(closed_walls)
    
    # 3. Find the blobs
    contours, _ = cv2.findContours(rooms_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    rooms = []
    r_idx = 0
    img_area = img.shape[0] * img.shape[1]
    
    for c in contours:
        x,y,w,h = cv2.boundingRect(c)
        area = w * h
        # Only preserve blobs that represent 2% to 45% of interior space (filters backgrounds + noise)
        if 0.02 * img_area < area < 0.45 * img_area:
            # snap cleanly
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
            

    # Detect Windows (Thin Rectangles from original thresh walls)
    window_contours, _ = cv2.findContours(thresh, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    for c in window_contours:
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
