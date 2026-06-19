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

  const actionButtonStyle = {
    backgroundColor: "var(--app-input-bg)",
    color: "var(--app-brand-strong)",
    border: "1px solid var(--app-brand-border)",
    borderRadius: "12px",
    padding: "10px 12px",
    fontSize: "14px",
    cursor: "pointer",
    boxShadow: "0 0 10px rgba(125, 219, 205, 0.12)",
    transition: "0.3s",
    fontFamily: "inherit",
    fontWeight: "700",
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
  );

  return (
    <>
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
          overflow: "auto",
          transition: "background-color 0.25s ease, border-color 0.25s ease",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexDirection: isMobile ? "column" : "row",
          }}
        >
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
          {themeToggleButton}
        </div>

        <div
          style={{
            display: "flex",
            gap: "18px",
            alignItems: "center",
            flexWrap: "wrap",
            justifyContent: "center",
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
              gap: "10px",
              alignItems: "center",
              flexWrap: "wrap",
              justifyContent: "center",
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
    </>
  );
};

export default Navbar;
