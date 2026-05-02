import React, { useState } from "react";

import { Link, useLocation } from "react-router-dom";
import logo from "./logo.png";
import AddExperienceModal from "./AddExperienceModal"
const Navbar = () => {
    const [showModal, setShowModal] = useState(false);
  
  const location = useLocation();
  const isMobile = window.innerWidth < 768;

  const linkStyle = (path) => ({
    textDecoration: "none",
    color: location.pathname === path ? "#7ddbcd" : "#e0e0e0",
    fontWeight: location.pathname === path ? "bold" : "normal",
    transition: "0.3s",
  });

  return (
    <nav
  style={{
    display: "flex",
    flexDirection: isMobile ? "column" : "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 24px",
    backgroundColor: "#16181d",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    gap: isMobile ? "14px" : "30px",
    overflow:"auto"
  }}
>

      {/* الشعار */}
      <Link to="/" style={{ display: "flex", alignItems: "center" }}>
        <img
          src={logo}
          alt="شعار دربك"
          style={{
            height: "80px",
            width: "85px",
            objectFit: "contain",
          }}
        />
      </Link>

      {/* الروابط */}
      <div style={{ display: "flex", gap: "26px", alignItems: "center" }}>
        <Link to="/" style={linkStyle("/")}>
          🏠 الرئيسية
        </Link>

        <Link to="/experiences" style={linkStyle("/experiences")}>
          📄 التجارب
        </Link>
        <div style={{ display: "flex", gap: "26px", alignItems: "center" }}>
        <button
            onClick={() => setShowModal(true)}
            style={{
              backgroundColor: "#7ddbcd",
              color: "#000",
              border: "none",
              borderRadius: "12px",
              padding: "10px 10px",
              fontSize: "14px",
              cursor: "pointer",
              boxShadow: "0 0 14px rgba(125,219,205, 0.4)",
              transition: "0.3s",
            }}
          >
            ➕أضف تجربتك 
            </button>
        </div>
 {showModal && (
          <AddExperienceModal
            onAddExperience={(exp) => console.log("تمت الإضافة:", exp)}
            onClose={() => setShowModal(false)}
          />
        )}


      </div>
    </nav>
  );
};

export default Navbar;
