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
  red:    { main: 0xf0323c, dark: 0xa81822, light: 0xff8f95, css: '#f0323c', label: 'Red' },
  yellow: { main: 0xffd31a, dark: 0xc79a00, light: 0xffec85, css: '#ffd31a', label: 'Yellow' },
  blue:   { main: 0x1f5cff, dark: 0x1038b0, light: 0x8fb0ff, css: '#1f5cff', label: 'Blue' },
  green:  { main: 0x2fc94e, dark: 0x1a8c33, light: 0x95efa8, css: '#2fc94e', label: 'Green' },
  pink:   { main: 0xff86c8, dark: 0xc7498f, light: 0xffc4e4, css: '#ff86c8', label: 'Pink' },
  orange: { main: 0xff8a1f, dark: 0xc25a00, light: 0xffc07a, css: '#ff8a1f', label: 'Orange' },
  purple: { main: 0xa01fa8, dark: 0x6a0f72, light: 0xd77fdd, css: '#a01fa8', label: 'Purple' },
  grey:   { main: 0x9aa3b2, dark: 0x636c7c, light: 0xd3d9e3, css: '#9aa3b2', label: 'Grey' },
  brown:  { main: 0x8a5a35, dark: 0x5a3820, light: 0xc79a70, css: '#8a5a35', label: 'Brown' },
  sky:    { main: 0x4fd3ff, dark: 0x1a9ccc, light: 0xb3ecff, css: '#4fd3ff', label: 'Sky Blue' },
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
