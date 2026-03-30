import json
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'material_db.json')

def load_materials():
    with open(DB_PATH, 'r') as f:
        return json.load(f)

def rank_materials(element_id, element_type, span_metres=0.0, room_context="general"):
    materials = load_materials()
    ranked = []
    
    is_long_span = span_metres > 5.0
    
    for mat in materials:
        c = mat['cost_score']
        s = mat['strength_score']
        d = mat['durability_score']
        
        # Per-room weighting adjustments
        if room_context == "wet-room":
            d = d * 1.5  # High durability needed for moisture
        elif room_context == "acoustic":
            s = s * 1.2  # Higher density materials often mean higher structural strength metrics
            
        # Long spans or columns logic
        if is_long_span or element_type == 'COLUMN':
            if mat['name'] not in ['Steel Frame', 'RCC']:
                continue  # Mandatory check for long spans
            score = (0.5 * s) + (0.4 * d) - (0.1 * c)
            
        # Load bearing logic
        elif element_type in ['LOAD_BEARING', 'SLAB']:
            score = (0.5 * s) + (0.3 * d) - (0.2 * c)
            
        # Partition logic
        elif element_type == 'PARTITION':
            score = (0.2 * s) + (0.3 * d) - (0.5 * c)
            
        else:
            score = 0
            
        ranked.append({
            "name": mat['name'],
            "score": round(score, 2),
            "cost": mat['cost'],
            "strength": mat['strength'],
            "durability": mat['durability']
        })
        
    # Sort by score descending
    ranked.sort(key=lambda x: x['score'], reverse=True)
    
    return {
        "element_id": element_id,
        "type": element_type,
        "span_metres": span_metres,
        "materials": ranked[:3]
    }
