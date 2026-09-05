const assert = require("assert");
const {
  getPdfIntegrity,
  matchesStoredPdfIntegrity,
} = require("../services/companyApplicationFileIntegrity");

const validPdf = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n", "ascii");
const integrity = getPdfIntegrity(validPdf);

assert.strictEqual(integrity.isPdf, true);
assert.strictEqual(integrity.size, validPdf.length);
assert.strictEqual(matchesStoredPdfIntegrity(validPdf, { size: validPdf.length, sha256: integrity.sha256 }).valid, true);
assert.strictEqual(matchesStoredPdfIntegrity(Buffer.from("not a pdf"), {}).valid, false);
assert.strictEqual(matchesStoredPdfIntegrity(validPdf, { size: validPdf.length, sha256: "0".repeat(64) }).valid, false);

console.log("company application file integrity tests passed");
