import AppError from "../../errors/AppError";
import Company from "../../models/Company";
import Plan from "../../models/Plan";
import Setting from "../../models/Setting";

export type CompanyFeatureFlags = {
  servicesEnabled: boolean;
  schedulingEnabled: boolean;
};

const parseSettingBoolean = (value: any): boolean | null => {
  if (value === true || value === false) {
    return value;
  }

  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (!normalized) {
    return null;
  }

  if (["true", "1", "enabled", "yes", "sim"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "disabled", "no", "nao"].includes(normalized)) {
    return false;
  }

  return null;
};

const GetCompanyFeatureFlagsService = async (
  companyId: number | string
): Promise<CompanyFeatureFlags> => {
  const targetCompanyId = Number(companyId);

  if (!Number.isInteger(targetCompanyId) || targetCompanyId <= 0) {
    throw new AppError("ERR_INVALID_COMPANY", 400);
  }

  const company = await Company.findByPk(targetCompanyId, {
    attributes: ["id"],
    include: [
      {
        model: Plan,
        as: "plan",
        attributes: ["id", "useSchedules"]
      },
      {
        model: Setting,
        as: "settings",
        attributes: ["key", "value"]
      }
    ]
  });

  if (!company) {
    throw new AppError("ERR_NO_COMPANY_FOUND", 404);
  }

  const settings = Array.isArray((company as any).settings)
    ? (company as any).settings
    : [];

  const getSettingFlag = (key: string): boolean | null => {
    const matchingSettings = settings.filter(
      (item: any) => String(item?.key || "").trim() === key
    );

    if (!matchingSettings.length) {
      return null;
    }

    const latestSetting = matchingSettings.sort((a: any, b: any) => {
      const aTime = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
      const bTime = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
      return bTime - aTime;
    })[0];

    return parseSettingBoolean(latestSetting?.value);
  };

  const planUseSchedules =
    (company as any).plan?.useSchedules === false ? false : true;

  const schedulingOverride = getSettingFlag("schedulingEnabled");
  const servicesOverride = getSettingFlag("servicesEnabled");

  const schedulingEnabled =
    schedulingOverride === null ? planUseSchedules : schedulingOverride;
  const servicesEnabled =
    servicesOverride === null ? true : servicesOverride;

  return {
    servicesEnabled,
    schedulingEnabled
  };
};

export default GetCompanyFeatureFlagsService;

