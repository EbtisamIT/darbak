import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { FiArrowRight, FiCheckCircle, FiCpu, FiEdit3, FiRefreshCw, FiX } from "react-icons/fi";
import API_BASE_URL from "../../config/api";
import { getAccessHeaders } from "../../utils/premiumAccess";
import { getVisitorId, trackEvent } from "../../utils/analytics";

const getQuestionKey = (question = {}, index = 0) =>
  question.id || question.question || `question-${index + 1}`;

const SECTION_LABELS = {
  summary: "النبذة",
  education: "التعليم",
  experiences: "الخبرات",
  projects: "المشاريع",
  skills: "المهارات",
  certifications: "الدورات والشهادات",
  volunteering: "الأنشطة",
  languages: "اللغات",
  links: "الروابط",
};

const DRAFT_SECTIONS = [
  ["professionalSummary", "النبذة"],
  ["education", "التعليم"],
  ["experiences", "الخبرات"],
  ["projects", "المشاريع"],
  ["skills", "المهارات"],
  ["certifications", "الدورات والشهادات"],
  ["volunteering", "الأنشطة والتطوع"],
  ["languages", "اللغات"],
];

const getAgentErrorMessage = (err) => {
  const status = err.response?.status;
  const data = err.response?.data;
  const apiError = data && typeof data === "object" ? data.error : "";
  const reason = data && typeof data === "object" ? data.reason : "";

  if (apiError) return apiError;
  if (!err.response) {
    return "تعذر الاتصال بخادم دربك. تأكدي أن الباكند يعمل ثم حاولي مرة أخرى.";
  }
  if (status === 404) {
    return "مسار وكيل السيرة غير موجود في الباكند الحالي. أعيدي تشغيل الباكند بعد آخر تحديث.";
  }
  if (reason === "openai_key_missing") {
    return "لم يتم تفعيل مفتاح OpenAI في الخادم بعد.";
  }
  if (reason === "openai_model_unavailable") {
    return "نموذج وكيل السيرة غير متاح في مشروع OpenAI الحالي. راجع اسم النموذج في Render.";
  }
  if (reason === "openai_auth_failed") {
    return "مفتاح OpenAI غير صالح أو غير نشط. راجع المفتاح في Render.";
  }
  if (reason === "openai_access_denied") {
    return "مشروع OpenAI لا يملك صلاحية تشغيل وكيل السيرة بعد. راجع صلاحيات المشروع والفوترة.";
  }
  return "تعذر تشغيل وكيل السيرة الآن.";
};

const listValue = (items = [], mapper = (item) => item) =>
  (Array.isArray(items) ? items : []).map(mapper).filter(Boolean);

const DraftSection = ({ title, children }) => {
  if (!children) return null;
  return (
    <section className="resume-agent-draft-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
};

const renderDraftSection = (draft = {}, key, title) => {
  if (key === "professionalSummary") {
    return draft.professionalSummary ? (
      <DraftSection key={key} title={title}>
        <p>{draft.professionalSummary}</p>
      </DraftSection>
    ) : null;
  }

  if (key === "skills") {
    const skills = listValue(draft.skills, (skill) => skill.name || skill);
    return skills.length ? (
      <DraftSection key={key} title={title}>
        <div className="resume-agent-skill-list">
          {skills.map((skill, index) => (
            <span key={`${skill}-${index}`}>{skill}</span>
          ))}
        </div>
      </DraftSection>
    ) : null;
  }

  if (key === "languages") {
    const languages = listValue(draft.languages, (language) =>
      [language.name, language.level].filter(Boolean).join(" - ")
    );
    return languages.length ? (
      <DraftSection key={key} title={title}>
        <ul>
          {languages.map((language, index) => (
            <li key={`${language}-${index}`}>{language}</li>
          ))}
        </ul>
      </DraftSection>
    ) : null;
  }

  const entries = Array.isArray(draft[key]) ? draft[key] : [];
  if (!entries.length) return null;

  return (
    <DraftSection key={key} title={title}>
      <div className="resume-agent-entry-list">
        {entries.map((entry, index) => {
          const heading =
            entry.title ||
            entry.name ||
            entry.degree ||
            entry.organization ||
            `${title} ${index + 1}`;
          const meta = [
            entry.organization,
            entry.major,
            entry.dates,
            entry.location,
            entry.issuer,
            entry.date,
          ]
            .filter(Boolean)
            .join(" · ");
          const bullets = Array.isArray(entry.bullets) ? entry.bullets : [];
          return (
            <article key={`${key}-${entry.sourceId || index}`}>
              <strong>{heading}</strong>
              {meta && <span>{meta}</span>}
              {entry.description && <p>{entry.description}</p>}
              {entry.details && <p>{entry.details}</p>}
              {bullets.length > 0 && (
                <ul>
                  {bullets.map((bullet, bulletIndex) => (
                    <li key={`${key}-${index}-${bulletIndex}`}>{bullet}</li>
                  ))}
                </ul>
              )}
            </article>
          );
        })}
      </div>
    </DraftSection>
  );
};

const ResumeAgentFlow = ({
  purpose = "create_resume",
  source = "professional_profile",
  language = "ar",
  opportunityId = "",
  externalJob = null,
  onApproved,
  onCancel,
}) => {
  const [session, setSession] = useState(null);
  const [output, setOutput] = useState(null);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const questions = output?.status === "needs_information" ? output.questions || [] : [];
  const pendingDraftId = output?.pendingDraftId || session?.pendingDraftId || "";
  const draft = output?.draft || session?.pendingDraft?.draft || null;
  const isTailored = purpose === "tailor_resume";

  const statusText = useMemo(() => {
    if (loading) return isTailored ? "نجهز تقديمك..." : "جاري تجهيز الوكيل...";
    if (output?.status === "needs_information") return "نحتاج كم معلومة قصيرة فقط.";
    if (output?.status === "draft_ready" || output?.status === "tailored_draft_ready") {
      return "المسودة جاهزة للمراجعة.";
    }
    if (output?.status === "cannot_continue") return "نحتاج نراجع السبب قبل المتابعة.";
    return isTailored ? "تقديمك جاهز للمراجعة." : "وكيل السيرة جاهز.";
  }, [isTailored, loading, output?.status]);

  useEffect(() => {
    let cancelled = false;

    const startAgent = async () => {
      try {
        setLoading(true);
        setError("");
        setNotice("");
        const { data } = await axios.post(
          `${API_BASE_URL}/api/resume-agent/start`,
          {
            purpose,
            source,
            language,
            opportunityId,
            externalJob,
            visitorId: getVisitorId(),
          },
          {
            headers: getAccessHeaders({ itemKey: "resume-agent:start" }),
          }
        );
        if (cancelled) return;
        setSession(data.session);
        setOutput(data.output);
        setAnswers({});
        if (purpose === "tailor_resume") {
          trackEvent("application_pack_started", {
            page: "/my-resume/tailor",
            metadata: {
              packType: ["company_suggestion", "where_to_train"].includes(externalJob?.sourceType)
                ? "company_outreach_pack"
                : "opportunity_pack",
              opportunityId,
              sourcePage: "my_resume_tailor",
            },
          });
        }
        trackEvent("resume_agent_flow_started", {
          page: "/my-resume",
          metadata: {
            purpose,
            source,
            status: data.output?.status,
          },
        });
      } catch (err) {
        if (cancelled) return;
        if (purpose === "tailor_resume") {
          trackEvent("application_pack_failed", {
            page: "/my-resume/tailor",
            metadata: {
              packType: ["company_suggestion", "where_to_train"].includes(externalJob?.sourceType)
                ? "company_outreach_pack"
                : "opportunity_pack",
              opportunityId,
              failureStage: "start",
            },
          });
        }
        setError(getAgentErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    startAgent();

    return () => {
      cancelled = true;
    };
  }, [purpose, source, language, opportunityId, externalJob]);

  const updateAnswer = (question, index, value) => {
    setAnswers((current) => ({
      ...current,
      [getQuestionKey(question, index)]: value,
    }));
  };

  const submitAnswers = async () => {
    if (!session?.sessionId) return;
    const payloadAnswers = questions
      .map((question, index) => ({
        questionId: getQuestionKey(question, index),
        section: question.section || "",
        question: question.question || "",
        answer: answers[getQuestionKey(question, index)] || "",
      }))
      .filter((answer) => answer.answer.trim());

    if (!payloadAnswers.length) {
      setError("اكتب إجابة واحدة على الأقل عشان نكمل.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setNotice(isTailored ? "نكمل تجهيز تقديمك بالمعلومات التي أضفتها." : "ممتاز، نرتب معلوماتك ونشوف إذا بقي شيء ناقص...");
      const { data } = await axios.post(
        `${API_BASE_URL}/api/resume-agent/respond`,
        {
          sessionId: session.sessionId,
          answers: payloadAnswers,
          visitorId: getVisitorId(),
        },
        {
          headers: getAccessHeaders({ itemKey: "resume-agent:respond" }),
        }
      );
      setSession(data.session);
      setOutput(data.output);
      setAnswers({});
      setNotice(isTailored
        ? data.output?.status === "needs_information"
          ? "باقي تفصيل قصير قبل إكمال التقديم."
          : "جاري إكمال تقديمك..."
        : data.output?.status === "needs_information"
          ? "باقي كم تفصيل صغير ونجهز المسودة."
          : "جاري كتابة سيرتك وترتيب المشاريع ومراجعة المعلومات..."
      );
      trackEvent("resume_agent_answers_submitted", {
        page: "/my-resume",
        metadata: {
          purpose,
          answerCount: payloadAnswers.length,
          status: data.output?.status,
        },
      });
    } catch (err) {
      if (isTailored) {
        trackEvent("application_pack_failed", {
          page: "/my-resume/tailor",
          metadata: {
            packType: ["company_suggestion", "where_to_train"].includes(externalJob?.sourceType)
              ? "company_outreach_pack"
              : "opportunity_pack",
            opportunityId,
            failureStage: "answers",
          },
        });
      }
      setError(getAgentErrorMessage(err));
      setNotice("");
    } finally {
      setLoading(false);
    }
  };

  const approveDraft = async () => {
    if (!pendingDraftId) {
      setError("لا توجد مسودة جاهزة للاعتماد.");
      return;
    }

    try {
      setApproving(true);
      setError("");
      const { data } = await axios.post(
        `${API_BASE_URL}/api/resume-agent/approve/${pendingDraftId}`,
        {
          language,
          visitorId: getVisitorId(),
        },
        {
          headers: getAccessHeaders({ itemKey: "resume-agent:approve" }),
        }
      );
      trackEvent("resume_agent_draft_approved_frontend", {
        page: "/my-resume",
        metadata: {
          purpose,
          tailored: Boolean(data.tailoredVersion),
        },
      });
      onApproved?.(data);
    } catch (err) {
      if (isTailored) {
        trackEvent("application_pack_failed", {
          page: "/my-resume/tailor",
          metadata: {
            packType: ["company_suggestion", "where_to_train"].includes(externalJob?.sourceType)
              ? "company_outreach_pack"
              : "opportunity_pack",
            opportunityId,
            failureStage: "approval",
          },
        });
      }
      setError(err.response?.data?.error || "تعذر اعتماد المسودة الآن.");
    } finally {
      setApproving(false);
    }
  };

  const rejectDraft = async () => {
    if (!pendingDraftId) {
      onCancel?.();
      return;
    }

    try {
      setApproving(true);
      setError("");
      await axios.post(
        `${API_BASE_URL}/api/resume-agent/reject/${pendingDraftId}`,
        { visitorId: getVisitorId() },
        {
          headers: getAccessHeaders({ itemKey: "resume-agent:reject" }),
        }
      );
      trackEvent("resume_agent_draft_rejected_frontend", {
        page: "/my-resume",
        metadata: { purpose },
      });
      onCancel?.();
    } catch (err) {
      setError(err.response?.data?.error || "تعذر رفض المسودة الآن.");
    } finally {
      setApproving(false);
    }
  };

  return (
    <section className="resume-agent-flow">
      <div className="resume-agent-hero">
        <div>
          <span>{isTailored ? "ملف تقديم مخصص" : "وكيل السيرة في دربك"}</span>
          <h2>{isTailored ? "نجهز تقديمك لهذه الجهة" : "نبني سيرتك خطوة بخطوة"}</h2>
          <p>
            {isTailored
              ? "نستخدم معلوماتك الموجودة في دربك، وما نضيف أي خبرة أو مهارة غير موجودة عندك."
              : "الوكيل يقرأ بياناتك في دربك، يسأل عن الناقص فقط، ثم يجهز مسودة قابلة للمراجعة قبل الحفظ."}
          </p>
        </div>
        <div className="resume-agent-status">
          <FiCpu aria-hidden="true" />
          <strong>{statusText}</strong>
        </div>
      </div>

      <div className="resume-agent-progress">
        {(isTailored ? ["نفهم الجهة", "نخصص سيرتك", "نجهز تقديمك"] : ["قراءة بياناتك", "تحديد الناقص", "صياغة المسودة", "مراجعة الادعاءات"]).map(
          (step, index) => (
            <span
              key={step}
              className={
                loading && index > 1
                  ? ""
                  : output?.status === "needs_information" && index > 1
                    ? ""
                    : "is-active"
              }
            >
              {step}
            </span>
          )
        )}
      </div>

      {notice && <div className="resume-agent-notice">{notice}</div>}
      {error && <div className="resume-page-error">{error}</div>}

      {loading && (
        <div className="resume-agent-loading">
          <FiRefreshCw aria-hidden="true" />
          <strong>{isTailored ? "نجهز ملف تقديمك..." : "نجهز الرد..."}</strong>
          <p>{isTailored ? "نرتب سيرتك ونجهز خطاب التقديم ورسالة الإيميل من معلوماتك الحالية." : "قد يستغرق الوكيل لحظات لأنه يقرأ بياناتك ويتحقق من المسودة قبل عرضها."}</p>
        </div>
      )}

      {!loading && output?.status === "needs_information" && (
        <div className="resume-agent-questions">
          <div className="resume-agent-section-head">
            <h3>أجب على هذه الأسئلة</h3>
            <p>اكتب بأسلوبك العادي، والوكيل يحولها لصياغة مناسبة للسيرة.</p>
          </div>
          {questions.map((question, index) => {
            const key = getQuestionKey(question, index);
            return (
              <label key={key} className="resume-agent-question-card">
                <span>{SECTION_LABELS[question.section] || question.section || "تفصيل مهم"}</span>
                <strong>{question.question}</strong>
                {question.whyNeeded && <small>{question.whyNeeded}</small>}
                {question.inputType === "textarea" ? (
                  <textarea
                    rows={4}
                    value={answers[key] || ""}
                    onChange={(event) => updateAnswer(question, index, event.target.value)}
                    placeholder="اكتب إجابتك هنا..."
                  />
                ) : (
                  <input
                    type={question.inputType === "number" ? "number" : "text"}
                    value={answers[key] || ""}
                    onChange={(event) => updateAnswer(question, index, event.target.value)}
                    placeholder="اكتب إجابتك هنا..."
                  />
                )}
              </label>
            );
          })}
          <div className="resume-agent-actions">
            <button type="button" className="is-soft" onClick={onCancel}>
              رجوع
            </button>
            <button type="button" onClick={submitAnswers}>
              إرسال ومتابعة
              <FiArrowRight aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {!loading &&
        (output?.status === "draft_ready" || output?.status === "tailored_draft_ready") &&
        draft && (
          <div className="resume-agent-review">
            <div className="resume-agent-section-head">
              <span>{isTailored ? "تقديمك جاهز ✨" : "مسودة سيرتك جاهزة ✨"}</span>
              <h3>{isTailored ? "راجع ما جهزناه ثم أنشئ ملف التقديم" : "راجع المسودة قبل اعتمادها"}</h3>
              <p>
                {isTailored
                  ? "سنحفظ النسخة بشكل مستقل عن سيرتك الأساسية، ويمكنك تعديلها بعدها."
                  : "لم يتم حفظ أي تعديل نهائي بعد. عند الاعتماد، تفتح المسودة داخل محرر دربك ويمكنك تعديلها يدويًا."}
              </p>
            </div>

            {!isTailored && <div className="resume-agent-draft-grid">
              {DRAFT_SECTIONS.map(([key, title]) => renderDraftSection(draft, key, title))}
            </div>}

            <div className="resume-agent-insights">
              {output.changesSummary?.length > 0 && (
                <div>
                  <strong>ما الذي رتبه الوكيل؟</strong>
                  <ul>
                    {output.changesSummary.map((item, index) => (
                      <li key={`change-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {!isTailored && output.warnings?.length > 0 && (
                <div>
                  <strong>ملاحظات للمراجعة</strong>
                  <ul>
                    {output.warnings.map((item, index) => (
                      <li key={`warning-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {!isTailored && output.missingInformation?.length > 0 && (
                <div>
                  <strong>معلومات لم نستخدمها أو ناقصة</strong>
                  <ul>
                    {output.missingInformation.map((item, index) => (
                      <li key={`missing-${index}`}>
                        {[item.section, item.question].filter(Boolean).join(": ")}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {!isTailored && output.validationStatus && (
                <div>
                  <strong>نتيجة التحقق</strong>
                  <p>
                    {output.validationStatus.valid
                      ? "تم ربط المسودة بالمعلومات المتوفرة."
                      : "تحتاج المسودة لمراجعة قبل الاعتماد."}
                  </p>
                </div>
              )}
            </div>

            <div className="resume-agent-actions">
              <button type="button" className="is-soft" onClick={rejectDraft} disabled={approving}>
                <FiX aria-hidden="true" />
                رفض المسودة
              </button>
              <button type="button" className="is-soft" onClick={onCancel} disabled={approving}>
                <FiEdit3 aria-hidden="true" />
                تعديل الإجابات
              </button>
              <button type="button" onClick={approveDraft} disabled={approving}>
                <FiCheckCircle aria-hidden="true" />
                {approving
                  ? "جاري إنشاء النسخة..."
                  : isTailored
                  ? "إنشاء ملف التقديم — يستخدم تخصيصًا واحدًا"
                  : "اعتماد وفتح المحرر"}
              </button>
            </div>
          </div>
        )}

      {!loading && output?.status === "cannot_continue" && (
        <div className="resume-agent-loading is-error">
          <strong>ما قدرنا نكمل المسودة الآن</strong>
          <p>{output.message || "المعلومات الحالية غير كافية أو تحتاج مراجعة."}</p>
          {output.warnings?.length > 0 && (
            <ul>
              {output.warnings.map((warning, index) => (
                <li key={`cannot-warning-${index}`}>{warning}</li>
              ))}
            </ul>
          )}
          <div className="resume-agent-actions">
            <button type="button" onClick={onCancel}>
              رجوع
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default ResumeAgentFlow;
