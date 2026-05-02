import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./pages/Navbar";
import HomePage from "./pages/HomePage";
import ExperiencesPage from "./pages/ExperiencesPage";
import AddExperienceModal from "./pages/AddExperienceModal";
import Footer from "./pages/Footer";
function App() {
  const appStyle = {
    minHeight: "100vh",
    backgroundColor: "#0f1115",
    color: "#e0e0e0",
    fontFamily: "'Cairo', sans-serif",
    display: "flex",
    flexDirection: "column",
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
        <Navbar />

        <div
          style={{
            color: "#111827",
            background: "rgba(255,255,255,0.94)",
            textAlign: "center",
            padding: "8px 14px",
            fontSize: "13px",
            fontWeight: "700",
            letterSpacing: 0,
            borderBottom: "1px solid rgba(0,108,53,0.18)",
          }}
        >
          صُنع بأيادٍ سعودية للشعب السعودي
        </div>

      

        {/* المحتوى */}
        <div style={contentContainer}>
          <div style={contentStyle}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/experiences" element={<ExperiencesPage />} />
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
