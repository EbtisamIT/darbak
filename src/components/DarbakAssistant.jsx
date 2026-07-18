import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiMessageCircle, FiSend } from "react-icons/fi";
import axios from "axios";
import API_BASE_URL from "../config/api";
import { trackEvent } from "../utils/analytics";

const defaultQuestions = [
  "أنا ضايع/ة وما أعرف من وين أبدأ، وش أسوي؟",
  "كيف أكتب إيميل تقديم للتدريب؟",
  "كيف أجهز CV للتدريب؟",
  "كيف أستعد للمقابلة؟",
  "وش أهم شيء أشيك عليه قبل أختار جهة؟",
  "ماذا قال الطلاب عن تدريب STC؟",
];

const introMessage = {
  role: "assistant",
  type: "intro",
  title: "دليل دربك",
  intro:
    "أنا دليل يساعدك تفهم تجارب التدريب في دربك، وأسئلة التقديم، المقابلات، اختيار الجهة، وتجهيز نفسك للتدريب.",
  bullets: [
    "إذا سألت عن جهة أو تخصص، أقرأ تجارب دربك فقط بدون إنترنت.",
    "إذا سألت سؤال تدريب عام، أعطيك خطوات عملية وواضحة.",
    "إذا ما لقيت بيانات كافية، أقول لك بوضوح بدون اختراع.",
  ],
};

const getLatestAssistantContext = (conversationMessages = []) => {
  const lastAnswer = [...conversationMessages]
    .reverse()
    .find((message) => message.role === "assistant" && message.type === "answer");

  if (!lastAnswer?.data) return null;

  return {
    question: lastAnswer.data.question || "",
    intent: lastAnswer.data.intent || "",
    filters: lastAnswer.data.filters || {},
    relatedUrl: lastAnswer.data.relatedUrl || "",
  };
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
    const context = getLatestAssistantContext(messages);

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
        context,
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
          usedContext: data.usedContext,
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
    const shouldShowCount = typeof count === "number" && !answer.hideCount;
    const relatedUrl = message.data?.relatedUrl || answer.relatedUrl;
    const previews = message.data?.experiences || [];

    return (
      <div className="darbak-assistant-message is-assistant" key={index}>
        <div className="darbak-assistant-answer-head">
          <strong>{answer.title}</strong>
          {shouldShowCount && <span>{count} تجربة</span>}
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
        <section className="darbak-assistant-panel" aria-label="دليل دربك">
          <div className="darbak-assistant-panel-head">
            <div className="darbak-assistant-panel-brand">
              <span className="darbak-assistant-panel-icon" aria-hidden="true">
                <FiMessageCircle />
              </span>
              <div>
                <span>دليل دربك</span>
                <p>اسأل عن التدريب، التقديم، المقابلات أو الجهات</p>
              </div>
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
            <span className="darbak-assistant-quick-title">أسئلة مقترحة</span>
            <div className="darbak-assistant-quick-list">
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
              <FiSend aria-hidden="true" />
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
        <span className="darbak-assistant-trigger-icon" aria-hidden="true">
          <FiMessageCircle />
        </span>
        <span className="darbak-assistant-trigger-copy">
          <strong>دليل دربك</strong>
          <small>شات التجارب</small>
        </span>
      </button>
    </div>
  );
}
