import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
  useNavigate,
} from "react-router-dom";
import "./App.css";
import Navbar from "./pages/Navbar";
import HomePage from "./pages/HomePage";
import ExperiencesPage from "./pages/ExperiencesPage";
import TrainingFinderPage from "./pages/TrainingFinderPage";
import AddExperienceModal from "./pages/AddExperienceModal";
import LegalPage from "./pages/LegalPage";
import AdminReviewPage from "./pages/AdminReviewPage";
import Footer from "./pages/Footer";

const PLATFORM_UPDATE_NOTICE_KEY = "darbak_where_to_train_update_seen_v2";

const hasSeenPlatformUpdateNotice = () => {
  if (typeof window === "undefined") return true;

  try {
    return window.localStorage.getItem(PLATFORM_UPDATE_NOTICE_KEY) === "true";
  } catch {
    return true;
  }
};

const markPlatformUpdateNoticeSeen = () => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(PLATFORM_UPDATE_NOTICE_KEY, "true");
  } catch {
    // Ignore storage quota or private browsing errors.
  }
};

function PageBanner() {
  const location = useLocation();
  const isExperiencesPage = location.pathname === "/experiences";

  if (!isExperiencesPage) return null;

  return (
    <div
      style={{
        width: "min(920px, calc(100% - 28px))",
        margin: "8px auto -18px",
        color: "var(--app-text-soft)",
        textAlign: "center",
        padding: "6px 14px",
        fontSize: "15px",
        fontWeight: "400",
        letterSpacing: 0,
        lineHeight: 1.75,
        fontFamily: "'Aniq', 'Cairo', sans-serif",
      }}
    >
      <span style={{ color: "var(--app-brand)", fontWeight: "600" }}>
        تنويه:
      </span>{" "}
      خذ من تجارب غيرك ما يفيدك، لكن تذكّر أن لكل طالب رحلته وتجربته الخاصة. 🤍
    </div>
  );
}

function PlatformUpdateNotice() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showNotice, setShowNotice] = useState(false);

  useEffect(() => {
    const isAdminPage = location.pathname === "/darbak-owner-review-2026";
    const isTrainingFinderPage = location.pathname === "/where-to-train";

    setShowNotice(
      !isAdminPage && !isTrainingFinderPage && !hasSeenPlatformUpdateNotice()
    );
  }, [location.pathname]);

  const closeNotice = () => {
    markPlatformUpdateNoticeSeen();
    setShowNotice(false);
  };

  const openTrainingFinder = () => {
    closeNotice();
    navigate("/where-to-train");
  };

  if (!showNotice) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="platform-update-title"
      onClick={closeNotice}
      aria-live="polite"
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "18px",
        background: "var(--app-overlay)",
        backdropFilter: "blur(8px)",
        zIndex: 2500,
        direction: "rtl",
        fontFamily: "'Aniq', 'Cairo', sans-serif",
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          position: "relative",
          width: "min(500px, 100%)",
          background: "var(--app-surface)",
          border: "1px solid var(--app-brand-border)",
          borderRadius: "22px",
          boxShadow: "0 24px 70px var(--app-shadow)",
          color: "var(--app-text)",
          padding: "28px 24px 22px",
          textAlign: "center",
        }}
      >
        <button
          type="button"
          onClick={closeNotice}
          aria-label="إغلاق إشعار التحديث"
          style={{
            position: "absolute",
            top: "12px",
            left: "12px",
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            border: "1px solid var(--app-border)",
            background: "var(--app-input-bg)",
            color: "var(--app-text-soft)",
            cursor: "pointer",
            fontSize: "19px",
            lineHeight: 1,
          }}
        >
          ×
        </button>

        <div
          aria-hidden="true"
          style={{
            width: "54px",
            height: "54px",
            borderRadius: "18px",
            display: "grid",
            placeItems: "center",
            margin: "0 auto 12px",
            background: "var(--app-brand-soft)",
            color: "var(--app-brand)",
            fontSize: "25px",
          }}
        >
          🎯
        </div>

        <p
          style={{
            margin: 0,
            color: "var(--app-brand)",
            fontWeight: "800",
            fontSize: "14px",
          }}
        >
          تحديث جديد في منصة دربك
        </p>
        <h2
          id="platform-update-title"
          style={{
            margin: "4px 0 0",
            color: "var(--app-text)",
            fontSize: "clamp(21px, 4vw, 27px)",
            lineHeight: 1.45,
          }}
        >
          صفحة وين أتدرب صارت جاهزة لاحتياجاتكم
        </h2>
        <p
          style={{
            margin: "10px auto 0",
            color: "var(--app-text-soft)",
            fontSize: "14px",
            lineHeight: 1.8,
            maxWidth: "390px",
          }}
        >
          اختَر تخصصك ومدينتك، ودربك يعرض لك جهات مناسبة بناءً على تجارب
          طلاب سابقة. تقدر بعدها تقرأ التجارب المرتبطة بكل جهة وتبدأ بحثك
          بصورة أوضح.
        </p>
        <div
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
            justifyContent: "center",
            marginTop: "18px",
          }}
        >
          <button
            type="button"
            onClick={openTrainingFinder}
            style={{
              background: "var(--app-brand)",
              color: "#07100e",
              border: "none",
              borderRadius: "12px",
              padding: "10px 14px",
              cursor: "pointer",
              fontFamily: "inherit",
              fontWeight: "900",
              boxShadow: "0 0 14px var(--app-brand-border)",
            }}
          >
            انتقل إلى وين أتدرب
          </button>
          <button
            type="button"
            onClick={closeNotice}
            style={{
              background: "transparent",
              color: "var(--app-text-soft)",
              border: "1px solid var(--app-border)",
              borderRadius: "12px",
              padding: "10px 14px",
              cursor: "pointer",
              fontFamily: "inherit",
              fontWeight: "700",
            }}
          >
            لاحقًا
          </button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "dark";
    return window.localStorage.getItem("darbak_theme") || "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem("darbak_theme", theme);
  }, [theme]);

  const appStyle = {
    minHeight: "100vh",
    backgroundColor: "var(--app-bg)",
    color: "var(--app-text-soft)",
    fontFamily: "'Cairo', sans-serif",
    display: "flex",
    flexDirection: "column",
    transition: "background-color 0.25s ease, color 0.25s ease",
  };

  const contentContainer = {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  };

  const contentStyle = {
    width: "100%",
    maxWidth: "1200px",
    padding: "40px 20px",
  };

  return (
    <Router>
      <div style={appStyle}>
        <Navbar theme={theme} setTheme={setTheme} />

        <PageBanner />
        <PlatformUpdateNotice />

      

        {/* المحتوى */}
        <div style={contentContainer}>
          <div className="app-content-frame" style={contentStyle}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/experiences" element={<ExperiencesPage />} />
              <Route path="/where-to-train" element={<TrainingFinderPage />} />
              <Route path="/legal" element={<LegalPage />} />
              <Route path="/terms" element={<LegalPage />} />
              <Route path="/privacy" element={<LegalPage />} />
              <Route path="/darbak-owner-review-2026" element={<AdminReviewPage />} />
              <Route path="/AddExperienceModal" element={<AddExperienceModal />} />

            </Routes>
          </div>
        </div>

       
         
        <Footer />

      </div>

    </Router>
  );
}

export default App;
