import AppError from "../../errors/AppError";
import GetCompanyFeatureFlagsService from "./GetCompanyFeatureFlagsService";

type FeatureKey = "services" | "scheduling";

type Request = {
  companyId: number | string;
  feature: FeatureKey;
};

const AssertCompanyFeatureEnabledService = async ({
  companyId,
  feature
}: Request): Promise<void> => {
  const flags = await GetCompanyFeatureFlagsService(companyId);

  if (feature === "services" && !flags.servicesEnabled) {
    throw new AppError(
      "Services feature is not available for this company/plan.",
      403
    );
  }

  if (feature === "scheduling" && !flags.schedulingEnabled) {
    throw new AppError(
      "Scheduling is not available for this company/plan.",
      403
    );
  }
};

export default AssertCompanyFeatureEnabledService;
