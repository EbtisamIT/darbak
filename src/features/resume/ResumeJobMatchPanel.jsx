import React, { useEffect, useState } from "react";
import axios from "axios";
import { FiAlertCircle, FiArrowLeft, FiCheckCircle, FiX } from "react-icons/fi";
import API_BASE_URL from "../../config/api";
import { getAccessHeaders } from "../../utils/premiumAccess";
import { getVisitorId } from "../../utils/analytics";

const ResumeJobMatchPanel = ({ opportunityId = "", externalJob = null, onStartTailoring, onBack }) => {
  const [mode] = useState("darbak");
  const [loading, setLoading] = useState(Boolean(opportunityId));
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [opportunities, setOpportunities] = useState([]);
  const [selectedOpportunityId, setSelectedOpportunityId] = useState(opportunityId);

  const analyze = async (payload) => {
    try {
      setLoading(true);
      setError("");
      const { data } = await axios.post(
        `${API_BASE_URL}/api/resume/match`,
        { ...payload, visitorId: getVisitorId() },
        { headers: getAccessHeaders({ itemKey: "resume:match" }) }
      );
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.error || "تعذر تجهيز التخصيص لهذه الفرصة.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (opportunityId) analyze({ opportunityId });
    else if (externalJob?.company) analyze({ job: externalJob });
  }, [opportunityId, externalJob]);

  useEffect(() => {
    if (mode !== "darbak" || opportunityId) return;
    axios.get(`${API_BASE_URL}/api/opportunities`)
      .then(({ data }) => setOpportunities((data.data || []).slice(0, 40)))
      .catch(() => setOpportunities([]));
  }, [mode, opportunityId]);

  const getFocusItems = (match = {}) => {
    const items = [
      ...(match.breakdown?.skills?.matched || []),
      ...(match.breakdown?.experience?.matched || []),
      ...(match.breakdown?.certifications?.matched || []),
    ].filter(Boolean);
    return [...new Set(items)].slice(0, 8);
  };

  const getReviewItems = (match = {}) => [
    ...(match.breakdown?.reviewRequirements || []),
    ...(match.breakdown?.skills?.missing || []),
  ].filter(Boolean).filter((item, index, items) => items.indexOf(item) === index).slice(0, 10);

  return (
    <section className="resume-match-panel">
      <div className="resume-match-head">
        <div>
          <span>جهّز تقديمك لفرصة</span>
          <h2>{!opportunityId && !externalJob ? "اختر الفرصة التي تريد التقديم عليها" : "نجهز أفضل نسخة من سيرتك لهذه الفرصة."}</h2>
          <p>سنبرز المعلومات الموجودة لديك فقط، ثم نجهز السيرة وخطاب التقديم ورسالة الإيميل.</p>
        </div>
        <button type="button" onClick={onBack} aria-label="العودة إلى السير الذاتية">
          <FiX aria-hidden="true" />
        </button>
      </div>

      {mode === "darbak" && !opportunityId && !externalJob && !result && (
        <div className="resume-match-form">
          <div className="resume-match-form-intro">
            <strong>الخطوة 1 من 2</strong>
            <span>اختر فرصة من دربك لنوضح لك ما الذي سنبرزه قبل إنشاء ملف التقديم.</span>
          </div>
          <label>
            الفرصة أو الجهة
            <select value={selectedOpportunityId} onChange={(event) => setSelectedOpportunityId(event.target.value)}>
              <option value="">اختر فرصة للتقديم</option>
              {opportunities.map((opportunity) => (
                <option key={opportunity._id} value={opportunity._id}>
                  {[opportunity.organizationName, opportunity.title].filter(Boolean).join(" — ")}
                </option>
              ))}
            </select>
          </label>
          <button type="button" disabled={!selectedOpportunityId} onClick={() => analyze({ opportunityId: selectedOpportunityId })}>
            التالي: جهّز ملخص التقديم <FiArrowLeft aria-hidden="true" />
          </button>
        </div>
      )}

      {loading && (
        <div className="resume-match-loading" aria-live="polite">
          <span>✓ قرأنا متطلبات الفرصة</span>
          <span>✓ قارناها بمهاراتك ومشاريعك</span>
          <strong>نحدد ما سنبرزه في النسخة...</strong>
        </div>
      )}

      {error && <div className="resume-page-error">{error}</div>}

      {result?.match && !loading && (
        <div className="resume-match-result">
          <div className="resume-tailor-opportunity-card">
            <span>نسخة مخصصة لـ</span>
            <strong>{result.job.title}</strong>
            {result.job.company && <p>{result.job.company}</p>}
          </div>

          <div className="resume-match-insights">
            <article>
              <FiCheckCircle aria-hidden="true" />
              <h3>سنركز في نسختك على</h3>
              <p>{getFocusItems(result.match).length ? getFocusItems(result.match).join("، ") : "لا توجد مطابقة مباشرة كافية في البيانات الحالية؛ سنحافظ على السيرة صادقة ونبرز محتواها المهني الواضح فقط."}</p>
            </article>
            <article>
              <FiAlertCircle aria-hidden="true" />
              <h3>متطلبات تحتاج مراجعة</h3>
              <p>{getReviewItems(result.match).length ? `${getReviewItems(result.match).join("، ")}. لن نضيف أيًا منها إلى سيرتك إلا إذا كانت لديك ومثبتة.` : "لا توجد متطلبات تحتاج تأكيدًا من البيانات المتاحة."}</p>
            </article>
          </div>

          <button type="button" className="resume-match-tailor-button" onClick={() => onStartTailoring(result)}>
            جهّز تقديمي لهذه الجهة — 1 تخصيص <FiArrowLeft aria-hidden="true" />
          </button>
        </div>
      )}
    </section>
  );
};

export default ResumeJobMatchPanel;
