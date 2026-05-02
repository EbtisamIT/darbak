import React, { useEffect, useState } from "react";
import axios from "axios";
import majors from "../majors";
import API_BASE_URL from "../config/api";

const HEADER_HEIGHT = 90;

const COMPANY_SEARCH_ALIASES = {
  // Generic government entity terms.
  وزاره: ["ministry", "minister"],
  الوزاره: ["ministry", "minister"],
  وزارات: ["ministries", "ministry"],
  ministry: ["وزاره", "الوزاره", "وزارات"],
  ministries: ["وزارات", "وزاره"],
  هيئه: ["authority", "commission", "agency"],
  الهيئه: ["authority", "commission", "agency"],
  authority: ["هيئه", "الهيئه"],
  commission: ["هيئه", "الهيئه"],
  agency: ["هيئه", "الهيئه"],
  صندوق: ["fund"],
  fund: ["صندوق"],
  مركز: ["center", "centre"],
  center: ["مركز"],
  centre: ["مركز"],
  جامعه: ["university"],
  university: ["جامعه"],
  امانه: ["municipality"],
  municipality: ["امانه", "بلديه"],
  بلديه: ["municipality"],
  الرياض: ["riyadh"],
  riyadh: ["الرياض"],

  // Common companies and national programs.
  علم: ["elm"],
  elm: ["علم"],
  stc: ["اس تي سي", "الاتصالات السعودية"],
  "اس تي سي": ["stc", "الاتصالات السعودية"],
  "الاتصالات السعودية": ["stc", "اس تي سي"],
  aramco: ["ارامكو", "أرامكو"],
  ارامكو: ["aramco", "أرامكو"],
  سابك: ["sabic"],
  sabic: ["سابك"],
  نيوم: ["neom"],
  neom: ["نيوم"],
  روشن: ["roshn"],
  roshn: ["روشن"],
  القديه: ["qiddiya"],
  qiddiya: ["القديه", "قديه"],
  الدرعيه: ["diriyah"],
  diriyah: ["الدرعيه"],
  هدف: ["hrdf", "صندوق تنميه الموارد البشريه"],
  hrdf: ["هدف", "صندوق تنمية الموارد البشرية"],
  منشات: ["monsha'at", "monshaat", "monshaat"],
  monshaat: ["منشآت", "منشات"],
  "monsha'at": ["منشآت", "منشات"],
  مسك: ["misk"],
  misk: ["مسك"],
  سدايا: ["sdaia"],
  sdaia: ["سدايا"],
  كاوست: ["kaust"],
  kaust: ["كاوست", "جامعه الملك عبدالله للعلوم والتقنيه"],

  // Ministries.
  "وزاره الصحه": ["moh", "ministry of health"],
  moh: ["وزارة الصحة"],
  "ministry of health": ["وزارة الصحة"],
  "وزاره التعليم": ["moe", "ministry of education"],
  moe: ["وزارة التعليم"],
  "ministry of education": ["وزارة التعليم"],
  "وزاره الماليه": ["mof", "ministry of finance"],
  mof: ["وزارة المالية"],
  "ministry of finance": ["وزارة المالية"],
  "وزاره العدل": ["moj", "ministry of justice"],
  moj: ["وزارة العدل"],
  "ministry of justice": ["وزارة العدل"],
  "وزاره الطاقه": ["ministry of energy"],
  "ministry of energy": ["وزارة الطاقة"],
  "وزاره الاستثمار": ["misa", "ministry of investment"],
  misa: ["وزارة الاستثمار"],
  "ministry of investment": ["وزارة الاستثمار"],
  "وزاره السياحه": ["ministry of tourism"],
  "ministry of tourism": ["وزارة السياحة"],
  "وزاره التجاره": ["mc", "ministry of commerce"],
  "ministry of commerce": ["وزارة التجارة"],
  "وزاره النقل": ["mot", "ministry of transport"],
  mot: ["وزارة النقل"],
  "ministry of transport": ["وزارة النقل"],
  "وزاره الاتصالات": ["mcit", "ministry of communications"],
  mcit: ["وزارة الاتصالات", "وزارة الاتصالات وتقنية المعلومات"],
  "ministry of communications": ["وزارة الاتصالات وتقنية المعلومات"],
  "وزاره الداخليه": ["moi", "ministry of interior"],
  moi: ["وزارة الداخلية"],
  "ministry of interior": ["وزارة الداخلية"],
  "وزاره الخارجيه": ["mofa", "ministry of foreign affairs"],
  mofa: ["وزارة الخارجية"],
  "ministry of foreign affairs": ["وزارة الخارجية"],
  "وزاره الموارد البشريه": ["mhrsd", "ministry of human resources"],
  mhrsd: ["وزارة الموارد البشرية", "وزارة الموارد البشرية والتنمية الاجتماعية"],
  "ministry of human resources": [
    "وزارة الموارد البشرية",
    "وزارة الموارد البشرية والتنمية الاجتماعية",
  ],
  "وزاره البيئه": ["mewa", "ministry of environment"],
  mewa: ["وزارة البيئة", "وزارة البيئة والمياه والزراعة"],
  "ministry of environment": ["وزارة البيئة والمياه والزراعة"],
  "وزاره الصناعه": ["mim", "ministry of industry"],
  mim: ["وزارة الصناعة", "وزارة الصناعة والثروة المعدنية"],
  "ministry of industry": ["وزارة الصناعة والثروة المعدنية"],
  "وزاره البلديات": ["momrah", "ministry of municipal"],
  momrah: ["وزارة البلديات", "وزارة الشؤون البلدية والقروية والإسكان"],
  "ministry of municipal": ["وزارة الشؤون البلدية والقروية والإسكان"],

  // Authorities, commissions, and public entities.
  "هيئه الحكومه الرقميه": ["dga", "digital government authority"],
  dga: ["هيئة الحكومة الرقمية"],
  "digital government authority": ["هيئة الحكومة الرقمية"],
  "هيئه الاتصالات": ["cst", "citc", "communications authority"],
  cst: ["هيئة الاتصالات", "هيئة الاتصالات والفضاء والتقنية"],
  citc: ["هيئة الاتصالات", "هيئة الاتصالات وتقنية المعلومات"],
  "communications authority": ["هيئة الاتصالات والفضاء والتقنية"],
  "هيئه السوق الماليه": ["cma", "capital market authority"],
  cma: ["هيئة السوق المالية"],
  "capital market authority": ["هيئة السوق المالية"],
  "هيئه الزكاه": ["zatca", "zakat tax customs authority"],
  زاتكا: ["zatca"],
  zatca: ["هيئة الزكاة", "هيئة الزكاة والضريبة والجمارك", "زاتكا"],
  "zakat tax customs authority": ["هيئة الزكاة والضريبة والجمارك"],
  "البنك المركزي": ["sama", "saudi central bank"],
  ساما: ["sama"],
  sama: ["البنك المركزي السعودي", "ساما"],
  "saudi central bank": ["البنك المركزي السعودي"],
  "هيئه الغذاء والدواء": ["sfda", "food and drug authority"],
  sfda: ["هيئة الغذاء والدواء"],
  "food and drug authority": ["هيئة الغذاء والدواء"],
  "الهيئه العامه للاحصاء": ["gastat", "general authority for statistics"],
  gastat: ["الهيئة العامة للإحصاء"],
  "general authority for statistics": ["الهيئة العامة للإحصاء"],
  "هيئه المحتوي المحلي": ["lcgpa", "local content"],
  lcgpa: ["هيئة المحتوى المحلي والمشتريات الحكومية"],
  "local content": ["هيئة المحتوى المحلي والمشتريات الحكومية"],
  "هيئه المدن والمناطق الاقتصاديه": ["ecza", "economic cities authority"],
  ecza: ["هيئة المدن والمناطق الاقتصادية الخاصة"],
  "economic cities authority": ["هيئة المدن والمناطق الاقتصادية الخاصة"],
  "هيئه تطوير بوابه الدرعيه": ["dgda", "diriyah gate"],
  dgda: ["هيئة تطوير بوابة الدرعية"],
  "diriyah gate": ["هيئة تطوير بوابة الدرعية"],
  "الهيئه الملكيه": ["royal commission"],
  "royal commission": ["الهيئة الملكية"],
  "الهيئه الملكيه لمدينه الرياض": ["rcrc", "royal commission for riyadh city"],
  rcrc: ["الهيئة الملكية لمدينة الرياض"],
  "royal commission for riyadh city": ["الهيئة الملكية لمدينة الرياض"],
  "امانه منطقه الرياض": ["riyadh municipality"],
  "riyadh municipality": ["أمانة منطقة الرياض"],
  "مطارات الرياض": ["riyadh airports"],
  "riyadh airports": ["مطارات الرياض"],
  "طيران الرياض": ["riyadh air"],
  "riyadh air": ["طيران الرياض"],
  "صندوق الاستثمارات العامه": ["pif", "public investment fund"],
  pif: ["صندوق الاستثمارات العامة"],
  "public investment fund": ["صندوق الاستثمارات العامة"],
  sadaia: ["سدايا", "هيئة البيانات والذكاء الاصطناعي", "sdaia"],
};

const MAJOR_SEARCH_ALIASES = {
  الحاسب: [
    "تقنيه",
    "تقنية",
    "it",
    "cs",
    "computer",
    "software",
    "programming",
    "برمجه",
    "برمجة",
    "ذكاء اصطناعي",
    "ai",
    "امن سيبراني",
    "cyber",
    "نظم معلومات",
    "علوم حاسب",
  ],
  الطب: ["صحه", "صحة", "health", "medical", "medicine", "تمريض", "صيدله"],
  التسويق: ["marketing", "اعلان", "إعلان", "مبيعات", "sales", "تسويق رقمي"],
  "قانون ومحاماة": ["قانون", "محاماه", "محاماة", "law", "legal", "حقوق"],
  "اللغة العربية": ["عربي", "arabic", "لغه عربيه", "لغة عربية"],
  "اللغة الإنجليزية": ["انجليزي", "انجليزيه", "english", "translation", "ترجمه"],
  "الشريعة والدين": ["شريعه", "دين", "اسلام", "islamic"],
  الهندسة: ["هندسه", "engineering", "engineer", "مهندس", "مدني", "كهرباء", "ميكانيكا"],
  "الصحافة والإعلام": [
    "اعلام",
    "إعلام",
    "صحافه",
    "صحافة",
    "media",
    "journalism",
    "علاقات عامه",
  ],
};

const ExperiencesPage = () => {
  const [experiences, setExperiences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedExperience, setSelectedExperience] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedMajors, setSelectedMajors] = useState([]);
  const [majorsMenuOpen, setMajorsMenuOpen] = useState(false);
  const [companySearch, setCompanySearch] = useState("");
  const [sortOption, setSortOption] = useState("latest");
  const [fetchError, setFetchError] = useState("");

  const steps = ["معلومات التدريب", "التقييم والتجربة"];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data } = await axios.get(`${API_BASE_URL}/api/experiences`);

        if (!Array.isArray(data)) {
          throw new Error("Unexpected API response");
        }

        const sorted = data.sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );
        setExperiences(sorted);
        setFetchError("");
      } catch (err) {
        console.error(err);
        setFetchError("تعذر تحميل التجارب حاليًا. تأكدي من اتصال خدمة API.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const toggleMajor = (major) => {
    if (major === "الكل") {
      setSelectedMajors([]);
      setMajorsMenuOpen(false);
      return;
    }

    setSelectedMajors((prev) =>
      prev.includes(major)
        ? prev.filter((m) => m !== major)
        : [...prev, major]
    );
  };

  const normalizeSearchText = (value = "") =>
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

  const normalizedCompanySearch = normalizeSearchText(companySearch);

  const getCompanySearchTerms = (value) => {
    const normalizedValue = normalizeSearchText(value);

    if (!normalizedValue) return [];

    const aliases = Object.entries(COMPANY_SEARCH_ALIASES).flatMap(
      ([company, alternatives]) => {
        const normalizedCompany = normalizeSearchText(company);
        const normalizedAlternatives = alternatives.map(normalizeSearchText);

        if (
          normalizedCompany.includes(normalizedValue) ||
          normalizedAlternatives.some((alias) => alias.includes(normalizedValue))
        ) {
          return [normalizedCompany, ...normalizedAlternatives];
        }

        return [];
      }
    );

    return Array.from(new Set([normalizedValue, ...aliases]));
  };

  const getMajorSearchTerms = (value) => {
    const normalizedValue = normalizeSearchText(value);

    if (!normalizedValue) return [];

    const aliases = Object.entries(MAJOR_SEARCH_ALIASES).flatMap(
      ([major, alternatives]) => {
        const normalizedMajor = normalizeSearchText(major);
        const normalizedAlternatives = alternatives.map(normalizeSearchText);

        if (
          normalizedMajor.includes(normalizedValue) ||
          normalizedAlternatives.some((alias) => alias.includes(normalizedValue))
        ) {
          return [normalizedMajor, ...normalizedAlternatives];
        }

        return [];
      }
    );

    return Array.from(new Set([normalizedValue, ...aliases]));
  };

  const searchTerms = Array.from(
    new Set([
      ...getCompanySearchTerms(companySearch),
      ...getMajorSearchTerms(companySearch),
    ])
  );

  const getSearchScore = (exp) => {
    if (searchTerms.length === 0) return 0;

    const searchableValues = [
      exp.organizationName,
      exp.companyName,
      exp.major,
      exp.title,
    ]
      .filter(Boolean)
      .map(normalizeSearchText);

    return searchTerms.reduce((score, term) => {
      const exactMatch = searchableValues.some((value) => value === term);
      const startsWithMatch = searchableValues.some((value) =>
        value.startsWith(term)
      );
      const includesMatch = searchableValues.some((value) =>
        value.includes(term)
      );

      if (exactMatch) return score + 6;
      if (startsWithMatch) return score + 4;
      if (includesMatch) return score + 2;
      return score;
    }, 0);
  };

  const filteredExperiences = experiences
    .filter((exp) => {
      const matchesMajor =
        selectedMajors.length === 0 || selectedMajors.includes(exp.major);

      const searchableNames = [
        exp.organizationName,
        exp.companyName,
        exp.major,
      ].filter(Boolean);

      const normalizedSearchableNames = searchableNames.map(normalizeSearchText);

      const matchesSearch =
        normalizedCompanySearch.length === 0 ||
        normalizedSearchableNames.some((name) =>
          searchTerms.some((term) => name.includes(term))
        );

      return matchesMajor && matchesSearch;
    })
    .sort((a, b) => {
      if (sortOption === "rating") {
        return (b.starRating || 0) - (a.starRating || 0);
      }

      if (sortOption === "relevance" && normalizedCompanySearch) {
        const scoreDiff = getSearchScore(b) - getSearchScore(a);
        if (scoreDiff !== 0) return scoreDiff;
      }

      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

  const StarRating = ({ value = 0 }) => (
    <div
      style={{
        display: "flex",
        gap: "4px",
        margin: "8px 0",
        justifyContent: "center",
      }}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          style={{
            color: star <= value ? "#facc15" : "#374151",
            fontSize: "17px",
          }}
        >
          ★
        </span>
      ))}
    </div>
  );

  const selectedMajorsText =
    selectedMajors.length === 0 ? "كل التخصصات" : selectedMajors.join("، ");

  const sortLabels = {
    latest: "الأحدث أولًا",
    rating: "الأعلى تقييمًا",
    relevance: "الأكثر صلة",
  };

  const clearAllFilters = () => {
    setSelectedMajors([]);
    setCompanySearch("");
    setSortOption("latest");
  };

  const MajorButton = ({ name, Icon, color = "#00bcd4", active, isAll }) => (
    <button
      type="button"
      onClick={() => toggleMajor(name)}
      className="major-filter-btn"
      style={{
        marginInline: "10px",
        padding: "14px 12px",
        borderRadius: "20px",
        border: isAll
          ? "1px solid #00bcd4"
          : "1px solid rgba(255,255,255,0.15)",
        background: active ? "#00bcd4" : "#181a20",
        color: active ? "#000" : "#fff",
        fontWeight: isAll || active ? "bold" : "500",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        fontSize: "13px",
        minWidth: 0,
      }}
    >
      {Icon && <Icon size={18} color={active ? "#000" : color} />}
      <span className="major-filter-text">{name}</span>
    </button>
  );

  const InfoBox = ({ label, value, icon }) => (
    <div
      style={{
        background: "#151820",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: "14px",
        padding: "14px",
        textAlign: "center",
        marginBottom: "12px",
      }}
    >
      <div
        style={{
          color: "#00bcd4",
          fontSize: "13px",
          fontWeight: "bold",
          marginBottom: "7px",
        }}
      >
        {icon} {label}
      </div>
      <div
        style={{
          color: "#e5e7eb",
          fontSize: "14px",
          lineHeight: "1.7",
        }}
      >
        {value || "غير محدد"}
      </div>
    </div>
  );

  const SkeletonCard = () => (
    <div
      style={{
        background: "#181a20",
        borderRadius: "18px",
        height: "210px",
        animation: "pulse 1.4s infinite",
      }}
    />
  );

  const renderStepContent = () => {
    const exp = selectedExperience;
    if (!exp) return null;

    if (currentStep === 1) {
      return (
        <div>
          <InfoBox
            icon="🏢"
            label="الجهة"
            value={exp.organizationName}
          />

          <InfoBox
            icon="📍"
            label="المدينة"
            value={exp.city}
          />

          <InfoBox
            icon="🎓"
            label="التخصص"
            value={exp.major}
          />

          <InfoBox
            icon="⏱️"
            label="مدة التدريب"
            value={exp.duration}
          />

          <InfoBox
            icon="📝"
            label="طريقة التقديم"
            value={exp.howApplied}
          />
        </div>
      );
    }

    return (
      <div>
        <div
          style={{
            background: "#151820",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "14px",
            padding: "16px",
            textAlign: "center",
            marginBottom: "14px",
          }}
        >
          <div
            style={{
              color: "#00bcd4",
              fontSize: "13px",
              fontWeight: "bold",
              marginBottom: "6px",
            }}
          >
            ⭐ التقييم
          </div>

          <StarRating value={exp.starRating || 0} />
        </div>

        <div
          style={{
            background: "#151820",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "14px",
            padding: "18px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              color: "#00bcd4",
              fontSize: "13px",
              fontWeight: "bold",
              marginBottom: "10px",
            }}
          >
            🧠 التجربة
          </div>

          <p
            style={{
              color: "#ddd",
              lineHeight: "1.9",
              fontSize: "14px",
              margin: 0,
            }}
          >
            {exp.description}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        background: "#0f1115",
        minHeight: "100vh",
        color: "#fff",
        fontFamily: "'Cairo', sans-serif",
        direction: "rtl",
      }}
    >
      {/* ================= Majors ================= */}
      <div
        className="experiences-shell"
        style={{
          marginTop: HEADER_HEIGHT - 20,
          padding: "15px 12px",
        }}
      >
        <div
          className="mobile-majors-menu"
          style={{
            display: "none",
            marginBottom: "18px",
          }}
        >
          <button
            type="button"
            onClick={() => setMajorsMenuOpen((open) => !open)}
            style={{
              width: "100%",
              background: "#181a20",
              color: "#fff",
              border: "1px solid rgba(0,188,212,0.35)",
              borderRadius: "16px",
              padding: "12px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              cursor: "pointer",
              textAlign: "right",
            }}
          >
            <span
              style={{
                display: "grid",
                gap: "3px",
                minWidth: 0,
              }}
            >
              <span
                style={{
                  color: "#00bcd4",
                  fontSize: "12px",
                  fontWeight: "bold",
                }}
              >
                التخصصات
              </span>
              <span
                style={{
                  color: "#e5e7eb",
                  fontSize: "13px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {selectedMajorsText}
              </span>
            </span>
            <span
              style={{
                color: "#00bcd4",
                fontSize: "18px",
                lineHeight: 1,
                transform: majorsMenuOpen ? "rotate(180deg)" : "rotate(0)",
                transition: "0.2s ease",
              }}
            >
              ▾
            </span>
          </button>

          {majorsMenuOpen && (
            <div
              className="mobile-majors-list"
              style={{
                marginTop: "10px",
                background: "#151820",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "16px",
                padding: "10px",
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: "8px",
              }}
            >
              <MajorButton
                name="الكل"
                active={selectedMajors.length === 0}
                isAll
              />

              {majors.map(({ name, icon: Icon, color = "#00bcd4" }) => (
                <MajorButton
                  key={name}
                  name={name}
                  Icon={Icon}
                  color={color}
                  active={selectedMajors.includes(name)}
                />
              ))}
            </div>
          )}
        </div>

        <div
          className="majors-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: "12px",
            marginBottom: "30px",
          }}
        >
          <MajorButton
            name="الكل"
            active={selectedMajors.length === 0}
            isAll
          />

          {majors.map(({ name, icon: Icon, color = "#00bcd4" }) => {
            const active = selectedMajors.includes(name);
            return (
              <MajorButton
                key={name}
                name={name}
                Icon={Icon}
                color={color}
                active={active}
              />
            );
          })}
        </div>

        <div
          className="experiences-search-bar"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            margin: "0 auto 22px",
            maxWidth: "980px",
          }}
        >
          <div
            style={{
              flex: 1,
              position: "relative",
            }}
          >
            <span
              style={{
                position: "absolute",
                right: "14px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "#00bcd4",
                fontSize: "16px",
              }}
            >
              🔎
            </span>
            <input
              value={companySearch}
              onChange={(e) => setCompanySearch(e.target.value)}
              placeholder="ابحث باسم الشركة، الجهة، أو التخصص"
              aria-label="ابحث باسم الشركة، الجهة، أو التخصص"
              style={{
                width: "100%",
                boxSizing: "border-box",
                background: "#181a20",
                color: "#fff",
                border: "1px solid rgba(0,188,212,0.28)",
                borderRadius: "16px",
                padding: "12px 44px 12px 14px",
                outline: "none",
                fontSize: "14px",
                fontFamily: "inherit",
                textAlign: "right",
              }}
            />
          </div>

          <div
            className="results-count"
            style={{
              color: "#9ca3af",
              fontSize: "13px",
              whiteSpace: "nowrap",
            }}
          >
            {filteredExperiences.length} تجربة
          </div>

          {companySearch && (
            <button
              type="button"
              onClick={() => setCompanySearch("")}
              style={{
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#e5e7eb",
                borderRadius: "12px",
                padding: "10px 12px",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: "13px",
              }}
            >
              مسح
            </button>
          )}

          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
            aria-label="ترتيب التجارب"
            style={{
              background: "#181a20",
              color: "#fff",
              border: "1px solid rgba(0,188,212,0.28)",
              borderRadius: "12px",
              padding: "10px 12px",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: "13px",
              outline: "none",
            }}
          >
            <option value="latest">الأحدث أولًا</option>
            <option value="rating">الأعلى تقييمًا</option>
            <option value="relevance">الأكثر صلة</option>
          </select>
        </div>

        {(selectedMajors.length > 0 ||
          companySearch ||
          sortOption !== "latest") && (
          <div
            className="active-filter-chips"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              flexWrap: "wrap",
              margin: "-8px 0 22px",
            }}
          >
            {selectedMajors.map((major) => (
              <button
                key={major}
                type="button"
                onClick={() =>
                  setSelectedMajors((prev) => prev.filter((m) => m !== major))
                }
                style={{
                  background: "rgba(0,188,212,0.1)",
                  border: "1px solid rgba(0,188,212,0.28)",
                  color: "#dffaff",
                  borderRadius: "999px",
                  padding: "7px 10px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: "12px",
                }}
              >
                التخصص: {major} ✕
              </button>
            ))}

            {companySearch && (
              <button
                type="button"
                onClick={() => setCompanySearch("")}
                style={{
                  background: "rgba(250,204,21,0.09)",
                  border: "1px solid rgba(250,204,21,0.25)",
                  color: "#fef3c7",
                  borderRadius: "999px",
                  padding: "7px 10px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: "12px",
                }}
              >
                البحث: {companySearch} ✕
              </button>
            )}

            {sortOption !== "latest" && (
              <button
                type="button"
                onClick={() => setSortOption("latest")}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#e5e7eb",
                  borderRadius: "999px",
                  padding: "7px 10px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: "12px",
                }}
              >
                الترتيب: {sortLabels[sortOption]} ✕
              </button>
            )}

            <button
              type="button"
              onClick={clearAllFilters}
              style={{
                background: "transparent",
                border: "none",
                color: "#9ca3af",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: "12px",
              }}
            >
              مسح الكل
            </button>
          </div>
        )}

        {/* ================= Cards ================= */}
        {fetchError && (
          <div
            style={{
              textAlign: "center",
              margin: "0 auto 18px",
              padding: "12px",
              borderRadius: "14px",
              background: "rgba(244,63,94,0.08)",
              border: "1px solid rgba(244,63,94,0.25)",
              color: "#fecdd3",
              maxWidth: "620px",
              lineHeight: 1.7,
            }}
          >
            {fetchError}
          </div>
        )}

        {loading ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
              gap: "20px",
            }}
          >
            {[...Array(6)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filteredExperiences.length === 0 ? (
          <div style={{ textAlign: "center", marginTop: "80px" }}>
            <p style={{ fontSize: "40px" }}>📭</p>
            <p>
              {companySearch
                ? "لا توجد تجارب مطابقة للبحث"
                : "لا توجد تجارب لهذا التخصص"}
            </p>
          </div>
        ) : (
          <div
            className="experience-cards-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(165px, 1fr))",
              gap: "14px",
            }}
          >
            {filteredExperiences.map((exp) => (
              <div
                className="experience-card"
                key={exp._id}
                onClick={() => {
                  setSelectedExperience(exp);
                  setCurrentStep(1);
                }}
                style={{
                  background:
                    "linear-gradient(180deg, #1b1e25 0%, #16181f 100%)",
                  borderRadius: "20px",
                  padding: "14px",
                  border: "1px solid rgba(255,255,255,0.07)",
                  cursor: "pointer",
                  textAlign: "center",
                  minHeight: "178px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  boxShadow: "0 10px 25px rgba(0,0,0,0.25)",
                  transition: "0.3s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-5px)";
                  e.currentTarget.style.boxShadow =
                    "0 15px 30px rgba(0,188,212,0.12)";
                  e.currentTarget.style.border =
                    "1px solid rgba(0,188,212,0.35)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow =
                    "0 10px 25px rgba(0,0,0,0.25)";
                  e.currentTarget.style.border =
                    "1px solid rgba(255,255,255,0.07)";
                }}
              >
                <div>
                  <div
                    className="experience-title-box"
                    style={{
                      background: "rgba(0,188,212,0.08)",
                      border: "1px solid rgba(0,188,212,0.18)",
                      borderRadius: "16px",
                      padding: "10px",
                      marginBottom: "10px",
                    }}
                  >
                    <h3
                      style={{
                        color: "#00bcd4",
                        fontSize: "14px",
                        margin: 0,
                        lineHeight: "1.45",
                      }}
                    >
                      {exp.title}
                    </h3>
                  </div>

                  <div
                    className="experience-card-info"
                    style={{
                      display: "grid",
                      gap: "8px",
                    }}
                  >
                    <div
                      className="experience-info-box"
                      style={{
                        background: "#14161c",
                        borderRadius: "12px",
                        padding: "8px",
                        border: "1px solid rgba(255,255,255,0.05)",
                      }}
                    >
                      <p
                        style={{
                          color: "#00bcd4",
                          fontSize: "11px",
                          margin: "0 0 4px",
                          fontWeight: "bold",
                        }}
                      >
                        🏢 الجهة
                      </p>
                      <p
                        style={{
                          fontSize: "12px",
                          color: "#e5e7eb",
                          margin: 0,
                          fontWeight:"bold"

                        }}
                      >
                        {exp.organizationName}
                      </p>
                    </div>

                    <div
                      className="experience-info-box"
                      style={{
                        background: "#14161c",
                        borderRadius: "12px",
                        padding: "8px",
                        border: "1px solid rgba(255,255,255,0.05)",
                      }}
                    >
                      <p
                        style={{
                          color: "#00bcd4",
                          fontSize: "11px",
                          margin: "0 0 4px",
                          fontWeight: "bold",
                        }}
                      >
                        🎓 التخصص
                      </p>
                      <p
                        style={{
                          fontSize: "12px",
                          color: "#e5e7eb",
                          margin: 0,
                          fontWeight:"bold"
                        }}
                      >
                        {exp.major}
                      </p>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: "10px" }}>
                  <StarRating value={exp.starRating || 0} />

                  <button
                    style={{
                      marginTop: "5px",
                      width: "100%",
                      padding: "7px",
                      borderRadius: "12px",
                      border: "1px solid rgba(0,188,212,0.45)",
                      background: "transparent",
                      color: "#00bcd4",
                      cursor: "pointer",
                      fontSize: "12px",
                      fontWeight: "bold",
                    }}
                  >
                    عرض التفاصيل
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ================= Modal ================= */}
      {selectedExperience && (
        <div
          onClick={() => setSelectedExperience(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            className="experience-modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "linear-gradient(180deg, #1c1f27, #15171d)",
              borderRadius: "22px",
              padding: "26px",
              width: "92%",
              maxWidth: "620px",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 20px 50px rgba(0,0,0,0.45)",
              textAlign: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: "10px",
                justifyContent: "center",
                marginBottom: "18px",
                flexWrap: "wrap",
              }}
            >
              {steps.map((step, i) => (
                <div
                  key={i}
                  style={{
                    color: currentStep === i + 1 ? "#000" : "#aaa",
                    background:
                      currentStep === i + 1
                        ? "#00bcd4"
                        : "rgba(255,255,255,0.06)",
                    fontSize: "13px",
                    padding: "8px 12px",
                    borderRadius: "999px",
                    fontWeight: "bold",
                  }}
                >
                  {i + 1}. {step}
                </div>
              ))}
            </div>

            <div style={{ marginTop: "20px" }}>
              {renderStepContent()}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "10px",
                marginTop: "22px",
              }}
            >
              <button
                disabled={currentStep === 1}
                onClick={() => setCurrentStep((s) => s - 1)}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "12px",
                  border: "1px solid rgba(255,255,255,0.12)",
                  background:
                    currentStep === 1
                      ? "rgba(255,255,255,0.04)"
                      : "transparent",
                  color: currentStep === 1 ? "#777" : "#fff",
                  cursor: currentStep === 1 ? "not-allowed" : "pointer",
                }}
              >
                السابق
              </button>

              {currentStep < 2 ? (
                <button
                  onClick={() => setCurrentStep((s) => s + 1)}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: "12px",
                    border: "none",
                    background: "#00bcd4",
                    color: "#000",
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >
                  التالي
                </button>
              ) : (
                <button
                  onClick={() => setSelectedExperience(null)}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: "12px",
                    border: "none",
                    background: "#00bcd4",
                    color: "#000",
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >
                  إغلاق
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= Responsive ================= */}
      <style>{`
        @keyframes pulse {
          0% { opacity: 0.4 }
          50% { opacity: 0.8 }
          100% { opacity: 0.4 }
        }

        .major-filter-btn:hover {
          border-color: rgba(0,188,212,0.45) !important;
        }

        .major-filter-text {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          min-width: 0;
        }

        @media (max-width: 900px) {
          .experiences-shell {
            margin-top: 72px !important;
            padding: 12px 10px 24px !important;
          }

          .majors-grid {
            display: none !important;
          }

          .mobile-majors-menu {
            display: block !important;
          }

          .mobile-majors-list .major-filter-btn {
            margin-inline: 0 !important;
            border-radius: 12px !important;
            padding: 9px 8px !important;
            min-height: 42px;
            font-size: 11px !important;
          }

          .mobile-majors-list .major-filter-btn svg {
            width: 15px;
            height: 15px;
            flex: 0 0 auto;
          }

          .experiences-search-bar {
            align-items: stretch !important;
            gap: 8px !important;
            margin-bottom: 16px !important;
            flex-wrap: wrap;
          }

          .experiences-search-bar > div:first-child {
            flex: 1 1 100% !important;
          }

          .experiences-search-bar input {
            border-radius: 14px !important;
            padding-top: 10px !important;
            padding-bottom: 10px !important;
            font-size: 13px !important;
          }

          .experiences-search-bar select,
          .experiences-search-bar button {
            flex: 1;
            min-height: 40px;
          }

          .active-filter-chips {
            justify-content: flex-start !important;
            margin-top: -4px !important;
          }

          .results-count {
            display: none;
          }

          .experience-cards-grid {
            display: grid !important;
            grid-auto-flow: column;
            grid-auto-columns: minmax(136px, 38vw);
            grid-template-columns: none !important;
            gap: 10px !important;
            overflow-x: auto;
            overflow-y: hidden;
            padding: 2px 2px 12px;
            scroll-snap-type: x mandatory;
            -webkit-overflow-scrolling: touch;
          }

          .experience-card {
            min-height: 150px !important;
            border-radius: 14px !important;
            padding: 10px !important;
            box-shadow: 0 8px 18px rgba(0,0,0,0.22) !important;
            scroll-snap-align: start;
          }

          .experience-title-box {
            border-radius: 10px !important;
            padding: 7px !important;
            margin-bottom: 7px !important;
          }

          .experience-title-box h3 {
            font-size: 11px !important;
            line-height: 1.45 !important;
          }

          .experience-card-info {
            gap: 6px !important;
          }

          .experience-info-box {
            border-radius: 9px !important;
            padding: 6px !important;
          }

          .experience-info-box p:first-child {
            font-size: 10px !important;
            margin-bottom: 3px !important;
          }

          .experience-info-box p:last-child {
            font-size: 10px !important;
            line-height: 1.45 !important;
          }

          .experience-card button {
            padding: 6px !important;
            font-size: 10px !important;
            border-radius: 9px !important;
            margin-top: 4px !important;
          }

          .experience-card span {
            font-size: 12px !important;
          }

          .experience-modal {
            width: 100% !important;
            max-height: 86vh;
            overflow-y: auto;
            border-radius: 18px !important;
            padding: 18px !important;
          }
        }

        @media (max-width: 430px) {
          .experience-cards-grid {
            grid-auto-columns: minmax(118px, 34vw);
          }

          .experience-card {
            min-height: auto !important;
          }
        }
      `}</style>
    </div>
  );
};

export default ExperiencesPage;
