import options from "../src/config/Gn";
import {
  __setGerencianetClientFactoryForTests,
  createPixCharge
} from "../src/services/SchedulingServices/PaymentProviderService";

type MockClient = {
  pixCreateImmediateCharge: (params: any, body: any) => Promise<any>;
  pixGenerateQRCode: (params: any) => Promise<any>;
  pixDetailCharge: (params: any) => Promise<any>;
};

const buildBooking = (id: number): any => {
  const booking: any = {
    id,
    companyId: 1,
    companyServiceId: 10,
    professionalId: 3,
    paymentReference: `SB-1-${id}`,
    depositAmount: 50,
    paymentDueAt: new Date(Date.now() + 60 * 60 * 1000),
    pixTxId: null,
    pixPayload: null,
    pixExpiresAt: null,
    pixProvider: null,
    pixLocationId: null,
    pixQrCode: null,
    contextJson: {},
    async update(payload: any): Promise<any> {
      Object.assign(this, payload);
      return this;
    }
  };
  return booking;
};

const pixSettings: any = {
  enabled: true,
  key: "pix-chave@conversafacil.com",
  keyType: "email",
  recipientName: "Conversa Facil",
  city: "Fortaleza",
  sendMode: "both"
};

const applyValidProviderConfig = (): void => {
  (options as any).client_id = "client-id-ok";
  (options as any).client_secret = "client-secret-ok";
  (options as any).pix_cert = __filename;
  (options as any).sandbox = false;
};

const setClientFactory = (factory: () => MockClient): void => {
  __setGerencianetClientFactoryForTests(factory as any);
};

const run = async (): Promise<void> => {
  process.env.SERVICE_BOOKING_PIX_PROVIDER = "gerencianet";
  process.env.SERVICE_BOOKING_PIX_PROVIDER_TIMEOUT_MS = "800";
  process.env.SERVICE_BOOKING_PIX_PROVIDER_MAX_ATTEMPTS = "3";
  process.env.SERVICE_BOOKING_PIX_PROVIDER_RETRY_BACKOFF_MS = "10";

  applyValidProviderConfig();

  let healthyCreateCalls = 0;
  let healthyQrCalls = 0;

  setClientFactory(() => ({
    async pixCreateImmediateCharge() {
      healthyCreateCalls += 1;
      return {
        txid: "SB1B1HEALTHY12345",
        loc: { id: 901 }
      };
    },
    async pixGenerateQRCode() {
      healthyQrCalls += 1;
      return {
        qrcode: "PAYLOAD_PROVIDER_HEALTHY",
        imagemQrcode: "QRCODE_IMG_HEALTHY"
      };
    },
    async pixDetailCharge() {
      return {
        txid: "SB1B1HEALTHY12345",
        status: "ATIVA",
        loc: { id: 901 }
      };
    }
  }));

  const healthyResult = await createPixCharge({
    booking: buildBooking(101),
    pixSettings,
    amount: 50,
    customerName: "Cliente 1",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000)
  });

  console.log("SCENARIO_1", {
    provider: healthyResult.provider,
    fallbackUsed: healthyResult.fallbackUsed,
    txId: healthyResult.txId,
    payloadLength: String(healthyResult.payload || "").length,
    createCalls: healthyCreateCalls,
    qrCalls: healthyQrCalls
  });

  let transientCreateCalls = 0;

  setClientFactory(() => ({
    async pixCreateImmediateCharge() {
      transientCreateCalls += 1;
      const err: any = new Error("socket hang up");
      err.code = "ECONNRESET";
      throw err;
    },
    async pixGenerateQRCode() {
      return { qrcode: "", imagemQrcode: "" };
    },
    async pixDetailCharge() {
      return {};
    }
  }));

  const transientResult = await createPixCharge({
    booking: buildBooking(102),
    pixSettings,
    amount: 50,
    customerName: "Cliente 2",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000)
  });

  console.log("SCENARIO_2", {
    provider: transientResult.provider,
    fallbackUsed: transientResult.fallbackUsed,
    detectionMode: transientResult.detectionMode,
    txId: transientResult.txId,
    retriesObserved: transientCreateCalls
  });

  let configErrorCreateCalls = 0;
  (options as any).client_id = "";

  setClientFactory(() => ({
    async pixCreateImmediateCharge() {
      configErrorCreateCalls += 1;
      return {
        txid: "UNEXPECTED",
        loc: { id: 0 }
      };
    },
    async pixGenerateQRCode() {
      return { qrcode: "", imagemQrcode: "" };
    },
    async pixDetailCharge() {
      return {};
    }
  }));

  const configErrorResult = await createPixCharge({
    booking: buildBooking(103),
    pixSettings,
    amount: 50,
    customerName: "Cliente 3",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000)
  });

  console.log("SCENARIO_3", {
    provider: configErrorResult.provider,
    fallbackUsed: configErrorResult.fallbackUsed,
    detectionMode: configErrorResult.detectionMode,
    txId: configErrorResult.txId,
    providerCallCount: configErrorCreateCalls
  });

  applyValidProviderConfig();

  let permanentProviderCreateCalls = 0;

  setClientFactory(() => ({
    async pixCreateImmediateCharge() {
      permanentProviderCreateCalls += 1;
      const err: any = new Error("chave pix invalida");
      err.response = {
        status: 400,
        data: {
          message: "chave pix invalida"
        }
      };
      throw err;
    },
    async pixGenerateQRCode() {
      return { qrcode: "", imagemQrcode: "" };
    },
    async pixDetailCharge() {
      return {};
    }
  }));

  const permanentProviderResult = await createPixCharge({
    booking: buildBooking(104),
    pixSettings,
    amount: 50,
    customerName: "Cliente 4",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000)
  });

  console.log("SCENARIO_4", {
    provider: permanentProviderResult.provider,
    fallbackUsed: permanentProviderResult.fallbackUsed,
    detectionMode: permanentProviderResult.detectionMode,
    txId: permanentProviderResult.txId,
    providerCallCount: permanentProviderCreateCalls
  });

  __setGerencianetClientFactoryForTests();
};

run().catch(error => {
  console.error("VALIDATION_SCRIPT_ERROR", error);
  process.exit(1);
});
