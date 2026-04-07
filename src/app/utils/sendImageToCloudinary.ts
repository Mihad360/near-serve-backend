import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import multer, { StorageEngine } from "multer";
import path from "path";
import config from "../config";

// Cloudinary config
cloudinary.config({
  cloud_name: config.CLOUDINARY_NAME,
  api_key: config.CLOUDINARY_API_KEY,
  api_secret: config.CLOUDINARY_API_SECRET,
});

// Upload Function
export const sendFileToCloudinary = (
  fileBuffer: Buffer,
  fileName: string,
  mimetype: string,
): Promise<UploadApiResponse> => {
  return new Promise((resolve, reject) => {
    if (!fileBuffer) return reject(new Error("Missing file buffer"));
    if (!mimetype) return reject(new Error("Missing mimetype"));

    const nameWithoutExt = path.parse(fileName).name;

    // ============================
    // 1️⃣ IMAGE Upload
    // ============================
    if (mimetype.startsWith("image/")) {
      const base64Image = fileBuffer.toString("base64");
      const dataUri = `data:${mimetype};base64,${base64Image}`;

      cloudinary.uploader.upload(
        dataUri,
        {
          public_id: nameWithoutExt,
          resource_type: "image",
          type: "upload",
          folder: "near-serve",
        },
        (error, result) => {
          if (error) return reject(error);
          if (!result) return reject(new Error("No result"));
          resolve(result);
        },
      );
    }

    // ============================
    // 2️⃣ PDF + WORD Uploads (raw)
    // ============================
    else if (
      mimetype === "application/pdf" ||
      mimetype === "application/msword" ||
      mimetype ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          public_id: fileName,
          resource_type: "raw",
        },
        (error, result) => {
          if (error) return reject(error);
          if (!result) return reject(new Error("No result"));
          resolve(result);
        },
      );
      uploadStream.end(fileBuffer);
    }

    // ============================
    // 3️⃣ AUDIO Upload (mp3, wav, webm, m4a, ogg etc.)
    // Cloudinary requires audio under resource_type: "video"
    // ============================
    else if (mimetype.startsWith("audio/")) {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          public_id: nameWithoutExt,
          resource_type: "video", // REQUIRED for audio files
          type: "upload",
        },
        (error, result) => {
          if (error) return reject(error);
          if (!result) return reject(new Error("No result"));
          resolve(result);
        },
      );
      uploadStream.end(fileBuffer);
    }

    // ============================
    // ❌ Unsupported file
    // ============================
    else {
      return reject(new Error("Unsupported file type"));
    }
  });
};

// Multer memory storage for receiving files
const storage: StorageEngine = multer.memoryStorage();

export const upload = multer({
  storage,
});
