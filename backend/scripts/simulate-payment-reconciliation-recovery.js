/* eslint-disable no-console */
const Company = require("../dist/models/Company").default;
const CompanyService = require("../dist/models/CompanyService").default;
const Contact = require("../dist/models/Contact").default;
const Whatsapp = require("../dist/models/Whatsapp").default;
const ServiceBooking = require("../dist/models/ServiceBooking").default;
const {
  runServiceBookingPaymentReconciliation
} = require("../dist/services/SchedulingServices/ServiceBookingPaymentReconciliationJob");

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
      name: "Stress Reconciliation Service",
      description: "Temporary service for payment reconciliation simulation",
      isActive: true,
      showPrice: false,
      displayOrder: 999,
      price: 130,
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
      name: `Stress Reconciliation WhatsApp ${companyId}`,
      status: "CONNECTED",
      session: "",
      number: `stress-reconciliation-whatsapp-${companyId}`,
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
      name: "Stress Reconciliation Contact",
      number: `55${Date.now()}${Math.floor(Math.random() * 1000)}`,
      email: "stress-reconciliation@test.local",
      active: true
    });
    createdResources.contactId = contact.id;
  }

  const startAt = new Date(Date.now() + 1000 * 60 * 140);
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
    depositAmount: 35,
    paymentDueAt: new Date(Date.now() + 30 * 60 * 1000),
    paymentReference: `RECON-${Date.now()}`,
    pixTxId: `SB${companyId}B${Date.now().toString().slice(-8)}`
      .replace(/[^A-Za-z0-9]/g, "")
      .slice(0, 25),
    pixProvider: "gerencianet",
    pixPayload:
      "00020126580014BR.GOV.BCB.PIX0136simulate-reconciliation520400005303986540535.005802BR5925SIMULACAO RECONCILIACAO6009FORTALEZA62070503REC6304ABCD",
    pixExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
    source: "stress_payment_reconciliation",
    customerNameSnapshot: "stress-reconciliation",
    customerNumberSnapshot: `${contact.number || "0000000000"}`,
    contextJson: { scenario: "reconciliation_without_webhook" }
  });

  await runServiceBookingPaymentReconciliation({
    trigger: "manual",
    limit: 20,
    statusResolver: async ({ txId }) => ({
      provider: "gerencianet",
      txId,
      status: "paid",
      raw: { simulated: true, reason: "webhook_not_received" }
    })
  });

  const afterFirstCycle = await ServiceBooking.findByPk(booking.id);

  await runServiceBookingPaymentReconciliation({
    trigger: "manual",
    limit: 20,
    statusResolver: async ({ txId }) => ({
      provider: "gerencianet",
      txId,
      status: "paid",
      raw: { simulated: true, reason: "duplicate_reconciliation_cycle" }
    })
  });

  const afterSecondCycle = await ServiceBooking.findByPk(booking.id);

  console.log(
    JSON.stringify(
      {
        bookingId: booking.id,
        noWebhookDispatched: true,
        firstCycle: {
          status: afterFirstCycle?.status,
          paymentStatus: afterFirstCycle?.paymentStatus,
          paidAt: afterFirstCycle?.paidAt || null,
          confirmationSource:
            afterFirstCycle?.contextJson?.payment?.lastConfirmationSource || null
        },
        secondCycle: {
          status: afterSecondCycle?.status,
          paymentStatus: afterSecondCycle?.paymentStatus,
          paidAt: afterSecondCycle?.paidAt || null,
          confirmationSource:
            afterSecondCycle?.contextJson?.payment?.lastConfirmationSource || null
        },
        lastProviderSync: afterSecondCycle?.contextJson?.payment?.lastProviderSync || null
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
    setTimeout(() => process.exit(0), 100);
  })
  .catch(error => {
    console.error(error);
    setTimeout(() => process.exit(1), 100);
  });

