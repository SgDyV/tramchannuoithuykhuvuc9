// Bộ thu thập tin tức — chạy bởi GitHub Actions (máy chủ, không bị rào CORS).
// Gom tin + ẢNH THẬT của từng bài, ghi ra news.json để trang web đọc trực tiếp.
import { writeFileSync, readFileSync } from 'node:fs';

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

// ═══════════ GIÁ SẢN PHẨM CHĂN NUÔI (nguồn chính thức: trang chủ Chi cục CNTY HCM) ═══════════
function parsePrices(html){
  const dec = s => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  let txt = dec(html);
  const cut = txt.search(/THĂM DÒ|function showPoll/i); if (cut > 0) txt = txt.slice(0, cut);
  const dm = txt.match(/tính đến ngày\s*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4})/i);
  const date = dm ? dm[1] : '';
  const H = {
    company:  'Giá sản phẩm chăn nuôi tại công ty',
    farm:     'Giá sản phẩm chăn nuôi tại hộ dân',
    egg:      'Giá trứng gia cầm',
    slaughter:'Giá sản phẩm chăn nuôi tại cơ sở giết mổ'
  };
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const anyH = '(?:' + Object.values(H).map(esc).join('|') + ')';
  const items = []; const seen = new Set();
  for (const key of Object.keys(H)) {
    const m = txt.match(new RegExp(esc(H[key]) + '([\\s\\S]*?)(?=' + anyH + '|$)', 'i'));
    if (!m) continue;
    const ire = /-\s*([^:]+?):\s*([0-9][0-9.\s]*(?:-\s*[0-9.\s]*)?\s*đ\s*\/?\s*(?:kg|quả|con)?)/gi;
    let r;
    while ((r = ire.exec(m[1]))) {
      const name = r[1].trim();
      let value = r[2].replace(/\s+/g, ' ').replace(/(\d)\s*đ/, '$1 đ').replace(/đ\s*\/\s*/, 'đ/').trim();
      if (key === 'egg') value = value.replace(/đ\/kg/, 'đ/quả');   // nguồn ghi nhầm đơn vị trứng
      const num = parseInt(((r[2].match(/[0-9.]+/) || [''])[0]).replace(/\./g, ''), 10) || null;
      const dk = key + '|' + name;
      if (name && /[0-9]/.test(value) && !seen.has(dk)) { seen.add(dk); items.push({ group: key, name, value, num }); }
    }
  }
  return { date, items };
}

try {
  const ph = await get('https://chicuccntyhcm.gov.vn/default.aspx');
  const pr = parsePrices(ph);
  if (pr && pr.items.length >= 6) {
    // Đọc giá cũ để tính xu hướng ▲▼=
    let prevMap = {};
    try { (JSON.parse(readFileSync('prices.json', 'utf8')).items || []).forEach(x => { prevMap[x.group + '|' + x.name] = x.num; }); } catch {}
    pr.items.forEach(x => {
      const old = prevMap[x.group + '|' + x.name];
      x.trend = (old == null || x.num == null || x.num === old) ? 'same' : (x.num > old ? 'up' : 'down');
    });
    const pout = { updated: new Date().toISOString(), date: pr.date, source: 'chicuccntyhcm.gov.vn', count: pr.items.length, items: pr.items };
    writeFileSync('prices.json', JSON.stringify(pout, null, 1));
    console.log('PRICES', pr.items.length, '| ngày', pr.date);
  } else {
    console.log('PRICES -> 0 (không đọc được, giữ prices.json cũ)');
  }
} catch (e) { console.log('PRICES ERR', e.message); }

// ═══════════ KHOA HỌC – CÔNG NGHỆ (channuoivietnam.com — chuyên mục KH&CN) ═══════════
// API trả toàn bộ danh mục (~47MB) nên chỉ cập nhật tối đa ~1 lần/ngày.
try {
  let need = true;
  try {
    const old = JSON.parse(readFileSync('khcn.json', 'utf8'));
    if (old.updated && (Date.now() - new Date(old.updated).getTime()) < 20 * 3600 * 1000) need = false;
  } catch {}
  if (!need) {
    console.log('KHCN -> còn mới (<20h), bỏ qua');
  } else {
    const KHCN_ID = 'fca53d3b-2302-4166-abfb-c50364a14fa6';
    const CAT = 'https://channuoivietnam.com/portal-type-news/' + KHCN_ID;
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), 90000);
    const r = await fetch('https://channuoivietnam.com/sys_news.ctr/get_list_news/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': UA, 'Referer': 'https://channuoivietnam.com/' },
      body: JSON.stringify({ id: KHCN_ID, page: 1 }),
      signal: ac.signal
    }).finally(() => clearTimeout(to));
    if (!r.ok) { console.log('KHCN -> HTTP', r.status); }
    else {
      const j = await r.json();
      let list = (j.list_news || []).filter(x => x.tieu_de && x.ngay_dang);
      list.sort((a, b) => new Date(b.ngay_dang) - new Date(a.ngay_dang));
      const items = list.slice(0, 15).map(x => ({
        title: String(x.tieu_de).replace(/\s+/g, ' ').trim(),
        link: CAT,
        date: x.ngay_dang,
        image: x.hinh_anh ? ('https://channuoivietnam.com' + (String(x.hinh_anh).startsWith('/') ? x.hinh_anh : '/' + x.hinh_anh)) : '',
        source: 'khcn', label: 'KH–CN · Chăn nuôi VN', icon: '🔬'
      }));
      writeFileSync('khcn.json', JSON.stringify({ updated: new Date().toISOString(), category: j.type_news_name || 'Khoa học công nghệ', source: CAT, count: items.length, items }, null, 1));
      console.log('KHCN', items.length, '| mới nhất', list[0] && list[0].ngay_dang);
    }
  }
} catch (e) { console.log('KHCN ERR', e.message); }
