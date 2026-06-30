// Bộ thu thập tin tức — chạy bởi GitHub Actions (máy chủ, không bị rào CORS).
// Gom tin từ nhiều nguồn, ghi ra news.json để trang web đọc trực tiếp (cùng nguồn).
import { writeFileSync } from 'node:fs';

const UA = 'Mozilla/5.0 (compatible; KV9NewsBot/1.0; +https://sgdyv.github.io/tramchannuoithuykhuvuc9/)';

// type:'rss' -> đọc feed XML | type:'html' -> bóc link bài từ trang danh sách
const SOURCES = [
  { key:'chicuccntyhcm', label:'Chi cục CNTY HCM', icon:'🏥', type:'rss',
    url:'https://chicuccntyhcm.gov.vn/syndication.axd' },
  { key:'channuoi', label:'Chăn nuôi VN', icon:'🌾', type:'rss',
    url:'https://channuoivietnam.com/feed/' },
  { key:'nhachannuoi', label:'Tạp chí Chăn nuôi VN', icon:'🐄', type:'rss',
    url:'https://nhachannuoi.vn/feed/' },
  { key:'mae', label:'Bộ NN&MT', icon:'🌿', type:'html', base:'https://mae.gov.vn',
    url:'https://mae.gov.vn/tin-tuc--su-kien', re:/<a[^>]+href="(\/[^"#?]+?-\d{4,}\.htm)"[^>]*>\s*([^<]{18,160}?)\s*<\/a>/gi },
];

async function get(url){
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 22000);
  try {
    const r = await fetch(url, { headers:{ 'User-Agent':UA, 'Accept':'*/*' }, redirect:'follow', signal:ac.signal });
    if (!r.ok) return '';
    return await r.text();
  } catch { return ''; } finally { clearTimeout(t); }
}

function decode(s){
  return (s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"')
    .replace(/&#0?39;|&apos;/g,"'").replace(/&nbsp;/g,' ')
    .replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(+n))
    .replace(/&amp;/g,'&')
    .replace(/\s+/g,' ').trim();
}

function item(src, title, link, date){
  return { title, link, date: date || '', source: src.key, label: src.label, icon: src.icon };
}

function parseRss(xml, src){
  const out = [];
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
  for (const b of blocks) {
    const title = decode((b.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '');
    let link = ((b.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || [])[1] || '').trim();
    if (!link) { const a = b.match(/<link[^>]+href="([^"]+)"/i); if (a) link = a[1]; }
    link = decode(link);
    const date = decode((b.match(/<(pubDate|updated|published)[^>]*>([\s\S]*?)<\/\1>/i) || [])[2] || '');
    if (title && /^https?:/.test(link)) out.push(item(src, title, link, date));
  }
  return out;
}

function parseHtml(html, src){
  const out = []; const seen = new Set();
  src.re.lastIndex = 0; let m;
  while ((m = src.re.exec(html))) {
    let link = m[1]; const title = decode(m[2]);
    if (link.startsWith('/')) link = src.base + link;
    if (title.length < 18 || seen.has(link)) continue;
    seen.add(link); out.push(item(src, title, link, ''));
    if (out.length >= 8) break;
  }
  return out;
}

const all = [];
for (const src of SOURCES) {
  try {
    const txt = await get(src.url);
    if (!txt) { console.log(src.key, '-> 0 (empty)'); continue; }
    const items = (src.type === 'rss' ? parseRss(txt, src) : parseHtml(txt, src)).slice(0, 10);
    items.forEach(it => all.push(it));
    console.log(src.key, '->', items.length);
  } catch (e) { console.log(src.key, '-> ERR', e.message); }
}

// bỏ trùng theo link
const seen = new Set(); const uniq = [];
for (const it of all) {
  const k = (it.link || it.title).toLowerCase();
  if (!seen.has(k)) { seen.add(k); uniq.push(it); }
}

const out = { updated: new Date().toISOString(), count: uniq.length, items: uniq };
writeFileSync('news.json', JSON.stringify(out, null, 1));
console.log('TOTAL', uniq.length);
