import { Request, Response } from "express";
import AppError from "../errors/AppError";
import DashboardDataService, { DashboardData, Params } from "../services/ReportService/DashbardDataService";
import { TicketsAttendance } from "../services/ReportService/TicketsAttendance";
import { TicketsDayService } from "../services/ReportService/TicketsDayService";

type IndexQuery = {
  initialDate: string;
  finalDate: string;
  companyId?: number;
};

const assertValidDateRange = (initialDate: string, finalDate: string) => {
  const from = new Date(`${initialDate}T00:00:00`);
  const to = new Date(`${finalDate}T23:59:59`);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new AppError("Invalid date range", 400);
  }
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const params: Params = req.query;
  const { companyId } = req.user;
  let daysInterval = 3;

  const dashboardData: DashboardData = await DashboardDataService(
    companyId,
    params
  );
  return res.status(200).json(dashboardData);
};

export const reportsUsers = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { initialDate, finalDate } = req.query as unknown as IndexQuery;
  assertValidDateRange(initialDate, finalDate);

  const { data } = await TicketsAttendance({ initialDate, finalDate, companyId });

  return res.json({ data });

}

export const reportsDay = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { initialDate, finalDate } = req.query as unknown as IndexQuery;
  assertValidDateRange(initialDate, finalDate);

  const { count, data } = await TicketsDayService({ initialDate, finalDate, companyId });

  return res.json({ count, data });

}
