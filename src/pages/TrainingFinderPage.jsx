import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import majors from "../majors";
import API_BASE_URL from "../config/api";
import TrainingGuideBanner from "../components/TrainingGuideBanner";

const cityOptions = [
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

const pageFont = "'Aniq', 'Cairo', sans-serif";
const SHOW_TRAINING_GUIDE_BANNER = true;

const trainingFinderFaqItems = [
  {
    question: "هل ظهور الجهة يعني توفر تدريب حاليًا؟",
    answer:
      "لا، ظهور الجهة يعني أن طلابًا سبق وشاركوا تجربة تدريب فيها أو أنها جهة مناسبة كبداية بحث. التوفر الحالي يعتمد على إعلان الجهة أو تواصلها الرسمي.",
  },
  {
    question: "إذا ما ظهرت تجارب لتخصصي، هل يعني ما له جهات؟",
    answer:
      "أبدًا. قاعدة دربك تتوسع مع مشاركات الطلاب، وقد تكون الفرص موجودة لكن ما وصلتنا تجارب كافية عنها بعد.",
  },
  {
    question: "أبدأ بالتقديم من الموقع أو الإيميل؟",
    answer:
      "ابدأ بالموقع الرسمي إذا كان فيه برنامج تدريب واضح، وإذا ما لقيت رابطًا مباشرًا جرّب الإيميل المهني أو تواصل لينكدإن باختصار واحترام.",
  },
  {
    question: "ليش بعض النتائج اقتراحات وليست من تجارب دربك؟",
    answer:
      "نضيف الاقتراحات عشان تعطيك نقطة بداية أوسع، لكنها منفصلة عن تجارب دربك ولا تعني توفر فرصة حالية.",
  },
  {
    question: "كيف أساعد طلاب تخصصي؟",
    answer:
      "إذا تدربت في جهة، مشاركة تجربتك تضيف مسارًا جديدًا لطلاب بعدك وتخلي نتائج الصفحة أذكى وأقرب للواقع.",
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

const regionOptions = Object.keys(regionCities);

const cityToSuggestionRegion = new Map(
  Object.entries(regionCities).flatMap(([region, cities]) =>
    cities.map((cityName) => [cityName, region])
  )
);

const resolveSuggestionRegion = (cityName) => {
  if (!cityName) return "";
  if (regionCities[cityName]) return cityName;
  return cityToSuggestionRegion.get(cityName) || "";
};

const getSelectedCityScope = (cityName) => {
  if (!cityName) return [];
  if (regionCities[cityName]) return regionCities[cityName];
  return [cityName];
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

const getOrganizationDomain = (url = "") => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

const getOrganizationLogoUrl = (url = "") => {
  const domain = getOrganizationDomain(url);
  if (!domain) return "";
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
};

const getOrganizationInitial = (name = "") => {
  const firstLetter = name.trim().replace(/[^\u0600-\u06FFA-Za-z0-9]/g, "")[0];
  return firstLetter || "د";
};

const OrganizationLogo = ({ name, url }) => {
  const [hasImageError, setHasImageError] = useState(false);
  const logoUrl = getOrganizationLogoUrl(url);
  const initial = getOrganizationInitial(name);

  return (
    <span
      className="suggested-organization-logo"
      aria-hidden="true"
      style={{
        width: "42px",
        height: "42px",
        borderRadius: "14px",
        display: "inline-grid",
        placeItems: "center",
        flex: "0 0 auto",
        minWidth: "42px",
        maxWidth: "42px",
        minHeight: "42px",
        maxHeight: "42px",
        aspectRatio: "1 / 1",
        background: "var(--app-brand-soft)",
        border: "1px solid var(--app-brand-border)",
        color: "var(--app-brand)",
        fontSize: "18px",
        fontWeight: "900",
        lineHeight: 1,
        overflow: "hidden",
      }}
    >
      {logoUrl && !hasImageError ? (
        <img
          src={logoUrl}
          alt=""
          width="24"
          height="24"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setHasImageError(true)}
          style={{
            width: "24px",
            height: "24px",
            minWidth: "24px",
            minHeight: "24px",
            display: "block",
            objectFit: "contain",
            borderRadius: "6px",
          }}
        />
      ) : (
        initial
      )}
    </span>
  );
};

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

export const suggestedOrganizationsByRegion = {
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

export const suggestedOrganizationsByMajorCategory = {
  "الطب والعلوم الصحية": [
    { name: "وزارة الصحة", url: "https://www.moh.gov.sa/", note: "صحة عامة وإدارة صحية" },
    { name: "الهيئة العامة للغذاء والدواء", url: "https://www.sfda.gov.sa/", note: "رقابة ومختبرات وصحة" },
    { name: "مستشفى الملك فيصل التخصصي", url: "https://www.kfshrc.edu.sa/", note: "رعاية صحية وبحث" },
    { name: "مجلس الضمان الصحي", url: "https://chi.gov.sa/", note: "تأمين صحي وتنظيم" },
    { name: "بوبا العربية", url: "https://www.bupa.com.sa/", note: "تأمين وخدمات صحية" },
    { name: "مجموعة الدكتور سليمان الحبيب", url: "https://hmg.com/", note: "تشغيل صحي ومستشفيات" },
    { name: "دله الصحية", url: "https://www.dallah-health.com/", note: "رعاية صحية وتشغيل" },
  ],
  "الهندسة والطاقة": [
    { name: "أرامكو", url: "https://www.aramco.com/", note: "طاقة وهندسة وتشغيل" },
    { name: "سابك", url: "https://www.sabic.com/", note: "صناعة وكيمياء وهندسة" },
    { name: "معادن", url: "https://www.maaden.com.sa/", note: "تعدين وصناعة" },
    { name: "الشركة السعودية للكهرباء", url: "https://www.se.com.sa/", note: "طاقة كهربائية وتشغيل" },
    { name: "أكوا باور", url: "https://www.acwapower.com/", note: "طاقة ومياه واستدامة" },
    { name: "الهيئة الملكية للجبيل وينبع", url: "https://www.rcjy.gov.sa/", note: "مدن صناعية وهندسة" },
    { name: "نيوم", url: "https://www.neom.com/", note: "مشاريع كبرى وتقنية" },
    { name: "البحر الأحمر الدولية", url: "https://www.redseaglobal.com/", note: "استدامة ومشاريع" },
  ],
  "الحاسب والتقنية": [
    { name: "سدايا", url: "https://sdaia.gov.sa/", note: "بيانات وذكاء اصطناعي" },
    { name: "هيئة الحكومة الرقمية", url: "https://dga.gov.sa/", note: "تحول رقمي وحوكمة" },
    { name: "هيئة الاتصالات والفضاء والتقنية", url: "https://www.cst.gov.sa/", note: "تقنية واتصالات وتنظيم" },
    { name: "stc", url: "https://www.stc.com.sa/", note: "اتصالات وتقنية" },
    { name: "شركة علم", url: "https://www.elm.sa/", note: "حلول رقمية ومنتجات" },
    { name: "زين السعودية", url: "https://sa.zain.com/", note: "اتصالات وتقنية" },
    { name: "موبايلي", url: "https://www.mobily.com.sa/", note: "اتصالات وتقنية" },
    { name: "SITE", url: "https://site.sa/", note: "أمن سيبراني وتقنية" },
  ],
  "القانون والسياسة": [
    { name: "وزارة العدل", url: "https://www.moj.gov.sa/", note: "قانون وخدمات عدلية" },
    { name: "ديوان المظالم", url: "https://www.bog.gov.sa/", note: "قضاء إداري وأنظمة" },
    { name: "النيابة العامة", url: "https://pp.gov.sa/", note: "أنظمة وعدالة جنائية" },
    { name: "هيئة حقوق الإنسان", url: "https://www.hrc.gov.sa/", note: "حقوق وأنظمة" },
    { name: "هيئة الخبراء بمجلس الوزراء", url: "https://www.boe.gov.sa/", note: "تشريعات وسياسات" },
    { name: "وزارة الخارجية", url: "https://www.mofa.gov.sa/", note: "سياسة وعلاقات دولية" },
    { name: "هيئة السوق المالية", url: "https://cma.org.sa/", note: "أنظمة مالية وتنظيم" },
  ],
  "المالية والإدارية": [
    { name: "البنك المركزي السعودي", url: "https://www.sama.gov.sa/", note: "مالية وبنوك وتنظيم" },
    { name: "هيئة السوق المالية", url: "https://cma.org.sa/", note: "أسواق مالية وحوكمة" },
    { name: "تداول السعودية", url: "https://www.saudiexchange.sa/", note: "أسواق مالية وعمليات" },
    { name: "صندوق الاستثمارات العامة", url: "https://www.pif.gov.sa/", note: "استثمار وإدارة" },
    { name: "وزارة المالية", url: "https://www.mof.gov.sa/", note: "مالية عامة وإدارة" },
    { name: "هيئة الزكاة والضريبة والجمارك", url: "https://zatca.gov.sa/", note: "ضريبة وجمارك وامتثال" },
    { name: "EY", url: "https://www.ey.com/ar_sa", note: "استشارات ومراجعة" },
    { name: "PwC الشرق الأوسط", url: "https://www.pwc.com/m1/en/countries/saudi-arabia.html", note: "استشارات ومراجعة" },
    { name: "Deloitte الشرق الأوسط", url: "https://www.deloitte.com/middle-east/en/about/locations/saudi-arabia.html", note: "استشارات ومراجعة" },
    { name: "KPMG السعودية", url: "https://kpmg.com/sa/", note: "استشارات ومراجعة" },
  ],
  "السياحة والضيافة": [
    { name: "وزارة السياحة", url: "https://mt.gov.sa/", note: "سياحة وتنظيم" },
    { name: "الهيئة السعودية للسياحة", url: "https://www.sta.gov.sa/", note: "تسويق وتجارب سياحية" },
    { name: "البحر الأحمر الدولية", url: "https://www.redseaglobal.com/", note: "سياحة وضيافة واستدامة" },
    { name: "أمالا", url: "https://www.amaala.com/", note: "وجهات سياحية فاخرة" },
    { name: "رؤى المدينة", url: "https://www.ruaalmadinah.com/", note: "ضيافة وتطوير وجهات" },
    { name: "كدانة", url: "https://kidana.com.sa/", note: "تطوير المشاعر وخدمات" },
    { name: "الهيئة الملكية لمحافظة العلا", url: "https://www.rcu.gov.sa/", note: "ثقافة وسياحة" },
    { name: "السودة للتطوير", url: "https://www.soudah.sa/", note: "سياحة ومشاريع كبرى" },
  ],
  "الإعلام والإتصال": [
    { name: "وزارة الإعلام", url: "https://media.gov.sa/", note: "إعلام واتصال حكومي" },
    { name: "هيئة الإذاعة والتلفزيون", url: "https://www.sba.sa/", note: "إنتاج وبث إعلامي" },
    { name: "وكالة الأنباء السعودية", url: "https://www.spa.gov.sa/", note: "صحافة وأخبار" },
    { name: "الهيئة العامة لتنظيم الإعلام", url: "https://gc.gov.sa/", note: "تنظيم إعلامي" },
    { name: "MBC", url: "https://www.mbc.net/", note: "إعلام وإنتاج" },
    { name: "المجموعة السعودية للأبحاث والإعلام", url: "https://www.srmg.com/", note: "إعلام ونشر" },
    { name: "هيئة الاتصالات والفضاء والتقنية", url: "https://www.cst.gov.sa/", note: "اتصال وتقنية وتنظيم" },
  ],
  "اللغات والآداب": [
    { name: "وزارة الثقافة", url: "https://www.moc.gov.sa/", note: "ثقافة ومبادرات" },
    { name: "هيئة الأدب والنشر والترجمة", url: "https://lpt.moc.gov.sa/", note: "أدب ونشر وترجمة" },
    { name: "مجمع الملك سلمان العالمي للغة العربية", url: "https://ksaa.gov.sa/", note: "لغة عربية ومحتوى" },
    { name: "مكتبة الملك فهد الوطنية", url: "https://www.kfnl.gov.sa/", note: "مكتبات ومعلومات" },
    { name: "دارة الملك عبدالعزيز", url: "https://www.darah.org.sa/", note: "توثيق وتاريخ" },
    { name: "هيئة التراث", url: "https://heritage.moc.gov.sa/", note: "تراث ومحتوى ثقافي" },
  ],
  "التصميم والفنون": [
    { name: "وزارة الثقافة", url: "https://www.moc.gov.sa/", note: "ثقافة وفنون" },
    { name: "هيئة فنون العمارة والتصميم", url: "https://archdesign.moc.gov.sa/", note: "تصميم وعمارة" },
    { name: "هيئة الفنون البصرية", url: "https://visualarts.moc.gov.sa/", note: "فنون بصرية" },
    { name: "هيئة الأفلام", url: "https://film.moc.gov.sa/", note: "إنتاج وصناعة أفلام" },
    { name: "معهد مسك للفنون", url: "https://miskartinstitute.org/", note: "فنون وتطوير إبداعي" },
    { name: "إثراء", url: "https://www.ithra.com/", note: "ثقافة وإبداع" },
    { name: "بوابة الدرعية", url: "https://www.diriyah.sa/", note: "تصميم وتجارب ثقافية" },
  ],
  "العلوم الأساسية": [
    { name: "كاوست", url: "https://www.kaust.edu.sa/", note: "بحث وعلوم متقدمة" },
    { name: "مدينة الملك عبدالعزيز للعلوم والتقنية", url: "https://www.kacst.gov.sa/", note: "بحث وابتكار" },
    { name: "هيئة المساحة الجيولوجية السعودية", url: "https://sgs.gov.sa/", note: "جيولوجيا وعلوم أرض" },
    { name: "المركز الوطني للأرصاد", url: "https://ncm.gov.sa/", note: "أرصاد وبيانات" },
    { name: "الهيئة العامة للغذاء والدواء", url: "https://www.sfda.gov.sa/", note: "مختبرات ورقابة" },
    { name: "المركز الوطني للرقابة على الالتزام البيئي", url: "https://ncec.gov.sa/", note: "بيئة واستدامة" },
  ],
  "العلوم الإنسانية": [
    { name: "دارة الملك عبدالعزيز", url: "https://www.darah.org.sa/", note: "تاريخ وتوثيق" },
    { name: "هيئة التراث", url: "https://heritage.moc.gov.sa/", note: "تراث وأبحاث" },
    { name: "وزارة الثقافة", url: "https://www.moc.gov.sa/", note: "ثقافة ومشاريع" },
    { name: "مكتبة الملك فهد الوطنية", url: "https://www.kfnl.gov.sa/", note: "مكتبات ومعلومات" },
    { name: "الهيئة الملكية لمحافظة العلا", url: "https://www.rcu.gov.sa/", note: "تراث وسياحة" },
    { name: "مجمع الملك سلمان العالمي للغة العربية", url: "https://ksaa.gov.sa/", note: "لغة ومحتوى" },
  ],
  "العلوم الإجتماعية": [
    { name: "وزارة الموارد البشرية والتنمية الاجتماعية", url: "https://www.hrsd.gov.sa/", note: "تنمية اجتماعية وعمل" },
    { name: "هيئة حقوق الإنسان", url: "https://www.hrc.gov.sa/", note: "حقوق ومجتمع" },
    { name: "مركز الملك سلمان للإغاثة", url: "https://www.ksrelief.org/", note: "عمل إنساني وتنمية" },
    { name: "جمعية إنسان", url: "https://ensanonline.com/", note: "خدمة اجتماعية" },
    { name: "مؤسسة مسك", url: "https://misk.org.sa/", note: "تمكين شباب ومبادرات" },
    { name: "جمعية الأطفال ذوي الإعاقة", url: "https://dca.org.sa/", note: "خدمة اجتماعية ورعاية" },
  ],
  "العلوم التربوية": [
    { name: "وزارة التعليم", url: "https://www.moe.gov.sa/", note: "تعليم وسياسات" },
    { name: "هيئة تقويم التعليم والتدريب", url: "https://etec.gov.sa/", note: "تقويم وتعليم" },
    { name: "المركز الوطني للتعليم الإلكتروني", url: "https://nelc.gov.sa/", note: "تعليم رقمي" },
    { name: "موهبة", url: "https://www.mawhiba.org/", note: "تعليم وموهوبون" },
    { name: "مؤسسة مسك", url: "https://misk.org.sa/", note: "تعليم وتمكين" },
    { name: "جامعة الملك سعود", url: "https://ksu.edu.sa/", note: "تعليم وبحث" },
  ],
  "العلوم الزراعية": [
    { name: "وزارة البيئة والمياه والزراعة", url: "https://www.mewa.gov.sa/", note: "زراعة وبيئة ومياه" },
    { name: "صندوق التنمية الزراعية", url: "https://www.adf.gov.sa/", note: "تمويل زراعي" },
    { name: "نادك", url: "https://nadec.com/", note: "زراعة وأغذية" },
    { name: "المراعي", url: "https://www.almarai.com/", note: "أغذية وتشغيل" },
    { name: "المركز الوطني لتنمية الغطاء النباتي", url: "https://www.ncv.gov.sa/", note: "بيئة واستدامة" },
    { name: "الهيئة العامة للغذاء والدواء", url: "https://www.sfda.gov.sa/", note: "غذاء ورقابة" },
  ],
  "العلوم الرياضية": [
    { name: "وزارة الرياضة", url: "https://www.mos.gov.sa/", note: "رياضة وإدارة" },
    { name: "اللجنة الأولمبية والبارالمبية السعودية", url: "https://olympic.sa/", note: "رياضة واتحادات" },
    { name: "الاتحاد السعودي لكرة القدم", url: "https://www.saff.com.sa/", note: "إدارة رياضية" },
    { name: "الاتحاد السعودي للرياضة للجميع", url: "https://sportsforall.com.sa/", note: "برامج ومبادرات رياضية" },
    { name: "معهد إعداد القادة", url: "https://leadersinstitute.sa/", note: "تدريب وقيادة رياضية" },
    { name: "نادي الهلال", url: "https://alhilal.com/", note: "إدارة رياضية وتسويق" },
  ],
};

const organizationHomepageEntries = [
  ...Object.values(suggestedOrganizationsByRegion)
    .flat()
    .map((organization) => [organization.name, organization.url]),
  ...Object.values(suggestedOrganizationsByMajorCategory)
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
  const [faqExpanded, setFaqExpanded] = useState(false);

  const selectedSpecialtyOption = useMemo(
    () =>
      specializationOptions.find(
        (option) => option.value === selectedSpecialty
      ),
    [selectedSpecialty]
  );
  const selectedSpecialtyLabel =
    selectedSpecialtyOption?.label || selectedSpecialty;
  const selectedMajorCategories = useMemo(
    () => selectedSpecialtyOption?.categories || [],
    [selectedSpecialtyOption]
  );
  const selectedMajorCategoriesText = selectedMajorCategories.join("، ");
  const suggestionRegion = resolveSuggestionRegion(city);
  const selectedCityScope = useMemo(() => getSelectedCityScope(city), [city]);
  const visibleTargets = useMemo(() => {
    if (selectedCityScope.length === 0) return targets;

    const allowedCities = new Set(selectedCityScope.map(normalizeName));
    return targets.filter((target) =>
      (target.cities || []).some((targetCity) =>
        allowedCities.has(normalizeName(targetCity))
      )
    );
  }, [selectedCityScope, targets]);
  const visibleTargetNames = useMemo(
    () =>
      new Set(
        visibleTargets.map((target) => normalizeName(target.organizationName))
      ),
    [visibleTargets]
  );
  const hasTrainingTargets = visibleTargets.length > 0;
  const totalVisibleExperienceCount = useMemo(
    () =>
      visibleTargets.reduce(
        (total, target) => total + (Number(target.count) || 0),
        0
      ),
    [visibleTargets]
  );
  const visibleMethodLabels = useMemo(() => {
    const methods = new Set();
    visibleTargets.forEach((target) => {
      (target.methods || []).forEach((method) => {
        if (method) methods.add(method);
      });
    });
    return Array.from(methods).slice(0, 3);
  }, [visibleTargets]);
  const visibleFaqItems = faqExpanded
    ? trainingFinderFaqItems
    : trainingFinderFaqItems.slice(0, 3);
  const suggestedOrganizations = useMemo(() => {
    const specialtyOrganizations = selectedMajorCategories.flatMap((category) =>
      (suggestedOrganizationsByMajorCategory[category] || []).map(
        (organization) => ({
          ...organization,
          sourceLabel: "حسب التخصص",
        })
      )
    );
    const regionOrganizations = suggestionRegion
      ? (suggestedOrganizationsByRegion[suggestionRegion] || []).map(
          (organization) => ({
            ...organization,
            sourceLabel: "حسب المدينة",
          })
        )
      : [];
    if (city) {
      return dedupeOrganizations(regionOrganizations).filter(
        (organization) =>
          !visibleTargetNames.has(normalizeName(organization.name))
      );
    }

    const fallbackOrganizations =
      specialtyOrganizations.length === 0 && regionOrganizations.length === 0
        ? Object.values(suggestedOrganizationsByRegion)
            .flat()
            .map((organization) => ({
              ...organization,
              sourceLabel: "اقتراح عام",
            }))
        : [];

    return dedupeOrganizations([
      ...specialtyOrganizations,
      ...regionOrganizations,
      ...fallbackOrganizations,
    ]).filter(
      (organization) =>
        !visibleTargetNames.has(normalizeName(organization.name))
    );
  }, [city, selectedMajorCategories, suggestionRegion, visibleTargetNames]);

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
        {SHOW_TRAINING_GUIDE_BANNER && (
          <TrainingGuideBanner
            compact
            ariaLabel="إعلان ملف رحلة المتدرب"
            badges={["🌟 ملف يساعدك تختصر الطريق", "✅ من التقديم إلى التقرير"]}
            title="رحلة المتدرب: شاملة من التقديم إلى كتابة التقرير"
            description="إذا كنت في مرحلة البحث عن تدريب أو بدأت تجربتك، هذا الملف يرتب لك الطريق خطوة بخطوة: كيف تقدم، تتابع طلباتك، تستعد، وتكتب تقريرك بثقة."
            buttonText="استكشف الملف الآن"
          />
        )}

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
            اختَر تخصصك من القائمة، وإذا ودك حدد المدينة أو المنطقة، ونقترح لك جهات سبق
            أن شارك الطلاب تجارب تدريبهم فيها.
          </p>
        </header>

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
            المدينة أو المنطقة
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
              <option value="">كل المدن والمناطق</option>
              <optgroup label="المناطق الرئيسية">
                {regionOptions.map((regionName) => (
                  <option key={regionName} value={regionName}>
                    {regionName}
                  </option>
                ))}
              </optgroup>
              <optgroup label="المدن الرئيسية">
                {cityOptions.map((cityName) => (
                  <option key={cityName} value={cityName}>
                    {cityName}
                  </option>
                ))}
              </optgroup>
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
            <section
              style={{
                background:
                  "linear-gradient(135deg, var(--app-brand-soft), var(--app-surface))",
                border: "1px solid var(--app-brand-border)",
                borderRadius: "16px",
                padding: "14px",
                display: "grid",
                gap: "8px",
                textAlign: "right",
              }}
            >
              <strong
                style={{
                  color: "var(--app-brand)",
                  fontSize: "15px",
                  lineHeight: 1.6,
                }}
              >
                {hasTrainingTargets
                  ? `ملخص بحثك: ${visibleTargets.length} جهة من تجارب دربك`
                  : "ملخص بحثك: جهات مقترحة كبداية مناسبة"}
              </strong>
              <p
                style={{
                  margin: 0,
                  color: "var(--app-text-soft)",
                  fontSize: "13px",
                  lineHeight: 1.8,
                }}
              >
                {hasTrainingTargets
                  ? `ظهرت نتائج لتخصص ${selectedSpecialtyLabel}${
                      city ? ` في ${city}` : ""
                    } مبنية على ${totalVisibleExperienceCount} تجربة مشاركة. ${
                      visibleMethodLabels.length
                        ? `طرق التقديم المذكورة تشمل: ${visibleMethodLabels.join(
                            "، "
                          )}.`
                        : "اقرأ التجارب لمعرفة تفاصيل التقديم."
                    }`
                  : `لسه ما ظهرت تجارب مطابقة لهذا الاختيار داخل دربك، وهذا لا يقلل من تخصصك أو فرصه. نعرض لك اقتراحات تساعدك تبدأ البحث، ومع مشاركات الطلاب القادمة بتصير النتائج أدق.`}
              </p>
            </section>

            <section
              style={{
                display: "grid",
                gap: "14px",
                order: !hasTrainingTargets ? 2 : 1,
                paddingTop: !hasTrainingTargets ? "16px" : 0,
                borderTop:
                  !hasTrainingTargets ? "1px solid var(--app-border)" : "none",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto minmax(0, 1fr)",
                  gap: "12px",
                  alignItems: "start",
                  paddingTop: "4px",
                }}
              >
                <span
                  style={{
                    display: "inline-grid",
                    placeItems: "center",
                    width: "34px",
                    height: "34px",
                    borderRadius: "999px",
                    background:
                      !hasTrainingTargets
                        ? "var(--app-input-bg)"
                        : "var(--app-brand)",
                    border:
                      !hasTrainingTargets
                        ? "1px solid var(--app-brand-border)"
                        : "none",
                    color: !hasTrainingTargets ? "var(--app-brand)" : "#07100e",
                    fontSize: "16px",
                    fontWeight: "900",
                    boxShadow:
                      !hasTrainingTargets
                        ? "none"
                        : "0 0 16px var(--app-brand-border)",
                  }}
                >
                  {!hasTrainingTargets ? "2" : "1"}
                </span>
                <div>
                  <h2
                    style={{
                      margin: 0,
                      color: "var(--app-text)",
                      fontSize: "20px",
                      lineHeight: 1.5,
                    }}
                  >
                    جهات ظهرت في تجارب دربك
                  </h2>
                  <p
                    style={{
                      margin: "4px 0 0",
                      color: "var(--app-muted)",
                      fontSize: "13px",
                      lineHeight: 1.8,
                    }}
                  >
                    نتائج {selectedSpecialtyLabel}
                    {city ? ` في ${city}` : ""}
                    {selectedMajorCategoriesText
                      ? ` - ضمن ${selectedMajorCategoriesText}`
                      : ""}
                    . هذه النتائج من تجارب شاركها الطلاب داخل دربك
                    {city ? " ومطابقة للمدينة أو المنطقة المحددة." : "."}
                  </p>
                </div>
              </div>

              {!hasTrainingTargets ? (
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
                  قاعدة دربك ما زالت تكبر بتجارب الطلاب، وقد لا تكون وصلت لنا
                  تجربة مطابقة لهذا الاختيار بعد. الاقتراحات بالأعلى تساعدك
                  تبدأ من جهات قريبة من تخصصك أو مدينتك، وأي تجربة جديدة
                  يشاركها الطلاب بتظهر هنا تلقائيًا.
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
                  {visibleTargets.map((target) => {
                    const organizationHomepageUrl = resolveOrganizationHomepageUrl(
                      target.organizationName
                    );

                    return (
                      <article
                        className="training-target-card"
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
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "10px",
                            alignItems: "flex-start",
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                          <h3
                            className="training-target-title"
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
                          <span
                            style={{
                              flex: "0 0 auto",
                              background: "var(--app-brand-soft)",
                              border: "1px solid var(--app-brand-border)",
                              color: "var(--app-brand)",
                              borderRadius: "999px",
                              padding: "5px 8px",
                              fontSize: "11px",
                              fontWeight: "900",
                              lineHeight: 1.3,
                            }}
                          >
                            {target.count || 1} تجربة
                          </span>
                        </div>

                        <div
                          className="training-target-detail"
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

                        <div
                          className="training-target-actions"
                          style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}
                        >
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

              {hasTrainingTargets && (
                <p
                  style={{
                    margin: "6px 0 0",
                    color: "var(--app-muted)",
                    fontSize: "13px",
                    lineHeight: 1.8,
                    textAlign: "center",
                  }}
                >
                  الجهات المعروضة مبنية على تجارب طلاب سابقة، ولا يعني ظهور
                  الجهة توفر فرصة تدريب حاليًا.
                </p>
              )}

              {hasTrainingTargets && suggestedOrganizations.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                    flexWrap: "wrap",
                    background:
                      "linear-gradient(90deg, var(--app-brand-soft), transparent)",
                    border: "1px solid var(--app-brand-border)",
                    borderRadius: "14px",
                    padding: "11px 13px",
                    color: "var(--app-text-soft)",
                    fontSize: "13px",
                    lineHeight: 1.8,
                  }}
                >
                  <strong style={{ color: "var(--app-brand)", fontSize: "14px" }}>
                    اقتراحات إضافية تحت النتائج
                  </strong>
                  <span>
                    إذا كانت جهات دربك كثيرة، كمل للأسفل بتلقى جهات مقترحة حسب
                    تخصصك والمدينة المختارة.
                  </span>
                </div>
              )}
            </section>

            <section
              style={{
                display: "grid",
                gap: "14px",
                order: !hasTrainingTargets ? 1 : 2,
                marginTop: !hasTrainingTargets ? 0 : "12px",
                paddingTop: !hasTrainingTargets ? "4px" : "18px",
                borderTop:
                  !hasTrainingTargets ? "none" : "1px solid var(--app-border)",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto minmax(0, 1fr)",
                  gap: "12px",
                  alignItems: "start",
                }}
              >
                <span
                  style={{
                    display: "inline-grid",
                    placeItems: "center",
                    width: "34px",
                    height: "34px",
                    borderRadius: "999px",
                    background:
                      !hasTrainingTargets
                        ? "var(--app-brand)"
                        : "var(--app-input-bg)",
                    border:
                      !hasTrainingTargets
                        ? "none"
                        : "1px solid var(--app-brand-border)",
                    color: !hasTrainingTargets ? "#07100e" : "var(--app-brand)",
                    fontSize: "16px",
                    fontWeight: "900",
                    boxShadow:
                      !hasTrainingTargets
                        ? "0 0 16px var(--app-brand-border)"
                        : "none",
                  }}
                >
                  {!hasTrainingTargets ? "1" : "2"}
                </span>
                <div>
                  <h2
                    style={{
                      margin: "0 0 5px",
                      color: "var(--app-text)",
                      fontSize: "20px",
                      lineHeight: 1.5,
                    }}
                  >
                    جهات مقترحة للتقديم
                  </h2>
                  <p
                    style={{
                      margin: 0,
                      color: "var(--app-muted)",
                      fontSize: "13px",
                      lineHeight: 1.8,
                    }}
                  >
                    هذا القسم منفصل عن نتائج دربك: اقتراحات حسب تخصصك
                    {suggestionRegion ? ` و${suggestionRegion}` : ""}
                    ، ولا يعني ظهور الجهة توفر فرصة تدريب حاليًا.
                  </p>
                </div>
              </div>

              {suggestedOrganizations.length === 0 ? (
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
                  كل الجهات المقترحة حاليًا ظهرت ضمن نتائج تجارب دربك، جرّب
                  البحث بتخصص أو مدينة أخرى.
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
                      className="suggested-target-card"
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
                      <div
                        className="suggested-card-head"
                        style={{
                          display: "grid",
                          gridTemplateColumns: "42px minmax(0, 1fr)",
                          gap: "10px",
                          alignItems: "start",
                        }}
                      >
                        <OrganizationLogo
                          name={organization.name}
                          url={organization.url}
                        />
                        <div>
                          <div
                            className="suggested-card-title-row"
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: "8px",
                              alignItems: "start",
                              marginBottom: "5px",
                            }}
                          >
                            <h3
                              style={{
                                margin: 0,
                                color: "var(--app-brand)",
                                fontSize: "17px",
                                lineHeight: 1.4,
                              }}
                            >
                              {organization.name}
                            </h3>
                            <span
                              className="suggested-organization-source"
                              style={{
                                flex: "0 0 auto",
                                background: "var(--app-brand-soft)",
                                border: "1px solid var(--app-brand-border)",
                                color: "var(--app-text-soft)",
                                borderRadius: "999px",
                                padding: "4px 7px",
                                fontSize: "11px",
                                lineHeight: 1.3,
                              }}
                            >
                              {organization.sourceLabel || "اقتراح"}
                            </span>
                          </div>
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
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gap: "7px",
                          background: "var(--app-card)",
                          border: "1px solid var(--app-border)",
                          borderRadius: "12px",
                          padding: "10px",
                        }}
                      >
                        <p
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "10px",
                            margin: 0,
                            color: "var(--app-text-soft)",
                            fontSize: "12px",
                            lineHeight: 1.6,
                          }}
                        >
                          <span style={{ color: "var(--app-muted)" }}>مناسب لـ</span>
                          <strong
                            style={{
                              color: "var(--app-brand)",
                              fontWeight: "800",
                              textAlign: "left",
                            }}
                          >
                            {selectedSpecialtyLabel}
                          </strong>
                        </p>
                        <p
                          style={{
                            margin: 0,
                            color: "var(--app-text-soft)",
                            fontSize: "12px",
                            lineHeight: 1.75,
                          }}
                        >
                          ابحث في الموقع الرسمي عن التدريب، الوظائف، أو برامج
                          الخريجين، وتابع لينكدإن للجهة إذا توفر.
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

        <section
          aria-label="أسئلة شائعة عن وين أتدرب"
          style={{
            background: "var(--app-surface)",
            border: "1px solid var(--app-border)",
            borderRadius: "16px",
            padding: "16px",
            display: "grid",
            gap: "12px",
            textAlign: "right",
          }}
        >
          <div>
            <h2
              style={{
                margin: "0 0 6px",
                color: "var(--app-text)",
                fontSize: "20px",
                lineHeight: 1.5,
              }}
            >
              أسئلة شائعة
            </h2>
            <p
              style={{
                margin: 0,
                color: "var(--app-muted)",
                fontSize: "13px",
                lineHeight: 1.8,
              }}
            >
              إجابات مختصرة تساعدك تستخدم الصفحة بدون ما تربط ظهور الجهة بتوفر
              فرصة تدريب حاليًا.
            </p>
          </div>

          <div style={{ display: "grid", gap: "8px" }}>
            {visibleFaqItems.map((item) => (
              <details
                key={item.question}
                style={{
                  background: "var(--app-card)",
                  border: "1px solid var(--app-border)",
                  borderRadius: "12px",
                  padding: "10px 12px",
                  color: "var(--app-text-soft)",
                }}
              >
                <summary
                  style={{
                    cursor: "pointer",
                    color: "var(--app-brand)",
                    fontWeight: "900",
                    fontSize: "13px",
                    lineHeight: 1.7,
                  }}
                >
                  {item.question}
                </summary>
                <p
                  style={{
                    margin: "8px 0 0",
                    color: "var(--app-text-soft)",
                    fontSize: "13px",
                    lineHeight: 1.85,
                  }}
                >
                  {item.answer}
                </p>
              </details>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setFaqExpanded((expanded) => !expanded)}
            style={{
              justifySelf: "center",
              background: "var(--app-input-bg)",
              color: "var(--app-brand)",
              border: "1px solid var(--app-brand-border)",
              borderRadius: "999px",
              padding: "8px 14px",
              fontFamily: "inherit",
              fontWeight: "900",
              cursor: "pointer",
            }}
          >
            {faqExpanded ? "عرض أقل" : "اقرأ المزيد"}
          </button>
        </section>
      </section>

      <style>{`
        @media (max-width: 760px) {
          .training-guide-banner {
            grid-template-columns: 1fr !important;
            padding: 14px !important;
            gap: 12px !important;
          }

          .training-guide-banner a,
          .training-guide-banner button {
            width: 100% !important;
            max-width: none !important;
          }

          .training-guide-banner h2 {
            font-size: 20px !important;
          }

          .training-finder-form {
            grid-template-columns: 1fr !important;
          }

          .training-targets-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 8px !important;
          }

          .suggested-targets-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 8px !important;
          }

          .training-target-card,
          .suggested-target-card {
            padding: 10px !important;
            border-radius: 13px !important;
            gap: 8px !important;
            box-shadow: 0 8px 18px var(--app-shadow) !important;
          }

          .training-target-title {
            font-size: 15px !important;
            line-height: 1.45 !important;
            margin-bottom: 4px !important;
          }

          .training-target-card p,
          .suggested-target-card p {
            font-size: 11.5px !important;
            line-height: 1.65 !important;
          }

          .training-target-detail {
            padding: 8px !important;
            border-radius: 10px !important;
          }

          .training-target-actions {
            display: grid !important;
            grid-template-columns: 1fr !important;
            gap: 6px !important;
          }

          .training-target-actions a,
          .training-target-actions button {
            width: 100% !important;
          }

          .suggested-organization-logo {
            width: 34px !important;
            height: 34px !important;
            min-width: 34px !important;
            max-width: 34px !important;
            min-height: 34px !important;
            max-height: 34px !important;
            border-radius: 11px !important;
          }

          .suggested-organization-logo img {
            width: 20px !important;
            height: 20px !important;
            min-width: 20px !important;
            min-height: 20px !important;
          }

          .suggested-card-head {
            grid-template-columns: 34px minmax(0, 1fr) !important;
            gap: 8px !important;
            align-items: start !important;
          }

          .suggested-card-title-row {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) !important;
            gap: 5px !important;
            margin-bottom: 4px !important;
          }

          .suggested-organization-source {
            justify-self: start !important;
            max-width: 100% !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            white-space: nowrap !important;
          }
        }

        @media (max-width: 340px) {
          .training-targets-grid,
          .suggested-targets-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}
