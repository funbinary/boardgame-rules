# 区2 像素级验证 v2:紧阈值分类 → 粗网格 → 连通域面积(只有"成片实心六角填充"才算数)。
# 背景羊皮纸/插画纹理因颜色离散或色距远被排除;六角格实心填充形成大连通块。
import sys
from PIL import Image

REFS = {
    'yellow': ((224, 185, 60), '修道院'),
    'blue':   ((94, 123, 166), '船'),
    'red':    ((140, 47, 57), '城堡'),
    'gray':   ((154, 154, 154), '银矿'),
    'green':  ((106, 154, 88), '牲畜'),
    'brown':  ((141, 108, 68), '建筑'),
}
TIGHT = 34          # 紧色距
GRID = 70           # 采样网格

def blobs(path):
    im = Image.open(path).convert('RGB')
    im = im.resize((GRID, GRID))
    lab = [[None] * GRID for _ in range(GRID)]
    for y in range(GRID):
        for x in range(GRID):
            px = im.getpixel((x, y))
            best, bd = None, 1e9
            for name, (ref, _) in REFS.items():
                d = sum((a - b) ** 2 for a, b in zip(px, ref)) ** 0.5
                if d < bd:
                    bd, best = d, name
            lab[y][x] = best if bd < TIGHT else None
    seen = [[False] * GRID for _ in range(GRID)]
    out = []
    for y in range(GRID):
        for x in range(GRID):
            if lab[y][x] and not seen[y][x]:
                color = lab[y][x]
                stack, size = [(x, y)], 0
                seen[y][x] = True
                while stack:
                    cx, cy = stack.pop()
                    size += 1
                    for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < GRID and 0 <= ny < GRID and not seen[ny][nx] and lab[ny][nx] == color:
                            seen[ny][nx] = True
                            stack.append((nx, ny))
                out.append((size, color))
    out.sort(reverse=True)
    print(f"\n== {path.split(chr(92))[-1]}")
    for size, color in out[:8]:
        if size >= 8:
            print(f"  {color:7s}{REFS[color][1]:4s} 连通块 {size:4d} 格点")
    return out

if __name__ == '__main__':
    base = r'D:\project\rules\_cob\d1'
    for q in ('q1', 'q2', 'q5'):
        blobs(f'{base}\\{q}.png')
