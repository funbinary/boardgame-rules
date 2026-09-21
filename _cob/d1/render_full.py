import fitz
doc = fitz.open(r"D:\project\rules\_cob\cob-se-rulebook-en.pdf")
page = doc[3]
print("page rect:", page.rect)
pix = page.get_pixmap(dpi=150)
pix.save(r"D:\project\rules\_cob\d1\full_150.png")
print("saved", pix.width, pix.height)
