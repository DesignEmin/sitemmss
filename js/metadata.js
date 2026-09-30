// Ses dosyalarından başlık / sanatçı / albüm / kapak bilgisini okur (ID3v2 + dosya adı).

const synchsafe = (b, o) => ((b[o] & 0x7f) << 21) | ((b[o + 1] & 0x7f) << 14) | ((b[o + 2] & 0x7f) << 7) | (b[o + 3] & 0x7f);
const uint32 = (b, o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
const uint24 = (b, o) => (b[o] << 16) | (b[o + 1] << 8) | b[o + 2];

function decode(bytes, enc) {
  const label = ['windows-1252', 'utf-16', 'utf-16be', 'utf-8'][enc] || 'utf-8';
  try {
    return new TextDecoder(label).decode(bytes).replace(/\0+$/g, '').replace(/\0/g, ' / ').trim();
  } catch {
    return '';
  }
}

// Kodlamaya göre null sonlandırıcının bittiği konumu bulur
function findTerminator(bytes, start, enc) {
  const wide = enc === 1 || enc === 2;
  for (let i = start; i < bytes.length; i += wide ? 2 : 1) {
    if (bytes[i] === 0 && (!wide || bytes[i + 1] === 0)) return { end: i, next: i + (wide ? 2 : 1) };
  }
  return { end: bytes.length, next: bytes.length };
}

function parsePicture(data, v22) {
  const enc = data[0];
  let pos = 1;
  let mime;
  if (v22) {
    const fmt = String.fromCharCode(data[1], data[2], data[3]).toLowerCase();
    mime = fmt === 'png' ? 'image/png' : 'image/jpeg';
    pos = 4;
  } else {
    const t = findTerminator(data, pos, 0);
    mime = new TextDecoder('latin1').decode(data.subarray(pos, t.end)) || 'image/jpeg';
    if (!mime.includes('/')) mime = 'image/' + mime.toLowerCase();
    pos = t.next;
  }
  pos += 1; // resim türü
  pos = findTerminator(data, pos, enc).next; // açıklama
  return new Blob([data.subarray(pos)], { type: mime });
}

async function readId3(file) {
  const head = new Uint8Array(await file.slice(0, 10).arrayBuffer());
  if (head.length < 10 || head[0] !== 0x49 || head[1] !== 0x44 || head[2] !== 0x33) return {};
  const ver = head[3];
  const flags = head[5];
  const size = synchsafe(head, 6);
  const buf = new Uint8Array(await file.slice(10, 10 + size).arrayBuffer());
  const v22 = ver === 2;
  let pos = 0;
  if (!v22 && flags & 0x40) pos = ver === 4 ? synchsafe(buf, 0) : uint32(buf, 0) + 4;

  const map = v22
    ? { TT2: 'title', TP1: 'artist', TAL: 'album', TYE: 'year', PIC: 'picture' }
    : { TIT2: 'title', TPE1: 'artist', TALB: 'album', TYER: 'year', TDRC: 'year', APIC: 'picture' };
  const idLen = v22 ? 3 : 4;
  const hdrLen = v22 ? 6 : 10;
  const tags = {};

  while (pos + hdrLen <= buf.length) {
    const id = String.fromCharCode(...buf.subarray(pos, pos + idLen));
    if (!/^[A-Z0-9]+$/.test(id)) break;
    const fsize = v22 ? uint24(buf, pos + 3) : ver === 4 ? synchsafe(buf, pos + 4) : uint32(buf, pos + 4);
    if (fsize <= 0 || pos + hdrLen + fsize > buf.length) break;
    const data = buf.subarray(pos + hdrLen, pos + hdrLen + fsize);
    pos += hdrLen + fsize;
    const key = map[id];
    if (!key || tags[key]) continue;
    if (key === 'picture') tags.picture = parsePicture(data, v22);
    else tags[key] = decode(data.subarray(1), data[0]);
  }
  return tags;
}

// "Sanatçı - Başlık.mp3" gibi dosya adlarından tahmin
function fromFilename(name) {
  const base = name.replace(/\.[^.]+$/, '').replace(/_/g, ' ').trim();
  const parts = base.split(/\s+[-–—]\s+/);
  if (parts.length >= 2) return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() };
  return { title: base };
}

export async function resizeImage(blob, size = 320) {
  try {
    const bmp = await createImageBitmap(blob);
    const scale = Math.min(1, size / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close?.();
    return canvas.toDataURL('image/jpeg', 0.85);
  } catch {
    return null;
  }
}

export function getDuration(src) {
  return new Promise((resolve) => {
    const a = new Audio();
    a.preload = 'metadata';
    const done = (v) => { a.removeAttribute('src'); a.load(); resolve(v); };
    a.onloadedmetadata = () => done(Number.isFinite(a.duration) ? a.duration : 0);
    a.onerror = () => done(0);
    setTimeout(() => done(0), 15000);
    a.src = src;
  });
}

export async function readMetadata(file) {
  let tags = {};
  try { tags = await readId3(file); } catch { /* etiket okunamadı */ }
  const guess = fromFilename(file.name);
  const url = URL.createObjectURL(file);
  const duration = await getDuration(url);
  URL.revokeObjectURL(url);
  return {
    title: tags.title || guess.title || file.name,
    artist: tags.artist || guess.artist || 'Bilinmeyen Sanatçı',
    album: tags.album || '',
    year: tags.year ? String(tags.year).slice(0, 4) : '',
    cover: tags.picture ? await resizeImage(tags.picture) : null,
    duration,
  };
}
