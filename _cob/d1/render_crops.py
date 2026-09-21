import fitz
doc = fitz.open(r"D:\project\rules\_cob\cob-se-rulebook-en.pdf")
page = doc[3]
# regions in PDF points (converted from 150dpi px / 2.0833, with margin)
crops = {
  "board":   (70, 365, 395, 730),
  "depot_tl": (132, 410, 233, 511),
  "depot_tr": (266, 420, 367, 525),
  "depot_r":  (266, 511, 367, 612),
  "depot_br": (257, 597, 362, 703),
  "depot_bl": (137, 597, 242, 703),
  "depot_l":  (113, 511, 208, 612),
  "black_c":  (200, 495, 299, 600),
}
for name, box in crops.items():
    r = fitz.Rect(*box)
    pix = page.get_pixmap(dpi=500, clip=r)
    out = rf"D:\project\rules\_cob\d1\{name}.png"
    pix.save(out)
    print(name, pix.width, pix.height)
