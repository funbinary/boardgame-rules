# D4: k-means dominant colors per cell crop
from PIL import Image
import numpy as np, glob, re

for f in sorted(glob.glob(r"D:\project\rules\_cob\d1\cell_*.png")):
    name = re.search(r"cell_(\w+)\.png", f).group(1)
    im = Image.open(f).convert("RGB")
    im = im.resize((60, 66))  # back to native-ish size
    a = np.asarray(im).astype(np.float32) / 255.0
    h, w, _ = a.shape
    # shrink crop to inner 70% to avoid neighboring hexes
    m0, m1 = int(h*0.15), int(h*0.85)
    n0, n1 = int(w*0.15), int(w*0.85)
    px = a[m0:m1, n0:n1].reshape(-1, 3)
    # simple k-means k=4
    rng = np.random.default_rng(0)
    k = 4
    C = px[rng.choice(len(px), k, replace=False)]
    for _ in range(25):
        d = ((px[:, None, :] - C[None, :, :]) ** 2).sum(-1)
        lab = d.argmin(1)
        for i in range(k):
            sel = px[lab == i]
            if len(sel): C[i] = sel.mean(0)
    counts = np.bincount(lab, minlength=k)
    order = counts.argsort()[::-1]
    parts = []
    for i in order:
        r, g, b = C[i]
        parts.append(f"({r:.2f},{g:.2f},{b:.2f})x{100*counts[i]/len(px):.0f}%")
    print(f"{name:4s} " + "  ".join(parts))
