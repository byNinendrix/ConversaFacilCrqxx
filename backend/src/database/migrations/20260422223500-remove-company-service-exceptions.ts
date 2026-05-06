import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await queryInterface.dropTable("CompanyServiceExceptions");
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.createTable("CompanyServiceExceptions", {
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
      exceptionDate: {
        type: DataTypes.DATEONLY,
        allowNull: false
      },
      startTime: {
        type: DataTypes.STRING,
        allowNull: true
      },
      endTime: {
        type: DataTypes.STRING,
        allowNull: true
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      reason: {
        type: DataTypes.STRING,
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
      "CompanyServiceExceptions",
      ["companyId", "companyServiceId", "exceptionDate", "isActive"],
      {
        name: "idx_company_service_exceptions_lookup"
      }
    );

    await queryInterface.addIndex(
      "CompanyServiceExceptions",
      ["companyServiceId", "exceptionDate", "startTime", "endTime"],
      {
        name: "uniq_company_service_exceptions_slot",
        unique: true
      }
    );
  }
};
