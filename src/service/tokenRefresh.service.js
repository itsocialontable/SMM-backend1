// ==========================================
// FILE: src/service/tokenRefresh.service.js
// NEW v18: OAuth access tokens expire ho jaate hain (YouTube ~1hr,
//   Twitter ~2hr, etc). Pehle refreshToken save hota tha lekin kahin
//   use hi nahi hota tha — agar post kal/parso schedule kiya hai,
//   publish time tak token expire ho chuka hota aur publish fail
//   ho jaata. Ye file expiry check karke automatically refresh
//   karti hai aur DB update kar deti hai.
// ==========================================

const axios = require("axios");
const OAUTH_CONFIG = require("../config/oauth.config");
const { encrypt, decrypt } = require("../utils/encrypt.util");

// Token expire hone se kitni der pehle proactively refresh karein
const REFRESH_BUFFER_MS = 2 * 60 * 1000; // 2 minutes

// function isExpiringSoon(tokenExpiresAt) {
//   if (!tokenExpiresAt) return false; // expiry pata nahi to assume valid hai
//   return new Date(tokenExpiresAt).getTime() - Date.now() < REFRESH_BUFFER_MS;
// }

function isExpiringSoon(tokenExpiresAt) {
  if (!tokenExpiresAt) return true; // ✅ unknown expiry = refresh kar do
  return new Date(tokenExpiresAt).getTime() - Date.now() < REFRESH_BUFFER_MS;
}

// ─────────────────────────────────────────────────────────
// Google (YouTube) — standard OAuth2 refresh_token grant
// ─────────────────────────────────────────────────────────
async function refreshGoogle(refreshToken) {
  const config = OAUTH_CONFIG.youtube;
  const res = await axios.post(
    config.tokenUrl,
    new URLSearchParams({
      client_id:     config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type:    "refresh_token"
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );
  return {
    accessToken:  res.data.access_token,
    refreshToken: res.data.refresh_token || refreshToken, // Google kabhi naya refresh_token nahi bhejta
    expiresIn:    res.data.expires_in
  };
}

// ─────────────────────────────────────────────────────────
// Twitter — refresh_token grant (offline.access scope zaroori)
// ─────────────────────────────────────────────────────────
async function refreshTwitter(refreshToken) {
  const config = OAUTH_CONFIG.twitter;
  const res = await axios.post(
    config.tokenUrl,
    new URLSearchParams({
      refresh_token: refreshToken,
      grant_type:    "refresh_token",
      client_id:     config.clientId
    }),
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      auth: { username: config.clientId, password: config.clientSecret }
    }
  );
  return {
    accessToken:  res.data.access_token,
    refreshToken: res.data.refresh_token || refreshToken,
    expiresIn:    res.data.expires_in
  };
}

// ─────────────────────────────────────────────────────────
// LinkedIn — refresh_token grant (LinkedIn partner program approval
// zaroori hai production me iske liye)
// ─────────────────────────────────────────────────────────
async function refreshLinkedIn(refreshToken) {
  const config = OAUTH_CONFIG.linkedin;
  const res = await axios.post(config.tokenUrl, null, {
    params: {
      grant_type:    "refresh_token",
      refresh_token: refreshToken,
      client_id:     config.clientId,
      client_secret: config.clientSecret
    }
  });
  return {
    accessToken:  res.data.access_token,
    refreshToken: res.data.refresh_token || refreshToken,
    expiresIn:    res.data.expires_in
  };
}

// ─────────────────────────────────────────────────────────
// Pinterest — refresh_token grant
// ─────────────────────────────────────────────────────────
async function refreshPinterest(refreshToken) {
  const config = OAUTH_CONFIG.pinterest;
  const res = await axios.post(
    config.tokenUrl,
    new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")
      }
    }
  );
  return {
    accessToken:  res.data.access_token,
    refreshToken: res.data.refresh_token || refreshToken,
    expiresIn:    res.data.expires_in
  };
}

// ─────────────────────────────────────────────────────────
// Facebook/Instagram — true "refresh_token" grant nahi hota.
// Short-lived token ko long-lived (~60 din) token me exchange karte
// hain. Page access tokens (jo hum store karte hain) bhi isi flow se
// derive hote hain agar user token long-lived ho.
// ─────────────────────────────────────────────────────────
async function refreshFacebook(refreshToken) {
  // Yahan "refreshToken" field me hum koi standard refresh token nahi
  // rakhte (FB deta nahi hai), is wajah se ye function generally
  // call hi nahi hoga jab tak kisi custom flow se token na diya jaye.
  const config = OAUTH_CONFIG.facebook;
  const res = await axios.get(config.tokenUrl, {
    params: {
      grant_type:        "fb_exchange_token",
      client_id:         config.clientId,
      client_secret:     config.clientSecret,
      fb_exchange_token: refreshToken
    }
  });
  return {
    accessToken:  res.data.access_token,
    refreshToken: refreshToken,
    expiresIn:    res.data.expires_in || 5184000 // ~60 din default
  };
}

const REFRESHERS = {
  youtube:   refreshGoogle,
  twitter:   refreshTwitter,
  linkedin:  refreshLinkedIn,
  pinterest: refreshPinterest,
  facebook:  refreshFacebook,
  instagram: refreshFacebook
};

// ─────────────────────────────────────────────────────────
// MAIN: account ka token expire ho raha ho to refresh karke
// DB me save kar dega, aur usable (decrypted) accessToken return
// karega. Refresh possible na ho (refreshToken missing/unsupported
// platform) to purana (decrypted) token hi return kar dega — caller
// publish attempt karega aur platform khud bata dega agar expire ho
// chuka hai.
// ─────────────────────────────────────────────────────────
async function getValidAccessToken(account) {
  const currentAccessToken = decrypt(account.accessToken);

  if (!isExpiringSoon(account.tokenExpiresAt)) {
    return currentAccessToken;
  }

  if (!account.refreshToken) {
    console.warn(`⚠️ Token expiring for ${account.platform} (${account._id}) but no refreshToken saved.`);
    return currentAccessToken;
  }

  const refresher = REFRESHERS[account.platform];
  if (!refresher) {
    return currentAccessToken;
  }

  try {
    const decryptedRefreshToken = decrypt(account.refreshToken);
    const result = await refresher(decryptedRefreshToken);

    account.accessToken    = encrypt(result.accessToken);
    account.refreshToken   = encrypt(result.refreshToken);
    account.tokenExpiresAt = result.expiresIn
      ? new Date(Date.now() + result.expiresIn * 1000)
      : null;
    await account.save();

    console.log(`🔄 Token refreshed for ${account.platform} (${account._id})`);
    return result.accessToken;

  } catch (err) {
    console.error(`❌ Token refresh failed for ${account.platform} (${account._id}):`, err.response?.data || err.message);
    // Refresh fail hua to purana token hi try karenge — shayad abhi bhi valid ho
    return currentAccessToken;
  }
}

module.exports = { getValidAccessToken };
