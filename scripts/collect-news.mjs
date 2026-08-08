// Bộ thu thập tin tức — chạy bởi GitHub Actions (máy chủ, không bị rào CORS).
// Gom tin + ẢNH THẬT của từng bài, ghi ra news.json để trang web đọc trực tiếp.
import { writeFileSync } from 'node:fs';

const UA = 'Mozilla/5.0 (compatible; KV9NewsBot/1.0; +https://sgdyv.github.io/tramchannuoithuykhuvuc9/)';

// Truy vấn Google Tin tức (tổng hợp bài từ RẤT NHIỀU báo VN theo chủ đề — không bị chặn).
const gn = q => 'https://news.google.com/rss/search?q=' + encodeURIComponent(q) + '&hl=vi&gl=VN&ceid=VN:vi';

// Báo Nông nghiệp & Môi trường — RSS theo chuyên mục, MỖI BÀI CÓ ẢNH THẬT + link trực tiếp.
const nnmt = s => ({ key:'nnmt', label:'Báo Nông nghiệp & Môi trường', icon:'🌾', type:'rss',
  base:'https://nongnghiepmoitruong.vn', max:8, url:'https://nongnghiepmoitruong.vn/' + s + '.rss' });

const SOURCES = [
  // Nguồn chính: Chi cục CNTY TP.HCM (có RSS + ảnh bài)
  { key:'chicuccntyhcm', label:'Chi cục CNTY HCM', icon:'🏥', type:'rss',
    base:'https://chicuccntyhcm.gov.vn', url:'https://chicuccntyhcm.gov.vn/syndication.axd' },
  // Báo NN&MT: 3 chuyên mục sát chủ đề — tất cả đều có ảnh bài
  nnmt('thu-y'), nnmt('chan-nuoi'), nnmt('dich-benh'),
  // Google Tin tức — gom tin từ nhiều báo theo chủ đề (giữ tên + LOGO báo gốc)
  { key:'gnews', label:'Tin tổng hợp', icon:'📰', type:'rss', base:'', gnews:true, max:10,
    url:gn('chăn nuôi thú y') },
  { key:'gnews', label:'Tin tổng hợp', icon:'📰', type:'rss', base:'', gnews:true, max:8,
    url:gn('dịch bệnh gia súc gia cầm an toàn thực phẩm') },
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

// Lấy ẢNH BÀI: image.axd (Chi cục) -> og:image -> media/enclosure/<img> (bỏ ảnh quảng cáo/giao diện).
function firstImg(html, base){
  if (!html) return '';
  const h = html
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"')
    .replace(/&#0?39;|&apos;/g,"'").replace(/&amp;/g,'&');
  const JUNK = /quang[_-]?cao|\/qc\/|banner|\blogo\b|sprite|placeholder|avatar|no[_-]?image|default|\/ads?[\/_.]/i;
  const abs = u => {
    u = (u || '').trim();
    if (/^https?:\/\//i.test(u)) return u;
    if (u.startsWith('//')) return 'https:' + u;
    return (base || 'https://chicuccntyhcm.gov.vn').replace(/\/$/, '') + '/' + u.replace(/^\//, '');
  };
  // 1) Chi cục: ảnh nội dung image.axd
  let m = h.match(/[^"'\s>)]*image\.axd\?picture=[^"'\s>)]+/i);
  if (m) return abs(m[0]);
  // 2) og:image — ảnh đại diện bài chuẩn
  m = h.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
   || h.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (m && !JUNK.test(m[1])) return abs(m[1]);
  // 3) media:content / enclosure / <img> — lấy ảnh đầu tiên không phải quảng cáo/giao diện
  const cands = []; let r;
  const reMedia = /(?:enclosure|media:content|media:thumbnail)[^>]+url=["']([^"']+\.(?:jpe?g|png|webp)[^"']*)["']/ig;
  while ((r = reMedia.exec(h))) cands.push(r[1]);
  const reImg = /<img[^>]+src=["']([^"']+\.(?:jpe?g|png|webp)[^"']*)["']/ig;
  while ((r = reImg.exec(h))) cands.push(r[1]);
  for (const u of cands) if (!JUNK.test(u)) return abs(u);
  return '';
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
    const image = firstImg(desc, src.base || '') || firstImg(b, src.base || '');
    if (!title || !/^https?:/.test(link)) continue;
    if (src.gnews) {
      // Tiêu đề Google có dạng "Nội dung - Tên báo" -> tách tên báo làm nhãn
      const i = title.lastIndexOf(' - ');
      let t = title, paper = '';
      if (i > 12 && title.length - i < 40) { t = title.slice(0, i).trim(); paper = title.slice(i + 3).trim(); }
      // <source url="https://bao.vn">Tên báo</source> -> LOGO nguồn (favicon) + tên đẹp
      const sm = b.match(/<source[^>]+url="([^"]+)"[^>]*>([\s\S]*?)<\/source>/i);
      let dom = '', name = paper;
      if (sm) {
        dom = sm[1].replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase();
        const sn = decode(sm[2]);
        if (sn && !/^[a-z0-9.\-]+\.[a-z]{2,}$/i.test(sn)) name = sn;
      }
      const it = item(src, t, link, date, dom ? 'https://www.google.com/s2/favicons?domain=' + dom + '&sz=128' : '');
      it.label = name || paper || dom || src.label;
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
