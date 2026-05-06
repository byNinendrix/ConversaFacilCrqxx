import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addIndex(
      "ServiceBookings",
      ["companyId", "companyServiceId", "status", "startAt"],
      {
        name: "idx_service_bookings_company_service_status_start"
      }
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex(
      "ServiceBookings",
      "idx_service_bookings_company_service_status_start"
    );
  }
};

