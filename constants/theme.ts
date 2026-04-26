import { Platform } from 'react-native';

const tintColorLight = '#8b5e3c';
const tintColorDark = '#f2c792';

export const Colors = {
  light: {
    text: '#261b16',
    background: '#f6f0e8',
    surface: '#fffaf4',
    muted: '#6f6259',
    border: '#dfd2c6',
    accentWarm: '#c7784f',
    accentCool: '#3f6f7f',
    success: '#2f7a58',
    danger: '#9b4141',
    tint: tintColorLight,
    icon: '#7b6b60',
    tabIconDefault: '#9b8a7d',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#f7efe8',
    background: '#191412',
    surface: '#241c19',
    muted: '#c9b8aa',
    border: '#3c312b',
    accentWarm: '#f0aa79',
    accentCool: '#83b8c3',
    success: '#7fd1a1',
    danger: '#f4a4a4',
    tint: tintColorDark,
    icon: '#b9a89b',
    tabIconDefault: '#8d7d72',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
