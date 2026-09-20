const cleanText = (value = "", maxLength = 900) =>
  value
    .toString()
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);

const { normalizeResumeSkills } = require("./resumeSkillNormalization");
const {
  getCanonicalResumeExperiences,
  resolveResumeFactsOwnership,
} = require("./resumeArchitecture");
const { normalizeResumeFactCollections } = require("./resumeFactNormalization");

const ACADEMIC_TRACK_IDS = new Set([
  "business_analytics",
  "data_analytics",
  "software_development",
  "artificial_intelligence",
  "cybersecurity",
  "computer_networks",
  "accounting",
  "finance",
  "marketing",
  "human_resources",
  "project_management",
  "supply_chain",
  "graphic_design",
]);

const getAcademicTrackId = (value = "", source = "") => {
  const normalized = cleanText(value, 80);
  if (normalized === "no_academic_track") return "";
  if (ACADEMIC_TRACK_IDS.has(normalized)) return normalized;
  return source === "custom" ? normalized : "";
};

// These values are student facts, not resume presentation. ResumeProfile owns
// them for Resume flows; Portfolio is only a read-only legacy fallback when a
// ResumeProfile has no facts at all.
const PROTECTED_PERSONAL_FACT_KEYS = [
  "fullName",
  "email",
  "phone",
  "city",
  "major",
  "university",
  "degree",
  "studentStatus",
  "grammaticalGender",
  "studyStartYear",
  "graduationYear",
  "expectedGraduationYear",
  "gpa",
  "gpaScale",
  "academicTrack",
  "relevantCoursework",
  "honors",
  "linkedinUrl",
  "githubUrl",
  "personalUrl",
  "portfolioUrl",
];

const escapeHtml = (value = "") =>
  value
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const hasValue = (value) =>
  Array.isArray(value)
    ? value.length > 0
    : Boolean(value && value.toString().trim());

const hasArabicText = (value = "") => /[\u0600-\u06FF]/.test(String(value));

// A translation is stored independently from the Arabic master. Older clients
// could submit an open English version to the master save endpoint while adding
// an English name for PDF download. Keep an existing Arabic presentation, but
// fall back to the verified Arabic fact when that stale English presentation is
// encountered at read time.
const useArabicPresentation = (presentationValue = "", verifiedValue = "") => {
  const presentation = cleanText(presentationValue, 1800);
  const verified = cleanText(verifiedValue, 1800);
  if (!presentation) return verified;
  if (hasArabicText(presentation)) return presentation;
  return hasArabicText(verified) ? verified : "";
};

const useArabicAchievements = (presentation = [], verified = []) => {
  if (!Array.isArray(presentation) || !presentation.length) {
    const verifiedText = (Array.isArray(verified) ? verified : [])
      .map((item) => cleanText(item?.text || item?.html || "", 1800))
      .join(" ");
    return hasArabicText(verifiedText) ? verified : [];
  }
  const presentationText = presentation
    .map((item) => cleanText(item?.text || item?.html || "", 1800))
    .join(" ");
  const verifiedText = (Array.isArray(verified) ? verified : [])
    .map((item) => cleanText(item?.text || item?.html || "", 1800))
    .join(" ");
  if (hasArabicText(presentationText)) return presentation;
  return hasArabicText(verifiedText) ? verified : [];
};

const isolateArabicMasterPresentation = (incoming = {}, existing = {}) => {
  const preserveText = (nextValue = "", previousValue = "") => {
    const next = cleanText(nextValue, 1800);
    const previous = cleanText(previousValue, 1800);
    if (hasArabicText(next)) return next;
    return hasArabicText(previous) ? previous : "";
  };
  const preserveEntries = (nextEntries = [], previousEntries = []) => {
    const previousById = new Map(
      (Array.isArray(previousEntries) ? previousEntries : []).map((entry) => [entry?.id, entry]),
    );
    return (Array.isArray(nextEntries) ? nextEntries : []).map((entry) => {
      const previous = previousById.get(entry?.id) || {};
      const isolatedEntry = {
        ...entry,
        description: preserveText(entry?.description || entry?.details, previous?.description || previous?.details),
        achievements: useArabicAchievements(entry?.achievements, previous?.achievements),
      };
      if (Object.prototype.hasOwnProperty.call(entry || {}, "details") || Object.prototype.hasOwnProperty.call(previous, "details")) {
        isolatedEntry.details = preserveText(entry?.details || entry?.description, previous?.details || previous?.description);
      }
      return isolatedEntry;
    });
  };
  const experiences = preserveEntries(
    incoming.experiences || incoming.experience,
    existing.experiences || existing.experience,
  );
  return {
    ...incoming,
    summary: preserveText(incoming.summary, existing.summary),
    experiences,
    experience: experiences,
    projects: preserveEntries(incoming.projects, existing.projects),
    volunteering: preserveEntries(incoming.volunteering, existing.volunteering),
  };
};

// ResumeProfile is the Arabic master. A legacy translation could have stored
// an English summary on it, while a Portfolio without professionalContext has
// no Arabic text for useArabicPresentation to restore. Never render that
// English presentation in the Arabic master. If no valid Arabic presentation
// exists, leave the summary empty for an explicit student edit; never invent
// Arabic wording or fall back to English.
const getArabicMasterSummary = ({ presentationValue = "", verifiedFacts = {}, personalInfo = {} } = {}) => {
  const presentation = cleanText(presentationValue, 1800);
  if (hasArabicText(presentation)) return presentation;

  const professionalContext = cleanText(verifiedFacts.professionalContext, 900);
  if (hasArabicText(professionalContext)) return professionalContext;
  return "";
};

const getArabicMasterName = (resume = {}) => {
  const current = cleanText(resume.personalInfo?.fullName, 120);
  const savedSource = cleanText(resume.rawDraftInput?.basic?.fullName, 120);
  const verified = cleanText(resume.verifiedResumeFacts?.personalInfo?.fullName, 120);
  return [current, savedSource, verified].find(hasArabicText) || current || savedSource || verified;
};

const isInvalidResumePersonalValue = (key = "", value = "") => {
  if (key !== "phone") return false;
  const digits = cleanText(value, 40).replace(/[^0-9٠-٩]/g, "");
  // A previous resume flow persisted a numeric zero as a phone value. Treat
  // it as missing, while preserving real phone numbers as strings.
  return digits.length < 8;
};

const uniqueText = (current = [], fallback = []) => {
  const seen = new Set();
  return [...(Array.isArray(current) ? current : []), ...(Array.isArray(fallback) ? fallback : [])]
    .filter(Boolean)
    .filter((item) => {
      const key = cleanText(item, 160).toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const entryFingerprint = (entry = {}) =>
  [entry.title, entry.organization || entry.subtitle, entry.period, entry.url]
    .map((value) => cleanText(value, 180).toLowerCase())
    .join("|");

const mergeEntries = (current = [], fallback = []) => {
  const merged = Array.isArray(current) ? [...current] : [];
  const existing = new Set(merged.map(entryFingerprint));

  (Array.isArray(fallback) ? fallback : []).forEach((entry) => {
    const fingerprint = entryFingerprint(entry);
    if (fingerprint && !existing.has(fingerprint)) {
      existing.add(fingerprint);
      merged.push(entry);
    }
  });

  return merged;
};

const hydrateEducationEntries = (current = [], fallback = []) => {
  const merged = mergeEntries(current, fallback);
  const portfolioEducation = (Array.isArray(fallback) ? fallback : [])[0];
  if (!portfolioEducation) return merged;

  return merged.map((entry) => {
    const sameEducation =
      cleanText(entry.title, 140) === cleanText(portfolioEducation.title, 140) &&
      cleanText(entry.organization || entry.subtitle, 180) ===
        cleanText(portfolioEducation.organization || portfolioEducation.subtitle, 180);
    const missingYear = !hasValue(entry.period) && !hasValue(entry.endDate);
    if (!sameEducation || !missingYear || !hasValue(portfolioEducation.endDate)) return entry;

    return {
      ...entry,
      period: portfolioEducation.period,
      endDate: portfolioEducation.endDate,
      isCurrent: false,
    };
  });
};

const mergeLanguages = (current = [], fallback = []) => {
  const merged = Array.isArray(current) ? [...current] : [];
  const names = new Set(merged.map((language) => cleanText(language?.name, 80).toLowerCase()));
  (Array.isArray(fallback) ? fallback : []).forEach((language) => {
    const name = cleanText(language?.name, 80).toLowerCase();
    if (name && !names.has(name)) {
      names.add(name);
      merged.push(language);
    }
  });
  return merged;
};

const mergeLinks = (current = [], fallback = []) => {
  const merged = Array.isArray(current) ? [...current] : [];
  const urls = new Set(merged.map((link) => cleanText(link?.url, 260).toLowerCase()));
  (Array.isArray(fallback) ? fallback : []).forEach((link) => {
    const url = cleanText(link?.url, 260).toLowerCase();
    if (url && !urls.has(url)) {
      urls.add(url);
      merged.push(link);
    }
  });
  return merged;
};

const buildPortfolioHeadline = (portfolio = {}) => {
  const major = cleanText(portfolio.major, 120);
  const rawStatus = cleanText(portfolio.studentStatus, 40);
  const normalizedStatus = {
    طالبة: "student", طالبه: "student", طالب: "student",
    خريجة: "graduate", خريجه: "graduate", خريج: "graduate",
    "متوقعة التخرج": "expected_graduate", "متوقع التخرج": "expected_graduate",
  }[rawStatus] || portfolio.studentStatus;
  const statusLabels = {
    student: { feminine: "طالبة", masculine: "طالب", neutral: "" },
    graduate: { feminine: "خريجة", masculine: "خريج", neutral: "" },
    expected_graduate: { feminine: "متوقعة التخرج", masculine: "متوقع التخرج", neutral: "" },
  };
  const stage = cleanText(portfolio.degreeLevel, 120);
  if (!major) return "";
  if (["طالبة", "طالبه", "خريجة", "خريجه", "طالب", "خريج"].includes(rawStatus)) {
    const explicitArabicStatus = rawStatus.replace("طالبه", "طالبة").replace("خريجه", "خريجة");
    return `${explicitArabicStatus} ${major}`;
  }
  if (statusLabels[normalizedStatus]) {
    return [statusLabels[normalizedStatus][portfolio.grammaticalGender] || statusLabels[normalizedStatus].neutral, major].filter(Boolean).join(" ");
  }
  const confirmedStage = stage.match(/(?:طالبة|طالب|خريجة|خريج)/)?.[0];
  return confirmedStage ? `${confirmedStage} ${major}` : major;
};

const mapPortfolioEntry = (entry = {}, prefix = "portfolio-entry", index = 0) => {
  const title = cleanText(entry.title || entry.name, 140);
  const organization = cleanText(entry.organization || entry.issuer || entry.provider, 180);
  const responsibilities = Array.isArray(entry.responsibilities)
    ? entry.responsibilities
      .map((responsibility) => cleanText(responsibility?.text || responsibility, 320))
      .filter(Boolean)
    : [];
  const description = cleanText(entry.description || entry.details || responsibilities.join("، "), 900);
  return {
    id: entry.id || entry._id?.toString?.() || `${prefix}-${index}-${title || organization || "item"}`,
    title,
    subtitle: organization,
    organization,
    experienceType: cleanText(entry.experienceType, 60),
    ...(entry.activityType ? { activityType: cleanText(entry.activityType, 60) } : {}),
    period: cleanText(entry.period || entry.year, 90),
    startDate: cleanText(entry.startDate, 40),
    endDate: cleanText(entry.endDate || entry.year, 40),
    isCurrent: Boolean(entry.current || entry.isCurrent),
    location: cleanText(entry.location || entry.city, 90),
    url: cleanText(entry.url || entry.credentialUrl || entry.link, 260),
    technologies: Array.isArray(entry.technologies)
      ? entry.technologies.map((technology) => cleanText(technology, 80)).filter(Boolean)
      : cleanText(entry.technologies, 400).split(/[،,]/u).map((technology) => cleanText(technology, 80)).filter(Boolean),
    description,
    details: description,
    userSourceDescription: description,
    userSourceContributions: responsibilities,
    achievements: responsibilities.length
      ? responsibilities.map((text, responsibilityIndex) => ({
        id: entry.responsibilities?.[responsibilityIndex]?.id || `${prefix}-${index}-responsibility-${responsibilityIndex}`,
        text,
        html: `<p>${escapeHtml(text)}</p>`,
      }))
      : description
        ? [{ id: `${prefix}-${index}-detail`, text: description, html: `<p>${escapeHtml(description)}</p>` }]
        : [],
  };
};

const mapPortfolioToResumePayload = (portfolio = {}, contact = "", options = {}) => {
  const frontendUrl = options.frontendUrl || "";
  const sectionOrder = options.sectionOrder || [];
  const portfolioUrl = portfolio.slug && frontendUrl ? `${frontendUrl}/p/${portfolio.slug}` : "";
  const academicTrack = getAcademicTrackId(portfolio.academicTrack, portfolio.academicTrackSource);
  const educationDescription = [
    portfolio.major,
    academicTrack && `Academic track: ${academicTrack}`,
    portfolio.graduationYear && `سنة التخرج: ${portfolio.graduationYear}`,
    portfolio.expectedGraduationYear && `التخرج المتوقع: ${portfolio.expectedGraduationYear}`,
    portfolio.gpa && `المعدل: ${portfolio.gpa}${portfolio.gpaScale ? ` / ${portfolio.gpaScale}` : ""}`,
    ...(Array.isArray(portfolio.relevantCoursework) && portfolio.relevantCoursework.length
      ? [`مقررات ذات صلة: ${portfolio.relevantCoursework.join("، ")}`]
      : []),
    ...(Array.isArray(portfolio.honors) && portfolio.honors.length
      ? [`التكريم: ${portfolio.honors.join("، ")}`]
      : []),
  ].filter(Boolean).join(" · ");
  const hasPracticalExperience = Array.isArray(portfolio.experiences) && portfolio.experiences.some((entry) =>
    Boolean(cleanText(entry?.title || entry?.description || entry?.organization, 160))
  );
  const candidateIsStudent = ["student", "expected_graduate"].includes(portfolio.studentStatus);
  const defaultSectionOrder = candidateIsStudent && !hasPracticalExperience
    ? ["summary", "education", "projects", "skills", "experience", "certifications", "volunteering", "languages", "links"]
    : ["summary", "experience", "education", "projects", "skills", "certifications", "volunteering", "languages", "links"];

  return {
    personalInfo: {
      fullName: cleanText(portfolio.fullName, 120),
      email: cleanText(portfolio.email || contact, 160),
      phone: cleanText(portfolio.phone, 40),
      city: cleanText(portfolio.city, 80),
      major: cleanText(portfolio.major, 120),
      university: cleanText(portfolio.university, 160),
      degree: cleanText(portfolio.degreeLevel, 80),
      studentStatus: cleanText(portfolio.studentStatus, 40),
      grammaticalGender: cleanText(portfolio.grammaticalGender, 20),
      studyStartYear: cleanText(portfolio.studyStartYear, 20),
      graduationYear: cleanText(portfolio.graduationYear, 20),
      expectedGraduationYear: cleanText(portfolio.expectedGraduationYear, 20),
      gpa: cleanText(portfolio.gpa, 20),
      gpaScale: cleanText(portfolio.gpaScale, 20),
      academicTrack,
      relevantCoursework: uniqueText([], portfolio.relevantCoursework).map((course) => cleanText(course, 120)),
      honors: uniqueText([], portfolio.honors).map((honor) => cleanText(honor, 140)),
      linkedinUrl: cleanText(portfolio.linkedinUrl, 260),
      headline: buildPortfolioHeadline(portfolio),
      portfolioUrl,
      githubUrl: cleanText(portfolio.githubUrl, 260),
      personalUrl: cleanText(portfolio.personalWebsite, 260),
      trainingStart: cleanText(portfolio.trainingStart, 40),
      trainingEnd: cleanText(portfolio.trainingEnd, 40),
      trainingField: cleanText(portfolio.targetTrainingField, 160),
    },
    summary: cleanText(portfolio.bio, 900),
    education: portfolio.university
      ? [{
          id: "portfolio-education",
          title: cleanText(portfolio.degreeLevel || portfolio.major, 140),
          subtitle: cleanText(portfolio.university, 180),
          organization: cleanText(portfolio.university, 180),
          period: cleanText(portfolio.graduationYear || portfolio.expectedGraduationYear, 20),
          startDate: cleanText(portfolio.studyStartYear, 20),
          endDate: cleanText(portfolio.graduationYear || portfolio.expectedGraduationYear, 20),
          isCurrent:
            !portfolio.graduationYear &&
            ["student", "expected_graduate"].includes(portfolio.studentStatus),
          location: cleanText(portfolio.city, 90),
          url: "",
          description: educationDescription,
          details: cleanText(portfolio.major, 900),
          achievements: [],
        }]
      : [],
    experiences: (portfolio.experiences || []).map((entry, index) => mapPortfolioEntry(entry, "portfolio-experience", index)),
    projects: (portfolio.projects || []).map((entry, index) => mapPortfolioEntry(entry, "portfolio-project", index)),
    certifications: (portfolio.certifications || []).map((entry, index) => mapPortfolioEntry({
      ...entry,
      period: entry.issueDate || entry.year,
      endDate: entry.expirationDate,
    }, "portfolio-certification", index)),
    courses: (portfolio.courses || []).map((entry, index) => mapPortfolioEntry({
      ...entry,
      organization: entry.provider,
      period: entry.year,
      url: entry.url,
    }, "portfolio-course", index)),
    volunteering: (portfolio.volunteering || []).map((entry, index) => mapPortfolioEntry(entry, "portfolio-volunteering", index)),
    languages: (portfolio.languages || []).map((language, index) => ({
      id: language._id?.toString?.() || `portfolio-language-${index}`,
      name: cleanText(language.name, 70),
      level: cleanText(language.level, 70),
    })).filter((language) => language.name || language.level),
    links: [
      portfolio.linkedinUrl ? { id: "linkedin", label: "LinkedIn", url: cleanText(portfolio.linkedinUrl, 260) } : null,
      portfolio.githubUrl ? { id: "github", label: "GitHub", url: cleanText(portfolio.githubUrl, 260) } : null,
      portfolio.personalWebsite ? { id: "website", label: "الموقع الشخصي", url: cleanText(portfolio.personalWebsite, 260) } : null,
      portfolioUrl ? { id: "portfolio", label: "ملفي المهني", url: portfolioUrl } : null,
    ].filter(Boolean),
    skills: normalizeResumeSkills((Array.isArray(portfolio.skills) ? portfolio.skills : []).map((skill) => cleanText(skill, 60))),
    sectionOrder: sectionOrder.length ? sectionOrder : defaultSectionOrder,
    hiddenSections: [],
    settings: { language: "ar", direction: "rtl", density: "comfortable", fontSize: "medium", template: "clean", accentColor: "#42cfc3" },
  };
};

const buildVerifiedResumeFacts = (portfolio = {}, contact = "", options = {}) => {
  const payload = mapPortfolioToResumePayload(portfolio, contact, options);
  return {
    personalInfo: payload.personalInfo,
    education: payload.education,
    experiences: payload.experiences,
    projects: payload.projects,
    certifications: payload.certifications,
    courses: payload.courses,
    volunteering: payload.volunteering,
    languages: payload.languages,
    links: payload.links,
    skills: payload.skills,
    professionalContext: cleanText(portfolio.bio, 900),
  };
};

const orderVerifiedEntries = (verifiedEntries = [], presentationEntries = []) => {
  const order = new Map(
    (Array.isArray(presentationEntries) ? presentationEntries : [])
      .map((entry, index) => [entry?.id, index])
      .filter(([id]) => Boolean(id))
  );
  return [...verifiedEntries].sort(
    (left, right) => (order.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(right.id) ?? Number.MAX_SAFE_INTEGER)
  );
};

const composeCanonicalResume = (resume = {}, portfolio = {}, contact = "", options = {}) => {
  const ownership = resolveResumeFactsOwnership(resume, portfolio);
  // Any ResumeProfile facts make that profile authoritative. Portfolio is
  // considered only for an entirely empty legacy profile.
  if (!ownership.fallbackUsed) {
    const experiences = getCanonicalResumeExperiences(resume);
    const normalizedFacts = normalizeResumeFactCollections({
      experiences,
      projects: resume.projects || [],
      volunteering: resume.volunteering || [],
    });
    const language = options.language || resume.settings?.language || "ar";
    const personalInfo = {
      ...(resume.personalInfo || {}),
      ...(language === "ar" ? { fullName: getArabicMasterName(resume) } : {}),
    };
    const canonical = {
      ...resume,
      personalInfo,
      experiences,
      experience: experiences,
      factsProvenance: {
        factsOwner: ownership.factsOwner,
        fallbackUsed: ownership.fallbackUsed,
      },
      verifiedResumeFacts: {
        personalInfo,
        education: resume.education || [],
        experiences: normalizedFacts.experiences,
        projects: normalizedFacts.projects,
        certifications: resume.certifications || [],
        volunteering: normalizedFacts.volunteering,
        languages: resume.languages || [],
        links: resume.links || [],
        skills: resume.skills || [],
        professionalContext: "",
      },
    };
    return language === "en"
      ? canonical
      : isolateArabicMasterPresentation(canonical);
  }
  const legacyPortfolio = ownership.portfolio;
  const verifiedResumeFacts = buildVerifiedResumeFacts(legacyPortfolio, contact, options);
  // Existing users without a Portfolio keep their existing resume intact. Once
  // the Portfolio has a fact, that verified fact wins over stale resume copies.
  const hasVerifiedPortfolio = Boolean(legacyPortfolio?._id || Object.keys(legacyPortfolio || {}).length);
  if (!hasVerifiedPortfolio) {
    return {
      ...resume,
      factsProvenance: { factsOwner: "resume", fallbackUsed: false },
      verifiedResumeFacts: null,
    };
  }

  const language = options.language || resume.settings?.language || "ar";
  const personalInfo = { ...(resume.personalInfo || {}) };
  PROTECTED_PERSONAL_FACT_KEYS.forEach((key) => {
    const value = verifiedResumeFacts.personalInfo?.[key];
    if (hasValue(value)) personalInfo[key] = value;
  });
  // Unlike optional presentation values, an absent verified academic track is
  // authoritative and clears stale inferred values from older resume versions.
  personalInfo.academicTrack = verifiedResumeFacts.personalInfo?.academicTrack || "";
  // The headline is always derived from verified facts. English display is
  // localized on the client from these same facts.
  personalInfo.headline = buildPortfolioHeadline(legacyPortfolio);

  const composeEntries = (section) => {
    const verified = verifiedResumeFacts[section] || [];
    if (!verified.length) return resume[section] || [];
    const presentation = Array.isArray(resume[section]) ? resume[section] : [];
    const byId = new Map(presentation.map((entry) => [entry?.id, entry]));
    return orderVerifiedEntries(verified, presentation).map((factEntry) => {
      const display = byId.get(factEntry.id) || {};
      // Translation/tailoring may own wording and bullets, but never the
      // identity of the entry. For Arabic master resumes retain the verified
      // Portfolio description so an AI omission cannot erase it.
      const presentationDescription = display.description || display.details || "";
      const translatedDescription = language === "en"
        ? (presentationDescription || factEntry.description)
        : useArabicPresentation(presentationDescription, factEntry.description);
      return {
        ...factEntry,
        description: translatedDescription,
        details: translatedDescription,
        achievements: language === "en"
          ? (Array.isArray(display.achievements) && display.achievements.length
            ? display.achievements
            : factEntry.achievements)
          : useArabicAchievements(display.achievements, factEntry.achievements),
      };
    });
  };

  const summary = language === "en"
    ? resume.summary || ""
    : getArabicMasterSummary({
        presentationValue: resume.summary,
        verifiedFacts: verifiedResumeFacts,
        personalInfo,
      });

  const experiences = composeEntries("experiences");
  return {
    ...resume,
    personalInfo,
    summary,
    education: composeEntries("education"),
    experiences,
    experience: experiences,
    projects: composeEntries("projects"),
    certifications: composeEntries("certifications"),
    volunteering: composeEntries("volunteering"),
    languages: verifiedResumeFacts.languages?.length ? verifiedResumeFacts.languages : resume.languages || [],
    links: verifiedResumeFacts.links?.length ? verifiedResumeFacts.links : resume.links || [],
    skills: verifiedResumeFacts.skills?.length ? verifiedResumeFacts.skills : resume.skills || [],
    factsProvenance: {
      factsOwner: ownership.factsOwner,
      fallbackUsed: ownership.fallbackUsed,
    },
    verifiedResumeFacts,
  };
};

const composeEnglishResumeVersion = ({
  masterResume = {},
  englishVersionPayload = {},
  portfolio = {},
  contact = "",
  options = {},
} = {}) => {
  const master = composeCanonicalResume(masterResume, portfolio, contact, {
    ...options,
    language: "ar",
  });
  const english = englishVersionPayload || {};
  const englishEntriesFor = (section) => {
    const entries = section === "experience"
      ? english.experience || english.experiences || []
      : english[section] || [];
    return new Map((Array.isArray(entries) ? entries : []).map((entry) => [entry?.id, entry]));
  };
  const mergeEntries = (section, masterEntries = []) => {
    const englishById = englishEntriesFor(section);
    return (Array.isArray(masterEntries) ? masterEntries : []).map((sourceEntry) => {
      const presentation = englishById.get(sourceEntry?.id) || {};
      const presentationDescription = cleanText(presentation.description || presentation.details, 1800);
      const presentationAchievements = (Array.isArray(presentation.achievements) ? presentation.achievements : [])
        .filter((item) => {
          const text = cleanText(item?.text || item?.html || "", 1800);
          return text && !hasArabicText(text);
        });
      return {
        ...sourceEntry,
        description: presentationDescription && !hasArabicText(presentationDescription)
          ? presentationDescription
          : sourceEntry.description || sourceEntry.details || "",
        details: presentationDescription && !hasArabicText(presentationDescription)
          ? presentationDescription
          : sourceEntry.details || sourceEntry.description || "",
        achievements: presentationAchievements.length
          ? presentationAchievements
          : sourceEntry.achievements || [],
      };
    });
  };
  const experiences = mergeEntries("experience", master.experience || master.experiences || []);
  const savedSummary = cleanText(english.summary, 1800);

  return {
    ...master,
    summary: savedSummary && !hasArabicText(savedSummary) ? savedSummary : "",
    education: mergeEntries("education", master.education),
    experience: experiences,
    experiences,
    projects: mergeEntries("projects", master.projects),
    certifications: mergeEntries("certifications", master.certifications),
    volunteering: mergeEntries("volunteering", master.volunteering),
    skills: Array.isArray(english.skills) && english.skills.length ? english.skills : master.skills || [],
    languages: Array.isArray(english.languages) && english.languages.length ? english.languages : master.languages || [],
    sectionOrder: Array.isArray(english.sectionOrder) && english.sectionOrder.length
      ? english.sectionOrder
      : master.sectionOrder,
    hiddenSections: Array.isArray(english.hiddenSections)
      ? english.hiddenSections
      : master.hiddenSections,
    localizedDisplay: english.localizedDisplay || {},
    summaryProvenance: english.summaryProvenance || {},
    settings: {
      ...(master.settings || {}),
      ...(english.settings || {}),
      language: "en",
      direction: "ltr",
    },
  };
};

const composeResumePreview = ({
  language = "ar",
  localizedVersion = false,
  resume = {},
  masterResume = {},
  englishVersionPayload = {},
  portfolio = {},
  contact = "",
  options = {},
} = {}) => language === "en" && localizedVersion
  ? composeEnglishResumeVersion({
      masterResume,
      englishVersionPayload,
      portfolio,
      contact,
      options,
    })
  : composeCanonicalResume(resume, portfolio, contact, {
      ...options,
      language: language === "en" ? "en" : "ar",
    });

const hydrateResumeFromPortfolio = (resume = null, portfolioResume = {}) => {
  const ownership = resolveResumeFactsOwnership(resume || {}, portfolioResume || {});
  if (!resume) {
    return {
      resume: {
        ...portfolioResume,
        factsProvenance: { factsOwner: ownership.factsOwner, fallbackUsed: ownership.fallbackUsed },
      },
      patch: {},
      changed: false,
    };
  }

  if (!ownership.fallbackUsed) {
    const experiences = getCanonicalResumeExperiences(resume);
    return {
      resume: {
        ...resume,
        experiences,
        experience: experiences,
        factsProvenance: { factsOwner: "resume", fallbackUsed: false },
      },
      patch: {},
      changed: false,
    };
  }

  const currentPersonal = resume.personalInfo || {};
  const personalInfo = { ...currentPersonal };
  // A profile created from Portfolio has one authoritative source for core
  // identity facts. This repairs stale or cross-account values saved by an old
  // resume draft without touching scratch/manual resume profiles.
  const resumeOwnsFacts = false;
  const portfolioOwnsIdentity = true;
  Object.entries(portfolioResume.personalInfo || {}).forEach(([key, value]) => {
    if (
      (portfolioOwnsIdentity || !hasValue(personalInfo[key]) || isInvalidResumePersonalValue(key, personalInfo[key])) &&
      hasValue(value)
    ) {
      personalInfo[key] = value;
    }
  });

  const currentExperience = getCanonicalResumeExperiences(resume);
  const portfolioExperience = getCanonicalResumeExperiences(portfolioResume);
  const hydrated = {
    ...resume,
    personalInfo,
    summary: hasValue(resume.summary) ? resume.summary : portfolioResume.summary || "",
    education: resumeOwnsFacts
      ? resume.education || []
      : portfolioOwnsIdentity && Array.isArray(portfolioResume.education) && portfolioResume.education.length
      ? portfolioResume.education
      : hydrateEducationEntries(resume.education, portfolioResume.education),
    experiences: resumeOwnsFacts ? currentExperience : mergeEntries(currentExperience, portfolioExperience),
    experience: resumeOwnsFacts ? currentExperience : mergeEntries(currentExperience, portfolioExperience),
    projects: resumeOwnsFacts ? resume.projects || [] : mergeEntries(resume.projects, portfolioResume.projects),
    certifications: resumeOwnsFacts ? resume.certifications || [] : mergeEntries(resume.certifications, portfolioResume.certifications),
    volunteering: resumeOwnsFacts ? resume.volunteering || [] : mergeEntries(resume.volunteering, portfolioResume.volunteering),
    languages: resumeOwnsFacts ? resume.languages || [] : mergeLanguages(resume.languages, portfolioResume.languages),
    links: resumeOwnsFacts ? resume.links || [] : mergeLinks(resume.links, portfolioResume.links),
    skills: resumeOwnsFacts ? normalizeResumeSkills(resume.skills || []) : normalizeResumeSkills(uniqueText(resume.skills, portfolioResume.skills)),
    factsProvenance: { factsOwner: "portfolio_legacy", fallbackUsed: true },
  };
  return { resume: hydrated, patch: {}, changed: false };
};

module.exports = {
  PROTECTED_PERSONAL_FACT_KEYS,
  mapPortfolioToResumePayload,
  buildVerifiedResumeFacts,
  composeCanonicalResume,
  composeEnglishResumeVersion,
  composeResumePreview,
  isolateArabicMasterPresentation,
  hydrateResumeFromPortfolio,
};
