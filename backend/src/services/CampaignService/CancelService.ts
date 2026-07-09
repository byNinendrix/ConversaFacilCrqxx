import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Campaign from "../../models/Campaign";
import CampaignShipping from "../../models/CampaignShipping";
import {
  getCampaignProcessJobId,
  removeCampaignQueueJob
} from "../../queues";

export async function CancelService(id: number) {
  const campaign = await Campaign.findByPk(id);
  if (!campaign) {
    throw new AppError("ERR_NO_CAMPAIGN_FOUND", 404);
  }

  await campaign.update({ status: "CANCELADA" });
  await removeCampaignQueueJob(getCampaignProcessJobId(campaign.id));

  const recordsToCancel = await CampaignShipping.findAll({
    where: {
      campaignId: campaign.id,
      jobId: { [Op.not]: null },
      deliveredAt: null
    }
  });

  for (let record of recordsToCancel) {
    await removeCampaignQueueJob(record.jobId);
  }
}
