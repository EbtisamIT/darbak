import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FaInstagram, FaSnapchatGhost, FaWhatsapp } from "react-icons/fa";
import { FiLink, FiShare2 } from "react-icons/fi";

const SHARE_MENU_WIDTH = 206;
const SHARE_MENU_HEIGHT = 110;
const VIEWPORT_MARGIN = 12;

function AirDropIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 18.5v-3.2" />
      <path d="M8.8 15.1a4.6 4.6 0 0 1 6.4 0" />
      <path d="M5.8 12.1a8.9 8.9 0 0 1 12.4 0" />
      <path d="M3.1 9.1a12.8 12.8 0 0 1 17.8 0" />
      <circle cx="12" cy="19.4" r="1.2" />
    </svg>
  );
}

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
  const [menuPosition, setMenuPosition] = useState(null);
  const wrapperRef = useRef(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const shareUrl = getAbsoluteShareUrl(url);
  const shareText = [text, shareUrl].filter(Boolean).join("\n");

  useEffect(() => {
    if (!isOpen) return undefined;

    const updateMenuPosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;

      const viewportWidth = window.innerWidth || SHARE_MENU_WIDTH;
      const viewportHeight = window.innerHeight || SHARE_MENU_HEIGHT;
      const width = Math.min(SHARE_MENU_WIDTH, viewportWidth - VIEWPORT_MARGIN * 2);
      let left = rect.right - width;
      let top = rect.bottom + 8;
      let opensUp = false;

      left = Math.max(
        VIEWPORT_MARGIN,
        Math.min(left, viewportWidth - width - VIEWPORT_MARGIN)
      );

      if (top + SHARE_MENU_HEIGHT > viewportHeight - VIEWPORT_MARGIN) {
        top = rect.top - SHARE_MENU_HEIGHT - 8;
        opensUp = true;
      }

      setMenuPosition({
        left,
        top: Math.max(VIEWPORT_MARGIN, top),
        width,
        opensUp,
      });
    };

    const closeOnOutsideClick = (event) => {
      const target = event.target;
      if (
        wrapperRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }

      setIsOpen(false);
    };

    updateMenuPosition();
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("touchstart", closeOnOutsideClick);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("touchstart", closeOnOutsideClick);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
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

  const shareMenu =
    isOpen && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            className={`share-card-menu ${menuPosition?.opensUp ? "opens-up" : ""}`}
            role="menu"
            aria-label="خيارات المشاركة"
            style={{
              top: `${menuPosition?.top || 0}px`,
              left: `${menuPosition?.left || VIEWPORT_MARGIN}px`,
              width: `${menuPosition?.width || SHARE_MENU_WIDTH}px`,
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="share-icon-option share-airdrop-option"
              onClick={openNativeShare}
              role="menuitem"
              aria-label="مشاركة الجهاز أو AirDrop"
              title="مشاركة الجهاز / AirDrop"
            >
              <AirDropIcon />
            </button>
            <button
              type="button"
              className="share-icon-option share-whatsapp-option"
              onClick={() =>
                openExternalShare(
                  "whatsapp",
                  `https://wa.me/?text=${encodeURIComponent(shareText)}`
                )
              }
              role="menuitem"
              aria-label="مشاركة عبر واتساب"
              title="واتساب"
            >
              <FaWhatsapp aria-hidden="true" />
            </button>
            <button
              type="button"
              className="share-icon-option share-snapchat-option"
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
              aria-label="مشاركة عبر سناب"
              title="سناب"
            >
              <FaSnapchatGhost aria-hidden="true" />
            </button>
            <button
              type="button"
              className="share-icon-option share-instagram-option"
              onClick={() =>
                openExternalShare("instagram", "https://www.instagram.com/", true)
              }
              role="menuitem"
              aria-label="مشاركة عبر انستقرام"
              title="انستقرام"
            >
              <FaInstagram aria-hidden="true" />
            </button>
            <button
              type="button"
              className="share-copy-option"
              onClick={copyLink}
              role="menuitem"
            >
              <FiLink aria-hidden="true" />
              <span>نسخ رابط</span>
            </button>
          </div>,
          document.body
        )
      : null;

  return (
    <div
      ref={wrapperRef}
      className={`share-card-control ${compact ? "is-compact" : ""}`}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        ref={buttonRef}
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
        <FiShare2 aria-hidden="true" />
        <span>{compact ? "شارك" : buttonLabel}</span>
      </button>

      {shareMenu}

      {status && <span className="share-card-status">{status}</span>}
    </div>
  );
}
