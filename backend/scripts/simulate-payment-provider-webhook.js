/* eslint-disable no-console */
const Company = require("../dist/models/Company").default;
const CompanyService = require("../dist/models/CompanyService").default;
const Contact = require("../dist/models/Contact").default;
const Whatsapp = require("../dist/models/Whatsapp").default;
const ServiceBooking = require("../dist/models/ServiceBooking").default;
const {
  createPixCharge
} = require("../dist/services/SchedulingServices/PaymentProviderService");
const ProcessServiceBookingPaymentWebhookService =
  require("../dist/services/ServiceBookingServices/ProcessServiceBookingPaymentWebhookService").default;

const buildSimulatedTxId = ({ companyId, bookingId }) => {
  const suffix = Date.now().toString(36).toUpperCase();
  return `SB${companyId}B${bookingId}${suffix}`
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 25);
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
    contactId: null
  };

  let service = await CompanyService.findOne({
    where: { companyId, isActive: true },
    order: [["id", "ASC"]]
  });
  if (!service) {
    service = await CompanyService.create({
      companyId,
      name: "Stress Provider Webhook Service",
      description: "Temporary service for provider webhook simulation",
      isActive: true,
      showPrice: false,
      displayOrder: 999,
      price: 140,
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
      name: `Stress Provider WhatsApp ${companyId}`,
      status: "CONNECTED",
      session: "",
      number: `stress-provider-whatsapp-${companyId}`,
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
      name: "Stress Provider Contact",
      number: `55${Date.now()}${Math.floor(Math.random() * 1000)}`,
      email: "stress-provider@test.local",
      active: true
    });
    createdResources.contactId = contact.id;
  }

  const startAt = new Date(Date.now() + 1000 * 60 * 160);
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
    depositAmount: 50,
    paymentDueAt: new Date(Date.now() + 15 * 60 * 1000),
    paymentReference: null,
    source: "stress_payment_provider_webhook",
    customerNameSnapshot: "stress-provider",
    customerNumberSnapshot: `${contact.number || "0000000000"}`,
    contextJson: { scenario: "provider_webhook_auto_confirmation" }
  });

  const preparedTxId = buildSimulatedTxId({
    companyId,
    bookingId: booking.id
  });

  await booking.update({
    paymentReference: `SB-${companyId}-${booking.id}`,
    pixTxId: preparedTxId
  });

  const pixSettings = {
    enabled: true,
    key: process.env.GERENCIANET_PIX_KEY || "pix-fallback@example.com",
    keyType: "email",
    recipientName: "Conversa Facil",
    city: "Fortaleza",
    sendMode: "both"
  };

  const charge = await createPixCharge({
    booking,
    pixSettings,
    amount: Number(booking.depositAmount || 0),
    customerName: booking.customerNameSnapshot || "Cliente teste",
    expiresAt: booking.paymentDueAt || null,
    forceRegeneration: true
  });

  await booking.update({
    pixProvider: charge.provider,
    pixTxId: charge.txId,
    pixPayload: charge.payload,
    pixLocationId: charge.locationId || null,
    pixQrCode: charge.qrCode || null,
    pixExpiresAt: charge.expiresAt || booking.paymentDueAt || null
  });

  const webhookPayload = {
    pix: [
      {
        txid: charge.txId,
        horario: new Date().toISOString()
      }
    ]
  };

  const firstWebhook = await ProcessServiceBookingPaymentWebhookService({
    payload: webhookPayload
  });
  const secondWebhook = await ProcessServiceBookingPaymentWebhookService({
    payload: webhookPayload
  });

  await booking.reload();

  console.log(
    JSON.stringify(
      {
        providerRequested: process.env.SERVICE_BOOKING_PIX_PROVIDER || "gerencianet",
        chargeProvider: charge.provider,
        fallbackUsed: charge.fallbackUsed,
        pixTxId: booking.pixTxId,
        firstWebhook,
        secondWebhook,
        finalStatus: booking.status,
        finalPaymentStatus: booking.paymentStatus,
        paidAt: booking.paidAt || null
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
