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
  const [isNavbarCollapsed, setIsNavbarCollapsed] = useState(false);
  const [floatingMenuOpen, setFloatingMenuOpen] = useState(false);

  const location = useLocation();
  const isExperiencesPage = location.pathname === "/experiences";
  const shouldStickNavbar = !isMobile && location.pathname !== "/experiences";
  const floatingNavTop = isExperiencesPage
    ? isMobile
      ? "142px"
      : "112px"
    : isMobile
    ? "72px"
    : "84px";
  const shouldHideHeader =
    shouldStickNavbar &&
    isNavbarCollapsed &&
    !showModal &&
    !showSuggestionBox &&
    !suggestionMessage;

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const collapsed = window.scrollY > (isMobile ? 130 : 180);
      setIsNavbarCollapsed(collapsed);
      if (!collapsed) setFloatingMenuOpen(false);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isMobile]);

  useEffect(() => {
    setFloatingMenuOpen(false);
  }, [location.pathname]);

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
    flex: isMobile ? "0 1 auto" : "initial",
    padding: isMobile ? "2px 1px 4px" : 0,
    borderRadius: 0,
    fontSize: isMobile ? "10.5px" : "inherit",
    background: "transparent",
    border: "none",
    borderBottom:
      isMobile && location.pathname === path
        ? "1px solid var(--app-brand)"
        : "1px solid transparent",
  });

  const actionButtonStyle = {
    backgroundColor: "var(--app-input-bg)",
    color: "var(--app-brand-strong)",
    border: "1px solid var(--app-brand-border)",
    borderRadius: isMobile ? "999px" : "12px",
    padding: isMobile ? "7px 8px" : "10px 12px",
    fontSize: isMobile ? "10.5px" : "14px",
    cursor: "pointer",
    boxShadow: "0 0 10px rgba(125, 219, 205, 0.12)",
    transition: "0.3s",
    fontFamily: "inherit",
    fontWeight: "700",
    whiteSpace: "nowrap",
    flex: isMobile ? "0 0 auto" : "initial",
  };

  const quietActionButtonStyle = {
    background: "transparent",
    color: "var(--app-text-soft)",
    border: "none",
    padding: isMobile ? "2px 1px 4px" : "0",
    cursor: "pointer",
    transition: "0.3s",
    fontFamily: "inherit",
    fontSize: isMobile ? "10.5px" : "14px",
    fontWeight: "700",
    whiteSpace: "nowrap",
    flex: isMobile ? "0 1 auto" : "initial",
    borderBottom: "1px solid transparent",
  };

  const toggleTheme = () => {
    if (setTheme) setTheme(theme === "dark" ? "light" : "dark");
  };

  const toggleSuggestionBox = () => {
    setShowSuggestionBox((prev) => !prev);
    setSuggestionMessage("");
    setFloatingMenuOpen(false);
  };

  const openAddExperienceModal = () => {
    setShowModal(true);
    setFloatingMenuOpen(false);
  };

  const floatingLinkStyle = (path) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    textDecoration: "none",
    color: location.pathname === path ? "var(--app-brand)" : "var(--app-text)",
    background:
      location.pathname === path ? "var(--app-brand-soft)" : "transparent",
    border: "1px solid",
    borderColor:
      location.pathname === path ? "var(--app-brand-border)" : "var(--app-border)",
    borderRadius: "14px",
    padding: "10px 12px",
    fontSize: "13px",
    fontWeight: "800",
    whiteSpace: "nowrap",
  });

  const floatingActionStyle = {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    background: "var(--app-input-bg)",
    color: "var(--app-text)",
    border: "1px solid var(--app-border)",
    borderRadius: "14px",
    padding: "10px 12px",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: "13px",
    fontWeight: "800",
    textAlign: "right",
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
    <>
      <header
      style={{
        position: shouldStickNavbar ? "sticky" : "static",
        top: shouldStickNavbar ? 0 : "auto",
        zIndex: shouldStickNavbar ? 1800 : "auto",
        width: "100%",
        background: "var(--app-surface)",
        boxShadow: shouldStickNavbar ? "0 10px 24px rgba(0,0,0,0.12)" : "none",
        transform: shouldHideHeader ? "translateY(-110%)" : "translateY(0)",
        opacity: shouldHideHeader ? 0 : 1,
        pointerEvents: shouldHideHeader ? "none" : "auto",
        transition:
          "transform 0.22s ease, opacity 0.22s ease, background-color 0.25s ease",
      }}
    >
      <nav
        style={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          justifyContent: "space-between",
          alignItems: "center",
          padding: isMobile ? "6px 8px 7px" : "14px 24px",
          backgroundColor: "var(--app-surface)",
          borderBottom: "1px solid var(--app-border)",
          gap: isMobile ? "5px" : "30px",
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
            gap: isMobile ? "6px" : "18px",
            alignItems: "center",
            flexWrap: isMobile ? "nowrap" : "wrap",
            justifyContent: isMobile ? "space-between" : "center",
            width: isMobile ? "100%" : "auto",
            overflowX: "hidden",
            overflowY: "hidden",
            paddingBottom: isMobile ? "2px" : 0,
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: isMobile ? "none" : "auto",
          }}
        >
          <Link to="/" style={linkStyle("/")}>
            {isMobile ? "الرئيسية" : "🏠 الرئيسية"}
          </Link>

          <Link to="/experiences" style={linkStyle("/experiences")}>
            {isMobile ? "التجارب" : "📄 التجارب"}
          </Link>

          <Link to="/where-to-train" style={linkStyle("/where-to-train")}>
            {isMobile ? "وين أتدرب" : "🎯 وين أتدرب؟"}
          </Link>

          <div
            style={{
              display: "flex",
              gap: isMobile ? "6px" : "10px",
              alignItems: "center",
              flexWrap: "nowrap",
              justifyContent: "center",
              flex: isMobile ? "0 1 auto" : "initial",
            }}
          >
            <button
              type="button"
              onClick={toggleSuggestionBox}
              style={quietActionButtonStyle}
            >
              {isMobile ? "اقتراح" : "اقتراحاتكم"}
            </button>
            <button
              type="button"
              onClick={openAddExperienceModal}
              style={actionButtonStyle}
            >
              {isMobile ? "+ تجربة" : "+ أضف تجربتك"}
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
            width: isNavbarCollapsed ? "min(560px, calc(100vw - 24px))" : "100%",
            background: "var(--app-surface)",
            border: isNavbarCollapsed ? "1px solid var(--app-border)" : "none",
            borderBottom: "1px solid var(--app-border)",
            borderRadius: isNavbarCollapsed ? "18px" : 0,
            padding: "12px 16px",
            boxSizing: "border-box",
            position: isNavbarCollapsed ? "fixed" : "static",
            top: isNavbarCollapsed ? (isMobile ? "12px" : "18px") : "auto",
            left: isNavbarCollapsed ? "50%" : "auto",
            transform: isNavbarCollapsed ? "translateX(-50%)" : "none",
            zIndex: isNavbarCollapsed ? 2600 : "auto",
            boxShadow: isNavbarCollapsed
              ? "0 18px 50px var(--app-shadow)"
              : "none",
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
            margin: isNavbarCollapsed ? 0 : "8px auto 0",
            padding: isNavbarCollapsed ? "9px 14px" : "0 16px",
            textAlign: "center",
            fontSize: "12px",
            color: suggestionMessage.includes("وصلنا")
              ? "var(--app-brand-strong)"
              : "#fecdd3",
            fontFamily: "'Cairo', sans-serif",
            position: isNavbarCollapsed ? "fixed" : "static",
            top: isNavbarCollapsed ? (isMobile ? "12px" : "18px") : "auto",
            left: isNavbarCollapsed ? "50%" : "auto",
            transform: isNavbarCollapsed ? "translateX(-50%)" : "none",
            zIndex: isNavbarCollapsed ? 2650 : "auto",
            width: isNavbarCollapsed ? "min(520px, calc(100vw - 24px))" : "auto",
            boxSizing: "border-box",
            background: isNavbarCollapsed ? "var(--app-surface)" : "transparent",
            border: isNavbarCollapsed ? "1px solid var(--app-border)" : "none",
            borderRadius: isNavbarCollapsed ? "999px" : 0,
            boxShadow: isNavbarCollapsed ? "0 16px 42px var(--app-shadow)" : "none",
          }}
        >
          {suggestionMessage}
        </p>
      )}
    </header>

      {isNavbarCollapsed && !showModal && (
        <div
          className="floating-nav-shell"
          style={{
            position: "fixed",
            right: isMobile ? "12px" : "22px",
            top: floatingNavTop,
            zIndex: 2450,
            direction: "rtl",
            fontFamily: "'Cairo', sans-serif",
          }}
        >
          {floatingMenuOpen && (
            <div
              className="floating-nav-panel"
              style={{
                position: "absolute",
                right: 0,
                top: "calc(100% + 10px)",
                width: isMobile ? "min(270px, calc(100vw - 24px))" : "250px",
                background: "color-mix(in srgb, var(--app-surface) 96%, transparent)",
                color: "var(--app-text)",
                border: "1px solid var(--app-border)",
                borderRadius: "20px",
                boxShadow: "0 22px 58px var(--app-shadow)",
                backdropFilter: "blur(14px)",
                padding: "10px",
                display: "grid",
                gap: "8px",
                maxHeight: `calc(100vh - ${floatingNavTop} - 24px)`,
                overflowY: "auto",
              }}
            >
              <Link to="/" style={floatingLinkStyle("/")}>
                <span>الرئيسية</span>
                <span aria-hidden="true">🏠</span>
              </Link>
              <Link to="/experiences" style={floatingLinkStyle("/experiences")}>
                <span>التجارب</span>
                <span aria-hidden="true">📄</span>
              </Link>
              <Link
                to="/where-to-train"
                style={floatingLinkStyle("/where-to-train")}
              >
                <span>وين أتدرب؟</span>
                <span aria-hidden="true">🎯</span>
              </Link>

              <button
                type="button"
                onClick={toggleSuggestionBox}
                style={floatingActionStyle}
              >
                <span>اقتراحاتكم</span>
                <span aria-hidden="true">✦</span>
              </button>
              <button
                type="button"
                onClick={openAddExperienceModal}
                style={{
                  ...floatingActionStyle,
                  background: "var(--app-brand)",
                  color: "#071315",
                  borderColor: "transparent",
                  boxShadow: "0 10px 24px var(--app-brand-border)",
                }}
              >
                <span>أضف تجربتك</span>
                <span aria-hidden="true">+</span>
              </button>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "10px",
                  padding: "2px 2px 0",
                }}
              >
                <span
                  style={{
                    color: "var(--app-text-soft)",
                    fontSize: "12px",
                    fontWeight: "700",
                  }}
                >
                  المظهر
                </span>
                {themeToggleButton}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setFloatingMenuOpen((open) => !open)}
            aria-expanded={floatingMenuOpen}
            aria-label={floatingMenuOpen ? "إغلاق القائمة" : "فتح القائمة"}
            style={{
              minWidth: isMobile ? "54px" : "62px",
              height: isMobile ? "42px" : "46px",
              borderRadius: "999px",
              border: "1px solid var(--app-brand-border)",
              background: "var(--app-brand)",
              color: "#071315",
              boxShadow:
                "0 16px 36px var(--app-shadow), 0 0 0 4px var(--app-brand-soft)",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "7px",
              padding: isMobile ? "0 13px" : "0 15px",
              fontFamily: "inherit",
              fontWeight: "900",
              fontSize: isMobile ? "12px" : "13px",
            }}
          >
            <span>{floatingMenuOpen ? "إغلاق" : "القائمة"}</span>
            <span
              aria-hidden="true"
              style={{
                fontSize: "20px",
                lineHeight: 1,
              }}
            >
              {floatingMenuOpen ? "×" : "☰"}
            </span>
          </button>
        </div>
      )}

      <style>{`
        @media (max-width: 767px) {
          .navbar-links-row::-webkit-scrollbar {
            display: none;
          }
        }

        @media (prefers-reduced-motion: no-preference) {
          .floating-nav-panel {
            animation: floatingMenuIn 0.18s ease both;
          }
        }

        @keyframes floatingMenuIn {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </>
  );
};

export default Navbar;
