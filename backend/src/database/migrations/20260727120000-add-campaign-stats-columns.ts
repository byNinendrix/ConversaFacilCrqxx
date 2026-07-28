import { QueryInterface, DataTypes } from "sequelize";

async function columnExists(
  queryInterface: QueryInterface,
  tableName: string,
  columnName: string
) {
  const table = await queryInterface.describeTable(tableName);
  return Object.prototype.hasOwnProperty.call(table, columnName);
}

async function addColumnIfMissing(
  queryInterface: QueryInterface,
  tableName: string,
  columnName: string,
  definition: any
) {
  if (await columnExists(queryInterface, tableName, columnName)) return;
  await queryInterface.addColumn(tableName, columnName, definition);
}

async function removeColumnIfExists(
  queryInterface: QueryInterface,
  tableName: string,
  columnName: string
) {
  if (!(await columnExists(queryInterface, tableName, columnName))) return;
  await queryInterface.removeColumn(tableName, columnName);
}

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    await addColumnIfMissing(queryInterface, "Campaigns", "validContactsCount", {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    });
    await addColumnIfMissing(queryInterface, "Campaigns", "deliveredCount", {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    });
    await addColumnIfMissing(
      queryInterface,
      "Campaigns",
      "confirmationRequestedCount",
      {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      }
    );
    await addColumnIfMissing(queryInterface, "Campaigns", "confirmedCount", {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    });
    await addColumnIfMissing(queryInterface, "Campaigns", "lastStatsAt", {
      type: DataTypes.DATE,
      allowNull: true
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await removeColumnIfExists(queryInterface, "Campaigns", "lastStatsAt");
    await removeColumnIfExists(queryInterface, "Campaigns", "confirmedCount");
    await removeColumnIfExists(
      queryInterface,
      "Campaigns",
      "confirmationRequestedCount"
    );
    await removeColumnIfExists(queryInterface, "Campaigns", "deliveredCount");
    await removeColumnIfExists(
      queryInterface,
      "Campaigns",
      "validContactsCount"
    );
  }
};
