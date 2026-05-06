import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("ServiceBookings", "pixProvider", {
      type: DataTypes.STRING,
      allowNull: true
    });

    await queryInterface.addColumn("ServiceBookings", "pixLocationId", {
      type: DataTypes.STRING,
      allowNull: true
    });

    await queryInterface.addColumn("ServiceBookings", "pixQrCode", {
      type: DataTypes.TEXT,
      allowNull: true
    });

    await queryInterface.addIndex("ServiceBookings", ["companyId", "pixProvider"], {
      name: "idx_service_bookings_company_pix_provider"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex(
      "ServiceBookings",
      "idx_service_bookings_company_pix_provider"
    );

    await queryInterface.removeColumn("ServiceBookings", "pixQrCode");
    await queryInterface.removeColumn("ServiceBookings", "pixLocationId");
    await queryInterface.removeColumn("ServiceBookings", "pixProvider");
  }
};
