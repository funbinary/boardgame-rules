/* ============================================================
   桌游规则书 — 交互脚本
   1. 根据正文 h2/h3 自动生成本页目录（侧边栏）
   2. 滚动时高亮当前章节（scrollspy）
   3. 移动端：侧边栏抽屉开关
   4. 顶部阅读进度条 + 返回顶部按钮
   ============================================================ */
(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    buildToc();
    initScrollspy();
    initDrawer();
    initProgressAndTop();
    initLightbox();
  });

  /* ---------- 0. 自绘滚动动画 ----------
     不用 CSS scroll-behavior:smooth / scrollTo({behavior:'smooth'})：
     部分内嵌 webview 中平滑滚动动画被节流，会导致所有滚动静默失效。
     这里用定时器逐帧滚动（behavior:'auto'），任何环境都有效。 */
  function animateScrollTo(targetY) {
    var startY = window.scrollY;
    var dist = targetY - startY;
    if (Math.abs(dist) < 2) return;
    var duration = Math.min(450, 150 + Math.abs(dist) / 6);
    var t0 = Date.now();
    var timer = setInterval(function () {
      var k = Math.min(1, (Date.now() - t0) / duration);
      var ease = 1 - Math.pow(1 - k, 3); // easeOutCubic
      window.scrollTo(0, Math.round(startY + dist * ease));
      if (k >= 1) clearInterval(timer);
    }, 16);
  }

  function headerOffset() {
    var bar = document.querySelector(".topbar");
    return (bar ? bar.offsetHeight : 56) + 12;
  }

  /* ---------- 1. 自动生成目录 ---------- */
  function buildToc() {
    var tocList = document.getElementById("toc-list");
    var article = document.querySelector(".content article");
    if (!tocList || !article) return;

    var headings = article.querySelectorAll("h2, h3");
    if (!headings.length) return;

    // 给没有 id 的标题补 id
    var used = {};
    Array.prototype.forEach.call(headings, function (h) {
      if (!h.id) {
        var base = slug(h.textContent || "");
        var id = base;
        var n = 2;
        while (used[id]) { id = base + "-" + n; n++; }
        used[id] = true;
        h.id = id;
      }
    });

    var html = "";
    Array.prototype.forEach.call(headings, function (h) {
      var cls = h.tagName === "H3" ? "toc-h3" : "toc-h2";
      var text = (h.textContent || "").trim();
      html += '<li class="' + cls + '"><a href="#' + h.id + '">' + escapeHtml(text) + "</a></li>";
    });
    tocList.innerHTML = html;
  }

  function slug(text) {
    return (text || "")
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "") || "section";
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- 2. 滚动高亮当前章节 ---------- */
  function initScrollspy() {
    var links = document.querySelectorAll(".toc a[href^='#']");
    if (!links.length) return;

    var headings = [];
    Array.prototype.forEach.call(links, function (a) {
      var target = document.getElementById(decodeURIComponent(a.getAttribute("href").slice(1)));
      if (target) headings.push({ link: a, el: target });
    });
    if (!headings.length) return;

    var ticking = false;
    function update() {
      ticking = false;
      var pos = window.scrollY + 120;
      var current = -1;
      for (var i = 0; i < headings.length; i++) {
        if (headings[i].el.offsetTop <= pos) current = i;
      }
      // 已滚动到页面底部时，高亮最后一个章节
      var doc = document.documentElement;
      if (window.innerHeight + window.scrollY >= doc.scrollHeight - 4) {
        current = headings.length - 1;
      }
      // 页面顶部时高亮第一个章节
      if (current < 0) current = 0;
      Array.prototype.forEach.call(links, function (a) { a.classList.remove("active"); });
      if (current >= 0) {
        headings[current].link.classList.add("active");
        // 侧边栏内部滚动跟随
        var active = headings[current].link;
        var sidebar = active.closest(".sidebar");
        if (sidebar) {
          var top = active.offsetTop - sidebar.offsetTop;
          if (top < sidebar.scrollTop + 60 || top > sidebar.scrollTop + sidebar.clientHeight - 80) {
            sidebar.scrollTop = top - sidebar.clientHeight / 3;
          }
        }
      }
    }

    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  /* ---------- 3. 移动端抽屉 ---------- */
  function initDrawer() {
    var menuBtn = document.querySelector(".menu-btn");
    var backdrop = document.querySelector(".backdrop");
    if (!menuBtn) return;

    function open() {
      document.body.classList.add("sidebar-open", "no-scroll");
      menuBtn.setAttribute("aria-expanded", "true");
    }
    function close() {
      document.body.classList.remove("sidebar-open", "no-scroll");
      menuBtn.setAttribute("aria-expanded", "false");
    }

    menuBtn.addEventListener("click", function () {
      document.body.classList.contains("sidebar-open") ? close() : open();
    });
    if (backdrop) backdrop.addEventListener("click", close);

    // 点击目录项：自绘动画滚动到章节，并收起抽屉
    var toc = document.querySelector(".toc");
    if (toc) toc.addEventListener("click", function (e) {
      var a = e.target.closest("a[href^='#']");
      if (!a) return;
      var id = decodeURIComponent(a.getAttribute("href").slice(1));
      var target = document.getElementById(id);
      if (target) {
        e.preventDefault();
        animateScrollTo(target.offsetTop - headerOffset());
        try { history.replaceState(null, "", "#" + id); } catch (err) { /* ignore */ }
      }
      close();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
    });
  }

  /* ---------- 4. 进度条 + 返回顶部 ---------- */
  function initProgressAndTop() {
    var bar = document.querySelector(".progress-bar");
    var topBtn = document.querySelector(".to-top");

    var ticking = false;
    function update() {
      ticking = false;
      var doc = document.documentElement;
      var max = doc.scrollHeight - window.innerHeight;
      var ratio = max > 0 ? window.scrollY / max : 0;
      if (bar) bar.style.width = (ratio * 100).toFixed(2) + "%";
      if (topBtn) topBtn.classList.toggle("show", window.scrollY > 600);
    }

    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    window.addEventListener("resize", update);
    update();

    if (topBtn) topBtn.addEventListener("click", function () {
      animateScrollTo(0);
    });
  }

  /* ---------- 5. 图片点击放大（lightbox，支持缩放与平移） ----------
     滚轮 / 按钮 / 双击 / 双指捏合缩放；放大后拖动平移。
     图片若带 data-full-src,打开时优先加载该高清原图。 */
  function initLightbox() {
    var overlay = document.createElement("div");
    overlay.className = "lightbox";
    overlay.setAttribute("aria-hidden", "true");
    var img = document.createElement("img");
    img.alt = "";
    img.draggable = false;
    overlay.appendChild(img);

    var bar = document.createElement("div");
    bar.className = "lightbox-bar";
    var zoomLabel = document.createElement("span");
    zoomLabel.className = "lightbox-zoom";
    zoomLabel.textContent = "100%";
    var mkBtn = function (txt, label) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = txt;
      b.setAttribute("aria-label", label);
      return b;
    };
    var btnOut = mkBtn("−", "缩小");
    var btnIn = mkBtn("+", "放大");
    var btnReset = mkBtn("重置", "重置缩放");
    var btnClose = mkBtn("✕", "关闭");
    bar.appendChild(zoomLabel);
    bar.appendChild(btnOut);
    bar.appendChild(btnIn);
    bar.appendChild(btnReset);
    bar.appendChild(btnClose);
    overlay.appendChild(bar);

    var hint = document.createElement("div");
    hint.className = "lightbox-hint";
    hint.textContent = "滚轮 / 双击 / 双指缩放 · 放大后可拖动";
    overlay.appendChild(hint);

    document.body.appendChild(overlay);

    var scale = 1, tx = 0, ty = 0;
    var MIN = 1, MAX = 8;
    var pointers = new Map();
    var pinch = null;   // {dist, scale, tx0, ty0}
    var panStart = null;
    var tap = null;     // {x, y, t, onImg}：单指落点，用于轻点/双击判定
    var lastTap = null; // 上一次有效轻点，用于触屏双击检测
    var closeTimer = null; // 触屏轻点延迟关闭，给双击放大留出判定窗口

    function apply(anim) {
      img.style.transition = anim ? "" : "none";
      img.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + scale + ")";
      img.classList.toggle("zoomed", scale > 1.01);
      zoomLabel.textContent = Math.round(scale * 100) + "%";
    }
    function reset(anim) { scale = 1; tx = 0; ty = 0; apply(anim); }

    // 以视口坐标 (cx, cy) 为锚点缩放到 target 倍
    function zoomAt(cx, cy, target, anim) {
      var ns = Math.min(MAX, Math.max(MIN, target));
      if (Math.abs(ns - scale) < 0.0001) return;
      var r = overlay.getBoundingClientRect();
      var ox = cx - r.left - r.width / 2;
      var oy = cy - r.top - r.height / 2;
      var k = ns / scale;
      tx = ox - (ox - tx) * k;
      ty = oy - (oy - ty) * k;
      scale = ns;
      apply(anim);
    }

    function open(src, alt) {
      reset(false);
      img.src = src;
      img.alt = alt || "";
      overlay.classList.add("open");
      overlay.setAttribute("aria-hidden", "false");
      document.body.classList.add("no-scroll");
    }
    function close() {
      overlay.classList.remove("open");
      overlay.setAttribute("aria-hidden", "true");
      document.body.classList.remove("no-scroll");
    }
    function centerStep(f) {
      var r = overlay.getBoundingClientRect();
      zoomAt(r.left + r.width / 2, r.top + r.height / 2, scale * f, true);
    }

    btnIn.addEventListener("click", function () { centerStep(1.3); });
    btnOut.addEventListener("click", function () { centerStep(1 / 1.3); });
    btnReset.addEventListener("click", function () { reset(true); });
    btnClose.addEventListener("click", close);

    overlay.addEventListener("wheel", function (e) {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, scale * Math.exp(-e.deltaY * 0.0016), false);
    }, { passive: false });

    img.addEventListener("dblclick", function (e) {
      e.preventDefault();
      if (scale > 1.01) reset(true);
      else zoomAt(e.clientX, e.clientY, 2.5, true);
    });

    overlay.addEventListener("pointerdown", function (e) {
      if (e.target !== img && e.target !== overlay) return; // 工具条按钮不参与手势
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { overlay.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ }
      if (pointers.size === 1) {
        panStart = { x: e.clientX, y: e.clientY, tx: tx, ty: ty };
        // 鼠标的单击/双击交给原生 click/dblclick；触屏/笔才做轻点判定
        tap = e.pointerType === "mouse" ? null
          : { x: e.clientX, y: e.clientY, t: Date.now(), onImg: e.target === img };
      } else if (pointers.size === 2) {
        var ps = Array.from(pointers.values());
        pinch = {
          dist: Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y),
          scale: scale, tx0: tx, ty0: ty
        };
        tap = null;
        lastTap = null;
      }
    });

    overlay.addEventListener("pointermove", function (e) {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.size === 2 && pinch) {
        var ps = Array.from(pointers.values());
        var d = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
        if (d > 2) {
          var cx = (ps[0].x + ps[1].x) / 2, cy = (ps[0].y + ps[1].y) / 2;
          var ns = Math.min(MAX, Math.max(MIN, pinch.scale * d / pinch.dist));
          var k = ns / pinch.scale;
          var r = overlay.getBoundingClientRect();
          var ox = cx - r.left - r.width / 2, oy = cy - r.top - r.height / 2;
          tx = ox - (ox - pinch.tx0) * k;
          ty = oy - (oy - pinch.ty0) * k;
          scale = ns;
          apply(false);
        }
      } else if (pointers.size === 1 && panStart) {
        if (scale > 1.01) {
          tx = panStart.tx + (e.clientX - panStart.x);
          ty = panStart.ty + (e.clientY - panStart.y);
          apply(false);
          tap = null;
        }
      }
    });

    function endPointer(e) {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (pointers.size === 1) {
        // 双指收起回单指：以剩余手指重建平移基准
        var rest = Array.from(pointers.values())[0];
        panStart = { x: rest.x, y: rest.y, tx: tx, ty: ty };
        return;
      }
      if (pointers.size === 0) {
        panStart = null;
        if (tap && Date.now() - tap.t < 350 &&
            Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 8) {
          if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
          if (lastTap && tap.t - lastTap.t < 350 &&
              Math.hypot(tap.x - lastTap.x, tap.y - lastTap.y) < 32) {
            // 触屏双击：切换放大/还原
            if (scale > 1.01) reset(true);
            else zoomAt(tap.x, tap.y, 2.5, true);
            lastTap = null;
          } else {
            lastTap = { x: tap.x, y: tap.y, t: tap.t };
            // 轻点关闭：点背景随时关；点图片仅在未放大时关，避免放大后误关。
            // 延迟一拍关闭，给可能到来的第二次轻点（双击放大）留窗口。
            var tapInfo = { onImg: tap.onImg };
            closeTimer = setTimeout(function () {
              closeTimer = null;
              if (!tapInfo.onImg || scale <= 1.01) close();
            }, 330);
          }
        }
      }
    }
    overlay.addEventListener("pointerup", endPointer);
    overlay.addEventListener("pointercancel", endPointer);

    // 桌面：点击背景关闭（点图片留给双击放大，关闭用 ✕/Esc/点背景）
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) close();
    });

    document.addEventListener("keydown", function (e) {
      if (!overlay.classList.contains("open")) return;
      if (e.key === "Escape") close();
      else if (e.key === "+" || e.key === "=") centerStep(1.3);
      else if (e.key === "-") centerStep(1 / 1.3);
      else if (e.key === "0") reset(true);
    });

    document.addEventListener("click", function (e) {
      var t = e.target;
      var smallIcon = t && t.classList && (t.classList.contains("ic") || t.classList.contains("ic-md") || t.classList.contains("ic-badge"));
      if (t && t.tagName === "IMG" && !smallIcon && t.closest(".content")) {
        e.preventDefault();
        var full = t.getAttribute("data-full-src");
        open(full || t.currentSrc || t.src, t.alt || "");
      }
    });
  }
})();
