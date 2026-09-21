# D4: annulus color measurement with background flattening
from PIL import Image
import numpy as np, re, glob

im = Image.open(r"D:\project\rules\_cob\d1\se_board_full.png").convert("RGB")
W, H = im.size
A = np.asarray(im).astype(np.float32) / 255.0

cells = {
    "p1a": (432, 221), "p1b": (542, 222), "p1c": (376, 316), "p1d": (432, 411),
    "p2a": (1282, 226), "p2b": (1392, 226), "p2c": (1450, 320), "p2d": (1394, 416),
    "p3a": (1352, 569), "p3b": (1450, 626), "p3d": (1450, 735),
    "p4a": (1361, 938), "p4b": (1414, 1036), "p4c": (1248, 1133), "p4d": (1359, 1131),
    "p5a": (466, 934), "p5b": (368, 948), "p5c": (408, 1030), "p5d": (462, 1126), "p5e": (574, 1130),
    "p6a": (470, 567), "p6b": (375, 620), "p6c": (374, 734), "p6d": (472, 782),
    "x3c": (1338, 677), "x6mid": (478, 675),
}

# reference corner patches of pure families (measured clean cells)
refs = {
    "tan":      (432, 221),
    "gold":     (1282, 226),
    "chart":    (376, 316),
    "teal":     (432, 411),
    "red":      (542, 222),
}

def annulus_stats(cx, cy, r0=26, r1=40):
    y0, y1 = max(0, cy-60), min(H, cy+60)
    x0, x1 = max(0, cx-60), min(W, cx+60)
    ys, xs = np.mgrid[y0:y1, x0:x1]
    d2 = (xs-cx)**2 + (ys-cy)**2
    m = (d2 >= r0*r0) & (d2 <= r1*r1)
    px = A[y0:y1, x0:x1][m]
    if len(px) == 0: return None
    r, g, b = px[:, 0], px[:, 1], px[:, 2]
    mx, mn = px.max(1), px.min(1)
    s = (mx - mn) / np.maximum(mx, 1e-6)
    v = mx
    # hue
    hh = np.zeros(len(px))
    dd = mx - mn
    for i in range(len(px)):
        if dd[i] < 1e-6: hh[i] = -1
        elif mx[i] == r[i]: hh[i] = ((g[i]-b[i])/dd[i]) % 6 * 60
        elif mx[i] == g[i]: hh[i] = ((b[i]-r[i])/dd[i] + 2) * 60
        else: hh[i] = ((r[i]-g[i])/dd[i] + 4) * 60
    satm = s > 0.18
    med = np.median(px, 0)
    return dict(mean=px.mean(0), med=med, satpct=100*satm.mean(), v=v.mean(), hue_med=(np.median(hh[satm]) if satm.sum()>5 else float('nan')))

print("cell  medRGB              sat%   V    hue")
for name, (cx, cy) in cells.items():
    st = annulus_stats(cx, cy)
    m = st['med']
    print(f"{name:5s} ({m[0]:.2f},{m[1]:.2f},{m[2]:.2f})  {st['satpct']:3.0f}  {st['v']:.2f}  {st['hue_med']:.0f}")
