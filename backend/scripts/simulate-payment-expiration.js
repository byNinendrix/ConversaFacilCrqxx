/* eslint-disable no-console */
const sequelize = require("../dist/database").default;
const Company = require("../dist/models/Company").default;
const CompanyService = require("../dist/models/CompanyService").default;
const Contact = require("../dist/models/Contact").default;
const Whatsapp = require("../dist/models/Whatsapp").default;
const ServiceBooking = require("../dist/models/ServiceBooking").default;
const {
  runServiceBookingPaymentExpirationCleanup
} = require("../dist/services/SchedulingServices/ServiceBookingPaymentExpirationJob");

async function run() {
  const company = await Company.findOne({ order: [["id", "ASC"]] });
  if (!company) {
    throw new Error("No company found for simulation.");
  }

  const companyId = Number(company.id);
  const createdResources = {
    serviceId: null,
    whatsappId: null,
    contactId: null
  };

  let service = await CompanyService.findOne({
    where: { companyId, isActive: true },
    order: [["id", "ASC"]]
  });
  if (!service) {
    service = await CompanyService.create({
      companyId,
      name: "Stress Payment Expiration Service",
      description: "Temporary service for payment expiration simulation",
      isActive: true,
      showPrice: false,
      displayOrder: 999,
      price: 80,
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
      name: `Stress Expiration WhatsApp ${companyId}`,
      status: "CONNECTED",
      session: "",
      number: `stress-expiration-whatsapp-${companyId}`,
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
      name: "Stress Expiration Contact",
      number: `55${Date.now()}${Math.floor(Math.random() * 1000)}`,
      email: "stress-expiration@test.local",
      active: true
    });
    createdResources.contactId = contact.id;
  }

  const startAt = new Date(Date.now() + 1000 * 60 * 90);
  startAt.setSeconds(0, 0);
  const endAt = new Date(startAt.getTime() + 30 * 60 * 1000);

  await ServiceBooking.destroy({
    where: {
      companyId,
      companyServiceId: service.id,
      startAt,
      source: "stress_payment_expiration"
    }
  });

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
    depositAmount: 20,
    paymentDueAt: new Date(Date.now() - 60 * 1000),
    paymentReference: `EXP-${Date.now()}`,
    pixTxId: `EXPTX${Date.now()}`,
    pixPayload: "00020126580014BR.GOV.BCB.PIX0136simulate-expiration520400005303986540520.005802BR5925SIMULACAO EXPIRACAO6009FORTALEZA62070503EXP6304ABCD",
    pixExpiresAt: new Date(Date.now() - 60 * 1000),
    source: "stress_payment_expiration",
    customerNameSnapshot: "stress-expiration",
    customerNumberSnapshot: `${contact.number || "0000000000"}`,
    contextJson: { scenario: "payment_expiration_cleanup" }
  });

  await runServiceBookingPaymentExpirationCleanup();

  const refreshed = await ServiceBooking.findByPk(booking.id);
  console.log(
    JSON.stringify(
      {
        bookingId: booking.id,
        status: refreshed?.status,
        paymentStatus: refreshed?.paymentStatus,
        activeSlotStartAt: refreshed?.activeSlotStartAt || null,
        pixTxId: refreshed?.pixTxId || null,
        pixExpiresAt: refreshed?.pixExpiresAt || null
      },
      null,
      2
    )
  );

  await ServiceBooking.destroy({
    where: {
      companyId,
      source: "stress_payment_expiration",
      id: booking.id
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
  .then(() => {
    setTimeout(() => process.exit(0), 50);
  })
  .catch(error => {
    console.error(error);
    setTimeout(() => process.exit(1), 50);
  });
