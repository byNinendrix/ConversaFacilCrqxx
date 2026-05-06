export const APPEARANCE_COLOR_FIELDS = [
  { key: "primary", label: "Primaria" },
  { key: "success", label: "Verde dos Tickets (abas/contadores)" },
  { key: "hover", label: "Hover / Realce (ex.: botao Sair)" },
  { key: "button", label: "Botao" },
  { key: "buttonText", label: "Texto do Botao" },
  { key: "secondary", label: "Secundaria" },
  { key: "accent", label: "Destaque" },
  { key: "background", label: "Fundo" },
  { key: "surface", label: "Superficie" },
  { key: "text", label: "Texto" },
  { key: "textSecondary", label: "Texto Secundario" },
  { key: "border", label: "Borda" },
  { key: "warning", label: "Alerta" },
  { key: "error", label: "Erro" }
];

export const DEFAULT_THEME_PALETTES = {
  light: {
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
  },
  dark: {
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
  }
};

export const DEFAULT_APPEARANCE_SETTINGS = {
  defaultMode: "light",
  palettes: DEFAULT_THEME_PALETTES
};

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{6})$/;

export const sanitizeHexColor = (value, fallback) => {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim();
  return HEX_COLOR_REGEX.test(normalized) ? normalized.toUpperCase() : fallback;
};

export const normalizePalette = (palette, fallbackPalette) => {
  const safePalette = palette && typeof palette === "object" ? palette : {};

  return APPEARANCE_COLOR_FIELDS.reduce((acc, field) => {
    acc[field.key] = sanitizeHexColor(safePalette[field.key], fallbackPalette[field.key]);
    return acc;
  }, {});
};

export const normalizeAppearanceSettings = (rawSettings) => {
  const rawPalettes =
    rawSettings && typeof rawSettings.palettes === "object" ? rawSettings.palettes : {};

  return {
    defaultMode: rawSettings?.defaultMode === "dark" ? "dark" : "light",
    palettes: {
      light: normalizePalette(rawPalettes.light, DEFAULT_THEME_PALETTES.light),
      dark: normalizePalette(rawPalettes.dark, DEFAULT_THEME_PALETTES.dark)
    }
  };
};

export const getPaletteByMode = (appearanceSettings, mode) => {
  const safeSettings = normalizeAppearanceSettings(appearanceSettings);
  return mode === "dark" ? safeSettings.palettes.dark : safeSettings.palettes.light;
};

export const buildThemeConfig = (mode, locale, appearanceSettings) => {
  const activePalette = getPaletteByMode(appearanceSettings, mode);
  const isLight = mode === "light";

  return {
    scrollbarStyles: {
      "&::-webkit-scrollbar": {
        width: "8px",
        height: "8px",
        borderRadius: "8px"
      },
      "&::-webkit-scrollbar-thumb": {
        boxShadow: "inset 0 0 6px rgba(0, 0, 0, 0.3)",
        backgroundColor: activePalette.primary,
        borderRadius: "8px"
      }
    },
    scrollbarStylesSoft: {
      "&::-webkit-scrollbar": {
        width: "8px",
        borderRadius: "8px"
      },
      "&::-webkit-scrollbar-thumb": {
        backgroundColor: isLight ? "#F3F3F3" : "#333333",
        borderRadius: "8px"
      }
    },
    palette: {
      type: mode,
      primary: { main: activePalette.primary },
      secondary: { main: activePalette.secondary },
      error: { main: activePalette.error },
      warning: { main: activePalette.warning },
      success: { main: activePalette.success },
      action: {
        hover: activePalette.hover,
        selected: activePalette.hover
      },
      sair: { main: activePalette.button },
      vcard: { main: activePalette.primary },
      textPrimary: activePalette.primary,
      borderPrimary: activePalette.border,
      dark: { main: isLight ? "#333333" : "#F3F3F3" },
      light: { main: isLight ? "#F3F3F3" : "#333333" },
      text: {
        primary: activePalette.text,
        secondary: activePalette.textSecondary,
        sair: activePalette.buttonText,
        vcard: activePalette.text
      },
      background: {
        default: activePalette.background,
        paper: activePalette.surface
      },
      divider: activePalette.border,
      tabHeaderBackground: activePalette.surface,
      optionsBackground: activePalette.surface,
      options: activePalette.surface,
      fontecor: activePalette.text,
      fancyBackground: activePalette.background,
      bordabox: activePalette.border,
      newmessagebox: activePalette.surface,
      inputdigita: isLight ? "#FFFFFF" : activePalette.surface,
      contactdrawer: activePalette.surface,
      announcements: activePalette.surface,
      login: activePalette.background,
      announcementspopover: activePalette.surface,
      chatlist: activePalette.surface,
      boxlist: activePalette.surface,
      boxchatlist: activePalette.surface,
      total: activePalette.surface,
      messageIcons: activePalette.textSecondary,
      inputBackground: activePalette.background,
      barraSuperior: `linear-gradient(to right, ${activePalette.primary}, ${activePalette.accent}, ${activePalette.secondary})`,
      boxticket: activePalette.surface,
      campaigntab: activePalette.surface,
      mediainput: activePalette.surface
    },
    mode
  };
};
