import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("CompanyServiceAvailabilities", {
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
      weekday: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      startTime: {
        type: DataTypes.STRING,
        allowNull: false
      },
      endTime: {
        type: DataTypes.STRING,
        allowNull: false
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
      "CompanyServiceAvailabilities",
      ["companyId", "companyServiceId"],
      {
        name: "idx_company_service_availabilities_company_service"
      }
    );

    await queryInterface.addIndex(
      "CompanyServiceAvailabilities",
      ["companyServiceId", "weekday", "isActive"],
      {
        name: "idx_company_service_availabilities_service_weekday_active"
      }
    );

    await queryInterface.addIndex(
      "CompanyServiceAvailabilities",
      ["companyServiceId", "weekday", "startTime", "endTime"],
      {
        name: "uniq_company_service_availabilities_slot",
        unique: true
      }
    );
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex(
      "CompanyServiceAvailabilities",
      "uniq_company_service_availabilities_slot"
    );
    await queryInterface.removeIndex(
      "CompanyServiceAvailabilities",
      "idx_company_service_availabilities_service_weekday_active"
    );
    await queryInterface.removeIndex(
      "CompanyServiceAvailabilities",
      "idx_company_service_availabilities_company_service"
    );

    await queryInterface.dropTable("CompanyServiceAvailabilities");
  }
};
