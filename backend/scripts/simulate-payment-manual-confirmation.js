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
      name: "Stress Manual Confirmation Service",
      description: "Temporary service for manual payment confirmation simulation",
      isActive: true,
      showPrice: false,
      displayOrder: 999,
      price: 110,
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
      name: `Stress Manual WhatsApp ${companyId}`,
      status: "CONNECTED",
      session: "",
      number: `stress-manual-whatsapp-${companyId}`,
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
      name: "Stress Manual Contact",
      number: `55${Date.now()}${Math.floor(Math.random() * 1000)}`,
      email: "stress-manual@test.local",
      active: true
    });
    createdResources.contactId = contact.id;
  }

  const randomOffsetMinutes = 720 + Math.floor(Math.random() * 1440);
  const startAt = new Date(Date.now() + 1000 * 60 * randomOffsetMinutes);
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
    depositAmount: 40,
    paymentDueAt: new Date(Date.now() + 15 * 60 * 1000),
    paymentReference: `MANUAL-${Date.now()}`,
    pixTxId: `MANUALTX${Date.now()}`,
    pixPayload: "00020126580014BR.GOV.BCB.PIX0136simulate-manual520400005303986540540.005802BR5925SIMULACAO MANUAL6009FORTALEZA62070503MAN6304ABCD",
    pixExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
    source: "stress_payment_manual_confirmation",
    customerNameSnapshot: "stress-manual",
    customerNumberSnapshot: `${contact.number || "0000000000"}`,
    contextJson: { scenario: "manual_payment_confirmation" }
  });

  const result = await ConfirmPaymentService({
    companyId,
    bookingId: booking.id,
    paymentReference: booking.paymentReference,
    pixTxId: booking.pixTxId,
    source: "manual"
  });

  const refreshed = await ServiceBooking.findByPk(booking.id);
  console.log(
    JSON.stringify(
      {
        bookingId: booking.id,
        alreadyProcessed: result.alreadyProcessed,
        finalStatus: refreshed?.status,
        finalPaymentStatus: refreshed?.paymentStatus,
        confirmedAt: refreshed?.confirmedAt || null,
        paidAt: refreshed?.paidAt || null
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
