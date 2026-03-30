from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class MaterialOption:
    name: str
    cost: str
    strength: str
    score: float


LOAD_BEARING_OPTIONS = (
    MaterialOption("Red Brick", "Medium", "High", 0.91),
    MaterialOption("Fly Ash Brick", "Low", "Medium-High", 0.84),
    MaterialOption("RCC Wall", "High", "Very High", 0.8),
)

PARTITION_OPTIONS = (
    MaterialOption("AAC Blocks", "Medium", "Medium", 0.93),
    MaterialOption("Hollow Block", "Low", "Medium", 0.87),
    MaterialOption("Gypsum Board", "Low", "Light Duty", 0.73),
)


def build_material_recommendations(walls: list[dict]) -> tuple[list[dict], list[str]]:
    materials: list[dict] = []
    explanations: list[str] = []

    for wall in walls:
        is_load_bearing = (wall.get("classification") or wall.get("type")) == "LOAD_BEARING"
        source = LOAD_BEARING_OPTIONS if is_load_bearing else PARTITION_OPTIONS

        options = [
            {
                "name": item.name,
                "cost": item.cost,
                "strength": item.strength,
                "score": round(item.score, 2),
            }
            for item in source
        ]

        materials.append(
            {
                "element_id": wall["id"],
                "type": "LOAD_BEARING" if is_load_bearing else "PARTITION",
                "materials": options,
            }
        )

        if is_load_bearing:
            explanations.append(
                f"{wall['id']} is treated as load-bearing because it sits on the outer structural envelope "
                f"or has a heavier wall thickness. Red Brick ranks highest here for balanced strength and cost."
            )
        else:
            explanations.append(
                f"{wall['id']} is treated as a partition wall because it sits inside the plan footprint. "
                f"AAC Blocks rank highest for lighter dead load and easier interior execution."
            )

    return materials, explanations
