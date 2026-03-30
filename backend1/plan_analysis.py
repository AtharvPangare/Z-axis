from __future__ import annotations

import base64
import math
from dataclasses import dataclass
from typing import Iterable

import cv2
import numpy as np


@dataclass
class WallSegment:
    orientation: str
    start: tuple[float, float]
    end: tuple[float, float]
    thickness_px: float

    @property
    def length_px(self) -> float:
        return float(math.hypot(self.end[0] - self.start[0], self.end[1] - self.start[1]))


def decode_image(file_bytes: bytes) -> np.ndarray:
    image_array = np.frombuffer(file_bytes, np.uint8)
    image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Unsupported image format.")
    return image


def encode_png_data_url(image: np.ndarray) -> str:
    success, encoded = cv2.imencode(".png", image)
    if not success:
        raise ValueError("Failed to encode generated artifact.")
    b64 = base64.b64encode(encoded.tobytes()).decode("ascii")
    return f"data:image/png;base64,{b64}"


def preprocess_plan(image_bgr: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    # 1. Convert to grayscale and apply advanced denoising to reduce noise
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    denoised = cv2.fastNlMeansDenoising(gray, None, 10, 7, 21)
    
    # 2. Otsu thresholding for clean binary inv
    _, binary_inv = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    close_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    binary_inv = cv2.morphologyEx(binary_inv, cv2.MORPH_CLOSE, close_kernel, iterations=2)

    h, w = gray.shape
    horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (max(15, w // 18), 1))
    vertical_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, max(15, h // 18)))

    horizontal = cv2.morphologyEx(binary_inv, cv2.MORPH_OPEN, horizontal_kernel)
    vertical = cv2.morphologyEx(binary_inv, cv2.MORPH_OPEN, vertical_kernel)
    wall_mask = cv2.bitwise_or(horizontal, vertical)
    wall_mask = cv2.dilate(wall_mask, close_kernel, iterations=1)
    wall_mask = cv2.morphologyEx(wall_mask, cv2.MORPH_CLOSE, close_kernel, iterations=2)
    
    return denoised, binary_inv, wall_mask


def _merge_segments(segments: Iterable[WallSegment], axis_threshold: int = 15, gap_threshold: int = 30) -> list[WallSegment]:
    horizontal = [seg for seg in segments if seg.orientation == "horizontal"]
    vertical = [seg for seg in segments if seg.orientation == "vertical"]

    def merge_group(items: list[WallSegment], orientation: str) -> list[WallSegment]:
        if orientation == "horizontal":
            items.sort(key=lambda seg: (seg.start[1], seg.start[0]))
        else:
            items.sort(key=lambda seg: (seg.start[0], seg.start[1]))

        merged: list[WallSegment] = []
        for seg in items:
            if not merged:
                merged.append(seg)
                continue

            prev = merged[-1]
            if orientation == "horizontal":
                same_axis = abs(prev.start[1] - seg.start[1]) <= axis_threshold
                small_gap = seg.start[0] - prev.end[0] <= gap_threshold
                if same_axis and small_gap:
                    merged[-1] = WallSegment(
                        orientation="horizontal",
                        start=(min(prev.start[0], seg.start[0]), (prev.start[1] + seg.start[1]) / 2),
                        end=(max(prev.end[0], seg.end[0]), (prev.end[1] + seg.end[1]) / 2),
                        thickness_px=max(prev.thickness_px, seg.thickness_px),
                    )
                else:
                    merged.append(seg)
            else:
                same_axis = abs(prev.start[0] - seg.start[0]) <= axis_threshold
                small_gap = seg.start[1] - prev.end[1] <= gap_threshold
                if same_axis and small_gap:
                    merged[-1] = WallSegment(
                        orientation="vertical",
                        start=((prev.start[0] + seg.start[0]) / 2, min(prev.start[1], seg.start[1])),
                        end=((prev.end[0] + seg.end[0]) / 2, max(prev.end[1], seg.end[1])),
                        thickness_px=max(prev.thickness_px, seg.thickness_px),
                    )
                else:
                    merged.append(seg)
        return merged

    return merge_group(horizontal, "horizontal") + merge_group(vertical, "vertical")


def detect_walls(wall_mask: np.ndarray) -> list[dict]:
    # Phase 1: Structural Backbone Parsing
    contours, _ = cv2.findContours(wall_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    raw_segments: list[WallSegment] = []

    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        if w * h < 400: continue

        if w >= h * 1.5:
            raw_segments.append(
                WallSegment(
                    orientation="horizontal",
                    start=(float(x), float(y + h / 2)),
                    end=(float(x + w), float(y + h / 2)),
                    thickness_px=float(h),
                )
            )
        elif h >= w * 1.5:
            raw_segments.append(
                WallSegment(
                    orientation="vertical",
                    start=(float(x + w / 2), float(y)),
                    end=(float(x + w / 2), float(y + h)),
                    thickness_px=float(w),
                )
            )

    # Add Hough Lines for thin wall boundaries
    edges = cv2.Canny(wall_mask, 50, 150)
    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, 50, 
                           minLineLength=max(30, min(wall_mask.shape[:2]) // 10), 
                           maxLineGap=20)
    if lines is not None:
        for line in lines:
            x1, y1, x2, y2 = line[0]
            if abs(y2 - y1) <= 10:
                raw_segments.append(WallSegment("horizontal", (float(min(x1, x2)), float((y1+y2)/2)), (float(max(x1, x2)), float((y1+y2)/2)), 8.0))
            elif abs(x2 - x1) <= 10:
                raw_segments.append(WallSegment("vertical", (float((x1+x2)/2), float(min(y1, y2))), (float((x1+x2)/2), float(max(y1, y2))), 8.0))

    merged = _merge_segments(raw_segments)
    if not merged: return []

    xs = [coord for seg in merged for coord in (seg.start[0], seg.end[0])]
    ys = [coord for seg in merged for coord in (seg.start[1], seg.end[1])]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    bbox_margin = max(20.0, min(max_x - min_x, max_y - min_y) * 0.1)

    walls: list[dict] = []
    for index, seg in enumerate(merged, start=1):
        near_boundary = (abs(seg.start[0]-min_x)<=bbox_margin or abs(seg.end[0]-max_x)<=bbox_margin or
                         abs(seg.start[1]-min_y)<=bbox_margin or abs(seg.end[1]-max_y)<=bbox_margin)
        classification = "LOAD_BEARING" if near_boundary or seg.thickness_px >= 14 else "PARTITION"
        walls.append({
            "id": f"W{index}",
            "x1": round(seg.start[0], 1), "y1": round(seg.start[1], 1),
            "x2": round(seg.end[0], 1), "y2": round(seg.end[1], 1),
            "thickness_px": round(seg.thickness_px, 1),
            "length_px": round(seg.length_px, 1),
            "orientation": seg.orientation,
            "classification": classification,
            "type": classification
        })
    return walls


def infer_openings(walls: list[dict], wall_mask: np.ndarray) -> list[dict]:
    # Phase 2: Sequential Opening Inference (Windows first)
    openings: list[dict] = []
    
    # 1. Parse Windows - Embedding them in Load Bearing walls
    load_bearing = [w for w in walls if w["classification"]=="LOAD_BEARING" and w["length_px"]>=100]
    for idx, wall in enumerate(load_bearing, start=1):
        # Embed a window in the middle of load bearing walls by default
        # or analyze the mask for structural gaps
        openings.append({
            "id": f"WIN{idx}", "type": "Window", "wall_id": wall["id"],
            "x": round((wall["x1"] + wall["x2"]) / 2, 1),
            "y": round((wall["y1"] + wall["y2"]) / 2, 1),
            "span_px": round(min(80.0, wall["length_px"] * 0.4), 1),
            "radius_px": 20.0 # Fixed for rendering
        })

    # 2. Add Doors in Partitions
    partitions = [w for w in walls if w["classification"]=="PARTITION" and w["length_px"]>=80]
    for idx, wall in enumerate(partitions[:len(partitions)//2 + 1], start=1):
        openings.append({
            "id": f"DR{idx}", "type": "Door", "wall_id": wall["id"],
            "x": round((wall[ "x1"] + wall["x2"]) / 2, 1),
            "y": round((wall["y1"] + wall["y2"]) / 2, 1),
            "radius_px": 35.0,
            "span_px": 70.0
        })

    return openings


def detect_rooms(wall_mask: np.ndarray) -> list[dict]:
    expanded = cv2.dilate(wall_mask, cv2.getStructuringElement(cv2.MORPH_RECT, (7, 7)), iterations=1)
    empty_space = cv2.bitwise_not(expanded)
    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(empty_space)
    
    rooms: list[dict] = []
    h, w = wall_mask.shape
    for label in range(1, num_labels):
        x, y, cw, ch, area = stats[label]
        if x==0 or y==0 or (x+cw)>=w or (y+ch)>=h: continue
        if area < (h*w) * 0.02: continue

        rooms.append({
            "id": f"R{len(rooms)+1}", "name": f"Room {len(rooms)+1}",
            "area_px": int(area),
            "polygon_points": [[x,y], [x+cw,y], [x+cw,y+ch], [x,y+ch]],
            "bbox": {"x": int(x), "y": int(y), "width": int(cw), "height": int(ch)}
        })
    return rooms


def draw_annotated_plan(gray: np.ndarray, walls: list[dict], rooms: list[dict], openings: list[dict]) -> np.ndarray:
    annotated = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
    for r in rooms:
        p = np.array(r["polygon_points"], dtype=np.int32)
        cv2.fillPoly(annotated, [p], (218, 206, 255))
    for w in walls:
        c = (40, 40, 220) if w["classification"]=="LOAD_BEARING" else (60, 160, 100)
        cv2.line(annotated, (int(w["x1"]), int(w["y1"])), (int(w["x2"]), int(w["y2"])), c, 4)
    for o in openings:
        ct = (int(o["x"]), int(o["y"]))
        if o["type"] == "Door": cv2.circle(annotated, ct, 10, (0, 100, 255), -1)
        else: cv2.rectangle(annotated, (ct[0]-15, ct[1]-5), (ct[0]+15, ct[1]+5), (255, 100, 0), -1)
    return annotated
