"""
floor_plan_parser.py
====================
Clean 4-stage pipeline for structural element detection:

  Stage 1 ── Grayscale + clean binary  (threshold dark walls out)
  Stage 2 ── Wall detection            (HoughLinesP on skeleton)
  Stage 3 ── Window detection          (thin elongated contours ON walls)
  Stage 4 ── Door detection            (HoughCircles for arcs, filter by wall proximity)
  Stage 5 ── Room voids                (flood-fill inversion)
"""

import cv2
import numpy as np
import math


# ════════════════════════════════════════════════════════════════════════════
#   HELPER UTILITIES
# ════════════════════════════════════════════════════════════════════════════

def _skeletonize(binary_img: np.ndarray) -> np.ndarray:
    """Morphological skeleton — reduces thick walls to 1-pixel centerlines."""
    skeleton = np.zeros(binary_img.shape, np.uint8)
    elem     = cv2.getStructuringElement(cv2.MORPH_CROSS, (3, 3))
    work     = binary_img.copy()
    while True:
        eroded = cv2.erode(work, elem)
        temp   = cv2.dilate(eroded, elem)
        temp   = cv2.subtract(work, temp)
        skeleton = cv2.bitwise_or(skeleton, temp)
        work = eroded.copy()
        if cv2.countNonZero(work) == 0:
            break
    return skeleton


def _pt_to_seg_dist(px, py, x1, y1, x2, y2) -> float:
    """Minimum distance from point (px,py) to segment (x1,y1)-(x2,y2)."""
    dx, dy = x2 - x1, y2 - y1
    seg_len_sq = dx * dx + dy * dy
    if seg_len_sq == 0:
        return math.hypot(px - x1, py - y1)
    t = max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / seg_len_sq))
    return math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))


def _near_wall(walls: list, x: float, y: float, tol: float = 35) -> bool:
    """Return True if (x,y) lies within `tol` pixels of any wall segment."""
    for w in walls:
        if _pt_to_seg_dist(x, y, w["x1"], w["y1"], w["x2"], w["y2"]) <= tol:
            return True
    return False


def _wall_thickness(clean_bin: np.ndarray, x1, y1, x2, y2) -> float:
    """
    Estimate wall thickness by sampling a perpendicular strip at the midpoint
    and counting contiguous white pixels.
    """
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2
    angle  = math.atan2(y2 - y1, x2 - x1)
    perp   = angle + math.pi / 2
    span   = 30          # search ±30px perpendicular
    pts    = []
    for d in range(-span, span + 1):
        px = int(mx + d * math.cos(perp))
        py = int(my + d * math.sin(perp))
        h_img, w_img = clean_bin.shape[:2]
        if 0 <= px < w_img and 0 <= py < h_img:
            pts.append(clean_bin[py, px])
    # Count the longest run of 255 (wall) pixels
    max_run = cur_run = 0
    for v in pts:
        if v == 255:
            cur_run += 1
            max_run  = max(max_run, cur_run)
        else:
            cur_run  = 0
    return float(max(max_run, 4))  # minimum 4 px so the 3D mesh has depth


def _cluster_by_axis(walls: list, axis: str, tol: int = 18) -> list:
    """
    Group walls by their shared axis coordinate:
      axis='y'  → horizontal walls, grouped by average Y
      axis='x'  → vertical walls,   grouped by average X
    Returns a list of groups (each group is a list of walls).
    """
    if not walls:
        return []

    def coord(w):
        if axis == 'y':
            return (w['y1'] + w['y2']) // 2
        return (w['x1'] + w['x2']) // 2

    ordered = sorted(walls, key=coord)
    groups, cur = [], [ordered[0]]
    cur_val = coord(ordered[0])
    for w in ordered[1:]:
        v = coord(w)
        if abs(v - cur_val) <= tol:
            cur.append(w)
        else:
            groups.append(cur)
            cur, cur_val = [w], v
    groups.append(cur)
    return groups


def _detect_doors_from_gaps(walls: list,
                            min_door: int = 20,
                            max_door: int = 120) -> list:
    """
    Find gaps between consecutive collinear wall segments.
    A gap of the right size (min_door … max_door px) is a door opening.

    Strategy
    --------
    1. Classify each wall as horizontal (|angle| < 20°) or vertical (> 70°).
    2. Cluster near-parallel segments by shared coordinate.
    3. Within each cluster sort by position, measure gap between adjacent ends.
    4. Gap in range → door at gap centre.
    """
    h_walls, v_walls = [], []
    for w in walls:
        ang = math.degrees(math.atan2(
            abs(w['y2'] - w['y1']),
            abs(w['x2'] - w['x1'])
        ))
        if ang < 20:
            h_walls.append(w)
        elif ang > 70:
            v_walls.append(w)
        # diagonal walls skipped for gap detection

    doors = []

    # ── Horizontal clusters: group by Y, sort each cluster by X ──────────
    for group in _cluster_by_axis(h_walls, 'y'):
        segs = sorted(group, key=lambda w: min(w['x1'], w['x2']))
        for i in range(len(segs) - 1):
            right_end = max(segs[i]['x1'],  segs[i]['x2'])
            left_end  = min(segs[i+1]['x1'], segs[i+1]['x2'])
            gap = left_end - right_end
            if min_door <= gap <= max_door:
                gap_cx = (right_end + left_end) // 2
                gap_cy = (
                    segs[i]['y1'] + segs[i]['y2'] +
                    segs[i+1]['y1'] + segs[i+1]['y2']
                ) // 4
                doors.append({
                    "type":      "Door",
                    "x":         gap_cx,
                    "y":         gap_cy,
                    "radius_px": gap // 2
                })

    # ── Vertical clusters: group by X, sort each cluster by Y ────────────
    for group in _cluster_by_axis(v_walls, 'x'):
        segs = sorted(group, key=lambda w: min(w['y1'], w['y2']))
        for i in range(len(segs) - 1):
            bottom_end = max(segs[i]['y1'],  segs[i]['y2'])
            top_end    = min(segs[i+1]['y1'], segs[i+1]['y2'])
            gap = top_end - bottom_end
            if min_door <= gap <= max_door:
                gap_cy = (bottom_end + top_end) // 2
                gap_cx = (
                    segs[i]['x1'] + segs[i]['x2'] +
                    segs[i+1]['x1'] + segs[i+1]['x2']
                ) // 4
                doors.append({
                    "type":      "Door",
                    "x":         gap_cx,
                    "y":         gap_cy,
                    "radius_px": gap // 2
                })

    return doors


# ════════════════════════════════════════════════════════════════════════════
#   MAIN ENTRY POINT
# ════════════════════════════════════════════════════════════════════════════

def parse_floor_plan(image_path: str) -> dict:
    """
    Parameters
    ----------
    image_path : str   path to a floor-plan image (JPG / PNG)

    Returns
    -------
    dict with keys:  image_size_px, walls, rooms, openings
    """
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Could not read image: {image_path}")

    img_h, img_w = img.shape[:2]
    img_area     = img_h * img_w


    # ──────────────────────────────────────────────────────────────────────
    # STAGE 1 — Grayscale + Clean Binary
    # ──────────────────────────────────────────────────────────────────────
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Walls are dark (≤ 80 greyscale); everything brighter → background.
    # Using THRESH_BINARY_INV so walls become white (255) in wall_bin.
    _, wall_bin = cv2.threshold(gray, 80, 255, cv2.THRESH_BINARY_INV)

    # Remove tiny blobs: text characters, dimension arrows, noise.
    n_lab, labels, stats, _ = cv2.connectedComponentsWithStats(wall_bin, connectivity=8)
    clean_bin = np.zeros_like(wall_bin)
    for i in range(1, n_lab):
        area = stats[i, cv2.CC_STAT_AREA]
        bw   = stats[i, cv2.CC_STAT_WIDTH]
        bh   = stats[i, cv2.CC_STAT_HEIGHT]
        # Keep blobs that are either large (≥ 400 px²) or clearly elongated
        if area >= 400 or max(bw, bh) >= 55:
            clean_bin[labels == i] = 255


    # ──────────────────────────────────────────────────────────────────────
    # STAGE 2 — Wall Detection  (HoughLinesP on skeleton)
    # ──────────────────────────────────────────────────────────────────────
    # Light dilation merges 2-3 px gaps in wall edges before skeletonising.
    dil_k   = np.ones((3, 3), np.uint8)
    dilated = cv2.dilate(clean_bin, dil_k, iterations=1)
    skeleton = _skeletonize(dilated)

    raw_lines = cv2.HoughLinesP(
        skeleton, 1, np.pi / 180,
        threshold=35,      # minimum votes
        minLineLength=35,  # ignore very short fragments
        maxLineGap=18      # bridge small gaps
    )

    walls      = []
    _seen_lines = []   # (cx, cy, angle) for deduplication

    if raw_lines is not None:
        for seg in raw_lines:
            x1, y1, x2, y2 = seg[0]
            length = math.hypot(x2 - x1, y2 - y1)
            if length < 25:
                continue

            angle = math.degrees(math.atan2(y2 - y1, x2 - x1)) % 180
            cx, cy = (x1 + x2) / 2, (y1 + y2) / 2

            # Deduplicate: skip if a nearly-parallel line at the same position exists
            duplicate = False
            for (ox, oy, oa) in _seen_lines:
                ang_diff = min(abs(angle - oa), 180 - abs(angle - oa))
                if ang_diff < 12 and math.hypot(cx - ox, cy - oy) < 18:
                    duplicate = True
                    break
            if duplicate:
                continue
            _seen_lines.append((cx, cy, angle))

            thk = _wall_thickness(clean_bin, x1, y1, x2, y2)
            # Long lines (> 100 px) and thick walls → load-bearing
            classification = "LOAD_BEARING" if length > 100 or thk > 12 else "PARTITION"

            walls.append({
                "id":             f"w{len(walls)}",
                "x1": int(x1),    "y1": int(y1),
                "x2": int(x2),    "y2": int(y2),
                "length_px":      float(round(length, 1)),
                "thickness":      float(round(thk, 1)),
                "classification": classification
            })


    # ──────────────────────────────────────────────────────────────────────
    # STAGE 3 — Window Detection  (thin elongated contours on wall segments)
    # ──────────────────────────────────────────────────────────────────────
    # Use a looser threshold (150) so we also capture the lighter window
    # pane markings that are thinner than full wall lines.
    _, win_bin = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY_INV)

    win_contours, _ = cv2.findContours(win_bin, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

    openings = []
    _win_seen = []   # (x, y) to dedup overlapping window hits

    for c in win_contours:
        area = cv2.contourArea(c)
        if area < 50 or area > 3000:
            continue

        # Use minAreaRect to handle rotated windows
        rect              = cv2.minAreaRect(c)
        (rx, ry), (rw, rh), _ = rect
        long_side  = max(rw, rh)
        short_side = min(rw, rh)
        if short_side < 1:
            continue

        aspect = long_side / short_side

        # Windows: strongly elongated, width 20–180 px, thickness < 18 px
        if aspect >= 3.5 and 20 <= long_side <= 180 and short_side <= 18:
            if not _near_wall(walls, rx, ry, tol=30):
                continue  # ignore if far from any wall
            # Deduplicate windows that overlap
            dup = any(math.hypot(rx - wx, ry - wy) < 20 for (wx, wy) in _win_seen)
            if dup:
                continue
            _win_seen.append((rx, ry))
            openings.append({
                "type":    "Window",
                "x":       int(rx),
                "y":       int(ry),
                "span_px": int(round(long_side))
            })


    # ──────────────────────────────────────────────────────────────────────
    # STAGE 4 — Door Detection  (gaps between collinear wall segments)
    # ──────────────────────────────────────────────────────────────────────
    # Instead of looking for arcs, we find gaps between consecutive aligned
    # wall segments. A gap of 20–120 px on the same line = a door opening.
    doors = _detect_doors_from_gaps(walls, min_door=20, max_door=120)
    openings.extend(doors)


    # ──────────────────────────────────────────────────────────────────────
    # STAGE 5 — Room Voids  (close gaps then invert)
    # ──────────────────────────────────────────────────────────────────────
    close_k   = np.ones((22, 22), np.uint8)
    closed    = cv2.morphologyEx(clean_bin, cv2.MORPH_CLOSE, close_k)
    rooms_mask = cv2.bitwise_not(closed)

    r_contours, _ = cv2.findContours(rooms_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    rooms = []
    for c in r_contours:
        x, y, w, h = cv2.boundingRect(c)
        area = w * h
        if 0.015 * img_area < area < 0.50 * img_area and w > 30 and h > 30:
            rooms.append({
                "id":             f"r{len(rooms)}",
                "label":          f"ROOM {len(rooms)}",
                "polygon_points": [[x, y], [x+w, y], [x+w, y+h], [x, y+h]],
                "area_px":        float(area)
            })


    return {
        "image_size_px": {"width": img_w, "height": img_h},
        "walls":         walls,
        "rooms":         rooms,
        "openings":      openings
    }
