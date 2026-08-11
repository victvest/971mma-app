# V0 Prompt - 971 MMA Privacy Website

Build a public, polished, mobile-first legal website for 971 MMA Academy.

## Goal
Create a website that clearly presents the app privacy policy and delete-account instructions for the 971 MMA mobile app. The site must feel trustworthy, premium, and easy to read on mobile and desktop. The main purpose is clarity and compliance, not marketing.

Do not explain how to build it. Focus only on the final website experience.

## Brand
- Brand name: 971 MMA
- Audience: members, guardians, and app store reviewers
- Tone: disciplined, premium, direct, trustworthy, calm
- Visual direction: modern athletic, minimal, high-contrast, clean legal layout

## Design System
- Primary background: #0B0B0B
- Surface: #121212
- Card background: #F5F4F0
- Text on dark: #FFFFFF
- Text on light: #111111
- Muted text: #6B7280
- Border: #E7E2D8
- Accent green: #00843D
- Secondary accent: #C8A96A
- Error/alert: #B42318

### Typography
- Headings: General Sans, semi-bold or bold
- Body: General Sans regular
- Fallbacks: Inter, system-ui, sans-serif
- Use large, confident headlines and highly readable legal body text

### Layout Style
- Strong hero with logo, short title, and one-line purpose statement
- Clear navigation to Privacy Policy and Account Deletion
- Wide readable text column for policy content
- Cards and section separators for scannability
- Subtle gradients, soft shadows, and thin borders
- Keep the site elegant, not flashy
- Prioritize legal readability and accessibility

## Logo Usage
Use the provided logo assets from the kit:
- `assets/logo-white.png` for dark backgrounds
- `assets/logo-black.png` for light backgrounds
- `assets/favicon.png` for the browser icon

Keep the logo prominent but not oversized. Use a centered wordless mark or compact brand header.

## Required Pages
1. Home page
   - Brief introduction to the 971 MMA legal website
   - Links to Privacy Policy and Account Deletion
   - Contact details in the footer

2. Privacy Policy page
   - Must publish the exact policy content below
   - Use clear section headings and readable spacing

3. Account Deletion page
   - Must publish the exact deletion instructions below
   - Make the deletion flow obvious and simple

## Exact Copy
Use the following content exactly and keep it current:

### Privacy Policy
Title: 971 MMA App Privacy Policy
Last updated: July 2026
Contact: info@971mma.com | +971 54 332 3980

Intro:
This Privacy Policy explains what information the 971 MMA mobile app collects, how we use it, and the choices you have. By using the app you agree to these practices.

Information we collect:
- Account information: email and password, or identifiers from Sign in with Apple / Google.
- Profile information: name, date of birth, phone number, and optional profile photo.
- Training activity: check-ins, attendance, points, milestones, and belt progression.
- Membership information: plan and status synced from the academy’s Mindbody system.
- Device permissions you grant: camera, photo picker, notifications.
- Technical information: basic device/app data needed for security and reliability.

We do not use advertising identifiers or third-party ad trackers.

How we use your information:
We use your information to authenticate you, show schedule and membership status, record check-ins, track rewards and belt progress, and respond to Help & Support messages. We do not sell personal information.

Third-party services:
- Supabase - hosts accounts and app data with row-level security.
- Mindbody - academy membership and schedule sync (credentials never ship in the mobile app).
- Apple / Google - only if the user chooses those sign-in options.

Data storage and security:
Auth sessions are stored in encrypted secure storage on device. Industry-standard safeguards apply; users should keep login details private.

Children and guardians:
Guardians may request linked child trainee accounts after academy approval. Child records remain separate and protected.

Your rights - including account deletion:
Users can update profile fields in the app. They can permanently delete their app account from Profile -> Delete Account. Deletion removes the app account and associated personal data from the system immediately.
Gym membership and billing are separate and must be cancelled with the front desk.
If the app cannot be opened, direct users to the account deletion page or to info@971mma.com.

Changes:
The policy may be updated and the Last updated date must change when it does.

### Account Deletion
Title: Delete your 971 MMA app account
Last updated: July 2026

Intro:
You can permanently delete your 971 MMA app account and associated personal data without reinstalling the app.

In the app (recommended):
1. Open the 971 MMA app and sign in.
2. Go to Profile.
3. Tap Delete Account.
4. Type DELETE and confirm.

After deletion completes, the user is signed out and cannot sign in with that account again.

If the app cannot be opened:
Email info@971mma.com from the email address on the account with the subject Delete my 971 MMA app account. Verify ownership and delete the account.

Important note:
Gym membership is separate. Deleting the app account does not cancel Mindbody membership, billing, or class packages. Contact the front desk at info@971mma.com or +971 54 332 3980 to cancel membership.

Related page: App Privacy Policy

## Site Behavior
- Keep the experience simple, trustworthy, and fast to scan
- Make the privacy policy and deletion instructions easy to find from the home page
- Ensure links are obvious and the contact information is always visible in the footer
- Support mobile-first reading with excellent spacing and accessibility
- Use a polished legal-site aesthetic that feels native to the 971 MMA brand

## Routes
Suggested routes:
- /
- /app-privacy
- /app-account-deletion

## Output Expectations
Generate a production-quality website design and layout that can be turned into a live legal site quickly. The result should feel official, current, and aligned with 971 MMA branding.
