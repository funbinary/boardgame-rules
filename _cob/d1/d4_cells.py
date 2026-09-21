# D4: per-cell crops + objective color stats
from PIL import Image
import numpy as np

im = Image.open(r"D:\project\rules\_cob\d1\se_board_full.png").convert("RGB")
W, H = im.size
A = np.asarray(im).astype(np.float32) / 255.0

cells = {
    # depot 1 = TL
    "p1a": (432, 221), "p1b": (542, 222), "p1c": (376, 316), "p1d": (432, 411),
    # depot 2 = TR
    "p2a": (1282, 226), "p2b": (1392, 226), "p2c": (1450, 320), "p2d": (1394, 416),
    # depot 3 = MR (E)
    "p3a": (1352, 569), "p3b": (1450, 626), "p3c": (1338, 677), "p3d": (1450, 735),
    # depot 4 = BR (SE)
    "p4a": (1361, 938), "p4b": (1414, 1036), "p4c": (1248, 1133), "p4d": (1359, 1131),
    # depot 5 = BL (SW)
    "p5a": (466, 934), "p5b": (368, 948), "p5c": (408, 1030), "p5d": (462, 1126), "p5e": (574, 1130),
    # depot 6 = ML (W)
    "p6a": (470, 567), "p6b": (375, 620), "p6c": (374, 734), "p6d": (472, 782),
    # goods hex depot1 (pip check)
    "g1": (493, 320),
}

def hue_deg(px):
    r, g, b = px
    mx, mn = max(r, g, b), min(r, g, b)
    d = mx - mn
    if d < 1e-6: return 0.0
    if mx == r: h = ((g - b) / d) % 6
    elif mx == g: h = (b - r) / d + 2
    else: h = (r - g) / d + 4
    return h * 60

for name, (cx, cy) in cells.items():
    hw, hh = 55, 60
    box = (max(0, cx-hw), max(0, cy-hh), min(W, cx+hw), min(H, cy+hh))
    c = im.crop(box)
    c3 = c.resize((c.width*3, c.height*3), Image.LANCZOS)
    c3.save(rf"D:\project\rules\_cob\d1\cell_{name}.png")
    # color stats: central disk r=18
    ys, xs = np.mgrid[box[1]:box[3], box[0]:box[2]]
    m = (xs-cx)**2 + ((ys-cy)*1.0)**2 < 19**2
    px = A[box[1]:box[3], box[0]:box[2]][m]
    mean = px.mean(0)
    s = (px.max(1) - px.min(1)) / np.maximum(px.max(1), 1e-6)
    v = px.max(1)
    hues = np.array([hue_deg(p) for p in px])
    sat_px = s > 0.25
    if sat_px.sum() > 10:
        hh_ = hues[sat_px]
        # circular mean
        ang = np.deg2rad(np.where(hh_ > 180, hh_-360, hh_))
        mh = np.rad2deg(np.arctan2(ang.sin() if hasattr(ang,'sin') else np.sin(ang).mean(), np.cos(ang).mean())) % 360
    else:
        mh = float('nan')
    print(f"{name} ({cx},{cy}) meanRGB=({mean[0]:.2f},{mean[1]:.2f},{mean[2]:.2f}) meanH={mh:.0f} sat%={100*sat_px.mean():.0f} meanV={v.mean():.2f}")
