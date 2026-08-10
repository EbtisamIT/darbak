import React, { useEffect, useMemo, useState } from "react";
import API_BASE_URL from "../config/api";
import AnimatedCount from "../components/AnimatedCount";

const pageFont = "'Aniq', 'Cairo', sans-serif";

const partnerEmailHref = `mailto:info@darbak.space?subject=${encodeURIComponent(
  "انضمام كشريك إطلاق في دربك"
)}&body=${encodeURIComponent(
  "مرحبًا دربك،\nنرغب بتجربة خدمة دربك لإدارة ونشر فرص التدريب.\n\nاسم الجهة:\nاسم المسؤول:\nالبريد:\nنوع برنامج التدريب:\nالمدينة:\nعدد المقاعد المتوقع:\n"
)}`;

const currentServices = [
  {
    title: "صفحة تقديم خاصة",
    text: "رابط مستقل لبرنامج التدريب يمكن مشاركته مع الطلاب بسهولة.",
  },
  {
    title: "وصول لطلاب مهتمين",
    text: "تعرض الفرصة داخل دربك لطلاب يبحثون فعليًا عن فرص تدريب مناسبة.",
  },
  {
    title: "طلبات مرتبطة بالملف المهني",
    text: "مراجعة بيانات الطالب، سيرته، مهاراته، مشاريعه وروابطه في مكان واحد.",
  },
  {
    title: "أسئلة إضافية للبرنامج",
    text: "إضافة أسئلة مخصصة تساعدكم على فرز المتقدمين حسب احتياج البرنامج.",
  },
  {
    title: "موافقة مشاركة البيانات",
    text: "قبل التقديم يوافق الطالب بوضوح على مشاركة ملفه المهني مع الجهة.",
  },
  {
    title: "متابعة الطلبات عبر دربك",
    text: "إدارة الطلبات الحالية من لوحة دربك وتحديث حالة الطالب عند الحاجة.",
  },
];

const PartnersPage = () => {
  const [stats, setStats] = useState({
    experiencesCount: null,
    organizationsCount: null,
    currentProgramsCount: null,
    studentsAppliedCount: null,
  });

  useEffect(() => {
    document.title = "برنامج شركاء الإطلاق | دربك";

    const fetchStats = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/home-stats`);
        const data = await response.json();
        setStats({
          experiencesCount:
            typeof data.experiencesCount === "number"
              ? data.experiencesCount
              : null,
          organizationsCount:
            typeof data.organizationsCount === "number"
              ? data.organizationsCount
              : null,
          currentProgramsCount:
            typeof data.currentProgramsCount === "number"
              ? data.currentProgramsCount
              : null,
          studentsAppliedCount:
            typeof data.studentsAppliedCount === "number"
              ? data.studentsAppliedCount
              : null,
        });
      } catch (error) {
        console.error("تعذر جلب أرقام دربك لصفحة الشركاء:", error);
      }
    };

    fetchStats();
  }, []);

  const statItems = useMemo(
    () => [
      {
        value: stats.experiencesCount,
        label: "تجربة منشورة",
      },
      {
        value: stats.organizationsCount,
        label: "جهة تدريب",
      },
      {
        value: stats.currentProgramsCount,
        label: "برنامج وفرصة حالية",
      },
      {
        value: stats.studentsAppliedCount,
        label: "تقديم عبر دربك",
      },
    ],
    [stats]
  );

  return (
    <main className="partners-page" dir="rtl">
      <section className="partners-hero">
        <div className="partners-hero-copy">
          <span className="partners-badge">برنامج شركاء الإطلاق</span>
          <h1>وصل فرصتك للطلاب المناسبين، واستقبل طلباتهم من مكان واحد.</h1>
          <p>
            دربك يساعد الجهات على نشر برامج التدريب والوصول إلى طلاب يبحثون
            فعلًا عن فرص، مع صفحة تقديم خاصة واستقبال الطلبات عبر الملفات
            المهنية للطلاب.
          </p>
          <div className="partners-actions">
            <a href={partnerEmailHref} className="partners-primary-cta">
              جرّب مع دربك
            </a>
            <span>تجربة محدودة دون رسوم خلال مرحلة الإطلاق.</span>
          </div>
        </div>

        <aside className="partners-launch-card" aria-label="برنامج شركاء الإطلاق">
          <strong>برنامج شركاء الإطلاق</strong>
          <p>
            نفتح حاليًا عددًا محدودًا من المقاعد للجهات الراغبة بتجربة خدمة
            دربك لإدارة ونشر فرص التدريب دون رسوم خلال مرحلة الإطلاق.
          </p>
        </aside>
      </section>

      <section className="partners-stats" aria-label="أرقام دربك الحالية">
        {statItems.map((item) => (
          <div key={item.label} className="partners-stat">
            <strong>
              {typeof item.value === "number" ? (
                <AnimatedCount value={item.value} prefix="+" />
              ) : (
                "..."
              )}
            </strong>
            <span />
            <p>{item.label}</p>
          </div>
        ))}
      </section>

      <section className="partners-section">
        <div className="partners-section-heading">
          <span>الخدمات الحالية</span>
          <h2>وش تحصل عليه الجهة اليوم؟</h2>
        </div>
        <div className="partners-services">
          {currentServices.map((service) => (
            <article key={service.title} className="partners-service-card">
              <h3>{service.title}</h3>
              <p>{service.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="partners-growth">
        <div>
          <span>نعمل حاليًا</span>
          <h2>ودربك يكبر معكم</h2>
        </div>
        <p>
          نعمل حاليًا على لوحة خاصة للجهات تشمل متابعة المتقدمين، تحديث حالات
          الطلبات، التواصل مع المرشحين، وتحليلات أكثر تفصيلًا.
        </p>
      </section>

      <section className="partners-final-cta">
        <h2>هل لديكم برنامج تدريب قادم؟</h2>
        <p>خلونا نجهز لكم صفحة التقديم ونوصلها لطلاب دربك.</p>
        <a href={partnerEmailHref}>انضم كشريك إطلاق</a>
        <small>
          تتوفر التجربة المجانية لعدد محدود من الجهات خلال مرحلة الإطلاق.
        </small>
      </section>

      <style>{`
        .partners-page {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, var(--app-brand-soft), transparent 34%),
            var(--app-bg);
          color: var(--app-text);
          font-family: ${pageFont};
          padding: 34px 18px 56px;
          box-sizing: border-box;
        }

        .partners-hero,
        .partners-stats,
        .partners-section,
        .partners-growth,
        .partners-final-cta {
          width: min(1080px, 100%);
          margin-inline: auto;
        }

        .partners-hero {
          display: grid;
          grid-template-columns: minmax(0, 1.4fr) minmax(280px, 0.6fr);
          gap: 20px;
          align-items: stretch;
          padding: 28px 0 18px;
        }

        .partners-hero-copy,
        .partners-launch-card,
        .partners-growth,
        .partners-final-cta {
          border: 1px solid var(--app-border);
          background: color-mix(in srgb, var(--app-surface) 94%, transparent);
          box-shadow: 0 18px 46px var(--app-shadow);
          border-radius: 24px;
        }

        .partners-hero-copy {
          padding: clamp(24px, 4vw, 42px);
        }

        .partners-badge,
        .partners-section-heading span,
        .partners-growth span {
          display: inline-flex;
          align-items: center;
          width: fit-content;
          border: 1px solid var(--app-brand-border);
          background: var(--app-brand-soft);
          color: var(--app-brand);
          border-radius: 999px;
          padding: 7px 14px;
          font-size: 13px;
          font-weight: 900;
        }

        .partners-hero h1 {
          margin: 18px 0 14px;
          font-size: clamp(32px, 5vw, 58px);
          line-height: 1.25;
          letter-spacing: 0;
          color: var(--app-text);
        }

        .partners-hero p,
        .partners-growth p,
        .partners-final-cta p {
          color: var(--app-text-soft);
          line-height: 1.9;
          font-size: 17px;
          margin: 0;
        }

        .partners-actions {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 24px;
        }

        .partners-primary-cta,
        .partners-final-cta a {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 46px;
          padding: 0 24px;
          border-radius: 14px;
          background: var(--app-brand);
          color: #071315;
          text-decoration: none;
          font-weight: 900;
          box-shadow: 0 12px 28px var(--app-brand-soft);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .partners-primary-cta:hover,
        .partners-primary-cta:focus-visible,
        .partners-final-cta a:hover,
        .partners-final-cta a:focus-visible {
          transform: translateY(-2px);
          box-shadow: 0 16px 34px var(--app-brand-border);
          outline: none;
        }

        .partners-actions span {
          color: var(--app-muted);
          font-size: 13px;
          font-weight: 800;
        }

        .partners-launch-card {
          padding: 24px;
          display: grid;
          align-content: center;
          gap: 10px;
        }

        .partners-launch-card strong {
          color: var(--app-brand);
          font-size: 22px;
        }

        .partners-launch-card p {
          color: var(--app-text-soft);
          line-height: 1.85;
          margin: 0;
        }

        .partners-stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 18px;
          padding: 26px 0 34px;
        }

        .partners-stat {
          text-align: center;
          padding: 8px 4px;
        }

        .partners-stat strong {
          display: block;
          color: var(--app-brand-strong);
          font-size: clamp(34px, 5vw, 52px);
          line-height: 1;
          font-weight: 900;
          margin-bottom: 14px;
        }

        .partners-stat span {
          display: block;
          width: 44px;
          height: 2px;
          margin: 0 auto 11px;
          border-radius: 999px;
          background: linear-gradient(90deg, transparent, var(--app-brand), transparent);
          opacity: 0.75;
        }

        .partners-stat p {
          margin: 0;
          color: var(--app-text-soft);
          font-size: 14px;
          font-weight: 900;
        }

        .partners-section {
          padding: 20px 0 0;
        }

        .partners-section-heading {
          text-align: center;
          display: grid;
          justify-items: center;
          gap: 10px;
          margin-bottom: 18px;
        }

        .partners-section-heading h2,
        .partners-growth h2,
        .partners-final-cta h2 {
          margin: 0;
          color: var(--app-text);
          font-size: clamp(24px, 4vw, 36px);
          line-height: 1.35;
        }

        .partners-services {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        .partners-service-card {
          border: 1px solid var(--app-border);
          background: var(--app-surface);
          border-radius: 18px;
          padding: 18px;
          min-height: 138px;
          box-shadow: 0 10px 28px var(--app-shadow);
        }

        .partners-service-card h3 {
          margin: 0 0 9px;
          color: var(--app-brand);
          font-size: 18px;
        }

        .partners-service-card p {
          margin: 0;
          color: var(--app-text-soft);
          line-height: 1.75;
          font-size: 14px;
        }

        .partners-growth {
          margin-top: 28px;
          padding: 24px;
          display: grid;
          grid-template-columns: minmax(210px, 0.35fr) minmax(0, 0.65fr);
          gap: 18px;
          align-items: center;
        }

        .partners-growth div {
          display: grid;
          gap: 10px;
        }

        .partners-final-cta {
          margin-top: 28px;
          text-align: center;
          padding: 30px 18px;
          display: grid;
          justify-items: center;
          gap: 12px;
        }

        .partners-final-cta small {
          color: var(--app-muted);
          font-size: 12.5px;
          line-height: 1.7;
        }

        @media (max-width: 820px) {
          .partners-page {
            padding: 18px 12px 42px;
          }

          .partners-hero {
            grid-template-columns: 1fr;
            padding-top: 12px;
          }

          .partners-hero-copy,
          .partners-launch-card,
          .partners-growth,
          .partners-final-cta {
            border-radius: 20px;
          }

          .partners-hero-copy {
            padding: 24px 18px;
          }

          .partners-hero p,
          .partners-growth p,
          .partners-final-cta p {
            font-size: 15px;
            line-height: 1.85;
          }

          .partners-actions {
            display: grid;
          }

          .partners-primary-cta,
          .partners-final-cta a {
            width: 100%;
            box-sizing: border-box;
          }

          .partners-stats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 16px 8px;
            padding: 18px 0 24px;
          }

          .partners-stat strong {
            font-size: 32px;
          }

          .partners-services {
            grid-template-columns: 1fr;
          }

          .partners-service-card {
            min-height: 0;
          }

          .partners-growth {
            grid-template-columns: 1fr;
            padding: 22px 18px;
          }
        }
      `}</style>
    </main>
  );
};

export default PartnersPage;
