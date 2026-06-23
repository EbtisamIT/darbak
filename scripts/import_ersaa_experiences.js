const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "../backend/.env") });
dotenv.config();

const Experience = require("../backend/models/Experience");

const DEFAULT_CSV_PATH =
  "/Users/ebtisamali/Downloads/Darbak_Ersaa_Experiences_Rewritten.csv";
const DEFAULT_TRAINING_YEAR = "2023";
const DEFAULT_DURATION = "3 إلى 6 أشهر";
const REVIEWED_AT = new Date().toISOString();

const args = process.argv.slice(2);
const shouldImport = args.includes("--import");
const shouldSyncDerived = args.includes("--sync-derived");
const shouldSyncDescriptions = args.includes("--sync-descriptions");
const shouldSyncDefaults = args.includes("--sync-defaults");
const csvArgIndex = args.indexOf("--csv");
const csvPath =
  csvArgIndex >= 0 && args[csvArgIndex + 1]
    ? args[csvArgIndex + 1]
    : DEFAULT_CSV_PATH;

const normalizeArabic = (value = "") =>
  value
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[أإآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ـ/g, "")
    .replace(/[\u064B-\u065F]/g, "")
    .replace(/\s+/g, " ");

const cleanText = (value) => {
  if (value === null || value === undefined) return "";

  let text = String(value).trim();
  const fixes = {
    "االتصاالت": "الاتصالات",
    "االتصالات": "الاتصالات",
    "اإليميل": "الإيميل",
    "االجتماعي": "الاجتماعي",
    "إجتماعي": "اجتماعي",
    "اختالط": "اختلاط",
    "يدوًيا": "يدويًا",
    "ج ًدا": "جدًا",
    "ج ًد ا": "جدًا",
    "جًد": "جد",
    "ممتازه": "ممتازة",
    "ممتعه": "ممتعة",
    "خالل": "خلال",
    "اال": "الا",
  };

  Object.entries(fixes).forEach(([oldValue, newValue]) => {
    text = text.replaceAll(oldValue, newValue);
  });

  return text.replace(/\s+/g, " ").trim(" .،\n\t");
};

const parseCsv = (content) => {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const next = content[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);

  const headers = rows.shift().map((header) =>
    header.replace(/^\uFEFF/, "").trim()
  );

  return rows.map((cells) =>
    headers.reduce((record, header, index) => {
      record[header] = cells[index] || "";
      return record;
    }, {})
  );
};

const requiredText = (value, fallback = "غير مذكور") =>
  cleanText(value) || fallback;

const polishDescription = (value) => {
  const original = requiredText(value);
  let text = original;

  const spellingFixes = {
    "اإلجتماعي": "الاجتماعي",
    "االجتماعي": "الاجتماعي",
    "اإليميل": "الإيميل",
    "األيام": "الأيام",
    "األكاديمية": "الأكاديمية",
    "األقسام": "الأقسام",
    "االستفادة": "الاستفادة",
    "االستفاده": "الاستفادة",
    "االستخدام": "الاستخدام",
    "االلتزام": "الالتزام",
    "االلتحاق": "الالتحاق",
    "االختبار": "الاختبار",
    "االعتماد": "الاعتماد",
    "اال": "الا",
    "إال": "إلا",
    "اختالط": "اختلاط",
    "عالقه": "علاقة",
    "علاقه": "علاقة",
    "اتعلم": "أتعلم",
    "اتدرب": "أتدرب",
    "اقسام": "أقسام",
    "اداره": "إدارة",
    "اروح": "أروح",
    "اسوي": "أسوي",
    "اسأل": "أسأل",
    "ممتازه": "ممتازة",
    "ممتعه": "ممتعة",
    "جيده": "جيدة",
    "ج ًدا": "جدًا",
    "ج ًد ا": "جدًا",
    "جًد": "جد",
    "جدا": "جدًا",
    "كثيًرا": "كثيرًا",
    "مايقصرون": "ما يقصرون",
    "ماكان": "ما كان",
    "مافي": "ما في",
    "ماعندي": "ما عندي",
    "ف كان": "فكان",
  };

  Object.entries(spellingFixes).forEach(([oldValue, newValue]) => {
    text = text.replaceAll(oldValue, newValue);
  });

  text = text
    .replace(/^كانت\s+تجربتي\s+(?:جيد(?:ة)?(?:\s+جدًا)?|ممتاز(?:ة)?(?:\s+جدًا)?|تدريب\s+جدًا\s+ممتاز|لم\s+أ?ستفد\s+كثيرًا?\s+من\s+التدريب)\s*[,،.]?\s*/u, "")
    .replace(/^تجربتي\s+كانت\s+(?:جيد(?:ة)?(?:\s+جدًا)?|ممتاز(?:ة)?(?:\s+جدًا)?)\s*[,،.]?\s*/u, "")
    .replace(/\s*\.\s*(?=(?:الأيام|عرضت|وقد|وكان|كما))/gu, " ")
    .replace(/\s+اي\s+/g, " أي ")
    .replace(/\s+([،.])/g, "$1")
    .replace(/([،.])(?=\S)/g, "$1 ")
    .replace(/\s+/g, " ")
    .trim(" .،\n\t");

  return text || original;
};

const containsAny = (text, phrases) =>
  phrases.some((phrase) => text.includes(normalizeArabic(phrase)));

const BENEFIT_POSITIVE_PHRASES = [
  "استفدت",
  "افادتني",
  "فادتني",
  "تعلمت",
  "اكتسبت",
  "مفيدة",
  "مفيد",
  "اضافت لي",
  "أضافت لي",
  "معلومات مفيدة",
  "خبرة",
  "تجربة ممتازة",
  "تجربتي ممتازة",
  "ممتاز جدا",
  "جيد جدا",
  "فريق العمل يساعد",
];

const BENEFIT_NEGATIVE_PHRASES = [
  "لم استفد",
  "ما استفدت",
  "لم اتعلم",
  "ما تعلمت",
  "غير مفيد",
  "بدون فائدة",
  "ما كان له علاقة بالتخصص",
  "ما كان له علاقه بالتخصص",
  "ليس له علاقة بالتخصص",
  "الشغل كان قليل",
  "عشوائية كبيرة",
  "عشوائيه كبيره",
  "على الفاضي",
];

const RECOMMEND_POSITIVE_PHRASES = [
  "انصح",
  "أنصح",
  "اوصي",
  "أوصي",
  "ارشح",
  "أرشح",
  "ممتاز",
  "ممتازة",
  "جيد جدا",
  "جيد جدًا",
  "مفيدة",
  "مفيد",
  "استفدت",
  "تعلمت",
  "اكتسبت",
  "بيئة جيدة",
  "فريق العمل يساعد",
];

const RECOMMEND_NEGATIVE_PHRASES = [
  "لا انصح",
  "لا أنصح",
  "ما انصح",
  "لا اوصي",
  "لا أوصي",
  "لا ارشح",
  "لا أرشح",
  "لم استفد",
  "ما استفدت",
  "غير مفيد",
  "سيء",
  "سيئ",
  "سيئة",
  "سيئه",
  "عشوائية كبيرة",
  "عشوائيه كبيره",
  "على الفاضي",
  "ما كان له علاقة بالتخصص",
  "ما كان له علاقه بالتخصص",
  "ليس له علاقة بالتخصص",
  "بيئة غير مريحة",
];

const inferStars = (ratingText, description) => {
  const combined = normalizeArabic(`${ratingText} ${description}`);

  if (
    combined.includes("ممتاز جدا") ||
    combined.includes("ممتازه جدا") ||
    combined.includes("تدريب جدا ممتاز") ||
    combined.includes("رائعه") ||
    combined.includes("رائع")
  ) {
    return 5;
  }

  if (
    combined.includes("جيد جدا") ||
    combined.includes("جيده جدا") ||
    combined.includes("ممتاز")
  ) {
    return 4;
  }

  if (
    combined.includes("لم استفد") ||
    combined.includes("ما استفدت") ||
    combined.includes("غير مفيد") ||
    combined.includes("سيئ") ||
    combined.includes("سيء") ||
    combined.includes("عشوائيه كبيره")
  ) {
    return 2;
  }

  if (
    combined.includes("جيد") ||
    combined.includes("مفيد") ||
    combined.includes("استفدت") ||
    combined.includes("تعلمت") ||
    combined.includes("اكتسبت")
  ) {
    return 3;
  }

  return 3;
};

const yesNoNotSure = (value, { volunteerMeansNo = false } = {}) => {
  const text = normalizeArabic(cleanText(value));
  if (!text || text === "-" || text === "nan" || text === "none") return "no";
  if (text.includes("نعم") || text === "yes" || text === "1") return "yes";
  if (text.includes("لا") || text === "no" || text === "0") return "no";
  if (volunteerMeansNo && text.includes("تطوع")) return "no";
  return "no";
};

const normalizeEnvironment = (trainingType, gender) => {
  const text = normalizeArabic(trainingType);
  const normalizedGender = normalizeArabic(gender);

  if (text.includes("نساء") || text.includes("نسائي")) return "women";
  if (text.includes("رجال") || text.includes("رجالي")) {
    if (text.includes("او") && text.includes("نساء")) {
      return normalizedGender.includes("طالب") && !normalizedGender.includes("طالبه")
        ? "men"
        : "women";
    }
    return "men";
  }
  if (text.includes("اختلاط") || text.includes("مختلط")) return "mixed";
  return "mixed";
};

const normalizeTrainingMode = (trainingType) => {
  const text = normalizeArabic(trainingType);
  return text.includes("عن بعد") || text.includes("remote") ? "remote" : "onsite";
};

const normalizeHowApplied = (value) => {
  const raw = cleanText(value);
  const text = normalizeArabic(raw);

  if (!text) return "غير مذكور";
  if (text.includes("لينكد")) return "لينكدإن";
  if (text.includes("بريد") || text.includes("ايميل")) return "البريد الإلكتروني";
  if (text.includes("موقع")) return "موقع الجهة الرسمي";
  if (text.includes("جامعه") || text.includes("ترشيح")) return "ترشيح من الجامعة";
  if (text.includes("يدوي")) return "يدوي";
  if (text.includes("تواصل") || text.includes("واتس") || text.includes("رقم")) {
    return "تواصل مباشر";
  }
  if (text.includes("اجتماعي") || text.includes("حسابات")) return "منصات التواصل";
  if (text.includes("ارساء")) return "إرساء";
  return raw;
};

const benefitedFromTraining = (rating, description) => {
  const text = normalizeArabic(description);

  if (containsAny(text, BENEFIT_NEGATIVE_PHRASES)) {
    return "no";
  }

  if (containsAny(text, BENEFIT_POSITIVE_PHRASES)) {
    return "yes";
  }

  return rating >= 3 ? "yes" : "no";
};

const wouldRecommend = (rating, description) => {
  const text = normalizeArabic(description);

  if (containsAny(text, RECOMMEND_NEGATIVE_PHRASES)) {
    return "no";
  }

  if (containsAny(text, RECOMMEND_POSITIVE_PHRASES)) {
    return "yes";
  }

  return rating >= 3 ? "yes" : "no";
};

const detectMajorCategory = (major) => {
  const text = normalizeArabic(major);

  const checks = [
    ["الطب والعلوم الصحية", ["طب", "تمريض", "صيدله", "صحه", "مختبر", "اشعه", "علاج"]],
    ["الهندسة والطاقة", ["هندسه", "كهرب", "ميكاني", "مدني", "صناعي", "معماري", "بترول", "طاقه"]],
    ["الحاسب والتقنية", ["حاسب", "تقنيه", "معلومات", "برمج", "نظم", "سيبراني", "ذكاء", "بيانات", "شبكات"]],
    ["القانون والسياسة", ["قانون", "حقوق", "شريعه", "انظمه", "سياسه"]],
    ["المالية والإدارية", ["اداره", "اعمال", "تسويق", "ماليه", "تمويل", "محاسبه", "اقتصاد", "موارد", "تأمين", "تامين", "استثمار", "بنوك"]],
    ["السياحة والضيافة", ["سياحه", "ضيافه", "فعاليات", "اثار", "تراث"]],
    ["الإعلام والإتصال", ["اعلام", "اتصال", "علاقات عامه", "صحافه", "اعلان"]],
    ["اللغات والآداب", ["لغه", "لغات", "ترجمه", "انجليزي", "عربي", "اداب"]],
    ["التصميم والفنون", ["تصميم", "فنون", "جرافيك", "مرئي"]],
    ["العلوم الأساسية", ["رياضيات", "احصاء", "فيزياء", "كيمياء", "احياء", "علوم"]],
    ["العلوم الإنسانية", ["تاريخ", "جغرافيا", "معلومات جغرافيه", "مكتبات"]],
    ["العلوم الإجتماعية", ["خدمه اجتماعيه", "علم النفس", "علم الاجتماع"]],
    ["العلوم التربوية", ["تربيه", "طفوله", "تقنيات التعليم", "مناهج"]],
    ["العلوم الزراعية", ["زراعه", "اغذيه", "تغذيه", "تربه", "نبات", "حيوان"]],
    ["العلوم الرياضية", ["رياضه", "رياضي", "نشاط بدني"]],
  ];

  const match = checks.find(([, keywords]) =>
    keywords.some((keyword) => text.includes(keyword))
  );

  return match ? match[0] : "المالية والإدارية";
};

const makeTitle = (organizationName, city) =>
  city && city !== "غير مذكور"
    ? `تجربتي في ${organizationName} بـ${city}`
    : `تجربتي في ${organizationName}`;

const buildRecord = (row) => {
  const organizationName = requiredText(row.company);
  const city = requiredText(row.city);
  const major = requiredText(row.major, "غير محدد");
  const legacyDescription = requiredText(row.description_rewritten);
  const description = polishDescription(legacyDescription);
  const starRating = inferStars(row.rating, description);

  return {
    organizationName,
    city,
    howApplied: normalizeHowApplied(row.application_method),
    duration: DEFAULT_DURATION,
    trainingYear: DEFAULT_TRAINING_YEAR,
    wasHired: yesNoNotSure(row.job_offer, { volunteerMeansNo: true }),
    hadReward: yesNoNotSure(row.stipend),
    trainingEnvironment: normalizeEnvironment(row.training_type, row.gender),
    benefitedFromTraining: benefitedFromTraining(starRating, description),
    wouldRecommend: wouldRecommend(starRating, description),
    trainingMode: normalizeTrainingMode(row.training_type),
    starRating,
    ratings: [],
    description,
    title: makeTitle(organizationName, city),
    status: "approved",
    rejectionReason: "",
    majorCategory: detectMajorCategory(major),
    major,
    reviewedAt: REVIEWED_AT,
    _legacyDescription: legacyDescription,
  };
};

const validateRecord = (record, index) => {
  const errors = [];
  ["organizationName", "city", "howApplied", "duration", "description", "major"].forEach(
    (field) => {
      if (!record[field]) errors.push(`row ${index + 1}: ${field} is empty`);
    }
  );

  if (!Number.isInteger(record.starRating) || record.starRating < 1 || record.starRating > 5) {
    errors.push(`row ${index + 1}: invalid starRating`);
  }

  ["benefitedFromTraining", "wouldRecommend"].forEach((field) => {
    if (!["yes", "no"].includes(record[field])) {
      errors.push(`row ${index + 1}: ${field} must be yes/no`);
    }
  });

  return errors;
};

async function main() {
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`);
  }

  const content = fs.readFileSync(csvPath, "utf8");
  const rows = parseCsv(content);
  const records = rows
    .map(buildRecord)
    .filter(
      (record) =>
        record.organizationName !== "غير مذكور" &&
        record.description !== "غير مذكور"
    );

  const validationErrors = records.flatMap(validateRecord);
  const ratingSummary = records.reduce((summary, record) => {
    summary[record.starRating] = (summary[record.starRating] || 0) + 1;
    return summary;
  }, {});
  const categorySummary = records.reduce((summary, record) => {
    summary[record.majorCategory] = (summary[record.majorCategory] || 0) + 1;
    return summary;
  }, {});
  const benefitSummary = records.reduce((summary, record) => {
    summary[record.benefitedFromTraining] =
      (summary[record.benefitedFromTraining] || 0) + 1;
    return summary;
  }, {});
  const recommendSummary = records.reduce((summary, record) => {
    summary[record.wouldRecommend] = (summary[record.wouldRecommend] || 0) + 1;
    return summary;
  }, {});
  const rewardSummary = records.reduce((summary, record) => {
    summary[record.hadReward] = (summary[record.hadReward] || 0) + 1;
    return summary;
  }, {});
  const jobOfferSummary = records.reduce((summary, record) => {
    summary[record.wasHired] = (summary[record.wasHired] || 0) + 1;
    return summary;
  }, {});

  console.log(`Prepared records: ${records.length}`);
  console.log("Rating distribution:", ratingSummary);
  console.log("Benefit distribution:", benefitSummary);
  console.log("Recommend distribution:", recommendSummary);
  console.log("Reward distribution:", rewardSummary);
  console.log("Job offer distribution:", jobOfferSummary);
  console.log("Major categories:", categorySummary);
  const descriptionChanges = records.filter(
    (record) => record.description !== record._legacyDescription
  );
  console.log(`Description changes: ${descriptionChanges.length}`);
  descriptionChanges.slice(0, 3).forEach((record, index) => {
    console.log(`Sample ${index + 1} before: ${record._legacyDescription}`);
    console.log(`Sample ${index + 1} after: ${record.description}`);
  });

  if (validationErrors.length > 0) {
    console.error(validationErrors.join("\n"));
    throw new Error("Validation failed before import");
  }

  if (
    !shouldImport &&
    !shouldSyncDerived &&
    !shouldSyncDescriptions &&
    !shouldSyncDefaults
  ) {
    console.log(
      "Dry run only. Add --import, --sync-derived, --sync-descriptions, or --sync-defaults to update MongoDB."
    );
    return;
  }

  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGO_URI/MONGODB_URI is missing");
  }

  await mongoose.connect(uri);

  let inserted = 0;
  let skipped = 0;
  let updatedDerived = 0;
  let updatedDescriptions = 0;
  let updatedDefaults = 0;
  let missingForSync = 0;

  for (const record of records) {
    const existing = await Experience.findOne({
      organizationName: record.organizationName,
      city: record.city,
      major: record.major,
      description: { $in: [record.description, record._legacyDescription] },
    }).lean();

    if (existing) {
      const setUpdate = {};

      if (shouldSyncDescriptions && existing.description !== record.description) {
        setUpdate.description = record.description;
      }

      if (shouldSyncDerived) {
        const derivedUpdate = {
          benefitedFromTraining: record.benefitedFromTraining,
          wouldRecommend: record.wouldRecommend,
        };

        Object.entries(derivedUpdate).forEach(([field, value]) => {
          if (existing[field] !== value) {
            setUpdate[field] = value;
          }
        });
      }

      if (shouldSyncDefaults) {
        const defaultUpdate = {
          duration: record.duration,
          hadReward: record.hadReward,
          wasHired: record.wasHired,
        };

        Object.entries(defaultUpdate).forEach(([field, value]) => {
          if (existing[field] !== value) {
            setUpdate[field] = value;
          }
        });
      }

      if (Object.keys(setUpdate).length > 0) {
        await Experience.updateOne({ _id: existing._id }, { $set: setUpdate });

        if (Object.prototype.hasOwnProperty.call(setUpdate, "description")) {
          updatedDescriptions += 1;
        }

        if (
          Object.prototype.hasOwnProperty.call(setUpdate, "benefitedFromTraining") ||
          Object.prototype.hasOwnProperty.call(setUpdate, "wouldRecommend")
        ) {
          updatedDerived += 1;
        }

        if (
          Object.prototype.hasOwnProperty.call(setUpdate, "duration") ||
          Object.prototype.hasOwnProperty.call(setUpdate, "hadReward") ||
          Object.prototype.hasOwnProperty.call(setUpdate, "wasHired")
        ) {
          updatedDefaults += 1;
        }
      }

      skipped += 1;
      continue;
    }

    if (!shouldImport) {
      missingForSync += 1;
      continue;
    }

    await Experience.create(record);
    inserted += 1;
  }

  console.log(`Inserted: ${inserted}`);
  console.log(`Skipped duplicates: ${skipped}`);
  console.log(`Updated derived fields: ${updatedDerived}`);
  console.log(`Updated descriptions: ${updatedDescriptions}`);
  console.log(`Updated defaults: ${updatedDefaults}`);
  if (missingForSync > 0) {
    console.log(`Missing records during sync: ${missingForSync}`);
  }

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
