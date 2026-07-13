# v19 Update Notes (is chat me kiye gaye fixes)

1. **subscription.middleware.js** — testing-mode bypass hataya, production
   subscription/trial-limit logic active kar diya. Trial limits ab:
   clients 5, team members 5, posts 20.
2. **postPublish.service.js** — duplicate-publish race condition fix.
   Check-then-act idempotency guard ko atomic `findOneAndUpdate` claim
   se replace kiya (worker + cron recovery job ab kabhi ek hi post
   parallel process nahi karenge, chahe publish 2min se zyada le le).
3. **post.model.js** — naya field `processingLockedAt` add kiya (upar
   wale lock ke liye zaroori, koi purana field nahi chhua).
4. **publish.controller.js (publishPost)** — missing `platforms.length`
   validation add ki (publishDraft me pehle se thi) — ab empty-platform
   post bina publish kiye "published" mark nahi ho sakta.

⚠️ IMPORTANT: `.env` is zip me nahi hai (security ke liye) — apna asli
`.env` (jo pehle wali zip me tha) use karo, LEKIN us zip ke saath share
hui saari secrets (Mongo URI, JWT_SECRET, email password, Redis URL,
sab OAuth client secrets, Cloudinary secret) turant rotate/regenerate
kar lo, kyunki wo ek baar external tool ko share ho chuki hain.

node_modules bhi zip me nahi hai — `npm install` chala lena.
