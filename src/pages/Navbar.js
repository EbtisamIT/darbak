import React, { useEffect, useState } from "react";

import { Link, useLocation } from "react-router-dom";
import axios from "axios";
import API_BASE_URL from "../config/api";
import logo from "./logo.png";
import AddExperienceModal from "./AddExperienceModal";

const Navbar = ({ theme = "dark", setTheme }) => {
  const [showModal, setShowModal] = useState(false);
  const [showSuggestionBox, setShowSuggestionBox] = useState(false);
  const [suggestionText, setSuggestionText] = useState("");
  const [suggestionMessage, setSuggestionMessage] = useState("");
  const [sendingSuggestion, setSendingSuggestion] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );

  const location = useLocation();
  const shouldStickNavbar = !isMobile && location.pathname !== "/experiences";

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
    whiteSpace: "nowrap",
    flex: isMobile ? "0 0 auto" : "initial",
    padding: isMobile ? "7px 10px" : 0,
    borderRadius: isMobile ? "999px" : 0,
    fontSize: isMobile ? "12px" : "inherit",
    background:
      isMobile && location.pathname === path
        ? "var(--app-brand-soft)"
        : "transparent",
    border:
      isMobile && location.pathname === path
        ? "1px solid var(--app-brand-border)"
        : isMobile
        ? "1px solid transparent"
        : "none",
  });

  const actionButtonStyle = {
    backgroundColor: "var(--app-input-bg)",
    color: "var(--app-brand-strong)",
    border: "1px solid var(--app-brand-border)",
    borderRadius: isMobile ? "999px" : "12px",
    padding: isMobile ? "8px 10px" : "10px 12px",
    fontSize: isMobile ? "12px" : "14px",
    cursor: "pointer",
    boxShadow: "0 0 10px rgba(125, 219, 205, 0.12)",
    transition: "0.3s",
    fontFamily: "inherit",
    fontWeight: "700",
    whiteSpace: "nowrap",
    flex: isMobile ? "0 0 auto" : "initial",
  };

  const toggleTheme = () => {
    if (setTheme) setTheme(theme === "dark" ? "light" : "dark");
  };

  const submitSuggestion = async (event) => {
    event.preventDefault();

    const text = suggestionText.trim();

    if (text.length < 3) {
      setSuggestionMessage("اكتب اقتراحًا واضحًا قبل الإرسال.");
      return;
    }

    try {
      setSendingSuggestion(true);
      setSuggestionMessage("");
      await axios.post(`${API_BASE_URL}/api/suggestions`, { text });
      setSuggestionText("");
      setShowSuggestionBox(false);
      setSuggestionMessage("وصلنا اقتراحك، شكرًا لك.");
    } catch (err) {
      setSuggestionMessage(
        err.response?.data?.error || "تعذر إرسال الاقتراح حاليًا."
      );
    } finally {
      setSendingSuggestion(false);
    }
  };

  const themeToggleButton = (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "تفعيل الوضع الصباحي" : "تفعيل الوضع المسائي"}
      style={{
        position: "relative",
        width: isMobile ? "50px" : "58px",
        height: isMobile ? "26px" : "30px",
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
          right: theme === "dark" ? (isMobile ? "27px" : "31px") : "3px",
          width: isMobile ? "20px" : "22px",
          height: isMobile ? "20px" : "22px",
          borderRadius: "50%",
          background: "var(--app-brand)",
          boxShadow: "0 4px 12px var(--app-brand-border)",
          transition: "right 0.25s ease",
          zIndex: 1,
        }}
      />
    </button>
  );

  return (
    <header
      style={{
        position: shouldStickNavbar ? "sticky" : "static",
        top: shouldStickNavbar ? 0 : "auto",
        zIndex: shouldStickNavbar ? 1800 : "auto",
        width: "100%",
        background: "var(--app-surface)",
        boxShadow: shouldStickNavbar ? "0 10px 24px rgba(0,0,0,0.12)" : "none",
      }}
    >
      <nav
        style={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          justifyContent: "space-between",
          alignItems: "center",
          padding: isMobile ? "7px 10px 9px" : "14px 24px",
          backgroundColor: "var(--app-surface)",
          borderBottom: "1px solid var(--app-border)",
          gap: isMobile ? "7px" : "30px",
          overflow: "hidden",
          transition: "background-color 0.25s ease, border-color 0.25s ease",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexDirection: "row",
            width: isMobile ? "100%" : "auto",
            justifyContent: isMobile ? "space-between" : "flex-start",
          }}
        >
          <Link to="/" style={{ display: "flex", alignItems: "center" }}>
            <img
              src={logo}
              alt="شعار دربك"
              style={{
                height: isMobile ? "42px" : "80px",
                width: isMobile ? "54px" : "85px",
                objectFit: "contain",
              }}
            />
          </Link>
          {themeToggleButton}
        </div>

        <div
          className="navbar-links-row"
          style={{
            display: "flex",
            gap: isMobile ? "7px" : "18px",
            alignItems: "center",
            flexWrap: isMobile ? "nowrap" : "wrap",
            justifyContent: isMobile ? "flex-start" : "center",
            width: isMobile ? "100%" : "auto",
            overflowX: isMobile ? "auto" : "visible",
            overflowY: "hidden",
            paddingBottom: isMobile ? "2px" : 0,
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: isMobile ? "none" : "auto",
          }}
        >
          <Link to="/" style={linkStyle("/")}>
            🏠 الرئيسية
          </Link>

          <Link to="/experiences" style={linkStyle("/experiences")}>
            📄 التجارب
          </Link>

          <Link to="/where-to-train" style={linkStyle("/where-to-train")}>
            🎯 وين أتدرب؟
          </Link>

          <div
            style={{
              display: "flex",
              gap: isMobile ? "7px" : "10px",
              alignItems: "center",
              flexWrap: "nowrap",
              justifyContent: isMobile ? "flex-start" : "center",
              flex: isMobile ? "0 0 auto" : "initial",
            }}
          >
            <button
              type="button"
              onClick={() => {
                setShowSuggestionBox((prev) => !prev);
                setSuggestionMessage("");
              }}
              style={actionButtonStyle}
            >
              اقتراحاتكم
            </button>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              style={actionButtonStyle}
            >
              + أضف تجربتك
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
      {showSuggestionBox && (
        <div
          style={{
            width: "100%",
            background: "var(--app-surface)",
            borderBottom: "1px solid var(--app-border)",
            padding: "12px 16px",
            boxSizing: "border-box",
          }}
        >
          <form
            onSubmit={submitSuggestion}
            style={{
              width: "min(100%, 560px)",
              margin: "0 auto",
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1fr) auto",
              gap: "10px",
              alignItems: "center",
              direction: "rtl",
            }}
          >
            <textarea
              value={suggestionText}
              onChange={(e) => setSuggestionText(e.target.value)}
              placeholder="اكتب اقتراحك لدربك..."
              rows={isMobile ? 3 : 2}
              maxLength={1000}
              style={{
                width: "100%",
                boxSizing: "border-box",
                resize: "vertical",
                background: "var(--app-input-bg)",
                color: "var(--app-text)",
                border: "1px solid var(--app-border)",
                borderRadius: "12px",
                padding: "10px 12px",
                fontFamily: "inherit",
                lineHeight: 1.7,
                textAlign: "right",
              }}
            />
            <button
              type="submit"
              disabled={sendingSuggestion}
              style={{
                background: "var(--app-brand)",
                color: "#101418",
                border: "none",
                borderRadius: "12px",
                padding: "11px 18px",
                cursor: sendingSuggestion ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                fontWeight: "800",
                whiteSpace: "nowrap",
              }}
            >
              {sendingSuggestion ? "إرسال..." : "إرسال"}
            </button>
          </form>
        </div>
      )}
      {suggestionMessage && (
        <p
          style={{
            margin: "8px auto 0",
            padding: "0 16px",
            textAlign: "center",
            fontSize: "12px",
            color: suggestionMessage.includes("وصلنا")
              ? "var(--app-brand-strong)"
              : "#fecdd3",
            fontFamily: "'Cairo', sans-serif",
          }}
        >
          {suggestionMessage}
        </p>
      )}
      <style>{`
        @media (max-width: 767px) {
          .navbar-links-row::-webkit-scrollbar {
            display: none;
          }
        }
      `}</style>
    </header>
  );
};

export default Navbar;
