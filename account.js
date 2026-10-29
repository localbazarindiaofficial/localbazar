// Account Hub Management, Screen Routing & Sub-modules Engine

/**
 * High-Quality Client-Side Image Compressor & Free Cloud CDN Uploader
 */
function compressFileImage(file, maxKB = 260, maxDimension = 1280) {
    if (window.uploadImageToCloud) {
        return window.uploadImageToCloud(file, maxKB, maxDimension);
    }
    return new Promise((resolve, reject) => {
        if (!file || !file.type || !file.type.startsWith('image/')) return reject(new Error('Not an image file'));
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = function(e) {
            const img = new Image();
            img.onerror = reject;
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

                let quality = 0.84;
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

document.addEventListener('DOMContentLoaded', () => {
    let currentUser = null;
    var firstUnreadStoreId = null;
    try {
        const raw = localStorage.getItem('lb_current_user');
        if (raw) currentUser = JSON.parse(raw);
        // Automatically purge old demo user
        if (currentUser && (currentUser.name === 'Sourav Das' || (currentUser.email && currentUser.email.includes('sourav.das')))) {
            localStorage.removeItem('lb_current_user');
            currentUser = null;
        }
    } catch {
        currentUser = null;
    }

    if (!currentUser) {
        window.location.href = 'auth.html';
        return;
    }

    // Initialize Theme
    const savedTheme = localStorage.getItem('lb_theme') || 'light';
    applyTheme(savedTheme);

    // Auto-sync any user listings to Firestore and react to cloud updates
    window.addEventListener('lb:cloud-synced', () => {
        if (typeof renderUserManageListings === 'function') {
            renderUserManageListings();
        }
    });

    setTimeout(() => {
        if (currentUser && window.lbCloudSync && typeof window.lbCloudSync.saveListing === 'function') {
            try {
                const raw = localStorage.getItem('lb_listings');
                const listings = raw ? JSON.parse(raw) : [];
                const userOwned = listings.filter(l => 
                    (currentUser.id && String(l.ownerId) === String(currentUser.id)) || 
                    (currentUser.email && l.ownerId && l.ownerId.toLowerCase() === currentUser.email.toLowerCase())
                );
                userOwned.forEach(l => window.lbCloudSync.saveListing(l));
            } catch (e) {}
        }
    }, 1200);

    // Populate Main Menu Profile Header
    function populateMainHeader() {
        const avatarImg = document.getElementById('userHubAvatar');
        const nameEl = document.getElementById('userHubName');
        const emailEl = document.getElementById('userHubEmail');
        const authBadge = document.getElementById('userAuthBadge');
        const memberSinceEl = document.getElementById('userHubMemberSince');

        if (avatarImg) avatarImg.src = currentUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&auto=format&fit=crop&q=80';
        if (nameEl) nameEl.textContent = currentUser.name || 'Local Citizen';
        if (emailEl) emailEl.textContent = currentUser.email || 'Email: Not added';
        
        if (memberSinceEl) {
            memberSinceEl.innerHTML = `<i class="fa-regular fa-calendar-check"></i> Member Since ${currentUser.memberSince || 'Today'}`;
        }

        if (authBadge) {
            if (currentUser.method === 'Facebook') {
                authBadge.innerHTML = '<i class="fa-brands fa-facebook" style="color:#1877F2;"></i>';
            } else {
                authBadge.innerHTML = '<i class="fa-brands fa-google" style="color:#4285F4;"></i>';
            }
        }

        // Sync Saved Places Badge Count
        const savedPlacesBadge = document.getElementById('hubSavedPlacesCountBadge');
        if (savedPlacesBadge) {
            let savedCount = 0;
            try {
                const raw = localStorage.getItem('lb_saved_places');
                savedCount = raw ? JSON.parse(raw).length : (currentUser.savedPlaces || 0);
            } catch {}
            savedPlacesBadge.textContent = savedCount;
        }

        // Sync Claim Requests Badge Count
        const claimBadge = document.getElementById('hubClaimBadge');
        if (claimBadge && currentUser) {
            try {
                const rawClaims = localStorage.getItem('lb_listing_claims');
                const claims = rawClaims ? JSON.parse(rawClaims) : [];
                const userClaims = claims.filter(c => String(c.userId) === String(currentUser.id) || (currentUser.email && c.userEmail && c.userEmail.toLowerCase() === currentUser.email.toLowerCase()));
                if (userClaims.length > 0) {
                    claimBadge.style.display = 'inline-block';
                    claimBadge.textContent = userClaims.length;
                } else {
                    claimBadge.style.display = 'none';
                }
            } catch {}
        }

        // Check Merchant Customer Inquiries & Show Live Alert Banner
        try {
            checkMerchantUnreadInquiries();
        } catch (err) {
            console.warn('checkMerchantUnreadInquiries error:', err);
        }
    }

    populateMainHeader();

    // ================= SCREEN SWITCHER =================
    window.switchAccountScreen = function(screenId) {
        document.querySelectorAll('.account-view-screen').forEach(el => {
            el.classList.remove('active');
            el.style.display = 'none';
        });

        const target = document.getElementById(screenId);
        const card = document.querySelector('.account-hub-card');

        if (card) {
            // Expand card cleanly for wide views like Add Listing or Manage Listings
            if (screenId === 'viewAddListing' || screenId === 'viewManageListings') {
                card.classList.add('expanded-mode');
            } else {
                card.classList.remove('expanded-mode');
            }
        }

        if (target) {
            target.classList.add('active');
            target.style.display = (screenId === 'viewBusinessDashboard' && window.innerWidth >= 769) ? 'flex' : 'block';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        // Handle navigation modal stack for hardware/browser back
        if (screenId !== 'viewMainMenu') {
            if (window.lbPushModal) window.lbPushModal('accountSubScreen', () => window.switchAccountScreen('viewMainMenu'));
        } else {
            if (window.lbPopModal) window.lbPopModal('accountSubScreen');
        }

        // Screen-specific triggers
        if (screenId === 'viewAccount') {
            loadAccountForm();
        } else if (screenId === 'viewAddListing') {
            loadUserCategories();
            // If opening Add Listing freshly (not editing), ensure completely fresh empty form
            const editingId = document.getElementById('uEditingListingId')?.value || '';
            if (!editingId) {
                resetAddListingForm();
            }
        } else if (screenId === 'viewManageListings') {
            renderUserManageListings();
        } else if (screenId === 'viewSavedPlaces') {
            renderUserSavedPlaces();
        } else if (screenId === 'viewClaimListing') {
            if (typeof initClaimListingForm === 'function') initClaimListingForm();
            if (typeof renderClaimHistory === 'function') renderClaimHistory();
        } else if (screenId === 'viewTrustBadge') {
            if (typeof initTrustBadgeView === 'function') initTrustBadgeView();
            if (typeof renderTrustBadgeStatusView === 'function') renderTrustBadgeStatusView();
        } else if (screenId === 'viewMerchantInbox') {
            if (typeof initUnifiedMerchantInbox === 'function') initUnifiedMerchantInbox();
        }
    };

    // Helper: Handle Back / Cancel navigation from Add/Edit Listing Form
    window.handleListingFormBack = function() {
        const editingId = document.getElementById('uEditingListingId')?.value || '';
        resetAddListingForm();
        if (editingId) {
            // Came from Manage Listings (Editing)
            switchAccountScreen('viewManageListings');
        } else {
            // Came from Main Menu (Add Listing)
            switchAccountScreen('viewMainMenu');
        }
    };

    // Populate Category Dropdown dynamically from Admin-created categories
    function loadUserCategories() {
        const catSelect = document.getElementById('uFullListingCategory');
        if (!catSelect) return;
        try {
            const rawCategories = localStorage.getItem('lb_categories');
            const categories = rawCategories ? JSON.parse(rawCategories) : [];
            const currentVal = catSelect.value;
            catSelect.innerHTML = '<option value="">Select Category</option>' + categories.map(cat => 
                `<option value="${cat.name}">${cat.name}</option>`
            ).join('');
            if (currentVal && categories.some(cat => cat.name === currentVal)) {
                catSelect.value = currentVal;
            }
        } catch (err) {
            console.error('Failed to load categories', err);
        }
    }
    loadUserCategories();

    // ================= 1. ACCOUNT PROFILE MODULE =================
    function loadAccountForm() {
        document.getElementById('accName').value = currentUser.name || '';
        document.getElementById('accGender').value = currentUser.gender || '';
        document.getElementById('accDob').value = currentUser.dob || '';
        document.getElementById('accCity').value = currentUser.city || '';
        document.getElementById('accState').value = currentUser.state || '';
        document.getElementById('accPincode').value = currentUser.pincode || '';
        document.getElementById('accEmail').value = currentUser.email || '';
        document.getElementById('accPhone').value = currentUser.phone || '';
        document.getElementById('accMemberSince').value = currentUser.memberSince || new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    document.getElementById('userAccountDetailsForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('accName').value.trim();
        const gender = document.getElementById('accGender').value;
        const dob = document.getElementById('accDob').value;
        const city = document.getElementById('accCity').value.trim();
        const state = document.getElementById('accState').value.trim();
        const pincode = document.getElementById('accPincode').value.trim();
        const email = document.getElementById('accEmail').value.trim();
        const phone = document.getElementById('accPhone').value.trim();

        // Update currentUser
        currentUser.name = name;
        currentUser.gender = gender;
        currentUser.dob = dob;
        currentUser.city = city;
        currentUser.state = state;
        currentUser.pincode = pincode;
        currentUser.email = email;
        currentUser.phone = phone;

        localStorage.setItem('lb_current_user', JSON.stringify(currentUser));

        // Sync with admin DB
        try {
            const rawUsers = localStorage.getItem('lb_users');
            const users = rawUsers ? JSON.parse(rawUsers) : [];
            const idx = users.findIndex(u => u.id === currentUser.id || (u.email && u.email.toLowerCase() === email.toLowerCase()));
            if (idx !== -1) {
                users[idx].name = name;
                users[idx].gender = gender;
                users[idx].dob = dob;
                users[idx].city = city;
                users[idx].state = state;
                users[idx].pincode = pincode;
                users[idx].email = email;
                users[idx].phone = phone;
                localStorage.setItem('lb_users', JSON.stringify(users));
            }
        } catch {}

        populateMainHeader();
        alert('Success! Your account details have been updated.');
        switchAccountScreen('viewMainMenu');
    });

    // ================= 2. HELP & SUPPORT (SEND MAIL TO ADMIN WITH ATTACHMENT) =================
    const helpAttachTrigger = document.getElementById('userHelpAttachTrigger');
    const helpAttachInput = document.getElementById('userHelpAttachInput');
    const helpAttachPreview = document.getElementById('userHelpAttachPreview');
    const helpAttachFileName = document.getElementById('userHelpAttachFileName');
    const helpAttachSize = document.getElementById('userHelpAttachSize');
    const helpAttachIcon = document.getElementById('userHelpAttachIcon');
    const helpAttachData = document.getElementById('userHelpAttachData');
    const helpAttachName = document.getElementById('userHelpAttachName');
    const removeAttachBtn = document.getElementById('userRemoveAttachBtn');

    if (helpAttachTrigger && helpAttachInput) {
        helpAttachTrigger.addEventListener('click', () => helpAttachInput.click());

        helpAttachInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Enforce max 5MB
            if (file.size > 5 * 1024 * 1024) {
                alert('File size exceeds 5MB limit. Please select a file under 5MB.');
                helpAttachInput.value = '';
                return;
            }

            const fileName = file.name;
            const isImage = file.type.startsWith('image/');

            if (helpAttachFileName) helpAttachFileName.textContent = fileName;
            if (helpAttachIcon) helpAttachIcon.className = isImage ? 'fa-solid fa-file-image' : 'fa-solid fa-file-lines';
            if (helpAttachSize) helpAttachSize.textContent = 'Optimizing...';
            if (helpAttachPreview) helpAttachPreview.style.display = 'flex';
            if (helpAttachTrigger) helpAttachTrigger.style.display = 'none';

            if (isImage) {
                try {
                    const compressed = await compressFileImage(file, 280, 1600);
                    const approxKB = Math.round((compressed.length * 3) / 4 / 1024);
                    if (helpAttachSize) helpAttachSize.textContent = `${approxKB} KB`;
                    if (helpAttachData) helpAttachData.value = compressed;
                    if (helpAttachName) helpAttachName.value = `${fileName} (${approxKB} KB)`;
                } catch {
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                        const kb = Math.round(file.size / 1024);
                        if (helpAttachSize) helpAttachSize.textContent = `${kb} KB`;
                        if (helpAttachData) helpAttachData.value = evt.target.result;
                        if (helpAttachName) helpAttachName.value = fileName;
                    };
                    reader.readAsDataURL(file);
                }
            } else {
                const reader = new FileReader();
                reader.onload = (evt) => {
                    const kb = Math.round(file.size / 1024);
                    if (helpAttachSize) helpAttachSize.textContent = `${kb} KB`;
                    if (helpAttachData) helpAttachData.value = evt.target.result;
                    if (helpAttachName) helpAttachName.value = fileName;
                };
                reader.readAsDataURL(file);
            }
        });

        removeAttachBtn?.addEventListener('click', () => {
            if (helpAttachInput) helpAttachInput.value = '';
            if (helpAttachData) helpAttachData.value = '';
            if (helpAttachName) helpAttachName.value = '';
            if (helpAttachPreview) helpAttachPreview.style.display = 'none';
            if (helpAttachTrigger) helpAttachTrigger.style.display = 'flex';
        });
    }

    document.getElementById('userMailToAdminForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const subject = document.getElementById('helpSubject').value.trim();
        const message = document.getElementById('helpMessage').value.trim();
        const attachData = document.getElementById('userHelpAttachData')?.value || '';
        const attachName = document.getElementById('userHelpAttachName')?.value || '';
        const attachSize = document.getElementById('userHelpAttachSize')?.textContent || '';

        // Save into Admin Mailbox (`lb_mail`) as an Inbox entry
        try {
            const rawMail = localStorage.getItem('lb_mail');
            const mail = rawMail ? JSON.parse(rawMail) : [];

            const mailItem = {
                id: 'ML-' + Date.now(),
                from: currentUser.email || currentUser.name || 'Platform User',
                to: 'Super Admin',
                subject: subject,
                body: message,
                type: 'inbox',
                read: false,
                attachment: attachData ? { data: attachData, name: attachName, size: attachSize } : null,
                date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            };

            mail.unshift(mailItem);
            localStorage.setItem('lb_mail', JSON.stringify(mail));

            if (window.lbCloudSync && typeof window.lbCloudSync.saveMail === 'function') {
                window.lbCloudSync.saveMail(mailItem);
            }
        } catch (err) {
            console.error('Mail error:', err);
        }

        document.getElementById('userMailToAdminForm').reset();
        removeAttachBtn?.click();
        alert('Thank you! Your message with attachments has been sent directly to the Super Admin Mailbox.');
        switchAccountScreen('viewMainMenu');
    });

    // ================= 3. SETTINGS MODULE (THEME & NOTIFICATIONS) =================
    window.setUserTheme = function(theme) {
        applyTheme(theme);
        localStorage.setItem('lb_theme', theme);
    };

    function applyTheme(theme) {
        const btnLight = document.getElementById('btnThemeLight');
        const btnDark = document.getElementById('btnThemeDark');

        if (theme === 'dark') {
            document.body.classList.add('dark-mode');
            btnDark?.classList.add('active');
            btnLight?.classList.remove('active');
        } else {
            document.body.classList.remove('dark-mode');
            btnLight?.classList.add('active');
            btnDark?.classList.remove('active');
        }
    }

    // ================= 4. USER PUSH NOTIFICATIONS ENGINE =================
    function getUserNotifPrefs() {
        try {
            const raw = localStorage.getItem('lb_user_notif_prefs');
            return raw ? JSON.parse(raw) : { inquiries: true, claims: true, promotions: true, admin: true };
        } catch {
            return { inquiries: true, claims: true, promotions: true, admin: true };
        }
    }

    window.saveNotificationSettings = function() {
        const settings = {
            inquiries: document.getElementById('notifyInquiries')?.checked ?? true,
            claims: document.getElementById('notifyClaims')?.checked ?? true,
            promotions: document.getElementById('notifyPromotions')?.checked ?? true,
            admin: document.getElementById('notifyAdmin')?.checked ?? true
        };
        localStorage.setItem('lb_user_notif_prefs', JSON.stringify(settings));
    };

    function loadNotificationSettings() {
        const prefs = getUserNotifPrefs();
        if (document.getElementById('notifyInquiries')) document.getElementById('notifyInquiries').checked = Boolean(prefs.inquiries);
        if (document.getElementById('notifyClaims')) document.getElementById('notifyClaims').checked = Boolean(prefs.claims);
        if (document.getElementById('notifyPromotions')) document.getElementById('notifyPromotions').checked = Boolean(prefs.promotions);
        if (document.getElementById('notifyAdmin')) document.getElementById('notifyAdmin').checked = Boolean(prefs.admin);
    }

    function updateUserNotifPermStatusDisplay() {
        const statusEl = document.getElementById('userNotifPermStatus');
        const btnEl = document.getElementById('btnEnableUserPushNotifs');
        const bannerEl = document.getElementById('userNotifPromptBanner');

        if (!('Notification' in window)) {
            if (statusEl) statusEl.textContent = 'Not supported on this browser';
            if (btnEl) btnEl.style.display = 'none';
            if (bannerEl) bannerEl.style.display = 'none';
            return;
        }

        const isDismissed = sessionStorage.getItem('lb_user_notif_banner_dismissed') === 'true';

        if (Notification.permission === 'granted') {
            if (statusEl) statusEl.innerHTML = `<span style="color:#059669; font-weight:700;"><i class="fa-solid fa-circle-check"></i> Enabled & Active</span>`;
            if (btnEl) {
                btnEl.textContent = 'Notifications Allowed';
                btnEl.style.background = '#059669';
                btnEl.disabled = true;
                btnEl.style.cursor = 'default';
            }
            if (bannerEl) bannerEl.style.display = 'none';
        } else if (Notification.permission === 'denied') {
            if (statusEl) statusEl.innerHTML = `<span style="color:#ef4444; font-weight:700;"><i class="fa-solid fa-circle-xmark"></i> Blocked by Browser</span>`;
            if (btnEl) {
                btnEl.textContent = 'Permission Blocked';
                btnEl.style.background = '#94a3b8';
            }
            if (bannerEl) bannerEl.style.display = 'none';
        } else {
            if (statusEl) statusEl.textContent = 'Status: Not enabled yet';
            if (btnEl) {
                btnEl.textContent = 'Enable Push Notifications';
                btnEl.style.background = '#2563eb';
                btnEl.disabled = false;
                btnEl.style.cursor = 'pointer';
            }
            if (bannerEl && !isDismissed) {
                bannerEl.style.display = 'flex';
            }
        }
    }

    window.dismissUserNotifBanner = function() {
        sessionStorage.setItem('lb_user_notif_banner_dismissed', 'true');
        const bannerEl = document.getElementById('userNotifPromptBanner');
        if (bannerEl) bannerEl.style.display = 'none';
    };

    window.requestUserPushPermission = function() {
        if (!('Notification' in window)) {
            alert('Push notifications are not supported on this browser.');
            return;
        }

        Notification.requestPermission().then(permission => {
            updateUserNotifPermStatusDisplay();
            if (permission === 'granted') {
                window.sendUserPushNotification(
                    'Push Notifications Enabled!',
                    'You will now receive instant push alerts for store inquiries, business claim updates, and local offers.',
                    'system'
                );
            } else if (permission === 'denied') {
                alert('Notifications were blocked. You can enable them anytime from your browser address bar settings.');
            }
        });
    };

    window.sendUserPushNotification = function(title, body, type = 'general', actionUrl = '#') {
        const prefs = getUserNotifPrefs();
        if (type === 'inquiry' && !prefs.inquiries) return;
        if (type === 'claim' && !prefs.claims) return;
        if (type === 'promotion' && !prefs.promotions) return;
        if (type === 'admin' && !prefs.admin) return;

        // 1. Native Desktop / Mobile Browser Notification
        if ('Notification' in window && Notification.permission === 'granted') {
            try {
                const notif = new Notification(title, {
                    body: body,
                    icon: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=120',
                    tag: 'lb_usr_' + type + '_' + Date.now()
                });
                notif.onclick = function() {
                    window.focus();
                    if (actionUrl && actionUrl !== '#') window.location.href = actionUrl;
                    notif.close();
                };
            } catch (err) {
                console.warn('User notification error:', err);
            }
        }

        // 2. In-App Floating Toast
        showUserPushToast(title, body, type);
    };

    function showUserPushToast(title, body, type) {
        let container = document.getElementById('userPushToastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'userPushToastContainer';
            container.className = 'admin-push-toast-container';
            document.body.appendChild(container);
        }

        let iconClass = 'fa-solid fa-bell';
        let typeClass = '';
        if (type === 'claim') {
            iconClass = 'fa-solid fa-file-circle-check';
            typeClass = 'claim-toast';
        } else if (type === 'inquiry') {
            iconClass = 'fa-solid fa-comments';
            typeClass = 'inquiry-toast';
        } else if (type === 'promotion') {
            iconClass = 'fa-solid fa-bag-shopping';
            typeClass = 'listing-toast';
        }

        const toast = document.createElement('div');
        toast.className = `admin-push-toast ${typeClass}`;
        toast.innerHTML = `
            <div class="admin-push-toast-icon"><i class="${iconClass}"></i></div>
            <div class="admin-push-toast-body">
                <div class="admin-push-toast-title">${title}</div>
                <div class="admin-push-toast-msg">${body}</div>
            </div>
            <button type="button" class="admin-push-toast-close" title="Dismiss">&times;</button>
        `;

        toast.querySelector('.admin-push-toast-close').addEventListener('click', () => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(110%)';
            setTimeout(() => toast.remove(), 250);
        });

        container.appendChild(toast);

        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(110%)';
                setTimeout(() => toast.remove(), 250);
            }
        }, 6000);
    }

    window.testUserPushNotification = function() {
        if ('Notification' in window && Notification.permission !== 'granted') {
            window.requestUserPushPermission();
            return;
        }
        window.sendUserPushNotification(
            'Test Push Alert: LocalBazar Active',
            'Your device is connected to receive real-time push alerts from LocalBazar!',
            'system'
        );
    };

    loadNotificationSettings();
    updateUserNotifPermStatusDisplay();

    // ================= USER REAL-TIME ACTIVITY LISTENER =================
    window.addEventListener('storage', (e) => {
        if (!e.key) return;

        // 1. Claim status updated by Admin
        if (e.key === 'lb_listing_claims' && e.newValue) {
            try {
                const updatedClaims = JSON.parse(e.newValue);
                const currentSessionUser = window.lbCurrentUser || {};
                const userClaims = updatedClaims.filter(c => 
                    (c.claimantEmail && currentSessionUser.email && c.claimantEmail.toLowerCase() === currentSessionUser.email.toLowerCase()) ||
                    (c.claimantId && currentSessionUser.id && String(c.claimantId) === String(currentSessionUser.id))
                );

                if (userClaims.length > 0) {
                    const latest = userClaims[0];
                    if (latest.status === 'Approved') {
                        window.sendUserPushNotification(
                            'Business Claim Approved! 🎉',
                            `Congratulations! Your claim for "${latest.businessName}" has been approved by admin. You can now manage your business.`,
                            'claim',
                            '#viewManageBusiness'
                        );
                    } else if (latest.status === 'Rejected') {
                        window.sendUserPushNotification(
                            'Claim Request Update',
                            `Your claim for "${latest.businessName}" was reviewed. Admin note: "${latest.adminReply || 'Documents need verification'}"`,
                            'claim',
                            '#viewMyClaims'
                        );
                    } else if (latest.adminReply) {
                        window.sendUserPushNotification(
                            'Admin Response Received',
                            `New message regarding your claim for "${latest.businessName}": ${latest.adminReply}`,
                            'admin',
                            '#viewMyClaims'
                        );
                    }
                }
            } catch (err) {}
        }

        // 2. Customer sent inquiry to merchant's store
        if (e.key === 'lb_notifications' && e.newValue) {
            try {
                const notifs = JSON.parse(e.newValue);
                const latest = notifs[0];
                const currentSessionUser = window.lbCurrentUser || {};
                const allListings = JSON.parse(localStorage.getItem('lb_listings') || '[]');
                const owned = allListings.find(l => String(l.id) === String(latest?.storeId) && (l.ownerEmail === currentSessionUser.email || l.ownerId === currentSessionUser.id));

                if (owned) {
                    window.sendUserPushNotification(
                        'New Customer Message! 💬',
                        `${latest.senderName || 'A customer'} sent a query for "${latest.product || owned.title || 'your store'}".`,
                        'inquiry',
                        `store-category.html?id=${encodeURIComponent(owned.id)}`
                    );
                }
            } catch (err) {}
        }
    });

    // ================= 5. USER ADD LISTING MODULE (Identical to Admin Enterprise Engine) =================
    // A. Top Listing Cover / Profile Picture
    const uImgDropzone = document.getElementById('uImgDropzone');
    const uListingImageInput = document.getElementById('uListingImageInput');
    const uImageUploadPreview = document.getElementById('uImageUploadPreview');
    const uDropzoneContent = document.getElementById('uDropzoneContent');
    const uPhotoOverlayEdit = document.getElementById('uPhotoOverlayEdit');
    const uUploadedImageData = document.getElementById('uUploadedImageData');

    if (uImgDropzone && uListingImageInput) {
        uImgDropzone.addEventListener('click', () => uListingImageInput.click());

        uListingImageInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const browseBtn = uImgDropzone.querySelector('.btn-browse-photo');
            const origHtml = browseBtn ? browseBtn.innerHTML : '';
            if (browseBtn) browseBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Optimizing...';

            try {
                const compressed = await compressFileImage(file, 480, 1920);
                if (uImageUploadPreview) {
                    uImageUploadPreview.src = compressed;
                    uImageUploadPreview.style.display = 'block';
                }
                if (uDropzoneContent) uDropzoneContent.style.display = 'none';
                if (uPhotoOverlayEdit) uPhotoOverlayEdit.style.display = 'flex';
                if (uUploadedImageData) uUploadedImageData.value = compressed;
            } catch {
                const reader = new FileReader();
                reader.onload = (evt) => {
                    if (uImageUploadPreview) {
                        uImageUploadPreview.src = evt.target.result;
                        uImageUploadPreview.style.display = 'block';
                    }
                    if (uDropzoneContent) uDropzoneContent.style.display = 'none';
                    if (uPhotoOverlayEdit) uPhotoOverlayEdit.style.display = 'flex';
                    if (uUploadedImageData) uUploadedImageData.value = evt.target.result;
                };
                reader.readAsDataURL(file);
            } finally {
                if (browseBtn) browseBtn.innerHTML = origHtml;
            }
        });
    }

    // ---------------- Autocomplete City Suggestions for Add Listing ----------------
    function initUserCityAutocomplete() {
        const uCityInputEl = document.getElementById('uFullListingCity');
        const uCityDropdownEl = document.getElementById('uCitySuggestionsDropdown');
        if (!uCityInputEl || !uCityDropdownEl) return;

        function updateCitySuggestions() {
            const val = uCityInputEl.value.trim().toLowerCase();
            let cities = [];
            try {
                const raw = localStorage.getItem('lb_cities');
                cities = raw ? JSON.parse(raw) : [];
            } catch (err) {}

            if (!val) {
                uCityDropdownEl.classList.remove('open');
                uCityDropdownEl.innerHTML = '';
                return;
            }

            // Only suggest cities whose name starts with the typed letters (prefix search)
            const matches = cities.filter(c => {
                const name = (c.name || '').toLowerCase();
                return name.startsWith(val);
            });

            if (matches.length === 0) {
                uCityDropdownEl.classList.remove('open');
                uCityDropdownEl.innerHTML = '';
                return;
            }

            uCityDropdownEl.innerHTML = matches.map(c => `
                <div class="city-suggestion-item" data-city-name="${c.name}">
                    <div class="sugg-city-info">
                        <span class="sugg-city-name">
                            <i class="fa-solid fa-location-dot" style="color:#ef4444; font-size:0.85rem;"></i>
                            ${c.name}
                        </span>
                        <div class="sugg-city-details">
                            ${c.district ? `<span>District: <strong>${c.district}</strong></span> • ` : ''}
                            <span>${c.state ? c.state : 'Active Hub'}</span>
                            ${c.pincode ? ` • <span class="sugg-pin-badge">PIN: ${c.pincode}</span>` : ''}
                        </div>
                    </div>
                    <span class="sugg-select-hint"><i class="fa-solid fa-arrow-turn-down-left"></i> Select</span>
                </div>
            `).join('');

            uCityDropdownEl.classList.add('open');

            uCityDropdownEl.querySelectorAll('.city-suggestion-item').forEach(item => {
                item.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const chosen = item.getAttribute('data-city-name');
                    uCityInputEl.value = chosen;
                    uCityDropdownEl.classList.remove('open');
                    uCityDropdownEl.innerHTML = '';
                });
            });
        }

        uCityInputEl.addEventListener('input', updateCitySuggestions);
        uCityInputEl.addEventListener('focus', updateCitySuggestions);
        uCityInputEl.addEventListener('keyup', updateCitySuggestions);

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!uCityInputEl.contains(e.target) && !uCityDropdownEl.contains(e.target)) {
                uCityDropdownEl.classList.remove('open');
            }
        });
    }
    initUserCityAutocomplete();

    // ---------------- Autocomplete City Suggestions for Merchant Portal Edit Profile ----------------
    function initPortalCityAutocomplete() {
        const mCityInputEl = document.getElementById('mInputBizCity');
        const mCityDropdownEl = document.getElementById('mCitySuggestionsDropdown');
        if (!mCityInputEl || !mCityDropdownEl) return;

        function updatePortalCitySuggestions() {
            const val = mCityInputEl.value.trim().toLowerCase();
            let cities = [];
            try {
                const raw = localStorage.getItem('lb_cities');
                cities = raw ? JSON.parse(raw) : [];
            } catch (err) {}

            if (!val) {
                mCityDropdownEl.classList.remove('open');
                mCityDropdownEl.innerHTML = '';
                return;
            }

            // Exact Prefix Search: Only cities that start with the typed letters (case-insensitive)
            const matches = cities.filter(c => {
                const name = (c.name || '').trim().toLowerCase();
                return name.startsWith(val);
            });

            if (matches.length === 0) {
                mCityDropdownEl.classList.remove('open');
                mCityDropdownEl.innerHTML = '';
                return;
            }

            // Highlighting prefix letters professionally
            mCityDropdownEl.innerHTML = matches.map(c => {
                const cName = c.name || '';
                const matchPart = cName.slice(0, val.length);
                const restPart = cName.slice(val.length);

                return `
                <div class="city-suggestion-item" data-city-name="${cName}">
                    <div class="sugg-city-info">
                        <span class="sugg-city-name">
                            <i class="fa-solid fa-location-dot" style="color:#ef4444; font-size:0.85rem;"></i>
                            <strong style="color:#2563eb;">${matchPart}</strong>${restPart}
                        </span>
                        <div class="sugg-city-details">
                            ${c.district ? `<span>District: <strong>${c.district}</strong></span> • ` : ''}
                            <span>${c.state ? c.state : 'Active Hub'}</span>
                            ${c.pincode ? ` • <span class="sugg-pin-badge">PIN: ${c.pincode}</span>` : ''}
                        </div>
                    </div>
                    <span class="sugg-select-hint"><i class="fa-solid fa-arrow-turn-down-left"></i> Select</span>
                </div>
                `;
            }).join('');

            mCityDropdownEl.classList.add('open');

            mCityDropdownEl.querySelectorAll('.city-suggestion-item').forEach(item => {
                item.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const chosen = item.getAttribute('data-city-name');
                    mCityInputEl.value = chosen;
                    mCityDropdownEl.classList.remove('open');
                    mCityDropdownEl.innerHTML = '';
                });
            });
        }

        mCityInputEl.addEventListener('input', updatePortalCitySuggestions);
        mCityInputEl.addEventListener('focus', updatePortalCitySuggestions);
        mCityInputEl.addEventListener('keyup', updatePortalCitySuggestions);

        document.addEventListener('click', (e) => {
            if (!mCityInputEl.contains(e.target) && !mCityDropdownEl.contains(e.target)) {
                mCityDropdownEl.classList.remove('open');
            }
        });
    }
    initPortalCityAutocomplete();

    // B. Daily Operating Schedule Matrix (Individual Open/Close Times for Each Day)
    const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const uDailyScheduleMatrix = document.getElementById('uDailyScheduleMatrix');

    // Default daily schedule structure
    let dailyScheduleData = {
        'Monday':    { isOpen: true,  openTime: '09:00', openAmPm: 'AM', closeTime: '08:30', closeAmPm: 'PM' },
        'Tuesday':   { isOpen: true,  openTime: '09:00', openAmPm: 'AM', closeTime: '08:30', closeAmPm: 'PM' },
        'Wednesday': { isOpen: true,  openTime: '09:00', openAmPm: 'AM', closeTime: '08:30', closeAmPm: 'PM' },
        'Thursday':  { isOpen: true,  openTime: '09:00', openAmPm: 'AM', closeTime: '08:30', closeAmPm: 'PM' },
        'Friday':    { isOpen: true,  openTime: '09:00', openAmPm: 'AM', closeTime: '08:30', closeAmPm: 'PM' },
        'Saturday':  { isOpen: true,  openTime: '09:00', openAmPm: 'AM', closeTime: '08:30', closeAmPm: 'PM' },
        'Sunday':    { isOpen: false, openTime: '09:00', openAmPm: 'AM', closeTime: '08:30', closeAmPm: 'PM' }
    };

    function renderDailyScheduleMatrix() {
        if (!uDailyScheduleMatrix) return;

        uDailyScheduleMatrix.innerHTML = `
            <div class="matrix-quick-actions">
                <span class="matrix-tip"><i class="fa-solid fa-wand-magic-sparkles text-amber"></i> Quick Tip: Customize each day's exact timings or toggle Closed.</span>
                <button type="button" class="btn-copy-timings" id="btnApplyAllDays" title="Apply Monday timings to all open days">
                    <i class="fa-solid fa-copy"></i> Apply Mon Times to All Days
                </button>
            </div>
            <div class="matrix-rows-wrap">
                ${DAYS_OF_WEEK.map(day => {
                    const d = dailyScheduleData[day] || { isOpen: true, openTime: '09:00', openAmPm: 'AM', closeTime: '08:30', closeAmPm: 'PM' };
                    return `
                        <div class="matrix-day-row ${d.isOpen ? 'is-open' : 'is-closed'}" id="matrixRow_${day}">
                            <!-- Left: Day & Toggle Switch -->
                            <div class="matrix-day-info">
                                <label class="day-toggle-switch">
                                    <input type="checkbox" class="chk-day-open" data-day="${day}" ${d.isOpen ? 'checked' : ''} onchange="handleDayToggle('${day}', this.checked)">
                                    <span class="slider round"></span>
                                </label>
                                <span class="matrix-day-name">${day}</span>
                                <span class="matrix-status-tag ${d.isOpen ? 'tag-open' : 'tag-closed'}" id="matrixTag_${day}">${d.isOpen ? 'Open' : 'Closed'}</span>
                            </div>

                            <!-- Right: Daily Time Controls (Enabled if Open, Disabled if Closed) -->
                            <div class="matrix-times-box" id="matrixTimesBox_${day}" style="${d.isOpen ? '' : 'opacity:0.4; pointer-events:none;'}">
                                <div class="matrix-time-input-wrap">
                                    <span class="time-lbl">Open:</span>
                                    <div class="time-ampm-row">
                                        <input type="text" class="inp-open-val" data-day="${day}" value="${d.openTime}" maxlength="5" onchange="handleDailyTimeChange('${day}', 'openTime', this.value)">
                                        <select class="sel-open-ampm" data-day="${day}" onchange="handleDailyTimeChange('${day}', 'openAmPm', this.value)">
                                            <option value="AM" ${d.openAmPm === 'AM' ? 'selected' : ''}>AM</option>
                                            <option value="PM" ${d.openAmPm === 'PM' ? 'selected' : ''}>PM</option>
                                        </select>
                                    </div>
                                </div>
                                <span class="matrix-time-sep">—</span>
                                <div class="matrix-time-input-wrap">
                                    <span class="time-lbl">Close:</span>
                                    <div class="time-ampm-row">
                                        <input type="text" class="inp-close-val" data-day="${day}" value="${d.closeTime}" maxlength="5" onchange="handleDailyTimeChange('${day}', 'closeTime', this.value)">
                                        <select class="sel-close-ampm" data-day="${day}" onchange="handleDailyTimeChange('${day}', 'closeAmPm', this.value)">
                                            <option value="PM" ${d.closeAmPm === 'PM' ? 'selected' : ''}>PM</option>
                                            <option value="AM" ${d.closeAmPm === 'AM' ? 'selected' : ''}>AM</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        document.getElementById('btnApplyAllDays')?.addEventListener('click', applyMondayTimeToAll);
    }

    window.handleDayToggle = function(day, isOpen) {
        if (!dailyScheduleData[day]) dailyScheduleData[day] = {};
        dailyScheduleData[day].isOpen = isOpen;

        const row = document.getElementById(`matrixRow_${day}`);
        const tag = document.getElementById(`matrixTag_${day}`);
        const timesBox = document.getElementById(`matrixTimesBox_${day}`);

        if (row) {
            row.classList.toggle('is-open', isOpen);
            row.classList.toggle('is-closed', !isOpen);
        }
        if (tag) {
            tag.textContent = isOpen ? 'Open' : 'Closed';
            tag.className = `matrix-status-tag ${isOpen ? 'tag-open' : 'tag-closed'}`;
        }
        if (timesBox) {
            timesBox.style.opacity = isOpen ? '1' : '0.4';
            timesBox.style.pointerEvents = isOpen ? 'auto' : 'none';
        }
    };

    window.handleDailyTimeChange = function(day, field, val) {
        if (!dailyScheduleData[day]) dailyScheduleData[day] = {};
        dailyScheduleData[day][field] = val;
    };

    function applyMondayTimeToAll() {
        const mon = dailyScheduleData['Monday'] || { openTime: '09:00', openAmPm: 'AM', closeTime: '08:30', closeAmPm: 'PM' };
        DAYS_OF_WEEK.forEach(day => {
            if (day !== 'Monday' && dailyScheduleData[day]?.isOpen) {
                dailyScheduleData[day].openTime = mon.openTime;
                dailyScheduleData[day].openAmPm = mon.openAmPm;
                dailyScheduleData[day].closeTime = mon.closeTime;
                dailyScheduleData[day].closeAmPm = mon.closeAmPm;
            }
        });
        renderDailyScheduleMatrix();
    }

    renderDailyScheduleMatrix();

    // C. Holiday Multi-Select Calendar
    const uHolidayTriggerBtn = document.getElementById('uHolidayTriggerBtn');
    const uCalendarPopover = document.getElementById('uCalendarPopover');
    const uCalMonthTitle = document.getElementById('uCalMonthTitle');
    const uCalendarDaysGrid = document.getElementById('uCalendarDaysGrid');
    const uCalSelectedCountText = document.getElementById('uCalSelectedCountText');
    const uHolidaySummaryDisplay = document.getElementById('uHolidaySummaryDisplay');
    const uCalendarDoneBtn = document.getElementById('uCalendarDoneBtn');
    const uPrevMonthBtn = document.getElementById('uPrevMonthBtn');
    const uNextMonthBtn = document.getElementById('uNextMonthBtn');

    let uCalCurrentDate = new Date();
    const uSelectedHolidaysSet = new Set();

    if (uHolidayTriggerBtn && uCalendarPopover) {
        uHolidayTriggerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            uCalendarPopover.classList.toggle('open');
            renderUCalendar();
        });

        uCalendarPopover.addEventListener('click', (e) => e.stopPropagation());
        document.addEventListener('click', () => uCalendarPopover.classList.remove('open'));

        uCalendarDoneBtn?.addEventListener('click', () => {
            uCalendarPopover.classList.remove('open');
            updateUHolidaySummary();
        });

        uPrevMonthBtn?.addEventListener('click', () => {
            uCalCurrentDate.setMonth(uCalCurrentDate.getMonth() - 1);
            renderUCalendar();
        });

        uNextMonthBtn?.addEventListener('click', () => {
            uCalCurrentDate.setMonth(uCalCurrentDate.getMonth() + 1);
            renderUCalendar();
        });
    }

    function renderUCalendar() {
        if (!uCalendarDaysGrid || !uCalMonthTitle) return;
        const year = uCalCurrentDate.getFullYear();
        const month = uCalCurrentDate.getMonth();

        uCalMonthTitle.textContent = uCalCurrentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        uCalendarDaysGrid.innerHTML = '';

        const firstDayIdx = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        for (let i = 0; i < firstDayIdx; i++) {
            const blank = document.createElement('div');
            blank.className = 'cal-day-cell empty';
            uCalendarDaysGrid.appendChild(blank);
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const cell = document.createElement('div');
            cell.className = 'cal-day-cell';
            cell.textContent = d;

            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            if (uSelectedHolidaysSet.has(dateStr)) {
                cell.classList.add('selected');
            }

            cell.addEventListener('click', () => {
                if (uSelectedHolidaysSet.has(dateStr)) {
                    uSelectedHolidaysSet.delete(dateStr);
                    cell.classList.remove('selected');
                } else {
                    uSelectedHolidaysSet.add(dateStr);
                    cell.classList.add('selected');
                }
                if (uCalSelectedCountText) uCalSelectedCountText.textContent = `${uSelectedHolidaysSet.size} selected`;
            });

            uCalendarDaysGrid.appendChild(cell);
        }
        if (uCalSelectedCountText) uCalSelectedCountText.textContent = `${uSelectedHolidaysSet.size} selected`;
    }

    function updateUHolidaySummary() {
        if (uHolidaySummaryDisplay) {
            const count = uSelectedHolidaysSet.size;
            uHolidaySummaryDisplay.textContent = count === 0 ? '0 Holidays Selected' : `${count} Holiday${count > 1 ? 's' : ''} Selected`;
        }
    }

    // D. Dynamic Products & Services (3 Columns: Image, Name, Price)
    const uAddProductBtn = document.getElementById('uAddProductRowBtn');
    const uProductsContainer = document.getElementById('uProductsContainer');

    if (uAddProductBtn && uProductsContainer) {
        uAddProductBtn.addEventListener('click', () => {
            const row = document.createElement('div');
            row.className = 'product-item-row';
            row.innerHTML = `
                <div class="prod-img-box" onclick="this.querySelector('input[type=file]').click()" title="Click to upload item image">
                    <input type="file" class="prod-file-input" accept="image/*" style="display:none;" onchange="previewUserProductImg(this)">
                    <div class="prod-img-placeholder">
                        <i class="fa-solid fa-camera"></i>
                        <span>Image</span>
                    </div>
                    <img class="prod-img-preview" alt="Item preview" style="display:none;">
                </div>
                <input type="text" class="prod-name" placeholder="Item / Service Name (e.g. Biryani, Consultation, AC Repair)" required>
                <input type="text" class="prod-price" placeholder="Price (e.g. ₹250, Free, On Request)">
                <button type="button" class="btn-remove-row" onclick="this.parentElement.remove()" title="Remove"><i class="fa-solid fa-trash-can"></i></button>
            `;
            uProductsContainer.appendChild(row);
        });
    }

    window.previewUserProductImg = function(input) {
        const file = input.files[0];
        if (file) {
            const parent = input.parentElement;
            const placeholder = parent.querySelector('.prod-img-placeholder');
            const preview = parent.querySelector('.prod-img-preview');

            compressFileImage(file, 350, 1080)
                .then(compressedUrl => {
                    if (preview) {
                        preview.src = compressedUrl;
                        preview.style.display = 'block';
                    }
                    if (placeholder) placeholder.style.display = 'none';
                })
                .catch(() => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        if (preview) {
                            preview.src = e.target.result;
                            preview.style.display = 'block';
                        }
                        if (placeholder) placeholder.style.display = 'none';
                    };
                    reader.readAsDataURL(file);
                });
        }
    };

    // ================= PREMIUM MNC-STYLE NOTIFICATION MODAL ENGINE =================
    window.showLbAlert = function({ title, message, type = 'warning', buttonText = 'Understood', onConfirm = null }) {
        const overlay = document.getElementById('lbAlertOverlay');
        const iconWrap = document.getElementById('lbAlertIconWrap');
        const icon = document.getElementById('lbAlertIcon');
        const titleEl = document.getElementById('lbAlertTitle');
        const descEl = document.getElementById('lbAlertDesc');
        const okBtn = document.getElementById('lbAlertOkBtn');
        if (!overlay) {
            alert(message);
            if (onConfirm) onConfirm();
            return;
        }

        titleEl.textContent = title || 'Notification';
        descEl.innerHTML = message;
        okBtn.textContent = buttonText;

        // Reset classes
        iconWrap.className = 'lb-alert-icon-wrap ' + type;
        okBtn.className = 'btn-lb-alert-primary ' + type;

        if (type === 'warning') {
            icon.className = 'fa-solid fa-triangle-exclamation';
        } else if (type === 'error') {
            icon.className = 'fa-solid fa-circle-xmark';
        } else if (type === 'success') {
            icon.className = 'fa-solid fa-circle-check';
        } else {
            icon.className = 'fa-solid fa-circle-info';
        }

        window._lbAlertConfirmCb = onConfirm;
        overlay.style.display = 'flex';
    };

    window.closeLbAlert = function() {
        const overlay = document.getElementById('lbAlertOverlay');
        if (overlay) overlay.style.display = 'none';
        if (typeof window._lbAlertConfirmCb === 'function') {
            const cb = window._lbAlertConfirmCb;
            window._lbAlertConfirmCb = null;
            cb();
        }
    };

    // E. Save & Register Full Listing (Validates all required fields across all steps before registering)
    window.handleListingRegistrationSubmit = async function(e) {
        if (e && e.preventDefault) e.preventDefault();
        const name = document.getElementById('uFullListingName')?.value.trim();
        const category = document.getElementById('uFullListingCategory')?.value;
        const city = document.getElementById('uFullListingCity')?.value.trim();
        const phone = document.getElementById('uFullListingContact')?.value.trim();
        const address = document.getElementById('uFullListingAddress')?.value.trim();
        const mapLink = document.getElementById('uFullListingMapLink')?.value.trim() || '';
        const coverImage = document.getElementById('uUploadedImageData')?.value || '';

        // Comprehensive Validation Across All Stages with Premium Dialog
        if (!name || !category || !city || !phone) {
            showLbAlert({
                title: 'Missing Required Information',
                message: 'Please complete all required fields in <strong>Step 1: Basic & Photos</strong> (Business Name, Category, City, and Contact Phone Number).',
                type: 'warning',
                buttonText: 'Fill Step 1 Now',
                onConfirm: () => {
                    navigateListingStep(1);
                    setTimeout(() => {
                        if (!name) document.getElementById('uFullListingName')?.focus();
                        else if (!category) document.getElementById('uFullListingCategory')?.focus();
                        else if (!city) document.getElementById('uFullListingCity')?.focus();
                        else if (!phone) document.getElementById('uFullListingContact')?.focus();
                    }, 50);
                }
            });
            return;
        }

        if (!address) {
            showLbAlert({
                title: 'Address is Required',
                message: 'Please enter your complete physical shop or office address in <strong>Step 2: Address & Location</strong> before completing registration.',
                type: 'warning',
                buttonText: 'Add Address Now',
                onConfirm: () => {
                    navigateListingStep(2);
                    setTimeout(() => {
                        document.getElementById('uFullListingAddress')?.focus();
                    }, 50);
                }
            });
            return;
        }

        // Open Days & Daily Hours Matrix
        const openDays = DAYS_OF_WEEK.filter(day => dailyScheduleData[day]?.isOpen);
        if (openDays.length === 0) {
            showLbAlert({
                title: 'Opening Schedule Required',
                message: 'Please set your weekly schedule in <strong>Step 3: Operating Schedule</strong>. At least one day of the week must be marked as <strong>Open</strong>.',
                type: 'warning',
                buttonText: 'Configure Hours',
                onConfirm: () => {
                    navigateListingStep(3);
                }
            });
            return;
        }

        // Compute representative default timing (e.g. from Monday or first open day)
        const firstOpenDay = openDays[0];
        const defaultDayObj = dailyScheduleData[firstOpenDay] || { openTime: '09:00', openAmPm: 'AM', closeTime: '08:30', closeAmPm: 'PM' };
        const primaryScheduleTimings = `${defaultDayObj.openTime} ${defaultDayObj.openAmPm} - ${defaultDayObj.closeTime} ${defaultDayObj.closeAmPm}`;

        const holidays = Array.from(uSelectedHolidaysSet);
        const desc = document.getElementById('uFullListingDesc')?.value.trim() || '';

        // Products & Services
        const products = [];
        document.querySelectorAll('#uProductsContainer .product-item-row').forEach(row => {
            const pName = row.querySelector('.prod-name')?.value.trim();
            const pPrice = row.querySelector('.prod-price')?.value.trim();
            const pImg = row.querySelector('.prod-img-preview')?.src || '';
            if (pName) products.push({
                name: pName,
                price: pPrice || 'On Request',
                image: (pImg && (pImg.startsWith('data:image') || pImg.startsWith('http'))) ? pImg : ''
            });
        });

        // Doctor Chamber Data (if applicable)
        const doctors = [];
        if (isDoctorChamberApplicable) {
            document.querySelectorAll('#uDoctorsContainer .doctor-chamber-card').forEach(card => {
                const docName = card.querySelector('.doc-name')?.value.trim();
                const specialist = card.querySelector('.doc-specialist')?.value.trim();
                const days = card.querySelector('.doc-days')?.value.trim();
                const time = card.querySelector('.doc-time')?.value.trim();
                const fee = card.querySelector('.doc-fee')?.value.trim();
                if (docName) {
                    doctors.push({
                        name: docName,
                        specialist: specialist || 'General Physician',
                        days: days || 'Daily',
                        time: time || 'Evening',
                        fee: fee || 'Consultation fee on request'
                    });
                }
            });
        }

        const editingId = document.getElementById('uEditingListingId')?.value || '';

        // Insert or Update in localStorage
        try {
            const rawListings = localStorage.getItem('lb_listings');
            let listings = rawListings ? JSON.parse(rawListings) : [];

            let targetListingToSync = null;

            if (editingId) {
                // UPDATE EXISTING LISTING
                const index = listings.findIndex(l => String(l.id) === String(editingId));
                if (index !== -1) {
                    listings[index] = {
                        ...listings[index],
                        name,
                        category,
                        city,
                        phone,
                        address,
                        mapLink,
                        image: coverImage || listings[index].image,
                        gallery: uploadedImagesList.length > 0 ? uploadedImagesList : (listings[index].gallery || listings[index].images || [listings[index].image]),
                        images: uploadedImagesList.length > 0 ? uploadedImagesList : (listings[index].gallery || listings[index].images || [listings[index].image]),
                        openDays: openDays,
                        scheduleTimings: primaryScheduleTimings,
                        dailySchedule: dailyScheduleData,
                        holidays,
                        products: (products.length > 0) ? products : (listings[index].products || []),
                        doctors: doctors.length > 0 ? doctors : (listings[index].doctors || []),
                        desc,
                        lastUpdated: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    };
                    targetListingToSync = listings[index];
                }
            } else {
                // CREATE NEW LISTING -> Status: 'Pending' (Registered, but awaiting Admin approval before public visibility)
                const newListingEntry = {
                    id: 'LB-' + Math.floor(1000 + Math.random() * 9000),
                    name,
                    category,
                    city,
                    phone,
                    status: 'Pending',
                    address,
                    mapLink,
                    image: coverImage,
                    gallery: uploadedImagesList,
                    images: uploadedImagesList,
                    openDays: openDays,
                    scheduleTimings: primaryScheduleTimings,
                    dailySchedule: dailyScheduleData,
                    holidays,
                    products,
                    storeCategories: getDefaultStoreCategories(category),
                    doctors,
                    desc,
                    ownerId: currentUser.id || currentUser.email,
                    ownerName: currentUser.name || 'Member User',
                    date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                };
                listings.unshift(newListingEntry);
                targetListingToSync = newListingEntry;
            }

            localStorage.setItem('lb_listings', JSON.stringify(listings));

            // Sync to Firebase Cloud Firestore immediately so Super Admin receives the request
            if (targetListingToSync && window.lbCloudSync && typeof window.lbCloudSync.saveListing === 'function') {
                try {
                    await window.lbCloudSync.saveListing(targetListingToSync);
                    console.log(`[Account] Listing "${targetListingToSync.name}" (${targetListingToSync.id}) synced to Cloud Firestore.`);
                } catch (syncErr) {
                    console.warn('[Account] Cloud Firestore sync warning:', syncErr);
                }
            }

            // Auto add city
            const rawCities = localStorage.getItem('lb_cities');
            const cities = rawCities ? JSON.parse(rawCities) : [];
            if (!cities.some(c => c.name.toLowerCase() === city.toLowerCase())) {
                const newCityObj = { name: city, state: 'Active Hub' };
                cities.push(newCityObj);
                localStorage.setItem('lb_cities', JSON.stringify(cities));
                if (window.lbCloudSync && typeof window.lbCloudSync.saveCity === 'function') {
                    window.lbCloudSync.saveCity(newCityObj);
                }
            }
        } catch (err) {
            console.error(err);
        }

        // Reset Form
        resetAddListingForm();

        if (editingId) {
            showLbAlert({
                title: 'Listing Updated Successfully!',
                message: `<strong>"${name}"</strong> has been successfully updated in your merchant portal.`,
                type: 'success',
                buttonText: 'View Dashboard',
                onConfirm: () => {
                    renderUserManageListings();
                    switchAccountScreen('viewManageListings');
                }
            });
        } else {
            showLbAlert({
                title: 'Registration Successful!',
                message: `<strong>"${name}"</strong> is now securely registered! <br><br><span style="font-size:0.86rem; color:#64748b;"><i class="fa-solid fa-clock" style="color:#d97706;"></i> <strong>Status: Pending Verification</strong>. To ensure high quality, your listing will undergo rapid admin review before becoming publicly visible in search results.</span>`,
                type: 'success',
                buttonText: 'Go to Manage Business',
                onConfirm: () => {
                    renderUserManageListings();
                    switchAccountScreen('viewManageListings');
                }
            });
        }
    };

    document.getElementById('userAddListingForm')?.addEventListener('submit', window.handleListingRegistrationSubmit);

    // ================= CREATE MULTI-CITY BRANCH FLOW =================
    window.openCreateBranchFlow = function() {
        const modal = document.getElementById('createBranchModal');
        if (!modal) return;

        let user = null;
        try {
            const rawUser = localStorage.getItem('lb_current_user');
            user = rawUser ? JSON.parse(rawUser) : null;
        } catch {}

        if (!user) {
            showHubToast('Please login to create branch', 'warning');
            return;
        }

        let listings = [];
        try {
            const raw = localStorage.getItem('lb_listings');
            listings = raw ? JSON.parse(raw) : [];
        } catch {}

        // Match owned listings
        const owned = listings.filter(l => 
            (user.email && l.ownerEmail && l.ownerEmail.toLowerCase() === user.email.toLowerCase()) ||
            (user.phone && l.ownerPhone && l.ownerPhone === user.phone) ||
            (user.id && l.ownerId && l.ownerId === user.id) ||
            (l.claimedBy && l.claimedBy === user.email)
        );

        if (owned.length === 0) {
            showHubToast('Please register at least one main business before adding branches!', 'warning');
            return;
        }

        // Determine parent store automatically (prefer non-branch main store, then first owned)
        let parentStore = null;
        if (currentActiveBusinessId) {
            parentStore = owned.find(s => String(s.id) === String(currentActiveBusinessId));
        }
        if (!parentStore && owned.length > 0) {
            parentStore = owned.find(s => !s.isBranch) || owned[0];
        }

        const parentIdInput = document.getElementById('cbParentStoreId');
        if (parentIdInput && parentStore) {
            parentIdInput.value = parentStore.id;
        }

        // Reset city auto-suggest input and popover
        const cityInput = document.getElementById('cbBranchCityInput');
        if (cityInput) {
            cityInput.value = '';
            cityInput.setCustomValidity('');
        }
        const popover = document.getElementById('cbBranchCityPopover');
        if (popover) {
            popover.style.display = 'none';
            popover.innerHTML = '';
        }

        // Reset inputs & prefill phone from parent store
        const addr = document.getElementById('cbBranchAddress');
        if (addr) addr.value = '';
        const phone = document.getElementById('cbBranchPhone');
        if (phone) phone.value = parentStore ? (parentStore.phone || '') : '';
        const wa = document.getElementById('cbBranchWhatsapp');
        if (wa) wa.value = parentStore ? (parentStore.whatsapp || '') : '';
        const map = document.getElementById('cbBranchMapLink');
        if (map) map.value = '';

        modal.style.display = 'flex';
    };

    window.closeCreateBranchFlow = function() {
        const modal = document.getElementById('createBranchModal');
        if (modal) modal.style.display = 'none';
        const popover = document.getElementById('cbBranchCityPopover');
        if (popover) popover.style.display = 'none';
    };

    // City Auto-Suggest for Branch Creation (Reads strictly from Admin Cities)
    window.handleBranchCityInput = function(val) {
        const popover = document.getElementById('cbBranchCityPopover');
        const input = document.getElementById('cbBranchCityInput');
        if (!popover || !input) return;

        let cities = [];
        try {
            const rawCities = localStorage.getItem('lb_cities');
            cities = rawCities ? JSON.parse(rawCities) : [];
        } catch { cities = []; }

        const query = (val || '').trim().toLowerCase();

        let matches = [];
        if (!query) {
            matches = cities.slice(0, 8);
        } else {
            const prefixMatches = [];
            const otherMatches = [];

            cities.forEach(c => {
                const name = (typeof c === 'string' ? c : (c.name || '')).toLowerCase();
                const dist = (c.district || '').toLowerCase();
                const pin = (c.pincode || '').toString().toLowerCase();
                const state = (c.state || '').toLowerCase();

                if (name.startsWith(query)) {
                    prefixMatches.push(c);
                } else if (name.includes(query) || dist.startsWith(query) || dist.includes(query) || pin.startsWith(query) || state.includes(query)) {
                    otherMatches.push(c);
                }
            });

            matches = [...prefixMatches, ...otherMatches].slice(0, 8);
        }

        if (matches.length === 0) {
            popover.innerHTML = `<div style="padding:0.75rem 0.85rem; font-size:0.8rem; color:#94a3b8; text-align:center;"><i class="fa-solid fa-triangle-exclamation" style="margin-right:4px;"></i>No admin-approved city found matching "${query}".</div>`;
            popover.style.display = 'block';
            return;
        }

        popover.innerHTML = matches.map(c => {
            const name = typeof c === 'string' ? c : (c.name || '');
            const dist = typeof c === 'object' && c.district ? c.district : '';
            const pin = typeof c === 'object' && c.pincode ? c.pincode : '';
            return `
                <div class="omni-sugg-item" style="cursor:pointer; padding:0.55rem 0.75rem;" onclick="selectBranchCitySuggestion('${name.replace(/'/g, "\\'")}')">
                    <div class="omni-sugg-main">
                        <span class="omni-sugg-title">
                            <i class="fa-solid fa-location-dot omni-sugg-icon-city"></i>
                            ${name}
                        </span>
                        <div class="omni-sugg-meta">
                            ${dist ? `<span>District: <strong>${dist}</strong></span>` : ''}
                            ${pin ? `<span>• PIN: ${pin}</span>` : ''}
                        </div>
                    </div>
                    <span class="omni-sugg-action-arrow"><i class="fa-solid fa-arrow-turn-down-left"></i></span>
                </div>
            `;
        }).join('');

        popover.style.display = 'block';
    };

    window.selectBranchCitySuggestion = function(cityName) {
        const input = document.getElementById('cbBranchCityInput');
        const popover = document.getElementById('cbBranchCityPopover');
        if (input) {
            input.value = cityName;
            input.setCustomValidity('');
        }
        if (popover) {
            popover.style.display = 'none';
        }
    };

    // Close branch city popover when clicking outside
    document.addEventListener('click', (e) => {
        const popover = document.getElementById('cbBranchCityPopover');
        const input = document.getElementById('cbBranchCityInput');
        if (popover && input && !input.contains(e.target) && !popover.contains(e.target)) {
            popover.style.display = 'none';
        }
    });

    window.handleCreateBranchSubmit = async function(e) {
        if (e && e.preventDefault) e.preventDefault();

        let listings = [];
        try {
            const raw = localStorage.getItem('lb_listings');
            listings = raw ? JSON.parse(raw) : [];
        } catch {}

        let user = null;
        try {
            const rawUser = localStorage.getItem('lb_current_user');
            user = rawUser ? JSON.parse(rawUser) : null;
        } catch {}

        const owned = listings.filter(l => 
            (user && user.email && l.ownerEmail && l.ownerEmail.toLowerCase() === user.email.toLowerCase()) ||
            (user && user.phone && l.ownerPhone && l.ownerPhone === user.phone) ||
            (user && user.id && l.ownerId && l.ownerId === user.id) ||
            (user && l.claimedBy && l.claimedBy === user.email)
        );

        let parentId = document.getElementById('cbParentStoreId')?.value;
        let parentStore = owned.find(s => String(s.id).trim() === String(parentId).trim());
        if (!parentStore) {
            parentStore = owned.find(s => !s.isBranch) || owned[0];
            if (parentStore) parentId = parentStore.id;
        }

        if (!parentStore) {
            showHubToast('No main business found. Please register your store first.', 'error');
            return;
        }

        const cityRaw = document.getElementById('cbBranchCityInput')?.value?.trim();
        const address = document.getElementById('cbBranchAddress')?.value?.trim();
        const phone = document.getElementById('cbBranchPhone')?.value?.trim();
        const whatsapp = document.getElementById('cbBranchWhatsapp')?.value?.trim();
        const mapLink = document.getElementById('cbBranchMapLink')?.value?.trim();

        if (!cityRaw) {
            showHubToast('Please type and select an admin-approved city for this branch.', 'warning');
            document.getElementById('cbBranchCityInput')?.focus();
            return;
        }

        // Verify city against Admin-approved cities (lb_cities)
        let adminCities = [];
        try {
            const rawCities = localStorage.getItem('lb_cities');
            adminCities = rawCities ? JSON.parse(rawCities) : [];
        } catch { adminCities = []; }

        const matchedAdminCity = adminCities.find(c => {
            const name = (typeof c === 'string' ? c : (c.name || '')).trim().toLowerCase();
            return name === cityRaw.toLowerCase();
        });

        if (!matchedAdminCity && adminCities.length > 0) {
            showHubToast(`"${cityRaw}" is not an admin-approved city. Please select from the suggestions.`, 'warning');
            document.getElementById('cbBranchCityInput')?.focus();
            return;
        }

        const city = matchedAdminCity ? (typeof matchedAdminCity === 'string' ? matchedAdminCity.trim() : matchedAdminCity.name.trim()) : cityRaw;

        if (!address) {
            showHubToast('Please enter the branch full address.', 'warning');
            document.getElementById('cbBranchAddress')?.focus();
            return;
        }

        const branchListingId = 'lb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);

        // Deep copy catalog items, banners, schedule, images from parent
        const clonedProducts = Array.isArray(parentStore.products) 
            ? JSON.parse(JSON.stringify(parentStore.products)).map(p => ({
                ...p,
                id: 'prod_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
                listingId: branchListingId
            }))
            : [];

        const clonedCategories = Array.isArray(parentStore.customProductCategories)
            ? [...parentStore.customProductCategories]
            : [];

        const clonedGallery = Array.isArray(parentStore.galleryImages)
            ? [...parentStore.galleryImages]
            : [];

        const clonedBanners = Array.isArray(parentStore.banners)
            ? [...parentStore.banners]
            : [];

        const newBranchListing = {
            ...parentStore,
            id: branchListingId,
            name: parentStore.name,
            branchTitle: `${parentStore.name} (${city} Branch)`,
            city: city,
            address: address,
            phone: phone || parentStore.phone || '',
            whatsapp: whatsapp || parentStore.whatsapp || '',
            mapLink: mapLink || '',
            isBranch: true,
            parentStoreId: parentStore.id,
            parentStoreName: parentStore.name,
            products: clonedProducts,
            customProductCategories: clonedCategories,
            galleryImages: clonedGallery,
            banners: clonedBanners,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: parentStore.status || 'Verified',
            inbox: []
        };

        // Save to localStorage
        listings.unshift(newBranchListing);
        localStorage.setItem('lb_listings', JSON.stringify(listings));

        // Save to Cloud Firestore
        if (window.lbCloudSync && typeof window.lbCloudSync.saveListing === 'function') {
            try {
                await window.lbCloudSync.saveListing(newBranchListing);
            } catch (err) {
                console.warn('Cloud sync error saving branch:', err);
            }
        }

        closeCreateBranchFlow();
        showHubToast(`Branch created successfully for ${city}!`, 'success');

        // Re-render user listings
        if (typeof renderUserManageListings === 'function') {
            renderUserManageListings();
        }

        // Open merchant portal for this new branch immediately so user can view/edit all menus
        if (typeof openMerchantPortal === 'function') {
            setTimeout(() => {
                openMerchantPortal(branchListingId);
            }, 300);
        }
    };

    // ================= DYNAMIC MULTI-IMAGES & DOCTOR CHAMBER SYSTEM =================
    let uploadedImagesList = [];
    let isDoctorChamberApplicable = false;

    // A. Multiple Images Upload Handler & Compact Fixed Picker
    const multiImagesInput = document.getElementById('uMultiImagesInput');
    const multiImagesPreviewGrid = document.getElementById('uMultiImagesPreviewGrid');
    const uPhotoCountPill = document.getElementById('uPhotoCountPill');
    const uPhotoStatusSubText = document.getElementById('uPhotoStatusSubText');
    const uPhotoIconBadge = document.getElementById('uPhotoIconBadge');
    const uBtnTogglePreviewDrawer = document.getElementById('uBtnTogglePreviewDrawer');
    const uCompactPhotoDrawer = document.getElementById('uCompactPhotoDrawer');
    const uDrawerChevron = document.getElementById('uDrawerChevron');
    const uDrawerCountText = document.getElementById('uDrawerCountText');
    const uBtnChoosePhotos = document.getElementById('uBtnChoosePhotos');

    // Trigger file chooser
    uBtnChoosePhotos?.addEventListener('click', (e) => {
        e.stopPropagation();
        multiImagesInput?.click();
    });

    // Toggle Preview Drawer
    function togglePhotoPreviewDrawer(forceOpen) {
        if (!uCompactPhotoDrawer) return;
        const willOpen = typeof forceOpen === 'boolean' ? forceOpen : (uCompactPhotoDrawer.style.display === 'none');
        uCompactPhotoDrawer.style.display = willOpen ? 'block' : 'none';
        if (uDrawerChevron) {
            uDrawerChevron.classList.toggle('rotated', willOpen);
        }
    }

    uBtnTogglePreviewDrawer?.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePhotoPreviewDrawer();
    });

    function renderMultiImagesGrid() {
        const count = uploadedImagesList.length;

        // 1. Update Fixed Status Texts & Pills
        if (uPhotoCountPill) {
            uPhotoCountPill.textContent = `${count} ${count === 1 ? 'Photo' : 'Photos'} Selected`;
            uPhotoCountPill.classList.toggle('has-photos', count > 0);
        }

        if (uDrawerCountText) {
            uDrawerCountText.textContent = count.toString();
        }

        if (uPhotoIconBadge) {
            uPhotoIconBadge.classList.toggle('has-photos', count > 0);
            uPhotoIconBadge.innerHTML = count > 0 ? '<i class="fa-solid fa-check"></i>' : '<i class="fa-solid fa-camera"></i>';
        }

        if (uPhotoStatusSubText) {
            if (count === 0) {
                uPhotoStatusSubText.textContent = 'Click to select single or multiple photos';
            } else if (count === 1) {
                uPhotoStatusSubText.textContent = '1 photo attached (Cover photo ready)';
            } else {
                uPhotoStatusSubText.textContent = `${count} photos attached. 1st photo is Cover photo.`;
            }
        }

        // Show/hide "View Photos" button
        if (uBtnTogglePreviewDrawer) {
            uBtnTogglePreviewDrawer.style.display = count > 0 ? 'inline-flex' : 'none';
        }

        // If count becomes 0, close drawer
        if (count === 0 && uCompactPhotoDrawer) {
            uCompactPhotoDrawer.style.display = 'none';
            if (uDrawerChevron) uDrawerChevron.classList.remove('rotated');
        }

        // 2. Render Scrollable Drawer Thumbnails
        if (multiImagesPreviewGrid) {
            if (count === 0) {
                multiImagesPreviewGrid.innerHTML = '';
            } else {
                multiImagesPreviewGrid.innerHTML = uploadedImagesList.map((imgUrl, idx) => `
                    <div class="multi-img-item">
                        <img src="${imgUrl}" alt="Photo ${idx+1}" class="multi-img-thumb">
                        ${idx === 0 ? '<span class="primary-badge-tag">Cover</span>' : ''}
                        <button type="button" class="btn-remove-multi-img" onclick="removeMultiImage(${idx})" title="Remove photo">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                `).join('');
            }
        }

        // Keep first image as primary in hidden field
        if (uUploadedImageData) {
            uUploadedImageData.value = uploadedImagesList[0] || '';
        }
    }

    window.removeMultiImage = function(index) {
        uploadedImagesList.splice(index, 1);
        renderMultiImagesGrid();
    };

    multiImagesInput?.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        for (const file of files) {
            try {
                const compressed = await compressFileImage(file, 350, 1200);
                uploadedImagesList.push(compressed);
            } catch {
                const reader = new FileReader();
                reader.onload = (evt) => {
                    uploadedImagesList.push(evt.target.result);
                    renderMultiImagesGrid();
                };
                reader.readAsDataURL(file);
            }
        }
        renderMultiImagesGrid();
        // If photos were added, open drawer to preview
        togglePhotoPreviewDrawer(true);
        multiImagesInput.value = '';
    });

    // B. Category Change Handler (Dynamic Doctor Chamber Injection)
    window.handleCategoryChange = function(categoryVal) {
        const cat = (categoryVal || '').toLowerCase();
        const medicalKeywords = ['medical', 'pharmacy', 'medicine', 'diagnostic', 'doctor', 'clinic', 'hospital', 'health', 'pathology'];
        
        isDoctorChamberApplicable = medicalKeywords.some(kw => cat.includes(kw));

        const stepPillDoctor = document.getElementById('stepPillDoctorChamber');
        const btnNextToDoctor = document.getElementById('btnNextToDoctor');
        const btnPublishFromTimings = document.getElementById('btnPublishFromTimings');

        if (isDoctorChamberApplicable) {
            if (stepPillDoctor) stepPillDoctor.style.display = 'inline-flex';
            if (btnNextToDoctor) btnNextToDoctor.style.display = 'inline-flex';
            if (btnPublishFromTimings) btnPublishFromTimings.style.display = 'none';
        } else {
            if (stepPillDoctor) stepPillDoctor.style.display = 'none';
            if (btnNextToDoctor) btnNextToDoctor.style.display = 'none';
            if (btnPublishFromTimings) btnPublishFromTimings.style.display = 'inline-flex';
        }
    };

    // C. Doctor Chamber Add/Remove Rows
    const uAddDoctorRowBtn = document.getElementById('uAddDoctorRowBtn');
    const uDoctorsContainer = document.getElementById('uDoctorsContainer');

    uAddDoctorRowBtn?.addEventListener('click', () => {
        if (!uDoctorsContainer) return;
        const card = document.createElement('div');
        card.className = 'doctor-chamber-card';
        card.innerHTML = `
            <div class="doctor-card-grid">
                <div class="form-field span-2">
                    <label>Doctor's Full Name *</label>
                    <input type="text" class="doc-name" placeholder="e.g. Dr. Subhash Chandra Roy (MD, Medicine)">
                </div>
                <div class="form-field">
                    <label>Specialist / Department *</label>
                    <input type="text" class="doc-specialist" placeholder="e.g. Cardiologist, Pediatrician, Gynecologist">
                </div>
                <div class="form-field">
                    <label>Visiting Days</label>
                    <input type="text" class="doc-days" placeholder="e.g. Mon, Wed, Fri or Daily">
                </div>
                <div class="form-field">
                    <label>Chamber Timings</label>
                    <input type="text" class="doc-time" placeholder="e.g. 05:00 PM - 08:00 PM">
                </div>
                <div class="form-field">
                    <label>Consultation Fee</label>
                    <input type="text" class="doc-fee" placeholder="e.g. ₹500, ₹700">
                </div>
            </div>
            <button type="button" class="btn-remove-doc" onclick="this.parentElement.remove()" title="Remove Doctor"><i class="fa-solid fa-trash-can"></i> Remove</button>
        `;
        uDoctorsContainer.appendChild(card);
    });

    // ================= STEP-BY-STEP ADD/EDIT LISTING STAGES ENGINE =================
    let currentListingStep = 1;

    window.navigateListingStep = function(stepNum) {
        // Free step-to-step navigation without blocking: users can freely view and fill any tab
        currentListingStep = stepNum;

        // Switch active step pane
        document.querySelectorAll('.listing-step-pane').forEach(p => p.style.display = 'none');
        const targetPane = document.getElementById(`listingStepPane${stepNum}`);
        if (targetPane) targetPane.style.display = 'block';

        // Update step pills UI
        document.querySelectorAll('.step-nav-pill').forEach(btn => {
            const pStep = parseInt(btn.getAttribute('data-step'), 10);
            btn.classList.remove('active');
            if (pStep === stepNum) {
                btn.classList.add('active');
                // Automatically scroll the active pill smoothly into center view
                btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
            }
        });

        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Allow user to click directly on step navigation pills
    document.querySelectorAll('.step-nav-pill').forEach(btn => {
        btn.addEventListener('click', () => {
            const step = parseInt(btn.getAttribute('data-step'), 10);
            navigateListingStep(step);
        });
    });

    // Helper: Reset Add/Edit Form
    function resetAddListingForm() {
        const form = document.getElementById('userAddListingForm');
        if (form) form.reset();
        
        const editingIdEl = document.getElementById('uEditingListingId');
        if (editingIdEl) editingIdEl.value = '';

        const screenTitle = document.getElementById('uFormScreenTitle');
        if (screenTitle) screenTitle.textContent = 'Create New Listing';

        const submitBtnText = document.getElementById('uFormSubmitBtnText');
        if (submitBtnText) submitBtnText.textContent = 'Complete Your Registration';
        document.querySelectorAll('.uPublishBtnText').forEach(el => {
            el.textContent = 'Complete Your Registration';
        });

        // Reset Multi-Images & Doctor Chamber
        uploadedImagesList = [];
        renderMultiImagesGrid();
        isDoctorChamberApplicable = false;
        handleCategoryChange('');

        if (uDoctorsContainer) {
            uDoctorsContainer.innerHTML = `
                <div class="doctor-chamber-card">
                    <div class="doctor-card-grid">
                        <div class="form-field span-2">
                            <label>Doctor's Full Name *</label>
                            <input type="text" class="doc-name" placeholder="e.g. Dr. Subhash Chandra Roy (MD, Medicine)">
                        </div>
                        <div class="form-field">
                            <label>Specialist / Department *</label>
                            <input type="text" class="doc-specialist" placeholder="e.g. Cardiologist, Pediatrician, Gynecologist">
                        </div>
                        <div class="form-field">
                            <label>Visiting Days</label>
                            <input type="text" class="doc-days" placeholder="e.g. Mon, Wed, Fri or Daily">
                        </div>
                        <div class="form-field">
                            <label>Chamber Timings</label>
                            <input type="text" class="doc-time" placeholder="e.g. 05:00 PM - 08:00 PM">
                        </div>
                        <div class="form-field">
                            <label>Consultation Fee</label>
                            <input type="text" class="doc-fee" placeholder="e.g. ₹500, ₹700">
                        </div>
                    </div>
                    <button type="button" class="btn-remove-doc" onclick="this.parentElement.remove()" title="Remove Doctor"><i class="fa-solid fa-trash-can"></i> Remove</button>
                </div>
            `;
        }

        uSelectedHolidaysSet.clear();
        updateUHolidaySummary();
        renderUCalendar();

        // Restore single empty product row
        if (uProductsContainer) {
            uProductsContainer.innerHTML = `
                <div class="product-item-row">
                    <div class="prod-img-box" onclick="this.querySelector('input[type=file]').click()" title="Click to upload item image">
                        <input type="file" class="prod-file-input" accept="image/*" style="display:none;" onchange="previewUserProductImg(this)">
                        <div class="prod-img-placeholder">
                            <i class="fa-solid fa-camera"></i>
                            <span>Image</span>
                        </div>
                        <img class="prod-img-preview" alt="Item preview" style="display:none;">
                    </div>
                    <input type="text" class="prod-name" placeholder="Item / Service Name (e.g. Biryani, Consultation, AC Repair)" required>
                    <input type="text" class="prod-price" placeholder="Price (e.g. ₹250, Free, On Request)">
                    <button type="button" class="btn-remove-row" onclick="this.parentElement.remove()" title="Remove"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            `;
        }

        // Reset Daily Schedule Matrix to default (Mon-Sat 9:00 AM - 8:30 PM, Sun Closed)
        dailyScheduleData = {
            'Monday':    { isOpen: true,  openTime: '09:00', openAmPm: 'AM', closeTime: '08:30', closeAmPm: 'PM' },
            'Tuesday':   { isOpen: true,  openTime: '09:00', openAmPm: 'AM', closeTime: '08:30', closeAmPm: 'PM' },
            'Wednesday': { isOpen: true,  openTime: '09:00', openAmPm: 'AM', closeTime: '08:30', closeAmPm: 'PM' },
            'Thursday':  { isOpen: true,  openTime: '09:00', openAmPm: 'AM', closeTime: '08:30', closeAmPm: 'PM' },
            'Friday':    { isOpen: true,  openTime: '09:00', openAmPm: 'AM', closeTime: '08:30', closeAmPm: 'PM' },
            'Saturday':  { isOpen: true,  openTime: '09:00', openAmPm: 'AM', closeTime: '08:30', closeAmPm: 'PM' },
            'Sunday':    { isOpen: false, openTime: '09:00', openAmPm: 'AM', closeTime: '08:30', closeAmPm: 'PM' }
        };
        renderDailyScheduleMatrix();
    }

    // Expose openCreateListingForm globally
    window.openCreateListingForm = function() {
        resetAddListingForm();
        navigateListingStep(1);
        switchAccountScreen('viewAddListing');
    };

    // Global: Open Listing in Full Edit Mode
    window.openEditListing = function(listingId) {
        let listings = [];
        try {
            const raw = localStorage.getItem('lb_listings');
            listings = raw ? JSON.parse(raw) : [];
        } catch { listings = []; }

        const item = listings.find(l => l.id === listingId);
        if (!item) {
            alert('Listing not found!');
            return;
        }

        // Set editing id and update UI headers
        const editingIdEl = document.getElementById('uEditingListingId');
        if (editingIdEl) editingIdEl.value = item.id;

        const screenTitle = document.getElementById('uFormScreenTitle');
        if (screenTitle) screenTitle.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Edit Listing: <span style="color:#2563eb;">${item.name}</span>`;

        const submitBtnText = document.getElementById('uFormSubmitBtnText');
        if (submitBtnText) submitBtnText.textContent = 'Update Listing Details';
        document.querySelectorAll('.uPublishBtnText').forEach(el => {
            el.textContent = 'Update Listing Details';
        });

        // 1. Basic Fields
        document.getElementById('uFullListingName').value = item.name || '';
        document.getElementById('uFullListingCategory').value = item.category || '';
        document.getElementById('uFullListingCity').value = item.city || '';
        document.getElementById('uFullListingContact').value = item.phone || '';
        document.getElementById('uFullListingAddress').value = item.address || '';
        document.getElementById('uFullListingMapLink').value = item.mapLink || '';
        const descEl = document.getElementById('uFullListingDesc');
        if (descEl) descEl.value = item.desc || '';

        // Dynamic category trigger for Doctor Chamber
        handleCategoryChange(item.category || '');

        // 2. Images (Support multi-images or fallback to single image)
        uploadedImagesList = [];
        if (Array.isArray(item.images) && item.images.length > 0) {
            uploadedImagesList = [...item.images];
        } else if (item.image) {
            uploadedImagesList = [item.image];
        }
        renderMultiImagesGrid();

        // 2b. Doctor Chamber Data populate (if medical listing)
        if (isDoctorChamberApplicable && uDoctorsContainer) {
            uDoctorsContainer.innerHTML = '';
            const docs = Array.isArray(item.doctors) && item.doctors.length > 0 ? item.doctors : [{ name: '', specialist: '', days: '', time: '', fee: '' }];
            docs.forEach(doc => {
                const card = document.createElement('div');
                card.className = 'doctor-chamber-card';
                card.innerHTML = `
                    <div class="doctor-card-grid">
                        <div class="form-field span-2">
                            <label>Doctor's Full Name *</label>
                            <input type="text" class="doc-name" placeholder="e.g. Dr. Subhash Chandra Roy (MD, Medicine)" value="${doc.name || ''}">
                        </div>
                        <div class="form-field">
                            <label>Specialist / Department *</label>
                            <input type="text" class="doc-specialist" placeholder="e.g. Cardiologist, Pediatrician, Gynecologist" value="${doc.specialist || ''}">
                        </div>
                        <div class="form-field">
                            <label>Visiting Days</label>
                            <input type="text" class="doc-days" placeholder="e.g. Mon, Wed, Fri or Daily" value="${doc.days || ''}">
                        </div>
                        <div class="form-field">
                            <label>Chamber Timings</label>
                            <input type="text" class="doc-time" placeholder="e.g. 05:00 PM - 08:00 PM" value="${doc.time || ''}">
                        </div>
                        <div class="form-field">
                            <label>Consultation Fee</label>
                            <input type="text" class="doc-fee" placeholder="e.g. ₹500, ₹700" value="${doc.fee || ''}">
                        </div>
                    </div>
                    <button type="button" class="btn-remove-doc" onclick="this.parentElement.remove()" title="Remove Doctor"><i class="fa-solid fa-trash-can"></i> Remove</button>
                `;
                uDoctorsContainer.appendChild(card);
            });
        }

        // 3. Daily Operating Schedule Matrix Population
        if (item.dailySchedule && typeof item.dailySchedule === 'object') {
            dailyScheduleData = JSON.parse(JSON.stringify(item.dailySchedule));
        } else {
            // Reconstruct from legacy openDays & scheduleTimings
            const legacyOpenDays = Array.isArray(item.openDays) ? item.openDays : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            let defOpen = '09:00', defOpenAmPm = 'AM', defClose = '08:30', defCloseAmPm = 'PM';
            if (item.scheduleTimings && item.scheduleTimings.includes('-')) {
                const parts = item.scheduleTimings.split('-').map(s => s.trim());
                if (parts[0]) {
                    const op = parts[0].split(' ');
                    if (op[0]) defOpen = op[0];
                    if (op[1]) defOpenAmPm = op[1];
                }
                if (parts[1]) {
                    const cl = parts[1].split(' ');
                    if (cl[0]) defClose = cl[0];
                    if (cl[1]) defCloseAmPm = cl[1];
                }
            }
            dailyScheduleData = {};
            DAYS_OF_WEEK.forEach(day => {
                dailyScheduleData[day] = {
                    isOpen: legacyOpenDays.includes(day),
                    openTime: defOpen,
                    openAmPm: defOpenAmPm,
                    closeTime: defClose,
                    closeAmPm: defCloseAmPm
                };
            });
        }
        renderDailyScheduleMatrix();

        // 5. Holidays
        uSelectedHolidaysSet.clear();
        if (Array.isArray(item.holidays)) {
            item.holidays.forEach(h => uSelectedHolidaysSet.add(h));
        }
        updateUHolidaySummary();
        renderUCalendar();

        // 6. Products & Services
        if (uProductsContainer) {
            uProductsContainer.innerHTML = '';
            const products = Array.isArray(item.products) && item.products.length > 0 ? item.products : [{ name: '', price: '', image: '' }];
            
            products.forEach(prod => {
                const row = document.createElement('div');
                row.className = 'product-item-row';
                const hasImg = prod.image && prod.image.trim() !== '';
                row.innerHTML = `
                    <div class="prod-img-box" onclick="this.querySelector('input[type=file]').click()" title="Click to upload item image">
                        <input type="file" class="prod-file-input" accept="image/*" style="display:none;" onchange="previewUserProductImg(this)">
                        <div class="prod-img-placeholder" style="${hasImg ? 'display:none;' : ''}">
                            <i class="fa-solid fa-camera"></i>
                            <span>Image</span>
                        </div>
                        <img class="prod-img-preview" alt="Item preview" src="${hasImg ? prod.image : ''}" style="${hasImg ? 'display:block;' : 'display:none;'}">
                    </div>
                    <input type="text" class="prod-name" placeholder="Item / Service Name" value="${prod.name || ''}" required>
                    <input type="text" class="prod-price" placeholder="Price (e.g. ₹250)" value="${prod.price || ''}">
                    <button type="button" class="btn-remove-row" onclick="this.parentElement.remove()" title="Remove"><i class="fa-solid fa-trash-can"></i></button>
                `;
                uProductsContainer.appendChild(row);
            });
        }

        // Switch to the form view
        switchAccountScreen('viewAddListing');
    };

    // ================= 6. USER MANAGE BUSINESS SUITE (Enterprise Merchant Hub) =================
    let currentActiveBusinessId = null;
    let userManageListingsCache = [];
    let userManageActiveTypeFilter = 'all';

    function renderUserManageListings() {
        const container = document.getElementById('userListingsContainer');
        const filterBar = document.getElementById('manageSearchFilterBar');
        if (!container) return;

        let listings = [];
        try {
            const rawListings = localStorage.getItem('lb_listings');
            listings = rawListings ? JSON.parse(rawListings) : [];
        } catch {
            listings = [];
        }

        // Filter listings created strictly by this user
        let userListings = listings.filter(l => 
            (currentUser.id && String(l.ownerId) === String(currentUser.id)) || 
            (currentUser.email && l.ownerId && l.ownerId.toLowerCase() === currentUser.email.toLowerCase()) || 
            (currentUser.email && l.ownerEmail && l.ownerEmail.toLowerCase() === currentUser.email.toLowerCase()) || 
            (currentUser.phone && l.phone && l.phone === currentUser.phone) ||
            (currentUser.phone && l.ownerPhone && l.ownerPhone === currentUser.phone) ||
            (currentUser.email && l.claimedBy && l.claimedBy.toLowerCase() === currentUser.email.toLowerCase())
        );

        userManageListingsCache = userListings;

        // Update stats
        const statTotal = document.getElementById('uStatTotalListings');
        const statActive = document.getElementById('uStatActiveListings');
        const verifiedCount = userListings.filter(l => l.status === 'Verified').length;
        if (statTotal) statTotal.textContent = userListings.length;
        if (statActive) statActive.textContent = verifiedCount;

        // Update Inbox unread badge count
        let totalUnread = 0;
        userListings.forEach(store => {
            try {
                const rawInbox = localStorage.getItem(`lb_store_inbox_${store.id}`);
                if (rawInbox) {
                    const threads = JSON.parse(rawInbox);
                    if (Array.isArray(threads)) {
                        totalUnread += threads.filter(t => !!t.unread).length;
                    }
                }
            } catch {}
        });
        const inboxBadge = document.getElementById('unifiedInboxBadgeCount');
        if (inboxBadge) {
            if (totalUnread > 0) {
                inboxBadge.textContent = totalUnread;
                inboxBadge.style.display = 'inline-block';
            } else {
                inboxBadge.style.display = 'none';
            }
        }

        // Render All Businesses List
        if (userListings.length === 0) {
            if (filterBar) filterBar.style.display = 'none';
            container.innerHTML = `
                <div class="ctrl-empty-state">
                    <i class="fa-solid fa-store-slash"></i>
                    <strong>No Businesses Registered Yet</strong>
                    <span>Get started by registering your shop, office or service on LocalBazar.</span>
                    <button type="button" class="btn-hub-primary" style="width:auto; margin-top:1.25rem; padding:0.65rem 1.4rem;" onclick="openCreateListingForm()">
                        <i class="fa-solid fa-plus"></i> Add Your Business
                    </button>
                </div>
            `;
            return;
        }

        if (filterBar) filterBar.style.display = 'flex';

        // Update counts in filter chips
        const countAll = document.getElementById('manageCountAll');
        const countMain = document.getElementById('manageCountMain');
        const countBranches = document.getElementById('manageCountBranches');
        const mainCount = userListings.filter(l => !l.isBranch).length;
        const branchCount = userListings.filter(l => !!l.isBranch).length;
        if (countAll) countAll.textContent = userListings.length;
        if (countMain) countMain.textContent = mainCount;
        if (countBranches) countBranches.textContent = branchCount;

        // Populate City Filter dropdown dynamically
        const citySelect = document.getElementById('manageListingsCityFilter');
        if (citySelect) {
            const currentSelected = citySelect.value || 'ALL';
            const uniqueCities = Array.from(new Set(userListings.map(l => (l.city || '').trim()).filter(Boolean))).sort();
            citySelect.innerHTML = `<option value="ALL">All Cities (${userListings.length})</option>` + 
                uniqueCities.map(c => `<option value="${c}">${c}</option>`).join('');
            if (uniqueCities.includes(currentSelected)) {
                citySelect.value = currentSelected;
            } else {
                citySelect.value = 'ALL';
            }
        }

        // Apply search & filter and render
        window.filterUserManageListings();
    }

    window.filterUserManageListings = function() {
        const container = document.getElementById('userListingsContainer');
        if (!container) return;

        const searchInput = document.getElementById('manageListingsSearchInput');
        const clearBtn = document.getElementById('manageListingsClearSearch');
        const citySelect = document.getElementById('manageListingsCityFilter');
        const countText = document.getElementById('manageShowingCountText');

        const query = (searchInput?.value || '').trim().toLowerCase();
        const selectedCity = citySelect?.value || 'ALL';

        if (clearBtn) {
            clearBtn.style.display = query ? 'block' : 'none';
        }

        let filtered = userManageListingsCache.slice();

        // 1. Filter by Type (All / Main / Branch)
        if (userManageActiveTypeFilter === 'main') {
            filtered = filtered.filter(l => !l.isBranch);
        } else if (userManageActiveTypeFilter === 'branch') {
            filtered = filtered.filter(l => !!l.isBranch);
        }

        // 2. Filter by City
        if (selectedCity !== 'ALL') {
            filtered = filtered.filter(l => String(l.city || '').trim().toLowerCase() === selectedCity.toLowerCase());
        }

        // 3. Filter by Search Query (Name, City, Category, Address, Phone, Parent Store)
        if (query) {
            filtered = filtered.filter(l => {
                const name = (l.name || '').toLowerCase();
                const city = (l.city || '').toLowerCase();
                const cat = (l.category || '').toLowerCase();
                const addr = (l.address || '').toLowerCase();
                const phone = (l.phone || '').toLowerCase();
                const parent = (l.parentStoreName || '').toLowerCase();
                return name.includes(query) || city.includes(query) || cat.includes(query) || addr.includes(query) || phone.includes(query) || parent.includes(query);
            });
        }

        // Update showing count text
        if (countText) {
            if (filtered.length === userManageListingsCache.length) {
                countText.textContent = `Showing all ${userManageListingsCache.length} businesses`;
            } else {
                countText.textContent = `Showing ${filtered.length} of ${userManageListingsCache.length} businesses`;
            }
        }

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="ctrl-empty-state" style="padding:2.5rem 1rem;">
                    <i class="fa-solid fa-magnifying-glass" style="font-size:2.2rem; color:#94a3b8; margin-bottom:0.75rem;"></i>
                    <strong style="font-size:1.05rem; color:#334155;">No businesses found</strong>
                    <span style="font-size:0.85rem; color:#64748b; margin-top:0.25rem;">No branch or store matches your search "${query || selectedCity}".</span>
                    <button type="button" class="btn-hub-primary" style="width:auto; margin-top:1rem; padding:0.5rem 1.25rem; font-size:0.85rem;" onclick="clearManageListingsSearch()">
                        <i class="fa-solid fa-rotate-left"></i> Reset Filter
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = filtered.map(item => {
            const isVerified = item.status === 'Verified';
            const isBranch = !!item.isBranch;
            return `
            <div class="ctrl-listing-card ${isBranch ? 'ctrl-is-branch-card' : ''}" onclick="handleBusinessCardClick('${item.id}')" style="cursor:pointer;" title="Click to manage ${item.name} dashboard">
                <div class="ctrl-card-top">
                    <div class="ctrl-thumb-wrapper">
                        <img src="${item.image || 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=160&auto=format&fit=crop&q=80'}" alt="${item.name}" class="ctrl-listing-thumb">
                        <span class="ctrl-badge-status ${isVerified ? 'verified' : 'pending'}">
                            ${isVerified ? '<i class="fa-solid fa-circle-check"></i> Live' : '<i class="fa-solid fa-clock"></i> In Review'}
                        </span>
                    </div>
                    <div class="ctrl-card-details">
                        <div class="ctrl-title-row">
                            <h4 class="ctrl-listing-title" style="display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap;">
                                <span>${item.name}</span>
                                ${(item.hasTrustBadge || item.status === 'Verified') ? `<span class="badge-gold-trust" style="font-size:0.65rem; padding:0.12rem 0.45rem;"><i class="fa-solid fa-shield-halved"></i> Trust</span>` : ''}
                            </h4>
                            <span class="ctrl-cat-tag">${item.category || 'Business'}</span>
                        </div>
                        ${isBranch && item.parentStoreName ? `
                        <div class="ctrl-parent-store-note">
                            <i class="fa-solid fa-store"></i> Branch of <strong>${item.parentStoreName}</strong>
                        </div>` : ''}
                        <div class="ctrl-meta-line">
                            <span><i class="fa-solid fa-location-dot"></i> ${item.city}</span>
                            <span><i class="fa-solid fa-phone"></i> ${item.phone || 'N/A'}</span>
                        </div>
                        <div class="ctrl-timing-line">
                            <i class="fa-regular fa-clock"></i> <span>${item.scheduleTimings || 'Regular Hours'}</span>
                        </div>
                    </div>
                    <div class="ctrl-card-right-group">
                        <button type="button" class="btn-ctrl-share" onclick="event.stopPropagation(); openListingShareQRModal('${item.id}');" title="Generate QR & Share Standee">
                            <i class="fa-solid fa-qrcode"></i>
                            <span>Share & QR</span>
                        </button>
                        <div class="ctrl-card-arrow" title="Open Merchant Control Hub">
                            <i class="fa-solid fa-chevron-right"></i>
                        </div>
                    </div>
                </div>
            </div>
            `;
        }).join('');
    };

    window.clearManageListingsSearch = function() {
        const searchInput = document.getElementById('manageListingsSearchInput');
        const clearBtn = document.getElementById('manageListingsClearSearch');
        const citySelect = document.getElementById('manageListingsCityFilter');
        if (searchInput) searchInput.value = '';
        if (clearBtn) clearBtn.style.display = 'none';
        if (citySelect) citySelect.value = 'ALL';
        userManageActiveTypeFilter = 'all';
        document.querySelectorAll('#manageTypeChips .btn-manage-filter-chip').forEach(btn => {
            if (btn.getAttribute('data-type') === 'all') {
                btn.classList.add('active');
                btn.style.background = '#2563eb';
                btn.style.color = '#ffffff';
                btn.style.borderColor = '#2563eb';
            } else {
                btn.classList.remove('active');
                btn.style.background = '#ffffff';
                btn.style.color = '#475569';
                btn.style.borderColor = '#cbd5e1';
            }
        });
        window.filterUserManageListings();
    };

    window.setManageListingsTypeFilter = function(type, targetBtn) {
        userManageActiveTypeFilter = type;
        document.querySelectorAll('#manageTypeChips .btn-manage-filter-chip').forEach(btn => {
            btn.classList.remove('active');
            btn.style.background = '#ffffff';
            btn.style.color = '#475569';
            btn.style.borderColor = '#cbd5e1';
        });
        if (targetBtn) {
            targetBtn.classList.add('active');
            targetBtn.style.background = '#2563eb';
            targetBtn.style.color = '#ffffff';
            targetBtn.style.borderColor = '#2563eb';
        }
        window.filterUserManageListings();
    };

    // ================= STORE SHARE & QR STANDEE SUITE =================
    window._currentShareListing = null;

    window.openListingShareQRModal = function(listingId) {
        let listings = [];
        try {
            const raw = localStorage.getItem('lb_listings');
            listings = raw ? JSON.parse(raw) : [];
        } catch { listings = []; }

        let item = listings.find(l => String(l.id).trim() === String(listingId).trim());
        if (!item && listingId) {
            item = listings.find(l => String(l.id).toLowerCase() === String(listingId).toLowerCase());
        }
        if (!item && listingId) {
            item = listings.find(l => (l.name || '').trim().toLowerCase() === String(listingId).trim().toLowerCase());
        }
        if (!item && listings.length > 0) {
            item = listings[0];
        }
        if (!item) {
            item = {
                id: listingId || 'LB-STORE',
                name: 'Local Store',
                category: 'Business',
                city: 'Local Area',
                image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=160&auto=format&fit=crop&q=80'
            };
        }

        // Construct unique store detail URL
        let storeUrl = '';
        if (window.location.protocol === 'file:') {
            storeUrl = window.location.href.replace(/account\.html.*$/, 'listing-detail.html') + `?id=${encodeURIComponent(item.id)}`;
        } else {
            const path = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
            storeUrl = `${window.location.origin}${path}listing-detail.html?id=${encodeURIComponent(item.id)}`;
        }

        window._currentShareListing = { item, storeUrl };

        // Populate Standee Identity
        const avatarEl = document.getElementById('qrStandeeAvatar');
        const nameEl = document.getElementById('qrStandeeName');
        const metaEl = document.getElementById('qrStandeeMeta');
        const linkEl = document.getElementById('qrStandeeLinkText');
        const linkAnchor = document.getElementById('qrStandeeLinkAnchor');
        const waBtn = document.getElementById('btnShareQrWhatsApp');
        const copyBtnText = document.getElementById('copyLinkBtnText');

        if (avatarEl) avatarEl.src = item.image || 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=160&auto=format&fit=crop&q=80';
        if (nameEl) nameEl.textContent = item.name || 'Store';
        if (metaEl) metaEl.textContent = `${item.category || 'Store'} • ${item.city || 'Local'}`;
        if (linkEl) linkEl.textContent = storeUrl;
        if (linkAnchor) {
            linkAnchor.href = storeUrl;
            linkAnchor.title = `Click to visit ${item.name || 'Store'} Home Page`;
        }
        if (copyBtnText) copyBtnText.textContent = 'Copy Link';
        resetStandeeCopyBtnState();

        if (waBtn) {
            const waMsg = `Check out ${item.name || 'our store'} on LocalBazar:\n${storeUrl}\n\nBrowse catalog, view offers & order directly!`;
            waBtn.href = `https://api.whatsapp.com/send?text=${encodeURIComponent(waMsg)}`;
        }

        // Generate QR Code
        const qrContainer = document.getElementById('qrCodeContainer');
        if (qrContainer) {
            qrContainer.innerHTML = '';
            if (typeof QRCode !== 'undefined') {
                try {
                    new QRCode(qrContainer, {
                        text: storeUrl,
                        width: 190,
                        height: 190,
                        colorDark: "#0f172a",
                        colorLight: "#ffffff",
                        correctLevel: QRCode.CorrectLevel.H
                    });
                } catch (e) {
                    console.warn('QRCode JS render error, using fallback:', e);
                    const qrImg = document.createElement('img');
                    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=6&data=${encodeURIComponent(storeUrl)}`;
                    qrImg.alt = 'Store QR Code';
                    qrContainer.appendChild(qrImg);
                }
            } else {
                const qrImg = document.createElement('img');
                qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=6&data=${encodeURIComponent(storeUrl)}`;
                qrImg.alt = 'Store QR Code';
                qrContainer.appendChild(qrImg);
            }
        }

        const modal = document.getElementById('listingShareQRModal');
        if (modal) {
            modal.classList.add('active');
            modal.style.display = 'flex';
        }
    };

    window.closeListingShareQRModal = function() {
        const modal = document.getElementById('listingShareQRModal');
        if (modal) {
            modal.classList.remove('active');
            modal.style.display = 'none';
        }
    };

    function resetStandeeCopyBtnState() {
        const standeeBtn = document.getElementById('standeeCopyBtn');
        const standeeIcon = document.getElementById('standeeCopyIcon');
        const standeeText = document.getElementById('standeeCopyText');
        const btnText = document.getElementById('copyLinkBtnText');
        if (standeeBtn) standeeBtn.classList.remove('copied');
        if (standeeIcon) standeeIcon.className = 'fa-regular fa-copy';
        if (standeeText) standeeText.textContent = 'Copy';
        if (btnText) btnText.textContent = 'Copy Link';
    }

    window.copyStoreShareLink = function() {
        const url = window._currentShareListing?.storeUrl || window.location.href;

        const showCopySuccess = () => {
            // Standee inner copy button
            const standeeBtn = document.getElementById('standeeCopyBtn');
            const standeeIcon = document.getElementById('standeeCopyIcon');
            const standeeText = document.getElementById('standeeCopyText');
            if (standeeBtn) standeeBtn.classList.add('copied');
            if (standeeIcon) standeeIcon.className = 'fa-solid fa-check';
            if (standeeText) standeeText.textContent = 'Copied!';

            // Main action button below standee
            const btnText = document.getElementById('copyLinkBtnText');
            if (btnText) btnText.textContent = 'Copied!';

            setTimeout(() => {
                resetStandeeCopyBtnState();
            }, 2500);
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(showCopySuccess).catch(() => {
                fallbackCopy(url);
                showCopySuccess();
            });
        } else {
            fallbackCopy(url);
            showCopySuccess();
        }

        function fallbackCopy(text) {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
    };

    window.printStoreQRStandee = function() {
        window.print();
    };

    // Helper: Generate Clean Official Merchant Standee Canvas (800x760 px)
    function generateStandeeCanvas(listing) {
        const storeName = listing.name || 'Store';
        const storeCategory = (listing.category || 'Local Business') + ' • ' + (listing.city || 'India');

        const qrContainer = document.getElementById('qrCodeContainer');
        const qrCanvas = qrContainer ? qrContainer.querySelector('canvas') : null;
        const qrImg = qrContainer ? qrContainer.querySelector('img') : null;

        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 760;
        const ctx = canvas.getContext('2d');

        // Crisp White Card Background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 800, 760);

        // Standee Card Outer Border
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 4;
        ctx.strokeRect(20, 20, 760, 720);

        // Header Brand Pill (LocalBazar)
        const gradient = ctx.createLinearGradient(50, 45, 260, 45);
        gradient.addColorStop(0, '#1e3a8a');
        gradient.addColorStop(1, '#2563eb');
        ctx.fillStyle = gradient;
        if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(50, 45, 210, 46, 23);
            ctx.fill();
        } else {
            ctx.fillRect(50, 45, 210, 46);
        }

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🛍️ LocalBazar', 155, 75);

        // Verified Badge
        ctx.fillStyle = '#ecfdf5';
        if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(540, 45, 200, 46, 23);
            ctx.fill();
        } else {
            ctx.fillRect(540, 45, 200, 46);
        }
        ctx.strokeStyle = '#a7f3d0';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#059669';
        ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('✓ Verified Store', 640, 74);

        // Store Name
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';
        const truncatedName = storeName.length > 30 ? storeName.substring(0, 28) + '...' : storeName;
        ctx.fillText(truncatedName, 400, 150);

        // Store Meta
        ctx.fillStyle = '#64748b';
        ctx.font = '600 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(storeCategory, 400, 188);

        // QR Box Background
        ctx.fillStyle = '#f8fafc';
        if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(155, 220, 490, 490, 24);
            ctx.fill();
        } else {
            ctx.fillRect(155, 220, 490, 490);
        }
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Corner brackets (High-tech scanner look)
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        // Top-Left
        ctx.beginPath(); ctx.moveTo(180, 270); ctx.lineTo(180, 245); ctx.lineTo(205, 245); ctx.stroke();
        // Top-Right
        ctx.beginPath(); ctx.moveTo(595, 245); ctx.lineTo(620, 245); ctx.lineTo(620, 270); ctx.stroke();
        // Bottom-Left
        ctx.beginPath(); ctx.moveTo(180, 660); ctx.lineTo(180, 685); ctx.lineTo(205, 685); ctx.stroke();
        // Bottom-Right
        ctx.beginPath(); ctx.moveTo(595, 685); ctx.lineTo(620, 685); ctx.lineTo(620, 660); ctx.stroke();

        // Draw Scannable QR Code
        const qrSource = qrCanvas || qrImg;
        if (qrSource) {
            try {
                ctx.drawImage(qrSource, 215, 280, 370, 370);
            } catch (e) {
                console.warn('Canvas draw QR warning:', e);
            }
        }

        return canvas;
    }

    // Download QR Standee Image
    window.downloadStoreQRStandee = function() {
        const listing = window._currentShareListing?.item || {};
        const storeName = listing.name || 'Store';
        const canvas = generateStandeeCanvas(listing);

        try {
            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `${(storeName || 'Store').replace(/[^a-zA-Z0-9]/g, '_')}_QR_Standee.png`;
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error('Download standee error:', err);
            alert('Could not download image directly.');
        }
    };

    // Share QR Standee via Web Share API (All apps on mobile: WhatsApp, Telegram, Facebook, etc.)
    window.shareStoreQRStandee = async function() {
        const listing = window._currentShareListing?.item || {};
        const storeName = listing.name || 'Store';
        const storeUrl = window._currentShareListing?.storeUrl || window.location.href;
        const shareTitle = `${storeName} - LocalBazar Official Store`;
        const shareText = `Check out ${storeName} on LocalBazar! Scan QR or click link to browse catalog, view offers & order directly:\n${storeUrl}`;

        try {
            const canvas = generateStandeeCanvas(listing);

            canvas.toBlob(async (blob) => {
                // 1. Try sharing standee image file directly via Web Share API
                if (blob && navigator.canShare) {
                    const fileName = `${(storeName || 'Store').replace(/[^a-zA-Z0-9]/g, '_')}_QR_Standee.png`;
                    const file = new File([blob], fileName, { type: 'image/png' });

                    if (navigator.canShare({ files: [file] })) {
                        try {
                            await navigator.share({
                                title: shareTitle,
                                text: shareText,
                                files: [file]
                            });
                            return;
                        } catch (shareErr) {
                            if (shareErr.name === 'AbortError') return; // User simply closed the share sheet
                            console.warn('File sharing failed, attempting URL sharing:', shareErr);
                        }
                    }
                }

                // 2. Fallback to standard native URL/Text share
                if (navigator.share) {
                    try {
                        await navigator.share({
                            title: shareTitle,
                            text: shareText,
                            url: storeUrl
                        });
                        return;
                    } catch (err) {
                        if (err.name === 'AbortError') return;
                    }
                }

                // 3. Fallback for Desktop: Copy link & show friendly alert
                copyStoreShareLink();
                alert(`Store link copied to clipboard!\n${storeUrl}`);
            }, 'image/png');
        } catch (e) {
            console.error('Share standee error:', e);
            if (navigator.share) {
                navigator.share({ title: shareTitle, text: shareText, url: storeUrl }).catch(() => {});
            } else {
                copyStoreShareLink();
            }
        }
    };

    // ================= MULTINATIONAL MERCHANT PORTAL (TOP-TIER SUITE) =================
    let currentPortalListingId = null;

    window.handleBusinessCardClick = function(listingId) {
        currentPortalListingId = listingId;
        openMerchantPortal(listingId);
    };

    function openMerchantPortal(listingId) {
        let listings = [];
        try {
            const raw = localStorage.getItem('lb_listings');
            listings = raw ? JSON.parse(raw) : [];
        } catch { listings = []; }

        // Robust business matching with fallbacks
        let biz = listings.find(l => String(l.id).trim() === String(listingId).trim());
        if (!biz && listingId) {
            biz = listings.find(l => String(l.id).toLowerCase() === String(listingId).toLowerCase());
        }
        if (!biz && listingId) {
            biz = listings.find(l => (l.name || '').trim().toLowerCase() === String(listingId).trim().toLowerCase());
        }
        if (!biz && listings.length > 0) {
            biz = listings[0];
        }
        if (!biz) {
            alert('No registered business found. Please add a business first.');
            return;
        }

        currentPortalListingId = biz.id;

        // Show Overlay immediately
        const overlay = document.getElementById('merchantPortalOverlay');
        if (overlay) {
            overlay.classList.add('active');
            overlay.style.display = 'flex';
            if (window.lbPushModal) window.lbPushModal('merchantPortal', window.closeMerchantPortal);
        }

        // 3. Tab: Profile Form Populate
        const photoPreview = document.getElementById('mStorePhotoPreviewImg');
        const inName = document.getElementById('mInputBizName');
        const inCat = document.getElementById('mInputBizCategory');
        const inCity = document.getElementById('mInputBizCity');
        const inPhone = document.getElementById('mInputBizPhone');
        const inWhatsapp = document.getElementById('mInputBizWhatsapp');
        const inAddr = document.getElementById('mInputBizAddress');
        const inMap = document.getElementById('mInputBizMapLink');

        // Populate Categories from Admin Database (lb_categories)
        let adminCategories = [];
        try {
            const rawCats = localStorage.getItem('lb_categories');
            adminCategories = rawCats ? JSON.parse(rawCats) : [];
        } catch {
            adminCategories = [];
        }

        if (inCat) {
            const currentCatVal = biz.category || '';
            if (adminCategories.length > 0) {
                inCat.innerHTML = '<option value="">Select Category</option>' + adminCategories.map(cat => {
                    const cName = typeof cat === 'string' ? cat : (cat.name || '');
                    return `<option value="${cName}" ${cName === currentCatVal ? 'selected' : ''}>${cName}</option>`;
                }).join('');
            } else if (currentCatVal) {
                inCat.innerHTML = `<option value="${currentCatVal}" selected>${currentCatVal}</option>`;
            } else {
                inCat.innerHTML = '<option value="">No categories created by Admin yet</option>';
            }
            if (currentCatVal) inCat.value = currentCatVal;
        }

        // Populate Identity & Action Buttons
        if (inName) inName.value = biz.name || '';
        if (inCity) inCity.value = biz.city || '';
        if (inAddr) inAddr.value = biz.address || '';
        if (inPhone) inPhone.value = biz.phone || '';
        if (inWhatsapp) inWhatsapp.value = biz.whatsapp || '';
        if (inMap) inMap.value = biz.mapLink || '';

        // Safely render each portal section
        try { renderPortalGallery(biz); } catch (e) { console.error('Gallery render error:', e); }
        try { renderPortalStoreCategories(biz); } catch (e) { console.error('Store categories render error:', e); }
        try { renderPortalCatalog(biz); } catch (e) { console.error('Catalog render error:', e); }
        try { renderPortalBanners(biz); } catch (e) { console.error('Banners render error:', e); }
        try { renderPortalDailySchedule(biz); } catch (e) { console.error('Schedule render error:', e); }
        try { renderPortalInbox(biz); } catch (e) { console.error('Inbox render error:', e); }
        try { attachPortalInboxCloudListener(biz.id); } catch (e) { console.error('Portal inbox listener error:', e); }

        // Populate Drawer Brand
        const dAvatar = document.getElementById('mDrawerStoreAvatar');
        const dName = document.getElementById('mDrawerStoreName');
        const mainImg = (Array.isArray(biz.gallery) && biz.gallery[0]) || biz.image || 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=120';
        if (dAvatar) dAvatar.src = mainImg;
        if (dName) dName.textContent = biz.name || 'My Business';

        // Activate Tab 1 (Listing Images)
        if (typeof window.switchPortalTab === 'function') {
            window.switchPortalTab('tabPhotos');
        }
    }

    window.closeMerchantPortal = function() {
        if (typeof portalInboxUnsub === 'function') {
            try { portalInboxUnsub(); } catch (e) {}
            portalInboxUnsub = null;
        }
        closePortalDrawer();
        const overlay = document.getElementById('merchantPortalOverlay');
        if (overlay) {
            overlay.classList.remove('active');
            overlay.style.display = 'none';
        }
        if (window.lbPopModal) window.lbPopModal('merchantPortal');
        renderUserManageListings();
    };

    // Auto-Hide Drawer Controls
    window.togglePortalDrawer = function() {
        const drawer = document.getElementById('mPortalDrawer');
        const backdrop = document.getElementById('mPortalDrawerBackdrop');
        if (drawer && backdrop) {
            const isOpen = drawer.classList.contains('active');
            if (isOpen) {
                closePortalDrawer();
            } else {
                openPortalDrawer();
            }
        }
    };

    window.openPortalDrawer = function() {
        const drawer = document.getElementById('mPortalDrawer');
        const backdrop = document.getElementById('mPortalDrawerBackdrop');
        if (drawer) drawer.classList.add('active');
        if (backdrop) backdrop.classList.add('active');
    };

    window.closePortalDrawer = function() {
        const drawer = document.getElementById('mPortalDrawer');
        const backdrop = document.getElementById('mPortalDrawerBackdrop');
        if (drawer) drawer.classList.remove('active');
        if (backdrop) backdrop.classList.remove('active');
    };

    window.handlePortalBackdropClick = function(e) {
        if (e.target && e.target.id === 'merchantPortalOverlay') {
            closeMerchantPortal();
        }
    };

    const tabTitlesMap = {
        'tabPhotos': { icon: 'fa-solid fa-images', name: 'Listing Images' },
        'tabIdentity': { icon: 'fa-solid fa-location-dot', name: 'Identity & Address' },
        'tabActionButtons': { icon: 'fa-solid fa-sliders', name: 'Action Buttons' },
        'tabProductsServices': { icon: 'fa-solid fa-boxes-stacked', name: 'Products & Services' },
        'tabBanners': { icon: 'fa-solid fa-bullhorn', name: 'Banners (16:9)' },
        'tabSchedule': { icon: 'fa-regular fa-clock', name: 'Schedule & Timings' }
    };

    // Tab Switching (Syncs Drawer Navigation & Auto-Hides Drawer)
    window.switchPortalTab = function(tabId) {
        // Drawer Menu Items
        document.querySelectorAll('#mPortalDrawerMenu .m-drawer-item').forEach(btn => {
            if (btn.getAttribute('data-tab') === tabId) btn.classList.add('active');
            else btn.classList.remove('active');
        });

        // Tab Panels
        document.querySelectorAll('.m-tab-panel').forEach(panel => {
            if (panel.id === tabId) panel.classList.add('active');
            else panel.classList.remove('active');
        });

        // Update Floating Topbar Title
        const topbarTitle = document.getElementById('mPortalActiveTabTitle');
        if (topbarTitle && tabTitlesMap[tabId]) {
            topbarTitle.innerHTML = `<i class="${tabTitlesMap[tabId].icon}"></i> <span>${tabTitlesMap[tabId].name}</span>`;
        }

        // Auto close drawer after selection
        closePortalDrawer();

        const bodyContent = document.querySelector('.m-portal-body');
        if (bodyContent) bodyContent.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Tab Click Listeners for Drawer Menu
    document.querySelectorAll('#mPortalDrawerMenu .m-drawer-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.getAttribute('data-tab');
            switchPortalTab(tab);
        });
    });

    // ================= 1. TAB 1: LISTING IMAGES GALLERY =================
    function renderPortalGallery(biz) {
        const grid = document.getElementById('mPortalGalleryGrid');
        if (!grid) return;

        let gallery = Array.isArray(biz.gallery) ? biz.gallery : [];
        if (gallery.length === 0 && biz.image) {
            gallery = [biz.image];
        }

        if (gallery.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align:center; padding:3rem 1.5rem; background:#f8fafc; border:1.5px dashed #cbd5e1; border-radius:14px;">
                    <i class="fa-solid fa-images" style="font-size:2.4rem; color:#94a3b8; margin-bottom:0.75rem;"></i>
                    <h4 style="margin:0 0 0.35rem 0; font-size:1rem; font-weight:700; color:#1e293b;">No Photos Uploaded Yet</h4>
                    <p style="margin:0; font-size:0.82rem; color:#64748b;">Click "Upload Photos" above to add storefront and interior photos for this listing.</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = gallery.map((imgUrl, idx) => `
            <div class="m-gallery-card ${idx === 0 ? 'is-primary' : ''}">
                <div class="m-gallery-img-box">
                    <img src="${imgUrl}" alt="Photo ${idx + 1}" loading="lazy">
                    ${idx === 0 ? '<span class="m-gallery-primary-chip"><i class="fa-solid fa-star"></i> Cover Photo</span>' : ''}
                </div>
                <div class="m-gallery-actions">
                    ${idx !== 0 ? `
                        <button type="button" class="btn-gallery-action" onclick="setGalleryPrimaryPhoto(${idx})" title="Set as Main Cover Photo">
                            <i class="fa-solid fa-star"></i> Set Cover
                        </button>
                    ` : '<span style="font-size:0.75rem; font-weight:700; color:#16a34a;"><i class="fa-solid fa-check"></i> Primary</span>'}
                    <button type="button" class="btn-gallery-action del" onclick="deleteGalleryPhoto(${idx})" title="Delete Photo">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    window.handlePortalGalleryUpload = function(input) {
        if (!input.files || input.files.length === 0 || !currentPortalListingId) return;

        let listings = [];
        try {
            const raw = localStorage.getItem('lb_listings');
            listings = raw ? JSON.parse(raw) : [];
        } catch { listings = []; }
        const idx = listings.findIndex(l => l.id === currentPortalListingId);
        if (idx === -1) return;

        if (!Array.isArray(listings[idx].gallery)) {
            listings[idx].gallery = listings[idx].image ? [listings[idx].image] : [];
        }

        const files = Array.from(input.files);
        let loadedCount = 0;

        files.forEach(file => {
            compressFileImage(file, 260, 1280)
                .then(compressedUrl => {
                    listings[idx].gallery.push(compressedUrl);
                    if (!listings[idx].image) listings[idx].image = compressedUrl;
                    listings[idx].images = listings[idx].gallery;
                    loadedCount++;
                    if (loadedCount === files.length) {
                        localStorage.setItem('lb_listings', JSON.stringify(listings));

            // Sync to Firebase Cloud Firestore if online
            if (window.lbCloudSync && typeof window.lbCloudSync.saveListing === 'function') {
                const _syncTarget = (typeof editingId !== 'undefined' && editingId && typeof index !== 'undefined' && listings[index]) 
                    ? listings[index] 
                    : (typeof newListingEntry !== 'undefined' ? newListingEntry : (typeof idx !== 'undefined' && listings[idx] ? listings[idx] : null));
                if (_syncTarget) window.lbCloudSync.saveListing(_syncTarget);
            }
                        renderPortalGallery(listings[idx]);
                        input.value = '';
                    }
                })
                .catch(() => {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        listings[idx].gallery.push(e.target.result);
                        if (!listings[idx].image) listings[idx].image = e.target.result;
                        listings[idx].images = listings[idx].gallery;
                        loadedCount++;
                        if (loadedCount === files.length) {
                            localStorage.setItem('lb_listings', JSON.stringify(listings));

            // Sync to Firebase Cloud Firestore if online
            if (window.lbCloudSync && typeof window.lbCloudSync.saveListing === 'function') {
                const _syncTarget = (typeof editingId !== 'undefined' && editingId && typeof index !== 'undefined' && listings[index]) 
                    ? listings[index] 
                    : (typeof newListingEntry !== 'undefined' ? newListingEntry : (typeof idx !== 'undefined' && listings[idx] ? listings[idx] : null));
                if (_syncTarget) window.lbCloudSync.saveListing(_syncTarget);
            }
                            renderPortalGallery(listings[idx]);
                            input.value = '';
                        }
                    };
                    reader.readAsDataURL(file);
                });
        });
    };

    window.setGalleryPrimaryPhoto = function(index) {
        if (!currentPortalListingId) return;
        let listings = [];
        try {
            const raw = localStorage.getItem('lb_listings');
            listings = raw ? JSON.parse(raw) : [];
        } catch { listings = []; }
        const idx = listings.findIndex(l => l.id === currentPortalListingId);
        if (idx === -1) return;

        if (Array.isArray(listings[idx].gallery) && listings[idx].gallery[index]) {
            const selected = listings[idx].gallery.splice(index, 1)[0];
            listings[idx].gallery.unshift(selected);
            listings[idx].image = selected; // primary cover image
            localStorage.setItem('lb_listings', JSON.stringify(listings));

            // Sync to Firebase Cloud Firestore if online
            if (window.lbCloudSync && typeof window.lbCloudSync.saveListing === 'function') {
                const _syncTarget = (typeof editingId !== 'undefined' && editingId && typeof index !== 'undefined' && listings[index]) 
                    ? listings[index] 
                    : (typeof newListingEntry !== 'undefined' ? newListingEntry : (typeof idx !== 'undefined' && listings[idx] ? listings[idx] : null));
                if (_syncTarget) window.lbCloudSync.saveListing(_syncTarget);
            }
            renderPortalGallery(listings[idx]);
            // Update brand avatar
            const dAvatar = document.getElementById('mDrawerStoreAvatar');
            if (dAvatar) dAvatar.src = selected;
        }
    };

    window.deleteGalleryPhoto = function(index) {
        if (!confirm('Are you sure you want to delete this photo?')) return;
        if (!currentPortalListingId) return;
        let listings = [];
        try {
            const raw = localStorage.getItem('lb_listings');
            listings = raw ? JSON.parse(raw) : [];
        } catch { listings = []; }
        const idx = listings.findIndex(l => l.id === currentPortalListingId);
        if (idx === -1) return;

        if (Array.isArray(listings[idx].gallery) && listings[idx].gallery[index]) {
            listings[idx].gallery.splice(index, 1);
            if (index === 0 && listings[idx].gallery.length > 0) {
                listings[idx].image = listings[idx].gallery[0];
            } else if (listings[idx].gallery.length === 0) {
                listings[idx].image = '';
            }
            localStorage.setItem('lb_listings', JSON.stringify(listings));

            // Sync to Firebase Cloud Firestore if online
            if (window.lbCloudSync && typeof window.lbCloudSync.saveListing === 'function') {
                const _syncTarget = (typeof editingId !== 'undefined' && editingId && typeof index !== 'undefined' && listings[index]) 
                    ? listings[index] 
                    : (typeof newListingEntry !== 'undefined' ? newListingEntry : (typeof idx !== 'undefined' && listings[idx] ? listings[idx] : null));
                if (_syncTarget) window.lbCloudSync.saveListing(_syncTarget);
            }
            renderPortalGallery(listings[idx]);
        }
    };

    // Helper: Safely save and sync portal listing to local storage AND Cloud Firestore
    function syncPortalListingToStorageAndCloud(listingObj) {
        if (!listingObj || !listingObj.id) return;
        try {
            const raw = localStorage.getItem('lb_listings');
            let listings = raw ? JSON.parse(raw) : [];
            const idx = listings.findIndex(l => String(l.id) === String(listingObj.id));
            if (idx !== -1) {
                listings[idx] = listingObj;
            } else {
                listings.push(listingObj);
            }
            localStorage.setItem('lb_listings', JSON.stringify(listings));
            if (window.lbCloudSync && typeof window.lbCloudSync.saveListing === 'function') {
                window.lbCloudSync.saveListing(listingObj);
                console.log(`[Merchant Portal] Listing "${listingObj.name}" (${listingObj.id}) synced to Cloud Firestore.`);
            }
        } catch (e) {
            console.error('Error syncing portal listing:', e);
        }
    }

    // ================= 2. TAB 2: IDENTITY & ADDRESS SUBMIT =================
    window.handlePortalIdentitySubmit = function(e) {
        if (e) e.preventDefault();
        if (!currentPortalListingId) return;

        let listings = [];
        try {
            const raw = localStorage.getItem('lb_listings');
            listings = raw ? JSON.parse(raw) : [];
        } catch { listings = []; }
        const idx = listings.findIndex(l => l.id === currentPortalListingId);
        if (idx === -1) return;

        const name = document.getElementById('mInputBizName')?.value.trim();
        const cat = document.getElementById('mInputBizCategory')?.value;
        const city = document.getElementById('mInputBizCity')?.value.trim();
        const addr = document.getElementById('mInputBizAddress')?.value.trim();

        if (!name || !city) return;

        const oldCat = listings[idx].category;
        listings[idx].name = name;
        if (cat) listings[idx].category = cat;
        listings[idx].city = city;
        listings[idx].address = addr;

        // If category changed, automatically sync In-Store Sliding Categories with the new Category template
        if (cat && cat !== oldCat) {
            listings[idx].storeCategories = getDefaultStoreCategories(cat);
            renderPortalStoreCategories(listings[idx]);
            renderPortalCatalog(listings[idx]);
        }

        syncPortalListingToStorageAndCloud(listings[idx]);
        const dName = document.getElementById('mDrawerStoreName');
        if (dName) dName.textContent = name;
        alert('Identity & Address saved successfully!');
    };

    // ================= 3. TAB 3: ACTION BUTTONS SUBMIT =================
    window.handlePortalActionButtonsSubmit = function(e) {
        if (e) e.preventDefault();
        if (!currentPortalListingId) return;

        let listings = [];
        try {
            const raw = localStorage.getItem('lb_listings');
            listings = raw ? JSON.parse(raw) : [];
        } catch { listings = []; }
        const idx = listings.findIndex(l => l.id === currentPortalListingId);
        if (idx === -1) return;

        const phone = document.getElementById('mInputBizPhone')?.value.trim();
        const whatsapp = document.getElementById('mInputBizWhatsapp')?.value.trim();
        const map = document.getElementById('mInputBizMapLink')?.value.trim();

        if (!phone) return;

        listings[idx].phone = phone;
        listings[idx].whatsapp = whatsapp;
        listings[idx].mapLink = map;

        syncPortalListingToStorageAndCloud(listings[idx]);
        alert('Action Buttons configuration saved successfully!');
    };

    // ================= 4. TAB 4: PRODUCTS & SERVICES (MULTI-IMAGE & STOCK STATUS) =================
    let currentUploadedProductImages = [];
    let currentSelectedFilterCat = 'all';

    function renderPortalCatalog(biz) {
        const grid = document.getElementById('mPortalCatalogGrid');
        const filterChips = document.getElementById('mPortalCatFilterChips');
        const catSelect = document.getElementById('pCatItemCategory');
        if (!grid) return;

        const rawStoreCats = Array.isArray(biz.storeCategories) && biz.storeCategories.length > 0
            ? biz.storeCategories
            : getDefaultStoreCategories(biz.category);

        const storeCats = rawStoreCats.map(c => {
            const label = typeof c === 'string' ? c.trim() : (c.label || c.name || 'Category').trim();
            const tag = typeof c === 'string'
                ? label.toLowerCase().replace(/[^a-z0-9]+/g, '-')
                : (c.tag || label.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
            return { label, tag };
        });

        // Populate Category dropdown in Add/Edit Product Modal
        if (catSelect) {
            catSelect.innerHTML = '<option value="">Select In-Store Category</option>' + 
                storeCats.map(c => `<option value="${c.tag || c.label}">${c.label}</option>`).join('');
        }

        // Populate Filter chips bar
        if (filterChips) {
            filterChips.innerHTML = `
                <button type="button" class="m-filter-chip ${currentSelectedFilterCat === 'all' ? 'active' : ''}" onclick="filterPortalCatalogByCat('all')">All</button>
            ` + storeCats.map(c => `
                <button type="button" class="m-filter-chip ${currentSelectedFilterCat === (c.tag || c.label) ? 'active' : ''}" onclick="filterPortalCatalogByCat('${c.tag || c.label}')">${c.label}</button>
            `).join('');
        }

        const items = Array.isArray(biz.products) ? biz.products : [];
        let filteredItems = items;
        if (currentSelectedFilterCat !== 'all') {
            filteredItems = items.filter(p => (p.category || '').toLowerCase() === currentSelectedFilterCat.toLowerCase());
        }

        if (filteredItems.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align:center; padding:2.5rem; background:#f8fafc; border:1px dashed #cbd5e1; border-radius:14px;">
                    <i class="fa-solid fa-box-open" style="font-size:2rem; color:#94a3b8; margin-bottom:0.5rem;"></i>
                    <p style="margin:0; font-size:0.9rem; font-weight:700; color:#334155;">No Products Found</p>
                    <span style="font-size:0.8rem; color:#64748b;">Click "Add Product" to create products under this category with multiple images.</span>
                </div>
            `;
            return;
        }

        grid.innerHTML = filteredItems.map((p) => {
            const realIdx = items.indexOf(p);
            const coverImg = (Array.isArray(p.images) && p.images[0]) || p.image || p.img || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=90';
            const imgCount = Array.isArray(p.images) ? p.images.length : (p.image ? 1 : 0);
            const isOutOfStock = p.stockStatus === 'out_of_stock';

            return `
                <div class="m-catalog-card ${isOutOfStock ? 'is-out-of-stock' : ''}">
                    <div class="m-cat-card-left" onclick="openProductPreviewModal(${realIdx})" style="cursor:pointer;" title="Click to view details & slide all images">
                        <div class="m-cat-card-thumb-wrap">
                            <img src="${coverImg}" alt="${p.name}" class="m-cat-card-thumb">
                            ${imgCount > 1 ? `<span class="m-cat-img-count-badge"><i class="fa-regular fa-images"></i> ${imgCount}</span>` : ''}
                        </div>
                        <div class="m-cat-card-info">
                            <strong class="m-cat-card-name">${p.name || 'Product'}</strong>
                            <div class="m-cat-card-price-row">
                                <span class="m-cat-card-price">${p.price || 'Price on Request'}</span>
                                <span class="m-stock-pill ${isOutOfStock ? 'out' : 'in'}">${isOutOfStock ? 'Out of Stock' : 'In Stock'}</span>
                            </div>
                            <span class="m-cat-card-cat-tag">Category: ${p.category || 'General'}</span>
                        </div>
                    </div>
                    <div class="m-cat-card-actions">
                        <button type="button" class="btn-card-action ${p.isTopProduct ? 'is-top-active' : ''}" onclick="toggleTopProduct(${realIdx})" title="${p.isTopProduct ? 'Remove from Top Products' : 'Feature as Top Product'}">
                            <i class="fa-${p.isTopProduct ? 'solid' : 'regular'} fa-star" style="${p.isTopProduct ? 'color:#f59e0b;' : 'color:#94a3b8;'}"></i>
                        </button>
                        <button type="button" class="btn-card-action" onclick="openProductPreviewModal(${realIdx})" title="Slide & View Details">
                            <i class="fa-solid fa-eye"></i>
                        </button>
                        <button type="button" class="btn-card-action" onclick="openPortalCatalogModal('product', ${realIdx})" title="Edit Product">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button type="button" class="btn-card-action del" onclick="deletePortalCatalogItem(${realIdx})" title="Delete Product">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        renderPortalTopProducts(biz);
    }

    window.filterPortalCatalogByCat = function(tag) {
        currentSelectedFilterCat = tag;
        let listings = [];
        try {
            const raw = localStorage.getItem('lb_listings');
            listings = raw ? JSON.parse(raw) : [];
        } catch { listings = []; }
        const biz = listings.find(l => l.id === currentPortalListingId);
        if (biz) renderPortalCatalog(biz);
    };

    const portalCatalogModal = document.getElementById('portalCatalogModal');
    const pCatItemIndex = document.getElementById('pCatItemIndex');
    const pCatItemName = document.getElementById('pCatItemName');
    const pCatItemCategory = document.getElementById('pCatItemCategory');
    const pCatItemPrice = document.getElementById('pCatItemPrice');
    const pCatItemStock = document.getElementById('pCatItemStock');
    const pCatItemDetails = document.getElementById('pCatItemDetails');
    const pCatImagesPreviewRow = document.getElementById('pCatImagesPreviewRow');

    window.openPortalCatalogModal = function(type, index = -1) {
        if (!portalCatalogModal) return;
        pCatItemIndex.value = index;
        currentUploadedProductImages = [];

        let listings = [];
        try {
            const raw = localStorage.getItem('lb_listings');
            listings = raw ? JSON.parse(raw) : [];
        } catch { listings = []; }
        const biz = listings.find(l => l.id === currentPortalListingId);

        const title = document.getElementById('portalCatalogModalTitle');
        if (index >= 0 && biz && Array.isArray(biz.products) && biz.products[index]) {
            const p = biz.products[index];
            if (title) title.innerHTML = '<i class="fa-solid fa-pen-to-square text-primary"></i> Edit Product';
            if (pCatItemName) pCatItemName.value = p.name || '';
            if (pCatItemCategory) pCatItemCategory.value = p.category || '';
            if (pCatItemPrice) pCatItemPrice.value = p.price || '';
            if (pCatItemStock) pCatItemStock.value = p.stockStatus || 'in_stock';
            if (pCatItemDetails) pCatItemDetails.value = p.details || p.description || '';
            const pCatItemIsTop = document.getElementById('pCatItemIsTop');
            if (pCatItemIsTop) pCatItemIsTop.checked = !!p.isTopProduct;
            currentUploadedProductImages = Array.isArray(p.images) ? [...p.images] : (p.image ? [p.image] : []);
        } else {
            if (title) title.innerHTML = '<i class="fa-solid fa-box-open text-primary"></i> Add Product';
            if (pCatItemName) pCatItemName.value = '';
            if (pCatItemCategory) pCatItemCategory.value = currentSelectedFilterCat !== 'all' ? currentSelectedFilterCat : '';
            if (pCatItemPrice) pCatItemPrice.value = '';
            if (pCatItemStock) pCatItemStock.value = 'in_stock';
            if (pCatItemDetails) pCatItemDetails.value = '';
            const pCatItemIsTop = document.getElementById('pCatItemIsTop');
            if (pCatItemIsTop) pCatItemIsTop.checked = false;
            currentUploadedProductImages = [];
        }

        renderProductModalThumbs();
        portalCatalogModal.classList.add('active');
        portalCatalogModal.style.display = 'flex';
    };

    window.closePortalCatalogModal = function() {
        if (portalCatalogModal) {
            portalCatalogModal.classList.remove('active');
            portalCatalogModal.style.display = 'none';
        }
        currentUploadedProductImages = [];
    };

    window.handleProductMultiImagesUpload = function(input) {
        if (!input.files || input.files.length === 0) return;
        const files = Array.from(input.files);

        files.forEach(file => {
            compressFileImage(file, 220, 1000)
                .then(compressedUrl => {
                    currentUploadedProductImages.push(compressedUrl);
                    renderProductModalThumbs();
                })
                .catch(() => {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        currentUploadedProductImages.push(e.target.result);
                        renderProductModalThumbs();
                    };
                    reader.readAsDataURL(file);
                });
        });
        input.value = '';
    };

    function renderProductModalThumbs() {
        if (!pCatImagesPreviewRow) return;
        if (currentUploadedProductImages.length === 0) {
            pCatImagesPreviewRow.innerHTML = '';
            return;
        }

        pCatImagesPreviewRow.innerHTML = currentUploadedProductImages.map((imgUrl, idx) => `
            <div class="m-modal-thumb-item ${idx === 0 ? 'is-first' : ''}">
                <img src="${imgUrl}" alt="Photo ${idx + 1}">
                ${idx === 0 ? '<span class="thumb-badge">1st (Cover)</span>' : ''}
                <button type="button" class="btn-thumb-remove" onclick="removeProductModalThumb(${idx})"><i class="fa-solid fa-xmark"></i></button>
            </div>
        `).join('');
    }

    window.removeProductModalThumb = function(idx) {
        currentUploadedProductImages.splice(idx, 1);
        renderProductModalThumbs();
    };

    window.handlePortalCatalogSubmit = function(e) {
        if (e) e.preventDefault();
        const index = parseInt(pCatItemIndex.value, 10);
        const name = pCatItemName.value.trim();
        const category = pCatItemCategory.value;
        const price = pCatItemPrice.value.trim();
        const stockStatus = pCatItemStock.value;
        const details = pCatItemDetails.value.trim();
        const isTopProduct = document.getElementById('pCatItemIsTop')?.checked || false;

        if (!name || !currentPortalListingId) return;

        let listings = [];
        try {
            const raw = localStorage.getItem('lb_listings');
            listings = raw ? JSON.parse(raw) : [];
        } catch { listings = []; }
        const idx = listings.findIndex(l => l.id === currentPortalListingId);
        if (idx === -1) return;

        if (!Array.isArray(listings[idx].products)) listings[idx].products = [];

        const itemObj = {
            name,
            category: category || 'General',
            price: price || 'On Request',
            stockStatus: stockStatus || 'in_stock',
            details: details || '',
            isTopProduct: isTopProduct,
            images: currentUploadedProductImages.length > 0 ? currentUploadedProductImages : ['https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=90'],
            image: currentUploadedProductImages[0] || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=90'
        };

        if (index >= 0 && index < listings[idx].products.length) {
            listings[idx].products[index] = itemObj;
        } else {
            listings[idx].products.push(itemObj);
        }

        syncPortalListingToStorageAndCloud(listings[idx]);
        closePortalCatalogModal();
        renderPortalCatalog(listings[idx]);
    };

    // ---------------- 3. TOP PRODUCTS SHOWCASE ----------------
    function renderPortalTopProducts(biz) {
        const topGrid = document.getElementById('mPortalTopProductsGrid');
        if (!topGrid) return;

        const allProds = Array.isArray(biz.products) ? biz.products : [];
        const topProds = allProds.filter(p => p.isTopProduct === true);

        if (topProds.length === 0) {
            topGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align:center; padding:1.75rem; background:#fffbeb; border:1px dashed #fde68a; border-radius:12px; color:#92400e;">
                    <i class="fa-solid fa-star" style="font-size:1.6rem; color:#f59e0b; margin-bottom:0.35rem;"></i>
                    <p style="margin:0; font-size:0.88rem; font-weight:700;">No Top Products Featured</p>
                    <span style="font-size:0.78rem; color:#b45309;">Click "Select Top Products" or click the star (<i class="fa-solid fa-star" style="color:#f59e0b;"></i>) on any catalog product above to feature it in the square shelf on your storefront.</span>
                </div>
            `;
            return;
        }

        topGrid.innerHTML = topProds.map(p => {
            const realIdx = allProds.indexOf(p);
            const coverImg = (Array.isArray(p.images) && p.images[0]) || p.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=90';
            return `
                <div class="m-top-prod-card">
                    <img src="${coverImg}" alt="${p.name}" class="m-top-prod-thumb">
                    <div class="m-top-prod-info">
                        <strong class="m-top-prod-name" title="${p.name}">${p.name}</strong>
                        <div style="display:flex; align-items:center; gap:0.5rem; margin-top:2px;">
                            <span class="m-top-prod-price">${p.price || '₹ 0'}</span>
                            <span class="m-top-prod-cat">${p.category || 'General'}</span>
                        </div>
                    </div>
                    <button type="button" class="btn-card-action del" onclick="toggleTopProduct(${realIdx})" title="Remove from Top Products">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
            `;
        }).join('');
    }

    window.toggleTopProduct = function(index) {
        let listings = [];
        try {
            const raw = localStorage.getItem('lb_listings');
            listings = raw ? JSON.parse(raw) : [];
        } catch { listings = []; }
        const idx = listings.findIndex(l => l.id === currentPortalListingId);
        if (idx === -1 || !Array.isArray(listings[idx].products) || !listings[idx].products[index]) return;

        listings[idx].products[index].isTopProduct = !listings[idx].products[index].isTopProduct;
        syncPortalListingToStorageAndCloud(listings[idx]);
        renderPortalCatalog(listings[idx]);
    };

    window.openSelectTopProductsModal = function() {
        const modal = document.getElementById('selectTopProductsModal');
        const listEl = document.getElementById('mTopSelectItemsList');
        if (!modal || !listEl) return;

        let listings = [];
        try {
            const raw = localStorage.getItem('lb_listings');
            listings = raw ? JSON.parse(raw) : [];
        } catch { listings = []; }
        const biz = listings.find(l => l.id === currentPortalListingId);
        const prods = (biz && Array.isArray(biz.products)) ? biz.products : [];

        if (prods.length === 0) {
            listEl.innerHTML = `<div style="text-align:center; padding:1.5rem; color:#64748b; font-size:0.85rem;">No products added in your catalog yet. Please add products first.</div>`;
        } else {
            listEl.innerHTML = prods.map((p, idx) => {
                const coverImg = (Array.isArray(p.images) && p.images[0]) || p.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=90';
                const checked = p.isTopProduct ? 'checked' : '';
                return `
                    <label class="m-top-select-item" style="display:flex; align-items:center; gap:0.75rem; padding:0.6rem 0.8rem; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; cursor:pointer;">
                        <input type="checkbox" class="top-prod-checkbox" data-index="${idx}" ${checked} style="width:18px; height:18px; accent-color:#f59e0b; cursor:pointer;">
                        <img src="${coverImg}" style="width:40px; height:40px; border-radius:8px; object-fit:cover;">
                        <div style="flex:1; min-width:0;">
                            <strong style="display:block; font-size:0.88rem; color:#1e293b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.name}</strong>
                            <span style="font-size:0.78rem; color:#64748b;">${p.category || 'General'} • <span style="font-weight:700; color:#0f172a;">${p.price || ''}</span></span>
                        </div>
                    </label>
                `;
            }).join('');
        }

        modal.classList.add('active');
        modal.style.display = 'flex';
    };

    window.closeSelectTopProductsModal = function() {
        const modal = document.getElementById('selectTopProductsModal');
        if (modal) {
            modal.classList.remove('active');
            modal.style.display = 'none';
        }
    };

    window.saveTopProductsSelection = function() {
        let listings = [];
        try {
            const raw = localStorage.getItem('lb_listings');
            listings = raw ? JSON.parse(raw) : [];
        } catch { listings = []; }
        const idx = listings.findIndex(l => l.id === currentPortalListingId);
        if (idx === -1 || !Array.isArray(listings[idx].products)) return;

        const checkboxes = document.querySelectorAll('.top-prod-checkbox');
        checkboxes.forEach(cb => {
            const itemIdx = parseInt(cb.dataset.index, 10);
            if (listings[idx].products[itemIdx]) {
                listings[idx].products[itemIdx].isTopProduct = cb.checked;
            }
        });

        syncPortalListingToStorageAndCloud(listings[idx]);
        closeSelectTopProductsModal();
        renderPortalCatalog(listings[idx]);
    };

    window.deletePortalCatalogItem = function(index) {
        if (!confirm('Are you sure you want to delete this product?')) return;
        let listings = [];
        try {
            const raw = localStorage.getItem('lb_listings');
            listings = raw ? JSON.parse(raw) : [];
        } catch { listings = []; }
        const idx = listings.findIndex(l => l.id === currentPortalListingId);
        if (idx === -1) return;

        if (Array.isArray(listings[idx].products)) {
            listings[idx].products.splice(index, 1);
            syncPortalListingToStorageAndCloud(listings[idx]);
            renderPortalCatalog(listings[idx]);
        }
    };

    // ================= 4B. PRODUCT PREVIEW SLIDER MODAL =================
    const portalProductPreviewModal = document.getElementById('portalProductPreviewModal');
    const prevSliderTrack = document.getElementById('prevSliderTrack');
    const prevSliderDots = document.getElementById('prevSliderDots');
    const prevPrice = document.getElementById('prevPrice');
    const prevStockBadge = document.getElementById('prevStockBadge');
    const prevName = document.getElementById('prevName');
    const prevDesc = document.getElementById('prevDesc');

    window.openProductPreviewModal = function(index) {
        if (!portalProductPreviewModal) return;
        let listings = [];
        try {
            const raw = localStorage.getItem('lb_listings');
            listings = raw ? JSON.parse(raw) : [];
        } catch { listings = []; }
        const biz = listings.find(l => l.id === currentPortalListingId);
        if (!biz || !Array.isArray(biz.products) || !biz.products[index]) return;

        const p = biz.products[index];
        const imgs = Array.isArray(p.images) && p.images.length > 0 ? p.images : [p.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400'];

        if (prevName) prevName.textContent = p.name || 'Product Details';
        if (prevPrice) prevPrice.textContent = p.price || 'Price on Request';
        if (prevDesc) prevDesc.textContent = p.details || p.description || 'No detailed specifications provided for this product.';
        
        if (prevStockBadge) {
            const isOut = p.stockStatus === 'out_of_stock';
            prevStockBadge.className = `m-prev-stock-badge ${isOut ? 'out' : 'in'}`;
            prevStockBadge.textContent = isOut ? 'Out of Stock' : 'In Stock';
        }

        // Render Image Track
        if (prevSliderTrack) {
            prevSliderTrack.innerHTML = imgs.map(img => `
                <div class="m-prev-slide-item">
                    <img src="${img}" alt="${p.name}">
                </div>
            `).join('');
            prevSliderTrack.scrollLeft = 0;
        }

        // Render Dots
        if (prevSliderDots) {
            prevSliderDots.innerHTML = imgs.map((_, i) => `
                <span class="m-prev-dot ${i === 0 ? 'active' : ''}"></span>
            `).join('');
        }

        portalProductPreviewModal.classList.add('active');
        portalProductPreviewModal.style.display = 'flex';
    };

    window.closeProductPreviewModal = function() {
        if (portalProductPreviewModal) {
            portalProductPreviewModal.classList.remove('active');
            portalProductPreviewModal.style.display = 'none';
        }
    };

    // ================= 5. TAB 5: BANNERS (16:9 RATIO) =================
    function renderPortalBanners(biz) {
        const grid = document.getElementById('mPortalBannersGrid');
        if (!grid) return;

        const banners = Array.isArray(biz.banners) ? biz.banners : [];

        if (banners.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align:center; padding:3rem 1.5rem; background:#f8fafc; border:1.5px dashed #cbd5e1; border-radius:14px;">
                    <i class="fa-solid fa-bullhorn" style="font-size:2.4rem; color:#94a3b8; margin-bottom:0.75rem;"></i>
                    <h4 style="margin:0 0 0.35rem 0; font-size:1.05rem; font-weight:700; color:#1e293b;">No Promotional Banners Yet</h4>
                    <p style="margin:0 0 1.25rem 0; font-size:0.85rem; color:#64748b; max-width:440px; margin-inline:auto;">Upload 16:9 banner images or design festive promo cards for your storefront header carousel.</p>
                    <button type="button" class="btn-portal-primary-sm" onclick="openPortalBannerModal()" style="display:inline-flex; align-items:center; gap:6px;">
                        <i class="fa-solid fa-plus"></i> Add First Banner
                    </button>
                </div>
            `;
            return;
        }

        grid.innerHTML = banners.map((b, idx) => {
            if (b.type === 'custom_image' || b.image) {
                return `
                    <div class="m-banner-16-9-card">
                        <img src="${b.image}" alt="16:9 Banner ${idx + 1}" class="m-banner-16-9-img" loading="lazy">
                        <div class="m-banner-16-9-overlay">
                            <span class="m-banner-16-9-badge">16:9 Banner</span>
                            <div class="m-banner-bottom-row">
                                <button type="button" class="btn-banner-ctrl" onclick="openPortalBannerModal(${idx})"><i class="fa-solid fa-pen"></i> Edit</button>
                                <button type="button" class="btn-banner-ctrl" onclick="deletePortalBanner(${idx})"><i class="fa-solid fa-trash-can"></i> Delete</button>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                return `
                    <div class="m-banner-card ${b.theme || 'festive-ad-1'}">
                        <div>
                            <span class="m-banner-chip">${b.badge || 'PROMO'}</span>
                            <h4 class="m-banner-headline">${b.heading || 'Festive Offer'}</h4>
                            <p class="m-banner-deal">${b.deal || 'Exclusive discount available'}</p>
                        </div>
                        <div class="m-banner-bottom-row">
                            <button type="button" class="btn-banner-ctrl" onclick="openPortalBannerModal(${idx})"><i class="fa-solid fa-pen"></i> Edit</button>
                            <button type="button" class="btn-banner-ctrl" onclick="deletePortalBanner(${idx})"><i class="fa-solid fa-trash-can"></i> Delete</button>
                        </div>
                    </div>
                `;
            }
        }).join('');
    }

    window.toggleBannerUploadType = function(val) {
        const imgBlock = document.getElementById('pBannerImageUploadBlock');
        const cardBlock = document.getElementById('pBannerCardDetailsBlock');
        if (val === 'custom_image') {
            if (imgBlock) imgBlock.style.display = 'block';
            if (cardBlock) cardBlock.style.display = 'none';
        } else {
            if (imgBlock) imgBlock.style.display = 'none';
            if (cardBlock) cardBlock.style.display = 'block';
        }
    };

    window.previewPortalBannerImage = async function(input) {
        if (!input || !input.files || !input.files[0]) return;

        const file = input.files[0];
        const placeholder = document.getElementById('pBannerPlaceholder');
        const previewImg = document.getElementById('pBannerPreviewImg');
        const changeBadge = document.getElementById('pBannerChangeBadge');
        const dataInput = document.getElementById('pBannerImgData');
        const saveBtn = document.querySelector('#portalBannerForm button[type="submit"]');

        if (placeholder) {
            placeholder.style.display = 'flex';
            placeholder.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="font-size:1.8rem; color:#2563eb;"></i><span style="font-weight:700; color:#2563eb;">Optimizing 16:9 banner image...</span>`;
        }
        if (previewImg) previewImg.style.display = 'none';
        if (changeBadge) changeBadge.style.display = 'none';
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Processing...`;
        }

        try {
            // Compress to max 220KB and 1280px width (HD 16:9 resolution)
            const compressed = await compressFileImage(file, 220, 1280);
            if (dataInput) dataInput.value = compressed;
            if (previewImg) {
                previewImg.src = compressed;
                previewImg.style.display = 'block';
            }
            if (changeBadge) changeBadge.style.display = 'block';
            if (placeholder) {
                placeholder.style.display = 'none';
                placeholder.innerHTML = `<i class="fa-solid fa-image"></i><span>Click to upload 16:9 banner image</span>`;
            }
        } catch (err) {
            console.warn('Banner compression fallback:', err);
            const reader = new FileReader();
            reader.onload = function(e) {
                if (dataInput) dataInput.value = e.target.result;
                if (previewImg) {
                    previewImg.src = e.target.result;
                    previewImg.style.display = 'block';
                }
                if (changeBadge) changeBadge.style.display = 'block';
                if (placeholder) {
                    placeholder.style.display = 'none';
                    placeholder.innerHTML = `<i class="fa-solid fa-image"></i><span>Click to upload 16:9 banner image</span>`;
                }
            };
            reader.readAsDataURL(file);
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = `<i class="fa-solid fa-check"></i> Save Banner`;
            }
        }
    };

    window.openPortalBannerModal = function(index = -1) {
        const modal = document.getElementById('portalBannerModal');
        if (!modal) return;

        const pIndex = document.getElementById('pBannerIndex');
        const pType = document.getElementById('pBannerTypeSelect');
        const pImgData = document.getElementById('pBannerImgData');
        const pPreviewImg = document.getElementById('pBannerPreviewImg');
        const pPlaceholder = document.getElementById('pBannerPlaceholder');
        const pBadge = document.getElementById('pBannerBadge');
        const pHeading = document.getElementById('pBannerHeading');
        const pDeal = document.getElementById('pBannerDeal');
        const pTheme = document.getElementById('pBannerTheme');
        const fileInput = document.getElementById('pBannerFileInput');
        const title = document.getElementById('portalBannerModalTitle');
        const changeBadge = document.getElementById('pBannerChangeBadge');
        const saveBtn = document.querySelector('#portalBannerForm button[type="submit"]');

        if (pIndex) pIndex.value = index;
        if (fileInput) fileInput.value = '';
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = `<i class="fa-solid fa-check"></i> Save Banner`;
        }

        let listings = [];
        try {
            const raw = localStorage.getItem('lb_listings');
            listings = raw ? JSON.parse(raw) : [];
        } catch { listings = []; }
        const biz = listings.find(l => String(l.id).trim() === String(currentPortalListingId).trim());

        if (index >= 0 && biz && Array.isArray(biz.banners) && biz.banners[index]) {
            const b = biz.banners[index];
            if (title) title.innerHTML = '<i class="fa-solid fa-pen-to-square text-primary"></i> Edit Banner';
            const bType = b.type || (b.image ? 'custom_image' : 'styled_card');
            if (pType) pType.value = bType;
            window.toggleBannerUploadType(bType);

            if (pImgData) pImgData.value = b.image || '';
            if (b.image && pPreviewImg) {
                pPreviewImg.src = b.image;
                pPreviewImg.style.display = 'block';
                if (changeBadge) changeBadge.style.display = 'block';
                if (pPlaceholder) pPlaceholder.style.display = 'none';
            } else {
                if (pPreviewImg) pPreviewImg.style.display = 'none';
                if (changeBadge) changeBadge.style.display = 'none';
                if (pPlaceholder) {
                    pPlaceholder.style.display = 'flex';
                    pPlaceholder.innerHTML = `<i class="fa-solid fa-image"></i><span>Click to upload 16:9 banner image</span>`;
                }
            }

            if (pBadge) pBadge.value = b.badge || '';
            if (pHeading) pHeading.value = b.heading || '';
            if (pDeal) pDeal.value = b.deal || '';
            if (pTheme) pTheme.value = b.theme || 'festive-ad-1';
        } else {
            if (title) title.innerHTML = '<i class="fa-solid fa-bullhorn text-primary"></i> Add Banner (16:9)';
            if (pType) pType.value = 'custom_image';
            window.toggleBannerUploadType('custom_image');
            if (pImgData) pImgData.value = '';
            if (pPreviewImg) {
                pPreviewImg.src = '';
                pPreviewImg.style.display = 'none';
            }
            if (changeBadge) changeBadge.style.display = 'none';
            if (pPlaceholder) {
                pPlaceholder.style.display = 'flex';
                pPlaceholder.innerHTML = `<i class="fa-solid fa-image"></i><span>Click to upload 16:9 banner image</span>`;
            }
            if (pBadge) pBadge.value = 'FESTIVE SALE';
            if (pHeading) pHeading.value = 'Special Discount Available';
            if (pDeal) pDeal.value = 'Flat 20% OFF on all store inquiries this week';
            if (pTheme) pTheme.value = 'festive-ad-1';
        }

        modal.classList.add('active');
        modal.style.display = 'flex';
    };

    window.closePortalBannerModal = function() {
        const modal = document.getElementById('portalBannerModal');
        if (modal) {
            modal.classList.remove('active');
            modal.style.display = 'none';
        }
    };

    window.handlePortalBannerSubmit = function(e) {
        if (e) e.preventDefault();

        const pIndex = document.getElementById('pBannerIndex');
        const pType = document.getElementById('pBannerTypeSelect');
        const pImgData = document.getElementById('pBannerImgData');
        const pBadge = document.getElementById('pBannerBadge');
        const pHeading = document.getElementById('pBannerHeading');
        const pDeal = document.getElementById('pBannerDeal');
        const pTheme = document.getElementById('pBannerTheme');

        const index = parseInt(pIndex ? pIndex.value : '-1', 10);
        const type = pType ? pType.value : 'custom_image';
        const img = pImgData ? pImgData.value.trim() : '';
        const badge = pBadge ? pBadge.value.trim() : '';
        const heading = pHeading ? pHeading.value.trim() : '';
        const deal = pDeal ? pDeal.value.trim() : '';
        const theme = pTheme ? pTheme.value : 'festive-ad-1';

        if (!currentPortalListingId) {
            alert('Store session not active. Please select your business again.');
            return;
        }

        let listings = [];
        try {
            const raw = localStorage.getItem('lb_listings');
            listings = raw ? JSON.parse(raw) : [];
        } catch { listings = []; }

        const idx = listings.findIndex(l => String(l.id).trim() === String(currentPortalListingId).trim());
        if (idx === -1) {
            alert('Business listing could not be found.');
            return;
        }

        if (!Array.isArray(listings[idx].banners)) {
            listings[idx].banners = [];
        }

        let bObj = {};
        if (type === 'custom_image') {
            if (!img) {
                alert('Please click the upload box to choose an image for your 16:9 banner.');
                return;
            }
            bObj = {
                type: 'custom_image',
                image: img
            };
        } else {
            if (!heading) {
                alert('Please enter a headline for the promotional card.');
                return;
            }
            bObj = {
                type: 'styled_card',
                badge: badge || 'SPECIAL DEAL',
                heading: heading,
                deal: deal || 'Exclusive discounts',
                theme: theme
            };
        }

        if (index >= 0 && index < listings[idx].banners.length) {
            listings[idx].banners[index] = bObj;
        } else {
            listings[idx].banners.push(bObj);
        }

        try {
            syncPortalListingToStorageAndCloud(listings[idx]);
        } catch (storageErr) {
            console.error('LocalStorage quota error while saving banner:', storageErr);
            alert('Storage limit reached! Please use a smaller image file or remove older photos.');
            return;
        }

        window.closePortalBannerModal();
        renderPortalBanners(listings[idx]);
    };

    window.deletePortalBanner = function(index) {
        if (!confirm('Are you sure you want to delete this banner?')) return;
        if (!currentPortalListingId) return;

        let listings = [];
        try {
            const raw = localStorage.getItem('lb_listings');
            listings = raw ? JSON.parse(raw) : [];
        } catch { listings = []; }

        const idx = listings.findIndex(l => String(l.id).trim() === String(currentPortalListingId).trim());
        if (idx === -1) return;

        if (Array.isArray(listings[idx].banners) && index >= 0 && index < listings[idx].banners.length) {
            listings[idx].banners.splice(index, 1);
            try {
                syncPortalListingToStorageAndCloud(listings[idx]);
            } catch (err) {
                console.error('Error saving listings after delete:', err);
            }
            renderPortalBanners(listings[idx]);
        }
    };

    // ================= 6. TAB 6: SCHEDULE (DAILY OPEN/CLOSE HOURS) =================
    const allWeekDaysList = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    function renderPortalDailySchedule(biz) {
        const container = document.getElementById('mPortalDailyScheduleList');
        const holsInput = document.getElementById('mInputScheduleHolidays');
        if (!container) return;

        if (holsInput) {
            holsInput.value = Array.isArray(biz.holidays) ? biz.holidays.join(', ') : (biz.holidays || '');
        }

        const openDays = Array.isArray(biz.openDays) && biz.openDays.length > 0 ? biz.openDays : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dailySchedule = biz.dailySchedule && typeof biz.dailySchedule === 'object' ? biz.dailySchedule : {};

        container.innerHTML = allWeekDaysList.map(day => {
            const dayData = dailySchedule[day] || {
                isOpen: openDays.includes(day),
                openTime: '09:00',
                openAmPm: 'AM',
                closeTime: '08:30',
                closeAmPm: 'PM'
            };
            const isOpen = dayData.isOpen !== false && openDays.includes(day);

            return `
                <div class="m-day-schedule-row ${isOpen ? '' : 'is-closed'}" id="rowDay_${day}">
                    <div class="m-day-toggle-col">
                        <label class="m-switch-wrap">
                            <input type="checkbox" id="cbIsOpen_${day}" ${isOpen ? 'checked' : ''} onchange="toggleDayRowState('${day}', this.checked)">
                            <span class="m-switch-slider"></span>
                        </label>
                        <strong class="m-day-name">${day}</strong>
                        <span class="m-day-status-pill ${isOpen ? 'open' : 'closed'}" id="pillStatus_${day}">${isOpen ? 'Open' : 'Off'}</span>
                    </div>

                    <div class="m-day-times-col" id="timesCol_${day}" style="${isOpen ? '' : 'opacity:0.4; pointer-events:none;'}">
                        <div class="m-time-picker-group">
                            <span class="m-time-lbl">Open:</span>
                            <input type="text" class="m-time-input" id="openTime_${day}" value="${dayData.openTime || '09:00'}" placeholder="09:00">
                            <select class="m-ampm-select" id="openAmPm_${day}">
                                <option value="AM" ${dayData.openAmPm === 'AM' ? 'selected' : ''}>AM</option>
                                <option value="PM" ${dayData.openAmPm === 'PM' ? 'selected' : ''}>PM</option>
                            </select>
                        </div>
                        <span class="m-time-divider">to</span>
                        <div class="m-time-picker-group">
                            <span class="m-time-lbl">Close:</span>
                            <input type="text" class="m-time-input" id="closeTime_${day}" value="${dayData.closeTime || '08:30'}" placeholder="08:30">
                            <select class="m-ampm-select" id="closeAmPm_${day}">
                                <option value="AM" ${dayData.closeAmPm === 'AM' ? 'selected' : ''}>AM</option>
                                <option value="PM" ${dayData.closeAmPm === 'PM' ? 'selected' : ''}>PM</option>
                            </select>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    window.toggleDayRowState = function(day, isChecked) {
        const row = document.getElementById(`rowDay_${day}`);
        const pill = document.getElementById(`pillStatus_${day}`);
        const timesCol = document.getElementById(`timesCol_${day}`);
        if (row) row.classList.toggle('is-closed', !isChecked);
        if (pill) {
            pill.className = `m-day-status-pill ${isChecked ? 'open' : 'closed'}`;
            pill.textContent = isChecked ? 'Open' : 'Off';
        }
        if (timesCol) {
            timesCol.style.opacity = isChecked ? '1' : '0.4';
            timesCol.style.pointerEvents = isChecked ? 'auto' : 'none';
        }
    };

    window.handlePortalScheduleSubmit = function(e) {
        if (e) e.preventDefault();
        if (!currentPortalListingId) return;

        let listings = [];
        try {
            const raw = localStorage.getItem('lb_listings');
            listings = raw ? JSON.parse(raw) : [];
        } catch { listings = []; }
        const idx = listings.findIndex(l => l.id === currentPortalListingId);
        if (idx === -1) return;

        const dailySchedule = {};
        const openDays = [];

        allWeekDaysList.forEach(day => {
            const cb = document.getElementById(`cbIsOpen_${day}`);
            const isOpen = cb ? cb.checked : false;
            const openTime = document.getElementById(`openTime_${day}`)?.value.trim() || '09:00';
            const openAmPm = document.getElementById(`openAmPm_${day}`)?.value || 'AM';
            const closeTime = document.getElementById(`closeTime_${day}`)?.value.trim() || '08:30';
            const closeAmPm = document.getElementById(`closeAmPm_${day}`)?.value || 'PM';

            if (isOpen) openDays.push(day);
            dailySchedule[day] = { isOpen, openTime, openAmPm, closeTime, closeAmPm };
        });

        const hols = document.getElementById('mInputScheduleHolidays')?.value.trim();

        listings[idx].dailySchedule = dailySchedule;
        listings[idx].openDays = openDays.length > 0 ? openDays : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        listings[idx].scheduleTimings = `${dailySchedule['Monday']?.openTime || '09:00'} ${dailySchedule['Monday']?.openAmPm || 'AM'} - ${dailySchedule['Monday']?.closeTime || '08:30'} ${dailySchedule['Monday']?.closeAmPm || 'PM'}`;
        listings[idx].holidays = hols ? hols.split(',').map(s => s.trim()).filter(Boolean) : [];

        syncPortalListingToStorageAndCloud(listings[idx]);
        alert('Daily schedule and timings updated successfully!');
    };

    // ================= 7. TAB 7: INBOX (CUSTOMER DIRECT INQUIRIES & REPLIES) =================
    let activeInboxThreadId = null;
    let portalInboxUnsub = null;

    function getStoreInboxMessages(storeId) {
        try {
            const raw = localStorage.getItem(`lb_store_inbox_${storeId}`);
            if (raw) return JSON.parse(raw);
        } catch {}
        return [];
    }

    function saveStoreInboxMessages(storeId, threads) {
        localStorage.setItem(`lb_store_inbox_${storeId}`, JSON.stringify(threads));
    }

    function attachPortalInboxCloudListener(storeId) {
        if (!storeId) return;
        if (portalInboxUnsub) {
            try { portalInboxUnsub(); } catch (e) {}
            portalInboxUnsub = null;
        }

        if (window.lbCloudSync && typeof window.lbCloudSync.listenStoreInbox === 'function') {
            portalInboxUnsub = window.lbCloudSync.listenStoreInbox(storeId, (cloudMessages) => {
                if (!Array.isArray(cloudMessages) || cloudMessages.length === 0) return;

                let threads = getStoreInboxMessages(storeId);
                let updated = false;

                cloudMessages.forEach(m => {
                    const cName = m.customerName || 'Local Customer';
                    const cPhone = m.customerPhone || '';

                    let thread = threads.find(t => 
                        (cPhone && cPhone !== 'In-App Direct Chat' && t.userPhone === cPhone) || 
                        (t.userName && t.userName.toLowerCase() === cName.toLowerCase())
                    );

                    if (!thread) {
                        thread = {
                            id: 'msg_' + (m.timestamp || Date.now()) + '_' + Math.random().toString(36).substr(2, 4),
                            userName: cName,
                            userPhone: cPhone,
                            lastTime: m.time || 'New inquiry',
                            unread: (m.sender === 'customer'),
                            messages: []
                        };
                        threads.unshift(thread);
                        updated = true;
                    }

                    const exists = thread.messages.some(msg => 
                        msg.text === m.text && msg.sender === m.sender && Math.abs((msg.timestamp || 0) - (m.timestamp || 0)) < 3000
                    );

                    if (!exists) {
                        thread.messages.push({
                            sender: m.sender,
                            text: m.text,
                            product: m.product || null,
                            time: m.time || '',
                            timestamp: m.timestamp || Date.now()
                        });
                        thread.lastTime = m.time || thread.lastTime;
                        if (m.sender === 'customer' && activeInboxThreadId !== thread.id) {
                            thread.unread = true;
                        }
                        updated = true;
                    }
                });

                if (updated) {
                    saveStoreInboxMessages(storeId, threads);
                    renderPortalInbox({ id: storeId });
                    if (activeInboxThreadId) {
                        const activeThread = threads.find(t => t.id === activeInboxThreadId);
                        if (activeThread) renderActiveChat(activeThread);
                    }
                }
            });
        }
    }

    function renderPortalInbox(biz) {
        const threadsList = document.getElementById('mInboxThreadsList');
        if (!threadsList) return;

        const threads = getStoreInboxMessages(biz.id);
        if (threads.length === 0) {
            threadsList.innerHTML = `<div style="padding:2rem 1rem; text-align:center; color:#64748b; font-size:0.85rem;">No customer inquiries yet.</div>`;
            return;
        }

        threadsList.innerHTML = threads.map(t => {
            const lastMsg = t.messages[t.messages.length - 1]?.text || 'New message';
            const initial = (t.userName || 'U').charAt(0).toUpperCase();
            const isActive = t.id === activeInboxThreadId;

            return `
                <div class="m-inbox-thread-item ${isActive ? 'active' : ''} ${t.unread ? 'unread' : ''}" onclick="selectInboxThread('${t.id}')">
                    <div class="m-thread-avatar">${initial}</div>
                    <div class="m-thread-info">
                        <div class="m-thread-top">
                            <span class="m-thread-name">${t.userName || 'Customer'}</span>
                            <span class="m-thread-time">${t.lastTime || ''}</span>
                        </div>
                        <p class="m-thread-last-msg">${lastMsg}</p>
                    </div>
                </div>
            `;
        }).join('');

        // If a thread is already active, keep it loaded
        if (activeInboxThreadId) {
            const current = threads.find(t => t.id === activeInboxThreadId);
            if (current) renderActiveChat(current);
        }
    }

    window.selectInboxThread = function(threadId) {
        activeInboxThreadId = threadId;
        const threads = getStoreInboxMessages(currentPortalListingId);
        const thread = threads.find(t => t.id === threadId);
        if (!thread) return;

        // Mark as read
        thread.unread = false;
        saveStoreInboxMessages(currentPortalListingId, threads);

        renderPortalInbox({ id: currentPortalListingId });
        renderActiveChat(thread);
    };

    function renderActiveChat(thread) {
        const placeholder = document.getElementById('mInboxEmptyPlaceholder');
        const panel = document.getElementById('mInboxChatPanel');
        const avatar = document.getElementById('mActiveChatAvatar');
        const name = document.getElementById('mActiveChatName');
        const phone = document.getElementById('mActiveChatPhone');
        const msgList = document.getElementById('mActiveChatMessages');
        const btnWa = document.getElementById('btnChatWhatsappCustomer');
        const btnCall = document.getElementById('btnChatCallCustomer');

        if (placeholder) placeholder.style.display = 'none';
        if (panel) panel.style.display = 'flex';

        if (avatar) avatar.textContent = (thread.userName || 'U').charAt(0).toUpperCase();
        if (name) name.textContent = thread.userName || 'Customer';
        if (phone) phone.innerHTML = `<i class="fa-solid fa-phone" style="font-size:0.75rem;"></i> ${thread.userPhone || 'Verified Customer'}`;

        // Direct WhatsApp / Call buttons if phone available
        const cleanDigits = (thread.userPhone || '').replace(/\D/g, '');
        if (btnWa) {
            if (cleanDigits.length >= 10) {
                const waPhone = cleanDigits.length === 10 ? ('91' + cleanDigits) : cleanDigits;
                btnWa.href = `https://wa.me/${waPhone}?text=Hi%20${encodeURIComponent(thread.userName || 'there')},%20we%20received%20your%20inquiry%20on%20LocalBazar.`;
                btnWa.style.display = 'inline-flex';
            } else {
                btnWa.style.display = 'none';
            }
        }
        if (btnCall) {
            if (cleanDigits.length >= 10) {
                btnCall.href = `tel:${cleanDigits}`;
                btnCall.style.display = 'inline-flex';
            } else {
                btnCall.style.display = 'none';
            }
        }

        if (msgList) {
            msgList.innerHTML = thread.messages.map(m => {
                let prodHtml = '';
                if (m.product && m.product.name) {
                    prodHtml = `<div style="background:rgba(255,255,255,0.2); padding:0.35rem 0.6rem; border-radius:6px; margin-bottom:0.35rem; font-size:0.78rem;"><strong><i class="fa-solid fa-tag"></i> Product:</strong> ${m.product.name} ${m.product.price ? '(' + m.product.price + ')' : ''}</div>`;
                }
                return `
                <div class="m-chat-bubble-row ${m.sender === 'store' ? 'outgoing' : 'incoming'}">
                    <div class="m-chat-bubble">
                        ${prodHtml}
                        ${m.text}
                        <span class="m-bubble-time">${m.time || ''}</span>
                    </div>
                </div>
            `;
            }).join('');
            msgList.scrollTop = msgList.scrollHeight;
        }
    }

    window.handlePortalInboxReply = async function(e) {
        if (e && e.preventDefault) e.preventDefault();
        const input = document.getElementById('mInboxReplyInput');
        const replyText = input?.value.trim();
        if (!replyText || !activeInboxThreadId || !currentPortalListingId) return;

        const threads = getStoreInboxMessages(currentPortalListingId);
        const thread = threads.find(t => t.id === activeInboxThreadId);
        if (!thread) return;

        const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const nowTs = Date.now();

        // 1. Add reply to local thread
        const replyMsg = {
            sender: 'store',
            text: replyText,
            time: timeNow,
            timestamp: nowTs
        };
        thread.messages.push(replyMsg);
        thread.lastTime = timeNow;

        saveStoreInboxMessages(currentPortalListingId, threads);
        input.value = '';

        // 2. Also save to customer chat history on local storage for same-device/browser testing
        try {
            const hKey = `lb_chat_history_${currentPortalListingId}`;
            const rawH = localStorage.getItem(hKey);
            let historyList = rawH ? JSON.parse(rawH) : [];
            historyList.push(replyMsg);
            localStorage.setItem(hKey, JSON.stringify(historyList));
        } catch (eH) {}

        renderPortalInbox({ id: currentPortalListingId });
        renderActiveChat(thread);

        // 3. Send reply to Cloud Firestore so the customer receives it on their phone/device!
        if (window.lbCloudSync && typeof window.lbCloudSync.saveInquiryMessage === 'function') {
            try {
                await window.lbCloudSync.saveInquiryMessage(currentPortalListingId, {
                    sender: 'store',
                    text: replyText,
                    customerName: thread.userName,
                    customerPhone: thread.userPhone,
                    time: timeNow,
                    timestamp: nowTs
                });
                console.log('[Merchant Portal] Reply successfully sent to customer via Firestore.');
            } catch (err) {
                console.warn('[Merchant Portal] Failed to send reply to Firestore:', err);
            }
        }
    };

    window.deleteActiveConversation = function() {
        if (!confirm('Are you sure you want to delete this customer conversation?')) return;
        if (!activeInboxThreadId || !currentPortalListingId) return;

        let threads = getStoreInboxMessages(currentPortalListingId);
        threads = threads.filter(t => t.id !== activeInboxThreadId);
        saveStoreInboxMessages(currentPortalListingId, threads);

        activeInboxThreadId = null;
        const placeholder = document.getElementById('mInboxEmptyPlaceholder');
        const panel = document.getElementById('mInboxChatPanel');
        if (placeholder) placeholder.style.display = 'flex';
        if (panel) panel.style.display = 'none';

        renderPortalInbox({ id: currentPortalListingId });
    };

    window.filterInboxConversations = function(query) {
        const q = (query || '').toLowerCase().trim();
        const threadEls = document.querySelectorAll('.m-inbox-thread-item');
        threadEls.forEach(el => {
            const text = el.textContent.toLowerCase();
            el.style.display = text.includes(q) ? 'flex' : 'none';
        });
    };

    // ---------------- IN-STORE SLIDING CATEGORIES MANAGEMENT ----------------
    function getStoreCategoryIcon(label = '') {
        if (typeof window.resolveStoreCategoryIcon === 'function') {
            return window.resolveStoreCategoryIcon(label);
        }
        const l = (label || '').toLowerCase().trim();
        if (l.includes('biryani') || l.includes('rice') || l.includes('pulao')) return '🍚';
        if (l.includes('burger') || l.includes('fast food') || l.includes('roll') || l.includes('sandwich')) return '🍔';
        if (l.includes('pizza')) return '🍕';
        if (l.includes('starter') || l.includes('main course') || l.includes('thali') || l.includes('meal') || l.includes('snack') || l.includes('chicken') || l.includes('curry') || l.includes('food')) return '🍛';
        if (l.includes('drink') || l.includes('tea') || l.includes('coffee') || l.includes('chai') || l.includes('juice') || l.includes('soda')) return '🥤';
        if (l.includes('ice cream')) return '🍨';
        if (l.includes('dessert') || l.includes('sweet') || l.includes('cake') || l.includes('bakery')) return '🍰';
        if (l.includes('saree') || l.includes('women') || l.includes('ladies') || l.includes('kurti') || l.includes('dress')) return '👗';
        if (l.includes('kid') || l.includes('baby') || l.includes('child')) return '🧒';
        if (l.includes('shoe') || l.includes('footwear') || l.includes('sneaker')) return '👟';
        if (l.includes('shirt') || l.includes('pant') || l.includes('jeans') || l.includes('men') || l.includes('wear') || l.includes('cloth')) return '👕';
        if (l.includes('mobile') || l.includes('phone') || l.includes('smartphone')) return '📱';
        if (l.includes('laptop') || l.includes('computer') || l.includes('pc')) return '💻';
        if (l.includes('headphone') || l.includes('audio') || l.includes('speaker')) return '🎧';
        if (l.includes('electronic') || l.includes('tv') || l.includes('appliance')) return '📺';
        if (l.includes('vegetable') || l.includes('fruit') || l.includes('fresh')) return '🥦';
        if (l.includes('grocery') || l.includes('ration') || l.includes('supermarket')) return '🛒';
        if (l.includes('beauty') || l.includes('cosmetic') || l.includes('salon') || l.includes('makeup')) return '💄';
        if (l.includes('doctor') || l.includes('health') || l.includes('medicine') || l.includes('clinic')) return '🩺';
        if (l.includes('jewel') || l.includes('gold') || l.includes('diamond')) return '💎';
        if (l.includes('watch') || l.includes('clock')) return '⌚';
        if (l.includes('fire') || l.includes('popular') || l.includes('trending')) return '🔥';
        if (l.includes('deal') || l.includes('offer') || l.includes('discount')) return '🏷️';
        if (l.includes('star') || l.includes('featured')) return '⭐';
        return '🏷️';
    }

    function formatMerchantCatIconHtml(icon, defaultLabel = '') {
        if (typeof window.formatCatIconHtml === 'function') {
            return window.formatCatIconHtml(icon, defaultLabel);
        }
        let ic = (icon || '').trim();
        if (!ic) ic = getStoreCategoryIcon(defaultLabel);
        if (ic.includes('fa-')) {
            const cls = ic.includes(' ') ? ic : `fa-solid ${ic}`;
            return `<i class="${cls}"></i>`;
        }
        return `<span class="cat-emoji" style="font-family:'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif; font-style:normal; line-height:1;">${ic}</span>`;
    }

    function getDefaultStoreCategories(categoryName = '') {
        if (categoryName) {
            try {
                const rawCats = localStorage.getItem('lb_categories');
                const categories = rawCats ? JSON.parse(rawCats) : [];
                const found = categories.find(c => (c.name || '').trim().toLowerCase() === categoryName.trim().toLowerCase());
                if (found && Array.isArray(found.storeCategories) && found.storeCategories.length > 0) {
                    return found.storeCategories.filter(Boolean).map(item => {
                        const lbl = typeof item === 'string' ? item.trim() : (item.label || item.name || '').trim();
                        let ic = (typeof item === 'object' && item && item.icon && item.icon !== 'fa-tag' && item.icon !== 'fa-bag-shopping')
                            ? item.icon
                            : getStoreCategoryIcon(lbl);
                        if (!ic || ic === 'fa-tag') ic = getStoreCategoryIcon(lbl);
                        return {
                            label: lbl,
                            tag: lbl.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                            icon: ic
                        };
                    });
                }
            } catch (err) {
                console.error('Failed to get admin store categories', err);
            }
        }
        // Universal fallback with vibrant emojis
        return [
            { label: 'For You', tag: 'all', icon: '🛍️' },
            { label: 'Popular', tag: 'popular', icon: '🔥' },
            { label: 'Featured', tag: 'featured', icon: '⭐' },
            { label: 'Offers', tag: 'offers', icon: '🏷️' }
        ];
    }

    function renderPortalStoreCategories(biz) {
        const grid = document.getElementById('mPortalStoreCatsGrid');
        if (!grid) return;

        const rawCats = Array.isArray(biz.storeCategories) && biz.storeCategories.length > 0
            ? biz.storeCategories
            : getDefaultStoreCategories(biz.category);

        const syncBtn = document.getElementById('btnSyncCatDefaults');
        if (syncBtn && biz.category) {
            syncBtn.title = `Reset/Load sliding categories from Admin template for "${biz.category}"`;
        }

        grid.innerHTML = rawCats.map((c, idx) => {
            const label = typeof c === 'string' ? c.trim() : (c.label || c.name || 'Category').trim();
            const tag = typeof c === 'string'
                ? label.toLowerCase().replace(/[^a-z0-9]+/g, '-')
                : (c.tag || label.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
            let icon = (typeof c === 'object' && c && c.icon && c.icon !== 'fa-tag' && c.icon !== 'fa-bag-shopping')
                ? c.icon
                : getStoreCategoryIcon(label);
            if (!icon || icon === 'fa-tag') icon = getStoreCategoryIcon(label);

            return `
            <div class="m-store-cat-card">
                <div class="m-store-cat-meta">
                    <div class="m-store-cat-icon">
                        ${formatMerchantCatIconHtml(icon, label)}
                    </div>
                    <div>
                        <span class="m-store-cat-name">${label}</span>
                        <span class="m-store-cat-tag">#${tag}</span>
                    </div>
                </div>
                <div class="m-store-cat-actions">
                    <button type="button" class="btn-card-action" onclick="openPortalStoreCategoryModal(${idx})" title="Edit Category">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button type="button" class="btn-card-action del" onclick="deletePortalStoreCategory(${idx})" title="Delete Category">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>
            `;
        }).join('');
    }

    window.syncStoreCategoriesWithAdminDefaults = function() {
        if (!currentPortalListingId) return;
        let listings = [];
        try {
            const raw = localStorage.getItem('lb_listings');
            listings = raw ? JSON.parse(raw) : [];
        } catch { listings = []; }
        const idx = listings.findIndex(l => l.id === currentPortalListingId);
        if (idx === -1) return;

        const currentCat = listings[idx].category || '';
        const defaults = getDefaultStoreCategories(currentCat);

        if (!confirm(`Are you sure you want to reset In-Store Sliding Categories to the Admin defaults for "${currentCat || 'this category'}" (${defaults.length} categories)?`)) return;

        listings[idx].storeCategories = defaults;
        syncPortalListingToStorageAndCloud(listings[idx]);
        renderPortalStoreCategories(listings[idx]);
        renderPortalCatalog(listings[idx]);
        alert(`Successfully synced sliding categories with "${currentCat || 'Default'}"!`);
    };

    const portalStoreCategoryModal = document.getElementById('portalStoreCategoryModal');
    function cleanMerchantIconClass(iconStr, defaultLabel = '') {
        if (typeof window.cleanStoreCategoryEmoji === 'function') {
            return window.cleanStoreCategoryEmoji(iconStr, defaultLabel);
        }
        let clean = (iconStr || '').trim();
        if (!clean) {
            return getStoreCategoryIcon(defaultLabel);
        }
        const classMatch = clean.match(/class=["']([^"']+)["']/i);
        if (classMatch && classMatch[1]) {
            return (window.faToEmoji ? window.faToEmoji(classMatch[1]) : classMatch[1]);
        }
        if (clean.includes('fa-') && window.faToEmoji) {
            return window.faToEmoji(clean);
        }
        clean = clean.replace(/<[^>]*>/g, '').trim();
        return clean;
    }

    const pStoreCatIndex = document.getElementById('pStoreCatIndex');
    const pStoreCatLabel = document.getElementById('pStoreCatLabel');
    const pStoreCatTag = document.getElementById('pStoreCatTag');
    const pStoreCatIconInput = document.getElementById('pStoreCatIconInput');
    const pStoreCatIconPreview = document.getElementById('pStoreCatIconPreview');

    function updateMerchantIconPreview() {
        if (!pStoreCatIconPreview) return;
        const pasted = pStoreCatIconInput ? pStoreCatIconInput.value.trim() : '';
        const label = pStoreCatLabel ? pStoreCatLabel.value.trim() : '';
        const ic = cleanMerchantIconClass(pasted, label);
        pStoreCatIconPreview.innerHTML = formatMerchantCatIconHtml(ic, label);
    }

    pStoreCatIconInput?.addEventListener('input', updateMerchantIconPreview);
    pStoreCatLabel?.addEventListener('input', () => {
        if (!pStoreCatIconInput || !pStoreCatIconInput.value.trim()) {
            updateMerchantIconPreview();
        }
    });

    window.openPortalStoreCategoryModal = function(index = -1) {
        if (!portalStoreCategoryModal) return;
        pStoreCatIndex.value = index;

        let listings = [];
        try {
            const raw = localStorage.getItem('lb_listings');
            listings = raw ? JSON.parse(raw) : [];
        } catch { listings = []; }
        const biz = listings.find(l => l.id === currentPortalListingId);
        const cats = biz && Array.isArray(biz.storeCategories) && biz.storeCategories.length > 0
            ? biz.storeCategories
            : getDefaultStoreCategories(biz?.category);

        const title = document.getElementById('portalStoreCatModalTitle');
        if (index >= 0 && cats[index]) {
            const item = cats[index];
            const lbl = typeof item === 'string' ? item.trim() : (item.label || item.name || '').trim();
            const tg = typeof item === 'string' ? '' : (item.tag || '');
            let ic = (typeof item === 'object' && item && item.icon) ? item.icon : getStoreCategoryIcon(lbl);

            if (title) title.innerHTML = '<i class="fa-solid fa-pen-to-square text-primary"></i> Edit Store Category';
            if (pStoreCatLabel) pStoreCatLabel.value = lbl;
            if (pStoreCatTag) pStoreCatTag.value = tg;
            if (pStoreCatIconInput) pStoreCatIconInput.value = ic;
            updateMerchantIconPreview();
        } else {
            if (title) title.innerHTML = '<i class="fa-solid fa-layer-group text-primary"></i> Add Store Category';
            if (pStoreCatLabel) pStoreCatLabel.value = '';
            if (pStoreCatTag) pStoreCatTag.value = '';
            if (pStoreCatIconInput) pStoreCatIconInput.value = '';
            updateMerchantIconPreview();
        }

        portalStoreCategoryModal.classList.add('active');
        portalStoreCategoryModal.style.display = 'flex';
    };

    window.closePortalStoreCategoryModal = function() {
        if (portalStoreCategoryModal) {
            portalStoreCategoryModal.classList.remove('active');
            portalStoreCategoryModal.style.display = 'none';
        }
    };

    window.handlePortalStoreCategorySubmit = function(e) {
        if (e) e.preventDefault();
        const index = parseInt(pStoreCatIndex.value, 10);
        const label = pStoreCatLabel.value.trim();
        const tag = pStoreCatTag.value.trim().toLowerCase().replace(/\s+/g, '-') || label.toLowerCase().replace(/\s+/g, '-');
        const icon = cleanMerchantIconClass(pStoreCatIconInput ? pStoreCatIconInput.value.trim() : '', label);

        if (!label) return;

        let listings = [];
        try {
            const raw = localStorage.getItem('lb_listings');
            listings = raw ? JSON.parse(raw) : [];
        } catch { listings = []; }

        const idx = listings.findIndex(l => l.id === currentPortalListingId);
        if (idx === -1) return;

        if (!Array.isArray(listings[idx].storeCategories) || listings[idx].storeCategories.length === 0) {
            listings[idx].storeCategories = getDefaultStoreCategories(listings[idx].category);
        }

        const catObj = { label, tag, icon };
        if (index >= 0 && index < listings[idx].storeCategories.length) {
            listings[idx].storeCategories[index] = catObj;
        } else {
            listings[idx].storeCategories.push(catObj);
        }

        syncPortalListingToStorageAndCloud(listings[idx]);
        closePortalStoreCategoryModal();
        renderPortalStoreCategories(listings[idx]);
    };

    window.deletePortalStoreCategory = function(index) {
        if (!confirm('Are you sure you want to remove this category filter chip?')) return;
        let listings = [];
        try {
            const raw = localStorage.getItem('lb_listings');
            listings = raw ? JSON.parse(raw) : [];
        } catch { listings = []; }
        const idx = listings.findIndex(l => l.id === currentPortalListingId);
        if (idx === -1) return;

        if (!Array.isArray(listings[idx].storeCategories) || listings[idx].storeCategories.length === 0) {
            listings[idx].storeCategories = getDefaultStoreCategories(listings[idx].category);
        }

        listings[idx].storeCategories.splice(index, 1);
        syncPortalListingToStorageAndCloud(listings[idx]);
        renderPortalStoreCategories(listings[idx]);
    };

    window.deleteUserListing = function(listingId, listingName) {
        const displayName = listingName || 'this listing';
        if (confirm(`Are you sure you want to delete "${displayName}"? This will permanently remove it from LocalBazar.`)) {
            try {
                const rawListings = localStorage.getItem('lb_listings');
                let listings = rawListings ? JSON.parse(rawListings) : [];
                listings = listings.filter(l => l.id !== listingId);
                localStorage.setItem('lb_listings', JSON.stringify(listings));

                // Sync delete to Firebase Cloud Firestore if online
                if (window.lbCloudSync && typeof window.lbCloudSync.deleteListing === 'function') {
                    window.lbCloudSync.deleteListing(listingId);
                }
                renderUserManageListings();
            } catch (err) {
                console.error(err);
            }
        }
    };

    // ================= 3. SAVED PLACES ENGINE =================
    window.renderUserSavedPlaces = function() {
        const container = document.getElementById('userSavedPlacesContainer');
        if (!container) return;

        let savedEntries = [];
        try {
            const rawSaved = localStorage.getItem('lb_saved_places');
            savedEntries = rawSaved ? JSON.parse(rawSaved) : [];
        } catch {
            savedEntries = [];
        }

        let listings = [];
        try {
            const rawListings = localStorage.getItem('lb_listings');
            listings = rawListings ? JSON.parse(rawListings) : [];
        } catch {
            listings = [];
        }

        // Hydrate saved entries with full listing details if available
        const savedPlaces = savedEntries.map(entry => {
            const placeId = typeof entry === 'string' ? entry : entry.id;
            const fullItem = listings.find(l => l.id === placeId);
            if (fullItem) {
                return {
                    id: fullItem.id,
                    name: fullItem.name,
                    category: fullItem.category,
                    city: fullItem.city,
                    image: fullItem.image || (Array.isArray(fullItem.gallery) && fullItem.gallery[0]) || '',
                    phone: fullItem.phone,
                    timings: fullItem.scheduleTimings || 'Regular Hours'
                };
            }
            return typeof entry === 'object' ? entry : { id: placeId, name: 'Saved Place', category: 'General', city: '', image: '' };
        });

        // Update badge count
        const badge = document.getElementById('hubSavedPlacesCountBadge');
        if (badge) badge.textContent = savedPlaces.length;

        if (savedPlaces.length === 0) {
            container.innerHTML = `
                <div class="ctrl-empty-state" style="padding: 3rem 1.5rem; text-align: center;">
                    <div style="width:68px; height:68px; border-radius:50%; background:#fef3c7; color:#d97706; display:flex; align-items:center; justify-content:center; font-size:1.8rem; margin:0 auto 1.25rem;">
                        <i class="fa-solid fa-bookmark"></i>
                    </div>
                    <strong style="font-size:1.15rem; color:#0f172a; display:block; margin-bottom:0.4rem;">No Saved Places Yet</strong>
                    <span style="color:#64748b; font-size:0.88rem; max-width:320px; display:block; margin:0 auto 1.5rem;">Click the Save button on any shop, clinic or office to keep it bookmarked here.</span>
                    <a href="explore.html" class="btn-hub-primary" style="width:auto; display:inline-flex; align-items:center; gap:0.5rem; padding:0.65rem 1.4rem; text-decoration:none;">
                        <i class="fa-solid fa-compass"></i> Explore Places
                    </a>
                </div>
            `;
            return;
        }

        container.innerHTML = savedPlaces.map(item => `
            <div class="ctrl-listing-card" style="cursor:pointer;" onclick="window.location.href='listing-detail.html?id=${encodeURIComponent(item.id)}'">
                <div class="ctrl-card-top">
                    <div class="ctrl-thumb-wrapper">
                        <img src="${item.image || 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=160&auto=format&fit=crop&q=80'}" alt="${item.name}" class="ctrl-listing-thumb">
                    </div>
                    <div class="ctrl-card-details">
                        <div class="ctrl-title-row">
                            <h4 class="ctrl-listing-title">${item.name}</h4>
                            <span class="ctrl-cat-tag">${item.category || 'Business'}</span>
                        </div>
                        <div class="ctrl-meta-line">
                            <span><i class="fa-solid fa-location-dot"></i> ${item.city || 'Local'}</span>
                            ${item.phone ? `<span><i class="fa-solid fa-phone"></i> ${item.phone}</span>` : ''}
                        </div>
                    </div>
                    <div class="ctrl-card-right-group">
                        <button type="button" class="btn-ctrl-share" style="color:#ef4444; border-color:#fecaca; background:#fff5f5;" onclick="event.stopPropagation(); removeUserSavedPlace('${item.id}', '${item.name}');" title="Remove bookmark">
                            <i class="fa-solid fa-trash-can"></i>
                            <span>Remove</span>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    };

    window.removeUserSavedPlace = function(id, name) {
        try {
            const raw = localStorage.getItem('lb_saved_places');
            let list = raw ? JSON.parse(raw) : [];
            list = list.filter(entry => (typeof entry === 'string' ? entry !== id : entry.id !== id));
            localStorage.setItem('lb_saved_places', JSON.stringify(list));

            // Sync with current user
            if (currentUser) {
                currentUser.savedPlaces = list.length;
                localStorage.setItem('lb_current_user', JSON.stringify(currentUser));
            }

            renderUserSavedPlaces();
        } catch (err) {
            console.error(err);
        }
    };

    // ================= 4. REAL-TIME MERCHANT NOTIFICATIONS & INBOX ALERT =================
    function playChimeAlert() {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
            gain.gain.setValueAtTime(0.25, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
            osc.start();
            osc.stop(ctx.currentTime + 0.4);
        } catch {}
    }

    function checkMerchantUnreadInquiries(playDing = false) {
        if (!currentUser) return;
        const banner = document.getElementById('merchantUnreadInquiryBanner');
        const bannerTitle = document.getElementById('inquiryBannerTitle');
        const bannerSub = document.getElementById('inquiryBannerSub');
        const bannerBadge = document.getElementById('inquiryBannerBadge');

        let listings = [];
        try {
            const rawListings = localStorage.getItem('lb_listings');
            listings = rawListings ? JSON.parse(rawListings) : [];
        } catch {}

        const myListings = listings.filter(l => 
            (currentUser.id && String(l.ownerId) === String(currentUser.id)) || 
            (currentUser.email && l.ownerId && l.ownerId.toLowerCase() === currentUser.email.toLowerCase()) || 
            (currentUser.phone && l.phone && l.phone === currentUser.phone)
        );

        let totalUnread = 0;
        let latestStoreName = '';
        let latestCustomer = '';
        firstUnreadStoreId = null;

        myListings.forEach(store => {
            try {
                const rawInbox = localStorage.getItem(`lb_store_inbox_${store.id}`);
                if (rawInbox) {
                    const threads = JSON.parse(rawInbox);
                    const unreadThreads = threads.filter(t => t.unread);
                    if (unreadThreads.length > 0) {
                        totalUnread += unreadThreads.length;
                        if (!firstUnreadStoreId) {
                            firstUnreadStoreId = store.id;
                            latestStoreName = store.name;
                            latestCustomer = unreadThreads[0].userName || 'Customer';
                        }
                    }
                }
            } catch {}
        });

        if (totalUnread > 0 && banner) {
            banner.style.display = 'block';
            if (bannerTitle) bannerTitle.textContent = `${totalUnread} New Customer ${totalUnread === 1 ? 'Inquiry' : 'Inquiries'}`;
            if (bannerSub) bannerSub.textContent = `Latest from ${latestCustomer} for "${latestStoreName}"`;
            if (bannerBadge) bannerBadge.textContent = `${totalUnread} New`;

            if (playDing) playChimeAlert();
        } else if (banner) {
            banner.style.display = 'none';
        }
    }

    window.openFirstUnreadStoreInbox = function() {
        if (typeof window.openUnifiedMerchantInbox === 'function') {
            window.openUnifiedMerchantInbox(firstUnreadStoreId);
        } else if (firstUnreadStoreId) {
            handleBusinessCardClick(firstUnreadStoreId);
            setTimeout(() => {
                switchPortalTab('tabInbox');
            }, 300);
        } else {
            switchAccountScreen('viewManageListings');
        }
    };

    // Auto-prompt browser notification permission on interaction
    if ('Notification' in window && Notification.permission === 'default') {
        setTimeout(() => {
            try { Notification.requestPermission(); } catch {}
        }, 3000);
    }

    // Cross-tab real-time storage listener
    window.addEventListener('storage', (e) => {
        if (e.key && (e.key.startsWith('lb_store_inbox_') || e.key === 'lb_notifications')) {
            checkMerchantUnreadInquiries(true);
        }
        if (e.key === 'lb_saved_places') {
            const badge = document.getElementById('hubSavedPlacesCountBadge');
            if (badge) {
                try {
                    const count = JSON.parse(e.newValue || '[]').length;
                    badge.textContent = count;
                } catch {}
            }
        }
    });

    // =========================================================================
    // CLAIM MY LISTING ENTERPRISE VERIFICATION & OWNERSHIP ENGINE
    // =========================================================================
    let claimAttachedFiles = []; // Max 5 files
    let isClaimFormInitialized = false;

    window.switchClaimTab = function(tab) {
        const formSec = document.getElementById('claimSectionForm');
        const histSec = document.getElementById('claimSectionHistory');
        const btnForm = document.getElementById('btnClaimTabForm');
        const btnHist = document.getElementById('btnClaimTabHistory');

        if (tab === 'form') {
            if (formSec) formSec.style.display = 'block';
            if (histSec) histSec.style.display = 'none';
            if (btnForm) {
                btnForm.classList.add('active');
                btnForm.style.background = '#4f46e5';
                btnForm.style.color = '#ffffff';
                btnForm.style.borderColor = '#4f46e5';
            }
            if (btnHist) {
                btnHist.classList.remove('active');
                btnHist.style.background = '#f9fafb';
                btnHist.style.color = '#4b5563';
                btnHist.style.borderColor = '#d1d5db';
            }
        } else {
            if (formSec) formSec.style.display = 'none';
            if (histSec) histSec.style.display = 'block';
            if (btnHist) {
                btnHist.classList.add('active');
                btnHist.style.background = '#4f46e5';
                btnHist.style.color = '#ffffff';
                btnHist.style.borderColor = '#4f46e5';
            }
            if (btnForm) {
                btnForm.classList.remove('active');
                btnForm.style.background = '#f9fafb';
                btnForm.style.color = '#4b5563';
                btnForm.style.borderColor = '#d1d5db';
            }
            window.renderClaimHistory();
        }
    };

    window.initClaimListingForm = function() {
        if (isClaimFormInitialized) return;
        isClaimFormInitialized = true;

        const cityInput = document.getElementById('claimCityInput');
        const cityDropdown = document.getElementById('claimCitySuggestions');
        const catInput = document.getElementById('claimCategoryInput');
        const catDropdown = document.getElementById('claimCategorySuggestions');
        const listingInput = document.getElementById('claimListingInput');
        const listingDropdown = document.getElementById('claimListingSuggestions');
        const listingIdHidden = document.getElementById('claimListingId');
        const fileInput = document.getElementById('claimFilesInput');

        // 1. City Auto-Suggest (Prefix search matching admin added cities from lb_cities)
        if (cityInput && cityDropdown) {
            function updateClaimCitySuggestions() {
                const val = cityInput.value.trim().toLowerCase();
                let cities = [];
                try {
                    const raw = localStorage.getItem('lb_cities');
                    cities = raw ? JSON.parse(raw) : [];
                } catch {}

                if (!val) {
                    cityDropdown.classList.remove('open');
                    cityDropdown.innerHTML = '';
                    return;
                }

                const matches = cities.filter(c => (c.name || '').toLowerCase().startsWith(val))
                    .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
                if (matches.length === 0) {
                    cityDropdown.classList.remove('open');
                    cityDropdown.innerHTML = '';
                    return;
                }

                cityDropdown.innerHTML = matches.map(c => `
                    <div class="city-suggestion-item" data-name="${c.name}">
                        <div class="sugg-city-info">
                            <span class="sugg-city-name"><i class="fa-solid fa-location-dot" style="color:#ef4444; font-size:0.85rem;"></i> ${c.name}</span>
                            <div class="sugg-city-details">${c.district ? `<span>District: <strong>${c.district}</strong></span> • ` : ''}<span>${c.state || 'Active Hub'}</span></div>
                        </div>
                        <span class="sugg-select-hint"><i class="fa-solid fa-arrow-turn-down-left"></i> Select</span>
                    </div>
                `).join('');
                cityDropdown.classList.add('open');

                cityDropdown.querySelectorAll('.city-suggestion-item').forEach(item => {
                    item.addEventListener('mousedown', (e) => {
                        e.preventDefault();
                        cityInput.value = item.getAttribute('data-name');
                        cityDropdown.classList.remove('open');
                        cityDropdown.innerHTML = '';
                    });
                });
            }

            cityInput.addEventListener('input', updateClaimCitySuggestions);
            cityInput.addEventListener('focus', updateClaimCitySuggestions);
            cityInput.addEventListener('keyup', updateClaimCitySuggestions);
        }

        // 2. Category Auto-Suggest (Prefix search matching admin added categories from lb_categories)
        if (catInput && catDropdown) {
            function updateClaimCatSuggestions() {
                const val = catInput.value.trim().toLowerCase();
                let categories = [];
                try {
                    const raw = localStorage.getItem('lb_categories');
                    categories = raw ? JSON.parse(raw) : [];
                } catch {}

                if (!val) {
                    catDropdown.classList.remove('open');
                    catDropdown.innerHTML = '';
                    return;
                }

                const matches = categories.filter(c => (c.name || '').toLowerCase().startsWith(val))
                    .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
                if (matches.length === 0) {
                    catDropdown.classList.remove('open');
                    catDropdown.innerHTML = '';
                    return;
                }

                catDropdown.innerHTML = matches.map(c => `
                    <div class="city-suggestion-item" data-name="${c.name}">
                        <div class="sugg-city-info">
                            <span class="sugg-city-name"><i class="fa-solid fa-layer-group" style="color:#6366f1; font-size:0.85rem;"></i> ${c.name}</span>
                            <div class="sugg-city-details"><span>${c.description || 'Verified Business Category'}</span></div>
                        </div>
                        <span class="sugg-select-hint"><i class="fa-solid fa-arrow-turn-down-left"></i> Select</span>
                    </div>
                `).join('');
                catDropdown.classList.add('open');

                catDropdown.querySelectorAll('.city-suggestion-item').forEach(item => {
                    item.addEventListener('mousedown', (e) => {
                        e.preventDefault();
                        catInput.value = item.getAttribute('data-name');
                        catDropdown.classList.remove('open');
                        catDropdown.innerHTML = '';
                    });
                });
            }

            catInput.addEventListener('input', updateClaimCatSuggestions);
            catInput.addEventListener('focus', updateClaimCatSuggestions);
            catInput.addEventListener('keyup', updateClaimCatSuggestions);
        }

        // 3. Listing Name Auto-Suggest (Prefix or word matching listings added in platform from lb_listings)
        if (listingInput && listingDropdown) {
            function updateClaimListingSuggestions() {
                const val = listingInput.value.trim().toLowerCase();
                if (!val) {
                    listingDropdown.classList.remove('open');
                    listingDropdown.innerHTML = '';
                    return;
                }

                let listings = [];
                try {
                    const raw = localStorage.getItem('lb_listings');
                    listings = raw ? JSON.parse(raw) : [];
                } catch {}

                const selectedCity = (cityInput?.value || '').trim().toLowerCase();
                const selectedCat = (catInput?.value || '').trim().toLowerCase();

                // Match listings whose name starts with or contains the typed word
                let matches = listings.filter(l => {
                    const name = (l.name || '').toLowerCase();
                    return name.includes(val);
                });

                // Filter by city and category if provided
                if (selectedCity) {
                    const cityMatches = matches.filter(l => (l.city || '').toLowerCase() === selectedCity);
                    if (cityMatches.length > 0) matches = cityMatches;
                }
                if (selectedCat) {
                    const catMatches = matches.filter(l => (l.category || '').toLowerCase() === selectedCat);
                    if (catMatches.length > 0) matches = catMatches;
                }

                if (matches.length === 0) {
                    listingDropdown.classList.remove('open');
                    listingDropdown.innerHTML = '';
                    return;
                }

                listingDropdown.innerHTML = matches.slice(0, 10).map(l => {
                    const isUnowned = !l.ownerId || l.ownerId === 'null' || l.ownerId === 'undefined';
                    const ownerBadge = isUnowned 
                        ? `<span style="font-size:0.72rem; background:#ecfdf5; color:#065f46; padding:0.15rem 0.45rem; border-radius:4px; font-weight:600;"><i class="fa-solid fa-lock-open"></i> Open for Claim</span>`
                        : `<span style="font-size:0.72rem; background:#f1f5f9; color:#475569; padding:0.15rem 0.45rem; border-radius:4px; font-weight:600;"><i class="fa-solid fa-building-circle-check"></i> Registered Listing</span>`;

                    return `
                        <div class="city-suggestion-item" data-id="${l.id}" data-name="${l.name}" data-city="${l.city || ''}" data-cat="${l.category || ''}">
                            <div class="sugg-city-info">
                                <span class="sugg-city-name"><i class="fa-solid fa-store" style="color:#d97706; font-size:0.85rem;"></i> ${l.name}</span>
                                <div class="sugg-city-details">
                                    <span><i class="fa-solid fa-location-dot"></i> ${l.city || 'City'}</span> • 
                                    <span><i class="fa-solid fa-tag"></i> ${l.category || 'Category'}</span> • 
                                    ${ownerBadge}
                                </div>
                            </div>
                            <span class="sugg-select-hint"><i class="fa-solid fa-arrow-turn-down-left"></i> Select</span>
                        </div>
                    `;
                }).join('');
                listingDropdown.classList.add('open');

                listingDropdown.querySelectorAll('.city-suggestion-item').forEach(item => {
                    item.addEventListener('mousedown', (e) => {
                        e.preventDefault();
                        const lid = item.getAttribute('data-id');
                        const lname = item.getAttribute('data-name');
                        const lcity = item.getAttribute('data-city');
                        const lcat = item.getAttribute('data-cat');

                        listingInput.value = lname;
                        if (listingIdHidden) listingIdHidden.value = lid;

                        if (cityInput && !cityInput.value.trim() && lcity) {
                            cityInput.value = lcity;
                        }
                        if (catInput && !catInput.value.trim() && lcat) {
                            catInput.value = lcat;
                        }

                        const notice = document.getElementById('claimSelectedListingNotice');
                        const noticeText = document.getElementById('claimSelectedListingText');
                        if (notice && noticeText) {
                            noticeText.innerHTML = `<strong>Selected:</strong> ${lname} (#${lid}) • <i class="fa-solid fa-location-dot"></i> ${lcity} • <i class="fa-solid fa-layer-group"></i> ${lcat}`;
                            notice.style.display = 'flex';
                        }

                        listingDropdown.classList.remove('open');
                        listingDropdown.innerHTML = '';
                    });
                });
            }

            listingInput.addEventListener('input', updateClaimListingSuggestions);
            listingInput.addEventListener('focus', updateClaimListingSuggestions);
            listingInput.addEventListener('keyup', updateClaimListingSuggestions);
        }

        // Close dropdowns on outside click
        document.addEventListener('click', (e) => {
            if (cityInput && cityDropdown && !cityInput.contains(e.target) && !cityDropdown.contains(e.target)) {
                cityDropdown.classList.remove('open');
            }
            if (catInput && catDropdown && !catInput.contains(e.target) && !catDropdown.contains(e.target)) {
                catDropdown.classList.remove('open');
            }
            if (listingInput && listingDropdown && !listingInput.contains(e.target) && !listingDropdown.contains(e.target)) {
                listingDropdown.classList.remove('open');
            }
        });

        // 4. File Uploader (Max 5 files)
        if (fileInput) {
            fileInput.addEventListener('change', async (e) => {
                const files = Array.from(e.target.files || []);
                if (files.length === 0) return;

                if (claimAttachedFiles.length + files.length > 5) {
                    alert(`Maximum 5 proof documents allowed. You currently have ${claimAttachedFiles.length} file(s) attached.`);
                    fileInput.value = '';
                    return;
                }

                for (const file of files) {
                    const isImg = file.type && file.type.startsWith('image/');
                    try {
                        let dataUrl = '';
                        let sizeStr = '';
                        if (isImg) {
                            dataUrl = await compressFileImage(file, 260, 1400);
                            const approxKB = Math.round((dataUrl.length * 3) / 4 / 1024);
                            sizeStr = `${approxKB} KB`;
                        } else {
                            dataUrl = await new Promise((res, rej) => {
                                const r = new FileReader();
                                r.onload = ev => res(ev.target.result);
                                r.onerror = rej;
                                r.readAsDataURL(file);
                            });
                            sizeStr = `${Math.round(file.size / 1024)} KB`;
                        }

                        claimAttachedFiles.push({
                            id: 'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                            name: file.name,
                            size: sizeStr,
                            type: file.type || 'application/octet-stream',
                            isImage: isImg,
                            data: dataUrl
                        });
                    } catch (err) {
                        console.error('File read error:', err);
                    }
                }

                fileInput.value = '';
                renderClaimAttachedFilesList();
            });
        }
    };

    function renderClaimAttachedFilesList() {
        const previewList = document.getElementById('claimFilesPreviewList');
        const countDisplay = document.getElementById('claimFilesCountDisplay');
        if (countDisplay) countDisplay.textContent = claimAttachedFiles.length;
        if (!previewList) return;

        if (claimAttachedFiles.length === 0) {
            previewList.innerHTML = '';
            return;
        }

        previewList.innerHTML = claimAttachedFiles.map((f, idx) => {
            let iconHtml = '<i class="fa-solid fa-file-lines" style="color:#6366f1;"></i>';
            if (f.isImage) {
                iconHtml = '<i class="fa-solid fa-file-image" style="color:#10b981;"></i>';
            } else if (f.name.toLowerCase().endsWith('.pdf') || (f.type && f.type.includes('pdf'))) {
                iconHtml = '<i class="fa-solid fa-file-pdf" style="color:#ef4444;"></i>';
            } else if (f.name.toLowerCase().endsWith('.doc') || f.name.toLowerCase().endsWith('.docx')) {
                iconHtml = '<i class="fa-solid fa-file-word" style="color:#2563eb;"></i>';
            }

            return `
                <div class="claim-file-chip">
                    <div class="claim-file-info">
                        ${iconHtml}
                        <span class="claim-file-name" title="${f.name}">${f.name}</span>
                        <span class="claim-file-size">(${f.size})</span>
                    </div>
                    <button type="button" class="btn-remove-claim-file" onclick="removeClaimAttachedFile(${idx})" title="Remove file">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            `;
        }).join('');
    }

    window.removeClaimAttachedFile = function(index) {
        claimAttachedFiles.splice(index, 1);
        renderClaimAttachedFilesList();
    };

    window.handleSubmitListingClaim = function() {
        if (!currentUser) {
            alert('Please sign in to submit a listing claim request.');
            return;
        }

        const city = (document.getElementById('claimCityInput')?.value || '').trim();
        const category = (document.getElementById('claimCategoryInput')?.value || '').trim();
        const listingName = (document.getElementById('claimListingInput')?.value || '').trim();
        const listingId = (document.getElementById('claimListingId')?.value || '').trim();
        const description = (document.getElementById('claimDescription')?.value || '').trim();

        if (!city || !category || !listingName || !description) {
            alert('Please complete all required fields: Target City, Target Category, Listing Name, and Description.');
            return;
        }

        if (claimAttachedFiles.length === 0) {
            if (!confirm('No proof files are attached. Uploading official documents (Trade License, Bills, Visiting Card) helps verify ownership much faster. Do you still want to proceed?')) {
                return;
            }
        }

        const claim = {
            id: 'CLM-' + Date.now(),
            userId: currentUser.id || currentUser.email || ('USR_' + Date.now()),
            userName: currentUser.name || 'Merchant User',
            userEmail: currentUser.email || '',
            userPhone: currentUser.phone || '',
            city: city,
            category: category,
            listingId: listingId || '',
            listingName: listingName,
            description: description,
            documents: claimAttachedFiles.map(f => ({
                id: f.id,
                name: f.name,
                size: f.size,
                type: f.type,
                isImage: f.isImage,
                data: f.data
            })),
            status: 'Pending', // Pending | Approved | Rejected
            createdAt: new Date().toISOString(),
            adminReply: '',
            repliedAt: null
        };

        try {
            const raw = localStorage.getItem('lb_listing_claims');
            const claims = raw ? JSON.parse(raw) : [];
            claims.unshift(claim);
            localStorage.setItem('lb_listing_claims', JSON.stringify(claims));

            // Inbound notice into admin mailbox
            const rawMail = localStorage.getItem('lb_mail');
            const mail = rawMail ? JSON.parse(rawMail) : [];
            mail.unshift({
                id: 'ML-' + Date.now(),
                from: currentUser.email || currentUser.name,
                to: 'Super Admin',
                subject: `[Claim Request] ${listingName} (${city})`,
                body: `Claim submitted by ${currentUser.name} for listing "${listingName}" (${city}, ${category}). Description: ${description}`,
                type: 'inbox',
                read: false,
                claimId: claim.id,
                date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            });
            localStorage.setItem('lb_mail', JSON.stringify(mail));

            // Sync claim to Firebase Cloud Firestore for real-time Super Admin review
            if (window.lbCloudSync && typeof window.lbCloudSync.saveClaim === 'function') {
                window.lbCloudSync.saveClaim(claim);
            }
        } catch (err) {
            console.error('Save claim error:', err);
        }

        // Reset form
        document.getElementById('claimListingForm')?.reset();
        if (document.getElementById('claimListingId')) document.getElementById('claimListingId').value = '';
        const notice = document.getElementById('claimSelectedListingNotice');
        if (notice) notice.style.display = 'none';
        claimAttachedFiles = [];
        renderClaimAttachedFilesList();

        // Switch to history tab
        window.switchClaimTab('history');

        // Update hub badge
        const badge = document.getElementById('hubClaimBadge');
        if (badge) {
            badge.style.display = 'inline-block';
            badge.textContent = String(parseInt(badge.textContent || '0') + 1);
        }

        alert(`Your claim request for "${listingName}" has been submitted successfully! Super Admin will review your proof documents and approve ownership.`);
    };

    window.renderClaimHistory = function() {
        const container = document.getElementById('claimHistoryListContainer');
        const badge = document.getElementById('claimHistoryBadge');
        if (!container) return;

        let claims = [];
        try {
            const raw = localStorage.getItem('lb_listing_claims');
            claims = raw ? JSON.parse(raw) : [];
        } catch {}

        const userClaims = currentUser ? claims.filter(c => 
            String(c.userId) === String(currentUser.id) || 
            (currentUser.email && c.userEmail && c.userEmail.toLowerCase() === currentUser.email.toLowerCase())
        ) : [];

        if (badge) {
            if (userClaims.length > 0) {
                badge.style.display = 'inline-block';
                badge.textContent = userClaims.length;
            } else {
                badge.style.display = 'none';
            }
        }

        if (userClaims.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2.5rem 1rem; color: #64748b;">
                    <div style="font-size: 2.8rem; color: #cbd5e1; margin-bottom: 0.75rem;"><i class="fa-solid fa-id-card-clip"></i></div>
                    <h4 style="color: #334155; font-size: 1.05rem; margin-bottom: 0.35rem;">No Claim Requests Found</h4>
                    <p style="font-size: 0.84rem; max-width: 320px; margin: 0 auto 1.25rem auto;">You have not submitted any ownership claims yet. Claim your business to manage it directly.</p>
                    <button type="button" onclick="switchClaimTab('form')" style="background: #4f46e5; color: #ffffff; border: none; padding: 0.55rem 1.15rem; font-weight: 700; border-radius: 8px; font-size: 0.85rem; cursor: pointer;">
                        <i class="fa-solid fa-plus"></i> Submit Your First Claim
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = userClaims.map(c => {
            let statusBadge = '';
            let statusNote = '';

            if (c.status === 'Approved') {
                statusBadge = `<span style="background: #d1fae5; color: #065f46; font-size: 0.75rem; font-weight: 700; padding: 0.25rem 0.65rem; border-radius: 20px;"><i class="fa-solid fa-circle-check"></i> Approved & Assigned</span>`;
                statusNote = `
                    <div style="margin-top: 0.75rem; padding: 0.75rem; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px;">
                        <div style="font-weight: 700; color: #166534; font-size: 0.84rem;"><i class="fa-solid fa-store"></i> Ownership Activated!</div>
                        <p style="margin: 0.25rem 0 0.5rem 0; font-size: 0.8rem; color: #15803d;">This business has been transferred to your account. You can now manage its catalog, timings, photos, and leads.</p>
                        <button type="button" onclick="switchAccountScreen('viewManageListings')" style="background: #16a34a; color: #ffffff; border: none; padding: 0.35rem 0.85rem; font-size: 0.78rem; font-weight: 700; border-radius: 6px; cursor: pointer;">
                            <i class="fa-solid fa-briefcase"></i> Open in Manage Your Business
                        </button>
                    </div>
                `;
            } else if (c.status === 'Rejected') {
                statusBadge = `<span style="background: #fee2e2; color: #991b1b; font-size: 0.75rem; font-weight: 700; padding: 0.25rem 0.65rem; border-radius: 20px;"><i class="fa-solid fa-circle-xmark"></i> Rejected</span>`;
                statusNote = `
                    <div style="margin-top: 0.75rem; padding: 0.75rem; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;">
                        <div style="font-weight: 700; color: #991b1b; font-size: 0.84rem;"><i class="fa-solid fa-circle-exclamation"></i> Claim Request Rejected</div>
                        <p style="margin: 0.25rem 0 0 0; font-size: 0.8rem; color: #b91c1c;"><strong>Reason / Kano Reject Holo:</strong> ${c.adminReply || 'Proof documents were insufficient or did not match business records.'}</p>
                    </div>
                `;
            } else {
                statusBadge = `<span style="background: #fef3c7; color: #b45309; font-size: 0.75rem; font-weight: 700; padding: 0.25rem 0.65rem; border-radius: 20px;"><i class="fa-solid fa-clock"></i> Under Admin Review</span>`;
                statusNote = `
                    <div style="margin-top: 0.75rem; padding: 0.65rem 0.75rem; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; font-size: 0.8rem; color: #92400e;">
                        <i class="fa-solid fa-spinner fa-spin" style="margin-right: 0.35rem;"></i> Super Admin is reviewing your submitted proof documents. You will see approval status right here.
                    </div>
                `;
            }

            const filesHtml = (c.documents && c.documents.length > 0) ? `
                <div style="margin-top: 0.65rem; display: flex; flex-wrap: wrap; gap: 0.4rem;">
                    ${c.documents.map(d => `
                        <span style="font-size: 0.74rem; background: #f1f5f9; color: #475569; padding: 0.25rem 0.5rem; border-radius: 6px; border: 1px solid #e2e8f0; display: inline-flex; align-items: center; gap: 0.3rem;">
                            <i class="${d.isImage ? 'fa-solid fa-file-image' : 'fa-solid fa-file'}"></i> ${d.name} (${d.size || ''})
                        </span>
                    `).join('')}
                </div>
            ` : '<div style="margin-top:0.4rem; font-size:0.75rem; color:#94a3b8;">No documents attached</div>';

            const adminReplyHtml = (c.adminReply && c.status !== 'Rejected') ? `
                <div style="margin-top: 0.75rem; padding: 0.65rem 0.85rem; background: #eef2ff; border-left: 3px solid #6366f1; border-radius: 6px;">
                    <div style="font-weight: 700; font-size: 0.8rem; color: #3730a3;"><i class="fa-solid fa-message"></i> Admin Reply:</div>
                    <p style="margin: 0.2rem 0 0 0; font-size: 0.82rem; color: #4338ca;">${c.adminReply}</p>
                </div>
            ` : '';

            const dateStr = c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent';

            return `
                <div class="claim-history-card">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; flex-wrap: wrap;">
                        <div>
                            <h4 style="margin: 0; font-size: 0.98rem; color: #1e293b;">
                                <i class="fa-solid fa-store" style="color: #4f46e5; margin-right: 0.3rem;"></i> ${c.listingName}
                                ${c.listingId ? `<span style="font-size: 0.74rem; color: #64748b; font-weight: normal;">(#${c.listingId})</span>` : ''}
                            </h4>
                            <div style="font-size: 0.78rem; color: #64748b; margin-top: 0.25rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
                                <span><i class="fa-solid fa-location-dot"></i> ${c.city}</span>
                                <span>•</span>
                                <span><i class="fa-solid fa-layer-group"></i> ${c.category}</span>
                                <span>•</span>
                                <span><i class="fa-regular fa-calendar"></i> ${dateStr}</span>
                            </div>
                        </div>
                        <div>${statusBadge}</div>
                    </div>

                    <div style="margin-top: 0.65rem; font-size: 0.82rem; color: #334155; background: #f8fafc; padding: 0.55rem 0.75rem; border-radius: 6px;">
                        <strong>Claim Statement:</strong> ${c.description}
                    </div>

                    ${filesHtml}
                    ${adminReplyHtml}
                    ${statusNote}
                </div>
            `;
        }).join('');
    };

    // ================= 5. LOG OUT ACTION =================
    window.handleHubSignOut = function() {
        if (confirm('Are you sure you want to sign out from LocalBazar?')) {
            try {
                if (window.firebase && window.firebase.auth) {
                    firebase.auth().signOut().catch(() => {});
                }
            } catch (e) {}
            localStorage.removeItem('lb_current_user');
            window.location.href = 'index.html';
        }
    };

    // ================= 7. TRUST BADGE VERIFICATION APPLICATION SUITE =================
    let trustUploadedDocBase64 = null;
    let selectedTrustStoreId = null;

    window.openTrustApplyForm = function() {
        const formSec = document.getElementById('trustApplicationSection');
        if (formSec) {
            formSec.style.display = 'block';
            formSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    window.closeTrustApplyForm = function() {
        const formSec = document.getElementById('trustApplicationSection');
        if (formSec) {
            formSec.style.display = 'none';
        }
    };

    window.selectStoreForTrustBadge = function(storeId) {
        selectedTrustStoreId = String(storeId);
        const hiddenInput = document.getElementById('trustSelectedStoreId');
        if (hiddenInput) hiddenInput.value = selectedTrustStoreId;
        window.closeTrustApplyForm();
        window.renderTrustStoresList();
        window.renderTrustBadgeStatusView();
    };

    window.initTrustBadgeView = function() {
        trustUploadedDocBase64 = null;
        const uploadPlaceholder = document.getElementById('trustDocUploadPlaceholder');
        const previewWrap = document.getElementById('trustDocPreviewWrap');
        if (uploadPlaceholder) uploadPlaceholder.style.display = 'block';
        if (previewWrap) previewWrap.style.display = 'none';

        // Prefill owner name from currentUser
        const ownerInput = document.getElementById('trustOwnerName');
        if (ownerInput && currentUser && currentUser.name) {
            ownerInput.value = currentUser.name;
        }

        window.renderTrustStoresList();
        window.renderTrustBadgeStatusView();
    };

    window.renderTrustStoresList = function() {
        const container = document.getElementById('trustStoresListContainer');
        const countText = document.getElementById('trustStoresCountText');
        if (!container) return;

        let listings = [];
        try {
            const raw = localStorage.getItem('lb_listings');
            listings = raw ? JSON.parse(raw) : [];
        } catch {}

        const owned = currentUser ? listings.filter(l => 
            (currentUser.id && String(l.ownerId) === String(currentUser.id)) ||
            (currentUser.email && l.ownerId && l.ownerId.toLowerCase() === currentUser.email.toLowerCase()) ||
            (currentUser.email && l.ownerEmail && l.ownerEmail.toLowerCase() === currentUser.email.toLowerCase()) ||
            (currentUser.phone && l.phone && l.phone === currentUser.phone) ||
            (currentUser.phone && l.ownerPhone && l.ownerPhone === currentUser.phone) ||
            (currentUser.email && l.claimedBy && l.claimedBy.toLowerCase() === currentUser.email.toLowerCase())
        ) : [];

        if (owned.length === 0) {
            container.innerHTML = `<div style="padding:1rem; text-align:center; color:#64748b; font-size:0.85rem;">No registered businesses found on your account.</div>`;
            return;
        }

        if (countText) countText.textContent = `${owned.length} ${owned.length === 1 ? 'Store' : 'Stores / Outlets'}`;

        let reqs = [];
        try {
            const raw = localStorage.getItem('lb_trust_requests');
            reqs = raw ? JSON.parse(raw) : [];
        } catch {}

        // If no store currently selected, default to the first one
        if (!selectedTrustStoreId || !owned.some(s => String(s.id) === String(selectedTrustStoreId))) {
            selectedTrustStoreId = String(owned[0].id);
            const hiddenInput = document.getElementById('trustSelectedStoreId');
            if (hiddenInput) hiddenInput.value = selectedTrustStoreId;
        }

        container.innerHTML = owned.map(s => {
            const isSelected = String(s.id) === String(selectedTrustStoreId);
            const isTrusted = !!(s.hasTrustBadge === true || s.status === 'Verified');
            const pendingReq = reqs.find(r => String(r.listingId) === String(s.id) && r.status === 'Pending');

            let badgeHtml = '';
            if (isTrusted) {
                badgeHtml = `<span style="background:#fef3c7; color:#78350f; border:1.5px solid #fde68a; font-weight:800; font-size:0.75rem; padding:0.25rem 0.65rem; border-radius:20px; display:inline-flex; align-items:center; gap:0.3rem;"><i class="fa-solid fa-crown" style="color:#d97706;"></i> Trusted</span>`;
            } else if (pendingReq) {
                badgeHtml = `<span style="background:#eff6ff; color:#1d4ed8; border:1.5px solid #bfdbfe; font-weight:800; font-size:0.75rem; padding:0.25rem 0.65rem; border-radius:20px; display:inline-flex; align-items:center; gap:0.3rem;"><i class="fa-solid fa-clock" style="color:#2563eb;"></i> In Review</span>`;
            } else {
                badgeHtml = `<span style="background:#f1f5f9; color:#64748b; border:1.5px solid #cbd5e1; font-weight:700; font-size:0.75rem; padding:0.25rem 0.65rem; border-radius:20px; display:inline-flex; align-items:center; gap:0.3rem;"><i class="fa-solid fa-shield-xmark" style="color:#94a3b8;"></i> Not Trusted</span>`;
            }

            const storeImg = s.image || (Array.isArray(s.gallery) && s.gallery[0]) || 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=100&auto=format&fit=crop&q=80';

            return `
                <div class="trust-store-item-row" 
                     onclick="selectStoreForTrustBadge('${s.id}')"
                     style="display:flex; align-items:center; justify-content:space-between; gap:0.75rem; padding:0.85rem 1rem; background:${isSelected ? '#fffbeb' : '#ffffff'}; border:2px solid ${isSelected ? '#f59e0b' : '#e2e8f0'}; border-radius:14px; cursor:pointer; transition:all 0.2s ease; box-shadow:${isSelected ? '0 4px 14px rgba(245,158,11,0.18)' : '0 1px 3px rgba(0,0,0,0.03)'};">
                    <div style="display:flex; align-items:center; gap:0.75rem; min-width:0;">
                        <img src="${storeImg}" alt="${s.name}" style="width:42px; height:42px; border-radius:10px; object-fit:cover; border:1px solid #e2e8f0; flex-shrink:0;">
                        <div style="min-width:0;">
                            <div style="display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap;">
                                <strong style="font-size:0.92rem; color:#1e293b; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${s.name}</strong>
                                ${s.isBranch ? `<span style="font-size:0.68rem; font-weight:700; background:#f1f5f9; color:#475569; padding:0.1rem 0.4rem; border-radius:8px;">Branch</span>` : ''}
                            </div>
                            <div style="font-size:0.78rem; color:#64748b; margin-top:0.15rem;">
                                <i class="fa-solid fa-location-dot"></i> ${s.city || 'Local Area'} • <span style="color:#2563eb;">${s.category || 'Business'}</span>
                            </div>
                        </div>
                    </div>
                    <div style="flex-shrink:0;">
                        ${badgeHtml}
                    </div>
                </div>
            `;
        }).join('');
    };

    window.renderTrustBadgeStatusView = function() {
        const wrap = document.getElementById('trustStatusCardWrap');
        if (!wrap) return;

        let listings = [];
        try {
            const raw = localStorage.getItem('lb_listings');
            listings = raw ? JSON.parse(raw) : [];
        } catch {}

        const owned = currentUser ? listings.filter(l => 
            (currentUser.id && String(l.ownerId) === String(currentUser.id)) ||
            (currentUser.email && l.ownerId && l.ownerId.toLowerCase() === currentUser.email.toLowerCase()) ||
            (currentUser.email && l.ownerEmail && l.ownerEmail.toLowerCase() === currentUser.email.toLowerCase()) ||
            (currentUser.phone && l.phone && l.phone === currentUser.phone) ||
            (currentUser.phone && l.ownerPhone && l.ownerPhone === currentUser.phone) ||
            (currentUser.email && l.claimedBy && l.claimedBy.toLowerCase() === currentUser.email.toLowerCase())
        ) : [];

        if (owned.length === 0) {
            wrap.innerHTML = `
                <div style="background:#f8fafc; border:2px dashed #cbd5e1; border-radius:16px; padding:2.5rem 1.25rem; text-align:center;">
                    <div style="font-size:2.8rem; color:#94a3b8; margin-bottom:0.75rem;"><i class="fa-solid fa-store-slash"></i></div>
                    <h3 style="color:#1e293b; font-size:1.15rem; font-weight:800; margin-bottom:0.4rem;">No Registered Business Found</h3>
                    <p style="font-size:0.86rem; color:#64748b; max-width:380px; margin:0 auto 1.5rem auto; line-height:1.45;">
                        To activate the official Gold Trust Badge, you must first register your business or shop on LocalBazar.
                    </p>
                    <button type="button" onclick="switchAccountScreen('viewAddListing')" style="background:linear-gradient(135deg, #2563eb, #1d4ed8); color:#ffffff; border:none; padding:0.65rem 1.4rem; border-radius:10px; font-weight:800; font-size:0.88rem; cursor:pointer;">
                        <i class="fa-solid fa-plus-circle"></i> Add Business Listing
                    </button>
                </div>
            `;
            window.closeTrustApplyForm();
            return;
        }

        const currentStore = owned.find(s => String(s.id) === String(selectedTrustStoreId)) || owned[0];
        if (!currentStore) return;

        // Check if store already has Trust Badge
        const isTrusted = !!(currentStore.hasTrustBadge === true || currentStore.status === 'Verified');

        // Check for any pending or rejected requests in lb_trust_requests
        let reqs = [];
        try {
            const raw = localStorage.getItem('lb_trust_requests');
            reqs = raw ? JSON.parse(raw) : [];
        } catch {}

        const pendingReq = reqs.find(r => String(r.listingId) === String(currentStore.id) && r.status === 'Pending');
        const rejectedReq = reqs.find(r => String(r.listingId) === String(currentStore.id) && r.status === 'Rejected');

        if (isTrusted) {
            // Calculate expiry and validity
            const expTime = currentStore.trustExpiresAt 
                ? new Date(currentStore.trustExpiresAt).getTime()
                : (new Date(currentStore.trustActivatedAt || currentStore.createdAt || Date.now()).getTime() + 365 * 24 * 60 * 60 * 1000);
            
            const isExpired = Date.now() > expTime;
            const daysRemaining = Math.max(0, Math.ceil((expTime - Date.now()) / (1000 * 60 * 60 * 24)));
            const expDateStr = new Date(expTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

            if (isExpired) {
                // ================= EXPIRED TRUST STATE =================
                wrap.innerHTML = `
                    <div style="background: #fff1f2; border: 2px solid #fecdd3; border-radius: 18px; padding: 2rem 1.25rem; text-align: center; box-shadow: 0 6px 20px rgba(225,29,72,0.08);">
                        <div style="display: inline-flex; align-items: center; justify-content: center; width: 68px; height: 68px; border-radius: 50%; background: #fee2e2; color: #e11d48; font-size: 2rem; margin-bottom: 0.9rem; border: 2px solid #fecdd3;">
                            <i class="fa-solid fa-triangle-exclamation"></i>
                        </div>
                        <div style="display: flex; justify-content: center; gap: 0.4rem; margin-bottom: 0.5rem;">
                            <span style="background: #fee2e2; color: #991b1b; font-size: 0.74rem; font-weight: 800; padding: 0.25rem 0.75rem; border-radius: 20px;">
                                1-Year Plan Expired on ${expDateStr}
                            </span>
                        </div>
                        <h2 style="margin: 0 0 0.4rem 0; font-size: 1.45rem; font-weight: 900; color: #9f1239;">
                            TRUST BADGE EXPIRED
                        </h2>
                        <p style="margin: 0 auto 1.25rem auto; font-size: 0.88rem; color: #be123c; max-width: 440px; line-height: 1.5;">
                            The 1-year Trust Badge for <strong>${currentStore.name}</strong> has expired. Please submit an annual renewal of ₹99 to reactivate your official Gold Trust priority.
                        </p>
                        <button type="button" onclick="openTrustApplyForm()" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; border: none; padding: 0.85rem 1.85rem; border-radius: 12px; font-size: 0.95rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 0.5rem; box-shadow: 0 6px 20px rgba(245, 158, 11, 0.35);">
                            <i class="fa-solid fa-arrows-rotate"></i> Renew Trust Badge (₹99 / 1 Year)
                        </button>
                    </div>
                `;
            } else {
                // ================= 1. STORE HAS TRUST BADGE (BIG GOLD VERIFIED CARD) =================
                // Exactly as requested:
                // Official Verified Merchant
                // 1-Year Active Plan
                // ✔ TRUSTED BUSINESS
                // Congratulations! Sathi Pan has successfully unlocked the Gold Trust Badge. Your business is featured with high trust priority across LocalBazar.
                // NO "View Live Store Page" button!
                // Displays expiry date and remaining days!
                wrap.innerHTML = `
                    <div style="background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border: 2px solid #f59e0b; border-radius: 18px; padding: 2rem 1.25rem; text-align: center; box-shadow: 0 10px 25px rgba(245, 158, 11, 0.18); position: relative; overflow: hidden;">
                        <div style="position: absolute; top: -20px; right: -20px; width: 100px; height: 100px; background: rgba(245, 158, 11, 0.12); border-radius: 50%;"></div>
                        
                        <div style="display: inline-flex; align-items: center; justify-content: center; width: 72px; height: 72px; border-radius: 50%; background: linear-gradient(135deg, #f59e0b, #d97706); color: #ffffff; font-size: 2.2rem; margin-bottom: 1rem; box-shadow: 0 6px 20px rgba(217, 119, 6, 0.35);">
                            <i class="fa-solid fa-crown"></i>
                        </div>

                        <div style="display: flex; justify-content: center; gap: 0.5rem; margin-bottom: 0.65rem; flex-wrap: wrap;">
                            <span style="background: #d97706; color: #ffffff; font-size: 0.75rem; font-weight: 800; padding: 0.25rem 0.75rem; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;">
                                <i class="fa-solid fa-circle-check"></i> Official Verified Merchant
                            </span>
                            <span style="background: #ffffff; color: #92400e; font-size: 0.75rem; font-weight: 800; padding: 0.25rem 0.75rem; border-radius: 20px; border: 1px solid #fde68a;">
                                <i class="fa-solid fa-calendar-check"></i> 1-Year Active Plan
                            </span>
                        </div>

                        <h2 style="margin: 0 0 0.4rem 0; font-size: 1.6rem; font-weight: 900; color: #78350f; display: flex; align-items: center; justify-content: center; gap: 0.4rem;">
                            ✔ TRUSTED BUSINESS
                        </h2>

                        <p style="margin: 0 auto 1.25rem auto; font-size: 0.92rem; color: #92400e; max-width: 440px; line-height: 1.5;">
                            Congratulations! <strong>${currentStore.name}</strong> has successfully unlocked the Gold Trust Badge. Your business is featured with high trust priority across LocalBazar.
                        </p>

                        <!-- Validity & Expiry Countdown Container -->
                        <div style="background:#ffffff; border:1.5px solid #fde68a; border-radius:12px; padding:0.95rem 1.15rem; max-width:380px; margin:0 auto; box-shadow:0 2px 8px rgba(245,158,11,0.08);">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
                                <span style="font-size:0.82rem; color:#64748b; font-weight:700;"><i class="fa-regular fa-calendar-check" style="color:#d97706;"></i> Valid Until:</span>
                                <strong style="font-size:0.88rem; color:#78350f;">${expDateStr}</strong>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center; padding-top:0.4rem; border-top:1px dashed #fde68a;">
                                <span style="font-size:0.82rem; color:#64748b; font-weight:700;"><i class="fa-regular fa-clock" style="color:#15803d;"></i> Days Remaining:</span>
                                <span style="font-size:0.88rem; font-weight:800; color:#15803d; background:#f0fdf4; border:1px solid #bbf7d0; padding:0.1rem 0.55rem; border-radius:10px;">${daysRemaining} Days</span>
                            </div>
                            <p style="margin:0.55rem 0 0 0; font-size:0.74rem; color:#b45309; line-height:1.4;">
                                <i class="fa-solid fa-circle-info"></i> When this 1-year date arrives, your badge will expire and can be renewed for ₹99 to maintain your trusted status.
                            </p>
                        </div>
                    </div>
                `;
            }
            window.closeTrustApplyForm();
        } else if (pendingReq) {
            // ================= 2. STORE HAS PENDING AUDIT (AMBER CARD) =================
            wrap.innerHTML = `
                <div style="background: #fffbeb; border: 2px solid #fde68a; border-radius: 18px; padding: 2rem 1.25rem; text-align: center; box-shadow: 0 6px 20px rgba(245, 158, 11, 0.08);">
                    <div style="display: inline-flex; align-items: center; justify-content: center; width: 68px; height: 68px; border-radius: 50%; background: #fef3c7; color: #d97706; font-size: 2rem; margin-bottom: 0.9rem; border: 2px solid #fde68a;">
                        <i class="fa-solid fa-clock-rotate-left"></i>
                    </div>

                    <div style="display: flex; justify-content: center; gap: 0.4rem; margin-bottom: 0.5rem;">
                        <span style="background: #fef3c7; color: #b45309; border: 1px solid #fde68a; font-size: 0.74rem; font-weight: 800; padding: 0.25rem 0.75rem; border-radius: 20px;">
                            <i class="fa-solid fa-spinner fa-spin"></i> Audit in Progress
                        </span>
                    </div>

                    <h2 style="margin: 0 0 0.4rem 0; font-size: 1.45rem; font-weight: 900; color: #92400e;">
                        ⏳ AUDIT IN PROGRESS
                    </h2>

                    <p style="margin: 0 auto 1rem auto; font-size: 0.88rem; color: #b45309; max-width: 440px; line-height: 1.45;">
                        Your application for <strong>${currentStore.name}</strong> is currently being reviewed by Super Admin.
                    </p>

                    <div style="background: #ffffff; border: 1px solid #fde68a; border-radius: 12px; padding: 0.85rem 1.15rem; max-width: 380px; margin: 0 auto 1.25rem auto; font-size: 0.84rem; color: #78350f; text-align: left;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:0.35rem;">
                            <span style="color:#64748b;">Business:</span>
                            <strong>${currentStore.name}</strong>
                        </div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:0.35rem;">
                            <span style="color:#64748b;">Plan & Fee:</span>
                            <strong style="color:#059669;">₹99 / 1 Year Validity</strong>
                        </div>
                        <div style="display:flex; justify-content:space-between;">
                            <span style="color:#64748b;">UPI Ref / UTR:</span>
                            <span style="font-family:monospace; font-weight:800; color:#1e293b;">${pendingReq.paymentUtr}</span>
                        </div>
                    </div>

                    <p style="font-size:0.8rem; color:#92400e; margin:0; line-height:1.4;">
                        <i class="fa-solid fa-shield-halved"></i> Admin verifies the payment & document proof within a few hours. Once approved, your Gold Trust Badge turns active automatically!
                    </p>
                </div>
            `;
            window.closeTrustApplyForm();
        } else {
            // ================= 3. STORE DOES NOT HAVE TRUST BADGE (BIG PROMPT CARD + APPLY NOW) =================
            // As requested: "badge asba na ..tar bodola apply now botton asba"
            wrap.innerHTML = `
                <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 2px dashed #cbd5e1; border-radius: 18px; padding: 2rem 1.25rem; text-align: center;">
                    <div style="display: inline-flex; align-items: center; justify-content: center; width: 68px; height: 68px; border-radius: 50%; background: #ffffff; color: #64748b; font-size: 2rem; margin-bottom: 0.85rem; border: 2px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.04);">
                        <i class="fa-solid fa-shield-xmark"></i>
                    </div>

                    <div style="display: flex; justify-content: center; gap: 0.5rem; margin-bottom: 0.5rem; flex-wrap: wrap;">
                        <span style="background: #fee2e2; color: #991b1b; font-size: 0.74rem; font-weight: 800; padding: 0.25rem 0.75rem; border-radius: 20px;">
                            No Active Trust Badge
                        </span>
                        <span style="background: #fef3c7; color: #b45309; font-size: 0.74rem; font-weight: 800; padding: 0.25rem 0.75rem; border-radius: 20px; border: 1px solid #fde68a;">
                            Special: ₹99 / 1 Year Plan
                        </span>
                    </div>

                    <h2 style="margin: 0 0 0.4rem 0; font-size: 1.5rem; font-weight: 900; color: #1e293b;">
                        NOT TRUSTED YET
                    </h2>

                    <p style="margin: 0 auto 1.25rem auto; font-size: 0.88rem; color: #64748b; max-width: 440px; line-height: 1.5;">
                        <strong>${currentStore.name}</strong> is currently unverified. Get the official Gold <strong>✔ Trust</strong> badge for 1 full year and double your customer inquiries.
                    </p>

                    ${rejectedReq ? `
                        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 0.75rem 1rem; max-width: 420px; margin: 0 auto 1.25rem auto; font-size: 0.82rem; color: #991b1b; text-align: left;">
                            <div style="font-weight: 800;"><i class="fa-solid fa-circle-exclamation"></i> Previous Application Not Approved:</div>
                            <div style="margin-top: 0.25rem;">${rejectedReq.adminRemarks || 'Document proof or UTR could not be verified.'} You can re-apply with corrected details below.</div>
                        </div>
                    ` : ''}

                    <div style="display: flex; justify-content: center;">
                        <button type="button" onclick="openTrustApplyForm()" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; border: none; padding: 0.85rem 1.85rem; border-radius: 12px; font-size: 0.95rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 0.5rem; box-shadow: 0 6px 20px rgba(245, 158, 11, 0.35);">
                            <i class="fa-solid fa-shield-halved"></i> Apply Now for Trust Badge (₹99 / Year)
                        </button>
                    </div>
                </div>
            `;
        }
    };

    window.handleTrustDocFileSelected = function(e) {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(evt) {
            trustUploadedDocBase64 = evt.target.result;
            const uploadPlaceholder = document.getElementById('trustDocUploadPlaceholder');
            const previewWrap = document.getElementById('trustDocPreviewWrap');
            const previewImg = document.getElementById('trustDocPreviewImg');

            if (uploadPlaceholder) uploadPlaceholder.style.display = 'none';
            if (previewWrap) previewWrap.style.display = 'block';
            if (previewImg) {
                previewImg.src = file.type.startsWith('image/') ? trustUploadedDocBase64 : 'https://cdn-icons-png.flaticon.com/512/337/337946.png';
            }
        };
        reader.readAsDataURL(file);
    };

    window.handleTrustBadgeSubmit = async function() {
        if (!currentUser) {
            showHubToast('Please login to apply for Trust Badge', 'warning');
            return;
        }

        const storeId = selectedTrustStoreId || document.getElementById('trustSelectedStoreId')?.value;
        const ownerName = document.getElementById('trustOwnerName')?.value?.trim();
        const docType = document.getElementById('trustDocType')?.value;
        const docNumber = document.getElementById('trustDocNumber')?.value?.trim() || 'N/A';
        const paymentUtr = document.getElementById('trustPaymentUtr')?.value?.trim();

        if (!storeId) {
            showHubToast('Please select your business / shop from the list above', 'warning');
            return;
        }
        if (!ownerName) {
            showHubToast('Please enter proprietor / owner full name', 'warning');
            return;
        }
        if (!trustUploadedDocBase64) {
            showHubToast('Please upload verification document or shop photo proof', 'warning');
            return;
        }
        if (!paymentUtr || paymentUtr.length < 6) {
            showHubToast('Please enter a valid 12-digit UPI UTR / Transaction ID', 'warning');
            return;
        }

        let listings = [];
        try {
            const raw = localStorage.getItem('lb_listings');
            listings = raw ? JSON.parse(raw) : [];
        } catch {}

        const targetStore = listings.find(l => String(l.id).trim() === String(storeId).trim());
        const storeName = targetStore ? targetStore.name : 'Unknown Store';
        const storeCity = targetStore ? targetStore.city : 'Local Area';

        const reqId = 'trust_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

        const newTrustRequest = {
            id: reqId,
            listingId: storeId,
            listingName: storeName,
            listingCity: storeCity,
            userId: currentUser.id || 'USR_DIRECT',
            userEmail: currentUser.email || '',
            userPhone: currentUser.phone || '',
            ownerName: ownerName,
            docType: docType,
            docNumber: docNumber,
            docProof: trustUploadedDocBase64,
            paymentAmount: 99,
            plan: '1 Year',
            validityDays: 365,
            paymentUtr: paymentUtr,
            status: 'Pending',
            createdAt: new Date().toISOString(),
            adminRemarks: ''
        };

        // Save to localStorage
        let existingReqs = [];
        try {
            const raw = localStorage.getItem('lb_trust_requests');
            existingReqs = raw ? JSON.parse(raw) : [];
        } catch {}
        existingReqs.unshift(newTrustRequest);
        localStorage.setItem('lb_trust_requests', JSON.stringify(existingReqs));

        // Sync to Cloud Firestore
        if (window.lbCloudSync && typeof window.lbCloudSync.saveTrustRequest === 'function') {
            try {
                await window.lbCloudSync.saveTrustRequest(newTrustRequest);
            } catch (err) {
                console.warn('Sync trust request error:', err);
            }
        }

        // Notify Admin via internal mail
        try {
            const rawMail = localStorage.getItem('lb_mail');
            const mail = rawMail ? JSON.parse(rawMail) : [];
            mail.unshift({
                id: 'm_' + Date.now(),
                from: currentUser.name || ownerName,
                email: currentUser.email || '',
                phone: currentUser.phone || '',
                to: 'Super Admin',
                subject: `[Trust Badge Request] ${storeName} (${storeCity}) - ₹99 (1 Year Plan)`,
                body: `Trust Badge Verification applied by ${ownerName} for "${storeName}". Plan: 1 Year (₹99), UTR: ${paymentUtr}, Doc: ${docType} (${docNumber}).`,
                type: 'inbox',
                read: false,
                date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            });
            localStorage.setItem('lb_mail', JSON.stringify(mail));
        } catch {}

        // Reset inputs and close form
        document.getElementById('trustBadgeForm')?.reset();
        trustUploadedDocBase64 = null;
        const uploadPlaceholder = document.getElementById('trustDocUploadPlaceholder');
        const previewWrap = document.getElementById('trustDocPreviewWrap');
        if (uploadPlaceholder) uploadPlaceholder.style.display = 'block';
        if (previewWrap) previewWrap.style.display = 'none';

        window.closeTrustApplyForm();
        window.renderTrustStoresList();
        window.renderTrustBadgeStatusView();
        showHubToast(`Application submitted! Super Admin will audit and activate the 1-Year Gold Trust Badge shortly.`, 'success');
    };

    // ================= 8. UNIFIED MERCHANT INBOX SUITE =================
    let currentUnifiedFilter = 'all'; // 'all' or 'unread'
    let activeUnifiedStoreId = null;
    let activeUnifiedThreadId = null;

    function getMerchantOwnedStores() {
        let listings = [];
        try {
            const raw = localStorage.getItem('lb_listings');
            listings = raw ? JSON.parse(raw) : [];
        } catch {
            listings = [];
        }
        if (!currentUser) return [];
        return listings.filter(l => 
            (currentUser.id && String(l.ownerId) === String(currentUser.id)) ||
            (currentUser.email && l.ownerId && l.ownerId.toLowerCase() === currentUser.email.toLowerCase()) ||
            (currentUser.email && l.ownerEmail && l.ownerEmail.toLowerCase() === currentUser.email.toLowerCase()) ||
            (currentUser.phone && l.phone && l.phone === currentUser.phone) ||
            (currentUser.phone && l.ownerPhone && l.ownerPhone === currentUser.phone) ||
            (currentUser.email && l.claimedBy && l.claimedBy.toLowerCase() === currentUser.email.toLowerCase())
        );
    }

    function getAllMerchantInboxThreads() {
        const ownedStores = getMerchantOwnedStores();
        const allThreads = [];

        ownedStores.forEach(store => {
            try {
                const raw = localStorage.getItem(`lb_store_inbox_${store.id}`);
                if (raw) {
                    const threads = JSON.parse(raw);
                    if (Array.isArray(threads)) {
                        threads.forEach(t => {
                            allThreads.push({
                                ...t,
                                storeId: store.id,
                                storeName: store.name,
                                storeCity: store.city || 'Local Area',
                                storeImage: store.image || ''
                            });
                        });
                    }
                }
            } catch {}
        });

        // Sort by latest message timestamp descending
        allThreads.sort((a, b) => {
            const aLastMsg = a.messages && a.messages[a.messages.length - 1];
            const bLastMsg = b.messages && b.messages[b.messages.length - 1];
            const aTs = (aLastMsg && (aLastMsg.timestamp || (aLastMsg.time ? new Date(aLastMsg.time).getTime() : 0))) || 0;
            const bTs = (bLastMsg && (bLastMsg.timestamp || (bLastMsg.time ? new Date(bLastMsg.time).getTime() : 0))) || 0;
            return bTs - aTs;
        });

        return allThreads;
    }

    window.openUnifiedMerchantInbox = function(storeId) {
        switchAccountScreen('viewMerchantInbox');
        if (storeId) {
            const filterEl = document.getElementById('unifiedInboxStoreFilter');
            if (filterEl) filterEl.value = storeId;
        }
        window.initUnifiedMerchantInbox();
    };

    window.initUnifiedMerchantInbox = function() {
        const storeFilter = document.getElementById('unifiedInboxStoreFilter');
        const ownedStores = getMerchantOwnedStores();

        if (storeFilter) {
            const currentVal = storeFilter.value || 'ALL';
            storeFilter.innerHTML = `<option value="ALL">All Your Businesses (${ownedStores.length})</option>` +
                ownedStores.map(s => `<option value="${s.id}">${s.name} (${s.city || 'Local Area'})</option>`).join('');
            if (ownedStores.some(s => String(s.id) === String(currentVal))) {
                storeFilter.value = currentVal;
            } else {
                storeFilter.value = 'ALL';
            }
        }

        window.renderUnifiedInboxThreads();
    };

    window.setUnifiedChatFilter = function(filter) {
        currentUnifiedFilter = filter;
        const btnAll = document.getElementById('btnFilterAllChats');
        const btnUnread = document.getElementById('btnFilterUnreadChats');
        if (filter === 'all') {
            if (btnAll) {
                btnAll.style.background = '#2563eb';
                btnAll.style.color = '#ffffff';
                btnAll.style.border = 'none';
            }
            if (btnUnread) {
                btnUnread.style.background = '#f1f5f9';
                btnUnread.style.color = '#475569';
                btnUnread.style.border = '1px solid #cbd5e1';
            }
        } else {
            if (btnUnread) {
                btnUnread.style.background = '#2563eb';
                btnUnread.style.color = '#ffffff';
                btnUnread.style.border = 'none';
            }
            if (btnAll) {
                btnAll.style.background = '#f1f5f9';
                btnAll.style.color = '#475569';
                btnAll.style.border = '1px solid #cbd5e1';
            }
        }
        window.renderUnifiedInboxThreads();
    };

    window.renderUnifiedInboxThreads = function() {
        const container = document.getElementById('unifiedInboxThreadsList');
        if (!container) return;

        const storeFilter = document.getElementById('unifiedInboxStoreFilter')?.value || 'ALL';
        let allThreads = getAllMerchantInboxThreads();

        if (storeFilter !== 'ALL') {
            allThreads = allThreads.filter(t => String(t.storeId) === String(storeFilter));
        }

        if (currentUnifiedFilter === 'unread') {
            allThreads = allThreads.filter(t => !!t.unread);
        }

        // Update badge count
        const totalUnread = allThreads.filter(t => !!t.unread).length;
        const badge = document.getElementById('unifiedInboxBadgeCount');
        if (badge) {
            if (totalUnread > 0) {
                badge.textContent = totalUnread;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        }

        if (allThreads.length === 0) {
            container.innerHTML = `
                <div style="padding:2.5rem 1rem; text-align:center; color:#64748b;">
                    <div style="font-size:2.2rem; color:#cbd5e1; margin-bottom:0.6rem;"><i class="fa-regular fa-comments"></i></div>
                    <div style="font-weight:700; color:#334155; font-size:0.95rem;">No customer inquiries found</div>
                    <p style="font-size:0.8rem; margin:0.35rem 0 0 0; color:#94a3b8;">When customers send inquiries from your shop or products, they will appear here instantly.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = allThreads.map(t => {
            const lastMsgObj = t.messages && t.messages[t.messages.length - 1];
            const lastMsgText = lastMsgObj ? lastMsgObj.text : 'New customer inquiry';
            const initial = (t.userName || 'Customer').charAt(0).toUpperCase();
            const isActive = t.id === activeUnifiedThreadId && t.storeId === activeUnifiedStoreId;
            const hasProduct = lastMsgObj && lastMsgObj.product && lastMsgObj.product.name;

            return `
                <div class="m-inbox-thread-item ${isActive ? 'active' : ''} ${t.unread ? 'unread' : ''}" 
                     onclick="selectUnifiedInboxThread('${t.id}', '${t.storeId}')"
                     style="cursor:pointer; position:relative; padding:0.85rem 1rem; border-bottom:1px solid #f1f5f9; display:flex; align-items:center; gap:0.75rem;">
                    <div class="m-thread-avatar" style="background:linear-gradient(135deg, #3b82f6, #1d4ed8); color:#ffffff; font-weight:800; width:40px; height:40px; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                        ${initial}
                    </div>
                    <div class="m-thread-info" style="flex:1; min-width:0;">
                        <div class="m-thread-top" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
                            <span class="m-thread-name" style="font-size:0.9rem; font-weight:700; color:#1e293b; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                                ${t.userName || 'Customer'}
                            </span>
                            <span class="m-thread-time" style="font-size:0.74rem; color:#94a3b8;">
                                ${t.lastTime || ''}
                            </span>
                        </div>
                        <div style="display:flex; align-items:center; gap:0.35rem; margin-bottom:0.25rem; flex-wrap:wrap;">
                            <span style="font-size:0.68rem; font-weight:700; background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; padding:0.05rem 0.4rem; border-radius:10px; display:inline-flex; align-items:center; gap:0.25rem;">
                                <i class="fa-solid fa-store" style="font-size:0.6rem;"></i> ${t.storeName}
                            </span>
                            ${hasProduct ? `
                                <span style="font-size:0.68rem; font-weight:700; background:#fef3c7; color:#92400e; border:1px solid #fde68a; padding:0.05rem 0.4rem; border-radius:10px; display:inline-flex; align-items:center; gap:0.25rem;">
                                    <i class="fa-solid fa-tag" style="font-size:0.6rem;"></i> ${lastMsgObj.product.name}
                                </span>
                            ` : ''}
                        </div>
                        <p class="m-thread-last-msg" style="margin:0; font-size:0.8rem; color:#64748b; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                            ${lastMsgText}
                        </p>
                    </div>
                    ${t.unread ? `
                        <div style="width:9px; height:9px; border-radius:50%; background:#2563eb; position:absolute; right:12px; top:50%; transform:translateY(-50%);"></div>
                    ` : ''}
                </div>
            `;
        }).join('');

        // If an active thread is loaded, refresh chat panel
        if (activeUnifiedThreadId && activeUnifiedStoreId) {
            const currentThread = allThreads.find(t => t.id === activeUnifiedThreadId && t.storeId === activeUnifiedStoreId);
            if (currentThread) {
                window.renderUnifiedActiveChat(currentThread);
            }
        }
    };

    window.selectUnifiedInboxThread = function(threadId, storeId) {
        activeUnifiedThreadId = threadId;
        activeUnifiedStoreId = storeId;

        // Mark as read in store inbox
        let threads = getStoreInboxMessages(storeId);
        const thread = threads.find(t => t.id === threadId);
        if (thread) {
            thread.unread = false;
            saveStoreInboxMessages(storeId, threads);
        }

        // Mobile responsiveness: open chat panel
        const layout = document.getElementById('unifiedInboxLayout');
        if (layout) layout.classList.add('mobile-chat-open');

        window.renderUnifiedInboxThreads();

        if (thread) {
            const storeInfo = getMerchantOwnedStores().find(s => String(s.id) === String(storeId));
            window.renderUnifiedActiveChat({
                ...thread,
                storeId: storeId,
                storeName: storeInfo ? storeInfo.name : 'Store',
                storeCity: storeInfo ? storeInfo.city : 'Local Area'
            });
        }
    };

    window.closeUnifiedMobileChat = function() {
        const layout = document.getElementById('unifiedInboxLayout');
        if (layout) layout.classList.remove('mobile-chat-open');
    };

    window.renderUnifiedActiveChat = function(thread) {
        const placeholder = document.getElementById('unifiedInboxEmptyPlaceholder');
        const panel = document.getElementById('unifiedInboxChatPanel');
        const avatar = document.getElementById('unifiedActiveChatAvatar');
        const name = document.getElementById('unifiedActiveChatName');
        const phone = document.getElementById('unifiedActiveChatPhone');
        const storeBadge = document.getElementById('unifiedActiveChatStoreBadge');
        const msgList = document.getElementById('unifiedActiveChatMessages');
        const btnWa = document.getElementById('btnUnifiedWaCustomer');
        const btnCall = document.getElementById('btnUnifiedCallCustomer');

        if (placeholder) placeholder.style.display = 'none';
        if (panel) panel.style.display = 'flex';

        if (avatar) avatar.textContent = (thread.userName || 'Customer').charAt(0).toUpperCase();
        if (name) name.textContent = thread.userName || 'Customer';
        if (storeBadge) storeBadge.textContent = `${thread.storeName} (${thread.storeCity || 'Local'})`;

        const cleanPhone = (thread.userPhone || '').trim();
        if (phone) {
            phone.innerHTML = cleanPhone ? `<i class="fa-solid fa-phone" style="font-size:0.7rem;"></i> ${cleanPhone}` : `<i class="fa-solid fa-circle-user" style="font-size:0.7rem;"></i> In-App Customer Inquiry`;
        }

        // WhatsApp action
        const cleanDigits = cleanPhone.replace(/\D/g, '');
        if (btnWa) {
            if (cleanDigits.length >= 10) {
                const waPhone = cleanDigits.length === 10 ? ('91' + cleanDigits) : cleanDigits;
                btnWa.href = `https://wa.me/${waPhone}?text=Hello%20${encodeURIComponent(thread.userName || '')},%20we%20received%20your%20inquiry%20regarding%20${encodeURIComponent(thread.storeName)}.`;
                btnWa.style.display = 'inline-flex';
            } else {
                btnWa.style.display = 'none';
            }
        }

        // Call action
        if (btnCall) {
            if (cleanDigits.length >= 10) {
                btnCall.href = `tel:${cleanDigits}`;
                btnCall.style.display = 'inline-flex';
            } else {
                btnCall.style.display = 'none';
            }
        }

        // Message bubbles
        if (msgList) {
            msgList.innerHTML = (thread.messages || []).map(m => {
                let prodHtml = '';
                if (m.product && m.product.name) {
                    prodHtml = `
                        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:10px; padding:0.6rem 0.75rem; margin-bottom:0.5rem; display:flex; align-items:center; gap:0.65rem; box-shadow:0 2px 6px rgba(0,0,0,0.03);">
                            <div style="width:34px; height:34px; border-radius:8px; background:#eff6ff; color:#2563eb; display:flex; align-items:center; justify-content:center; font-size:0.95rem; flex-shrink:0;">
                                <i class="fa-solid fa-tag"></i>
                            </div>
                            <div style="flex:1; min-width:0;">
                                <div style="font-size:0.72rem; font-weight:800; color:#2563eb; text-transform:uppercase; letter-spacing:0.3px;">Product Inquiry</div>
                                <div style="font-size:0.84rem; font-weight:800; color:#1e293b; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${m.product.name}</div>
                                ${m.product.price ? `<div style="font-size:0.76rem; font-weight:700; color:#059669;">${m.product.price}</div>` : ''}
                            </div>
                        </div>
                    `;
                }
                return `
                    <div class="m-chat-bubble-row ${m.sender === 'store' ? 'outgoing' : 'incoming'}">
                        <div class="m-chat-bubble">
                            ${prodHtml}
                            <div style="line-height:1.45;">${m.text}</div>
                            <span class="m-bubble-time">${m.time || ''}</span>
                        </div>
                    </div>
                `;
            }).join('');
            msgList.scrollTop = msgList.scrollHeight;
        }
    };

    window.handleUnifiedInboxReply = async function(e) {
        if (e && e.preventDefault) e.preventDefault();
        const input = document.getElementById('unifiedInboxReplyInput');
        const replyText = input?.value.trim();
        if (!replyText || !activeUnifiedThreadId || !activeUnifiedStoreId) return;

        const storeId = activeUnifiedStoreId;
        const threadId = activeUnifiedThreadId;

        const threads = getStoreInboxMessages(storeId);
        const thread = threads.find(t => t.id === threadId);
        if (!thread) return;

        const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const nowTs = Date.now();

        // 1. Add reply to local thread
        const replyMsg = {
            sender: 'store',
            text: replyText,
            time: timeNow,
            timestamp: nowTs
        };
        thread.messages.push(replyMsg);
        thread.lastTime = timeNow;

        saveStoreInboxMessages(storeId, threads);
        input.value = '';

        // 2. Also save to customer chat history on local storage for same-device/browser testing
        try {
            const hKey = `lb_chat_history_${storeId}`;
            const rawH = localStorage.getItem(hKey);
            let historyList = rawH ? JSON.parse(rawH) : [];
            historyList.push(replyMsg);
            localStorage.setItem(hKey, JSON.stringify(historyList));
        } catch (eH) {}

        const storeInfo = getMerchantOwnedStores().find(s => String(s.id) === String(storeId));
        window.renderUnifiedInboxThreads();
        window.renderUnifiedActiveChat({
            ...thread,
            storeId: storeId,
            storeName: storeInfo ? storeInfo.name : 'Store',
            storeCity: storeInfo ? storeInfo.city : 'Local Area'
        });

        // 3. Send reply to Cloud Firestore so the customer receives it on their phone!
        if (window.lbCloudSync && typeof window.lbCloudSync.saveInquiryMessage === 'function') {
            try {
                await window.lbCloudSync.saveInquiryMessage(storeId, {
                    sender: 'store',
                    text: replyText,
                    customerName: thread.userName,
                    customerPhone: thread.userPhone,
                    time: timeNow,
                    timestamp: nowTs
                });
            } catch (err) {
                console.warn('[Unified Inbox] Failed to send reply to Firestore:', err);
            }
        }
    };

    window.deleteUnifiedConversation = function() {
        if (!confirm('Are you sure you want to delete this customer conversation?')) return;
        if (!activeUnifiedThreadId || !activeUnifiedStoreId) return;

        let threads = getStoreInboxMessages(activeUnifiedStoreId);
        threads = threads.filter(t => t.id !== activeUnifiedThreadId);
        saveStoreInboxMessages(activeUnifiedStoreId, threads);

        activeUnifiedThreadId = null;
        activeUnifiedStoreId = null;

        const placeholder = document.getElementById('unifiedInboxEmptyPlaceholder');
        const panel = document.getElementById('unifiedInboxChatPanel');
        if (placeholder) placeholder.style.display = 'flex';
        if (panel) panel.style.display = 'none';

        window.renderUnifiedInboxThreads();
        showHubToast('Conversation deleted', 'info');
    };

    window.filterUnifiedInboxConversations = function(query) {
        const q = (query || '').toLowerCase().trim();
        const threadEls = document.querySelectorAll('#unifiedInboxThreadsList .m-inbox-thread-item');
        threadEls.forEach(el => {
            const text = el.textContent.toLowerCase();
            el.style.display = text.includes(q) ? 'flex' : 'none';
        });
    };

    document.getElementById('hubSignOutBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        window.handleHubSignOut();
    });
});

// Professional Strict Title Case: First letter capital, all subsequent letters small per word/tag
function formatToTitleCase(str) {
    if (!str) return '';
    return str.toLowerCase().replace(/(^|[^\p{L}\p{N}'])([\p{L}])/gu, (match, prefix, char) => prefix + char.toUpperCase());
}

// Global Auto Title-Case / First-letter capitalization on typing
document.addEventListener('input', (e) => {
    const el = e.target;
    if (!el || !(el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
    
    const type = (el.getAttribute('type') || '').toLowerCase();
    if (['password', 'email', 'url', 'number', 'file', 'checkbox', 'radio', 'hidden', 'date', 'time', 'color'].includes(type)) return;
    if (el.dataset.noCapitalize !== undefined) return;

    const val = el.value;
    if (!val) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;

    const transformed = formatToTitleCase(val);

    if (transformed !== val) {
        el.value = transformed;
        if (start !== null && end !== null) {
            el.setSelectionRange(start, end);
        }
    }
});
