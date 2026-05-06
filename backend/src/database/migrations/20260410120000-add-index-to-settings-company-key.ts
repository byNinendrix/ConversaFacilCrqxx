import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addIndex("Settings", ["companyId", "key"], {
      name: "idx_settings_company_key"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex("Settings", "idx_settings_company_key");
  }
};
