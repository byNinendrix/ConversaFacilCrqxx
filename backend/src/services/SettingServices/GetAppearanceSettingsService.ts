import ShowSettingsService from "./ShowSettingsService";
import {
  APPEARANCE_COLOR_KEYS,
  APPEARANCE_SETTING_KEYS,
  AppearanceMode,
  AppearancePalette,
  AppearancePayload,
  DEFAULT_APPEARANCE_SETTINGS
} from "./AppearanceThemeDefaults";

interface Request {
  companyId: number;
}

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{6})$/;

const normalizeColor = (value: unknown, fallback: string): string => {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim();
  return HEX_COLOR_REGEX.test(normalized) ? normalized.toUpperCase() : fallback;
};

const normalizePalette = (
  rawPalette: unknown,
  fallbackPalette: AppearancePalette
): AppearancePalette => {
  const palette = (rawPalette && typeof rawPalette === "object"
    ? rawPalette
    : {}) as Record<string, unknown>;

  return APPEARANCE_COLOR_KEYS.reduce((acc, colorKey) => {
    acc[colorKey] = normalizeColor(palette[colorKey], fallbackPalette[colorKey]);
    return acc;
  }, {} as AppearancePalette);
};

const parsePalette = (
  rawValue: string,
  fallbackPalette: AppearancePalette
): AppearancePalette => {
  try {
    return normalizePalette(JSON.parse(rawValue), fallbackPalette);
  } catch (error) {
    return fallbackPalette;
  }
};

const normalizeMode = (value: unknown): AppearanceMode => {
  return value === "dark" ? "dark" : "light";
};

const GetAppearanceSettingsService = async ({
  companyId
}: Request): Promise<AppearancePayload> => {
  const defaultModeSetting = await ShowSettingsService({
    settingKey: APPEARANCE_SETTING_KEYS.defaultMode,
    companyId
  });

  const lightPaletteSetting = await ShowSettingsService({
    settingKey: APPEARANCE_SETTING_KEYS.lightPalette,
    companyId
  });

  const darkPaletteSetting = await ShowSettingsService({
    settingKey: APPEARANCE_SETTING_KEYS.darkPalette,
    companyId
  });

  return {
    defaultMode: normalizeMode(defaultModeSetting?.value),
    palettes: {
      light: parsePalette(
        lightPaletteSetting?.value || "",
        DEFAULT_APPEARANCE_SETTINGS.palettes.light
      ),
      dark: parsePalette(
        darkPaletteSetting?.value || "",
        DEFAULT_APPEARANCE_SETTINGS.palettes.dark
      )
    }
  };
};

export default GetAppearanceSettingsService;
