// ==========================================
// FILE: src/utils/ensureInstagramImageRatio.util.js
// PURPOSE: Instagram sirf 4:5 (0.8) se 1.91:1 tak ke aspect ratio wali
//   images/feed-photos accept karta hai. Isse bahar ki koi bhi image
//   Instagram ke media-container step par hi reject ho jaati hai:
//     "The aspect ratio is not supported." (code 36003, subcode 2207009)
//
//   Ye function publish se PEHLE image ka actual width/height check
//   karta hai. Agar ratio already valid range me hai, kuch nahi karta
//   (original Cloudinary URL wapas de deta hai — extra upload nahi).
//   Agar range se bahar hai, to image ko CROP nahi karta (content loss
//   se bachne ke liye) — balki canvas ko white padding (letterbox /
//   pillarbox) se extend karke nearest valid ratio tak la deta hai,
//   phir usse Cloudinary pe re-upload karke naya URL return karta hai.
//
//   NOTE: Ye sirf IMAGES ke liye hai (sharp image library hai). Videos
//   (Reels) is fix me cover nahi hain — unke liye video processing
//   (ffmpeg) chahiye hoga, jo abhi project me dependency nahi hai.
// ==========================================

const axios = require("axios");
const sharp = require("sharp");
const cloudinary = require("../config/cloudinary.config");

const MIN_RATIO = 4 / 5;   // 0.8   — sabse "tall/narrow" allowed
const MAX_RATIO = 1.91;    // sabse "wide/short" allowed

/**
 * @param {string} imageUrl - original Cloudinary (ya kisi bhi publicly
 *   accessible) image URL
 * @returns {Promise<string>} - agar ratio already valid hai to same URL,
 *   warna padded image ka naya Cloudinary URL
 */
async function ensureInstagramImageRatio(imageUrl) {
  try {
    // ── 1. Image download karo memory me ──
    const { data: imageBuffer } = await axios.get(imageUrl, {
      responseType: "arraybuffer"
    });

    const image = sharp(Buffer.from(imageBuffer));
    const { width, height } = await image.metadata();

    if (!width || !height) {
      console.warn("⚠️ Instagram ratio-fix: metadata nahi mili, original URL use kar rahe hain");
      return imageUrl;
    }

    const ratio = width / height;

    // ── 2. Ratio already valid hai — kuch mat karo ──
    if (ratio >= MIN_RATIO && ratio <= MAX_RATIO) {
      return imageUrl;
    }

    console.log(
      `📐 Instagram ratio-fix: ${width}x${height} (ratio ${ratio.toFixed(3)}) valid range (${MIN_RATIO}-${MAX_RATIO}) se bahar hai — padding add kar rahe hain`
    );

    // ── 3. Padding calculate karo (crop nahi, sirf extend) ──
    let top = 0, bottom = 0, left = 0, right = 0;

    if (ratio < MIN_RATIO) {
      // Bahut tall/narrow → left-right pillarbox padding chahiye
      const targetWidth = Math.ceil(height * MIN_RATIO);
      const totalPad = targetWidth - width;
      left  = Math.floor(totalPad / 2);
      right = totalPad - left;
    } else {
      // Bahut wide/short → top-bottom letterbox padding chahiye
      const targetHeight = Math.ceil(width / MAX_RATIO);
      const totalPad = targetHeight - height;
      top    = Math.floor(totalPad / 2);
      bottom = totalPad - top;
    }

    const paddedBuffer = await sharp(Buffer.from(imageBuffer))
      .extend({
        top,
        bottom,
        left,
        right,
        background: { r: 255, g: 255, b: 255, alpha: 1 } // white background
      })
      .jpeg({ quality: 90 })
      .toBuffer();

    // ── 4. Padded image ko Cloudinary pe re-upload karo ──
    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "smm-uploads/instagram-fixed", resource_type: "image" },
        (error, result) => (error ? reject(error) : resolve(result))
      );
      stream.end(paddedBuffer);
    });

    console.log("✅ Instagram ratio-fix: padded image upload ho gayi:", uploadResult.secure_url);
    return uploadResult.secure_url;

  } catch (err) {
    // Fix fail ho jaaye to bhi publish attempt na ruke — original URL
    // ke saath try karo (kam se kam ratio ke alawa sab kaam karega)
    console.error("⚠️ Instagram ratio-fix failed, original URL use kar rahe hain:", err.message);
    return imageUrl;
  }
}

module.exports = ensureInstagramImageRatio;