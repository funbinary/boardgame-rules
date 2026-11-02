/* ============================================================
   桌游规则书 — 中英文切换
   机制:顶栏注入「中/EN」按钮;applyLang 遍历页内 data 属性换文案;
   规则正文按 <article data-alt-body="..."> 指向的对侧语言片段按需
   fetch 并替换 .rule-body;无片段或 404 时显示提示条保留原文。
   语言存 localStorage(zrules-lang),跨页保持。
   文案约定:
     data-zh / data-en                    换 textContent(内联双语,适合游戏名等每页不同文案;仅限叶子元素,会清掉子节点)
     data-title-zh / data-title-en        换 title 属性
     data-i18n="key"                      按字典 key 换 textContent
     data-i18n-aria="key"                 按字典 key 换 aria-label
     data-i18n-placeholder="key"          按字典 key 换 placeholder
     data-lang-only="zh|en"               成对出现的整段富文本(内含链接等子节点,不能走 textContent):
                                          按语言显隐(display:none),中英两份各带一个该属性
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
      langBtnLabel: "EN",
      /* ---- 收藏 / 账户(account.js 注入 + account/shared 页) ---- */
      myGames: "📚 我的游戏",
      myFav: "我的收藏",
      loginRegister: "🔐 登录 / 注册",
      logout: "退出",
      stOwned: "✅ 已有",
      stWishlist: "🛒 想买",
      stPlay: "🎲 想玩",
      tMarkOwned: "标记为已有",
      tAddWishlist: "加入想买",
      tAddPlay: "加入想玩",
      moveTitle: "移到「{s}」",
      removeTitle: "移出清单",
      favFail: "收藏失败：",
      wLabel: "权重",
      bggChipTitle: "BGG 综合 {a} · 排名 #{r} · 权重/复杂度 {w}/5 · {u} 人评分",
      loginTab: "登录",
      registerTab: "注册",
      usernameLabel: "用户名",
      passwordLabel: "密码",
      loginPhUser: "用户名",
      loginPhPw: "密码（至少 6 位）",
      loginSubmit: "登录",
      noAccount: "没有账号？",
      registerLink: "注册一个",
      registerTail: "，只需用户名和密码。",
      regPhUser: "2-24 位中文、字母、数字、_ 或 -",
      regPhPw: "至少 8 位，含字母和数字",
      registerSubmit: "注册并登录",
      hasAccount: "已有账号？",
      loginLink: "直接登录",
      dotTail: "。",
      pwRuleLen: "8 位以上",
      pwRuleLetter: "包含字母",
      pwRuleDigit: "包含数字",
      pwWeak: "弱",
      pwMid: "中",
      pwStrong: "强",
      pwStrength: "强度：",
      favTitle: "📚 我的收藏",
      favTip: "在任意游戏页点「已有 / 想买 / 想玩」即可加入对应清单",
      shareTitle: "分享我的收藏",
      shareDesc: "开启后，任何人都可以通过链接查看你的三张清单（只读）",
      shareEnable: "开启分享",
      shareLinkAria: "分享链接",
      shareCopy: "复制链接",
      copied: "已复制 ✓",
      shareRegen: "重新生成",
      shareOff: "关闭分享",
      secOwned: "已有",
      secWishlist: "想买",
      secPlay: "想玩",
      emptyOwned: "还没有标记「已有」的游戏",
      emptyWishlist: "购物车还是空的",
      emptyPlay: "还没有想玩的游戏",
      goIndex: "去首页逛逛 →",
      backAll: "← 返回全部游戏",
      opFail: "操作失败：",
      enableFail: "开启失败：",
      closeFail: "关闭失败：",
      regenConfirm: "重新生成后，旧链接将立即失效，确定？",
      shareOffConfirm: "关闭分享后，现有链接将无法访问，确定？",
      manualCopy: "请手动复制：",
      sharedTitleTpl: "{u} 分享的收藏 · 桌游规则书",
      sharedTopbar: "分享的收藏",
      sharedH1Tpl: "👤 {u} 分享的收藏",
      sharedTip: "通过分享链接查看 · 只读",
      invalidLink: "链接无效，或对方已关闭分享"
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
      langBtnLabel: "中",
      /* ---- 收藏 / 账户(account.js 注入 + account/shared 页) ---- */
      myGames: "📚 My games",
      myFav: "My favorites",
      loginRegister: "🔐 Sign in / Register",
      logout: "Sign out",
      stOwned: "✅ Owned",
      stWishlist: "🛒 Want to buy",
      stPlay: "🎲 Want to play",
      tMarkOwned: "Mark as owned",
      tAddWishlist: "Add to want-to-buy",
      tAddPlay: "Add to want-to-play",
      moveTitle: "Move to {s}",
      removeTitle: "Remove from list",
      favFail: "Failed to save: ",
      wLabel: "Weight",
      bggChipTitle: "BGG average {a} · rank #{r} · weight/complexity {w}/5 · {u} ratings",
      loginTab: "Sign in",
      registerTab: "Register",
      usernameLabel: "Username",
      passwordLabel: "Password",
      loginPhUser: "Username",
      loginPhPw: "Password (at least 6 characters)",
      loginSubmit: "Sign in",
      noAccount: "No account yet? ",
      registerLink: "Create one",
      registerTail: " — just a username and password.",
      regPhUser: "2–24 chars: Chinese, letters, digits, _ or -",
      regPhPw: "At least 8 characters with letters and digits",
      registerSubmit: "Register & sign in",
      hasAccount: "Already have an account? ",
      loginLink: "Sign in",
      dotTail: ".",
      pwRuleLen: "8+ characters",
      pwRuleLetter: "Contains a letter",
      pwRuleDigit: "Contains a digit",
      pwWeak: "Weak",
      pwMid: "Fair",
      pwStrong: "Strong",
      pwStrength: "Strength: ",
      favTitle: "📚 My Favorites",
      favTip: "Tap Owned / Want to buy / Want to play on any game page to build these lists",
      shareTitle: "Share my favorites",
      shareDesc: "When enabled, anyone with the link can view your three lists (read-only)",
      shareEnable: "Enable sharing",
      shareLinkAria: "Share link",
      shareCopy: "Copy link",
      copied: "Copied ✓",
      shareRegen: "Regenerate",
      shareOff: "Disable sharing",
      secOwned: "Owned",
      secWishlist: "Want to buy",
      secPlay: "Want to play",
      emptyOwned: "No games marked as owned yet",
      emptyWishlist: "Your shopping cart is empty",
      emptyPlay: "Nothing on the want-to-play list yet",
      goIndex: "Browse all games →",
      backAll: "← All games",
      opFail: "Operation failed: ",
      enableFail: "Failed to enable: ",
      closeFail: "Failed to disable: ",
      regenConfirm: "Regenerating will invalidate the old link immediately. Continue?",
      shareOffConfirm: "Once disabled, the current link will stop working. Continue?",
      manualCopy: "Please copy manually: ",
      sharedTitleTpl: "{u}'s Favorites · Board Game Rules",
      sharedTopbar: "Shared favorites",
      sharedH1Tpl: "👤 {u}'s Favorites",
      sharedTip: "Shared link · read-only",
      invalidLink: "This link is invalid, or sharing has been turned off"
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

  // 后端(server/internal/api)错误文案是中文;英文模式下把已知串翻成英文,未知串原样返回
  var SERVER_ERRORS_EN = {
    "请求体不是合法 JSON": "Request body is not valid JSON",
    "用户名需为 2-24 个中文、字母、数字、_ 或 -": "Username must be 2–24 characters: Chinese, letters, digits, _ or -",
    "密码至少 8 位，且需同时包含字母和数字": "Password must be at least 8 characters and contain both letters and digits",
    "密码最长 72 位": "Password must be at most 72 characters",
    "密码需同时包含字母和数字": "Password must contain both letters and digits",
    "这个密码太常见，请换一个": "This password is too common — please pick another",
    "注册过于频繁，请稍后再试": "Too many registrations — please try again later",
    "服务器内部错误": "Internal server error",
    "用户名已被注册": "Username already taken",
    "尝试过于频繁，请稍后再试": "Too many attempts — please try again later",
    "用户名或密码错误": "Wrong username or password",
    "未登录": "Not signed in",
    "访问过于频繁，请稍后再试": "Too many requests — please try again later",
    "链接无效": "Invalid link",
    "链接无效或分享已关闭": "Invalid link, or sharing has been disabled",
    "游戏标识不合法": "Invalid game key",
    "status 需为 owned / wishlist / play": "status must be owned / wishlist / play",
    "name 必填且不超过 60 字": "name is required (max 60 characters)",
    "操作过于频繁，请稍后再试": "Too many operations — please try again later"
  };

  function tErr(msg) {
    var s = String(msg || "");
    return current === "en" && SERVER_ERRORS_EN[s] ? SERVER_ERRORS_EN[s] : s;
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
    // data-lang-only:成对出现的富文本段落(内含链接等子节点),按语言显隐
    var onlys = document.querySelectorAll("[data-lang-only]");
    for (var k = 0; k < onlys.length; k++) {
      onlys[k].style.display = onlys[k].getAttribute("data-lang-only") === lang ? "" : "none";
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
    tErr: tErr,
    apply: apply,
    lang: function () { return current; },
    esc: esc
  };
})();
