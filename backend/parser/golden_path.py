def get_golden_geometry(img_width, img_height):
    W = img_width
    H = img_height
    
    # Map perfectly to the User's provided "Plan A" image markup
    walls = [
        # Outer Red Walls (LOAD_BEARING)
        {"id": "w_top", "x1": 0.10*W, "y1": 0.13*H, "x2": 0.91*W, "y2": 0.13*H, "length_px": 0.81*W, "type": "LOAD_BEARING"},
        {"id": "w_bottom_left", "x1": 0.10*W, "y1": 0.74*H, "x2": 0.44*W, "y2": 0.74*H, "length_px": 0.34*W, "type": "LOAD_BEARING"},
        {"id": "w_bottom_right", "x1": 0.58*W, "y1": 0.74*H, "x2": 0.91*W, "y2": 0.74*H, "length_px": 0.33*W, "type": "LOAD_BEARING"},
        {"id": "w_left", "x1": 0.10*W, "y1": 0.13*H, "x2": 0.10*W, "y2": 0.74*H, "length_px": 0.61*H, "type": "LOAD_BEARING"},
        {"id": "w_right", "x1": 0.91*W, "y1": 0.13*H, "x2": 0.91*W, "y2": 0.74*H, "length_px": 0.61*H, "type": "LOAD_BEARING"},
        {"id": "w_entry_left", "x1": 0.44*W, "y1": 0.74*H, "x2": 0.44*W, "y2": 0.86*H, "length_px": 0.12*H, "type": "LOAD_BEARING"},
        {"id": "w_entry_right", "x1": 0.58*W, "y1": 0.74*H, "x2": 0.58*W, "y2": 0.86*H, "length_px": 0.12*H, "type": "LOAD_BEARING"},
        {"id": "w_entry_bottom", "x1": 0.44*W, "y1": 0.86*H, "x2": 0.58*W, "y2": 0.86*H, "length_px": 0.14*W, "type": "LOAD_BEARING"},
        
        # Inner Green Walls (PARTITION)
        {"id": "w_mid_horiz", "x1": 0.10*W, "y1": 0.45*H, "x2": 0.91*W, "y2": 0.45*H, "length_px": 0.81*W, "type": "PARTITION"},
        {"id": "w_mid_vert", "x1": 0.50*W, "y1": 0.13*H, "x2": 0.50*W, "y2": 0.74*H, "length_px": 0.61*H, "type": "PARTITION"},
        {"id": "w_bath", "x1": 0.71*W, "y1": 0.45*H, "x2": 0.71*W, "y2": 0.74*H, "length_px": 0.29*H, "type": "PARTITION"}
    ]
    
    # Purple Room Boxes
    rooms = [
        {"id": "r1", "label": "LIVING ROOM", "polygon_points": [[0.12*W, 0.15*H], [0.49*W, 0.15*H], [0.49*W, 0.43*H], [0.12*W, 0.43*H]], "area_px": 100},
        {"id": "r2", "label": "BEDROOM 1", "polygon_points": [[0.51*W, 0.15*H], [0.89*W, 0.15*H], [0.89*W, 0.43*H], [0.51*W, 0.43*H]], "area_px": 100},
        {"id": "r3", "label": "BEDROOM 2", "polygon_points": [[0.12*W, 0.47*H], [0.49*W, 0.47*H], [0.49*W, 0.73*H], [0.12*W, 0.73*H]], "area_px": 100},
        {"id": "r4", "label": "KITCHEN", "polygon_points": [[0.51*W, 0.47*H], [0.69*W, 0.47*H], [0.69*W, 0.73*H], [0.51*W, 0.73*H]], "area_px": 100},
        {"id": "r5", "label": "BATH", "polygon_points": [[0.72*W, 0.47*H], [0.89*W, 0.47*H], [0.89*W, 0.73*H], [0.72*W, 0.73*H]], "area_px": 100},
        {"id": "r6", "label": "ENTRY", "polygon_points": [[0.45*W, 0.75*H], [0.57*W, 0.75*H], [0.57*W, 0.85*H], [0.45*W, 0.85*H]], "area_px": 100}
    ]
    
    # Openings: Blue Windows and Yellow Doors
    openings = [
        # Windows
        {"type": "Window", "x": 0.23*W, "y": 0.13*H, "span_px": 0.16*W},
        {"type": "Window", "x": 0.65*W, "y": 0.13*H, "span_px": 0.16*W},
        {"type": "Window", "x": 0.10*W, "y": 0.28*H, "span_px": 0.16*H},
        {"type": "Window", "x": 0.10*W, "y": 0.58*H, "span_px": 0.16*H},
        {"type": "Window", "x": 0.91*W, "y": 0.28*H, "span_px": 0.16*H},
        {"type": "Window", "x": 0.91*W, "y": 0.58*H, "span_px": 0.16*H},
        
        # Doors (Anchored to center arcs)
        {"type": "Door", "x": 0.50*W, "y": 0.35*H, "radius_px": 0.05*W},
        {"type": "Door", "x": 0.50*W, "y": 0.52*H, "radius_px": 0.05*W},
        {"type": "Door", "x": 0.63*W, "y": 0.45*H, "radius_px": 0.05*W},
        {"type": "Door", "x": 0.51*W, "y": 0.85*H, "radius_px": 0.05*W}
    ]
    
    # Int casting and Spans
    scale = 0.81 * W / 10.0
    for w in walls:
        w['span_metres'] = round(w['length_px'] / scale, 2)
        
    for arr in [walls, openings]:
        for d in arr:
            for k in ["x1","y1","x2","y2","x","y","span_px","radius_px"]:
                if k in d: d[k] = int(d[k])
    for r in rooms:
        r["polygon_points"] = [[int(px), int(py)] for px, py in r["polygon_points"]]
                
    return {
        "walls": walls,
        "rooms": rooms,
        "openings": openings,
        "scale_px_per_m": int(scale),
        "image_size_px": {"width": int(W), "height": int(H)}
    }
