import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import API_BASE_URL from "../config/api";
import { trackEvent } from "../utils/analytics";
import majors from "../majors";
import { cityOptions as trainingCityOptions } from "./TrainingFinderPage";

const emptyQuestionForm = {
  organizationName: "",
  majorCategory: "",
  major: "",
  city: "",
  questions: "",
  note: "",
};

const normalizeText = (value = "") =>
  value
    .toString()
    .toLowerCase()
    .replace(/[أإآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ـ/g, "")
    .replace(/[\u064B-\u065F]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const uniqueSorted = (values = []) =>
  Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "ar")
  );

export default function InterviewsPage() {
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [selectedMajor, setSelectedMajor] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState(null);
  const [questionForm, setQuestionForm] = useState(emptyQuestionForm);
  const [submittingQuestion, setSubmittingQuestion] = useState(false);
  const [questionMessage, setQuestionMessage] = useState("");

  useEffect(() => {
    const fetchInterviews = async () => {
      try {
        setLoading(true);
        setError("");
        const { data } = await axios.get(`${API_BASE_URL}/api/interviews`);
        setInterviews(Array.isArray(data?.data) ? data.data : []);
      } catch (err) {
        console.error("Interviews fetch error:", err);
        setError("تعذر تحميل أسئلة المقابلات حاليًا.");
      } finally {
        setLoading(false);
      }
    };

    fetchInterviews();
    trackEvent("interviews_page_viewed");
  }, []);

  const majorOptions = useMemo(
    () => uniqueSorted(interviews.map((item) => item.major)),
    [interviews]
  );

  const cityOptions = useMemo(
    () =>
      uniqueSorted(
        interviews.flatMap((item) =>
          Array.isArray(item.cities) ? item.cities : []
        )
      ),
    [interviews]
  );

  const filteredInterviews = useMemo(() => {
    const normalizedQuery = normalizeText(query);

    return interviews.filter((item) => {
      if (selectedMajor && item.major !== selectedMajor) return false;
      if (
        selectedCity &&
        !(Array.isArray(item.cities) && item.cities.includes(selectedCity))
      ) {
        return false;
      }

      if (!normalizedQuery) return true;

      const searchable = [
        item.organizationName,
        item.major,
        item.majorCategory,
        ...(Array.isArray(item.cities) ? item.cities : []),
        ...(Array.isArray(item.questions) ? item.questions : []),
      ]
        .filter(Boolean)
        .map(normalizeText);

      return searchable.some((value) => value.includes(normalizedQuery));
    });
  }, [interviews, query, selectedCity, selectedMajor]);

  const formMajorOptions = useMemo(() => {
    const category = majors.find(
      (majorCategory) => majorCategory.name === questionForm.majorCategory
    );

    return category?.subMajors || [];
  }, [questionForm.majorCategory]);

  const citySelectOptions = useMemo(
    () => uniqueSorted([...trainingCityOptions, ...cityOptions]),
    [cityOptions]
  );

  useEffect(() => {
    if (!query && !selectedMajor && !selectedCity) return;

    const timer = window.setTimeout(() => {
      trackEvent("interviews_search", {
        searchQuery: query.trim(),
        major: selectedMajor,
        city: selectedCity,
        resultsCount: filteredInterviews.length,
      });
    }, 700);

    return () => window.clearTimeout(timer);
  }, [filteredInterviews.length, query, selectedCity, selectedMajor]);

  const updateQuestionForm = (field, value) => {
    setQuestionForm((prev) => {
      if (field === "majorCategory") {
        return { ...prev, majorCategory: value, major: "" };
      }

      return { ...prev, [field]: value };
    });
  };

  const closeQuestionModal = () => {
    if (submittingQuestion) return;
    setShowQuestionModal(false);
  };

  const openQuestionModal = () => {
    setShowQuestionModal(true);
    trackEvent("interview_questions_started", {
      metadata: {
        source: "interviews_page_cta",
      },
    });
  };

  const openInterviewDetails = (item) => {
    setSelectedInterview(item);
    trackEvent("interview_details_opened", {
      organizationName: item.organizationName,
      major: item.major,
      city: Array.isArray(item.cities) ? item.cities[0] || "" : "",
      metadata: {
        questionsCount: item.questionsCount || item.questions?.length || 0,
        sourcesCount: item.sourcesCount || 0,
      },
    });
  };

  const submitQuestionForm = async (event) => {
    event.preventDefault();

    const questions = questionForm.questions
      .split("\n")
      .map((question) => question.trim())
      .filter(Boolean);

    if (!questionForm.organizationName.trim() || !questionForm.major) {
      setQuestionMessage("اكتب اسم الجهة واختر التخصص قبل الإرسال.");
      return;
    }

    if (questions.length === 0) {
      setQuestionMessage("اكتب سؤال مقابلة واحدًا على الأقل.");
      return;
    }

    try {
      setSubmittingQuestion(true);
      setQuestionMessage("");

      await axios.post(`${API_BASE_URL}/api/interview-questions`, {
        ...questionForm,
        questions,
      });

      setQuestionForm(emptyQuestionForm);
      setQuestionMessage("وصلتنا أسئلتك، وبتظهر للطلاب بعد المراجعة. شكرًا لمشاركتك.");
      trackEvent("interview_questions_submitted", {
        organizationName: questionForm.organizationName.trim(),
        major: questionForm.major,
        city: questionForm.city,
        questionsCount: questions.length,
        metadata: {
          organizationName: questionForm.organizationName.trim(),
          questionsCount: questions.length,
          source: "interviews_page_modal",
        },
      });

      window.setTimeout(() => {
        setShowQuestionModal(false);
        setQuestionMessage("");
      }, 1600);
    } catch (err) {
      setQuestionMessage(
        err.response?.data?.error || "تعذر إرسال الأسئلة حاليًا."
      );
    } finally {
      setSubmittingQuestion(false);
    }
  };

  return (
    <main className="interviews-page" dir="rtl">
      <section className="interviews-hero">
        <span className="interviews-eyebrow">من تجارب دربك المعتمدة</span>
        <h1>مقابلات التدريب</h1>
        <p>
          أسئلة مقابلات شاركها الطلاب حسب الجهة والتخصص، تساعدك تستعد قبل
          المقابلة بدون توقعات عشوائية.
        </p>
      </section>

      <section className="interviews-contribute">
        <p>
          زكاة العلم نشره، شارك الطلاب أسئلة المقابلة لمساعدتهم على الاستعداد.
        </p>
        <button type="button" onClick={openQuestionModal}>
          شارك أسئلة مقابلة
        </button>
      </section>

      <section className="interviews-controls" aria-label="فلاتر المقابلات">
        <label>
          <span>البحث</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ابحث باسم الجهة، التخصص، أو السؤال"
          />
        </label>

        <label>
          <span>التخصص</span>
          <select
            value={selectedMajor}
            onChange={(event) => setSelectedMajor(event.target.value)}
          >
            <option value="">كل التخصصات</option>
            {majorOptions.map((major) => (
              <option key={major} value={major}>
                {major}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>المدينة</span>
          <select
            value={selectedCity}
            onChange={(event) => setSelectedCity(event.target.value)}
          >
            <option value="">كل المدن</option>
            {cityOptions.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </label>
      </section>

      <div className="interviews-summary" aria-live="polite">
        <strong>{filteredInterviews.length}</strong>
        <span>نتيجة مقابلة</span>
      </div>

      {loading ? (
        <div className="interviews-state">جارِ تحميل أسئلة المقابلات...</div>
      ) : error ? (
        <div className="interviews-state is-error">{error}</div>
      ) : filteredInterviews.length === 0 ? (
        <div className="interviews-state">
          لا توجد أسئلة مطابقة حاليًا. جرّب/ي البحث باسم جهة أو تخصص مختلف.
        </div>
      ) : (
        <section className="interviews-grid" aria-label="نتائج المقابلات">
          {filteredInterviews.map((item) => (
            <article
              className="interview-card"
              key={`${item.organizationName}-${item.major}`}
            >
              <div className="interview-card-simple">
                <span className="interview-card-label">اسم الشركة</span>
                <h2>{item.organizationName}</h2>
                <span className="interview-major-chip">{item.major}</span>
              </div>

              <div className="interview-card-footer">
                <button
                  type="button"
                  onClick={() => openInterviewDetails(item)}
                >
                  عرض التفاصيل
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      {selectedInterview && (
        <div
          className="interview-question-modal-overlay"
          onMouseDown={() => setSelectedInterview(null)}
        >
          <article
            className="interview-details-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="interview-question-modal-close"
              onClick={() => setSelectedInterview(null)}
              aria-label="إغلاق"
            >
              ×
            </button>

            <div className="interview-details-head">
              <span>تفاصيل مقابلة</span>
              <h2>{selectedInterview.organizationName}</h2>
              <p>
                أسئلة مرتبطة بتخصص {selectedInterview.major}
                {Array.isArray(selectedInterview.cities) &&
                selectedInterview.cities.length > 0
                  ? ` في ${selectedInterview.cities.join("، ")}`
                  : ""}.
              </p>
            </div>

            <div className="interview-details-meta">
              <span>{selectedInterview.major}</span>
              {selectedInterview.majorCategory && (
                <span>{selectedInterview.majorCategory}</span>
              )}
              <span>
                {selectedInterview.sourcesCount || 1} مصدر
              </span>
              <span>
                {selectedInterview.questionsCount ||
                  selectedInterview.questions?.length ||
                  0}{" "}
                سؤال
              </span>
            </div>

            <div className="interview-details-questions">
              {(selectedInterview.questions || []).map((question, index) => (
                <p key={`${selectedInterview.organizationName}-detail-${index}`}>
                  {question}
                </p>
              ))}
            </div>
          </article>
        </div>
      )}

      {showQuestionModal && (
        <div
          className="interview-question-modal-overlay"
          onMouseDown={closeQuestionModal}
        >
          <form
            className="interview-question-modal"
            onSubmit={submitQuestionForm}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="interview-question-modal-close"
              onClick={closeQuestionModal}
              aria-label="إغلاق"
            >
              ×
            </button>

            <div className="interview-question-modal-head">
              <span>مشاركة معرفة</span>
              <h2>أضف أسئلة مقابلة تدريب</h2>
              <p>
                اكتب الأسئلة كما تتذكرها، وبعد مراجعتها بتظهر للطلاب حسب
                الجهة والتخصص.
              </p>
            </div>

            <div className="interview-question-form-grid">
              <label>
                <span>اسم الجهة</span>
                <input
                  value={questionForm.organizationName}
                  onChange={(event) =>
                    updateQuestionForm("organizationName", event.target.value)
                  }
                  placeholder="مثال: STC أو هيئة السوق المالية"
                  required
                />
              </label>

              <label>
                <span>التخصص الرئيسي</span>
                <select
                  value={questionForm.majorCategory}
                  onChange={(event) =>
                    updateQuestionForm("majorCategory", event.target.value)
                  }
                >
                  <option value="">اختر التصنيف</option>
                  {majors.map((majorCategory) => (
                    <option key={majorCategory.name} value={majorCategory.name}>
                      {majorCategory.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>التخصص</span>
                <select
                  value={questionForm.major}
                  onChange={(event) =>
                    updateQuestionForm("major", event.target.value)
                  }
                  required
                  disabled={!questionForm.majorCategory}
                >
                  <option value="">
                    {questionForm.majorCategory
                      ? "اختر التخصص"
                      : "اختر التصنيف أولًا"}
                  </option>
                  {formMajorOptions.map((major) => (
                    <option key={major} value={major}>
                      {major}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>المدينة</span>
                <select
                  value={questionForm.city}
                  onChange={(event) => updateQuestionForm("city", event.target.value)}
                >
                  <option value="">اختياري</option>
                  {citySelectOptions.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="interview-question-full-field">
              <span>أسئلة المقابلة</span>
              <textarea
                value={questionForm.questions}
                onChange={(event) =>
                  updateQuestionForm("questions", event.target.value)
                }
                rows={5}
                placeholder={"اكتب كل سؤال في سطر مستقل\nمثال: تحدث عن نفسك\nما الفرق بين قائمة الدخل والميزانية؟"}
                required
              />
            </label>

            <label className="interview-question-full-field">
              <span>ملاحظة بسيطة إن وجدت</span>
              <textarea
                value={questionForm.note}
                onChange={(event) => updateQuestionForm("note", event.target.value)}
                rows={2}
                placeholder="مثلًا: المقابلة كانت باللغة الإنجليزية أو كان فيه اختبار قصير"
              />
            </label>

            {questionMessage && (
              <div className="interview-question-message">{questionMessage}</div>
            )}

            <div className="interview-question-actions">
              <button
                type="button"
                onClick={closeQuestionModal}
                disabled={submittingQuestion}
              >
                إلغاء
              </button>
              <button type="submit" disabled={submittingQuestion}>
                {submittingQuestion ? "جارِ الإرسال..." : "إرسال للمراجعة"}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
