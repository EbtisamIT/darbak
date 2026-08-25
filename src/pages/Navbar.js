import React, { useEffect, useRef, useState } from "react";

import { Link, useLocation } from "react-router-dom";
import {
  ACCOUNT_MODAL_EVENT,
} from "../utils/premiumAccess";
import { trackEvent } from "../utils/analytics";
import logo from "./logo.png";
import AddExperienceModal from "./AddExperienceModal";
import {
  FiActivity,
  FiBriefcase,
  FiChevronDown,
  FiClipboard,
  FiCompass,
  FiFileText,
  FiHome,
  FiMenu,
  FiMessageCircle,
  FiSend,
  FiStar,
  FiUser,
} from "react-icons/fi";

const TELEGRAM_CHANNEL_URL = "https://t.me/darbak_1";

const Navbar = ({ theme = "dark", setTheme }) => {
  const [showModal, setShowModal] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );
  const [isNavbarCollapsed, setIsNavbarCollapsed] = useState(false);
  const [floatingMenuOpen, setFloatingMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const moreMenuRef = useRef(null);

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
    !showModal;

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
    setMoreMenuOpen(false);
    setMobileMoreOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const closeMoreMenu = (event) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target)) {
        setMoreMenuOpen(false);
      }
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setMoreMenuOpen(false);
    };
    document.addEventListener("mousedown", closeMoreMenu);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeMoreMenu);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const isPathActive = (path) =>
    path.includes("?")
      ? `${location.pathname}${location.search}` === path
      : path === "/my-resume"
      ? location.pathname === "/my-resume" || location.pathname.startsWith("/my-resume/")
      : path === "/where-to-train"
      ? location.pathname.startsWith("/where-to-train")
      : location.pathname === path;

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
    color: isPathActive(path) ? "var(--app-brand)" : "var(--app-text-soft)",
    fontWeight: isPathActive(path) ? "bold" : "normal",
    transition: "0.3s",
    whiteSpace: "nowrap",
    flex: isMobile ? "0 1 auto" : "initial",
    padding: isMobile ? "2px 1px 4px" : "10px 2px 8px",
    borderRadius: isMobile ? 0 : "8px",
    fontSize: isMobile ? "10.5px" : "inherit",
    background: "transparent",
    border: "none",
    borderBottom: `${isMobile ? 1 : 2}px solid transparent`,
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

  const premiumCtaButtonStyle = {
    background:
      "linear-gradient(135deg, var(--app-brand), color-mix(in srgb, var(--app-brand) 78%, #ffffff 22%))",
    color: "#071814",
    border: "1px solid transparent",
    borderRadius: "999px",
    padding: isMobile ? "7px 10px" : "9px 14px",
    fontSize: isMobile ? "11px" : "13.5px",
    cursor: "pointer",
    boxShadow: "0 10px 24px var(--app-brand-soft)",
    transition: "0.25s",
    fontFamily: "inherit",
    fontWeight: "900",
    whiteSpace: "nowrap",
  };

  const quietActionButtonStyle = {
    background: moreMenuOpen ? "var(--app-brand-soft)" : "transparent",
    color: moreMenuOpen ? "var(--app-brand)" : "var(--app-text-soft)",
    border: `1px solid ${moreMenuOpen ? "var(--app-brand-border)" : "transparent"}`,
    padding: isMobile ? "2px 1px 4px" : "8px 10px",
    cursor: "pointer",
    transition: "0.3s",
    fontFamily: "inherit",
    fontSize: isMobile ? "10.5px" : "14px",
    fontWeight: "700",
    whiteSpace: "nowrap",
    flex: isMobile ? "0 1 auto" : "initial",
    borderRadius: isMobile ? 0 : "10px",
  };

  const toggleTheme = () => {
    if (setTheme) setTheme(theme === "dark" ? "light" : "dark");
  };

  const openAddExperienceModal = () => {
    setShowModal(true);
    setFloatingMenuOpen(false);
  };

  const openAccountModal = () => {
    window.dispatchEvent(new Event(ACCOUNT_MODAL_EVENT));
    setFloatingMenuOpen(false);
    setMoreMenuOpen(false);
  };

  const openTrainingDiagnosis = () => {
    window.dispatchEvent(new Event("darbak:open-training-diagnosis"));
    setFloatingMenuOpen(false);
    setMoreMenuOpen(false);
  };

  const openPortfolioAnnouncement = () => {
    window.dispatchEvent(new Event("darbak:open-portfolio-announcement"));
    setFloatingMenuOpen(false);
    setMoreMenuOpen(false);
  };

  const trackTelegramClick = (source) => {
    trackEvent("telegram_channel_clicked", {
      metadata: {
        source,
        path: location.pathname,
      },
    });
    setFloatingMenuOpen(false);
    setMoreMenuOpen(false);
  };

  const floatingLinkStyle = (path) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    textDecoration: "none",
    color: isPathActive(path) ? "var(--app-brand)" : "var(--app-text)",
    background:
      isPathActive(path) ? "var(--app-brand-soft)" : "transparent",
    border: "1px solid",
    borderColor:
      isPathActive(path) ? "var(--app-brand-border)" : "var(--app-border)",
    borderRadius: "14px",
    padding: "10px 12px",
    fontSize: "13px",
    fontWeight: "800",
    whiteSpace: "nowrap",
  });

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

  const renderMoreItems = () => (
    <div className="navbar-more-list" role="menu" aria-label="خدمات إضافية">
      <button type="button" role="menuitem" onClick={openTrainingDiagnosis}>
        <FiActivity aria-hidden="true" /> <span>تشخيص التدريب</span>
      </button>
      <Link to="/interviews" role="menuitem" onClick={() => setMoreMenuOpen(false)}>
        <FiMessageCircle aria-hidden="true" /> <span>مقابلات</span>
      </Link>
      <button type="button" role="menuitem" onClick={openPortfolioAnnouncement}>
        <FiBriefcase aria-hidden="true" /> <span>Portfolio</span>
      </button>
      <Link to="/applications" role="menuitem" onClick={() => setMoreMenuOpen(false)}>
        <FiClipboard aria-hidden="true" /> <span>طلباتي</span>
      </Link>
      <button type="button" role="menuitem" onClick={openAccountModal}>
        <FiUser aria-hidden="true" /> <span>حسابي</span>
      </button>
      <a href={TELEGRAM_CHANNEL_URL} target="_blank" rel="noopener noreferrer" onClick={() => trackTelegramClick("navbar_more")}>
        <FiSend aria-hidden="true" /> <span>قناة الفرص</span>
      </a>
    </div>
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
        className="navbar-root"
        style={{
          display: isMobile ? "flex" : "grid",
          flexDirection: isMobile ? "column" : "row",
          gridTemplateColumns: isMobile ? undefined : "auto minmax(0, 1fr) auto",
          justifyContent: isMobile ? "space-between" : undefined,
          alignItems: "center",
          padding: isMobile ? "6px 8px 7px" : "10px 28px",
          minHeight: isMobile ? undefined : "72px",
          boxSizing: "border-box",
          direction: "rtl",
          backgroundColor: "var(--app-surface)",
          borderBottom: "1px solid var(--app-border)",
          gap: isMobile ? "5px" : "30px",
          // The desktop "المزيد" panel is anchored to this navigation row.
          // Keep it visible outside the header while retaining the compact
          // mobile header behavior.
          overflow: isMobile ? "hidden" : "visible",
          transition: "background-color 0.25s ease, border-color 0.25s ease",
        }}
      >
        <div
          className="navbar-brand-area"
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
                height: isMobile ? "42px" : "58px",
                width: isMobile ? "54px" : "66px",
                objectFit: "contain",
              }}
            />
          </Link>
          {themeToggleButton}
          <Link to="/subscribe" style={{ ...premiumCtaButtonStyle, textDecoration: "none" }}>
              دربك+
          </Link>
          {isMobile && (
            <button
              type="button"
              className="navbar-mobile-menu-trigger"
              aria-expanded={floatingMenuOpen}
              onClick={() => setFloatingMenuOpen((open) => !open)}
            >
              <FiMenu aria-hidden="true" /> القائمة
            </button>
          )}
        </div>

        {!isMobile && <div
          className="navbar-links-row"
          style={{
            display: "flex",
            gap: isMobile ? "6px" : "24px",
            alignItems: "center",
            flexWrap: isMobile ? "nowrap" : "wrap",
            justifyContent: isMobile ? "space-between" : "center",
            width: "100%",
            overflowX: isMobile ? "hidden" : "visible",
            overflowY: isMobile ? "hidden" : "visible",
            paddingBottom: isMobile ? "2px" : 0,
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: isMobile ? "none" : "auto",
          }}
        >
          <Link to="/" className="navbar-primary-link" style={linkStyle("/")}>
            <FiHome aria-hidden="true" /> <span>الرئيسية</span>
          </Link>

          <Link to="/where-to-train" className="navbar-primary-link" style={linkStyle("/where-to-train")}>
            <FiCompass aria-hidden="true" /> <span>وين أتدرب؟</span>
          </Link>

          <Link to="/my-resume" className="navbar-primary-link" style={linkStyle("/my-resume")}>
            <FiUser aria-hidden="true" /> <span>سيرتي</span>
          </Link>

          <Link to="/experiences" className="navbar-primary-link" style={linkStyle("/experiences")}>
            <FiStar aria-hidden="true" /> <span>تجارب الطلاب</span>
          </Link>

            <div className="navbar-more-menu" ref={moreMenuRef}>
              <button
                type="button"
                aria-expanded={moreMenuOpen}
                aria-haspopup="menu"
                onClick={() => setMoreMenuOpen((open) => !open)}
                style={quietActionButtonStyle}
              >
                <span>المزيد</span>
              </button>
              {moreMenuOpen && (
                <div className="navbar-more-panel">
                  {renderMoreItems()}
                </div>
              )}
            </div>
        </div>
        }
        {!isMobile && (
          <button
            type="button"
            className="navbar-desktop-add-experience"
            onClick={openAddExperienceModal}
            style={actionButtonStyle}
          >
            + أضف تجربتك
          </button>
        )}
      </nav>
    </header>

      {showModal && (
        <AddExperienceModal
          onAddExperience={(exp) => console.log("تمت الإضافة:", exp)}
          onClose={() => setShowModal(false)}
        />
      )}

      {(isNavbarCollapsed || isMobile) && !showModal && (
        <div
          className="floating-nav-shell"
          style={{
            position: "fixed",
            right: isMobile ? "12px" : "22px",
            top: floatingNavTop,
            zIndex: 2450,
            direction: "rtl",
            fontFamily: "'IBM Plex Sans Arabic', 'Aniq', 'Cairo', sans-serif",
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
              <div className="navbar-mobile-primary-links">
                <Link to="/" style={floatingLinkStyle("/")}><FiHome aria-hidden="true" /><span>الرئيسية</span></Link>
                <Link to="/where-to-train" style={floatingLinkStyle("/where-to-train")}><FiCompass aria-hidden="true" /><span>وين أتدرب؟</span></Link>
                <Link to="/my-resume" style={floatingLinkStyle("/my-resume")}><FiFileText aria-hidden="true" /><span>سيرتي</span></Link>
                <Link to="/experiences" style={floatingLinkStyle("/experiences")}><FiClipboard aria-hidden="true" /><span>تجارب الطلاب</span></Link>
              </div>
              <button type="button" className="navbar-mobile-more-toggle" aria-expanded={mobileMoreOpen} onClick={() => setMobileMoreOpen((open) => !open)}>
                <span>المزيد</span><FiChevronDown aria-hidden="true" />
              </button>
              {mobileMoreOpen && renderMoreItems()}
              <button type="button" onClick={openAddExperienceModal} className="navbar-mobile-add-experience">+ أضف تجربتك</button>
            </div>
          )}

          {!isMobile && <button
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
          </button>}
        </div>
      )}

      <style>{`
        .navbar-root {
          isolation: isolate;
        }
        .navbar-brand-area {
          min-width: max-content;
        }
        .navbar-primary-link:hover {
          color: var(--app-brand) !important;
        }
        .navbar-primary-link {
          display: inline-flex;
          align-items: center;
          gap: 7px;
        }
        .navbar-primary-link svg {
          width: 17px;
          height: 17px;
          stroke-width: 1.9;
        }
        .navbar-desktop-add-experience {
          justify-self: end;
          min-width: max-content;
        }

        .navbar-more-menu {
          position: relative;
        }

        .navbar-more-panel {
          position: absolute;
          top: calc(100% + 10px);
          /* Keep the panel away from "تجاربي" and open it toward the
             empty CTA side of the navbar. */
          left: auto;
          right: 0;
          z-index: 2200;
          width: min(310px, calc(100vw - 48px));
          display: grid;
          gap: 0;
          padding: 10px 12px;
          background: var(--app-surface);
          border: 1px solid var(--app-border);
          border-radius: 18px;
          box-shadow: 0 22px 52px var(--app-shadow);
        }
        .navbar-more-panel::before {
          content: "";
          position: absolute;
          top: -7px;
          right: 22px;
          width: 12px;
          height: 12px;
          background: var(--app-surface);
          border-top: 1px solid var(--app-border);
          border-left: 1px solid var(--app-border);
          transform: rotate(45deg);
        }

        .navbar-more-list {
          display: grid;
          align-content: start;
          padding: 2px;
        }

        .navbar-more-list a,
        .navbar-more-list button {
          width: 100%;
          min-height: 48px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 10px;
          border: 0;
          border-radius: 10px;
          background: transparent;
          color: var(--app-text);
          cursor: pointer;
          font: inherit;
          font-size: 13px;
          font-weight: 700;
          text-align: right;
          text-decoration: none;
        }

        .navbar-more-list svg { color: var(--app-brand); font-size: 16px; }
        .navbar-more-list small { margin-right: auto; color: var(--app-text-muted); font-size: 10px; }
        .navbar-more-list a + a,
        .navbar-more-list button + a,
        .navbar-more-list a + button,
        .navbar-more-list button + button { border-top: 1px solid var(--app-border-soft); }
        .navbar-more-list a:hover,
        .navbar-more-list button:not(:disabled):hover {
          background: var(--app-brand-soft);
          color: var(--app-brand);
        }
        .navbar-more-list button:disabled { cursor: default; opacity: .55; }

        .navbar-mobile-menu-trigger,
        .navbar-mobile-more-toggle,
        .navbar-mobile-add-experience {
          border: 1px solid var(--app-border);
          background: var(--app-input-bg);
          color: var(--app-text);
          border-radius: 10px;
          font: inherit;
          font-weight: 800;
          cursor: pointer;
        }
        .navbar-mobile-menu-trigger { display: inline-flex; align-items: center; gap: 6px; padding: 8px 10px; font-size: 12px; }
        .navbar-mobile-primary-links { display: grid; gap: 6px; }
        .navbar-mobile-primary-links a { justify-content: flex-start; }
        .navbar-mobile-more-toggle { width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 11px 12px; }
        .navbar-mobile-add-experience { width: 100%; padding: 11px 12px; border-color: var(--app-brand-border); color: var(--app-brand); }

        @media (max-width: 767px) {
          .navbar-root { direction: rtl; }
          .floating-nav-shell { left: 12px; right: 12px !important; top: 60px !important; }
          .floating-nav-panel { width: 100% !important; box-sizing: border-box; max-height: calc(100vh - 76px) !important; }
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
