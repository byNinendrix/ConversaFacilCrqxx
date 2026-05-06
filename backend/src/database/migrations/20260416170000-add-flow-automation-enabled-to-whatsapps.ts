import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Whatsapps", "flowAutomationEnabled", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    await queryInterface.sequelize.query(`
      UPDATE "Whatsapps" w
      SET "flowAutomationEnabled" = TRUE
      WHERE EXISTS (
        SELECT 1
        FROM "FlowBindings" fb
        WHERE fb."whatsappId" = w."id"
          AND fb."channel" = 'whatsapp'
          AND fb."event" = 'inbound_message'
          AND fb."isActive" = TRUE
      );
    `);
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("Whatsapps", "flowAutomationEnabled");
  }
};
