def generate_3d_model(geometry_data):
    """
    Convert Shape/Graph geometry into Three.js JSON.
    Extrude to 3m height. Add flat floor slab.
    """
    walls = geometry_data.get('walls', [])
    scale = geometry_data.get('scale_px_per_m', 100.0)
    
    threejs_walls = []
    
    if not walls:
        return {"walls": [], "slab": None, "scale": scale}
        
    min_x = min([min(w['x1'], w['x2']) for w in walls])
    max_x = max([max(w['x1'], w['x2']) for w in walls])
    min_y = min([min(w['y1'], w['y2']) for w in walls]) 
    max_y = max([max(w['y1'], w['y2']) for w in walls])
    
    slab_w = (max_x - min_x) / scale
    slab_d = (max_y - min_y) / scale
    
    center_x = (min_x + max_x) / 2
    center_z = (min_y + max_y) / 2
    
    for w in walls:
        x1_m = (w['x1'] - center_x) / scale
        z1_m = (w['y1'] - center_z) / scale
        x2_m = (w['x2'] - center_x) / scale
        z2_m = (w['y2'] - center_z) / scale
        
        threejs_walls.append({
            "id": w['id'],
            "x1": round(x1_m, 3),
            "z1": round(z1_m, 3),
            "x2": round(x2_m, 3),
            "z2": round(z2_m, 3),
            "height": 3.0,
            "thickness": 0.2 if w.get('type') == 'LOAD_BEARING' else 0.1,
            "type": w.get('type', 'PARTITION'),
            "span_metres": w.get('span_metres', 0)
        })
        
    return {
        "walls": threejs_walls,
        "slab": {
            "width": round(slab_w + 0.4, 2), 
            "depth": round(slab_d + 0.4, 2),
            "thickness": 0.15
        },
        "scale": scale
    }
