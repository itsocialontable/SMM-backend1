// const cloudinary = require("../config/cloudinary.config");

// /**
//  * Disk pe saved temp file ko Cloudinary pe upload karta hai
//  *
//  * Pehle: file.buffer (RAM) → streamifier → Cloudinary  ← memory storage
//  * Ab:    file.path  (disk) → directly    → Cloudinary  ← disk storage, RAM safe ✅
//  *
//  * @param {string} filePath  - Multer ka file.path (temp file ka location)
//  * @param {string} mimetype  - file.mimetype (e.g. "image/jpeg", "video/mp4")
//  * @param {string} folder    - Cloudinary folder (default: "smm-uploads")
//  * @returns {Promise<{ secure_url, public_id, resource_type, format, bytes }>}
//  */
// const uploadToCloudinary = (filePath, mimetype = "", folder = "smm-uploads") => {
//   return new Promise((resolve, reject) => {

//     // ================= RESOURCE TYPE =================
//     let resource_type = "auto";
//     if      (mimetype.startsWith("video/")) resource_type = "video"; // audio intact ✅
//     else if (mimetype.startsWith("image/")) resource_type = "image";
//     else                                    resource_type = "raw";   // PDF, Word, etc.

//     // ================= UPLOAD OPTIONS =================
//     const uploadOptions = {
//       resource_type,
//       folder,
//       // Images ke liye auto quality + format optimize
//       ...(resource_type === "image" && {
//         quality:      "auto",
//         fetch_format: "auto"
//       })
//     };

//     // ================= UPLOAD =================
//     // file.path directly dete hain — streamifier ki zaroorat nahi
//     cloudinary.uploader.upload(filePath, uploadOptions, (error, result) => {
//       if (error) {
//         console.error("❌ Cloudinary upload error:", error);
//         return reject(new Error(`Cloudinary upload failed: ${error.message}`));
//       }
//       console.log("✅ Cloudinary upload success:", result.secure_url);
//       resolve(result);
//     });

//   });
// };

// module.exports = uploadToCloudinary;



const cloudinary = require("../config/cloudinary.config");
const sharp = require("sharp");
const fs = require("fs");

const uploadToCloudinary = async (
  filePath,
  mimetype = "",
  folder = "smm-uploads"
) => {
  try {
    let resource_type = "auto";

    if (mimetype.startsWith("video/")) {
      resource_type = "video";
    } else if (mimetype.startsWith("image/")) {
      resource_type = "image";
    } else {
      resource_type = "raw";
    }

    // ================= IMAGE COMPRESSION =================
    let uploadPath = filePath;

    if (resource_type === "image") {
      const compressedPath = `${filePath}-compressed.jpg`;

      await sharp(filePath)
        .resize({
          width: 1920,
          withoutEnlargement: true
        })
        .jpeg({
          quality: 70
        })
        .toFile(compressedPath);

      console.log("✅ Image compressed");

      uploadPath = compressedPath;
    }

    const uploadOptions = {
      resource_type,
      folder,
      ...(resource_type === "image" && {
        quality: "auto",
        fetch_format: "auto"
      })
    };

    const result = await cloudinary.uploader.upload(
      uploadPath,
      uploadOptions
    );

    console.log("✅ Cloudinary upload success:", result.secure_url);

    // compressed temp file delete
    if (uploadPath !== filePath) {
      fs.unlink(uploadPath, () => {});
    }

    return result;

  } catch (error) {
    console.error("❌ Cloudinary upload error:", error);
    throw new Error(`Cloudinary upload failed: ${error.message}`);
  }
};

module.exports = uploadToCloudinary;