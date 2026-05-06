import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("ServiceSchedulingSessions", {
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
      ticketId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Tickets", key: "id" },
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
      selectedServiceId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "CompanyServices", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "active"
      },
      currentStep: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "service_selection"
      },
      selectedDate: {
        type: DataTypes.DATEONLY,
        allowNull: true
      },
      selectedStartAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      selectedEndAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      contextJson: {
        type: DataTypes.JSON,
        allowNull: true
      },
      lastInteractionAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      expiresAt: {
        type: DataTypes.DATE,
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
      "ServiceSchedulingSessions",
      ["companyId", "whatsappId", "ticketId", "status"],
      { name: "idx_service_scheduling_sessions_lookup" }
    );

    await queryInterface.addIndex(
      "ServiceSchedulingSessions",
      ["ticketId", "status"],
      { name: "idx_service_scheduling_sessions_ticket_status" }
    );

    await queryInterface.addIndex(
      "ServiceSchedulingSessions",
      ["expiresAt", "status"],
      { name: "idx_service_scheduling_sessions_expiration" }
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex(
      "ServiceSchedulingSessions",
      "idx_service_scheduling_sessions_expiration"
    );
    await queryInterface.removeIndex(
      "ServiceSchedulingSessions",
      "idx_service_scheduling_sessions_ticket_status"
    );
    await queryInterface.removeIndex(
      "ServiceSchedulingSessions",
      "idx_service_scheduling_sessions_lookup"
    );

    await queryInterface.dropTable("ServiceSchedulingSessions");
  }
};
