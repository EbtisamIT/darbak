import majors from "../majors";

export const cityOptions = [
  "الرياض",
  "جدة",
  "مكة المكرمة",
  "المدينة المنورة",
  "الدمام",
  "الخبر",
  "الظهران",
  "الأحساء",
  "الجبيل",
  "الطائف",
  "أبها",
  "خميس مشيط",
  "نجران",
  "جازان",
  "تبوك",
  "حائل",
  "بريدة",
  "الباحة",
  "سكاكا",
  "عرعر",
  "ينبع",
  "الخرج",
  "العلا",
];

const normalizeName = (value = "") =>
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

export const specializationOptions = Array.from(
  majors
    .reduce((optionsMap, majorGroup) => {
      (majorGroup.subMajors || []).forEach((specialization) => {
        const key = normalizeName(specialization);
        const existingOption = optionsMap.get(key);

        if (existingOption) {
          if (!existingOption.categories.includes(majorGroup.name)) {
            existingOption.categories.push(majorGroup.name);
          }
          return;
        }

        optionsMap.set(key, {
          value: specialization,
          label: specialization,
          categories: [majorGroup.name],
        });
      });

      return optionsMap;
    }, new Map())
    .values()
).sort((a, b) => a.label.localeCompare(b.label, "ar"));
