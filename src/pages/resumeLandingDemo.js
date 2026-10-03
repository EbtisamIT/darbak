// Public, fictional marketing sample. Never hydrate it from or save it to a user account.
const sharedSettings = {
  direction: "rtl",
  template: "ats-classic",
  density: "comfortable",
  fontSize: "medium",
};

const sectionOrder = [
  "summary",
  "experience",
  "education",
  "projects",
  "skills",
  "certifications",
  "volunteering",
  "languages",
];

export const demoResumes = {
  ar: {
    personalInfo: {
      fullName: "سارة أحمد",
      headline: "طالبة نظم معلومات — مسار تحليل الأعمال",
      email: "sara@example.com",
      phone: "05xxxxxxxx",
      city: "الرياض",
      major: "نظم معلومات — مسار تحليل الأعمال",
      studentStatus: "student",
      grammaticalGender: "feminine",
      university: "جامعة الملك سعود",
      degree: "بكالوريوس",
      expectedGraduationYear: "2027",
      gpa: "4.62",
      gpaScale: "5",
    },
    summary: "طالبة نظم معلومات في مسار تحليل الأعمال (Business Analytics)، طبقت تحليل البيانات باستخدام Power BI وMicrosoft Excel في مشروع عملي لمتابعة أداء المبيعات. أهتم بتحسين العمليات وتحويل البيانات إلى مؤشرات تدعم اتخاذ القرار.",
    education: [{ id: "demo-education", title: "بكالوريوس نظم معلومات — مسار تحليل الأعمال", organization: "جامعة الملك سعود", location: "الرياض" }],
    experience: [{
      id: "demo-experience",
      title: "متدربة تحليل أعمال",
      organization: "شركة تقنية سعودية (مثال توضيحي)",
      period: "يونيو 2026 - أغسطس 2026",
      achievements: [
        { id: "demo-experience-1", text: "حللت بيانات تشغيلية باستخدام Excel وPower BI." },
        { id: "demo-experience-2", text: "ساهمت في إعداد تقارير دورية لمتابعة مؤشرات الأداء." },
        { id: "demo-experience-3", text: "وثقت متطلبات مستخدمين وساعدت في تنظيمها لفريق التطوير." },
      ],
    }],
    projects: [{
      id: "demo-project-sales",
      title: "لوحة متابعة أداء المبيعات",
      technologies: ["Power BI", "Microsoft Excel"],
      achievements: [
        { id: "demo-sales-1", text: "نظفت وحللت بيانات المبيعات الشهرية." },
        { id: "demo-sales-2", text: "قارنت أداء الفروع وحددت المنتجات الأعلى مبيعًا." },
        { id: "demo-sales-3", text: "صممت لوحة مؤشرات توضح الأداء والاتجاهات الرئيسية." },
      ],
    }, {
      id: "demo-project-booking",
      title: "نظام حجز المرافق الجامعية",
      technologies: ["Figma", "SQL"],
      achievements: [
        { id: "demo-booking-1", text: "حددت رحلة المستخدم ومتطلبات الحجز." },
        { id: "demo-booking-2", text: "صممت نموذجًا أوليًا لعملية الحجز والمتابعة." },
        { id: "demo-booking-3", text: "صممت نموذج بيانات أوليًا للمرافق والحجوزات." },
      ],
    }],
    skills: ["Power BI", "Microsoft Excel", "SQL", "تحليل البيانات", "تحليل الأعمال", "جمع المتطلبات", "Figma", "حل المشكلات", "التواصل"],
    certifications: [
      { id: "demo-cert-ms", title: "Microsoft Power BI Data Analyst Fundamentals", organization: "Microsoft Learn", startDate: "2026" },
      { id: "demo-cert-itil", title: "ITIL 4 Foundation", organization: "PeopleCert", startDate: "2026" },
      { id: "demo-cert-ibm", title: "Data Analysis Fundamentals", organization: "IBM", startDate: "2025" },
    ],
    volunteering: [{
      id: "demo-activity",
      title: "عضوة نادي نظم المعلومات",
      organization: "جامعة الملك سعود",
      period: "2025 - 2026",
      achievements: [{ id: "demo-activity-1", text: "ساهمت في تنظيم ورشة عن تحليل البيانات وتجهيز المحتوى والتنسيق مع الفريق." }],
    }],
    languages: [{ id: "demo-lang-ar", name: "العربية", level: "اللغة الأم" }, { id: "demo-lang-en", name: "الإنجليزية", level: "متقدم" }],
    sectionOrder,
    hiddenSections: [],
    settings: { ...sharedSettings, language: "ar" },
  },
  en: {
    personalInfo: {
      fullName: "Sara Ahmed",
      headline: "Information Systems Student — Business Analytics Track",
      email: "sara@example.com",
      phone: "05xxxxxxxx",
      city: "Riyadh",
      major: "Information Systems — Business Analytics Track",
      studentStatus: "student",
      university: "King Saud University",
      degree: "Bachelor's Degree",
      expectedGraduationYear: "2027",
      gpa: "4.62",
      gpaScale: "5",
    },
    summary: "Information Systems student on the Business Analytics track with practical experience analyzing sales data using Power BI and Microsoft Excel. Interested in improving processes and turning data into indicators that support decisions.",
    education: [{ id: "demo-education", title: "Bachelor's Degree in Information Systems — Business Analytics Track", organization: "King Saud University", location: "Riyadh" }],
    experience: [{
      id: "demo-experience",
      title: "Business Analysis Intern",
      organization: "Saudi Technology Company (illustrative)",
      period: "June 2026 - August 2026",
      achievements: [
        { id: "demo-experience-1", text: "Analyzed operational data using Excel and Power BI." },
        { id: "demo-experience-2", text: "Contributed to regular reports tracking performance indicators." },
        { id: "demo-experience-3", text: "Documented user requirements and helped organize them for the development team." },
      ],
    }],
    projects: [{
      id: "demo-project-sales",
      title: "Sales Performance Dashboard",
      technologies: ["Power BI", "Microsoft Excel"],
      achievements: [
        { id: "demo-sales-1", text: "Cleaned and analyzed monthly sales data." },
        { id: "demo-sales-2", text: "Compared branch performance and identified top-selling products." },
        { id: "demo-sales-3", text: "Designed a dashboard showing key performance indicators and trends." },
      ],
    }, {
      id: "demo-project-booking",
      title: "University Facilities Booking System",
      technologies: ["Figma", "SQL"],
      achievements: [
        { id: "demo-booking-1", text: "Mapped the user journey and booking requirements." },
        { id: "demo-booking-2", text: "Designed a prototype for booking and follow-up." },
        { id: "demo-booking-3", text: "Designed an initial data model for facilities and reservations." },
      ],
    }],
    skills: ["Power BI", "Microsoft Excel", "SQL", "Data Analysis", "Business Analysis", "Requirements Gathering", "Figma", "Problem Solving", "Communication"],
    certifications: [
      { id: "demo-cert-ms", title: "Microsoft Power BI Data Analyst Fundamentals", organization: "Microsoft Learn", startDate: "2026" },
      { id: "demo-cert-itil", title: "ITIL 4 Foundation", organization: "PeopleCert", startDate: "2026" },
      { id: "demo-cert-ibm", title: "Data Analysis Fundamentals", organization: "IBM", startDate: "2025" },
    ],
    volunteering: [{
      id: "demo-activity",
      title: "Information Systems Club Member",
      organization: "King Saud University",
      period: "2025 - 2026",
      achievements: [{ id: "demo-activity-1", text: "Helped organize a data analysis workshop, prepare content, and coordinate with the team." }],
    }],
    languages: [{ id: "demo-lang-ar", name: "Arabic", level: "Native" }, { id: "demo-lang-en", name: "English", level: "Advanced" }],
    sectionOrder,
    hiddenSections: [],
    settings: { ...sharedSettings, direction: "ltr", language: "en" },
  },
};

export const getDemoResume = (language, template) => ({
  ...demoResumes[language === "en" ? "en" : "ar"],
  settings: { ...demoResumes[language === "en" ? "en" : "ar"].settings, template },
});
