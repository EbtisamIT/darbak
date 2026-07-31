import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import API_BASE_URL from "../config/api";

const normalizeSpaces = (value = "") => value.toString().replace(/\s+/g, " ").trim();

const getReadableMajor = (experience = {}) =>
  experience.major && experience.major !== "." && experience.major.length > 1
    ? experience.major
    : experience.majorCategory || experience.major || "تخصص غير محدد";

const getOrganizationInitials = (name = "") => {
  const cleanName = normalizeSpaces(name);
  if (!cleanName) return "د";

  const parts = cleanName
    .split(/\s+/)
    .filter((part) => !["شركة", "هيئة", "مؤسسة"].includes(part));

  return (parts[0] || cleanName).slice(0, 2);
};

const getAmbassadorDisplayName = (experience = {}) =>
  normalizeSpaces(experience.ambassadorDisplayName);

const getLinkedInUrl = (url = "") => {
  const cleanUrl = normalizeSpaces(url);
  if (!cleanUrl) return "";

  return cleanUrl.startsWith("http") ? cleanUrl : `https://${cleanUrl}`;
};

const getStrongExperienceLine = (description = "") => {
  const cleanDescription = normalizeSpaces(description);
  if (!cleanDescription) {
    return "ملخص سريع عن تجربة التدريب، بيئة العمل، وآلية التقديم.";
  }

  const sentence = cleanDescription
    .split(/[.!؟\n]/)
    .map((part) => part.trim())
    .find((part) => part.length >= 28);
  const line = sentence || cleanDescription;

  return line.length > 110 ? `${line.slice(0, 107).trim()}...` : line;
};

const getCardTitle = (experience = {}) => {
  const customTitle = normalizeSpaces(experience.featuredAmbassadorCardTitle);
  if (customTitle) return customTitle;

  const ambassadorName = normalizeSpaces(experience.ambassadorDisplayName);
  const organizationName = normalizeSpaces(experience.organizationName);

  if (ambassadorName && organizationName) {
    return `تجربة ${ambassadorName} في ${organizationName}`;
  }

  return organizationName ? `تجربتي في ${organizationName}` : "تجربة سفير دربك";
};

const getCardSummary = (experience = {}) =>
  normalizeSpaces(experience.featuredAmbassadorCardSummary) ||
  getStrongExperienceLine(experience.description);

const getDefaultTags = (experience = {}) =>
  [
    getReadableMajor(experience),
    experience.city,
    experience.hadReward === "yes" ? "مكافأة" : "",
  ]
    .filter(Boolean)
    .slice(0, 3);

const getCardTags = (experience = {}) => {
  const customTags = Array.isArray(experience.featuredAmbassadorCardTags)
    ? experience.featuredAmbassadorCardTags
        .map((tag) => normalizeSpaces(tag))
        .filter(Boolean)
    : [];

  return (customTags.length ? customTags : getDefaultTags(experience)).slice(0, 4);
};

export default function FeaturedAmbassadorsSection({
  title = "سفراء دربك لهذا الأسبوع ⭐",
  subtitle = "تجارب شاركها طلاب سابقون لمساعدة المتدربين.",
  compact = false,
}) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    let isMounted = true;

    axios
      .get(`${API_BASE_URL}/api/experiences/featured-ambassadors`, {
        params: { limit: 3 },
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

  const visibleItems = useMemo(() => items.slice(0, 3), [items]);

  if (visibleItems.length === 0) return null;

  return (
    <section
      className={`featured-ambassadors${compact ? " is-compact" : ""}${
        visibleItems.length > 1 ? " has-multiple" : ""
      }`}
    >
      <div className="featured-ambassadors-head">
        <div>
          <h2>{title}</h2>
        </div>
        <p>{subtitle}</p>
      </div>

      <div className="featured-ambassadors-grid">
        {visibleItems.map((experience, index) => {
          const logoUrl = normalizeSpaces(experience.featuredAmbassadorLogoUrl);
          const tags = getCardTags(experience);
          const ambassadorName = getAmbassadorDisplayName(experience);
          const linkedInUrl = getLinkedInUrl(experience.ambassadorLinkedInUrl);
          const showLinkedInButton = Boolean(ambassadorName && linkedInUrl);

          return (
            <article
              className={`featured-ambassador-card tone-${index % 2 === 0 ? "green" : "violet"}`}
              key={experience._id}
            >
              <div className="featured-card-glow" />
              <div className="featured-card-badge">سفير دربك</div>

              <div className="featured-card-logo" aria-label={experience.organizationName}>
                {logoUrl ? (
                  <img src={logoUrl} alt={`شعار ${experience.organizationName}`} />
                ) : (
                  <span>{getOrganizationInitials(experience.organizationName)}</span>
                )}
              </div>

              <h3>{getCardTitle(experience)}</h3>
              <p className="featured-card-summary">{getCardSummary(experience)}</p>

              {tags.length > 0 && (
                <div className="featured-card-tags">
                  {tags.map((tag) => (
                    <span key={`${experience._id}-${tag}`}>{tag}</span>
                  ))}
                </div>
              )}

              <div className="featured-card-footer">
                {ambassadorName && (
                  <div className="featured-card-ambassador-row">
                    <span className="featured-card-owner">
                      سفير دربك: {ambassadorName}
                    </span>
                    {showLinkedInButton && (
                      <a
                        href={linkedInUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => event.stopPropagation()}
                        className="featured-card-linkedin"
                        aria-label={`فتح LinkedIn الخاص بـ ${ambassadorName}`}
                      >
                        <span aria-hidden="true">in</span>
                        LinkedIn
                      </a>
                    )}
                  </div>
                )}

                <Link className="featured-ambassador-button" to={`/experiences/${experience._id}`}>
                  <span>عرض التجربة</span>
                  <b aria-hidden="true">←</b>
                </Link>
              </div>
            </article>
          );
        })}
      </div>

      <style>{`
        .featured-ambassadors {
          width: min(100%, 1120px);
          margin: ${compact ? "16px auto 22px" : "30px auto 0"};
          padding: ${compact ? "16px" : "20px"};
          box-sizing: border-box;
          direction: rtl;
          text-align: right;
        }

        .featured-ambassadors-head {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 16px;
        }

        .featured-ambassadors-head h2 {
          margin: 0;
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
          gap: 16px;
        }

        .featured-ambassador-card {
          position: relative;
          isolation: isolate;
          display: flex;
          min-height: 390px;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          border: 1px solid rgba(255,255,255,0.13);
          border-radius: 30px;
          padding: 28px 22px 22px;
          text-align: center;
          color: #f8fafc;
          overflow: hidden;
          box-shadow: 0 22px 46px rgba(0,0,0,0.22);
        }

        .featured-ambassador-card.tone-green {
          background:
            radial-gradient(circle at 50% 34%, rgba(125,219,205,0.27), transparent 34%),
            linear-gradient(150deg, #102f2d 0%, #101820 47%, #0d1319 100%);
        }

        .featured-ambassador-card.tone-violet {
          background:
            radial-gradient(circle at 50% 34%, rgba(107,64,188,0.38), transparent 35%),
            linear-gradient(150deg, #2e1c59 0%, #18162c 50%, #11131c 100%);
        }

        .featured-card-glow {
          position: absolute;
          inset: 0;
          z-index: -1;
          background:
            linear-gradient(180deg, rgba(255,255,255,0.05), transparent 42%),
            radial-gradient(circle at 50% 100%, rgba(125,219,205,0.12), transparent 44%);
          pointer-events: none;
        }

        .featured-card-badge {
          position: absolute;
          top: 18px;
          inset-inline-start: 18px;
          border: 1px solid rgba(125,219,205,0.36);
          border-radius: 999px;
          padding: 6px 11px;
          color: #7ddbcd;
          background: rgba(7,16,14,0.42);
          font-size: 11px;
          font-weight: 900;
          backdrop-filter: blur(10px);
        }

        .featured-card-logo {
          width: 132px;
          height: 72px;
          display: grid;
          place-items: center;
          border-radius: 18px;
          background: #ffffff;
          box-shadow: 0 15px 32px rgba(0,0,0,0.22);
          overflow: hidden;
        }

        .featured-card-logo img {
          width: 84%;
          height: 74%;
          object-fit: contain;
          display: block;
        }

        .featured-card-logo span {
          color: #163b39;
          font-size: 30px;
          font-weight: 1000;
          letter-spacing: 0;
        }

        .featured-ambassador-card h3 {
          margin: 4px 0 0;
          color: #ffffff;
          font-size: 26px;
          line-height: 1.35;
          font-weight: 1000;
          max-width: 95%;
        }

        .featured-card-summary {
          margin: -4px 0 0;
          min-height: 58px;
          color: rgba(248,250,252,0.72);
          font-size: 14px;
          line-height: 1.8;
          max-width: 290px;
        }

        .featured-card-tags {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 8px;
          min-height: 38px;
        }

        .featured-card-tags span {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 32px;
          border: 1px solid rgba(255,255,255,0.24);
          border-radius: 999px;
          padding: 5px 12px;
          color: rgba(255,255,255,0.9);
          background: rgba(255,255,255,0.045);
          font-size: 12px;
          font-weight: 900;
          white-space: nowrap;
        }

        .featured-card-footer {
          width: 100%;
          display: grid;
          gap: 12px;
          margin-top: auto;
        }

        .featured-card-ambassador-row {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-wrap: wrap;
          gap: 8px;
          min-height: 34px;
        }

        .featured-card-owner {
          color: #7ddbcd;
          font-size: 12px;
          font-weight: 900;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 100%;
        }

        .featured-card-linkedin {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          min-height: 30px;
          border-radius: 999px;
          border: 1px solid rgba(125,219,205,0.32);
          padding: 5px 11px;
          background: rgba(125,219,205,0.13);
          color: #dffbf7;
          font-size: 11px;
          font-weight: 1000;
          text-decoration: none;
          transition: transform 0.2s ease, background 0.2s ease;
        }

        .featured-card-linkedin:hover {
          transform: translateY(-1px);
          background: rgba(125,219,205,0.2);
        }

        .featured-card-linkedin span {
          display: inline-grid;
          place-items: center;
          width: 18px;
          height: 18px;
          border-radius: 5px;
          background: #0a66c2;
          color: #fff;
          font-family: Arial, sans-serif;
          font-size: 10px;
          font-weight: 900;
          line-height: 1;
        }

        .featured-ambassador-button {
          display: inline-flex;
          width: 100%;
          min-height: 52px;
          align-items: center;
          justify-content: center;
          gap: 10px;
          border-radius: 999px;
          border: none;
          color: #111827;
          background: #ffffff;
          text-decoration: none;
          font-size: 14px;
          font-weight: 1000;
          box-shadow: 0 14px 28px rgba(0,0,0,0.18);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .featured-ambassador-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 18px 34px rgba(0,0,0,0.24);
        }

        .featured-ambassador-button b {
          color: #1f2937;
          font-size: 18px;
          line-height: 1;
        }

        @media (max-width: 980px) {
          .featured-ambassadors-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .featured-ambassadors {
            width: 100%;
            max-width: 100%;
            padding: 14px 0 16px;
            overflow: hidden;
          }

          .featured-ambassadors-head {
            display: grid;
            gap: 7px;
            text-align: center;
            padding: 0 14px;
          }

          .featured-ambassadors-head p {
            max-width: none;
            font-size: 13px;
          }

          .featured-ambassadors-grid {
            display: flex;
            gap: 14px;
            overflow-x: auto;
            overscroll-behavior-inline: contain;
            scroll-snap-type: x mandatory;
            -webkit-overflow-scrolling: touch;
            padding: 2px 16px 14px;
            scrollbar-width: none;
          }

          .featured-ambassadors-grid::-webkit-scrollbar {
            display: none;
          }

          .featured-ambassador-card {
            flex: 0 0 min(84vw, 330px);
            min-height: 380px;
            padding: 26px 18px 20px;
            scroll-snap-align: center;
          }

          .featured-card-logo {
            width: 122px;
            height: 68px;
          }

          .featured-ambassador-card h3 {
            font-size: 23px;
          }

          .featured-card-summary {
            min-height: 54px;
            font-size: 13px;
          }

          .featured-card-tags span {
            min-height: 30px;
            padding-inline: 10px;
            font-size: 11px;
          }

          .featured-ambassadors.has-multiple::after {
            content: "اسحب/ي لعرض المزيد";
            display: block;
            width: fit-content;
            margin: -4px auto 0;
            color: var(--app-muted-2);
            font-size: 11px;
            font-weight: 800;
            opacity: 0.85;
          }
        }
      `}</style>
    </section>
  );
}
