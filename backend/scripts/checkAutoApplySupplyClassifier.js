const { classifySupplyBatch, classifierSettings } = require("../services/autoApplySupplyClassifier");
const { coopEmail, genericHr, arabicPortal } = require("../tests/fixtures/autoApplySupplyClassification");

async function main() {
  const config = classifierSettings();
  if (!config.apiKey) { console.log(JSON.stringify({ skipped: "OPENAI_KEY_MISSING" })); return; }
  const report = await classifySupplyBatch({ previewRecords: [coopEmail, genericHr, arabicPortal] });
  console.log(JSON.stringify({ model: config.model, ...report }));
  if (report.failedClassifications) process.exitCode = 1;
}
main().catch(() => { console.error("SUPPLY_AI_SMOKE_FAILED"); process.exitCode = 1; });
