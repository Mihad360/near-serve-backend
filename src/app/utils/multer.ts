/* eslint-disable @typescript-eslint/no-unused-vars */
import multer from "multer";
import fs from "fs";
import path from "path";

/**
 * Ensure a directory exists (creates recursively if missing)
 */
const ensureDirExists = (dirPath: string) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

/**
 * Decide folder based on mime type
 */
export const getUploadFolder = (mimetype: string) => {
  if (mimetype.startsWith("image")) return "images";
  if (mimetype.startsWith("audio")) return "audio";
  return "docs"; // pdf, doc, docx
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const publicDir = path.join(process.cwd(), "public");
      const folder = getUploadFolder(file.mimetype);
      const uploadDir = path.join(publicDir, folder);

      // Ensure directories exist
      ensureDirExists(publicDir);
      ensureDirExists(uploadDir);

      cb(null, uploadDir);
    } catch (error) {
      cb(new Error("Failed to create upload directory"), "");
    }
  },

  filename: (req, file, cb) => {
    try {
      const ext = path.extname(file.originalname);
      const baseName = path
        .basename(file.originalname, ext)
        .replace(/\s+/g, "-")
        .toLowerCase();

      const uniqueName = `${Date.now()}-${baseName}${ext}`;
      cb(null, uniqueName);
    } catch (error) {
      cb(new Error("Failed to generate file name"), "");
    }
  },
});

/**
 * File type validation
 */
const fileFilter: multer.Options["fileFilter"] = (req, file, cb) => {
  console.log(file);
  const allowedTypes = [
    // Images
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/jpg",

    // Audio
    "audio/mpeg", // mp3
    "audio/wav",
    "audio/ogg",
    "audio/webm",
    "audio/mp3",
    "audio/m4a", // keep
    "audio/mp4", // ✅ REQUIRED for m4a
    "audio/x-m4a", // ✅ fallback

    // Documents
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  if (!allowedTypes.includes(file.mimetype)) {
    return cb(
      new Error(
        "Invalid file type. Only image, audio, PDF, and Word documents are allowed.",
      ),
    );
  }

  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});
