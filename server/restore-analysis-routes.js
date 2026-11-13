const fs = require("fs");

const currentFile = "./server.js";
const backupFile = "./server-before-company-profile-fix-20261101-154546.js";

const current = fs.readFileSync(currentFile, "utf8");
const backup = fs.readFileSync(backupFile, "utf8");

const technicalRoute = 'app.get("/api/technical-analysis/:symbol"';
const predictionRoute = 'app.get("/api/prediction/:symbol"';
const riskRoute = 'app.get("/api/risk-analysis/:symbol"';

const technicalStart = backup.indexOf(technicalRoute);
const predictionStart = backup.indexOf(predictionRoute);
const backupRiskStart = backup.indexOf(riskRoute);

const currentRiskStart = current.indexOf(riskRoute);

if (technicalStart < 0 || predictionStart < 0 || backupRiskStart < 0) {
    throw new Error("Backup route declarations are incomplete. No changes made.");
}

if (technicalStart >= predictionStart || predictionStart >= backupRiskStart) {
    throw new Error("Backup route order is unexpected. No changes made.");
}

if (currentRiskStart < 0 || current.indexOf(riskRoute, currentRiskStart + 1) >= 0) {
    throw new Error("Current Risk Analysis route is missing or duplicated. No changes made.");
}

if (current.includes(technicalRoute) || current.includes(predictionRoute)) {
    throw new Error("One or both analysis routes already exist. No changes made.");
}

if (!current.includes("resolveExchangeProviderSymbol")) {
    throw new Error("Current exchange resolver is missing. No changes made.");
}

// Locate the Risk Analysis heading immediately before its route.
const backupRiskHeading = backup.lastIndexOf("/*", backupRiskStart);
const currentRiskHeading = current.lastIndexOf("/*", currentRiskStart);

if (backupRiskHeading < technicalStart || currentRiskHeading < 0) {
    throw new Error("Could not safely locate route boundaries. No changes made.");
}

// Extract only Technical Analysis and Prediction.
const routes = backup.slice(technicalStart, backupRiskHeading).trimEnd();

if (!routes.includes(technicalRoute) || !routes.includes(predictionRoute)) {
    throw new Error("Extracted routes are incomplete. No changes made.");
}

const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
const backupName = `server-before-restoring-analysis-${timestamp}.js`;

fs.copyFileSync(currentFile, backupName);

const updated =
    current.slice(0, currentRiskHeading) +
    routes +
    "\n\n" +
    current.slice(currentRiskHeading);

fs.writeFileSync(currentFile, updated, "utf8");

console.log("SUCCESS: Both routes restored.");
console.log("Backup:", backupName);
