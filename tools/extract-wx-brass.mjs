import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const html = readFileSync('_bga/wx-brass.html', 'utf8');

// isolate js_content
const start = html.indexOf('id="js_content"');
const end = html.indexOf('id="js_tags"', start);
const body = html.slice(start, end > 0 ? end : start + 2000000);

// extract images in order
const imgs = [];
const re = /<img[^>]*>/g;
let m;
while ((m = re.exec(body)) !== null) {
  const tag = m[0];
  const src = (tag.match(/data-src="([^"]+)"/) || tag.match(/src="([^"]+)"/) || [])[1] || '';
  const alt = (tag.match(/alt="([^"]*)"/) || [])[1] || '';
  const w = (tag.match(/data-w="(\d+)"/) || [])[1] || '';
  imgs.push({ src, alt, w });
}

// extract text: strip tags
let text = body
  .replace(/<img[^>]*>/g, '\n[IMG]\n')
  .replace(/<br\s*\/?>/g, '\n')
  .replace(/<\/(p|div|section|h1|h2|h3|h4|li|tr|blockquote)>/g, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'");
text = text.split('\n').map(l => l.trim()).filter(l => l.length > 0).join('\n');

mkdirSync('_bga/wx-brass', { recursive: true });
writeFileSync('_bga/wx-brass/text.txt', text);
writeFileSync('_bga/wx-brass/images.json', JSON.stringify(imgs, null, 2));
console.log('images:', imgs.length);
console.log('text chars:', text.length);
imgs.forEach((im, i) => console.log(`${i}: w=${im.w} alt=${im.alt.slice(0,30)} ${im.src.slice(0, 90)}`));
