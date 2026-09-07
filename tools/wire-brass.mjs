import { readFileSync, writeFileSync } from 'node:fs';

const edit = (file, from, to) => {
  let s = readFileSync(file, 'utf8');
  if (!s.includes(from)) { console.error('MISS: ' + file); process.exitCode = 1; return; }
  if (s.includes(to)) { console.log('SKIP (already there): ' + file); return; }
  writeFileSync(file, s.replace(from, to));
  console.log('OK: ' + file);
};

const sideOld = '          <li><a href="7-wonders.html">🏛️ 七大奇迹</a></li>';
const sideNew = sideOld + '\n          <li><a href="brass-birmingham.html">🏭 工业革命：伯明翰</a></li>';
for (const g of ['7-wonders', 'vale-of-eternity', 'wingspan', 'pokemon-grove']) {
  edit(`games/${g}.html`, sideOld, sideNew);
}

// theme colors
edit('assets/css/style.css',
  'body[data-theme="grove"] { --accent: #55921c; --accent-strong: #3f7212; --accent-soft: rgba(85, 146, 28, 0.10); --accent-border: rgba(85, 146, 28, 0.35); }',
  'body[data-theme="grove"] { --accent: #55921c; --accent-strong: #3f7212; --accent-soft: rgba(85, 146, 28, 0.10); --accent-border: rgba(85, 146, 28, 0.35); }\nbody[data-theme="brass"] { --accent: #8a6a15; --accent-strong: #6b5210; --accent-soft: rgba(138, 106, 21, 0.10); --accent-border: rgba(138, 106, 21, 0.35); }');
edit('assets/css/style.css',
  '.game-card[data-theme="grove"]     { --accent: #55921c; --accent-strong: #3f7212; --accent-soft: rgba(85, 146, 28, 0.10); --accent-border: rgba(85, 146, 28, 0.35); }',
  '.game-card[data-theme="grove"]     { --accent: #55921c; --accent-strong: #3f7212; --accent-soft: rgba(85, 146, 28, 0.10); --accent-border: rgba(85, 146, 28, 0.35); }\n.game-card[data-theme="brass"]     { --accent: #8a6a15; --accent-strong: #6b5210; --accent-soft: rgba(138, 106, 21, 0.10); --accent-border: rgba(138, 106, 21, 0.35); }');

// index.html: card after 7-wonders card
edit('index.html',
  `        </a>

        <a class="game-card" data-theme="vale" href="games/vale-of-eternity.html">`,
  `        </a>

        <a class="game-card" data-theme="brass" href="games/brass-birmingham.html">
          <div class="card-banner">🏭</div>
          <div class="card-body">
            <h3 class="card-title">工业革命：伯明翰</h3>
            <p class="card-sub">Brass: Birmingham · Martin Wallace</p>
            <div class="card-meta">
              <span class="meta-chip">👥 2–4 人</span>
              <span class="meta-chip">⏱ 60–120 分钟</span>
            </div>
            <p class="card-desc">回到 1770–1870 年的英格兰：铺设运河与铁路，建设煤矿、棉花厂、陶器厂与啤酒厂，两个时代后争夺最高胜利点数。</p>
            <span class="card-link">阅读规则 →</span>
          </div>
        </a>

        <a class="game-card" data-theme="vale" href="games/vale-of-eternity.html">`);

// index.html: searchable featured entry
edit('index.html',
  'var featured = [\n      { name: "宝可梦林地探索", en: "Pokemon Grove", id: "pokemon-grove", players: "1-5", href: "games/pokemon-grove.html" }\n    ];',
  'var featured = [\n      { name: "宝可梦林地探索", en: "Pokemon Grove", id: "pokemon-grove", players: "1-5", href: "games/pokemon-grove.html" },\n      { name: "工业革命：伯明翰", en: "Brass: Birmingham", id: "brass-birmingham", players: "2-4", href: "games/brass-birmingham.html" }\n    ];');

// index.html: footer credit
edit('index.html',
  '永恒之谷整理自\n        <a href="https://www.bilibili.com/opus/890774653861101571" target="_blank" rel="noopener">啃规则的Lancer</a>；宝可梦林地探索整理自玩家提供的规则书扫描图。版权归原作者所有。',
  '永恒之谷整理自\n        <a href="https://www.bilibili.com/opus/890774653861101571" target="_blank" rel="noopener">啃规则的Lancer</a>；工业革命：伯明翰整理自\n        <a href="https://mp.weixin.qq.com/s/9p9dLk-auv57EnYaqD8pHA" target="_blank" rel="noopener">微信公众号《工业革命：伯明翰》中文规则书</a>；宝可梦林地探索整理自玩家提供的规则书扫描图。版权归原作者所有。');

// index.html: meta description
edit('index.html',
  'content="桌游规则书：七大奇迹、永恒之谷、展翅翱翔、宝可梦林地探索等桌游的中文规则速查',
  'content="桌游规则书：七大奇迹、工业革命：伯明翰、永恒之谷、展翅翱翔、宝可梦林地探索等桌游的中文规则速查');

// README: tree + source list
edit('README.md',
  '│   ├── 7-wonders.html       # 中文精选（人工整理）',
  '│   ├── 7-wonders.html       # 中文精选（人工整理）\n│   ├── brass-birmingham.html');
edit('README.md',
  '- [展翅翱翔](https://www.bilibili.com/opus/1030122149069717511/) · BGA桌游中文规则书',
  '- [展翅翱翔](https://www.bilibili.com/opus/1030122149069717511/) · BGA桌游中文规则书\n- [工业革命：伯明翰](https://mp.weixin.qq.com/s/9p9dLk-auv57EnYaqD8pHA) · 微信公众号（Roxley 官方繁中规则书转录为简体）');
console.log('done');
