/* eslint-disable no-console */
const sequelize = require("../dist/database").default;
const Company = require("../dist/models/Company").default;
const CompanyService = require("../dist/models/CompanyService").default;
const Contact = require("../dist/models/Contact").default;
const Whatsapp = require("../dist/models/Whatsapp").default;
const ServiceBooking = require("../dist/models/ServiceBooking").default;
const ConfirmPaymentService =
  require("../dist/services/ServiceBookingServices/ConfirmPaymentService").default;

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
      name: "Stress Payment Idempotency Service",
      description: "Temporary service for duplicate payment simulation",
      isActive: true,
      showPrice: false,
      displayOrder: 999,
      price: 95,
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
      name: `Stress Idempotency WhatsApp ${companyId}`,
      status: "CONNECTED",
      session: "",
      number: `stress-idempotency-whatsapp-${companyId}`,
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
      name: "Stress Idempotency Contact",
      number: `55${Date.now()}${Math.floor(Math.random() * 1000)}`,
      email: "stress-idempotency@test.local",
      active: true
    });
    createdResources.contactId = contact.id;
  }

  const startAt = new Date(Date.now() + 1000 * 60 * 120);
  startAt.setSeconds(0, 0);
  const endAt = new Date(startAt.getTime() + 30 * 60 * 1000);

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
    depositAmount: 25,
    paymentDueAt: new Date(Date.now() + 15 * 60 * 1000),
    paymentReference: `IDEMP-${Date.now()}`,
    pixTxId: `IDEMPTX${Date.now()}`,
    pixPayload: "00020126580014BR.GOV.BCB.PIX0136simulate-idempotency520400005303986540525.005802BR5925SIMULACAO IDEMPOTENTE6009FORTALEZA62070503IDE6304ABCD",
    pixExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
    source: "stress_payment_idempotency",
    customerNameSnapshot: "stress-idempotency",
    customerNumberSnapshot: `${contact.number || "0000000000"}`,
    contextJson: { scenario: "payment_webhook_twice" }
  });

  const first = await ConfirmPaymentService({
    companyId,
    bookingId: booking.id,
    paymentReference: `IDEMP-${Date.now()}-1`,
    pixTxId: booking.pixTxId,
    source: "webhook"
  });

  const second = await ConfirmPaymentService({
    companyId,
    pixTxId: booking.pixTxId,
    paymentReference: `IDEMP-${Date.now()}-2`,
    source: "webhook"
  });

  const refreshed = await ServiceBooking.findByPk(booking.id);

  console.log(
    JSON.stringify(
      {
        bookingId: booking.id,
        firstAlreadyProcessed: first.alreadyProcessed,
        secondAlreadyProcessed: second.alreadyProcessed,
        finalStatus: refreshed?.status,
        finalPaymentStatus: refreshed?.paymentStatus,
        paidAt: refreshed?.paidAt || null,
        paymentReference: refreshed?.paymentReference || null,
        pixTxId: refreshed?.pixTxId || null
      },
      null,
      2
    )
  );

  await ServiceBooking.destroy({
    where: {
      id: booking.id,
      companyId
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
