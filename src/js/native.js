// Telefon (Android / iOS) entegrasyonu. Tarayıcıda çalışırken bu fonksiyonlar web API'lerine düşer.
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { App } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { MediaSession } from '@capgo/capacitor-media-session';

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform(); // 'android' | 'ios' | 'web'

const quiet = (p) => { p?.catch?.(() => {}); };

// Kilit ekranı / bildirim kontrolleri. Android'de ayrıca ön plan servisi başlatır,
// böylece uygulama arka plandayken müzik kesilmez.
export const media = {
  setMetadata({ title, artist, album, artwork }) {
    const meta = { title, artist, album: album || '', artwork: artwork || [] };
    try { quiet(MediaSession.setMetadata(meta)); } catch { /* desteklenmiyor */ }
  },
  setPlaybackState(state) {
    try { quiet(MediaSession.setPlaybackState({ playbackState: state })); } catch { /* desteklenmiyor */ }
  },
  setPositionState({ duration, position, playbackRate = 1 }) {
    if (!Number.isFinite(duration) || duration <= 0) return;
    try {
      quiet(MediaSession.setPositionState({ duration, position: Math.min(Math.max(0, position), duration), playbackRate }));
    } catch { /* desteklenmiyor */ }
  },
  setActionHandler(action, handler) {
    try { quiet(MediaSession.setActionHandler({ action }, (d) => handler(d || {}))); } catch { /* desteklenmiyor */ }
  },
};

// Android geri tuşu: önce açık pencereleri kapatır, sonra geri gider,
// ana sayfadaysa uygulamayı kapatmak yerine arka plana alır (müzik çalmaya devam eder).
export function onBackButton(handler) {
  if (platform !== 'android') return;
  quiet(App.addListener('backButton', async () => {
    if (handler()) return;
    if (location.hash && location.hash !== '#/' && location.hash !== '#') history.back();
    else quiet(App.minimizeApp());
  }));
}

export function onAppPause(handler) {
  if (!isNative) return;
  quiet(App.addListener('pause', handler));
}

export async function setupNativeUi() {
  if (!isNative) return;
  document.documentElement.classList.add('native', 'platform-' + platform);
  try { await SystemBars.setStyle({ style: SystemBarsStyle.Dark }); } catch { /* yoksay */ }
  try { await SplashScreen.hide({ fadeOutDuration: 200 }); } catch { /* yoksay */ }
}
