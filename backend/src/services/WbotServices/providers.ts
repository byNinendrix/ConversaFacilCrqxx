import { proto, WASocket } from "@whiskeysockets/baileys";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import { runBoletoScenario } from "./providers/boleto";
import { runTrustReconnectScenario } from "./providers/religue";

export const provider = async (
  ticket: Ticket,
  msg: proto.IWebMessageInfo,
  companyId: number,
  contact: Contact,
  wbot: WASocket
) => {
  const queueName = (ticket.queue?.name || "").trim().toLowerCase();

  if (["2ª via de boleto", "2 via de boleto"].includes(queueName)) {
    await runBoletoScenario(ticket, msg, companyId, contact, wbot);
    return;
  }

  if (["religue de confiança", "liberação em confiança"].includes(queueName)) {
    await runTrustReconnectScenario(ticket, msg, companyId, contact, wbot);
  }
};

