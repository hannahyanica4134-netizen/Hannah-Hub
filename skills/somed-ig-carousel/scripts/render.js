#!/usr/bin/env node
// SOMED Skin Studio IG carousel renderer
// Usage: node render.js <spec.json> [outDir]
// Renders each slide as 1080x1350 HTML -> PNG @2x (2160x2700) + a contact sheet.

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const C = {
  mint: '#C8E5CB',   // 01 Signature Mint Green  主品牌色
  sage: '#A5C9A8',   // 02 Soft Sage Green       辅助色
  deep: '#376B4C',   // 03 Botanical Deep Green  强调色
  white: '#F8FAF6',  // 04 Clinical White        留白
  ink: '#22392B',    // 深绿墨色（标题第一行，取自 deep 加深）
  body: '#3F4F44',   // 正文
  muted: '#6B7F70',  // hook / 次要文字
};

// ---------- icons (line, 24-grid, stroke=currentColor) ----------
const ICONS = {
  drop: '<path d="M12 3c3.5 4.2 6 7.6 6 10.6A6 6 0 0 1 6 13.6C6 10.6 8.5 7.2 12 3z"/><path d="M9.5 14.5a2.6 2.6 0 0 0 2.5 2.4"/>',
  shield: '<path d="M12 3l7 3v5.5c0 4.3-3 7.8-7 9.5-4-1.7-7-5.2-7-9.5V6z"/><path d="M9 12l2.2 2.2L15.5 10"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  layers: '<path d="M12 3.5l8.5 4.5L12 12.5 3.5 8z"/><path d="M3.5 12L12 16.5 20.5 12"/><path d="M3.5 16L12 20.5 20.5 16"/>',
  check: '<circle cx="12" cy="12" r="8.5"/><path d="M8 12.2l2.7 2.7L16.2 9.4"/>',
  leaf: '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14z"/><path d="M5 19c3-4 6-6.5 9.5-8.5"/>',
  flask: '<path d="M9.5 3h5M10.5 3v6L5.5 18a2 2 0 0 0 1.8 3h9.4a2 2 0 0 0 1.8-3l-5-9V3"/><path d="M7.8 14.5h8.4"/>',
  face: '<circle cx="12" cy="12" r="8.5"/><path d="M9 10h.01M15 10h.01"/><path d="M8.8 14.5a4.2 4.2 0 0 0 6.4 0"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8"/>',
  wave: '<path d="M3 9c2.2-2 3.8-2 6 0s3.8 2 6 0 3.8-2 6 0"/><path d="M3 15c2.2-2 3.8-2 6 0s3.8 2 6 0 3.8-2 6 0"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  heart: '<path d="M12 20s-7.5-4.5-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.5-7.5 10-7.5 10z"/>',
  alert: '<path d="M12 3.5l9 16H3z"/><path d="M12 10v4.5M12 17.2h.01"/>',
  bulb: '<path d="M9 17.5h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2v.2h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>',
  chat: '<path d="M4 5.5h16v10.5H10l-4.5 3.5V16H4z"/><path d="M8.5 10.8h.01M12 10.8h.01M15.5 10.8h.01"/>',
};
const icon = (name, size, color, sw = 1.6) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ICONS.sparkle}</svg>`;

// **word** -> accent span ; newline -> <br>
const md = (s = '') => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/\*\*(.+?)\*\*/g, '<b class="acc">$1</b>')
  .replace(/\n/g, '<br>');

const dataUri = (p) => {
  if (!p) return null;
  const ext = path.extname(p).slice(1).toLowerCase().replace('jpg', 'jpeg');
  return `data:image/${ext === 'svg' ? 'svg+xml' : ext};base64,${fs.readFileSync(p).toString('base64')}`;
};

// ---------- base CSS ----------
const CSS = `
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1350px;overflow:hidden}
body{position:relative;font-family:'Noto Sans CJK SC','Noto Sans SC',sans-serif;color:${C.body};background:${C.white}}
.serif{font-family:'Noto Serif CJK SC','Noto Serif SC',serif}
.bg,.ov{position:absolute;inset:0}
.bg img{width:100%;height:100%;object-fit:cover}
.acc{color:${C.deep};font-weight:900}
.hl{background:linear-gradient(transparent 60%,var(--hl) 60%,var(--hl) 92%,transparent 92%);padding:0 4px;color:${C.deep}}
header{position:absolute;top:56px;left:64px;right:64px;display:flex;align-items:center;justify-content:space-between;z-index:5}
.brand{display:flex;align-items:center;gap:18px}
.logo{width:72px;height:72px;border-radius:50%;border:3px solid ${C.deep};background:#fff;overflow:hidden;display:flex;align-items:center;justify-content:center}
.logo img{width:100%;height:100%;object-fit:cover}
.logo.has-img{border:none;box-shadow:0 2px 10px rgba(55,107,76,.18)}
.logo .txt{font-weight:900;font-size:15px;letter-spacing:1.5px;color:${C.deep}}
.handle{font-size:30px;font-weight:700;color:${C.deep};letter-spacing:.5px}
.count{font-size:24px;color:${C.deep};background:rgba(255,255,255,.7);border:1.5px solid ${C.sage};border-radius:999px;padding:6px 20px}
.hint{flex:1;margin:0 20px;font-size:20px;line-height:1.3;color:#8A9A8E;text-align:right}
.hook{position:absolute;bottom:96px;left:64px;right:64px;font-size:26px;color:${C.muted};z-index:5}
footer{position:absolute;bottom:44px;left:64px;right:64px;display:flex;justify-content:space-between;font-size:26px;font-weight:700;color:#7F9584;letter-spacing:4px;z-index:5}
.bar{position:absolute;left:0;right:0;bottom:0;height:14px;background:${C.deep};z-index:5}
.main{position:absolute;top:150px;left:64px;right:64px;z-index:4}
h1{font-family:'Noto Serif CJK SC',serif;font-weight:700;font-size:76px;line-height:1.24;color:${C.ink}}
.rule{height:2px;background:linear-gradient(90deg,${C.deep},rgba(55,107,76,.08));margin:30px 0 26px}
.lead{font-size:28px;line-height:1.7;color:${C.body}}
.sub{font-family:'Noto Serif CJK SC',serif;font-size:34px;color:${C.body};line-height:1.5}
.tip{margin-top:20px;background:${C.deep};color:${C.white};border-radius:24px;padding:18px 30px;display:flex;align-items:center;gap:24px}
.tip p{font-family:'Noto Serif CJK SC',serif;font-size:30px;line-height:1.45;font-weight:600}
.tip .acc{color:${C.mint}}
`;

// decorative clinical background for light slides
const lightDeco = `<div class="bg" style="background:
  radial-gradient(circle at 96% 4%, ${C.mint} 0, rgba(200,229,203,.55) 180px, rgba(200,229,203,0) 420px),
  radial-gradient(circle at 0% 100%, rgba(165,201,168,.28) 0, rgba(165,201,168,0) 360px), ${C.white}"></div>`;

function frame(s, i, n, ctx, inner, opts = {}) {
  const dark = opts.dark;
  const logo = ctx.logo
    ? `<img src="${ctx.logo}">`
    : `<span class="txt">SOMED</span>`;
  let bg = opts.bg || '';
  if (s.photo && !opts.noPhoto) {
    bg = `<div class="bg"><img src="${dataUri(s.photo)}" style="object-position:${s.photoPos || '50% 50%'}"></div><div class="ov" style="background:${opts.overlay}"></div>`;
  }
  const hint = (!s.photo && s.photoHint) ? `<div class="hint">📷 建议照片：${md(s.photoHint)}</div>` : '';
  const right = i === n ? '收藏 · 分享' : '往左滑 →';
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}${opts.css || ''}</style></head>
<body style="--hl:${opts.hl || C.mint}${dark ? `;background:${C.deep}` : ''}">
${bg}
<header><div class="brand"><div class="logo${ctx.logo ? " has-img" : ""}">${logo}</div><div class="handle" ${dark ? `style="color:${C.white}"` : ''}>${ctx.handle}</div></div>
${hint}<div class="count" ${dark ? `style="background:rgba(255,255,255,.1);color:${C.mint};border-color:rgba(200,229,203,.5)"` : ''}>${i}/${n}</div></header>
${inner}
${s.hook ? `<div class="hook" ${dark ? `style="color:${C.sage}"` : ''}>${md(s.hook)}</div>` : ''}
<footer ${dark ? `style="color:${C.sage}"` : ''}><span>${ctx.footer}</span><span>${right}</span></footer>
<div class="bar" ${dark ? `style="background:${C.mint}"` : ''}></div>
</body></html>`;
}

const title2 = (t) => `<h1>${md(t[0])}<br><span class="hl">${md(t[1] || '')}</span></h1>`;

// ---------- slide types ----------
const T = {};

T.cover = (s, i, n, ctx) => {
  const css = `
  .cv{position:absolute;left:64px;right:64px;bottom:150px;z-index:4}
  .eb{display:flex;align-items:center;gap:20px;margin-bottom:18px}
  .eb i{display:block;width:56px;height:3px;border-radius:2px;background:${C.deep}}
  .eb span{font-family:'Noto Serif CJK SC',serif;font-weight:600;font-size:42px;letter-spacing:6px;color:${C.deep}}
  .eb em{font-style:normal;color:${C.sage}}
  .t1{font-family:'Noto Serif CJK SC',serif;font-weight:700;font-size:92px;line-height:1.3;color:${C.ink}}
  .t2{font-family:'Noto Serif CJK SC',serif;font-weight:700;font-size:88px;line-height:1.4}
  .tag{margin-top:26px;display:inline-flex;align-items:center;gap:20px;border:2px solid ${C.deep};border-radius:999px;padding:12px 16px;font-size:34px;background:rgba(248,250,246,.55)}
  .chip{background:${C.deep};color:${C.white};font-weight:700;border-radius:999px;padding:6px 22px}
  .sm{font-family:'Noto Serif CJK SC',serif;color:${C.deep};padding-right:14px}
  .ring{position:absolute;border-radius:50%;z-index:1}`;
  const eb = (s.eyebrow || []).map(md).join('<em>｜</em>');
  const deco = `<div class="bg" style="background:radial-gradient(circle at 72% 30%, #fff 0, rgba(255,255,255,.65) 160px, rgba(255,255,255,0) 460px), ${C.mint}"></div>
  <div class="ring" style="width:620px;height:620px;right:-150px;top:120px;border:2px solid rgba(55,107,76,.18)"></div>
  <div class="ring" style="width:420px;height:420px;right:-50px;top:220px;background:rgba(165,201,168,.35)"></div>
  <div class="ring" style="width:150px;height:150px;right:330px;top:200px;border:2px solid rgba(55,107,76,.25)"></div>`;
  const inner = `<div class="cv">
    ${eb ? `<div class="eb"><i></i><span>${eb}</span></div>` : ''}
    <div class="t1">${md(s.title[0])}</div>
    <div class="t2"><span class="hl">${md(s.title[1] || '')}</span></div>
    ${s.tag ? `<div class="tag"><span class="chip"># ${md(s.tag)}</span><span class="sm">${md(s.summary || '')}</span></div>` : ''}
  </div>`;
  return frame(s, i, n, ctx, inner, {
    css, hl: C.white, bg: deco,
    overlay: `linear-gradient(rgba(200,229,203,.25),rgba(200,229,203,0) 20%,rgba(200,229,203,0) 36%,rgba(200,229,203,.88) 56%,${C.mint} 70%)`,
  });
};

T.cards = (s, i, n, ctx) => {
  const css = `
  .cards{display:flex;flex-direction:column;gap:16px;margin-top:28px}
  .card{display:flex;align-items:center;gap:28px;background:#fff;border:2px solid ${C.sage};border-radius:28px;padding:18px 28px;box-shadow:0 6px 24px rgba(55,107,76,.06)}
  .ic{flex:none;width:88px;height:88px;border-radius:50%;background:${C.mint};display:flex;align-items:center;justify-content:center}
  .vb{flex:none;width:2px;align-self:stretch;background:${C.sage}}
  .ct{font-family:'Noto Serif CJK SC',serif;font-weight:700;font-size:40px;color:${C.deep};line-height:1.3}
  .cd{font-size:26px;line-height:1.55;color:${C.body};margin-top:4px}`;
  const cards = s.cards.map(c => `<div class="card"><div class="ic">${icon(c.icon, 58, C.deep)}</div><div class="vb"></div>
    <div><div class="ct">${md(c.title)}</div><div class="cd">${md(c.desc)}</div></div></div>`).join('');
  const inner = `<div class="main">${title2(s.title)}<div class="rule"></div>
    ${s.lead ? `<div class="lead">${md(s.lead)}</div>` : ''}
    <div class="cards">${cards}</div>
    ${s.tip ? `<div class="tip">${icon('bulb', 58, C.mint, 1.5)}<p>${md(s.tip)}</p></div>` : ''}</div>`;
  return frame(s, i, n, ctx, inner, { css, bg: lightDeco, overlay: overlayLight });
};

T.list = (s, i, n, ctx) => {
  const css = `
  .rows{display:flex;flex-direction:column;gap:18px;margin-top:28px}
  .row{display:flex;align-items:center;gap:26px;background:#fff;border:2px solid ${C.sage};border-radius:26px;padding:18px 28px;box-shadow:0 6px 24px rgba(55,107,76,.06)}
  .num{flex:none;width:62px;height:62px;border-radius:50%;background:${C.deep};color:${C.white};display:flex;align-items:center;justify-content:center;font-size:34px;font-weight:900}
  .rt{font-family:'Noto Serif CJK SC',serif;font-weight:700;font-size:40px;color:${C.deep};line-height:1.3}
  .rd{font-size:26px;line-height:1.5;color:${C.body};margin-top:4px}`;
  const rows = s.items.map((r, k) => `<div class="row"><div class="num">${k + 1}</div><div><div class="rt">${md(r.title)}</div><div class="rd">${md(r.desc)}</div></div></div>`).join('');
  const inner = `<div class="main">${title2(s.title)}<div class="rule"></div>
    ${s.sub ? `<div class="sub">${md(s.sub)}</div>` : ''}
    <div class="rows">${rows}</div>
    ${s.tip ? `<div class="tip">${icon('bulb', 58, C.mint, 1.5)}<p>${md(s.tip)}</p></div>` : ''}</div>`;
  return frame(s, i, n, ctx, inner, { css, bg: lightDeco, overlay: overlayLight });
};

T.product = (s, i, n, ctx) => {
  const css = `
  .pf{margin-top:26px;height:${s.features && s.features.length > 2 ? 470 : 560}px;border-radius:32px;overflow:hidden;background:radial-gradient(circle at 50% 45%,#fff 0,${C.mint} 70%);border:2px solid ${C.sage};display:flex;align-items:center;justify-content:center;position:relative}
  .pf img{width:100%;height:100%;object-fit:${s.photoFit || 'cover'};object-position:${s.photoPos || '50% 50%'}}
  .pf .ph{font-size:26px;color:${C.muted};text-align:center;line-height:1.6}
  .pn{position:absolute;left:24px;top:22px;background:${C.deep};color:${C.white};font-size:26px;font-weight:700;letter-spacing:3px;border-radius:999px;padding:8px 24px}
  .fg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:18px}
  .ft{background:#fff;border:2px solid ${C.sage};border-radius:22px;padding:16px 22px;display:flex;gap:16px;align-items:flex-start}
  .ft svg{flex:none;margin-top:2px}
  .fl{font-family:'Noto Serif CJK SC',serif;font-weight:700;font-size:32px;color:${C.deep}}
  .fd{font-size:23px;line-height:1.45;color:${C.body};margin-top:2px}`;
  const img = s.photo ? `<img src="${dataUri(s.photo)}">` : `<div class="ph">${icon('flask', 90, C.deep, 1.2)}<br>📷 ${md(s.photoHint || '产品照片')}</div>`;
  const feats = (s.features || []).map(f => `<div class="ft">${icon(f.icon || 'check', 40, C.deep, 1.8)}<div><div class="fl">${md(f.label)}</div><div class="fd">${md(f.desc)}</div></div></div>`).join('');
  const inner = `<div class="main">${title2(s.title)}
    <div class="pf">${img}${s.name ? `<div class="pn">${md(s.name)}</div>` : ''}</div>
    <div class="fg">${feats}</div></div>`;
  // photo lives in the frame, not full-bleed
  return frame({ ...s, photo: null, photoHint: null }, i, n, ctx, inner, { css, bg: lightDeco });
};

T.view = (s, i, n, ctx) => {
  const css = `
  .ve{font-size:30px;font-weight:900;letter-spacing:6px;color:${C.deep};display:flex;align-items:center;gap:16px}
  .ve i{display:block;width:40px;height:3px;background:${C.deep};border-radius:2px}
  .main h1{margin-top:14px}
  .vc{background:#fff;border:2px solid ${C.sage};border-radius:28px;padding:34px 36px;display:flex;flex-direction:column;gap:26px;box-shadow:0 10px 32px rgba(55,107,76,.08)}
  .vh{display:flex;justify-content:space-between;align-items:center;gap:20px}
  .vh b{font-size:32px;font-weight:900;letter-spacing:4px;color:${C.ink}}
  .vh span{background:${C.mint};color:${C.deep};font-size:26px;font-weight:900;border-radius:999px;padding:8px 24px;white-space:nowrap}
  .vr{display:flex;align-items:center;gap:22px;font-size:34px;font-weight:700;color:${C.ink};line-height:1.4}
  .vr i{flex:none;font-style:normal;width:56px;height:56px;border-radius:50%;background:${C.deep};color:${C.white};display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:900}
  .why{margin-top:30px;font-size:34px;line-height:1.55;color:${C.ink}}`;
  const pts = s.points.map((p, k) => `<div class="vr"><i>${k + 1}</i><span>${md(p)}</span></div>`).join('');
  const inner = `<div class="main"><div class="ve"><i></i>${md(s.eyebrow || '专业建议')}</div>${title2(s.title)}<div class="rule"></div>
    <div class="vc"><div class="vh"><b>${md(s.cardTitle || 'SOMED 的建议')}</b>${s.stance ? `<span>${md(s.stance)}</span>` : ''}</div>${pts}</div>
    ${s.why ? `<div class="why">${md(s.why)}</div>` : ''}</div>`;
  return frame(s, i, n, ctx, inner, { css, bg: lightDeco, overlay: overlayLight });
};

T.end = (s, i, n, ctx) => {
  const css = `
  h1{color:${C.white}}
  .hl{color:${C.mint};background:linear-gradient(transparent 62%,rgba(165,201,168,.38) 62%,rgba(165,201,168,.38) 92%,transparent 92%)}
  .rule{background:linear-gradient(90deg,${C.mint},rgba(200,229,203,.08))}
  .acc{color:${C.mint}}
  .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
  .tile{background:rgba(248,250,246,.08);border:1.5px solid rgba(200,229,203,.22);border-radius:20px;padding:22px 26px}
  .tl{font-family:'Noto Serif CJK SC',serif;font-weight:700;font-size:52px;color:${C.white};line-height:1.2}
  .tl small{font-size:28px;margin-left:6px}
  .ta{font-size:30px;font-weight:700;color:${C.mint};margin-top:6px;line-height:1.4}
  .cb{margin-top:56px;border:2px solid rgba(200,229,203,.75);border-radius:32px;padding:38px 40px}
  .cq{display:flex;align-items:center;gap:26px}
  .cq p{font-family:'Noto Serif CJK SC',serif;font-weight:700;font-size:50px;color:${C.white};line-height:1.3}
  .cdv{height:2px;background:rgba(248,250,246,.4);margin:26px 0}
  .ci{font-family:'Noto Serif CJK SC',serif;font-size:36px;color:${C.white};line-height:1.5}
  .bio{margin-top:30px;font-size:28px;color:${C.sage}}`;
  const grid = s.grid.map(g => `<div class="tile"><div class="tl">${md(g.label)}${g.unit ? `<small>${md(g.unit)}</small>` : ''}</div><div class="ta">${md(g.answer)}</div></div>`).join('');
  const bg = `<div class="bg" style="background:radial-gradient(circle at 85% 8%, rgba(200,229,203,.22) 0, rgba(200,229,203,0) 460px), radial-gradient(circle at 5% 95%, rgba(165,201,168,.18) 0, rgba(165,201,168,0) 420px), ${C.deep}"></div>`;
  const inner = `<div class="main">${title2(s.title)}<div class="rule"></div>
    <div class="grid">${grid}</div>
    <div class="cb"><div class="cq">${icon('chat', 80, C.mint, 1.5)}<p>${md(s.question)}</p></div><div class="cdv"></div><div class="ci">${md(s.invite)}</div></div>
    <div class="bio">${md(ctx.bio)}</div></div>`;
  return frame(s, i, n, ctx, inner, { css, bg, dark: true, noPhoto: true });
};

const overlayLight = `linear-gradient(rgba(248,250,246,.90),rgba(248,250,246,.82) 55%,rgba(248,250,246,.94))`;

// ---------- run ----------
(async () => {
  const specPath = process.argv[2];
  if (!specPath) { console.error('usage: node render.js spec.json [outDir]'); process.exit(1); }
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  const base = path.dirname(path.resolve(specPath));
  const res = (p) => (p ? path.resolve(base, p) : p);
  const skillDir = path.resolve(__dirname, '..');
  const defLogo = ['logo.png', 'logo.jpg', 'logo.jpeg', 'logo.svg'].map(f => path.join(skillDir, 'assets', f)).find(fs.existsSync);
  const logoPath = res(spec.logo) || defLogo;
  const ctx = {
    logo: logoPath && fs.existsSync(logoPath) ? dataUri(logoPath) : null,
    handle: spec.handle || 'somed.skinstudio',
    footer: spec.footer || 'SOMED SKIN STUDIO',
    bio: spec.bio || 'SOMED Skin Studio｜高级科技护肤 · 专业皮肤管理',
  };
  if (!ctx.logo) console.warn('⚠ 没找到 logo（assets/logo.png），先用 SOMED 文字圆标');
  const out = path.resolve(process.argv[3] || spec.out || path.join(base, 'out'));
  fs.mkdirSync(out, { recursive: true });
  const topic = spec.topic || 'SOMED';
  const n = spec.slides.length;

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 2 });
  const files = [];
  let problems = 0;
  for (let k = 0; k < n; k++) {
    const s = { ...spec.slides[k], photo: res(spec.slides[k].photo) };
    const fn = T[s.type];
    if (!fn) throw new Error('unknown slide type: ' + s.type);
    const html = fn(s, k + 1, n, ctx);
    const num = String(k + 1).padStart(2, '0');
    fs.writeFileSync(path.join(out, `${topic}轮播_${num}.html`), html);
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    // layout checks: content must end above the hook line; nothing horizontally overflowing
    const issues = await page.evaluate(() => {
      const r = [];
      const hook = document.querySelector('.hook') || document.querySelector('footer');
      const limit = hook.getBoundingClientRect().top - 12;
      document.querySelectorAll('.main,.cv').forEach(m => {
        const b = m.getBoundingClientRect().bottom;
        if (b > limit) r.push(`content bottom ${Math.round(b)} > limit ${Math.round(limit)} (overlaps hook/footer)`);
      });
      const hint = document.querySelector('.hint'), main = document.querySelector('.main');
      if (hint && main && hint.getBoundingClientRect().bottom > main.getBoundingClientRect().top + 2 && hint.getBoundingClientRect().left < main.getBoundingClientRect().right) {
        // hint overlaps content area — only a problem if it overlaps the h1 text
        const h1 = main.querySelector('h1');
        if (h1) { const a = hint.getBoundingClientRect(), c = h1.getBoundingClientRect(); if (a.bottom > c.top && a.left < c.right - 200) r.push('photo hint overlaps headline'); }
      }
      document.querySelectorAll('.main *, .cv *').forEach(e => { if (e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflow !== 'visible') r.push('overflow in ' + e.className); });
      if (document.documentElement.scrollHeight > 1350) r.push('page taller than 1350');
      return r;
    });
    if (issues.length) { problems++; console.warn(`⚠ slide ${num}: ${issues.join('; ')}`); }
    const file = path.join(out, `${topic}轮播_${num}_HD.png`);
    await page.screenshot({ path: file });
    files.push(file);
    console.log('✓', file);
  }
  // contact sheet
  const sheet = `<html><body style="margin:0;background:#ddd;display:grid;grid-template-columns:repeat(${Math.min(n, 4)},270px);gap:12px;padding:12px;width:max-content">
    ${files.map(f => `<img src="${dataUri(f)}" style="width:270px;height:337.5px">`).join('')}</body></html>`;
  const sp = await browser.newPage({ viewport: { width: Math.min(n, 4) * 282 + 12, height: 400 } });
  await sp.setContent(sheet, { waitUntil: 'load' });
  await sp.screenshot({ path: path.join(out, `_contact_sheet.png`), fullPage: true });
  await browser.close();
  console.log(problems ? `完成，但有 ${problems} 张需要调整` : '完成，排版检查通过');
})();
