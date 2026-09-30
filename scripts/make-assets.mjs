// assets/ klasöründeki uygulama simgesi ve açılış ekranı kaynak PNG'lerini üretir.
// Kendi tasarımını kullanmak istersen bu PNG'leri değiştir ve `npm run assets` çalıştır.
import { chromium } from 'playwright';

const logo = (size, bg) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">
  ${bg ? `<rect width="512" height="512" fill="${bg}"/>` : ''}
  <circle cx="256" cy="256" r="176" fill="#1ed760"/>
  <path fill="#121212" d="M214 330a42 42 0 1 1-20-36V170l150-28v158a42 42 0 1 1-20-36V184l-110 20z"/>
</svg>`;

const pages = [
  // Tam simge (iOS ve eski Android)
  { file: 'icon-only.png', w: 1024, h: 1024, html: logo(1024, '#121212') },
  // Android uyarlanabilir simge: ön plan (şeffaf, güvenli alanda) + arka plan
  { file: 'icon-foreground.png', w: 1024, h: 1024, html: `<div style="width:1024px;height:1024px;display:grid;place-items:center">${logo(640)}</div>`, transparent: true },
  { file: 'icon-background.png', w: 1024, h: 1024, html: '<div style="width:1024px;height:1024px;background:#121212"></div>' },
  // Açılış ekranı
  { file: 'splash.png', w: 2732, h: 2732, html: `<div style="width:2732px;height:2732px;background:#000;display:grid;place-items:center">${logo(560)}</div>` },
  { file: 'splash-dark.png', w: 2732, h: 2732, html: `<div style="width:2732px;height:2732px;background:#000;display:grid;place-items:center">${logo(560)}</div>` },
];

const browser = await chromium.launch();
for (const p of pages) {
  const page = await browser.newPage({ viewport: { width: p.w, height: p.h } });
  await page.setContent(`<html><body style="margin:0;background:transparent">${p.html}</body></html>`);
  await page.screenshot({ path: `assets/${p.file}`, omitBackground: !!p.transparent });
  await page.close();
  console.log('assets/' + p.file);
}
await browser.close();
