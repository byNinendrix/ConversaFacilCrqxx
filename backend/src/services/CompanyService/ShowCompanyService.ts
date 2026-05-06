import Company from "../../models/Company";
import CompanyService from "../../models/CompanyService";
import CompanyServiceAvailability from "../../models/CompanyServiceAvailability";
import CompanyServiceProfessional from "../../models/CompanyServiceProfessional";
import CompanyServiceSpecificSlot from "../../models/CompanyServiceSpecificSlot";
import User from "../../models/User";
import AppError from "../../errors/AppError";

const ShowCompanyService = async (id: string | number): Promise<Company> => {
  const company = await Company.findByPk(id, {
    include: [
      {
        model: CompanyService,
        as: "companyServices",
        attributes: [
          "id",
          "name",
          "description",
          "isActive",
          "showPrice",
          "displayOrder",
          "price",
          "durationMinutes",
          "intervalMinutes",
          "minAdvanceMinutes",
          "maxAdvanceDays",
          "maxBookingsPerSlot",
          "assignmentMode"
        ],
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
            where: { companyId: Number(id) },
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
        ]
      }
    ],
    order: [
      [{ model: CompanyService, as: "companyServices" }, "displayOrder", "ASC"],
      [{ model: CompanyService, as: "companyServices" }, "name", "ASC"]
    ]
  });

  if (!company) {
    throw new AppError("ERR_NO_COMPANY_FOUND", 404);
  }

  return company;
};

export default ShowCompanyService;
