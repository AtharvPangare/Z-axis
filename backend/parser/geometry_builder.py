import math
import networkx as nx
from shapely.geometry import LineString, Point, Polygon, MultiPolygon, MultiLineString

def build_geometry(parsed_data):
    """
    Takes parsed OpenCV data, maps walls to a junction graph, resolves duplicate 
    ghost lines, and classifies walls using Shapely topological analysis.
    """
    raw_walls = parsed_data.get('walls', [])
    openings = parsed_data.get('openings', [])
    
    if not raw_walls:
        return parsed_data
        
    # Standard scaling parameters
    min_x = min([min(w['x1'], w['x2']) for w in raw_walls])
    max_x = max([max(w['x1'], w['x2']) for w in raw_walls])
    total_width_px = max_x - min_x
    if total_width_px == 0: total_width_px = 100
    
    px_per_metre = total_width_px / 10.0
    parsed_data['scale_px_per_m'] = px_per_metre
    
    # ── Phase 0: Graph Construction (NetworkX) for Relational Lookups ──
    G = nx.Graph()
    for w in raw_walls:
        p1 = (round(w['x1']/20)*20, round(w['y1']/20)*20)
        p2 = (round(w['x2']/20)*20, round(w['y2']/20)*20)
        if p1 != p2:
            G.add_edge(p1, p2, id=w['id'], weight=w['length_px'])

    def get_degree(w):
        p1 = (round(w['x1']/20)*20, round(w['y1']/20)*20)
        p2 = (round(w['x2']/20)*20, round(w['y2']/20)*20)
        return (G.degree(p1) if p1 in G else 0) + (G.degree(p2) if p2 in G else 0)

    # ── Phase 1: Ghost Wall Pruning (Parallel Deduplication) ──
    walls_to_keep = []
    pruned_ids = set()
    
    # Pre-compute shapely geometry mapping
    slines = { w['id']: LineString([(w['x1'], w['y1']), (w['x2'], w['y2'])]) for w in raw_walls }
    
    for i, w1 in enumerate(raw_walls):
        if w1['id'] in pruned_ids:
            continue
            
        is_ghost = False
        l1 = slines[w1['id']]
        w1_mid = Point((w1['x1'] + w1['x2'])/2, (w1['y1'] + w1['y2'])/2)
        
        # Check against all subsequent walls
        for j in range(i + 1, len(raw_walls)):
            w2 = raw_walls[j]
            if w2['id'] in pruned_ids:
                continue
                
            l2 = slines[w2['id']]
            w2_mid = Point((w2['x1'] + w2['x2'])/2, (w2['y1'] + w2['y2'])/2)
            
            # Midpoint Distance: ensures lines run laterally alongside each other!
            # Standard .distance() measures endpoints, which accidentally deleted 
            # disconnected walls separated by doorways.
            # We use 30.0px to catch thicker parallel duplicate detections.
            if l1.distance(w2_mid) < 30.0 or l2.distance(w1_mid) < 30.0:
                dx1, dy1 = w1['x2'] - w1['x1'], w1['y2'] - w1['y1']
                dx2, dy2 = w2['x2'] - w2['x1'], w2['y2'] - w2['y1']
                
                len1 = math.hypot(dx1, dy1)
                len2 = math.hypot(dx2, dy2)
                
                if len1 == 0 or len2 == 0:
                    continue
                    
                # Vector Overlap Logic (Angle Tolerance approx ~25 degrees)
                dot = (dx1*dx2 + dy1*dy2) / (len1 * len2)
                if abs(abs(dot) - 1.0) < 0.10: 
                    # RESOLUTION: Length is the dominant indicator of a true structural line.
                    if len1 >= len2:
                        pruned_ids.add(w2['id']) # w2 is the fragmented ghost
                    else:
                        is_ghost = True
                        pruned_ids.add(w1['id']) # w1 is the fragmented ghost
                        break 
                        
        if not is_ghost:
            walls_to_keep.append(w1)
            
    # Purge the unselected ghost lines completely
    walls = walls_to_keep
    parsed_data['walls'] = walls

    # Gather explicit window coordinates as Shapely Points
    windows = [{"pt": Point(op['x'], op['y']), "op": op} for op in openings if op.get('type') == 'Window']
    
    # ── Phase 2: Nearest-Neighbor Window Bounding ──
    window_assignments = { w['id']: [] for w in walls }
    
    for win in windows:
        best_wall_id = None
        best_dist = float('inf')
        
        # Determine the definitive closest ownership using Shapely
        for w in walls:
            wall_line = LineString([(w['x1'], w['y1']), (w['x2'], w['y2'])])
            dist = wall_line.distance(win["pt"])
            if dist < best_dist and dist < 45.0: # strict upper bound limit
                best_dist = dist
                best_wall_id = w['id']
                
        if best_wall_id:
            window_assignments[best_wall_id].append({"x": win["pt"].x, "y": win["pt"].y})

    # ── Phase 3: Bounding-Box Geometry Classification ──
    min_x = min([min(w['x1'], w['x2']) for w in walls]) if walls else 0
    max_x = max([max(w['x1'], w['x2']) for w in walls]) if walls else 0
    min_y = min([min(w['y1'], w['y2']) for w in walls]) if walls else 0
    max_y = max([max(w['y1'], w['y2']) for w in walls]) if walls else 0

    for w in walls:
        w['span_metres'] = round(w['length_px'] / px_per_metre, 2)
        
        # Determine envelope perimeter placement using traditional heuristic bounding bounds
        is_outer_x = min(w['x1'], w['x2']) <= min_x + 30 or max(w['x1'], w['x2']) >= max_x - 30
        is_outer_y = min(w['y1'], w['y2']) <= min_y + 30 or max(w['y1'], w['y2']) >= max_y - 30
        is_exterior = is_outer_x or is_outer_y
                
        # Attach strict nearest-neighbor windows explicitly 
        w['windows_list'] = window_assignments[w['id']]
        has_window = len(w['windows_list']) > 0
        
        # Final Rule Enforcement Priority
        is_structural_anchor = get_degree(w) >= 5
        
        if is_exterior or has_window:
            w['type'] = 'LOAD_BEARING'
        elif w['span_metres'] >= 5.0 or is_structural_anchor:
            w['type'] = 'LOAD_BEARING'
        else:
            w['type'] = 'PARTITION' # Classified as an INTERIOR division
            
        w['is_exterior'] = is_exterior
        w['has_window'] = has_window
            
    return parsed_data
