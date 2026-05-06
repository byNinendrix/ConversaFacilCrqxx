/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const historyFile = path.resolve(__dirname, "..", "config", "version-history.json");
const frontendPackageFile = path.resolve(__dirname, "..", "..", "frontend", "package.json");

const [, , versionArg, titleArg, changesArg] = process.argv;

if (!versionArg) {
  console.error("Uso: npm run release:version -- <versao> \"<titulo>\" \"item1|item2|item3\"");
  process.exit(1);
}

const versionRegex = /^\d+\.\d+\.\d+$/;
if (!versionRegex.test(versionArg)) {
  console.error(`Versao invalida: "${versionArg}". Use formato semver simples, ex: 5.3.7`);
  process.exit(1);
}

const title = (titleArg || `Release ${versionArg}`).trim();
const changes = (changesArg || "")
  .split("|")
  .map(item => item.trim())
  .filter(Boolean);

const now = new Date();
const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
  now.getDate()
).padStart(2, "0")}`;

const readJson = filePath => JSON.parse(fs.readFileSync(filePath, "utf8"));
const writeJson = (filePath, payload) =>
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

const historyPayload = readJson(historyFile);
const normalizedHistory = Array.isArray(historyPayload.history) ? historyPayload.history : [];

const newRelease = {
  version: versionArg,
  date,
  title,
  changes
};

const filtered = normalizedHistory.filter(item => item?.version !== versionArg);

historyPayload.currentVersion = versionArg;
historyPayload.history = [newRelease, ...filtered];
writeJson(historyFile, historyPayload);

const frontendPackage = readJson(frontendPackageFile);
frontendPackage.versionSystem = versionArg;
writeJson(frontendPackageFile, frontendPackage);

console.log("Release atualizada com sucesso.");
console.log(`Versao atual: ${versionArg}`);
console.log(`Arquivo de historico: ${historyFile}`);
console.log(`frontend/package.json -> versionSystem=${versionArg}`);
