const mongoose = require('mongoose');

const experienceSchema = new mongoose.Schema(
  {
    organizationName: {
      type: String,
      required: true, // اسم الجهة
    },
    city: {
      type: String,
      required: true, // المدينة
    },
    howApplied: {
      type: String,
      required: true, // كيف قدم
    },
    duration: {
      type: String,
      required: true, // مدة التدريب
    },
    starRating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },


    description: {
      type: String,
      required: true, // وصف التجربة
    },
    title: {
      type: String,
    },

    // ✅ التخصص الجديد
    major: {
      type: String,
      required: true,
      enum: [
        "الحاسب",
        "الطب",
        "الإدارة",
        "الموارد البشرية",
        "المالية",
        "المحاسبة",
        "التسويق",
        "إدارة الأعمال",
        "الاقتصاد",
        "قانون ومحاماة",
        "التصميم",
        "اللغة العربية",
        "اللغة الإنجليزية",
        "الشريعة والدين",
        "الهندسة",
        "الصحافة والإعلام",
        "العلاقات العامة",
      ],
    },
  },
  { timestamps: true }
);

// ✅ إنشاء العنوان تلقائيًا قبل الحفظ
experienceSchema.pre("save", function (next) {
  if (this.organizationName && this.city) {
    this.title = `تجربتي في ${this.organizationName} بـ${this.city}`;
  } else if (this.organizationName) {
    this.title = `تجربتي في ${this.organizationName}`;
  }
  next();
});

module.exports = mongoose.model("experiences", experienceSchema);
