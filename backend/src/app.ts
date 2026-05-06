import * as Sentry from "@sentry/node";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import "express-async-errors";
import "reflect-metadata";
import "./bootstrap";

import bodyParser from 'body-parser';
import uploadConfig from "./config/upload";
import "./database";
import AppError from "./errors/AppError";
import { messageQueue, sendScheduledMessages } from "./queues";
import routes from "./routes";
import { logger } from "./utils/logger";

Sentry.init({ dsn: process.env.SENTRY_DSN });

const app = express();

app.set("queues", {
  messageQueue,
  sendScheduledMessages
});

const bodyparser = require('body-parser');
app.use(bodyParser.json({ limit: '10mb' }));

const normalizeOrigin = (origin: string): string => {
  return origin.trim().replace(/\/+$/, "");
};

const getAllowedOrigins = (): string[] => {
  const envOrigins = (process.env.FRONTEND_URL || "")
    .split(",")
    .map(origin => normalizeOrigin(origin))
    .filter(Boolean);

  const defaultLocalOrigins = [
    "http://localhost:3000",
    "http://localhost:3003",
    "http://localhost:3010",
    "http://localhost:4000",
    "http://127.0.0.1:4000"
  ];

  const defaultProductionOrigins = [
    "https://app.conversafacil.com"
  ];

  return Array.from(
    new Set([...envOrigins, ...defaultLocalOrigins, ...defaultProductionOrigins])
  );
};

const allowedOrigins = getAllowedOrigins();

const isConversaFacilOrigin = (origin: string): boolean => {
  return /^https?:\/\/([a-z0-9-]+\.)?conversafacil\.com$/i.test(origin);
};

app.use(
  cors({
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      const normalizedOrigin = normalizeOrigin(origin);

      if (
        allowedOrigins.includes(normalizedOrigin) ||
        isConversaFacilOrigin(normalizedOrigin)
      ) {
        callback(null, true);
        return;
      }

      logger.warn(`CORS origin not allowed: ${origin}`);
      callback(new Error(`CORS origin not allowed: ${origin}`));
    }
  })
);
app.use(cookieParser());
app.use(express.json());
app.use(Sentry.Handlers.requestHandler());
app.use("/public", express.static(uploadConfig.directory));
app.use(routes);

app.use(Sentry.Handlers.errorHandler());

app.use(async (err: Error, req: Request, res: Response, _: NextFunction) => {
  if (err instanceof AppError) {
    logger.warn(err);
    return res.status(err.statusCode).json({ error: err.message });
  }

  logger.error(err);
  return res.status(500).json({ error: "Internal server error" });
});

export default app;
