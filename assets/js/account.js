/* ============================================================
   account.js — 用户登录态 + 收藏交互（全站引用）
   依赖：无（vanilla JS，与 main.js 同风格）
   职责：
     1. 顶栏注入 登录/注册 或 用户名·退出（account 页自身除外）
     2. 游戏页（body[data-game-key]）渲染 已有/想买/想玩 收藏条
   account.html 通过 window.RulesAccount.api 复用接口封装。
   ============================================================ */
(function () {
  "use strict";

  var API = "/api";

  function api(method, path, body) {
    return fetch(API + path, {
      method: method,
      credentials: "same-origin",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) {
          var err = new Error(data.error || ("HTTP " + res.status));
          err.status = res.status;
          throw err;
        }
        return data;
      });
    });
  }

  window.RulesAccount = { api: api, user: null };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- 收藏状态 ---------- */

  var STATUS_LABEL = { owned: "✅ 已有", wishlist: "🛒 想买", play: "🎲 想玩" };
  var STATUS_KEYS = ["owned", "wishlist", "play"];

  function accountHref() {
    // account.html 固定在站点根目录，必须用根相对路径，
    // 否则游戏页 /games/*.html 下会解析成 /games/account.html 404
    return "/account.html" + (location.pathname.indexOf("/") === 0
      ? "?next=" + encodeURIComponent(location.pathname)
      : "");
  }

  function renderTopbarAuth(user) {
    var topbar = document.querySelector("header.topbar");
    if (!topbar || document.body.dataset.page === "account") return;
    var box = document.createElement("span");
    box.className = "topbar-auth";
    if (user) {
      box.innerHTML =
        '<a class="auth-link" href="/account.html" title="我的收藏">👤 ' + esc(user.username) + "</a>" +
        '<button type="button" class="auth-logout">退出</button>';
      box.querySelector(".auth-logout").addEventListener("click", function () {
        api("POST", "/logout").then(function () { location.reload(); }).catch(function () { location.reload(); });
      });
    } else {
      box.innerHTML = '<a class="auth-link" href="' + accountHref() + '">🔐 登录 / 注册</a>';
    }
    topbar.appendChild(box);
  }

  /* ---------- 游戏页收藏条 ---------- */

  function gameKey() {
    return document.body.getAttribute("data-game-key") || null;
  }

  function gameName() {
    var el = document.querySelector(".topbar-title") || document.querySelector(".game-title");
    var t = el ? el.textContent.trim() : document.title.split("·")[0].trim();
    return t.slice(0, 60);
  }

  function gameEn() {
    var el = document.querySelector(".game-sub");
    if (!el) return "";
    var t = el.textContent.split("·")[0].trim();
    return t.length <= 80 ? t : "";
  }

  function renderCollectBar(key) {
    var chips = document.querySelector(".page-header .meta-chips");
    var bar = document.createElement("div");
    bar.className = "collect-bar";
    bar.innerHTML =
      '<span class="collect-label">📚 我的游戏</span>' +
      STATUS_KEYS.map(function (s) {
        return '<button type="button" class="collect-btn" data-status="' + s + '">' + STATUS_LABEL[s] + "</button>";
      }).join("");
    if (chips && chips.parentNode) {
      chips.parentNode.insertBefore(bar, chips.nextSibling);
    } else {
      var article = document.querySelector("article");
      if (article) article.insertBefore(bar, article.firstChild.nextSibling);
    }

    var buttons = bar.querySelectorAll(".collect-btn");
    var current = "";

    function paint() {
      buttons.forEach(function (b) {
        b.classList.toggle("active", b.dataset.status === current);
        b.setAttribute("aria-pressed", b.dataset.status === current ? "true" : "false");
      });
    }

    function setStatus(status) {
      buttons.forEach(function (b) { b.disabled = true; });
      api("PUT", "/collection/" + key, {
        status: status, name: gameName(), en: gameEn()
      }).then(function () {
        current = status;
        paint();
      }).catch(function (err) {
        window.alert("收藏失败：" + err.message);
      }).finally(function () {
        buttons.forEach(function (b) { b.disabled = false; });
      });
    }

    buttons.forEach(function (b) {
      b.addEventListener("click", function () {
        if (!window.RulesAccount.user) {
          // 未登录：引导去登录，登录后回到本页
          location.href = accountHref();
          return;
        }
        // 再点一次当前状态 = 取消收藏
        setStatus(b.dataset.status === current ? "" : b.dataset.status);
      });
    });

    if (window.RulesAccount.user) {
      api("GET", "/collection/" + key).then(function (data) {
        current = data.status || "";
        paint();
      }).catch(function () { /* 网络异常时保持无高亮 */ });
    }
  }

  /* ---------- 启动 ---------- */

  api("GET", "/me").then(function (u) {
    window.RulesAccount.user = u;
    renderTopbarAuth(u);
    if (gameKey()) renderCollectBar(gameKey());
  }).catch(function () {
    renderTopbarAuth(null);
    if (gameKey()) renderCollectBar(gameKey());
  });
})();
