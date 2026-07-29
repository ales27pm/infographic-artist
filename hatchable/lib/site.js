const esc = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
export function page(title, content, description = '') {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>${description ? `<meta name="description" content="${esc(description)}">` : ''}<style>:root{color-scheme:dark;background:#080a0f;color:#eef1f7;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 15% 0,#202941 0,transparent 34rem),#080a0f;line-height:1.65}main{max-width:900px;margin:auto;padding:72px 26px 96px}header{margin-bottom:48px}.eyebrow{letter-spacing:.16em;text-transform:uppercase;font-size:.74rem;color:#8aa4ff}.hero{font-size:clamp(2.4rem,7vw,5.6rem);line-height:.92;margin:.35rem 0 1.1rem;letter-spacing:-.055em}.lede{max-width:720px;color:#b6bfd2;font-size:1.15rem}.card{background:rgba(18,22,33,.82);border:1px solid #2d3548;border-radius:18px;padding:24px;margin:18px 0;box-shadow:0 20px 70px rgba(0,0,0,.22)}h1,h2,h3{line-height:1.15}h2{margin-top:2.2rem}a{color:#9eb5ff}ul{padding-left:1.25rem}code{background:#171c29;padding:.15rem .35rem;border-radius:.35rem}.status{display:inline-flex;gap:.55rem;align-items:center;border:1px solid #33405b;border-radius:999px;padding:.4rem .8rem;color:#cad4e8}.dot{width:.55rem;height:.55rem;background:#65e6a7;border-radius:50%;box-shadow:0 0 18px #65e6a7}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}.metric strong{display:block;font-size:1.7rem}</style></head><body><main>${content}</main></body></html>`;
}
export function setCommonHeaders(res, contentType = 'text/html; charset=utf-8') {
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
}