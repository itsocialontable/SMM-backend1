# SMM Backend v18 — Flow Documentation

## ⚠️ CORE PLATFORM RULE (v18)

**SMM apne khud ke liye kabhi social account connect ya post publish nahi karta.**
Har agency ke SMM, us agency ke CLIENTS ki taraf se (client se mile
credentials/permission se) unke social media par post publish karte
hain. Isliye:

- Social account connect karte waqt `clientId` MANDATORY hai.
- Post/Draft banate waqt `clientId` MANDATORY hai.
- `clientId` hamesha validate hota hai — wo client SMM ki **apni agency** ka hi hona chahiye (doosri agency ka client allowed nahi).

```
Flow:  Client apna social account credential/permission SMM ko deta hai
       → SMM us client ki taraf se account connect karta hai (clientId required)
       → SMM us client ke liye post banata hai (clientId required)
       → Post publish hota hai client ke connected account par
```

## 1. Super Admin Flow

```
SuperAdmin registers → POST /api/superadmin/register (one-time)
SuperAdmin logs in   → POST /api/superadmin/login → JWT (role: superadmin)
Create Agency        → POST /api/superadmin/agencies/create
                       - Auto-assigns 3-day trial
                       - Sends welcome email with credentials
Manage Agencies      → GET/PUT/DELETE /api/superadmin/agencies/:id
Toggle Agency        → PATCH /api/superadmin/agencies/:id/toggle-status
Activate Paid Plan   → PATCH /api/superadmin/agencies/:id/activate-subscription
                       Body: { planType: "pro", durationDays: 30 }
```

## 2. Agency (Admin) Flow

```
Agency logs in       → POST /api/agency/login → JWT (role: admin)
Forgot password (v18)→ POST /api/agency/forgot-password { email }
Verify OTP (v18)     → POST /api/agency/verify-reset-otp { email, otp }
Resend OTP (v18)     → POST /api/agency/resend-reset-otp { email }
Reset password (v18) → POST /api/agency/reset-password { email, newPassword, confirmPassword }
Change password (v18)→ POST /api/agency/change-password (logged in)
Check subscription   → GET /api/agency/subscription-status
Get own profile      → GET /api/agency/me
Update branding      → PUT /api/agency/branding
Upload logo          → POST /api/agency/branding/logo (multipart: logo)
Delete logo          → DELETE /api/agency/branding/logo
Dashboard            → GET /api/admin/dashboard
Own profile/photo    → GET/PUT /api/admin/profile , POST/DELETE /api/admin/profile/image
Workspace settings   → GET/PUT /api/admin/workspace , POST/DELETE /api/admin/workspace/logo
Create users         → POST /api/user/create (Client/SMM/GD) — SINGLE source of truth now
Manage users         → GET/PUT/DELETE /api/admin/users/:id

NOTE (v18): "Admin" model pura hata diya gaya hai. Agency hi system me
"admin" hai — agency ka JWT role hamesha "admin" hota hai, aur isi
token se /api/admin/* (dashboard/profile/workspace/users) ke saath
/api/agency/* (login/branding/subscription) dono kaam karte hain.
Pehle ek alag, broken "Admin" model + workspace tha (register route
hi disabled tha, login kaam hi nahi karta tha agency-scoped data ke
saath) — wo confusion khatam kar diya gaya hai.
```

## 3. Client Flow

```
Login               → POST /api/user/login { email, password, role: "Client" }
View content        → GET /api/client/... (read-only)
```

## 4. Team Member Flow (SMM + Graphic Designer)

```
Login               → POST /api/user/login { email, password, role: "SMM"|"Graphic Designer" }
SMM Dashboard       → GET /api/smm/dashboard
Graphic Designer    → GET /api/gd/dashboard
```

## 5. Social Media Manager Flow

```
Login               → POST /api/user/login { role: "SMM" }
Get my clients       → GET /api/admin/users/clients  (dropdown ke liye — v18 fix)
Connect client's account → GET /api/social/auth/:platform?clientId=<id>  (MANDATORY)
                         → POST /api/social/connect { ..., clientId }     (MANDATORY)
Create Post for client  → POST /api/posts/create { clientId, content, platforms, ... }  (MANDATORY)
Schedule Post       → POST /api/posts/create + clientId + { scheduleDate, scheduleTime } OR { scheduleAt }
Get Queued Posts    → GET /api/posts/queued?clientId=<id>  (clientId optional filter)
Get Published       → GET /api/posts/published?clientId=<id>
Save Draft          → POST /api/posts/draft { clientId, ... }  (MANDATORY)
Manage Drafts       → GET/PUT/DELETE /api/posts/draft/:id
Analytics           → GET /api/posts/overview
Social Accounts     → GET /api/social/accounts?clientId=<id>  (optional — na diya to sab clients ke accounts)
```

## 6. Graphic Designer Flow

```
Login               → POST /api/user/login { role: "Graphic Designer" }
Dashboard           → GET /api/gd/dashboard
Design Projects     → GET /api/gd/projects
Update Profile      → PUT /api/gd/profile
```

## 7. Post Management Flow

```
Create (immediate):   POST /api/posts/create { content, platforms, tags }
                      → status: "queued" → BullMQ processes immediately

Schedule (v16 fix):   POST /api/posts/create {
                        content, platforms,
                        scheduleDate: "2024-12-25",  ← NEW: separate fields
                        scheduleTime: "14:30"         ← NEW: separate fields
                        // OR: scheduleAt: "2024-12-25T14:30:00.000Z"  ← old way still works
                      }
                      → status: "scheduled" → BullMQ processes at delay
                      → scheduleDate + scheduleTime stored in DB ✅

Draft:                POST /api/posts/draft → status: "draft"
Publish Draft:        PUT /api/posts/publish/:id

BullMQ Worker:        processes jobs with delay → calls shared
                       processPostPublish() in
                       src/service/postPublish.service.js → REAL
                       publish on YouTube/Twitter/LinkedIn/Facebook/
                       Instagram/Pinterest (v18 — pehle sirf YouTube
                       real tha, baaki sab "mock success" daal dete
                       the). Access token expire ho raha ho to
                       automatically refresh hota hai
                       (tokenRefresh.service.js).

Cron Recovery Job (v18): har 2 minute check karta hai — sirf un posts
                       ko jo "scheduled" hain aur scheduleAt + 2min
                       grace nikal gaya (matlab BullMQ job kisi reason
                       se miss ho gaya, e.g. Redis down tha). Same
                       processPostPublish() ko call karta hai — REAL
                       publish, fake "mark as published" nahi.
                       processPostPublish() khud idempotent hai
                       (already-published post skip ho jaata hai),
                       isliye worker ke saath race-condition nahi hoti.
```

## 8. Authentication & Authorization Flow

```
Token:    JWT { id, role } stored in Authorization: Bearer <token>

Roles:
  superadmin → isSuperAdmin middleware
  admin      → isAdmin middleware (Agency)
  SMM        → role(["SMM"]) middleware
  Graphic Designer → role(["Graphic Designer"])
  Client     → role(["Client"])

Subscription check (v16):
  All protected agency/user/post routes → checkSubscription middleware
  trial + trialEndDate not expired → PASS
  trial + expired → 402 TRIAL_EXPIRED
  active + subscriptionExpiry not passed → PASS
  active + expired → 402 SUBSCRIPTION_EXPIRED
  expired → 402 SUBSCRIPTION_EXPIRED

Trial Limits (v16):
  Create Client        → checkTrialClientLimit (max 2)
  Create SMM/GD        → checkTrialTeamMemberLimit (max 2)
  Create/Draft Post    → checkTrialPostLimit (max 20)
```

---

## Subscription Status Values

| Status    | Description                    |
|-----------|-------------------------------|
| `trial`   | 3-day trial (auto on creation) |
| `active`  | Paid subscription active       |
| `expired` | Trial or subscription expired  |

## Plan Types

| Plan         | Clients    | Team Members | Posts      | Analytics |
|--------------|-----------|--------------|-----------|-----------|
| `trial`      | Max 2      | Max 2        | Max 20    | No        |
| `basic`      | Unlimited  | Unlimited    | Unlimited | No        |
| `pro`        | Unlimited  | Unlimited    | Unlimited | Yes       |
| `enterprise` | Unlimited  | Unlimited    | Unlimited | Yes + Reports |
