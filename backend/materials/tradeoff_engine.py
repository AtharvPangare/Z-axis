"""
tradeoff_engine.py
==================
Hardcoded structural engineering specifications and material rankings
for two distinct wall classifications:
  1. LOAD_BEARING: Walls holding window openings (stress concentration & lintel requirements)
  2. PARTITION: Non-load-bearing walls without windows (lightweight dead-load reduction)
"""

LOAD_BEARING_SPEC = {
    "type_label": "Load-Bearing Wall (Window Holder)",
    "holds_window": True,
    "thickness": "230 mm (9-inch nominal)",
    "lintel_spec": "RCC M20/M25 Cast-in-situ Lintel with 4x10mm Fe500 TMT bars (200mm end bearing)",
    "structural_role": "Sustains upper slab/roof gravity loads and safely redistributes window opening shear stresses",
    "materials": [
        {
            "name": "Reinforced Cement Concrete (RCC M25)",
            "score": 0.95,
            "cost": "$115/m² (₹85/sq.ft)",
            "strength": "25.0 N/mm² (Very High)",
            "durability": "50+ Years (Class A)",
            "density": "2400 kg/m³",
            "fire_rating": "4 Hours",
            "thermal_conductivity": "1.25 W/m·K",
            "acoustic_stc": "52 dB"
        },
        {
            "name": "Class 1 Red Clay Brick (with RCC Lintel)",
            "score": 0.86,
            "cost": "$85/m² (₹70/sq.ft)",
            "strength": "10.5 N/mm² (High)",
            "durability": "40+ Years (Class A)",
            "density": "1900 kg/m³",
            "fire_rating": "4 Hours",
            "thermal_conductivity": "0.80 W/m·K",
            "acoustic_stc": "48 dB"
        },
        {
            "name": "High-Strength Fly Ash Brick (Class 10)",
            "score": 0.81,
            "cost": "$75/m² (₹60/sq.ft)",
            "strength": "10.0 N/mm² (High)",
            "durability": "35+ Years (Standard)",
            "density": "1750 kg/m³",
            "fire_rating": "3 Hours",
            "thermal_conductivity": "0.72 W/m·K",
            "acoustic_stc": "46 dB"
        }
    ],
    "explanation": (
        "LOAD-BEARING WALL (WINDOW HOLDER): This wall accommodates window fenestrations, "
        "creating localized stress concentrations at the jambs. To prevent diagonal shear cracking, "
        "an RCC M20/M25 lintel beam reinforced with Fe 500 steel rebars is mandatory across the window aperture "
        "with a minimum 200 mm bearing. Heavy-duty 230 mm Class 1 Brick masonry (compressive strength 10.5–25.0 N/mm²) "
        "or RCC is specified to safely transfer overhead slab/roof loads around the opening to the foundation."
    )
}

PARTITION_SPEC = {
    "type_label": "Non-Load-Bearing Partition (No Window)",
    "holds_window": False,
    "thickness": "100–150 mm (4–6 inch nominal)",
    "lintel_spec": "None required (Continuous solid partition without openings)",
    "structural_role": "Interior room subdivision and acoustic/thermal isolation; carries self-weight only",
    "materials": [
        {
            "name": "Autoclaved Aerated Concrete (AAC) Blocks",
            "score": 0.92,
            "cost": "$48/m² (₹55/sq.ft)",
            "strength": "4.0 N/mm² (Optimal Infill)",
            "durability": "40+ Years (Class A)",
            "density": "600 kg/m³ (Lightweight)",
            "fire_rating": "4 Hours",
            "thermal_conductivity": "0.16 W/m·K",
            "acoustic_stc": "42 dB"
        },
        {
            "name": "Hollow Concrete Partition Blocks",
            "score": 0.80,
            "cost": "$42/m² (₹48/sq.ft)",
            "strength": "3.5 N/mm² (Standard)",
            "durability": "30+ Years (Standard)",
            "density": "1100 kg/m³",
            "fire_rating": "2 Hours",
            "thermal_conductivity": "0.45 W/m·K",
            "acoustic_stc": "38 dB"
        },
        {
            "name": "Drywall Steel Stud with Gypsum Infill",
            "score": 0.73,
            "cost": "$36/m² (₹40/sq.ft)",
            "strength": "2.5 N/mm² (Partition)",
            "durability": "20+ Years (Dry System)",
            "density": "45 kg/m³",
            "fire_rating": "1 Hour",
            "thermal_conductivity": "0.19 W/m·K",
            "acoustic_stc": "40 dB"
        }
    ],
    "explanation": (
        "NON-LOAD-BEARING PARTITION WALL (NO WINDOW): Internal room separation carrying self-weight only "
        "with zero window apertures. Autoclaved Aerated Concrete (AAC) Blocks (Grade 1, IS 2185) are specified. "
        "Their lightweight density (600 kg/m³) cuts superstructure dead load on floor slabs by over 50%, "
        "reducing seismic vulnerability. Superior thermal resistance (0.16 W/m·K) and 42 dB sound insulation "
        "provide optimal residential comfort at minimum cost."
    )
}

def rank_materials(element_id, element_type, span_metres=0.0, holds_window=False):
    """
    Returns hardcoded structural material specifications and engineering data
    strictly categorized by wall type:
      - LOAD_BEARING: holds window
      - PARTITION: without window
    """
    is_load_bearing = (element_type == 'LOAD_BEARING') or holds_window
    spec = LOAD_BEARING_SPEC if is_load_bearing else PARTITION_SPEC
    
    return {
        "element_id": element_id,
        "type": "LOAD_BEARING" if is_load_bearing else "PARTITION",
        "type_label": spec["type_label"],
        "holds_window": spec["holds_window"],
        "span_metres": span_metres,
        "thickness": spec["thickness"],
        "lintel_spec": spec["lintel_spec"],
        "structural_role": spec["structural_role"],
        "materials": spec["materials"],
        "explanation": spec["explanation"]
    }
