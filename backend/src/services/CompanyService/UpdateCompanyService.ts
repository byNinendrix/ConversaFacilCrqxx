import AppError from "../../errors/AppError";
import Company from "../../models/Company";
import Setting from "../../models/Setting";
import Invoices from "../../models/Invoices";
import Plan from "../../models/Plan";
import UpdateCompanyServicesService from "./UpdateCompanyServicesService";

interface CompanyServiceData {
  id?: number | string;
  name: string;
  price?: number | string;
}

interface CompanyData {
  name: string;
  id?: number | string;
  phone?: string;
  email?: string;
  status?: boolean;
  planId?: number;
  campaignsEnabled?: boolean;
  servicesEnabled?: boolean;
  schedulingEnabled?: boolean;
  dueDate?: string;
  recurrence?: string;
  companyServices?: CompanyServiceData[];
}

const upsertSettingValue = async (
  companyId: number,
  key: string,
  value: string
): Promise<void> => {
  const existingSettings = await Setting.findAll({
    where: {
      companyId,
      key
    }
  });

  if (!existingSettings.length) {
    await Setting.create({
      companyId,
      key,
      value
    });
    return;
  }

  await Promise.all(existingSettings.map(setting => setting.update({ value })));
};

const toBoolean = (value: any, fallback: boolean): boolean => {
  if (typeof value === "boolean") {
    return value;
  }

  const normalizedValue = String(value ?? "")
    .trim()
    .toLowerCase();

  if (["true", "enabled", "1", "yes", "sim"].includes(normalizedValue)) {
    return true;
  }

  if (["false", "disabled", "0", "no", "nao", "não"].includes(normalizedValue)) {
    return false;
  }

  return fallback;
};

const UpdateCompanyService = async (
  companyData: CompanyData
): Promise<Company> => {
  const company = await Company.findByPk(companyData.id);
  const {
    name,
    phone,
    email,
    status,
    planId,
    campaignsEnabled,
    servicesEnabled,
    schedulingEnabled,
    dueDate,
    recurrence,
    companyServices
  } = companyData;
  const normalizedCampaignsEnabled = toBoolean(campaignsEnabled, false);
  const normalizedServicesEnabled = toBoolean(servicesEnabled, true);
  const normalizedSchedulingEnabled = toBoolean(schedulingEnabled, true);

  if (!company) {
    throw new AppError("ERR_NO_COMPANY_FOUND", 404);
  }

  const openInvoices = await Invoices.findAll({
    where: {
      status: "open",
      companyId: company.id,
    },
 });

 if (openInvoices.length > 1) {
  for (const invoice of openInvoices.slice(1)) {
    await invoice.update({ status: "cancelled" });
  }
}

const plan = await Plan.findByPk(planId);

if (!plan) {
  throw new Error("Plano Não Encontrado.");
}


  // 5. Atualizar a única invoice com status "open" existente, baseada no companyId.
  const openInvoice = openInvoices[0];
  
  if (openInvoice) {
    await openInvoice.update({
      value: plan.value,
      detail: plan.name,
      dueDate: dueDate,
    });
  
  } else {
    throw new Error("Nenhuma fatura em aberto para este cliente!");
  }

  await company.update({
    name,
    phone,
    email,
    status,
    planId,
    dueDate,
    recurrence
  });

  if (companyData.campaignsEnabled !== undefined) {
    await upsertSettingValue(
      company.id,
      "campaignsEnabled",
      `${normalizedCampaignsEnabled}`
    );
  }

  if (companyData.servicesEnabled !== undefined) {
    await upsertSettingValue(
      company.id,
      "servicesEnabled",
      `${normalizedServicesEnabled}`
    );
  }

  if (companyData.schedulingEnabled !== undefined) {
    await upsertSettingValue(
      company.id,
      "schedulingEnabled",
      `${normalizedSchedulingEnabled}`
    );
  }

  if (companyServices !== undefined) {
    const companyWithServices = await UpdateCompanyServicesService({
      id: company.id,
      companyServices: companyServices as any
    });

    return companyWithServices;
  }

  return company;
};

export default UpdateCompanyService;
