import * as Yup from "yup";
import AppError from "../../errors/AppError";
import Company from "../../models/Company";
import Setting from "../../models/Setting";
import User from "../../models/User";
import { ensureDefaultSchedulingPaymentSettings } from "../SchedulingServices/ServiceSchedulingPaymentSettingsService";
import UpdateCompanyServicesService from "./UpdateCompanyServicesService";

interface CompanyServiceData {
  id?: number | string;
  name: string;
  price?: number | string;
}

interface CompanyData {
  name: string;
  phone?: string;
  email?: string;
  password?: string;
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

const CreateCompanyService = async (
  companyData: CompanyData
): Promise<Company> => {
  const {
    name,
    phone,
    email,
    status,
    planId,
    password,
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

  const companySchema = Yup.object().shape({
    name: Yup.string()
      .min(2, "ERR_COMPANY_INVALID_NAME")
      .required("ERR_COMPANY_INVALID_NAME")
      .test(
        "Check-unique-name",
        "ERR_COMPANY_NAME_ALREADY_EXISTS",
        async value => {
          if (value) {
            const companyWithSameName = await Company.findOne({
              where: { name: value }
            });

            return !companyWithSameName;
          }
          return false;
        }
      )
  });

  try {
    await companySchema.validate({ name });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const company = await Company.create({
    name,
    phone,
    email,
    status,
    planId,
    dueDate,
    recurrence
  });

  if (Array.isArray(companyServices) && companyServices.length > 0) {
    await UpdateCompanyServicesService({
      id: company.id,
      companyServices: companyServices as any
    });
  }

  const user = await User.create({
    name: company.name,
    email: company.email,
    password: password || "mudar123",
    profile: "admin",
    companyId: company.id
  });

  await Setting.findOrCreate({
    where: {
      companyId: company.id,
      key: "asaas"
    },
    defaults: {
      companyId: company.id,
      key: "asaas",
      value: ""
    },
  });

  //tokenixc
  await Setting.findOrCreate({
    where: {
      companyId: company.id,
      key: "tokenixc"
    },
    defaults: {
      companyId: company.id,
      key: "tokenixc",
      value: ""
    },
  });

  //ipixc
  await Setting.findOrCreate({
    where: {
      companyId: company.id,
      key: "ipixc"
    },
    defaults: {
      companyId: company.id,
      key: "ipixc",
      value: ""
    },
  });

  //ipmkauth
  await Setting.findOrCreate({
    where: {
      companyId: company.id,
      key: "ipmkauth"
    },
    defaults: {
      companyId: company.id,
      key: "ipmkauth",
      value: ""
    },
  });

  //clientsecretmkauth
  await Setting.findOrCreate({
    where: {
      companyId: company.id,
      key: "clientsecretmkauth"
    },
    defaults: {
      companyId: company.id,
      key: "clientsecretmkauth",
      value: ""
    },
  });

  //clientidmkauth
  await Setting.findOrCreate({
    where: {
      companyId: company.id,
      key: "clientidmkauth"
    },
    defaults: {
      companyId: company.id,
      key: "clientidmkauth",
      value: ""
    },
  });

  //CheckMsgIsGroup
  await Setting.findOrCreate({
    where: {
      companyId: company.id,
      key: "CheckMsgIsGroup"
    },
    defaults: {
      companyId: company.id,
      key: "enabled",
      value: ""
    },
  });

  //CheckMsgIsGroup
  await Setting.findOrCreate({
    where: {
      companyId: company.id,
      key: ""
    },
    defaults: {
      companyId: company.id,
      key: "call",
      value: "disabled"
    },
  });

  //scheduleType
  await Setting.findOrCreate({
    where: {
      companyId: company.id,
      key: "scheduleType"
    },
    defaults: {
      companyId: company.id,
      key: "scheduleType",
      value: "disabled"
    },
  });


 // Enviar mensagem ao aceitar ticket
    await Setting.findOrCreate({
	where:{
      companyId: company.id,
      key: "sendGreetingAccepted",
    },
    defaults: {
      companyId: company.id,
      key: "sendGreetingAccepted",
      value: "disabled"
    },
  });
  
 // Enviar mensagem de transferencia
    await Setting.findOrCreate({
	where:{
      companyId: company.id,
      key: "sendMsgTransfTicket",
    },
    defaults: {
      companyId: company.id,
      key: "sendMsgTransfTicket",
      value: "disabled"
    },
 });

  //userRating
  await Setting.findOrCreate({
    where: {
      companyId: company.id,
      key: "userRating"
    },
    defaults: {
      companyId: company.id,
      key: "userRating",
      value: "disabled"
    },
  });

  //userRating
  await Setting.findOrCreate({
    where: {
      companyId: company.id,
      key: "chatBotType"
    },
    defaults: {
      companyId: company.id,
      key: "chatBotType",
      value: "text"
    },

  });

  await Setting.findOrCreate({
    where: {
      companyId: company.id,
      key: "tokensgp"
    },
    defaults: {
      companyId: company.id,
      key: "tokensgp",
      value: ""
    },
  });

  await Setting.findOrCreate({
    where: {
      companyId: company.id,
      key: "ipsgp"
    },
    defaults: {
      companyId: company.id,
      key: "ipsgp",
      value: ""
    },
  });

  await Setting.findOrCreate({
    where: {
      companyId: company.id,
      key: "appsgp"
    },
    defaults: {
      companyId: company.id,
      key: "appsgp",
      value: ""
    },
  });

  await ensureDefaultSchedulingPaymentSettings(company.id);

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

  return company;
};

export default CreateCompanyService;
