import { Platform } from "react-native";

const tintColorLight = "#8b5e3c";
const tintColorDark = "#f2c792";

export const Colors = {
  light: {
    text: "#1A1826",
    background: "#F7F4F0",
    surface: "#FFFFFF",
    muted: "#9B95A8",
    border: "#EAE5DC",
    accentWarm: "#C4714F",
    accentCool: "#4A6FA5",
    success: "#7B9E87",
    danger: "#9b4141",
    tint: tintColorLight,
    icon: "#9B95A8",
    tabIconDefault: "#9B95A8",
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: "#FFFFFF",
    background: "#1A1826",
    surface: "#201E30",
    muted: "#9B95A8",
    border: "#2D2A45",
    accentWarm: "#C4714F",
    accentCool: "#4A6FA5",
    success: "#7B9E87",
    danger: "#f4a4a4",
    tint: tintColorDark,
    icon: "#9B95A8",
    tabIconDefault: "#9B95A8",
    tabIconSelected: tintColorDark,
  },
};

const _fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

export const Fonts = _fonts ?? {
  sans: "normal",
  serif: "serif",
  rounded: "normal",
  mono: "monospace",
};
