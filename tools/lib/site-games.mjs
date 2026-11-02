// 站点游戏注册表装载器:content/site-games.json 是「本站收录哪些游戏」的单一事实源。
// 消费方:sync-sidebar / sync-index / add-bgg-chips-manual / assemble-*。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const REGISTRY = path.join(ROOT, "content", "site-games.json");

export function loadRegistry() {
  const reg = JSON.parse(fs.readFileSync(REGISTRY, "utf8"));
  const bySlug = new Map(reg.games.map((g) => [g.slug, g]));
  if (bySlug.size !== reg.games.length) {
    throw new Error("site-games.json: 存在重复 slug");
  }
  for (const slug of reg.featuredOrder) {
    if (!bySlug.has(slug)) throw new Error(`site-games.json: featuredOrder 引用了不存在的 slug "${slug}"`);
  }
  return { reg, bySlug };
}

/** 侧边栏条目 [[文件名, 标签], ...](数组顺序即侧边栏顺序;有 emoji 的才进侧边栏) */
export function sidebarGames() {
  const { reg } = loadRegistry();
  return reg.games
    .filter((g) => g.emoji)
    .map((g) => {
      const file = path.basename(g.href);
      return [file, g.sidebar ?? `${g.emoji} ${g.zh}`];
    });
}

/** 首页 featured 数组(与 index.html 内联数组同形,顺序=featuredOrder) */
export function featuredList() {
  const { reg, bySlug } = loadRegistry();
  return reg.featuredOrder.map((slug) => {
    const g = bySlug.get(slug)!;
    return { name: g.zh, en: g.en, id: g.slug, players: g.players, href: g.href };
  });
}

/** 独立规则页 slug 清单(games/<slug>.html,非 games/bga/ 路径) */
export function standaloneSlugs() {
  const { reg } = loadRegistry();
  return reg.games.filter((g) => /^games\/[^/]+\.html$/.test(g.href)).map((g) => g.slug);
}
