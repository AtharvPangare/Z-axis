def get_fallback_geometry():
    """
    Returns hardcoded JSON for a 3-room layout with windows on exterior walls
    and solid interior partitions without windows.
    """
    return {
        "walls": [
            {"id": "w1", "x1": 100, "y1": 100, "x2": 900, "y2": 100, "length_px": 800},
            {"id": "w2", "x1": 900, "y1": 100, "x2": 900, "y2": 700, "length_px": 600},
            {"id": "w3", "x1": 900, "y1": 700, "x2": 100, "y2": 700, "length_px": 800},
            {"id": "w4", "x1": 100, "y1": 700, "x2": 100, "y2": 100, "length_px": 600},
            {"id": "w5", "x1": 500, "y1": 100, "x2": 500, "y2": 700, "length_px": 600},
            {"id": "w6", "x1": 100, "y1": 400, "x2": 500, "y2": 400, "length_px": 400} 
        ],
        "rooms": [
            {"id": "r1", "label": "ROOM 1", "polygon_points": [[100,100], [500,100], [500,400], [100,400]], "area_px": 120000},
            {"id": "r2", "label": "ROOM 2", "polygon_points": [[100,400], [500,400], [500,700], [100,700]], "area_px": 120000},
            {"id": "r3", "label": "ROOM 3", "polygon_points": [[500,100], [900,100], [900,700], [500,700]], "area_px": 240000}
        ],
        "openings": [
            {"type": "Window", "x": 300, "y": 100, "span_px": 60},
            {"type": "Window", "x": 700, "y": 100, "span_px": 60},
            {"type": "Window", "x": 500, "y": 700, "span_px": 60},
            {"type": "Door", "x": 500, "y": 300, "span_px": 40}
        ]
    }
