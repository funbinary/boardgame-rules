# D4: robust hex detection on native board image
import cv2, json
import numpy as np

img = cv2.imread(r"D:/project/rules/_cob/d1/se_board_full.png")
H, W = img.shape[:2]
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
found = {}
for lo, hi in [(30,90),(50,140),(70,180),(90,220),(120,260),(150,300)]:
    edges = cv2.Canny(gray, lo, hi)
    edges = cv2.dilate(edges, cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(3,3)))
    cnts,_ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    for c in cnts:
        a = cv2.contourArea(c)
        if a < 2500 or a > 40000: continue
        peri = cv2.arcLength(c, True)
        ap = cv2.approxPolyDP(c, 0.03*peri, True)
        if len(ap) < 6 or len(ap) > 8: continue
        if not cv2.isContourConvex(ap): continue
        x,y,w,h = cv2.boundingRect(ap)
        if not (0.7 < w/h < 1.45): continue
        if not (55 < w < 140 and 55 < h < 140): continue
        cx,cy = x+w/2, y+h/2
        if cx < 100 or cx > W-100 or cy < 100 or cy > H-90: continue
        key = (round(cx/12), round(cy/12))
        # keep the largest per neighborhood
        if key not in found or found[key][2] < w*h:
            found[key] = (cx, cy, w*h, w, h)
hexes = sorted(found.values(), key=lambda t: (t[1], t[0]))
print("hexes:", len(hexes))
for cx, cy, area, w, h in hexes:
    print(f"  ({cx:6.0f},{cy:6.0f}) w={w:3.0f} h={h:3.0f}")

# cluster with radius 260
n = len(hexes)
parent = list(range(n))
def find(i):
    while parent[i] != i:
        parent[i] = parent[parent[i]]; i = parent[i]
    return i
for i in range(n):
    for j in range(i+1, n):
        d = ((hexes[i][0]-hexes[j][0])**2 + (hexes[i][1]-hexes[j][1])**2) ** 0.5
        if d < 260: parent[find(i)] = find(j)
groups = {}
for i in range(n): groups.setdefault(find(i), []).append(hexes[i])
print("\ngroups:")
out = []
for k, v in sorted(groups.items(), key=lambda kv: -len(kv[1])):
    if len(v) >= 3:
        gx = sum(t[0] for t in v)/len(v); gy = sum(t[1] for t in v)/len(v)
        out.append({"cx": gx, "cy": gy, "members": [(round(t[0]),round(t[1])) for t in v]})
        print(f"  n={len(v)} center=({gx:.0f},{gy:.0f}) members={[ (round(t[0]),round(t[1])) for t in v]}")
json.dump({"hexes": [(t[0],t[1],t[3],t[4]) for t in hexes], "groups": out},
          open(r"D:/project/rules/_cob/d1/d4_hexes.json","w"), indent=1)
