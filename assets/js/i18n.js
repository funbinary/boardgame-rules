/* ============================================================
   桌游规则书 — 中英文切换
   机制:顶栏注入「中/EN」按钮;applyLang 遍历页内 data 属性换文案;
   规则正文按 <article data-alt-body="..."> 指向的对侧语言片段按需
   fetch 并替换 .rule-body;无片段或 404 时显示提示条保留原文。
   语言存 localStorage(zrules-lang),跨页保持。
   文案约定:
     data-zh / data-en                    换 textContent(内联双语,适合游戏名等每页不同文案)
     data-title-zh / data-title-en        换 title 属性
     data-i18n="key"                      按字典 key 换 textContent
     data-i18n-aria="key"                 按字典 key 换 aria-label
     data-i18n-placeholder="key"          按字典 key 换 placeholder
   正文约定(由 build-bga.mjs / wire-i18n.mjs 产出):
     <article data-page-lang="zh|en" data-alt-body="片段URL">
       … <div class="rule-body">默认语言正文</div> …
   换语言后派发 document 级自定义事件 zrules:langchange({detail.lang}),
   main.js / index / bgg-ranking 监听后重建 TOC 或重渲染列表。
   ============================================================ */
(function () {
  "use strict";

  var LS_KEY = "zrules-lang";
  var BODY_CACHE_PREFIX = "zrules-body:";

  var STRINGS = {
    zh: {
      brand: "🎲 桌游规则书",
      openToc: "打开目录",
      onThisPage: "本页目录",
      siteNav: "站点导航",
      homeAll: "🏠 返回首页 / 全部游戏",
      home: "🏠 返回首页",
      allGames: "全部游戏",
      docChip: "📄 BGA 官方文档",
      playLabel: "在线玩本游戏",
      playGo: "开始 →",
      backTop: "返回顶部",
      zoomOut: "缩小",
      zoomIn: "放大",
      zoomReset: "重置缩放",
      zoomResetLabel: "重置",
      close: "关闭",
      lightboxHint: "滚轮 / 双击 / 双指缩放 · 放大后可拖动",
      searchPh: "搜索游戏名称，如：卡坦岛、卡卡颂、hearts…",
      showEn: "同时显示英文游戏（1600+）",
      gameCount: "共 {n} 个游戏",
      noMatch: "没有匹配的游戏",
      moreLimit: "只显示前 {n} 个结果，请输入更多关键字缩小范围",
      enHint: "英文游戏中找到 {n} 个匹配——勾选上方「同时显示英文游戏」即可查看",
      noticeNoEn: "该规则暂无英文翻译，以下显示中文原文。",
      noticeNoZh: "该游戏规则暂无中文翻译，以下显示英文原文。",
      sourcePrefix: "来源：",
      sourceSuffix: "商标与原内容归各出版商及 BGA 所有，翻译仅供个人学习查阅。",
      searchPhFull: "搜索游戏名称，如：gloomhaven、方舟动物园、scythe…",
      searchPhBga: "搜索游戏名称，如：方舟动物园、catan、gaia…",
      viewsAria: "榜单视图",
      sortAria: "排序方式",
      showMore: "显示更多（还剩 {n} 款）",
      badgePlayable: "🎮 可玩",
      badgePlayableBeta: "🎮 可玩 β",
      badgeDelisted: "已下架",
      rulesLink: "📚 规则书",
      badgePending: "待补",
      badgeNoEntry: "无词条",
      boardCount: "共 {n} 款",
      boardOfTotal: "（总榜 {n} 款）",
      boardAllSite: "（全站 {n} 款）",
      boardShown: "，已显示 {n} 款",
      fullLoadErr: "总榜数据加载失败，请刷新重试",
      playersUnit: "{n}人",
      statFullTotal: "🏆 总榜 {n} 款",
      statOnBga: "🎮 BGA 可玩 {n} 款",
      statSite: "📚 本站规则书 {n} 款",
      statDate: "📅 数据日期 {n}",
      statBgaTotal: "🎮 BGA {n} 款",
      statHave: "⭐ 有 BGG 评分 {n} 款",
      statRanked: "🏅 排名榜 {n} 款",
      statBeta: "🧪 Beta {n} 款",
      langBtnAria: "Switch to English",
      langBtnLabel: "EN"
    },
    en: {
      brand: "🎲 Board Game Rules",
      openToc: "Open contents",
      onThisPage: "On this page",
      siteNav: "Site navigation",
      homeAll: "🏠 Home / All games",
      home: "🏠 Home",
      allGames: "All Games",
      docChip: "📄 BGA official wiki",
      playLabel: "Play this game online",
      playGo: "Start →",
      backTop: "Back to top",
      zoomOut: "Zoom out",
      zoomIn: "Zoom in",
      zoomReset: "Reset zoom",
      zoomResetLabel: "Reset",
      close: "Close",
      lightboxHint: "Scroll / double-click / pinch to zoom · drag to pan when zoomed",
      searchPh: "Search games, e.g. Catan, Carcassonne, hearts…",
      showEn: "Include untranslated games (1600+)",
      gameCount: "{n} games",
      noMatch: "No matching games",
      moreLimit: "Showing first {n} results — enter more keywords to narrow down",
      enHint: "{n} matches among untranslated games — tick “Include untranslated games” above to see them",
      noticeNoEn: "English translation not yet available — showing the Chinese original below.",
      noticeNoZh: "该游戏规则暂无中文翻译，以下显示英文原文。",
      sourcePrefix: "Source: ",
      sourceSuffix: "Trademarks and original content belong to their publishers and BGA; this translation is for personal study only.",
      searchPhFull: "Search games, e.g. gloomhaven, Ark Nova, scythe…",
      searchPhBga: "Search games, e.g. Ark Nova, catan, gaia…",
      viewsAria: "Board views",
      sortAria: "Sort by",
      showMore: "Show more ({n} more)",
      badgePlayable: "🎮 Playable",
      badgePlayableBeta: "🎮 Playable β",
      badgeDelisted: "Delisted",
      rulesLink: "📚 Rulebook",
      badgePending: "No rating",
      badgeNoEntry: "No BGG entry",
      boardCount: "{n} games",
      boardOfTotal: " (of {n} in full board)",
      boardAllSite: " (of {n} on BGA)",
      boardShown: ", showing {n}",
      fullLoadErr: "Failed to load the rankings — please refresh.",
      playersUnit: "{n}",
      statFullTotal: "🏆 {n} ranked",
      statOnBga: "🎮 {n} playable on BGA",
      statSite: "📚 {n} with rulebooks",
      statDate: "📅 Data as of {n}",
      statBgaTotal: "🎮 {n} on BGA",
      statHave: "⭐ {n} rated on BGG",
      statRanked: "🏅 {n} ranked",
      statBeta: "🧪 {n} beta",
      langBtnAria: "切换到中文",
      langBtnLabel: "中"
    }
  };

  var current = (function () {
    try {
      var v = localStorage.getItem(LS_KEY);
      if (v === "zh" || v === "en") return v;
    } catch (e) { /* 隐私模式等 */ }
    return "zh";
  })();

  function t(key, lang) {
    var dict = STRINGS[lang || current] || STRINGS.zh;
    return dict[key] != null ? dict[key] : (STRINGS.zh[key] != null ? STRINGS.zh[key] : key);
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- chrome 文案 ---------- */
  function applyChrome(lang) {
    document.documentElement.setAttribute("lang", lang === "en" ? "en" : "zh-CN");

    var titleEl = document.querySelector("title");
    if (titleEl) {
      var v = lang === "en" ? titleEl.getAttribute("data-en") : titleEl.getAttribute("data-zh");
      if (v != null && v !== "") titleEl.textContent = v;
    }

    var els = document.querySelectorAll("[data-zh],[data-en],[data-i18n],[data-i18n-aria],[data-i18n-placeholder],[data-title-zh],[data-title-en]");
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var text = lang === "en" ? el.getAttribute("data-en") : el.getAttribute("data-zh");
      var key = el.getAttribute("data-i18n");
      if (text != null && text !== "") el.textContent = text;
      else if (key && t(key, lang) !== key) el.textContent = t(key, lang);
      // data-zh/data-en 为空串时表示「该语言无文案」——清空还是保留原文?
      // 约定:空串保留原文(不隐藏),避免误伤。
      var ariaKey = el.getAttribute("data-i18n-aria");
      if (ariaKey) el.setAttribute("aria-label", t(ariaKey, lang));
      var phKey = el.getAttribute("data-i18n-placeholder");
      if (phKey) el.setAttribute("placeholder", t(phKey, lang));
      var titleAttr = lang === "en" ? el.getAttribute("data-title-en") : el.getAttribute("data-title-zh");
      if (titleAttr != null && titleAttr !== "") el.setAttribute("title", titleAttr);
    }
    updateToggleBtn();
  }

  /* ---------- 正文切换 ---------- */
  function getBodyBlock() {
    return document.querySelector(".content article .rule-body");
  }

  function ensureNotice() {
    var old = document.querySelector(".i18n-notice");
    if (old) return old;
    var article = document.querySelector(".content article");
    if (!article) return null;
    var div = document.createElement("div");
    div.className = "i18n-notice";
    article.insertBefore(div, article.firstChild);
    return div;
  }

  function restoreBody(st) {
    if (!st) return;
    var body = getBodyBlock();
    if (body && st.origHtml != null) body.innerHTML = st.origHtml;
    var notice = document.querySelector(".i18n-notice");
    if (notice) notice.remove();
  }

  function fetchFragment(url) {
    var cacheKey = BODY_CACHE_PREFIX + url;
    try {
      var hit = sessionStorage.getItem(cacheKey);
      if (hit != null) return Promise.resolve(hit);
    } catch (e) { /* 忽略 */ }
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(String(r.status));
      return r.text();
    }).then(function (txt) {
      try { sessionStorage.setItem(cacheKey, txt); } catch (e) { /* 忽略 */ }
      return txt;
    });
  }

  function swapBody(lang) {
    var article = document.querySelector(".content article");
    if (!article) return Promise.resolve();
    var pageLang = article.getAttribute("data-page-lang");
    if (!pageLang) return Promise.resolve(); // 纯 UI 页(index 等),正文不参与切换
    var body = getBodyBlock();

    var st = article.__i18nState;
    if (body && !st) {
      st = article.__i18nState = { origHtml: body.innerHTML };
    }

    if (pageLang === lang) {
      restoreBody(st);
      return Promise.resolve();
    }

    // 无 .rule-body 包裹(手写独立页):正文整体保留,仅显示提示条
    if (!body) { showNotice(lang); return Promise.resolve(); }

    var altUrl = article.getAttribute("data-alt-body");
    var scrollRatio = (function () {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      return h > 0 ? window.scrollY / h : 0;
    })();

    if (!altUrl) { showNotice(lang); return Promise.resolve(); }

    return fetchFragment(altUrl).then(function (html) {
      body.innerHTML = html;
      var notice = document.querySelector(".i18n-notice");
      if (notice) notice.remove();
      return scrollRatio;
    }).catch(function () {
      // 片段缺失/网络失败:回到默认语言正文并提示
      restoreBody(st);
      showNotice(lang);
    });
  }

  function showNotice(targetLang) {
    var notice = ensureNotice();
    if (!notice) return;
    // 提示文案用目标语言;noticeNoZh 本身是中文(切中文缺中文时也用中文)
    notice.textContent = targetLang === "en" ? t("noticeNoEn") : t("noticeNoZh");
  }

  function emitChange(lang, scrollRatio) {
    document.dispatchEvent(new CustomEvent("zrules:langchange", { detail: { lang: lang } }));
    if (scrollRatio != null) {
      // 图片未加载完高度会变,按比例近似恢复滚动位置
      requestAnimationFrame(function () {
        var h = document.documentElement.scrollHeight - window.innerHeight;
        if (h > 0) window.scrollTo(0, scrollRatio * h);
      });
    }
  }

  function apply(lang) {
    current = lang === "en" ? "en" : "zh";
    try { localStorage.setItem(LS_KEY, current); } catch (e) { /* 忽略 */ }
    applyChrome(current);
    // 正文替换完成(或确定保持原文)后再派发一次 langchange,页面脚本据此重渲染
    return swapBody(current).then(function (scrollRatio) {
      emitChange(current, scrollRatio);
    });
  }

  /* ---------- 顶栏切换按钮 ---------- */
  function updateToggleBtn() {
    var btn = document.querySelector(".lang-toggle");
    if (!btn) return;
    var target = current === "zh" ? "en" : "zh";
    btn.textContent = t("langBtnLabel", target);
    btn.setAttribute("aria-label", t("langBtnAria", target));
    btn.setAttribute("lang", target === "en" ? "en" : "zh-CN");
  }

  function mountToggle() {
    var bar = document.querySelector(".topbar");
    if (!bar || document.querySelector(".lang-toggle")) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "lang-toggle";
    btn.addEventListener("click", function () {
      apply(current === "zh" ? "en" : "zh");
    });
    bar.appendChild(btn);
    updateToggleBtn();
  }

  /* ---------- 启动 ---------- */
  function boot() {
    mountToggle();
    apply(current);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.ZRulesI18N = {
    t: t,
    apply: apply,
    lang: function () { return current; },
    esc: esc
  };
})();
