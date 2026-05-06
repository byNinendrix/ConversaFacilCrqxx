import { Request, Response } from "express";
import * as Yup from "yup";
import AppError from "../errors/AppError";
import Company from "../models/Company";
import CompanyService from "../models/CompanyService";
import CompanyServiceAvailability from "../models/CompanyServiceAvailability";
import CompanyServiceProfessional from "../models/CompanyServiceProfessional";
import CompanyServiceSpecificSlot from "../models/CompanyServiceSpecificSlot";
import User from "../models/User";
import CreateCompanyService from "../services/CompanyService/CreateCompanyService";
import DeleteCompanyService from "../services/CompanyService/DeleteCompanyService";
import FindAllCompaniesService from "../services/CompanyService/FindAllCompaniesService";
import ListCompaniesPlanService from "../services/CompanyService/ListCompaniesPlanService";
import ListCompaniesService from "../services/CompanyService/ListCompaniesService";
import ShowCompanyService from "../services/CompanyService/ShowCompanyService";
import ShowPlanCompanyService from "../services/CompanyService/ShowPlanCompanyService";
import UpdateCompanyService from "../services/CompanyService/UpdateCompanyService";
import UpdateCompanyServicesService from "../services/CompanyService/UpdateCompanyServicesService";
import UpdateSchedulesService from "../services/CompanyService/UpdateSchedulesService";
import AssertCompanyFeatureEnabledService from "../services/CompanyFeatureService/AssertCompanyFeatureEnabledService";
import ListSlotsService from "../services/ServiceBookingServices/ListSlotsService";

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
};

type CompanyData = {
  name: string;
  id?: number;
  phone?: string;
  email?: string;
  status?: boolean;
  planId?: number;
  campaignsEnabled?: boolean;
  servicesEnabled?: boolean;
  schedulingEnabled?: boolean;
  dueDate?: string;
  recurrence?: string;
  companyServices?: Array<{
    id?: number | string;
    name: string;
    description?: string;
    isActive?: boolean;
    showPrice?: boolean;
    displayOrder?: number | string;
    price: number | string;
    durationMinutes?: number | string;
    intervalMinutes?: number | string;
    minAdvanceMinutes?: number | string;
    maxAdvanceDays?: number | string;
    maxBookingsPerSlot?: number | string;
    assignmentMode?: string;
    professionals?: Array<{
      id?: number | string;
      userId?: number | string;
      priority?: number | string;
      isActive?: boolean;
    }>;
    availabilities?: Array<{
      id?: number | string;
      professionalId?: number | string | null;
      weekday?: number | string;
      startTime?: string;
      endTime?: string;
      capacity?: number | string | null;
      isActive?: boolean;
    }>;
    specificSlots?: Array<{
      id?: number | string;
      professionalId?: number | string | null;
      slotDate?: string;
      startTime?: string;
      endTime?: string | null;
      capacity?: number | string | null;
      isActive?: boolean;
    }>;
  }>;
};

type SchedulesData = {
  schedules: [];
};

const ensureCompanyAccess = async (
  requestUserId: string,
  requestCompanyId: number,
  targetCompanyId: number
) => {
  const requestUser = await User.findByPk(requestUserId);

  if (!requestUser) {
    throw new AppError("Usuário não encontrado", 404);
  }

  if (requestUser.super === true) {
    return;
  }

  if (requestCompanyId !== targetCompanyId) {
    throw new AppError("Você não possui permissão para acessar este recurso!", 403);
  }
};

const companyServiceSchema = Yup.object().shape({
  id: Yup.mixed().notRequired(),
  name: Yup.string().trim().required(),
  description: Yup.string().nullable().notRequired(),
  isActive: Yup.boolean().notRequired(),
  showPrice: Yup.boolean().notRequired(),
  displayOrder: Yup.number().integer().min(0).max(9999).notRequired(),
  price: Yup.number().min(0).required(),
  durationMinutes: Yup.number().integer().min(5).max(1440).notRequired(),
  intervalMinutes: Yup.number().integer().min(0).max(720).notRequired(),
  minAdvanceMinutes: Yup.number().integer().min(0).max(43200).notRequired(),
  maxAdvanceDays: Yup.number().integer().min(1).max(365).notRequired(),
  maxBookingsPerSlot: Yup.number().integer().min(1).max(100).notRequired(),
  assignmentMode: Yup.string()
    .oneOf(["automatic", "manual", "least_loaded"])
    .notRequired(),
  professionals: Yup.array()
    .of(
      Yup.object().shape({
        id: Yup.mixed().notRequired(),
        userId: Yup.number().integer().min(1).required(),
        priority: Yup.number().integer().min(0).max(9999).notRequired(),
        isActive: Yup.boolean().notRequired()
      })
    )
    .notRequired(),
  availabilities: Yup.array()
    .of(
      Yup.object().shape({
        id: Yup.mixed().notRequired(),
        professionalId: Yup.mixed()
          .nullable()
          .test(
            "valid-professional-id",
            "professionalId invalido",
            value =>
              value === null ||
              value === undefined ||
              value === "" ||
              Number.isInteger(Number(value))
          ),
        weekday: Yup.number().integer().min(0).max(6).required(),
        startTime: Yup.string()
          .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
          .required(),
        endTime: Yup.string()
          .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
          .required(),
        capacity: Yup.number().integer().min(1).max(100).nullable().notRequired(),
        isActive: Yup.boolean().notRequired()
      })
    )
    .notRequired(),
  specificSlots: Yup.array()
    .of(
      Yup.object().shape({
        id: Yup.mixed().notRequired(),
        professionalId: Yup.mixed()
          .nullable()
          .test(
            "valid-specific-professional-id",
            "professionalId invalido",
            value =>
              value === null ||
              value === undefined ||
              value === "" ||
              Number.isInteger(Number(value))
          ),
        slotDate: Yup.string()
          .matches(/^\d{4}-\d{2}-\d{2}$/)
          .required(),
        startTime: Yup.string()
          .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
          .required(),
        endTime: Yup.string()
          .nullable()
          .notRequired()
          .test(
            "valid-specific-end-time",
            "Horario final invalido",
            value =>
              value === null ||
              value === undefined ||
              value === "" ||
              /^([01]\d|2[0-3]):([0-5]\d)$/.test(value)
          ),
        capacity: Yup.number().integer().min(1).max(100).nullable().notRequired(),
        isActive: Yup.boolean().notRequired()
      })
    )
    .notRequired(),
});

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { searchParam, pageNumber } = req.query as IndexQuery;

  const { companies, count, hasMore } = await ListCompaniesService({
    searchParam,
    pageNumber
  });

  return res.json({ companies, count, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const newCompany: CompanyData = req.body;

  const schema = Yup.object().shape({
    name: Yup.string().required(),
    campaignsEnabled: Yup.boolean().notRequired(),
    servicesEnabled: Yup.boolean().notRequired(),
    schedulingEnabled: Yup.boolean().notRequired(),
    companyServices: Yup.array()
      .of(companyServiceSchema)
      .notRequired()
  });

  try {
    await schema.validate(newCompany);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const company = await CreateCompanyService(newCompany);

  return res.status(200).json(company);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const targetCompanyId = Number(req.params.id);
  const { id: requestUserId, companyId: requestCompanyId } = req.user;

  await ensureCompanyAccess(requestUserId, requestCompanyId, targetCompanyId);

  const company = await ShowCompanyService(targetCompanyId);

  return res.status(200).json(company);
};

export const list = async (req: Request, res: Response): Promise<Response> => {
  const companies: Company[] = await FindAllCompaniesService();

  return res.status(200).json(companies);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyData: CompanyData = req.body;

  const schema = Yup.object().shape({
    name: Yup.string(),
    campaignsEnabled: Yup.boolean().notRequired(),
    servicesEnabled: Yup.boolean().notRequired(),
    schedulingEnabled: Yup.boolean().notRequired(),
    companyServices: Yup.array()
      .of(companyServiceSchema)
      .notRequired()
  });

  try {
    await schema.validate(companyData);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const { id } = req.params;

  const company = await UpdateCompanyService({ id, ...companyData });

  return res.status(200).json(company);
};

export const updateServices = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;
  const targetCompanyId = Number(id);
  const { id: requestUserId, companyId: requestCompanyId } = req.user;
  const { companyServices = [] } = req.body as CompanyData;

  await ensureCompanyAccess(requestUserId, requestCompanyId, targetCompanyId);
  await AssertCompanyFeatureEnabledService({
    companyId: targetCompanyId,
    feature: "services"
  });

  const schema = Yup.object().shape({
    companyServices: Yup.array()
      .of(companyServiceSchema)
      .required()
  });

  try {
    await schema.validate({ companyServices });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const company = await UpdateCompanyServicesService({ id, companyServices });

  return res.status(200).json(company);
};

export const listServices = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const targetCompanyId = Number(req.params.id);
  const { id: requestUserId, companyId: requestCompanyId } = req.user;

  await ensureCompanyAccess(requestUserId, requestCompanyId, targetCompanyId);
  await AssertCompanyFeatureEnabledService({
    companyId: targetCompanyId,
    feature: "services"
  });

  const companyServices = await CompanyService.findAll({
    where: { companyId: targetCompanyId },
    include: [
      {
        model: CompanyServiceAvailability,
        as: "availabilities",
        attributes: [
          "id",
          "professionalId",
          "weekday",
          "startTime",
          "endTime",
          "capacity",
          "isActive"
        ]
      },
      {
        model: CompanyServiceSpecificSlot,
        as: "specificSlots",
        attributes: [
          "id",
          "professionalId",
          "slotDate",
          "startTime",
          "endTime",
          "capacity",
          "isActive"
        ]
      },
      {
        model: CompanyServiceProfessional,
        as: "professionals",
        where: { companyId: targetCompanyId },
        required: false,
        attributes: ["id", "userId", "priority", "isActive"],
        include: [
          {
            model: User,
            as: "professional",
            attributes: ["id", "name", "email"]
          }
        ]
      }
    ],
    order: [
      ["displayOrder", "ASC"],
      ["name", "ASC"]
    ]
  });

  return res.status(200).json({ companyId: targetCompanyId, companyServices });
};

export const updateSchedules = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { schedules }: SchedulesData = req.body;
  const targetCompanyId = Number(req.params.id);
  const { id: requestUserId, companyId: requestCompanyId } = req.user;

  await ensureCompanyAccess(requestUserId, requestCompanyId, targetCompanyId);

  const company = await UpdateSchedulesService({
    id: targetCompanyId,
    schedules
  });

  return res.status(200).json(company);
};

export const previewServiceSlots = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const targetCompanyId = Number(req.params.id);
  const companyServiceId = Number(req.params.serviceId);
  const { id: requestUserId, companyId: requestCompanyId } = req.user;

  await ensureCompanyAccess(requestUserId, requestCompanyId, targetCompanyId);
  await AssertCompanyFeatureEnabledService({
    companyId: targetCompanyId,
    feature: "services"
  });

  if (!Number.isInteger(companyServiceId) || companyServiceId <= 0) {
    throw new AppError("ERR_INVALID_SERVICE", 400);
  }

  const days = req.query.days ? String(req.query.days) : undefined;
  const fromDate = req.query.fromDate ? String(req.query.fromDate) : undefined;
  const professionalId = req.query.professionalId
    ? String(req.query.professionalId)
    : undefined;

  const slots = await ListSlotsService({
    companyId: targetCompanyId,
    companyServiceId,
    days,
    fromDate,
    professionalId
  });

  const preview = (slots.dateOptions || [])
    .flatMap(option =>
      (option.slots || []).map(slot => ({
        date: option.date,
        dateLabel: option.label,
        hourLabel: slot.label,
        startAtIso: slot.startAtIso,
        endAtIso: slot.endAtIso
      }))
    )
    .slice(0, 30);

  return res.status(200).json({
    service: slots.service,
    dateOptions: slots.dateOptions,
    preview
  });
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;

  const company = await DeleteCompanyService(id);

  return res.status(200).json(company);
};

export const listPlan = async (req: Request, res: Response): Promise<Response> => {
  const targetCompanyId = Number(req.params.id);
  const { id: requestUserId, companyId: requestCompanyId } = req.user;

  await ensureCompanyAccess(requestUserId, requestCompanyId, targetCompanyId);

  const company = await ShowPlanCompanyService(targetCompanyId);
  return res.status(200).json(company);
};

export const indexPlan = async (req: Request, res: Response): Promise<Response> => {
  const requestUser = await User.findByPk(req.user.id);

  if (requestUser?.super === true) {
    const companies = await ListCompaniesPlanService();
    return res.json({ companies });
  }

  return res.status(403).json({ error: "Você não possui permissão para acessar este recurso!" });
};
