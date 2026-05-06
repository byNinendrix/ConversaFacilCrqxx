import { Request, Response } from "express";
import { Op } from "sequelize";
import { getIO } from "../libs/socket";
import Ticket from "../models/Ticket";
import AppError from "../errors/AppError";
import { logger } from "../utils/logger";

import CreateTicketService from "../services/TicketServices/CreateTicketService";
import DeleteTicketService from "../services/TicketServices/DeleteTicketService";
import ListTicketsService from "../services/TicketServices/ListTicketsService";
import ShowTicketUUIDService from "../services/TicketServices/ShowTicketFromUUIDService";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import UpdateTicketService from "../services/TicketServices/UpdateTicketService";
import ListTicketsServiceKanban from "../services/TicketServices/ListTicketsServiceKanban";

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
  status: string;
  date: string;
  updatedAt?: string;
  sortOrder?: string;
  showAll: string;
  withUnreadMessages: string;
  queueIds: string;
  whatsappIds?: string;
  tags: string;
  users: string;
};

interface TicketData {
  contactId: number;
  status: string;
  queueId: number;
  userId: number;
  whatsappId: string;
  useIntegration: boolean;
  promptId: number;
  integrationId: number;
}

export const index = async (req: Request, res: Response): Promise<Response> => {
  const {
    pageNumber,
    status,
    date,
    updatedAt,
    sortOrder,
    searchParam,
    showAll,
    queueIds: queueIdsStringified,
    whatsappIds: whatsappIdsStringified,
    tags: tagIdsStringified,
    users: userIdsStringified,
    withUnreadMessages
  } = req.query as IndexQuery;

  const userId = req.user.id;
  const { companyId } = req.user;

  let queueIds: number[] = [];
  let whatsappIds: number[] = [];
  let tagsIds: number[] = [];
  let usersIds: number[] = [];

  if (queueIdsStringified) {
    queueIds = JSON.parse(queueIdsStringified);
  }
  if (whatsappIdsStringified) {
    whatsappIds = JSON.parse(whatsappIdsStringified);
  }

  if (tagIdsStringified) {
    tagsIds = JSON.parse(tagIdsStringified);
  }

  if (userIdsStringified) {
    usersIds = JSON.parse(userIdsStringified);
  }

  const { tickets, count, hasMore } = await ListTicketsService({
    searchParam,
    tags: tagsIds,
    users: usersIds,
    pageNumber,
    status,
    date,
    updatedAt,
    sortOrder,
    showAll,
    userId,
    queueIds,
    whatsappIds,
    withUnreadMessages,
    companyId,


  });
  return res.status(200).json({ tickets, count, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { contactId, status, userId, queueId, whatsappId }: TicketData = req.body;
  const { companyId } = req.user;

  const ticket = await CreateTicketService({
    contactId,
    status,
    userId,
    companyId,
    queueId,
    whatsappId
  });

  const io = getIO();
  io.to(ticket.status).emit(`company-${companyId}-ticket`, {
    action: "update",
    ticket
  });
  return res.status(200).json(ticket);
};

export const kanban = async (req: Request, res: Response): Promise<Response> => {
  const {
    pageNumber,
    status,
    date,
    updatedAt,
    searchParam,
    showAll,
    queueIds: queueIdsStringified,
    whatsappIds: whatsappIdsStringified,
    tags: tagIdsStringified,
    users: userIdsStringified,
    withUnreadMessages
  } = req.query as IndexQuery;


  const userId = req.user.id;
  const { companyId } = req.user;

  let queueIds: number[] = [];
  let whatsappIds: number[] = [];
  let tagsIds: number[] = [];
  let usersIds: number[] = [];

  if (queueIdsStringified) {
    queueIds = JSON.parse(queueIdsStringified);
  }
  if (whatsappIdsStringified) {
    whatsappIds = JSON.parse(whatsappIdsStringified);
  }

  if (tagIdsStringified) {
    tagsIds = JSON.parse(tagIdsStringified);
  }

  if (userIdsStringified) {
    usersIds = JSON.parse(userIdsStringified);
  }

  const { tickets, count, hasMore } = await ListTicketsServiceKanban({
    searchParam,
    tags: tagsIds,
    users: usersIds,
    pageNumber,
    status,
    date,
    updatedAt,
    showAll,
    userId,
    queueIds,
    whatsappIds,
    withUnreadMessages,
    companyId

  });

  return res.status(200).json({ tickets, count, hasMore });
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { companyId } = req.user;

  const contact = await ShowTicketService(ticketId, companyId);
  return res.status(200).json(contact);
};

export const showFromUUID = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { uuid } = req.params;

  const ticket: Ticket = await ShowTicketUUIDService(uuid);

  return res.status(200).json(ticket);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const ticketData: TicketData = req.body;
  const { companyId } = req.user;

  const { ticket } = await UpdateTicketService({
    ticketData,
    ticketId,
    companyId
  });


  return res.status(200).json(ticket);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const { companyId } = req.user;

  await ShowTicketService(ticketId, companyId);

  const ticket = await DeleteTicketService(ticketId);

  const io = getIO();
  io.to(ticketId)
    .to(`company-${companyId}-${ticket.status}`)
    .to(`company-${companyId}-notification`)
    .to(`queue-${ticket.queueId}-${ticket.status}`)
    .to(`queue-${ticket.queueId}-notification`)
    .emit(`company-${companyId}-ticket`, {
      action: "delete",
      ticketId: +ticketId
    });

  return res.status(200).json({ message: "ticket deleted" });
};

export const closeAll = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const profile = String(req.user?.profile || "").toLowerCase();
  if (profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const {
    queueId,
    whatsappId,
    scope,
    withoutQueueAndWhatsapp,
    statuses,
    status,
    selectedQueueIds
  } = req.body as {
    queueId?: number | string;
    whatsappId?: number | string;
    scope?: string;
    withoutQueueAndWhatsapp?: boolean;
    statuses?: string[];
    status?: string;
    selectedQueueIds?: Array<number | string>;
  };

  let parsedQueueId = queueId != null && `${queueId}` !== "" ? Number(queueId) : null;
  const parsedWhatsappId = whatsappId != null && `${whatsappId}` !== "" ? Number(whatsappId) : null;

  if (!parsedQueueId && !parsedWhatsappId && Array.isArray(selectedQueueIds) && selectedQueueIds.length === 1) {
    parsedQueueId = Number(selectedQueueIds[0]);
  }

  const shouldCloseWithoutQueueAndWhatsapp =
    Boolean(withoutQueueAndWhatsapp) || String(scope || "").toLowerCase() === "unassigned";

  if (shouldCloseWithoutQueueAndWhatsapp && (parsedQueueId || parsedWhatsappId)) {
    throw new AppError("Informe apenas um filtro: sem fila e sem conexao OU fila/conexao.", 400);
  }

  if (
    !shouldCloseWithoutQueueAndWhatsapp &&
    ((!parsedQueueId && !parsedWhatsappId) || (parsedQueueId && parsedWhatsappId))
  ) {
    throw new AppError("Informe apenas um filtro: fila OU conexao.", 400);
  }

  const allowedStatuses = ["open", "pending"];
  const statusListRaw =
    Array.isArray(statuses) && statuses.length > 0
      ? statuses
      : status
        ? [status]
        : allowedStatuses;
  const statusList = statusListRaw
    .map((status) => String(status || "").toLowerCase().trim())
    .filter((status) => allowedStatuses.includes(status));

  if (!statusList.length) {
    throw new AppError("Nenhum status valido para fechamento em massa.", 400);
  }

  const where: any = {
    companyId,
    status: {
      [Op.in]: statusList
    }
  };

  if (parsedQueueId) {
    where.queueId = parsedQueueId;
  }

  if (parsedWhatsappId) {
    where.whatsappId = parsedWhatsappId;
  }

  if (shouldCloseWithoutQueueAndWhatsapp) {
    where.queueId = { [Op.is]: null };
    where.whatsappId = { [Op.is]: null };
  }

  const io = getIO();

  const { rows: tickets } = await Ticket.findAndCountAll({
    where,
    order: [["updatedAt", "DESC"]]
  });

  let closedCount = 0;
  let failedCount = 0;

  for (const ticket of tickets) {
    try {
      const oldStatus = ticket.status;
      await ticket.update({
        status: "closed",
        useIntegration: false,
        promptId: null,
        integrationId: null,
        unreadMessages: 0
      });

      let deleteEmit = io.to(`${ticket.id}`)
        .to(`company-${companyId}-${oldStatus}`)
        .to(`company-${companyId}-notification`);

      if (ticket.queueId != null) {
        deleteEmit = deleteEmit
          .to(`queue-${ticket.queueId}-${oldStatus}`)
          .to(`queue-${ticket.queueId}-notification`);
      }

      deleteEmit.emit(`company-${companyId}-ticket`, {
        action: "delete",
        ticketId: ticket.id
      });

      let updateEmit = io.to(`company-${companyId}-closed`);
      if (ticket.queueId != null) {
        updateEmit = updateEmit.to(`queue-${ticket.queueId}-closed`);
      }

      updateEmit.emit(`company-${companyId}-ticket`, {
        action: "update",
        ticket
      });

      closedCount += 1;
    } catch (error) {
      failedCount += 1;
      logger.error(error);
    }
  }

  return res.status(200).json({
    closedCount,
    failedCount,
    queueId: parsedQueueId,
    whatsappId: parsedWhatsappId,
    withoutQueueAndWhatsapp: shouldCloseWithoutQueueAndWhatsapp
  });
};

