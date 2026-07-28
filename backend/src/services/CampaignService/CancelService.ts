import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Campaign from "../../models/Campaign";
import CampaignShipping from "../../models/CampaignShipping";
import {
  getCampaignFinalizeJobId,
  getCampaignPrepareJobId,
  getCampaignProcessJobId,
  removeCampaignQueueJob
} from "../../queues";

export async function CancelService(
  id: number,
  companyId: number | string
) {
  const campaign = await Campaign.findOne({
    where: { id, companyId }
  });
  if (!campaign) {
    throw new AppError("ERR_NO_CAMPAIGN_FOUND", 404);
  }

  await campaign.update({ status: "CANCELADA" });
  await removeCampaignQueueJob(getCampaignProcessJobId(campaign.id));
  await removeCampaignQueueJob(getCampaignFinalizeJobId(campaign.id));

  const recordsToCancel = await CampaignShipping.findAll({
    where: {
      campaignId: campaign.id,
      jobId: { [Op.not]: null },
      deliveredAt: null
    },
    attributes: ["id", "jobId", "contactId"]
  });

  for (let record of recordsToCancel) {
    await removeCampaignQueueJob(
      getCampaignPrepareJobId(campaign.id, record.contactId)
    );
    await removeCampaignQueueJob(record.jobId);
  }
}
