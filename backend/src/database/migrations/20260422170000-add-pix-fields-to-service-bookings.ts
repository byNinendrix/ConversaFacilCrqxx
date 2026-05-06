import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("ServiceBookings", "pixPayload", {
      type: DataTypes.TEXT,
      allowNull: true
    });

    await queryInterface.addColumn("ServiceBookings", "pixTxId", {
      type: DataTypes.STRING,
      allowNull: true
    });

    await queryInterface.addColumn("ServiceBookings", "pixExpiresAt", {
      type: DataTypes.DATE,
      allowNull: true
    });

    await queryInterface.addIndex("ServiceBookings", ["companyId", "pixTxId"], {
      name: "idx_service_bookings_company_pix_txid"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex(
      "ServiceBookings",
      "idx_service_bookings_company_pix_txid"
    );

    await queryInterface.removeColumn("ServiceBookings", "pixExpiresAt");
    await queryInterface.removeColumn("ServiceBookings", "pixTxId");
    await queryInterface.removeColumn("ServiceBookings", "pixPayload");
  }
};
