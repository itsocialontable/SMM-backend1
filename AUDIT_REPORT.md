# SMM Backend v18 — Audit Report & Changelog

Ye file v18 me ki gayi saari fixes ka complete record hai — taaki future
me koi bhi (aap khud ya koi naya developer) samajh sake ki kya tha,
kyun tha, aur kaise fix kiya gaya.

---

## 🏗️ ARCHITECTURE CHANGE — Admin model hata diya, Agency hi "admin" hai

**Pehle:** Do alag-alag "admin" systems the —
- Purana `Admin` model + `Workspace` model (`/api/admin/login`, profile, workspace) — iska register route hi disabled tha, matlab koi naya Admin account ban hi nahi sakta tha. Practically dead/broken code tha.
- Naya `Agency` model (`/api/agency/login` + branding) — ye asli kaam karta tha (subscription, trial, user management ke saath).

Dono ka JWT role `"admin"` hota tha, dono ek hi `isAdmin` middleware se guard hote the — bohot confusing, aur Admin model se login karne par `/api/admin/dashboard`, `/api/admin/users/*` jaise routes khaali/galat data dete (kyunki Admin._id kabhi kisi User2.agencyId se match nahi karta).

**Ab (v18):**
- `src/models/admin.model.js` **pura delete** kar diya gaya.
- `Agency` model hi system me "admin" hai. Login `/api/agency/login` se hota hai (role: "admin"), aur **isi token se** `/api/admin/dashboard`, `/api/admin/profile`, `/api/admin/workspace`, `/api/admin/users/*`, `/api/admin/design-projects/*` sab access hote hain.
- `Workspace` model ka `admin` field `agency` (ref: "Agency") bana diya — workspace ab Agency se directly linked hai.
- `Agency` model me `profileImage`, `profileImagePublicId`, `resetOtp`, `resetOtpExpire`, `resetOtpVerified` fields add kiye (pehle Admin model me the).
- Agency ke liye apna forgot-password flow add kiya: `POST /api/agency/forgot-password`, `/verify-reset-otp`, `/resend-reset-otp`, `/reset-password`, `/change-password`.
- `controllers/admin/profile.controller.js` aur `workspace.controller.js` ab `Agency` model use karte hain.

---

## 🏗️ "User" model hata diya — sirf User2 use hota hai ab

**Pehle:** `post.model.js`, `socialAccount.model.js`, `notificationSettings.model.js` me `ref: "User"` likha tha — lekin koi `User` mongoose model kabhi define hi nahi tha is codebase me, sirf `User2` tha! Abhi tak crash nahi hua tha kyunki kahin `.populate("user")` call nahi ho raha tha — lekin future me koi bhi populate try karta to "Schema hasn't been registered for model 'User'" error aata.

**Fix:** Teeno jagah `ref: "User"` ko `ref: "User2"` kar diya. `SocialAccount` aur `Notification` me ab `ownerType` field + dynamic `refPath` bhi hai (User2 ya Agency dono ko sahi se populate kar sake, kyunki Agency bhi kabhi-kabhi owner ho sakti hai).

---

## 🚨 CRITICAL BUGS — pehle crash/silent-fail karte the, ab fix

| # | Bug | Pehle kya hota tha | Fix |
|---|-----|---------------------|-----|
| 1 | `PUT /api/posts/publish/:id` | `Post` model aur `postQueue` ka `require` hi missing tha — call karte hi "Post is not defined" crash | Imports add kiye |
| 2 | Disconnect social account | `accessToken`/`refreshToken` ko `null` set karke save karte the, jabki model me `accessToken` `required: true` hai — Mongoose validation fail, hamesha 500 error | `null` ki jagah `""` (empty string) — required validator ko satisfy karta hai |
| 3 | Analytics overview leak | `getOverview` me `req.user._id` use hota tha (hamesha `undefined`, sahi field `req.user.id` hai) — `$match` khaali ho jaata, **saare users ka data mix** ho jaata | `req.user.id` ko explicitly `mongoose.Types.ObjectId` me cast karke match kiya |
| 4 | Account connect/disconnect notifications | `sendNotification()` ko positional args (`io, userId, event, title`) se call kiya jaata tha jabki function ek object expect karta hai — DB me notification kabhi save hi nahi hoti thi | Object-signature se call, sath me missing enum values bhi add kiye |
| 5 | Design-review notifications gayab | `design_submitted_to_smm`, `design_sent_to_client`, `smm_approved_design`, `smm_rejected_design`, `account_connected`, `account_disconnected` — ye sab events use ho rahe the lekin Notification model ke enum me nahi the, Mongoose validation error se silently fail | Sab events enum me add kiye |
| 6 | Agency social-connect access | `social.routes.js` me role check `["SMM","Agency","agency"]` tha, lekin Agency ka actual JWT role hamesha `"admin"` hota hai — Agency hamesha 403 paati thi | Check ko `["SMM","admin"]` kiya |
| 7 | `POST /api/admin/users/create` | Sirf `auth` middleware tha, `isAdmin` nahi — koi bhi Client/SMM/GD bhi user create kar sakta tha. Andar "GD" role allow hota tha jo model ke enum me hi nahi hai (sirf "Graphic Designer" valid) — crash karta | Ye duplicate route pura hata diya — sirf `/api/user/create` (jo subscription/trial limits properly check karta hai) use hota hai ab |
| 8 | `smmReviewProject` duplicate | Same naam ka function 2 jagah tha (`smm.dashboard.controller.js` aur `smm.designProject.controller.js`) — route sirf pehle wale ko use karta tha, doosra dead code tha | Dead duplicate hata diya |
| 9 | YouTube publish bhi practically hamesha fail | `SocialAccount.accessToken`/`refreshToken` schema me `select: false` hain, lekin worker ki query me `.select("+accessToken")` missing tha — `account.accessToken` hamesha `undefined` aata, `decrypt(undefined)` crash | `.select("+accessToken +refreshToken")` add kiya shared publish service me |
| 10 | Pinterest connect crash | `SocialAccount.platform` enum me `"pinterest"` hi missing tha — Pinterest account connect karte waqt validation error | Enum me add kiya |
| 11 | `checkUserActive` SuperAdmin bug | Check `role === "SuperAdmin"` (capital) karta tha, jabki actual stored role `"superadmin"` (lowercase) hai — kabhi match nahi hota | Dono case check kiye |
| 12 | `getAllClients` / `getAllGraphicDesigners` SMM ke liye khaali | `agencyId = req.user.id` har jagah — sahi sirf Agency ke liye hai. SMM jab ye route (client/GD dropdown ke liye) call karta, uska apna User2._id use ho jaata jo kabhi kisi ka agencyId nahi hota — **hamesha khaali list** | `resolveAgencyId()` helper — role ke hisaab se SMM ka asli agencyId User2 se lookup karta hai |

---

## 🎯 PLATFORM KA CORE RULE — SMM apne liye nahi, CLIENT ki taraf se post karta hai

User ki explicit requirement: **SMM kabhi apne khud ke liye social account connect ya post publish nahi karega.** Har SMM apni agency ke clients ke liye (client se mile credentials/permission se) unki taraf se post publish karega.

**Pehle:** `clientId` optional tha har jagah — agar nahi diya, account/post "SMM ka apna" ban jaata (`client: null`). Draft banate waqt `clientId` field controller me handle hi nahi hota tha. Ownership validate nahi hoti thi — koi SMM (ya state tamper karke) kisi doosri agency ke clientId bhi use kar sakta tha.

**Fix (v18):**
- Naya helper: `src/utils/validateClientForSmm.util.js` — check karta hai ki diya gaya `clientId` (1) ek real Client User2 document hai, (2) SMM ki apni agency ka hi hai.
- `clientId` ab **MANDATORY** hai: `POST /api/posts/create`, `POST /api/posts/draft`, `GET /api/social/auth/:platform` (auth URL), `POST /api/social/connect`.
- OAuth `state` base64-encoded hota hai, signed/encrypted nahi — isliye `connectAccount` me bhi **server-side dobara validate** kiya jaata hai (sirf `getAuthUrl` pe trust nahi kiya jaata).
- `publishDraft` aur `publishPost` me safety check: agar post/draft ka `client` field khaali hai to publish reject hota hai.
- `getAccounts`/`getQueuedPosts`/`getPublishedPosts`/`getDrafts` me optional `?clientId=` filter add kiya (validated) — SMM apne specific client ka data dekh sake.
- `getAllClients`/`getAllGraphicDesigners` ka SMM-empty-list bug bhi isi context me fix hua (upar #12).

---

## 🆕 MISSING FEATURES — ab implement ho gaye

### Real publishing (pehle sirf YouTube real tha, baaki sab "mock success")
Naye files:
- `src/service/socialPublish.service.js` — Twitter, LinkedIn, Facebook, Instagram, Pinterest ke liye real publish functions.
- `src/service/tokenRefresh.service.js` — access token expire ho raha ho to automatically refresh karta hai (YouTube/Twitter/LinkedIn/Pinterest standard refresh_token grant; Facebook/Instagram long-lived-token exchange).
- `src/service/postPublish.service.js` — sab platforms ke liye shared, idempotent publish orchestration. Worker (`post.worker.js`) aur recovery cron job (`publishScheduledPosts.job.js`) dono isi ek function (`processPostPublish`) ko call karte hain.

**Production setup zaroori hai:**
- Facebook: connected Page + `pages_manage_posts` permission (Meta App Review).
- Instagram: Business/Creator account Page se linked + `instagram_content_publish` (Meta App Review) + kam se kam 1 image/video.
- LinkedIn: `w_member_social` scope approved.
- Pinterest: kam se kam 1 image + board (auto-fallback to first board agar `pinterestBoardId` nahi diya).
- Twitter: image attach ho sakta hai, video abhi text-only fallback karta hai.

`oauth.config.js` me Facebook scope (`pages_show_list,pages_manage_posts,pages_read_engagement`) aur LinkedIn scope (`w_member_social`) add kiye — pehle ye missing the, isliye actual posting structurally possible hi nahi thi.

### Cron + BullMQ race condition / fake-publish (Redis down scenario)
**Pehle:** Cron job har minute "scheduled" posts ko seedha `status="published"` kar deta tha **bina kuch real publish kiye**. Agar Redis down ho (jo gracefully ignore hota hai), to client ko lagta post chala gaya, jabki kahin gaya hi nahi.

**Fix:** Cron ab ek "recovery/safety-net" job hai — sirf un posts ko process karta hai jo overdue ho gaye (BullMQ se 2-min grace period ke baad bhi "scheduled" hi hain), aur same real `processPostPublish()` call karta hai. Idempotency guard hai (already-published post skip ho jaata hai) — isliye worker se race-condition nahi hoti.

---

## 🔒 SECURITY FIXES

1. **`.env.example` me real production secrets the** (Mongo password, JWT secret, encryption key, email app password, Redis token, OAuth client secrets, Cloudinary keys). Agar ye file kahin commit/share hui ho, **sab credentials abhi rotate karo**.
2. `db.js` me `console.log(process.env.MONGO_URI)` tha — password sahit connection string logs me leak ho sakta tha. Hata diya.
3. `multer` error message "Max 50MB" bolta tha jabki actual limit 100MB hai — fix kiya.
4. `checkDeletedAccount.util.js` dead code tha (kahin import hi nahi hota, jo field check karta tha wo schema me exist hi nahi karta) — delete kiya.

## ⚠️ STILL WORTH KNOWING (cannot be "fixed" by code alone)

1. **SuperAdmin register route public hai** — jab tak koi SuperAdmin nahi bana, koi bhi pehle register karke control le sakta hai. Production deploy karte hi turant ek SuperAdmin register kar lo.
2. Facebook/Instagram/LinkedIn real posting Meta/LinkedIn App Review (production permissions) ke bina sirf test/developer accounts ke saath kaam karegi.
3. Is sandbox me live network access (Facebook/Twitter/LinkedIn/Google APIs) nahi tha, isliye in publish functions ko syntax/logic level pe carefully likha gaya hai but live-tested nahi kiya ja saka — apne real OAuth app credentials ke saath end-to-end test zaroor karo.
