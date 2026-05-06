import Setting from "../../models/Setting";
import {
  APPEARANCE_SETTING_KEYS,
  DEFAULT_APPEARANCE_SETTINGS
} from "./AppearanceThemeDefaults";

interface Request {
  settingKey: string; // Add settingKey property
  companyId: number;
}

const DEFAULT_SETTINGS_VALUES: Record<string, string> = {
  allowregister: "enabled",
  trial: "3",
  viewregister: "disabled",
  [APPEARANCE_SETTING_KEYS.defaultMode]: DEFAULT_APPEARANCE_SETTINGS.defaultMode,
  [APPEARANCE_SETTING_KEYS.lightPalette]: JSON.stringify(
    DEFAULT_APPEARANCE_SETTINGS.palettes.light
  ),
  [APPEARANCE_SETTING_KEYS.darkPalette]: JSON.stringify(
    DEFAULT_APPEARANCE_SETTINGS.palettes.dark
  )
};

const ShowSettingsService = async ({
  settingKey, // Update parameter name to settingKey
  companyId
}: Request): Promise<Setting | undefined> => {
  const defaultValue = DEFAULT_SETTINGS_VALUES[settingKey] || "disabled";

  const [setting] = await Setting.findOrCreate({
    where: { key: settingKey, companyId },
    defaults: {
      key: settingKey,
      value: defaultValue,
      companyId
    }
  });

  return setting;
};

export default ShowSettingsService;
