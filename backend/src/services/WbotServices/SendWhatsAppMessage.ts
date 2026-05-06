import * as Sentry from "@sentry/node";
import { WAMessage } from "@whiskeysockets/baileys";
import AppError from "../../errors/AppError";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";

import formatBody from "../../helpers/Mustache";
import { map_msg } from "../../utils/global";

type SupportedMediaType = "image" | "video";

interface Request {
  body: string;
  ticket: Ticket;
  quotedMsg?: Message;
  isForwarded?: boolean;
  mediaType?: SupportedMediaType;
  mediaUrl?: string;
}

const SendWhatsAppMessage = async ({
  body,
  ticket,
  quotedMsg,
  isForwarded = false,
  mediaType,
  mediaUrl
}: Request): Promise<WAMessage> => {
  const wbot = await GetTicketWbot(ticket);

  const rawNumber = String(ticket.contact.number || "").replace(/\D/g, "");
  const jid = `${rawNumber}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`;

  let options: any = {};

  if (quotedMsg) {
    const chatMessage = await Message.findOne({
      where: { id: quotedMsg.id }
    });

    if (chatMessage) {
      const msgFound = JSON.parse(chatMessage.dataJson);

      options = {
        quoted: {
          key: msgFound.key,
          message: {
            extendedTextMessage: msgFound.message?.extendedTextMessage
          }
        }
      };
    }
  }

  try {
    const bodyMessage = formatBody(body || "", ticket.contact);
    const normalizedMediaType = String(mediaType || "").trim().toLowerCase() as SupportedMediaType | "";
    const normalizedMediaUrl = String(mediaUrl || "").trim();
    const contextInfo = {
      forwardingScore: isForwarded ? 2 : 0,
      isForwarded: !!isForwarded
    };

    map_msg.set(rawNumber, {
      lastSystemMsg: bodyMessage || `[${normalizedMediaType || "text"}]`
    });

    await wbot.presenceSubscribe(jid);
    await wbot.sendPresenceUpdate("composing", jid);
    await wbot.sendPresenceUpdate("paused", jid);

    let sentMessage: WAMessage;

    if (
      (normalizedMediaType === "image" || normalizedMediaType === "video")
      && normalizedMediaUrl
    ) {
      const mediaPayload =
        normalizedMediaType === "video"
          ? {
            video: { url: normalizedMediaUrl },
            caption: bodyMessage || undefined,
            contextInfo
          }
          : {
            image: { url: normalizedMediaUrl },
            caption: bodyMessage || undefined,
            contextInfo
          };

      sentMessage = await wbot.sendMessage(jid, mediaPayload as any, options);
    } else {
      sentMessage = await wbot.sendMessage(
        jid,
        {
          text: bodyMessage,
          contextInfo
        },
        options
      );
    }

    await ticket.update({
      lastMessage: bodyMessage || `[${normalizedMediaType || "text"}]`
    });

    return sentMessage;
  } catch (err) {
    Sentry.captureException(err);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMessage;
