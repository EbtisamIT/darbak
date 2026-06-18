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
      default: "", // كيف حصل على الفرصة
    },
    duration: {
      type: String,
      required: true, // مدة التدريب
    },
    trainingYear: {
      type: String,
    },
    wasHired: {
      type: String,
      enum: ["yes", "no", "not_sure", ""],
      default: "",
    },
    hadReward: {
      type: String,
      enum: ["yes", "no", "not_sure", ""],
      default: "",
    },
    starRating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    ratings: {
      type: [String],
      default: [],
      validate: {
        validator: (value) => value.length <= 2,
        message: "يمكن اختيار تقييمين كحد أقصى",
      },
    },


    description: {
      type: String,
      required: true, // وصف التجربة
    },
    title: {
      type: String,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    reviewedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
      default: "",
    },

    // ✅ التخصص
    majorCategory: {
      type: String,
    },
    major: {
      type: String,
      required: true,
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
