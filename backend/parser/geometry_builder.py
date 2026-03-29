import math

def build_geometry(parsed_data):
    """
    Takes parsed OpenCV data (or fallback) and classifies walls.
    Adds 'type' and computes 'span_metres' assuming 10px = 1m as per prompt (or scaled to 10m).
    """
    walls = parsed_data.get('walls', [])
    
    if not walls:
        return parsed_data
        
    # Calculate bounding box to find total width in px
    min_x = min([min(w['x1'], w['x2']) for w in walls])
    max_x = max([max(w['x1'], w['x2']) for w in walls])
    min_y = min([min(w['y1'], w['y2']) for w in walls])
    max_y = max([max(w['y1'], w['y2']) for w in walls])
    
    total_width_px = max_x - min_x
    if total_width_px == 0: total_width_px = 100
    
    # Scale: prompt says "assume total plan width = 10 metres"
    px_per_metre = total_width_px / 10.0
    
    for w in walls:
        w['span_metres'] = round(w['length_px'] / px_per_metre, 2)
        
        # Classification
        # LOAD_BEARING if on outer boundary
        is_outer_x = min(w['x1'], w['x2']) <= min_x + 20 or max(w['x1'], w['x2']) >= max_x - 20
        is_outer_y = min(w['y1'], w['y2']) <= min_y + 20 or max(w['y1'], w['y2']) >= max_y - 20
        
        if is_outer_x or is_outer_y or w['span_metres'] >= 5.0:
            w['type'] = 'LOAD_BEARING'
        else:
            # PARTITION if interior and short
            w['type'] = 'PARTITION'
            
    parsed_data['scale_px_per_m'] = px_per_metre
    return parsed_data
