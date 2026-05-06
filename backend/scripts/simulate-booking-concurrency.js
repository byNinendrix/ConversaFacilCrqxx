/* eslint-disable no-console */
const sequelize = require("../dist/database").default;
const CompanyService = require("../dist/models/CompanyService").default;
const Company = require("../dist/models/Company").default;
const Contact = require("../dist/models/Contact").default;
const Whatsapp = require("../dist/models/Whatsapp").default;
const ServiceBooking = require("../dist/models/ServiceBooking").default;

async function run() {
  let service = await CompanyService.findOne({
    where: { isActive: true },
    order: [["id", "ASC"]]
  });

  let company = service
    ? await Company.findByPk(service.companyId)
    : await Company.findOne({ order: [["id", "ASC"]] });

  if (!company) {
    throw new Error("No company found for simulation.");
  }

  const companyId = Number(company.id);
  const createdResources = {
    serviceId: null,
    whatsappId: null,
    contactId: null
  };

  if (!service) {
    service = await CompanyService.create({
      companyId,
      name: "Stress Test Service",
      description: "Temporary service for booking concurrency simulation",
      isActive: true,
      showPrice: false,
      displayOrder: 999,
      price: 0,
      durationMinutes: 30,
      intervalMinutes: 0,
      minAdvanceMinutes: 0,
      maxAdvanceDays: 30,
      maxBookingsPerSlot: 1
    });
    createdResources.serviceId = service.id;
  }

  let whatsapp = await Whatsapp.findOne({
    where: { companyId },
    order: [["id", "ASC"]]
  });

  if (!whatsapp) {
    whatsapp = await Whatsapp.create({
      companyId,
      name: `Stress Test WhatsApp ${companyId}`,
      status: "CONNECTED",
      session: "",
      number: `stress-whatsapp-${companyId}`,
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
      name: "Stress Test Contact",
      number: `55${Date.now()}${Math.floor(Math.random() * 1000)}`,
      email: "stress@test.local",
      active: true
    });
    createdResources.contactId = contact.id;
  }

  const startAt = new Date(Date.now() + 1000 * 60 * 60);
  startAt.setSeconds(0, 0);
  const durationMinutes = Math.max(Number(service.durationMinutes || 30), 5);
  const endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);

  await ServiceBooking.destroy({
    where: {
      companyId,
      companyServiceId: service.id,
      startAt,
      source: "stress_test"
    }
  });

  const attempts = 50;
  const startedAt = Date.now();
  const results = await Promise.all(
    Array.from({ length: attempts }).map(async (_, index) => {
      try {
        const booking = await ServiceBooking.create({
          companyId,
          whatsappId: whatsapp.id,
          contactId: contact.id,
          ticketId: null,
          companyServiceId: service.id,
          startAt,
          endAt,
          status: "confirmed",
          source: "stress_test",
          customerNameSnapshot: `stress-contact-${index}`,
          customerNumberSnapshot: `${contact.number || "0000000000"}-${index}`,
          contextJson: { scenario: "concurrency_simulation", attempt: index + 1 }
        });

        return {
          ok: true,
          bookingId: booking.id
        };
      } catch (error) {
        return {
          ok: false,
          name: String(error?.name || "Error"),
          message: String(error?.message || error)
        };
      }
    })
  );

  const successes = results.filter(result => result.ok);
  const failures = results.filter(result => !result.ok);
  const uniqueFailures = failures.filter(
    result =>
      String(result.name).includes("UniqueConstraintError") ||
      String(result.message).toLowerCase().includes("duplicate")
  );

  console.log(
    JSON.stringify(
      {
        attempts,
        successCount: successes.length,
        failureCount: failures.length,
        uniqueConstraintFailures: uniqueFailures.length,
        elapsedMs: Date.now() - startedAt
      },
      null,
      2
    )
  );

  await ServiceBooking.destroy({
    where: {
      companyId,
      companyServiceId: service.id,
      startAt,
      source: "stress_test"
    }
  });

  if (createdResources.contactId) {
    await Contact.destroy({ where: { id: createdResources.contactId } });
  }
  if (createdResources.whatsappId) {
    await Whatsapp.destroy({ where: { id: createdResources.whatsappId } });
  }
  if (createdResources.serviceId) {
    await CompanyService.destroy({ where: { id: createdResources.serviceId } });
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
