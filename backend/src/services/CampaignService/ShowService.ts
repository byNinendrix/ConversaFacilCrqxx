import Campaign from "../../models/Campaign";
import AppError from "../../errors/AppError";
import CampaignShipping from "../../models/CampaignShipping";
import ContactList from "../../models/ContactList";
import ContactListItem from "../../models/ContactListItem";
import Whatsapp from "../../models/Whatsapp";
import { Op } from "sequelize";

const ShowService = async (
  id: string | number,
  companyId: string | number
): Promise<any> => {
  const record = await Campaign.findOne({
    where: { id, companyId },
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
    confirmed,
    failed
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
    }),
    CampaignShipping.count({
      where: {
        campaignId: record.id,
        failedAt: { [Op.not]: null }
      }
    })
  ]);

  const recordJson: any = record.toJSON();
  const canUseCached =
    record.status === "FINALIZADA" || record.status === "CANCELADA";
  const cachedValidContacts = recordJson.validContactsCount || 0;
  const cachedDelivered = recordJson.deliveredCount || 0;
  const cachedConfirmationRequested =
    recordJson.confirmationRequestedCount || 0;
  const cachedConfirmed = recordJson.confirmedCount || 0;
  const cachedFailed = recordJson.failedCount || 0;

  return {
    ...recordJson,
    stats: {
      validContacts:
        validContacts || (canUseCached ? cachedValidContacts : 0),
      delivered: canUseCached
        ? Math.max(delivered, cachedDelivered)
        : delivered,
      confirmationRequested: canUseCached
        ? Math.max(confirmationRequested, cachedConfirmationRequested)
        : confirmationRequested,
      confirmed: canUseCached ? Math.max(confirmed, cachedConfirmed) : confirmed,
      failed: canUseCached ? Math.max(failed, cachedFailed) : failed
    }
  };
};

export default ShowService;
