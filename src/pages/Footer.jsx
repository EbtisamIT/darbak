import { useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import API_BASE_URL from "../config/api";

export default function Footer() {
    const [showSuggestionBox, setShowSuggestionBox] = useState(false);
    const [suggestionText, setSuggestionText] = useState("");
    const [suggestionMessage, setSuggestionMessage] = useState("");
    const [sendingSuggestion, setSendingSuggestion] = useState(false);

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
        <p style={{ fontSize: "14px", marginBottom: "10px" }}>
          صُمم بواسطة{" "}
          <a
            href="https://www.linkedin.com/in/ebtisam-ali-159513215/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "var(--app-brand-strong)",
              fontWeight: "600",
              fontSize:"14px",
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
          <Link
            to="/legal#terms"
            style={{
              color: "var(--app-muted)",
              textDecoration: "none",
              borderBottom: "1px solid var(--app-brand-border)",
              paddingBottom: "3px",
            }}
          >
           سياسة الاستخدام والخصوصية
          </Link>
          <span style={{ color: "var(--app-border)" }}>•</span>
          <Link
            to="/legal#privacy"
            style={{
              color: "var(--app-muted)",
              textDecoration: "none",
              borderBottom: "1px solid var(--app-brand-border)",
              paddingBottom: "3px",
            }}
          >
          </Link>
          <button
            type="button"
            onClick={() => {
              setShowSuggestionBox((prev) => !prev);
              setSuggestionMessage("");
            }}
            style={{
              color: "var(--app-brand-strong)",
              background: "transparent",
              border: "none",
              borderBottom: "1px solid var(--app-brand-border)",
              padding: "0 0 3px",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: "13px",
            }}
          >
            اقتراحاتكم
          </button>
        </nav>

        {showSuggestionBox && (
          <form
            onSubmit={submitSuggestion}
            style={{
              width: "min(100%, 520px)",
              margin: "16px auto 0",
              display: "grid",
              gap: "10px",
            }}
          >
            <textarea
              value={suggestionText}
              onChange={(e) => setSuggestionText(e.target.value)}
              placeholder="اكتب اقتراحك لدربك..."
              rows={3}
              maxLength={1000}
              style={{
                width: "100%",
                boxSizing: "border-box",
                resize: "vertical",
                background: "var(--app-input-bg)",
                color: "var(--app-text)",
                border: "1px solid var(--app-border)",
                borderRadius: "12px",
                padding: "12px",
                fontFamily: "inherit",
                lineHeight: 1.8,
                textAlign: "right",
              }}
            />
            <button
              type="submit"
              disabled={sendingSuggestion}
              style={{
                justifySelf: "center",
                background: "var(--app-brand)",
                color: "#101418",
                border: "none",
                borderRadius: "999px",
                padding: "9px 18px",
                cursor: sendingSuggestion ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                fontWeight: "700",
              }}
            >
              {sendingSuggestion ? "إرسال..." : "إرسال الاقتراح"}
            </button>
          </form>
        )}

        {suggestionMessage && (
          <p
            style={{
              margin: "12px 0 0",
              fontSize: "12px",
              color: suggestionMessage.includes("وصلنا")
                ? "var(--app-brand-strong)"
                : "#fecdd3",
            }}
          >
            {suggestionMessage}
          </p>
        )}
  
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
  
