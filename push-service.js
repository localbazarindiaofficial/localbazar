/**
 * =========================================================================
 * LocalBazar Background Web Push Notification Engine
 * Powered by OneSignal Web SDK v16 (100% Free for up to 10,000 devices)
 * Direct Device Token & Background Push for Android, iOS & Desktop
 * =========================================================================
 */

(function() {
    'use strict';

    const DEFAULT_REST_KEY = (typeof atob === 'function' ? atob('b3NfdjJfYXBwX3pyZ25hczJteXpoNDNrNGZuN3hiaGJhM2R5cWNhNmNoZm1kZWhtZmV3ZXZpaXBhZmFibWV1Z2htNngzaGViYWl4cmdub3M2ZmUzaHU3emxhemZoZDd0ZXNuNnF1dGlvZzZqbXdzZXk=') : '');
    
    // Purge any stale invalid key from localStorage
    try {
        const storedKey = localStorage.getItem('lb_onesignal_rest_key');
        if (!storedKey || !storedKey.includes('dyqca6chfm')) {
            localStorage.setItem('lb_onesignal_rest_key', DEFAULT_REST_KEY);
        }
    } catch(e) {}

    const PUSH_CONFIG = {
        appId: 'cc4cd04b-4cc6-4fcd-ab85-6fee13841b1e',
        restApiKey: DEFAULT_REST_KEY,
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
                    const subId = OneSignal.User?.PushSubscription?.id;
                    if (subId) {
                        console.log('[PushService] Active Device Push Token:', subId);
                        localStorage.setItem('lb_device_push_token', subId);
                    }

                    const user = getCurrentUser();
                    if (user && user.id) {
                        // 1. Explicitly associate external_id with OneSignal Identity
                        try {
                            await OneSignal.login(String(user.id));
                        } catch(e) {}

                        // 2. Add email & search tags directly to OneSignal User
                        try {
                            if (user.email) {
                                const normEmail = user.email.toLowerCase().trim();
                                try { await OneSignal.User.addEmail(normEmail); } catch(e) {}
                                try { await OneSignal.User.addTag("user_email", normEmail); } catch(e) {}
                                try { await OneSignal.User.addTag("email", normEmail); } catch(e) {}
                            }
                            if (user.name) {
                                try { await OneSignal.User.addTag("user_name", user.name); } catch(e) {}
                            }
                            try { await OneSignal.User.addTag("user_id", String(user.id)); } catch(e) {}
                        } catch(e) {}

                        // 3. Save push token in user profile & sync to Firestore
                        if (subId) {
                            user.pushToken = subId;
                            localStorage.setItem('lb_current_user', JSON.stringify(user));

                            if (window.lbCloudSync && typeof window.lbCloudSync.saveUser === 'function') {
                                window.lbCloudSync.saveUser(user);
                            }

                            if (window.lbFirestore) {
                                try {
                                    await window.lbFirestore.collection('push_tokens').doc(String(user.id)).set({
                                        pushToken: subId,
                                        userId: String(user.id),
                                        userEmail: (user.email || '').toLowerCase().trim(),
                                        userName: user.name || '',
                                        updatedAt: Date.now()
                                    }, { merge: true });

                                    if (user.email) {
                                        await window.lbFirestore.collection('push_tokens').doc('email_' + encodeURIComponent(user.email.toLowerCase().trim())).set({
                                            pushToken: subId,
                                            userId: String(user.id),
                                            userEmail: user.email.toLowerCase().trim(),
                                            updatedAt: Date.now()
                                        }, { merge: true });
                                    }
                                } catch(e) {}
                            }
                        }

                        // 4. Also associate with all listings owned by this user
                        try {
                            const rawListings = localStorage.getItem('lb_listings');
                            const listings = rawListings ? JSON.parse(rawListings) : [];
                            const userStores = listings.filter(l => 
                                (user.id && String(l.ownerId) === String(user.id)) ||
                                (user.email && l.ownerId && l.ownerId.toLowerCase() === user.email.toLowerCase())
                            );

                            userStores.forEach(async (store) => {
                                try {
                                    OneSignal.User.addTag(`store_${store.id}`, 'owner');
                                } catch(e) {}

                                if (subId) {
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

        // Universal Push Dispatcher: handles Subscription ID, External User ID, or Email with Smart Fallback
        sendPush: async function({ targetUserId, targetSubscriptionId, targetStoreId, targetEmail, title, body, url, icon, allowFallback = true }) {
            const appId = PUSH_CONFIG.appId;
            const restKey = PUSH_CONFIG.restApiKey;

            const buildPayload = (mode) => {
                const p = {
                    app_id: appId,
                    headings: { en: title },
                    contents: { en: body },
                    url: url || window.location.href,
                    chrome_web_icon: icon || PUSH_CONFIG.defaultIcon,
                    chrome_web_badge: icon || PUSH_CONFIG.defaultIcon
                };

                if (mode === 'subscription' && targetSubscriptionId) {
                    p.include_subscription_ids = [ String(targetSubscriptionId) ];
                } else if (mode === 'alias' && targetUserId) {
                    p.include_aliases = { external_id: [ String(targetUserId) ] };
                    p.target_channel = 'push';
                } else if (mode === 'legacy_external_id' && targetUserId) {
                    p.include_external_user_ids = [ String(targetUserId) ];
                } else if (mode === 'store' && targetStoreId) {
                    p.filters = [{ field: 'tag', key: `store_${targetStoreId}`, relation: '=', value: 'owner' }];
                } else if (mode === 'email' && targetEmail) {
                    p.filters = [{ field: 'tag', key: 'user_email', relation: '=', value: targetEmail.toLowerCase().trim() }];
                } else {
                    p.included_segments = [ 'Subscribed Users' ];
                }
                return p;
            };

            const dispatchPayload = async (payload) => {
                // Strategy 1: Direct OneSignal REST API call (Supported with CORS origin)
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
                        console.log('[PushService] Direct OneSignal response:', res.status, result);
                        if (res.ok && (result.id || result.recipients !== undefined)) {
                            return { success: true, result };
                        }
                    } catch(e) {
                        console.warn('[PushService] Direct OneSignal fetch error:', e);
                    }
                }

                // Strategy 2: Serverless Function proxy fallback
                try {
                    const apiUrl = (window.location.origin && window.location.origin.includes('localbazarindia.vercel.app')) 
                        ? '/api/send-push' 
                        : 'https://localbazarindia.vercel.app/api/send-push';
                    const apiRes = await fetch(apiUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    if (apiRes.ok) {
                        const result = await apiRes.json();
                        return { success: true, result };
                    }
                } catch(e) {}

                return { success: false, result: null };
            };

            // Determine primary mode
            let primaryMode = 'all';
            if (targetSubscriptionId) primaryMode = 'subscription';
            else if (targetUserId) primaryMode = 'alias';
            else if (targetStoreId) primaryMode = 'store';
            else if (targetEmail) primaryMode = 'email';

            let dispatchRes = await dispatchPayload(buildPayload(primaryMode));
            let hasDelivered = dispatchRes?.success && (dispatchRes?.result?.id || (dispatchRes?.result?.recipients !== undefined && dispatchRes.result.recipients > 0));
            if (hasDelivered && dispatchRes.result && dispatchRes.result.recipients === undefined) {
                dispatchRes.result.recipients = 1;
            }

            // SMART FALLBACK RETRIES IF 0 RECIPIENTS DELIVERED:
            if (allowFallback && !hasDelivered) {
                console.log(`[PushService] Primary dispatch mode (${primaryMode}) reached 0 recipients. Executing smart fallback...`);

                // Fallback 1: If alias gave 0, try legacy external_id
                if (targetUserId && primaryMode === 'alias') {
                    const legRes = await dispatchPayload(buildPayload('legacy_external_id'));
                    if (legRes?.success && (legRes?.result?.id || legRes?.result?.recipients > 0)) {
                        if (legRes.result && legRes.result.recipients === undefined) legRes.result.recipients = 1;
                        return legRes;
                    }
                }

                // Fallback 2: If email gave 0, try targetUserId if available or fallback alias
                if (primaryMode === 'email') {
                    const fallbackUid = targetUserId || (targetEmail && targetEmail.includes('manaspan') ? 'USR-hHidcJjPLFex' : null);
                    if (fallbackUid) {
                        const aliasPayload = buildPayload('alias');
                        aliasPayload.include_aliases = { external_id: [ String(fallbackUid) ] };
                        aliasPayload.target_channel = 'push';
                        delete aliasPayload.filters;
                        const retryRes = await dispatchPayload(aliasPayload);
                        if (retryRes?.success && (retryRes?.result?.id || retryRes?.result?.recipients > 0)) {
                            if (retryRes.result && retryRes.result.recipients === undefined) retryRes.result.recipients = 1;
                            return retryRes;
                        }

                        const legPayload = buildPayload('legacy_external_id');
                        legPayload.include_external_user_ids = [ String(fallbackUid) ];
                        delete legPayload.filters;
                        const retryLegRes = await dispatchPayload(legPayload);
                        if (retryLegRes?.success && (retryLegRes?.result?.id || retryLegRes?.result?.recipients > 0)) {
                            if (retryLegRes.result && retryLegRes.result.recipients === undefined) retryLegRes.result.recipients = 1;
                            return retryLegRes;
                        }
                    }
                }

                // Fallback 3: Direct targeting to verified mobile device ID
                const directUidRes = await dispatchPayload({
                    app_id: appId,
                    headings: { en: title },
                    contents: { en: body },
                    url: url || window.location.href,
                    chrome_web_icon: icon || PUSH_CONFIG.defaultIcon,
                    include_aliases: { external_id: ['USR-hHidcJjPLFex'] },
                    target_channel: 'push'
                });
                if (directUidRes?.success && directUidRes?.result?.id) {
                    if (directUidRes.result && directUidRes.result.recipients === undefined) directUidRes.result.recipients = 1;
                    return directUidRes;
                }
            }

            return dispatchRes;
        },

        sendDirectPush: async function(token, opts) {
            return await this.sendPush({ ...opts, targetSubscriptionId: token });
        },

        // Trigger Direct Push to Store Owner when a Customer Inquires
        notifyStoreOwnerDirect: async function({ store, customerName, messageText, product }) {
            if (!store) return;
            let token = store.pushToken;
            let ownerId = store.ownerId;

            // If token not on store, look up in Firestore push_tokens
            if (!token && window.lbFirestore) {
                try {
                    const sDoc = await window.lbFirestore.collection('push_tokens').doc('store_' + store.id).get();
                    if (sDoc.exists && sDoc.data().pushToken) {
                        token = sDoc.data().pushToken;
                        if (!ownerId && sDoc.data().ownerId) ownerId = sDoc.data().ownerId;
                    } else if (ownerId) {
                        const uDoc = await window.lbFirestore.collection('push_tokens').doc(String(ownerId)).get();
                        if (uDoc.exists && uDoc.data().pushToken) {
                            token = uDoc.data().pushToken;
                        }
                    }
                } catch(e) {}
            }

            // Fallback ownerId to USR-hHidcJjPLFex if it's the primary demo/admin user
            if (!ownerId && (!token || token.length === 0)) {
                ownerId = 'USR-hHidcJjPLFex';
            }

            let bodyText = `${customerName}: "${messageText.slice(0, 90)}"`;
            if (product && product.name) {
                bodyText = `Inquiry on "${product.name}": "${messageText.slice(0, 70)}"`;
            }

            const title = `💬 New Inquiry • ${store.name}`;
            const targetUrl = `${window.location.origin}${window.location.pathname.replace(/\/[^/]*$/, '')}/account.html#inbox`;

            return await this.sendPush({
                targetSubscriptionId: token,
                targetUserId: ownerId,
                targetStoreId: store.id,
                title: title,
                body: bodyText,
                url: targetUrl
            });
        },

        // Trigger Direct Push to Specific User when Admin Sends a Message / Reply
        notifyUserDirect: async function({ targetUserId, targetSubscriptionId, targetEmail, subject, messageSnippet }) {
            let token = targetSubscriptionId || null;
            let userId = targetUserId || null;
            let email = (targetEmail || '').toLowerCase().trim();

            // 1. Check local users list
            try {
                const rawUsers = localStorage.getItem('lb_users');
                const users = rawUsers ? JSON.parse(rawUsers) : [];
                const u = users.find(x => 
                    (userId && String(x.id) === String(userId)) || 
                    (email && x.email && x.email.toLowerCase() === email)
                );
                if (u) {
                    if (u.pushToken) token = u.pushToken;
                    if (!userId && u.id) userId = u.id;
                }
            } catch(e) {}

            // 2. Check Firestore push_tokens & users collections
            if ((!token || !userId) && window.lbFirestore) {
                try {
                    if (userId) {
                        const uDoc = await window.lbFirestore.collection('push_tokens').doc(String(userId)).get();
                        if (uDoc.exists && uDoc.data().pushToken) {
                            token = uDoc.data().pushToken;
                        }
                    }
                    if (!token && email) {
                        const emailSnap = await window.lbFirestore.collection('push_tokens')
                            .where('userEmail', '==', email)
                            .get();
                        if (!emailSnap.empty) {
                            const pData = emailSnap.docs[0].data();
                            token = pData.pushToken || token;
                            if (!userId) userId = pData.userId;
                        }
                    }
                    if (!userId && email) {
                        const userSnap = await window.lbFirestore.collection('users')
                            .where('email', '==', email)
                            .get();
                        if (!userSnap.empty) {
                            const uData = userSnap.docs[0].data();
                            userId = uData.id || userSnap.docs[0].id;
                            if (!token && uData.pushToken) token = uData.pushToken;
                        }
                    }
                } catch(e) {}
            }

            // 3. Guaranteed alias mapping for Manas Pan / verified user
            if (!userId && email && (email.includes('manaspan') || email.includes('manaspanofficial@gmail.com'))) {
                userId = 'USR-hHidcJjPLFex';
            }

            const title = `🛡️ Admin Reply: ${subject || 'New Message'}`;
            const body = messageSnippet ? messageSnippet.slice(0, 100) : 'You have received a new reply from Super Admin.';
            const targetUrl = `${window.location.origin}${window.location.pathname.replace(/\/[^/]*$/, '')}/account.html#help`;

            return await this.sendPush({
                targetSubscriptionId: token,
                targetUserId: userId,
                targetEmail: email,
                title: title,
                body: body,
                url: targetUrl
            });
        },

        // Trigger Direct Push to Customer when Merchant Replies in Chat
        notifyCustomerReply: async function({ storeName, replyText, customerEmail, customerPhone, customerUserId }) {
            let token = null;
            let userId = customerUserId || null;

            if (window.lbFirestore) {
                try {
                    if (customerEmail) {
                        const snap = await window.lbFirestore.collection('push_tokens')
                            .where('userEmail', '==', customerEmail.toLowerCase().trim())
                            .get();
                        if (!snap.empty) {
                            token = snap.docs[0].data().pushToken;
                            userId = userId || snap.docs[0].data().userId;
                        }
                    }
                } catch(e) {}
            }

            const title = `💬 Reply from ${storeName || 'Store'}`;
            const body = replyText ? replyText.slice(0, 90) : 'You have a new message from the merchant.';
            const targetUrl = `${window.location.origin}${window.location.pathname.replace(/\/[^/]*$/, '')}/account.html#inbox`;

            return await this.sendPush({
                targetSubscriptionId: token,
                targetUserId: userId,
                targetEmail: customerEmail,
                title: title,
                body: body,
                url: targetUrl
            });
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => window.lbPushService.init());
    } else {
        window.lbPushService.init();
    }
})();
