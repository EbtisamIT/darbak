import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import API_BASE_URL from "../config/api";
import { trackEvent } from "../utils/analytics";

const defaultQuestions = [
  "أفضل جهات التدريب لتخصص علوم الحاسب بالرياض؟",
  "ماذا قال الطلاب عن تدريب STC؟",
  "هل يوجد تجارب لتخصص المحاسبة في جدة؟",
  "ما الجهات التي حصل فيها الطلاب على مكافأة؟",
];

const introMessage = {
  role: "assistant",
  type: "intro",
  title: "اسأل مساعد دربك",
  intro:
    "أجاوبك من تجارب دربك فقط: جهات، تخصصات، مدن، مكافآت، تقييمات وملاحظات الطلاب.",
  bullets: [
    "لا أستخدم الإنترنت.",
    "لا أخترع معلومات غير موجودة.",
    "إذا البيانات غير كافية بقول لك بوضوح.",
  ],
};

export default function DarbakAssistant() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([introMessage]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const openAssistant = () => setIsOpen(true);
    window.addEventListener("darbak:open-smart-assistant", openAssistant);
    return () =>
      window.removeEventListener("darbak:open-smart-assistant", openAssistant);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 120);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading]);

  const sendQuestion = async (text) => {
    const cleanQuestion = text.trim();
    if (!cleanQuestion || isLoading) return;

    setIsOpen(true);
    setQuestion("");
    setMessages((currentMessages) => [
      ...currentMessages,
      { role: "user", text: cleanQuestion },
    ]);

    try {
      setIsLoading(true);
      const { data } = await axios.post(`${API_BASE_URL}/api/smart-assistant/query`, {
        question: cleanQuestion,
      });

      setMessages((currentMessages) => [
        ...currentMessages,
        { role: "assistant", type: "answer", data },
      ]);

      trackEvent("smart_assistant_query", {
        searchQuery: cleanQuestion,
        resultsCount: data.count || 0,
        metadata: {
          intent: data.intent,
          organizations: data.filters?.organizations || [],
          cities: data.filters?.cities || [],
          majors: data.filters?.majors || [],
        },
      });
    } catch (err) {
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          role: "assistant",
          type: "error",
          title: "تعذر تحليل السؤال",
          intro:
            err.response?.data?.error ||
            "صار خطأ مؤقت أثناء قراءة تجارب دربك. حاول مرة ثانية.",
          bullets: [],
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const submitQuestion = (event) => {
    event.preventDefault();
    sendQuestion(question);
  };

  const openRelatedExperiences = (url = "/experiences") => {
    setIsOpen(false);
    navigate(url);
  };

  const renderAssistantAnswer = (message, index) => {
    const answer = message.data?.answer || message;
    const count = message.data?.count;
    const relatedUrl = message.data?.relatedUrl || answer.relatedUrl;
    const previews = message.data?.experiences || [];

    return (
      <div className="darbak-assistant-message is-assistant" key={index}>
        <div className="darbak-assistant-answer-head">
          <strong>{answer.title}</strong>
          {typeof count === "number" && <span>{count} تجربة</span>}
        </div>
        {answer.intro && <p>{answer.intro}</p>}
        {Array.isArray(answer.paragraphs) &&
          answer.paragraphs.map((paragraph) => (
            <p className="darbak-assistant-paragraph" key={paragraph}>
              {paragraph}
            </p>
          ))}
        {Array.isArray(answer.bullets) && answer.bullets.length > 0 && (
          <ul>
            {answer.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        )}
        {Array.isArray(answer.quotes) && answer.quotes.length > 0 && (
          <div className="darbak-assistant-quotes">
            {answer.quotes.map((quote) => (
              <blockquote key={`${quote.label}-${quote.text}`}>
                <span>{quote.label}</span>
                <p>“{quote.text}”</p>
              </blockquote>
            ))}
          </div>
        )}
        {answer.closing && (
          <p className="darbak-assistant-closing">{answer.closing}</p>
        )}
        {answer.note && <small>{answer.note}</small>}

        {previews.length > 0 && (
          <div className="darbak-assistant-preview-list">
            {previews.slice(0, 3).map((exp) => (
              <div className="darbak-assistant-preview" key={exp.id}>
                <strong>{exp.organizationName}</strong>
                <span>
                  {exp.city} · {exp.major || "تخصص غير محدد"} · {exp.rating || "-"}
                  /5
                </span>
              </div>
            ))}
          </div>
        )}

        {relatedUrl && (
          <button
            type="button"
            className="darbak-assistant-related-button"
            onClick={() => openRelatedExperiences(relatedUrl)}
          >
            {message.data?.relatedLabel || "عرض التجارب المرتبطة"}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="darbak-assistant-widget" dir="rtl">
      {isOpen && (
        <section className="darbak-assistant-panel" aria-label="مساعد دربك الذكي">
          <div className="darbak-assistant-panel-head">
            <div>
              <span>مساعد دربك الذكي</span>
              <p>يعتمد فقط على تجارب المنصة</p>
            </div>
            <button
              type="button"
              aria-label="إغلاق المساعد"
              onClick={() => setIsOpen(false)}
            >
              ×
            </button>
          </div>

          <div className="darbak-assistant-messages">
            {messages.map((message, index) =>
              message.role === "user" ? (
                <div className="darbak-assistant-message is-user" key={index}>
                  {message.text}
                </div>
              ) : (
                renderAssistantAnswer(message, index)
              )
            )}
            {isLoading && (
              <div className="darbak-assistant-message is-assistant">
                <p>أقرأ التجارب المطابقة داخل دربك...</p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="darbak-assistant-quick-questions">
            {defaultQuestions.map((item) => (
              <button
                type="button"
                key={item}
                onClick={() => sendQuestion(item)}
                disabled={isLoading}
              >
                {item}
              </button>
            ))}
          </div>

          <form className="darbak-assistant-form" onSubmit={submitQuestion}>
            <input
              ref={inputRef}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="اكتب سؤالك عن جهة، تخصص أو مدينة..."
              disabled={isLoading}
            />
            <button type="submit" disabled={isLoading || !question.trim()}>
              اسأل
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        className="darbak-assistant-trigger"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
      >
        <span>المساعد الذكي</span>
        <strong>اسأل</strong>
      </button>
    </div>
  );
}
