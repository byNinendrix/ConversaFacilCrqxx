import { Op, Sequelize } from "sequelize";
import Contact from "../../models/Contact";
import CompanyService from "../../models/CompanyService";
import ServiceBooking from "../../models/ServiceBooking";
import Ticket from "../../models/Ticket";
import User from "../../models/User";
import Whatsapp from "../../models/Whatsapp";

interface Request {
  companyId: number;
  pageNumber?: string | number;
  status?: string;
  paymentStatus?: string;
  searchParam?: string;
  companyServiceId?: string | number;
  professionalId?: string | number;
  contactId?: string | number;
  whatsappId?: string | number;
  startDate?: string;
  endDate?: string;
}

interface Response {
  bookings: ServiceBooking[];
  count: number;
  hasMore: boolean;
}

const ListService = async ({
  companyId,
  pageNumber = "1",
  status,
  paymentStatus,
  searchParam,
  companyServiceId,
  professionalId,
  contactId,
  whatsappId,
  startDate,
  endDate
}: Request): Promise<Response> => {
  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  const whereCondition: any = { companyId };

  if (status && String(status).trim() !== "" && String(status) !== "all") {
    whereCondition.status = String(status).trim();
  }

  if (
    paymentStatus &&
    String(paymentStatus).trim() !== "" &&
    String(paymentStatus) !== "all"
  ) {
    whereCondition.paymentStatus = String(paymentStatus).trim();
  }

  if (companyServiceId) {
    whereCondition.companyServiceId = Number(companyServiceId);
  }

  if (professionalId) {
    whereCondition.professionalId = Number(professionalId);
  }

  if (contactId) {
    whereCondition.contactId = Number(contactId);
  }

  if (whatsappId) {
    whereCondition.whatsappId = Number(whatsappId);
  }

  if (startDate || endDate) {
    const start = startDate
      ? new Date(`${String(startDate).trim()}T00:00:00.000Z`)
      : null;
    const end = endDate
      ? new Date(`${String(endDate).trim()}T23:59:59.999Z`)
      : null;

    if (start && end) {
      whereCondition.startAt = { [Op.between]: [start, end] };
    } else if (start) {
      whereCondition.startAt = { [Op.gte]: start };
    } else if (end) {
      whereCondition.startAt = { [Op.lte]: end };
    }
  }

  if (searchParam && String(searchParam).trim() !== "") {
    const search = String(searchParam).trim().toLowerCase();
    whereCondition[Op.or] = [
      Sequelize.where(
        Sequelize.fn("LOWER", Sequelize.col("ServiceBooking.customerNameSnapshot")),
        "LIKE",
        `%${search}%`
      ),
      Sequelize.where(
        Sequelize.fn("LOWER", Sequelize.col("ServiceBooking.customerNumberSnapshot")),
        "LIKE",
        `%${search}%`
      )
    ];
  }

  const { count, rows: bookings } = await ServiceBooking.findAndCountAll({
    where: whereCondition,
    limit,
    offset,
    order: [["startAt", "ASC"]],
    attributes: [
      "id",
      "companyId",
      "whatsappId",
      "contactId",
      "ticketId",
      "companyServiceId",
      "professionalId",
      "startAt",
      "endAt",
      "status",
      "paymentStatus",
      "depositAmount",
      "paymentDueAt",
      "paidAt",
      "paymentReference",
      "pixTxId",
      "pixExpiresAt",
      "pixProvider",
      "pixLocationId",
      "pixQrCode",
      "source",
      "contextJson",
      "customerNameSnapshot",
      "customerNumberSnapshot",
      "confirmedAt",
      "cancelledAt",
      "createdAt",
      "updatedAt"
    ],
    include: [
      {
        model: CompanyService,
        as: "companyService",
        attributes: ["id", "name", "price", "showPrice"]
      },
      {
        model: Contact,
        as: "contact",
        attributes: ["id", "name", "number"]
      },
      {
        model: Ticket,
        as: "ticket",
        attributes: ["id", "status"]
      },
      {
        model: User,
        as: "professional",
        attributes: ["id", "name", "email"],
        where: { companyId },
        required: false
      },
      {
        model: Whatsapp,
        as: "whatsapp",
        attributes: ["id", "name", "number"]
      }
    ]
  });

  const hasMore = count > offset + bookings.length;

  return { bookings, count, hasMore };
};

export default ListService;
