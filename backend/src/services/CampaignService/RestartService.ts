import Campaign from "../../models/Campaign";
import AppError from "../../errors/AppError";
import {
  campaignQueue,
  getCampaignProcessJobId,
  removeCampaignQueueJob
} from "../../queues";

export async function RestartService(id: number) {
  const campaign = await Campaign.findByPk(id);
  if (!campaign) {
    throw new AppError("ERR_NO_CAMPAIGN_FOUND", 404);
  }

  await campaign.update({ status: "EM_ANDAMENTO" });
  await removeCampaignQueueJob(getCampaignProcessJobId(campaign.id));

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
