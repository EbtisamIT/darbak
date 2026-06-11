import { Link } from "react-router-dom";

export default function Footer() {
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
  
