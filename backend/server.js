const express = require('express');
const mongoose = require('mongoose');
const cors = require("cors");
require('dotenv').config();

const Experience = require('./models/Experience');

const app = express();
const PORT = process.env.PORT || 3001;
const DEFAULT_EXPERIENCES_LIMIT = 36;
const MAX_EXPERIENCES_LIMIT = 60;

const normalizeSearchText = (value = "") =>
  value
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[أإآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ـ/g, "")
    .replace(/[\u064B-\u065F]/g, "")
    .replace(/\s+/g, " ");

// ===== Middlewares =====
app.use(cors());
app.use(express.json());

// ===== MongoDB Connection =====
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
  })
  .catch(err => {
    console.log("❌ MongoDB connection failed:", err);
  });

// Debug مهم جدًا
mongoose.connection.on("connected", () => {
  console.log("🟢 Mongoose connected");
});

mongoose.connection.on("error", (err) => {
  console.log("🔴 Mongoose error:", err);
});

// ===== Routes =====

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'darbak-api' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', database: mongoose.connection.readyState === 1 });
});

// إنشاء تجربة
app.post('/api/experiences', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const newExp = new Experience(req.body);
    await newExp.save();
    res.json(newExp);
  } catch (err) {
    console.error("❌ Error saving experience:", err);
    res.status(500).json({ error: err.message });
  }
});

// جلب التجارب
app.get('/api/experiences', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Database is not connected" });
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const requestedLimit = parseInt(req.query.limit, 10) || DEFAULT_EXPERIENCES_LIMIT;
    const limit = Math.min(Math.max(requestedLimit, 1), MAX_EXPERIENCES_LIMIT);
    const skip = (page - 1) * limit;
    const sortOption = req.query.sort || "latest";
    const majors = req.query.majors
      ? req.query.majors.split(",").map((major) => major.trim()).filter(Boolean)
      : [];
    const searchTerms = req.query.terms
      ? req.query.terms.split("|").map(normalizeSearchText).filter(Boolean)
      : [];

    const baseFilter = {};

    if (majors.length > 0) {
      baseFilter.major = { $in: majors };
    }

    const sort =
      sortOption === "rating"
        ? { starRating: -1, createdAt: -1 }
        : { createdAt: -1 };

    let experiences;
    let total;

    if (searchTerms.length > 0) {
      const candidates = await Experience.find(baseFilter).sort(sort).lean();

      const matchesSearch = (exp) => {
        const searchableValues = [
          exp.organizationName,
          exp.companyName,
          exp.major,
          exp.title,
        ]
          .filter(Boolean)
          .map(normalizeSearchText);

        return searchableValues.some((value) =>
          searchTerms.some((term) => value.includes(term))
        );
      };

      const filtered = candidates.filter(matchesSearch);
      total = filtered.length;
      experiences = filtered.slice(skip, skip + limit);
    } else {
      const [items, count] = await Promise.all([
        Experience.find(baseFilter).sort(sort).skip(skip).limit(limit).lean(),
        Experience.countDocuments(baseFilter),
      ]);

      experiences = items;
      total = count;
    }

    console.log("✅ Data fetched:", experiences.length);

    res.json({
      data: experiences,
      page,
      limit,
      total,
      hasMore: skip + experiences.length < total,
    });
  } catch (err) {
    console.error("❌ FULL ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
