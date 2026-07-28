import AppError from "../../errors/AppError";
import ContactList from "../../models/ContactList";
import ContactListItem from "../../models/ContactListItem";
import Whatsapp from "../../models/Whatsapp";

type CampaignValidationData = {
  companyId: number;
  contactListId?: number | string | null;
  whatsappId?: number | string | null;
};

export const ValidateCampaignService = async ({
  companyId,
  contactListId,
  whatsappId
}: CampaignValidationData): Promise<void> => {
  if (!contactListId) {
    throw new AppError("ERR_CAMPAIGN_CONTACT_LIST_REQUIRED", 400);
  }

  const contactList = await ContactList.findOne({
    where: { id: contactListId, companyId },
    attributes: ["id"]
  });

  if (!contactList) {
    throw new AppError("ERR_CAMPAIGN_CONTACT_LIST_NOT_FOUND", 404);
  }

  const validContacts = await ContactListItem.count({
    where: {
      contactListId,
      companyId,
      isWhatsappValid: true
    }
  });

  if (validContacts === 0) {
    throw new AppError("ERR_CAMPAIGN_CONTACT_LIST_EMPTY", 400);
  }

  if (!whatsappId) {
    throw new AppError("ERR_CAMPAIGN_WHATSAPP_REQUIRED", 400);
  }

  const whatsapp = await Whatsapp.findOne({
    where: { id: whatsappId, companyId },
    attributes: ["id"]
  });

  if (!whatsapp) {
    throw new AppError("ERR_CAMPAIGN_WHATSAPP_NOT_FOUND", 404);
  }
};

export default ValidateCampaignService;
