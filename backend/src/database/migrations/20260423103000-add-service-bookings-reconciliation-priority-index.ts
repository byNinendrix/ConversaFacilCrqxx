import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addIndex(
      "ServiceBookings",
      [
        "paymentStatus",
        "status",
        "pixProvider",
        "paymentDueAt",
        "companyId",
        "createdAt",
        "id"
      ],
      {
        name: "idx_service_bookings_reconciliation_priority"
      }
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex(
      "ServiceBookings",
      "idx_service_bookings_reconciliation_priority"
    );
  }
};
