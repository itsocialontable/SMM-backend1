// // ==========================================
// // FILE: src/service/socialPublish.service.js
// // NEW v18: Real publish functions for Twitter, LinkedIn, Facebook,
// //   Instagram, Pinterest. Pehle worker me sirf YouTube real tha,
// //   baaki sab "mock success" daal deta tha (kuch bhi actually
// //   platform par publish nahi hota tha).
// //
// // IMPORTANT — production me ye cheezein chahiye:
// //   - Facebook/Instagram: Meta App Review approval (pages_manage_posts,
// //     instagram_content_publish) + ek connected Facebook Page
// //   - LinkedIn: w_member_social scope approved on your LinkedIn app
// //   - Twitter: API v2 app with elevated/paid access for posting
// //   - Pinterest: approved Pinterest app + at least one board
// //
// // Har function ek consistent shape return karta hai:
// //   { status: "success", postId, url } ya throws Error(message)
// // ==========================================

// const axios = require("axios");

// // ─────────────────────────────────────────────────────────
// // TWITTER / X
// // Text + (optional) single image. Video upload TWITTER par
// // chunked upload chahiye — abhi tak support nahi kiya gaya,
// // agar sirf video diya gaya hai to text-only tweet chala denge.
// // ─────────────────────────────────────────────────────────
// async function publishToTwitter(accessToken, content, mediaUrls = []) {
//   let mediaIds = [];

//   const firstImage = mediaUrls.find(m => m.type === "image");
//   if (firstImage) {
//     try {
//       const imgRes = await axios.get(firstImage.url, { responseType: "arraybuffer" });
//       const base64 = Buffer.from(imgRes.data).toString("base64");

//       const uploadRes = await axios.post(
//         "https://upload.twitter.com/1.1/media/upload.json",
//         new URLSearchParams({ media_data: base64 }),
//         { headers: { Authorization: `Bearer ${accessToken}` } }
//       );

//       if (uploadRes.data?.media_id_string) {
//         mediaIds.push(uploadRes.data.media_id_string);
//       }
//     } catch (err) {
//       console.error("Twitter media upload failed, posting text-only:", err.response?.data || err.message);
//     }
//   }

//   const body = { text: content || "" };
//   if (mediaIds.length) body.media = { media_ids: mediaIds };

//   const res = await axios.post("https://api.twitter.com/2/tweets", body, {
//     headers: {
//       Authorization: `Bearer ${accessToken}`,
//       "Content-Type": "application/json"
//     }
//   });

//   const tweetId = res.data?.data?.id;
//   return {
//     status: "success",
//     postId: tweetId,
//     url: tweetId ? `https://twitter.com/i/web/status/${tweetId}` : null
//   };
// }


// // ─────────────────────────────────────────────────────────
// // LINKEDIN
// // Text + optional single image (registerUpload -> upload -> ugcPost).
// // accountId = LinkedIn member "sub" (from /v2/userinfo at connect time)
// // ─────────────────────────────────────────────────────────
// async function publishToLinkedIn(accessToken, accountId, content, mediaUrls = []) {
//   const author = `urn:li:person:${accountId}`;
//   let mediaAsset = null;

//   const firstImage = mediaUrls.find(m => m.type === "image");
//   if (firstImage) {
//     try {
//       const registerRes = await axios.post(
//         "https://api.linkedin.com/v2/assets?action=registerUpload",
//         {
//           registerUploadRequest: {
//             recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
//             owner: author,
//             serviceRelationships: [
//               { relationshipType: "OWNER", identifier: "urn:li:userGeneratedContent" }
//             ]
//           }
//         },
//         { headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" } }
//       );

//       const uploadUrl = registerRes.data.value.uploadMechanism[
//         "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
//       ].uploadUrl;
//       mediaAsset = registerRes.data.value.asset;

//       const imgRes = await axios.get(firstImage.url, { responseType: "arraybuffer" });
//       await axios.put(uploadUrl, imgRes.data, {
//         headers: { Authorization: `Bearer ${accessToken}` }
//       });
//     } catch (err) {
//       console.error("LinkedIn media upload failed, posting text-only:", err.response?.data || err.message);
//       mediaAsset = null;
//     }
//   }

//   const shareContent = {
//     shareCommentary: { text: content || "" },
//     shareMediaCategory: mediaAsset ? "IMAGE" : "NONE"
//   };

//   if (mediaAsset) {
//     shareContent.media = [{ status: "READY", media: mediaAsset }];
//   }

//   const res = await axios.post(
//     "https://api.linkedin.com/v2/ugcPosts",
//     {
//       author,
//       lifecycleState: "PUBLISHED",
//       specificContent: { "com.linkedin.ugc.ShareContent": shareContent },
//       visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" }
//     },
//     {
//       headers: {
//         Authorization: `Bearer ${accessToken}`,
//         "Content-Type": "application/json",
//         "X-Restli-Protocol-Version": "2.0.0"
//       }
//     }
//   );

//   const postUrn = res.data?.id || res.headers?.["x-restli-id"];
//   return { status: "success", postId: postUrn, url: null };
// }


// // ─────────────────────────────────────────────────────────
// // FACEBOOK
// // accountId = Page ID, accessToken = Page access token
// // Single image -> /photos, no media -> /feed
// // ─────────────────────────────────────────────────────────
// async function publishToFacebook(accessToken, pageId, content, mediaUrls = []) {
//   const firstImage = mediaUrls.find(m => m.type === "image");

//   let res;
//   if (firstImage) {
//     res = await axios.post(`https://graph.facebook.com/v18.0/${pageId}/photos`, {
//       url: firstImage.url,
//       caption: content || "",
//       access_token: accessToken
//     });
//   } else {
//     res = await axios.post(`https://graph.facebook.com/v18.0/${pageId}/feed`, {
//       message: content || "",
//       access_token: accessToken
//     });
//   }

//   const postId = res.data?.post_id || res.data?.id;
//   return {
//     status: "success",
//     postId,
//     url: postId ? `https://www.facebook.com/${postId}` : null
//   };
// }


// // ─────────────────────────────────────────────────────────
// // INSTAGRAM
// // accountId = Instagram Business Account ID, accessToken = Page access token
// // Container create -> publish. IG requires at least one image/video.
// // ─────────────────────────────────────────────────────────
// async function publishToInstagram(accessToken, igUserId, content, mediaUrls = []) {
//   const media = mediaUrls.find(m => m.type === "image" || m.type === "video");

//   if (!media) {
//     throw new Error("Instagram requires at least one image or video — text-only posts are not supported by Instagram's API");
//   }

//   const containerParams = {
//     caption: content || "",
//     access_token: accessToken
//   };

//   if (media.type === "video") {
//     containerParams.media_type = "REELS";
//     containerParams.video_url  = media.url;
//   } else {
//     containerParams.image_url = media.url;
//   }

//   const containerRes = await axios.post(
//     `https://graph.facebook.com/v18.0/${igUserId}/media`,
//     containerParams
//   );

//   const creationId = containerRes.data?.id;
//   if (!creationId) throw new Error("Instagram media container creation failed");

//   // Video processing thoda time leta hai — chhota wait dete hain
//   if (media.type === "video") {
//     await new Promise(r => setTimeout(r, 5000));
//   }

//   const publishRes = await axios.post(
//     `https://graph.facebook.com/v18.0/${igUserId}/media_publish`,
//     { creation_id: creationId, access_token: accessToken }
//   );

//   const postId = publishRes.data?.id;
//   return { status: "success", postId, url: null };
// }


// // ─────────────────────────────────────────────────────────
// // PINTEREST
// // boardId zaroori hai — agar Post me nahi diya, caller (worker)
// // pehle se user ka pehla board fetch karke pass karega.
// // ─────────────────────────────────────────────────────────
// async function publishToPinterest(accessToken, content, mediaUrls = [], boardId) {
//   const image = mediaUrls.find(m => m.type === "image");

//   if (!image) {
//     throw new Error("Pinterest requires at least one image");
//   }

//   if (!boardId) {
//     throw new Error("Pinterest requires a board — no board found/selected for this account");
//   }

//   const res = await axios.post(
//     "https://api.pinterest.com/v5/pins",
//     {
//       board_id: boardId,
//       title: (content || "").slice(0, 100),
//       description: content || "",
//       media_source: { source_type: "image_url", url: image.url }
//     },
//     { headers: { Authorization: `Bearer ${accessToken}` } }
//   );

//   const postId = res.data?.id;
//   return {
//     status: "success",
//     postId,
//     url: postId ? `https://www.pinterest.com/pin/${postId}` : null
//   };
// }


// // ─────────────────────────────────────────────────────────
// // Pinterest ke liye board fallback fetch karna
// // ─────────────────────────────────────────────────────────
// async function fetchFirstPinterestBoard(accessToken) {
//   const res = await axios.get("https://api.pinterest.com/v5/boards", {
//     headers: { Authorization: `Bearer ${accessToken}` }
//   });
//   return res.data?.items?.[0]?.id || null;
// }


// module.exports = {
//   publishToTwitter,
//   publishToLinkedIn,
//   publishToFacebook,
//   publishToInstagram,
//   publishToPinterest,
//   fetchFirstPinterestBoard
// };


// ==========================================
// FILE: src/service/socialPublish.service.js
// NEW v18: Real publish functions for Twitter, LinkedIn, Facebook,
//   Instagram, Pinterest. Pehle worker me sirf YouTube real tha,
//   baaki sab "mock success" daal deta tha (kuch bhi actually
//   platform par publish nahi hota tha).
//
// IMPORTANT — production me ye cheezein chahiye:
//   - Facebook/Instagram: Meta App Review approval (pages_manage_posts,
//     instagram_content_publish) + ek connected Facebook Page
//   - LinkedIn: w_member_social scope approved on your LinkedIn app
//   - Twitter: API v2 app with elevated/paid access for posting
//   - Pinterest: approved Pinterest app + at least one board
//
// Har function ek consistent shape return karta hai:
//   { status: "success", postId, url } ya throws Error(message)
// ==========================================

const axios = require("axios");

// ─────────────────────────────────────────────────────────
// TWITTER / X
// Text + (optional) single image. Video upload TWITTER par
// chunked upload chahiye — abhi tak support nahi kiya gaya,
// agar sirf video diya gaya hai to text-only tweet chala denge.
// ─────────────────────────────────────────────────────────
async function publishToTwitter(accessToken, content, mediaUrls = []) {
  let mediaIds = [];

  const firstImage = mediaUrls.find(m => m.type === "image");
  if (firstImage) {
    try {
      const imgRes = await axios.get(firstImage.url, { responseType: "arraybuffer" });
      const base64 = Buffer.from(imgRes.data).toString("base64");

      const uploadRes = await axios.post(
        "https://upload.twitter.com/1.1/media/upload.json",
        new URLSearchParams({ media_data: base64 }),
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (uploadRes.data?.media_id_string) {
        mediaIds.push(uploadRes.data.media_id_string);
      }
    } catch (err) {
      console.error("Twitter media upload failed, posting text-only:", err.response?.data || err.message);
    }
  }

  const body = { text: content || "" };
  if (mediaIds.length) body.media = { media_ids: mediaIds };

  const res = await axios.post("https://api.twitter.com/2/tweets", body, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    }
  });

  const tweetId = res.data?.data?.id;
  return {
    status: "success",
    postId: tweetId,
    url: tweetId ? `https://twitter.com/i/web/status/${tweetId}` : null
  };
}


// ─────────────────────────────────────────────────────────
// LINKEDIN
// Text + optional single image (registerUpload -> upload -> ugcPost).
// accountId = LinkedIn member "sub" (from /v2/userinfo at connect time)
// ─────────────────────────────────────────────────────────
async function publishToLinkedIn(accessToken, accountId, content, mediaUrls = []) {
  const author = `urn:li:person:${accountId}`;
  let mediaAsset = null;

  const firstImage = mediaUrls.find(m => m.type === "image");
  if (firstImage) {
    try {
      const registerRes = await axios.post(
        "https://api.linkedin.com/v2/assets?action=registerUpload",
        {
          registerUploadRequest: {
            recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
            owner: author,
            serviceRelationships: [
              { relationshipType: "OWNER", identifier: "urn:li:userGeneratedContent" }
            ]
          }
        },
        { headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" } }
      );

      const uploadUrl = registerRes.data.value.uploadMechanism[
        "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
      ].uploadUrl;
      mediaAsset = registerRes.data.value.asset;

      const imgRes = await axios.get(firstImage.url, { responseType: "arraybuffer" });
      await axios.put(uploadUrl, imgRes.data, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
    } catch (err) {
      console.error("LinkedIn media upload failed, posting text-only:", err.response?.data || err.message);
      mediaAsset = null;
    }
  }

  const shareContent = {
    shareCommentary: { text: content || "" },
    shareMediaCategory: mediaAsset ? "IMAGE" : "NONE"
  };

  if (mediaAsset) {
    shareContent.media = [{ status: "READY", media: mediaAsset }];
  }

  const res = await axios.post(
    "https://api.linkedin.com/v2/ugcPosts",
    {
      author,
      lifecycleState: "PUBLISHED",
      specificContent: { "com.linkedin.ugc.ShareContent": shareContent },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" }
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0"
      }
    }
  );

  const postUrn = res.data?.id || res.headers?.["x-restli-id"];
  return { status: "success", postId: postUrn, url: null };
}


// ─────────────────────────────────────────────────────────
// FACEBOOK
// accountId = Page ID, accessToken = Page access token
// Video -> /videos, Single image -> /photos, no media -> /feed
// FIXED: pehle video ke liye koi handling nahi thi — video attach karne
// par bhi ye chup-chap sirf text (/feed) post kar deta tha, video ignore
// ho jaata tha bina kisi error ke. Ab video ko explicitly /videos
// endpoint se publish karte hain.
// ─────────────────────────────────────────────────────────
async function publishToFacebook(accessToken, pageId, content, mediaUrls = []) {
  const firstVideo = mediaUrls.find(m => m.type === "video");
  const firstImage = mediaUrls.find(m => m.type === "image");

  let res;
  if (firstVideo) {
    res = await axios.post(`https://graph-video.facebook.com/v18.0/${pageId}/videos`, {
      file_url: firstVideo.url,
      description: content || "",
      access_token: accessToken
    });
  } else if (firstImage) {
    res = await axios.post(`https://graph.facebook.com/v18.0/${pageId}/photos`, {
      url: firstImage.url,
      caption: content || "",
      access_token: accessToken
    });
  } else {
    res = await axios.post(`https://graph.facebook.com/v18.0/${pageId}/feed`, {
      message: content || "",
      access_token: accessToken
    });
  }

  // Video upload response me "id" video id hoti hai (post_id nahi aata),
  // isliye video ke liye alag URL pattern use karna padta hai.
  const postId = res.data?.post_id || res.data?.id;
  const url = firstVideo
    ? (postId ? `https://www.facebook.com/watch/?v=${postId}` : null)
    : (postId ? `https://www.facebook.com/${postId}` : null);

  return { status: "success", postId, url };
}


// ─────────────────────────────────────────────────────────
// INSTAGRAM
// accountId = Instagram Business Account ID, accessToken = Page access token
// Container create -> publish. IG requires at least one image/video.
// ─────────────────────────────────────────────────────────
async function publishToInstagram(accessToken, igUserId, content, mediaUrls = []) {
  const media = mediaUrls.find(m => m.type === "image" || m.type === "video");

  if (!media) {
    throw new Error("Instagram requires at least one image or video — text-only posts are not supported by Instagram's API");
  }

  const containerParams = {
    caption: content || "",
    access_token: accessToken
  };

  if (media.type === "video") {
    containerParams.media_type = "REELS";
    containerParams.video_url  = media.url;
  } else {
    containerParams.image_url = media.url;
  }

  const containerRes = await axios.post(
    `https://graph.facebook.com/v18.0/${igUserId}/media`,
    containerParams
  );

  const creationId = containerRes.data?.id;
  if (!creationId) throw new Error("Instagram media container creation failed");

  // Video processing thoda time leta hai — chhota wait dete hain
  if (media.type === "video") {
    await new Promise(r => setTimeout(r, 5000));
  }

  const publishRes = await axios.post(
    `https://graph.facebook.com/v18.0/${igUserId}/media_publish`,
    { creation_id: creationId, access_token: accessToken }
  );

  const postId = publishRes.data?.id;
  return { status: "success", postId, url: null };
}


// ─────────────────────────────────────────────────────────
// PINTEREST
// boardId zaroori hai — agar Post me nahi diya, caller (worker)
// pehle se user ka pehla board fetch karke pass karega.
// ─────────────────────────────────────────────────────────
async function publishToPinterest(accessToken, content, mediaUrls = [], boardId) {
  const image = mediaUrls.find(m => m.type === "image");

  if (!image) {
    throw new Error("Pinterest requires at least one image");
  }

  if (!boardId) {
    throw new Error("Pinterest requires a board — no board found/selected for this account");
  }

  const res = await axios.post(
    "https://api.pinterest.com/v5/pins",
    {
      board_id: boardId,
      title: (content || "").slice(0, 100),
      description: content || "",
      media_source: { source_type: "image_url", url: image.url }
    },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  const postId = res.data?.id;
  return {
    status: "success",
    postId,
    url: postId ? `https://www.pinterest.com/pin/${postId}` : null
  };
}


// ─────────────────────────────────────────────────────────
// Pinterest ke liye board fallback fetch karna
// ─────────────────────────────────────────────────────────
async function fetchFirstPinterestBoard(accessToken) {
  const res = await axios.get("https://api.pinterest.com/v5/boards", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  return res.data?.items?.[0]?.id || null;
}


module.exports = {
  publishToTwitter,
  publishToLinkedIn,
  publishToFacebook,
  publishToInstagram,
  publishToPinterest,
  fetchFirstPinterestBoard
};