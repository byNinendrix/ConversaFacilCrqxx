import { Op } from "sequelize";

import AppError from "../../errors/AppError";
import Setting from "../../models/Setting";

export type SchedulingPaymentMode = "disabled" | "optional" | "required";
export type SchedulingDepositType = "fixed" | "percentage";
export type SchedulingPixKeyType = "cpf" | "cnpj" | "email" | "phone" | "random";
export type SchedulingPixSendMode = "copy_paste" | "instructions" | "both";

export type SchedulingPixSettings = {
  enabled: boolean;
  key: string;
  keyType: SchedulingPixKeyType;
  recipientName: string;
  city: string;
  sendMode: SchedulingPixSendMode;
};

export type SchedulingPaymentSettings = {
  paymentMode: SchedulingPaymentMode;
  depositType: SchedulingDepositType;
  depositValue: number;
  paymentHoldMinutes: number;
  paymentInstructions: string;
  pix: SchedulingPixSettings;
};

type UpdateSchedulingPaymentSettingsInput = {
  companyId: number;
  paymentMode: SchedulingPaymentMode;
  depositType: SchedulingDepositType;
  depositValue: number;
  paymentHoldMinutes?: number;
  paymentInstructions?: string;
  pixEnabled?: boolean;
  pixKey?: string;
  pixKeyType?: SchedulingPixKeyType;
  pixRecipientName?: string;
  pixCity?: string;
  pixSendMode?: SchedulingPixSendMode;
};

type LoadOptions = {
  transaction?: any;
};

export const SCHEDULING_PAYMENT_SETTING_KEYS = {
  paymentMode: "schedulingPaymentMode",
  depositType: "schedulingDepositType",
  depositValue: "schedulingDepositValue",
  paymentHoldMinutes: "schedulingPaymentHoldMinutes",
  paymentInstructions: "schedulingPaymentInstructions",
  pixEnabled: "schedulingPixEnabled",
  pixKey: "schedulingPixKey",
  pixKeyType: "schedulingPixKeyType",
  pixRecipientName: "schedulingPixRecipientName",
  pixCity: "schedulingPixCity",
  pixSendMode: "schedulingPixSendMode"
} as const;

const DEFAULT_PAYMENT_SETTINGS: SchedulingPaymentSettings = {
  paymentMode: "disabled",
  depositType: "fixed",
  depositValue: 0,
  paymentHoldMinutes: 15,
  paymentInstructions: "",
  pix: {
    enabled: false,
    key: "",
    keyType: "random",
    recipientName: "",
    city: "",
    sendMode: "both"
  }
};

const normalizePaymentMode = (value: any): SchedulingPaymentMode => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (["disabled", "optional", "required"].includes(normalized)) {
    return normalized as SchedulingPaymentMode;
  }
  return DEFAULT_PAYMENT_SETTINGS.paymentMode;
};

const normalizeDepositType = (value: any): SchedulingDepositType => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (["fixed", "percentage"].includes(normalized)) {
    return normalized as SchedulingDepositType;
  }
  return DEFAULT_PAYMENT_SETTINGS.depositType;
};

const normalizeDepositValue = (value: any): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_PAYMENT_SETTINGS.depositValue;
  }
  return Math.max(0, Number(numeric.toFixed(2)));
};

const normalizePaymentHoldMinutes = (value: any): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_PAYMENT_SETTINGS.paymentHoldMinutes;
  }
  const rounded = Math.trunc(parsed);
  if (rounded < 1) return 1;
  if (rounded > 24 * 60) return 24 * 60;
  return rounded;
};

const normalizePaymentInstructions = (value: any): string =>
  String(value || "")
    .trim()
    .slice(0, 2000);

const normalizeBoolean = (value: any, fallback = false): boolean => {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (["1", "true", "enabled", "yes", "sim"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "disabled", "no", "nao", "não"].includes(normalized)) {
    return false;
  }

  return fallback;
};

const normalizePixKey = (value: any): string =>
  String(value || "")
    .trim()
    .slice(0, 255);

const normalizePixKeyType = (value: any): SchedulingPixKeyType => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (["cpf", "cnpj", "email", "phone", "random"].includes(normalized)) {
    return normalized as SchedulingPixKeyType;
  }

  return DEFAULT_PAYMENT_SETTINGS.pix.keyType;
};

const normalizePixRecipientName = (value: any): string =>
  String(value || "")
    .trim()
    .slice(0, 80);

const normalizePixCity = (value: any): string =>
  String(value || "")
    .trim()
    .slice(0, 80);

const normalizePixSendMode = (value: any): SchedulingPixSendMode => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (["copy_paste", "instructions", "both"].includes(normalized)) {
    return normalized as SchedulingPixSendMode;
  }

  return DEFAULT_PAYMENT_SETTINGS.pix.sendMode;
};

const ensureValidSettings = (
  settings: SchedulingPaymentSettings,
  enforceRequiredDeposit = false
): void => {
  if (settings.depositType === "percentage" && settings.depositValue > 100) {
    throw new AppError("ERR_INVALID_DEPOSIT_PERCENTAGE", 400);
  }

  if (
    enforceRequiredDeposit &&
    settings.paymentMode === "required" &&
    settings.depositValue <= 0
  ) {
    throw new AppError("ERR_REQUIRED_DEPOSIT_VALUE_MUST_BE_POSITIVE", 400);
  }

  if (settings.pix.enabled) {
    if (!settings.pix.key) {
      throw new AppError("ERR_PIX_KEY_REQUIRED", 400);
    }

    if (!settings.pix.recipientName) {
      throw new AppError("ERR_PIX_RECIPIENT_REQUIRED", 400);
    }

    if (!settings.pix.city) {
      throw new AppError("ERR_PIX_CITY_REQUIRED", 400);
    }
  }
};

const upsertSetting = async ({
  companyId,
  key,
  value,
  transaction
}: {
  companyId: number;
  key: string;
  value: string;
  transaction?: any;
}): Promise<void> => {
  const [setting, created] = await Setting.findOrCreate({
    where: {
      companyId,
      key
    },
    defaults: {
      companyId,
      key,
      value
    },
    transaction
  });

  if (!created && setting.value !== value) {
    await setting.update({ value }, { transaction });
  }
};

export const getSchedulingPaymentSettings = async (
  companyId: number,
  options: LoadOptions = {}
): Promise<SchedulingPaymentSettings> => {
  const rows = await Setting.findAll({
    where: {
      companyId,
      key: {
        [Op.in]: Object.values(SCHEDULING_PAYMENT_SETTING_KEYS)
      }
    },
    transaction: options.transaction
  });

  const byKey = new Map<string, string>();
  rows.forEach(setting => {
    byKey.set(String(setting.key), String(setting.value || ""));
  });

  const settings: SchedulingPaymentSettings = {
    paymentMode: normalizePaymentMode(
      byKey.get(SCHEDULING_PAYMENT_SETTING_KEYS.paymentMode)
    ),
    depositType: normalizeDepositType(
      byKey.get(SCHEDULING_PAYMENT_SETTING_KEYS.depositType)
    ),
    depositValue: normalizeDepositValue(
      byKey.get(SCHEDULING_PAYMENT_SETTING_KEYS.depositValue)
    ),
    paymentHoldMinutes: normalizePaymentHoldMinutes(
      byKey.get(SCHEDULING_PAYMENT_SETTING_KEYS.paymentHoldMinutes)
    ),
    paymentInstructions: normalizePaymentInstructions(
      byKey.get(SCHEDULING_PAYMENT_SETTING_KEYS.paymentInstructions)
    ),
    pix: {
      enabled: normalizeBoolean(
        byKey.get(SCHEDULING_PAYMENT_SETTING_KEYS.pixEnabled),
        DEFAULT_PAYMENT_SETTINGS.pix.enabled
      ),
      key: normalizePixKey(byKey.get(SCHEDULING_PAYMENT_SETTING_KEYS.pixKey)),
      keyType: normalizePixKeyType(
        byKey.get(SCHEDULING_PAYMENT_SETTING_KEYS.pixKeyType)
      ),
      recipientName: normalizePixRecipientName(
        byKey.get(SCHEDULING_PAYMENT_SETTING_KEYS.pixRecipientName)
      ),
      city: normalizePixCity(byKey.get(SCHEDULING_PAYMENT_SETTING_KEYS.pixCity)),
      sendMode: normalizePixSendMode(
        byKey.get(SCHEDULING_PAYMENT_SETTING_KEYS.pixSendMode)
      )
    }
  };

  ensureValidSettings(settings);
  return settings;
};

export const updateSchedulingPaymentSettings = async ({
  companyId,
  paymentMode,
  depositType,
  depositValue,
  paymentHoldMinutes,
  paymentInstructions,
  pixEnabled,
  pixKey,
  pixKeyType,
  pixRecipientName,
  pixCity,
  pixSendMode
}: UpdateSchedulingPaymentSettingsInput): Promise<SchedulingPaymentSettings> => {
  const currentSettings = await getSchedulingPaymentSettings(companyId);

  const normalized: SchedulingPaymentSettings = {
    paymentMode: normalizePaymentMode(paymentMode),
    depositType: normalizeDepositType(depositType),
    depositValue: normalizeDepositValue(depositValue),
    paymentHoldMinutes: normalizePaymentHoldMinutes(
      paymentHoldMinutes !== undefined
        ? paymentHoldMinutes
        : currentSettings.paymentHoldMinutes
    ),
    paymentInstructions: normalizePaymentInstructions(
      paymentInstructions !== undefined
        ? paymentInstructions
        : currentSettings.paymentInstructions
    ),
    pix: {
      enabled: normalizeBoolean(pixEnabled, currentSettings.pix.enabled),
      key: normalizePixKey(pixKey !== undefined ? pixKey : currentSettings.pix.key),
      keyType: normalizePixKeyType(
        pixKeyType !== undefined ? pixKeyType : currentSettings.pix.keyType
      ),
      recipientName: normalizePixRecipientName(
        pixRecipientName !== undefined
          ? pixRecipientName
          : currentSettings.pix.recipientName
      ),
      city: normalizePixCity(pixCity !== undefined ? pixCity : currentSettings.pix.city),
      sendMode: normalizePixSendMode(
        pixSendMode !== undefined ? pixSendMode : currentSettings.pix.sendMode
      )
    }
  };

  ensureValidSettings(normalized, true);

  await upsertSetting({
    companyId,
    key: SCHEDULING_PAYMENT_SETTING_KEYS.paymentMode,
    value: normalized.paymentMode
  });

  await upsertSetting({
    companyId,
    key: SCHEDULING_PAYMENT_SETTING_KEYS.depositType,
    value: normalized.depositType
  });

  await upsertSetting({
    companyId,
    key: SCHEDULING_PAYMENT_SETTING_KEYS.depositValue,
    value: String(normalized.depositValue)
  });

  await upsertSetting({
    companyId,
    key: SCHEDULING_PAYMENT_SETTING_KEYS.paymentHoldMinutes,
    value: String(normalized.paymentHoldMinutes)
  });

  await upsertSetting({
    companyId,
    key: SCHEDULING_PAYMENT_SETTING_KEYS.paymentInstructions,
    value: normalized.paymentInstructions
  });

  await upsertSetting({
    companyId,
    key: SCHEDULING_PAYMENT_SETTING_KEYS.pixEnabled,
    value: String(normalized.pix.enabled)
  });

  await upsertSetting({
    companyId,
    key: SCHEDULING_PAYMENT_SETTING_KEYS.pixKey,
    value: normalized.pix.key
  });

  await upsertSetting({
    companyId,
    key: SCHEDULING_PAYMENT_SETTING_KEYS.pixKeyType,
    value: normalized.pix.keyType
  });

  await upsertSetting({
    companyId,
    key: SCHEDULING_PAYMENT_SETTING_KEYS.pixRecipientName,
    value: normalized.pix.recipientName
  });

  await upsertSetting({
    companyId,
    key: SCHEDULING_PAYMENT_SETTING_KEYS.pixCity,
    value: normalized.pix.city
  });

  await upsertSetting({
    companyId,
    key: SCHEDULING_PAYMENT_SETTING_KEYS.pixSendMode,
    value: normalized.pix.sendMode
  });

  return normalized;
};

export const ensureDefaultSchedulingPaymentSettings = async (
  companyId: number
): Promise<void> => {
  await upsertSetting({
    companyId,
    key: SCHEDULING_PAYMENT_SETTING_KEYS.paymentMode,
    value: DEFAULT_PAYMENT_SETTINGS.paymentMode
  });

  await upsertSetting({
    companyId,
    key: SCHEDULING_PAYMENT_SETTING_KEYS.depositType,
    value: DEFAULT_PAYMENT_SETTINGS.depositType
  });

  await upsertSetting({
    companyId,
    key: SCHEDULING_PAYMENT_SETTING_KEYS.depositValue,
    value: String(DEFAULT_PAYMENT_SETTINGS.depositValue)
  });

  await upsertSetting({
    companyId,
    key: SCHEDULING_PAYMENT_SETTING_KEYS.paymentHoldMinutes,
    value: String(DEFAULT_PAYMENT_SETTINGS.paymentHoldMinutes)
  });

  await upsertSetting({
    companyId,
    key: SCHEDULING_PAYMENT_SETTING_KEYS.paymentInstructions,
    value: DEFAULT_PAYMENT_SETTINGS.paymentInstructions
  });

  await upsertSetting({
    companyId,
    key: SCHEDULING_PAYMENT_SETTING_KEYS.pixEnabled,
    value: String(DEFAULT_PAYMENT_SETTINGS.pix.enabled)
  });

  await upsertSetting({
    companyId,
    key: SCHEDULING_PAYMENT_SETTING_KEYS.pixKey,
    value: DEFAULT_PAYMENT_SETTINGS.pix.key
  });

  await upsertSetting({
    companyId,
    key: SCHEDULING_PAYMENT_SETTING_KEYS.pixKeyType,
    value: DEFAULT_PAYMENT_SETTINGS.pix.keyType
  });

  await upsertSetting({
    companyId,
    key: SCHEDULING_PAYMENT_SETTING_KEYS.pixRecipientName,
    value: DEFAULT_PAYMENT_SETTINGS.pix.recipientName
  });

  await upsertSetting({
    companyId,
    key: SCHEDULING_PAYMENT_SETTING_KEYS.pixCity,
    value: DEFAULT_PAYMENT_SETTINGS.pix.city
  });

  await upsertSetting({
    companyId,
    key: SCHEDULING_PAYMENT_SETTING_KEYS.pixSendMode,
    value: DEFAULT_PAYMENT_SETTINGS.pix.sendMode
  });
};
