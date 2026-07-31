import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import API_BASE_URL from "../config/api";
import AnimatedCount from "../components/AnimatedCount";
import FeaturedAmbassadorsSection from "../components/FeaturedAmbassadorsSection";
import { darbakContactDirectoryOrganizations } from "../data/darbakContactDirectory";
import { darbakGuideOrganizations } from "../data/darbakGuideSuggestions";
import {
  suggestedOrganizationsByMajorCategory,
  suggestedOrganizationsByRegion,
} from "./TrainingFinderPage";

const homeFont = "'Aniq', 'Cairo', sans-serif";

const normalizeOrganizationName = (value = "") =>
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

const countUniqueOrganizations = (names = []) =>
  new Set(names.map(normalizeOrganizationName).filter(Boolean)).size;

const suggestedOrganizationNames = [
  ...Object.values(suggestedOrganizationsByRegion)
    .flat()
    .map((organization) => organization.name),
  ...Object.values(suggestedOrganizationsByMajorCategory)
    .flat()
    .map((organization) => organization.name),
  ...darbakGuideOrganizations.map((organization) => organization.name),
  ...darbakContactDirectoryOrganizations.map((organization) => organization.name),
];

const MovingGreenPath = () => {
  return (
    <div className="home-title-wrap" style={{ position: "relative", display: "inline-block" }}>
      {/* 🌌 خلفية نجوم محسّنة */}
      <div
        style={{
          position: "absolute",
          top: "-60px",
          left: "-80px",
          width: "300px",
          height: "200px",
          pointerEvents: "none",
          overflow: "visible",
          zIndex: 0,
        }}
      >
        {/* ⭐ نجوم */}
        <div className="star s1"></div>
        <div className="star s2"></div>
        <div className="star s3"></div>
        <div className="star s4"></div>

        {/* 🌠 شهاب ناعم */}
        <div className="shooting"></div>

        <style>
          {`
          .star {
              position: absolute;
              width: 4px;
              height: 4px;
              background: var(--app-text);
              border-radius: 50%;
              opacity: 0.8;
              filter: drop-shadow(0 0 6px var(--app-text));
              animation: twinkle 2.2s infinite ease-in-out;
            }

            .s1 { top: 10px; left: 40px; animation-delay: 0.3s; }
            .s2 { top: 90px; left: 140px; animation-delay: 1s; }
            .s3 { top: 45px; left: 200px; animation-delay: 1.6s; }
            .s4 { top: 120px; left: 70px; animation-delay: 2.2s; }

            @keyframes twinkle {
              0%, 100% { opacity: 0.3; transform: scale(0.8); }
              50% { opacity: 1; transform: scale(1.2); }
            }

            .shooting {
              position: absolute;
              top: 40px;
              left: -40px;
              width: 120px;
              height: 2px;
              background: linear-gradient(90deg, var(--app-text), transparent);
              opacity: 0;
              transform: rotate(25deg);
              filter: drop-shadow(0 0 4px var(--app-text));
              animation: shoot 3.5s infinite ease-out;
            }

            @keyframes shoot {
              0% { transform: translateX(0) rotate(25deg); opacity: 0; }
              10% { opacity: 1; }
              40% { transform: translateX(160px) rotate(25deg); opacity: 0; }
              100% { opacity: 0; }
            }
          `}
        </style>
      </div>

      {/* العنوان */}
      <h1
        className="home-title"
        style={{
          fontSize: "42px",
          color: "var(--app-brand-strong)",
          margin: 0,
          fontWeight: "700",
          position: "relative",
          zIndex: 2,
          fontFamily: homeFont,
        }}
      >
        تعلّـم من تجارب غيرك ودربك خضـر
      </h1>

      {/* الطريق الأخضر */}
      <div
        style={{
          position: "absolute",
          bottom: "-12px",
          left: "0",
          width: "100%",
          height: "4px",
          background:
            "linear-gradient(90deg, transparent, var(--app-brand-strong), transparent)",
          animation: "moveRoad 5s linear infinite",
          borderRadius: "20px",
        }}
      ></div>

      <style>
        {`
          @keyframes moveRoad {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
        `}
      </style>
    </div>
  );
};

const HomePage = () => {
  const [experiencesCount, setExperiencesCount] = useState(null);
  const [currentProgramsCount, setCurrentProgramsCount] = useState(null);
  const [studentsAppliedCount, setStudentsAppliedCount] = useState(null);
  const [experienceOrganizationNames, setExperienceOrganizationNames] =
    useState([]);

  useEffect(() => {
    const fetchHomeStats = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/home-stats`);
        const data = await response.json();

        if (typeof data.experiencesCount === "number") {
          setExperiencesCount(data.experiencesCount);
        }

        if (typeof data.currentProgramsCount === "number") {
          setCurrentProgramsCount(data.currentProgramsCount);
        }

        if (typeof data.studentsAppliedCount === "number") {
          setStudentsAppliedCount(data.studentsAppliedCount);
        }

        if (Array.isArray(data.organizationNames)) {
          setExperienceOrganizationNames(data.organizationNames);
        }
      } catch (error) {
        console.error("تعذر جلب إحصائيات الصفحة الرئيسية:", error);
      }
    };

    fetchHomeStats();
  }, []);

  const organizationsCount = useMemo(
    () =>
      countUniqueOrganizations([
        ...suggestedOrganizationNames,
        ...experienceOrganizationNames,
      ]),
    [experienceOrganizationNames]
  );

  const homeStats = useMemo(
    () => [
      {
        value: typeof experiencesCount === "number" ? experiencesCount : null,
        label: "تجربة مشاركة",
        to: "/experiences",
      },
      {
        value: organizationsCount || null,
        label: "جهة تدريب",
        to: "/where-to-train",
      },
      {
        value:
          typeof currentProgramsCount === "number"
            ? currentProgramsCount
            : null,
        label: "برنامج حالي",
        caption: "جهات حكومية وشركات",
        to: "/where-to-train",
      },
      {
        value:
          typeof studentsAppliedCount === "number"
            ? studentsAppliedCount
            : null,
        label: "طالب قدم عبر دربك",
        caption: "من الفرص والبرامج",
        to: "/where-to-train",
      },
    ],
    [
      currentProgramsCount,
      experiencesCount,
      organizationsCount,
      studentsAppliedCount,
    ]
  );

  return (
    <div
      className="home-page"
      style={{
        backgroundColor: "var(--app-bg)",
        color: "var(--app-text)",
        minHeight: "calc(100vh - 80px)",
        width: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
        fontFamily: homeFont,
        padding: "20px",
      }}
    >
      <div
        className="home-kicker"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--app-brand)",
          border: "1px solid var(--app-brand-border)",
          backgroundColor: "var(--app-brand-soft)",
          borderRadius: "999px",
          padding: "8px 14px",
          marginBottom: "22px",
          fontSize: "15px",
          lineHeight: 1.4,
          fontFamily: homeFont,
        }}
      >
        منصة طلابية سعودية لتبادل التجارب
      </div>

      <MovingGreenPath />

      <p
        className="home-copy"
        style={{
          fontSize: "19px",
          color: "var(--app-muted-2)",
          maxWidth: "600px",
          margin: "25px auto 35px auto",
          lineHeight: "1.8",
          fontFamily: homeFont,
        }}
      >
        منصة <strong>دربك</strong> تساعد الطلاب والطالبات على اكتشاف أفضل
        تجارب التدريب التعاوني عبر مشاركة قصص حقيقية 
        <br />
        لتكون بداية مشوارك المهني أوضح وأسهل.
      </p>

      <div
        className="home-actions"
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        <Link to="/where-to-train" style={{ textDecoration: "none" }}>
          <button
            className="home-cta home-primary-cta"
            style={{
              backgroundColor: "var(--app-brand)",
              color: "#07100e",
              border: "none",
              borderRadius: "10px",
              padding: "14px 34px",
              fontSize: "16px",
              fontFamily: homeFont,
              cursor: "pointer",
              transition: "0.3s",
              fontWeight: "900",
              boxShadow: "0 0 14px var(--app-brand-border)",
            }}
          >
            وين أتدرب؟
          </button>
        </Link>
      </div>

      <div
        className="home-stats"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: "12px",
          width: "min(100%, 760px)",
          marginTop: "30px",
        }}
      >
        {homeStats.map((stat) => (
          <Link
            key={stat.label}
            to={stat.to}
            className="home-stat-card"
            aria-label={`${stat.label} في دربك`}
            style={{
              display: "block",
              textDecoration: "none",
              border: "1px solid var(--app-brand-border)",
              borderRadius: "10px",
              padding: "14px 10px",
              backgroundColor: "var(--app-surface)",
              boxShadow: "0 8px 20px var(--app-shadow)",
              transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
              cursor: "pointer",
            }}
          >
            <strong
              style={{
                display: "block",
                color: "var(--app-brand)",
                fontSize: "22px",
                lineHeight: 1.2,
                fontWeight: 700,
                marginBottom: "6px",
              }}
            >
              {typeof stat.value === "number" ? (
                <AnimatedCount value={stat.value} suffix="+" />
              ) : (
                "..."
              )}
            </strong>
            <span
              style={{
                display: "block",
                color: "var(--app-muted-2)",
                fontSize: "13px",
                lineHeight: 1.5,
              }}
            >
              {stat.label}
            </span>
            {stat.caption && (
              <small
                style={{
                  display: "block",
                  color: "var(--app-muted)",
                  fontSize: "11px",
                  lineHeight: 1.45,
                  marginTop: "2px",
                }}
              >
                {stat.caption}
              </small>
            )}
          </Link>
        ))}
      </div>

      <FeaturedAmbassadorsSection compact />

      <style>{`
        .home-stat-card:hover,
        .home-stat-card:focus-visible {
          transform: translateY(-4px) scale(1.02);
          border-color: var(--app-brand);
          box-shadow: 0 14px 30px var(--app-shadow), 0 0 18px var(--app-brand-border) !important;
          outline: none;
        }

        .home-stat-card:active {
          transform: translateY(0) scale(0.98);
        }

        @media (max-width: 768px) {
          .home-page {
            width: calc(100% + 40px) !important;
            margin-inline: -20px;
            min-height: calc(100vh - 170px) !important;
            padding: 28px 14px 36px !important;
            justify-content: flex-start !important;
            overflow-x: hidden;
          }

          .home-kicker {
            font-size: 14px !important;
            margin-bottom: 18px !important;
            padding: 7px 12px !important;
          }

          .home-title-wrap {
            width: 100%;
            max-width: 100%;
            display: block !important;
          }

          .home-title-wrap > div:first-child {
            display: none;
          }

          .home-title {
            font-size: 30px !important;
            line-height: 1.45 !important;
            max-width: 100%;
            margin-inline: auto !important;
            padding-inline: 8px;
          }

          .home-copy {
            font-size: 16px !important;
            line-height: 1.8 !important;
            margin: 18px auto 24px !important;
            max-width: 92vw !important;
          }

          .home-cta {
            width: min(100%, 280px);
            padding: 12px 24px !important;
            font-size: 16px !important;
          }

          .home-actions {
            width: min(100%, 280px);
            gap: 8px !important;
          }

          .home-stats {
            width: min(100%, 340px) !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 8px !important;
            margin-top: 22px !important;
          }

          .home-stat-card {
            padding: 10px 6px !important;
          }

          .home-stat-card strong {
            font-size: 18px !important;
          }

          .home-stat-card span {
            font-size: 11px !important;
          }

          .home-stat-card small {
            font-size: 10px !important;
          }

        }

        @media (max-width: 390px) {
          .home-title {
            font-size: 26px !important;
          }

          .home-copy {
            font-size: 15px !important;
            max-width: 94vw !important;
          }

          .home-stats {
            width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
};

export default HomePage;
