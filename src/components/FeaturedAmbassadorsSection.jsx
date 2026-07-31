import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import API_BASE_URL from "../config/api";

const normalizeSpaces = (value = "") => value.toString().replace(/\s+/g, " ").trim();

const getReadableMajor = (experience = {}) =>
  experience.major && experience.major !== "." && experience.major.length > 1
    ? experience.major
    : experience.majorCategory || experience.major || "تخصص غير محدد";

const getLinkedInHandle = (url = "") => {
  if (!url) return "حساب LinkedIn";

  try {
    const parsedUrl = new URL(url.startsWith("http") ? url : `https://${url}`);
    const parts = parsedUrl.pathname.split("/").filter(Boolean);
    const handle = parts[0] === "in" ? parts[1] : parts[0];
    return handle ? `LinkedIn: ${handle}` : "حساب LinkedIn";
  } catch {
    return "حساب LinkedIn";
  }
};

const getStrongExperienceLine = (description = "") => {
  const cleanDescription = normalizeSpaces(description);
  if (!cleanDescription) return "تجربة مختارة تساعد المتدربين على فهم الصورة قبل التقديم.";

  const sentence = cleanDescription
    .split(/[.!؟\n]/)
    .map((part) => part.trim())
    .find((part) => part.length >= 28);
  const line = sentence || cleanDescription;

  return line.length > 115 ? `${line.slice(0, 112).trim()}...` : line;
};

export default function FeaturedAmbassadorsSection({
  title = "سفراء دربك لهذا الأسبوع ⭐",
  subtitle = "تجارب مميزة شاركها طلاب سابقون لمساعدة المتدربين.",
  compact = false,
}) {
  const [items, setItems] = useState([]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let isMounted = true;

    axios
      .get(`${API_BASE_URL}/api/experiences/featured-ambassadors`, {
        params: { limit: 9 },
      })
      .then(({ data }) => {
        if (!isMounted) return;
        setItems(Array.isArray(data?.data) ? data.data : []);
      })
      .catch(() => {
        if (isMounted) setItems([]);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const visibleItems = useMemo(
    () => (showAll ? items : items.slice(0, 3)),
    [items, showAll]
  );

  if (visibleItems.length === 0) return null;

  return (
    <section className={`featured-ambassadors${compact ? " is-compact" : ""}`}>
      <div className="featured-ambassadors-head">
        <div>
          <span>⭐ من تجارب الأسبوع</span>
          <h2>{title}</h2>
        </div>
        <p>{subtitle}</p>
      </div>

      <div className="featured-ambassadors-grid">
        {visibleItems.map((experience) => (
          <article className="featured-ambassador-card" key={experience._id}>
            <div className="featured-ambassador-topline">
              <span>سفير دربك</span>
              <a
                href={experience.ambassadorLinkedInUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => event.stopPropagation()}
              >
                {getLinkedInHandle(experience.ambassadorLinkedInUrl)}
              </a>
            </div>

            <h3>{experience.organizationName}</h3>
            <p className="featured-ambassador-meta">
              {[getReadableMajor(experience), experience.city].filter(Boolean).join(" - ")}
            </p>
            <blockquote>{getStrongExperienceLine(experience.description)}</blockquote>

            <Link className="featured-ambassador-button" to={`/experiences/${experience._id}`}>
              اقرأ التجربة
            </Link>
          </article>
        ))}
      </div>

      {items.length > 3 && (
        <button
          className="featured-ambassadors-all"
          type="button"
          onClick={() => setShowAll((value) => !value)}
        >
          {showAll ? "إخفاء التجارب الإضافية" : "عرض المزيد من سفراء دربك"}
        </button>
      )}

      <style>{`
        .featured-ambassadors {
          width: min(100%, 1120px);
          margin: ${compact ? "16px auto 22px" : "28px auto 0"};
          padding: ${compact ? "16px" : "20px"};
          box-sizing: border-box;
          border-block: 1px solid var(--app-border);
          background: linear-gradient(90deg, transparent, var(--app-surface-2), transparent);
          direction: rtl;
          text-align: right;
        }

        .featured-ambassadors-head {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 14px;
        }

        .featured-ambassadors-head span {
          color: var(--app-brand);
          font-size: 13px;
          font-weight: 900;
        }

        .featured-ambassadors-head h2 {
          margin: 4px 0 0;
          color: var(--app-text);
          font-size: ${compact ? "22px" : "26px"};
          line-height: 1.35;
        }

        .featured-ambassadors-head p {
          margin: 0;
          color: var(--app-text-soft);
          font-size: 14px;
          line-height: 1.8;
          max-width: 390px;
        }

        .featured-ambassadors-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .featured-ambassador-card {
          display: flex;
          min-height: 205px;
          flex-direction: column;
          gap: 9px;
          border: 1px solid var(--app-border-soft);
          border-radius: 16px;
          padding: 13px;
          background: var(--app-card);
          box-shadow: 0 10px 24px rgba(0,0,0,0.08);
        }

        .featured-ambassador-topline {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }

        .featured-ambassador-topline span {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          padding: 5px 8px;
          color: #07100e;
          background: var(--app-brand);
          font-size: 11px;
          font-weight: 900;
          white-space: nowrap;
        }

        .featured-ambassador-topline a {
          color: var(--app-brand-strong);
          font-size: 11px;
          font-weight: 800;
          text-decoration: none;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .featured-ambassador-card h3 {
          margin: 3px 0 0;
          color: var(--app-brand);
          font-size: 17px;
          line-height: 1.45;
          min-height: 48px;
        }

        .featured-ambassador-meta {
          margin: 0;
          color: var(--app-muted-2);
          font-size: 12px;
          line-height: 1.6;
          font-weight: 800;
        }

        .featured-ambassador-card blockquote {
          flex: 1;
          margin: 0;
          color: var(--app-text-soft);
          font-size: 13px;
          line-height: 1.85;
        }

        .featured-ambassador-button,
        .featured-ambassadors-all {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          border: 1px solid var(--app-brand-border);
          color: var(--app-brand);
          background: var(--app-brand-soft);
          text-decoration: none;
          font-weight: 900;
        }

        .featured-ambassador-button {
          width: 100%;
          padding: 9px 12px;
          font-size: 12px;
        }

        .featured-ambassadors-all {
          width: fit-content;
          margin: 16px auto 0;
          padding: 10px 16px;
          font-size: 13px;
          cursor: pointer;
          font-family: inherit;
        }

        @media (max-width: 980px) {
          .featured-ambassadors-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .featured-ambassadors {
            width: min(100%, 390px);
            padding: 13px 10px;
          }

          .featured-ambassadors-head {
            display: grid;
            gap: 7px;
            text-align: center;
          }

          .featured-ambassadors-head p {
            max-width: none;
          }

          .featured-ambassadors-grid {
            grid-template-columns: 1fr;
          }

          .featured-ambassador-card {
            min-height: auto;
            padding: 12px;
          }

          .featured-ambassador-card h3 {
            min-height: auto;
          }
        }
      `}</style>
    </section>
  );
}
