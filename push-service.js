/**
 * =========================================================================
 * LocalBazar Background Web Push Notification Engine
 * Powered by OneSignal Web SDK v16 (100% Free for up to 10,000 devices)
 * Direct Device Token & Background Push for Android, iOS & Desktop
 * =========================================================================
 */

(function() {
    'use strict';

    const PUSH_CONFIG = {
        appId: localStorage.getItem('lb_onesignal_app_id') || 'cc4cd04b-4cc6-4fcd-ab85-6fee13841b1e',
        restApiKey: localStorage.getItem('lb_onesignal_rest_key') || (typeof atob === 'function' ? atob('b3NfdjJfYXBwX3pyZ25hczJteXpoNDNrNGZuN3hiaGJhM2QzNjJxaml2ZzZ5ZWc2bnlmc3luZmJnZWU2NWY0bHF0cmUyZ2s1anY0bjVwc21uaWZuZ3VyMzQ3cW9tanpoamVteHR2cXZpaXU3aWp3Znk=') : ''),
        defaultIcon: 'https://localbazarindia.vercel.app/app-logo-hd-512.png',
        brandName: 'LocalBazar'
    };

    window.lbPushConfig = PUSH_CONFIG;

    function getCurrentUser() {
        try {
            const raw = localStorage.getItem('lb_current_user');
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }

    window.OneSignalDeferred = window.OneSignalDeferred || [];

    window.lbPushService = {
        isInitialized: false,

        init: function() {
            if (this.isInitialized) return;

            window.OneSignalDeferred.push(async function(OneSignal) {
                try {
                    const appId = PUSH_CONFIG.appId;
                    if (!appId || appId === 'ONESIGNAL_APP_ID_PLACEHOLDER') return;

                    try {
                        await OneSignal.init({
                            appId: appId,
                            allowLocalhostAsSecureOrigin: true,
                            notifyButton: { enable: false }
                        });
                    } catch (initErr) {
                        // Already initialized by head script
                    }

                    window.lbPushService.isInitialized = true;
                    console.log('[PushService] OneSignal Engine Active.');

                    // Auto-sync device token
                    window.lbPushService.syncDeviceToken();

                    // Listen to subscription token changes
                    try {
                        OneSignal.User.PushSubscription.addEventListener("change", function() {
                            window.lbPushService.syncDeviceToken();
                        });
                    } catch(e) {}

                    // Permission change listener
                    try {
                        OneSignal.Notifications.addEventListener('permissionChange', function(permission) {
                            if (permission) {
                                window.lbPushService.syncDeviceToken();
                            }
                        });
                    } catch(e) {}
                } catch (err) {
                    console.warn('[PushService] Init warning:', err);
                }
            });
        },

        // Request Push Permission from Browser
        requestPermission: async function() {
            return new Promise((resolve) => {
                window.OneSignalDeferred.push(async function(OneSignal) {
                    try {
                        const canRequest = await OneSignal.Notifications.canRequest();
                        if (canRequest) {
                            const result = await OneSignal.Notifications.requestPermission();
                            window.lbPushService.syncDeviceToken();
                            resolve(result);
                        } else {
                            resolve(OneSignal.Notifications.permission);
                        }
                    } catch (err) {
                        resolve(false);
                    }
                });
            });
        },

        // Capture Device Token & Associate with User & Store in Firestore
        syncDeviceToken: function() {
            window.OneSignalDeferred.push(async function(OneSignal) {
                try {
                    const subId = OneSignal.User.PushSubscription.id;
                    if (!subId) return;

                    console.log('[PushService] Active Device Push Token:', subId);
                    localStorage.setItem('lb_device_push_token', subId);

                    const user = getCurrentUser();
                    if (user && user.id) {
                        user.pushToken = subId;
                        localStorage.setItem('lb_current_user', JSON.stringify(user));

                        // Sync with Firestore user record
                        if (window.lbCloudSync && typeof window.lbCloudSync.saveUser === 'function') {
                            window.lbCloudSync.saveUser(user);
                        }

                        // Central token collection for instant lookup
                        if (window.lbFirestore) {
                            try {
                                await window.lbFirestore.collection('push_tokens').doc(String(user.id)).set({
                                    pushToken: subId,
                                    userId: String(user.id),
                                    userEmail: (user.email || '').toLowerCase().trim(),
                                    userName: user.name || '',
                                    updatedAt: Date.now()
                                }, { merge: true });
                            } catch(e) {}
                        }

                        // Also associate with all listings owned by this user
                        try {
                            const rawListings = localStorage.getItem('lb_listings');
                            const listings = rawListings ? JSON.parse(rawListings) : [];
                            const userStores = listings.filter(l => 
                                (user.id && String(l.ownerId) === String(user.id)) ||
                                (user.email && l.ownerId && l.ownerId.toLowerCase() === user.email.toLowerCase())
                            );

                            userStores.forEach(async (store) => {
                                store.pushToken = subId;
                                if (window.lbCloudSync && typeof window.lbCloudSync.saveListing === 'function') {
                                    window.lbCloudSync.saveListing(store);
                                }
                                if (window.lbFirestore) {
                                    try {
                                        await window.lbFirestore.collection('push_tokens').doc('store_' + store.id).set({
                                            pushToken: subId,
                                            storeId: String(store.id),
                                            storeName: store.name || '',
                                            ownerId: String(user.id),
                                            updatedAt: Date.now()
                                        }, { merge: true });
                                    } catch(e) {}
                                }
                            });
                            localStorage.setItem('lb_listings', JSON.stringify(listings));
                        } catch(e) {}
                    }
                } catch (err) {
                    console.warn('[PushService] Token sync warning:', err);
                }
            });
        },

        // DIRECT PUSH: Sends directly to a specific device subscription token
        sendDirectPush: async function(token, { title, body, url, icon }) {
            if (!token) {
                console.warn('[PushService] No device token provided for direct push');
                return { success: false, reason: 'No token' };
            }

            const payload = {
                app_id: PUSH_CONFIG.appId,
                include_subscription_ids: [ String(token) ],
                headings: { en: title },
                contents: { en: body },
                url: url || window.location.href,
                chrome_web_icon: icon || PUSH_CONFIG.defaultIcon
            };

            const apiUrl = (window.location.origin && window.location.origin.includes('localbazarindia.vercel.app')) 
                ? '/api/send-push' 
                : 'https://localbazarindia.vercel.app/api/send-push';

            // Strategy 1: Dispatch via Serverless Function
            try {
                const apiRes = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (apiRes.ok) {
                    const result = await apiRes.json();
                    console.log('[PushService] Direct Push dispatched successfully:', result);
                    return { success: true, result };
                }
            } catch(e) {}

            // Strategy 2: Direct OneSignal REST API call
            const restKey = PUSH_CONFIG.restApiKey;
            if (restKey) {
                try {
                    const authHeader = restKey.startsWith('os_v2_') ? `Key ${restKey}` : `Basic ${restKey}`;
                    const res = await fetch('https://onesignal.com/api/v1/notifications', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json; charset=utf-8',
                            'Authorization': authHeader
                        },
                        body: JSON.stringify(payload)
                    });
                    const result = await res.json();
                    console.log('[PushService] Direct OneSignal response:', result);
                    return { success: true, result };
                } catch(e) {}
            }

            return { success: false };
        },

        // Trigger Direct Push to Store Owner when a Customer Inquires
        notifyStoreOwnerDirect: async function({ store, customerName, messageText, product }) {
            if (!store) return;
            let token = store.pushToken;

            // If token not on store, look up in Firestore push_tokens
            if (!token && window.lbFirestore) {
                try {
                    const sDoc = await window.lbFirestore.collection('push_tokens').doc('store_' + store.id).get();
                    if (sDoc.exists && sDoc.data().pushToken) {
                        token = sDoc.data().pushToken;
                    } else if (store.ownerId) {
                        const uDoc = await window.lbFirestore.collection('push_tokens').doc(String(store.ownerId)).get();
                        if (uDoc.exists && uDoc.data().pushToken) {
                            token = uDoc.data().pushToken;
                        }
                    }
                } catch(e) {}
            }

            let bodyText = `${customerName}: "${messageText.slice(0, 90)}"`;
            if (product && product.name) {
                bodyText = `Inquiry on "${product.name}": "${messageText.slice(0, 70)}"`;
            }

            const title = `💬 New Inquiry • ${store.name}`;
            const targetUrl = `${window.location.origin}${window.location.pathname.replace(/\/[^/]*$/, '')}/account.html#inbox`;

            if (token) {
                return await this.sendDirectPush(token, { title, body: bodyText, url: targetUrl });
            } else {
                console.warn(`[PushService] Store "${store.name}" owner has no device token registered yet.`);
            }
        },

        // Trigger Direct Push to Specific User when Admin Sends a Message / Reply
        notifyUserDirect: async function({ targetUserId, targetEmail, subject, messageSnippet }) {
            let token = null;

            // Check local users list
            try {
                const rawUsers = localStorage.getItem('lb_users');
                const users = rawUsers ? JSON.parse(rawUsers) : [];
                const u = users.find(x => 
                    (targetUserId && String(x.id) === String(targetUserId)) || 
                    (targetEmail && x.email && x.email.toLowerCase() === targetEmail.toLowerCase())
                );
                if (u && u.pushToken) token = u.pushToken;
            } catch(e) {}

            // Check Firestore
            if (!token && window.lbFirestore && targetUserId) {
                try {
                    const uDoc = await window.lbFirestore.collection('push_tokens').doc(String(targetUserId)).get();
                    if (uDoc.exists && uDoc.data().pushToken) {
                        token = uDoc.data().pushToken;
                    }
                } catch(e) {}
            }

            const title = `🛡️ Admin Reply: ${subject}`;
            const body = messageSnippet ? messageSnippet.slice(0, 100) : 'You have received a new reply from Super Admin.';
            const targetUrl = `${window.location.origin}${window.location.pathname.replace(/\/[^/]*$/, '')}/account.html#help`;

            if (token) {
                return await this.sendDirectPush(token, { title, body: body, url: targetUrl });
            } else {
                console.warn('[PushService] Target user has no device token saved in database yet.');
            }
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => window.lbPushService.init());
    } else {
        window.lbPushService.init();
    }
})();
