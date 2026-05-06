import * as Sentry from "@sentry/node";
import makeWASocket, {
  WASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  isJidBroadcast,
  jidNormalizedUser
} from "@whiskeysockets/baileys";
import { Op } from "sequelize";
import { FindOptions } from "sequelize/types";
import Whatsapp from "../models/Whatsapp";
import { logger } from "../utils/logger";
import MAIN_LOGGER from "@whiskeysockets/baileys/lib/Utils/logger";
import authState from "../helpers/authState";
import { Boom } from "@hapi/boom";
import AppError from "../errors/AppError";
import { getIO } from "./socket";
import { Store } from "./store";
import { StartWhatsAppSession } from "../services/WbotServices/StartWhatsAppSession";
import DeleteBaileysService from "../services/BaileysServices/DeleteBaileysService";
import NodeCache from "node-cache";
import Contact from "../models/Contact";
import Ticket from "../models/Ticket";

const loggerBaileys = MAIN_LOGGER.child({});
loggerBaileys.level = "error";

type Session = WASocket & {
  id?: number;
  store?: Store;
};

const sessions: Session[] = [];
const retriesQrCodeMap = new Map<number, number>();

export const getWbot = (whatsappId: number): Session => {
  const sessionIndex = sessions.findIndex(s => s.id === whatsappId);

  if (sessionIndex === -1) {
    throw new AppError("ERR_WAPP_NOT_INITIALIZED");
  }

  return sessions[sessionIndex];
};

export const removeWbot = async (
  whatsappId: number,
  isLogout = true
): Promise<void> => {
  try {
    const sessionIndex = sessions.findIndex(s => s.id === whatsappId);

    if (sessionIndex !== -1) {
      if (isLogout) {
        sessions[sessionIndex].logout();
        sessions[sessionIndex].ws.close();
      }

      sessions.splice(sessionIndex, 1);
    }
  } catch (err) {
    logger.error(err);
  }
};

export const restartWbot = async (
  companyId: number
): Promise<void> => {
  try {
    const options: FindOptions = {
      where: {
        companyId
      },
      attributes: ["id"]
    };

    const whatsapps = await Whatsapp.findAll(options);

    whatsapps.map(async c => {
      const sessionIndex = sessions.findIndex(s => s.id === c.id);

      if (sessionIndex !== -1) {
        sessions[sessionIndex].ws.close();
      }
    });
  } catch (err) {
    logger.error(err);
  }
};

export const initWASocket = async (whatsapp: Whatsapp): Promise<Session> => {
  return new Promise(async (resolve, reject) => {
    try {
      const io = getIO();

        const whatsappUpdate = await Whatsapp.findOne({
          where: { id: whatsapp.id }
        });

        if (!whatsappUpdate) {
          reject(new AppError("ERR_NO_WAPP_FOUND", 404));
          return;
        }

        const { id, name, provider } = whatsappUpdate;

        const { version, isLatest } = await fetchLatestBaileysVersion();
        const isLegacy = provider === "stable";

        logger.info(`using WA v${version.join(".")}, isLatest: ${isLatest}`);
        logger.info(`isLegacy: ${isLegacy}`);
        logger.info(`Starting session ${name}`);

        let retriesQrCode = 0;
        let wsocket: Session = null;

        // estado de autenticação (MD)
        const { state, saveState } = await authState(whatsapp);

        const msgRetryCounterCache = new NodeCache();

        wsocket = makeWASocket({
          logger: loggerBaileys,
          printQRInTerminal: false,
          browser: [
            process.env.BROWSER_CLIENT || "SINTESE",
            process.env.BROWSER_NAME || "Chrome",
            process.env.BROWSER_VERSION || "114.0.5735.133"
          ],
          auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger)
          },
          version,
          msgRetryCounterCache,
          shouldIgnoreJid: jid => isJidBroadcast(jid)
        });

        wsocket.ev.on(
          "connection.update",
          async ({ connection, lastDisconnect, qr }) => {
            try {
            logger.info(
              `Socket ${name} Connection Update ${connection || ""} ${
                lastDisconnect || ""
              }`
            );

            const disconnectStatus = (lastDisconnect?.error as Boom)?.output
              ?.statusCode as number | undefined;

            if (connection === "close") {
              // sessão banida / token inválido
              if (disconnectStatus === 403) {
                await whatsapp.update({
                  status: "PENDING",
                  session: "",
                  number: ""
                });

                await DeleteBaileysService(whatsapp.id);
                removeWbot(id, false);

                io.to(`company-${whatsapp.companyId}-mainchannel`).emit(
                  `company-${whatsapp.companyId}-whatsappSession`,
                  {
                    action: "update",
                    session: whatsapp
                  }
                );
              }

              // tentativa de reconexão automática se não for logout explícito
              if (disconnectStatus !== DisconnectReason.loggedOut) {
                removeWbot(id, false);
                setTimeout(
                  () => StartWhatsAppSession(whatsapp, whatsapp.companyId),
                  2000
                );
              } else {
                // logout explícito
                await whatsapp.update({
                  status: "PENDING",
                  session: "",
                  number: ""
                });

                await DeleteBaileysService(whatsapp.id);

                io.to(`company-${whatsapp.companyId}-mainchannel`).emit(
                  `company-${whatsapp.companyId}-whatsappSession`,
                  {
                    action: "update",
                    session: whatsapp
                  }
                );

                removeWbot(id, false);
                setTimeout(
                  () => StartWhatsAppSession(whatsapp, whatsapp.companyId),
                  2000
                );
              }
            }

            if (connection === "open") {
              await whatsapp.update({
                status: "CONNECTED",
                qrcode: "",
                retries: 0,
                number:
                  wsocket.type === "md"
                    ? jidNormalizedUser(
                        (wsocket as WASocket).user.id
                      ).split("@")[0]
                    : "-"
              });

              io.to(`company-${whatsapp.companyId}-mainchannel`).emit(
                `company-${whatsapp.companyId}-whatsappSession`,
                {
                  action: "update",
                  session: whatsapp
                }
              );

              const sessionIndex = sessions.findIndex(
                s => s.id === whatsapp.id
              );

              if (sessionIndex === -1) {
                wsocket.id = whatsapp.id;
                sessions.push(wsocket);
              }

              resolve(wsocket);
            }

            if (qr !== undefined) {
              if (
                retriesQrCodeMap.get(id) &&
                retriesQrCodeMap.get(id) >= 3
              ) {
                await whatsapp.update({
                  status: "DISCONNECTED",
                  qrcode: ""
                });

                await DeleteBaileysService(whatsapp.id);

                io.to(
                  `company-${whatsapp.companyId}-mainchannel`
                ).emit(`company-${whatsapp.companyId}-whatsappSession`, {
                  action: "update",
                  session: whatsapp
                });

                wsocket.ev.removeAllListeners("connection.update");
                wsocket.ws.close();
                wsocket = null;
                retriesQrCodeMap.delete(id);
              } else {
                logger.info(`Session QRCode Generate ${name}`);
                retriesQrCodeMap.set(id, (retriesQrCode += 1));

                await whatsapp.update({
                  qrcode: qr,
                  status: "qrcode",
                  retries: 0,
                  number: ""
                });

                const sessionIndex = sessions.findIndex(
                  s => s.id === whatsapp.id
                );

                if (sessionIndex === -1) {
                  wsocket.id = whatsapp.id;
                  sessions.push(wsocket);
                }

                io.to(`company-${whatsapp.companyId}-mainchannel`).emit(
                  `company-${whatsapp.companyId}-whatsappSession`,
                  {
                    action: "update",
                    session: whatsapp
                  }
                );
              }
            }
            } catch (error) {
              logger.error(
                {
                  whatsappId: whatsapp.id,
                  companyId: whatsapp.companyId
                },
                "connection.update: error processing"
              );
              Sentry.captureException(error);
            }
          }
        );

        wsocket.ev.on("creds.update", saveState);

        wsocket.ev.on(
          "presence.update",
          async ({ id: remoteJid, presences }) => {
            try {
              logger.debug(
                { remoteJid, presences },
                "Received contact presence"
              );

              if (!presences[remoteJid]?.lastKnownPresence) {
                return;
              }

              const contact = await Contact.findOne({
                where: {
                  number: remoteJid.replace(/\D/g, ""),
                  companyId: whatsapp.companyId
                }
              });

              if (!contact) {
                return;
              }

              const ticket = await Ticket.findOne({
                where: {
                  contactId: contact.id,
                  whatsappId: whatsapp.id,
                  status: {
                    [Op.or]: ["open", "pending"]
                  }
                }
              });

              if (ticket) {
                io.to(ticket.id.toString())
                  .to(`company-${whatsapp.companyId}-${ticket.status}`)
                  .to(`queue-${ticket.queueId}-${ticket.status}`)
                  .emit(`company-${whatsapp.companyId}-presence`, {
                    ticketId: ticket.id,
                    presence: presences[remoteJid].lastKnownPresence
                  });
              }
            } catch (error) {
              logger.error(
                { remoteJid, presences },
                "presence.update: error processing"
              );

              if (error instanceof Error) {
                logger.error(`Error: ${error.name} ${error.message}`);
              } else {
                logger.error(
                  `Error was object of type: ${typeof error}`
                );
              }
            }
          }
        );
    } catch (error) {
      Sentry.captureException(error);
      console.log(error);
      reject(error);
    }
  });
};
