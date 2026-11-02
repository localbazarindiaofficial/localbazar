# LocalBazar — Explore Your City

> **"Every Destination. Every Detail."**  
> A hyper-local business discovery, e-commerce storefront, and marketplace Progressive Web Application (PWA) connecting consumers with verified neighborhood shops, clinics, doctors, services, and commercial establishments.

[![Live Demo](https://img.shields.io/badge/Live-Demo%20on%20Vercel-success?style=for-the-badge&logo=vercel)](https://localbazarindia.vercel.app)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-blue?style=for-the-badge&logo=pwa)](https://localbazarindia.vercel.app)
[![Firebase Cloud](https://img.shields.io/badge/Database-Firebase%20Firestore-orange?style=for-the-badge&logo=firebase)](https://firebase.google.com/)
[![Push Notifications](https://img.shields.io/badge/Push-OneSignal-red?style=for-the-badge&logo=onesignal)](https://onesignal.com/)

---

## 📌 Table of Contents
- [Overview](#-overview)
- [Key Features](#-key-features)
  - [1. Consumer Discovery Experience](#1-consumer-discovery-experience)
  - [2. Merchant & Business Portal](#2-merchant--business-portal)
  - [3. Super Admin Command Center](#3-super-admin-command-center)
- [Tech Stack & Architecture](#-tech-stack--architecture)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Future Roadmap & Scaling Plan](#-future-roadmap--scaling-plan)
  - [Phase 1: Security & Cloud Hardening (Immediate)](#phase-1-security--cloud-hardening-immediate)
  - [Phase 2: Next.js Migration & Google SEO (Scale to 2M+ Users)](#phase-2-nextjs-migration--google-seo-scale-to-2m-users)
  - [Phase 3: High-Performance Search & Geo-Location](#phase-3-high-performance-search--geo-location)
  - [Phase 4: Monetization & Digital Payments](#phase-4-monetization--digital-payments)
  - [Phase 5: Native Mobile Apps (Android & iOS)](#phase-5-native-mobile-apps-android--ios)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🌟 Overview

**LocalBazar** is built to bridge the gap between physical retail merchants and local shoppers. Inspired by platforms like Justdial and Google Maps Local, LocalBazar provides an ultra-fast, mobile-first experience allowing users to discover nearby businesses, check operating hours, view product catalogs, read customer reviews, and initiate direct calls or WhatsApp chats.

### Live Links:
* **Production Web App:** [https://localbazarindia.vercel.app](https://localbazarindia.vercel.app)
* **GitHub Repository:** [https://github.com/localbazarindiaofficial/localbazar](https://github.com/localbazarindiaofficial/localbazar)

---

## 🚀 Key Features

### 1. Consumer Discovery Experience
* **Omni-Search Engine (`index.html`):** Unified dual-input search bar for **City/Locality** and **Category/Shop Type** featuring zero-latency in-memory autocomplete, strict prefix matching, and category popovers.
* **Explore Feed (`explore.html`):** Dynamic listing grid filterable by city and category, featuring real-time operational status ("Open Today" vs. "Closed"), Justdial-style review badges, and sponsored ad slots.
* **Comprehensive Store Profile (`listing-detail.html`):**
  * Interactive multi-image gallery carousel.
  * Direct customer action buttons: **Call Store**, **WhatsApp Chat**, **Get Directions**, and **Share**.
  * Dynamic weekly schedule drawer (day-by-day opening hours).
  * Full address sheet and location badge.
  * Gold Trust badge indicator for verified businesses.
* **In-Store Product Catalog (`store-category.html`):**
  * Flipkart/Amazon-style product grid with sorting (Featured, Price Low to High, Price High to Low, Name A–Z) and an "In Stock Only" filter.
  * Interactive product detail viewer modal with multi-image sliders and direct chat inquiry triggers.
* **Customer Reviews & Ratings:** Star-rating breakdowns, verified customer badges, and interactive review submission.

### 2. Merchant & Business Portal (`account.html`)
* **One-Click Google Authentication (`auth.html`):** Streamlined sign-in via Google OAuth (Firebase Auth).
* **Listing Management:** Add, edit, or update shop information, operating hours, photos, and catalogs.
* **Live Merchant Inbox:** Real-time customer chat allowing merchants to receive and respond to buyer inquiries instantly.
* **Listing Claim Workflow:** Verification mechanism for business owners to claim pre-existing store listings.
* **Trust Badge Applications:** Formal verification requests for stores seeking the official Gold Trust badge.
* **Saved Places & Bookmarks:** Quick-access personal repository for favorite local establishments.

### 3. Super Admin Command Center (`manas-pan-login-admin.html`)
* **Secure Gated Access:** Administrative access control with salted password hashing and brute-force lockout guards.
* **Real-time KPI Dashboard:** Metrics overview displaying total active users, listings, claims, inquiries, supported cities, and categories.
* **Business Listings Moderation:** Full CRUD operations with cloud synchronization.
* **Directory Management:** Custom category taxonomy creation, search tags, and in-store sliding categories.
* **Listing Claims & Verification:** Review legal proofs, approve/reject merchant ownership claims, and award Gold Trust badges.
* **Promotions & Ads Engine:** Manage dynamic 16:9 banner ads and broadcast announcements across the explore feed.
* **Web Push Broadcast Mailbox:** Send platform-wide web push notifications to subscribed devices.

---

## 🛠 Tech Stack & Architecture

| Layer | Technology | Description |
|---|---|---|
| **Frontend** | Vanilla JavaScript (ES6+), HTML5, CSS3 | Pure web standards; zero bundle compile overhead; utilizes CSS custom properties, Font Awesome 6.4, and Google Fonts (*Plus Jakarta Sans* & *Inter*). |
| **Database** | Google Firebase Firestore (v10.8.0 compat) | Real-time cloud database managing listings, reviews, inquiries, cities, categories, and settings. |
| **Authentication** | Firebase Auth | Google OAuth social login and secure session management. |
| **Image CDN & Compression** | ImgBB Cloud API + Canvas Engine | Client-side micro-compression compresses photos down to **<35 KB** in milliseconds with an auto-rotating 3-key failover pool. |
| **Push Notifications** | OneSignal Web SDK v16 + Vercel Serverless | Device token registration and background web push delivery handled via serverless proxy (`send-push.js`). |
| **PWA & Offline** | Service Worker (`sw.js` v88), `manifest.json` | Standalone app experience, offline asset caching, custom app icons, and mobile install prompt. |
| **Hosting & Deploy** | Vercel | Production CDN deployment configured via `vercel.json` with service worker cache headers. |

---

## 📂 Project Structure

```text
localbazar/
├── index.html                   # Landing page with Omni-Search & Google login modal
├── script.js / style.css        # Search logic, autocomplete popovers & main styling
├── explore.html                 # Search results feed & quick listing modal
├── explore.js / explore.css     # Feed rendering, filter handling & ad slots
├── listing-detail.html          # Full store profile, reviews, timings & product showcase
├── listing-detail.js / .css     # Gallery slider, schedule sheet, review manager & chat
├── store-category.html          # Dedicated category & product catalog view
├── store-category.js / .css     # Catalog sorting, stock filtering & product viewer modal
├── account.html                 # Multi-view customer & merchant portal
├── account.js / account.css     # Profile, saved stores, merchant inbox & listing manager
├── manas-pan-login-admin.html   # Enterprise Super Admin control center
├── admin.js / admin.css         # Admin auth gate, KPI metrics, CRUD operations & claims
├── auth.html / auth.js          # Google sign-in page
├── firebase-config.js           # Firebase setup, ImgBB uploader with failover & cloud sync bridge
├── firestore.rules              # Cloud Firestore security rules
├── push-service.js              # OneSignal Web Push client integration
├── send-push.js                 # Vercel serverless function for push dispatch
├── sw.js / pwa.js / pwa.css     # Service worker v88, offline caching & PWA installation
├── manifest.json / admin-manifest.json # App installation manifests
├── vercel.json                  # Deployment configuration & caching rules
└── README.md                    # Project documentation
```

---

## 💻 Getting Started

### Local Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/localbazarindiaofficial/localbazar.git
   cd localbazar
   ```

2. **Serve locally:**
   Since LocalBazar uses standard web technologies, you can run it using any local static file server:
   ```bash
   # Using npx serve
   npx serve .

   # Or using Python
   python -m http.server 3000
   ```
   Open `http://localhost:3000` in your browser.

3. **Firebase Configuration:**
   * Open `firebase-config.js` and ensure your Firebase project credentials match your console settings:
     ```javascript
     window.firebaseConfig = {
         apiKey: "YOUR_FIREBASE_API_KEY",
         authDomain: "your-project.firebaseapp.com",
         projectId: "your-project-id",
         storageBucket: "your-project.appspot.com",
         messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
         appId: "YOUR_APP_ID"
     };
     ```

---

## 🗺️ Future Roadmap & Scaling Plan

This roadmap outlines the planned evolution of LocalBazar from its current MVP architecture into an enterprise-scale hyper-local marketplace capable of serving **2,000,000+ customers and 100,000+ verified businesses**.

```
  ┌───────────────────────────────────────────────────────────────┐
  │                        FUTURE ROADMAP                         │
  ├──────────────┬──────────────┬──────────────┬──────────────────┤
  │   PHASE 1    │   PHASE 2    │   PHASE 3    │     PHASE 4      │
  │  Security &  │   Next.js    │ Fast Search  │   Monetization   │
  │ Cloud Audit  │  Migration   │ & GPS Radius │   & Mobile Apps  │
  └──────────────┴──────────────┴──────────────┴──────────────────┘
```

### Phase 1: Security & Cloud Hardening (Immediate Priority)
- [ ] **Strict Firestore Security Rules:** Lock down database permissions so users can only modify their own stores and profiles; enforce admin checks on sensitive collections.
- [ ] **Backend Admin Authentication:** Transition Super Admin authentication from client-side hashing to Firebase Auth with custom admin claims (`request.auth.token.admin == true`).
- [ ] **Secret Key Protection:** Revoke and remove client-side OneSignal REST API keys; enforce all push dispatches strictly through serverless routes.
- [ ] **Stored XSS Elimination:** Add universal HTML entity sanitization (`escapeHtml`) on all user-submitted inputs (reviews, store names, descriptions).
- [ ] **Customer Chat Privacy:** Restrict `/inquiries` access strictly to the customer (`senderId`) and store owner (`receiverId`).

### Phase 2: Next.js Migration & Google SEO (Scale to 2M+ Users)
- [ ] **Next.js 14+ (App Router) Architecture:** Migrate codebase to Next.js + TypeScript to enable Server-Side Rendering (SSR) and Server Actions.
- [ ] **Incremental Static Regeneration (ISR):** Cache store profiles at the CDN edge (`revalidate: 3600`) so 2M visitors do not overload the database.
- [ ] **Search Engine Dominance (SEO):** Automatically generate dynamic OpenGraph tags, sitemaps, and Schema.org structured data (`LocalBusiness`, `Product`, `Review`) for top Google search rankings.
- [ ] **Server-Side Cursor Pagination:** Replace full-database collection downloads with Firestore cursor queries (`.limit(20).startAfter(...)`).
- [ ] **IndexedDB Client Caching:** Replace the restrictive 5MB browser `localStorage` cache with IndexedDB for smooth offline browsing.

### Phase 3: High-Performance Search & Geo-Location
- [ ] **Dedicated Search Engine:** Integrate **Typesense** or **Algolia** for typo-tolerant, multi-attribute, instant search across millions of listings and products.
- [ ] **GPS "Near Me" Radius Filter:** Allow customers to find businesses within 1 km, 3 km, or 5 km of their live location using coordinates.
- [ ] **Interactive Map View:** Add a cluster map view (Mapbox / Leaflet) alongside the grid feed to visualize nearby stores geographically.

### Phase 4: Monetization & Digital Payments
- [ ] **Merchant Subscriptions:** Introduce tiered merchant plans (Free, Silver, Gold Trust Verified) with priority ranking in search results.
- [ ] **Sponsored Search Auctions:** Allow business owners to bid for sponsored placements at the top of category feeds.
- [ ] **In-App Order & Booking:** Integrate UPI, NetBanking, and Card payments (Razorpay / Cashfree) for direct product ordering and clinic appointment booking.
- [ ] **Automated WhatsApp Business Bot:** Notify merchants instantly on WhatsApp when a customer places an inquiry or order.

### Phase 5: Native Mobile Apps (Android & iOS)
- [ ] **TWA (Trusted Web Activity) Android App:** Publish the optimized PWA to Google Play Store using Bubblewrap.
- [ ] **React Native / Expo Apps:** Build dedicated native apps for Android and iOS with native push notifications, background location, and barcode scanning for in-store merchants.

---

## 🤝 Contributing

Contributions, feedback, and issue reports are welcome!
1. Fork the Project.
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`).
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the Branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<p align="center">
  Made with ❤️ by <strong>LocalBazar India</strong>
</p>
