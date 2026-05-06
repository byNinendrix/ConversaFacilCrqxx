import Company from "../../models/Company";
import CompanyService from "../../models/CompanyService";
import Plan from "../../models/Plan";
import Setting from "../../models/Setting";

const FindAllCompanyService = async (): Promise<Company[]> => {
  const companies = await Company.findAll({
    order: [["name", "ASC"]],
    include: [
      { model: Plan, as: "plan", attributes: ["id", "name", "value", "useSchedules"] },
      { model: Setting, as: "settings" },
      {
        model: CompanyService,
        as: "companyServices",
        attributes: ["id", "name", "price", "assignmentMode"]
      }
    ]
  });
  return companies;
};

export default FindAllCompanyService;
