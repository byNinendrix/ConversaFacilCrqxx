import { Op } from "sequelize";
import Setting from "../../../models/Setting";

const PROVIDER_SETTING_KEYS = [
  "asaas",
  "tokenixc",
  "ipixc",
  "ipmkauth",
  "clientidmkauth",
  "clientsecretmkauth"
] as const;

type ProviderSettingKey = typeof PROVIDER_SETTING_KEYS[number];
export type ProviderSettings = Record<ProviderSettingKey, string>;
type ProviderSettingsCacheEntry = {
  expiresAt: number;
  value: ProviderSettings;
};

const PROVIDER_SETTINGS_TTL_MS = 5000;
const providerSettingsCache = new Map<number, ProviderSettingsCacheEntry>();

export const sanitizeCpfCnpj = (value: string): string => value.replace(/[.\-\/\s,]/g, "");
export const normalizeBaseUrl = (value: string): string => (value.endsWith("/") ? value.slice(0, -1) : value);

export const loadProviderSettings = async (companyId: number): Promise<ProviderSettings> => {
  const cached = providerSettingsCache.get(companyId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const settings = await Setting.findAll({
    where: {
      companyId,
      key: { [Op.in]: PROVIDER_SETTING_KEYS as unknown as string[] }
    },
    attributes: ["key", "value"],
    raw: true
  });

  const settingsMap = settings.reduce((acc, setting) => {
    const key = setting.key as ProviderSettingKey;
    acc[key] = setting.value || "";
    return acc;
  }, {} as Partial<ProviderSettings>);

  const missingKeys = PROVIDER_SETTING_KEYS.filter(key => !(key in settingsMap));
  if (missingKeys.length > 0) {
    throw new Error(`Missing provider settings for company ${companyId}: ${missingKeys.join(", ")}`);
  }

  const resolvedSettings = settingsMap as ProviderSettings;
  providerSettingsCache.set(companyId, {
    value: resolvedSettings,
    expiresAt: Date.now() + PROVIDER_SETTINGS_TTL_MS
  });

  return resolvedSettings;
};

