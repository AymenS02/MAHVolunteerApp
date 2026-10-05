# Releasing MAH Volunteer on the Apple App Store

Work through these in order. Steps marked **(you)** need your accounts or
decisions; steps marked **(Claude)** I can do once the earlier ones are done.

---

## 1. Join the Apple Developer Program (you)

You need this to put any app on the App Store. It costs **$99 USD per year**.

**Decide who the "seller" is.** The App Store shows this name under the app.

| Enroll as | Seller name shown | What you need |
|---|---|---|
| **Organization** (recommended for a mosque or nonprofit) | The organization's legal name | A legal entity, a **D-U-N-S number** (free from Dun & Bradstreet, can take a few business days), a website on the organization's domain, and authority to sign for the organization |
| Individual | Your personal name | Just your Apple ID and ID verification |

**Nonprofits may not have to pay.** Apple offers fee waivers to eligible
nonprofit organizations. Search "Apple Developer membership fee waiver" and check
whether your organization qualifies *before* paying.

**Steps:**
1. Make sure your Apple ID has **two-factor authentication** on (Settings →
   your name → Sign-In & Security on an iPhone).
2. If enrolling as an organization, look up or request your D-U-N-S number
   (Apple's enrollment page links to a lookup tool).
3. Download the **Apple Developer** app on your iPhone and tap **Enroll Now**
   (or go to developer.apple.com/programs/enroll). Follow the prompts and pay
   (or apply for the waiver).
4. Wait for the approval email. Individuals are usually quick; organizations
   can take several days while Apple verifies them.

---

## 2. Host the server (you, with these instructions)

The app currently talks to your own computer (`http://192.168.2.56:5000`).
Reviewers and real users can't reach that, and iPhones block plain `http`. The
server needs a public `https://` address that is always on (reminder
notifications run on a timer inside it).

These steps use **Render**, which is the simplest option for an Express
server. Railway or Fly.io work the same way.

1. **Put the code on GitHub** (it already is if you have the repo there).
   Commit and push your latest work.
2. Go to **render.com** and sign up with your GitHub account.
3. Click **New → Web Service**, then pick this repository.
4. Fill in:
   | Setting | Value |
   |---|---|
   | Root Directory | `server` |
   | Runtime | Node |
   | Build Command | `npm ci --omit=dev` (skips test-only packages, including a ~780 MB MongoDB download) |
   | Start Command | `npm start` |
   | Instance type | A **paid** instance (Starter, about $7/month at the time of writing). The free tier goes to sleep after inactivity, which stops reminders and makes the first request very slow. |
5. Under **Environment**, add these variables (copy values from `server/.env`;
   never commit them to GitHub):
   | Name | Value |
   |---|---|
   | `MONGO_URI` | your Atlas connection string (the rotated one) |
   | `JWT_SECRET` | your rotated secret |
   | `EVENT_TIMEZONE` | e.g. `America/Toronto` |
   | `TRUST_PROXY` | `1` (Render sits in front of the server; this makes rate limits see real IPs) |
   | `NODE_ENV` | `production` |
6. **Let Render reach Atlas.** In MongoDB Atlas → **Network Access**, add
   Render's outbound IP addresses (shown on your Render service under
   **Connect → Outbound**). Allowing `0.0.0.0/0` also works but relies only on
   the database password, so prefer the specific IPs.
7. Click **Create Web Service** and wait for the deploy to finish. Render gives
   it an address like `https://mah-volunteer.onrender.com`.
8. **Connect `api.mahcanada.com`** (the app is already built to use it):
   1. In Render → your service → **Settings → Custom Domains**, add
      `api.mahcanada.com`. Render shows the target to point it at (your
      `….onrender.com` address).
   2. `mahcanada.com` uses **Cloudflare**. In Cloudflare → `mahcanada.com` →
      **DNS → Records → Add record**:
      | Type | Name | Target | Proxy status |
      |---|---|---|---|
      | CNAME | `api` | your `….onrender.com` address | **DNS only** (grey cloud) |

      Keep it "DNS only" so Render can issue the HTTPS certificate.
   3. Back in Render, click **Verify**. The certificate usually appears within
      minutes (DNS changes can occasionally take longer).
9. **Check it works:**
   - https://api.mahcanada.com/privacy shows the privacy policy
   - https://api.mahcanada.com/support shows the support page
   - In Render's logs you see `MongoDB Connected` and `Server running`.

---

## 3. Fill in the privacy policy and support page (you)

Open `server/public/privacy.html` and `server/public/support.html` and replace
every `[BRACKETED]` placeholder:

- `[ORGANIZATION LEGAL NAME]`
- `[MAILING ADDRESS]`
- `[CONTACT EMAIL]` – an address someone actually reads
- `[EFFECTIVE DATE]` – the day you publish it
- `[HOSTING PROVIDER, e.g. Render]`

Have someone responsible for the organization read the policy. It describes
what the app actually does, but it's the organization's promise to its
volunteers, and I'm not a lawyer.

Then commit and push; Render redeploys automatically.

Your URLs for App Store Connect:
- Privacy Policy URL: `https://api.mahcanada.com/privacy`
- Support URL: `https://api.mahcanada.com/support`

(If the organization's main website can host these pages instead, e.g.
`mahcanada.com/privacy`, that looks a little more polished. Either works for
Apple.)

---

## 4. Configure and build the app (Claude)

**Already done:**
- `app.json`: bundle identifier `org.mahcanada.volunteer` (it can never change
  after the first upload), display name **MAH Volunteer**, iPhone only, and
  `ITSAppUsesNonExemptEncryption: false` (no export-compliance questions).
- `eas.json`: a **production** profile that points the app at
  `https://api.mahcanada.com/api` and numbers builds automatically.

**Once your Apple Developer account is approved:**

1. Run the production build:
   `npx eas-cli@latest build --platform ios --profile production`
   The first time, EAS asks you to sign in to your Apple Developer account
   (you'll type `! npx eas-cli@latest build ...` yourself so you can enter your
   Apple ID and the two-factor code). EAS then creates the certificates and the
   **push notification key** for you.
2. Upload the build to **TestFlight**:
   `npx eas-cli@latest submit --platform ios --latest`

---

## 5. Test the real build on your iPhone (you)

1. Install **TestFlight** from the App Store and accept the invite (EAS/App
   Store Connect sends it to your Apple ID).
2. Test the main flows on the real build, against the real server:
   sign up, register for an event, cancel and undo, notifications (turn them on,
   then have an admin approve your hours), the waitlist, and account deletion.
3. Sign in with the review account (step 6) and make sure it works. It sees
   two sample events that nobody else can see.

---

## 6. Fill in App Store Connect (you; Claude can draft the text)

At appstoreconnect.apple.com → **Apps → +** → New App (bundle ID from step 4).

**App information**
- Name: `MAH Volunteer` (must be unique on the App Store)
- Subtitle (optional, 30 characters), e.g. `Sign up and track your hours`
- Category: **Lifestyle** (or Social Networking)
- Privacy Policy URL and Support URL from step 3

**Screenshots**: required for 6.9" iPhone (1320 × 2868). Take them on a large
iPhone running the TestFlight build, or in the iOS Simulator.

**Age rating questionnaire**: answer "None" to all content questions (no
violence, gambling, user-generated public content, etc.). The app's *content*
rating is separate from your 13+ account rule, which the privacy policy covers.

**App Privacy ("nutrition label")**: my suggested answers; check them against
the final policy:

| Data type | Collected | Linked to the user | Used for tracking | Purpose |
|---|---|---|---|---|
| Contact Info → Name | Yes | Yes | No | App Functionality |
| Contact Info → Email Address | Yes | Yes | No | App Functionality |
| Contact Info → Phone Number | Yes | Yes | No | App Functionality |
| Identifiers → User ID | Yes | Yes | No | App Functionality |
| Other Data (date of birth, group, volunteer hours) | Yes | Yes | No | App Functionality |

Everything else: not collected. No third-party advertising or analytics.

**App Review Information**
- **Sign-in required**: yes
  - User name: `appreview@example.com`
  - Password: the one printed by `node scripts/createDemoAccount.js`
    (re-run it to reset the password if you've lost it)
- **Right before submitting**, run `node scripts/createReviewEvents.js` (from
  the `server` folder). It resets the two sample events only the review
  account can see, with dates 30 days out:
  - "Sample: Food bank shift": open, for registering, cancelling and Undo
  - "Sample: Community iftar (full)": full, for joining the waitlist
- **Notes**, for example:
  > MAH Volunteer lets members of our community sign up for volunteer shifts
  > at MAH Canada and track their volunteer hours. The demo account is a
  > regular volunteer; it sees two sample events created for review. Open
  > "Sample: Food bank shift", tap Register, then Cancel registration (an Undo
  > option appears). "Sample: Community iftar (full)" is full, so you can join
  > the waitlist. Event management (creating events, approving hours,
  > messaging volunteers) is limited to our organization's staff. Account
  > deletion is in Profile → Delete account.
- Contact name, phone and email for Apple to reach you during review.

---

## 7. Submit for review (you)

1. In App Store Connect, open the version, choose the TestFlight build, and
   check every section shows as complete.
2. Click **Add for Review**, then **Submit to App Review**.
3. Review usually takes a day or two. If Apple rejects it, the message says
   which guideline; send it to me and we'll fix it and resubmit.
4. After approval you can release immediately or on a date you choose.

---

## Before real users arrive

- Keep the review account working while the app is in review.
- After launch, upload each update with a higher build number (EAS can
  increment it automatically).
