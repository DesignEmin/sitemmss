import { db, uid } from './db.js';
import { icon, hydrateIcons } from './icons.js';
import { readMetadata, getDuration, resizeImage } from './metadata.js';
import { media, isNative, onBackButton, onAppPause, setupNativeUi } from './native.js';

/* ---------- Yardımcılar ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const enc = encodeURIComponent;
const collator = new Intl.Collator('tr', { sensitivity: 'base', numeric: true });
const norm = (s) => String(s ?? '').toLocaleLowerCase('tr').replace(/ı/g, 'i').normalize('NFD').replace(/[̀-ͯ]/g, '');

function fmt(sec) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}
function fmtTotal(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h ? `${h} sa ${m} dk` : `${m} dk ${Math.floor(sec % 60)} sn`;
}
function relDate(ts) {
  if (!ts) return '';
  const day = 864e5;
  const d = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(ts).setHours(0, 0, 0, 0)) / day);
  if (d <= 0) return 'Bugün';
  if (d === 1) return 'Dün';
  if (d < 7) return `${d} gün önce`;
  if (d < 30) return `${Math.floor(d / 7)} hafta önce`;
  return new Date(ts).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}
function hue(str) {
  let h = 0;
  for (const c of String(str)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}
const plural = (n, w) => `${n} ${w}`;
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem('muzigim.' + k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('muzigim.' + k, JSON.stringify(v)); } catch { /* yoksay */ } },
};

/* ---------- Durum ---------- */
const state = {
  songs: new Map(),
  playlists: [],
  search: '',
  libSort: store.get('libSort', 'added'),
  libFilter: '',
  plFind: '',
};
const lists = new Map(); // ekranda görünen şarkı listeleri (çalma bağlamı için)
let listSeq = 0;

const audio = $('#audio');
const player = {
  queue: [],
  original: [],
  index: -1,
  context: null,
  shuffle: false,
  repeat: 'off', // off | all | one
  volume: 0.8,
  muted: false,
  currentId: null,
  objectUrl: null,
  counted: false,
  loadToken: 0,
};

const songs = () => [...state.songs.values()];
const current = () => state.songs.get(player.currentId);
const getPlaylist = (id) => state.playlists.find((p) => p.id === id);
const plSongs = (pl) => pl.songIds.map((id) => state.songs.get(id)).filter(Boolean);
const likedSongs = () => songs().filter((s) => s.liked).sort((a, b) => (b.likedAt || 0) - (a.likedAt || 0));

function registerList(ids, context) {
  const key = 'l' + listSeq++;
  lists.set(key, { ids, ...context });
  return key;
}

/* ---------- Bildirimler ---------- */
function toast(msg, { id, duration = 3000 } = {}) {
  let el = id && document.getElementById('toast-' + id);
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    if (id) el.id = 'toast-' + id;
    $('#toasts').append(el);
    const all = $$('.toast', $('#toasts'));
    all.slice(0, Math.max(0, all.length - 2)).forEach((t) => t.remove());
  }
  el.textContent = msg;
  clearTimeout(el._t);
  if (duration) el._t = setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, duration);
  return el;
}

/* ---------- Kapak görselleri ---------- */
function cover(src, cls = '') {
  return src
    ? `<div class="cover ${cls}"><img src="${src}" alt="" loading="lazy" decoding="async"></div>`
    : `<div class="cover empty ${cls}" style="--h:${hue(cls)}">${icon('note')}</div>`;
}
const songCover = (s, cls = '') => (s?.cover ? cover(s.cover, cls) : `<div class="cover empty ${cls}" style="--h:${hue(s?.artist || '')}">${icon('note')}</div>`);
const likedCover = (cls = '') => `<div class="cover liked ${cls}">${icon('heart-fill')}</div>`;
function playlistCover(pl, cls = '') {
  if (pl.cover) return cover(pl.cover, cls);
  const covers = [...new Set(plSongs(pl).map((s) => s.cover).filter(Boolean))];
  if (covers.length >= 4) return `<div class="cover mosaic ${cls}">${covers.slice(0, 4).map((c) => `<img src="${c}" alt="" loading="lazy">`).join('')}</div>`;
  if (covers.length) return cover(covers[0], cls);
  return `<div class="cover empty ${cls}" style="--h:${hue(pl.name)}">${icon('note')}</div>`;
}

/* ---------- Veritabanı işlemleri ---------- */
async function saveSong(song) { await db.put('songs', song); }
async function savePlaylist(pl) { pl.updatedAt = Date.now(); await db.put('playlists', pl); }

async function toggleLike(id) {
  const s = state.songs.get(id);
  if (!s) return;
  s.liked = !s.liked;
  s.likedAt = s.liked ? Date.now() : null;
  await saveSong(s);
  toast(s.liked ? 'Beğenilen Şarkılar’a eklendi' : 'Beğenilen Şarkılar’dan kaldırıldı');
  refreshLikes(id);
}

function refreshLikes(id) {
  const s = state.songs.get(id);
  $$(`.like-btn[data-song="${id}"]`).forEach((b) => setLikeBtn(b, s?.liked));
  if (id === player.currentId) updatePlayerUI();
  render();
  renderSidebar();
}

function setLikeBtn(btn, on) {
  btn.classList.toggle('on', !!on);
  btn.innerHTML = icon(on ? 'heart-fill' : 'heart');
  btn.title = on ? 'Beğenilenlerden kaldır' : 'Beğen';
}

async function createPlaylist(name, songIds = []) {
  const n = state.playlists.length + 1;
  const pl = { id: uid(), name: name?.trim() || `Çalma Listem #${n}`, description: '', cover: null, songIds: [...songIds], added: {}, createdAt: Date.now(), updatedAt: Date.now() };
  markAdded(pl, songIds);
  state.playlists.push(pl);
  await savePlaylist(pl);
  renderSidebar();
  return pl;
}

function markAdded(pl, ids) {
  pl.added ||= {};
  const now = Date.now();
  ids.forEach((id) => { pl.added[id] = now; });
}

async function addToPlaylist(pl, ids) {
  const fresh = ids.filter((id) => !pl.songIds.includes(id));
  if (!fresh.length) { toast(`Zaten “${pl.name}” listesinde`); return 0; }
  pl.songIds.push(...fresh);
  markAdded(pl, fresh);
  await savePlaylist(pl);
  toast(`“${pl.name}” listesine eklendi`);
  renderSidebar();
  return fresh.length;
}

async function removeFromPlaylist(pl, id) {
  pl.songIds = pl.songIds.filter((x) => x !== id);
  await savePlaylist(pl);
  toast(`“${pl.name}” listesinden kaldırıldı`);
  renderSidebar();
  render();
}

async function deletePlaylist(pl) {
  if (!(await confirmModal('Çalma listesi silinsin mi?', `“${pl.name}” kalıcı olarak silinecek. Şarkıların kitaplığında kalır.`, 'Sil'))) return;
  state.playlists = state.playlists.filter((p) => p !== pl);
  await db.delete('playlists', pl.id);
  renderSidebar();
  toast('Çalma listesi silindi');
  location.hash = '#/library';
}

async function deleteSong(id) {
  const s = state.songs.get(id);
  if (!s) return;
  if (!(await confirmModal('Şarkı silinsin mi?', `“${s.title}” kitaplığından ve tüm çalma listelerinden kaldırılacak.`, 'Sil'))) return;
  if (player.currentId === id) {
    audio.pause();
    audio.removeAttribute('src');
    player.currentId = null;
  }
  removeFromQueueById(id);
  state.songs.delete(id);
  await db.deleteSong(id);
  for (const pl of state.playlists) {
    if (pl.songIds.includes(id)) {
      pl.songIds = pl.songIds.filter((x) => x !== id);
      await savePlaylist(pl);
    }
  }
  updatePlayerUI();
  renderSidebar();
  render();
  toast('Şarkı silindi');
}

/* ---------- İçe aktarma ---------- */
let persistAsked = false;
async function importFiles(files) {
  files = files.filter((f) => f.type.startsWith('audio/') || /\.(mp3|m4a|aac|flac|ogg|oga|opus|wav|webm|wma)$/i.test(f.name));
  if (!files.length) { toast('Ses dosyası bulunamadı'); return; }
  if (!persistAsked && navigator.storage?.persist) { persistAsked = true; navigator.storage.persist().catch(() => {}); }

  const r = route();
  const targetPl = r.name === 'playlist' ? getPlaylist(r.param) : null;
  const existing = new Set(songs().map((s) => `${s.fileName}|${s.size}`));
  const added = [];
  let skipped = 0;
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    toast(`Şarkılar ekleniyor… ${i + 1}/${files.length}`, { id: 'import', duration: 0 });
    if (existing.has(`${f.name}|${f.size}`)) { skipped++; continue; }
    try {
      const meta = await readMetadata(f);
      const song = {
        id: uid(), ...meta, fileName: f.name, size: f.size, type: f.type,
        addedAt: Date.now() + i, liked: false, likedAt: null, plays: 0, lastPlayed: null,
      };
      await db.addSong(song, f);
      state.songs.set(song.id, song);
      added.push(song.id);
      existing.add(`${f.name}|${f.size}`);
    } catch (err) {
      console.error(err);
      if (err?.name === 'QuotaExceededError') { toast('Depolama alanı doldu. Bazı şarkılar eklenemedi.', { duration: 6000 }); break; }
    }
  }
  if (targetPl && added.length) { targetPl.songIds.push(...added); markAdded(targetPl, added); await savePlaylist(targetPl); }
  let msg = `${plural(added.length, 'şarkı')} eklendi`;
  if (targetPl && added.length) msg += ` ve “${targetPl.name}” listesine kondu`;
  if (skipped) msg += ` (${skipped} tanesi zaten vardı)`;
  toast(msg, { id: 'import', duration: 4000 });
  renderSidebar();
  render();
}

function addUrlModal() {
  openModal(`
    <h2>Bağlantıdan şarkı ekle</h2>
    <p class="muted">Doğrudan bir ses dosyasına giden bağlantı gir (ör. .mp3). Bu şarkılar internet gerektirir.</p>
    <label>Bağlantı<input name="url" type="url" required placeholder="https://…/sarki.mp3"></label>
    <label>Şarkı adı<input name="title" placeholder="İsteğe bağlı"></label>
    <label>Sanatçı<input name="artist" placeholder="İsteğe bağlı"></label>
  `, async (fd) => {
    const url = fd.get('url').trim();
    toast('Bağlantı kontrol ediliyor…', { id: 'url', duration: 0 });
    const duration = await getDuration(url);
    const name = decodeURIComponent(url.split('/').pop().split('?')[0] || 'Şarkı').replace(/\.[^.]+$/, '');
    const song = {
      id: uid(), title: fd.get('title').trim() || name, artist: fd.get('artist').trim() || 'Bilinmeyen Sanatçı',
      album: '', year: '', cover: null, duration, url, addedAt: Date.now(), liked: false, likedAt: null, plays: 0, lastPlayed: null,
    };
    await db.addSong(song);
    state.songs.set(song.id, song);
    toast(duration ? 'Şarkı eklendi' : 'Şarkı eklendi (süre okunamadı, bağlantıyı kontrol et)', { id: 'url' });
    render();
  }, 'Ekle');
}

/* ---------- Çalar ---------- */
function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function playIds(ids, start = 0, context = null) {
  if (!ids.length) return;
  player.original = ids.slice();
  player.context = context;
  if (player.shuffle) {
    const first = start >= 0 ? ids[start] : null;
    const rest = shuffled(ids.filter((_, i) => i !== start));
    player.queue = first ? [first, ...rest] : rest;
    player.index = 0;
  } else {
    player.queue = ids.slice();
    player.index = Math.max(0, start);
  }
  loadSong(player.queue[player.index], true);
}

function playList(key, index = 0, forceShuffle = false) {
  const l = lists.get(key);
  if (!l || !l.ids.length) { toast('Bu listede şarkı yok'); return; }
  if (forceShuffle) { player.shuffle = true; updateModes(); index = -1; }
  playIds(l.ids, index, { label: l.label, href: l.href });
}

async function loadSong(id, autoplay = true, startAt = 0) {
  const song = state.songs.get(id);
  if (!song) return;
  const token = ++player.loadToken;
  let src = song.url;
  if (!src) {
    const rec = await db.get('audio', id);
    if (token !== player.loadToken) return;
    if (!rec) { toast('Ses dosyası bulunamadı'); return; }
    if (player.objectUrl) URL.revokeObjectURL(player.objectUrl);
    src = player.objectUrl = URL.createObjectURL(rec.blob);
  }
  player.currentId = id;
  player.counted = false;
  audio.src = src;
  if (startAt) audio.addEventListener('loadedmetadata', () => { audio.currentTime = startAt; }, { once: true });
  if (autoplay) audio.play().catch((e) => { if (e.name !== 'AbortError') toast('Şarkı çalınamadı'); });
  updatePlayerUI();
  updateMediaSession();
  markPlayingRows();
  savePlayer();
  if (route().name === 'queue') render();
}

function toggle() {
  if (!player.currentId) {
    const r = lists.keys().next().value;
    if (r) playList(r, 0);
    else if (state.songs.size) playIds(songs().sort((a, b) => b.addedAt - a.addedAt).map((s) => s.id));
    return;
  }
  if (audio.paused) audio.play().catch(() => {}); else audio.pause();
}

function next(auto = false) {
  if (!player.queue.length) return;
  if (player.index < player.queue.length - 1) player.index++;
  else if (player.repeat === 'all') {
    if (player.shuffle) player.queue = shuffled(player.queue);
    player.index = 0;
  } else {
    if (auto) { audio.pause(); audio.currentTime = 0; }
    return;
  }
  loadSong(player.queue[player.index], true);
}

function prev() {
  if (audio.currentTime > 3 || player.index <= 0) { audio.currentTime = 0; return; }
  player.index--;
  loadSong(player.queue[player.index], true);
}

function setShuffle(on) {
  player.shuffle = on;
  const cur = player.currentId;
  if (player.queue.length) {
    if (on) {
      player.original = player.queue.slice();
      const rest = player.queue.filter((_, i) => i !== player.index);
      player.queue = cur ? [cur, ...shuffled(rest)] : shuffled(rest);
      player.index = 0;
    } else {
      player.queue = player.original.length ? player.original.slice() : player.queue;
      player.index = Math.max(0, player.queue.indexOf(cur));
    }
  }
  updateModes();
  savePlayer();
  toast(on ? 'Karıştırma açık' : 'Karıştırma kapalı', { id: 'mode', duration: 1500 });
  if (route().name === 'queue') render();
}

function cycleRepeat() {
  player.repeat = { off: 'all', all: 'one', one: 'off' }[player.repeat];
  updateModes();
  savePlayer();
  toast({ off: 'Tekrar kapalı', all: 'Listeyi tekrarla', one: 'Bu şarkıyı tekrarla' }[player.repeat], { id: 'mode', duration: 1500 });
}

function playNext(id) {
  if (!player.queue.length) { playIds([id]); return; }
  player.queue.splice(player.index + 1, 0, id);
  const oi = player.original.indexOf(player.currentId);
  player.original.splice(oi + 1, 0, id);
  savePlayer();
  toast('Sıradaki olarak çalınacak');
  if (route().name === 'queue') render();
}

function addToQueue(id) {
  if (!player.queue.length) { playIds([id]); return; }
  player.queue.push(id);
  player.original.push(id);
  savePlayer();
  toast('Sıraya eklendi');
  if (route().name === 'queue') render();
}

function removeFromQueueAt(i) {
  const id = player.queue[i];
  player.queue.splice(i, 1);
  const oi = player.original.lastIndexOf(id);
  if (oi >= 0) player.original.splice(oi, 1);
  if (i < player.index) player.index--;
  savePlayer();
  render();
}

function removeFromQueueById(id) {
  const cur = player.queue[player.index];
  player.queue = player.queue.filter((x) => x !== id);
  player.original = player.original.filter((x) => x !== id);
  player.index = cur === id ? Math.min(player.index, player.queue.length - 1) : player.queue.indexOf(cur);
}

function savePlayer() {
  store.set('player', {
    queue: player.queue, original: player.original, index: player.index, context: player.context,
    shuffle: player.shuffle, repeat: player.repeat, volume: player.volume, muted: player.muted,
    currentId: player.currentId, time: audio.currentTime || 0,
  });
}

function restorePlayer() {
  const saved = store.get('player', null);
  if (!saved) return;
  Object.assign(player, {
    queue: (saved.queue || []).filter((id) => state.songs.has(id)),
    original: (saved.original || []).filter((id) => state.songs.has(id)),
    context: saved.context, shuffle: !!saved.shuffle, repeat: saved.repeat || 'off',
    volume: saved.volume ?? 0.8, muted: !!saved.muted,
  });
  player.index = player.queue.indexOf(saved.currentId);
  if (player.index < 0 && player.queue.length) player.index = 0;
  if (player.index >= 0) loadSong(player.queue[player.index], false, saved.time || 0);
}

/* ---------- Çalar arayüzü ---------- */
function setRangeFill(el) {
  const pct = ((el.value - el.min) / (el.max - el.min)) * 100 || 0;
  el.style.setProperty('--val', pct + '%');
}

function updatePlayerUI() {
  const s = current();
  $('#pTitle').textContent = s ? s.title : 'Bir şarkı seç';
  $('#pArtist').innerHTML = s ? `<a class="link" href="#/artist/${enc(s.artist)}">${esc(s.artist)}</a>` : '';
  $('#pCover').innerHTML = s ? songCover(s) : '';
  $('#npTitle').textContent = s ? s.title : '';
  $('#npArtist').innerHTML = s ? `<a class="link" href="#/artist/${enc(s.artist)}" data-action="close-now-playing">${esc(s.artist)}</a>` : '';
  $('#npCover').innerHTML = s ? songCover(s) : '';
  $('#npBg').style.backgroundImage = s?.cover ? `url(${s.cover})` : '';
  $('#npContext').textContent = player.context?.label || 'Şimdi çalıyor';
  for (const b of [$('#pLike'), $('#npLike')]) { b.dataset.song = s?.id || ''; setLikeBtn(b, s?.liked); b.hidden = !s; }
  document.body.classList.toggle('has-song', !!s);
  document.title = s ? `${s.title} • ${s.artist}` : 'Müziğim';
  updateTime();
  updatePlayState();
}

function updatePlayState() {
  const playing = !audio.paused && !!player.currentId;
  document.body.classList.toggle('is-playing', playing);
  for (const b of [$('#btnPlay'), $('#npPlay')]) { b.innerHTML = icon(playing ? 'pause' : 'play'); b.title = playing ? 'Duraklat' : 'Çal'; }
  $$('.big-play[data-list]').forEach((b) => {
    const l = lists.get(b.dataset.list);
    const active = playing && l && l.href && player.context?.href === l.href;
    b.innerHTML = icon(active ? 'pause' : 'play');
  });
  // Bildirim / kilit ekranı kontrolleri ancak kullanıcı bir şey çalmaya başladıktan sonra gösterilir
  if (playing) mediaActive = true;
  if (mediaActive && player.currentId) media.setPlaybackState(playing ? 'playing' : 'paused');
}

function updateModes() {
  for (const b of [$('#btnShuffle'), $('#npShuffle')]) b.classList.toggle('on', player.shuffle);
  for (const b of [$('#btnRepeat'), $('#npRepeat')]) {
    b.classList.toggle('on', player.repeat !== 'off');
    b.innerHTML = icon(player.repeat === 'one' ? 'repeat-one' : 'repeat');
  }
  const vol = player.muted ? 0 : player.volume;
  audio.volume = vol;
  const vEl = $('#volume');
  vEl.value = Math.round(vol * 100);
  setRangeFill(vEl);
  $('#btnMute').innerHTML = icon(vol === 0 ? 'mute' : vol < 0.5 ? 'volume-low' : 'volume');
}

let seeking = false;
let lastSave = 0;
let lastPosSync = 0;
let mediaActive = false;
function updateTime() {
  const dur = audio.duration || current()?.duration || 0;
  const cur = audio.currentTime || 0;
  if (!seeking) {
    for (const el of [$('#seek'), $('#npSeek')]) { el.value = dur ? Math.round((cur / dur) * 1000) : 0; setRangeFill(el); }
    $('#tCur').textContent = $('#npCur').textContent = fmt(cur);
  }
  $('#tDur').textContent = $('#npDur').textContent = fmt(dur);
  $('#miniBar').style.width = dur ? (cur / dur) * 100 + '%' : '0';
}

function markPlayingRows() {
  $$('.row.playing').forEach((r) => r.classList.remove('playing'));
  if (player.currentId) $$(`.row[data-song="${player.currentId}"]`).forEach((r) => r.classList.add('playing'));
  $$('.side-playlists a').forEach((a) => a.classList.toggle('playing', !!player.context && a.getAttribute('href') === player.context.href));
}

function updateMediaSession() {
  const s = current();
  if (!s) return;
  media.setMetadata({
    title: s.title, artist: s.artist, album: s.album || '',
    artwork: s.cover ? [{ src: s.cover, sizes: '320x320', type: 'image/jpeg' }] : [],
  });
}

function setupMediaSession() {
  const set = (a, f) => media.setActionHandler(a, f);
  set('play', () => { if (player.currentId) audio.play().catch(() => {}); });
  set('pause', () => audio.pause());
  set('previoustrack', prev);
  set('nexttrack', () => next());
  set('seekbackward', () => { audio.currentTime = Math.max(0, audio.currentTime - 10); });
  set('seekforward', () => { audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 10); });
  set('seekto', (d) => { if (Number.isFinite(d.seekTime)) audio.currentTime = d.seekTime; });
  set('stop', () => audio.pause());
}

function bindAudio() {
  audio.addEventListener('play', updatePlayState);
  audio.addEventListener('pause', () => { updatePlayState(); savePlayer(); });
  audio.addEventListener('loadedmetadata', async () => {
    updateTime();
    const s = current();
    if (s && Number.isFinite(audio.duration) && Math.abs((s.duration || 0) - audio.duration) > 1) {
      s.duration = audio.duration;
      await saveSong(s);
    }
  });
  audio.addEventListener('timeupdate', async () => {
    updateTime();
    const s = current();
    if (!s) return;
    const now = Date.now();
    if (now - lastSave > 5000) { lastSave = now; savePlayer(); }
    if (!player.counted && audio.currentTime > Math.min(30, (audio.duration || 60) / 2)) {
      player.counted = true;
      s.plays = (s.plays || 0) + 1;
      s.lastPlayed = now;
      await saveSong(s);
    }
    if (now - lastPosSync > 1000) {
      lastPosSync = now;
      media.setPositionState({ duration: audio.duration, position: audio.currentTime, playbackRate: audio.playbackRate });
    }
  });
  audio.addEventListener('ended', () => {
    if (player.repeat === 'one') { audio.currentTime = 0; audio.play(); } else next(true);
  });
  audio.addEventListener('error', () => {
    if (!audio.getAttribute('src')) return;
    toast('Bu şarkı çalınamadı, sıradakine geçiliyor');
    setTimeout(() => next(true), 800);
  });

  for (const el of [$('#seek'), $('#npSeek')]) {
    el.addEventListener('input', () => {
      seeking = true;
      setRangeFill(el);
      const dur = audio.duration || 0;
      $('#tCur').textContent = $('#npCur').textContent = fmt((el.value / 1000) * dur);
    });
    el.addEventListener('change', () => {
      seeking = false;
      if (audio.duration) audio.currentTime = (el.value / 1000) * audio.duration;
    });
  }
  $('#volume').addEventListener('input', (e) => {
    player.volume = e.target.value / 100;
    player.muted = player.volume === 0;
    updateModes();
    savePlayer();
  });
}

/* ---------- Yönlendirme ---------- */
function route() {
  const h = location.hash.replace(/^#\/?/, '');
  const [name, ...rest] = h.split('/');
  return { name: name || 'home', param: rest.length ? decodeURIComponent(rest.join('/')) : null };
}

const views = { home: viewHome, search: viewSearch, library: viewLibrary, liked: viewLiked, playlist: viewPlaylist, artist: viewArtist, album: viewAlbum, queue: viewQueue };

let lastRouteKey = '';
function render() {
  const r = route();
  const key = r.name + '/' + r.param;
  lists.clear();
  const view = $('#view');
  view.innerHTML = (views[r.name] || viewHome)(r.param);
  hydrateIcons(view);
  $$('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === r.name));
  $$('.side-playlists a').forEach((a) => a.classList.toggle('active', a.getAttribute('href') === location.hash));
  $('#topSearch').hidden = r.name !== 'search';
  if (key !== lastRouteKey) {
    $('#main').scrollTop = 0;
    if (r.name === 'search') setTimeout(() => $('#searchInput').focus(), 0);
    state.plFind = '';
    lastRouteKey = key;
  }
  markPlayingRows();
  updatePlayState();
}

/* ---------- Şarkı listesi bileşenleri ---------- */
function songTable(list, { context = {}, dateOf, reorder = false, showHeader = true, key } = {}) {
  if (!list.length) return '';
  if (key) lists.set(key, { ids: list.map((s) => s.id), ...context });
  else key = registerList(list.map((s) => s.id), context);
  const rows = list.map((s, i) => `
    <div class="row" data-song="${s.id}" data-list="${key}" data-index="${i}" ${reorder ? 'draggable="true"' : ''}>
      <div class="c-num"><span class="num">${i + 1}</span><span class="eq"><i></i><i></i><i></i></span><span class="rowplay">${icon('play')}</span></div>
      <div class="c-title">${songCover(s, 'sm')}<div class="t"><div class="title">${esc(s.title)}</div><div class="sub"><a class="link" href="#/artist/${enc(s.artist)}">${esc(s.artist)}</a></div></div></div>
      <div class="c-album">${s.album ? `<a class="link" href="#/album/${enc(s.album)}">${esc(s.album)}</a>` : ''}</div>
      <div class="c-date">${esc(relDate(dateOf ? dateOf(s) : s.addedAt))}</div>
      <div class="c-like"><button class="icon-btn like-btn ${s.liked ? 'on' : ''}" data-action="like" data-song="${s.id}" title="${s.liked ? 'Beğenilenlerden kaldır' : 'Beğen'}">${icon(s.liked ? 'heart-fill' : 'heart')}</button></div>
      <div class="c-dur">${fmt(s.duration)}</div>
      <div class="c-more"><button class="icon-btn" data-action="more" data-song="${s.id}" data-list="${key}" data-index="${i}" title="Diğer seçenekler">${icon('more')}</button></div>
    </div>`).join('');
  return `<div class="table">${showHeader ? `
    <div class="thead"><div class="c-num">#</div><div class="c-title">Başlık</div><div class="c-album">Albüm</div><div class="c-date">Eklenme</div><div class="c-like"></div><div class="c-dur">${icon('clock')}</div><div class="c-more"></div></div>` : ''}
    ${rows}</div>`;
}

function hero({ type, title, sub, coverHtml, meta, color, round }) {
  return `<section class="hero" style="--hero:${color}">
    <div class="hero-cover ${round ? 'round' : ''}">${coverHtml}</div>
    <div class="hero-text">
      <div class="hero-type">${type}</div>
      <h1 class="${title.length > 22 ? 'long' : ''}">${esc(title)}</h1>
      ${sub ? `<p class="hero-sub">${sub}</p>` : ''}
      <div class="hero-meta">${meta}</div>
    </div>
  </section>`;
}

function actionBar(key, extra = '') {
  return `<div class="action-bar">
    <button class="big-play" data-action="play-list" data-list="${key}" title="Çal">${icon('play')}</button>
    <button class="icon-btn big" data-action="shuffle-list" data-list="${key}" title="Karıştırarak çal">${icon('shuffle')}</button>
    ${extra}
  </div>`;
}

function metaLine(list) {
  const total = list.reduce((t, s) => t + (s.duration || 0), 0);
  return `${plural(list.length, 'şarkı')}${list.length ? `, ${fmtTotal(total)}` : ''}`;
}

function songCards(list, context) {
  if (!list.length) return '';
  const key = registerList(list.map((s) => s.id), context);
  return list.map((s, i) => `
    <div class="card" data-action="play-card" data-list="${key}" data-index="${i}">
      <div class="card-cover">${songCover(s)}<span class="card-play">${icon('play')}</span></div>
      <div class="card-title">${esc(s.title)}</div>
      <div class="card-sub">${esc(s.artist)}</div>
    </div>`).join('');
}

function playlistCards(pls, { withLiked = false, withNew = false } = {}) {
  let html = '';
  if (withLiked) {
    const liked = likedSongs();
    html += `<a class="card" href="#/liked">
      <div class="card-cover">${likedCover()}<button class="card-play" data-action="play-collection" data-kind="liked">${icon('play')}</button></div>
      <div class="card-title">Beğenilen Şarkılar</div><div class="card-sub">${plural(liked.length, 'şarkı')}</div></a>`;
  }
  html += pls.map((pl) => `
    <a class="card" href="#/playlist/${pl.id}">
      <div class="card-cover">${playlistCover(pl)}<button class="card-play" data-action="play-collection" data-kind="playlist" data-id="${pl.id}">${icon('play')}</button></div>
      <div class="card-title">${esc(pl.name)}</div><div class="card-sub">Çalma listesi • ${plural(plSongs(pl).length, 'şarkı')}</div>
    </a>`).join('');
  if (withNew) {
    html += `<button class="card new-card" data-action="new-playlist">
      <div class="card-cover"><div class="cover empty">${icon('plus')}</div></div>
      <div class="card-title">Yeni çalma listesi</div><div class="card-sub">Oluştur</div></button>`;
  }
  return html;
}

function artistCards(names) {
  return names.map((a) => {
    const s = songs().find((x) => x.artist === a && x.cover) || { artist: a };
    return `<a class="card" href="#/artist/${enc(a)}">
      <div class="card-cover round">${songCover(s)}</div>
      <div class="card-title">${esc(a)}</div><div class="card-sub">Sanatçı</div></a>`;
  }).join('');
}

function albumCards(albums) {
  return albums.map(({ album, artist, cover: c }) => `
    <a class="card" href="#/album/${enc(album)}">
      <div class="card-cover">${cover(c, album)}</div>
      <div class="card-title">${esc(album)}</div><div class="card-sub">${esc(artist)}</div></a>`).join('');
}

function shelf(title, body, href) {
  if (!body) return '';
  return `<section class="shelf"><div class="shelf-head"><h2>${title}</h2>${href ? `<a class="link muted" href="${href}">Tümünü göster</a>` : ''}</div><div class="cards">${body}</div></section>`;
}

function emptyState(title, text, withUpload = true) {
  return `<div class="empty-state">
    <div class="empty-icon">${icon('note')}</div>
    <h2>${title}</h2><p>${text}</p>
    ${withUpload ? `<div class="empty-actions"><button class="pill-btn primary" data-action="upload">${icon('upload')} Bilgisayardan şarkı yükle</button>
    <button class="pill-btn" data-action="add-url">${icon('link')} Bağlantıdan ekle</button></div>` : ''}
  </div>`;
}

function artistsList() {
  const count = new Map();
  for (const s of songs()) count.set(s.artist, (count.get(s.artist) || 0) + 1);
  return [...count.keys()].sort((a, b) => count.get(b) - count.get(a) || collator.compare(a, b));
}
function albumsList() {
  const m = new Map();
  for (const s of songs()) {
    if (!s.album) continue;
    const a = m.get(s.album) || { album: s.album, artist: s.artist, cover: null, n: 0 };
    a.cover ||= s.cover;
    a.n++;
    m.set(s.album, a);
  }
  return [...m.values()].sort((a, b) => collator.compare(a.album, b.album));
}

/* ---------- Sayfalar ---------- */
function viewHome() {
  const h = new Date().getHours();
  const greet = h < 5 ? 'İyi geceler' : h < 12 ? 'Günaydın' : h < 18 ? 'İyi günler' : h < 22 ? 'İyi akşamlar' : 'İyi geceler';
  if (!state.songs.size) {
    return `<h1 class="page-title">${greet}</h1>` + emptyState('Müzik kütüphanen boş', 'Bilgisayarındaki veya telefonundaki şarkıları ekle ya da dosyaları bu pencereye sürükle. Şarkıların sadece bu cihazda, tarayıcında saklanır.');
  }
  const all = songs();
  const quick = [
    `<a class="quick" href="#/liked">${likedCover('xs')}<span>Beğenilen Şarkılar</span></a>`,
    ...[...state.playlists].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 7).map((pl) =>
      `<a class="quick" href="#/playlist/${pl.id}">${playlistCover(pl, 'xs')}<span>${esc(pl.name)}</span></a>`),
  ].join('');
  const recent = all.filter((s) => s.lastPlayed).sort((a, b) => b.lastPlayed - a.lastPlayed).slice(0, 12);
  const newest = all.slice().sort((a, b) => b.addedAt - a.addedAt).slice(0, 12);
  const top = all.filter((s) => s.plays).sort((a, b) => b.plays - a.plays).slice(0, 12);
  return `
    <h1 class="page-title">${greet}</h1>
    <div class="quick-grid">${quick}</div>
    ${shelf('Son çalınanlar', songCards(recent, { label: 'Son çalınanlar' }))}
    ${shelf('Çalma listelerin', playlistCards(state.playlists, { withNew: true }), '#/library')}
    ${shelf('Yeni eklenenler', songCards(newest, { label: 'Yeni eklenenler' }), '#/library')}
    ${shelf('En çok dinlediklerin', songCards(top, { label: 'En çok dinlediklerin' }))}
    ${shelf('Sanatçıların', artistCards(artistsList().slice(0, 12)), '#/search')}
  `;
}

function viewSearch() {
  const q = norm(state.search.trim());
  if (!q) {
    if (!state.songs.size) return emptyState('Aranacak bir şey yok', 'Önce birkaç şarkı ekle.');
    return `
      ${shelf('Sanatçılar', artistCards(artistsList()))}
      ${shelf('Albümler', albumCards(albumsList()))}`;
  }
  const match = (s) => norm(s).includes(q);
  const found = songs().filter((s) => match(s.title) || match(s.artist) || match(s.album)).sort((a, b) => {
    const score = (s) => (norm(s.title).startsWith(q) ? 0 : match(s.title) ? 1 : 2);
    return score(a) - score(b) || collator.compare(a.title, b.title);
  });
  const artists = artistsList().filter(match);
  const albums = albumsList().filter((a) => match(a.album));
  const pls = state.playlists.filter((p) => match(p.name));
  if (!found.length && !artists.length && !pls.length) {
    return emptyState(`“${esc(state.search)}” için sonuç yok`, 'Yazımı kontrol et ya da başka bir kelime dene.', false);
  }
  return `
    ${found.length ? `<section class="shelf"><div class="shelf-head"><h2>Şarkılar</h2></div>${songTable(found.slice(0, 100), { context: { label: 'Arama sonuçları' } })}</section>` : ''}
    ${shelf('Sanatçılar', artistCards(artists))}
    ${shelf('Albümler', albumCards(albums))}
    ${shelf('Çalma listeleri', playlistCards(pls))}
  `;
}

const sorters = {
  added: (a, b) => b.addedAt - a.addedAt,
  title: (a, b) => collator.compare(a.title, b.title),
  artist: (a, b) => collator.compare(a.artist, b.artist) || collator.compare(a.album, b.album) || collator.compare(a.title, b.title),
  album: (a, b) => collator.compare(a.album || '￿', b.album || '￿') || collator.compare(a.title, b.title),
  plays: (a, b) => (b.plays || 0) - (a.plays || 0) || (b.lastPlayed || 0) - (a.lastPlayed || 0),
  duration: (a, b) => (b.duration || 0) - (a.duration || 0),
};

function libraryRows() {
  const q = norm(state.libFilter.trim());
  let list = songs();
  if (q) list = list.filter((s) => norm(`${s.title} ${s.artist} ${s.album}`).includes(q));
  return list.sort(sorters[state.libSort] || sorters.added);
}

function viewLibrary() {
  const list = libraryRows();
  const total = songs().reduce((t, s) => t + (s.duration || 0), 0);
  const opts = { added: 'Son eklenen', title: 'Başlık', artist: 'Sanatçı', album: 'Albüm', plays: 'En çok dinlenen', duration: 'Süre' };
  const key = registerList(list.map((s) => s.id), { label: 'Tüm şarkılar', href: '#/library' });
  return `
    <h1 class="page-title">Kitaplığım</h1>
    <section class="shelf"><div class="shelf-head"><h2>Çalma listelerin</h2></div>
      <div class="cards">${playlistCards(state.playlists, { withLiked: true, withNew: true })}</div></section>
    <section class="shelf">
      <div class="shelf-head"><h2>Tüm şarkılar</h2><span class="muted">${plural(state.songs.size, 'şarkı')}${state.songs.size ? ', ' + fmtTotal(total) : ''}</span></div>
      ${state.songs.size ? `
      <div class="toolbar">
        <button class="big-play small" data-action="play-list" data-list="${key}" title="Tümünü çal">${icon('play')}</button>
        <button class="icon-btn" data-action="shuffle-list" data-list="${key}" title="Karıştırarak çal">${icon('shuffle')}</button>
        <div class="filter">${icon('search')}<input id="libFilter" type="search" placeholder="Kitaplıkta ara" value="${esc(state.libFilter)}"></div>
        <label class="sort">Sırala
          <select id="libSort">${Object.entries(opts).map(([k, v]) => `<option value="${k}" ${state.libSort === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
        </label>
        <span class="spacer"></span>
        <button class="pill-btn" data-action="add-url">${icon('link')}<span class="hide-sm">Bağlantıdan ekle</span></button>
        <button class="pill-btn primary" data-action="upload">${icon('upload')}<span class="hide-sm">Şarkı yükle</span></button>
      </div>
      <div id="libTable">${libTableHtml(list, key)}</div>
      <p class="muted small" id="storageInfo"></p>` : emptyState('Henüz şarkı yok', 'Şarkı dosyalarını yükle veya bu pencereye sürükleyip bırak.')}
    </section>`;
}

function libTableHtml(list, key) {
  if (!list.length) return `<p class="muted">Eşleşen şarkı yok.</p>`;
  return songTable(list, { context: { label: 'Tüm şarkılar', href: '#/library' }, key });
}

function viewLiked() {
  const list = likedSongs();
  const key = registerList(list.map((s) => s.id), { label: 'Beğenilen Şarkılar', href: '#/liked' });
  return `
    ${hero({ type: 'Çalma listesi', title: 'Beğenilen Şarkılar', coverHtml: likedCover(), meta: metaLine(list), color: 'hsl(250 55% 45%)' })}
    ${actionBar(key)}
    ${list.length ? songTable(list, { context: { label: 'Beğenilen Şarkılar', href: '#/liked' }, dateOf: (s) => s.likedAt })
      : emptyState('Beğendiğin şarkılar burada görünür', 'Bir şarkının yanındaki kalp simgesine dokunarak onu buraya ekle.', false)}`;
}

function viewPlaylist(id) {
  const pl = getPlaylist(id);
  if (!pl) return emptyState('Çalma listesi bulunamadı', 'Silinmiş olabilir.', false);
  const list = plSongs(pl);
  const href = '#/playlist/' + pl.id;
  const key = registerList(list.map((s) => s.id), { label: pl.name, href });
  return `
    ${hero({ type: 'Çalma listesi', title: pl.name, sub: esc(pl.description), coverHtml: `<button class="cover-edit" data-action="pl-edit" data-id="${pl.id}" title="Düzenle">${playlistCover(pl)}<span>${icon('edit')}</span></button>`, meta: metaLine(list), color: `hsl(${hue(pl.name)} 45% 38%)` })}
    ${actionBar(key, `
      <button class="icon-btn big" data-action="pl-edit" data-id="${pl.id}" title="Düzenle">${icon('edit')}</button>
      <button class="icon-btn big" data-action="pl-delete" data-id="${pl.id}" title="Sil">${icon('trash')}</button>`)}
    ${songTable(list, { context: { label: pl.name, href, playlistId: pl.id }, reorder: true, dateOf: (s) => pl.added?.[s.id] || pl.createdAt })}
    <section class="finder">
      <h2>Bu listeye şarkı ekle</h2>
      <div class="filter wide">${icon('search')}<input id="plFind" type="search" placeholder="Şarkı veya sanatçı ara" value="${esc(state.plFind)}" data-id="${pl.id}"></div>
      <div id="plFindResults">${finderResults(pl)}</div>
      <p class="muted small">İpucu: Bu sayfadayken yüklediğin şarkılar doğrudan bu listeye eklenir.</p>
    </section>`;
}

function finderResults(pl) {
  const q = norm(state.plFind.trim());
  let cand = songs().filter((s) => !pl.songIds.includes(s.id));
  if (q) cand = cand.filter((s) => norm(`${s.title} ${s.artist} ${s.album}`).includes(q));
  else cand.sort((a, b) => (b.lastPlayed || b.addedAt) - (a.lastPlayed || a.addedAt));
  cand = cand.slice(0, q ? 30 : 8);
  if (!cand.length) return `<p class="muted">${state.songs.size ? 'Eklenecek şarkı bulunamadı.' : 'Kitaplığında henüz şarkı yok.'}</p>`;
  return cand.map((s) => `
    <div class="finder-row">
      ${songCover(s, 'sm')}
      <div class="t"><div class="title">${esc(s.title)}</div><div class="sub">${esc(s.artist)}</div></div>
      <button class="pill-btn" data-action="pl-add-song" data-id="${pl.id}" data-song="${s.id}">Ekle</button>
    </div>`).join('');
}

function viewArtist(name) {
  const list = songs().filter((s) => s.artist === name).sort((a, b) => (b.plays || 0) - (a.plays || 0) || collator.compare(a.title, b.title));
  if (!list.length) return emptyState('Sanatçı bulunamadı', '', false);
  const href = '#/artist/' + enc(name);
  const key = registerList(list.map((s) => s.id), { label: name, href });
  const albums = albumsList().filter((a) => list.some((s) => s.album === a.album));
  return `
    ${hero({ type: 'Sanatçı', title: name, coverHtml: songCover(list.find((s) => s.cover) || list[0]), meta: metaLine(list), color: `hsl(${hue(name)} 40% 35%)`, round: true })}
    ${actionBar(key)}
    <section class="shelf"><div class="shelf-head"><h2>Şarkılar</h2></div>${songTable(list, { context: { label: name, href } })}</section>
    ${shelf('Albümler', albumCards(albums))}`;
}

function viewAlbum(name) {
  const list = songs().filter((s) => s.album === name).sort((a, b) => a.addedAt - b.addedAt);
  if (!list.length) return emptyState('Albüm bulunamadı', '', false);
  const href = '#/album/' + enc(name);
  const key = registerList(list.map((s) => s.id), { label: name, href });
  const artists = [...new Set(list.map((s) => s.artist))];
  const year = list.find((s) => s.year)?.year;
  return `
    ${hero({ type: 'Albüm', title: name, sub: artists.map((a) => `<a class="link" href="#/artist/${enc(a)}">${esc(a)}</a>`).join(', '), coverHtml: songCover(list.find((s) => s.cover) || list[0]), meta: (year ? year + ' • ' : '') + metaLine(list), color: `hsl(${hue(name)} 40% 35%)` })}
    ${actionBar(key)}
    ${songTable(list, { context: { label: name, href } })}`;
}

function viewQueue() {
  const s = current();
  if (!s) return `<h1 class="page-title">Sıradakiler</h1>` + emptyState('Şu anda bir şey çalmıyor', 'Bir şarkı çalmaya başladığında sıra burada görünür.', false);
  const upcoming = player.queue.slice(player.index + 1).map((id) => state.songs.get(id)).filter(Boolean);
  const rows = upcoming.map((x, i) => {
    const qi = player.index + 1 + i;
    return `<div class="row" data-song="${x.id}" data-queue-index="${qi}">
      <div class="c-num"><span class="num">${i + 1}</span><span class="rowplay">${icon('play')}</span></div>
      <div class="c-title">${songCover(x, 'sm')}<div class="t"><div class="title">${esc(x.title)}</div><div class="sub">${esc(x.artist)}</div></div></div>
      <div class="c-album">${esc(x.album)}</div><div class="c-date"></div>
      <div class="c-like"><button class="icon-btn like-btn ${x.liked ? 'on' : ''}" data-action="like" data-song="${x.id}">${icon(x.liked ? 'heart-fill' : 'heart')}</button></div>
      <div class="c-dur">${fmt(x.duration)}</div>
      <div class="c-more"><button class="icon-btn" data-action="q-remove" data-index="${qi}" title="Sıradan kaldır">${icon('close')}</button></div>
    </div>`;
  }).join('');
  return `
    <h1 class="page-title">Sıradakiler</h1>
    <h2 class="sub-title">Şimdi çalıyor</h2>
    ${songTable([s], { context: { queue: true }, showHeader: false })}
    <div class="shelf-head"><h2 class="sub-title">Sırada${player.context?.label ? `: <a class="link" href="${esc(player.context.href || '#/')}">${esc(player.context.label)}</a>` : ''}</h2>
      ${upcoming.length ? `<button class="pill-btn" data-action="q-clear">Sırayı temizle</button>` : ''}</div>
    ${upcoming.length ? `<div class="table">${rows}</div>` : `<p class="muted">Sırada başka şarkı yok.</p>`}`;
}

/* ---------- Kenar çubuğu ---------- */
function renderSidebar() {
  const pls = [...state.playlists].sort((a, b) => b.updatedAt - a.updatedAt);
  $('#sidePlaylists').innerHTML = pls.map((pl) => `
    <li><a href="#/playlist/${pl.id}" class="${location.hash === '#/playlist/' + pl.id ? 'active' : ''}">
      ${playlistCover(pl, 'xs')}
      <span class="t"><span class="title">${esc(pl.name)}</span><span class="sub">Çalma listesi • ${plural(plSongs(pl).length, 'şarkı')}</span></span>
      <span class="side-eq">${icon('volume')}</span>
    </a></li>`).join('') || `<li class="muted small side-empty">Henüz çalma listen yok. Yukarıdan oluşturabilirsin.</li>`;
  markPlayingRows();
}

/* ---------- Menü ---------- */
const menuEl = $('#menu');
function openMenu(anchor, items, header = '') {
  menuEl.innerHTML = header + items.filter(Boolean).map((it) => it === '-' ? '<hr>' :
    `<button class="menu-item ${it.danger ? 'danger' : ''}" data-menu="${it.id}">${icon(it.icon)}<span>${it.label}</span></button>`).join('');
  menuEl.hidden = false;
  menuEl._items = items;
  menuEl._openedAt = performance.now();
  const sheet = matchMedia('(max-width: 700px)').matches;
  menuEl.classList.toggle('sheet', sheet);
  if (!sheet) {
    const r = anchor.getBoundingClientRect();
    const mw = menuEl.offsetWidth;
    const mh = menuEl.offsetHeight;
    let x = r.right - mw;
    let y = r.bottom + 4;
    if (y + mh > innerHeight - 8) y = Math.max(8, r.top - mh - 4);
    x = Math.max(8, Math.min(x, innerWidth - mw - 8));
    menuEl.style.left = x + 'px';
    menuEl.style.top = y + 'px';
  } else {
    menuEl.style.left = menuEl.style.top = '';
  }
}
function closeMenu() { menuEl.hidden = true; menuEl._items = null; }

function songMenu(btn) {
  const id = btn.dataset.song;
  const s = state.songs.get(id);
  if (!s) return;
  const l = lists.get(btn.dataset.list) || {};
  const pl = l.playlistId ? getPlaylist(l.playlistId) : null;
  const idx = +btn.dataset.index;
  const items = [
    { id: 'play-next', icon: 'play-next', label: 'Sıradaki olarak çal', run: () => playNext(id) },
    { id: 'add-queue', icon: 'add-queue', label: 'Sıraya ekle', run: () => addToQueue(id) },
    '-',
    { id: 'add-pl', icon: 'list-add', label: 'Çalma listesine ekle', run: () => addToPlaylistModal([id]) },
    pl && { id: 'rm-pl', icon: 'trash', label: 'Bu listeden kaldır', run: () => removeFromPlaylist(pl, id) },
    pl && idx > 0 && { id: 'up', icon: 'chevron-up', label: 'Yukarı taşı', run: () => moveInPlaylist(pl, idx, idx - 1) },
    pl && idx < pl.songIds.length - 1 && { id: 'down', icon: 'chevron-down', label: 'Aşağı taşı', run: () => moveInPlaylist(pl, idx, idx + 1) },
    { id: 'like', icon: s.liked ? 'heart-fill' : 'heart', label: s.liked ? 'Beğenilenlerden kaldır' : 'Beğenilenlere ekle', run: () => toggleLike(id) },
    '-',
    { id: 'artist', icon: 'user', label: 'Sanatçıya git', run: () => { location.hash = '#/artist/' + enc(s.artist); } },
    s.album && { id: 'album', icon: 'disc', label: 'Albüme git', run: () => { location.hash = '#/album/' + enc(s.album); } },
    { id: 'edit', icon: 'edit', label: 'Bilgileri düzenle', run: () => editSongModal(id) },
    !s.url && !isNative && { id: 'download', icon: 'download', label: 'Dosyayı indir', run: () => downloadSong(id) },
    { id: 'delete', icon: 'trash', label: 'Kitaplıktan sil', danger: true, run: () => deleteSong(id) },
  ];
  openMenu(btn, items, `<div class="menu-head">${songCover(s, 'sm')}<div class="t"><div class="title">${esc(s.title)}</div><div class="sub">${esc(s.artist)}</div></div></div>`);
}

async function moveInPlaylist(pl, from, to) {
  // Görünen sıra ile kayıtlı sıra, silinmiş şarkılar yüzünden farklı olabilir; önce temizle
  pl.songIds = pl.songIds.filter((id) => state.songs.has(id));
  const [id] = pl.songIds.splice(from, 1);
  pl.songIds.splice(to, 0, id);
  await savePlaylist(pl);
  render();
}

async function downloadSong(id) {
  const s = state.songs.get(id);
  const rec = await db.get('audio', id);
  if (!rec) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(rec.blob);
  a.download = s.fileName || `${s.artist} - ${s.title}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/* ---------- Pencereler (modal) ---------- */
const modalEl = $('#modal');
let modalResolve = null;
function openModal(inner, onSubmit, okLabel = 'Kaydet', { danger = false } = {}) {
  modalEl.innerHTML = `<form class="modal" role="dialog" aria-modal="true">
    <button type="button" class="icon-btn modal-x" data-action="close-modal" title="Kapat">${icon('close')}</button>
    ${inner}
    <div class="modal-actions">
      <button type="button" class="pill-btn" data-action="close-modal">Vazgeç</button>
      ${okLabel ? `<button type="submit" class="pill-btn ${danger ? 'danger' : 'primary'}">${okLabel}</button>` : ''}
    </div></form>`;
  modalEl.hidden = false;
  const form = modalEl.querySelector('form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const keep = await onSubmit?.(new FormData(form), form);
    if (keep !== false) closeModal(true);
  });
  setTimeout(() => form.querySelector('input:not([type=file]), textarea')?.focus(), 30);
  return form;
}
function closeModal(ok = false) {
  modalEl.hidden = true;
  modalEl.innerHTML = '';
  modalResolve?.(ok);
  modalResolve = null;
}
function confirmModal(title, text, okLabel = 'Tamam') {
  return new Promise((resolve) => {
    openModal(`<h2>${esc(title)}</h2><p class="muted">${esc(text)}</p>`, () => {}, okLabel, { danger: true });
    modalResolve = resolve;
  });
}

function imagePicker(current, label = 'Kapak görseli') {
  return `<div class="img-pick">
    <div class="img-preview">${current ? `<img src="${current}" alt="">` : icon('note')}</div>
    <div>
      <label class="pill-btn file-btn">${label} seç<input type="file" name="image" accept="image/*" hidden></label>
      ${current ? `<label class="check"><input type="checkbox" name="removeImage"> Görseli kaldır</label>` : ''}
    </div>
  </div>`;
}
function bindImagePreview(form) {
  const inp = form.querySelector('input[name=image]');
  inp?.addEventListener('change', () => {
    const f = inp.files[0];
    if (f) form.querySelector('.img-preview').innerHTML = `<img src="${URL.createObjectURL(f)}" alt="">`;
  });
}

function newPlaylistModal(songIds = []) {
  openModal(`<h2>Yeni çalma listesi</h2>
    <label>Ad<input name="name" maxlength="100" placeholder="Çalma Listem #${state.playlists.length + 1}"></label>
    <label>Açıklama<textarea name="description" rows="2" maxlength="300" placeholder="İsteğe bağlı"></textarea></label>`,
  async (fd) => {
    const pl = await createPlaylist(fd.get('name'), songIds);
    pl.description = fd.get('description').trim();
    await savePlaylist(pl);
    toast(songIds.length ? `“${pl.name}” oluşturuldu ve şarkı eklendi` : `“${pl.name}” oluşturuldu`);
    if (!songIds.length) location.hash = '#/playlist/' + pl.id;
    else render();
  }, 'Oluştur');
}

function editPlaylistModal(pl) {
  const form = openModal(`<h2>Çalma listesini düzenle</h2>
    ${imagePicker(pl.cover)}
    <label>Ad<input name="name" maxlength="100" required value="${esc(pl.name)}"></label>
    <label>Açıklama<textarea name="description" rows="3" maxlength="300">${esc(pl.description)}</textarea></label>`,
  async (fd) => {
    pl.name = fd.get('name').trim() || pl.name;
    pl.description = fd.get('description').trim();
    const img = fd.get('image');
    if (fd.get('removeImage')) pl.cover = null;
    if (img && img.size) pl.cover = await resizeImage(img, 480);
    await savePlaylist(pl);
    renderSidebar();
    render();
  });
  bindImagePreview(form);
}

function editSongModal(id) {
  const s = state.songs.get(id);
  const form = openModal(`<h2>Şarkı bilgilerini düzenle</h2>
    ${imagePicker(s.cover)}
    <label>Başlık<input name="title" required value="${esc(s.title)}"></label>
    <label>Sanatçı<input name="artist" required value="${esc(s.artist)}"></label>
    <div class="two"><label>Albüm<input name="album" value="${esc(s.album)}"></label>
    <label>Yıl<input name="year" inputmode="numeric" maxlength="4" value="${esc(s.year)}"></label></div>`,
  async (fd) => {
    s.title = fd.get('title').trim() || s.title;
    s.artist = fd.get('artist').trim() || s.artist;
    s.album = fd.get('album').trim();
    s.year = fd.get('year').trim();
    const img = fd.get('image');
    if (fd.get('removeImage')) s.cover = null;
    if (img && img.size) s.cover = await resizeImage(img);
    await saveSong(s);
    if (id === player.currentId) { updatePlayerUI(); updateMediaSession(); }
    renderSidebar();
    render();
    toast('Kaydedildi');
  });
  bindImagePreview(form);
}

function addToPlaylistModal(ids) {
  const renderList = () => state.playlists.length
    ? [...state.playlists].sort((a, b) => b.updatedAt - a.updatedAt).map((pl) => {
      const has = ids.every((id) => pl.songIds.includes(id));
      return `<button type="button" class="pick-row ${has ? 'on' : ''}" data-pick="${pl.id}">
        ${playlistCover(pl, 'sm')}<span class="t"><span class="title">${esc(pl.name)}</span><span class="sub">${plural(plSongs(pl).length, 'şarkı')}</span></span>
        <span class="pick-check">${icon(has ? 'check' : 'plus')}</span></button>`;
    }).join('')
    : '<p class="muted">Henüz çalma listen yok.</p>';
  const form = openModal(`<h2>Çalma listesine ekle</h2>
    <button type="button" class="pick-row new" data-pick="__new">${`<div class="cover empty sm">${icon('plus')}</div>`}<span class="t"><span class="title">Yeni çalma listesi</span></span></button>
    <div class="pick-list">${renderList()}</div>`, null, null);
  form.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-pick]');
    if (!b) return;
    if (b.dataset.pick === '__new') { closeModal(); newPlaylistModal(ids); return; }
    const pl = getPlaylist(b.dataset.pick);
    if (b.classList.contains('on')) {
      pl.songIds = pl.songIds.filter((id) => !ids.includes(id));
      await savePlaylist(pl);
      toast(`“${pl.name}” listesinden kaldırıldı`);
    } else {
      await addToPlaylist(pl, ids);
    }
    form.querySelector('.pick-list').innerHTML = renderList();
    renderSidebar();
    if (route().name === 'playlist') render();
  });
}

/* ---------- Now playing (tam ekran) ---------- */
function openNowPlaying() {
  if (!current()) return;
  $('#nowPlaying').hidden = false;
  requestAnimationFrame(() => $('#nowPlaying').classList.add('open'));
}
function closeNowPlaying() {
  const np = $('#nowPlaying');
  np.classList.remove('open');
  setTimeout(() => { np.hidden = true; }, 250);
}

/* ---------- Olaylar ---------- */
async function handleAction(action, el, e) {
  const d = el.dataset;
  switch (action) {
    case 'upload': $('#fileInput').click(); break;
    case 'add-url': addUrlModal(); break;
    case 'new-playlist': newPlaylistModal(); break;
    case 'back': history.back(); break;
    case 'forward': history.forward(); break;
    case 'toggle': toggle(); break;
    case 'next': next(); break;
    case 'prev': prev(); break;
    case 'shuffle': setShuffle(!player.shuffle); break;
    case 'repeat': cycleRepeat(); break;
    case 'mute':
      if (player.muted || player.volume === 0) { player.muted = false; if (player.volume === 0) player.volume = 0.5; } else player.muted = true;
      updateModes(); savePlayer(); break;
    case 'like-current': if (player.currentId) toggleLike(player.currentId); break;
    case 'like': toggleLike(d.song); break;
    case 'more': songMenu(el); break;
    case 'open-now-playing': openNowPlaying(); break;
    case 'close-now-playing': closeNowPlaying(); break;
    case 'close-modal': closeModal(false); break;
    case 'play-list': {
      const l = lists.get(d.list);
      if (l?.href && player.context?.href === l.href && player.currentId) toggle();
      else playList(d.list, 0);
      break;
    }
    case 'shuffle-list': playList(d.list, 0, true); break;
    case 'play-card': playList(d.list, +d.index); break;
    case 'play-collection': {
      if (d.kind === 'liked') playIds(likedSongs().map((s) => s.id), 0, { label: 'Beğenilen Şarkılar', href: '#/liked' });
      else {
        const pl = getPlaylist(d.id);
        const ids = plSongs(pl).map((s) => s.id);
        if (!ids.length) toast('Bu liste boş');
        else playIds(ids, 0, { label: pl.name, href: '#/playlist/' + pl.id });
      }
      break;
    }
    case 'pl-edit': editPlaylistModal(getPlaylist(d.id)); break;
    case 'pl-delete': deletePlaylist(getPlaylist(d.id)); break;
    case 'pl-add-song': {
      const pl = getPlaylist(d.id);
      await addToPlaylist(pl, [d.song]);
      const y = $('#main').scrollTop;
      render();
      $('#main').scrollTop = y;
      break;
    }
    case 'q-remove': removeFromQueueAt(+d.index); break;
    case 'q-clear':
      player.queue = player.queue.slice(0, player.index + 1);
      player.original = player.queue.slice();
      savePlayer(); render(); break;
    default: break;
  }
}

function bindEvents() {
  document.addEventListener('click', (e) => {
    // Menü öğesi
    const mi = e.target.closest('[data-menu]');
    if (mi && menuEl._items) {
      const it = menuEl._items.find((x) => x && x.id === mi.dataset.menu);
      closeMenu();
      it?.run();
      return;
    }
    if (!menuEl.hidden && !e.target.closest('#menu')) {
      closeMenu();
      if (e.target.closest('[data-action="more"]')) return;
    }
    if (e.target === modalEl) { closeModal(false); return; }

    const a = e.target.closest('[data-action]');
    if (a) {
      const link = e.target.closest('a[href]');
      if (link && link !== a && a.contains(link)) return; // iç bağlantı normal çalışsın
      if (a.tagName !== 'A') e.preventDefault();
      handleAction(a.dataset.action, a, e);
      return;
    }
    if (e.target.closest('a[href]')) return;
    const row = e.target.closest('.row[data-song]');
    if (row) {
      if (row.dataset.queueIndex) { player.index = +row.dataset.queueIndex; loadSong(player.queue[player.index]); return; }
      const l = lists.get(row.dataset.list);
      if (l?.queue) { toggle(); return; }
      if (row.dataset.song === player.currentId && l?.href && player.context?.href === l.href) { toggle(); return; }
      playList(row.dataset.list, +row.dataset.index);
    }
  });

  document.addEventListener('contextmenu', (e) => {
    const row = e.target.closest('.row[data-song]');
    const btn = row?.querySelector('[data-action="more"]');
    if (btn) { e.preventDefault(); songMenu(btn); }
  });

  $('#fileInput').addEventListener('change', (e) => {
    importFiles([...e.target.files]);
    e.target.value = '';
  });

  $('#searchInput').addEventListener('input', (e) => { state.search = e.target.value; render(); });

  $('#view').addEventListener('input', (e) => {
    if (e.target.id === 'libFilter') {
      state.libFilter = e.target.value;
      const list = libraryRows();
      const key = [...lists.entries()].find(([, l]) => l.href === '#/library')?.[0];
      $('#libTable').innerHTML = libTableHtml(list, key);
      markPlayingRows();
    } else if (e.target.id === 'plFind') {
      state.plFind = e.target.value;
      $('#plFindResults').innerHTML = finderResults(getPlaylist(e.target.dataset.id));
    }
  });
  $('#view').addEventListener('change', (e) => {
    if (e.target.id === 'libSort') { state.libSort = e.target.value; store.set('libSort', state.libSort); render(); }
  });

  // Dosya sürükle bırak
  let dragDepth = 0;
  const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
  window.addEventListener('dragenter', (e) => { if (!hasFiles(e)) return; dragDepth++; $('#dropOverlay').hidden = false; });
  window.addEventListener('dragleave', (e) => { if (!hasFiles(e)) return; if (--dragDepth <= 0) { dragDepth = 0; $('#dropOverlay').hidden = true; } });
  window.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
  window.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth = 0;
    $('#dropOverlay').hidden = true;
    importFiles([...e.dataTransfer.files]);
  });

  // Çalma listesinde sürükleyerek sıralama
  let dragFrom = null;
  const view = $('#view');
  view.addEventListener('dragstart', (e) => {
    const row = e.target.closest('.row[draggable]');
    if (!row) return;
    dragFrom = +row.dataset.index;
    row.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(dragFrom));
  });
  view.addEventListener('dragover', (e) => {
    if (dragFrom === null) return;
    const row = e.target.closest('.row[draggable]');
    if (!row) return;
    e.preventDefault();
    $$('.drop-above, .drop-below').forEach((r) => r.classList.remove('drop-above', 'drop-below'));
    const rect = row.getBoundingClientRect();
    row.classList.add(e.clientY < rect.top + rect.height / 2 ? 'drop-above' : 'drop-below');
  });
  view.addEventListener('drop', (e) => {
    if (dragFrom === null) return;
    const row = e.target.closest('.row[draggable]');
    const r = route();
    const pl = r.name === 'playlist' && getPlaylist(r.param);
    if (row && pl) {
      e.preventDefault();
      let to = +row.dataset.index + (row.classList.contains('drop-below') ? 1 : 0);
      if (to > dragFrom) to--;
      if (to !== dragFrom) moveInPlaylist(pl, dragFrom, to);
    }
  });
  view.addEventListener('dragend', () => {
    dragFrom = null;
    $$('.dragging, .drop-above, .drop-below').forEach((r) => r.classList.remove('dragging', 'drop-above', 'drop-below'));
  });

  // Klavye kısayolları
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!menuEl.hidden) closeMenu();
      else if (!modalEl.hidden) closeModal(false);
      else if (!$('#nowPlaying').hidden) closeNowPlaying();
      return;
    }
    if (e.target.closest('input, textarea, select') || e.ctrlKey || e.metaKey || e.altKey || !modalEl.hidden) return;
    const k = e.key.toLowerCase();
    if (e.code === 'Space') { e.preventDefault(); toggle(); }
    else if (e.key === 'ArrowRight' && e.shiftKey) next();
    else if (e.key === 'ArrowLeft' && e.shiftKey) prev();
    else if (e.key === 'ArrowRight') audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5);
    else if (e.key === 'ArrowLeft') audio.currentTime = Math.max(0, audio.currentTime - 5);
    else if (e.key === 'ArrowUp') { e.preventDefault(); player.volume = Math.min(1, player.volume + 0.05); player.muted = false; updateModes(); savePlayer(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); player.volume = Math.max(0, player.volume - 0.05); updateModes(); savePlayer(); }
    else if (k === 'l' && player.currentId) toggleLike(player.currentId);
    else if (k === 's') setShuffle(!player.shuffle);
    else if (k === 'r') cycleRepeat();
    else if (k === 'm') handleAction('mute', document.body);
    else if (k === '/') { e.preventDefault(); location.hash = '#/search'; }
  });

  window.addEventListener('hashchange', () => { closeMenu(); render(); });
  window.addEventListener('resize', () => { if (!menuEl.classList.contains('sheet')) closeMenu(); });
  $('#main').addEventListener('scroll', () => {
    if (!menuEl.hidden && !menuEl.classList.contains('sheet') && performance.now() - menuEl._openedAt > 200) closeMenu();
  }, { passive: true });
  window.addEventListener('beforeunload', savePlayer);
  document.addEventListener('visibilitychange', () => { if (document.hidden) savePlayer(); });
  onAppPause(savePlayer);
  // Android geri tuşu: açık menü / pencere / tam ekran çalar varsa önce onu kapat
  onBackButton(() => {
    if (!menuEl.hidden) { closeMenu(); return true; }
    if (!modalEl.hidden) { closeModal(false); return true; }
    if (!$('#nowPlaying').hidden) { closeNowPlaying(); return true; }
    return false;
  });
}

async function showStorage() {
  const el = $('#storageInfo');
  if (!el || !navigator.storage?.estimate) return;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  const gb = (b) => (b / 1024 ** 3 >= 1 ? (b / 1024 ** 3).toFixed(1) + ' GB' : (b / 1024 ** 2).toFixed(0) + ' MB');
  el.textContent = `Kullanılan alan: ${gb(usage)} / ${gb(quota)}`;
}

/* ---------- Başlangıç ---------- */
async function init() {
  hydrateIcons();
  setupNativeUi();
  try {
    const [s, p] = await Promise.all([db.getAll('songs'), db.getAll('playlists')]);
    s.forEach((x) => state.songs.set(x.id, x));
    state.playlists = p;
  } catch (err) {
    console.error(err);
    toast('Veritabanı açılamadı. Gizli sekmede olabilirsin.', { duration: 8000 });
  }
  bindEvents();
  bindAudio();
  setupMediaSession();
  restorePlayer();
  updateModes();
  updatePlayerUI();
  renderSidebar();
  render();
  new MutationObserver(() => { if (route().name === 'library') showStorage(); }).observe($('#view'), { childList: true });
  showStorage();

  if (!isNative && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

init();
