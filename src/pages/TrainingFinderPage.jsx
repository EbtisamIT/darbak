import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import majors from "../majors";
import API_BASE_URL from "../config/api";

const cityOptions = [
  "الرياض",
  "جدة",
  "الدمام",
  "مكة المكرمة",
  "المدينة المنورة",
  "الخبر",
  "الظهران",
  "الأحساء",
  "الجبيل",
  "القطيف",
  "رأس تنورة",
  "حفر الباطن",
  "الطائف",
  "تبوك",
  "أبها",
  "خميس مشيط",
  "نجران",
  "جازان",
  "الباحة",
  "حائل",
  "بريدة",
  "عنيزة",
  "الرس",
  "سكاكا",
  "عرعر",
  "رفحاء",
  "القريات",
  "ينبع",
  "رابغ",
  "الخرج",
  "الدرعية",
  "المجمعة",
  "الزلفي",
  "الدوادمي",
  "وادي الدواسر",
  "القويعية",
  "شقراء",
  "عفيف",
  "حوطة بني تميم",
  "المذنب",
  "البكيرية",
  "البدائع",
  "الأسياح",
  "رياض الخبراء",
  "الخفجي",
  "بقيق",
  "النعيرية",
  "قرية العليا",
  "الوجه",
  "ضباء",
  "أملج",
  "تيماء",
  "البدع",
  "العلا",
  "خيبر",
  "بدر",
  "المهد",
  "الحناكية",
  "القنفذة",
  "الليث",
  "رنية",
  "تربة",
  "الخرمة",
  "بحرة",
  "بيشة",
  "محايل عسير",
  "النماص",
  "تنومة",
  "رجال ألمع",
  "سراة عبيدة",
  "ظهران الجنوب",
  "شرورة",
  "حبونا",
  "يدمة",
  "صبيا",
  "أبو عريش",
  "صامطة",
  "بيش",
  "الدرب",
  "فرسان",
  "بلجرشي",
  "المندق",
  "العقيق",
  "المخواة",
  "طريف",
  "دومة الجندل",
  "طبرجل",
];

const pageFont = "'Aniq', 'Cairo', sans-serif";

const trainingTips = [
  {
    icon: "📧",
    title: "لا تكتفِ بالتقديم عبر الموقع",
    text: "ابحث عن بريد القسم أو الجهة وأرسل خطاب التدريب وسيرتك الذاتية مباشرة.",
  },
  {
    icon: "💼",
    title: "استخدم لينكدإن بذكاء",
    text: "تواصل باحترافية مع الموارد البشرية أو متدربين سابقين واسأل عن آلية التقديم.",
  },
  {
    icon: "⏰",
    title: "قدّم مبكرًا",
    text: "كثير من الجهات تغلق المقاعد قبل بدء التدريب بفترة طويلة.",
  },
  {
    icon: "👥",
    title: "اسأل طلابًا سبقوك",
    text: "التجارب السابقة قد توفر لك معلومات لا تجدها في الإعلانات الرسمية.",
  },
  {
    icon: "📄",
    title: "خصص سيرتك الذاتية",
    text: "ركز على المهارات المرتبطة بالتخصص والجهة التي تتقدم لها.",
  },
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

const regionCities = {
  "منطقة الرياض": [
    "الرياض",
    "الخرج",
    "الدرعية",
    "المجمعة",
    "الزلفي",
    "الدوادمي",
    "وادي الدواسر",
    "القويعية",
    "شقراء",
    "عفيف",
    "حوطة بني تميم",
  ],
  "منطقة مكة المكرمة": [
    "جدة",
    "مكة المكرمة",
    "الطائف",
    "رابغ",
    "القنفذة",
    "الليث",
    "رنية",
    "تربة",
    "الخرمة",
    "بحرة",
  ],
  "منطقة المدينة المنورة": [
    "المدينة المنورة",
    "ينبع",
    "العلا",
    "خيبر",
    "بدر",
    "المهد",
    "الحناكية",
  ],
  "المنطقة الشرقية": [
    "الدمام",
    "الخبر",
    "الظهران",
    "الأحساء",
    "الجبيل",
    "القطيف",
    "رأس تنورة",
    "حفر الباطن",
    "الخفجي",
    "بقيق",
    "النعيرية",
    "قرية العليا",
  ],
  "منطقة القصيم": [
    "بريدة",
    "عنيزة",
    "الرس",
    "المذنب",
    "البكيرية",
    "البدائع",
    "الأسياح",
    "رياض الخبراء",
  ],
  "منطقة عسير": [
    "أبها",
    "خميس مشيط",
    "بيشة",
    "محايل عسير",
    "النماص",
    "تنومة",
    "رجال ألمع",
    "سراة عبيدة",
    "ظهران الجنوب",
  ],
  "منطقة تبوك": ["تبوك", "الوجه", "ضباء", "أملج", "تيماء", "البدع"],
  "منطقة حائل": ["حائل"],
  "منطقة الحدود الشمالية": ["عرعر", "رفحاء", "طريف"],
  "منطقة جازان": [
    "جازان",
    "صبيا",
    "أبو عريش",
    "صامطة",
    "بيش",
    "الدرب",
    "فرسان",
  ],
  "منطقة نجران": ["نجران", "شرورة", "حبونا", "يدمة"],
  "منطقة الباحة": ["الباحة", "بلجرشي", "المندق", "العقيق", "المخواة"],
  "منطقة الجوف": ["سكاكا", "القريات", "دومة الجندل", "طبرجل"],
};

const cityToSuggestionRegion = new Map(
  Object.entries(regionCities).flatMap(([region, cities]) =>
    cities.map((cityName) => [cityName, region])
  )
);

const resolveSuggestionRegion = (cityName) => {
  if (!cityName) return "";
  return cityToSuggestionRegion.get(cityName) || "";
};

const dedupeOrganizations = (organizations = []) =>
  Array.from(
    new Map(
      organizations.map((organization) => [
        `${normalizeName(organization.name)}-${organization.url}`,
        organization,
      ])
    ).values()
  );

const specializationOptions = Array.from(
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

const suggestedOrganizationsByRegion = {
  "منطقة الرياض": [
    { name: "stc", url: "https://www.stc.com.sa/", note: "اتصالات وتقنية" },
    { name: "شركة علم", url: "https://www.elm.sa/", note: "حلول رقمية" },
    { name: "سدايا", url: "https://sdaia.gov.sa/", note: "بيانات وذكاء اصطناعي" },
    { name: "منشآت", url: "https://www.monshaat.gov.sa/", note: "ريادة وأعمال" },
    { name: "القدية", url: "https://www.qiddiya.com/", note: "ترفيه ومشاريع كبرى" },
  ],
  "منطقة مكة المكرمة": [
    { name: "الخطوط السعودية", url: "https://www.saudia.com/", note: "طيران وتشغيل" },
    { name: "بوبا العربية", url: "https://www.bupa.com.sa/", note: "تأمين وصحة" },
    { name: "مجموعة صافولا", url: "https://www.savola.com/", note: "أعمال وسلاسل إمداد" },
    { name: "جامعة الملك عبدالعزيز", url: "https://www.kau.edu.sa/", note: "تعليم وإدارة" },
    { name: "كدانة", url: "https://kidana.com.sa/", note: "تطوير المشاعر" },
    { name: "جامعة أم القرى", url: "https://uqu.edu.sa/", note: "تعليم وبحث" },
  ],
  "منطقة المدينة المنورة": [
    { name: "هيئة تطوير منطقة المدينة المنورة", url: "https://mda.gov.sa/", note: "تطوير حضري" },
    { name: "رؤى المدينة", url: "https://www.ruaalmadinah.com/", note: "تطوير وضيافة" },
    { name: "جامعة طيبة", url: "https://www.taibahu.edu.sa/", note: "تعليم وبحث" },
    { name: "الهيئة الملكية لمحافظة العلا", url: "https://www.rcu.gov.sa/", note: "ثقافة وسياحة" },
    { name: "الهيئة الملكية للجبيل وينبع", url: "https://www.rcjy.gov.sa/", note: "صناعة وإدارة مدن" },
  ],
  "المنطقة الشرقية": [
    { name: "أرامكو", url: "https://www.aramco.com/", note: "طاقة وهندسة" },
    { name: "سابك", url: "https://www.sabic.com/", note: "صناعة وكيمياء" },
    { name: "معادن", url: "https://www.maaden.com.sa/", note: "تعدين وصناعة" },
    { name: "الهيئة الملكية للجبيل وينبع", url: "https://www.rcjy.gov.sa/", note: "صناعة وإدارة مدن" },
    { name: "جامعة الملك فهد للبترول والمعادن", url: "https://www.kfupm.edu.sa/", note: "تعليم وتقنية" },
  ],
  "منطقة القصيم": [
    { name: "جامعة القصيم", url: "https://www.qu.edu.sa/", note: "تعليم وبحث" },
    { name: "غرفة القصيم", url: "https://www.qcc.org.sa/", note: "أعمال وتدريب" },
    { name: "المراعي", url: "https://www.almarai.com/", note: "أغذية وتشغيل" },
    { name: "وزارة البيئة والمياه والزراعة", url: "https://www.mewa.gov.sa/", note: "زراعة وبيئة" },
    { name: "صندوق التنمية الزراعية", url: "https://www.adf.gov.sa/", note: "تمويل وزراعة" },
  ],
  "منطقة عسير": [
    { name: "هيئة تطوير عسير", url: "https://www.asda.gov.sa/", note: "تطوير وسياحة" },
    { name: "جامعة الملك خالد", url: "https://www.kku.edu.sa/", note: "تعليم وبحث" },
    { name: "أمانة منطقة عسير", url: "https://www.ars.gov.sa/", note: "خدمات بلدية" },
    { name: "وزارة السياحة", url: "https://mt.gov.sa/", note: "سياحة وضيافة" },
    { name: "السودة للتطوير", url: "https://www.soudah.sa/", note: "سياحة ومشاريع كبرى" },
  ],
  "منطقة تبوك": [
    { name: "نيوم", url: "https://www.neom.com/", note: "مشاريع كبرى وتقنية" },
    { name: "البحر الأحمر الدولية", url: "https://www.redseaglobal.com/", note: "سياحة واستدامة" },
    { name: "أمالا", url: "https://www.amaala.com/", note: "سياحة وضيافة" },
    { name: "جامعة تبوك", url: "https://www.ut.edu.sa/", note: "تعليم وبحث" },
    { name: "وزارة البيئة والمياه والزراعة", url: "https://www.mewa.gov.sa/", note: "بيئة وزراعة" },
  ],
  "منطقة حائل": [
    { name: "جامعة حائل", url: "https://www.uoh.edu.sa/", note: "تعليم وبحث" },
    { name: "المراعي", url: "https://www.almarai.com/", note: "أغذية وتشغيل" },
    { name: "وزارة البيئة والمياه والزراعة", url: "https://www.mewa.gov.sa/", note: "زراعة وبيئة" },
    { name: "صندوق التنمية الزراعية", url: "https://www.adf.gov.sa/", note: "تمويل وزراعة" },
  ],
  "منطقة الحدود الشمالية": [
    { name: "جامعة الحدود الشمالية", url: "https://www.nbu.edu.sa/", note: "تعليم وبحث" },
    { name: "أمانة منطقة الحدود الشمالية", url: "https://arar-mu.momah.gov.sa/", note: "خدمات بلدية" },
    { name: "معادن", url: "https://www.maaden.com.sa/", note: "تعدين وصناعة" },
    { name: "وزارة البيئة والمياه والزراعة", url: "https://www.mewa.gov.sa/", note: "بيئة وزراعة" },
  ],
  "منطقة جازان": [
    { name: "جامعة جازان", url: "https://www.jazanu.edu.sa/", note: "تعليم وبحث" },
    { name: "غرفة جازان", url: "https://www.jazancci.org.sa/", note: "أعمال وتدريب" },
    { name: "أمانة منطقة جازان", url: "https://www.jazan.sa/", note: "خدمات بلدية" },
    { name: "أرامكو", url: "https://www.aramco.com/", note: "طاقة وتشغيل" },
    { name: "وزارة البيئة والمياه والزراعة", url: "https://www.mewa.gov.sa/", note: "بيئة وزراعة" },
  ],
  "منطقة نجران": [
    { name: "جامعة نجران", url: "https://www.nu.edu.sa/", note: "تعليم وبحث" },
    { name: "أمانة منطقة نجران", url: "https://www.najran.gov.sa/", note: "خدمات بلدية" },
    { name: "وزارة البيئة والمياه والزراعة", url: "https://www.mewa.gov.sa/", note: "بيئة وزراعة" },
    { name: "صندوق التنمية الزراعية", url: "https://www.adf.gov.sa/", note: "تمويل وزراعة" },
  ],
  "منطقة الباحة": [
    { name: "جامعة الباحة", url: "https://bu.edu.sa/", note: "تعليم وبحث" },
    { name: "أمانة منطقة الباحة", url: "https://baha.gov.sa/", note: "خدمات بلدية" },
    { name: "وزارة السياحة", url: "https://mt.gov.sa/", note: "سياحة وضيافة" },
    { name: "وزارة البيئة والمياه والزراعة", url: "https://www.mewa.gov.sa/", note: "بيئة وزراعة" },
  ],
  "منطقة الجوف": [
    { name: "جامعة الجوف", url: "https://www.ju.edu.sa/", note: "تعليم وبحث" },
    { name: "نادك", url: "https://nadec.com/", note: "زراعة وأغذية" },
    { name: "وزارة البيئة والمياه والزراعة", url: "https://www.mewa.gov.sa/", note: "بيئة وزراعة" },
    { name: "صندوق التنمية الزراعية", url: "https://www.adf.gov.sa/", note: "تمويل وزراعة" },
  ],
};

const organizationHomepageEntries = [
  ...Object.values(suggestedOrganizationsByRegion)
    .flat()
    .map((organization) => [organization.name, organization.url]),
  ["علم", "https://www.elm.sa/"],
  ["elm", "https://www.elm.sa/"],
  ["اس تي سي", "https://www.stc.com.sa/"],
  ["الاتصالات السعودية", "https://www.stc.com.sa/"],
  ["أرامكو", "https://www.aramco.com/"],
  ["ارامكو", "https://www.aramco.com/"],
  ["aramco", "https://www.aramco.com/"],
  ["سابك", "https://www.sabic.com/"],
  ["sabic", "https://www.sabic.com/"],
  ["هيئة السوق المالية", "https://cma.org.sa/"],
  ["الهيئة السوق المالية", "https://cma.org.sa/"],
  ["cma", "https://cma.org.sa/"],
  ["زين", "https://sa.zain.com/"],
  ["شركة زين", "https://sa.zain.com/"],
  ["zain", "https://sa.zain.com/"],
  ["EY", "https://www.ey.com/ar_sa"],
  ["EY (Ernst & Young)", "https://www.ey.com/ar_sa"],
  ["Ernst & Young", "https://www.ey.com/ar_sa"],
  ["ارامكو", "https://www.aramco.com/"],
  ["معادن", "https://www.maaden.com.sa/"],
  ["maaden", "https://www.maaden.com.sa/"],
  ["سدايا", "https://sdaia.gov.sa/"],
  ["sdaia", "https://sdaia.gov.sa/"],
  ["منشآت", "https://www.monshaat.gov.sa/"],
  ["منشات", "https://www.monshaat.gov.sa/"],
  ["مسك", "https://misk.org.sa/"],
  ["misk", "https://misk.org.sa/"],
];

const organizationHomepageMap = new Map(
  organizationHomepageEntries.map(([name, url]) => [normalizeName(name), url])
);

const getOrganizationLookupKeys = (value = "") => {
  const normalized = normalizeName(value);
  const withoutGenericPrefix = normalized.replace(
    /^(شركه|شركة|الهيئه|هيئه|الوزاره|وزاره|جامعه|غرفه|امانه)\s+/,
    ""
  );

  return Array.from(
    new Set([
      normalized,
      withoutGenericPrefix,
      normalized.replace(/\s+بالرياض$/, ""),
      normalized.replace(/\s+بجده$/, ""),
      normalized.replace(/\s+بمكه$/, ""),
      normalized.replace(/\s+بالمدينه$/, ""),
    ].filter(Boolean))
  );
};

const resolveOrganizationHomepageUrl = (organizationName) => {
  const lookupKeys = getOrganizationLookupKeys(organizationName);
  const directUrl = lookupKeys
    .map((key) => organizationHomepageMap.get(key))
    .find(Boolean);

  if (directUrl) return directUrl;

  const normalizedOrganization = normalizeName(organizationName);
  if (normalizedOrganization.length < 4) return "";

  return organizationHomepageEntries.find(([name]) => {
    const normalizedName = normalizeName(name);
    return (
      normalizedName.length >= 4 &&
      (normalizedOrganization.includes(normalizedName) ||
        normalizedName.includes(normalizedOrganization))
    );
  })?.[1] || "";
};

export default function TrainingFinderPage() {
  const [selectedSpecialty, setSelectedSpecialty] = useState("");
  const [city, setCity] = useState("");
  const [targets, setTargets] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAllTrainingTips, setShowAllTrainingTips] = useState(false);

  const selectedSpecialtyOption = useMemo(
    () =>
      specializationOptions.find(
        (option) => option.value === selectedSpecialty
      ),
    [selectedSpecialty]
  );
  const selectedSpecialtyLabel =
    selectedSpecialtyOption?.label || selectedSpecialty;
  const selectedMajorCategories = selectedSpecialtyOption?.categories || [];
  const selectedMajorCategoriesText = selectedMajorCategories.join("، ");
  const suggestionRegion = resolveSuggestionRegion(city);
  const existingTargetNames = useMemo(
    () => new Set(targets.map((target) => normalizeName(target.organizationName))),
    [targets]
  );
  const suggestedOrganizations = useMemo(() => {
    const organizations = suggestionRegion
      ? suggestedOrganizationsByRegion[suggestionRegion] || []
      : Object.values(suggestedOrganizationsByRegion).flat();

    return dedupeOrganizations(organizations).filter(
      (organization) =>
        !existingTargetNames.has(normalizeName(organization.name))
    );
  }, [existingTargetNames, suggestionRegion]);

  const fetchTrainingTargets = async (event) => {
    event.preventDefault();

    if (!selectedSpecialty) {
      setError("اختَر تخصصك أولًا.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSearched(true);

      const { data } = await axios.get(`${API_BASE_URL}/api/training-targets`, {
        params: {
          major: selectedSpecialty,
          majorCategory: selectedMajorCategories[0] || "",
          majorCategories: selectedMajorCategories.join(","),
          city,
        },
      });

      setTargets(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      console.error(err);
      setError("تعذر عرض النتائج حاليًا.");
      setTargets([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        width: "100%",
        minHeight: "70vh",
        direction: "rtl",
        fontFamily: pageFont,
        color: "var(--app-text)",
      }}
    >
      <section
        style={{
          width: "min(100%, 980px)",
          margin: "0 auto",
          display: "grid",
          gap: "18px",
        }}
      >
        <header style={{ textAlign: "center" }}>
          <p
            style={{
              margin: "0 0 8px",
              color: "var(--app-brand)",
              fontSize: "14px",
              fontWeight: "800",
            }}
          >
            بناءً على تجارب الطلاب السابقة
          </p>
          <h1
            style={{
              margin: 0,
              color: "var(--app-text)",
              fontSize: "clamp(28px, 4vw, 44px)",
              lineHeight: 1.35,
            }}
          >
            وين أتدرب؟
          </h1>
          <p
            style={{
              margin: "12px auto 0",
              maxWidth: "650px",
              color: "var(--app-text-soft)",
              lineHeight: 1.8,
              fontSize: "15px",
            }}
          >
            اختَر تخصصك من القائمة، وإذا ودك حدد المدينة، ونقترح لك جهات سبق
            أن شارك الطلاب تجارب تدريبهم فيها.
          </p>
        </header>

        <section
          className={`training-tips-section ${
            showAllTrainingTips ? "is-expanded" : ""
          }`}
          aria-label="نصائح للحصول على التدريب"
          style={{
            background: "var(--app-surface)",
            border: "1px solid var(--app-border)",
            borderRadius: "16px",
            padding: "14px",
            display: "grid",
            gap: "12px",
            boxShadow: "0 10px 24px var(--app-shadow)",
          }}
        >
          <div>
            <h2
              style={{
                margin: "0 0 5px",
                color: "var(--app-text)",
                fontSize: "clamp(17px, 2vw, 23px)",
                lineHeight: 1.5,
              }}
            >
              🚀 خطوات ساعدت طلابًا في الحصول على فرص تدريب
            </h2>
            <p
              className="training-tips-mobile-summary"
              style={{
                display: "none",
                margin: 0,
                color: "var(--app-text-soft)",
                fontSize: "12px",
                lineHeight: 1.7,
              }}
            >
              نصائح سريعة قبل البحث عن الجهات المناسبة.
            </p>
          </div>

          <div
            className="training-tips-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
              gap: "10px",
            }}
          >
            {trainingTips.map((tip) => (
              <article
                key={tip.title}
                style={{
                  background: "var(--app-card)",
                  border: "1px solid var(--app-border)",
                  borderRadius: "14px",
                  padding: "12px",
                  minHeight: "118px",
                  boxSizing: "border-box",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "7px",
                    color: "var(--app-brand)",
                    fontWeight: "800",
                    fontSize: "13px",
                    lineHeight: 1.5,
                    marginBottom: "7px",
                  }}
                >
                  <span aria-hidden="true">{tip.icon}</span>
                  <span>{tip.title}</span>
                </div>
                <p
                  style={{
                    margin: 0,
                    color: "var(--app-text-soft)",
                    fontSize: "12px",
                    lineHeight: 1.75,
                  }}
                >
                  {tip.text}
                </p>
              </article>
            ))}
          </div>

          <button
            type="button"
            className="training-tips-toggle"
            onClick={() => setShowAllTrainingTips((prev) => !prev)}
            style={{
              display: "none",
              width: "100%",
              border: "1px solid var(--app-brand-border)",
              background: "var(--app-brand-soft)",
              color: "var(--app-brand)",
              borderRadius: "12px",
              padding: "9px 12px",
              fontFamily: "inherit",
              fontWeight: "800",
              cursor: "pointer",
            }}
          >
            {showAllTrainingTips ? "إخفاء النصائح" : "عرض كل النصائح"}
          </button>
        </section>

        <form
          onSubmit={fetchTrainingTargets}
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr) auto",
            gap: "10px",
            alignItems: "end",
            background: "var(--app-surface)",
            border: "1px solid var(--app-border)",
            borderRadius: "16px",
            padding: "14px",
          }}
          className="training-finder-form"
        >
          <label style={{ display: "grid", gap: "7px", color: "var(--app-text-soft)", fontSize: "13px" }}>
            التخصص
            <select
              value={selectedSpecialty}
              onChange={(event) => setSelectedSpecialty(event.target.value)}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "12px",
                border: "1px solid var(--app-border)",
                background: "var(--app-input-bg)",
                color: "var(--app-text)",
                fontFamily: "inherit",
              }}
            >
              <option value="">اختر تخصصك</option>
              {specializationOptions.map((specialization) => (
                <option key={specialization.value} value={specialization.value}>
                  {specialization.label}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: "7px", color: "var(--app-text-soft)", fontSize: "13px" }}>
            المدينة
            <select
              value={city}
              onChange={(event) => setCity(event.target.value)}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "12px",
                border: "1px solid var(--app-border)",
                background: "var(--app-input-bg)",
                color: "var(--app-text)",
                fontFamily: "inherit",
              }}
            >
              <option value="">كل المدن</option>
              {cityOptions.map((cityName) => (
                <option key={cityName} value={cityName}>
                  {cityName}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            disabled={loading}
            style={{
              background: "var(--app-brand)",
              color: "#07100e",
              border: "none",
              borderRadius: "12px",
              padding: "13px 20px",
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              fontWeight: "900",
              whiteSpace: "nowrap",
              boxShadow: "0 0 14px var(--app-brand-border)",
            }}
          >
            {loading ? "جاري البحث..." : "اعرض الجهات"}
          </button>
        </form>

        {error && (
          <p
            style={{
              margin: 0,
              color: "#fecdd3",
              textAlign: "center",
              background: "rgba(244,63,94,0.08)",
              border: "1px solid rgba(244,63,94,0.18)",
              borderRadius: "12px",
              padding: "10px",
            }}
          >
            {error}
          </p>
        )}

        {searched && !loading && !error && (
          <section style={{ display: "grid", gap: "14px" }}>
            <h2
              style={{
                margin: 0,
                color: "var(--app-text)",
                fontSize: "20px",
                lineHeight: 1.5,
              }}
            >
              شركات فيها تجارب سابقة في دربك
              <span
                style={{
                  display: "block",
                  color: "var(--app-muted)",
                  fontSize: "13px",
                  fontWeight: "500",
                  marginTop: "4px",
                }}
              >
                نتائج {selectedSpecialtyLabel}
                {city ? ` في ${city}` : ""}
                {selectedMajorCategoriesText
                  ? ` - ضمن ${selectedMajorCategoriesText}`
                  : ""}
              </span>
            </h2>

            {targets.length === 0 ? (
              <div
                style={{
                  background: "var(--app-surface)",
                  border: "1px solid var(--app-border)",
                  borderRadius: "16px",
                  padding: "18px",
                  textAlign: "center",
                  color: "var(--app-text-soft)",
                  lineHeight: 1.8,
                }}
              >
                ما لقينا تجارب مطابقة لهذا التخصص والمدينة حاليًا. جرّب
                البحث بدون تحديد مدينة، أو استفد من الجهات المقترحة بالأسفل
                كبداية للتقديم.
              </div>
            ) : (
              <div
                className="training-targets-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: "12px",
                }}
              >
                {targets.map((target) => {
                  const organizationHomepageUrl = resolveOrganizationHomepageUrl(
                    target.organizationName
                  );

                  return (
                    <article
                      key={target.organizationName}
                      style={{
                        background: "var(--app-surface)",
                        border: "1px solid var(--app-border)",
                        borderRadius: "16px",
                        padding: "16px",
                        display: "grid",
                        gap: "12px",
                        boxShadow: "0 10px 24px var(--app-shadow)",
                      }}
                    >
                      <div>
                        <h3
                          style={{
                            margin: "0 0 6px",
                            color: "var(--app-brand)",
                            fontSize: "24px",
                            lineHeight: 1.3,
                          }}
                        >
                          {target.organizationName}
                        </h3>
                        <p
                          style={{
                            margin: 0,
                            color: "var(--app-text-soft)",
                            fontSize: "13px",
                          }}
                        >
                          {target.cities?.join("، ") || "مدينة غير محددة"}
                        </p>
                      </div>

                      <div
                        style={{
                          background: "var(--app-card)",
                          border: "1px solid var(--app-border)",
                          borderRadius: "12px",
                          padding: "11px",
                        }}
                      >
                        <p style={{ margin: "0 0 7px", color: "var(--app-brand)", fontWeight: "800", fontSize: "13px" }}>
                          سبق أن تدرب فيها طلاب من:
                        </p>
                        <p style={{ margin: 0, color: "var(--app-text-soft)", fontSize: "13px", lineHeight: 1.7 }}>
                          {target.majors?.length ? target.majors.join("، ") : "تخصصات غير محددة"}
                        </p>
                      </div>

                      <div>
                        <p style={{ margin: "0 0 8px", color: "var(--app-brand)", fontWeight: "800", fontSize: "13px" }}>
                          طرق الحصول على الفرصة المذكورة:
                        </p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "7px" }}>
                          {(target.methods?.length ? target.methods : ["غير محدد"]).map((method) => (
                            <span
                              key={method}
                              style={{
                                background: "var(--app-brand-soft)",
                                border: "1px solid var(--app-brand-border)",
                                color: "var(--app-text-soft)",
                                borderRadius: "999px",
                                padding: "6px 9px",
                                fontSize: "12px",
                              }}
                            >
                              {method}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <Link
                          to={{
                            pathname: "/experiences",
                            search: `?company=${encodeURIComponent(
                              target.organizationName
                            )}`,
                          }}
                          style={{ textDecoration: "none" }}
                        >
                          <button
                            type="button"
                            style={{
                              background: "var(--app-brand)",
                              color: "#07100e",
                              border: "none",
                              borderRadius: "10px",
                              padding: "9px 12px",
                              fontFamily: "inherit",
                              fontWeight: "800",
                              cursor: "pointer",
                            }}
                          >
                            قراءة التجارب
                          </button>
                        </Link>
                        {organizationHomepageUrl && (
                          <a
                            href={organizationHomepageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ textDecoration: "none" }}
                          >
                            <button
                              type="button"
                              style={{
                                background: "var(--app-input-bg)",
                                color: "var(--app-brand)",
                                border: "1px solid var(--app-brand-border)",
                                borderRadius: "10px",
                                padding: "9px 12px",
                                fontFamily: "inherit",
                                fontWeight: "800",
                                cursor: "pointer",
                              }}
                            >
                              زيارة صفحة الجهة
                            </button>
                          </a>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            <p
              style={{
                margin: "6px 0 0",
                color: "var(--app-muted)",
                fontSize: "13px",
                lineHeight: 1.8,
                textAlign: "center",
              }}
            >
              الجهات المعروضة مبنية على تجارب طلاب سابقة، ولا يعني ظهور الجهة
              توفر فرصة تدريب حاليًا.
            </p>

            <section
              style={{
                display: "grid",
                gap: "12px",
                marginTop: "10px",
              }}
            >
              <div>
                <h2
                  style={{
                    margin: "0 0 5px",
                    color: "var(--app-text)",
                    fontSize: "20px",
                    lineHeight: 1.5,
                  }}
                >
                  جهات نقترحها عليك للتقديم
                </h2>
                <p
                  style={{
                    margin: 0,
                    color: "var(--app-muted)",
                    fontSize: "13px",
                    lineHeight: 1.8,
                  }}
                >
                  هذه جهات نقترحها عليك تقدم فيها وليست موجودة ضمن نتائج تجارب
                  دربك الحالية
                  {suggestionRegion ? ` في ${suggestionRegion}` : " في المناطق المحددة"}.
                </p>
              </div>

              {city && !suggestionRegion ? (
                <div
                  style={{
                    background: "var(--app-surface)",
                    border: "1px solid var(--app-border)",
                    borderRadius: "16px",
                    padding: "16px",
                    color: "var(--app-text-soft)",
                    lineHeight: 1.8,
                  }}
                >
                  ما قدرنا نحدد منطقة هذه المدينة حاليًا، جرّب البحث بدون
                  تحديد مدينة لعرض اقتراحات من كل المناطق.
                </div>
              ) : suggestedOrganizations.length === 0 ? (
                <div
                  style={{
                    background: "var(--app-surface)",
                    border: "1px solid var(--app-border)",
                    borderRadius: "16px",
                    padding: "16px",
                    color: "var(--app-text-soft)",
                    lineHeight: 1.8,
                  }}
                >
                  كل الجهات المقترحة لهذه المنطقة موجودة بالفعل ضمن تجارب دربك
                  الحالية.
                </div>
              ) : (
                <div
                  className="suggested-targets-grid"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: "10px",
                  }}
                >
                  {suggestedOrganizations.map((organization) => (
                    <article
                      key={`${organization.name}-${organization.url}`}
                      style={{
                        background: "var(--app-surface)",
                        border: "1px solid var(--app-border)",
                        borderRadius: "15px",
                        padding: "14px",
                        display: "grid",
                        gap: "10px",
                      }}
                    >
                      <div>
                        <h3
                          style={{
                            margin: "0 0 5px",
                            color: "var(--app-brand)",
                            fontSize: "17px",
                            lineHeight: 1.4,
                          }}
                        >
                          {organization.name}
                        </h3>
                        <p
                          style={{
                            margin: 0,
                            color: "var(--app-text-soft)",
                            fontSize: "12px",
                            lineHeight: 1.7,
                          }}
                        >
                          {organization.note}
                        </p>
                      </div>
                      <a
                        href={organization.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ textDecoration: "none" }}
                      >
                        <button
                          type="button"
                          style={{
                            width: "100%",
                            background: "var(--app-input-bg)",
                            color: "var(--app-brand)",
                            border: "1px solid var(--app-brand-border)",
                            borderRadius: "10px",
                            padding: "9px 10px",
                            fontFamily: "inherit",
                            fontWeight: "800",
                            cursor: "pointer",
                          }}
                        >
                          زيارة صفحة الجهة
                        </button>
                      </a>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </section>
        )}
      </section>

      <style>{`
        @media (max-width: 980px) {
          .training-tips-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 760px) {
          .training-finder-form {
            grid-template-columns: 1fr !important;
          }

          .training-tips-section {
            padding: 12px !important;
            gap: 9px !important;
          }

          .training-tips-section h2 {
            font-size: 16px !important;
            margin-bottom: 4px !important;
          }

          .training-tips-mobile-summary,
          .training-tips-toggle {
            display: block !important;
          }

          .training-tips-grid {
            grid-template-columns: 1fr !important;
            gap: 7px !important;
          }

          .training-tips-grid article {
            min-height: auto !important;
            padding: 10px 11px !important;
          }

          .training-tips-grid article div {
            margin-bottom: 3px !important;
            font-size: 12px !important;
          }

          .training-tips-grid article p {
            font-size: 11px !important;
            line-height: 1.65 !important;
          }

          .training-tips-section:not(.is-expanded) .training-tips-grid article:nth-child(n + 2) {
            display: none !important;
          }

          .training-targets-grid {
            grid-template-columns: 1fr !important;
          }

          .suggested-targets-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}
