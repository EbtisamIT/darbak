const crypto = require("crypto");

const getPdfIntegrity = (value) => {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value || []);
  const headerOffset = buffer.subarray(0, Math.min(buffer.length, 1024)).indexOf("%PDF-");
  const footer = buffer.subarray(Math.max(0, buffer.length - 2048)).toString("latin1");
  const isPdf = buffer.length >= 8 && headerOffset >= 0 && footer.includes("%%EOF");

  return {
    isPdf,
    size: buffer.length,
    sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
  };
};

const matchesStoredPdfIntegrity = (value, file = {}) => {
  const integrity = getPdfIntegrity(value);
  return {
    ...integrity,
    valid:
      integrity.isPdf &&
      (!file.size || Number(file.size) === integrity.size) &&
      (!file.sha256 || file.sha256 === integrity.sha256),
  };
};

module.exports = { getPdfIntegrity, matchesStoredPdfIntegrity };
