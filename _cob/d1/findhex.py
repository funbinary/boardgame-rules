import cv2, json
img = cv2.imread(r"D:/project/rules/_cob/d1/se_board_full.png")
H,W = img.shape[:2]
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
edges = cv2.Canny(gray, 40, 120)
edges = cv2.dilate(edges, cv2.getStructuringElement(cv2.MORPH_RECT,(3,3)))
cnts,_ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
hexes=[]
for c in cnts:
    a = cv2.contourArea(c)
    if a < 2500 or a > 30000: continue
    peri = cv2.arcLength(c, True)
    ap = cv2.approxPolyDP(c, 0.02*peri, True)
    if len(ap) != 6: continue
    if not cv2.isContourConvex(ap): continue
    x,y,w,h = cv2.boundingRect(ap)
    if not (0.75 < w/h < 1.33): continue
    cx,cy = x+w/2, y+h/2
    if cx < 120 or cx > W-120 or cy < 120 or cy > H-110: continue  # drop scoring ring
    hexes.append({"cx":cx,"cy":cy,"w":w,"h":h,"x":x,"y":y})
print("hexes found:", len(hexes))
n=len(hexes); parent=list(range(n))
def find(i):
    while parent[i]!=i: parent[i]=parent[parent[i]]; i=parent[i]
    return i
for i in range(n):
    for j in range(i+1,n):
        d=((hexes[i]["cx"]-hexes[j]["cx"])**2+(hexes[i]["cy"]-hexes[j]["cy"])**2)**.5
        if d<170: parent[find(i)]=find(j)
groups={}
for i in range(n): groups.setdefault(find(i),[]).append(hexes[i])
out=[]
for k,v in groups.items():
    if len(v)>=3:
        out.append({"n":len(v),"cx":sum(h['cx'] for h in v)/len(v),"cy":sum(h['cy'] for h in v)/len(v),
                    "box":[min(h['x'] for h in v),min(h['y'] for h in v),max(h['x']+h['w'] for h in v),max(h['y']+h['h'] for h in v)]})
out.sort(key=lambda g:(g["cy"],g["cx"]))
dbg = img.copy()
for g in out:
    b=g["box"]; cv2.rectangle(dbg,(b[0]-12,b[1]-12),(b[2]+12,b[3]+12),(0,0,255),4)
    cv2.putText(dbg,"grp%d"%g["n"],(b[0],b[1]-16),cv2.FONT_HERSHEY_SIMPLEX,1.1,(0,0,255),3)
cv2.imwrite(r"D:/project/rules/_cob/d1/hexdbg.png", dbg)
json.dump({"hexes":hexes,"groups":out}, open(r"D:/project/rules/_cob/d1/hexes.json","w"), indent=1)
for g in out: print(g)
