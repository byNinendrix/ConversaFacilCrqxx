/* eslint-disable no-console */
const sequelize = require("../dist/database").default;
const Company = require("../dist/models/Company").default;
const CompanyService = require("../dist/models/CompanyService").default;
const CompanyServiceProfessional = require("../dist/models/CompanyServiceProfessional").default;
const Contact = require("../dist/models/Contact").default;
const ServiceBooking = require("../dist/models/ServiceBooking").default;
const User = require("../dist/models/User").default;
const Whatsapp = require("../dist/models/Whatsapp").default;

const ACTIVE_STATUSES = ["scheduled", "confirmed"];

const runScenario = async ({
  title,
  attempts,
  companyId,
  companyServiceId,
  whatsappId,
  contactId,
  slotStartAt,
  slotEndAt,
  professionalIdFactory
}) => {
  await ServiceBooking.destroy({
    where: {
      companyId,
      companyServiceId,
      startAt: slotStartAt,
      source: "stress_multi_prof"
    }
  });

  const startedAt = Date.now();
  const results = await Promise.all(
    Array.from({ length: attempts }).map(async (_, index) => {
      const professionalId = professionalIdFactory(index);
      try {
        const created = await ServiceBooking.create({
          companyId,
          whatsappId,
          contactId,
          ticketId: null,
          companyServiceId,
          professionalId,
          startAt: slotStartAt,
          endAt: slotEndAt,
          status: "confirmed",
          source: "stress_multi_prof",
          customerNameSnapshot: `scenario-${title}-user-${index + 1}`,
          customerNumberSnapshot: `scenario-${title}-phone-${index + 1}`,
          contextJson: {
            scenario: title,
            attempt: index + 1
          }
        });

        return {
          ok: true,
          bookingId: created.id,
          professionalId
        };
      } catch (error) {
        return {
          ok: false,
          professionalId,
          name: String(error?.name || "Error"),
          message: String(error?.message || error)
        };
      }
    })
  );

  const successCount = results.filter(result => result.ok).length;
  const conflictCount = results.filter(
    result =>
      !result.ok &&
      (String(result.name).includes("UniqueConstraintError") ||
        String(result.message || "").toLowerCase().includes("duplicate"))
  ).length;

  const activePersisted = await ServiceBooking.count({
    where: {
      companyId,
      companyServiceId,
      startAt: slotStartAt,
      status: ACTIVE_STATUSES,
      source: "stress_multi_prof"
    }
  });

  await ServiceBooking.destroy({
    where: {
      companyId,
      companyServiceId,
      startAt: slotStartAt,
      source: "stress_multi_prof"
    }
  });

  return {
    title,
    attempts,
    successCount,
    failureCount: attempts - successCount,
    conflictCount,
    activePersisted,
    elapsedMs: Date.now() - startedAt
  };
};

async function run() {
  const company = await Company.findOne({ order: [["id", "ASC"]] });
  if (!company) {
    throw new Error("No company found for simulation.");
  }

  const companyId = Number(company.id);
  const createdResources = {
    serviceId: null,
    whatsappId: null,
    contactId: null,
    userIds: []
  };

  const service = await CompanyService.create({
    companyId,
    name: "Stress Multi Professional Service",
    description: "Temporary service for multi professional concurrency simulation",
    isActive: true,
    showPrice: false,
    displayOrder: 9999,
    price: 0,
    durationMinutes: 30,
    intervalMinutes: 0,
    minAdvanceMinutes: 0,
    maxAdvanceDays: 30,
    maxBookingsPerSlot: 1,
    assignmentMode: "automatic"
  });
  createdResources.serviceId = service.id;

  let whatsapp = await Whatsapp.findOne({
    where: { companyId },
    order: [["id", "ASC"]]
  });
  if (!whatsapp) {
    whatsapp = await Whatsapp.create({
      companyId,
      name: `Stress Multi WhatsApp ${companyId}`,
      status: "CONNECTED",
      session: "",
      number: `stress-multi-whatsapp-${companyId}`,
      schedulingAutomationEnabled: true
    });
    createdResources.whatsappId = whatsapp.id;
  }

  let contact = await Contact.findOne({
    where: { companyId },
    order: [["id", "ASC"]]
  });
  if (!contact) {
    contact = await Contact.create({
      companyId,
      whatsappId: whatsapp.id,
      name: "Stress Multi Contact",
      number: `55${Date.now()}${Math.floor(Math.random() * 1000)}`,
      email: "stress-multi@test.local",
      active: true
    });
    createdResources.contactId = contact.id;
  }

  const professionals = await User.findAll({
    where: { companyId },
    order: [["id", "ASC"]],
    limit: 2
  });

  while (professionals.length < 2) {
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const createdUser = await User.create({
      companyId,
      name: `Stress Professional ${professionals.length + 1}`,
      email: `stress-prof-${suffix}@test.local`,
      password: "stress123",
      profile: "admin"
    });
    createdResources.userIds.push(createdUser.id);
    professionals.push(createdUser);
  }

  await CompanyServiceProfessional.bulkCreate(
    professionals.slice(0, 2).map((professional, index) => ({
      companyId,
      companyServiceId: service.id,
      userId: professional.id,
      priority: index,
      isActive: true
    }))
  );

  const firstProfessionalId = Number(professionals[0].id);
  const secondProfessionalId = Number(professionals[1].id);

  const slotStartAt = new Date(Date.now() + 1000 * 60 * 60);
  slotStartAt.setSeconds(0, 0);
  const slotEndAt = new Date(
    slotStartAt.getTime() + Math.max(Number(service.durationMinutes || 30), 5) * 60 * 1000
  );

  const sameProfessionalResult = await runScenario({
    title: "same-professional",
    attempts: 20,
    companyId,
    companyServiceId: service.id,
    whatsappId: whatsapp.id,
    contactId: contact.id,
    slotStartAt,
    slotEndAt,
    professionalIdFactory: () => firstProfessionalId
  });

  const multipleProfessionalResult = await runScenario({
    title: "multiple-professionals",
    attempts: 20,
    companyId,
    companyServiceId: service.id,
    whatsappId: whatsapp.id,
    contactId: contact.id,
    slotStartAt,
    slotEndAt,
    professionalIdFactory: index =>
      index % 2 === 0 ? firstProfessionalId : secondProfessionalId
  });

  console.log(
    JSON.stringify(
      {
        sameProfessionalResult,
        multipleProfessionalResult
      },
      null,
      2
    )
  );

  await CompanyServiceProfessional.destroy({
    where: {
      companyId,
      companyServiceId: service.id
    }
  });
  await CompanyService.destroy({ where: { id: service.id } });

  if (createdResources.contactId) {
    await Contact.destroy({ where: { id: createdResources.contactId } });
  }
  if (createdResources.whatsappId) {
    await Whatsapp.destroy({ where: { id: createdResources.whatsappId } });
  }
  if (createdResources.userIds.length) {
    await User.destroy({ where: { id: createdResources.userIds } });
  }
}

run()
  .then(async () => {
    await sequelize.close();
  })
  .catch(async error => {
    console.error(error);
    await sequelize.close();
    process.exitCode = 1;
  });
