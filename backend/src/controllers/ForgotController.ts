import { v4 as uuid } from "uuid";
import { Request, Response } from "express";
import SendMail from "../services/ForgotPassWordServices/SendMail";
import ResetPassword from "../services/ResetPasswordService/ResetPassword";
type IndexQuery = { email?: string; token?: string; password?: string };
export const store = async (req: Request, res: Response): Promise<Response> => {
  const email = (req.body?.email || (req.params as IndexQuery).email || "").trim();
  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }
  const TokenSenha = uuid();
  await SendMail(email, TokenSenha);
  return res.status(200).json({ message: "Se o e-mail existir, enviaremos as instruções de recuperação." });
};
export const resetPasswords = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const params = req.params as IndexQuery;
  const email = (req.body?.email || params.email || "").trim();
  const token = (req.body?.token || params.token || "").trim();
  const password = (req.body?.password || params.password || "").trim();
  if (!email || !token || !password) {
    return res.status(400).json({ error: "Email, token and password are required" });
  }
  const resetPassword = await ResetPassword(email, token, password);
  if (!resetPassword) {
    return res.status(200).json({ message: "Senha redefinida com sucesso" });
  }
  return res.status(404).json({ error: "Verifique o Token informado" });
};
