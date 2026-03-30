import math
import networkx as nx

def build_geometry(parsed_data):
    """
    Takes parsed OpenCV data, maps walls to a junction graph using NetworkX, 
    and classifies walls based on graph centrality, node degrees, and envelope bounding.
    """
    walls = parsed_data.get('walls', [])
    
    if not walls:
        return parsed_data
        
    min_x = min([min(w['x1'], w['x2']) for w in walls])
    max_x = max([max(w['x1'], w['x2']) for w in walls])
    min_y = min([min(w['y1'], w['y2']) for w in walls])
    max_y = max([max(w['y1'], w['y2']) for w in walls])
    
    total_width_px = max_x - min_x
    if total_width_px == 0: total_width_px = 100
    
    # Scale: prompt assumes total plan width = 10 metres
    px_per_metre = total_width_px / 10.0
    
    # Graph Construction
    G = nx.Graph()
    for w in walls:
        # Snap endpoints to a 20px grid to merge proximal joints
        p1 = (round(w['x1']/20)*20, round(w['y1']/20)*20)
        p2 = (round(w['x2']/20)*20, round(w['y2']/20)*20)
        
        # Avoid self-loops
        if p1 != p2:
            G.add_edge(p1, p2, id=w['id'], weight=w['length_px'])
            
    for w in walls:
        w['span_metres'] = round(w['length_px'] / px_per_metre, 2)
        
        p1 = (round(w['x1']/20)*20, round(w['y1']/20)*20)
        p2 = (round(w['x2']/20)*20, round(w['y2']/20)*20)
        
        node_degree = 0
        if p1 in G: node_degree += G.degree(p1)
        if p2 in G: node_degree += G.degree(p2)
        
        # Envelope detection
        is_outer_x = min(w['x1'], w['x2']) <= min_x + 30 or max(w['x1'], w['x2']) >= max_x - 30
        is_outer_y = min(w['y1'], w['y2']) <= min_y + 30 or max(w['y1'], w['y2']) >= max_y - 30
        
        # High connectivity structural anchors
        is_structural_anchor = node_degree >= 5
        
        if is_outer_x or is_outer_y or w['span_metres'] >= 5.0 or is_structural_anchor:
            w['type'] = 'LOAD_BEARING'
        else:
            w['type'] = 'PARTITION'
            
    parsed_data['scale_px_per_m'] = px_per_metre
    return parsed_data
