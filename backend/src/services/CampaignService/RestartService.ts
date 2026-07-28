import Campaign from "../../models/Campaign";
import AppError from "../../errors/AppError";
import CampaignShipping from "../../models/CampaignShipping";
import {
  campaignQueue,
  getCampaignFinalizeJobId,
  getCampaignProcessJobId,
  removeCampaignQueueJob
} from "../../queues";

export async function RestartService(
  id: number,
  companyId: number | string
) {
  const campaign = await Campaign.findOne({
    where: { id, companyId }
  });
  if (!campaign) {
    throw new AppError("ERR_NO_CAMPAIGN_FOUND", 404);
  }

  await campaign.update({ status: "EM_ANDAMENTO" });
  await removeCampaignQueueJob(getCampaignProcessJobId(campaign.id));
  await removeCampaignQueueJob(getCampaignFinalizeJobId(campaign.id));
  await CampaignShipping.update(
    {
      failedAt: null,
      failReason: null,
      attempts: 0,
      jobId: null
    },
    {
      where: {
        campaignId: campaign.id,
        deliveredAt: null
      }
    }
  );

  await campaignQueue.add(
    "ProcessCampaign",
    {
      id: campaign.id,
      delay: 3000
    },
    {
      jobId: getCampaignProcessJobId(campaign.id),
      delay: 3000,
      removeOnComplete: true,
      removeOnFail: true
    }
  );
}
