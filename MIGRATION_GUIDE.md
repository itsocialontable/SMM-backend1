# SMM Backend v18 — Migration Notes (read this first)

## ⚠️ BREAKING CHANGES in v18

1. **Admin model removed.** `src/models/admin.model.js` aur uska login (`/api/admin/login`, register) pura hata diya gaya. Agency hi ab "admin" hai. Agar production DB me purane `admins` collection ke records hain, wo ab kisi bhi route se use nahi honge (dead data — chahen to manually drop kar sakte ho: `db.admins.drop()`).
2. **`Workspace.admin` → `Workspace.agency`.** Agar production me already Workspace documents hain (Admin se linked), unhe manually migrate karna hoga:
   ```js
   // Agar koi purana Workspace.admin tha jo ek Agency ki id se match karta tha:
   db.workspaces.find({ admin: { $exists: true } }).forEach(ws => {
     db.workspaces.updateOne({ _id: ws._id }, { $rename: { admin: "agency" } });
   });
   ```
   Naye setups ke liye (jahan koi purana Workspace data nahi hai) kuch karne ki zaroorat nahi — naya workspace agency ke pehle access pe auto-create ho jaata hai.
3. **`clientId` ab MANDATORY hai** — `POST /api/posts/create`, `POST /api/posts/draft`, social account connect (`GET /api/social/auth/:platform`, `POST /api/social/connect`). SMM ab apne liye kuch nahi karta, hamesha kisi client ki taraf se. Agar koi existing frontend bina `clientId` ke call kar rahi thi, usse update karna hoga (client dropdown ke liye `GET /api/admin/users/clients` use karo, jo ab SMM ke liye sahi se kaam karta hai).
4. Agar production DB me purane Posts/SocialAccounts hain jisme `client: null` hai (SMM ka "apna" account/post), wo ab purane data ke roop me reh jaayenge (read/list me dikhenge, koi issue nahi), lekin naye posts/connections ke liye `client` field hamesha zaroori hai.

## New env vars
Koi naya environment variable nahi chahiye — sab existing `.env` variables wahi rahenge.

## Recommended one-time action
Production deploy karne ke baad turant ek SuperAdmin register kar lo (`POST /api/superadmin/register`) — ye route public hai jab tak koi SuperAdmin exist nahi karta.

---



## Files Modified

| File | Change |
|------|--------|
| `src/models/agency.model.js` | Added: `trialStartDate`, `trialEndDate`, `subscriptionStatus`, `planType`, `subscriptionExpiry`, `branding` |
| `src/models/user2.model.js` | Added: `agencyId` (ObjectId ref to Agency) |
| `src/models/post.model.js` | Added: `scheduleDate` (String), `scheduleTime` (String) |
| `src/controllers/posts/post.controller.js` | **FIXED**: Schedule null bug — now handles `scheduleDate`+`scheduleTime` |
| `src/controllers/superAdmin/superAdminAgency.controller.js` | Auto 3-day trial on agency creation; `activateSubscription` added |
| `src/controllers/users/user2.controller.js` | Assigns `agencyId` from admin creator |
| `src/routes/superAdmin.routes.js` | Added: `PATCH /agencies/:id/activate-subscription` |
| `src/routes/agencyAuth.routes.js` | Added: `GET /me`, `GET /subscription-status` |
| `src/routes/post.routes.js` | Added: `checkSubscription`, `checkTrialPostLimit` middleware |
| `src/routes/user2.routes.js` | Added: `checkSubscription`, `checkTrialClientLimit`, `checkTrialTeamMemberLimit` |
| `src/app.js` | Added: `/api/agency/branding` route |

## Files Added (New)

| File | Description |
|------|-------------|
| `src/middleware/subscription.middleware.js` | Subscription + trial enforcement |
| `src/controllers/agencyBranding/agencyBranding.controller.js` | Agency branding CRUD |
| `src/routes/agencyBranding.routes.js` | Branding routes |
| `FLOW_DOCUMENTATION.md` | Full flow documentation |
| `API_DOCUMENTATION.md` | API reference |
| `MIGRATION_GUIDE.md` | This file |

---

## Database Migration Steps

### Step 1: Existing Agencies — Set Trial Dates

Run this in MongoDB shell or a migration script for any agencies that existed before v16:

```js
// Set all existing agencies without trialStartDate to use their createdAt as trial start
db.agencies.find({ trialStartDate: { $exists: false } }).forEach(agency => {
  const trialStart = agency.createdAt || new Date();
  const trialEnd   = new Date(trialStart.getTime() + 3 * 24 * 60 * 60 * 1000);
  db.agencies.updateOne(
    { _id: agency._id },
    {
      $set: {
        trialStartDate:     trialStart,
        trialEndDate:       trialEnd,
        subscriptionStatus: "trial",
        planType:           "trial",
        subscriptionExpiry: null,
        branding: {
          companyLogo:        "",
          companyLogoPublicId:"",
          companyDescription: "",
          websiteUrl:         "",
          socialLinks: { facebook: "", instagram: "", twitter: "", linkedin: "", youtube: "" }
        }
      }
    }
  );
});
```

### Step 2: Existing Users — Optionally Backfill agencyId

If you need to link existing users to their agencies (by createdByAdmin), you may do so manually. The field is nullable so existing functionality is not broken.

### Step 3: Existing Posts — scheduleDate/scheduleTime

Existing posts will have `null` for `scheduleDate` and `scheduleTime` — this is fine.  
New posts will have both fields populated correctly from now on.

---

## Backward Compatibility Notes

- All existing APIs work exactly as before.
- `scheduleAt` ISO string still works for post scheduling.
- Agencies without `subscriptionStatus` will naturally be in "trial" once migration runs.
- `agencyId` on User2 is nullable — no existing user records break.
- `branding` on Agency is a subdocument with all defaults — no existing records break.

---

## Environment Variables (No Changes)

No new environment variables required. All existing `.env` variables still apply.

---

## Subscription Activation (SuperAdmin)

To manually activate a paid plan for an agency:

```bash
PATCH /api/superadmin/agencies/:agencyId/activate-subscription
Authorization: Bearer <superadmin-token>
Body: { "planType": "pro", "durationDays": 30 }
```

This will set `subscriptionStatus: "active"` and `subscriptionExpiry` to 30 days from now.
