import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("ServiceBookings", "paymentStatus", {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "not_required"
    });

    await queryInterface.addColumn("ServiceBookings", "depositAmount", {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    });

    await queryInterface.addColumn("ServiceBookings", "paymentDueAt", {
      type: DataTypes.DATE,
      allowNull: true
    });

    await queryInterface.addColumn("ServiceBookings", "paidAt", {
      type: DataTypes.DATE,
      allowNull: true
    });

    await queryInterface.addColumn("ServiceBookings", "paymentReference", {
      type: DataTypes.STRING,
      allowNull: true
    });

    await queryInterface.addIndex(
      "ServiceBookings",
      ["companyId", "paymentStatus", "paymentDueAt", "status"],
      {
        name: "idx_service_bookings_company_payment_status_due_status"
      }
    );

    await queryInterface.addIndex(
      "ServiceBookings",
      ["companyId", "status", "paymentStatus", "startAt"],
      {
        name: "idx_service_bookings_company_status_payment_start"
      }
    );

    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === "postgres") {
      await queryInterface.sequelize.query(`
        UPDATE "ServiceBookings"
        SET "activeSlotStartAt" = "startAt"
        WHERE "status" = 'pending_payment'
      `);
    } else {
      await queryInterface.sequelize.query(`
        UPDATE ServiceBookings
        SET activeSlotStartAt = startAt
        WHERE status = 'pending_payment'
      `);
    }
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex(
      "ServiceBookings",
      "idx_service_bookings_company_status_payment_start"
    );

    await queryInterface.removeIndex(
      "ServiceBookings",
      "idx_service_bookings_company_payment_status_due_status"
    );

    await queryInterface.removeColumn("ServiceBookings", "paymentReference");
    await queryInterface.removeColumn("ServiceBookings", "paidAt");
    await queryInterface.removeColumn("ServiceBookings", "paymentDueAt");
    await queryInterface.removeColumn("ServiceBookings", "depositAmount");
    await queryInterface.removeColumn("ServiceBookings", "paymentStatus");
  }
};

