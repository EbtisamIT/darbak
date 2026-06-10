import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "./App.css";
import Navbar from "./pages/Navbar";
import HomePage from "./pages/HomePage";
import ExperiencesPage from "./pages/ExperiencesPage";
import AddExperienceModal from "./pages/AddExperienceModal";
import LegalPage from "./pages/LegalPage";
import AdminReviewPage from "./pages/AdminReviewPage";
import Footer from "./pages/Footer";
import { useLocation } from "react-router-dom";

function PageBanner() {
  const location = useLocation();
  const isExperiencesPage = location.pathname === "/experiences";

  if (!isExperiencesPage) return null;

  return (
    <div
      style={{
        color: "var(--app-text)",
        textAlign: "center",
        padding: "8px 14px 2px",
        fontSize: "14px",
        fontWeight: "400",
        letterSpacing: 0,
        lineHeight: 1.7,
      }}
    >
      تنويه: التجارب الطلابية شخصية ومرتبطة بظروف وبيئات مختلفة؛ ما يناسب غيرك قد لا يكون الأفضل لك، والعكس صحيح.
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

      

        {/* المحتوى */}
        <div style={contentContainer}>
          <div style={contentStyle}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/experiences" element={<ExperiencesPage />} />
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
