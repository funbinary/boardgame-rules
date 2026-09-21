# 区2 像素级颜色验证:对 D1 裁剪图做六色目标聚类的质量统计。
# 标定:先跑高置信的 q1(应为 建筑,建筑,修道院,银矿),再跑待裁定的 q2。
import sys
from PIL import Image
from collections import Counter

REFS = {
    'yellow 修道院': (224, 185, 60),
    'blue 船':       (94, 123, 166),
    'red 城堡':      (140, 47, 57),
    'gray 银矿':     (154, 154, 154),
    'green 牲畜':    (106, 154, 88),
    'brown 建筑':    (141, 108, 68),
}

def classify(path, box=None, dist=60):
    im = Image.open(path).convert('RGB')
    if box:
        im = im.crop(box)
    im = im.resize((min(400, im.width), min(400, im.height)))
    counts = Counter()
    for px in im.getdata():
        best, bd = None, 1e9
        for name, ref in REFS.items():
            d = sum((a - b) ** 2 for a, b in zip(px, ref)) ** 0.5
            if d < bd:
                bd, best = d, name
        if bd < dist:
            counts[best] += 1
    total = sum(counts.values()) or 1
    print(f"\n== {path} box={box}")
    for name, n in counts.most_common():
        print(f"  {name:14s} {n:6d} px ({n * 100 // total}%)")

if __name__ == '__main__':
    base = r'D:\project\rules\_cob\d1'
    classify(f'{base}\\q1.png')       # 标定:期望 brown≫其他,有 yellow+gray
    classify(f'{base}\\q2.png')       # 裁定:gray 还是 brown/red?
    classify(f'{base}\\q5.png')       # 复核:{yellow,blue,gray,green}
