const express = require("express");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const mongoose = require("mongoose");
require("dotenv").config();

const Image = require("./models/Image");

const app = express();

// MongoDB connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const ext = file.originalname.split(".").pop().toLowerCase();
    if (allowedTypes.test(ext)) cb(null, true);
    else cb(new Error("Only images are allowed (jpeg, jpg, png, gif)"));
  },
});

// Routes
app.get("/", (req, res) => res.send("Server is running..."));

app.post("/upload", upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });

  try {
    // Upload buffer to Cloudinary
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: process.env.CLOUDINARY_FOLDER },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    // Save image info in MongoDB
    const image = new Image({
      url: result.secure_url,
      public_id: result.public_id,
      originalName: req.file.originalname,
    });

    await image.save();

    res.status(200).json({
      message: "Image uploaded and saved successfully",
      image,
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ message: "Upload error", error: err.message });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Global error:", err.message);
  res.status(500).json({ message: err.message });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
