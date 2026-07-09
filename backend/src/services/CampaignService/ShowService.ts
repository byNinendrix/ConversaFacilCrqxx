import Campaign from "../../models/Campaign";
import AppError from "../../errors/AppError";
import CampaignShipping from "../../models/CampaignShipping";
import ContactList from "../../models/ContactList";
import ContactListItem from "../../models/ContactListItem";
import Whatsapp from "../../models/Whatsapp";
import { Op } from "sequelize";

const ShowService = async (id: string | number): Promise<any> => {
  const record = await Campaign.findByPk(id, {
    include: [
      { model: ContactList },
      { model: Whatsapp, attributes: ["id", "name"] }
    ]
  });

  if (!record) {
    throw new AppError("ERR_NO_CAMPAIGN_FOUND", 404);
  }

  const [
    validContacts,
    delivered,
    confirmationRequested,
    confirmed
  ] = await Promise.all([
    record.contactListId
      ? ContactListItem.count({
          where: {
            contactListId: record.contactListId,
            isWhatsappValid: true
          }
        })
      : Promise.resolve(0),
    CampaignShipping.count({
      where: {
        campaignId: record.id,
        deliveredAt: { [Op.not]: null }
      }
    }),
    CampaignShipping.count({
      where: {
        campaignId: record.id,
        confirmationRequestedAt: { [Op.not]: null }
      }
    }),
    CampaignShipping.count({
      where: {
        campaignId: record.id,
        confirmedAt: { [Op.not]: null }
      }
    })
  ]);

  return {
    ...record.toJSON(),
    stats: {
      validContacts,
      delivered,
      confirmationRequested,
      confirmed
    }
  };
};

export default ShowService;
