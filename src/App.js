import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./pages/Navbar";
import HomePage from "./pages/HomePage";
import ExperiencesPage from "./pages/ExperiencesPage";
import AddExperienceModal from "./pages/AddExperienceModal";
import Footer from "./pages/Footer";
import { useLocation } from "react-router-dom";

function PageBanner() {
  const location = useLocation();
  const isExperiencesPage = location.pathname === "/experiences";

  return (
    <div
      style={{
        color: isExperiencesPage ? "#fff" : "#00A651",
        textAlign: "center",
        padding: isExperiencesPage ? "8px 14px 2px" : "5px 10px 2px",
        fontSize: isExperiencesPage ? "14px" : "30px",
        fontWeight: isExperiencesPage ? "400" : "800",
        letterSpacing: 0,
        lineHeight: 1.7,
      }}
    >
      {isExperiencesPage
        ? "تنويه: التجارب الطلابية شخصية ومرتبطة بظروف وبيئات مختلفة؛ ما يناسب غيرك قد لا يكون الأفضل لك، والعكس صحيح."
        : "صُنع بأيادٍ سعودية للشعب السعودي"}
    </div>
  );
}

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

        <PageBanner />

      

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
