const express = require('express');
const mongoose = require('mongoose');
const cors = require("cors");
require('dotenv').config();

const Experience = require('./models/Experience');

const app = express();
const PORT = process.env.PORT || 3001;

// ===== Middlewares =====
app.use(cors());
app.use(express.json());

// ===== MongoDB Connection (اتصال واحد فقط) =====
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
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

// إنشاء تجربة
app.post('/api/experiences', async (req, res) => {
  try {
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
    const experiences = await Experience.find().sort({ createdAt: -1 });

    console.log("✅ Data fetched:", experiences.length);

    res.json(experiences);
  } catch (err) {
    console.error("❌ FULL ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});