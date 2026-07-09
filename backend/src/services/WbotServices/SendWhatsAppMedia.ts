import { WAMessage, AnyMessageContent } from "@whiskeysockets/baileys";
import * as Sentry from "@sentry/node";
import fs from "fs";
import { exec } from "child_process";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import AppError from "../../errors/AppError";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import Ticket from "../../models/Ticket";
import mime from "mime-types";

import ffmpegPath from "ffmpeg-static";
import formatBody from "../../helpers/Mustache";

interface Request {
  media: Express.Multer.File;
  ticket: Ticket;
  body?: string;
  isForwarded?: boolean;  
}

ffmpeg.setFfmpegPath(ffmpegPath);

const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");
const reusableAudioCache = new Map<string, Promise<string>>();

const processAudio = async (
  audio: string,
  removeOriginal = true
): Promise<string> => {
  const outputAudio = `${publicFolder}/${new Date().getTime()}.mp3`;
  return new Promise((resolve, reject) => {
    exec(
      `${ffmpegPath} -i ${audio} -vn -ab 128k -ar 44100 -f ipod ${outputAudio} -y`,
      (error, _stdout, _stderr) => {
        if (error) {
          reject(error);
          return;
        }
        if (removeOriginal) {
          fs.unlinkSync(audio);
        }
        resolve(outputAudio);
      }
    );
  });
};

const processReusableAudio = async (audio: string): Promise<string> => {
  const stat = fs.statSync(audio);
  const cacheKey = `${audio}:${stat.size}:${stat.mtimeMs}`;

  if (!reusableAudioCache.has(cacheKey)) {
    reusableAudioCache.set(cacheKey, processAudio(audio, false));
  }

  return reusableAudioCache.get(cacheKey);
};

const processAudioFile = async (audio: string): Promise<string> => {
  const outputAudio = `${publicFolder}/${new Date().getTime()}.mp3`;
  return new Promise((resolve, reject) => {
    exec(
      `${ffmpegPath} -i ${audio} -vn -ar 44100 -ac 2 -b:a 192k ${outputAudio}`,
      (error, _stdout, _stderr) => {
        if (error) reject(error);
        fs.unlinkSync(audio);
        resolve(outputAudio);
      }
    );
  });
};


export const getMessageOptions = async (
  fileName: string,
  pathMedia: string,
  body: string = " "
): Promise<any> => {
  const mimeType = mime.lookup(pathMedia);

  try {
    if (!mimeType) {
      throw new Error("Invalid mimetype");
    }
    const typeMessage = mimeType.split("/")[0];
    let options: AnyMessageContent;
    const media = { url: pathMedia };

    if (typeMessage === "video") {
      options = {
        video: media,
        caption: body ? body : null,
        fileName: fileName
        // gifPlayback: true
      };
    } else if (typeMessage === "audio") {
      const convert = await processReusableAudio(pathMedia);
      options = {
        audio: { url: convert },
        mimetype: "audio/mp4",
        ptt: true
      };
    } else if (typeMessage === "document") {
      options = {
        document: media,
        caption: body ? body : null,
        fileName: fileName,
        mimetype: mimeType
      };
    } else if (typeMessage === "application") {
      options = {
        document: media,
        caption: body ? body : null,
        fileName: fileName,
        mimetype: mimeType
      };
    } else {
      options = {
        image: media,
        caption: body ? body : null,
      };
    }

    return options;
  } catch (e) {
    Sentry.captureException(e);
    console.log(e);
    return null;
  }
};


const SendWhatsAppMedia = async ({
  media,
  ticket,
  body,
  isForwarded = false
}: Request): Promise<WAMessage> => {
  try {
    const wbot = await GetTicketWbot(ticket);

    const pathMedia = media.path;
    const typeMessage = media.mimetype.split("/")[0];
    let options: AnyMessageContent;
    const bodyMessage = formatBody(body, ticket.contact)

    if (typeMessage === "video") {
      options = {
        video: { url: pathMedia },
        caption: bodyMessage,
        fileName: media.originalname,
        contextInfo: { forwardingScore: isForwarded ? 2 : 0, isForwarded: isForwarded }
        // gifPlayback: true
      };
    } else if (typeMessage === "audio") {
      const typeAudio = media.originalname.includes("audio-record-site");
      if (typeAudio) {
        const convert = await processAudio(media.path);
        options = {
          audio: { url: convert },
          mimetype: "audio/mpeg",
          ptt: true,
          contextInfo: { forwardingScore: isForwarded ? 2 : 0, isForwarded: isForwarded }
        };
      } else {
        const convert = await processAudio(media.path);
        options = {
          audio: { url: convert },
          mimetype: "audio/mpeg",
          ptt: true,
          contextInfo: { forwardingScore: isForwarded ? 2 : 0, isForwarded: isForwarded }
        };
      }
    } else if (typeMessage === "document" || typeMessage === "text") {
      options = {
        document: { url: pathMedia },
        caption: bodyMessage,
        fileName: media.originalname,
        mimetype: media.mimetype,
        contextInfo: { forwardingScore: isForwarded ? 2 : 0, isForwarded: isForwarded }
      };
    } else if (typeMessage === "application") {
      options = {
        document: { url: pathMedia },
        caption: bodyMessage,
        fileName: media.originalname,
        mimetype: media.mimetype,
        contextInfo: { forwardingScore: isForwarded ? 2 : 0, isForwarded: isForwarded }
      };
    } else {
      options = {
        image: { url: pathMedia },
        caption: bodyMessage,
        contextInfo: { forwardingScore: isForwarded ? 2 : 0, isForwarded: isForwarded }
      };
    }

    const sentMessage = await wbot.sendMessage(
      `${ticket.contact.number}@${ticket.isGroup ? "g.us" : "s.whatsapp.net"}`,
      {
        ...options
      }
    );

    await ticket.update({ lastMessage: bodyMessage });

    return sentMessage;
  } catch (err) {
    Sentry.captureException(err);
    console.log(err);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMedia;
