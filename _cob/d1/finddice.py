import cv2
img = cv2.imread(r"D:/project/rules/_cob/d1/se_board_full.png")
windows = {
 "d1": (330, 130, 760, 480), "d2": (1150, 180, 1580, 520),
 "d3": (1180, 420, 1610, 760), "d4": (240, 500, 670, 860),
 "d5": (300, 830, 730, 1200), "d6": (1080, 800, 1520, 1190),
}
hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
for name,(x0,y0,x1,y1) in windows.items():
    sub = hsv[y0:y1, x0:x1]
    m = cv2.inRange(sub, (0,0,170), (255,95,255))
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(3,3)))
    m = cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(5,5)))
    cnts,_ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    best=[]
    for c in cnts:
        a = cv2.contourArea(c)
        if a < 400 or a > 7000: continue
        x,y,w,h = cv2.boundingRect(c)
        if not (0.6 < w/h < 1.6): continue
        if a/(w*h) < 0.45: continue
        best.append((a,x,y,w,h))
    best.sort(reverse=True)
    print(name, "candidates:")
    for a,x,y,w,h in best[:4]:
        roi = cv2.cvtColor(img[y0+y:y0+y+h, x0+x:x0+x+w], cv2.COLOR_BGR2GRAY)
        roi = cv2.GaussianBlur(roi,(3,3),0)
        th = cv2.threshold(roi, 0, 255, cv2.THRESH_BINARY_INV+cv2.THRESH_OTSU)[1]
        th = cv2.morphologyEx(th, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(2,2)))
        pc,_ = cv2.findContours(th, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        pips = [p for p in pc if 8 < cv2.contourArea(p) < (w*h)/6]
        print("   box=(%d,%d,%d,%d) area=%d pips=%d board=(%d,%d)" % (x,y,w,h,a,len(pips),x0+x,y0+y))
