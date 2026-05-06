import { Request, Response } from 'express';
import { QueryTypes } from 'sequelize';

import sequelize from '../database';
import AppError from "../errors/AppError";

type RequestQueryProps = {
  initialDate: string;
  finalDate: string;
};

const normalizePeriod = ({ initialDate, finalDate }: RequestQueryProps) => {
  const from = new Date(`${initialDate}T00:00:00`);
  const to = new Date(`${finalDate}T23:59:59`);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new AppError("Invalid period", 400);
  }

  return { from, to };
};

export const appointmentsAtendent = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  const { companyId } = req.user;
  const { initialDate, finalDate } = req.query as RequestQueryProps;
  const { from, to } = normalizePeriod({ initialDate, finalDate });

  const resultAppointmentsByAttendents = await sequelize.query(
    `
      SELECT 
         u."name" as user_name
        ,COUNT(t.*) as total_tickets
      FROM "Users" u 
      LEFT JOIN "TicketTraking" tt ON tt."userId" = u.id 
      LEFT JOIN "Tickets" t ON t.id = tt."ticketId" AND t."createdAt" BETWEEN :fromDate AND :toDate
      where u."companyId" = :companyId
      GROUP BY u."name"
      ORDER BY total_tickets ASC
    `,
    { type: QueryTypes.SELECT, replacements: { fromDate: from, toDate: to, companyId } },
  );

  const resultTicketsByQueues = await sequelize.query(
    `
      SELECT 
        q."name"
        ,COUNT(DISTINCT t.id) as total_tickets 
      FROM "Queues" q 
      LEFT JOIN "Messages" m ON m."queueId" = q.id 
      LEFt JOIN "Tickets" t ON t.id = m."ticketId"  AND t."createdAt" BETWEEN :fromDate AND :toDate
      WHERE q."companyId" = :companyId
      GROUP BY q."name" 
      ORDER BY total_tickets ASC
    `,
    { type: QueryTypes.SELECT, replacements: { fromDate: from, toDate: to, companyId } },
  );

  return res.json({
    appointmentsByAttendents: resultAppointmentsByAttendents,
    ticketsByQueues: resultTicketsByQueues,
  });
};

export const rushHour = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  const { companyId } = req.user;
  const { initialDate, finalDate } = req.query as RequestQueryProps;
  const { from, to } = normalizePeriod({ initialDate, finalDate });

  const resultAppointmentsByHours = await sequelize.query(
    `
      SELECT
        extract (hour from m."createdAt") AS message_hour,
        COUNT(m.id) AS message_count
      FROM "Messages" m
      LEFT JOIN "Tickets" t ON t.id = m."ticketId"
      WHERE t."companyId" = :companyId
        AND m."createdAt" BETWEEN :fromDate AND :toDate
      GROUP BY
        extract (hour from m."createdAt")
      ORDER BY
        extract (hour from m."createdAt")
    `,
    { type: QueryTypes.SELECT, replacements: { fromDate: from, toDate: to, companyId } },
  );

  return res.json(resultAppointmentsByHours);
};

export const departamentRatings = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  const { companyId } = req.user;
  const { initialDate, finalDate } = req.query as RequestQueryProps;
  const { from, to } = normalizePeriod({ initialDate, finalDate });

  const resultDepartamentRating = await sequelize.query(
    `
      SELECT
        m."ticketId"
        ,q."name"
        ,round(avg(ur.rate), 2) AS total_rate
      FROM "Messages" m
      LEFT JOIN "Tickets" t ON t.id = m."ticketId"
      LEFT JOIN "UserRatings" ur ON ur."ticketId" = t.id
      LEFT JOIN "Queues" q ON q.id = m."queueId"
      WHERE m."queueId" IS NOT NULL
        AND m."companyId" = :companyId
        AND ur."createdAt" BETWEEN :fromDate AND :toDate
      GROUP BY m."ticketId", q."name"
    `,
    { type: QueryTypes.SELECT, replacements: { fromDate: from, toDate: to, companyId } },
  );

  return res.json(resultDepartamentRating);
};
