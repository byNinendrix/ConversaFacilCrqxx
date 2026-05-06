import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("CompanyServices", "description", {
      type: DataTypes.TEXT,
      allowNull: true
    });

    await queryInterface.addColumn("CompanyServices", "isActive", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    });

    await queryInterface.addColumn("CompanyServices", "durationMinutes", {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 30
    });

    await queryInterface.addColumn("CompanyServices", "intervalMinutes", {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    });

    await queryInterface.addColumn("CompanyServices", "minAdvanceMinutes", {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 60
    });

    await queryInterface.addColumn("CompanyServices", "maxAdvanceDays", {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 30
    });

    await queryInterface.addColumn("CompanyServices", "maxBookingsPerSlot", {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    });

    await queryInterface.addIndex(
      "CompanyServices",
      ["companyId", "isActive"],
      {
        name: "idx_company_services_company_active"
      }
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex(
      "CompanyServices",
      "idx_company_services_company_active"
    );

    await queryInterface.removeColumn("CompanyServices", "maxBookingsPerSlot");
    await queryInterface.removeColumn("CompanyServices", "maxAdvanceDays");
    await queryInterface.removeColumn("CompanyServices", "minAdvanceMinutes");
    await queryInterface.removeColumn("CompanyServices", "intervalMinutes");
    await queryInterface.removeColumn("CompanyServices", "durationMinutes");
    await queryInterface.removeColumn("CompanyServices", "isActive");
    await queryInterface.removeColumn("CompanyServices", "description");
  }
};
