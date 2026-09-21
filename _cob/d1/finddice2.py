import cv2
img = cv2.imread(r"D:/project/rules/_cob/d1/se_board_full.png")
H,W = img.shape[:2]
hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
m = cv2.inRange(hsv, (0,0,140), (255,120,255))
m = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(3,3)))
m = cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(3,3)))
cnts,_ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
res=[]
for c in cnts:
    a = cv2.contourArea(c)
    if a < 300 or a > 9000: continue
    x,y,w,h = cv2.boundingRect(c)
    if not (0.55 < w/h < 1.8): continue
    if a/(w*h) < 0.45: continue
    if x < 120 or x+w > W-120 or y < 120 or y+h > H-110: continue
    roi = cv2.cvtColor(img[y:y+h, x:x+w], cv2.COLOR_BGR2GRAY)
    roi = cv2.GaussianBlur(roi,(3,3),0)
    th = cv2.threshold(roi, 0, 255, cv2.THRESH_BINARY_INV+cv2.THRESH_OTSU)[1]
    pc,_ = cv2.findContours(th, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    pips = [p for p in pc if 6 < cv2.contourArea(p) < (w*h)/6 and cv2.boundingRect(p)[2] < w*0.45]
    res.append((a,x,y,w,h,len(pips)))
res.sort(key=lambda r:-r[0])
for a,x,y,w,h,p in res[:25]:
    print("board=(%d,%d) %dx%d area=%d pips=%d" % (x,y,w,h,a,p))
