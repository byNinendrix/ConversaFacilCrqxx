import sequelize from "../../database";
import { QueryTypes } from "sequelize";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";

const ShowMessageService = async (messageId: string, companyId: number) => {
  const message = await sequelize.query<Message>(
    `select * from "Messages" where id = :messageId and "companyId" = :companyId limit 1`,
    {
      model: Message,
      mapToModel: true,
      type: QueryTypes.SELECT,
      replacements: { messageId, companyId }
    }
  );

  if (message.length > 0) {
    return message[0];
  }

  return undefined;
}

const GetWhatsAppFromMessage = async (message: Message): Promise<number | null> => {
  const ticketId = message.ticketId;
  const ticket = await Ticket.findByPk(ticketId);
  if (!ticket || ticket.companyId !== message.companyId) {
    return null;
  }
  return ticket.whatsappId;
}

export {
  GetWhatsAppFromMessage
};

export default ShowMessageService;
