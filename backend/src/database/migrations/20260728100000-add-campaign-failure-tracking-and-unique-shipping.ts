import { QueryInterface, DataTypes } from "sequelize";

async function columnExists(
  queryInterface: QueryInterface,
  tableName: string,
  columnName: string
) {
  const table = await queryInterface.describeTable(tableName);
  return Object.prototype.hasOwnProperty.call(table, columnName);
}

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

async function addColumnIfMissing(
  queryInterface: QueryInterface,
  tableName: string,
  columnName: string,
  definition: any
) {
  if (await columnExists(queryInterface, tableName, columnName)) return;
  await queryInterface.addColumn(tableName, columnName, definition);
}

async function removeColumnIfExists(
  queryInterface: QueryInterface,
  tableName: string,
  columnName: string
) {
  if (!(await columnExists(queryInterface, tableName, columnName))) return;
  await queryInterface.removeColumn(tableName, columnName);
}

async function addIndexIfMissing(
  queryInterface: QueryInterface,
  tableName: string,
  fields: string[],
  name: string,
  unique = false
) {
  if (await indexExists(queryInterface, tableName, name)) return;
  await queryInterface.addIndex(tableName, fields, { name, unique });
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
    await addColumnIfMissing(queryInterface, "CampaignShipping", "failedAt", {
      type: DataTypes.DATE,
      allowNull: true
    });
    await addColumnIfMissing(queryInterface, "CampaignShipping", "failReason", {
      type: DataTypes.TEXT,
      allowNull: true
    });
    await addColumnIfMissing(queryInterface, "CampaignShipping", "attempts", {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    });
    await addColumnIfMissing(queryInterface, "Campaigns", "failedCount", {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    });

    await queryInterface.sequelize.query(`
      WITH ranked AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY "campaignId", "contactId"
            ORDER BY
              CASE
                WHEN "deliveredAt" IS NOT NULL THEN 0
                WHEN "confirmationRequestedAt" IS NOT NULL THEN 1
                WHEN "failedAt" IS NOT NULL THEN 2
                ELSE 3
              END,
              "updatedAt" DESC,
              id DESC
          ) AS rn
        FROM "CampaignShipping"
        WHERE "campaignId" IS NOT NULL
          AND "contactId" IS NOT NULL
      )
      DELETE FROM "CampaignShipping"
      WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
    `);

    await addIndexIfMissing(
      queryInterface,
      "CampaignShipping",
      ["campaignId", "failedAt"],
      "idx_cpsh_campaign_failed"
    );
    await addIndexIfMissing(
      queryInterface,
      "CampaignShipping",
      ["campaignId", "contactId"],
      "uniq_cpsh_campaign_contact",
      true
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await removeIndexIfExists(
      queryInterface,
      "CampaignShipping",
      "uniq_cpsh_campaign_contact"
    );
    await removeIndexIfExists(
      queryInterface,
      "CampaignShipping",
      "idx_cpsh_campaign_failed"
    );
    await removeColumnIfExists(queryInterface, "Campaigns", "failedCount");
    await removeColumnIfExists(queryInterface, "CampaignShipping", "attempts");
    await removeColumnIfExists(
      queryInterface,
      "CampaignShipping",
      "failReason"
    );
    await removeColumnIfExists(queryInterface, "CampaignShipping", "failedAt");
  }
};
