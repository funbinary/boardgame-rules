# D4: gap-fill hex detection via edge-template matching in 6 regions
import cv2
import numpy as np

img = cv2.imread(r"D:/project/rules/_cob/d1/se_board_full.png")
H, W = img.shape[:2]
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)
# gradient magnitude
gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
mag = np.sqrt(gx*gx + gy*gy)
mag = cv2.GaussianBlur(mag, (3,3), 0)

regions = {
    "TL": (250, 100, 700, 560),
    "ML": (280, 480, 660, 900),
    "BL": (280, 820, 680, 1200),
    "TR": (1180, 100, 1560, 560),
    "MR": (1250, 460, 1560, 860),
    "BR": (1180, 820, 1560, 1200),
}

known = [(432,221),(542,222),(376,316),(432,411),(493,320),
         (1282,226),(1392,226),(1450,320),(1394,416),
         (1352,569),(1450,626),(1338,677),(1450,735),
         (1361,938),(1414,1036),(1248,1133),(1359,1131),
         (466,934),(368,948),(408,1030),(462,1126),(574,1130),
         (470,567),(375,620),(374,734),(472,782),(488,674)]

for rn, (x0, y0, x1, y1) in regions.items():
    # hexagon edge template: ring of a flat-top hexagon ~ w78
    best = []
    for wsize in (72, 80):
        hsize = int(wsize * 1.08)
        t = np.zeros((hsize, wsize), np.float32)
        pts = np.array([[wsize/2, 2], [wsize-2, hsize*0.25], [wsize-2, hsize*0.75],
                        [wsize/2, hsize-2], [2, hsize*0.75], [2, hsize*0.25]], np.int32)
        cv2.polylines(t, [pts], True, 1.0, 3)
        t /= t.sum()
        res = cv2.matchTemplate(mag[y0:y1, x0:x1], t, cv2.TM_CCOEFF_NORMED)
        ys, xs = np.nonzero(res > 0.45)
        for x, y in zip(xs, ys):
            best.append((float(res[y, x]), x + x0 + wsize/2, y + y0 + hsize/2))
    # nms
    best.sort(reverse=True)
    kept = []
    for s, cx, cy in best:
        if all((cx-kx)**2 + (cy-ky)**2 > 45**2 for kx, ky in [k[1:] for k in kept]):
            kept.append((s, cx, cy))
    print(f"\n{rn}:")
    for s, cx, cy in kept[:12]:
        tag = "KNOWN" if any((cx-kx)**2+(cy-ky)**2 < 30**2 for kx,ky in known) else "NEW  "
        print(f"  {tag} ({cx:.0f},{cy:.0f}) score={s:.2f}")
