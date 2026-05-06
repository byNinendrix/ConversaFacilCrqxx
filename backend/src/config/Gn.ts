import fs from "fs";
import path from "path";

const parseBooleanEnv = (value: string | undefined, fallback = false): boolean => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return fallback;
  return ["1", "true", "yes", "on"].includes(normalized);
};

const normalizeCertFileName = (value: string): string => {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (normalized.toLowerCase().endsWith(".p12")) {
    return normalized;
  }
  return `${normalized}.p12`;
};

const resolveGerencianetCertPath = (): string => {
  const rawCertValue = String(process.env.GERENCIANET_PIX_CERT || "").trim();
  const normalizedCertFile = normalizeCertFileName(rawCertValue);

  if (!normalizedCertFile) {
    return "";
  }

  const candidateSet = new Set<string>();

  if (path.isAbsolute(rawCertValue)) {
    candidateSet.add(path.resolve(rawCertValue));
  } else if (rawCertValue) {
    candidateSet.add(path.resolve(process.cwd(), rawCertValue));
    candidateSet.add(path.resolve(__dirname, "../../certs", rawCertValue));
  }

  if (path.isAbsolute(normalizedCertFile)) {
    candidateSet.add(path.resolve(normalizedCertFile));
  } else {
    candidateSet.add(path.resolve(process.cwd(), normalizedCertFile));
    candidateSet.add(path.resolve(process.cwd(), "certs", normalizedCertFile));
    candidateSet.add(path.resolve(__dirname, "../../certs", normalizedCertFile));
  }

  for (const candidate of candidateSet) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  if (path.isAbsolute(normalizedCertFile)) {
    return path.resolve(normalizedCertFile);
  }

  return path.resolve(__dirname, "../../certs", normalizedCertFile);
};

const cert = resolveGerencianetCertPath();

export = {
  sandbox: parseBooleanEnv(process.env.GERENCIANET_SANDBOX, false),
  client_id: String(process.env.GERENCIANET_CLIENT_ID || "").trim(),
  client_secret: String(process.env.GERENCIANET_CLIENT_SECRET || "").trim(),
  pix_cert: cert
};
