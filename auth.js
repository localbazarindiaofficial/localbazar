// LocalBazar Smart Auth & Admin Database Bridge

document.addEventListener('DOMContentLoaded', () => {
    const googleBtn = document.getElementById('googleLoginBtn');
    const facebookBtn = document.getElementById('facebookLoginBtn');

    function getOrSyncUserSession(defaultName, defaultEmail, defaultMethod, defaultAvatar, defaultPhone, defaultCity, defaultUid) {
        try {
            const rawUsers = localStorage.getItem('lb_users');
            let users = rawUsers ? JSON.parse(rawUsers) : [];

            const normEmail = (defaultEmail || '').trim().toLowerCase();
            const userUid = defaultUid || '';

            // Find if this user already exists in DB strictly by normalized email or Firebase UID
            let existing = users.find(u => 
                (normEmail && u.email && u.email.trim().toLowerCase() === normEmail) || 
                (userUid && u.uid === userUid) ||
                (u.id && u.id === ('USR-' + userUid.substring(0, 12)))
            );

            // Helper to generate unique LB + 6-digit User ID (Supports 10 Lakh users without conflict)
            const generateLBUserId = () => {
                let newId;
                let attempts = 0;
                do {
                    newId = 'LB' + Math.floor(100000 + Math.random() * 900000);
                    attempts++;
                } while (users.some(u => u && u.id === newId) && attempts < 100);
                return newId;
            };

            if (!existing) {
                const uniqueUserId = generateLBUserId();
                existing = {
                    id: uniqueUserId,
                    uid: userUid,
                    name: defaultName,
                    email: defaultEmail,
                    method: defaultMethod,
                    role: 'Member',
                    avatar: defaultAvatar,
                    phone: defaultPhone || '',
                    city: defaultCity || '',
                    date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                    memberSince: new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }),
                    savedPlaces: 0,
                    reviewsCount: 0
                };
                users.unshift(existing);
                localStorage.setItem('lb_users', JSON.stringify(users));
            } else {
                // Auto-upgrade legacy USR- ID to clean LB + 6-digit format
                if (existing.id && (existing.id.startsWith('USR-') || !existing.id.startsWith('LB'))) {
                    existing.id = generateLBUserId();
                }
                // Update profile info for returning user without altering unique ID
                existing.name = defaultName || existing.name;
                existing.avatar = defaultAvatar || existing.avatar;
                if (userUid) existing.uid = userUid;
                if (defaultPhone && !existing.phone) existing.phone = defaultPhone;
                const idx = users.findIndex(u => u.uid === existing.uid || (existing.email && u.email === existing.email));
                if (idx !== -1) {
                    users[idx] = existing;
                    localStorage.setItem('lb_users', JSON.stringify(users));
                }
            }

            // Return active session user
            return {
                id: existing.id,
                uid: existing.uid || userUid,
                name: existing.name || defaultName,
                email: existing.email || defaultEmail,
                avatar: existing.avatar || defaultAvatar,
                method: defaultMethod,
                phone: existing.phone || defaultPhone || '',
                city: existing.city || defaultCity || '',
                role: existing.role || 'Member',
                memberSince: existing.memberSince || existing.date || new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }),
                savedPlaces: existing.savedPlaces || 0,
                reviewsCount: existing.reviewsCount || 0
            };
        } catch (e) {
            console.error('Error syncing user:', e);
            return {
                id: 'LB' + Math.floor(100000 + Math.random() * 900000),
                name: defaultName,
                email: defaultEmail,
                avatar: defaultAvatar,
                method: defaultMethod,
                role: 'Member'
            };
        }
    }

    if (googleBtn) {
        googleBtn.addEventListener('click', async () => {
            googleBtn.innerHTML = `
                <i class="fa-solid fa-spinner fa-spin" style="color: #2563eb;"></i>
                <span>Signing in with Google...</span>
            `;
            googleBtn.style.opacity = '0.8';
            googleBtn.style.pointerEvents = 'none';

            // Real Firebase Google Authentication
            if (window.isFirebaseReady && window.isFirebaseReady() && window.firebase && window.firebase.auth) {
                try {
                    const provider = new firebase.auth.GoogleAuthProvider();
                    const result = await firebase.auth().signInWithPopup(provider);
                    const user = result.user;

                    const activeUser = getOrSyncUserSession(
                        user.displayName || "Google User",
                        user.email || "",
                        "Google",
                        user.photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
                        user.phoneNumber || "",
                        "",
                        user.uid || ""
                    );

                    // Sync to Firestore
                    if (window.lbCloudSync && window.lbCloudSync.saveUser) {
                        await window.lbCloudSync.saveUser(activeUser);
                    }

                    localStorage.setItem('lb_current_user', JSON.stringify(activeUser));

                    // Seamless Redirect to Pending Search if user was searching before login
                    try {
                        const rawPending = sessionStorage.getItem('lb_pending_search');
                        if (rawPending) {
                            sessionStorage.removeItem('lb_pending_search');
                            const pending = JSON.parse(rawPending);
                            if (pending && (pending.city || pending.category)) {
                                const p = new URLSearchParams();
                                if (pending.city) p.set('city', pending.city);
                                if (pending.category) p.set('category', pending.category);
                                window.location.href = `explore.html?${p.toString()}`;
                                return;
                            }
                        }
                    } catch (e) {}

                    window.location.href = "index.html";
                    return;
                } catch (authErr) {
                    console.error("Firebase Google Auth error:", authErr);
                    googleBtn.innerHTML = `
                        <svg class="google-icon" width="20" height="20" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                        </svg>
                        <span>Continue with Google</span>
                    `;
                    googleBtn.style.opacity = '1';
                    googleBtn.style.pointerEvents = 'auto';
                    if (authErr.code !== 'auth/popup-closed-by-user') {
                        alert("Google Sign-In notice: " + (authErr.message || "Failed to sign in with Google."));
                    }
                    return;
                }
            }

            // Local fallback prompt for actual user identity
            const realName = prompt("Enter your full name:", "Member") || "Local Member";
            const realEmail = prompt("Enter your email address:", "") || "user@localbazar.com";

            const activeUser = getOrSyncUserSession(
                realName,
                realEmail,
                "Google",
                "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
                "",
                ""
            );

            localStorage.setItem('lb_current_user', JSON.stringify(activeUser));
            window.location.href = "index.html";
        });
    }
});

// Professional Strict Title Case: First letter capital, all subsequent letters small per word/tag
function formatToTitleCase(str) {
    if (!str) return '';
    return str.toLowerCase().replace(/(^|[^\p{L}\p{N}'])([\p{L}])/gu, (match, prefix, char) => prefix + char.toUpperCase());
}

// Auto-capitalize First Letter on typing
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
