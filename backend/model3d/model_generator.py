def generate_3d_model(geometry_data):
    """
    Convert Shape/Graph geometry into Three.js JSON.
    Extrude to 3m height. Add flat floor slab.
    """
    walls = geometry_data.get('walls', [])
    scale = geometry_data.get('scale_px_per_m', 100.0)
    openings = geometry_data.get('openings', [])
    windows = [o for o in openings if o.get('type') == 'Window']
    door_openings = [o for o in openings if o.get('type') == 'Door']
    
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
        
        # 3D CSG Window Mapping
        wall_length_px = w.get('length_px', 0)
        wall_windows = []
        if wall_length_px > 0:
            for win in windows:
                x0, z0 = win['x'], win['y']
                vx, vz = w['x2'] - w['x1'], w['y2'] - w['y1']
                wx, wz = x0 - w['x1'], z0 - w['y1']
                
                # Projection mapping t
                c1 = wx * vx + wz * vz
                c2 = vx * vx + vz * vz
                if c2 > 0:
                    t = max(0, min(1, c1 / c2))
                    proj_x = w['x1'] + t * vx
                    proj_z = w['y1'] + t * vz
                    dist = ((x0 - proj_x)**2 + (z0 - proj_z)**2)**0.5
                    
                    if dist < 25: # CSG tolerance intersection
                        u_m = (t * wall_length_px) / scale
                        width_m = win.get('span_px', 40) / scale
                        wall_windows.append({
                            "u": round(u_m, 2),
                            "w": round(width_m, 2),
                            "h": 1.2,
                            "elevation": 1.0 # 1 meter off floor
                        })
        
        holds_win = len(wall_windows) > 0 or w.get('holds_window', False)
        wall_type = 'LOAD_BEARING' if holds_win else 'PARTITION'
        
        threejs_walls.append({
            "id": w['id'],
            "x1": round(x1_m, 3),
            "z1": round(z1_m, 3),
            "x2": round(x2_m, 3),
            "z2": round(z2_m, 3),
            "height": 3.0,
            "thickness": 0.23 if wall_type == 'LOAD_BEARING' else 0.12,
            "type": wall_type,
            "holds_window": holds_win,
            "span_metres": w.get('span_metres', 0),
            "windows": wall_windows
        })
        
    # Convert door openings to model-space coordinates
    doors_list = []
    for door in door_openings:
        dx_m = (door['x'] - center_x) / scale
        dz_m = (door['y'] - center_z) / scale
        span_m = door.get('span_px', 40) / scale
        doors_list.append({
            "x": round(dx_m, 3),
            "z": round(dz_m, 3),
            "width": round(max(0.7, span_m), 2),
            "height": 2.1
        })

    return {
        "walls": threejs_walls,
        "doors": doors_list,
        "slab": {
            "width": round(slab_w + 0.4, 2), 
            "depth": round(slab_d + 0.4, 2),
            "thickness": 0.15
        },
        "scale": scale
    }
