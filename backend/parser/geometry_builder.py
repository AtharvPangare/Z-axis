import math
import networkx as nx

def _wall_holds_window(w, windows, tol=35.0):
    x1, y1 = w['x1'], w['y1']
    x2, y2 = w['x2'], w['y2']
    dx, dy = x2 - x1, y2 - y1
    seg_len_sq = dx * dx + dy * dy
    if seg_len_sq == 0:
        return False
        
    for win in windows:
        wx, wy = win.get('x', 0), win.get('y', 0)
        t = max(0.0, min(1.0, ((wx - x1) * dx + (wy - y1) * dy) / seg_len_sq))
        proj_x = x1 + t * dx
        proj_y = y1 + t * dy
        dist = math.hypot(wx - proj_x, wy - proj_y)
        if dist <= tol:
            return True
    return False

def build_geometry(parsed_data):
    """
    Takes parsed geometry data, maps walls to scale, and classifies walls into:
      1. LOAD_BEARING: Walls that hold a window opening (or outer envelope fallback).
      2. PARTITION: Non-load-bearing walls without any window.
    """
    walls = parsed_data.get('walls', [])
    openings = parsed_data.get('openings', [])
    windows = [o for o in openings if o.get('type') == 'Window']
    
    if not walls:
        return parsed_data
        
    min_x = min([min(w['x1'], w['x2']) for w in walls])
    max_x = max([max(w['x1'], w['x2']) for w in walls])
    min_y = min([min(w['y1'], w['y2']) for w in walls])
    max_y = max([max(w['y1'], w['y2']) for w in walls])
    
    total_width_px = max_x - min_x
    if total_width_px == 0:
        total_width_px = 100
    
    # Scale: assume total plan width = 10 metres
    px_per_metre = total_width_px / 10.0
    
    has_windows = len(windows) > 0
    
    for w in walls:
        w['span_metres'] = round(w['length_px'] / px_per_metre, 2)
        
        if has_windows:
            holds_win = _wall_holds_window(w, windows, tol=35.0)
            if holds_win:
                w['type'] = 'LOAD_BEARING'
                w['classification'] = 'LOAD_BEARING'
                w['holds_window'] = True
            else:
                w['type'] = 'PARTITION'
                w['classification'] = 'PARTITION'
                w['holds_window'] = False
        else:
            # Fallback if plan contains no window annotations: outer envelope = load bearing
            is_outer_x = min(w['x1'], w['x2']) <= min_x + 30 or max(w['x1'], w['x2']) >= max_x - 30
            is_outer_y = min(w['y1'], w['y2']) <= min_y + 30 or max(w['y1'], w['y2']) >= max_y - 30
            if is_outer_x or is_outer_y or w['span_metres'] >= 4.5:
                w['type'] = 'LOAD_BEARING'
                w['classification'] = 'LOAD_BEARING'
                w['holds_window'] = True
            else:
                w['type'] = 'PARTITION'
                w['classification'] = 'PARTITION'
                w['holds_window'] = False
            
    parsed_data['scale_px_per_m'] = px_per_metre
    return parsed_data
