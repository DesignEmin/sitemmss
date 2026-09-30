// Uçtan uca test: derlenmiş uygulamayı (www/) gerçek bir tarayıcıda açar ve tüm ana özellikleri dener.
// Çalıştırma: npm run build && npm test
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = 'www';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  try {
    const body = await readFile(join(ROOT, path.endsWith('/') ? path + 'index.html' : path));
    res.writeHead(200, { 'content-type': types[extname(path)] || 'text/html' });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, r));
const URL_BASE = `http://localhost:${server.address().port}/`;

// Test için kısa WAV dosyaları üret
function wav(seconds, freq) {
  const rate = 8000;
  const n = rate * seconds;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(6000 * Math.sin((2 * Math.PI * freq * i) / rate)), 44 + i * 2);
  return buf;
}
const dir = await mkdtemp(join(tmpdir(), 'muzigim-'));
const names = ['Sezen Aksu - Gidiyorum', 'Tarkan - Simarik', 'Baris Manco - Gulpembe', 'MFO - Ele Gune Karsi', 'Duman - Bu Aksam'];
const files = [];
for (let i = 0; i < names.length; i++) {
  const f = join(dir, names[i] + '.wav');
  await writeFile(f, wav(3 + i, 220 * (i + 1)));
  files.push(f);
}

let failed = 0;
const check = (cond, msg) => {
  console.log(`${cond ? '✔' : '✘'} ${msg}`);
  if (!cond) failed++;
};

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const go = async (hash) => { await page.evaluate((h) => { location.hash = h; }, hash); await page.waitForTimeout(150); };
const rows = () => page.locator('#view .row');

try {
  await page.goto(URL_BASE);
  await page.waitForSelector('.empty-state');
  check(true, 'Uygulama açıldı, boş kitaplık ekranı görünüyor');

  // --- Şarkı yükleme
  await page.setInputFiles('#fileInput', files);
  await page.waitForFunction(() => /eklendi/.test(document.querySelector('#toast-import')?.textContent || ''), null, { timeout: 30000 });
  await go('#/library');
  check((await rows().count()) === 5, '5 şarkı yüklendi');
  check((await page.locator('#view .row .title').allTextContents()).includes('Simarik'), 'Başlık dosya adından okundu');
  check((await page.locator('#view .row .sub').allTextContents()).includes('Tarkan'), 'Sanatçı dosya adından okundu');

  // Aynı dosyayı tekrar yükleme
  await page.setInputFiles('#fileInput', [files[0]]);
  await page.waitForFunction(() => /zaten vardı/.test(document.querySelector('#toast-import')?.textContent || ''), null, { timeout: 10000 });
  await page.waitForTimeout(200);
  check((await rows().count()) === 5, 'Aynı şarkı ikinci kez eklenmedi');

  // --- Çalma
  await rows().nth(0).click();
  await page.waitForTimeout(500);
  const firstTitle = await page.locator('#view .row .title').nth(0).textContent();
  check(await page.evaluate(() => !document.getElementById('audio').paused), 'Şarkıya tıklayınca çalmaya başladı');
  check((await page.textContent('#pTitle')) === firstTitle, 'Çalar çubuğunda doğru şarkı görünüyor');
  await page.click('#btnPlay');
  check(await page.evaluate(() => document.getElementById('audio').paused), 'Duraklat düğmesi çalışıyor');
  await page.click('#btnPlay');
  await page.click('[data-action=next]');
  await page.waitForTimeout(300);
  const secondTitle = await page.locator('#view .row .title').nth(1).textContent();
  check((await page.textContent('#pTitle')) === secondTitle, 'Sonraki şarkıya geçildi');
  await page.click('#btnShuffle');
  check(await page.locator('#btnShuffle.on').count() === 1, 'Karıştırma açıldı');
  await page.click('#btnShuffle');
  await page.click('#btnRepeat');
  check(await page.locator('#btnRepeat.on').count() === 1, 'Tekrar modu açıldı');

  // --- Beğenme
  await rows().nth(2).locator('[data-action=like]').click({ force: true });
  await rows().nth(3).locator('[data-action=like]').click({ force: true });
  await go('#/liked');
  check((await rows().count()) === 2, 'Beğenilen Şarkılar listesinde 2 şarkı var');
  await rows().nth(0).locator('[data-action=like]').click({ force: true });
  await page.waitForTimeout(150);
  check((await rows().count()) === 1, 'Beğeniyi geri alınca listeden çıktı');
  await page.click('#pLike');
  await page.waitForTimeout(150);
  check((await rows().count()) === 2, 'Çalar çubuğundaki kalp ile beğenme çalışıyor');

  // --- Çalma listesi oluşturma
  await page.click('.side-btn[data-action=new-playlist]');
  await page.fill('.modal input[name=name]', 'Yol Şarkıları');
  await page.click('.modal button[type=submit]');
  await page.waitForTimeout(300);
  check((await page.evaluate(() => location.hash)).startsWith('#/playlist/'), 'Yeni çalma listesi oluşturuldu ve açıldı');
  check((await page.locator('.side-playlists a').count()) === 1, 'Liste kenar çubuğunda görünüyor');
  for (let i = 0; i < 3; i++) { await page.locator('[data-action=pl-add-song]').first().click(); await page.waitForTimeout(150); }
  check((await rows().count()) === 3, 'Listeye 3 şarkı eklendi');

  // Sıralama (menüden aşağı taşı)
  const before = await page.locator('#view .row .title').allTextContents();
  await rows().nth(0).locator('[data-action=more]').click({ force: true });
  await page.click('[data-menu=down]');
  await page.waitForTimeout(200);
  const after = await page.locator('#view .row .title').allTextContents();
  check(after[0] === before[1] && after[1] === before[0], 'Şarkı listede aşağı taşındı');

  // Listeden kaldırma
  await rows().nth(2).locator('[data-action=more]').click({ force: true });
  await page.click('[data-menu=rm-pl]');
  await page.waitForTimeout(200);
  check((await rows().count()) === 2, 'Şarkı listeden kaldırıldı');

  // Listeyi çal
  await page.click('.action-bar [data-action=play-list]');
  await page.waitForTimeout(300);
  check((await page.textContent('#pTitle')) === after[0], 'Liste baştan çalınıyor');

  // Listeyi düzenle
  await page.click('.action-bar [data-action=pl-edit]');
  await page.fill('.modal input[name=name]', 'Yolculuk');
  await page.fill('.modal textarea[name=description]', 'Uzun yol için');
  await page.click('.modal button[type=submit]');
  await page.waitForTimeout(200);
  check((await page.textContent('.hero h1')) === 'Yolculuk', 'Liste adı değiştirildi');

  // --- Kitaplıktan "Çalma listesine ekle" penceresi
  await go('#/library');
  await rows().nth(4).locator('[data-action=more]').click({ force: true });
  await page.click('[data-menu=add-pl]');
  await page.locator('.pick-row[data-pick]:not(.new)').first().click();
  await page.waitForTimeout(200);
  check(await page.locator('.pick-row.on').count() === 1, 'Pencereden listeye eklendi');
  await page.click('.modal-actions [data-action=close-modal]');

  // Pencereden yeni liste oluşturup ekleme
  await rows().nth(0).locator('[data-action=more]').click({ force: true });
  await page.click('[data-menu=add-pl]');
  await page.click('.pick-row.new');
  await page.fill('.modal input[name=name]', 'Sakin');
  await page.click('.modal button[type=submit]');
  await page.waitForTimeout(300);
  check((await page.locator('.side-playlists a').count()) === 2, 'Pencereden yeni liste oluşturuldu');

  // --- Sıra
  await rows().nth(0).click();
  await page.waitForTimeout(200);
  await rows().nth(3).locator('[data-action=more]').click({ force: true });
  await page.click('[data-menu=play-next]');
  const nextTitle = await page.locator('#view .row .title').nth(3).textContent();
  await go('#/queue');
  check((await page.locator('#view .table').nth(1).locator('.row .title').first().textContent()) === nextTitle, '“Sıradaki olarak çal” sıranın başına ekledi');
  await page.locator('[data-action=q-remove]').first().click();
  await page.waitForTimeout(150);
  check((await page.locator('#view .table').nth(1).locator('.row .title').first().textContent()) !== nextTitle, 'Sıradan kaldırma çalışıyor');

  // --- Arama (Türkçe karakter duyarsız)
  await go('#/search');
  await page.fill('#searchInput', 'gülpembe');
  await page.waitForTimeout(200);
  check((await rows().count()) === 1, 'Arama “gülpembe” ile “Gulpembe”yi buldu');

  // --- Şarkı bilgisi düzenleme
  await rows().nth(0).locator('[data-action=more]').click({ force: true });
  await page.click('[data-menu=edit]');
  await page.fill('.modal input[name=title]', 'Gül Pembe');
  await page.fill('.modal input[name=album]', 'Sarı Çizmeli');
  await page.click('.modal button[type=submit]');
  await go('#/album/' + encodeURIComponent('Sarı Çizmeli'));
  check((await rows().count()) === 1 && (await page.locator('#view .row .title').first().textContent()) === 'Gül Pembe', 'Şarkı bilgisi düzenlendi, albüm sayfası çalışıyor');
  await go('#/artist/' + encodeURIComponent('Tarkan'));
  check((await rows().count()) === 1, 'Sanatçı sayfası çalışıyor');

  // --- Kalıcılık (sayfa yenileme)
  const playingBefore = await page.textContent('#pTitle');
  await page.reload();
  await page.waitForTimeout(800);
  await go('#/library');
  check((await rows().count()) === 5, 'Yenilemeden sonra şarkılar duruyor');
  check((await page.locator('.side-playlists a').count()) === 2, 'Yenilemeden sonra listeler duruyor');
  check((await page.textContent('#pTitle')) === playingBefore, 'Yenilemeden sonra son çalan şarkı hatırlandı');
  await go('#/liked');
  check((await rows().count()) === 2, 'Yenilemeden sonra beğeniler duruyor');

  // --- Şarkı silme
  await go('#/library');
  await rows().nth(0).locator('[data-action=more]').click({ force: true });
  await page.click('[data-menu=delete]');
  await page.click('.modal button[type=submit]');
  await page.waitForTimeout(300);
  check((await rows().count()) === 4, 'Şarkı kitaplıktan silindi');

  // --- Liste silme
  await page.locator('.side-playlists a').first().click();
  await page.waitForTimeout(200);
  await page.click('.action-bar [data-action=pl-delete]');
  await page.click('.modal button[type=submit]');
  await page.waitForTimeout(300);
  check((await page.locator('.side-playlists a').count()) === 1, 'Çalma listesi silindi');

  // --- Telefon görünümü
  await page.setViewportSize({ width: 390, height: 844 });
  await go('#/library');
  check(await page.locator('.bottom-nav').isVisible(), 'Telefonda alt menü görünüyor');
  check(!(await page.locator('.sidebar').isVisible()), 'Telefonda yan menü gizli');
  await rows().nth(0).locator('[data-action=more]').click();
  check(await page.locator('#menu.sheet').isVisible(), 'Telefonda menü alttan açılıyor');
  await page.keyboard.press('Escape');
  await rows().nth(1).click();
  await page.waitForTimeout(300);
  check(await page.evaluate(() => !document.getElementById('audio').paused), 'Telefonda şarkıya dokununca çalıyor');
  await page.click('#pTitle');
  await page.waitForTimeout(400);
  check(await page.locator('#nowPlaying.open').isVisible(), 'Tam ekran çalar açılıyor');
  check(await page.locator('#nowPlaying [data-action=next]').isVisible(), 'Tam ekran çalarda kontroller görünüyor');
  await page.click('#nowPlaying [data-action=close-now-playing]');

  check(errors.length === 0, 'Konsolda hata yok' + (errors.length ? ': ' + errors.join(' | ') : ''));
} catch (err) {
  console.error(err);
  failed++;
} finally {
  await browser.close();
  server.close();
}

console.log(failed ? `\n${failed} test başarısız` : '\nTüm testler geçti');
process.exit(failed ? 1 : 0);
