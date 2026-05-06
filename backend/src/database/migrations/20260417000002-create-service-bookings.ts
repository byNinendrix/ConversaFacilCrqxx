import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("ServiceBookings", {
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
      whatsappId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Whatsapps", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      contactId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Contacts", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      ticketId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Tickets", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      companyServiceId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "CompanyServices", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      createdByUserId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      startAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      endAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "scheduled"
      },
      source: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "whatsapp"
      },
      customerNameSnapshot: {
        type: DataTypes.STRING,
        allowNull: true
      },
      customerNumberSnapshot: {
        type: DataTypes.STRING,
        allowNull: true
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      confirmedAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      cancelledAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      contextJson: {
        type: DataTypes.JSON,
        allowNull: true
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
      "ServiceBookings",
      ["companyId", "whatsappId", "status", "startAt"],
      { name: "idx_service_bookings_company_whatsapp_status_start" }
    );

    await queryInterface.addIndex(
      "ServiceBookings",
      ["companyServiceId", "startAt", "status"],
      { name: "idx_service_bookings_service_start_status" }
    );

    await queryInterface.addIndex("ServiceBookings", ["ticketId"], {
      name: "idx_service_bookings_ticket_id"
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex(
      "ServiceBookings",
      "idx_service_bookings_ticket_id"
    );
    await queryInterface.removeIndex(
      "ServiceBookings",
      "idx_service_bookings_service_start_status"
    );
    await queryInterface.removeIndex(
      "ServiceBookings",
      "idx_service_bookings_company_whatsapp_status_start"
    );

    await queryInterface.dropTable("ServiceBookings");
  }
};
