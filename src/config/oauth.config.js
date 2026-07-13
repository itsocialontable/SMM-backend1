// // ==========================================
// // FILE: src/config/oauth.config.js
// // UPDATED v18:
// //   - facebook scope me pages_show_list + pages_manage_posts +
// //     pages_read_engagement add kiya — pehle sirf public_profile,email
// //     tha jisse Page par post karna possible hi nahi tha (sirf login
// //     ho sakta tha, publish kabhi nahi)
// //   - linkedin scope me w_member_social add kiya — pehle sirf
// //     openid/profile/email tha jisse sirf login hota tha, post karna
// //     possible nahi tha
// // NOTE: Facebook/Instagram Page-level permissions production me
// //   Meta App Review se approve karwani padti hain. Development/test
// //   mode me sirf app-admin/tester accounts ke saath kaam karega.
// // ==========================================

// const OAUTH_CONFIG = {

// facebook: {
//   clientId: process.env.FB_CLIENT_ID,
//   clientSecret: process.env.FB_CLIENT_SECRET,
//   redirectUri: process.env.FB_REDIRECT_URI,
//   authUrl: "https://www.facebook.com/v18.0/dialog/oauth",
//   tokenUrl: "https://graph.facebook.com/v18.0/oauth/access_token",
//   // pages_show_list + pages_manage_posts + pages_read_engagement —
//   // Page list fetch karne aur usme actually post karne ke liye zaroori
//   scope: "public_profile,email,pages_show_list,pages_manage_posts,pages_read_engagement",
//   version: "v18.0"
// },

// instagram: {
//   clientId: process.env.FB_CLIENT_ID,
//   clientSecret: process.env.FB_CLIENT_SECRET,
//   redirectUri: process.env.FB_REDIRECT_URI,
//   authUrl: "https://www.facebook.com/v18.0/dialog/oauth",
//   tokenUrl: "https://graph.facebook.com/v18.0/oauth/access_token",
//   scope: "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement",
//   version: "v18.0"
// },

// twitter: {
//   clientId: process.env.TWITTER_CLIENT_ID,
//   clientSecret: process.env.TWITTER_CLIENT_SECRET,
//   redirectUri: process.env.TWITTER_REDIRECT_URI,
//   authUrl: "https://twitter.com/i/oauth2/authorize",
//   tokenUrl: "https://api.twitter.com/2/oauth2/token",
//   scope: "tweet.read tweet.write users.read offline.access",
//   codeChallengeMethod: "S256"
// },

// linkedin: {
//   clientId: process.env.LINKEDIN_CLIENT_ID,
//   clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
//   redirectUri: process.env.LINKEDIN_REDIRECT_URI,
//   authUrl: "https://www.linkedin.com/oauth/v2/authorization",
//   tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
//   // w_member_social add kiya — bina iske UGC post (publish) API kaam nahi karta
//   scope: "openid profile email w_member_social"
// },

// youtube: {
//   clientId:     process.env.GOOGLE_CLIENT_ID,
//   clientSecret: process.env.GOOGLE_CLIENT_SECRET,
//   redirectUri:  process.env.GOOGLE_REDIRECT_URI,
//   authUrl:      "https://accounts.google.com/o/oauth2/v2/auth",
//   tokenUrl:     "https://oauth2.googleapis.com/token",
//   scope: "https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email"
// },

// pinterest: {
//   clientId: process.env.PINTEREST_CLIENT_ID,
//   clientSecret: process.env.PINTEREST_CLIENT_SECRET,
//   redirectUri: process.env.PINTEREST_REDIRECT_URI,
//   authUrl: "https://www.pinterest.com/oauth/",
//   tokenUrl: "https://api.pinterest.com/v5/oauth/token",
//   scope: "boards:read,pins:read,pins:write,user_accounts:read"
// }

// };

// module.exports = OAUTH_CONFIG;


// ==========================================
// FILE: src/config/oauth.config.js
// UPDATED v18:
//   - facebook scope me pages_show_list + pages_manage_posts +
//     pages_read_engagement add kiya — pehle sirf public_profile,email
//     tha jisse Page par post karna possible hi nahi tha (sirf login
//     ho sakta tha, publish kabhi nahi)
//   - linkedin scope me w_member_social add kiya — pehle sirf
//     openid/profile/email tha jisse sirf login hota tha, post karna
//     possible nahi tha
// NOTE: Facebook/Instagram Page-level permissions production me
//   Meta App Review se approve karwani padti hain. Development/test
//   mode me sirf app-admin/tester accounts ke saath kaam karega.
// ==========================================

const OAUTH_CONFIG = {

facebook: {
  clientId: process.env.FB_CLIENT_ID,
  clientSecret: process.env.FB_CLIENT_SECRET,
  redirectUri: process.env.FB_REDIRECT_URI,
  authUrl: "https://www.facebook.com/v18.0/dialog/oauth",
  tokenUrl: "https://graph.facebook.com/v18.0/oauth/access_token",
  // FIXED: "email" scope hataya — ye "Facebook Login for Business" type
  // app me invalid scope maana jaata hai ("Invalid Scopes: email" error
  // deta hai), aur Page/Instagram publish karne ke liye email ki zarurat
  // bhi nahi hai. pages_show_list + pages_manage_posts +
  // pages_read_engagement hi kaafi hain.
  // FIXED (2): "business_management" add kiya — jab Page ek Business
  // Portfolio/Business Manager ke through owned hoti hai (jaisa
  // Growthcraft360), Graph API ka /me/accounts is permission ke bina
  // us Page ko khaali list dikhata hai, chahe user ko Page pe "Full
  // access" hi kyun na diya ho. Isi wajah se "No Facebook Page found"
  // aata tha.
  scope: "public_profile,pages_show_list,pages_manage_posts,pages_read_engagement,business_management",
  version: "v18.0"
},

instagram: {
  clientId: process.env.FB_CLIENT_ID,
  clientSecret: process.env.FB_CLIENT_SECRET,
  redirectUri: process.env.FB_REDIRECT_URI,
  authUrl: "https://www.facebook.com/v18.0/dialog/oauth",
  tokenUrl: "https://graph.facebook.com/v18.0/oauth/access_token",
  // FIXED: business_management add kiya (same wajah jaisi Facebook me) —
  // Business Portfolio-owned Page ke through hi Instagram Business
  // account milta hai, isliye ye permission bhi zaroori hai.
  scope: "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement,business_management",
  version: "v18.0"
},

twitter: {
  clientId: process.env.TWITTER_CLIENT_ID,
  clientSecret: process.env.TWITTER_CLIENT_SECRET,
  redirectUri: process.env.TWITTER_REDIRECT_URI,
  authUrl: "https://twitter.com/i/oauth2/authorize",
  tokenUrl: "https://api.twitter.com/2/oauth2/token",
  scope: "tweet.read tweet.write users.read offline.access",
  codeChallengeMethod: "S256"
},

linkedin: {
  clientId: process.env.LINKEDIN_CLIENT_ID,
  clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
  redirectUri: process.env.LINKEDIN_REDIRECT_URI,
  authUrl: "https://www.linkedin.com/oauth/v2/authorization",
  tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
  // w_member_social add kiya — bina iske UGC post (publish) API kaam nahi karta
  scope: "openid profile email w_member_social"
},

youtube: {
  clientId:     process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri:  process.env.GOOGLE_REDIRECT_URI,
  authUrl:      "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl:     "https://oauth2.googleapis.com/token",
  scope: "https://www.googleapis.com/auth/youtube https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email"
},

pinterest: {
  clientId: process.env.PINTEREST_CLIENT_ID,
  clientSecret: process.env.PINTEREST_CLIENT_SECRET,
  redirectUri: process.env.PINTEREST_REDIRECT_URI,
  authUrl: "https://www.pinterest.com/oauth/",
  tokenUrl: "https://api.pinterest.com/v5/oauth/token",
  scope: "boards:read,pins:read,pins:write,user_accounts:read"
}

};

module.exports = OAUTH_CONFIG;