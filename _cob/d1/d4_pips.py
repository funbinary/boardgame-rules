# D4: pip detection on ivory hexes (dark blobs on light bg)
from PIL import Image
import numpy as np

im = Image.open(r"D:\project\rules\_cob\d1\se_board_full.png").convert("RGB")
A = np.asarray(im).astype(np.float32) / 255.0
H, W, _ = A.shape

targets = {
    "TL_goods": (493, 320, 46),
    "ML_ivory": (478, 675, 34),
    "MR_ivory": (1338, 677, 34),
}

def dark_blobs(cx, cy, r):
    y0, y1 = max(0, cy - r), min(H, cy + r)
    x0, x1 = max(0, cx - r), min(W, cx + r)
    reg = A[y0:y1, x0:x1]
    lum = reg.mean(2)
    # local background: median
    bg = np.median(lum)
    dark = lum < bg - 0.25
    # connected components (4-conn) via simple BFS
    visited = np.zeros_like(dark, bool)
    blobs = []
    hh, ww = dark.shape
    for yy in range(hh):
        for xx in range(ww):
            if dark[yy, xx] and not visited[yy, xx]:
                stack = [(yy, xx)]; visited[yy, xx] = True
                pts = []
                while stack:
                    a, b = stack.pop()
                    pts.append((a, b))
                    for da, db in ((1,0),(-1,0),(0,1),(0,-1),(1,1),(-1,-1),(1,-1),(-1,1)):
                        na, nb = a+da, b+db
                        if 0 <= na < hh and 0 <= nb < ww and dark[na, nb] and not visited[na, nb]:
                            visited[na, nb] = True
                            stack.append((na, nb))
                if 4 <= len(pts) <= 400:
                    ys = [p[0] for p in pts]; xs = [p[1] for p in pts]
                    by = (max(ys)+min(ys))/2 + y0; bx = (max(xs)+min(xs))/2 + x0
                    blobs.append(dict(n=len(pts), cx=bx, cy=by, w=max(xs)-min(xs)+1, h=max(ys)-min(ys)+1))
    return blobs, bg

for name, (cx, cy, r) in targets.items():
    blobs, bg = dark_blobs(cx, cy, r)
    # pip-like blobs: roundish, size 8-90 px, aspect 0.6-1.6
    pips = [b for b in blobs if 0.55 < b['w']/max(b['h'],1) < 1.8 and 6 <= b['n'] <= 260 and 5 <= b['w'] <= 18 and 5 <= b['h'] <= 18]
    glyphs = [b for b in blobs if (b['w'] > 18 or b['h'] > 18) and b['n'] > 60]
    print(f"\n{name} bg={bg:.2f} blobs={len(blobs)}")
    print("  pip-like:", [(round(p['cx']), round(p['cy']), p['n']) for p in pips])
    print("  glyph-like:", [(round(g['cx']), round(g['cy']), g['w'], g['h']) for g in glyphs])
