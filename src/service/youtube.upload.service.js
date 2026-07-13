// src/service/youtube.upload.service.js
const axios = require("axios");
const fs = require("fs");
const path = require("path");

/**
 * YouTube Data API v3 se video upload karo
 * @param {string} accessToken - Decrypted access token
 * @param {object} videoFile - { path, originalname, mimetype }
 * @param {object} meta - { title, description, tags }
 */
const uploadVideoToYouTube = async (accessToken, videoFile, meta = {}) => {
  const title       = meta.title || "My Video";
  const description = meta.description || "";
  const tags        = meta.tags || [];

  // Step 1: Initiate resumable upload
  const initRes = await axios.post(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      snippet: {
        title,
        description,
        tags,
        categoryId: "22" // People & Blogs — change karo agar chahiye
      },
    //   status: {
    //     privacyStatus: "public" // "private" ya "unlisted" bhi ho sakta hai
    //   }
    // ✅ Yeh hona chahiye — dynamic
status: {
  privacyStatus: meta.privacy || "public"
}
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Upload-Content-Type": videoFile.mimetype || "video/mp4",
        "X-Upload-Content-Length": fs.statSync(videoFile.path).size
      }
    }
  );

  const uploadUrl = initRes.headers.location;
  if (!uploadUrl) throw new Error("YouTube upload URL nahi mila");

  // Step 2: Upload video bytes
  const fileBuffer = fs.readFileSync(videoFile.path);
  const uploadRes = await axios.put(uploadUrl, fileBuffer, {
    headers: {
      "Content-Type": videoFile.mimetype || "video/mp4",
      "Content-Length": fileBuffer.length
    },
    maxContentLength: Infinity,
    maxBodyLength: Infinity
  });

  const videoId = uploadRes.data?.id;
  if (!videoId) throw new Error("YouTube video ID nahi mila upload ke baad");

  return {
    videoId,
    videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
    title: uploadRes.data?.snippet?.title
  };
};

module.exports = { uploadVideoToYouTube };