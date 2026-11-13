// Shared constants. Kept free of imports so any module can use it without cycles.

export const GAME_W = 540;
export const GAME_H = 960;

export const SAVE_KEY = 'bus-color-jam:save:v1'; // key stays the same: old saves are migrated in place (see SaveManager)
export const SAVE_VERSION = 2;
export const HINT_COST = 15;
export const BOOST_COST = { vip: 60, pax: 40, colors: 40 }; // coin price of the three boosters
export const START_COINS = 100;
export const DAILY_REWARDS = [50, 75, 100, 150, 200, 250, 500];

export const FONT = '"Trebuchet MS","Arial Rounded MT Bold","Segoe UI",Roboto,Arial,sans-serif';

// The 10 gameplay colours (Red, Yellow, Blue, Green, Pink, Orange, Purple, Grey, Brown, Sky Blue). A bus and its passengers use EXACTLY the same `main` value.
// `main` = base paint, `dark` = shaded side / rim, `light` = highlight, `label` = readable name.
export const COLORS = {
  red:    { main: 0xd81f2a, dark: 0x8c0f18, light: 0xff7a82, css: '#d81f2a', label: 'Red' },
  yellow: { main: 0xf2b705, dark: 0xa87c00, light: 0xffd95a, css: '#f2b705', label: 'Yellow' },
  blue:   { main: 0x1648d9, dark: 0x0b2a8c, light: 0x7b9cff, css: '#1648d9', label: 'Blue' },
  green:  { main: 0x1f9e3a, dark: 0x0f6a24, light: 0x7fdc93, css: '#1f9e3a', label: 'Green' },
  pink:   { main: 0xe8559f, dark: 0xa22a6c, light: 0xff9fcf, css: '#e8559f', label: 'Pink' },
  orange: { main: 0xf06d0a, dark: 0xa64300, light: 0xffa860, css: '#f06d0a', label: 'Orange' },
  purple: { main: 0x8a1596, dark: 0x560a62, light: 0xc66bd0, css: '#8a1596', label: 'Purple' },
  grey:   { main: 0x7b8494, dark: 0x4a5262, light: 0xb9c0cc, css: '#7b8494', label: 'Grey' },
  brown:  { main: 0x74461f, dark: 0x472810, light: 0xb98a5e, css: '#74461f', label: 'Brown' },
  sky:    { main: 0x1fb4e8, dark: 0x0b7aa6, light: 0x8fe0ff, css: '#1fb4e8', label: 'Sky Blue' },
};
export const COLOR_NAMES = Object.keys(COLORS);

export const UI_COLORS = {
  green: 0x3ed16a,
  blue: 0x3d8bff,
  orange: 0xff9a3c,
  red: 0xff4d5e,
  purple: 0xa566ff,
  gray: 0x8c96b0,
  navy: 0x1b2a52,
};

// Gameplay layout (design resolution is GAME_W x GAME_H, scaled to fit any screen).
export const LAYOUT = {
  platformTop: 198,
  platformBottom: 318,
  slotY: 420,
  slotH: 104,
  roadTop: 516, // dispatch road (perspective) top / bottom edge
  roadBottom: 900,
  laneTop: 604,
  laneGap: 56,
  laneMaxVisible: 5,
  controlsY: 912,
};
