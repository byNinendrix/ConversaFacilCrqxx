import { Op } from "sequelize";

import sequelize from "../../database";
import AppError from "../../errors/AppError";
import Company from "../../models/Company";
import CompanyService from "../../models/CompanyService";
import CompanyServiceAvailability from "../../models/CompanyServiceAvailability";
import CompanyServiceProfessional from "../../models/CompanyServiceProfessional";
import CompanyServiceSpecificSlot from "../../models/CompanyServiceSpecificSlot";
import User from "../../models/User";
import AssertCompanyFeatureEnabledService from "../CompanyFeatureService/AssertCompanyFeatureEnabledService";

const ASSIGNMENT_MODES = ["automatic", "manual", "least_loaded"] as const;

interface CompanyServiceAvailabilityData {
  id?: number | string;
  professionalId?: number | string | null;
  weekday?: number | string;
  startTime?: string;
  endTime?: string;
  capacity?: number | string | null;
  isActive?: boolean;
}

interface CompanyServiceSpecificSlotData {
  id?: number | string;
  professionalId?: number | string | null;
  slotDate?: string;
  startTime?: string;
  endTime?: string | null;
  capacity?: number | string | null;
  isActive?: boolean;
}

interface CompanyServiceProfessionalData {
  id?: number | string;
  userId?: number | string;
  priority?: number | string;
  isActive?: boolean;
}

interface CompanyServiceData {
  id?: number | string;
  name: string;
  description?: string;
  isActive?: boolean;
  showPrice?: boolean;
  displayOrder?: number | string;
  price?: number | string;
  durationMinutes?: number | string;
  intervalMinutes?: number | string;
  minAdvanceMinutes?: number | string;
  maxAdvanceDays?: number | string;
  maxBookingsPerSlot?: number | string;
  assignmentMode?: string;
  professionals?: CompanyServiceProfessionalData[];
  availabilities?: CompanyServiceAvailabilityData[];
  specificSlots?: CompanyServiceSpecificSlotData[];
}

interface Request {
  id: string | number;
  companyServices: CompanyServiceData[];
}

const hasOwn = (obj: any, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(obj || {}, key);

const normalizeDecimal = (value: any, fallback: number): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const raw = String(value ?? "").trim();
  if (!raw) {
    return fallback;
  }

  const normalizedText = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;

  const normalized = Number(
    normalizedText
  );

  if (!Number.isFinite(normalized)) {
    return fallback;
  }

  return normalized;
};

const normalizeInteger = (
  value: any,
  fallback: number,
  min: number,
  max: number
): number => {
  const normalized = Number(String(value ?? "").trim());
  if (!Number.isFinite(normalized)) {
    return fallback;
  }

  const rounded = Math.trunc(normalized);
  if (rounded < min) return min;
  if (rounded > max) return max;
  return rounded;
};

const normalizeTime = (value: any): string => {
  const text = String(value ?? "").trim();
  const isValid = /^([01]\d|2[0-3]):([0-5]\d)$/.test(text);
  return isValid ? text : "";
};

const normalizeOptionalTime = (value: any): string | null => {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }
  const time = normalizeTime(value);
  return time || null;
};

const normalizeOptionalCapacity = (value: any): number | null => {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }

  const parsed = Number(String(value).trim());
  if (!Number.isFinite(parsed)) {
    return null;
  }

  const rounded = Math.trunc(parsed);
  if (rounded <= 0) {
    return null;
  }

  return Math.min(rounded, 100);
};

const normalizeDate = (value: any): string => {
  const text = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
};

const normalizeProfessionalId = (value: any): number | null => {
  const normalized = Number(String(value ?? "").trim());
  if (!Number.isInteger(normalized) || normalized <= 0) {
    return null;
  }
  return normalized;
};

const normalizeAssignmentMode = (value: any, fallback = "automatic"): string => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (ASSIGNMENT_MODES.includes(normalized as any)) {
    return normalized;
  }

  return fallback;
};

const toMinutes = (time: string): number => {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
};

const normalizeAvailabilities = (availabilities: any[] = []) => {
  const mapBySlot = new Map<string, any>();

  for (const availability of Array.isArray(availabilities) ? availabilities : []) {
    const professionalId = normalizeProfessionalId(availability?.professionalId);
    const weekday = normalizeInteger(availability?.weekday, -1, 0, 6);
    const startTime = normalizeTime(availability?.startTime);
    const endTime = normalizeTime(availability?.endTime);
    const isActive = availability?.isActive !== false;

    if (weekday < 0 || !startTime || !endTime) {
      continue;
    }

    if (toMinutes(startTime) >= toMinutes(endTime)) {
      continue;
    }

    const normalized = {
      id: availability?.id ? Number(availability.id) : undefined,
      professionalId,
      weekday,
      startTime,
      endTime,
      capacity: normalizeOptionalCapacity(availability?.capacity),
      isActive
    };

    const slotKey = `${professionalId || "all"}-${weekday}-${startTime}-${endTime}`;
    mapBySlot.set(slotKey, normalized);
  }

  return Array.from(mapBySlot.values());
};

const normalizeSpecificSlots = (specificSlots: any[] = []) => {
  const mapBySlot = new Map<string, any>();

  for (const specificSlot of Array.isArray(specificSlots) ? specificSlots : []) {
    const professionalId = normalizeProfessionalId(specificSlot?.professionalId);
    const slotDate = normalizeDate(specificSlot?.slotDate);
    const startTime = normalizeTime(specificSlot?.startTime);
    const endTime = normalizeOptionalTime(specificSlot?.endTime);
    const capacity = normalizeOptionalCapacity(specificSlot?.capacity);
    const isActive = specificSlot?.isActive !== false;

    if (!slotDate || !startTime) {
      continue;
    }

    if (endTime && toMinutes(startTime) >= toMinutes(endTime)) {
      continue;
    }

    const normalized = {
      id: specificSlot?.id ? Number(specificSlot.id) : undefined,
      professionalId,
      slotDate,
      startTime,
      endTime,
      capacity,
      isActive
    };

    const key = `${professionalId || "all"}-${slotDate}-${startTime}`;
    mapBySlot.set(key, normalized);
  }

  return Array.from(mapBySlot.values());
};

const normalizeProfessionals = (professionals: any[] = []) => {
  const mapByUserId = new Map<number, any>();

  for (const professional of Array.isArray(professionals) ? professionals : []) {
    const userId = normalizeProfessionalId(professional?.userId);
    if (!userId) {
      continue;
    }

    const normalized = {
      id: professional?.id ? Number(professional.id) : undefined,
      userId,
      priority: normalizeInteger(professional?.priority, 0, 0, 9999),
      isActive: professional?.isActive !== false
    };

    mapByUserId.set(userId, normalized);
  }

  return Array.from(mapByUserId.values());
};

const normalizeCompanyServices = (companyServices: CompanyServiceData[] = []) => {
  if (!Array.isArray(companyServices)) {
    return [];
  }

  return companyServices
    .map(service => {
      const normalizedName = String(service?.name || "").trim();
      const hasAvailabilitiesField = hasOwn(service, "availabilities");

      return {
        id: service?.id ? Number(service.id) : undefined,
        name: normalizedName,
        price: normalizeDecimal(service?.price, 0),
        description: String(service?.description || "").trim(),
        isActive: service?.isActive !== false,
        showPrice: service?.showPrice !== false,
        displayOrder: normalizeInteger(service?.displayOrder, 0, 0, 9999),
        durationMinutes: normalizeInteger(service?.durationMinutes, 30, 5, 1440),
        intervalMinutes: normalizeInteger(service?.intervalMinutes, 0, 0, 720),
        minAdvanceMinutes: normalizeInteger(service?.minAdvanceMinutes, 60, 0, 60 * 24 * 30),
        maxAdvanceDays: normalizeInteger(service?.maxAdvanceDays, 30, 1, 365),
        maxBookingsPerSlot: normalizeInteger(service?.maxBookingsPerSlot, 1, 1, 100),
        assignmentMode: normalizeAssignmentMode(service?.assignmentMode),
        professionals: normalizeProfessionals(service?.professionals || []),
        availabilities: normalizeAvailabilities(service?.availabilities || []),
        specificSlots: normalizeSpecificSlots(service?.specificSlots || []),
        hasDescriptionField: hasOwn(service, "description"),
        hasIsActiveField: hasOwn(service, "isActive"),
        hasShowPriceField: hasOwn(service, "showPrice"),
        hasDisplayOrderField: hasOwn(service, "displayOrder"),
        hasDurationField: hasOwn(service, "durationMinutes"),
        hasIntervalField: hasOwn(service, "intervalMinutes"),
        hasMinAdvanceField: hasOwn(service, "minAdvanceMinutes"),
        hasMaxAdvanceField: hasOwn(service, "maxAdvanceDays"),
        hasMaxBookingsField: hasOwn(service, "maxBookingsPerSlot"),
        hasAssignmentModeField: hasOwn(service, "assignmentMode"),
        hasProfessionalsField: hasOwn(service, "professionals"),
        hasAvailabilitiesField,
        hasSpecificSlotsField: hasOwn(service, "specificSlots")
      };
    })
    .filter(service => service.name.length > 0);
};

const syncAvailabilities = async (
  companyId: number,
  companyService: CompanyService,
  availabilities: any[],
  allowedProfessionalIds: Set<number>,
  transaction: any
) => {
  const existingAvailabilities = await CompanyServiceAvailability.findAll({
    where: {
      companyId,
      companyServiceId: companyService.id
    },
    transaction
  });

  const existingById = new Map(
    existingAvailabilities.map(availability => [availability.id, availability])
  );

  const keepIds: number[] = [];

  for (const availability of availabilities) {
    const professionalId =
      availability.professionalId && allowedProfessionalIds.has(Number(availability.professionalId))
        ? Number(availability.professionalId)
        : null;

    if (availability.id && existingById.has(availability.id)) {
      const current = existingById.get(availability.id);
      await current.update({
        professionalId,
        weekday: availability.weekday,
        startTime: availability.startTime,
        endTime: availability.endTime,
        capacity: availability.capacity,
        isActive: availability.isActive
      }, { transaction });
      keepIds.push(current.id);
      continue;
    }

    const created = await CompanyServiceAvailability.create({
      companyId,
      companyServiceId: companyService.id,
      professionalId,
      weekday: availability.weekday,
      startTime: availability.startTime,
      endTime: availability.endTime,
      capacity: availability.capacity,
      isActive: availability.isActive
    }, { transaction });
    keepIds.push(created.id);
  }

  if (keepIds.length > 0) {
    await CompanyServiceAvailability.destroy({
      where: {
        companyId,
        companyServiceId: companyService.id,
        id: {
          [Op.notIn]: keepIds
        }
      },
      transaction
    });
  } else {
    await CompanyServiceAvailability.destroy({
      where: {
        companyId,
        companyServiceId: companyService.id
      },
      transaction
    });
  }
};

const syncProfessionals = async (
  companyId: number,
  companyService: CompanyService,
  professionals: any[],
  transaction: any
): Promise<Set<number>> => {
  const existingBindings = await CompanyServiceProfessional.findAll({
    where: {
      companyId,
      companyServiceId: companyService.id
    },
    transaction
  });

  const existingByUserId = new Map(
    existingBindings.map(binding => [Number(binding.userId), binding])
  );

  const requestedUserIds = Array.from(
    new Set(
      (professionals || [])
        .map(professional => Number(professional.userId || 0))
        .filter(userId => Number.isInteger(userId) && userId > 0)
    )
  );

  const validUsers = await User.findAll({
    where: {
      companyId,
      id: {
        [Op.in]: requestedUserIds.length ? requestedUserIds : [0]
      }
    },
    attributes: ["id"],
    transaction,
    raw: true
  });
  const validUserIds = new Set(validUsers.map((user: any) => Number(user.id)));

  const keepUserIds = new Set<number>();
  for (const professional of professionals || []) {
    const userId = Number(professional.userId || 0);
    if (!validUserIds.has(userId)) {
      continue;
    }

    if (existingByUserId.has(userId)) {
      const current = existingByUserId.get(userId);
      await current.update(
        {
          priority: professional.priority,
          isActive: professional.isActive !== false
        },
        { transaction }
      );
    } else {
      await CompanyServiceProfessional.create(
        {
          companyId,
          companyServiceId: companyService.id,
          userId,
          priority: professional.priority,
          isActive: professional.isActive !== false
        },
        { transaction }
      );
    }

    keepUserIds.add(userId);
  }

  if (keepUserIds.size > 0) {
    await CompanyServiceProfessional.destroy({
      where: {
        companyId,
        companyServiceId: companyService.id,
        userId: {
          [Op.notIn]: Array.from(keepUserIds.values())
        }
      },
      transaction
    });
  } else {
    await CompanyServiceProfessional.destroy({
      where: {
        companyId,
        companyServiceId: companyService.id
      },
      transaction
    });
  }

  return keepUserIds;
};

const syncSpecificSlots = async (
  companyId: number,
  companyService: CompanyService,
  specificSlots: any[],
  allowedProfessionalIds: Set<number>,
  transaction: any
) => {
  const existingSpecificSlots = await CompanyServiceSpecificSlot.findAll({
    where: {
      companyId,
      companyServiceId: companyService.id
    },
    transaction
  });

  const existingById = new Map(
    existingSpecificSlots.map(specificSlot => [specificSlot.id, specificSlot])
  );

  const keepIds: number[] = [];

  for (const specificSlot of specificSlots) {
    const professionalId =
      specificSlot.professionalId &&
      allowedProfessionalIds.has(Number(specificSlot.professionalId))
        ? Number(specificSlot.professionalId)
        : null;

    if (specificSlot.id && existingById.has(specificSlot.id)) {
      const current = existingById.get(specificSlot.id);
      await current.update(
        {
          professionalId,
          slotDate: specificSlot.slotDate,
          startTime: specificSlot.startTime,
          endTime: specificSlot.endTime,
          capacity: specificSlot.capacity,
          isActive: specificSlot.isActive
        },
        { transaction }
      );
      keepIds.push(current.id);
      continue;
    }

    const created = await CompanyServiceSpecificSlot.create(
      {
        companyId,
        companyServiceId: companyService.id,
        professionalId,
        slotDate: specificSlot.slotDate,
        startTime: specificSlot.startTime,
        endTime: specificSlot.endTime,
        capacity: specificSlot.capacity,
        isActive: specificSlot.isActive
      },
      { transaction }
    );
    keepIds.push(created.id);
  }

  if (keepIds.length > 0) {
    await CompanyServiceSpecificSlot.destroy({
      where: {
        companyId,
        companyServiceId: companyService.id,
        id: {
          [Op.notIn]: keepIds
        }
      },
      transaction
    });
  } else {
    await CompanyServiceSpecificSlot.destroy({
      where: {
        companyId,
        companyServiceId: companyService.id
      },
      transaction
    });
  }
};

const UpdateCompanyServicesService = async ({
  id,
  companyServices
}: Request): Promise<Company> => {
  await AssertCompanyFeatureEnabledService({
    companyId: id,
    feature: "services"
  });

  const normalizedCompanyServices = normalizeCompanyServices(companyServices);

  const result = await sequelize.transaction(async transaction => {
    const company = await Company.findByPk(id, { transaction });

    if (!company) {
      throw new AppError("ERR_NO_COMPANY_FOUND", 404);
    }

    const existingServices = await CompanyService.findAll({
      where: { companyId: company.id },
      transaction
    });
    const existingServicesById = new Map(
      existingServices.map(service => [service.id, service])
    );
    const keepIds: number[] = [];

    for (const service of normalizedCompanyServices) {
      if (service.id && existingServicesById.has(service.id)) {
        const currentService = existingServicesById.get(service.id);
        await currentService.update({
          name: service.name,
          price: service.price,
          description: service.hasDescriptionField
            ? service.description || null
            : currentService.description,
          isActive: service.hasIsActiveField ? service.isActive : currentService.isActive,
          showPrice: service.hasShowPriceField ? service.showPrice : currentService.showPrice,
          displayOrder: service.hasDisplayOrderField
            ? service.displayOrder
            : currentService.displayOrder,
          durationMinutes: service.hasDurationField
            ? service.durationMinutes
            : currentService.durationMinutes,
          intervalMinutes: service.hasIntervalField
            ? service.intervalMinutes
            : currentService.intervalMinutes,
          minAdvanceMinutes: service.hasMinAdvanceField
            ? service.minAdvanceMinutes
            : currentService.minAdvanceMinutes,
          maxAdvanceDays: service.hasMaxAdvanceField
            ? service.maxAdvanceDays
            : currentService.maxAdvanceDays,
          maxBookingsPerSlot: service.hasMaxBookingsField
            ? service.maxBookingsPerSlot
            : currentService.maxBookingsPerSlot,
          assignmentMode: service.hasAssignmentModeField
            ? service.assignmentMode
            : currentService.assignmentMode
        }, { transaction });
        keepIds.push(currentService.id);

        let assignedProfessionalIds = new Set<number>();
        if (service.hasProfessionalsField) {
          assignedProfessionalIds = await syncProfessionals(
            company.id,
            currentService,
            service.professionals,
            transaction
          );
        } else {
          const existingBindings = await CompanyServiceProfessional.findAll({
            where: {
              companyId: company.id,
              companyServiceId: currentService.id,
              isActive: true
            },
            attributes: ["userId"],
            transaction,
            raw: true
          });
          assignedProfessionalIds = new Set(
            existingBindings.map((binding: any) => Number(binding.userId))
          );
        }

        if (service.hasAvailabilitiesField) {
          await syncAvailabilities(
            company.id,
            currentService,
            service.availabilities,
            assignedProfessionalIds,
            transaction
          );
        }

        if (service.hasSpecificSlotsField) {
          await syncSpecificSlots(
            company.id,
            currentService,
            service.specificSlots,
            assignedProfessionalIds,
            transaction
          );
        }

      } else {
        const createdService = await CompanyService.create({
          companyId: company.id,
          name: service.name,
          description: service.hasDescriptionField
            ? service.description || null
            : null,
          isActive: service.isActive,
          showPrice: service.showPrice,
          displayOrder: service.displayOrder,
          price: service.price,
          durationMinutes: service.durationMinutes,
          intervalMinutes: service.intervalMinutes,
          minAdvanceMinutes: service.minAdvanceMinutes,
          maxAdvanceDays: service.maxAdvanceDays,
          maxBookingsPerSlot: service.maxBookingsPerSlot,
          assignmentMode: service.assignmentMode
        }, { transaction });
        keepIds.push(createdService.id);

        let assignedProfessionalIds = new Set<number>();
        if (service.hasProfessionalsField) {
          assignedProfessionalIds = await syncProfessionals(
            company.id,
            createdService,
            service.professionals,
            transaction
          );
        }

        if (service.hasAvailabilitiesField) {
          await syncAvailabilities(
            company.id,
            createdService,
            service.availabilities,
            assignedProfessionalIds,
            transaction
          );
        }

        if (service.hasSpecificSlotsField) {
          await syncSpecificSlots(
            company.id,
            createdService,
            service.specificSlots,
            assignedProfessionalIds,
            transaction
          );
        }

      }
    }

    if (keepIds.length > 0) {
      await CompanyService.destroy({
        where: {
          companyId: company.id,
          id: {
            [Op.notIn]: keepIds
          }
        },
        transaction
      });
    } else {
      await CompanyService.destroy({
        where: {
          companyId: company.id
        },
        transaction
      });
    }

    const updatedCompany = await Company.findByPk(company.id, {
      include: [
        {
          model: CompanyService,
          as: "companyServices",
          include: [
            { model: CompanyServiceAvailability, as: "availabilities" },
            { model: CompanyServiceSpecificSlot, as: "specificSlots" },
            {
              model: CompanyServiceProfessional,
              as: "professionals",
              include: [
                {
                  model: User,
                  as: "professional",
                  attributes: ["id", "name", "email"]
                }
              ]
            }
          ]
        }
      ],
      transaction
    });

    return updatedCompany || company;
  });

  return result;
};

export default UpdateCompanyServicesService;
