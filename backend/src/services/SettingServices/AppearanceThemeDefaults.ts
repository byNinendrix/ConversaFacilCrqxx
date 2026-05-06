export const APPEARANCE_SETTING_KEYS = {
  defaultMode: "uiThemeDefaultMode",
  lightPalette: "uiThemePaletteLight",
  darkPalette: "uiThemePaletteDark"
} as const;

export const APPEARANCE_COLOR_KEYS = [
  "primary",
  "secondary",
  "accent",
  "background",
  "surface",
  "text",
  "textSecondary",
  "border",
  "button",
  "buttonText",
  "hover",
  "success",
  "warning",
  "error"
] as const;

export type AppearanceColorKey = typeof APPEARANCE_COLOR_KEYS[number];
export type AppearanceMode = "light" | "dark";

export type AppearancePalette = Record<AppearanceColorKey, string>;

export interface AppearancePayload {
  defaultMode: AppearanceMode;
  palettes: {
    light: AppearancePalette;
    dark: AppearancePalette;
  };
}

export const DEFAULT_LIGHT_PALETTE: AppearancePalette = {
  primary: "#2DDD7F",
  secondary: "#0A6EBD",
  accent: "#06B6D4",
  background: "#F6F8FB",
  surface: "#FFFFFF",
  text: "#1F2937",
  textSecondary: "#4B5563",
  border: "#D1D5DB",
  button: "#2DDD7F",
  buttonText: "#FFFFFF",
  hover: "#ECFDF3",
  success: "#16A34A",
  warning: "#D97706",
  error: "#DC2626"
};

export const DEFAULT_DARK_PALETTE: AppearancePalette = {
  primary: "#2DDD7F",
  secondary: "#60A5FA",
  accent: "#22D3EE",
  background: "#111827",
  surface: "#1F2937",
  text: "#F9FAFB",
  textSecondary: "#D1D5DB",
  border: "#374151",
  button: "#2DDD7F",
  buttonText: "#0B111B",
  hover: "#1E293B",
  success: "#22C55E",
  warning: "#F59E0B",
  error: "#F87171"
};

export const DEFAULT_APPEARANCE_SETTINGS: AppearancePayload = {
  defaultMode: "light",
  palettes: {
    light: DEFAULT_LIGHT_PALETTE,
    dark: DEFAULT_DARK_PALETTE
  }
};

