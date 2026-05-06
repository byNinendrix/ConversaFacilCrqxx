import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("ServiceBookingSlotLocks", {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Companies", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      companyServiceId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "CompanyServices", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      startAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    await queryInterface.addIndex(
      "ServiceBookingSlotLocks",
      ["companyId", "companyServiceId", "startAt"],
      {
        name: "uniq_service_booking_slot_locks",
        unique: true
      }
    );

    await queryInterface.addIndex(
      "ServiceBookingSlotLocks",
      ["companyServiceId", "startAt"],
      {
        name: "idx_service_booking_slot_locks_service_start"
      }
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex(
      "ServiceBookingSlotLocks",
      "idx_service_booking_slot_locks_service_start"
    );

    await queryInterface.removeIndex(
      "ServiceBookingSlotLocks",
      "uniq_service_booking_slot_locks"
    );

    await queryInterface.dropTable("ServiceBookingSlotLocks");
  }
};
