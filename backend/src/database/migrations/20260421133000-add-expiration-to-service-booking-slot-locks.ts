import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("ServiceBookingSlotLocks", "expiresAt", {
      type: DataTypes.DATE,
      allowNull: true
    });

    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === "postgres") {
      await queryInterface.sequelize.query(`
        UPDATE "ServiceBookingSlotLocks"
        SET "expiresAt" = COALESCE("updatedAt", "createdAt") + INTERVAL '2 minutes'
        WHERE "expiresAt" IS NULL
      `);
    } else {
      await queryInterface.sequelize.query(`
        UPDATE ServiceBookingSlotLocks
        SET expiresAt = DATE_ADD(COALESCE(updatedAt, createdAt), INTERVAL 2 MINUTE)
        WHERE expiresAt IS NULL
      `);
    }

    await queryInterface.changeColumn("ServiceBookingSlotLocks", "expiresAt", {
      type: DataTypes.DATE,
      allowNull: false
    });

    await queryInterface.addIndex("ServiceBookingSlotLocks", ["expiresAt"], {
      name: "idx_service_booking_slot_locks_expires_at"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex(
      "ServiceBookingSlotLocks",
      "idx_service_booking_slot_locks_expires_at"
    );
    await queryInterface.removeColumn("ServiceBookingSlotLocks", "expiresAt");
  }
};
