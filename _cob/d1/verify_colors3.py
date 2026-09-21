# 区2 验证 v3:无参考 k-means 量化(PIL median-cut),输出真实主色。
import sys
from PIL import Image

def kmeans_colors(path, k=10):
    im = Image.open(path).convert('RGB')
    q = im.quantize(colors=k, method=Image.MEDIANCUT)
    pal = q.getpalette()
    counts = sorted(q.getcolors(), reverse=True)
    print(f"\n== {path.split(chr(92))[-1]}  ({im.width}x{im.height})")
    for cnt, idx in counts[:k]:
        r, g, b = pal[idx * 3: idx * 3 + 3]
        print(f"  #{r:02x}{g:02x}{b:02x}  ({r},{g},{b})  {cnt * 100 // (im.width * im.height):3d}%")

if __name__ == '__main__':
    base = r'D:\project\rules\_cob\d1'
    for q in sys.argv[1:] or ['q1.png', 'q2.png', 'q2left.png', 'q5.png']:
        kmeans_colors(f'{base}\\{q}')
