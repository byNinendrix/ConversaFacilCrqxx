import { Request, Response } from "express";
import GetVersionInfoService from "../services/VersionServices/GetVersionInfoService";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const versionInfo = await GetVersionInfoService();
  return res.status(200).json(versionInfo);
};
