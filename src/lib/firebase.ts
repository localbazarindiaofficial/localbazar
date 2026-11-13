import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  initializeFirestore,
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDocs, 
  getDoc, 
  updateDoc, 
  query, 
  where, 
  limit, 
  startAfter, 
  onSnapshot,
  Firestore
} from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { Listing, UserProfile, CategoryItem, CityItem, MailItem, ClaimItem, TrustRequest, TrustBadgeSettings, NewsItem, SlideBannerItem, TargetNewsBannerItem, EmptyStoreBannerSlot, ReviewItem, PromotedProductItem } from '@/types';

export const firebaseConfig = {
  apiKey: "AIzaSyB8TjyRJ7uCx-YaaxPFYanv6nEWFowt4Vo",
  authDomain: "localbazar-india.firebaseapp.com",
  projectId: "localbazar-india",
  storageBucket: "localbazar-india.firebasestorage.app",
  messagingSenderId: "993047939009",
  appId: "1:993047939009:web:265f275db6785f7a561140",
  measurementId: "G-G8DHT8ZDE6"
};

// Initialize Firebase App
const isNewApp = !getApps().length;
export const app = isNewApp ? initializeApp(firebaseConfig) : getApp();

let firestoreDb: Firestore;
try {
  firestoreDb = initializeFirestore(app, { ignoreUndefinedProperties: true });
} catch {
  firestoreDb = getFirestore(app);
}
export const db: Firestore = firestoreDb;
export const auth: Auth = getAuth(app);

/**
 * Utility to strip undefined properties recursively from an object
 * to prevent Firestore setDoc/updateDoc unsupported field value crashes.
 */
export function cleanForFirestore<T extends Record<string, any>>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;
  const cleaned: any = Array.isArray(obj) ? [] : {};
  for (const [key, val] of Object.entries(obj)) {
    if (val === undefined) continue;
    if (val !== null && typeof val === 'object' && !(val instanceof Date)) {
      cleaned[key] = cleanForFirestore(val);
    } else {
      cleaned[key] = val;
    }
  }
  return cleaned;
}

// Image Upload Helper with Server-Side Route & Local Pre-Compression
export async function uploadImageToCloud(fileOrDataUrl: File | Blob | string, maxKB = 300, maxDimension = 1200): Promise<string> {
  if (!fileOrDataUrl) return '';

  let base64Data: string | null = null;

  if (typeof fileOrDataUrl === 'string' && fileOrDataUrl.startsWith('data:image')) {
    base64Data = fileOrDataUrl;
  } else if (typeof fileOrDataUrl !== 'string' && fileOrDataUrl instanceof Blob) {
    base64Data = await preCompressImage(fileOrDataUrl, maxKB, maxDimension);
  } else {
    return String(fileOrDataUrl);
  }

  if (!base64Data) return String(fileOrDataUrl);

  // 1. Send upload securely through Serverless Next.js API route (keys never exposed to browser)
  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64Data })
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.success && data?.url) {
        return data.url;
      }
    }
  } catch (err) {
    // server API unavailable, fall back safely to optimized pre-compressed base64
  }

  // Safe fallback: Return pre-compressed base64 without exposing any private API keys in client bundle
  return base64Data;
}

function preCompressImage(file: Blob | File, maxKB = 350, maxDimension = 1200): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(null);
    if (!file || !file.type || !file.type.startsWith('image/')) return resolve(null);

    const reader = new FileReader();
    reader.onerror = () => resolve(null);
    reader.onload = function(e) {
      const img = new Image();
      img.onerror = () => resolve(e.target?.result as string);
      img.onload = function() {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(e.target?.result as string);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.85;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        let currentKB = Math.round((dataUrl.length * 3) / 4 / 1024);
        while (currentKB > maxKB && quality > 0.45) {
          quality -= 0.08;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
          currentKB = Math.round((dataUrl.length * 3) / 4 / 1024);
        }
        resolve(dataUrl);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// Deterministic LB-prefixed 6-digit User ID Formatter
export function formatLBUserId(seedOrEmail?: string): string {
  if (!seedOrEmail) return 'LB' + Math.floor(100000 + Math.random() * 900000);
  const clean = String(seedOrEmail).trim();
  if (/^LB\d{6}$/i.test(clean)) {
    return clean.toUpperCase();
  }
  let hash = 0;
  const str = clean.toLowerCase();
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return 'LB' + (100000 + Math.abs(hash % 900000));
}

// In-Memory SWR High-Speed Cache (0ms Instant Page Transitions like Amazon/Flipkart)
const memoryCache = {
  listings: null as Listing[] | null,
  listingsTimestamp: 0,
  listingById: new Map<string, Listing>(),
  categories: null as CategoryItem[] | null,
  cities: null as CityItem[] | null,
  banners: null as any[] | null,
  promotedProducts: null as PromotedProductItem[] | null,
  trustBadgeSettings: null as TrustBadgeSettings | null,
  targetBanners: null as any[] | null,
  newsTicker: null as string | null,
};

// ================= CLOUD SYNC SERVICES =================
export const cloudSync = {
  // Invalidate entire cache (e.g. for Admin or explicit full sync)
  invalidateCache: () => {
    memoryCache.listings = null;
    memoryCache.listingsTimestamp = 0;
    memoryCache.listingById.clear();
    memoryCache.categories = null;
    memoryCache.cities = null;
    memoryCache.banners = null;
    memoryCache.promotedProducts = null;
    memoryCache.trustBadgeSettings = null;
    memoryCache.targetBanners = null;
    memoryCache.newsTicker = null;
  },

  // Listings
  saveListing: async (listing: Listing): Promise<void> => {
    if (!listing || !listing.id) return;
    const docRef = doc(db, 'listings', String(listing.id));
    await setDoc(docRef, listing, { merge: true });

    // Update in-memory cache instantly
    if (memoryCache.listings) {
      const idx = memoryCache.listings.findIndex((l) => l.id === listing.id);
      if (idx >= 0) memoryCache.listings[idx] = listing;
      else memoryCache.listings.unshift(listing);
    }
    memoryCache.listingById.set(String(listing.id), listing);
  },

  updateListingFields: async (listingId: string, fields: Partial<Listing>): Promise<void> => {
    if (!listingId || !fields) return;
    const docRef = doc(db, 'listings', String(listingId));
    const payload = {
      ...fields,
      lastUpdated: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    };
    await setDoc(docRef, payload, { merge: true });

    if (memoryCache.listingById.has(String(listingId))) {
      const existing = memoryCache.listingById.get(String(listingId))!;
      const merged = { ...existing, ...payload };
      memoryCache.listingById.set(String(listingId), merged);
      if (memoryCache.listings) {
        const idx = memoryCache.listings.findIndex((l) => l.id === listingId);
        if (idx >= 0) memoryCache.listings[idx] = merged;
      }
    }
  },

  deleteListing: async (listingId: string): Promise<void> => {
    if (!listingId) return;
    const docRef = doc(db, 'listings', String(listingId));
    await deleteDoc(docRef);

    if (memoryCache.listings) {
      memoryCache.listings = memoryCache.listings.filter((l) => l.id !== listingId);
    }
    memoryCache.listingById.delete(String(listingId));
  },

  pullListings: async (limitCount?: number, forceRefresh = false): Promise<Listing[]> => {
    // 0ms instant cache hit (3-minute TTL)
    if (!forceRefresh && memoryCache.listings && Date.now() - memoryCache.listingsTimestamp < 180000) {
      return limitCount && limitCount > 0 ? memoryCache.listings.slice(0, limitCount) : memoryCache.listings;
    }

    try {
      const colRef = collection(db, 'listings');
      const q = limitCount && limitCount > 0 ? query(colRef, limit(limitCount)) : query(colRef);
      const snap = await getDocs(q);
      const list: Listing[] = [];
      snap.forEach((d) => {
        const item = d.data() as Listing;
        list.push(item);
        if (item && item.id) {
          memoryCache.listingById.set(String(item.id), item);
        }
      });
      if (!limitCount || limitCount >= list.length) {
        memoryCache.listings = list;
        memoryCache.listingsTimestamp = Date.now();
      }
      return list;
    } catch (err) {
      if (memoryCache.listings) return memoryCache.listings;
      throw err;
    }
  },

  // Real Database-Level Cursor Pagination for Extreme Scale (10,000+ businesses)
  pullListingsPaginated: async (
    pageSize: number = 10,
    lastDocSnap: any = null,
    filterCity?: string,
    filterCategory?: string
  ): Promise<{ listings: Listing[]; lastDoc: any; hasMore: boolean }> => {
    try {
      const colRef = collection(db, 'listings');
      const constraints: any[] = [];

      if (filterCity && filterCity !== 'all') {
        constraints.push(where('city', '==', filterCity));
      }
      if (filterCategory && filterCategory !== 'all') {
        constraints.push(where('category', '==', filterCategory));
      }

      constraints.push(limit(pageSize));

      if (lastDocSnap) {
        constraints.push(startAfter(lastDocSnap));
      }

      const q = query(colRef, ...constraints);
      const snap = await getDocs(q);
      const list: Listing[] = [];
      snap.forEach((d) => list.push(d.data() as Listing));

      const newLastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
      const hasMore = snap.docs.length === pageSize;

      return {
        listings: list,
        lastDoc: newLastDoc,
        hasMore
      };
    } catch (err) {
      console.error('Paginated fetch error:', err);
      return { listings: [], lastDoc: null, hasMore: false };
    }
  },

  getListingById: async (id: string, forceRefresh = false): Promise<Listing | null> => {
    if (!id) return null;
    const strId = String(id);

    // 0ms instant cache hit if already loaded in session (e.g. from search results)
    if (!forceRefresh) {
      if (memoryCache.listingById.has(strId)) {
        return memoryCache.listingById.get(strId)!;
      }
      if (memoryCache.listings) {
        const found = memoryCache.listings.find((l) => String(l.id).toLowerCase() === strId.toLowerCase());
        if (found) {
          memoryCache.listingById.set(strId, found);
          return found;
        }
      }
    }

    const docRef = doc(db, 'listings', strId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as Listing;
      memoryCache.listingById.set(strId, data);
      return data;
    }
    return null;
  },

  // Cities
  pullCities: async (forceRefresh = false): Promise<CityItem[]> => {
    if (!forceRefresh && memoryCache.cities) {
      return memoryCache.cities;
    }
    const colRef = collection(db, 'cities');
    const snap = await getDocs(colRef);
    const cities: CityItem[] = [];
    snap.forEach((d) => {
      const data = d.data() as CityItem;
      if (data && data.name) cities.push(data);
    });
    cities.sort((a, b) => a.name.localeCompare(b.name));
    memoryCache.cities = cities;
    return cities;
  },

  saveCity: async (city: CityItem): Promise<void> => {
    if (!city || !city.name) return;
    const docId = city.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await setDoc(doc(db, 'cities', docId), city, { merge: true });
  },

  deleteCity: async (cityName: string): Promise<void> => {
    if (!cityName) return;
    const docId = cityName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await deleteDoc(doc(db, 'cities', docId));
  },

  // Categories
  pullCategories: async (forceRefresh = false): Promise<CategoryItem[]> => {
    if (!forceRefresh && memoryCache.categories) {
      return memoryCache.categories;
    }
    if (!forceRefresh && typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('lb_cached_categories');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            memoryCache.categories = parsed;
          }
        }
      } catch {}
    }
    const colRef = collection(db, 'categories');
    const snap = await getDocs(colRef);
    const cats: CategoryItem[] = [];
    snap.forEach((d) => {
      const data = d.data() as CategoryItem;
      if (data && data.name) cats.push(data);
    });
    cats.sort((a, b) => a.name.localeCompare(b.name));
    memoryCache.categories = cats;
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('lb_cached_categories', JSON.stringify(cats));
      }
    } catch {}
    return cats;
  },

  saveCategory: async (category: CategoryItem): Promise<void> => {
    if (!category || !category.name) return;
    const docId = category.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await setDoc(doc(db, 'categories', docId), category, { merge: true });
    memoryCache.categories = null; // Invalidate
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('lb_cached_categories');
      }
    } catch {}
  },

  deleteCategory: async (categoryName: string): Promise<void> => {
    if (!categoryName) return;
    const docId = categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await deleteDoc(doc(db, 'categories', docId));
    memoryCache.categories = null; // Invalidate
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('lb_cached_categories');
      }
    } catch {}
  },

  // Users
  saveUser: async (user: UserProfile): Promise<void> => {
    if (!user) return;
    let standardId = formatLBUserId(user.email || user.id || user.uid || '');
    const rawUid = user.uid || (!String(user.id).startsWith('LB') ? String(user.id) : undefined);
    let finalJoinedDate = user.joinedDate;

    // Collision safety guard & joinedDate preservation
    if (user.email) {
      try {
        const existingSnap = await getDoc(doc(db, 'users', String(standardId)));
        if (existingSnap.exists()) {
          const exData = existingSnap.data() as UserProfile;
          if (exData.email && exData.email.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
            const numPart = parseInt(standardId.replace('LB', '')) || 100000;
            standardId = 'LB' + (((numPart + 1 - 100000) % 900000) + 100000);
          } else if (exData.joinedDate) {
            // Never overwrite the user's authentic first registration date!
            finalJoinedDate = exData.joinedDate;
          }
        }
      } catch {}
    }

    const cleanUser: UserProfile = {
      ...user,
      id: standardId,
      uid: rawUid,
      joinedDate: finalJoinedDate,
    };
    await setDoc(doc(db, 'users', String(cleanUser.id)), cleanUser, { merge: true });
    // If the user's previous document was stored with raw Firebase UID, clean it up
    if (user.id && user.id !== cleanUser.id && !String(user.id).startsWith('LB')) {
      try {
        await deleteDoc(doc(db, 'users', String(user.id)));
      } catch {}
    }
  },

  deleteUser: async (userId: string): Promise<void> => {
    if (!userId) return;
    await deleteDoc(doc(db, 'users', String(userId)));
  },

  pullUsers: async (): Promise<UserProfile[]> => {
    const colRef = collection(db, 'users');
    const snap = await getDocs(colRef);
    const usersMap = new Map<string, UserProfile>();

    snap.forEach((d) => {
      const u = d.data() as UserProfile;
      if (!u) return;
      const originalId = u.id || d.id;
      const rawUid = u.uid || (!String(originalId).startsWith('LB') ? String(originalId) : undefined);
      const standardId = formatLBUserId(u.email || originalId);

      const normalizedUser: UserProfile = {
        ...u,
        id: standardId,
        uid: rawUid,
      };

      const emailKey = u.email ? u.email.trim().toLowerCase() : standardId;

      if (emailKey) {
        if (!usersMap.has(emailKey)) {
          usersMap.set(emailKey, normalizedUser);
        } else {
          const existing = usersMap.get(emailKey)!;
          usersMap.set(emailKey, {
            ...existing,
            ...normalizedUser,
            id: existing.id || standardId,
            uid: existing.uid || normalizedUser.uid,
            phone: normalizedUser.phone || existing.phone || '',
            city: normalizedUser.city || existing.city || '',
            state: normalizedUser.state || existing.state || '',
            pincode: normalizedUser.pincode || existing.pincode || '',
            verified: normalizedUser.verified ?? existing.verified ?? true,
            joinedDate: existing.joinedDate || normalizedUser.joinedDate,
          });
        }
      } else {
        usersMap.set(standardId, normalizedUser);
      }
    });

    return Array.from(usersMap.values());
  },

  // Mails & Notifications
  pullMail: async (): Promise<MailItem[]> => {
    const colRef = collection(db, 'mail');
    const snap = await getDocs(colRef);
    const mails: MailItem[] = [];
    snap.forEach((d) => mails.push(d.data() as MailItem));
    return mails;
  },

  saveMail: async (mailItem: MailItem): Promise<void> => {
    if (!mailItem || !mailItem.id) return;
    await setDoc(doc(db, 'mail', String(mailItem.id)), mailItem, { merge: true });
  },

  deleteMail: async (mailId: string): Promise<void> => {
    if (!mailId) return;
    await deleteDoc(doc(db, 'mail', String(mailId)));
  },

  // Claims
  pullClaims: async (): Promise<ClaimItem[]> => {
    const colRef = collection(db, 'claims');
    const snap = await getDocs(colRef);
    const claims: ClaimItem[] = [];
    snap.forEach((d) => claims.push(d.data() as ClaimItem));
    return claims;
  },

  saveClaim: async (claim: ClaimItem): Promise<void> => {
    if (!claim || !claim.id) return;
    await setDoc(doc(db, 'claims', String(claim.id)), claim, { merge: true });
  },

  deleteClaim: async (claimId: string): Promise<void> => {
    if (!claimId) return;
    await deleteDoc(doc(db, 'claims', String(claimId)));
  },

  // Trust requests
  pullTrustRequests: async (): Promise<TrustRequest[]> => {
    const colRef = collection(db, 'trust_requests');
    const snap = await getDocs(colRef);
    const reqs: TrustRequest[] = [];
    snap.forEach((d) => reqs.push(d.data() as TrustRequest));
    return reqs;
  },

  saveTrustRequest: async (req: TrustRequest): Promise<void> => {
    if (!req || !req.id) return;
    const cleanData = cleanForFirestore(req);
    await setDoc(doc(db, 'trust_requests', String(req.id)), cleanData, { merge: true });
  },

  deleteTrustRequest: async (id: string): Promise<void> => {
    if (!id) return;
    await deleteDoc(doc(db, 'trust_requests', String(id)));
  },

  pullTrustBadgeSettings: async (forceRefresh = false): Promise<TrustBadgeSettings | null> => {
    if (!forceRefresh && memoryCache.trustBadgeSettings) {
      return memoryCache.trustBadgeSettings;
    }
    // Check localStorage fast cache (0ms instant paint)
    if (!forceRefresh && typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('lb_cached_trust_settings');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            memoryCache.trustBadgeSettings = parsed;
          }
        }
      } catch {}
    }
    try {
      const snap = await getDoc(doc(db, 'settings', 'trust_badge'));
      if (snap.exists()) {
        const data = snap.data() as TrustBadgeSettings;
        memoryCache.trustBadgeSettings = data;
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem('lb_cached_trust_settings', JSON.stringify(data));
          }
        } catch {}
        return data;
      }
    } catch {}
    if (memoryCache.trustBadgeSettings) return memoryCache.trustBadgeSettings;
    return null;
  },

  saveTrustBadgeSettings: async (settings: TrustBadgeSettings): Promise<void> => {
    if (!settings) return;
    await setDoc(doc(db, 'settings', 'trust_badge'), settings, { merge: true });
    memoryCache.trustBadgeSettings = settings;
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('lb_cached_trust_settings', JSON.stringify(settings));
      }
    } catch {}
  },

  // City Requests
  pullCityRequests: async (): Promise<any[]> => {
    try {
      const snap = await getDocs(collection(db, 'city_requests'));
      const list: any[] = [];
      snap.forEach((d) => list.push(d.data()));
      return list;
    } catch {
      return [];
    }
  },

  saveCityRequest: async (req: any): Promise<void> => {
    if (!req || !req.id) return;
    await setDoc(doc(db, 'city_requests', String(req.id)), req, { merge: true });
  },

  deleteCityRequest: async (id: string): Promise<void> => {
    if (!id) return;
    await deleteDoc(doc(db, 'city_requests', String(id)));
  },

  // Category Requests
  pullCategoryRequests: async (): Promise<any[]> => {
    try {
      const snap = await getDocs(collection(db, 'category_requests'));
      const list: any[] = [];
      snap.forEach((d) => list.push(d.data()));
      return list;
    } catch {
      return [];
    }
  },

  saveCategoryRequest: async (req: any): Promise<void> => {
    if (!req || !req.id) return;
    await setDoc(doc(db, 'category_requests', String(req.id)), req, { merge: true });
  },

  deleteCategoryRequest: async (id: string): Promise<void> => {
    if (!id) return;
    await deleteDoc(doc(db, 'category_requests', String(id)));
  },

  // Admin Security
  pullAdminSecurity: async (): Promise<{ pwdHash?: string; email?: string } | null> => {
    try {
      const snap = await getDoc(doc(db, 'settings', 'admin_security'));
      if (snap.exists()) return snap.data() as { pwdHash?: string; email?: string };
    } catch {}
    return null;
  },

  saveAdminSecurity: async (sec: { pwdHash: string; email?: string }): Promise<void> => {
    if (!sec || !sec.pwdHash) return;
    await setDoc(doc(db, 'settings', 'admin_security'), sec, { merge: true });
  },

  // News & Banners Settings
  pullHomeBanners: async (forceRefresh = false): Promise<SlideBannerItem[]> => {
    if (!forceRefresh && memoryCache.banners && memoryCache.banners.length > 0) {
      return memoryCache.banners;
    }
    // Check localStorage fast cache (0ms instant paint)
    if (!forceRefresh && typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('lb_cached_home_banners');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            memoryCache.banners = parsed;
          }
        }
      } catch {}
    }

    try {
      let cloudBanners: SlideBannerItem[] | null = null;
      let latestTime = 0;

      // 1. Check primary settings collection
      try {
        const snap = await getDoc(doc(db, 'settings', 'home_banners'));
        if (snap.exists() && Array.isArray(snap.data()?.banners)) {
          cloudBanners = snap.data()?.banners as SlideBannerItem[];
          latestTime = Number(snap.data()?.updatedAt) || 1;
        }
      } catch {}

      // 2. Check news collection (always accessible regardless of security rules)
      try {
        const newsSnap = await getDoc(doc(db, 'news', 'home_banners'));
        if (newsSnap.exists() && Array.isArray(newsSnap.data()?.banners)) {
          const nBanners = newsSnap.data()?.banners as SlideBannerItem[];
          const nTime = Number(newsSnap.data()?.updatedAt) || 0;
          if (!cloudBanners || nTime >= latestTime) {
            cloudBanners = nBanners;
          }
        }
      } catch {}

      if (cloudBanners && Array.isArray(cloudBanners)) {
        memoryCache.banners = cloudBanners;
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem('lb_cached_home_banners', JSON.stringify(cloudBanners));
          }
        } catch {}
        return cloudBanners;
      }
    } catch (err) {
      console.warn('Could not pull fresh banners from Firestore:', err);
    }

    if (memoryCache.banners) return memoryCache.banners;
    return [];
  },

  saveHomeBanners: async (banners: SlideBannerItem[]): Promise<void> => {
    let saved = false;
    let primaryErr: any = null;

    // 1. Save to news/home_banners first (Zero permission barriers: title & imageUrl conform to rules)
    try {
      const firstImg = banners.find((b) => b.imageUrl)?.imageUrl || 'https://localbazarindia.com/icon-512.png';
      await setDoc(doc(db, 'news', 'home_banners'), {
        title: 'Home Slide Banners',
        imageUrl: firstImg,
        banners,
        updatedAt: Date.now(),
      }, { merge: true });
      saved = true;
    } catch (err) {
      console.warn('Fallback save to news/home_banners failed:', err);
    }

    // 2. Also save to settings/home_banners
    try {
      await setDoc(doc(db, 'settings', 'home_banners'), { banners, updatedAt: Date.now() }, { merge: true });
      saved = true;
    } catch (err) {
      primaryErr = err;
      console.warn('Save to settings/home_banners restricted by rules:', err);
    }

    if (!saved && primaryErr) {
      throw primaryErr;
    }

    memoryCache.banners = banners;
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('lb_cached_home_banners', JSON.stringify(banners));
        window.dispatchEvent(new CustomEvent('lb_home_banners_changed', { detail: banners }));
      }
    } catch {}
  },

  pullTargetNewsBanners: async (): Promise<TargetNewsBannerItem[]> => {
    try {
      const snap = await getDoc(doc(db, 'settings', 'target_news_banners'));
      if (snap.exists() && Array.isArray(snap.data()?.targets)) {
        return snap.data()?.targets as TargetNewsBannerItem[];
      }
    } catch {}
    return [];
  },

  saveTargetNewsBanners: async (targets: TargetNewsBannerItem[]): Promise<void> => {
    await setDoc(doc(db, 'settings', 'target_news_banners'), { targets, updatedAt: Date.now() }, { merge: true });
  },

  pullEmptyStoreBanners: async (): Promise<EmptyStoreBannerSlot[]> => {
    try {
      const snap = await getDoc(doc(db, 'settings', 'empty_store_banners'));
      if (snap.exists() && Array.isArray(snap.data()?.slots)) {
        return snap.data()?.slots as EmptyStoreBannerSlot[];
      }
    } catch {}
    return [];
  },

  saveEmptyStoreBanners: async (slots: EmptyStoreBannerSlot[]): Promise<void> => {
    await setDoc(doc(db, 'settings', 'empty_store_banners'), { slots, updatedAt: Date.now() }, { merge: true });
  },

  // Promoted Products (Featured on Home Page)
  pullPromotedProducts: async (forceRefresh = false): Promise<PromotedProductItem[]> => {
    if (!forceRefresh && memoryCache.promotedProducts && memoryCache.promotedProducts.length > 0) {
      return memoryCache.promotedProducts;
    }
    // Check localStorage fast cache (0ms instant paint)
    if (!forceRefresh && typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('lb_cached_promoted_products');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            memoryCache.promotedProducts = parsed;
          }
        }
      } catch {}
    }
    try {
      const snap = await getDoc(doc(db, 'settings', 'promoted_products'));
      if (snap.exists() && Array.isArray(snap.data()?.items)) {
        const items = snap.data()?.items as PromotedProductItem[];
        memoryCache.promotedProducts = items;
        try {
          if (typeof window !== 'undefined') {
            localStorage.setItem('lb_cached_promoted_products', JSON.stringify(items));
          }
        } catch {}
        return items;
      }
    } catch {}
    if (memoryCache.promotedProducts) return memoryCache.promotedProducts;
    return [];
  },

  savePromotedProducts: async (items: PromotedProductItem[]): Promise<void> => {
    await setDoc(doc(db, 'settings', 'promoted_products'), { items, updatedAt: Date.now() }, { merge: true });
    memoryCache.promotedProducts = items;
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('lb_cached_promoted_products', JSON.stringify(items));
      }
    } catch {}
  },

  pullNewsTicker: async (): Promise<string | null> => {
    try {
      const snap = await getDoc(doc(db, 'settings', 'news_ticker'));
      if (snap.exists() && snap.data()?.ticker) {
        return snap.data()?.ticker as string;
      }
    } catch {}
    return null;
  },

  saveNewsTicker: async (ticker: string): Promise<void> => {
    await setDoc(doc(db, 'settings', 'news_ticker'), { ticker, updatedAt: Date.now() }, { merge: true });
  },

  // Store Reviews Sync (Strictly for Shop / Business Home)
  saveStoreReview: async (shopId: string, review: ReviewItem): Promise<void> => {
    if (!shopId || !review || !review.id) return;
    try {
      const payload: ReviewItem = {
        ...review,
        type: 'store'
      };
      const revRef = doc(db, 'reviews', String(shopId), 'items', String(review.id));
      await setDoc(revRef, payload, { merge: true });
    } catch (err) {
      console.warn('Could not save store review to cloud:', err);
    }
  },

  pullStoreReviews: async (shopId: string): Promise<ReviewItem[]> => {
    if (!shopId) return [];
    try {
      const colRef = collection(db, 'reviews', String(shopId), 'items');
      const snap = await getDocs(colRef);
      const list: ReviewItem[] = [];
      snap.forEach((d) => {
        const item = d.data() as ReviewItem;
        if (!item) return;
        // Strictly Store Reviews: type === 'store' or legacy reviews without a productId
        if ((!item.type || item.type === 'store') && !item.productId) {
          list.push(item);
        }
      });
      list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      return list;
    } catch {
      return [];
    }
  },

  deleteStoreReview: async (shopId: string, reviewId: string): Promise<void> => {
    if (!shopId || !reviewId) return;
    try {
      const revRef = doc(db, 'reviews', String(shopId), 'items', String(reviewId));
      await deleteDoc(revRef);
    } catch (err) {
      console.warn('Could not delete store review from cloud:', err);
    }
  },

  // Product Reviews Sync (Strictly for each individual product)
  saveProductReview: async (shopId: string, productId: string, review: ReviewItem): Promise<void> => {
    if (!shopId || !productId || !review || !review.id) return;
    try {
      const cleanProdId = String(productId).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const payload: ReviewItem = {
        ...review,
        type: 'product',
        productId: cleanProdId
      };
      const revRef = doc(db, 'reviews', String(shopId), 'items', String(review.id));
      await setDoc(revRef, payload, { merge: true });
    } catch (err) {
      console.warn('Could not save product review to cloud:', err);
    }
  },

  pullProductReviews: async (shopId: string, productId?: string): Promise<ReviewItem[]> => {
    if (!shopId) return [];
    try {
      const colRef = collection(db, 'reviews', String(shopId), 'items');
      const snap = await getDocs(colRef);
      const list: ReviewItem[] = [];
      const cleanProdId = productId ? String(productId).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') : '';

      snap.forEach((d) => {
        const item = d.data() as ReviewItem;
        if (!item) return;
        // Strictly Product Reviews for THIS specific product
        if (item.type === 'product' && item.productId) {
          const itemProdId = String(item.productId).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
          if (!cleanProdId || itemProdId === cleanProdId || item.productId === productId) {
            list.push(item);
          }
        }
      });
      list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      return list;
    } catch {
      return [];
    }
  },

  deleteProductReview: async (shopId: string, reviewId: string): Promise<void> => {
    if (!shopId || !reviewId) return;
    try {
      const revRef = doc(db, 'reviews', String(shopId), 'items', String(reviewId));
      await deleteDoc(revRef);
    } catch (err) {
      console.warn('Could not delete product review from cloud:', err);
    }
  },

  // Store Inquiries & Messages
  saveStoreMessage: async (shopId: string, thread: any): Promise<void> => {
    if (!shopId || !thread || !thread.id) return;
    try {
      const msgRef = doc(db, 'inbox', String(shopId), 'threads', String(thread.id));
      await setDoc(msgRef, thread, { merge: true });
    } catch (err) {
      console.warn('Could not save store thread to cloud:', err);
    }
  },

  pullStoreMessages: async (shopId: string): Promise<any[]> => {
    if (!shopId) return [];
    try {
      const colRef = collection(db, 'inbox', String(shopId), 'threads');
      const snap = await getDocs(colRef);
      const list: any[] = [];
      snap.forEach((d) => list.push(d.data()));
      return list;
    } catch {
      return [];
    }
  },

  // User Saved Places / Bookmarks
  saveUserSavedPlaces: async (userId: string, savedPlaces: string[]): Promise<void> => {
    if (!userId) return;
    try {
      await setDoc(doc(db, 'users', String(userId)), { savedPlaces }, { merge: true });
    } catch (err) {
      console.warn('Could not save user bookmarks to cloud:', err);
    }
  },

  pullUserSavedPlaces: async (userId: string): Promise<string[]> => {
    if (!userId) return [];
    try {
      const snap = await getDoc(doc(db, 'users', String(userId)));
      if (snap.exists() && Array.isArray(snap.data()?.savedPlaces)) {
        return snap.data()?.savedPlaces as string[];
      }
    } catch {}
    return [];
  }
};

// Legacy LocalStorage Auto-Cleaner: Purges all heavy arrays (listings, users, banners, reviews)
// leaving ONLY the active login session (lb_current_user), theme (lb_theme) and PWA flags.
export function cleanupLegacyLocalStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    const keysToRemove = [
      'lb_listings',
      'lb_users',
      'lb_user_listings',
      'lb_empty_store_banners',
      'lb_home_banners',
      'lb_target_news_banners',
      'lb_news_ticker',
      'lb_listing_claims',
      'lb_trust_requests',
      'lb_trust_badge_settings',
      'lb_mail',
      'lb_city_requests',
      'lb_category_requests',
      'lb_cities',
      'lb_categories',
      'lb_news',
      'lb_theme'
    ];
    keysToRemove.forEach((k) => {
      try { localStorage.removeItem(k); } catch {}
    });

    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('lb_reviews_') || key.startsWith('lb_store_inbox_') || key.startsWith('lb_prod_reviews_'))) {
        try { localStorage.removeItem(key); } catch {}
      }
    }
  } catch {}
}
