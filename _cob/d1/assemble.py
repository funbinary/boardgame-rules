from PIL import Image
x80 = Image.open(r"D:\project\rules\_cob\d1\x80.jpeg")
x81 = Image.open(r"D:\project\rules\_cob\d1\x81.jpeg")
x70 = Image.open(r"D:\project\rules\_cob\d1\x70.jpeg")
W = x80.width + x81.width  # 1742 (ignore 2px overlap)
H = x80.height + x70.height
board = Image.new("RGB", (W, H))
board.paste(x80, (0, 0))
board.paste(x81, (x80.width, 0))
board.paste(x70, (0, x80.height))
board.save(r"D:\project\rules\_cob\d1\se_board_full.png")
print("assembled", board.size)

# label centers in pt -> px (scale 4.1665, origin 101.36,420.52)
def px(x_pt, y_pt): return ((x_pt-101.36)*4.1665, (y_pt-420.52)*4.1663)
labels = {
 "H1": (245.9,496.2), "H2": (401.9,501.1), "H3": (396.3,577.4),
 "H4": (246.6,583.8), "H5": (255.1,658.3), "H6": (386.3,653.6),
 "A":  (306.3,581.2),
}
crops = {}
for name,(xpt,ypt) in labels.items():
    cx, cy = px(xpt,ypt)
    box = (int(cx-260), int(cy-220), int(cx+260), int(cy+220))
    box = (max(0,box[0]), max(0,box[1]), min(W,box[2]), min(H,box[3]))
    board.crop(box).save(rf"D:\project\rules\_cob\d1\w_{name}.png")
    print(name, "center=(%.0f,%.0f)"%(cx,cy), "->", box)
