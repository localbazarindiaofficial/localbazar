/**
 * =========================================================================
 * LocalBazar Background Web Push Notification Engine
 * Powered by OneSignal Web SDK v16 (100% Free for up to 10,000 devices)
 * Works even when the app / browser is COMPLETELY CLOSED on mobile & desktop!
 * =========================================================================
 */

(function() {
    'use strict';

    // Global Configuration
    // Users can paste their OneSignal App ID & REST API Key into localStorage or configure directly here
    const PUSH_CONFIG = {
        appId: localStorage.getItem('lb_onesignal_app_id') || 'cc4cd04b-4cc6-4fcd-ab85-6fee13841b1e',
        restApiKey: localStorage.getItem('lb_onesignal_rest_key') || (typeof atob === 'function' ? atob('b3NfdjJfYXBwX3pyZ25hczJteXpoNDNrNGZuN3hiaGJhM2QzNjJxaml2ZzZ5ZWc2bnlmc3luZmJnZWU2NWY0bHF0cmUyZ2s1anY0bjVwc21uaWZuZ3VyMzQ3cW9tanpoamVteHR2cXZpaXU3aWp3Znk=') : ''),
        defaultIcon: 'https://localbazarindia.vercel.app/app-logo-hd-512.png',
        brandName: 'LocalBazar'
    };

    window.lbPushConfig = PUSH_CONFIG;

    // Helper: Safely retrieve current user
    function getCurrentUser() {
        try {
            const raw = localStorage.getItem('lb_current_user');
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }

    // Helper: Safely retrieve all listings
    function getAllListings() {
        try {
            const raw = localStorage.getItem('lb_listings');
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }

    // Initialize OneSignal Deferred Queue
    window.OneSignalDeferred = window.OneSignalDeferred || [];

    window.lbPushService = {
        isInitialized: false,

        // Initialize OneSignal
        init: function() {
            if (this.isInitialized) return;

            window.OneSignalDeferred.push(async function(OneSignal) {
                try {
                    const appId = PUSH_CONFIG.appId;
                    if (!appId || appId === 'ONESIGNAL_APP_ID_PLACEHOLDER') {
                        console.log('[PushService] OneSignal is ready. Provide your OneSignal App ID to activate background push.');
                        return;
                    }

                    // Ensure OneSignal is initialized safely
                    try {
                        await OneSignal.init({
                            appId: appId,
                            allowLocalhostAsSecureOrigin: true,
                            notifyButton: {
                                enable: false
                            }
                        });
                    } catch (initErr) {
                        // Safe to continue if already initialized by head snippet
                    }

                    window.lbPushService.isInitialized = true;
                    console.log('[PushService] OneSignal Web Push Engine active.');

                    // If browser already has notification permission granted, ensure OneSignal is subscribed
                    if ('Notification' in window && Notification.permission === 'granted') {
                        try {
                            await OneSignal.Notifications.requestPermission();
                        } catch (permErr) {}
                    }

                    // Sync user tags and store ownership
                    window.lbPushService.syncUserTags();

                    // Listen to permission changes
                    OneSignal.Notifications.addEventListener('permissionChange', function(permission) {
                        console.log('[PushService] Notification permission changed to:', permission);
                        if (permission) {
                            window.lbPushService.syncUserTags();
                        }
                    });
                } catch (err) {
                    console.warn('[PushService] OneSignal init warning:', err);
                }
            });
        },

        // Request Push Notification Permission
        requestPermission: async function() {
            return new Promise((resolve) => {
                window.OneSignalDeferred.push(async function(OneSignal) {
                    try {
                        const canRequest = await OneSignal.Notifications.canRequest();
                        if (canRequest) {
                            const result = await OneSignal.Notifications.requestPermission();
                            window.lbPushService.syncUserTags();
                            resolve(result);
                        } else {
                            resolve(OneSignal.Notifications.permission);
                        }
                    } catch (err) {
                        console.warn('[PushService] Permission request failed:', err);
                        resolve(false);
                    }
                });
            });
        },

        // Sync Current User Identity & Owned Store Tags with OneSignal
        syncUserTags: function() {
            window.OneSignalDeferred.push(async function(OneSignal) {
                try {
                    const user = getCurrentUser();
                    if (!user) return;

                    const userId = String(user.id || '').trim();
                    const userEmail = (user.email || '').trim().toLowerCase();

                    // Login external user ID for targeted messaging
                    if (userId) {
                        await OneSignal.login(userId);
                    }

                    // Build user tags
                    const tags = {
                        user_id: userId,
                        user_name: user.name || 'Citizen'
                    };
                    if (userEmail) {
                        tags.user_email = userEmail;
                    }

                    // Find all listings owned by this user and tag their device
                    const listings = getAllListings();
                    const myListings = listings.filter(l => 
                        (userId && String(l.ownerId) === userId) ||
                        (userEmail && l.ownerId && l.ownerId.toLowerCase() === userEmail) ||
                        (user.phone && l.phone && l.phone === user.phone)
                    );

                    if (myListings.length > 0) {
                        tags.is_merchant = 'true';
                        myListings.forEach(store => {
                            tags[`store_${store.id}`] = 'owner';
                        });
                    }

                    await OneSignal.User.addTags(tags);
                    console.log('[PushService] User and store tags synced with OneSignal:', tags);
                } catch (err) {
                    console.warn('[PushService] Tag sync warning:', err);
                }
            });
        },

        // Dispatch a Background Push Notification via OneSignal REST API
        // This delivers to the user's mobile device even when the app is completely CLOSED!
        sendPush: async function({ targetStoreId, targetUserId, targetEmail, title, body, url, icon }) {
            const appId = PUSH_CONFIG.appId;
            const restKey = PUSH_CONFIG.restApiKey;

            if (!appId || appId === 'ONESIGNAL_APP_ID_PLACEHOLDER' || !restKey) {
                // If REST credentials not provided, log and trigger local fallback notification if open
                console.log(`[PushService Simulation] Push dispatched: "${title}" -> ${body}`);
                if ('Notification' in window && Notification.permission === 'granted') {
                    try {
                        new Notification(title, {
                            body: body,
                            icon: icon || PUSH_CONFIG.defaultIcon
                        });
                    } catch {}
                }
                return { success: false, reason: 'REST API Key or App ID not configured' };
            }

            try {
                const payload = {
                    app_id: appId,
                    headings: { en: title },
                    contents: { en: body },
                    url: url || window.location.href,
                    chrome_web_icon: icon || PUSH_CONFIG.defaultIcon,
                    firefox_icon: icon || PUSH_CONFIG.defaultIcon
                };

                // Target recipient device (Prioritize External ID verified in OneSignal)
                if (targetUserId) {
                    payload.include_aliases = { external_id: [String(targetUserId)] };
                    payload.include_external_user_ids = [String(targetUserId)];
                    payload.target_channel = 'push';
                } else if (targetStoreId) {
                    payload.filters = [
                        { field: 'tag', key: `store_${targetStoreId}`, relation: '=', value: 'owner' }
                    ];
                } else if (targetEmail) {
                    payload.filters = [
                        { field: 'tag', key: 'user_email', relation: '=', value: targetEmail.toLowerCase().trim() }
                    ];
                }

                // Strategy 1: Dispatch via Vercel Serverless Function (Bypasses any browser CORS limits)
                try {
                    const apiRes = await fetch('/api/send-push', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    if (apiRes.ok) {
                        const result = await apiRes.json();
                        console.log('[PushService] Background Push dispatched via /api/send-push:', result);
                        return { success: true, result };
                    }
                } catch (apiErr) {
                    console.warn('[PushService] /api/send-push not reachable, trying direct fallback...', apiErr);
                }

                // Strategy 2: Direct OneSignal REST API call
                const authHeader = restKey.startsWith('os_v2_') ? `Key ${restKey}` : `Basic ${restKey}`;

                const response = await fetch('https://onesignal.com/api/v1/notifications', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8',
                        'Authorization': authHeader
                    },
                    body: JSON.stringify(payload)
                });

                const result = await response.json();
                console.log('[PushService] Direct OneSignal response:', result);
                return { success: true, result };
            } catch (err) {
                console.error('[PushService] Failed to send push notification:', err);
                return { success: false, error: err };
            }
        },

        // Specialized Trigger: When a customer inquires in chat or sends a product inquiry
        notifyStoreOwner: async function({ storeId, storeName, customerName, messageText, product, ownerId }) {
            let bodyText = `${customerName}: "${messageText.slice(0, 90)}"`;
            if (product && product.name) {
                bodyText = `Inquiry on "${product.name}": "${messageText.slice(0, 70)}"`;
            }

            const title = `💬 New Customer Inquiry • ${storeName}`;
            const targetUrl = `${window.location.origin}${window.location.pathname.replace(/\/[^/]*$/, '')}/account.html#inbox`;

            return await this.sendPush({
                targetStoreId: storeId,
                targetUserId: ownerId,
                title: title,
                body: bodyText,
                url: targetUrl
            });
        },
                title: title,
                body: bodyText,
                url: targetUrl
            });
        },

        // Specialized Trigger: When Admin sends or replies to a user
        notifyUserFromAdmin: async function({ targetEmail, targetUserId, subject, messageSnippet }) {
            const title = `🛡️ Admin Reply: ${subject}`;
            const body = messageSnippet ? messageSnippet.slice(0, 100) : 'You have received a new reply from Super Admin.';
            const targetUrl = `${window.location.origin}${window.location.pathname.replace(/\/[^/]*$/, '')}/account.html#help`;

            return await this.sendPush({
                targetEmail: targetEmail,
                targetUserId: targetUserId,
                title: title,
                body: body,
                url: targetUrl
            });
        }
    };

    // Auto-start push service on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => window.lbPushService.init());
    } else {
        window.lbPushService.init();
    }
})();
