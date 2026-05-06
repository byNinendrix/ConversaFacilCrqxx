import { QueryInterface } from "sequelize";

const hasConstraint = async (
  queryInterface: QueryInterface,
  constraintName: string
) => {
  const [rows] = await queryInterface.sequelize.query(
    "SELECT 1 FROM pg_constraint WHERE conname = :constraintName LIMIT 1;",
    { replacements: { constraintName } }
  );

  return Array.isArray(rows) && rows.length > 0;
};

export default {
  up: async (queryInterface: QueryInterface) => {
    try {
      await queryInterface.removeConstraint("Whatsapps", "Whatsapps_name_key");
    } catch (e) {
      // noop
    }

    const alreadyExists = await hasConstraint(
      queryInterface,
      "company_name_constraint"
    );

    if (!alreadyExists) {
      await queryInterface.addConstraint("Whatsapps", ["companyId", "name"], {
        type: "unique",
        name: "company_name_constraint"
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    try {
      await queryInterface.removeConstraint(
        "Whatsapps",
        "company_name_constraint"
      );
    } catch (e) {
      // noop
    }

    const alreadyExists = await hasConstraint(
      queryInterface,
      "Whatsapps_name_key"
    );

    if (!alreadyExists) {
      await queryInterface.addConstraint("Whatsapps", ["name"], {
        type: "unique",
        name: "Whatsapps_name_key"
      });
    }
  }
};