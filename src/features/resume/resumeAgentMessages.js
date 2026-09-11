export const getStudentVisibleAgentMessages = (messages = []) => (Array.isArray(messages) ? messages : [])
  .filter((message) => {
    const value = String(message || "").trim();
    return value && !/^[A-Z0-9_:-]+$/u.test(value) && !/^(?:project_description|experience_description|certification_details):/iu.test(value) && !/\b(?:quality_validation_failed|fieldKey|hash|PENDING_DRAFT)\b/iu.test(value);
  });

export const getStudentVisibleMissingNotes = (items = []) => (Array.isArray(items) ? items : [])
  .filter((item) => item && !item.fieldKey && !item.inputType);
