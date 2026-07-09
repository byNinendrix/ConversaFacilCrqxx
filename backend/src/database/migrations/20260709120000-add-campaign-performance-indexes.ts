import { QueryInterface } from "sequelize";

async function indexExists(
  queryInterface: QueryInterface,
  tableName: string,
  indexName: string
) {
  const indexes = (await queryInterface.showIndex(tableName)) as Array<{
    name: string;
  }>;
  return indexes.some(index => index.name === indexName);
}

async function addIndexIfMissing(
  queryInterface: QueryInterface,
  tableName: string,
  fields: string[],
  name: string
) {
  if (await indexExists(queryInterface, tableName, name)) return;
  await queryInterface.addIndex(tableName, fields, { name });
}

async function removeIndexIfExists(
  queryInterface: QueryInterface,
  tableName: string,
  name: string
) {
  if (!(await indexExists(queryInterface, tableName, name))) return;
  await queryInterface.removeIndex(tableName, name);
}

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await addIndexIfMissing(queryInterface, "Campaigns", ["status", "scheduledAt"], "idx_campaigns_status_scheduled_at");
    await addIndexIfMissing(queryInterface, "ContactListItems", ["contactListId", "isWhatsappValid", "id"], "idx_ctli_list_valid_id");
    await addIndexIfMissing(queryInterface, "CampaignShipping", ["campaignId", "contactId"], "idx_cpsh_campaign_contact");
    await addIndexIfMissing(queryInterface, "CampaignShipping", ["campaignId", "deliveredAt"], "idx_cpsh_campaign_delivered");
    await addIndexIfMissing(queryInterface, "CampaignShipping", ["campaignId", "confirmationRequestedAt"], "idx_cpsh_campaign_confirmation_requested");
    await addIndexIfMissing(queryInterface, "CampaignShipping", ["campaignId", "confirmedAt"], "idx_cpsh_campaign_confirmed");
    await addIndexIfMissing(queryInterface, "CampaignShipping", ["campaignId", "number", "confirmation"], "idx_cpsh_campaign_number_confirmation");
    await addIndexIfMissing(queryInterface, "CampaignShipping", ["number", "confirmation", "campaignId", "confirmationRequestedAt"], "idx_cpsh_number_confirmation_campaign_requested");
    await addIndexIfMissing(queryInterface, "CampaignShipping", ["campaignId", "deliveredAt", "jobId"], "idx_cpsh_campaign_delivered_job");
  },

  down: async (queryInterface: QueryInterface) => {
    await removeIndexIfExists(queryInterface, "CampaignShipping", "idx_cpsh_campaign_delivered_job");
    await removeIndexIfExists(queryInterface, "CampaignShipping", "idx_cpsh_number_confirmation_campaign_requested");
    await removeIndexIfExists(queryInterface, "CampaignShipping", "idx_cpsh_campaign_number_confirmation");
    await removeIndexIfExists(queryInterface, "CampaignShipping", "idx_cpsh_campaign_confirmed");
    await removeIndexIfExists(queryInterface, "CampaignShipping", "idx_cpsh_campaign_confirmation_requested");
    await removeIndexIfExists(queryInterface, "CampaignShipping", "idx_cpsh_campaign_delivered");
    await removeIndexIfExists(queryInterface, "CampaignShipping", "idx_cpsh_campaign_contact");
    await removeIndexIfExists(queryInterface, "ContactListItems", "idx_ctli_list_valid_id");
    await removeIndexIfExists(queryInterface, "Campaigns", "idx_campaigns_status_scheduled_at");
  }
};
