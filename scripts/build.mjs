// src/ klasöründen www/ klasörüne üretim çıktısı oluşturur.
// Kullanım: node scripts/build.mjs          -> tek seferlik derleme
//           node scripts/build.mjs --serve  -> http://localhost:8000 adresinde geliştirme sunucusu
import * as esbuild from 'esbuild';
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const serve = process.argv.includes('--serve');
const out = 'www';

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const f of ['index.html', 'manifest.webmanifest', 'sw.js', 'css', 'icons']) {
  cpSync(`src/${f}`, `${out}/${f}`, { recursive: true });
}

// Her derlemede service worker önbellek sürümünü yenile ki telefonlar/tarayıcılar güncel dosyayı alsın
const sw = readFileSync(`${out}/sw.js`, 'utf8').replace('__BUILD_ID__', Date.now().toString(36));
writeFileSync(`${out}/sw.js`, sw);

const options = {
  entryPoints: ['src/js/app.js'],
  outfile: `${out}/js/app.js`,
  bundle: true,
  format: 'esm',
  splitting: false,
  minify: !serve,
  sourcemap: serve,
  target: ['es2020', 'chrome89', 'safari15'],
  logLevel: 'info',
};

if (serve) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: out, port: 8000 });
  console.log(`Geliştirme sunucusu: http://localhost:${port}`);
} else {
  await esbuild.build(options);
}
