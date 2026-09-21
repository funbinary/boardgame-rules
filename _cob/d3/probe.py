import pymupdf
doc = pymupdf.open(r"D:\project\rules\_cob\cob-se-rulebook-en.pdf")
print("pages:", len(doc))
for i in [0,1,2,10,11,26,27]:
    p = doc[i]
    print(i+1, p.rect, "rotation", p.rotation)
