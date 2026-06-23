import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import API_BASE_URL from "../config/api";

const homeFont = "'Aniq', 'Cairo', sans-serif";

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

  useEffect(() => {
    const fetchExperiencesCount = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/experiences?limit=1`);
        const data = await response.json();

        if (typeof data.total === "number") {
          setExperiencesCount(data.total);
        }
      } catch (error) {
        console.error("تعذر جلب عدد التجارب:", error);
      }
    };

    fetchExperiencesCount();
  }, []);

  const homeStats = useMemo(
    () => [
      { value: "+20", label: "مدينة رئيسية" },
      { value: "+25", label: "تخصص رئيسي" },
      {
        value:
          typeof experiencesCount === "number" ? `+${experiencesCount}` : "+",
        label: "تجربة مشاركة",
      },
    ],
    [experiencesCount]
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
        <Link to="/experiences" style={{ textDecoration: "none" }}>
          <button
            className="home-cta"
            style={{
              backgroundColor: "var(--app-brand)",
              color: "#07100e",
              border: "none",
              borderRadius: "10px",
              padding: "14px 34px",
              fontSize: "18px",
              fontFamily: homeFont,
              cursor: "pointer",
              transition: "0.3s",
              boxShadow: "0 0 15px var(--app-brand-border)",
            }}
          >
            استعرض التجارب 🚀
          </button>
        </Link>

        <Link to="/where-to-train" style={{ textDecoration: "none" }}>
          <button
            className="home-cta home-secondary-cta"
            style={{
              backgroundColor: "var(--app-input-bg)",
              color: "var(--app-brand-strong)",
              border: "1px solid var(--app-brand-border)",
              borderRadius: "10px",
              padding: "14px 34px",
              fontSize: "18px",
              fontFamily: homeFont,
              cursor: "pointer",
              transition: "0.3s",
              fontWeight: "700",
              boxShadow: "0 0 10px rgba(125, 219, 205, 0.12)",
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
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: "12px",
          width: "min(100%, 560px)",
          marginTop: "30px",
        }}
      >
        {homeStats.map((stat) => (
          <div
            key={stat.label}
            className="home-stat-card"
            style={{
              border: "1px solid var(--app-brand-border)",
              borderRadius: "10px",
              padding: "14px 10px",
              backgroundColor: "var(--app-surface)",
              boxShadow: "0 8px 20px var(--app-shadow)",
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
              {stat.value}
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
          </div>
        ))}
      </div>

      <style>{`
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
            width: min(100%, 320px);
          }

          .home-stats {
            width: min(100%, 340px) !important;
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
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
