// Compact line art shared by the in-match HUD and the controls menu.
// Accessible names belong to the surrounding button; the artwork is decorative.
const glyphs = Object.freeze({
  sense: '<path d="M8 8a4 4 0 0 1 8 0c0 3-3 3.5-3 6v1a3 3 0 0 1-6 0"/><path d="M11 8a1 1 0 0 1 2 0c0 1.5-3 2-3 4"/><path d="M19 5a9 9 0 0 1 0 9M4 7a8 8 0 0 0 0 7"/>',
  focus: '<path d="m14 4 2 4 4 2a6 6 0 0 1-7 5L7 21l-4-4 6-6a6 6 0 0 1 5-7Z"/><path d="m5.5 16.5 2 2M3 3v4M3 3h4M21 17v4h-4"/>',
  heal: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z"/>',
  trap: '<path d="M3 12a9 9 0 0 0 18 0M3 12l2-5 3 3 4-5 4 5 3-3 2 5"/><path d="M5 16h14M8 20v2M16 20v2M9 13h6v3"/>',
  fury: '<path d="M12 2c-6 0-8 3-8 8 0 6 3 11 8 12 5-1 8-6 8-12 0-5-2-8-8-8Z"/><path d="m7 8 3 1-1 2H6ZM17 8l-3 1 1 2h3ZM10 14h4M9 17h.01M12 18h.01M15 17h.01"/><path d="m10 4 2 2 2-2"/>',
  crouch: '<circle cx="14" cy="5" r="2"/><path d="m12 9-4 4 5 3 5-2M12 9l4 3h5M13 16l-4 5H4M8 13l-4 2"/>',
  attack: '<path d="m8 15 9-12 4-1c1 5-3 11-10 16Z"/><path d="m8 15 3 3-5 5-3-3ZM6 14l7 7"/>',
  rifle: '<path d="M3 11h13v4H8l-3 4H2v-7ZM16 12h6M21 10v4M11 15v4h3l-1-4M5 11V9h5"/>',
  bat: '<path d="M5 20c-.8.8-2.4-.8-1.6-1.6L9 12l2 2Zm4-8 8-9c2-2 5 1 3 3l-9 8ZM3 18l3 3"/>',
  flashlight: '<path d="m7 11 5-5 6 6-5 5ZM7 11l-5 6 5 5 6-5M12 6l2-3 7 7-3 2M17 2l1-1M21 6l2-1M20 2l2-1"/><path d="m6 15 3 3"/>',
  map: '<path d="m2 5 6-3 8 3 6-3v17l-6 3-8-3-6 3ZM8 2v17M16 5v17"/><path d="m11 10 2 2-2 2"/>',
  drop: '<path d="M12 2v11m-4-4 4 4 4-4M4 15v6h16v-6M3 15h5M16 15h5"/>',
  run: '<circle cx="15" cy="4" r="2"/><path d="m13 8-4 5 5 3-3 6M13 8l4 4h5M9 13l-3 5H2M12 9H7l-3 3"/>',
  heart: '<path d="M12 21 3.5 12.5C-2 7 6 0 12 6c6-6 14 1 8.5 6.5Z"/>',
  stamina: '<path d="M13 2 4 14h7l-1 8 10-13h-7Z"/>',
  bag: '<rect x="5" y="7" width="14" height="15" rx="3"/><path d="M9 7V5a3 3 0 0 1 6 0v2M8 12h8v6H8ZM5 11H3v7h2M19 11h2v7h-2"/>',
  medkit: '<rect x="2" y="7" width="20" height="14" rx="3"/><path d="M8 7V4h8v3M12 11v6M9 14h6"/>',
  ammo: '<path d="M4 9V6l3-4 3 4v15H4ZM14 9V6l3-4 3 4v15h-6ZM4 9h6M14 9h6M4 18h6M14 18h6"/>',
  car: '<path d="m4 9 2-6h12l2 6M3 9h18v10H3ZM5 19v3M19 19v3M2 12h2M20 12h2M7 6h10"/><path d="M6 13h2M16 13h2M8 17h8"/>',
  boat: '<path d="M12 2v7M12 4h5M5 12V9h14v3M2 12l10 3 10-3-4 7H6ZM2 22c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2"/>',
  radio: '<rect x="5" y="7" width="14" height="15" rx="2"/><path d="M8 7V1M9 11h6M9 14h6M9 17h2M14 18h1M19 10h2v4h-2"/>',
  rescue: '<path d="M10 3H3v18h7M13 3h8v18h-8M8 12h10m-4-4 4 4-4 4"/>',
  settings: '<path d="m10 2-1 3-3 1-3 1 1 3-2 2 2 2-1 3 3 1 3 1 1 3h4l1-3 3-1 3-1-1-3 2-2-2-2 1-3-3-1-3-1-1-3Z"/><circle cx="12" cy="12" r="3"/>',
  sound: '<path d="M3 9h4l5-5v16l-5-5H3ZM16 8a6 6 0 0 1 0 8M19 4a11 11 0 0 1 0 16"/>',
  search: '<circle cx="10" cy="10" r="7"/><path d="m15 15 7 7"/>',
  interact: '<path d="M9 12V5a2 2 0 0 1 4 0v7-3a2 2 0 0 1 4 0v3-1a2 2 0 0 1 4 0v5c0 4-3 6-7 6h-2l-7-8a2 2 0 0 1 3-2l3 3"/>',
  barricade: '<path d="m3 4 18 13-3 4L1 8ZM21 4l-6 5M3 17l5-4M3 17l3 4 6-4M3 2v4M21 18v4"/><path d="M6 8h.01M18 17h.01M18 6h.01M6 18h.01"/>',
  lure: '<path d="M8 13c0-3 7-3 8 0l-1 6H9ZM10 10l-2-3 2-2M16 9l3-2M17 12l5-1M6 12l-4-2M5 15l-3 1"/><path d="M11 15h2"/>',
  drive: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><path d="m3 8 6 3M21 8l-6 3M12 15v7M4 6h16"/>',
  revive: '<circle cx="7" cy="6" r="3"/><path d="M2 21v-4a5 5 0 0 1 10 0v4M17 6v8M13 10h8M15 20l2 2 5-5"/>',
  power: '<path d="M12 2v10M6 5a9 9 0 1 0 12 0"/>',
  inspect: '<path d="M3 6h4M3 6v4M21 6h-4M21 6v4M3 18h4M3 18v-4M21 18h-4M21 18v-4"/><path d="M5 12c4-6 10-6 14 0-4 6-10 6-14 0Z"/><circle cx="12" cy="12" r="2"/>',
  skull: '<path d="M7 17H5C0 10 4 2 12 2s12 8 7 15h-2v5H7Z"/><circle cx="8" cy="10" r="2"/><circle cx="16" cy="10" r="2"/><path d="m12 13-1 3h2ZM10 19v3M14 19v3"/>',
  eye: '<path d="M2 12C7 3 17 3 22 12c-5 9-15 9-20 0Z"/><circle cx="12" cy="12" r="3"/>',
  close: '<path d="m5 5 14 14M19 5 5 19"/>',
});

const aliases = Object.freeze({ear:'sense',tool:'focus',cross:'heal',mask:'fury',machete:'attack'});
export const ICON_NAMES = Object.freeze([...Object.keys(glyphs),...Object.keys(aliases)]);

export function icon(name) {
  const key = Object.hasOwn(aliases,name) ? aliases[name] : name;
  const artwork = Object.hasOwn(glyphs,key) ? glyphs[key] : glyphs.interact;
  return '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+artwork+'</svg>';
}
