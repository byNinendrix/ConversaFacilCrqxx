import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("CompanyServices", "assignmentMode", {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "automatic"
    });

    await queryInterface.createTable("CompanyServiceProfessionals", {
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
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      },
      priority: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
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
      "CompanyServiceProfessionals",
      ["companyId", "companyServiceId", "userId"],
      {
        name: "uniq_company_service_professionals_service_user",
        unique: true
      }
    );

    await queryInterface.addIndex(
      "CompanyServiceProfessionals",
      ["companyId", "companyServiceId", "isActive", "priority"],
      {
        name: "idx_company_service_professionals_lookup"
      }
    );

    await queryInterface.addIndex(
      "CompanyServiceProfessionals",
      ["companyId", "userId", "isActive"],
      {
        name: "idx_company_service_professionals_company_user_active"
      }
    );

    await queryInterface.addColumn(
      "CompanyServiceAvailabilities",
      "professionalId",
      {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      }
    );

    await queryInterface.removeIndex(
      "CompanyServiceAvailabilities",
      "uniq_company_service_availabilities_slot"
    );

    await queryInterface.addIndex(
      "CompanyServiceAvailabilities",
      ["companyServiceId", "professionalId", "weekday", "startTime", "endTime"],
      {
        name: "uniq_company_service_availabilities_prof_slot",
        unique: true
      }
    );

    await queryInterface.addIndex(
      "CompanyServiceAvailabilities",
      ["companyId", "companyServiceId", "professionalId", "weekday", "isActive"],
      {
        name: "idx_company_service_availabilities_professional_lookup"
      }
    );

    await queryInterface.addColumn("ServiceBookings", "professionalId", {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "Users", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL"
    });

    await queryInterface.addColumn("ServiceBookings", "activeSlotResourceKey", {
      type: DataTypes.STRING,
      allowNull: true
    });

    const dialect = queryInterface.sequelize.getDialect();
    if (dialect === "postgres") {
      await queryInterface.sequelize.query(`
        UPDATE "ServiceBookings"
        SET "activeSlotResourceKey" = CASE
          WHEN "status" IN ('scheduled', 'confirmed') THEN
            CASE
              WHEN "professionalId" IS NULL THEN 'service'
              ELSE 'professional:' || "professionalId"::text
            END
          ELSE NULL
        END
      `);
    } else {
      await queryInterface.sequelize.query(`
        UPDATE ServiceBookings
        SET activeSlotResourceKey = CASE
          WHEN status IN ('scheduled', 'confirmed') THEN
            CASE
              WHEN professionalId IS NULL THEN 'service'
              ELSE CONCAT('professional:', professionalId)
            END
          ELSE NULL
        END
      `);
    }

    await queryInterface.removeIndex(
      "ServiceBookings",
      "uniq_service_bookings_active_slot"
    );

    await queryInterface.addIndex(
      "ServiceBookings",
      [
        "companyId",
        "companyServiceId",
        "activeSlotStartAt",
        "activeSlotResourceKey"
      ],
      {
        name: "uniq_service_bookings_active_slot_resource",
        unique: true
      }
    );

    await queryInterface.addIndex(
      "ServiceBookings",
      ["companyId", "companyServiceId", "professionalId", "status", "startAt"],
      {
        name: "idx_service_bookings_company_service_prof_status_start"
      }
    );

    await queryInterface.addColumn("ServiceBookingSlotLocks", "professionalId", {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "Users", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL"
    });

    await queryInterface.addColumn("ServiceBookingSlotLocks", "resourceKey", {
      type: DataTypes.STRING,
      allowNull: true
    });

    if (dialect === "postgres") {
      await queryInterface.sequelize.query(`
        UPDATE "ServiceBookingSlotLocks"
        SET "resourceKey" = CASE
          WHEN "professionalId" IS NULL THEN 'service'
          ELSE 'professional:' || "professionalId"::text
        END
      `);
    } else {
      await queryInterface.sequelize.query(`
        UPDATE ServiceBookingSlotLocks
        SET resourceKey = CASE
          WHEN professionalId IS NULL THEN 'service'
          ELSE CONCAT('professional:', professionalId)
        END
      `);
    }

    await queryInterface.changeColumn("ServiceBookingSlotLocks", "resourceKey", {
      type: DataTypes.STRING,
      allowNull: false
    });

    await queryInterface.removeIndex(
      "ServiceBookingSlotLocks",
      "uniq_service_booking_slot_locks"
    );

    await queryInterface.addIndex(
      "ServiceBookingSlotLocks",
      ["companyId", "companyServiceId", "startAt", "resourceKey"],
      {
        name: "uniq_service_booking_slot_locks_resource",
        unique: true
      }
    );

    await queryInterface.addIndex(
      "ServiceBookingSlotLocks",
      ["companyId", "companyServiceId", "professionalId", "startAt", "expiresAt"],
      {
        name: "idx_service_booking_slot_locks_service_prof_start"
      }
    );

    await queryInterface.addColumn(
      "ServiceSchedulingSessions",
      "selectedProfessionalId",
      {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      }
    );

    await queryInterface.addIndex(
      "ServiceSchedulingSessions",
      ["companyId", "selectedProfessionalId", "status"],
      {
        name: "idx_service_scheduling_sessions_selected_professional"
      }
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex(
      "ServiceSchedulingSessions",
      "idx_service_scheduling_sessions_selected_professional"
    );
    await queryInterface.removeColumn(
      "ServiceSchedulingSessions",
      "selectedProfessionalId"
    );

    await queryInterface.removeIndex(
      "ServiceBookingSlotLocks",
      "idx_service_booking_slot_locks_service_prof_start"
    );
    await queryInterface.removeIndex(
      "ServiceBookingSlotLocks",
      "uniq_service_booking_slot_locks_resource"
    );

    await queryInterface.addIndex(
      "ServiceBookingSlotLocks",
      ["companyId", "companyServiceId", "startAt"],
      {
        name: "uniq_service_booking_slot_locks",
        unique: true
      }
    );

    await queryInterface.removeColumn("ServiceBookingSlotLocks", "resourceKey");
    await queryInterface.removeColumn(
      "ServiceBookingSlotLocks",
      "professionalId"
    );

    await queryInterface.removeIndex(
      "ServiceBookings",
      "idx_service_bookings_company_service_prof_status_start"
    );
    await queryInterface.removeIndex(
      "ServiceBookings",
      "uniq_service_bookings_active_slot_resource"
    );

    await queryInterface.addIndex(
      "ServiceBookings",
      ["companyId", "companyServiceId", "activeSlotStartAt"],
      {
        name: "uniq_service_bookings_active_slot",
        unique: true
      }
    );

    await queryInterface.removeColumn("ServiceBookings", "activeSlotResourceKey");
    await queryInterface.removeColumn("ServiceBookings", "professionalId");

    await queryInterface.removeIndex(
      "CompanyServiceAvailabilities",
      "idx_company_service_availabilities_professional_lookup"
    );
    await queryInterface.removeIndex(
      "CompanyServiceAvailabilities",
      "uniq_company_service_availabilities_prof_slot"
    );

    await queryInterface.addIndex(
      "CompanyServiceAvailabilities",
      ["companyServiceId", "weekday", "startTime", "endTime"],
      {
        name: "uniq_company_service_availabilities_slot",
        unique: true
      }
    );

    await queryInterface.removeColumn(
      "CompanyServiceAvailabilities",
      "professionalId"
    );

    await queryInterface.removeIndex(
      "CompanyServiceProfessionals",
      "idx_company_service_professionals_company_user_active"
    );
    await queryInterface.removeIndex(
      "CompanyServiceProfessionals",
      "idx_company_service_professionals_lookup"
    );
    await queryInterface.removeIndex(
      "CompanyServiceProfessionals",
      "uniq_company_service_professionals_service_user"
    );
    await queryInterface.dropTable("CompanyServiceProfessionals");

    await queryInterface.removeColumn("CompanyServices", "assignmentMode");
  }
};
