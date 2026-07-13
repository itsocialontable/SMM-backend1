# SMM Backend v16 — API Documentation

**Base URL:** `https://your-domain.com/api`

---

## Authentication

All protected routes require:
```
Authorization: Bearer <JWT_TOKEN>
```

---

## Super Admin

### POST /superadmin/register
Register SuperAdmin (one-time only).
```json
Body: { "email": "admin@example.com", "password": "secret123", "name": "Super Admin" }
```

### POST /superadmin/login
```json
Body: { "email": "", "password": "" }
Response: { "success": true, "token": "..." }
```

### POST /superadmin/agencies/create *(auth: superadmin)*
Create a new agency (auto-starts 3-day trial).
```json
Body: {
  "name": "Agency Name",
  "owner": "Owner Name",
  "email": "agency@example.com",
  "password": "pass1234",
  "confirmPassword": "pass1234",
  "phoneNumber": "...",
  "state": "...", "city": "...", "country": "..."
}
Response: { "success": true, "agency": { "subscriptionStatus": "trial", "trialEndDate": "..." } }
```

### PATCH /superadmin/agencies/:id/activate-subscription *(auth: superadmin)*
Activate paid subscription for an agency.
```json
Body: { "planType": "pro", "durationDays": 30 }
```

### GET /superadmin/agencies *(auth: superadmin)*
Query: `?page=1&limit=10&search=name&subscriptionStatus=trial`

---

## Agency Auth

### POST /agency/login
```json
Body: { "email": "", "password": "" }
```

### POST /agency/forgot-password *(v18 — naya)*
```json
Body: { "email": "agency@example.com" }
Response: { "success": true, "msg": "Reset OTP sent to your email" }
```

### POST /agency/verify-reset-otp *(v18 — naya)*
```json
Body: { "email": "", "otp": "123456" }
```

### POST /agency/resend-reset-otp *(v18 — naya)*
```json
Body: { "email": "" }
```

### POST /agency/reset-password *(v18 — naya)*
```json
Body: { "email": "", "newPassword": "", "confirmPassword": "" }
```

### POST /agency/change-password *(auth: admin, v18 — naya)*
```json
Body: { "oldPassword": "", "newPassword": "", "confirmPassword": "" }
```

### GET /agency/me *(auth: admin)*
Get own agency profile.

### GET /agency/subscription-status *(auth: admin)*
```json
Response: {
  "subscriptionStatus": "trial",
  "planType": "trial",
  "trialEndDate": "2024-...",
  "daysRemaining": 2
}
```

---

## Agency Dashboard / Profile / Workspace *(auth: admin)*

**NOTE (v18):** "Admin" model pura hata diya gaya hai — Agency hi
"admin" hai, isi ke login token (`/agency/login`) se ye sab routes
access hote hain.

### GET /admin/dashboard
Agency-scoped stats — clients, team members, projects.

### GET /admin/profile · PUT /admin/profile
Agency's own profile (name, owner, email, phoneNumber).

### POST /admin/profile/image · DELETE /admin/profile/image
Profile photo upload/remove. multipart field: `profileImage`.

### PUT /admin/change-password
Change password while logged in.

### GET /admin/workspace · PUT /admin/workspace
Workspace settings — timezone, default platforms, business hours,
notification preferences, theme colors.

### POST /admin/workspace/logo · DELETE /admin/workspace/logo
Agency logo upload/remove. multipart field: `agencyLogo`.

---

## Agency Branding *(auth: admin)*

### GET /agency/branding
Get current branding settings.

### PUT /agency/branding
Update text branding fields.
```json
Body: {
  "companyDescription": "We help brands grow...",
  "websiteUrl": "https://example.com",
  "socialLinks": {
    "facebook": "https://facebook.com/...",
    "instagram": "https://instagram.com/...",
    "twitter": "https://twitter.com/...",
    "linkedin": "https://linkedin.com/...",
    "youtube": "https://youtube.com/..."
  }
}
```

### POST /agency/branding/logo
Upload company logo. `multipart/form-data`, field: `logo`.

### DELETE /agency/branding/logo
Delete company logo (removes from Cloudinary too).

---

## Users (Admin creates team)

### POST /user/create *(auth: admin)*
```json
Body: {
  "name": "John",
  "email": "john@example.com",
  "password": "pass1234",
  "role": "Client" | "SMM" | "Graphic Designer",
  // Client fields:
  "companyName": "...", "industry": "...", "budget": 5000,
  // SMM/GD fields:
  "experience": "2 years", "skills": ["copywriting"],
  "platforms": ["instagram", "facebook"],
  // GD fields:
  "specialization": ["logo design"]
}
```
**Trial Limits:** Max 2 Clients, Max 2 Team Members (SMM + GD combined).

### POST /user/login
```json
Body: { "email": "", "password": "", "role": "Client" | "SMM" | "Graphic Designer" }
```

---

## Social Accounts *(auth: SMM or admin)*

**v18 — clientId is MANDATORY for SMM.** SMM never connects an account for themself — only on behalf of one of their own agency's clients.

### GET /social/auth/:platform?clientId=<id>
Get OAuth URL to start connecting a client's account. `clientId` required for SMM role.

### POST /social/connect
```json
Body: { "platform": "instagram", "code": "...", "state": "...", "clientId": "..." }
```
`clientId` is re-validated server-side (ownership + same agency) even though it travels inside the OAuth `state`.

### GET /social/accounts?clientId=<id>
List connected accounts. `clientId` optional — omit to see all of your clients' connected accounts.

### DELETE /social/disconnect/:id
Disconnect (soft-deactivate) a connected account.

---

## Posts *(auth: SMM role + active subscription)*

### POST /posts/create
Create and schedule a post. `multipart/form-data`

| Field | Type | Description |
|---|---|---|
| **clientId** | String (**required**, v18) | Kis client ki taraf se post publish ho raha hai — SMM ki apni agency ka client hona zaroori hai |
| content | String (required) | Post text content |
| platforms | String/Array | "instagram,facebook" or array |
| tags | String/Array | Optional tags |
| media | File[] | Up to 10 files |
| **scheduleDate** | String | **NEW** "YYYY-MM-DD" |
| **scheduleTime** | String | **NEW** "HH:mm" (e.g. "14:30") |
| scheduleAt | String | ISO string (backward compat) |
| pinterestBoardId | String | *(v18, optional)* — Pinterest pin kis board me jaaye; na diya to user ka pehla board auto-use ho jaata hai |

**Note:** `scheduleDate` + `scheduleTime` are the preferred way to schedule.  
`scheduleAt` (ISO) still works for backward compatibility.  
Both `scheduleDate` and `scheduleTime` are now stored in DB and returned in responses.

**v18 — Real publishing requirements per platform:**
- YouTube: video file in `media`, real publish.
- Twitter/X: text + optional single image, real publish.
- LinkedIn: text + optional single image, real publish (needs `w_member_social` scope approved on your LinkedIn app).
- Facebook: needs a connected Facebook **Page** (personal profiles can't be posted to via API) + `pages_manage_posts` permission approved by Meta App Review.
- Instagram: needs Instagram **Business/Creator** account linked to a Facebook Page + at least one image/video (Instagram doesn't support text-only posts) + `instagram_content_publish` permission approved by Meta App Review.
- Pinterest: needs at least one image + a board (`pinterestBoardId` or auto-fallback to first board).

**Trial Limit:** Max 20 posts total.

```json
Response: {
  "success": true,
  "msg": "Post scheduled successfully",
  "data": {
    "_id": "...",
    "status": "scheduled",
    "scheduleAt": "2024-12-25T14:30:00.000Z",
    "scheduleDate": "2024-12-25",   // ✅ NOW RETURNED
    "scheduleTime": "14:30"          // ✅ NOW RETURNED
  }
}
```

### GET /posts/queued
Get queued + scheduled posts.

### GET /posts/published
Get published posts.

### POST /posts/draft
Save a draft (same fields as create, no schedule).

### GET /posts/drafts
Get all drafts.

### PUT /posts/draft/:id
Update a draft.

### DELETE /posts/draft/:id
Delete a draft.

### PUT /posts/publish/:id
Manually publish a queued/scheduled post.

### GET /posts/overview
Get analytics overview.

### GET /posts/search-tags?q=keyword
Search tags.

---

## Subscription Error Responses

When subscription is expired or trial ended:
```json
HTTP 402
{
  "success": false,
  "code": "TRIAL_EXPIRED" | "SUBSCRIPTION_EXPIRED",
  "msg": "Your 3-day trial has expired...",
  "data": { "trialEndDate": "...", "subscriptionStatus": "expired" }
}
```

When trial limits are hit:
```json
HTTP 403
{
  "success": false,
  "code": "TRIAL_LIMIT_REACHED",
  "msg": "Trial plan allows maximum 2 clients...",
  "data": { "limit": 2, "current": 2 }
}
```
