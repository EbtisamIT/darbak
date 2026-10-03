import React from "react";

// Shared verbatim fields for manual opportunities and Inbox drafts.
export default function OpportunityFormFields({ opportunityForm, updateOpportunityField, adminColors, adminSelectStyle, MultiChipSelector, opportunityCityOptions, majorCategoryOptions, normalizeFormArray, ALL_SPECIALTIES_VALUE, getSpecialtiesForCategories, getCategoriesForSpecialties, opportunitySelectFields }) {
  return <>
            <div className="admin-edit-grid">
              {[
                ["organizationName", "اسم الجهة", "مثال: STC"],
                ["title", "عنوان الفرصة", "برنامج التدريب التعاوني"],
                ["applicationUrl", "رابط التقديم", "https://..."],
                ["logoUrl", "رابط الشعار", "https://.../logo.png"],
                ["sourceUrl", "رابط المصدر", "رابط إعلان رسمي إن وجد"],
                ["submitterContact", "تواصل المرسل", "اختياري"],
              ].map(([field, label, placeholder]) => (
                <label key={field} style={{ color: adminColors.textSoft, fontSize: "13px" }}>
                  {label}
                  <input
                    value={opportunityForm[field] || ""}
                    onChange={(e) =>
                      updateOpportunityField(field, e.target.value)
                    }
                    placeholder={placeholder}
                    style={{
                      ...adminSelectStyle,
                      marginTop: "5px",
                    }}
                  />
                </label>
              ))}

              <MultiChipSelector
                label="المدن أو المناطق المناسبة"
                values={opportunityForm.cities}
                options={opportunityCityOptions}
                onChange={(nextCities) =>
                  updateOpportunityField("cities", nextCities)
                }
                emptyLabel="كل المدن"
                maxHeight="150px"
                helpText="اترك/يها على كل المدن إذا كانت الفرصة عامة، أو اضغطي أكثر من مدينة/منطقة لإضافتها."
              />

              <MultiChipSelector
                label="التخصصات الرئيسية المناسبة"
                values={opportunityForm.majorCategories}
                options={majorCategoryOptions}
                onChange={(nextCategories) =>
                  updateOpportunityField("majorCategories", nextCategories)
                }
                emptyLabel="كل التخصصات"
                maxHeight="165px"
                helpText="اختاري أكثر من تخصص رئيسي بالضغط على الشرائح. تركها فارغة يعني أن الفرصة عامة أو حسب التخصصات الفرعية المختارة."
              />

              <div
                style={{
                  color: adminColors.textSoft,
                  fontSize: "13px",
                  gridColumn: "1 / -1",
                }}
              >
                <MultiChipSelector
                  label="التخصصات الفرعية المناسبة"
                  values={opportunityForm.specialties}
                  options={[
                    {
                      value: ALL_SPECIALTIES_VALUE,
                      label: "جميع التخصصات",
                    },
                    ...getSpecialtiesForCategories(
                      normalizeFormArray(opportunityForm.majorCategories)
                    ).map((option) => ({
                      value: option.name,
                      label: option.name,
                    })),
                  ]}
                  onChange={(nextSpecialties) =>
                    updateOpportunityField("specialties", nextSpecialties)
                  }
                  emptyLabel="كل التخصصات الفرعية"
                  maxHeight="190px"
                  showEmptyButton={false}
                  helpText="إذا اخترت/ي تخصصات رئيسية، تظهر لك فروعها فقط هنا. اختيار جميع التخصصات يجعل الفرصة عامة."
                />
                {!normalizeFormArray(opportunityForm.specialties).includes(
                  ALL_SPECIALTIES_VALUE
                ) && (
                  <small
                    style={{
                      display: "block",
                      marginTop: "5px",
                      color: adminColors.brand,
                      lineHeight: 1.7,
                    }}
                  >
                    التصنيف الرئيسي:{" "}
                    {Array.from(
                      new Set([
                        ...normalizeFormArray(opportunityForm.majorCategories),
                        ...getCategoriesForSpecialties(
                          normalizeFormArray(opportunityForm.specialties)
                        ),
                      ])
                    ).join("، ") || "غير محدد"}
                  </small>
                )}
              </div>

              <label style={{ color: adminColors.textSoft, fontSize: "13px" }}>
                تاريخ انتهاء التقديم
                <input
                  type="date"
                  value={opportunityForm.deadline || ""}
                  onChange={(e) =>
                    updateOpportunityField("deadline", e.target.value)
                  }
                  style={adminSelectStyle}
                />
              </label>

              {opportunitySelectFields.map((field) => (
                <label
                  key={field.field}
                  style={{ color: adminColors.textSoft, fontSize: "13px" }}
                >
                  {field.label}
                  <select
                    value={opportunityForm[field.field] || ""}
                    onChange={(e) =>
                      updateOpportunityField(field.field, e.target.value)
                    }
                    style={adminSelectStyle}
                  >
                    {field.options.map(([value, label]) => (
                      <option key={`${field.field}-${value}`} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>

            <label style={{ color: adminColors.textSoft, fontSize: "13px" }}>
              ملاحظة للطلاب
              <textarea
                value={opportunityForm.note || ""}
                onChange={(e) => updateOpportunityField("note", e.target.value)}
                rows={3}
                placeholder="مثال: تأكدي من شروط الجهة قبل التقديم."
                style={{
                  ...adminSelectStyle,
                  lineHeight: 1.8,
                }}
              />
            </label>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                color: adminColors.textSoft,
                fontSize: "13px",
              }}
            >
              <input
                type="checkbox"
                checked={Boolean(opportunityForm.featured)}
                onChange={(e) =>
                  updateOpportunityField("featured", e.target.checked)
                }
              />
              فرصة مميزة وتظهر أولًا
            </label>

  </>;
}
