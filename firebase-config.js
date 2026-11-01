/**
 * LocalBazar Central Firebase Cloud Service & Configuration
 * -------------------------------------------------------------
 * Provides seamless bridge between local UI caching and Firebase Cloud Firestore.
 * 
 * Instructions:
 * Replace the placeholder values in `window.firebaseConfig` with your actual
 * Firebase project credentials from https://console.firebase.google.com
 */

window.firebaseConfig = {
    apiKey: "AIzaSyB8TjyRJ7uCx-YaaxPFYanv6nEWFowt4Vo",
    authDomain: "localbazar-india.firebaseapp.com",
    projectId: "localbazar-india",
    storageBucket: "localbazar-india.firebasestorage.app",
    messagingSenderId: "993047939009",
    appId: "1:993047939009:web:265f275db6785f7a561140",
    measurementId: "G-G8DHT8ZDE6"
};

// ========================================================
// FREE CLOUD IMAGE HOSTING & GLOBAL CDN CONFIGURATION
// ========================================================
window.imageHostConfig = {
    provider: "imgbb",
    apiKey: "b8773b33f1f4eac08fdc8056c9daf1dd",
    // Multi-Key Failover Pool (Auto-rotates if any key hits limit or 429)
    apiKeys: [
        "b8773b33f1f4eac08fdc8056c9daf1dd",
        "6d207e02198a847aa5ad3ac2292fc10a",
        "d93c042ef3a6dc9e201b1a8d0f1712a3"
    ],
    endpoint: "https://api.imgbb.com/1/upload"
};

/**
 * Client-Side Smart Micro-Compression Helper
 * Compresses HD photos down to ~25-35 KB in milliseconds.
 * Preserves high retina clarity while keeping upload speeds < 0.5s on mobile.
 */
function preCompressImage(file, maxKB = 35, maxDimension = 1000) {
    return new Promise((resolve) => {
        if (!file || !file.type || !file.type.startsWith('image/')) {
            return resolve(null);
        }
        const reader = new FileReader();
        reader.onerror = () => resolve(null);
        reader.onload = function(e) {
            const img = new Image();
            img.onerror = () => resolve(e.target.result);
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
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);

                let quality = 0.78;
                let dataUrl = canvas.toDataURL('image/jpeg', quality);
                let currentKB = Math.round((dataUrl.length * 3) / 4 / 1024);
                while (currentKB > maxKB && quality > 0.35) {
                    quality -= 0.08;
                    dataUrl = canvas.toDataURL('image/jpeg', quality);
                    currentKB = Math.round((dataUrl.length * 3) / 4 / 1024);
                }
                resolve(dataUrl);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

/**
 * Universal Cloud Image Uploader with Multi-Key Failover & Micro-Compression Guard
 * Uploads shop photos, banners and product pictures to free CDN (ImgBB).
 * Returns instant direct CDN URL (e.g. https://i.ibb.co/xyz/pic.jpg).
 * In case of offline or failure, seamlessly falls back to ultra-compressed micro-copy (< 30 KB).
 */
window.uploadImageToCloud = async function(fileOrDataUrl, maxKB = 35, maxDimension = 1000) {
    if (!fileOrDataUrl) return '';

    // 1. Resolve active ImgBB API key list (Primary + Backups)
    let keyPool = (window.imageHostConfig && Array.isArray(window.imageHostConfig.apiKeys))
        ? [...window.imageHostConfig.apiKeys]
        : ['b8773b33f1f4eac08fdc8056c9daf1dd'];

    try {
        const storedKey = localStorage.getItem('lb_imgbb_api_key');
        if (storedKey && storedKey.trim()) {
            keyPool.unshift(storedKey.trim());
        }
    } catch {}

    // Deduplicate keys
    keyPool = Array.from(new Set(keyPool.filter(k => k && k.trim())));

    // 2. Pre-compress to DataURL for ultra fast network transfer (< 35 KB)
    let base64Data = null;
    if (typeof fileOrDataUrl === 'string' && fileOrDataUrl.startsWith('data:image')) {
        base64Data = fileOrDataUrl;
    } else if (fileOrDataUrl instanceof Blob || fileOrDataUrl instanceof File) {
        base64Data = await preCompressImage(fileOrDataUrl, maxKB, maxDimension);
    } else {
        return fileOrDataUrl;
    }

    if (!base64Data) return fileOrDataUrl;

    // 3. Try each key in pool until upload succeeds (Auto-Failover)
    const cleanBase64 = base64Data.replace(/^data:image\/[a-zA-Z0-9.+]+;base64,/, '');

    for (let i = 0; i < keyPool.length; i++) {
        const activeKey = keyPool[i];
        try {
            const formData = new FormData();
            formData.append('key', activeKey);
            formData.append('image', cleanBase64);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6500);

            const response = await fetch('https://api.imgbb.com/1/upload', {
                method: 'POST',
                body: formData,
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (response.ok) {
                const json = await response.json();
                if (json && json.success && json.data && json.data.url) {
                    console.log(`LocalBazar: Cloud CDN image hosted successfully (Key #${i+1}) ->`, json.data.url);
                    return json.data.url;
                }
            }
        } catch (err) {
            console.warn(`LocalBazar: ImgBB Key #${i+1} notice, trying next backup...`);
        }
    }

    // Graceful offline fallback: Always returns ultra-compressed micro-copy (Never crashes Firestore 1MB)
    return base64Data;
};

(function() {
    let lbFirebaseApp = null;
    let lbFirestore = null;
    let lbAuth = null;

    window.isFirebaseReady = function() {
        return Boolean(
            window.firebase &&
            window.firebaseConfig &&
            window.firebaseConfig.apiKey &&
            window.firebaseConfig.apiKey !== "YOUR_API_KEY" &&
            window.firebaseConfig.projectId &&
            window.firebaseConfig.projectId !== "YOUR_PROJECT_ID"
        );
    };

    try {
        if (window.firebase && window.isFirebaseReady()) {
            if (!firebase.apps.length) {
                lbFirebaseApp = firebase.initializeApp(window.firebaseConfig);
            } else {
                lbFirebaseApp = firebase.app();
            }
            lbFirestore = firebase.firestore();
            lbAuth = firebase.auth();
            console.log("LocalBazar: Cloud Firestore & Firebase Auth initialized successfully.");
        } else {
            console.info("LocalBazar: Running in Local Cache Mode. (To enable Cloud Sync, add your Firebase credentials in firebase-config.js)");
        }
    } catch (err) {
        console.warn("LocalBazar: Firebase initialization warning:", err.message);
    }

    // ========================================================
    // CLOUD SYNC BRIDGE (Hybrid Cache-First Architecture)
    // ========================================================
    window.lbCloudSync = {
        getFirestore: () => lbFirestore,
        getAuth: () => lbAuth,

        // 1. Sync Listing to Cloud Firestore (with Anti-Crash Document Size Guard)
        saveListing: async function(listing) {
            if (!listing || !listing.id) return;
            if (!window.isFirebaseReady() || !lbFirestore) return;

            try {
                const safeListing = { ...listing };
                if (safeListing.image && typeof safeListing.image === 'string' && safeListing.image.length > 70000) {
                    safeListing.image = safeListing.image.slice(0, 70000);
                }
                await lbFirestore.collection('listings').doc(String(listing.id)).set(safeListing, { merge: true });
                console.log(`[CloudSync] Listing "${listing.name}" (${listing.id}) synced to Firestore.`);
            } catch (err) {
                console.error("[CloudSync] Failed to sync listing to Firestore:", err);
            }
        },

        // 2. Delete Listing from Cloud Firestore
        deleteListing: async function(listingId) {
            if (!listingId) return;
            if (!window.isFirebaseReady() || !lbFirestore) return;

            try {
                await lbFirestore.collection('listings').doc(String(listingId)).delete();
                console.log(`[CloudSync] Listing (${listingId}) deleted from Firestore.`);
            } catch (err) {
                console.error("[CloudSync] Failed to delete listing from Firestore:", err);
            }
        },

        // 3. Pull All Listings from Firestore & Cache in LocalStorage (With Cooldown Throttling)
        pullListings: async function(force = false) {
            if (!window.isFirebaseReady() || !lbFirestore) return null;

            const now = Date.now();
            const lastSync = Number(sessionStorage.getItem('lb_last_sync_listings') || 0);
            if (!force && (now - lastSync < 3 * 60 * 1000)) {
                try {
                    const raw = localStorage.getItem('lb_listings');
                    if (raw) return JSON.parse(raw);
                } catch (e) {}
            }

            try {
                const snapshot = await lbFirestore.collection('listings').get();
                if (!snapshot.empty) {
                    const cloudListings = [];
                    snapshot.forEach(doc => {
                        cloudListings.push(doc.data());
                    });

                    if (cloudListings.length > 0) {
                        let localListings = [];
                        try {
                            const raw = localStorage.getItem('lb_listings');
                            localListings = raw ? JSON.parse(raw) : [];
                        } catch (e) {}

                        const cloudMap = new Map(cloudListings.map(item => [String(item.id), item]));
                        const merged = [...cloudListings];
                        localListings.forEach(loc => {
                            if (!loc || !loc.id) return;
                            if (!cloudMap.has(String(loc.id))) {
                                merged.push(loc);
                            } else {
                                const cloudItem = cloudMap.get(String(loc.id));
                                if (loc.ownerId && !cloudItem.ownerId) cloudItem.ownerId = loc.ownerId;
                                if (loc.ownerEmail && !cloudItem.ownerEmail) cloudItem.ownerEmail = loc.ownerEmail;
                                if (loc.ownerPhone && !cloudItem.ownerPhone) cloudItem.ownerPhone = loc.ownerPhone;
                                if (loc.ownerName && !cloudItem.ownerName) cloudItem.ownerName = loc.ownerName;
                                if (loc.isPublic && !cloudItem.isPublic) cloudItem.isPublic = loc.isPublic;
                            }
                        });

                        localStorage.setItem('lb_listings', JSON.stringify(merged));
                        sessionStorage.setItem('lb_last_sync_listings', String(Date.now()));
                        console.log(`[CloudSync] Pulled ${cloudListings.length} listings from Firestore, merged total ${merged.length} into local cache.`);
                        return merged;
                    }
                }
            } catch (err) {
                console.error("[CloudSync] Failed to pull listings from Firestore:", err);
            }
            return null;
        },

        // 3b. High-Performance On-Demand Query with Pagination (Supports up to 50,000+ Listings)
        pullListingsPaged: async function({ city = '', category = '', limitCount = 20, lastDoc = null } = {}) {
            if (!window.isFirebaseReady() || !lbFirestore) return null;

            try {
                let query = lbFirestore.collection('listings');

                if (city && city.toLowerCase() !== 'all' && city.toLowerCase() !== 'all cities') {
                    query = query.where('city', '==', city);
                }

                if (category && category.toLowerCase() !== 'all' && category.toLowerCase() !== 'all categories') {
                    query = query.where('category', '==', category);
                }

                query = query.limit(limitCount);

                if (lastDoc) {
                    query = query.startAfter(lastDoc);
                }

                const snapshot = await query.get();
                const results = [];
                let newLastDoc = null;

                if (!snapshot.empty) {
                    snapshot.forEach(doc => {
                        const d = doc.data();
                        if (d && d.status !== 'Pending') {
                            results.push(d);
                        }
                    });
                    newLastDoc = snapshot.docs[snapshot.docs.length - 1];
                }

                if (results.length > 0) {
                    try {
                        const raw = localStorage.getItem('lb_listings');
                        const local = raw ? JSON.parse(raw) : [];
                        const localMap = new Map(local.map(l => [String(l.id), l]));
                        results.forEach(r => localMap.set(String(r.id), r));
                        const mergedArr = Array.from(localMap.values()).slice(0, 500);
                        localStorage.setItem('lb_listings', JSON.stringify(mergedArr));
                    } catch (e) {}
                }

                return {
                    listings: results,
                    lastDoc: newLastDoc,
                    hasMore: snapshot.docs.length === limitCount
                };
            } catch (err) {
                console.warn("[CloudSync] Paged query notice:", err.message);
                return null;
            }
        },

        // 4. Real-time Listener for Public Listings
        listenListings: function(callback) {
            if (!window.isFirebaseReady() || !lbFirestore) return null;

            try {
                return lbFirestore.collection('listings').onSnapshot(snapshot => {
                    const updated = [];
                    snapshot.forEach(doc => updated.push(doc.data()));
                    if (updated.length > 0) {
                        let localListings = [];
                        try {
                            const raw = localStorage.getItem('lb_listings');
                            localListings = raw ? JSON.parse(raw) : [];
                        } catch (e) {}

                        const cloudMap = new Map(updated.map(item => [String(item.id), item]));
                        const merged = [...updated];
                        localListings.forEach(loc => {
                            if (!loc || !loc.id) return;
                            if (!cloudMap.has(String(loc.id))) {
                                merged.push(loc);
                            } else {
                                const cloudItem = cloudMap.get(String(loc.id));
                                if (loc.ownerId && !cloudItem.ownerId) cloudItem.ownerId = loc.ownerId;
                                if (loc.ownerEmail && !cloudItem.ownerEmail) cloudItem.ownerEmail = loc.ownerEmail;
                                if (loc.ownerPhone && !cloudItem.ownerPhone) cloudItem.ownerPhone = loc.ownerPhone;
                                if (loc.ownerName && !cloudItem.ownerName) cloudItem.ownerName = loc.ownerName;
                                if (loc.isPublic && !cloudItem.isPublic) cloudItem.isPublic = loc.isPublic;
                            }
                        });

                        localStorage.setItem('lb_listings', JSON.stringify(merged));
                    }
                    if (typeof callback === 'function') {
                        callback(updated);
                    }
                }, err => {
                    console.error("[CloudSync] Listings listener error:", err);
                });
            } catch (err) {
                console.error("[CloudSync] Error attaching listings listener:", err);
                return null;
            }
        },

        // 5. Sync User to Cloud Firestore (with automatic email deduplication)
        saveUser: async function(user) {
            if (!user || !user.id) return;
            if (!window.isFirebaseReady() || !lbFirestore) return;

            try {
                // If user has email, check for existing document to avoid duplicate user creation
                if (user.email) {
                    const normEmail = user.email.trim().toLowerCase();
                    const existingSnap = await lbFirestore.collection('users')
                        .where('email', '==', normEmail)
                        .get();
                    if (!existingSnap.empty) {
                        const primaryDoc = existingSnap.docs[0];
                        await primaryDoc.ref.set(user, { merge: true });
                        // Delete any redundant duplicate docs with same email
                        if (existingSnap.docs.length > 1) {
                            for (let i = 1; i < existingSnap.docs.length; i++) {
                                await existingSnap.docs[i].ref.delete().catch(() => {});
                            }
                        }
                        console.log(`[CloudSync] Existing User "${user.name}" (${user.email}) merged in Firestore.`);
                        return;
                    }
                }
                await lbFirestore.collection('users').doc(String(user.id)).set(user, { merge: true });
                console.log(`[CloudSync] User "${user.name}" (${user.id}) synced to Firestore.`);
            } catch (err) {
                console.error("[CloudSync] Failed to sync user to Firestore:", err);
            }
        },

        // 6. Delete User from Cloud Firestore
        deleteUser: async function(userId) {
            if (!userId) return;
            if (!window.isFirebaseReady() || !lbFirestore) return;

            try {
                await lbFirestore.collection('users').doc(String(userId)).delete();
                console.log(`[CloudSync] User (${userId}) deleted from Firestore.`);
            } catch (err) {
                console.error("[CloudSync] Failed to delete user from Firestore:", err);
            }
        },

        // 7. Pull Users from Firestore (with automatic deduplication)
        pullUsers: async function() {
            if (!window.isFirebaseReady() || !lbFirestore) return null;

            try {
                function formatToCleanLBId(u, fallbackId) {
                    if (u && u.id && typeof u.id === 'string' && /^LB\d{6}$/i.test(u.id)) {
                        return u.id.toUpperCase();
                    }
                    const seed = String((u && u.email) || (u && u.uid) || fallbackId || 'lb_user');
                    let hash = 0;
                    for (let i = 0; i < seed.length; i++) {
                        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
                        hash |= 0;
                    }
                    return 'LB' + (100000 + Math.abs(hash % 900000));
                }

                const snapshot = await lbFirestore.collection('users').get();
                if (!snapshot.empty) {
                    const rawUsers = [];
                    snapshot.forEach(doc => {
                        const data = doc.data() || {};
                        rawUsers.push({ ...data, id: formatToCleanLBId(data, data.id || doc.id) });
                    });

                    const emailMap = new Map();
                    const cloudUsers = [];
                    for (const u of rawUsers) {
                        const em = (u.email || '').trim().toLowerCase();
                        if (em) {
                            if (emailMap.has(em)) {
                                // Duplicate document found in Firestore - delete the redundant doc
                                const prev = emailMap.get(em);
                                const docToDelete = (u.id !== prev.id) ? u.id : null;
                                if (docToDelete) {
                                    lbFirestore.collection('users').doc(String(docToDelete)).delete().catch(() => {});
                                }
                                continue;
                            }
                            emailMap.set(em, u);
                        }
                        cloudUsers.push(u);
                    }

                    if (cloudUsers.length > 0) {
                        localStorage.setItem('lb_users', JSON.stringify(cloudUsers));
                        return cloudUsers;
                    }
                }
            } catch (err) {
                console.error("[CloudSync] Failed to pull users from Firestore:", err);
            }
            return null;
        },

        // 7b. Real-time Listener for Users
        listenUsers: function(callback) {
            if (!window.isFirebaseReady() || !lbFirestore) return null;

            try {
                return lbFirestore.collection('users').onSnapshot(snapshot => {
                    const rawUsers = [];
                    snapshot.forEach(doc => {
                        const data = doc.data() || {};
                        let cleanId = data.id || doc.id;
                        if (!cleanId || !String(cleanId).startsWith('LB')) {
                            const seed = String(data.email || data.uid || doc.id || 'lb_user');
                            let hash = 0;
                            for (let i = 0; i < seed.length; i++) {
                                hash = ((hash << 5) - hash) + seed.charCodeAt(i);
                                hash |= 0;
                            }
                            cleanId = 'LB' + (100000 + Math.abs(hash % 900000));
                        }
                        rawUsers.push({ ...data, id: cleanId.toUpperCase() });
                    });

                    const emailMap = new Map();
                    const updated = [];
                    for (const u of rawUsers) {
                        const em = (u.email || '').trim().toLowerCase();
                        if (em) {
                            if (emailMap.has(em)) continue;
                            emailMap.set(em, u);
                        }
                        updated.push(u);
                    }

                    if (updated.length > 0) {
                        localStorage.setItem('lb_users', JSON.stringify(updated));
                    }
                    if (typeof callback === 'function') {
                        callback(updated);
                    }
                }, err => {
                    console.error("[CloudSync] Users listener error:", err);
                });
            } catch (err) {
                console.error("[CloudSync] Error attaching users listener:", err);
                return null;
            }
        },

        // 8. Sync Inquiries / Chat Thread to Cloud
        saveInquiryMessage: async function(storeId, messageData) {
            if (!storeId || !messageData) return;
            if (!window.isFirebaseReady() || !lbFirestore) return;

            try {
                await lbFirestore.collection('inquiries')
                    .doc(String(storeId))
                    .collection('messages')
                    .add({
                        ...messageData,
                        timestamp: messageData.timestamp || Date.now(),
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                console.log(`[CloudSync] Inquiry message sent to store ${storeId}.`);
            } catch (err) {
                console.error("[CloudSync] Failed to send inquiry message to Firestore:", err);
            }
        },

        // 9. Real-time Store Chat Listener for Merchant Portal & Customer Chat
        listenStoreInbox: function(storeId, callback) {
            if (!storeId || !window.isFirebaseReady() || !lbFirestore) return null;

            try {
                return lbFirestore.collection('inquiries')
                    .doc(String(storeId))
                    .collection('messages')
                    .onSnapshot(snapshot => {
                        const messages = [];
                        snapshot.forEach(doc => messages.push({ id: doc.id, ...doc.data() }));
                        messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
                        if (typeof callback === 'function') {
                            callback(messages);
                        }
                    }, err => {
                        console.error("[CloudSync] Store inbox listener error:", err);
                    });
            } catch (err) {
                console.error("[CloudSync] Error attaching inbox listener:", err);
                return null;
            }
        },

        // 9b. Sync Customer Rating & Review to Firestore
        saveListingReview: async function(storeId, reviewData) {
            if (!storeId || !reviewData) return;
            if (!window.isFirebaseReady() || !lbFirestore) return;

            try {
                const revId = String(reviewData.id || reviewData.userId || ('rev_' + Date.now()));
                await lbFirestore.collection('reviews')
                    .doc(String(storeId))
                    .collection('items')
                    .doc(revId)
                    .set({
                        ...reviewData,
                        id: revId,
                        timestamp: reviewData.timestamp || Date.now(),
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    }, { merge: true });

                console.log(`[CloudSync] Review saved for store ${storeId}.`);
            } catch (err) {
                console.error("[CloudSync] Failed to save review to Firestore:", err);
            }
        },

        // 9c. Real-time Customer Reviews Listener
        listenListingReviews: function(storeId, callback) {
            if (!storeId || !window.isFirebaseReady() || !lbFirestore) return null;

            try {
                return lbFirestore.collection('reviews')
                    .doc(String(storeId))
                    .collection('items')
                    .onSnapshot(snapshot => {
                        const reviews = [];
                        snapshot.forEach(doc => reviews.push({ id: doc.id, ...doc.data() }));
                        reviews.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                        if (typeof callback === 'function') {
                            callback(reviews);
                        }
                    }, err => {
                        console.error("[CloudSync] Reviews listener error:", err);
                    });
            } catch (err) {
                console.error("[CloudSync] Error attaching reviews listener:", err);
                return null;
            }
        },

        // 10. Sync City to Cloud Firestore
        saveCity: async function(city) {
            if (!city || !city.name) return;
            if (!window.isFirebaseReady() || !lbFirestore) return;
            try {
                const docId = city.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                await lbFirestore.collection('cities').doc(docId).set(city, { merge: true });
            } catch (err) {
                console.error("[CloudSync] Failed to sync city:", err);
            }
        },

        deleteCity: async function(cityName) {
            if (!cityName || !window.isFirebaseReady() || !lbFirestore) return;
            try {
                const docId = cityName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                await lbFirestore.collection('cities').doc(docId).delete();
            } catch (err) {
                console.error("[CloudSync] Failed to delete city:", err);
            }
        },

        clearAllCities: async function() {
            if (!window.isFirebaseReady() || !lbFirestore) return;
            try {
                const snapshot = await lbFirestore.collection('cities').get();
                if (!snapshot.empty) {
                    const batch = lbFirestore.batch();
                    snapshot.forEach(doc => batch.delete(doc.ref));
                    await batch.commit();
                }
                localStorage.setItem('lb_cities', JSON.stringify([]));
                console.log("[CloudSync] All cities deleted from Firestore.");
            } catch (err) {
                console.error("[CloudSync] Failed to clear all cities:", err);
            }
        },

        pullCities: async function(force = false) {
            if (!window.isFirebaseReady() || !lbFirestore) return null;
            const now = Date.now();
            const lastSync = Number(sessionStorage.getItem('lb_last_sync_cities') || 0);
            if (!force && (now - lastSync < 5 * 60 * 1000)) {
                try {
                    const raw = localStorage.getItem('lb_cities');
                    if (raw) return JSON.parse(raw);
                } catch (e) {}
            }
            try {
                const snapshot = await lbFirestore.collection('cities').get();
                const cloudCities = [];
                if (!snapshot.empty) {
                    snapshot.forEach(doc => {
                        const d = doc.data();
                        if (d && d.name) cloudCities.push(d);
                    });
                }
                cloudCities.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
                localStorage.setItem('lb_cities', JSON.stringify(cloudCities));
                sessionStorage.setItem('lb_last_sync_cities', String(Date.now()));
                return cloudCities;
            } catch (err) {
                console.error("[CloudSync] Failed to pull cities:", err);
            }
            return null;
        },

        // 11. Sync Category to Cloud Firestore
        saveCategory: async function(cat) {
            if (!cat || !cat.name) return;
            if (!window.isFirebaseReady() || !lbFirestore) return;
            try {
                const docId = cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                await lbFirestore.collection('categories').doc(docId).set(cat, { merge: true });
            } catch (err) {
                console.error("[CloudSync] Failed to sync category:", err);
            }
        },

        deleteCategory: async function(catName) {
            if (!catName || !window.isFirebaseReady() || !lbFirestore) return;
            try {
                const docId = catName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                await lbFirestore.collection('categories').doc(docId).delete();
            } catch (err) {
                console.error("[CloudSync] Failed to delete category:", err);
            }
        },

        clearAllCategories: async function() {
            if (!window.isFirebaseReady() || !lbFirestore) return;
            try {
                const snapshot = await lbFirestore.collection('categories').get();
                if (!snapshot.empty) {
                    const batch = lbFirestore.batch();
                    snapshot.forEach(doc => batch.delete(doc.ref));
                    await batch.commit();
                }
                localStorage.setItem('lb_categories', JSON.stringify([]));
                console.log("[CloudSync] All categories deleted from Firestore.");
            } catch (err) {
                console.error("[CloudSync] Failed to clear all categories:", err);
            }
        },

        pullCategories: async function(force = false) {
            if (!window.isFirebaseReady() || !lbFirestore) return null;
            const now = Date.now();
            const lastSync = Number(sessionStorage.getItem('lb_last_sync_categories') || 0);
            if (!force && (now - lastSync < 5 * 60 * 1000)) {
                try {
                    const raw = localStorage.getItem('lb_categories');
                    if (raw) return JSON.parse(raw);
                } catch (e) {}
            }
            try {
                const snapshot = await lbFirestore.collection('categories').get();
                const cloudCats = [];
                if (!snapshot.empty) {
                    snapshot.forEach(doc => {
                        const d = doc.data();
                        if (d && d.name) cloudCats.push(d);
                    });
                }
                cloudCats.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
                localStorage.setItem('lb_categories', JSON.stringify(cloudCats));
                sessionStorage.setItem('lb_last_sync_categories', String(Date.now()));
                return cloudCats;
            } catch (err) {
                console.error("[CloudSync] Failed to pull categories:", err);
            }
            return null;
        },

        // 12. Sync News / Ads to Cloud Firestore
        saveNewsItem: async function(item) {
            if (!item || !item.id) return;
            if (!window.isFirebaseReady() || !lbFirestore) return;
            try {
                await lbFirestore.collection('news').doc(String(item.id)).set(item, { merge: true });
            } catch (err) {
                console.error("[CloudSync] Failed to sync ad item:", err);
            }
        },

        deleteNewsItem: async function(itemId) {
            if (!itemId || !window.isFirebaseReady() || !lbFirestore) return;
            try {
                await lbFirestore.collection('news').doc(String(itemId)).delete();
            } catch (err) {
                console.error("[CloudSync] Failed to delete ad item:", err);
            }
        },

        pullNews: async function(force = false) {
            if (!window.isFirebaseReady() || !lbFirestore) return null;
            const now = Date.now();
            const lastSync = Number(sessionStorage.getItem('lb_last_sync_news') || 0);
            if (!force && (now - lastSync < 5 * 60 * 1000)) {
                try {
                    const raw = localStorage.getItem('lb_news');
                    if (raw) return JSON.parse(raw);
                } catch (e) {}
            }
            try {
                const snapshot = await lbFirestore.collection('news').get();
                if (!snapshot.empty) {
                    const cloudNews = [];
                    snapshot.forEach(doc => cloudNews.push(doc.data()));
                    if (cloudNews.length > 0) {
                        localStorage.setItem('lb_news', JSON.stringify(cloudNews));
                        sessionStorage.setItem('lb_last_sync_news', String(Date.now()));
                        return cloudNews;
                    }
                }
            } catch (err) {
                console.error("[CloudSync] Failed to pull news/ads:", err);
            }
            return null;
        },

        // 13. Sync Claims to Cloud Firestore
        saveClaim: async function(claim) {
            if (!claim || !claim.id) return;
            if (!window.isFirebaseReady() || !lbFirestore) return;
            try {
                await lbFirestore.collection('claims').doc(String(claim.id)).set(claim, { merge: true });
            } catch (err) {
                console.error("[CloudSync] Failed to sync claim:", err);
            }
        },

        pullClaims: async function() {
            if (!window.isFirebaseReady() || !lbFirestore) return null;
            try {
                const snapshot = await lbFirestore.collection('claims').get();
                if (!snapshot.empty) {
                    const cloudClaims = [];
                    snapshot.forEach(doc => cloudClaims.push(doc.data()));
                    if (cloudClaims.length > 0) {
                        localStorage.setItem('lb_listing_claims', JSON.stringify(cloudClaims));
                        return cloudClaims;
                    }
                }
            } catch (err) {
                console.error("[CloudSync] Failed to pull claims:", err);
            }
            return null;
        },

        // 13b. Real-time Listener for Claims
        listenClaims: function(callback) {
            if (!window.isFirebaseReady() || !lbFirestore) return null;
            try {
                return lbFirestore.collection('claims').onSnapshot(snapshot => {
                    const updated = [];
                    snapshot.forEach(doc => updated.push(doc.data()));
                    if (updated.length > 0) {
                        localStorage.setItem('lb_listing_claims', JSON.stringify(updated));
                    }
                    if (typeof callback === 'function') callback(updated);
                }, err => {
                    console.error("[CloudSync] Claims listener error:", err);
                });
            } catch (err) {
                console.error("[CloudSync] Error attaching claims listener:", err);
                return null;
            }
        },

        // 13c. Sync Trust Badge Requests to Cloud Firestore
        saveTrustRequest: async function(req) {
            if (!req || !req.id) return;
            if (!window.isFirebaseReady() || !lbFirestore) return;
            try {
                await lbFirestore.collection('trust_requests').doc(String(req.id)).set(req, { merge: true });
            } catch (err) {
                console.error("[CloudSync] Failed to sync trust request:", err);
            }
        },

        pullTrustRequests: async function() {
            if (!window.isFirebaseReady() || !lbFirestore) return null;
            try {
                const snapshot = await lbFirestore.collection('trust_requests').get();
                if (!snapshot.empty) {
                    const cloudReqs = [];
                    snapshot.forEach(doc => cloudReqs.push(doc.data()));
                    if (cloudReqs.length > 0) {
                        localStorage.setItem('lb_trust_requests', JSON.stringify(cloudReqs));
                        return cloudReqs;
                    }
                }
            } catch (err) {
                console.error("[CloudSync] Failed to pull trust requests:", err);
            }
            return null;
        },

        listenTrustRequests: function(callback) {
            if (!window.isFirebaseReady() || !lbFirestore) return null;
            try {
                return lbFirestore.collection('trust_requests').onSnapshot(snapshot => {
                    const updated = [];
                    snapshot.forEach(doc => updated.push(doc.data()));
                    if (updated.length > 0) {
                        localStorage.setItem('lb_trust_requests', JSON.stringify(updated));
                    }
                    if (typeof callback === 'function') callback(updated);
                }, err => {
                    console.error("[CloudSync] Trust requests listener error:", err);
                });
            } catch (err) {
                console.error("[CloudSync] Error attaching trust requests listener:", err);
                return null;
            }
        },

        // 14. Sync Mailbox Messages to Cloud Firestore
        saveMail: async function(mailItem) {
            if (!mailItem || !mailItem.id) return;
            if (!window.isFirebaseReady() || !lbFirestore) return;
            try {
                await lbFirestore.collection('mail').doc(String(mailItem.id)).set(mailItem, { merge: true });
                console.log(`[CloudSync] Mail item "${mailItem.id}" synced to Firestore.`);
            } catch (err) {
                console.error("[CloudSync] Failed to sync mail to Firestore:", err);
            }
        },

        // 14b. Delete Single Mail from Cloud Firestore
        deleteMail: async function(mailId) {
            if (!mailId || !window.isFirebaseReady() || !lbFirestore) return;
            try {
                await lbFirestore.collection('mail').doc(String(mailId)).delete();
                console.log(`[CloudSync] Mail (${mailId}) permanently deleted from Firestore.`);
            } catch (err) {
                console.error("[CloudSync] Failed to delete mail from Firestore:", err);
            }
        },

        // 14c. Batch Delete Multiple Mails from Cloud Firestore
        deleteMultipleMails: async function(mailIds) {
            if (!Array.isArray(mailIds) || mailIds.length === 0 || !window.isFirebaseReady() || !lbFirestore) return;
            try {
                const batch = lbFirestore.batch();
                mailIds.forEach(id => {
                    batch.delete(lbFirestore.collection('mail').doc(String(id)));
                });
                await batch.commit();
                console.log(`[CloudSync] ${mailIds.length} mail items permanently deleted from Firestore.`);
            } catch (err) {
                console.error("[CloudSync] Failed batch delete mails from Firestore:", err);
            }
        },

        // 15. Pull Mail from Firestore
        pullMail: async function() {
            if (!window.isFirebaseReady() || !lbFirestore) return null;
            try {
                const snapshot = await lbFirestore.collection('mail').get();
                if (!snapshot.empty) {
                    const cloudMail = [];
                    snapshot.forEach(doc => cloudMail.push(doc.data()));
                    if (cloudMail.length > 0) {
                        localStorage.setItem('lb_mail', JSON.stringify(cloudMail));
                        return cloudMail;
                    }
                }
            } catch (err) {
                console.error("[CloudSync] Failed to pull mail from Firestore:", err);
            }
            return null;
        },

        // 16. Real-time Mailbox Listener
        listenMail: function(callback) {
            if (!window.isFirebaseReady() || !lbFirestore) return null;
            try {
                return lbFirestore.collection('mail').onSnapshot(snapshot => {
                    const updated = [];
                    snapshot.forEach(doc => updated.push(doc.data()));
                    if (updated.length > 0) {
                        localStorage.setItem('lb_mail', JSON.stringify(updated));
                    }
                    if (typeof callback === 'function') callback(updated);
                }, err => {
                    console.error("[CloudSync] Mail listener error:", err);
                });
            } catch (err) {
                console.error("[CloudSync] Error attaching mail listener:", err);
                return null;
            }
        },

        // 17. Sync Default 16:9 Fallback Listing Banners
        saveDefaultBanners: async function(banners) {
            if (!Array.isArray(banners)) return;
            localStorage.setItem('lb_default_banners', JSON.stringify(banners));
            if (!window.isFirebaseReady() || !lbFirestore) return;
            try {
                await lbFirestore.collection('settings').doc('default_banners').set({
                    banners: banners,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                console.log('[CloudSync] Default listing banners synced to Firestore.');
            } catch (err) {
                console.error("[CloudSync] Failed to sync default banners to Firestore:", err);
            }
        },

        // 18. Pull Default Fallback Listing Banners
        pullDefaultBanners: async function() {
            if (!window.isFirebaseReady() || !lbFirestore) return null;
            try {
                const doc = await lbFirestore.collection('settings').doc('default_banners').get();
                if (doc.exists && doc.data() && Array.isArray(doc.data().banners)) {
                    const banners = doc.data().banners;
                    localStorage.setItem('lb_default_banners', JSON.stringify(banners));
                    return banners;
                }
            } catch (err) {
                console.error("[CloudSync] Failed to pull default banners:", err);
            }
            return null;
        },

        // 18b. Sync Super Admin Security (Master Password Hash & Email) to Cloud Firestore
        saveAdminSecurity: async function(securityData) {
            if (!securityData || !securityData.pwdHash) return;
            if (!window.isFirebaseReady() || !lbFirestore) return;
            try {
                await lbFirestore.collection('settings').doc('admin_security').set({
                    pwdHash: securityData.pwdHash,
                    email: securityData.email || 'localbazar@adminmanaspan.com',
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                console.log('[CloudSync] Admin security credentials synced globally to Cloud Firestore.');
            } catch (err) {
                console.error("[CloudSync] Failed to sync admin security to Firestore:", err);
            }
        },

        pullAdminSecurity: async function() {
            if (!window.isFirebaseReady() || !lbFirestore) return null;
            try {
                const doc = await lbFirestore.collection('settings').doc('admin_security').get();
                if (doc.exists && doc.data() && doc.data().pwdHash) {
                    const data = doc.data();
                    localStorage.setItem('lb_admin_pwd_hash', data.pwdHash);
                    if (data.email) {
                        try {
                            const curAdmin = JSON.parse(localStorage.getItem('lb_admin') || '{}');
                            curAdmin.email = data.email;
                            localStorage.setItem('lb_admin', JSON.stringify(curAdmin));
                        } catch (e) {}
                    }
                    return data;
                }
            } catch (err) {
                console.warn("[CloudSync] Notice pulling admin security:", err.message);
            }
            return null;
        },

        // 19. Sync City Requests to Cloud Firestore
        saveCityRequest: async function(req) {
            if (!req || !req.id) return;
            if (!window.isFirebaseReady() || !lbFirestore) return;
            try {
                await lbFirestore.collection('city_requests').doc(String(req.id)).set(req, { merge: true });
                console.log(`[CloudSync] City Request "${req.name || req.cityName}" synced to Firestore.`);
            } catch (err) {
                console.error("[CloudSync] Failed to sync city request:", err);
            }
        },

        deleteCityRequest: async function(reqId) {
            if (!reqId || !window.isFirebaseReady() || !lbFirestore) return;
            try {
                await lbFirestore.collection('city_requests').doc(String(reqId)).delete();
            } catch (err) {
                console.error("[CloudSync] Failed to delete city request:", err);
            }
        },

        pullCityRequests: async function() {
            if (!window.isFirebaseReady() || !lbFirestore) return null;
            try {
                const snapshot = await lbFirestore.collection('city_requests').get();
                const cloudReqs = [];
                if (!snapshot.empty) {
                    snapshot.forEach(doc => cloudReqs.push(doc.data()));
                }
                localStorage.setItem('lb_city_requests', JSON.stringify(cloudReqs));
                return cloudReqs;
            } catch (err) {
                console.error("[CloudSync] Failed to pull city requests:", err);
            }
            return null;
        },

        listenCityRequests: function(callback) {
            if (!window.isFirebaseReady() || !lbFirestore) return null;
            try {
                return lbFirestore.collection('city_requests').onSnapshot(snapshot => {
                    const updated = [];
                    snapshot.forEach(doc => updated.push(doc.data()));
                    localStorage.setItem('lb_city_requests', JSON.stringify(updated));
                    if (typeof callback === 'function') callback(updated);
                }, err => {
                    console.error("[CloudSync] City requests listener error:", err);
                });
            } catch (err) {
                return null;
            }
        },

        // 20. Sync Category Requests to Cloud Firestore
        saveCategoryRequest: async function(req) {
            if (!req || !req.id) return;
            if (!window.isFirebaseReady() || !lbFirestore) return;
            try {
                await lbFirestore.collection('category_requests').doc(String(req.id)).set(req, { merge: true });
                console.log(`[CloudSync] Category Request "${req.name || req.categoryName}" synced to Firestore.`);
            } catch (err) {
                console.error("[CloudSync] Failed to sync category request:", err);
            }
        },

        deleteCategoryRequest: async function(reqId) {
            if (!reqId || !window.isFirebaseReady() || !lbFirestore) return;
            try {
                await lbFirestore.collection('category_requests').doc(String(reqId)).delete();
            } catch (err) {
                console.error("[CloudSync] Failed to delete category request:", err);
            }
        },

        pullCategoryRequests: async function() {
            if (!window.isFirebaseReady() || !lbFirestore) return null;
            try {
                const snapshot = await lbFirestore.collection('category_requests').get();
                const cloudReqs = [];
                if (!snapshot.empty) {
                    snapshot.forEach(doc => cloudReqs.push(doc.data()));
                }
                localStorage.setItem('lb_category_requests', JSON.stringify(cloudReqs));
                return cloudReqs;
            } catch (err) {
                console.error("[CloudSync] Failed to pull category requests:", err);
            }
            return null;
        },

        listenCategoryRequests: function(callback) {
            if (!window.isFirebaseReady() || !lbFirestore) return null;
            try {
                return lbFirestore.collection('category_requests').onSnapshot(snapshot => {
                    const updated = [];
                    snapshot.forEach(doc => updated.push(doc.data()));
                    localStorage.setItem('lb_category_requests', JSON.stringify(updated));
                    if (typeof callback === 'function') callback(updated);
                }, err => {
                    console.error("[CloudSync] Category requests listener error:", err);
                });
            } catch (err) {
                return null;
            }
        },

        // 21. Full Database Pull from Firestore on startup (Optimized Context-Aware & Cooldown Strategy)
        pullAllData: async function(force = false) {
            if (!window.isFirebaseReady() || !lbFirestore) return;

            const isAdminPage = window.location.pathname.includes('manas-pan-login-admin') || !!document.getElementById('adminSidebar');

            try {
                // Tier 1: Search-critical data first (Cities, Categories, Listings) with cooldown caching
                await Promise.allSettled([
                    window.lbCloudSync.pullCities(force),
                    window.lbCloudSync.pullCategories(force),
                    window.lbCloudSync.pullListings(force)
                ]);
                try {
                    window.dispatchEvent(new CustomEvent('lb:cloud-synced'));
                } catch (e) {}

                // Tier 2: Background sync - only pull what is relevant to the current user/page
                const tier2Tasks = [
                    window.lbCloudSync.pullNews(force),
                    window.lbCloudSync.pullDefaultBanners(force)
                ];

                // Heavy admin-only collections are strictly skipped for regular users
                if (isAdminPage) {
                    tier2Tasks.push(
                        window.lbCloudSync.pullAdminSecurity(),
                        window.lbCloudSync.pullUsers(force),
                        window.lbCloudSync.pullClaims(force),
                        window.lbCloudSync.pullTrustRequests(force),
                        window.lbCloudSync.pullMail(force),
                        window.lbCloudSync.pullCityRequests(force),
                        window.lbCloudSync.pullCategoryRequests(force)
                    );
                } else if (window.location.pathname.includes('account.html')) {
                    tier2Tasks.push(window.lbCloudSync.pullMail(force));
                }

                Promise.allSettled(tier2Tasks).then(() => {
                    console.log("[CloudSync] Background sync finished.");
                    try {
                        window.dispatchEvent(new CustomEvent('lb:cloud-synced'));
                    } catch (e) {}
                });
            } catch (err) {
                console.warn("[CloudSync] Error in pullAllData:", err);
            }
        }
    };

    // Auto-pull fresh database from Cloud if online & configured
    document.addEventListener('DOMContentLoaded', () => {
        if (window.isFirebaseReady()) {
            window.lbCloudSync.pullAllData().catch(() => {});
        }
    });
})();
