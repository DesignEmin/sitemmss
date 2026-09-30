// IndexedDB: şarkı bilgileri, ses dosyaları ve çalma listeleri tarayıcıda kalıcı olarak saklanır.
const DB_NAME = 'muzigim';
const DB_VERSION = 1;
let dbPromise;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('songs')) db.createObjectStore('songs', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('audio')) db.createObjectStore('audio', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('playlists')) db.createObjectStore('playlists', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function run(storeNames, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, mode);
    let result;
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
    const stores = [].concat(storeNames).map((n) => tx.objectStore(n));
    const req = fn(...stores);
    if (req) req.onsuccess = () => { result = req.result; };
  });
}

export const db = {
  getAll: (store) => run(store, 'readonly', (s) => s.getAll()),
  get: (store, id) => run(store, 'readonly', (s) => s.get(id)),
  put: (store, value) => run(store, 'readwrite', (s) => s.put(value)),
  delete: (store, id) => run(store, 'readwrite', (s) => s.delete(id)),
  addSong: (song, blob) =>
    run(['songs', 'audio'], 'readwrite', (songs, audio) => {
      songs.put(song);
      if (blob) audio.put({ id: song.id, blob });
    }),
  deleteSong: (id) =>
    run(['songs', 'audio'], 'readwrite', (songs, audio) => {
      songs.delete(id);
      audio.delete(id);
    }),
};

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
