const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "../backend/.env") });
dotenv.config();

const Experience = require("../backend/models/Experience");

const inputPath =
  process.argv[2] || "/tmp/darbak_computer_college_pending_experiences.json";
const shouldImport = process.argv.includes("--import");

const allowedStatuses = new Set(["pending", "approved", "rejected"]);

const normalizeRecord = (item) => ({
  organizationName: item.organizationName,
  city: item.city || "غير مذكور",
  howApplied: item.howApplied || "غير مذكور",
  duration: item.duration || "3 إلى 6 أشهر",
  trainingYear: item.trainingYear || "",
  wasHired: ["yes", "no", "not_sure", ""].includes(item.wasHired)
    ? item.wasHired
    : "no",
  hadReward: ["yes", "no", "not_sure", ""].includes(item.hadReward)
    ? item.hadReward
    : "no",
  trainingEnvironment: ["mixed", "women", "men", ""].includes(
    item.trainingEnvironment
  )
    ? item.trainingEnvironment
    : "mixed",
  benefitedFromTraining: ["yes", "no", ""].includes(item.benefitedFromTraining)
    ? item.benefitedFromTraining
    : "",
  wouldRecommend: ["yes", "no", ""].includes(item.wouldRecommend)
    ? item.wouldRecommend
    : "",
  trainingMode: ["onsite", "remote", ""].includes(item.trainingMode)
    ? item.trainingMode
    : "onsite",
  starRating:
    Number.isInteger(item.starRating) && item.starRating >= 1 && item.starRating <= 5
      ? item.starRating
      : 3,
  ratings: Array.isArray(item.ratings) ? item.ratings : [],
  description: item.description,
  title: item.title,
  status: allowedStatuses.has(item.status) ? item.status : "pending",
  rejectionReason: item.rejectionReason || "",
  majorCategory: item.majorCategory || "الحاسب والتقنية",
  major: item.major || "علوم الحاسب",
});

const validateRecord = (record, index) => {
  const required = [
    "organizationName",
    "city",
    "howApplied",
    "duration",
    "description",
    "major",
  ];
  const errors = required
    .filter((field) => !record[field])
    .map((field) => `row ${index + 1}: ${field} is empty`);

  if (!allowedStatuses.has(record.status)) {
    errors.push(`row ${index + 1}: invalid status`);
  }

  return errors;
};

async function main() {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`JSON file not found: ${inputPath}`);
  }

  const raw = fs.readFileSync(inputPath, "utf8");
  const records = JSON.parse(raw).map(normalizeRecord);
  const errors = records.flatMap(validateRecord);

  const statusSummary = records.reduce((summary, record) => {
    summary[record.status] = (summary[record.status] || 0) + 1;
    return summary;
  }, {});

  console.log(`Prepared records: ${records.length}`);
  console.log("Status distribution:", statusSummary);

  if (errors.length > 0) {
    console.error(errors.join("\n"));
    throw new Error("Validation failed before import");
  }

  if (!shouldImport) {
    console.log("Dry run only. Add --import to insert into MongoDB.");
    return;
  }

  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGO_URI/MONGODB_URI is missing");
  }

  await mongoose.connect(uri);

  let inserted = 0;
  let skipped = 0;

  for (const record of records) {
    const existing = await Experience.findOne({
      organizationName: record.organizationName,
      city: record.city,
      major: record.major,
      description: record.description,
    }).lean();

    if (existing) {
      skipped += 1;
      continue;
    }

    await Experience.create(record);
    inserted += 1;
  }

  console.log(`Inserted: ${inserted}`);
  console.log(`Skipped duplicates: ${skipped}`);

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("Import failed:", error.message);
  try {
    await mongoose.disconnect();
  } catch (_) {
    // Ignore disconnect failures on failed connection attempts.
  }
  process.exit(1);
});
