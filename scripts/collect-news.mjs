// Bộ thu thập tin tức — chạy bởi GitHub Actions (máy chủ, không bị rào CORS).
// Gom tin + ẢNH THẬT của từng bài, ghi ra news.json để trang web đọc trực tiếp.
import { writeFileSync } from 'node:fs';

const UA = 'Mozilla/5.0 (compatible; KV9NewsBot/1.0; +https://sgdyv.github.io/tramchannuoithuykhuvuc9/)';

const SOURCES = [
  { key:'chicuccntyhcm', label:'Chi cục CNTY HCM', icon:'🏥', type:'rss',
    base:'https://chicuccntyhcm.gov.vn', url:'https://chicuccntyhcm.gov.vn/syndication.axd' },
  { key:'mae', label:'Bộ NN&MT', icon:'🌿', type:'html', base:'https://mae.gov.vn',
    url:'https://mae.gov.vn/', re:/<a[^>]+href="(\/[^"#?]+?-\d{4,}\.htm)"[^>]*>\s*([^<]{18,160}?)\s*<\/a>/gi },
  { key:'channuoi', label:'Chăn nuôi VN', icon:'🌾', type:'rss', base:'https://channuoivietnam.com',
    url:'https://channuoivietnam.com/feed/' },
  { key:'nhachannuoi', label:'Tạp chí Chăn nuôi VN', icon:'🐄', type:'rss', base:'https://nhachannuoi.vn',
    url:'https://nhachannuoi.vn/feed/' },
  { key:'cucthuy', label:'Cục CN&TY', icon:'🐄', type:'html', base:'https://cucthuy.gov.vn',
    url:'https://cucthuy.gov.vn/web/guest/tin-tuc-su-kien',
    re:/<a[^>]+href="(https?:\/\/cucthuy\.gov\.vn\/web\/guest\/-\/[^"#?]{20,})"[^>]*>\s*([^<]{25,160}?)\s*<\/a>/gi },
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

// Lấy ẢNH NỘI DUNG BÀI (image.axd) — bỏ qua mọi ảnh giao diện (logo/banner/gif).
function firstImg(html, base){
  if (!html) return '';
  const h = html
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"')
    .replace(/&#0?39;|&apos;/g,"'").replace(/&amp;/g,'&');
  const m = h.match(/image\.axd\?picture=[^"'\s>)]+/i);
  if (!m) return '';
  const u = m[0].replace(/&amp;/g,'&').replace(/^\//,'');
  return (base || 'https://chicuccntyhcm.gov.vn') + '/' + u;
}

function item(src, title, link, date, image){
  return { title, link, date: date || '', image: image || '', source: src.key, label: src.label, icon: src.icon };
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
    const desc = (b.match(/<(description|content:encoded|summary)[^>]*>([\s\S]*?)<\/\1>/i) || [])[2] || '';
    const image = firstImg(desc, src.base || '');
    if (title && /^https?:/.test(link)) out.push(item(src, title, link, date, image));
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
    seen.add(link); out.push(item(src, title, link, '', ''));
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

// Bổ sung ảnh cho bài của Chi cục còn thiếu (tải trang bài để lấy ảnh đầu)
for (const it of all) {
  if (it.image || it.source !== 'chicuccntyhcm') continue;
  try {
    const html = await get(it.link);
    it.image = firstImg(html, 'https://chicuccntyhcm.gov.vn');
  } catch {}
}

// bỏ trùng theo link
const seen = new Set(); const uniq = [];
for (const it of all) {
  const k = (it.link || it.title).toLowerCase();
  if (!seen.has(k)) { seen.add(k); uniq.push(it); }
}

const out = { updated: new Date().toISOString(), count: uniq.length, items: uniq };
writeFileSync('news.json', JSON.stringify(out, null, 1));
console.log('TOTAL', uniq.length, '| có ảnh:', uniq.filter(x => x.image).length);
