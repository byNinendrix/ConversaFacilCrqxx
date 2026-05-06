import { Request, Response, NextFunction } from "express";
import AppError from "../errors/AppError";
import Whatsapp from "../models/Whatsapp";

const tokenAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.replace(/^Bearer\s+/i, "").trim();

    if (!token) throw new Error("Token ausente");

    const whatsapp = await Whatsapp.findOne({ where: { token } });
    if (!whatsapp) throw new Error("Token inválido");

    // ✅ NÃO destrói params; apenas adiciona
    (req as any).apiAuth = {
      whatsappId: whatsapp.id,
      companyId: whatsapp.companyId
    };

    // Opcional: se você quiser manter compatibilidade com código legado
    req.params.whatsappId = String(whatsapp.id);

    return next();
  } catch (err) {
    throw new AppError("Acesso não permitido", 401);
  }
};

export default tokenAuth;
