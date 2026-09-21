from PIL import Image
im = Image.open(r"D:\project\rules\_cob\d1\se_board_full.png")
chunks = {
 "cTL": (0,60,640,620), "cTM": (560,60,1180,620), "cTR": (1100,60,1742,620),
 "cML": (0,560,640,1120), "cCM": (560,560,1180,1120), "cMR": (1100,560,1742,1120),
 "cBL": (0,1060,640,1287), "cBM": (560,1060,1180,1287), "cBR": (1100,1060,1742,1287),
}
for n,b in chunks.items():
    im.crop(b).save(rf"D:\project\rules\_cob\d1\{n}.png")
    print(n,b)
