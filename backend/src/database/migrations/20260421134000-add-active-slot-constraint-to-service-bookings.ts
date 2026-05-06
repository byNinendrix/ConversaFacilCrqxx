import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("ServiceBookings", "activeSlotStartAt", {
      type: DataTypes.DATE,
      allowNull: true
    });

    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === "postgres") {
      await queryInterface.sequelize.query(`
        UPDATE "ServiceBookings"
        SET "activeSlotStartAt" = CASE
          WHEN "status" IN ('scheduled', 'confirmed') THEN "startAt"
          ELSE NULL
        END
      `);
    } else {
      await queryInterface.sequelize.query(`
        UPDATE ServiceBookings
        SET activeSlotStartAt = CASE
          WHEN status IN ('scheduled', 'confirmed') THEN startAt
          ELSE NULL
        END
      `);
    }

    await queryInterface.addIndex(
      "ServiceBookings",
      ["companyId", "companyServiceId", "activeSlotStartAt"],
      {
        name: "uniq_service_bookings_active_slot",
        unique: true
      }
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex(
      "ServiceBookings",
      "uniq_service_bookings_active_slot"
    );
    await queryInterface.removeColumn("ServiceBookings", "activeSlotStartAt");
  }
};
