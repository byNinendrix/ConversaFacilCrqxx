import { QueryTypes } from "sequelize";
import database from "../../database";
import { hash } from "bcryptjs";
const ResetPassword = async (
  email: string,
  token: string,
  password: string
) => {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedToken = token.trim();
  const { hasResult, data } = await filterUser(normalizedEmail);
  if (!hasResult) {
    return { status: 404, message: "Email não encontrado" };
  }
  if (hasResult === true) {
    try {
      const convertPassword: string = await hash(password, 8);
      const { datas } = await insertHasPassword(
        normalizedEmail,
        normalizedToken,
        convertPassword
      );
      if (datas.length === 0) {
        return { status: 404, message: "Token não encontrado" };
      }
    } catch (err) {
      console.log(err);
    }
  }
};
export default ResetPassword;
const filterUser = async (email: string) => {
  const sql = `SELECT * FROM "Users" WHERE email = :email AND "resetPassword" != ''`;
  const result = await database.query(sql, {
    type: QueryTypes.SELECT,
    replacements: { email }
  });
  return { hasResult: result.length > 0, data: result };
};
const insertHasPassword = async (
  email: string,
  token: string,
  convertPassword: string
) => {
  const sqlValida = `SELECT * FROM "Users" WHERE email = :email AND "resetPassword" = :token`;
  const resultado = await database.query(sqlValida, {
    type: QueryTypes.SELECT,
    replacements: { email, token }
  });
  const sqls = `UPDATE "Users" SET "passwordHash" = :convertPassword, "resetPassword" = '' WHERE email = :email AND "resetPassword" = :token`;
  const results = await database.query(sqls, {
    type: QueryTypes.UPDATE,
    replacements: { email, token, convertPassword }
  });
  return { hasResults: results.length > 0, datas: resultado };
};
