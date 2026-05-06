import { Request, Response } from "express";
import AppError from "../errors/AppError";

import formatBody from "../helpers/Mustache";
import SetTicketMessagesAsRead from "../helpers/SetTicketMessagesAsRead";
import { getIO } from "../libs/socket";
import Ticket from "../models/Ticket";
import Message from "../models/Message";
import Queue from "../models/Queue";
import User from "../models/User";
import Whatsapp from "../models/Whatsapp";
import { isNil } from "lodash";
import CreateOrUpdateContactService from "../services/ContactServices/CreateOrUpdateContactService";
import SendWhatsAppReaction from "../services/WbotServices/SendWhatsAppReaction";
import ListMessagesService from "../services/MessageServices/ListMessagesService";
import FindOrCreateTicketService from "../services/TicketServices/FindOrCreateTicketService";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import UpdateTicketService from "../services/TicketServices/UpdateTicketService";
import CheckContactNumber from "../services/WbotServices/CheckNumber";
import DeleteWhatsAppMessage from "../services/WbotServices/DeleteWhatsAppMessage";
import GetProfilePicUrl from "../services/WbotServices/GetProfilePicUrl";
import ShowContactService from "../services/ContactServices/ShowContactService";
import SendWhatsAppMedia from "../services/WbotServices/SendWhatsAppMedia";
import path from "path";
import SendWhatsAppMessage from "../services/WbotServices/SendWhatsAppMessage";
import EditWhatsAppMessage from "../services/WbotServices/EditWhatsAppMessage";
import ShowMessageService, {
  GetWhatsAppFromMessage
} from "../services/MessageServices/ShowMessageService";

type IndexQuery = {
  pageNumber: string;
};

type MessageData = {
  body: string;
  fromMe: boolean;
  read: boolean;
  quotedMsg?: Message;
  number?: string;
  closeTicket?: true;
  whatsappId?: number; // Mantido por compatibilidade, mas NÃO será usado no endpoint por token
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { pageNumber } = req.query as IndexQuery;
  const { companyId, profile } = req.user;
  const queues: number[] = [];

  if (profile !== "admin") {
    const user = await User.findByPk(req.user.id, {
      include: [{ model: Queue, as: "queues" }]
    });
    user.queues.forEach(queue => {
      queues.push(queue.id);
    });
  }

  const { count, messages, ticket, hasMore } = await ListMessagesService({
    pageNumber,
    ticketId,
    companyId,
    queues
  });

  SetTicketMessagesAsRead(ticket);

  return res.json({ count, messages, ticket, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { body, quotedMsg }: MessageData = req.body;
  const medias = req.files as Express.Multer.File[];
  const { companyId } = req.user;

  const ticket = await ShowTicketService(ticketId, companyId);

  SetTicketMessagesAsRead(ticket);

  console.log("bodyyyyyyyyyy:", body);
  if (medias) {
    await Promise.all(
      medias.map(async (media: Express.Multer.File, index) => {
        await SendWhatsAppMedia({
          media,
          ticket,
          body: Array.isArray(body) ? body[index] : body
        });
      })
    );
  } else {
    await SendWhatsAppMessage({ body, ticket, quotedMsg });
  }

  return res.send();
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  const { messageId } = req.params;
  const { companyId } = req.user;

  const message = await DeleteWhatsAppMessage(messageId);

  const io = getIO();
  io.to(message.ticketId.toString()).emit(`company-${companyId}-appMessage`, {
    action: "update",
    message
  });

  return res.send();
};

/**
 * Endpoint público por token: POST /api/messages/send
 * Governança SaaS: o token define companyId e whatsappId. Sem fallback global.
 */
export const send = async (req: Request, res: Response): Promise<Response> => {
  const messageData = req.body as MessageData;
  const medias = req.files as Express.Multer.File[];

  const apiAuth = (req as any).apiAuth as
    | { whatsappId: number; companyId: number }
    | undefined;

  console.log("send API -> apiAuth:", apiAuth, "messageData:", messageData);

  try {
    if (!messageData.number) {
      throw new AppError("O número é obrigatório", 400);
    }

    // ✅ Contexto obrigatório vindo do tokenAuth
    if (!apiAuth?.whatsappId || !apiAuth?.companyId) {
      throw new AppError("Token inválido ou sem contexto de empresa", 401);
    }

    // ✅ WhatsApp estritamente determinado pelo token
    const whatsapp = await Whatsapp.findByPk(apiAuth.whatsappId);
    if (!whatsapp) {
      throw new AppError("WhatsApp do token não encontrado", 404);
    }

    const companyId = apiAuth.companyId;

    // ✅ Integridade: evita inconsistência token vs registro
    if (whatsapp.companyId !== companyId) {
      throw new AppError(
        "Token inconsistente: WhatsApp não pertence à empresa informada",
        401
      );
    }

    const numberToTest = messageData.number;
    const body = messageData.body;

    // 2) Validar número e montar contato
    const CheckValidNumber = await CheckContactNumber(numberToTest, companyId);
    const number = CheckValidNumber.jid.replace(/\D/g, "");

    const profilePicUrl = await GetProfilePicUrl(number, companyId);

    const contactData = {
      name: `${number}`,
      number,
      profilePicUrl,
      isGroup: false,
      companyId
    };

    const contact = await CreateOrUpdateContactService(contactData);

    // 3) Ticket na empresa correta + conexão correta (whatsapp do token)
    const ticket = await FindOrCreateTicketService(
      contact,
      whatsapp.id!,
      0,
      companyId
    );
	
	// GOVERNANÇA: token manda. Garante que o ticket fica amarrado ao whatsapp do token.
	if (ticket.whatsappId !== whatsapp.id) {
		ticket.whatsappId = whatsapp.id;
		await ticket.save();
	}

	
    // 4) Enviar mídia ou texto
    if (medias && medias.length > 0) {
      await Promise.all(
        medias.map(async (media: Express.Multer.File) => {
          await req.app.get("queues").messageQueue.add(
            "SendMessage",
            {
              whatsappId: whatsapp.id,
              data: {
                number,
                body: body ? formatBody(body, contact) : media.originalname,
                mediaPath: media.path,
                fileName: media.originalname
              }
            },
            { removeOnComplete: true, attempts: 3 }
          );
        })
      );
    } else {
      await SendWhatsAppMessage({
        body: formatBody(body, contact),
        ticket
      });

      await ticket.update({
        lastMessage: body
      });
    }

    // 5) Fechar ticket, se solicitado
    if (messageData.closeTicket) {
      setTimeout(async () => {
        await UpdateTicketService({
          ticketId: ticket.id,
          ticketData: { status: "closed" },
          companyId
        });
      }, 1000);
    }

    SetTicketMessagesAsRead(ticket);

    return res.send({ mensagem: "Mensagem enviada" });
  } catch (err: any) {
    console.error("Erro no send API:", err);

    if (err instanceof AppError) {
      throw err;
    }

    const msg =
      err?.message ||
      "Não foi possível enviar a mensagem, tente novamente em alguns instantes";

    throw new AppError(msg);
  }
};

export const addReaction = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { messageId } = req.params;
    const { type } = req.body; // O tipo de reação, por exemplo, 'like', 'heart', etc.
    const { companyId, id } = req.user;

    const message = await Message.findByPk(messageId);

    const ticket = await Ticket.findByPk(message.ticketId, {
      include: ["contact"]
    });

    if (!message) {
      return res.status(404).send({ message: "Mensagem não encontrada" });
    }

    // Envia a reação via WhatsApp
    const reactionResult = await SendWhatsAppReaction({
      messageId: messageId,
      ticket: ticket,
      reactionType: type
    });

    // Atualiza a mensagem com a nova reação no banco de dados (opcional, dependendo da necessidade)
    const updatedMessage = await message.update({
      reactions: [...message.reactions, { type: type, userId: id }]
    });

    const io = getIO();
    io.to(message.ticketId.toString()).emit(`company-${companyId}-appMessage`, {
      action: "update",
      message
    });

    return res.status(200).send({
      message: "Reação adicionada com sucesso!",
      reactionResult,
      reactions: updatedMessage.reactions
    });
  } catch (error: any) {
    console.error("Erro ao adicionar reação:", error);
    if (error instanceof AppError) {
      return res.status(400).send({ message: error.message });
    }
    return res
      .status(500)
      .send({ message: "Erro ao adicionar reação", error: error.message });
  }
};

function obterNomeEExtensaoDoArquivo(url: string) {
  const urlObj = new URL(url);
  const pathname = urlObj.pathname;
  const filename = pathname.split("/").pop() || "";
  const parts = filename.split(".");

  const nomeDoArquivo = parts[0];
  const extensao = parts[1];

  return `${nomeDoArquivo}.${extensao}`;
}

export const forwardMessage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { quotedMsg, signMessage, messageId, contactId } = req.body;
  const { id: userId, companyId } = req.user;
  const requestUser = await User.findByPk(userId);

  if (!messageId || !contactId) {
    return res.status(200).send("MessageId or ContactId not found");
  }

  const message = await ShowMessageService(messageId, companyId);
  const contact = await ShowContactService(contactId, companyId);

  if (!message) {
    return res.status(404).send("Message not found");
  }
  if (!contact) {
    return res.status(404).send("Contact not found");
  }

  const whatsAppConnectionId = await GetWhatsAppFromMessage(message);
  if (!whatsAppConnectionId) {
    return res.status(404).send("Whatsapp from message not found");
  }

  const ticket = await ShowTicketService(message.ticketId, message.companyId);

  const createTicket = await FindOrCreateTicketService(
    contact,
    ticket?.whatsappId,
    0,
    ticket.companyId,
    contact.isGroup ? contact : null
  );

  let ticketData;

  if (isNil(createTicket?.queueId)) {
    ticketData = {
      status: createTicket.isGroup ? "group" : "open",
      userId: requestUser.id,
      queueId: ticket.queueId
    };
  } else {
    ticketData = {
      status: createTicket.isGroup ? "group" : "open",
      userId: requestUser.id
    };
  }

  await UpdateTicketService({
    ticketData,
    ticketId: createTicket.id,
    companyId: createTicket.companyId
  });

  let body = message.body;
  if (
    message.mediaType === "conversation" ||
    message.mediaType === "extendedTextMessage"
  ) {
    await SendWhatsAppMessage({
      body,
      ticket: createTicket,
      quotedMsg,
      isForwarded: message.fromMe ? false : true
    });
  } else {
    const mediaUrl = message.mediaUrl.replace(`:${process.env.PORT}`, "");
    const fileName = obterNomeEExtensaoDoArquivo(mediaUrl);

    if (body === fileName) {
      body = "";
    }

    const publicFolder = path.join(__dirname, "..", "..", "..", "backend", "public");

    const filePath = path.join(publicFolder, fileName);

    const mediaSrc = {
      fieldname: "medias",
      originalname: fileName,
      encoding: "7bit",
      mimetype: message.mediaType,
      filename: fileName,
      path: filePath
    } as Express.Multer.File;

    await SendWhatsAppMedia({
      media: mediaSrc,
      ticket: createTicket,
      body,
      isForwarded: message.fromMe ? false : true
    });
  }

  return res.send();
};

export const edit = async (req: Request, res: Response): Promise<Response> => {
  const { messageId } = req.params;
  const { companyId } = req.user;
  const { body }: MessageData = req.body;
  console.log(body);

  const { ticket, message } = await EditWhatsAppMessage({ messageId, body });

  const io = getIO();
  io.emit(`company-${companyId}-appMessage`, {
    action: "update",
    message,
    ticket: ticket,
    contact: ticket.contact
  });

  return res.send();
};
