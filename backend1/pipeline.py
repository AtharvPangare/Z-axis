from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

import cv2

from backend.materials import build_material_recommendations
from backend.plan_analysis import (
    decode_image,
    detect_rooms,
    detect_walls,
    draw_annotated_plan,
    encode_png_data_url,
    infer_openings,
    preprocess_plan,
)


OUTPUT_DIR = Path("outputs")
OUTPUT_DIR.mkdir(exist_ok=True)


def _nearest_wall(opening: dict, model_walls: list[dict]) -> dict | None:
    best = None
    best_distance = float("inf")
    for wall in model_walls:
        mx = (wall["x1_px"] + wall["x2_px"]) / 2
        my = (wall["y1_px"] + wall["y2_px"]) / 2
        dist = ((opening["x"] - mx) ** 2 + (opening["y"] - my) ** 2) ** 0.5
        if dist < best_distance:
            best_distance = dist
            best = wall
    return best


def _build_3d_model(walls: list[dict], openings: list[dict], width: int, height: int) -> dict:
    scale_px_per_metre = max(70.0, min(140.0, width / 8))
    model_walls: list[dict] = []

    for wall in walls:
        model_walls.append(
            {
                "id": wall["id"],
                "type": wall["classification"],
                "x1": round((wall["x1"] - width / 2) / scale_px_per_metre, 3),
                "z1": round((wall["y1"] - height / 2) / scale_px_per_metre, 3),
                "x2": round((wall["x2"] - width / 2) / scale_px_per_metre, 3),
                "z2": round((wall["y2"] - height / 2) / scale_px_per_metre, 3),
                "x1_px": wall["x1"],
                "y1_px": wall["y1"],
                "x2_px": wall["x2"],
                "y2_px": wall["y2"],
                "height": 3.1 if wall["classification"] == "LOAD_BEARING" else 2.8,
                "thickness": round(max(0.12, wall["thickness_px"] / scale_px_per_metre), 3),
                "span_metres": round(wall["length_px"] / scale_px_per_metre, 3),
                "length_px": wall["length_px"],
                "thickness_px": wall["thickness_px"],
                "windows": [],
            }
        )

    for opening in openings:
        if opening["type"] != "Window":
            continue

        wall = _nearest_wall(opening, model_walls)
        if not wall:
            continue

        wall["windows"].append(
            {
                "u": round(wall["span_metres"] / 2, 3),
                "w": round(max(0.5, opening["span_px"] / scale_px_per_metre), 3),
                "h": 1.2,
                "elevation": 1.0,
            }
        )

    for wall in model_walls:
        if "x1_px" in wall: wall.pop("x1_px")
        if "y1_px" in wall: wall.pop("y1_px")
        if "x2_px" in wall: wall.pop("x2_px")
        if "y2_px" in wall: wall.pop("y2_px")

    return {"scale": round(scale_px_per_metre, 2), "walls": model_walls}


def _save_outputs(stem: str, grayscale, annotated, payload: dict) -> dict:
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    slug = f"{Path(stem).stem or 'plan'}-{timestamp}"
    target_dir = OUTPUT_DIR / slug
    target_dir.mkdir(parents=True, exist_ok=True)

    gray_path = target_dir / "grayscale.png"
    annotated_path = target_dir / "annotated-2d.png"
    json_path = target_dir / "pipeline-output.json"

    cv2.imwrite(str(gray_path), grayscale)
    cv2.imwrite(str(annotated_path), annotated)
    json_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    return {
        "directory": str(target_dir.resolve()),
        "grayscale_path": str(gray_path.resolve()),
        "annotated_2d_path": str(annotated_path.resolve()),
        "json_path": str(json_path.resolve()),
    }


def run_pipeline(file_bytes: bytes, filename: str) -> dict:
    image = decode_image(file_bytes)
    gray, _binary_inv, wall_mask = preprocess_plan(image)

    walls = detect_walls(wall_mask)
    if not walls:
        raise ValueError("No wall-like geometry could be detected in the uploaded plan.")

    rooms = detect_rooms(wall_mask)
    openings = infer_openings(walls)
    annotated = draw_annotated_plan(gray, walls, rooms, openings)
    materials, explanations = build_material_recommendations(walls)

    height, width = gray.shape
    model = _build_3d_model(walls, openings, width, height)

    payload = {
        "status": "success",
        "message": "2D plan processed into grayscale, segmented layout, inferred openings, and 3D wall geometry.",
        "geom": {
            "image_size_px": {"width": width, "height": height},
            "walls": walls,
            "rooms": rooms,
            "openings": openings,
        },
        "model": model,
        "materials": materials,
        "explanations": explanations,
        "artifacts": {
            "grayscale_preview": encode_png_data_url(gray),
            "annotated_2d_preview": encode_png_data_url(annotated),
        },
    }

    payload["artifacts"].update(_save_outputs(filename, gray, annotated, payload))
    return payload
