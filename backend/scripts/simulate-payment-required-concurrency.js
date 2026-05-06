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
      name: "Stress Required Payment Service",
      description: "Temporary service for pending payment concurrency simulation",
      isActive: true,
      showPrice: false,
      displayOrder: 999,
      price: 120,
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
      name: `Stress Payment WhatsApp ${companyId}`,
      status: "CONNECTED",
      session: "",
      number: `stress-payment-whatsapp-${companyId}`,
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
      name: "Stress Payment Contact",
      number: `55${Date.now()}${Math.floor(Math.random() * 1000)}`,
      email: "stress-payment@test.local",
      active: true
    });
    createdResources.contactId = contact.id;
  }

  const startAt = new Date(Date.now() + 1000 * 60 * 60);
  startAt.setSeconds(0, 0);
  const durationMinutes = Math.max(Number(service.durationMinutes || 30), 5);
  const endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);
  const paymentDueAt = new Date(Date.now() + 1000 * 60 * 10);

  await ServiceBooking.destroy({
    where: {
      companyId,
      companyServiceId: service.id,
      startAt,
      source: "stress_payment_required"
    }
  });

  const attempts = 10;
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
          status: "pending_payment",
          paymentStatus: "pending",
          depositAmount: 30,
          paymentDueAt,
          paymentReference: `SIM-${Date.now()}-${index + 1}`,
          pixTxId: `SIMTX${Date.now()}${index + 1}`,
          pixPayload: `00020126580014BR.GOV.BCB.PIX0136simulacao-required-${index + 1}520400005303986540530.005802BR5925SIMULACAO PAGAMENTO PIX6009FORTALEZA62070503SIM6304ABCD`,
          pixExpiresAt: paymentDueAt,
          source: "stress_payment_required",
          customerNameSnapshot: `stress-payment-${index + 1}`,
          customerNumberSnapshot: `${contact.number || "0000000000"}-${index + 1}`,
          contextJson: { scenario: "required_payment_concurrency", attempt: index + 1 }
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

  const activePendingCount = await ServiceBooking.count({
    where: {
      companyId,
      companyServiceId: service.id,
      startAt,
      status: "pending_payment",
      paymentStatus: "pending",
      source: "stress_payment_required"
    }
  });

  console.log(
    JSON.stringify(
      {
        attempts,
        successCount: successes.length,
        failureCount: failures.length,
        uniqueConstraintFailures: uniqueFailures.length,
        activePendingCount,
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
      source: "stress_payment_required"
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
