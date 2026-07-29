import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import QRCode from "qrcode";
import API_BASE_URL from "../config/api";
import { cityOptions, specializationOptions } from "./TrainingFinderPage";
import {
  getStoredAccessIdentity,
  saveAccessIdentity,
} from "../utils/premiumAccess";
import { getVisitorId, trackEvent } from "../utils/analytics";
import logo from "./logo.png";

const PORTFOLIO_BADGE_LINKEDIN_MESSAGE =
  "شارك ملفك في LinkedIn وأخبر الشركات أنك جاهز للتدريب.";

const readinessOptions = [
  "جاهز للتقديم",
  "مستعد ومؤهل للمقابلات الشخصية",
  "أبحث عن تدريب تعاوني",
  "أبحث عن فرصة تدريب صيفي",
  "جاهز للتواصل مع جهات التدريب",
  "أخرى",
];

const degreeOptions = [
  "دبلوم",
  "بكالوريوس",
  "ماجستير",
  "حديث تخرج",
  "طالب تدريب تعاوني",
  "أخرى",
];

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
  "أخرى",
];

const portfolioCityOptions = Array.from(
  new Set([
    ...cityOptions,
    "الرياض",
    "جدة",
    "مكة",
    "المدينة المنورة",
    "الدمام",
    "الخبر",
    "الظهران",
    "الأحساء",
    "القطيف",
    "الجبيل",
    "رأس تنورة",
    "الخفجي",
    "حفر الباطن",
    "بقيق",
    "النعيرية",
    "القصيم",
    "بريدة",
    "عنيزة",
    "الرس",
    "البكيرية",
    "البدائع",
    "أبها",
    "خميس مشيط",
    "بيشة",
    "محايل عسير",
    "النماص",
    "جازان",
    "صبيا",
    "أبو عريش",
    "صامطة",
    "نجران",
    "تبوك",
    "حائل",
    "الجوف",
    "سكاكا",
    "عرعر",
    "رفحاء",
    "طريف",
    "الباحة",
    "الطائف",
    "ينبع",
    "رابغ",
    "القنفذة",
    "الليث",
    "الدوادمي",
    "المجمعة",
    "الزلفي",
    "شقراء",
    "عفيف",
    "وادي الدواسر",
    "أخرى",
  ])
);

const emptyProject = { title: "", description: "", url: "" };
const emptyCertification = { title: "", provider: "", year: "" };

const emptyForm = {
  slug: "",
  fullName: "",
  major: "",
  majorOther: "",
  university: "",
  universityOther: "",
  city: "",
  cityOther: "",
  dateOfBirth: "",
  degreeLevel: "",
  degreeOther: "",
  readinessStatus: "مستعد ومؤهل للمقابلات الشخصية",
  readinessOther: "",
  targetOrganizations: "",
  bio: "",
  skills: "",
  linkedinUrl: "",
  email: "",
  isPublished: false,
  projects: [{ ...emptyProject }],
  certifications: [{ ...emptyCertification }],
};

const getDeviceType = () => {
  if (typeof window === "undefined") return "unknown";
  if (window.innerWidth < 768) return "mobile";
  if (window.innerWidth < 1024) return "tablet";
  return "desktop";
};

const isValidEmail = (value = "") =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase());

const formatList = (items = []) => (Array.isArray(items) ? items.join("، ") : "");

const normalizeForm = (portfolio = {}) => ({
  ...emptyForm,
  slug: portfolio.slug || "",
  fullName: portfolio.fullName || "",
  major: portfolio.major || "",
  university: portfolio.university || "",
  city: portfolio.city || "",
  dateOfBirth: portfolio.dateOfBirth || "",
  degreeLevel: portfolio.degreeLevel || "",
  readinessStatus:
    portfolio.readinessStatus || "مستعد ومؤهل للمقابلات الشخصية",
  targetOrganizations: formatList(portfolio.targetOrganizations),
  bio: portfolio.bio || "",
  skills: formatList(portfolio.skills),
  linkedinUrl: portfolio.linkedinUrl || "",
  email: portfolio.email || "",
  isPublished: Boolean(portfolio.isPublished),
  projects:
    portfolio.projects?.length > 0
      ? portfolio.projects.map((project) => ({
          title: project.title || "",
          description: project.description || "",
          url: project.url || "",
        }))
      : [{ ...emptyProject }],
  certifications:
    portfolio.certifications?.length > 0
      ? portfolio.certifications.map((certification) => ({
          title: certification.title || "",
          provider: certification.provider || "",
          year: certification.year || "",
        }))
      : [{ ...emptyCertification }],
});

const compressAvatar = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const maxSide = 900;
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("تعذر ضغط الصورة."));
              return;
            }
            resolve(blob);
          },
          "image/webp",
          0.82
        );
      };
      image.onerror = () => reject(new Error("تعذر قراءة الصورة."));
      image.src = reader.result;
    };
    reader.onerror = () => reject(new Error("تعذر قراءة الصورة."));
    reader.readAsDataURL(file);
  });

const getSafeOrigin = () =>
  typeof window !== "undefined" ? window.location.origin : "https://darbak.space";

const makeSafeSlug = (value = "") =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 34);

const getPortfolioShareUrl = (publicUrl, slug) => {
  if (publicUrl) return publicUrl;
  return `${getSafeOrigin()}/p/${makeSafeSlug(slug) || "student"}`;
};

const getReferralCode = (contact = "", slug = "") => {
  const source =
    makeSafeSlug(slug) ||
    makeSafeSlug(contact.split("@")[0]) ||
    makeSafeSlug(getVisitorId()) ||
    "student";
  return `${source.slice(0, 24)}-ready`;
};

const drawCanvasRoundRect = (context, x, y, width, height, radius) => {
  if (typeof context.roundRect === "function") {
    context.roundRect(x, y, width, height, radius);
    return;
  }

  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - safeRadius,
    y + height
  );
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
};

const writeWrappedCanvasText = (
  context,
  text,
  x,
  y,
  maxWidth,
  lineHeight,
  maxLines = 3
) => {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let currentLine = "";

  words.forEach((word) => {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (context.measureText(nextLine).width <= maxWidth) {
      currentLine = nextLine;
      return;
    }
    if (currentLine) lines.push(currentLine);
    currentLine = word;
  });

  if (currentLine) lines.push(currentLine);

  lines.slice(0, maxLines).forEach((line, index) => {
    const renderedLine =
      index === maxLines - 1 && lines.length > maxLines ? `${line}...` : line;
    context.fillText(renderedLine, x, y + index * lineHeight);
  });

  return Math.min(lines.length, maxLines) * lineHeight;
};

const loadCanvasImage = (source = "") =>
  new Promise((resolve) => {
    if (!source) {
      resolve(null);
      return;
    }

    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = source;
  });

const drawCircularImage = (context, image, x, y, size) => {
  context.save();
  context.beginPath();
  context.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  context.clip();

  const imageRatio = image.width / image.height;
  const boxRatio = 1;
  let drawWidth = size;
  let drawHeight = size;
  let offsetX = x;
  let offsetY = y;

  if (imageRatio > boxRatio) {
    drawWidth = size * imageRatio;
    offsetX = x - (drawWidth - size) / 2;
  } else {
    drawHeight = size / imageRatio;
    offsetY = y - (drawHeight - size) / 2;
  }

  context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
  context.restore();
};

export default function PortfolioBuilderPage() {
  const [identity, setIdentity] = useState(() => getStoredAccessIdentity());
  const [authForm, setAuthForm] = useState(() => {
    const stored = getStoredAccessIdentity();
    return {
      contact: stored.contact || stored.email || "",
      accessCode: stored.accessCode || "",
    };
  });
  const [form, setForm] = useState(emptyForm);
  const [publicUrl, setPublicUrl] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [cvFile, setCvFile] = useState(null);
  const [savedCvLabel, setSavedCvLabel] = useState("");
  const [badgeTheme, setBadgeTheme] = useState("dark");
  const [message, setMessage] = useState("");
  const [badgePostReady, setBadgePostReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const contact = identity.contact || identity.email || authForm.contact.trim();
  const accessCode = identity.accessCode || authForm.accessCode.trim();
  const isAuthenticated = Boolean(contact && accessCode);

  const majorValue = form.major === "أخرى" ? form.majorOther : form.major;
  const cityValue = form.city === "أخرى" ? form.cityOther : form.city;
  const universityValue =
    form.university === "أخرى" ? form.universityOther : form.university;
  const degreeValue =
    form.degreeLevel === "أخرى" ? form.degreeOther : form.degreeLevel;
  const readinessValue =
    form.readinessStatus === "أخرى"
      ? form.readinessOther
      : form.readinessStatus;
  const skillItems = useMemo(
    () =>
      form.skills
        .split(/[,،]/)
        .map((skill) => skill.trim())
        .filter(Boolean)
        .slice(0, 8),
    [form.skills]
  );

  const activeProjects = form.projects.filter(
    (project) => project.title || project.description || project.url
  );
  const activeCertifications = form.certifications.filter(
    (certification) =>
      certification.title || certification.provider || certification.year
  );
  const portfolioShareUrl = getPortfolioShareUrl(publicUrl, form.slug);
  const referralCode = useMemo(
    () => getReferralCode(contact, form.slug),
    [contact, form.slug]
  );
  const referralUrl = `${getSafeOrigin()}/?ref=${encodeURIComponent(referralCode)}`;
  const linkedInShareText = [
    "سعيد بمشاركة بطاقة جاهزية التدريب التعاوني وملف أعمالي الرقمي عبر منصة دربك.",
    readinessValue ? `حالتي المهنية: ${readinessValue}.` : "",
    majorValue ? `تخصصي: ${majorValue}.` : "",
    "جاهز لفرص التدريب والتواصل المهني.",
    portfolioShareUrl,
    "#جاهز_مع_دربك",
  ]
    .filter(Boolean)
    .join("\n");
  const badgeLinkedInPost = [
    "جاهز للتدريب التعاوني عبر ملف أعمالي الرقمي في منصة دربك.",
    "",
    "جمعت بياناتي، مهاراتي، مشاريعي، ورابط ملفي المهني في بطاقة واحدة يسهل مشاركتها مع جهات التدريب.",
    ...(majorValue ? [`التخصص: ${majorValue}`] : []),
    ...(cityValue ? [`المدينة: ${cityValue}`] : []),
    "",
    `رابط الملف: ${portfolioShareUrl}`,
    "",
    "#جاهز_مع_دربك",
  ].join("\n");

  const fetchPortfolio = async (identityOverride = identity) => {
    const nextContact =
      identityOverride.contact || identityOverride.email || authForm.contact.trim();
    const nextAccessCode = identityOverride.accessCode || authForm.accessCode.trim();

    if (!nextContact || !nextAccessCode) return;

    try {
      setLoading(true);
      setMessage("");
      const { data } = await axios.get(`${API_BASE_URL}/api/portfolio/me`, {
        headers: {
          "x-darbak-contact": nextContact,
          "x-darbak-access-code": nextAccessCode,
        },
      });
      setForm(normalizeForm(data.portfolio));
      setPublicUrl(data.publicUrl || "");
      setSavedCvLabel(data.portfolio?.cvAssetId ? "تم حفظ ملف PDF" : "");
      const storedAvatar =
        data.portfolio?.avatarAssetUrl || data.portfolio?.avatarUrl || "";
      if (storedAvatar) setAvatarPreview(storedAvatar);
    } catch (err) {
      setMessage(err.response?.data?.error || "تعذر تحميل ملف الأعمال.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (identity.contact && identity.accessCode) fetchPortfolio(identity);
    trackEvent("portfolio_builder_opened");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setMessage("");
  };

  const updateListItem = (listName, index, field, value) => {
    setForm((current) => ({
      ...current,
      [listName]: current[listName].map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      ),
    }));
    setMessage("");
  };

  const addListItem = (listName, emptyItem, maxItems = 6) => {
    setForm((current) => {
      if (current[listName].length >= maxItems) return current;
      return { ...current, [listName]: [...current[listName], { ...emptyItem }] };
    });
  };

  const removeListItem = (listName, index, emptyItem) => {
    setForm((current) => ({
      ...current,
      [listName]:
        current[listName].length <= 1
          ? [{ ...emptyItem }]
          : current[listName].filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    const nextContact = authForm.contact.trim();
    const nextAccessCode = authForm.accessCode.trim();

    if (!nextContact || !nextAccessCode) {
      setMessage("اكتب البريد الإلكتروني ورمز دخول من اختيارك أو رمز حسابك.");
      return;
    }

    saveAccessIdentity({ contact: nextContact, accessCode: nextAccessCode });
    const nextIdentity = { contact: nextContact, accessCode: nextAccessCode };
    setIdentity(nextIdentity);
    await fetchPortfolio(nextIdentity);
    setMessage("تم تجهيز مساحة ملف الأعمال.");
  };

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage("اختاري صورة بصيغة JPG أو PNG أو WEBP.");
      return;
    }

    try {
      const compressed = await compressAvatar(file);
      if (compressed.size > 800 * 1024) {
        setMessage("الصورة ما زالت كبيرة بعد الضغط. جرّبي صورة أصغر.");
        return;
      }
      setAvatarFile(new File([compressed], "portfolio-avatar.webp", { type: "image/webp" }));
      setAvatarPreview(URL.createObjectURL(compressed));
      setMessage("تم تجهيز الصورة للرفع بحجم خفيف.");
    } catch (err) {
      setMessage(err.message || "تعذر تجهيز الصورة.");
    }
  };

  const handleCvChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      setMessage("السيرة الذاتية يجب أن تكون PDF.");
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      setMessage("حجم السيرة كبير. الحد الأقصى 3MB.");
      return;
    }

    setCvFile(file);
    setSavedCvLabel(file.name);
    setMessage("تم اختيار ملف السيرة الذاتية.");
  };

  const uploadAsset = async (type, file) => {
    if (!file) return null;

    const { data } = await axios.put(
      `${API_BASE_URL}/api/portfolio/me/assets/${type}`,
      file,
      {
        headers: {
          "Content-Type": file.type,
          "x-file-name": encodeURIComponent(file.name),
          "x-darbak-contact": contact,
          "x-darbak-access-code": accessCode,
          "x-darbak-visitor-id": getVisitorId(),
          "x-darbak-device-type": getDeviceType(),
        },
      }
    );

    return data;
  };

  const buildPayload = () => ({
    slug: form.slug,
    fullName: form.fullName,
    major: majorValue,
    university: universityValue,
    city: cityValue,
    dateOfBirth: form.dateOfBirth,
    degreeLevel: degreeValue,
    readinessStatus: readinessValue,
    targetOrganizations: form.targetOrganizations,
    bio: form.bio,
    skills: form.skills,
    linkedinUrl: form.linkedinUrl,
    email: form.email,
    isPublished: form.isPublished,
    projects: form.projects,
    certifications: form.certifications,
    visitorId: getVisitorId(),
    deviceType: getDeviceType(),
  });

  const savePortfolio = async (event) => {
    event.preventDefault();

    if (!isAuthenticated) {
      setMessage("سجّل الدخول بالبريد والرمز قبل الحفظ.");
      return;
    }

    if (!form.fullName.trim() || !majorValue.trim()) {
      setMessage("الاسم والتخصص مطلوبة قبل الحفظ.");
      return;
    }

    if (form.email && !isValidEmail(form.email)) {
      setMessage("بريد التواصل غير صحيح.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");
      if (avatarFile) await uploadAsset("avatar", avatarFile);
      if (cvFile) await uploadAsset("cv", cvFile);

      const { data } = await axios.post(
        `${API_BASE_URL}/api/portfolio/me`,
        buildPayload(),
        {
          headers: {
            "x-darbak-contact": contact,
            "x-darbak-access-code": accessCode,
          },
        }
      );

      setForm(normalizeForm(data.portfolio));
      setPublicUrl(data.publicUrl || "");
      setAvatarFile(null);
      setCvFile(null);
      setMessage(data.message || "تم حفظ ملف الأعمال.");
      trackEvent("portfolio_saved_from_page", {
        metadata: { publicActive: Boolean(data.portfolio?.publicActive) },
      });
    } catch (err) {
      setMessage(err.response?.data?.error || "تعذر حفظ ملف الأعمال.");
    } finally {
      setSaving(false);
    }
  };

  const sharePortfolio = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `ملف أعمال ${form.fullName || "دربك"}`,
          text: "ملف أعمال رقمي من دربك",
          url: portfolioShareUrl,
        });
        trackEvent("portfolio_native_share_clicked", {
          metadata: { source: "builder_savebar", hasPublicUrl: Boolean(publicUrl) },
        });
        return;
      }
      await navigator.clipboard.writeText(portfolioShareUrl);
      setMessage("تم نسخ رابط ملف الأعمال.");
      trackEvent("portfolio_link_copied", {
        metadata: { source: "builder_savebar", hasPublicUrl: Boolean(publicUrl) },
      });
    } catch {
      setMessage("انسخ الرابط يدويًا إذا لم تظهر المشاركة.");
    }
  };

  const openLinkedInShare = () => {
    if (typeof window === "undefined") return;

    const linkedInUrl = `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(
      linkedInShareText
    )}`;
    window.open(linkedInUrl, "_blank", "noopener,noreferrer");
    trackEvent("portfolio_linkedin_share_clicked", {
      metadata: {
        hasPublicUrl: Boolean(publicUrl),
        hasFullName: Boolean(form.fullName.trim()),
        referralCode,
      },
    });
  };

  const copyReferralLink = async () => {
    try {
      await navigator.clipboard.writeText(referralUrl);
      setMessage("تم نسخ رابط الإحالة. شاركه مع زملائك وخل دربك يوصل لهم.");
      trackEvent("portfolio_referral_link_copied", {
        metadata: { referralCode, hasPublicUrl: Boolean(publicUrl) },
      });
    } catch {
      setMessage("تعذر النسخ التلقائي. انسخ الرابط يدويًا من الصندوق.");
    }
  };

  const copyBadgeLinkedInPost = async () => {
    try {
      await navigator.clipboard.writeText(badgeLinkedInPost);
      setBadgePostReady(false);
      setMessage("تم نسخ منشور LinkedIn. أرفق معه بطاقة ملفك وشاركه بثقة.");
      trackEvent("portfolio_badge_linkedin_post_copied", {
        metadata: { hasPublicUrl: Boolean(publicUrl), badgeTheme },
      });
    } catch {
      setMessage("تعذر نسخ المنشور تلقائيًا. انسخه يدويًا من رابط ملفك.");
    }
  };

  const downloadDigitalBadge = async () => {
    if (typeof document === "undefined") return;

    const canvas = document.createElement("canvas");
    const width = 1080;
    const height = 1350;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return;

    const palette = {
      bg: "#00111d",
      bg2: "#051827",
      cardStart: "#061b2d",
      cardMid: "#082439",
      cardEnd: "#071522",
      textOnCard: "#f8fffd",
      mutedOnCard: "#9fb3c4",
      divider: "rgba(196, 220, 234, 0.18)",
      accent: "#7ddbcd",
      accent2: "#37f1dc",
      accentGreen: "#41e98d",
      accentSoft: "rgba(125, 219, 205, 0.13)",
      panel: "rgba(255,255,255,0.055)",
      border: "rgba(211, 232, 246, 0.44)",
      shadow: "rgba(0, 0, 0, 0.5)",
    };

    const avatarImage = await loadCanvasImage(avatarPreview);
    const brandLogo = await loadCanvasImage(logo);
    let qrImage = null;
    try {
      const qrDataUrl = await QRCode.toDataURL(portfolioShareUrl, {
        width: 240,
        margin: 1,
        errorCorrectionLevel: "M",
        color: { dark: "#081827", light: "#ffffff" },
      });
      qrImage = await loadCanvasImage(qrDataUrl);
    } catch {
      qrImage = null;
    }

    const fullName = form.fullName || "اسم الطالب";
    const targetText =
      form.targetOrganizations ||
      "جهات تدريبية مناسبة لبداية مهنية أوضح";
    const currentYear = new Date().getFullYear();
    const statusText = readinessValue || "مستعد ومؤهل للمقابلات";
    const cityText = cityValue || "السعودية";
    const majorText = majorValue || "التخصص";

    const fillRoundedRect = (x, y, boxWidth, boxHeight, radius, fillStyle) => {
      context.fillStyle = fillStyle;
      context.beginPath();
      drawCanvasRoundRect(context, x, y, boxWidth, boxHeight, radius);
      context.fill();
    };

    const strokeRoundedRect = (
      x,
      y,
      boxWidth,
      boxHeight,
      radius,
      strokeStyle,
      lineWidth = 2
    ) => {
      context.strokeStyle = strokeStyle;
      context.lineWidth = lineWidth;
      context.beginPath();
      drawCanvasRoundRect(context, x, y, boxWidth, boxHeight, radius);
      context.stroke();
    };

    const drawPill = (text, x, y, boxWidth, options = {}) => {
      const {
        fill = palette.accentSoft,
        color = palette.accent,
        border = "rgba(125, 219, 205, 0.12)",
        align = "center",
      } = options;
      fillRoundedRect(x, y, boxWidth, 58, 29, fill);
      strokeRoundedRect(x, y, boxWidth, 58, 29, border, 2);
      context.fillStyle = color;
      context.textAlign = align;
      context.font = "900 30px Cairo, Arial, sans-serif";
      context.fillText(text, align === "right" ? x + boxWidth - 22 : x + boxWidth / 2, y + 8);
    };

    const limitCanvasText = (text, maxLength = 18) => {
      const value = String(text || "").trim();
      if (value.length <= maxLength) return value;
      return `${value.slice(0, maxLength - 3)}...`;
    };

    const background = context.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, palette.bg);
    background.addColorStop(1, palette.bg2);
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);

    const glow = context.createRadialGradient(540, 410, 40, 540, 410, 760);
    glow.addColorStop(0, "rgba(14, 165, 233, 0.18)");
    glow.addColorStop(1, "rgba(125, 219, 205, 0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);

    context.direction = "rtl";
    context.textBaseline = "top";
    context.shadowColor = palette.shadow;
    context.shadowBlur = 64;
    context.shadowOffsetY = 30;
    const cardGradient = context.createRadialGradient(540, 355, 20, 540, 355, 720);
    cardGradient.addColorStop(0, palette.cardMid);
    cardGradient.addColorStop(0.55, palette.cardStart);
    cardGradient.addColorStop(1, palette.cardEnd);
    fillRoundedRect(64, 66, 952, 1268, 42, cardGradient);
    context.shadowColor = "transparent";
    strokeRoundedRect(64, 66, 952, 1268, 42, palette.border, 2);

    if (brandLogo) {
      const sx = brandLogo.width * 0.08;
      const sy = brandLogo.height * 0.32;
      const sw = brandLogo.width * 0.84;
      const sh = brandLogo.height * 0.4;
      context.drawImage(brandLogo, sx, sy, sw, sh, 802, 116, 142, 72);
    } else {
      context.textAlign = "right";
      context.fillStyle = palette.accent;
      context.font = "900 42px Cairo, Arial, sans-serif";
      context.fillText("دربك", 900, 118);
    }

    drawPill(`دفعة ${currentYear}`, 116, 120, 206, {
      fill: "rgba(255,255,255,0.07)",
      color: palette.accent,
      border: "rgba(125, 219, 205, 0.12)",
    });

    context.shadowColor = "rgba(125, 219, 205, 0.42)";
    context.shadowBlur = 24;
    context.beginPath();
    context.arc(width / 2, 304, 114, 0, Math.PI * 2);
    context.fillStyle = "#ffffff";
    context.fill();
    context.shadowColor = "transparent";
    context.strokeStyle = palette.accent;
    context.lineWidth = 6;
    context.beginPath();
    context.arc(width / 2, 304, 114, 0, Math.PI * 2);
    context.stroke();

    if (avatarImage) {
      drawCircularImage(context, avatarImage, width / 2 - 102, 202, 204);
    } else {
      const initials =
        fullName
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0])
          .join("") || "د";
      context.textAlign = "center";
      context.fillStyle = palette.accent;
      context.font = "900 94px Cairo, Arial, sans-serif";
      context.fillText(initials, width / 2, 248);
    }

    context.textAlign = "center";
    context.fillStyle = palette.textOnCard;
    context.font = "900 62px Cairo, Arial, sans-serif";
    writeWrappedCanvasText(context, fullName, width / 2, 470, 780, 72, 1);

    context.fillStyle = palette.textOnCard;
    context.font = "800 30px Cairo, Arial, sans-serif";
    writeWrappedCanvasText(context, majorText, width / 2, 558, 760, 42, 1);

    context.fillStyle = palette.mutedOnCard;
    context.font = "800 28px Cairo, Arial, sans-serif";
    context.fillText(`📍 ${cityText}، السعودية`, width / 2, 620);

    context.strokeStyle = palette.divider;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(144, 710);
    context.lineTo(936, 710);
    context.stroke();

    context.fillStyle = palette.mutedOnCard;
    context.font = "800 25px Cairo, Arial, sans-serif";
    context.fillText("الحالة المهنية", width / 2, 764);
    context.fillStyle = palette.accentGreen;
    context.font = "900 36px Cairo, Arial, sans-serif";
    context.fillText(`✓ ${limitCanvasText(statusText, 36)}`, width / 2, 816);

    context.fillStyle = palette.mutedOnCard;
    context.font = "800 25px Cairo, Arial, sans-serif";
    context.fillText("القطاعات المستهدفة", width / 2, 910);
    context.fillStyle = palette.textOnCard;
    context.font = "900 30px Cairo, Arial, sans-serif";
    writeWrappedCanvasText(context, targetText, width / 2, 964, 800, 42, 2);

    context.textAlign = "center";
    context.fillStyle = palette.accentGreen;
    context.font = "900 32px Cairo, Arial, sans-serif";
    context.fillText("جاهز للفرص، ومستعد لصنع الأثر", width / 2, 1030);

    fillRoundedRect(114, 1082, 852, 198, 32, palette.panel);
    strokeRoundedRect(114, 1082, 852, 198, 32, "rgba(125, 219, 205, 0.18)", 2);
    context.strokeStyle = palette.divider;
    context.beginPath();
    context.moveTo(398, 1120);
    context.lineTo(398, 1238);
    context.stroke();

    fillRoundedRect(168, 1108, 150, 150, 22, "#ffffff");
    if (qrImage) {
      context.drawImage(qrImage, 181, 1121, 124, 124);
    } else {
      context.fillStyle = "#081827";
      context.font = "900 18px Cairo, Arial, sans-serif";
      context.fillText("QR", 243, 1172);
    }
    context.fillStyle = palette.textOnCard;
    context.font = "800 23px Cairo, Arial, sans-serif";
    context.fillText("امسح للعرض", 243, 1254);

    context.textAlign = "right";
    context.fillStyle = palette.accentGreen;
    context.font = "900 38px Cairo, Arial, sans-serif";
    context.fillText("ملفي المهني", 874, 1120);
    context.fillStyle = palette.mutedOnCard;
    context.font = "800 26px Cairo, Arial, sans-serif";
    writeWrappedCanvasText(
      context,
      "جميع معلوماتي، مشاريعي، وأعمالي في رابط واحد.",
      874,
      1178,
      406,
      38,
      2
    );

    const download = (url) => {
      const link = document.createElement("a");
      link.href = url;
      link.download = `darbak-portfolio-badge-${badgeTheme}.png`;
      link.click();
    };

    if (canvas.toBlob) {
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        download(url);
        URL.revokeObjectURL(url);
      }, "image/png");
    } else {
      download(canvas.toDataURL("image/png"));
    }

    setBadgePostReady(true);
    setMessage(PORTFOLIO_BADGE_LINKEDIN_MESSAGE);
    trackEvent("portfolio_badge_downloaded", {
      metadata: {
        hasPublicUrl: Boolean(publicUrl),
        hasSkills: skillItems.length > 0,
        hasAvatar: Boolean(avatarImage),
        badgeTheme,
      },
    });
  };

  return (
    <main className="portfolio-builder-page" dir="rtl">
      <section className="portfolio-builder-hero">
        <span>portfolio</span>
        <h1>ملف أعمال رقمي يليق بتقديمك على التدريب.</h1>
        <p>
          اكتب بياناتك، ارفع سيرتك وصورتك، وشاهد البطاقة قبل الحفظ. الرابط العام
          يعمل للمشتركين عند نشر الملف.
        </p>
      </section>

      <section className="portfolio-builder-layout">
        <form className="portfolio-builder-form" onSubmit={savePortfolio}>
          <div className="portfolio-builder-panel">
            <h2>الدخول والحفظ</h2>
            <p>استخدم بريدك ورمز دخول بسيط. إذا عندك دربك+ استخدم نفس بياناتك.</p>
            <div className="portfolio-auth-row">
              <label>
                البريد الإلكتروني
                <input
                  type="email"
                  value={authForm.contact}
                  onChange={(event) =>
                    setAuthForm((current) => ({
                      ...current,
                      contact: event.target.value,
                    }))
                  }
                  placeholder="example@email.com"
                  dir="ltr"
                />
              </label>
              <label>
                رمز الدخول
                <input
                  value={authForm.accessCode}
                  onChange={(event) =>
                    setAuthForm((current) => ({
                      ...current,
                      accessCode: event.target.value,
                    }))
                  }
                  placeholder="4 إلى 12 حرف أو رقم"
                  dir="ltr"
                  maxLength={12}
                />
              </label>
              <button type="button" onClick={handleLogin} disabled={loading}>
                {loading ? "جاري التحميل..." : "تجهيز ملفي"}
              </button>
            </div>
          </div>

          <div className="portfolio-builder-panel">
            <h2>البيانات الأساسية</h2>
            <div className="portfolio-builder-grid">
              <label>
                الرابط المختصر
                <input
                  value={form.slug}
                  onChange={(event) => updateField("slug", event.target.value)}
                  placeholder="khaled-cs"
                  dir="ltr"
                />
              </label>
              <label>
                الاسم
                <input
                  value={form.fullName}
                  onChange={(event) => updateField("fullName", event.target.value)}
                  placeholder="اسم الطالب"
                />
              </label>
              <label>
                التخصص
                <select
                  value={form.major}
                  onChange={(event) => updateField("major", event.target.value)}
                >
                  <option value="">اختر التخصص</option>
                  {specializationOptions.map((specialization) => (
                    <option key={specialization.value} value={specialization.value}>
                      {specialization.label}
                    </option>
                  ))}
                  <option value="أخرى">أخرى</option>
                </select>
              </label>
              {form.major === "أخرى" && (
                <label>
                  اكتب التخصص
                  <input
                    value={form.majorOther}
                    onChange={(event) =>
                      updateField("majorOther", event.target.value)
                    }
                    placeholder="اسم التخصص"
                  />
                </label>
              )}
              <label>
                الجامعة
                <select
                  value={form.university}
                  onChange={(event) =>
                    updateField("university", event.target.value)
                  }
                >
                  <option value="">اختر الجامعة</option>
                  {saudiUniversities.map((university) => (
                    <option key={university} value={university}>
                      {university}
                    </option>
                  ))}
                </select>
              </label>
              {form.university === "أخرى" && (
                <label>
                  اكتب الجامعة
                  <input
                    value={form.universityOther}
                    onChange={(event) =>
                      updateField("universityOther", event.target.value)
                    }
                    placeholder="اسم الجامعة"
                  />
                </label>
              )}
              <label>
                المدينة
                <select
                  value={form.city}
                  onChange={(event) => updateField("city", event.target.value)}
                >
                  <option value="">اختر المدينة</option>
                  {portfolioCityOptions.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </label>
              {form.city === "أخرى" && (
                <label>
                  اكتب المدينة
                  <input
                    value={form.cityOther}
                    onChange={(event) => updateField("cityOther", event.target.value)}
                    placeholder="اسم المدينة"
                  />
                </label>
              )}
              <label>
                تاريخ الميلاد
                <input
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(event) =>
                    updateField("dateOfBirth", event.target.value)
                  }
                />
              </label>
              <label>
                درجة الشهادة
                <select
                  value={form.degreeLevel}
                  onChange={(event) =>
                    updateField("degreeLevel", event.target.value)
                  }
                >
                  <option value="">اختر الدرجة</option>
                  {degreeOptions.map((degree) => (
                    <option key={degree} value={degree}>
                      {degree}
                    </option>
                  ))}
                </select>
              </label>
              {form.degreeLevel === "أخرى" && (
                <label>
                  اكتب الدرجة
                  <input
                    value={form.degreeOther}
                    onChange={(event) => updateField("degreeOther", event.target.value)}
                    placeholder="مثال: زمالة، شهادة مهنية..."
                  />
                </label>
              )}
            </div>
          </div>

          <div className="portfolio-builder-panel">
            <h2>الملفات والجاهزية</h2>
            <div className="portfolio-builder-grid">
              <label>
                حالة الجاهزية
                <select
                  value={form.readinessStatus}
                  onChange={(event) =>
                    updateField("readinessStatus", event.target.value)
                  }
                >
                  {readinessOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              {form.readinessStatus === "أخرى" && (
                <label>
                  اكتب حالة الجاهزية
                  <input
                    value={form.readinessOther}
                    onChange={(event) =>
                      updateField("readinessOther", event.target.value)
                    }
                    placeholder="مثال: جاهز للتدريب في قطاع التقنية"
                  />
                </label>
              )}
              <label>
                الصورة الشخصية
                <input type="file" accept="image/*" onChange={handleAvatarChange} />
                <small>تُضغط الصورة تلقائيًا قبل الرفع.</small>
              </label>
              <label>
                ملف السيرة الذاتية PDF
                <input type="file" accept="application/pdf" onChange={handleCvChange} />
                <small>{savedCvLabel || "الحد الأقصى 3MB."}</small>
              </label>
            </div>
          </div>

          <div className="portfolio-builder-panel">
            <h2>نبذة وروابط</h2>
            <div className="portfolio-builder-grid">
              <label className="is-wide">
                نبذة شخصية
                <textarea
                  value={form.bio}
                  onChange={(event) => updateField("bio", event.target.value)}
                  placeholder="اكتب سطرين عن اهتمامك المهني وما الذي تستطيع تقديمه."
                />
              </label>
              <label className="is-wide">
                المهارات
                <input
                  value={form.skills}
                  onChange={(event) => updateField("skills", event.target.value)}
                  placeholder="Excel، Python، React، تحليل بيانات"
                />
              </label>
              <label>
                LinkedIn
                <input
                  value={form.linkedinUrl}
                  onChange={(event) => updateField("linkedinUrl", event.target.value)}
                  placeholder="https://linkedin.com/in/..."
                  dir="ltr"
                />
              </label>
              <label>
                بريد التواصل الظاهر
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  placeholder="example@email.com"
                  dir="ltr"
                />
              </label>
              <label className="is-wide">
                الوجهات أو القطاعات المستهدفة
                <input
                  value={form.targetOrganizations}
                  onChange={(event) =>
                    updateField("targetOrganizations", event.target.value)
                  }
                  placeholder="STC، علم، البنوك، الجهات الحكومية"
                />
              </label>
            </div>
          </div>

          <div className="portfolio-builder-panel">
            <div className="portfolio-builder-section-head">
              <h2>المشاريع</h2>
              <button
                type="button"
                onClick={() => addListItem("projects", emptyProject, 6)}
              >
                إضافة مشروع
              </button>
            </div>
            {form.projects.map((project, index) => (
              <div className="portfolio-builder-repeat" key={index}>
                <input
                  value={project.title}
                  onChange={(event) =>
                    updateListItem("projects", index, "title", event.target.value)
                  }
                  placeholder="اسم المشروع"
                />
                <textarea
                  value={project.description}
                  onChange={(event) =>
                    updateListItem(
                      "projects",
                      index,
                      "description",
                      event.target.value
                    )
                  }
                  placeholder="وصف مختصر للمشروع"
                />
                <input
                  value={project.url}
                  onChange={(event) =>
                    updateListItem("projects", index, "url", event.target.value)
                  }
                  placeholder="رابط المشروع اختياري"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => removeListItem("projects", index, emptyProject)}
                >
                  حذف
                </button>
              </div>
            ))}
          </div>

          <div className="portfolio-builder-panel">
            <div className="portfolio-builder-section-head">
              <h2>الشهادات والدورات التدريبية</h2>
              <button
                type="button"
                onClick={() =>
                  addListItem("certifications", emptyCertification, 8)
                }
              >
                إضافة شهادة
              </button>
            </div>
            {form.certifications.map((certification, index) => (
              <div className="portfolio-builder-repeat is-compact" key={index}>
                <input
                  value={certification.title}
                  onChange={(event) =>
                    updateListItem(
                      "certifications",
                      index,
                      "title",
                      event.target.value
                    )
                  }
                  placeholder="اسم الشهادة أو الدورة"
                />
                <input
                  value={certification.provider}
                  onChange={(event) =>
                    updateListItem(
                      "certifications",
                      index,
                      "provider",
                      event.target.value
                    )
                  }
                  placeholder="الجهة المقدمة"
                />
                <input
                  value={certification.year}
                  onChange={(event) =>
                    updateListItem(
                      "certifications",
                      index,
                      "year",
                      event.target.value
                    )
                  }
                  placeholder="السنة"
                />
                <button
                  type="button"
                  onClick={() =>
                    removeListItem(
                      "certifications",
                      index,
                      emptyCertification
                    )
                  }
                >
                  حذف
                </button>
              </div>
            ))}
          </div>

          <div className="portfolio-builder-savebar">
            <label>
              <input
                type="checkbox"
                checked={form.isPublished}
                onChange={(event) => updateField("isPublished", event.target.checked)}
              />
              نشر الرابط العام عند تفعيل دربك+
            </label>
            <div>
              <button type="button" className="secondary" onClick={sharePortfolio}>
                مشاركة البطاقة
              </button>
              <button type="submit" disabled={saving}>
                {saving ? "جاري الحفظ..." : "حفظ ملف الأعمال"}
              </button>
            </div>
          </div>

          <div className="portfolio-growth-panel">
            <div className="portfolio-growth-copy">
              <span>انشر ملفك لتثبيت جاهزيتك</span>
              <h2>حمّل بطاقة جاهزة للنشر عن ملف أعمالك.</h2>
              <p>
                البطاقة تطلع كصورة مرتبة فيها صورتك، تخصصك، جاهزيتك، ورابط ملفك
                عشان تنشرها في LinkedIn أو ترسلها بثقة.
              </p>
            </div>

            <div className="portfolio-badge-theme-picker" role="group" aria-label="نمط البطاقة">
              <span>نمط البطاقة</span>
              <div>
                <button
                  type="button"
                  className={badgeTheme === "dark" ? "is-active" : ""}
                  onClick={() => setBadgeTheme("dark")}
                >
                  ليلي
                </button>
                <button
                  type="button"
                  className={badgeTheme === "light" ? "is-active" : ""}
                  onClick={() => setBadgeTheme("light")}
                >
                  نهاري
                </button>
              </div>
            </div>

            <div className="portfolio-growth-actions">
              <button type="button" onClick={openLinkedInShare}>
                🔗 شارك ملفك على LinkedIn بنقرة واحدة
              </button>
              <button type="button" className="secondary" onClick={downloadDigitalBadge}>
                📥 تحميل بطاقة جاهزة للنشر
              </button>
            </div>

            <div className="portfolio-referral-card">
              <div>
                <span>شارك واكسب أيامًا مجانية</span>
                <p>
                  شارك رابطك مع زملائك في الجامعة. كل تسجيل مؤهل عبر رابطك يُحسب
                  لك، ومع تفعيل مكافآت الإحالة تحصل على أيام مجانية في دربك+.
                </p>
              </div>
              <div className="portfolio-referral-row">
                <code dir="ltr">{referralUrl}</code>
                <button type="button" onClick={copyReferralLink}>
                  نسخ رابط الإحالة
                </button>
              </div>
              <small>#جاهز_مع_دربك</small>
            </div>
          </div>

          {message && (
            <div className="portfolio-builder-message">
              <span>{message}</span>
              {badgePostReady && message === PORTFOLIO_BADGE_LINKEDIN_MESSAGE && (
                <button type="button" onClick={copyBadgeLinkedInPost}>
                  انسخ منشور LinkedIn
                </button>
              )}
            </div>
          )}
        </form>

        <aside className="portfolio-builder-preview">
          <div className="portfolio-preview-card">
            <div className="portfolio-preview-card-head">
              <img src={logo} alt="دربك" />
              <span>Portfolio</span>
            </div>
            <div className="portfolio-preview-avatar">
              {avatarPreview ? (
                <img src={avatarPreview} alt="" />
              ) : (
                <strong>{(form.fullName.trim()[0] || "د").toUpperCase()}</strong>
              )}
            </div>
            <h2>{form.fullName || "اسم الطالب"}</h2>
            <p>{majorValue || "التخصص"}</p>
            <small>
              {[universityValue || "الجامعة", cityValue || "المدينة"]
                .filter(Boolean)
                .join(" - ")}
            </small>
            <div className="portfolio-preview-info">
              <span>الجاهزية</span>
              <strong>{readinessValue || "مستعد ومؤهل للمقابلات"}</strong>
            </div>
            <div className="portfolio-preview-info">
              <span>الدرجة</span>
              <strong>{degreeValue || "غير محدد"}</strong>
            </div>
            <div className="portfolio-preview-targets">
              {form.targetOrganizations || "الوجهات المستهدفة تظهر هنا"}
            </div>
          </div>

          <div className="portfolio-preview-details">
            <h3>نبذة</h3>
            <p>{form.bio || "اكتب نبذة قصيرة تظهر هنا في معاينة ملف الأعمال."}</p>
            {skillItems.length > 0 && (
              <div className="portfolio-preview-skills">
                {skillItems.map((skill) => (
                  <span key={skill}>{skill}</span>
                ))}
              </div>
            )}
            <h3>المشاريع</h3>
            {activeProjects.length > 0 ? (
              activeProjects.slice(0, 3).map((project, index) => (
                <article key={`${project.title}-${index}`}>
                  <strong>{project.title || "مشروع"}</strong>
                  <p>{project.description || "وصف مختصر للمشروع."}</p>
                </article>
              ))
            ) : (
              <p>أضف مشروعًا واحدًا على الأقل إذا رغبت.</p>
            )}
            {activeCertifications.length > 0 && (
              <>
                <h3>الشهادات</h3>
                {activeCertifications.slice(0, 3).map((certification, index) => (
                  <article key={`${certification.title}-${index}`}>
                    <strong>{certification.title || "شهادة"}</strong>
                    <p>
                      {[certification.provider, certification.year]
                        .filter(Boolean)
                        .join(" - ")}
                    </p>
                  </article>
                ))}
              </>
            )}
            {publicUrl && (
              <a href={publicUrl} target="_blank" rel="noreferrer">
                فتح الرابط العام
              </a>
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}
