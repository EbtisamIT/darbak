import React, { useEffect, useState } from "react";

import { Link, useLocation } from "react-router-dom";
import logo from "./logo.png";
import AddExperienceModal from "./AddExperienceModal"
const Navbar = ({ theme = "dark", setTheme }) => {
    const [showModal, setShowModal] = useState(false);
  
  const location = useLocation();
  const isMobile = window.innerWidth < 768;

  useEffect(() => {
    const openAddExperienceModal = () => setShowModal(true);

    window.addEventListener("darbak:open-add-experience", openAddExperienceModal);
    return () => {
      window.removeEventListener(
        "darbak:open-add-experience",
        openAddExperienceModal
      );
    };
  }, []);

  const linkStyle = (path) => ({
    textDecoration: "none",
    color: location.pathname === path ? "var(--app-brand)" : "var(--app-text-soft)",
    fontWeight: location.pathname === path ? "bold" : "normal",
    transition: "0.3s",
  });

  const toggleTheme = () => {
    if (setTheme) setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <nav
  style={{
    display: "flex",
    flexDirection: isMobile ? "column" : "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 24px",
    backgroundColor: "var(--app-surface)",
    borderBottom: "1px solid var(--app-border)",
    gap: isMobile ? "14px" : "30px",
    overflow:"auto",
    transition: "background-color 0.25s ease, border-color 0.25s ease",
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
      <div style={{ display: "flex", gap: "18px", alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
        <Link to="/" style={linkStyle("/")}>
          🏠 الرئيسية
        </Link>

        <Link to="/experiences" style={linkStyle("/experiences")}>
          📄 التجارب
        </Link>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "تفعيل الوضع الصباحي" : "تفعيل الوضع المسائي"}
          style={{
            position: "relative",
            width: "58px",
            height: "30px",
            backgroundColor: "var(--app-input-bg)",
            color: "var(--app-text)",
            border: "1px solid var(--app-border)",
            borderRadius: "999px",
            padding: "0",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "space-between",
            overflow: "hidden",
            boxShadow: "inset 0 0 0 1px var(--app-border-soft)",
            transition: "background-color 0.25s ease, border-color 0.25s ease",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: "50%",
              display: "grid",
              placeItems: "center",
              color: theme === "light" ? "#07100e" : "var(--app-muted)",
              fontSize: "13px",
              zIndex: 2,
            }}
          >
            ☼
          </span>
          <span
            aria-hidden="true"
            style={{
              width: "50%",
              display: "grid",
              placeItems: "center",
              color: theme === "dark" ? "#07100e" : "var(--app-muted)",
              fontSize: "13px",
              zIndex: 2,
            }}
          >
            ◐
          </span>
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              top: "3px",
              right: theme === "dark" ? "31px" : "3px",
              width: "22px",
              height: "22px",
              borderRadius: "50%",
              background: "var(--app-brand)",
              boxShadow: "0 4px 12px var(--app-brand-border)",
              transition: "right 0.25s ease",
              zIndex: 1,
            }}
          />
        </button>

        <div style={{ display: "flex", gap: "26px", alignItems: "center" }}>
        <button
            onClick={() => setShowModal(true)}
            style={{
              backgroundColor: "var(--app-brand)",
              color: "#000",
              border: "none",
              borderRadius: "12px",
              padding: "10px 10px",
              fontSize: "14px",
              cursor: "pointer",
              boxShadow: "0 0 14px var(--app-brand-border)",
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
