import fitz
doc = fitz.open(r"D:\project\rules\_cob\cob-se-rulebook-en.pdf")
page = doc[3]
# regions in PDF points (full_150 px / 2.08333, + margin ~12pt)
crops = {
  "black_a": (198, 402, 274, 480),
  "h1_w":  (124, 415, 194, 490),
  "h2_nw": (158, 324, 228, 396),
  "h3_ne": (271, 340, 343, 415),
  "h4_e":  (254, 386, 329, 463),
  "h5_sw": (132, 487, 204, 562),
  "h6_se": (259, 484, 331, 559),
}
for name, box in crops.items():
    r = fitz.Rect(*box)
    pix = page.get_pixmap(dpi=500, clip=r)
    out = rf"D:\project\rules\_cob\d1\{name}.png"
    pix.save(out)
    print(name, pix.width, pix.height)
