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

  /* ---------- 5. 图片点击放大（lightbox） ---------- */
  function initLightbox() {
    var overlay = document.createElement("div");
    overlay.className = "lightbox";
    overlay.setAttribute("aria-hidden", "true");
    var img = document.createElement("img");
    img.alt = "";
    overlay.appendChild(img);
    document.body.appendChild(overlay);

    function close() {
      overlay.classList.remove("open");
      overlay.setAttribute("aria-hidden", "true");
      document.body.classList.remove("no-scroll");
    }
    overlay.addEventListener("click", close);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && overlay.classList.contains("open")) close();
    });
    document.addEventListener("click", function (e) {
      var t = e.target;
      var smallIcon = t && t.classList && (t.classList.contains("ic") || t.classList.contains("ic-md") || t.classList.contains("ic-badge"));
      if (t && t.tagName === "IMG" && !smallIcon && t.closest(".content")) {
        e.preventDefault();
        img.src = t.currentSrc || t.src;
        img.alt = t.alt || "";
        overlay.classList.add("open");
        overlay.setAttribute("aria-hidden", "false");
        document.body.classList.add("no-scroll");
      }
    });
  }
})();
