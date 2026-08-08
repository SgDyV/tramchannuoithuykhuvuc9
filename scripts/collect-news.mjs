// Bộ thu thập tin tức — chạy bởi GitHub Actions (máy chủ, không bị rào CORS).
// Gom tin + ẢNH THẬT của từng bài, ghi ra news.json để trang web đọc trực tiếp.
import { writeFileSync } from 'node:fs';

const UA = 'Mozilla/5.0 (compatible; KV9NewsBot/1.0; +https://sgdyv.github.io/tramchannuoithuykhuvuc9/)';

// Truy vấn Google Tin tức (tổng hợp bài từ RẤT NHIỀU báo VN theo chủ đề — không bị chặn).
const gn = q => 'https://news.google.com/rss/search?q=' + encodeURIComponent(q) + '&hl=vi&gl=VN&ceid=VN:vi';

const SOURCES = [
  // Nguồn chính: Chi cục CNTY TP.HCM (có RSS + ảnh bài)
  { key:'chicuccntyhcm', label:'Chi cục CNTY HCM', icon:'🏥', type:'rss',
    base:'https://chicuccntyhcm.gov.vn', url:'https://chicuccntyhcm.gov.vn/syndication.axd' },
  // Bộ NN&MT (quét trang chủ — đôi khi chặn, để thử)
  { key:'mae', label:'Bộ NN&MT', icon:'🌿', type:'html', base:'https://mae.gov.vn',
    url:'https://mae.gov.vn/', re:/<a[^>]+href="(\/[^"#?]+?-\d{4,}\.htm)"[^>]*>\s*([^<]{18,160}?)\s*<\/a>/gi },
  // Google Tin tức — gom tin từ nhiều báo theo chủ đề (mỗi bài giữ tên báo gốc)
  { key:'gnews', label:'Tin tổng hợp', icon:'📰', type:'rss', base:'', gnews:true, max:14,
    url:gn('chăn nuôi thú y') },
  { key:'gnews', label:'Tin tổng hợp', icon:'📰', type:'rss', base:'', gnews:true, max:10,
    url:gn('dịch bệnh gia súc gia cầm') },
  { key:'gnews', label:'Tin tổng hợp', icon:'📰', type:'rss', base:'', gnews:true, max:8,
    url:gn('an toàn thực phẩm thịt heo tiêm phòng vắc xin') },
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
    if (!title || !/^https?:/.test(link)) continue;
    if (src.gnews) {
      // Tiêu đề Google có dạng "Nội dung - Tên báo" -> tách tên báo làm nhãn
      const i = title.lastIndexOf(' - ');
      let t = title, paper = src.label;
      if (i > 12 && title.length - i < 40) { t = title.slice(0, i).trim(); paper = title.slice(i + 3).trim(); }
      const it = item(src, t, link, date, '');
      it.label = paper || src.label;
      out.push(it);
    } else {
      out.push(item(src, title, link, date, image));
    }
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
    const items = (src.type === 'rss' ? parseRss(txt, src) : parseHtml(txt, src)).slice(0, src.max || 10);
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
