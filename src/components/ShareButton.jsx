import React, { useEffect, useRef, useState } from "react";

const getAbsoluteShareUrl = (url = "") => {
  if (!url) return "";
  if (typeof window === "undefined") return url;

  try {
    return new URL(url, window.location.origin).toString();
  } catch (error) {
    return `${window.location.origin}${url.startsWith("/") ? "" : "/"}${url}`;
  }
};

const writeClipboard = async (value) => {
  if (!value) return false;

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return true;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  return copied;
};

export default function ShareButton({
  title = "دربك",
  text = "شوف هذا الرابط من منصة دربك",
  url = "/",
  buttonLabel = "مشاركة صديق",
  compact = false,
  onShareAction,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState("");
  const wrapperRef = useRef(null);
  const shareUrl = getAbsoluteShareUrl(url);
  const shareText = [text, shareUrl].filter(Boolean).join("\n");

  useEffect(() => {
    if (!isOpen) return undefined;

    const closeOnOutsideClick = (event) => {
      if (!wrapperRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [isOpen]);

  const reportAction = (action) => {
    onShareAction?.(action);
  };

  const openNativeShare = async () => {
    reportAction("native");

    try {
      if (navigator.share) {
        await navigator.share({ title, text, url: shareUrl });
        setStatus("تم فتح خيارات المشاركة.");
      } else {
        await writeClipboard(shareText);
        setStatus("تم نسخ الرابط.");
      }
      setIsOpen(false);
    } catch (error) {
      if (error?.name !== "AbortError") {
        setStatus("انسخ الرابط يدويًا إذا لم تظهر المشاركة.");
      }
    }
  };

  const copyLink = async () => {
    reportAction("copy");

    try {
      await writeClipboard(shareUrl);
      setStatus("تم نسخ الرابط.");
      setIsOpen(false);
    } catch (error) {
      setStatus("تعذر النسخ، جرّب مشاركة الجهاز.");
    }
  };

  const openExternalShare = async (action, targetUrl, shouldCopyFirst = false) => {
    reportAction(action);

    if (shouldCopyFirst) {
      try {
        await writeClipboard(shareText);
        setStatus("تم نسخ الرابط، ألصقه في التطبيق.");
      } catch (error) {
        setStatus("");
      }
    }

    window.open(targetUrl, "_blank", "noopener,noreferrer");
    setIsOpen(false);
  };

  return (
    <div
      ref={wrapperRef}
      className={`share-card-control ${compact ? "is-compact" : ""}`}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="share-card-button"
        onClick={(event) => {
          event.stopPropagation();
          setStatus("");
          setIsOpen((current) => !current);
        }}
        aria-expanded={isOpen}
        aria-label={buttonLabel}
        title={buttonLabel}
      >
        <span aria-hidden="true">↗</span>
        <span>{compact ? "شارك" : buttonLabel}</span>
      </button>

      {isOpen && (
        <div className="share-card-menu" role="menu" aria-label="خيارات المشاركة">
          <button type="button" onClick={openNativeShare} role="menuitem">
            <span aria-hidden="true">⌁</span>
            <span>مشاركة الجهاز / AirDrop</span>
          </button>
          <button type="button" onClick={copyLink} role="menuitem">
            <span aria-hidden="true">⧉</span>
            <span>نسخ الرابط</span>
          </button>
          <button
            type="button"
            onClick={() =>
              openExternalShare(
                "whatsapp",
                `https://wa.me/?text=${encodeURIComponent(shareText)}`
              )
            }
            role="menuitem"
          >
            <span aria-hidden="true">☘</span>
            <span>واتساب</span>
          </button>
          <button
            type="button"
            onClick={() =>
              openExternalShare(
                "snapchat",
                `https://www.snapchat.com/scan?attachmentUrl=${encodeURIComponent(
                  shareUrl
                )}`,
                true
              )
            }
            role="menuitem"
          >
            <span aria-hidden="true">◒</span>
            <span>سناب</span>
          </button>
          <button
            type="button"
            onClick={() =>
              openExternalShare("instagram", "https://www.instagram.com/", true)
            }
            role="menuitem"
          >
            <span aria-hidden="true">◎</span>
            <span>انستقرام</span>
          </button>
        </div>
      )}

      {status && <span className="share-card-status">{status}</span>}
    </div>
  );
}
