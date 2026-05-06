import moment from "moment";
import { Op } from "sequelize";

import AppError from "../../errors/AppError";
import CompanyService from "../../models/CompanyService";
import CompanyServiceAvailability from "../../models/CompanyServiceAvailability";
import CompanyServiceProfessional from "../../models/CompanyServiceProfessional";
import CompanyServiceSpecificSlot from "../../models/CompanyServiceSpecificSlot";
import ServiceBooking from "../../models/ServiceBooking";
import ServiceBookingSlotLock from "../../models/ServiceBookingSlotLock";
import User from "../../models/User";

const ACTIVE_BOOKING_STATUSES = ["scheduled", "confirmed", "pending_payment"];
const DEFAULT_MAX_DATE_OPTIONS = 7;
const HARD_MAX_DATE_OPTIONS = 21;
const ASSIGNMENT_MODES = ["automatic", "manual", "least_loaded"] as const;

interface SchedulingService extends CompanyService {
  availabilities: CompanyServiceAvailability[];
  specificSlots: CompanyServiceSpecificSlot[];
  professionals: Array<
    CompanyServiceProfessional & {
      professional?: User;
    }
  >;
}

interface Request {
  companyId: number;
  companyServiceId: number | string;
  fromDate?: string;
  days?: string | number;
  professionalId?: string | number;
}

type SlotOption = {
  startAtIso: string;
  endAtIso: string;
  label: string;
  capacity?: number;
  source?: "specific" | "recurring";
  availableProfessionalIds?: number[];
};

type Response = {
  service: {
    id: number;
    name: string;
    durationMinutes: number;
    intervalMinutes: number;
    minAdvanceMinutes: number;
    maxAdvanceDays: number;
    maxBookingsPerSlot: number;
    assignmentMode: string;
    professionals: Array<{
      id: number;
      name: string;
      priority: number;
      isActive: boolean;
    }>;
  };
  dateOptions: Array<{
    date: string;
    label: string;
    slots: SlotOption[];
  }>;
};

const parseTimeMinutes = (value: string): number => {
  const [hour, minute] = String(value || "00:00")
    .split(":")
    .map(Number);
  return hour * 60 + minute;
};

const formatDateLabel = (date: moment.Moment): string => {
  const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
  return `${date.format("DD/MM/YYYY")} (${weekdays[date.day()]})`;
};

const normalizeAssignmentMode = (value: any): string => {
  const mode = String(value || "")
    .trim()
    .toLowerCase();

  if (ASSIGNMENT_MODES.includes(mode as any)) {
    return mode;
  }

  return "automatic";
};

const asResourceKey = (professionalId: number | null): string =>
  professionalId ? `professional:${professionalId}` : "service";

const normalizeCapacity = (value: any, fallback: number): number => {
  const parsed = Number(String(value ?? "").trim());
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.max(1, Math.min(Math.trunc(parsed), 100));
};

const getServiceProfessionals = (
  service: SchedulingService
): Array<{ id: number; name: string; priority: number; isActive: boolean }> => {
  return (service.professionals || [])
    .filter(binding => {
      if (!binding || binding.isActive === false) {
        return false;
      }
      const professional = (binding as any).professional as User | undefined;
      if (!professional || Number(professional.companyId) !== Number(service.companyId)) {
        return false;
      }
      return true;
    })
    .map(binding => ({
      id: Number(binding.userId),
      name:
        String(((binding as any).professional?.name || "")).trim() ||
        `Profissional #${binding.userId}`,
      priority: Number(binding.priority || 0),
      isActive: binding.isActive !== false
    }))
    .sort((first, second) => {
      if (first.priority !== second.priority) {
        return first.priority - second.priority;
      }
      return first.name.localeCompare(second.name);
    });
};

const getProfessionalAvailabilities = (
  availabilities: CompanyServiceAvailability[],
  professionalId: number | null
): CompanyServiceAvailability[] => {
  const activeAvailabilities = (availabilities || []).filter(
    availability => availability.isActive !== false
  );

  if (!professionalId) {
    return activeAvailabilities.filter(
      availability => availability.professionalId === null || availability.professionalId === undefined
    );
  }

  const specific = activeAvailabilities.filter(
    availability => Number(availability.professionalId || 0) === professionalId
  );

  if (specific.length > 0) {
    return specific;
  }

  return activeAvailabilities.filter(
    availability => availability.professionalId === null || availability.professionalId === undefined
  );
};

const hasAvailabilityForSlot = ({
  availabilities,
  weekday,
  slotStartMinute,
  slotEndMinute
}: {
  availabilities: CompanyServiceAvailability[];
  weekday: number;
  slotStartMinute: number;
  slotEndMinute: number;
}): boolean => {
  return availabilities.some(availability => {
    if (Number(availability.weekday) !== weekday) {
      return false;
    }
    const start = parseTimeMinutes(availability.startTime);
    const end = parseTimeMinutes(availability.endTime);
    if (end <= start) {
      return false;
    }
    return slotStartMinute >= start && slotEndMinute <= end;
  });
};

const normalizeProfessionalFilter = (value: string | number | undefined): number | null => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }
  const parsed = Number(String(value).trim());
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
};

const mergeCandidateProfessionals = (
  current: number[] | undefined,
  next: number[]
): number[] => {
  return Array.from(new Set([...(current || []), ...next]));
};

const ListSlotsService = async ({
  companyId,
  companyServiceId,
  fromDate,
  days,
  professionalId
}: Request): Promise<Response> => {
  const service = (await CompanyService.findOne({
    where: {
      id: Number(companyServiceId),
      companyId,
      isActive: true
    },
    include: [
      {
        model: CompanyServiceAvailability,
        as: "availabilities",
        where: { isActive: true, companyId },
        required: false
      },
      {
        model: CompanyServiceSpecificSlot,
        as: "specificSlots",
        where: { isActive: true, companyId },
        required: false
      },
      {
        model: CompanyServiceProfessional,
        as: "professionals",
        where: { companyId, isActive: true },
        required: false,
        include: [
          {
            model: User,
            as: "professional",
            where: { companyId },
            required: false,
            attributes: ["id", "name", "companyId"]
          }
        ]
      }
    ]
  })) as SchedulingService | null;

  if (!service) {
    throw new AppError("ERR_SERVICE_NOT_AVAILABLE", 404);
  }

  const serviceProfessionals = getServiceProfessionals(service);
  const selectedProfessionalId = normalizeProfessionalFilter(professionalId);
  const hasProfessionals = serviceProfessionals.length > 0;
  const serviceProfessionalIds = new Set(serviceProfessionals.map(prof => Number(prof.id)));

  if (selectedProfessionalId && !hasProfessionals) {
    throw new AppError("ERR_PROFESSIONAL_NOT_AVAILABLE", 404);
  }

  if (
    selectedProfessionalId &&
    hasProfessionals &&
    !serviceProfessionals.some(prof => prof.id === selectedProfessionalId)
  ) {
    throw new AppError("ERR_PROFESSIONAL_NOT_AVAILABLE", 404);
  }

  const now = moment();
  const minAdvanceMinutes = Math.max(Number(service.minAdvanceMinutes || 0), 0);
  const minStartAt = now.clone().add(minAdvanceMinutes, "minutes");

  const parsedDays = Number(days || DEFAULT_MAX_DATE_OPTIONS);
  const maxDateOptions = Math.max(
    1,
    Math.min(
      Number.isFinite(parsedDays) ? Math.trunc(parsedDays) : DEFAULT_MAX_DATE_OPTIONS,
      HARD_MAX_DATE_OPTIONS
    )
  );

  const maxAdvanceDays = Math.max(Number(service.maxAdvanceDays || 1), 1);

  const requestedFrom = fromDate ? moment(String(fromDate).trim(), "YYYY-MM-DD", true) : null;
  const rangeStartBase =
    requestedFrom && requestedFrom.isValid()
      ? requestedFrom.startOf("day")
      : minStartAt.clone().startOf("day");

  const rangeStart = moment.max(rangeStartBase, minStartAt.clone().startOf("day"));
  const rangeEnd = now.clone().add(maxAdvanceDays, "days").endOf("day");

  const bookings = await ServiceBooking.findAll({
    where: {
      companyId,
      companyServiceId: service.id,
      status: {
        [Op.in]: ACTIVE_BOOKING_STATUSES
      },
      startAt: {
        [Op.between]: [rangeStart.toDate(), rangeEnd.toDate()]
      } as any
    },
    attributes: ["startAt", "professionalId"]
  });

  const activeLocks = await ServiceBookingSlotLock.findAll({
    where: {
      companyId,
      companyServiceId: service.id,
      startAt: {
        [Op.between]: [rangeStart.toDate(), rangeEnd.toDate()]
      } as any,
      expiresAt: {
        [Op.gt]: new Date()
      }
    },
    attributes: ["startAt", "professionalId", "resourceKey"],
    raw: true
  });

  const bookedByStartAt = new Map<string, number>();
  const occupiedByResourceAndStart = new Set<string>();

  bookings.forEach(booking => {
    const startIso = moment(booking.startAt).toISOString();
    const bookingProfessionalId =
      booking.professionalId !== null && booking.professionalId !== undefined
        ? Number(booking.professionalId)
        : null;
    const resourceKey = asResourceKey(bookingProfessionalId);

    bookedByStartAt.set(startIso, (bookedByStartAt.get(startIso) || 0) + 1);
    occupiedByResourceAndStart.add(`${resourceKey}:${startIso}`);
  });

  activeLocks.forEach((lock: any) => {
    const startIso = moment(lock.startAt).toISOString();
    const lockResourceKey =
      String(lock.resourceKey || "").trim() ||
      asResourceKey(lock.professionalId ? Number(lock.professionalId) : null);
    occupiedByResourceAndStart.add(`${lockResourceKey}:${startIso}`);
  });

  const durationMinutes = Math.max(Number(service.durationMinutes || 30), 5);
  const intervalMinutes = Math.max(Number(service.intervalMinutes || 0), 0);
  const slotStep = durationMinutes + intervalMinutes;
  const defaultCapacity = normalizeCapacity(service.maxBookingsPerSlot || 1, 1);

  const activeAvailabilities = (service.availabilities || []).filter(availability => {
    const start = parseTimeMinutes(availability.startTime);
    const end = parseTimeMinutes(availability.endTime);
    return availability.isActive !== false && end > start;
  });

  const activeSpecificSlots = (service.specificSlots || []).filter(
    specificSlot =>
      specificSlot.isActive !== false &&
      /^\d{4}-\d{2}-\d{2}$/.test(String(specificSlot.slotDate || "")) &&
      /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(specificSlot.startTime || ""))
  );

  const dateOptions: Response["dateOptions"] = [];
  const cursor = rangeStart.clone();

  while (cursor.isSameOrBefore(rangeEnd, "day") && dateOptions.length < maxDateOptions) {
    const weekday = cursor.day();
    const slotDate = cursor.format("YYYY-MM-DD");
    const slotMap = new Map<string, SlotOption>();

    const daySpecificSlots = activeSpecificSlots
      .filter(specificSlot => String(specificSlot.slotDate) === slotDate)
      .sort((first, second) => String(first.startTime).localeCompare(String(second.startTime)));

    for (const specificSlot of daySpecificSlots) {
      const slotStart = moment(
        `${slotDate} ${specificSlot.startTime}`,
        "YYYY-MM-DD HH:mm",
        true
      );
      if (!slotStart.isValid() || slotStart.isBefore(minStartAt)) {
        continue;
      }

      const slotEnd =
        specificSlot.endTime &&
        /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(specificSlot.endTime || ""))
          ? moment(`${slotDate} ${specificSlot.endTime}`, "YYYY-MM-DD HH:mm", true)
          : slotStart.clone().add(durationMinutes, "minutes");

      if (!slotEnd.isValid() || !slotEnd.isAfter(slotStart)) {
        continue;
      }

      const slotStartMinute = slotStart.hours() * 60 + slotStart.minutes();
      const slotEndMinute = slotEnd.hours() * 60 + slotEnd.minutes();

      const startIso = slotStart.toISOString();
      const endIso = slotEnd.toISOString();
      const capacity = normalizeCapacity(specificSlot.capacity, defaultCapacity);
      const used = bookedByStartAt.get(startIso) || 0;

      if (used >= capacity) {
        continue;
      }

      if (!hasProfessionals) {
        if (occupiedByResourceAndStart.has(`${asResourceKey(null)}:${startIso}`)) {
          continue;
        }

        const existing = slotMap.get(startIso);
        slotMap.set(startIso, {
          startAtIso: startIso,
          endAtIso: endIso,
          label: slotStart.format("HH:mm"),
          capacity: Math.max(existing?.capacity || 0, capacity),
          source: "specific"
        });
        continue;
      }

      const specificProfessionalId = specificSlot.professionalId
        ? Number(specificSlot.professionalId)
        : null;

      if (specificProfessionalId && !serviceProfessionalIds.has(specificProfessionalId)) {
        continue;
      }

      if (
        selectedProfessionalId &&
        specificProfessionalId &&
        selectedProfessionalId !== specificProfessionalId
      ) {
        continue;
      }

      const professionalCandidates = specificProfessionalId
        ? [specificProfessionalId]
        : selectedProfessionalId
          ? [selectedProfessionalId]
          : serviceProfessionals.map(prof => prof.id);

      const availableProfessionalIds = professionalCandidates.filter(candidateId => {
        return !occupiedByResourceAndStart.has(
          `${asResourceKey(candidateId)}:${startIso}`
        );
      });

      if (!availableProfessionalIds.length) {
        continue;
      }

      const existing = slotMap.get(startIso);
      slotMap.set(startIso, {
        startAtIso: startIso,
        endAtIso: endIso,
        label: slotStart.format("HH:mm"),
        source: "specific",
        capacity: Math.max(existing?.capacity || 0, capacity),
        availableProfessionalIds: mergeCandidateProfessionals(
          existing?.availableProfessionalIds,
          availableProfessionalIds
        )
      });
    }

    const dayAvailabilities = activeAvailabilities.filter(
      availability => Number(availability.weekday) === weekday
    );

    for (const availability of dayAvailabilities) {
      const startMinutes = parseTimeMinutes(availability.startTime);
      const endMinutes = parseTimeMinutes(availability.endTime);
      const capacity = normalizeCapacity(availability.capacity, defaultCapacity);

      for (
        let minuteCursor = startMinutes;
        minuteCursor + durationMinutes <= endMinutes;
        minuteCursor += slotStep
      ) {
        const slotStart = cursor.clone().startOf("day").add(minuteCursor, "minutes");
        if (slotStart.isBefore(minStartAt)) {
          continue;
        }

        const slotEnd = slotStart.clone().add(durationMinutes, "minutes");
        const slotStartMinute = slotStart.hours() * 60 + slotStart.minutes();
        const slotEndMinute = slotEnd.hours() * 60 + slotEnd.minutes();

        const startIso = slotStart.toISOString();
        if (slotMap.has(startIso)) {
          continue;
        }

        const used = bookedByStartAt.get(startIso) || 0;
        if (used >= capacity) {
          continue;
        }

        if (!hasProfessionals) {
          if (availability.professionalId) {
            continue;
          }

          if (occupiedByResourceAndStart.has(`${asResourceKey(null)}:${startIso}`)) {
            continue;
          }

          slotMap.set(startIso, {
            startAtIso: startIso,
            endAtIso: slotEnd.toISOString(),
            label: slotStart.format("HH:mm"),
            source: "recurring",
            capacity
          });
          continue;
        }

        const availabilityProfessionalId = availability.professionalId
          ? Number(availability.professionalId)
          : null;

        if (
          availabilityProfessionalId &&
          !serviceProfessionalIds.has(availabilityProfessionalId)
        ) {
          continue;
        }

        if (
          selectedProfessionalId &&
          availabilityProfessionalId &&
          selectedProfessionalId !== availabilityProfessionalId
        ) {
          continue;
        }

        const professionalCandidates = availabilityProfessionalId
          ? [availabilityProfessionalId]
          : selectedProfessionalId
            ? [selectedProfessionalId]
            : serviceProfessionals.map(prof => prof.id);

        const availableProfessionalIds = professionalCandidates.filter(candidateId => {
          const candidateAvailabilities = getProfessionalAvailabilities(
            activeAvailabilities,
            candidateId
          );

          const candidateIsAvailable = hasAvailabilityForSlot({
            availabilities: candidateAvailabilities,
            weekday,
            slotStartMinute,
            slotEndMinute
          });

          if (!candidateIsAvailable) {
            return false;
          }

          return !occupiedByResourceAndStart.has(
            `${asResourceKey(candidateId)}:${startIso}`
          );
        });

        if (!availableProfessionalIds.length) {
          continue;
        }

        slotMap.set(startIso, {
          startAtIso: startIso,
          endAtIso: slotEnd.toISOString(),
          label: slotStart.format("HH:mm"),
          source: "recurring",
          capacity,
          availableProfessionalIds: Array.from(new Set(availableProfessionalIds))
        });
      }
    }

    const slots = Array.from(slotMap.values()).sort((first, second) =>
      first.startAtIso.localeCompare(second.startAtIso)
    );

    if (slots.length > 0) {
      dateOptions.push({
        date: slotDate,
        label: formatDateLabel(cursor),
        slots
      });
    }

    cursor.add(1, "day");
  }

  return {
    service: {
      id: service.id,
      name: service.name,
      durationMinutes: Number(service.durationMinutes || 30),
      intervalMinutes: Number(service.intervalMinutes || 0),
      minAdvanceMinutes: Number(service.minAdvanceMinutes || 0),
      maxAdvanceDays: Number(service.maxAdvanceDays || 1),
      maxBookingsPerSlot: Number(service.maxBookingsPerSlot || 1),
      assignmentMode: normalizeAssignmentMode(service.assignmentMode),
      professionals: serviceProfessionals
    },
    dateOptions
  };
};

export default ListSlotsService;
