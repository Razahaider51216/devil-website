/* Original DEVIL line icons. Drawn here on a 24 × 24 grid; no icon package. */
(() => {
  const paths = {
    arrow: '<path d="M5 12h13m-5-5 5 5-5 5"/>',
    external: '<path d="M7 17 17 7M8 7h9v9"/>',
    menu: '<path d="M4 7h16M4 12h10M4 17h16"/>',
    close: '<path d="m7 7 10 10M17 7 7 17"/>',
    theme: '<circle cx="12" cy="12" r="8"/><path d="M12 4v16M12 4a8 8 0 0 1 0 16Z" fill="currentColor" stroke="none"/>',
    command: '<path d="m5 7 5 5-5 5m9 0h5"/><path d="M3 3h18v18H3z" opacity=".35"/>',
    server: '<rect x="4" y="3" width="16" height="7" rx="2"/><rect x="4" y="14" width="16" height="7" rx="2"/><path d="M8 6.5h.01M8 17.5h.01m4-11h5m-5 11h5M12 10v4"/>',
    users: '<path d="M4 20v-2a5 5 0 0 1 10 0v2m3-11a3 3 0 0 1 0 6m1 2a4 4 0 0 1 3 3"/><circle cx="9" cy="8" r="4"/>',
    shield: '<path d="m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6l8-3Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    ticket: '<path d="M4 5h16v4a3 3 0 0 0 0 6v4H4v-4a3 3 0 0 0 0-6V5Z"/><path d="M14 5v3m0 3v2m0 3v3"/>',
    welcome: '<path d="M4 20h16M7 20V5l9-2v17M7 5h11v15m-7-8h.01"/>',
    rank: '<path d="m5 12 7-7 7 7m-14 5 7-7 7 7M12 3v2"/>',
    crown: '<path d="m3 6 5 4 4-6 4 6 5-4-3 12H6L3 6Zm3 15h12"/>',
    vip: '<path d="m12 2 8 5v10l-8 5-8-5V7l8-5Z"/><path d="m7 9 2.5 2L12 7l2.5 4L17 9l-1.5 7h-7L7 9Zm2 9h6"/><path d="M12 2v2m8 3-2 1M4 7l2 1" opacity=".5"/>',
    shop: '<path d="m5 3-2 6a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0l-2-6H5ZM5 12v9h14v-9M9 21v-6h6v6"/>',
    settings: '<path d="M4 6h6m4 0h6M4 12h10m4 0h2M4 18h2m4 0h10"/><circle cx="12" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="8" cy="18" r="2"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15 15 5 5"/>',
    bell: '<path d="M6 10a6 6 0 0 1 12 0v5l2 3H4l2-3v-5Zm4 11h4M12 2v2"/>',
    chat: '<path d="M4 4h16v12H9l-5 4V4Z"/><path d="M8 8h8m-8 4h5"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18Z"/>',
    activity: '<path d="M3 12h4l3-7 4 14 3-7h4"/>',
    update: '<path d="M4 9a8 8 0 0 1 14-3l2 3m0-5v5h-5M20 15a8 8 0 0 1-14 3l-2-3m0 5v-5h5"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
    plus: '<path d="M5 12h14M12 5v14"/>',
    community: '<circle cx="12" cy="12" r="3"/><circle cx="5" cy="5" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="m6.5 6.5 3.3 3.3m4.4 0 3.3-3.3m-11 11 3.3-3.3m4.4 0 3.3 3.3"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>'
  };
  window.DevilIcons = {
    render(name, className = '') {
      return `<svg class="devil-icon ${className}" data-drawn-icon="${Object.hasOwn(paths, name) ? name : 'grid'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.grid}</svg>`;
    }
  };
})();
