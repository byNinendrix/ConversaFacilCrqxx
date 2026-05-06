import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.addColumn("CompanyServiceAvailabilities", "capacity", {
      type: DataTypes.INTEGER,
      allowNull: true
    });

    await queryInterface.createTable("CompanyServiceSpecificSlots", {
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
      professionalId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: "Users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL"
      },
      slotDate: {
        type: DataTypes.DATEONLY,
        allowNull: false
      },
      startTime: {
        type: DataTypes.STRING,
        allowNull: false
      },
      endTime: {
        type: DataTypes.STRING,
        allowNull: true
      },
      capacity: {
        type: DataTypes.INTEGER,
        allowNull: true
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
      "CompanyServiceSpecificSlots",
      ["companyId", "companyServiceId", "slotDate", "isActive"],
      {
        name: "idx_company_service_specific_slots_lookup"
      }
    );

    await queryInterface.addIndex(
      "CompanyServiceSpecificSlots",
      [
        "companyServiceId",
        "professionalId",
        "slotDate",
        "startTime"
      ],
      {
        name: "uniq_company_service_specific_slots_prof_date_time",
        unique: true
      }
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex(
      "CompanyServiceSpecificSlots",
      "uniq_company_service_specific_slots_prof_date_time"
    );

    await queryInterface.removeIndex(
      "CompanyServiceSpecificSlots",
      "idx_company_service_specific_slots_lookup"
    );

    await queryInterface.dropTable("CompanyServiceSpecificSlots");
    await queryInterface.removeColumn("CompanyServiceAvailabilities", "capacity");
  }
};
