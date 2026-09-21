# D4: color radar sweep to find all family-colored hexes in regions
from PIL import Image
import numpy as np

im = Image.open(r"D:\project\rules\_cob\d1\se_board_full.png").convert("RGB")
W, H = im.size
A = np.asarray(im).astype(np.float32) / 255.0

fams = {
    "tan":   np.array([0.93, 0.82, 0.61]),
    "gold":  np.array([0.97, 0.81, 0.26]),
    "chart": np.array([0.76, 0.80, 0.28]),
    "dchart":np.array([0.56, 0.56, 0.29]),
    "teal":  np.array([0.47, 0.75, 0.71]),
    "red":   np.array([0.81, 0.27, 0.18]),
}

def disk_mean(cx, cy, r=20):
    y0, y1 = max(0, cy-r), min(H, cy+r)
    x0, x1 = max(0, cx-r), min(W, cx+r)
    ys, xs = np.mgrid[y0:y1, x0:x1]
    m = (xs-cx)**2 + (ys-cy)**2 <= r*r
    return A[y0:y1, x0:x1][m].mean(0)

regions = {
    "MR": (1180, 420, 1600, 860),
    "BL": (260, 840, 700, 1200),
    "ML": (300, 470, 660, 870),
    "TL": (300, 120, 660, 480),
    "TR": (1200, 120, 1560, 480),
    "BR": (1180, 840, 1600, 1200),
}

for rn, (x0, y0, x1, y1) in regions.items():
    hits = []
    for cy in range(y0, y1, 6):
        for cx in range(x0, x1, 6):
            c = disk_mean(cx, cy)
            for fn, fc in fams.items():
                if np.linalg.norm(c - fc) < 0.055:
                    hits.append((cx, cy, fn))
                    break
    # cluster hits by family+position
    out = {}
    for cx, cy, fn in hits:
        key = fn
        placed = False
        for e in out.get(key, []):
            if (e[0]-cx)**2 + (e[1]-cy)**2 < 55**2:
                placed = True; break
        if not placed:
            out.setdefault(key, []).append((cx, cy))
    print(f"\n{rn} region:")
    for fn, pts in sorted(out.items()):
        for p in pts:
            print(f"   {fn:7s} @ ({p[0]},{p[1]})")
