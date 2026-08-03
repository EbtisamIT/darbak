import React, { useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import API_BASE_URL from "../config/api";
import { trackEvent } from "../utils/analytics";

const footerLinkStyle = {
  color: "var(--app-muted)",
  textDecoration: "none",
  borderBottom: "1px solid var(--app-brand-border)",
  paddingBottom: "3px",
};

const contactReasons = [
  "استفسار عام",
  "مشكلة تقنية",
  "اقتراح تطوير",
  "بلاغ عن محتوى",
  "تعاون أو إعلان",
  "أخرى",
];

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid var(--app-border)",
  borderRadius: "13px",
  background: "var(--app-input-bg)",
  color: "var(--app-text)",
  padding: "11px 12px",
  fontFamily: "inherit",
  fontSize: "13px",
  outline: "none",
};

const panelButtonStyle = (active = false) => ({
  border: "1px solid",
  borderColor: active ? "transparent" : "var(--app-brand-border)",
  borderRadius: "999px",
  background: active ? "var(--app-brand)" : "var(--app-input-bg)",
  color: active ? "#071814" : "var(--app-brand)",
  padding: "10px 15px",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: "13px",
  fontWeight: "900",
  whiteSpace: "nowrap",
});

const TELEGRAM_CHANNEL_URL = "https://t.me/darbak_1";

export default function Footer() {
  const [activePanel, setActivePanel] = useState("");
  const [suggestionText, setSuggestionText] = useState("");
  const [suggestionStatus, setSuggestionStatus] = useState("");
  const [sendingSuggestion, setSendingSuggestion] = useState(false);
  const [contactForm, setContactForm] = useState({
    reason: contactReasons[0],
    contact: "",
    message: "",
  });
  const [contactStatus, setContactStatus] = useState("");
  const [sendingContact, setSendingContact] = useState(false);

  const popularSeoLinks = [
    ["تجارب تدريب الرياض", "/experiences/city/riyadh"],
    ["تجارب تدريب علوم الحاسب", "/experiences/major/computer-science"],
    ["تجارب تدريب المحاسبة", "/experiences/major/accounting"],
    ["وين أتدرب بالرياض؟", "/where-to-train/city/riyadh"],
    ["جهات تدريب علوم الحاسب", "/where-to-train/major/computer-science"],
    ["جهات تدريب المحاسبة", "/where-to-train/major/accounting"],
  ];

  const openPanel = (panelName) => {
    setActivePanel((current) => (current === panelName ? "" : panelName));
    if (panelName === "contact") trackEvent("contact_form_opened");
    if (panelName === "suggestion") trackEvent("suggestion_form_opened");
  };

  const trackTelegramClick = (source) => {
    trackEvent("telegram_channel_clicked", {
      metadata: { source },
    });
  };

  const submitSuggestion = async (event) => {
    event.preventDefault();
    const text = suggestionText.trim();

    if (text.length < 3) {
      setSuggestionStatus("اكتب اقتراحًا واضحًا قبل الإرسال.");
      return;
    }

    try {
      setSendingSuggestion(true);
      setSuggestionStatus("");
      await axios.post(`${API_BASE_URL}/api/suggestions`, { text });
      setSuggestionText("");
      setSuggestionStatus("وصلنا اقتراحك، شكرًا لك.");
      trackEvent("suggestion_submitted");
    } catch (err) {
      setSuggestionStatus(err.response?.data?.error || "تعذر إرسال الاقتراح حاليًا.");
    } finally {
      setSendingSuggestion(false);
    }
  };

  const submitContact = async (event) => {
    event.preventDefault();
    const message = contactForm.message.trim();

    if (message.length < 5) {
      setContactStatus("اكتب رسالتك بشكل أوضح قبل الإرسال.");
      return;
    }

    try {
      setSendingContact(true);
      setContactStatus("");
      await axios.post(`${API_BASE_URL}/api/contact`, {
        reason: contactForm.reason,
        contact: contactForm.contact,
        message,
      });
      setContactForm({
        reason: contactReasons[0],
        contact: "",
        message: "",
      });
      setContactStatus("وصلتنا رسالتك، شكرًا لك.");
      trackEvent("contact_form_submitted", {
        metadata: { reason: contactForm.reason },
      });
    } catch (err) {
      setContactStatus(err.response?.data?.error || "تعذر إرسال الرسالة حاليًا.");
    } finally {
      setSendingContact(false);
    }
  };

  return (
    <footer
      style={{
        marginTop: "0px",
        padding: "28px 16px",
        textAlign: "center",
        color: "var(--app-muted)",
        borderTop: "1px solid var(--app-border)",
        backgroundColor: "var(--app-bg)",
        fontFamily: "'Cairo', sans-serif",
      }}
    >
      <section
        aria-label="اقتراحات وتواصل"
        style={{
          width: "min(860px, 100%)",
          margin: "0 auto 22px",
          padding: "16px",
          boxSizing: "border-box",
          borderRadius: "20px",
          border: "1px solid var(--app-border)",
          background:
            "linear-gradient(135deg, var(--app-brand-soft), transparent 62%), var(--app-surface)",
          textAlign: "right",
          direction: "rtl",
          boxShadow: "0 14px 36px var(--app-shadow)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <strong
              style={{
                display: "block",
                color: "var(--app-text)",
                fontSize: "17px",
                marginBottom: "3px",
              }}
            >
              صوتك يطور دربك
            </strong>
            <span style={{ color: "var(--app-text-soft)", fontSize: "13px" }}>
              أرسل اقتراحًا سريعًا أو تابع قناة الفرص والتنبيهات.
            </span>
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <a
              href={TELEGRAM_CHANNEL_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackTelegramClick("footer")}
              style={{ textDecoration: "none" }}
            >
              <span style={panelButtonStyle(true)}>قناة الفرص</span>
            </a>
            <button
              type="button"
              onClick={() => openPanel("suggestion")}
              style={panelButtonStyle(activePanel === "suggestion")}
            >
              اقتراحاتكم
            </button>
            <button
              type="button"
              onClick={() => openPanel("contact")}
              style={panelButtonStyle(activePanel === "contact")}
            >
              تواصل معنا
            </button>
          </div>
        </div>

        {activePanel === "suggestion" && (
          <form
            onSubmit={submitSuggestion}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
              gap: "10px",
              marginTop: "14px",
              alignItems: "end",
            }}
          >
            <label style={{ display: "grid", gap: "7px", color: "var(--app-text-soft)" }}>
              <span style={{ fontSize: "12px", fontWeight: "800" }}>اقتراحك</span>
              <textarea
                value={suggestionText}
                onChange={(event) => setSuggestionText(event.target.value)}
                rows={2}
                maxLength={1000}
                placeholder="اكتب اقتراحك لدربك..."
                style={{ ...inputStyle, resize: "vertical", lineHeight: 1.7 }}
              />
            </label>
            <button type="submit" disabled={sendingSuggestion} style={panelButtonStyle(true)}>
              {sendingSuggestion ? "إرسال..." : "إرسال"}
            </button>
          </form>
        )}

        {activePanel === "contact" && (
          <form
            onSubmit={submitContact}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
              gap: "10px",
              marginTop: "14px",
            }}
          >
            <label style={{ display: "grid", gap: "7px", color: "var(--app-text-soft)" }}>
              <span style={{ fontSize: "12px", fontWeight: "800" }}>سبب التواصل</span>
              <select
                value={contactForm.reason}
                onChange={(event) =>
                  setContactForm((current) => ({
                    ...current,
                    reason: event.target.value,
                  }))
                }
                style={inputStyle}
              >
                {contactReasons.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "grid", gap: "7px", color: "var(--app-text-soft)" }}>
              <span style={{ fontSize: "12px", fontWeight: "800" }}>وسيلة الرد، اختياري</span>
              <input
                value={contactForm.contact}
                onChange={(event) =>
                  setContactForm((current) => ({
                    ...current,
                    contact: event.target.value,
                  }))
                }
                placeholder="بريدك أو رقمك للرد"
                style={inputStyle}
              />
            </label>

            <label
              style={{
                display: "grid",
                gap: "7px",
                color: "var(--app-text-soft)",
                gridColumn: "1 / -1",
              }}
            >
              <span style={{ fontSize: "12px", fontWeight: "800" }}>رسالتك</span>
              <textarea
                value={contactForm.message}
                onChange={(event) =>
                  setContactForm((current) => ({
                    ...current,
                    message: event.target.value,
                  }))
                }
                rows={3}
                maxLength={1800}
                placeholder="اكتب رسالتك هنا..."
                style={{ ...inputStyle, resize: "vertical", lineHeight: 1.7 }}
              />
            </label>

            <div
              style={{
                gridColumn: "1 / -1",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
                flexWrap: "wrap",
              }}
            >
              <span style={{ color: "var(--app-muted)", fontSize: "12px" }}>
                تصل الرسائل إلى info@darbak.space بعد تفعيل خدمة الإرسال.
              </span>
              <button type="submit" disabled={sendingContact} style={panelButtonStyle(true)}>
                {sendingContact ? "إرسال..." : "إرسال الرسالة"}
              </button>
            </div>
          </form>
        )}

        {(suggestionStatus || contactStatus) && (
          <p
            style={{
              margin: "12px 0 0",
              color:
                suggestionStatus.includes("وصلنا") || contactStatus.includes("وصلتنا")
                  ? "var(--app-brand)"
                  : "#fecdd3",
              fontSize: "12.5px",
              fontWeight: "800",
            }}
          >
            {suggestionStatus || contactStatus}
          </p>
        )}
      </section>

      <p style={{ fontSize: "14px", marginBottom: "10px" }}>
        صُمم بواسطة{" "}
        <a
          href="https://www.linkedin.com/in/ebtisam-ali-159513215/"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "var(--app-brand-strong)",
            fontWeight: "600",
            fontSize: "14px",
            textDecoration: "none",
            transition: "0.25s",
          }}
          onMouseEnter={(e) => (e.target.style.opacity = "0.8")}
          onMouseLeave={(e) => (e.target.style.opacity = "1")}
        >
          إبتسام
        </a>{" "}
        💚
      </p>

      <nav
        aria-label="روابط بحث شائعة"
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "10px 14px",
          flexWrap: "wrap",
          marginTop: "14px",
          fontSize: "12.5px",
          lineHeight: 1.8,
        }}
      >
        {popularSeoLinks.map(([label, url]) => (
          <Link key={url} to={url} style={footerLinkStyle}>
            {label}
          </Link>
        ))}
      </nav>

      <nav
        aria-label="روابط قانونية"
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "14px",
          flexWrap: "wrap",
          marginTop: "14px",
          fontSize: "13px",
        }}
      >
        <Link to="/legal#terms" style={footerLinkStyle}>
          سياسة الاستخدام والخصوصية
        </Link>
      </nav>

      <p
        style={{
          marginTop: "18px",
          fontSize: "12px",
          color: "var(--app-muted)",
        }}
      >
        © {new Date().getFullYear()} دربك — جميع الحقوق محفوظة
      </p>
    </footer>
  );
}
