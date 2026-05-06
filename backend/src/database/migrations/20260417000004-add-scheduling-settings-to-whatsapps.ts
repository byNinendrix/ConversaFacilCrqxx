import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("Whatsapps", "schedulingAutomationEnabled", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    await queryInterface.addColumn("Whatsapps", "schedulingOfferMessage", {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: ""
    });

    await queryInterface.addColumn("Whatsapps", "schedulingShowPrice", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    });

    await queryInterface.addColumn("Whatsapps", "schedulingRequireConfirmation", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    });

    await queryInterface.addIndex(
      "Whatsapps",
      ["companyId", "schedulingAutomationEnabled"],
      { name: "idx_whatsapps_company_scheduling_enabled" }
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex(
      "Whatsapps",
      "idx_whatsapps_company_scheduling_enabled"
    );

    await queryInterface.removeColumn(
      "Whatsapps",
      "schedulingRequireConfirmation"
    );
    await queryInterface.removeColumn("Whatsapps", "schedulingShowPrice");
    await queryInterface.removeColumn("Whatsapps", "schedulingOfferMessage");
    await queryInterface.removeColumn(
      "Whatsapps",
      "schedulingAutomationEnabled"
    );
  }
};
