import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import API_BASE_URL from "../config/api";
import { cityOptions, specializationOptions } from "../data/trainingOptions";
import { trackEvent } from "../utils/analytics";
import { getAccessHeaders } from "../utils/premiumAccess";

const pageFont = "'IBM Plex Sans Arabic', 'Aniq', 'Cairo', sans-serif";

const emptyForm = {
  fullName: "",
  email: "",
  confirmEmail: "",
  phone: "",
  university: "",
  major: "",
  city: "",
  gpaValue: "",
  gpaScale: "",
  trainingInfo: "",
  linkedinUrl: "",
};

const OTHER_VALUE = "__other__";

const saudiUniversities = [
  "جامعة الملك سعود",
  "جامعة الإمام محمد بن سعود الإسلامية",
  "جامعة الملك عبدالعزيز",
  "جامعة الملك فهد للبترول والمعادن",
  "جامعة الملك خالد",
  "جامعة القصيم",
  "جامعة أم القرى",
  "جامعة طيبة",
  "جامعة الطائف",
  "جامعة جازان",
  "جامعة نجران",
  "جامعة تبوك",
  "جامعة حائل",
  "جامعة الجوف",
  "جامعة الباحة",
  "جامعة الحدود الشمالية",
  "جامعة الأمير سطام بن عبدالعزيز",
  "جامعة شقراء",
  "جامعة المجمعة",
  "جامعة جدة",
  "جامعة بيشة",
  "جامعة حفر الباطن",
  "الجامعة السعودية الإلكترونية",
  "جامعة الأميرة نورة بنت عبدالرحمن",
  "جامعة الملك فيصل",
  "جامعة الإمام عبدالرحمن بن فيصل",
  "جامعة اليمامة",
  "جامعة الأمير سلطان",
  "جامعة الفيصل",
  "جامعة دار العلوم",
  "جامعة عفت",
  "جامعة دار الحكمة",
  "كليات التقنية",
];

const specializationValues = specializationOptions.map((item) => item.value);

const getSelectValue = (value, options) => {
  if (!value) return "";
  return options.includes(value) ? value : OTHER_VALUE;
};

const DiscoveryLogo = ({ logoUrl, organizationName }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const fallback = (organizationName || "د").trim().charAt(0) || "د";

  return (
    <span className="company-apply-discovery-logo" aria-label={organizationName}>
      {logoUrl && !imageFailed ? (
        <img
          src={logoUrl}
          alt={`شعار ${organizationName}`}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span>{fallback}</span>
      )}
    </span>
  );
};

const normalizeQuestion = (item) => ({
  question: String(item?.question ?? "").trim(),
  required: Boolean(item?.required),
  answer: "",
});

const isValidEmail = (value = "") => /^\S+@\S+\.\S+$/.test(value.trim());
const isValidSaudiPhone = (value = "") => {
  const digits = String(value).replace(/[^\d+]/g, "");
  return /^(\+9665\d{8}|9665\d{8}|05\d{8}|5\d{8})$/.test(digits);
};

const toSaudiMobileLocalValue = (value = "") => {
  const digits = String(value).replace(/[^\d]/g, "");
  if (digits.startsWith("966")) return digits.slice(3, 12);
  if (digits.startsWith("0")) return digits.slice(1, 10);
  return digits.slice(0, 9);
};

const normalizePhoneInput = (value = "") =>
  String(value)
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/\D/g, "")
    .replace(/^0/, "")
    .slice(0, 9);

const formatDeadline = (value) => {
  if (!value) return "غير محدد";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "غير محدد";
  return new Intl.DateTimeFormat("ar-SA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
};

const CompanyApplyPage = () => {
  const { companySlug = "" } = useParams();
  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [customAnswers, setCustomAnswers] = useState([]);
  const [cvFile, setCvFile] = useState(null);
  const [cvMessage, setCvMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successApplication, setSuccessApplication] = useState(null);
  const [discovery, setDiscovery] = useState({
    latestOpportunities: [],
    latestExperiences: [],
    loading: false,
  });
  const didPrefill = useRef(false);
  const cvInputRef = useRef(null);

  const fetchContext = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(
        `${API_BASE_URL}/api/company-apply/${companySlug}/context`,
        { headers: getAccessHeaders() }
      );
      setContext(data);
    } catch (err) {
      setErrorMessage(
        err.response?.data?.error || "تعذر تحميل برنامج التقديم الآن. حاول مرة أخرى."
      );
    } finally {
      setLoading(false);
    }
  }, [companySlug]);

  useEffect(() => {
    fetchContext();
  }, [fetchContext]);

  useEffect(() => {
    const campaign = context?.campaign;
    if (!campaign) return;

    document.title = `التقديم على ${campaign.organizationName} | دربك`;
    trackEvent("company_apply_page_viewed", {
      companySlug,
      organizationName: campaign.organizationName,
      opportunityTitle: campaign.opportunityTitle,
    });

    if (!didPrefill.current) {
      const snapshot = context?.snapshot || {};
      setForm((current) => ({
        ...current,
        fullName: snapshot.fullName || current.fullName,
        email: snapshot.email || current.email,
        confirmEmail: snapshot.email || current.confirmEmail,
        phone: snapshot.phone ? toSaudiMobileLocalValue(snapshot.phone) : current.phone,
        university: snapshot.university || current.university,
        major: snapshot.major || current.major,
        city: snapshot.city || current.city,
        linkedinUrl: snapshot.linkedinUrl || current.linkedinUrl,
      }));
      didPrefill.current = true;
    }

    setCustomAnswers(
      Array.isArray(campaign.customQuestions)
        ? campaign.customQuestions.map(normalizeQuestion).filter((item) => item.question)
        : []
    );
  }, [companySlug, context]);

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
      ...(field === "email" && value !== current.email ? { confirmEmail: "" } : {}),
    }));
  };

  const updateSelectField = (field, value, options) => {
    if (value === OTHER_VALUE) {
      setForm((current) => ({
        ...current,
        [field]: options.includes(current[field]) ? "" : current[field],
      }));
      return;
    }
    updateField(field, value);
  };

  const updateAnswer = (index, value) => {
    setCustomAnswers((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, answer: value } : item
      )
    );
  };

  useEffect(() => {
    if (!successApplication) return undefined;

    let cancelled = false;
    setDiscovery({
      latestOpportunities: [],
      latestExperiences: [],
      loading: true,
    });

    axios
      .get(`${API_BASE_URL}/api/post-apply-discovery`)
      .then(({ data }) => {
        if (cancelled) return;
        setDiscovery({
          latestOpportunities: Array.isArray(data?.latestOpportunities)
            ? data.latestOpportunities
            : [],
          latestExperiences: Array.isArray(data?.latestExperiences)
            ? data.latestExperiences
            : [],
          loading: false,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setDiscovery({
            latestOpportunities: [],
            latestExperiences: [],
            loading: false,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [successApplication]);

  const uploadCv = async () => {
    if (!cvFile) throw new Error("ارفع السيرة الذاتية بصيغة PDF.");
    if (cvFile.type !== "application/pdf" && !cvFile.name.toLowerCase().endsWith(".pdf")) {
      throw new Error("السيرة الذاتية يجب أن تكون بصيغة PDF.");
    }
    if (cvFile.size > 10 * 1024 * 1024) {
      throw new Error("حجم السيرة كبير. الحد الأقصى 10MB.");
    }

    try {
      const { data } = await axios.post(
        `${API_BASE_URL}/api/company-application-files`,
        cvFile,
        {
          headers: {
            "Content-Type": "application/pdf",
            "X-File-Name": encodeURIComponent(cvFile.name),
          },
        }
      );
      if (!data?.data?.verified) {
        throw new Error("لم يكتمل التحقق من السيرة. اختر ملف PDF آخر.");
      }
      return data.data;
    } catch (error) {
      const message = error.response?.data?.error || error.message || "تعذر التحقق من السيرة.";
      const cvError = new Error(message);
      cvError.isCvVerificationError = true;
      throw cvError;
    }
  };

  const handleCvChange = (event) => {
    const selected = event.target.files?.[0] || null;
    setCvMessage("");
    if (!selected) { setCvFile(null); return; }
    if ((selected.type !== "application/pdf" && !selected.name.toLowerCase().endsWith(".pdf")) || selected.size > 10 * 1024 * 1024) {
      setCvFile(null);
      setCvMessage(selected.size > 10 * 1024 * 1024 ? "حجم السيرة أكبر من 10MB. اختر ملفًا أصغر." : "هذا الملف ليس PDF. اختر السيرة بصيغة PDF.");
      event.target.value = "";
      return;
    }
    setCvFile(selected);
    setCvMessage("سيتم التحقق من سلامة السيرة قبل إرسال طلبك.");
  };

  const validateForm = () => {
    if (form.fullName.trim().length < 3) return "اكتب الاسم الكامل بشكل واضح.";
    if (!isValidEmail(form.email)) return "اكتب بريدًا إلكترونيًا صحيحًا.";
    if (form.email.trim().toLowerCase() !== form.confirmEmail.trim().toLowerCase()) {
      return "البريدان الإلكترونيان غير متطابقين.";
    }
    if (!isValidSaudiPhone(`+966${form.phone}`)) return "اكتب رقم جوال سعوديًا صحيحًا.";
    if (form.university.trim().length < 2) return "اكتب اسم الجامعة.";
    if (form.major.trim().length < 2) return "اكتب التخصص.";
    if (form.gpaValue && !form.gpaScale) return "اختر مقياس المعدل.";
    if (form.gpaScale && !form.gpaValue) return "اكتب قيمة المعدل.";
    if (form.gpaValue && Number(form.gpaValue) > Number(form.gpaScale)) {
      return "قيمة المعدل لا يمكن أن تتجاوز المقياس المختار.";
    }
    if (!cvFile) return "ارفع السيرة الذاتية بصيغة PDF.";
    if (!consent) return "يلزم الموافقة على مشاركة بيانات الطلب مع الجهة.";
    if (customAnswers.some((item) => item.required && !item.answer.trim())) {
      return "أجب عن أسئلة البرنامج المطلوبة قبل الإرسال.";
    }
    return "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    const validationError = validateForm();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const upload = await uploadCv();
      const campaign = context?.campaign || {};
      const { data } = await axios.post(
        `${API_BASE_URL}/api/company-applications`,
        {
          ...form,
          phone: `+966${form.phone}`,
          gpa: form.gpaValue && form.gpaScale ? `${form.gpaValue} من ${form.gpaScale}` : "",
          cvFileId: upload?.id,
          campaignSlug: campaign.slug || companySlug,
          companySlug: campaign.companySlug || companySlug,
          customAnswers,
          consent,
        },
        { headers: getAccessHeaders() }
      );

      trackEvent("company_application_submitted", {
        companySlug,
        organizationName: campaign.organizationName,
        opportunityTitle: campaign.opportunityTitle,
        city: form.city,
        major: form.major,
      });
      setSuccessApplication(data?.data || { organizationName: campaign.organizationName });
    } catch (err) {
      if (err.isCvVerificationError) {
        setCvFile(null);
        if (cvInputRef.current) cvInputRef.current.value = "";
        setCvMessage(`تعذر قبول السيرة: ${err.message} اختر ملف PDF سليمًا ثم أرسله مرة أخرى.`);
      }
      setErrorMessage(
        err.response?.data?.error || err.message || "تعذر إرسال الطلب الآن. حاول مرة أخرى."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const campaign = context?.campaign || {};
  const isOpen = Boolean(campaign.isOpen);
  const specialties = Array.isArray(campaign.specialties) ? campaign.specialties : [];
  const cities = Array.isArray(campaign.cities) ? campaign.cities : [];
  const displayCities = cities.length ? cities.join("، ") : campaign.city || "كل المدن";

  return (
    <main dir="rtl" className="company-apply-page">
      <section className="company-apply-shell">
        <aside className="company-apply-hero">
          <span className="company-apply-badge">التقديم عبر دربك</span>
          {campaign.organizationLogoUrl && (
            <img
              className="company-apply-logo"
              src={campaign.organizationLogoUrl}
              alt={`شعار ${campaign.organizationName}`}
            />
          )}
          <h1>{campaign.organizationName || "برنامج تدريب"}</h1>
          <h2>{campaign.opportunityTitle || "التدريب التعاوني"}</h2>
          {campaign.description && <p>{campaign.description}</p>}

          <div className="company-apply-summary">
            <div><span>المدينة</span><strong>{displayCities}</strong></div>
            <div><span>التخصصات</span><strong>{specialties.length ? specialties.join("، ") : "متاح لعدة تخصصات"}</strong></div>
            <div><span>آخر موعد</span><strong>{formatDeadline(campaign.applicationDeadline)}</strong></div>
          </div>
        </aside>

        <section className="company-apply-card">
          {loading ? (
            <div className="company-apply-state">جار تجهيز نموذج التقديم...</div>
          ) : errorMessage && !campaign.organizationName ? (
            <div className="company-apply-state company-apply-error-state">{errorMessage}</div>
          ) : !isOpen ? (
            <div className="company-apply-state">
              <h2>التقديم على هذا البرنامج مغلق حاليًا</h2>
              <p>تابع الفرص الأخرى المتاحة في دربك.</p>
              <Link to="/where-to-train" className="company-apply-primary-link">استكشف الفرص</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="company-apply-form">
              <header>
                <span>طلب جديد</span>
                <h2>قدّم على البرنامج</h2>
                <p>أدخل بياناتك وأرسل طلبك مباشرة للجهة.</p>
              </header>

              {errorMessage && <p className="company-apply-error">{errorMessage}</p>}

              <div className="company-apply-fields">
                <label>
                  الاسم الكامل <b>*</b>
                  <input value={form.fullName} onChange={(e) => updateField("fullName", e.target.value)} autoComplete="name" required />
                </label>
                <label>
                  البريد الإلكتروني <b>*</b>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value.trim())}
                    autoComplete="email"
                    dir="ltr"
                    placeholder="name@example.com"
                    required
                  />
                </label>
                <label>
                  تأكيد البريد الإلكتروني <b>*</b>
                  <input
                    type="email"
                    value={form.confirmEmail}
                    onChange={(e) => updateField("confirmEmail", e.target.value.trim())}
                    autoComplete="email"
                    dir="ltr"
                    placeholder="أعد كتابة البريد"
                    required
                  />
                </label>
                <label>
                  رقم الجوال <b>*</b>
                  <span className="company-apply-phone-control" dir="ltr">
                    <span>+966</span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={form.phone}
                      onChange={(e) =>
                        updateField(
                          "phone",
                          normalizePhoneInput(e.target.value)
                        )
                      }
                      placeholder="5xxxxxxxx"
                      autoComplete="tel-national"
                      required
                    />
                  </span>
                  <small>أدخل الرقم بدون الصفر الأول.</small>
                </label>
                <label>
                  الجامعة <b>*</b>
                  <span className="company-apply-choice-with-custom">
                    <select
                      value={getSelectValue(form.university, saudiUniversities)}
                      onChange={(e) => updateSelectField("university", e.target.value, saudiUniversities)}
                      required
                    >
                      <option value="">اختر الجامعة</option>
                      {saudiUniversities.map((university) => (
                        <option key={university} value={university}>{university}</option>
                      ))}
                      <option value={OTHER_VALUE}>أخرى</option>
                    </select>
                    {getSelectValue(form.university, saudiUniversities) === OTHER_VALUE && (
                      <input
                        value={form.university}
                        onChange={(e) => updateField("university", e.target.value)}
                        placeholder="اكتب اسم الجامعة"
                        required
                      />
                    )}
                  </span>
                </label>
                <label>
                  التخصص <b>*</b>
                  <span className="company-apply-choice-with-custom">
                    <select
                      value={getSelectValue(form.major, specializationValues)}
                      onChange={(e) => updateSelectField("major", e.target.value, specializationValues)}
                      required
                    >
                      <option value="">اختر التخصص</option>
                      {specializationOptions.map((specialization) => (
                        <option key={specialization.value} value={specialization.value}>
                          {specialization.value}
                        </option>
                      ))}
                      <option value={OTHER_VALUE}>أخرى</option>
                    </select>
                    {getSelectValue(form.major, specializationValues) === OTHER_VALUE && (
                      <input
                        value={form.major}
                        onChange={(e) => updateField("major", e.target.value)}
                        placeholder="اكتب التخصص"
                        required
                      />
                    )}
                  </span>
                </label>
                <label>
                  المدينة
                  <span className="company-apply-choice-with-custom">
                    <select
                      value={getSelectValue(form.city, cityOptions)}
                      onChange={(e) => updateSelectField("city", e.target.value, cityOptions)}
                    >
                      <option value="">اختر المدينة</option>
                      {cityOptions.map((city) => <option key={city} value={city}>{city}</option>)}
                      <option value={OTHER_VALUE}>أخرى</option>
                    </select>
                    {getSelectValue(form.city, cityOptions) === OTHER_VALUE && (
                      <input
                        value={form.city}
                        onChange={(e) => updateField("city", e.target.value)}
                        placeholder="اكتب المدينة"
                      />
                    )}
                  </span>
                </label>
                <label>
                  المعدل <small>اختياري</small>
                  <span className="company-apply-gpa-control">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.gpaValue}
                      onChange={(e) => updateField("gpaValue", e.target.value)}
                      placeholder="مثال: 4.60"
                      inputMode="decimal"
                      dir="ltr"
                    />
                    <select value={form.gpaScale} onChange={(e) => updateField("gpaScale", e.target.value)}>
                      <option value="">من كم؟</option>
                      <option value="4">من 4</option>
                      <option value="5">من 5</option>
                      <option value="100">من 100</option>
                    </select>
                  </span>
                </label>
                <label>
                  بداية التدريب المتوقعة <small>اختياري</small>
                  <input
                    type="date"
                    value={form.trainingInfo}
                    onChange={(e) => updateField("trainingInfo", e.target.value)}
                  />
                </label>
                <label className="company-apply-wide-field">
                  LinkedIn <small>اختياري</small>
                  <input type="url" value={form.linkedinUrl} onChange={(e) => updateField("linkedinUrl", e.target.value)} placeholder="https://linkedin.com/in/..." dir="ltr" />
                </label>
              </div>

              <label className="company-apply-file-field">
                <span>رفع السيرة الذاتية PDF <b>*</b></span>
                <input
                  ref={cvInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={handleCvChange}
                  required
                />
                <small style={{ color: cvMessage.startsWith("تعذر") || cvMessage.includes("ليس PDF") || cvMessage.includes("أكبر") ? "#b91c1c" : undefined }}>
                  {cvMessage || (cvFile ? `تم اختيار: ${cvFile.name}` : "الحد الأقصى 10MB")}
                </small>
                {cvMessage.startsWith("تعذر") && (
                  <button type="button" onClick={() => cvInputRef.current?.click()} className="company-apply-secondary-button">
                    اختيار ملف آخر
                  </button>
                )}
              </label>

              {customAnswers.length > 0 && (
                <section className="company-apply-questions">
                  <h3>أسئلة البرنامج</h3>
                  {customAnswers.map((item, index) => (
                    <label key={`${item.question}-${index}`}>
                      {item.question} {item.required && <b>*</b>}
                      <textarea value={item.answer} onChange={(e) => updateAnswer(index, e.target.value)} rows={3} required={item.required} />
                    </label>
                  ))}
                </section>
              )}

              <label className="company-apply-consent">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>أوافق على مشاركة بيانات هذا الطلب مع الجهة لغرض التقديم على البرنامج.</span>
              </label>

              <button className="company-apply-submit" type="submit" disabled={submitting}>
                {submitting ? "جار إرسال الطلب..." : "إرسال الطلب"}
              </button>
            </form>
          )}
        </section>
      </section>

      {successApplication && (
        <div className="company-apply-success-overlay" role="dialog" aria-modal="true">
          <section className="company-apply-success-modal">
            <span>✓</span>
            <h2>تم إرسال طلبك بنجاح</h2>
            <p>تم استلام طلبك للتقديم على {successApplication.opportunityTitle || campaign.opportunityTitle || campaign.organizationName}.</p>
            <div className="company-apply-success-divider" />

            {(discovery.loading || discovery.latestOpportunities.length > 0 || discovery.latestExperiences.length > 0) && (
              <section className="company-apply-discovery" aria-label="اكتشف المزيد في دربك">
                <h3>اكتشف المزيد في دربك</h3>
                {discovery.loading ? (
                  <p className="company-apply-discovery-loading">جار تجهيز محتوى جديد لك...</p>
                ) : (
                  <>
                    {discovery.latestOpportunities.length > 0 && (
                      <section className="company-apply-discovery-section">
                        <div className="company-apply-discovery-heading">
                          <h4>أحدث 3 فرص</h4>
                          <Link to="/where-to-train">عرض كل الفرص</Link>
                        </div>
                        <div className="company-apply-discovery-list">
                          {discovery.latestOpportunities.map((opportunity) => (
                            <Link
                              key={opportunity.id}
                              to={`/where-to-train/opportunity/${opportunity.id}`}
                              className="company-apply-discovery-row"
                            >
                              <DiscoveryLogo
                                logoUrl={opportunity.logoUrl}
                                organizationName={opportunity.organizationName}
                              />
                              <span className="company-apply-discovery-copy">
                                <strong>{opportunity.title}</strong>
                                <small>
                                  {[opportunity.organizationName, opportunity.city]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </small>
                                {opportunity.field && <em>{opportunity.field}</em>}
                              </span>
                              <span className="company-apply-discovery-arrow">عرض ‹</span>
                            </Link>
                          ))}
                        </div>
                      </section>
                    )}

                    {discovery.latestExperiences.length > 0 && (
                      <section className="company-apply-discovery-section company-apply-discovery-experiences">
                        <div className="company-apply-discovery-heading">
                          <h4>تجربتان جديدتان</h4>
                          <Link to="/experiences">عرض كل التجارب</Link>
                        </div>
                        <div className="company-apply-discovery-list">
                          {discovery.latestExperiences.map((experience) => (
                            <Link
                              key={experience.id}
                              to={`/experiences/${experience.id}`}
                              className="company-apply-discovery-row company-apply-discovery-experience"
                            >
                              <span className="company-apply-discovery-experience-mark">ت</span>
                              <span className="company-apply-discovery-copy">
                                <strong>{experience.organizationName}</strong>
                                {experience.major && <small>{experience.major}</small>}
                                {experience.excerpt && <em>{experience.excerpt}</em>}
                              </span>
                              <span className="company-apply-discovery-arrow">عرض ‹</span>
                            </Link>
                          ))}
                        </div>
                      </section>
                    )}
                  </>
                )}
              </section>
            )}
            <Link to="/" className="company-apply-success-primary">استكشف دربك</Link>
            <button type="button" onClick={() => setSuccessApplication(null)}>العودة للفرصة</button>
          </section>
        </div>
      )}

      <style>{`
        .company-apply-page { min-height: 100vh; padding: clamp(22px, 5vw, 58px) 14px; color: var(--app-text); background: var(--app-bg); font-family: ${pageFont}; }
        .company-apply-shell { max-width: 1080px; margin: 0 auto; display: grid; grid-template-columns: minmax(270px, .84fr) minmax(0, 1.16fr); gap: clamp(18px, 4vw, 30px); align-items: start; }
        .company-apply-hero, .company-apply-card { border: 1px solid var(--app-border); border-radius: 22px; box-shadow: 0 18px 52px var(--app-shadow); }
        .company-apply-hero { position: sticky; top: 92px; padding: clamp(22px, 3vw, 30px); background: #102a28; color: #fff; }
        .company-apply-badge { display:inline-flex; padding:6px 11px; border-radius:999px; background:rgba(125,219,205,.16); color:#9ff2e8; font-size:13px; font-weight:900; }
        .company-apply-logo { display:block; width:70px; height:70px; margin:18px 0 12px; padding:9px; border-radius:16px; object-fit:contain; background:#fff; }
        .company-apply-hero h1 { margin:0; font-size:clamp(26px,4vw,40px); line-height:1.2; }
        .company-apply-hero h2 { margin:8px 0 14px; color:#7ddbcd; font-size:18px; }
        .company-apply-hero > p { margin:0; color:rgba(255,255,255,.78); line-height:1.9; white-space:pre-line; }
        .company-apply-summary { display:grid; gap:9px; margin-top:22px; }
        .company-apply-summary div { display:flex; justify-content:space-between; gap:14px; padding:11px 0; border-top:1px solid rgba(255,255,255,.12); font-size:13px; }
        .company-apply-summary span { color:rgba(255,255,255,.6); } .company-apply-summary strong { text-align:left; color:#fff; }
        .company-apply-card { min-height:460px; padding:clamp(20px,4vw,34px); background:var(--app-card); }
        .company-apply-state { display:grid; place-content:center; min-height:370px; text-align:center; color:var(--app-text-soft); line-height:1.8; }
        .company-apply-state h2 { color:var(--app-text); margin:0 0 8px; } .company-apply-primary-link { display:inline-flex; justify-self:center; margin-top:12px; padding:11px 15px; border-radius:10px; background:var(--app-brand); color:#06201e; font-weight:900; text-decoration:none; }
        .company-apply-form header span { color:var(--app-brand-strong); font-size:13px; font-weight:900; } .company-apply-form header h2 { margin:5px 0 6px; font-size:clamp(24px,4vw,32px); } .company-apply-form header p { margin:0 0 24px; color:var(--app-text-soft); }
        .company-apply-fields { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:13px; }
        .company-apply-form label { display:grid; gap:7px; color:var(--app-text); font-size:14px; font-weight:800; } .company-apply-form b { color:var(--app-brand-strong); } .company-apply-form small { color:var(--app-text-soft); font-weight:600; }
        .company-apply-form input, .company-apply-form select, .company-apply-form textarea { width:100%; box-sizing:border-box; border:1px solid var(--app-border); border-radius:10px; padding:11px 12px; background:var(--app-input-bg); color:var(--app-text); font:inherit; font-weight:600; outline:none; }
        .company-apply-form input:focus, .company-apply-form select:focus, .company-apply-form textarea:focus { border-color:var(--app-brand); box-shadow:0 0 0 3px color-mix(in srgb,var(--app-brand) 18%,transparent); } .company-apply-wide-field { grid-column:1 / -1; }
        .company-apply-choice-with-custom { display:grid; gap:8px; }
        .company-apply-phone-control { display:grid; grid-template-columns:auto minmax(0,1fr); overflow:hidden; border:1px solid var(--app-border); border-radius:10px; background:var(--app-input-bg); direction:ltr; }
        .company-apply-phone-control:focus-within { border-color:var(--app-brand); box-shadow:0 0 0 3px color-mix(in srgb,var(--app-brand) 18%,transparent); }
        .company-apply-phone-control > span { display:grid; place-items:center; min-width:59px; padding:0 10px; border-right:1px solid var(--app-border); color:var(--app-text-soft); font-size:14px; font-weight:900; }
        .company-apply-phone-control input { border:0; border-radius:0; box-shadow:none !important; }
        .company-apply-gpa-control { display:grid; grid-template-columns:minmax(0,1fr) 112px; gap:8px; direction:ltr; }
        .company-apply-file-field { margin-top:16px; padding:14px; border:1px dashed color-mix(in srgb,var(--app-brand) 55%,var(--app-border)); border-radius:12px; background:color-mix(in srgb,var(--app-brand) 5%,transparent); } .company-apply-file-field input { padding:8px 0; border:0; background:transparent; }
        .company-apply-questions { display:grid; gap:12px; margin-top:20px; padding-top:18px; border-top:1px solid var(--app-border); } .company-apply-questions h3 { margin:0; font-size:17px; }
        .company-apply-consent { display:flex !important; grid-template-columns:auto 1fr; align-items:flex-start; gap:10px !important; margin-top:20px; color:var(--app-text-soft) !important; line-height:1.8; } .company-apply-consent input { width:17px; height:17px; margin-top:4px; accent-color:var(--app-brand); }
        .company-apply-submit { width:100%; margin-top:18px; padding:13px 16px; border:0; border-radius:11px; background:var(--app-brand); color:#06201e; font:inherit; font-weight:900; font-size:16px; cursor:pointer; } .company-apply-submit:disabled { opacity:.62; cursor:wait; }
        .company-apply-error { margin:0 0 14px; padding:11px 13px; border-radius:10px; color:#fecaca; background:rgba(248,113,113,.12); border:1px solid rgba(248,113,113,.26); line-height:1.7; } .company-apply-error-state { color:#fecaca; }
        .company-apply-success-overlay { position:fixed; inset:0; z-index:1000; display:grid; place-items:center; padding:20px; background:rgba(3,13,12,.72); backdrop-filter:blur(5px); } .company-apply-success-modal { width:min(100%,590px); max-height:min(88vh,760px); overflow:auto; padding:28px; border:1px solid var(--app-border); border-radius:20px; background:var(--app-card); text-align:center; box-shadow:0 26px 80px rgba(0,0,0,.35); } .company-apply-success-modal > span { display:grid; place-items:center; width:50px; height:50px; margin:0 auto 14px; border-radius:50%; background:rgba(125,219,205,.14); color:var(--app-brand); font-size:28px; font-weight:900; } .company-apply-success-modal h2 { margin:0 0 8px; } .company-apply-success-modal > p { margin:0; color:var(--app-text-soft); line-height:1.8; } .company-apply-success-divider { height:1px; margin:20px 0; background:var(--app-border); } .company-apply-discovery { text-align:right; } .company-apply-discovery > h3 { margin:0 0 14px; color:var(--app-text); font-size:18px; } .company-apply-discovery-loading { margin:0 0 14px; color:var(--app-text-soft); font-size:13px; } .company-apply-discovery-section { display:grid; gap:8px; } .company-apply-discovery-experiences { margin-top:18px; padding-top:18px; border-top:1px solid var(--app-border); } .company-apply-discovery-heading { display:flex; align-items:center; justify-content:space-between; gap:12px; } .company-apply-discovery-heading h4 { margin:0; color:var(--app-text); font-size:15px; } .company-apply-discovery-heading a { color:var(--app-brand-strong); font-size:12px; font-weight:800; text-decoration:none; } .company-apply-discovery-list { display:grid; gap:7px; } .company-apply-discovery-row { display:grid; grid-template-columns:44px minmax(0,1fr) auto; align-items:center; gap:10px; min-height:58px; padding:7px; border:1px solid var(--app-border); border-radius:11px; color:var(--app-text); text-decoration:none; transition:border-color .16s ease, transform .16s ease; } .company-apply-discovery-row:hover { border-color:var(--app-brand); transform:translateY(-1px); } .company-apply-discovery-logo, .company-apply-discovery-experience-mark { display:grid; place-items:center; width:42px; height:42px; overflow:hidden; border-radius:10px; background:color-mix(in srgb,var(--app-brand) 12%,var(--app-input-bg)); color:var(--app-brand-strong); font-weight:900; } .company-apply-discovery-logo img { width:100%; height:100%; object-fit:contain; background:#fff; } .company-apply-discovery-copy { display:grid; min-width:0; gap:2px; } .company-apply-discovery-copy strong { overflow:hidden; color:var(--app-text); font-size:13px; line-height:1.35; text-overflow:ellipsis; white-space:nowrap; } .company-apply-discovery-copy small, .company-apply-discovery-copy em { overflow:hidden; color:var(--app-text-soft); font-size:11px; font-style:normal; line-height:1.35; text-overflow:ellipsis; white-space:nowrap; } .company-apply-discovery-copy em { color:var(--app-brand-strong); } .company-apply-discovery-experience .company-apply-discovery-copy em { color:var(--app-text-soft); } .company-apply-discovery-arrow { color:var(--app-brand-strong); font-size:12px; font-weight:900; white-space:nowrap; } .company-apply-success-modal > a, .company-apply-success-modal > button { display:block; width:100%; box-sizing:border-box; margin-top:12px; padding:12px; border-radius:10px; font:inherit; font-weight:900; text-decoration:none; cursor:pointer; } .company-apply-success-primary { background:var(--app-brand); color:#06201e; } .company-apply-success-modal > button { border:1px solid var(--app-border); background:transparent; color:var(--app-text-soft); }
        @media (max-width:780px) { .company-apply-page { padding:18px 12px 34px; } .company-apply-shell { grid-template-columns:1fr; } .company-apply-hero { position:static; } .company-apply-card { min-height:0; } }
        @media (max-width:520px) { .company-apply-fields { grid-template-columns:1fr; } .company-apply-wide-field { grid-column:auto; } .company-apply-hero { padding:22px 19px; } .company-apply-card { padding:22px 17px; } .company-apply-success-overlay { padding:10px; } .company-apply-success-modal { width:100%; max-height:calc(100vh - 20px); padding:22px 16px; border-radius:17px; } .company-apply-discovery-row { grid-template-columns:40px minmax(0,1fr) auto; gap:8px; } .company-apply-discovery-logo, .company-apply-discovery-experience-mark { width:38px; height:38px; } .company-apply-discovery-arrow { font-size:11px; } }
      `}</style>
    </main>
  );
};

export default CompanyApplyPage;
