import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { pdf } from "@react-pdf/renderer";
import API_BASE_URL from "../config/api";
import ResumePdfDocument from "../features/resume/ResumePdfDocument";
import { getResumeFileName, normalizeResume } from "../features/resume/resumeDefaults";
import { trackEvent } from "../utils/analytics";
import { getAccessHeaders, getStoredAccessIdentity } from "../utils/premiumAccess";
import {
  buildEmailApplicationHref,
  getApplicationEmail,
  getEmailApplicationFallback,
  getEmailApplicationMessage,
  getEmailApplicationSubject,
} from "../utils/emailApplication";
import "./EmailApplicationSheet.css";

const copyText = async (value) => {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
  const field = document.createElement("textarea");
  field.value = value;
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.select();
  const copied = document.execCommand("copy");
  field.remove();
  if (!copied) throw new Error("Copy unavailable");
};

export default function EmailApplicationSheet({ opportunity, hasMasterResume, onClose, onOpenMail }) {
  const email = getApplicationEmail(opportunity);
  const identity = getStoredAccessIdentity();
  const [subject, setSubject] = useState(() => getEmailApplicationSubject(opportunity));
  const [message, setMessage] = useState(() => getEmailApplicationMessage(opportunity, identity.firstName || identity.name || ""));
  const [notice, setNotice] = useState("");
  const [hasRewardPdf, setHasRewardPdf] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const panelRef = useRef(null);
  const fallbackUrl = getEmailApplicationFallback(opportunity);
  const opportunityId = opportunity._id || opportunity.id || "";

  useEffect(() => {
    if (!identity.contact || !identity.accessCode) return undefined;
    let active = true;
    axios.get(`${API_BASE_URL}/api/rewards/resume/me`, { headers: getAccessHeaders() })
      .then(({ data }) => {
        if (active) setHasRewardPdf(data?.reward?.status === "redeemed");
      })
      .catch(() => null);
    return () => { active = false; };
  }, [identity.contact, identity.accessCode]);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector("button")?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const controls = [...panelRef.current.querySelectorAll("button:not(:disabled), textarea, input, a[href]")];
      if (!controls.length) return;
      if (event.shiftKey && document.activeElement === controls[0]) {
        event.preventDefault(); controls[controls.length - 1].focus();
      } else if (!event.shiftKey && document.activeElement === controls[controls.length - 1]) {
        event.preventDefault(); controls[0].focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [onClose]);

  const copy = async (value, eventName, successText) => {
    try {
      await copyText(value);
      setNotice(successText);
      try { trackEvent(eventName, { metadata: { opportunityId } }); } catch { /* Analytics never blocks copying. */ }
    } catch {
      setNotice("تعذر النسخ تلقائيًا. حددي النص وانسخيه يدويًا.");
    }
  };

  const downloadRewardResume = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/rewards/resume/pdf`, {
        headers: getAccessHeaders(), responseType: "blob",
      });
      const url = URL.createObjectURL(new Blob([data], { type: "application/pdf" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "darbak-ats-classic.pdf";
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setNotice("تعذر تنزيل السيرة الآن. يمكنك تنزيلها من حسابك.");
    } finally {
      setDownloading(false);
    }
  };

  const downloadMasterResume = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const { data } = await axios.get(`${API_BASE_URL}/api/resume/me`, {
        headers: getAccessHeaders({ itemKey: "resume:me" }),
      });
      if (!data?.masterResumeExists || !data.resume) throw new Error("Resume unavailable");
      const resume = normalizeResume(data.resume);
      const blob = await pdf(<ResumePdfDocument resume={resume} />).toBlob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = getResumeFileName(resume);
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1200);
    } catch {
      setNotice("تعذر تنزيل السيرة الآن. يمكنك تنزيلها من حسابك.");
    } finally {
      setDownloading(false);
    }
  };

  const openMail = () => {
    if (!email) return;
    const href = buildEmailApplicationHref({ email, subject, body: message });
    onOpenMail(opportunity);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.click();
  };

  return <div className="email-application-overlay" onClick={onClose}>
    <section ref={panelRef} className="email-application-sheet" role="dialog" aria-modal="true" aria-labelledby="email-application-title" dir="rtl" onClick={(event) => event.stopPropagation()}>
      <header className="email-application-head">
        <div><span className="email-application-eyebrow">قبل فتح البريد</span><h2 id="email-application-title">التقديم عبر البريد</h2></div>
        <button type="button" className="email-application-close" aria-label="إغلاق" onClick={onClose}>×</button>
      </header>
      {!email ? <div className="email-application-missing" role="alert">
        <p>بريد التقديم لهذه الفرصة غير متاح أو غير صالح حاليًا.</p>
        {fallbackUrl && <a href={fallbackUrl} target="_blank" rel="noopener noreferrer">عرض مصدر الفرصة</a>}
      </div> : <>
        <div className="email-application-field">
          <span>إلى</span>
          <div className="email-application-address"><bdi dir="ltr">{email}</bdi><button type="button" onClick={() => copy(email, "email_address_copied", "تم نسخ البريد.")}>نسخ البريد</button></div>
        </div>
        <label className="email-application-field">عنوان الرسالة
          <input type="text" value={subject} onChange={(event) => setSubject(event.target.value)} dir="auto" />
        </label>
        <label className="email-application-field">رسالة مقترحة
          <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows="8" dir="auto" />
        </label>
        <div className="email-application-resume">
          {hasRewardPdf || hasMasterResume ? <>
            <strong>سيرتك جاهزة للإرفاق ✓</strong>
            <button type="button" onClick={hasRewardPdf ? downloadRewardResume : downloadMasterResume} disabled={downloading}>تنزيل السيرة</button>
          </> : <p>لا تنسَ إرفاق سيرتك الذاتية قبل الإرسال.</p>}
          <small>لا يستطيع دربك إرفاق الملف تلقائيًا.</small>
        </div>
        {notice && <p className="email-application-notice" role="status">{notice}</p>}
        <div className="email-application-actions">
          <button type="button" className="email-application-primary" onClick={openMail}>فتح تطبيق البريد</button>
          <button type="button" onClick={() => copy(message, "email_message_copied", "تم نسخ الرسالة.")}>نسخ الرسالة</button>
        </div>
      </>}
    </section>
  </div>;
}
