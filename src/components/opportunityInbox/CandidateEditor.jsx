import React, { useState } from "react";
import OpportunityFormFields from "./OpportunityFormFields";
import { opportunityDraft } from "./opportunityDraft";
import { CandidateLinks } from "./CandidateCard";

export default function CandidateEditor({ candidate, formOptions, onSave, onCancel, busy }) {
  const original = opportunityDraft(candidate);
  const [form, setForm] = useState({ ...original, deadline: original.deadline ? String(original.deadline).slice(0, 10) : "" });
  const locked = ["published", "rejected"].includes(candidate.status);
  const save = (event) => {
    event.preventDefault();
    const cities = formOptions.normalizeFormArray(form.cities);
    const specialties = formOptions.normalizeFormArray(form.specialties);
    const categories = formOptions.normalizeFormArray(form.majorCategories);
    const all = (!specialties.length && !categories.length) || specialties.includes(formOptions.ALL_SPECIALTIES_VALUE);
    onSave({ _id: candidate._id, opportunityDraft: {
      ...form, cities, city: cities[0] || "",
      specialties: all ? [] : specialties,
      majorCategories: all ? [] : [...new Set([...categories, ...formOptions.getCategoriesForSpecialties(specialties)])],
    } });
  };
  return <form className="oi-editor" onSubmit={save}>
    <CandidateLinks item={{ ...candidate, opportunityDraft: form }} showEvidence />
    <OpportunityFormFields {...formOptions} opportunityForm={form} updateOpportunityField={(field, value) => setForm((previous) => ({ ...previous, [field]: value }))} />
    <div className="oi-actions"><button disabled={busy || locked}>حفظ</button><button type="button" onClick={onCancel} disabled={busy}>إلغاء</button></div>
  </form>;
}
