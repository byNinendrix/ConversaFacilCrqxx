import express from "express";
import * as ForgotController from "../controllers/ForgotController";
const forgotsRoutes = express.Router();
forgotsRoutes.post("/forgetpassword", ForgotController.store);
forgotsRoutes.post("/forgetpassword/:email", ForgotController.store);
forgotsRoutes.post("/resetpasswords", ForgotController.resetPasswords);
forgotsRoutes.post(
  "/resetpasswords/:email/:token/:password",
  ForgotController.resetPasswords
);
export default forgotsRoutes;
