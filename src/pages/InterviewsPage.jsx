import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import API_BASE_URL from "../config/api";
import { trackEvent } from "../utils/analytics";

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
              <div className="interview-card-head">
                <div>
                  <span className="interview-card-label">الجهة</span>
                  <h2>{item.organizationName}</h2>
                </div>
                <span className="interview-count">
                  {item.experiencesCount} تجربة
                </span>
              </div>

              <div className="interview-tags">
                <span>{item.major}</span>
                {item.majorCategory && <span>{item.majorCategory}</span>}
                {Array.isArray(item.cities) &&
                  item.cities.slice(0, 2).map((city) => (
                    <span key={`${item.organizationName}-${city}`}>{city}</span>
                  ))}
              </div>

              <div className="interview-questions">
                {(item.questions || []).slice(0, 5).map((question, index) => (
                  <p key={`${item.organizationName}-${item.major}-${index}`}>
                    {question}
                  </p>
                ))}
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
