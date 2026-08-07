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
    rewardAmount: {
      type: String,
      default: "",
    },
    trainingEnvironment: {
      type: String,
      enum: ["mixed", "women", "men", ""],
      default: "",
    },
    benefitedFromTraining: {
      type: String,
      enum: ["yes", "no", ""],
      default: "",
    },
    wouldRecommend: {
      type: String,
      enum: ["yes", "no", ""],
      default: "",
    },
    trainingMode: {
      type: String,
      enum: ["onsite", "remote", ""],
      default: "",
    },
    ambassadorConsent: {
      type: String,
      enum: ["yes", "no", ""],
      default: "no",
    },
    ambassadorLinkedInUrl: {
      type: String,
      default: "",
    },
    ambassadorProfileImageUrl: {
      type: String,
      default: "",
    },
    ambassadorDisplayName: {
      type: String,
      default: "",
    },
    featuredAmbassadorLogoUrl: {
      type: String,
      default: "",
    },
    featuredAmbassadorCardTitle: {
      type: String,
      default: "",
    },
    featuredAmbassadorCardSummary: {
      type: String,
      default: "",
    },
    featuredAmbassadorCardTags: {
      type: [String],
      default: [],
    },
    featuredAmbassador: {
      type: Boolean,
      default: false,
      index: true,
    },
    featuredAmbassadorAt: {
      type: Date,
    },
    featuredAmbassadorUntil: {
      type: Date,
      index: true,
    },
    submittedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    submissionStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    rewardEligible: {
      type: Boolean,
      default: false,
      index: true,
    },
    rewardStatus: {
      type: String,
      enum: ["pending", "granted", "not_eligible", "revoked"],
      default: "not_eligible",
      index: true,
    },
    rewardGrantedAt: {
      type: Date,
    },
    rewardStartsAt: {
      type: Date,
    },
    rewardExpiresAt: {
      type: Date,
    },
    rewardGrantedBy: {
      type: String,
      default: "",
    },
    publicationConsent: {
      type: Boolean,
      default: false,
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
    interviewQuestions: {
      type: [String],
      default: [],
    },


    description: {
      type: String,
      required: true, // وصف التجربة
    },
    title: {
      type: String,
    },
    sourceType: {
      type: String,
      enum: ["direct", "public_summary"],
      default: "direct",
      index: true,
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

experienceSchema.index({ status: 1, createdAt: -1 });
experienceSchema.index({ status: 1, reviewedAt: -1, createdAt: -1 });
experienceSchema.index({ status: 1, city: 1, createdAt: -1 });
experienceSchema.index({ status: 1, major: 1, createdAt: -1 });
experienceSchema.index({ status: 1, majorCategory: 1, createdAt: -1 });
experienceSchema.index({ status: 1, organizationName: 1 });
experienceSchema.index({ status: 1, hadReward: 1, trainingEnvironment: 1 });

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
