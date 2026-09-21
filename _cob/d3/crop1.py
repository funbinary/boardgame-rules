import pymupdf
doc = pymupdf.open(r"D:\project\rules\_cob\cob-se-rulebook-en.pdf")
p = doc[1]  # page 2 = contents (base game)
# whole tile strip region, generous
clip = pymupdf.Rect(150, 30, 465, 200)
pix = p.get_pixmap(dpi=500, clip=clip)
pix.save("d3/p02_tiles_strip.png")
print("saved", pix.width, pix.height)
# lower part of page: goods / silverlings etc.
clip2 = pymupdf.Rect(0, 600, 612, 825)
pix2 = p.get_pixmap(dpi=500, clip=clip2)
pix2.save("d3/p02_lower.png")
print("saved2", pix2.width, pix2.height)
