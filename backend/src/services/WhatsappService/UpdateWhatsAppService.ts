import * as Yup from "yup";
import { Op } from "sequelize";

import AppError from "../../errors/AppError";
import Whatsapp from "../../models/Whatsapp";
import FlowBinding from "../../models/FlowBinding";
import FlowExecution from "../../models/FlowExecution";
import ShowWhatsAppService from "./ShowWhatsAppService";
import AssociateWhatsappQueue from "./AssociateWhatsappQueue";
import AssertCompanyFeatureEnabledService from "../CompanyFeatureService/AssertCompanyFeatureEnabledService";

interface WhatsappData {
  name?: string;
  status?: string;
  session?: string;
  isDefault?: boolean;
  greetingMessage?: string;
  complationMessage?: string;
  outOfHoursMessage?: string;
  ratingMessage?: string;
  queueIds?: number[];
  token?: string;
  //sendIdQueue?: number;
  //timeSendQueue?: number;
  transferQueueId?: number; 
  timeToTransfer?: number;    
  promptId?: number;
  maxUseBotQueues?: number;
  timeUseBotQueues?: number;
  expiresTicket?: number;
  expiresInactiveMessage?: string;
  flowAutomationEnabled?: boolean;
  schedulingAutomationEnabled?: boolean;
  schedulingOfferMessage?: string;
  schedulingShowPrice?: boolean;
  schedulingRequireConfirmation?: boolean;

}

interface Request {
  whatsappData: WhatsappData;
  whatsappId: string;
  companyId: number;
}

interface Response {
  whatsapp: Whatsapp;
  oldDefaultWhatsapp: Whatsapp | null;
}

const UpdateWhatsAppService = async ({
  whatsappData,
  whatsappId,
  companyId
}: Request): Promise<Response> => {
  const schema = Yup.object().shape({
    name: Yup.string().min(2),
    status: Yup.string(),
    isDefault: Yup.boolean()
  });

  const {
    name,
    status,
    isDefault,
    session,
    greetingMessage,
    complationMessage,
    outOfHoursMessage,
    ratingMessage,
    queueIds = [],
    token,
    //timeSendQueue,
    //sendIdQueue = null,
    transferQueueId,	
	timeToTransfer,	
    promptId,
    maxUseBotQueues,
    timeUseBotQueues,
    expiresTicket,
    expiresInactiveMessage,
    flowAutomationEnabled,
    schedulingAutomationEnabled,
    schedulingOfferMessage,
    schedulingShowPrice,
    schedulingRequireConfirmation
  } = whatsappData;

  if (schedulingAutomationEnabled === true) {
    await AssertCompanyFeatureEnabledService({
      companyId,
      feature: "scheduling"
    });
  }

  try {
    await schema.validate({ name, status, isDefault });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  if (queueIds.length > 1 && !greetingMessage) {
    throw new AppError("ERR_WAPP_GREETING_REQUIRED");
  }

  let oldDefaultWhatsapp: Whatsapp | null = null;

  if (isDefault) {
    oldDefaultWhatsapp = await Whatsapp.findOne({
      where: {
        isDefault: true,
        id: { [Op.not]: whatsappId },
        companyId
      }
    });
    if (oldDefaultWhatsapp) {
      await oldDefaultWhatsapp.update({ isDefault: false });
    }
  }

  const whatsapp = await ShowWhatsAppService(whatsappId, companyId);

  await whatsapp.update({
    name,
    status,
    session,
    greetingMessage,
    complationMessage,
    outOfHoursMessage,
    ratingMessage,
    isDefault,
    companyId,
    token,
    //timeSendQueue,
    //sendIdQueue,
    transferQueueId,	
	timeToTransfer,	
    promptId,
    maxUseBotQueues,
    timeUseBotQueues,
    expiresTicket,
    expiresInactiveMessage,
    flowAutomationEnabled,
    schedulingAutomationEnabled,
    schedulingOfferMessage,
    schedulingShowPrice,
    schedulingRequireConfirmation
  });

  await AssociateWhatsappQueue(whatsapp, queueIds);

  if (flowAutomationEnabled === false) {
    await FlowBinding.destroy({
      where: {
        companyId,
        whatsappId: Number(whatsappId),
        channel: "whatsapp",
        event: "inbound_message"
      }
    });

    await FlowExecution.update(
      {
        status: "completed",
        finishedAt: new Date(),
        lastInteractionAt: new Date()
      },
      {
        where: {
          companyId,
          whatsappId: Number(whatsappId),
          status: {
            [Op.in]: ["running", "waiting_input", "waiting_timeout"]
          }
        }
      }
    );
  }

  return { whatsapp, oldDefaultWhatsapp };
};

export default UpdateWhatsAppService;
