# D4 recheck step 1: locate depot hex clusters by color segmentation on native-res assembled board.
import numpy as np
from PIL import Image

img = Image.open(r"D:\project\rules\_cob\d1\se_board_full.png").convert("RGB")
a = np.asarray(img).astype(np.float32) / 255.0
H, W, _ = a.shape
print("image", W, "x", H)

r, g, b = a[..., 0], a[..., 1], a[..., 2]
mx = a.max(-1); mn = a.min(-1)
v = mx
s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
hue = np.zeros_like(mx)
d = mx - mn
mask = d > 1e-6
rr, gg, bb = r[mask], g[mask], b[mask]
mxm, mnm = mx[mask], mn[mask]
dm = d[mask]
h = np.zeros_like(mxm)
im = mxm == rr
h[im] = ((gg[im] - bb[im]) / dm[im]) % 6
im2 = mxm == gg
h[im2] = (bb[im2] - rr[im2]) / dm[im2] + 2
im3 = mxm == bb
h[im3] = (rr[im3] - gg[im3]) / dm[im3] + 4
hue[mask] = h * 60.0

cats = {
    "yellow": [(35, 65)],
    "green":  [(75, 160)],
    "blue":   [(185, 255)],
    "red":    [(335, 360), (0, 18)],
    "brown":  [(18, 35)],
}

# density grid
cs = 8
gh, gw = H // cs, W // cs
for name, ranges in cats.items():
    m = np.zeros((H, W), bool)
    for lo, hi in ranges:
        m |= (hue >= lo) & (hue < hi)
    m &= (s > 0.30) & (v > 0.25)
    gm = m[:gh*cs, :gw*cs].reshape(gh, cs, gw, cs).sum((1, 3))
    # find dense cells: >= 32 of 64 pixels
    hot = gm >= 30
    ys, xs = np.nonzero(hot)
    pts = list(zip(xs.numpy() if hasattr(xs,'numpy') else xs.tolist(), ys.tolist())) if False else [(int(x), int(y)) for x, y in zip(xs, ys)]
    # cluster pts greedily
    clusters = []
    for x, y in pts:
        placed = False
        for c in clusters:
            if abs(x - c["cx"]/c["n"]) < 10 and abs(y - c["cy"]/c["n"]) < 10:
                c["cx"] += x; c["cy"] += y; c["n"] += 1; placed = True; break
        if not placed:
            clusters.append({"cx": x, "cy": y, "n": 1})
    big = [c for c in clusters if c["n"] >= 6]
    print(f"\n{name}: {len(pts)} hot cells, {len(big)} clusters (n>=6)")
    for c in sorted(big, key=lambda c: -c["n"]):
        print(f"   center=({c['cx']/c['n']*cs+cs/2:.0f},{c['cy']/c['n']*cs+cs/2:.0f}) cells={c['n']} size~{c['n']*cs*cs}px2")
