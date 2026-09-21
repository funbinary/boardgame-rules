from PIL import Image, ImageDraw, ImageFont
im = Image.open(r"D:\project\rules\_cob\d1\se_board_full.png").convert("RGB")
W,H = im.size
# scale down to 60% for readability, keep grid labels
sc = 0.6
im2 = im.resize((int(W*sc), int(H*sc)), Image.LANCZOS)
d = ImageDraw.Draw(im2)
w2,h2 = im2.size
cols, rows = 8, 6
cw, ch = w2/cols, h2/rows
try:
    font = ImageFont.truetype("arial.ttf", 22)
except:
    font = ImageFont.load_default()
for c in range(1,cols):
    d.line([(c*cw,0),(c*cw,h2)], fill=(255,0,255), width=2)
for r in range(1,rows):
    d.line([(0,r*ch),(w2,r*ch)], fill=(255,0,255), width=2)
for r in range(rows):
    for c in range(cols):
        d.text((c*cw+4, r*ch+2), f"{c+1}{r+1}", fill=(255,0,0), font=font)
im2.save(r"D:\project\rules\_cob\d1\se_board_grid.png")
print("saved", im2.size, "cell w=%.0f h=%.0f"%(cw,ch))
