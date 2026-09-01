const assert = require("assert");
const {
  collectFacts,
  validateResumeClaims,
  filterConfirmedQuestions,
  ensureActionableNeedsInformation,
  isDeferredTailorQuestion,
} = require("../agents/darbakResumeAgent");
const {
  assertEnglishSummaryIntegrity,
  assertTranslationIntegrity,
  mapDraftToResumePayload,
  approvedDraftNeedsRematerialization,
  resumeDraftSchema,
} = require("../services/resumeAiService");
const { hasCompleteApplicationPack } = require("../services/applicationPackIntegrity");

const baseFacts = {
  sourceIds: new Set(["resume_basic", "resume_project_1", "answer_role"]),
  answers: [
    {
      questionId: "role",
      section: "projects",
      question: "ما دورك في المشروع؟",
      answer: "نفذت واجهة المستخدم وربطت الجداول وساعدت في تنظيم الطلبات.",
    },
  ],
  factText:
    "نظم معلومات | جامعة الإمام | الرياض | مشروع لوحة متابعة طلبات التدريب باستخدام React و JavaScript | نفذت واجهة المستخدم وربطت الجداول | ساعدت في تنظيم الطلبات | 2025",
  opportunityText:
    "فرصة تدريب في تحليل البيانات تتطلب Python و Power BI ومهارات تواصل.",
  allowedNumbers: new Set(["2025"]),
};

const validDraft = {
  targetTitle: "متدرب نظم معلومات",
  professionalSummary:
    "طالب نظم معلومات مهتم ببناء واجهات تساعد على تنظيم البيانات ومتابعة طلبات التدريب. لديه تجربة جامعية في تطوير لوحة متابعة باستخدام React و JavaScript.",
  education: [
    {
      sourceId: "resume_basic",
      title: "",
      organization: "جامعة الإمام",
      degree: "بكالوريوس",
      major: "نظم معلومات",
      dates: "2025",
      location: "الرياض",
      details: "",
      bullets: [],
    },
  ],
  experiences: [],
  projects: [
    {
      sourceId: "resume_project_1",
      name: "لوحة متابعة طلبات التدريب",
      description: "مشروع جامعي لتنظيم طلبات التدريب ومتابعتها.",
      technologies: ["React", "JavaScript"],
      bullets: [
        "نفذ واجهة المستخدم وربط الجداول لعرض طلبات التدريب.",
        "ساهم في تنظيم بيانات الطلبات وتسهيل متابعتها.",
      ],
      url: "",
    },
  ],
  skills: [
    { name: "React", evidenceSourceId: "resume_project_1" },
    { name: "JavaScript", evidenceSourceId: "resume_project_1" },
  ],
  certifications: [],
  volunteering: [],
  languages: [],
  missingInformation: [],
  warnings: [],
  missingRequirements: [],
};

const validSourceMap = [
  {
    path: "projects.0.bullets.0",
    sourceId: "resume_project_1",
    sourceText: "نفذت واجهة المستخدم وربطت الجداول.",
  },
  {
    path: "projects.0.bullets.1",
    sourceId: "resume_project_1",
    sourceText: "ساعدت في تنظيم الطلبات.",
  },
];

const clone = (value) => JSON.parse(JSON.stringify(value));

const { missingRequirements: _missingRequirements, ...baseEditorialDraft } = validDraft;
const editorialDraft = resumeDraftSchema.parse({
  ...baseEditorialDraft,
  editorialCheck: {
    concise: true,
    noRepeatedIdeas: true,
    naturalArabic: true,
    evidenceBased: true,
    noUnnecessaryToolListing: true,
  },
});
assert.deepStrictEqual(editorialDraft.editorialCheck, {
  concise: true,
  noRepeatedIdeas: true,
  naturalArabic: true,
  evidenceBased: true,
  noUnnecessaryToolListing: true,
}, "the structured draft retains the Arabic editorial review without a second model call");

{
  const resumePayload = {
    personalInfo: { fullName: "طالب اختبار" },
    summary: "نبذة محفوظة للسيرة.",
  };
  const completePack = {
    resume: { status: "ready" },
    trainingLetter: { status: "ready", body: "خطاب تقديم محفوظ." },
    email: { status: "ready", subject: "طلب تدريب", body: "رسالة إيميل محفوظة." },
  };
  assert.strictEqual(hasCompleteApplicationPack({ resumePayload, applicationPack: completePack }), true);
  assert.strictEqual(
    hasCompleteApplicationPack({
      resumePayload,
      applicationPack: { ...completePack, email: { status: "ready", subject: "", body: "" } },
    }),
    false
  );
  assert.strictEqual(
    hasCompleteApplicationPack({
      resumePayload,
      applicationPack: { ...completePack, email: { status: "needs_input", subject: "", body: "" } },
    }),
    true
  );
}

{
  const nouraBase = {
    personalInfo: {
      fullName: "Noura Abdullah Alotaibi",
      major: "Business Administration",
      university: "University of Jeddah",
      city: "Jeddah",
      degree: "Bachelor's",
      studentStatus: "graduate",
      graduationYear: "2026",
      gpa: "4.35",
      gpaScale: "5",
      grammaticalGender: "feminine",
    },
    projects: [{ id: "customer-satisfaction", title: "Customer Satisfaction Analysis", description: "Analyzed customer satisfaction feedback." }],
    skills: ["Microsoft PowerPointB", "Excel"],
    settings: { language: "en" },
  };
  const approvedSummary = "Business Administration Graduate with approved V2 presentation wording.";
  const mapped = mapDraftToResumePayload({
    ...validDraft,
    professionalSummary: approvedSummary,
    experiences: [{
      sourceId: "internship-1",
      title: "Accounting Intern",
      organization: "Example Accounting Firm",
      dates: "2025",
      location: "Jeddah",
      bullets: ["Approved internship bullet marker."],
    }],
    projects: [{ ...validDraft.projects[0], bullets: ["Approved project bullet marker."] }],
    skills: [{ name: "Microsoft PowerPointB", evidenceSourceId: "resume_basic" }],
  }, nouraBase, { basic: nouraBase.personalInfo }, "en");
  assert.strictEqual(mapped.personalInfo.headline, "Business Administration Graduate");
  assert.strictEqual(mapped.personalInfo.university, "University of Jeddah");
  assert.strictEqual(mapped.personalInfo.city, "Jeddah");
  assert.strictEqual(mapped.summary, approvedSummary);
  assert.deepStrictEqual(mapped.experiences[0].achievements.map((item) => item.text), ["Approved internship bullet marker."]);
  assert.deepStrictEqual(mapped.projects[0].achievements.map((item) => item.text), ["Approved project bullet marker."]);
  assert.ok(mapped.skills.includes("Microsoft PowerPoint"));
}

{
  const approvedDraft = {
    professionalSummary: "Approved professional summary marker.",
    experiences: [{ sourceId: "experience-1", bullets: ["Approved experience bullet marker."] }],
    projects: [{ sourceId: "project-1", bullets: ["Approved project bullet marker."] }],
  };
  const staleResume = {
    summary: "A fact-derived fallback summary.",
    experiences: [{ id: "experience-1", achievements: [{ text: "Original fact description." }] }],
    projects: [{ id: "project-1", achievements: [{ text: "Original project description." }] }],
  };
  assert.strictEqual(
    approvedDraftNeedsRematerialization(approvedDraft, staleResume),
    true,
    "an explicit re-approval repairs a master payload that lost reviewed draft presentation"
  );
  const persistedApprovedResume = {
    summary: approvedDraft.professionalSummary,
    experiences: [{ id: "experience-1", achievements: [{ text: "Approved experience bullet marker." }] }],
    projects: [{ id: "project-1", achievements: [{ text: "Approved project bullet marker." }] }],
  };
  assert.strictEqual(
    approvedDraftNeedsRematerialization(approvedDraft, persistedApprovedResume),
    false,
    "a replay never rewrites an already-materialized approved draft"
  );
}

{
  assert.doesNotThrow(() => assertEnglishSummaryIntegrity({
    personalInfo: { studentStatus: "graduate" },
    summary: "Graduate in Business Administration with Excel skills.",
  }));
  assert.throws(() => assertEnglishSummaryIntegrity({
    personalInfo: { studentStatus: "graduate" },
    summary: "طالبة في Business Administration.",
  }), /اتساق نبذة النسخة الإنجليزية/);
}

{
  const filtered = filterConfirmedQuestions(
    {
      status: "needs_information",
      questions: [
        { section: "skills", question: "ما مهاراتك؟" },
        { section: "projects", question: "اذكر مشروعك." },
        { section: "personal", question: "ما رقم التواصل؟" },
      ],
    },
    { profile: { skills: ["React"], projects: [{ title: "لوحة" }] }, resume: {}, sources: [] }
  );
  assert.deepStrictEqual(filtered.questions.map((item) => item.section), ["personal"]);
}

{
  // Facts already entered in the professional profile must not be asked for
  // again merely because the ResumeProfile has not been completed yet.
  const facts = collectFacts({
    profile: {
      phone: "0500000000",
      major: "تقنية المعلومات",
      university: "جامعة الإمام",
      degreeLevel: "بكالوريوس",
      experiences: [{ title: "مساعدة مطورة", organization: "نادي التقنية" }],
      volunteering: [{ title: "عضوة", organization: "نادي إنجاز" }],
    },
    resume: null,
    opportunity: null,
    collectedFacts: {},
  });
  assert.strictEqual(facts.profile.phone, "0500000000");
  const filtered = filterConfirmedQuestions(
    {
      status: "needs_information",
      questions: [
        { section: "education", question: "ما تخصصك وجامعتك؟" },
        { section: "experiences", question: "اذكر خبرتك." },
        { section: "volunteering", question: "اذكر نشاطك التطوعي." },
        { section: "personal", question: "ما وسيلة التواصل المناسبة؟" },
      ],
    },
    facts
  );
  assert.deepStrictEqual(filtered.questions.map((item) => item.section), ["personal"]);
}

{
  const filtered = filterConfirmedQuestions(
    {
      status: "needs_information",
      questions: [{ section: "summary", question: "هل أنتِ خريجة بالفعل أم ما زلتِ طالبة؟" }],
    },
    {
      profile: {},
      resume: { personalInfo: { headline: "خريجة تقنية المعلومات" } },
      sources: [{ sourceId: "resume_basic", text: "خريجة تقنية المعلومات" }],
    }
  );
  assert.deepStrictEqual(filtered.questions, []);
}

{
  // A needs-information response must always leave the student with an
  // answerable field. A project can exist while its description is genuinely
  // absent, so section-level deduplication must not leave an empty question UI.
  const actionable = ensureActionableNeedsInformation(
    {
      status: "needs_information",
      message: "أحتاج وصفًا مختصرًا للمشروع.",
      questions: [],
    },
    {
      profile: { projects: [{ title: "بوابة الطلاب", description: "" }] },
      resume: {},
      sources: [],
      answers: [],
    }
  );
  assert.strictEqual(actionable.status, "needs_information");
  assert.strictEqual(actionable.questions.length, 1);
  assert.strictEqual(actionable.questions[0].fieldKey, "project_description");
}

{
  const blocked = ensureActionableNeedsInformation(
    { status: "needs_information", questions: [] },
    { profile: {}, resume: {}, sources: [], answers: [] }
  );
  assert.strictEqual(blocked.status, "cannot_continue");
}

{
  // Agent wording may change after a refresh. A persisted field key, not the
  // wording itself, prevents asking the same fact again.
  const filtered = filterConfirmedQuestions(
    {
      status: "needs_information",
      questions: [
        {
          id: "new-wording-after-refresh",
          fieldKey: "opportunity_description",
          section: "opportunity",
          question: "أرسل وصف الفرصة أو متطلباتها.",
        },
      ],
    },
    {
      profile: {},
      resume: {},
      sources: [],
      answers: [
        {
          fieldKey: "opportunity_description",
          answer: "وصف محفوظ من الطالب.",
        },
      ],
    }
  );
  assert.deepStrictEqual(filtered.questions, []);
}

{
  // A Darbak opportunity is already a trusted description source; the agent
  // must not turn its valid id into a manual-description question.
  const filtered = filterConfirmedQuestions(
    {
      status: "needs_information",
      questions: [
        {
          section: "opportunity",
          question: "أرسل وصف الفرصة التدريبية أو متطلباتها.",
        },
      ],
    },
    {
      profile: {},
      resume: {},
      sources: [],
      opportunity: { _id: "valid-opportunity", title: "تدريب تعاوني" },
    }
  );
  assert.deepStrictEqual(filtered.questions, []);
}

{
  const filtered = filterConfirmedQuestions(
    {
      status: "needs_information",
      questions: [{ id: "project-role", section: "projects", question: "ما دورك في المشروع؟" }],
    },
    {
      profile: {},
      resume: {},
      sources: [],
      answers: [{ questionId: "project-role", answer: "صممت واجهات المشروع." }],
    }
  );
  assert.deepStrictEqual(filtered.questions, []);
}

{
  assert.strictEqual(
    isDeferredTailorQuestion({ question: "هل أنتِ حاليًا في مرحلة التدريب التعاوني أو مؤهلة لها؟" }),
    true
  );
  assert.strictEqual(
    isDeferredTailorQuestion({ question: "ما فترة التدريب التعاوني المطلوبة لديكِ؟" }),
    true
  );
  assert.strictEqual(
    isDeferredTailorQuestion({ question: "ما دورك الفعلي في مشروع دربك؟" }),
    false
  );
}

{
  const arabic = {
    personalInfo: { fullName: "طالب", headline: "مصمم جرافيك" },
    skills: ["Figma"],
    projects: [{ id: "p1", title: "مشروع تصميم", organization: "جامعة" }],
  };
  assert.doesNotThrow(() => assertTranslationIntegrity(arabic, clone(arabic)));
  const changed = clone(arabic);
  changed.projects[0].title = "Programmer";
  assert.throws(() => assertTranslationIntegrity(arabic, changed));
}

{
  // NITC may ask for Graphic Design, but that target must never become the
  // student's title or major in a tailored version.
  const masterResume = {
    personalInfo: {
      fullName: "ابتسام علي",
      headline: "طالبة تقنية معلومات",
      major: "تقنية المعلومات",
      university: "جامعة الإمام محمد بن سعود الإسلامية",
    },
    summary: "طالبة تقنية معلومات مهتمة بتصميم الواجهات والمحتوى الرقمي.",
    education: [{ id: "edu-1", title: "بكالوريوس", organization: "جامعة الإمام" }],
    projects: [
      { id: "project-other", title: "مشروع آخر" },
      { id: "project-darbak", title: "دربك", organization: "دربك" },
    ],
    skills: ["React", "UI/UX", "Figma"],
    settings: { language: "ar", direction: "rtl" },
  };
  const NITC_TARGET_DRAFT = {
    targetTitle: "متدربة تعاونية في التصميم الجرافيكي والوسائط الرقمية",
    professionalSummary: "طالبة تقنية معلومات تبرز خبرتها في تصميم الواجهات والمحتوى الرقمي والمشاريع ذات الصلة.",
    education: [],
    experiences: [],
    projects: [{ sourceId: "project-darbak", name: "دربك", description: "", technologies: [], bullets: [], url: "" }],
    skills: [{ name: "Figma", evidenceSourceId: "project-darbak" }],
    certifications: [],
    volunteering: [],
    languages: [],
    missingInformation: [],
    warnings: [],
    missingRequirements: [],
  };
  const tailored = mapDraftToResumePayload(
    NITC_TARGET_DRAFT,
    masterResume,
    { basic: masterResume.personalInfo },
    "ar",
    { preserveIdentity: true }
  );
  assert.strictEqual(tailored.personalInfo.headline, masterResume.personalInfo.headline);
  assert.strictEqual(tailored.personalInfo.major, masterResume.personalInfo.major);
  assert.deepStrictEqual(tailored.skills, ["Figma", "React.js", "UI/UX"]);
  assert.deepStrictEqual(tailored.projects.map((item) => item.id), ["project-darbak", "project-other"]);
  assert.ok(tailored.summary.includes("تقنية المعلومات"));
  assert.ok(!tailored.summary.includes("طالبة"));
}

{
  const result = validateResumeClaims({
    draft: validDraft,
    facts: baseFacts,
    sourceMap: validSourceMap,
    purpose: "create_resume",
  });
  assert.strictEqual(result.valid, true, result.errors.join("\n"));
}

{
  const graduateFacts = {
    ...baseFacts,
    factText: `${baseFacts.factText} | خريجة تقنية المعلومات`,
  };
  const draft = clone(validDraft);
  draft.professionalSummary = "طالبة بكالوريوس تقنية المعلومات مؤهلة للتدريب التعاوني.";
  const result = validateResumeClaims({
    draft,
    facts: graduateFacts,
    sourceMap: validSourceMap,
    purpose: "tailor_resume",
  });
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("طالب")));
  assert.ok(result.errors.some((error) => error.includes("مؤهل")));
}

{
  const graduateFacts = {
    ...baseFacts,
    factText: `${baseFacts.factText} | خريجة تقنية المعلومات`,
  };
  const draft = clone(validDraft);
  draft.professionalSummary = "خريجة تقنية المعلومات مهتمة بتطوير واجهات المستخدم.";
  const result = validateResumeClaims({
    draft,
    facts: graduateFacts,
    sourceMap: validSourceMap,
    purpose: "tailor_resume",
  });
  assert.strictEqual(result.valid, true, result.errors.join("\n"));
}

{
  const studentFacts = {
    ...baseFacts,
    profile: { studentStatus: "student" },
    factText: baseFacts.factText,
  };
  const draft = clone(validDraft);
  draft.professionalSummary = "طالب نظم معلومات طوّر مشروعًا جامعيًا لتنظيم طلبات التدريب.";
  const result = validateResumeClaims({
    draft,
    facts: studentFacts,
    sourceMap: validSourceMap,
    purpose: "tailor_resume",
  });
  assert.strictEqual(result.valid, true, "the verified system student status supports Arabic طالب without a literal Arabic duplicate in factText");
}

{
  const draft = clone(validDraft);
  draft.projects[0].bullets[0] = "رفع كفاءة متابعة الطلبات بنسبة 40%.";
  const result = validateResumeClaims({
    draft,
    facts: baseFacts,
    sourceMap: validSourceMap,
    purpose: "create_resume",
  });
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("40")));
}

{
  const result = validateResumeClaims({
    draft: validDraft,
    facts: baseFacts,
    sourceMap: [],
    purpose: "create_resume",
  });
  assert.strictEqual(result.valid, true, result.errors.join("\n"));
  assert.ok(result.warnings.some((warning) => warning.includes("نقطة المشروع")));
}

{
  const draft = clone(validDraft);
  draft.projects[0].sourceId = "role";
  draft.projects[0].technologies = ["React", "Figma"];
  draft.projects[0].bullets = ["نفذ واجهة المستخدم وربط الجداول لتنظيم طلبات التدريب."];
  draft.skills = [
    { name: "React", evidenceSourceId: "role" },
    { name: "Figma", evidenceSourceId: "role" },
  ];
  const facts = {
    ...baseFacts,
    sourceIds: new Set(["resume_basic", "resume_project_1", "answer_role"]),
    factText:
      `${baseFacts.factText} | استخدمت React و Figma في تصميم وتنفيذ واجهة المشروع.`,
    answers: [
      {
        questionId: "role",
        section: "projects",
        question: "ما الأدوات التي استخدمتها؟",
        answer: "استخدمت React و Figma في تصميم وتنفيذ واجهة المشروع.",
      },
    ],
  };
  const result = validateResumeClaims({
    draft,
    facts,
    sourceMap: [
      {
        path: "projects.0.bullets.0",
        sourceId: "role",
        sourceText: "نفذت واجهة المستخدم وربطت الجداول.",
      },
    ],
    purpose: "create_resume",
  });
  assert.strictEqual(result.valid, true, result.errors.join("\n"));
}

{
  const draft = clone(validDraft);
  draft.projects[0].sourceId = "role";
  draft.projects[0].technologies = ["React", "Figma", "Java"];
  draft.projects[0].bullets = ["نفذ واجهة المستخدم وربط الجداول لتنظيم طلبات التدريب."];
  draft.skills = [
    { name: "React", evidenceSourceId: "role" },
    { name: "Figma", evidenceSourceId: "role" },
    { name: "Java", evidenceSourceId: "role" },
  ];
  const facts = {
    ...baseFacts,
    sourceIds: new Set(["resume_basic", "resume_project_1", "answer_role"]),
    factText:
      `${baseFacts.factText} | استخدمت رياكت وفيقما وجافا في تصميم وتنفيذ المشروع.`,
    answers: [
      {
        questionId: "role",
        section: "projects",
        question: "ما الأدوات التي استخدمتها؟",
        answer: "استخدمت رياكت وفيقما وجافا في تصميم وتنفيذ المشروع.",
      },
    ],
  };
  const result = validateResumeClaims({
    draft,
    facts,
    sourceMap: [
      {
        path: "projects.0.bullets.0",
        sourceId: "role",
        sourceText: "نفذت واجهة المستخدم وربطت الجداول.",
      },
    ],
    purpose: "create_resume",
  });
  assert.strictEqual(result.valid, true, result.errors.join("\n"));
}

{
  const draft = clone(validDraft);
  draft.projects = [];
  draft.experiences = [
    {
      sourceId: "training",
      title: "متدرب واجهات أمامية",
      organization: "Dar Al Riyadh",
      dates: "March 2024 - May 2024",
      location: "الرياض",
      bullets: [
        "طوّر واجهات تفاعلية باستخدام React.",
        "صمم نماذج أولية للشاشات باستخدام Figma.",
      ],
    },
  ];
  draft.skills = [
    { name: "React", evidenceSourceId: "training" },
    { name: "Figma", evidenceSourceId: "training" },
  ];
  const facts = {
    ...baseFacts,
    sourceIds: new Set(["answer_training"]),
    factText:
      "تدربت في دار الرياض من مارس 2024 إلى مايو 2024 واستخدمت React وFigma في الواجهات.",
    answers: [
      {
        questionId: "training",
        section: "experiences",
        question: "اذكر تفاصيل التدريب والأدوات.",
        answer:
          "تدربت في دار الرياض من مارس 2024 إلى مايو 2024 واستخدمت React وFigma في الواجهات.",
      },
    ],
    allowedNumbers: new Set(["2024", "2025"]),
  };
  const result = validateResumeClaims({
    draft,
    facts,
    sourceMap: [],
    purpose: "create_resume",
  });
  assert.strictEqual(result.valid, true, result.errors.join("\n"));
  assert.ok(result.warnings.some((warning) => warning.includes("جهة أو تاريخ")));
}

{
  const draft = clone(validDraft);
  draft.skills.push({ name: "Java", evidenceSourceId: "resume_project_1" });
  const result = validateResumeClaims({
    draft,
    facts: baseFacts,
    sourceMap: validSourceMap,
    purpose: "create_resume",
  });
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("Java")));
}

{
  const draft = clone(validDraft);
  draft.skills.push({ name: "Python", evidenceSourceId: "resume_project_1" });
  const result = validateResumeClaims({
    draft,
    facts: baseFacts,
    sourceMap: validSourceMap,
    purpose: "tailor_resume",
  });
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("Python")));
}

{
  const draft = clone(validDraft);
  draft.skills.push({ name: "Power BI", evidenceSourceId: "" });
  const result = validateResumeClaims({
    draft,
    facts: baseFacts,
    sourceMap: validSourceMap,
    purpose: "tailor_resume",
  });
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("Power BI")));
}

{
  // Presentation spelling may use React.js and a shortened certification
  // title, but both remain confirmed when they came from the portfolio.
  const facts = collectFacts({
    profile: {
      skills: ["React"],
      certifications: [
        { title: "ITIL v4 Foundation", provider: "PeopleCert", year: "2024" },
      ],
    },
    resume: null,
    opportunity: null,
    collectedFacts: {},
  });
  const draft = clone(validDraft);
  draft.education = [];
  draft.professionalSummary = "متخصصة في تقنية المعلومات مهتمة بتطوير واجهات المستخدم.";
  draft.projects[0].technologies = ["React.js"];
  draft.skills = [{ name: "React.js", evidenceSourceId: "portfolio_basic" }];
  draft.certifications = [
    { sourceId: "portfolio_cert_ITIL_v4_Foundation", name: "ITIL", issuer: "PeopleCert", date: "2024", details: "" },
  ];
  const result = validateResumeClaims({
    draft,
    facts,
    sourceMap: validSourceMap,
    purpose: "tailor_resume",
  });
  assert.strictEqual(result.valid, true, result.errors.join("\n"));
}

console.log("resumeAgentValidation tests passed");
