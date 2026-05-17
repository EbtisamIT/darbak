import { Link } from "react-router-dom";

export default function Footer() {
    return (
      <footer
        style={{
          marginTop: "0px",
          padding: "28px 16px",
          textAlign: "center",
          color: "#94a3b8",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          backgroundColor: "#0f1115",
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
              color: "#22c55e", // أخضر جميل
              fontWeight: "600",
              fontSize:"20px",
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
              color: "#9ca3af",
              textDecoration: "none",
              borderBottom: "1px solid rgba(125,219,205,0.35)",
              paddingBottom: "3px",
            }}
          >
            سياسة الاستخدام
          </Link>
          <span style={{ color: "#374151" }}>•</span>
          <Link
            to="/legal#privacy"
            style={{
              color: "#9ca3af",
              textDecoration: "none",
              borderBottom: "1px solid rgba(125,219,205,0.35)",
              paddingBottom: "3px",
            }}
          >
            سياسة الخصوصية
          </Link>
        </nav>
  
        <p
          style={{
            marginTop: "18px",
            fontSize: "12px",
            color: "#6b7280",
          }}
        >
          © {new Date().getFullYear()} دربك — جميع الحقوق محفوظة
        </p>
      </footer>
    );
  }
  
