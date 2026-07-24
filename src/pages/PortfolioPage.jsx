import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import API_BASE_URL from "../config/api";
import { getVisitorId, trackEvent } from "../utils/analytics";
import logo from "./logo.png";

const getDeviceType = () => {
  if (typeof window === "undefined") return "unknown";
  if (window.innerWidth < 768) return "mobile";
  if (window.innerWidth < 1024) return "tablet";
  return "desktop";
};

const initialsFromName = (name = "") => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
};

const ActionLink = ({ href, className = "", children, disabled = false }) => {
  if (!href || disabled) {
    return (
      <span className={`portfolio-action is-disabled ${className}`}>
        {children}
      </span>
    );
  }

  return (
    <a
      className={`portfolio-action ${className}`}
      href={href}
      target={href.startsWith("mailto:") ? undefined : "_blank"}
      rel={href.startsWith("mailto:") ? undefined : "noreferrer"}
      onClick={() =>
        trackEvent("portfolio_action_clicked", {
          metadata: { action: className || "portfolio_action" },
        })
      }
    >
      {children}
    </a>
  );
};

const formatDate = (value = "") => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("ar-SA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
};

export default function PortfolioPage() {
  const { slug = "" } = useParams();
  const [portfolio, setPortfolio] = useState(null);
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    const fetchPortfolio = async () => {
      try {
        setStatus("loading");
        setMessage("");
        const { data } = await axios.get(
          `${API_BASE_URL}/api/portfolios/${encodeURIComponent(slug)}`,
          {
            params: {
              visitorId: getVisitorId(),
              deviceType: getDeviceType(),
            },
          }
        );

        if (!isMounted) return;
        setPortfolio(data.portfolio);
        setStatus("ready");
      } catch (err) {
        if (!isMounted) return;

        if (err.response?.status === 402) {
          setPortfolio(err.response.data?.portfolio || null);
          setMessage(
            err.response.data?.error ||
              "ملف الأعمال محفوظ، لكنه يحتاج تفعيل دربك+ حتى يكون ظاهرًا للعامة."
          );
          setStatus("inactive");
          return;
        }

        setMessage("لم يتم العثور على ملف الأعمال المطلوب.");
        setStatus("error");
      }
    };

    fetchPortfolio();

    return () => {
      isMounted = false;
    };
  }, [slug]);

  const targetsText = useMemo(() => {
    const targets = portfolio?.targetOrganizations || [];
    return targets.length ? targets.join(" | ") : "جاهز لاكتشاف فرص تدريب مناسبة";
  }, [portfolio]);

  const mailHref = portfolio?.email ? `mailto:${portfolio.email}` : "";
  const avatarSrc = portfolio?.avatarAssetUrl || portfolio?.avatarUrl || "";
  const cvHref = portfolio?.cvAssetUrl || portfolio?.cvUrl || "";

  const sharePortfolio = async () => {
    const shareUrl =
      typeof window !== "undefined"
        ? window.location.href
        : `https://darbak.space/p/${slug}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `ملف أعمال ${portfolio.fullName}`,
          text: "ملف أعمال رقمي من دربك",
          url: shareUrl,
        });
        return;
      }

      await navigator.clipboard.writeText(shareUrl);
      setMessage("تم نسخ رابط ملف الأعمال.");
    } catch {
      setMessage("انسخ الرابط من المتصفح إذا لم تظهر المشاركة.");
    }
  };

  if (status === "loading") {
    return (
      <main className="portfolio-page" dir="rtl">
        <section className="portfolio-state-card">
          <span>دربك Portfolio</span>
          <h1>جاري تجهيز ملف الأعمال...</h1>
        </section>
      </main>
    );
  }

  if (status === "inactive" || status === "error") {
    return (
      <main className="portfolio-page" dir="rtl">
        <section className="portfolio-state-card">
          <img src={logo} alt="دربك" />
          <span>ملف أعمال دربك</span>
          <h1>
            {status === "inactive"
              ? "هذا الملف غير مفعل للعامة حاليًا"
              : "الرابط غير موجود"}
          </h1>
          <p>{message}</p>
          <Link to="/" className="portfolio-state-link">
            العودة إلى منصة دربك
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="portfolio-page" dir="rtl">
      <section className="portfolio-shell">
        <aside className="portfolio-identity-card">
          <div className="portfolio-card-head">
            <img src={logo} alt="دربك" />
            <span>Portfolio 2026</span>
          </div>

          <div className="portfolio-avatar">
            {avatarSrc ? (
              <img src={avatarSrc} alt={portfolio.fullName} />
            ) : (
              <strong>{initialsFromName(portfolio.fullName) || "د"}</strong>
            )}
          </div>

          <div className="portfolio-student-info">
            <h1>{portfolio.fullName}</h1>
            <p>{portfolio.major}</p>
            <small>
              {[portfolio.university, portfolio.city].filter(Boolean).join(" - ")}
            </small>
          </div>

          <div className="portfolio-card-section">
            <span>حالة الجاهزية</span>
            <strong>{portfolio.readinessStatus}</strong>
          </div>

          <div className="portfolio-card-section">
            <span>البيانات الأكاديمية</span>
            <p>
              {[portfolio.degreeLevel, portfolio.dateOfBirth && `الميلاد: ${formatDate(portfolio.dateOfBirth)}`]
                .filter(Boolean)
                .join(" | ") || "لم تكتمل بعد"}
            </p>
          </div>

          <div className="portfolio-card-section">
            <span>الوجهات المستهدفة</span>
            <p>{targetsText}</p>
          </div>

          <div className="portfolio-card-foot">
            <span>darbak.space</span>
            <small>{portfolio.viewCount || 0} مشاهدة</small>
          </div>
        </aside>

        <section className="portfolio-content">
          <div className="portfolio-hero-copy">
            <span>ملف أعمال رقمي من دربك</span>
            <h2>بطاقة مهنية مختصرة تساعدك تتعرف على الطالب بسرعة.</h2>
            <p>
              هذا الملف يجمع السيرة الذاتية، نبذة الطالب، مهاراته ومشاريعه في
              صفحة واحدة مصممة للمراجعة السريعة من مسؤولي التدريب والتوظيف.
            </p>
          </div>

          <div className="portfolio-actions">
            <ActionLink href={cvHref} className="is-primary">
              تحميل السيرة الذاتية PDF
            </ActionLink>
            <ActionLink href={portfolio.linkedinUrl}>بروفايل LinkedIn</ActionLink>
            <ActionLink href={mailHref}>تواصل عبر البريد</ActionLink>
            <button
              type="button"
              className="portfolio-action"
              onClick={sharePortfolio}
            >
              مشاركة البطاقة
            </button>
          </div>

          {message && status === "ready" && (
            <p className="portfolio-share-message">{message}</p>
          )}

          <section className="portfolio-section">
            <h3>نبذة شخصية</h3>
            <p>
              {portfolio.bio ||
                "لم يضف الطالب نبذة شخصية بعد، لكن بياناته الأساسية متاحة في البطاقة."}
            </p>
          </section>

          {portfolio.skills?.length > 0 && (
            <section className="portfolio-section">
              <h3>المهارات</h3>
              <div className="portfolio-skills">
                {portfolio.skills.map((skill) => (
                  <span key={skill}>{skill}</span>
                ))}
              </div>
            </section>
          )}

          {portfolio.certifications?.length > 0 && (
            <section className="portfolio-section">
              <h3>الشهادات والدورات التدريبية</h3>
              <div className="portfolio-certifications">
                {portfolio.certifications.map((certification, index) => (
                  <article key={`${certification.title}-${index}`}>
                    <strong>{certification.title || "شهادة تدريبية"}</strong>
                    <span>
                      {[certification.provider, certification.year]
                        .filter(Boolean)
                        .join(" - ")}
                    </span>
                  </article>
                ))}
              </div>
            </section>
          )}

          <section className="portfolio-section">
            <h3>المشاريع والإنتاج العلمي</h3>
            {portfolio.projects?.length > 0 ? (
              <div className="portfolio-projects">
                {portfolio.projects.map((project, index) => (
                  <article className="portfolio-project-card" key={`${project.title}-${index}`}>
                    <h4>{project.title || `مشروع ${index + 1}`}</h4>
                    <p>{project.description || "لم يضف وصفًا لهذا المشروع."}</p>
                    {project.url && (
                      <a href={project.url} target="_blank" rel="noreferrer">
                        عرض المشروع
                      </a>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <p>لم تتم إضافة مشاريع بعد.</p>
            )}
          </section>
        </section>
      </section>
    </main>
  );
}
