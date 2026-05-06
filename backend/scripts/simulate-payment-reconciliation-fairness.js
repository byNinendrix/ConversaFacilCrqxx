/* eslint-disable no-console */
const { Op } = require("sequelize");

const Company = require("../dist/models/Company").default;
const CompanyService = require("../dist/models/CompanyService").default;
const Contact = require("../dist/models/Contact").default;
const Whatsapp = require("../dist/models/Whatsapp").default;
const ServiceBooking = require("../dist/models/ServiceBooking").default;
const {
  runServiceBookingPaymentReconciliation
} = require("../dist/services/SchedulingServices/ServiceBookingPaymentReconciliationJob");

const toTxId = (companyId, suffix) =>
  `SB${companyId}B${String(suffix).replace(/[^A-Za-z0-9]/g, "").toUpperCase()}`
    .slice(0, 25);

async function ensureResources(companyId) {
  const created = {
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
      name: `Fairness Service ${companyId}`,
      description: "Temporary service for fairness simulation",
      isActive: true,
      showPrice: false,
      displayOrder: 997,
      price: 60,
      durationMinutes: 30,
      intervalMinutes: 0,
      minAdvanceMinutes: 0,
      maxAdvanceDays: 30,
      maxBookingsPerSlot: 1
    });
    created.serviceId = service.id;
  }

  let whatsapp = await Whatsapp.findOne({
    where: { companyId },
    order: [["id", "ASC"]]
  });
  if (!whatsapp) {
    whatsapp = await Whatsapp.create({
      companyId,
      name: `Fairness WhatsApp ${companyId}`,
      status: "CONNECTED",
      session: "",
      number: `fairness-whatsapp-${companyId}-${Date.now()}`,
      schedulingAutomationEnabled: true
    });
    created.whatsappId = whatsapp.id;
  }

  let contact = await Contact.findOne({
    where: { companyId },
    order: [["id", "ASC"]]
  });
  if (!contact) {
    contact = await Contact.create({
      companyId,
      whatsappId: whatsapp.id,
      name: `Fairness Contact ${companyId}`,
      number: `55${Date.now()}${Math.floor(Math.random() * 1000)}`,
      email: `fairness-${companyId}@test.local`,
      active: true
    });
    created.contactId = contact.id;
  }

  return {
    service,
    whatsapp,
    contact,
    created
  };
}

async function run() {
  const companies = await Company.findAll({
    order: [["id", "ASC"]],
    limit: 2
  });

  if (companies.length < 2) {
    throw new Error("Need at least 2 companies for fairness simulation.");
  }

  const companyA = Number(companies[0].id);
  const companyB = Number(companies[1].id);
  const resourcesA = await ensureResources(companyA);
  const resourcesB = await ensureResources(companyB);

  const createdBookings = [];
  const cleanupResources = [
    { companyId: companyA, ...resourcesA.created },
    { companyId: companyB, ...resourcesB.created }
  ];

  const createBooking = async ({
    companyId,
    serviceId,
    whatsappId,
    contactId,
    minuteOffset,
    dueInMinutes,
    txId,
    withBackoff
  }) => {
    const startAt = new Date(Date.now() + (400 + minuteOffset) * 60 * 1000);
    startAt.setSeconds(0, 0);
    const endAt = new Date(startAt.getTime() + 30 * 60 * 1000);

    const booking = await ServiceBooking.create({
      companyId,
      whatsappId,
      contactId,
      ticketId: null,
      companyServiceId: serviceId,
      startAt,
      endAt,
      status: "pending_payment",
      paymentStatus: "pending",
      depositAmount: 15,
      paymentDueAt: new Date(Date.now() + dueInMinutes * 60 * 1000),
      paymentReference: `FAIR-${companyId}-${Date.now()}-${minuteOffset}`,
      pixTxId: txId,
      pixProvider: "gerencianet",
      pixPayload:
        "00020126580014BR.GOV.BCB.PIX0136fairness-sim520400005303986540515.005802BR5925SIMULACAO FAIRNESS6009FORTALEZA62070503FAI6304ABCD",
      pixExpiresAt: new Date(Date.now() + (dueInMinutes + 30) * 60 * 1000),
      source: "stress_reconciliation_fairness",
      customerNameSnapshot: "stress-reconciliation-fairness",
      customerNumberSnapshot: `${contactId}`,
      contextJson: withBackoff
        ? {
            payment: {
              reconciliation: {
                nextRetryAt: new Date(Date.now() + 12 * 60 * 1000).toISOString(),
                attemptCount: 1,
                failureCount: 0
              }
            }
          }
        : {}
    });

    createdBookings.push(booking.id);
    return booking;
  };

  const randomSeed = Math.floor(Math.random() * 100000);
  const txA1 = toTxId(companyA, `A1${randomSeed}`);
  const txA2 = toTxId(companyA, `A2${randomSeed}`);
  const txA3 = toTxId(companyA, `A3${randomSeed}`);
  const txABackoff = toTxId(companyA, `AB${randomSeed}`);
  const txB1 = toTxId(companyB, `B1${randomSeed}`);
  const txB2 = toTxId(companyB, `B2${randomSeed}`);
  const txB3 = toTxId(companyB, `B3${randomSeed}`);

  await createBooking({
    companyId: companyA,
    serviceId: resourcesA.service.id,
    whatsappId: resourcesA.whatsapp.id,
    contactId: resourcesA.contact.id,
    minuteOffset: 0,
    dueInMinutes: 6,
    txId: txA1
  });
  await createBooking({
    companyId: companyA,
    serviceId: resourcesA.service.id,
    whatsappId: resourcesA.whatsapp.id,
    contactId: resourcesA.contact.id,
    minuteOffset: 10,
    dueInMinutes: 8,
    txId: txA2
  });
  await createBooking({
    companyId: companyA,
    serviceId: resourcesA.service.id,
    whatsappId: resourcesA.whatsapp.id,
    contactId: resourcesA.contact.id,
    minuteOffset: 20,
    dueInMinutes: 10,
    txId: txA3
  });
  await createBooking({
    companyId: companyA,
    serviceId: resourcesA.service.id,
    whatsappId: resourcesA.whatsapp.id,
    contactId: resourcesA.contact.id,
    minuteOffset: 30,
    dueInMinutes: 4,
    txId: txABackoff,
    withBackoff: true
  });

  await createBooking({
    companyId: companyB,
    serviceId: resourcesB.service.id,
    whatsappId: resourcesB.whatsapp.id,
    contactId: resourcesB.contact.id,
    minuteOffset: 0,
    dueInMinutes: 5,
    txId: txB1
  });
  await createBooking({
    companyId: companyB,
    serviceId: resourcesB.service.id,
    whatsappId: resourcesB.whatsapp.id,
    contactId: resourcesB.contact.id,
    minuteOffset: 10,
    dueInMinutes: 7,
    txId: txB2
  });
  await createBooking({
    companyId: companyB,
    serviceId: resourcesB.service.id,
    whatsappId: resourcesB.whatsapp.id,
    contactId: resourcesB.contact.id,
    minuteOffset: 20,
    dueInMinutes: 9,
    txId: txB3
  });

  const callOrder = [];
  const summary = await runServiceBookingPaymentReconciliation({
    trigger: "manual",
    limit: 4,
    perTenantLimit: 2,
    overscanFactor: 6,
    companyScanLimit: 80,
    statusResolver: async ({ booking, provider, txId }) => {
      callOrder.push({
        bookingId: booking.id,
        companyId: booking.companyId,
        txId,
        paymentDueAt: booking.paymentDueAt
      });
      return {
        provider,
        txId,
        status: "paid",
        raw: { simulated: "fairness_paid" }
      };
    }
  });

  console.log(
    JSON.stringify(
      {
        companyA,
        companyB,
        expectedPerTenantCap: 2,
        expectedGlobalOrderByDueAt: [txB1, txA1, txB2, txA2],
        callOrder,
        summary
      },
      null,
      2
    )
  );

  await ServiceBooking.destroy({
    where: {
      id: {
        [Op.in]: createdBookings
      }
    }
  });

  for (const resource of cleanupResources) {
    if (resource.contactId) {
      await Contact.destroy({ where: { id: resource.contactId, companyId: resource.companyId } });
    }
    if (resource.whatsappId) {
      await Whatsapp.destroy({ where: { id: resource.whatsappId, companyId: resource.companyId } });
    }
    if (resource.serviceId) {
      await CompanyService.destroy({
        where: { id: resource.serviceId, companyId: resource.companyId }
      });
    }
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
