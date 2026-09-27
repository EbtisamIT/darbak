import React, { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { FiBookOpen, FiCheckCircle, FiCopy, FiExternalLink, FiMapPin, FiUsers } from "react-icons/fi";
import { setPageSeo } from "../utils/seoMetadata";
import "./ClubDemoPage.css";

const read = (params, key, fallback) => params.get(key)?.trim() || fallback;

export default function ClubDemoPage() {
  const { search } = useLocation();
  const [copied, setCopied] = useState(false);
  const club = useMemo(() => {
    const params = new URLSearchParams(search);
    return {
      name: read(params, "name", "نادي التقنية"),
      university: read(params, "university", "جامعة الإمام محمد بن سعود الإسلامية"),
      college: read(params, "college", "كلية علوم الحاسب والمعلومات"),
      city: read(params, "city", "الرياض"),
      code: read(params, "code", "TECH10"),
    };
  }, [search]);

  React.useEffect(() => {
    setPageSeo({ title: `${club.name} | دربك`, description: `صفحة ${club.name} في دربك لمساعدة الطلاب في رحلة التدريب.`, path: "/clubs/demo" });
  }, [club.name]);

  const joinUrl = `/subscribe?source=club&club=${encodeURIComponent(club.name)}&discountCode=${encodeURIComponent(club.code)}`;
  const copyCode = async () => {
    await navigator.clipboard?.writeText(club.code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return <main className="club-demo-page" dir="rtl">
    <section className="club-demo-hero">
      <div className="club-demo-brand"><span>دربك</span><b>×</b><span>{club.name}</span></div>
      <div className="club-demo-identity">
        <span className="club-demo-mark">{club.name.slice(0, 1)}</span>
        <div><p>شريك طلابي في دربك</p><h1>{club.name}</h1><small><FiBookOpen /> {club.university} <i>·</i> {club.college}</small></div>
      </div>
      <p className="club-demo-copy">مساحة تجمع لطلاب النادي تجارب التدريب والفرص والجهات المناسبة، وتختصر بداية البحث بخطوات واضحة.</p>
      <div className="club-demo-actions"><Link to={joinUrl}>انضم عبر النادي <FiExternalLink /></Link><a href="#club-benefits">استكشف المزايا</a></div>
    </section>

    <section className="club-demo-stats" aria-label="مزايا دربك للطلاب">
      <article><FiUsers /><strong>مجتمع النادي</strong><span>رابط خاص لطلاب النادي</span></article>
      <article><FiMapPin /><strong>{club.city}</strong><span>فرص وجهات قريبة منك</span></article>
      <article><FiCheckCircle /><strong>رحلة تدريب أوضح</strong><span>تجارب وفرص في مكان واحد</span></article>
    </section>

    <section className="club-demo-grid" id="club-benefits">
      <article className="club-demo-panel"><span>لطلاب النادي</span><h2>ابدأ رحلتك من مكان مرتب</h2><p>اكتشف تجارب طلاب سابقين، جهات مناسبة لتخصصك، وفرص تدريب محدثة في دربك.</p><ul><li>تجارب تدريب ومقابلات حقيقية</li><li>وين أتدرب؟ حسب التخصص والمدينة</li><li>ملف مهني مرتب عند الحاجة</li></ul></article>
      <article className="club-demo-discount"><span>ميزة خاصة بالنادي</span><h2>كود خصم طلاب {club.name}</h2><p>بعد إنشاء الحساب، أدخل الكود عند اختيار الباقة لتظهر لك ميزة النادي.</p><button type="button" onClick={copyCode}><code dir="ltr">{club.code}</code><FiCopy /> {copied ? "تم النسخ" : "انسخ الكود"}</button><Link to={joinUrl}>إنشاء حساب واستخدام الكود <FiExternalLink /></Link><small>هذا نموذج عرض. تفعيل الخصم الحقيقي يتم عند اعتماد شراكة النادي.</small></article>
    </section>

    <section className="club-demo-how"><span>كيف تعمل الشراكة؟</span><div><article><b>1</b><h3>رابط النادي</h3><p>ينشر النادي رابطًا خاصًا في حساباته وقنواته.</p></article><article><b>2</b><h3>تسجيل الطالب</h3><p>ينشئ الطالب حسابه في دربك من رابط النادي.</p></article><article><b>3</b><h3>كود النادي</h3><p>يستخدم الكود عند اختيار الباقة للاستفادة من العرض.</p></article></div></section>
    <p className="club-demo-footer">هذه صفحة نموذجية توضح شكل صفحة النادي داخل دربك.</p>
  </main>;
}
