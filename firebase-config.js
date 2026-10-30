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
    endpoint: "https://api.imgbb.com/1/upload"
};

/**
 * Client-Side Pre-Compression Helper
 * Compresses raw camera photos down to ~250-350 KB in milliseconds so cloud upload takes < 1 second.
 */
function preCompressImage(file, maxKB = 320, maxDimension = 1400) {
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

                let quality = 0.85;
                let dataUrl = canvas.toDataURL('image/jpeg', quality);
                let currentKB = Math.round((dataUrl.length * 3) / 4 / 1024);
                while (currentKB > maxKB && quality > 0.40) {
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
 * Universal Cloud Image Uploader
 * Uploads shop photos, banners and product pictures to free CDN (ImgBB).
 * Returns instant direct CDN URL (e.g. https://i.ibb.co/xyz/pic.jpg).
 * In case of offline or failure, seamlessly falls back to optimized Base64.
 */
window.uploadImageToCloud = async function(fileOrDataUrl, maxKB = 300, maxDimension = 1400) {
    if (!fileOrDataUrl) return '';

    // 1. Resolve active ImgBB API key
    let apiKey = (window.imageHostConfig && window.imageHostConfig.apiKey) || 'b8773b33f1f4eac08fdc8056c9daf1dd';
    try {
        const storedKey = localStorage.getItem('lb_imgbb_api_key');
        if (storedKey && storedKey.trim()) apiKey = storedKey.trim();
    } catch {}

    // 2. Pre-compress to DataURL for ultra fast network transfer
    let base64Data = null;
    if (typeof fileOrDataUrl === 'string' && fileOrDataUrl.startsWith('data:image')) {
        base64Data = fileOrDataUrl;
    } else if (fileOrDataUrl instanceof Blob || fileOrDataUrl instanceof File) {
        base64Data = await preCompressImage(fileOrDataUrl, maxKB, maxDimension);
    } else {
        return fileOrDataUrl;
    }

    if (!base64Data) return fileOrDataUrl;

    // 3. If no key, fallback to local base64
    if (!apiKey) return base64Data;

    // 4. Send to ImgBB Free CDN
    try {
        const cleanBase64 = base64Data.replace(/^data:image\/[a-zA-Z0-9.+]+;base64,/, '');
        const formData = new FormData();
        formData.append('key', apiKey);
        formData.append('image', cleanBase64);

        const response = await fetch('https://api.imgbb.com/1/upload', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const json = await response.json();
            if (json && json.success && json.data && json.data.url) {
                console.log('LocalBazar: Cloud CDN image hosted successfully ->', json.data.url);
                return json.data.url;
            }
        }
    } catch (err) {
        console.warn('LocalBazar: ImgBB CDN notice (using local optimized copy):', err.message);
    }

    // Graceful offline fallback
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

        // 1. Sync Listing to Cloud Firestore
        saveListing: async function(listing) {
            if (!listing || !listing.id) return;
            if (!window.isFirebaseReady() || !lbFirestore) return;

            try {
                await lbFirestore.collection('listings').doc(String(listing.id)).set(listing, { merge: true });
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

        // 3. Pull All Listings from Firestore & Cache in LocalStorage
        pullListings: async function() {
            if (!window.isFirebaseReady() || !lbFirestore) return null;

            try {
                const snapshot = await lbFirestore.collection('listings').get();
                if (!snapshot.empty) {
                    const cloudListings = [];
                    snapshot.forEach(doc => {
                        cloudListings.push(doc.data());
                    });

                    if (cloudListings.length > 0) {
                        localStorage.setItem('lb_listings', JSON.stringify(cloudListings));
                        console.log(`[CloudSync] Pulled ${cloudListings.length} listings from Firestore to local cache.`);
                        return cloudListings;
                    }
                }
            } catch (err) {
                console.error("[CloudSync] Failed to pull listings from Firestore:", err);
            }
            return null;
        },

        // 4. Real-time Listener for Public Listings
        listenListings: function(callback) {
            if (!window.isFirebaseReady() || !lbFirestore) return null;

            try {
                return lbFirestore.collection('listings').onSnapshot(snapshot => {
                    const updated = [];
                    snapshot.forEach(doc => updated.push(doc.data()));
                    if (updated.length > 0) {
                        localStorage.setItem('lb_listings', JSON.stringify(updated));
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
                const snapshot = await lbFirestore.collection('users').get();
                if (!snapshot.empty) {
                    const rawUsers = [];
                    snapshot.forEach(doc => rawUsers.push({ ...doc.data(), id: doc.data().id || doc.id }));

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
                    snapshot.forEach(doc => rawUsers.push({ ...doc.data(), id: doc.data().id || doc.id }));

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

        pullCities: async function() {
            if (!window.isFirebaseReady() || !lbFirestore) return null;
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

        pullCategories: async function() {
            if (!window.isFirebaseReady() || !lbFirestore) return null;
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

        pullNews: async function() {
            if (!window.isFirebaseReady() || !lbFirestore) return null;
            try {
                const snapshot = await lbFirestore.collection('news').get();
                if (!snapshot.empty) {
                    const cloudNews = [];
                    snapshot.forEach(doc => cloudNews.push(doc.data()));
                    if (cloudNews.length > 0) {
                        localStorage.setItem('lb_news', JSON.stringify(cloudNews));
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

        // 19. Full Database Pull from Firestore on startup (Optimized 2-Tier Strategy)
        pullAllData: async function() {
            if (!window.isFirebaseReady() || !lbFirestore) return;
            try {
                // Tier 1: Search-critical data first (Cities, Categories, Listings) for 0ms initial responsiveness
                await Promise.allSettled([
                    window.lbCloudSync.pullCities(),
                    window.lbCloudSync.pullCategories(),
                    window.lbCloudSync.pullListings()
                ]);
                try {
                    window.dispatchEvent(new CustomEvent('lb:cloud-synced'));
                } catch (e) {}

                // Tier 2: Background sync for secondary admin data (Users, News, Claims, Trust, Mail, Banners)
                Promise.allSettled([
                    window.lbCloudSync.pullUsers(),
                    window.lbCloudSync.pullNews(),
                    window.lbCloudSync.pullClaims(),
                    window.lbCloudSync.pullTrustRequests(),
                    window.lbCloudSync.pullMail(),
                    window.lbCloudSync.pullDefaultBanners()
                ]).then(() => {
                    console.log("[CloudSync] Complete Firestore database sync finished.");
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
