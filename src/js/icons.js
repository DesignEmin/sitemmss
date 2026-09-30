// Satır içi SVG ikonları (harici bağımlılık yok)
const p = (d, fill = true) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" ${fill ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'}>${d}</svg>`;

export const icons = {
  logo: p('<circle cx="12" cy="12" r="11"/><path fill="#000" d="M9.5 16.5a2 2 0 1 1-1-1.73V7.5l8-1.5v8.5a2 2 0 1 1-1-1.73V8.2l-6 1.12z"/>'),
  home: p('<path d="M12 3 2 11h3v9h5v-6h4v6h5v-9h3z"/>'),
  search: p('<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>', false),
  library: p('<path d="M4 3h2v18H4zM9 3h2v18H9zM14.2 3.6l1.9-.7 5.7 16.9-1.9.7z"/>'),
  plus: p('<path d="M12 5v14M5 12h14"/>', false),
  upload: p('<path d="M12 16V4M6 10l6-6 6 6M4 20h16"/>', false),
  link: p('<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/>', false),
  heart: p('<path d="M12 20.5s-7.5-4.6-9.3-9.2C1.5 8 3.6 4.5 7.1 4.5c2 0 3.4 1.1 4.9 2.9 1.5-1.8 2.9-2.9 4.9-2.9 3.5 0 5.6 3.5 4.4 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/>', false),
  'heart-fill': p('<path d="M12 20.5s-7.5-4.6-9.3-9.2C1.5 8 3.6 4.5 7.1 4.5c2 0 3.4 1.1 4.9 2.9 1.5-1.8 2.9-2.9 4.9-2.9 3.5 0 5.6 3.5 4.4 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/>'),
  play: p('<path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z"/>'),
  pause: p('<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>'),
  next: p('<path d="M5 5.2v13.6a1 1 0 0 0 1.5.86L16 13v6h2V5h-2v6L6.5 4.34A1 1 0 0 0 5 5.2z"/>'),
  prev: p('<path d="M19 5.2v13.6a1 1 0 0 1-1.5.86L8 13v6H6V5h2v6l9.5-6.66A1 1 0 0 1 19 5.2z"/>'),
  shuffle: p('<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>', false),
  repeat: p('<path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>', false),
  'repeat-one': p('<path d="M17 2l4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/><path d="M11 10h1.5v5"/>', false),
  volume: p('<path d="M11 5 6 9H2v6h4l5 4z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>', false),
  'volume-low': p('<path d="M11 5 6 9H2v6h4l5 4z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/>', false),
  mute: p('<path d="M11 5 6 9H2v6h4l5 4z" fill="currentColor"/><path d="m22 9-6 6M16 9l6 6"/>', false),
  queue: p('<path d="M3 6h13M3 12h13M3 18h8M18 14v7l4-3.5z"/>', false),
  more: p('<circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>'),
  'chevron-left': p('<path d="m15 18-6-6 6-6"/>', false),
  'chevron-right': p('<path d="m9 18 6-6-6-6"/>', false),
  'chevron-down': p('<path d="m6 9 6 6 6-6"/>', false),
  'chevron-up': p('<path d="m6 15 6-6 6 6"/>', false),
  note: p('<path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>', false),
  clock: p('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', false),
  edit: p('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>', false),
  trash: p('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', false),
  close: p('<path d="M6 6l12 12M18 6 6 18"/>', false),
  check: p('<path d="m5 12 5 5 9-10"/>', false),
  'play-next': p('<path d="M3 6h11M3 12h11M3 18h6"/><path d="M15 15v6l5-3z" fill="currentColor"/>', false),
  'add-queue': p('<path d="M3 6h13M3 12h13M3 18h8M18 15v6M15 18h6"/>', false),
  'list-add': p('<path d="M3 6h13M3 12h9M3 18h9M18 13v8M14 17h8"/>', false),
  user: p('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', false),
  disc: p('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/>', false),
  grip: p('<circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>'),
  download: p('<path d="M12 4v12M6 10l6 6 6-6M4 20h16"/>', false),
};

export const icon = (name) => icons[name] || '';

export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    el.innerHTML = icon(el.dataset.icon);
    el.classList.add('ic');
  });
}
