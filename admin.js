// LocalBazar Enterprise Multi-Module Admin Panel Engine

const DB_KEYS = {
    USERS: 'lb_users',
    LISTINGS: 'lb_listings',
    CITIES: 'lb_cities',
    CATEGORIES: 'lb_categories',
    MAIL: 'lb_mail',
    NEWS: 'lb_news',
    ADMIN: 'lb_admin',
    CLAIMS: 'lb_listing_claims',
    CITY_REQUESTS: 'lb_city_requests',
    CAT_REQUESTS: 'lb_category_requests'
};

const DEFAULT_ADMIN_EMAIL = 'localbazar@adminmanaspan.com';
const DEFAULT_ADMIN_PWD = 'Localbazar@Manaspan@8798';

// Safe HTML sanitizer for Admin UI
function escapeAdminHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Consistent Deterministic LB User ID Formatter (LB + 6 digits)
function getCleanLBUserId(u) {
    if (!u) return 'LB100001';
    if (u.id && typeof u.id === 'string' && /^LB\d{6}$/i.test(u.id)) {
        return u.id.toUpperCase();
    }
    const seed = String(u.email || u.uid || u.id || 'lb_user');
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash |= 0;
    }
    return 'LB' + (100000 + Math.abs(hash % 900000));
}

// =========================================================
// SUPER ADMIN AUTHENTICATION GATEWAY CONTROLLER
// =========================================================
function checkAdminAuthSession() {
    const isLoggedIn = sessionStorage.getItem('lb_admin_logged_in') === 'true';
    const gate = document.getElementById('adminLoginGate');
    const wrapper = document.getElementById('adminMainWrapper');
    
    if (isLoggedIn) {
        if (gate) gate.classList.add('hidden');
        if (wrapper) wrapper.style.display = 'flex';
    } else {
        if (gate) gate.classList.remove('hidden');
        if (wrapper) wrapper.style.display = 'none';
        const emailInput = document.getElementById('adminGateEmail');
        if (emailInput && !emailInput.value) {
            emailInput.value = DEFAULT_ADMIN_EMAIL;
        }
    }
}

window.handleAdminGatewayLogin = function(e) {
    if (e) e.preventDefault();
    const emailInput = document.getElementById('adminGateEmail');
    const pwdInput = document.getElementById('adminGatePassword');
    const errBox = document.getElementById('adminLoginError');
    const errMsg = document.getElementById('adminLoginErrorMsg');
    const submitBtn = document.getElementById('btnAdminGateSubmit');

    const enteredEmail = (emailInput?.value || '').trim();
    const enteredPwd = pwdInput?.value || '';

    // Retrieve active admin credentials
    const adminProfile = getDB(DB_KEYS.ADMIN, { email: DEFAULT_ADMIN_EMAIL });
    const validEmail = adminProfile.email || DEFAULT_ADMIN_EMAIL;
    const validPwd = localStorage.getItem('lb_admin_pwd') || DEFAULT_ADMIN_PWD;

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Verifying...</span>`;
    }

    setTimeout(() => {
        if (enteredEmail.toLowerCase() === validEmail.toLowerCase() && enteredPwd === validPwd) {
            sessionStorage.setItem('lb_admin_logged_in', 'true');
            if (errBox) errBox.style.display = 'none';
            if (pwdInput) pwdInput.value = '';
            checkAdminAuthSession();
        } else {
            if (errBox) {
                errBox.style.display = 'flex';
                if (enteredEmail.toLowerCase() !== validEmail.toLowerCase()) {
                    if (errMsg) errMsg.textContent = 'Admin ID / Email does not exist.';
                } else {
                    if (errMsg) errMsg.textContent = 'Incorrect password! Please enter valid credentials.';
                }
            }
            if (pwdInput) {
                pwdInput.value = '';
                pwdInput.focus();
            }
        }
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<i class="fa-solid fa-lock-open"></i> <span>Authenticate & Access</span>`;
        }
    }, 350);
};

window.handleAdminLogout = function() {
    if (confirm('Are you sure you want to log out from the Admin Command Center?')) {
        sessionStorage.removeItem('lb_admin_logged_in');
        checkAdminAuthSession();
        const pwdInput = document.getElementById('adminGatePassword');
        if (pwdInput) pwdInput.value = '';
    }
};

window.toggleAdminGatePasswordVisibility = function() {
    const input = document.getElementById('adminGatePassword');
    const icon = document.getElementById('gatePwdEyeIcon');
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
        if (icon) {
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        }
    } else {
        input.type = 'password';
        if (icon) {
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    }
};

// Database Initializer (Real State starts empty or loads persisted localStorage)
function getDB(key, defaultVal = []) {
    try {
        const data = localStorage.getItem(key);
        let res = data ? JSON.parse(data) : defaultVal;
        if (Array.isArray(res)) {
            if (key === DB_KEYS.CITIES) {
                res.sort((a, b) => (a.name || a || '').localeCompare(b.name || b || '', undefined, { sensitivity: 'base' }));
            } else if (key === DB_KEYS.CATEGORIES) {
                res.sort((a, b) => (a.name || a || '').localeCompare(b.name || b || '', undefined, { sensitivity: 'base' }));
            }
        }
        return res;
    } catch {
        return defaultVal;
    }
}

function setDB(key, val) {
    if (Array.isArray(val)) {
        if (key === DB_KEYS.CITIES) {
            val.sort((a, b) => (a.name || a || '').localeCompare(b.name || b || '', undefined, { sensitivity: 'base' }));
        } else if (key === DB_KEYS.CATEGORIES) {
            val.sort((a, b) => (a.name || a || '').localeCompare(b.name || b || '', undefined, { sensitivity: 'base' }));
        }
    }
    try {
        localStorage.setItem(key, JSON.stringify(val));
    } catch (quotaErr) {
        console.warn('LocalStorage quota exceeded in setDB:', quotaErr);
        // If quota exceeded while saving news/ads, compress or prune old inactive records
        if (key === DB_KEYS.NEWS && Array.isArray(val) && val.length > 1) {
            // Keep active and latest items
            try {
                // If the latest item has a very large image, try emergency re-compression
                localStorage.setItem(key, JSON.stringify(val.slice(0, 15)));
            } catch (e2) {
                alert('Storage is full. Please remove some old unused images or banner ads.');
            }
        } else {
            alert('Browser storage quota exceeded. Please clear some old entries.');
        }
    }

    // Sync to Cloud Firestore if connected
    try {
        if (window.lbCloudSync) {
            if (key === DB_KEYS.LISTINGS && Array.isArray(val)) {
                val.forEach(item => window.lbCloudSync.saveListing(item));
            } else if (key === DB_KEYS.USERS && Array.isArray(val)) {
                val.forEach(u => window.lbCloudSync.saveUser(u));
            } else if (key === DB_KEYS.CITIES && Array.isArray(val)) {
                val.forEach(c => window.lbCloudSync.saveCity(c));
            } else if (key === DB_KEYS.CATEGORIES && Array.isArray(val)) {
                val.forEach(cat => window.lbCloudSync.saveCategory(cat));
            } else if (key === DB_KEYS.NEWS && Array.isArray(val)) {
                val.forEach(n => window.lbCloudSync.saveNewsItem(n));
            } else if (key === DB_KEYS.CLAIMS && Array.isArray(val)) {
                val.forEach(cl => window.lbCloudSync.saveClaim(cl));
            } else if (key === DB_KEYS.MAIL && Array.isArray(val)) {
                val.forEach(m => window.lbCloudSync.saveMail(m));
            } else if (key === DB_KEYS.CITY_REQUESTS && Array.isArray(val)) {
                val.forEach(r => window.lbCloudSync.saveCityRequest(r));
            } else if (key === DB_KEYS.CAT_REQUESTS && Array.isArray(val)) {
                val.forEach(r => window.lbCloudSync.saveCategoryRequest(r));
            }
        }
    } catch (e) {
        console.warn('Cloud sync in setDB skipped:', e);
    }
}

// FontAwesome Icon to Emoji Map for seamless compatibility
window.faToEmoji = function(str) {
    if (!str) return '🏷️';
    const s = String(str).toLowerCase().trim();
    if (s.includes('bowl-rice') || s.includes('rice') || s.includes('biryani')) return '🍚';
    if (s.includes('burger')) return '🍔';
    if (s.includes('pizza')) return '🍕';
    if (s.includes('utensils')) return '🍛';
    if (s.includes('mug-hot') || s.includes('coffee') || s.includes('tea')) return '☕';
    if (s.includes('ice-cream')) return '🍨';
    if (s.includes('cake') || s.includes('candle')) return '🍰';
    if (s.includes('person-dress') || s.includes('dress') || s.includes('saree')) return '👗';
    if (s.includes('shirt')) return '👕';
    if (s.includes('child')) return '🧒';
    if (s.includes('shoe')) return '👟';
    if (s.includes('mobile')) return '📱';
    if (s.includes('laptop')) return '💻';
    if (s.includes('headphones')) return '🎧';
    if (s.includes('tv')) return '📺';
    if (s.includes('carrot') || s.includes('apple')) return '🥦';
    if (s.includes('basket-shopping') || s.includes('bag') || s.includes('shopping')) return '🛒';
    if (s.includes('wand-magic-sparkles') || s.includes('spa')) return '✨';
    if (s.includes('heart-pulse') || s.includes('heart')) return '🩺';
    if (s.includes('gem')) return '💎';
    if (s.includes('clock')) return '⌚';
    if (s.includes('fire')) return '🔥';
    if (s.includes('star')) return '⭐';
    if (s.includes('tags') || s.includes('tag')) return '🏷️';
    if (s.includes('couch')) return '🛋️';
    if (s.includes('car')) return '🚗';
    if (s.includes('motorcycle')) return '🏍️';
    if (s.includes('screwdriver-wrench')) return '🔧';
    if (s.includes('book-open')) return '📚';
    return str;
};

// Universal Category Emoji / Icon Resolver
window.resolveStoreCategoryIcon = function(label = '') {
    const l = (label || '').toLowerCase().trim();
    // 1. Food, Meals & Dining
    if (l.includes('biryani') || l.includes('rice') || l.includes('pulao') || l.includes('fried rice')) return '🍚';
    if (l.includes('burger') || l.includes('fast food') || l.includes('roll') || l.includes('sandwich') || l.includes('chowmein') || l.includes('noodle')) return '🍔';
    if (l.includes('pizza')) return '🍕';
    if (l.includes('starter') || l.includes('main course') || l.includes('thali') || l.includes('meal') || l.includes('lunch') || l.includes('dinner') || l.includes('snack') || l.includes('chicken') || l.includes('mutton') || l.includes('fish') || l.includes('kebab') || l.includes('tandoor') || l.includes('curry') || l.includes('roti') || l.includes('paratha') || l.includes('food') || l.includes('combo')) return '🍛';
    if (l.includes('drink') || l.includes('beverage') || l.includes('tea') || l.includes('coffee') || l.includes('chai') || l.includes('juice') || l.includes('shake') || l.includes('mocktail') || l.includes('soda') || l.includes('water') || l.includes('lassi') || l.includes('cold drink')) return '🥤';
    if (l.includes('ice cream') || l.includes('kulfi')) return '🍨';
    if (l.includes('dessert') || l.includes('sweet') || l.includes('mishti') || l.includes('misti') || l.includes('cake') || l.includes('bakery') || l.includes('pastry') || l.includes('cookie') || l.includes('biscuit') || l.includes('halwa')) return '🍰';
    
    // 2. Fashion & Clothing
    if (l.includes('saree') || l.includes('sari') || l.includes('women') || l.includes('ladies') || l.includes('girl') || l.includes('kurti') || l.includes('lehenga') || l.includes('salwar') || l.includes('dress') || l.includes('suit') || l.includes('dupatta')) return '👗';
    if (l.includes('kid') || l.includes('baby') || l.includes('child') || l.includes('children') || l.includes('toy')) return '🧒';
    if (l.includes('shoe') || l.includes('footwear') || l.includes('sandal') || l.includes('sneaker') || l.includes('boot') || l.includes('chappal') || l.includes('heel') || l.includes('slipper')) return '👟';
    if (l.includes('shirt') || l.includes('pant') || l.includes('jeans') || l.includes('men') || l.includes('t-shirt') || l.includes('tshirt') || l.includes('trouser') || l.includes('jacket') || l.includes('coat') || l.includes('wear') || l.includes('fashion') || l.includes('ethnic') || l.includes('garment') || l.includes('cloth')) return '👕';
    
    // 3. Mobiles, Computers & Tech
    if (l.includes('mobile') || l.includes('phone') || l.includes('smartphone') || l.includes('tablet') || l.includes('ipad') || l.includes('iphone') || l.includes('android')) return '📱';
    if (l.includes('laptop') || l.includes('computer') || l.includes('pc') || l.includes('desktop') || l.includes('macbook') || l.includes('monitor') || l.includes('cpu')) return '💻';
    if (l.includes('headphone') || l.includes('earphone') || l.includes('audio') || l.includes('sound') || l.includes('speaker') || l.includes('bluetooth') || l.includes('airpod') || l.includes('earbud')) return '🎧';
    if (l.includes('electronic') || l.includes('tv') || l.includes('television') || l.includes('appliance') || l.includes('fridge') || l.includes('refrigerator') || l.includes('ac') || l.includes('cooler') || l.includes('camera') || l.includes('gadget') || l.includes('microwave') || l.includes('washing')) return '📺';
    
    // 4. Grocery & Fresh
    if (l.includes('vegetable') || l.includes('fruit') || l.includes('fresh') || l.includes('sabzi') || l.includes('apple') || l.includes('banana') || l.includes('potato') || l.includes('tomato') || l.includes('onion')) return '🥦';
    if (l.includes('grocery') || l.includes('ration') || l.includes('staple') || l.includes('oil') || l.includes('atta') || l.includes('flour') || l.includes('dal') || l.includes('spice') || l.includes('masala') || l.includes('sugar') || l.includes('salt') || l.includes('fmcg') || l.includes('supermarket') || l.includes('daily')) return '🛒';
    
    // 5. Beauty, Wellness & Salon
    if (l.includes('beauty') || l.includes('cosmetic') || l.includes('salon') || l.includes('parlour') || l.includes('parlor') || l.includes('makeup') || l.includes('skincare') || l.includes('hair') || l.includes('facial') || l.includes('bridal') || l.includes('spa') || l.includes('massage') || l.includes('nail') || l.includes('lipstick')) return '💄';
    
    // 6. Healthcare, Doctors & Medicines
    if (l.includes('doctor') || l.includes('health') || l.includes('medicine') || l.includes('pharma') || l.includes('clinic') || l.includes('dental') || l.includes('dentist') || l.includes('hospital') || l.includes('lab') || l.includes('test') || l.includes('diagnostic') || l.includes('pathology') || l.includes('eye') || l.includes('optical')) return '🩺';
    
    // 7. Jewelry, Watches & Luxury
    if (l.includes('jewel') || l.includes('gold') || l.includes('silver') || l.includes('diamond') || l.includes('ring') || l.includes('necklace') || l.includes('chain') || l.includes('earring') || l.includes('bangle')) return '💎';
    if (l.includes('watch') || l.includes('clock') || l.includes('time') || l.includes('ghadi') || l.includes('smartwatch')) return '⌚';
    
    // 8. Home, Auto, Services & Education
    if (l.includes('home') || l.includes('furniture') || l.includes('sofa') || l.includes('bed') || l.includes('decor') || l.includes('kitchen') || l.includes('curtain') || l.includes('mattress') || l.includes('chair') || l.includes('table')) return '🛋️';
    if (l.includes('car') || l.includes('auto') || l.includes('vehicle') || l.includes('wheel') || l.includes('garage') || l.includes('tyre')) return '🚗';
    if (l.includes('bike') || l.includes('motorcycle') || l.includes('scooter') || l.includes('two wheeler') || l.includes('cycle')) return '🏍️';
    if (l.includes('repair') || l.includes('service') || l.includes('mechanic') || l.includes('electrician') || l.includes('plumber') || l.includes('maintenance') || l.includes('tool')) return '🔧';
    if (l.includes('book') || l.includes('stationery') || l.includes('study') || l.includes('notebook') || l.includes('pen') || l.includes('pencil') || l.includes('paper') || l.includes('school') || l.includes('college')) return '📚';
    
    // 9. Deals, Trending & Featured
    if (l.includes('fire') || l.includes('popular') || l.includes('trending') || l.includes('hot') || l.includes('bestseller')) return '🔥';
    if (l.includes('deal') || l.includes('offer') || l.includes('discount') || l.includes('sale') || l.includes('save') || l.includes('special')) return '🏷️';
    if (l.includes('star') || l.includes('featured') || l.includes('highlight') || l.includes('vip') || l.includes('top')) return '⭐';
    
    return '🏷️';
};

// Universal Category Icon HTML Formatter (Renders Emoji or FontAwesome icon)
window.formatCatIconHtml = function(icon, fallbackLabel = '') {
    let ic = (icon || '').trim();
    if (!ic) {
        ic = window.resolveStoreCategoryIcon ? window.resolveStoreCategoryIcon(fallbackLabel) : '🏷️';
    }
    // Convert known FA class strings to vibrant emoji
    if (ic.includes('fa-') && window.faToEmoji) {
        ic = window.faToEmoji(ic);
    }
    // If still an FA class
    if (/fa-[a-z0-9-]+/i.test(ic)) {
        const cls = ic.includes(' ') ? ic : `fa-solid ${ic}`;
        return `<i class="${cls}"></i>`;
    }
    return `<span class="cat-emoji" style="font-family:'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif; font-style:normal; line-height:1;">${ic}</span>`;
};

// No default seed categories - strictly use categories created by Admin in Cloud Firestore
const SEED_CATEGORIES = [];

function initSeedCategories() {
    // Categories are managed strictly by Admin and Cloud Firestore
}
initSeedCategories();

/**
 * High-Quality Image Compressor (Client-Side HTML5 Canvas)
 * Automatically optimizes images to under 500 KB while retaining crystal-clear quality.
 * @param {File} file - The uploaded image file
 * @param {number} maxKB - Target maximum file size in KB (default 480KB)
 * @param {number} maxDimension - Max width or height in px (default 1920px for HD clarity)
 * @returns {Promise<string>} Base64 Data URL of compressed image
 */
window.compressImage = function(file, maxKB = 260, maxDimension = 1280) {
    if (window.uploadImageToCloud) {
        return window.uploadImageToCloud(file, maxKB, maxDimension);
    }
    return new Promise((resolve, reject) => {
        if (!file || !file.type.startsWith('image/')) {
            return reject(new Error('Invalid image file'));
        }

        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = function(e) {
            const img = new Image();
            img.onerror = reject;
            img.onload = function() {
                let { width, height } = img;

                // Scale down if oversized while preserving exact aspect ratio
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

                const ctx = canvas.getContext('2d', { alpha: false });
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

                // If still slightly over maxKB, scale canvas down slightly
                if (currentKB > maxKB) {
                    const shrinkFactor = 0.8;
                    const secondCanvas = document.createElement('canvas');
                    secondCanvas.width = Math.round(width * shrinkFactor);
                    secondCanvas.height = Math.round(height * shrinkFactor);
                    const secondCtx = secondCanvas.getContext('2d');
                    secondCtx.imageSmoothingEnabled = true;
                    secondCtx.imageSmoothingQuality = 'high';
                    secondCtx.fillStyle = '#FFFFFF';
                    secondCtx.fillRect(0, 0, secondCanvas.width, secondCanvas.height);
                    secondCtx.drawImage(canvas, 0, 0, secondCanvas.width, secondCanvas.height);
                    dataUrl = secondCanvas.toDataURL('image/jpeg', 0.85);
                }

                resolve(dataUrl);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
};

// Global View Switcher
window.switchView = function(viewId, updateHash = true) {
    if (!viewId) return;
    const targetPanel = document.getElementById(viewId);
    if (!targetPanel) return;

    document.querySelectorAll('.admin-view-panel').forEach(panel => {
        panel.classList.remove('active');
        panel.style.display = 'none';
    });
    document.querySelectorAll('.sidebar-menu .menu-item').forEach(item => item.classList.remove('active'));

    targetPanel.classList.add('active');
    targetPanel.style.display = 'block';

    const activeMenuItem = document.querySelector(`.sidebar-menu .menu-item[data-view="${viewId}"]`);
    if (activeMenuItem) activeMenuItem.classList.add('active');

    // Persist current active view in sessionStorage and URL hash so browser refresh stays on this page
    try {
        sessionStorage.setItem('admin_active_view', viewId);
        if (updateHash && window.location.hash !== '#' + viewId) {
            history.replaceState(null, '', '#' + viewId);
        }
    } catch (e) {}

    // On Users view, remove topbar search bar so page begins directly with "All Registered Users" header & filters
    const topbarSearch = document.querySelector('.topbar-search');
    if (topbarSearch) {
        topbarSearch.style.display = (viewId === 'usersView') ? 'none' : 'flex';
    }

    if (viewId === 'dashboardView') {
        if (typeof renderStats === 'function') renderStats();
        if (typeof renderRecentListings === 'function') renderRecentListings();
    } else if (viewId === 'usersView') {
        if (typeof renderAllUsers === 'function') renderAllUsers();
    } else if (viewId === 'listingsView') {
        if (typeof renderAllListings === 'function') renderAllListings();
    } else if (viewId === 'citiesView') {
        if (typeof renderAllCities === 'function') renderAllCities();
    } else if (viewId === 'categoriesView') {
        if (typeof renderAllCategories === 'function') renderAllCategories();
    } else if (viewId === 'mailboxView') {
        if (typeof renderMailbox === 'function') renderMailbox('inbox');
    } else if (viewId === 'newsView') {
        if (typeof renderNews === 'function') renderNews();
    } else if (viewId === 'createListingView') {
        if (typeof window.navigateAdminListingStep === 'function') {
            window.navigateAdminListingStep(1);
        }
        if (typeof window.renderAdminDailyScheduleMatrix === 'function') {
            window.renderAdminDailyScheduleMatrix();
        }
    } else if (viewId === 'claimsView') {
        if (typeof window.renderListingClaims === 'function') {
            window.renderListingClaims();
        }
    } else if (viewId === 'trustBadgeView') {
        if (typeof window.renderAdminTrustedListings === 'function') {
            window.renderAdminTrustedListings();
        }
        if (typeof window.renderAdminTrustBadgeRequests === 'function') {
            window.renderAdminTrustBadgeRequests();
        }
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
};

document.addEventListener('DOMContentLoaded', () => {
    // 0. Verify Super Admin Authentication Session
    checkAdminAuthSession();

    // Current date
    const dateEl = document.getElementById('currentDateDisplay');
    if (dateEl) {
        dateEl.textContent = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    // Sidebar Auto-Hide / Toggle logic
    const sidebar = document.getElementById('adminSidebar');
    const desktopSidebarToggle = document.getElementById('desktopSidebarToggle');
    const closeSidebarMobile = document.getElementById('closeSidebarMobile');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const adminMain = document.querySelector('.admin-main');

    function openMobileSidebar() {
        if (sidebar) {
            sidebar.classList.remove('collapsed');
            sidebar.classList.add('open');
        }
        if (sidebarOverlay) sidebarOverlay.classList.add('active');
        document.body.classList.add('admin-sidebar-open');
    }

    function closeMobileSidebar() {
        if (sidebar) sidebar.classList.remove('open');
        if (sidebarOverlay) sidebarOverlay.classList.remove('active');
        document.body.classList.remove('admin-sidebar-open');
    }

    function toggleDesktopSidebar() {
        if (sidebar) sidebar.classList.toggle('collapsed');
        if (adminMain) adminMain.classList.toggle('expanded');
    }

    window.toggleAdminSidebar = function(e) {
        if (e && e.stopPropagation) e.stopPropagation();
        if (window.innerWidth <= 992) {
            if (sidebar && sidebar.classList.contains('open')) {
                closeMobileSidebar();
            } else {
                openMobileSidebar();
            }
        } else {
            toggleDesktopSidebar();
        }
    };

    if (desktopSidebarToggle) {
        desktopSidebarToggle.addEventListener('click', window.toggleAdminSidebar);
    }

    if (closeSidebarMobile) {
        closeSidebarMobile.addEventListener('click', (e) => {
            e.stopPropagation();
            closeMobileSidebar();
        });
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', (e) => {
            e.stopPropagation();
            closeMobileSidebar();
        });
    }

    // Sidebar View Navigation (Always auto-hide on mobile when a menu item is tapped)
    document.querySelectorAll('.sidebar-menu .menu-item[data-view]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const viewId = item.getAttribute('data-view');
            switchView(viewId);

            // Always close mobile drawer upon selecting any navigation view
            closeMobileSidebar();
        });
    });

    // Auto-hide when clicking outside (mobile only)
    document.addEventListener('click', (e) => {
        if (sidebar && sidebar.contains(e.target)) return;
        const isToggle = desktopSidebarToggle && desktopSidebarToggle.contains(e.target);
        const isModal = e.target.closest('.modal-card') || e.target.closest('.modal-backdrop');

        if (!isToggle && !isModal && sidebar && sidebar.classList.contains('open')) {
            closeMobileSidebar();
        }
    });

    // Generic Modal Management
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', () => {
            const modalId = btn.getAttribute('data-close-modal');
            const modal = document.getElementById(modalId);
            if (modal) modal.classList.remove('active');
        });
    });

    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                backdrop.classList.remove('active');
            }
        });
    });

    window.openModal = function(id) {
        const modal = document.getElementById(id);
        if (id === 'addCategoryModal' && window.addStoreCatBuilder) {
            window.addStoreCatBuilder.clear();
        }
        if (modal) modal.classList.add('active');
    };
    function openModal(id) {
        window.openModal(id);
    }

    // Open Full Page for Add Listing (Instead of modal)
    document.getElementById('openAddModalBtn')?.addEventListener('click', () => {
        switchView('createListingView');
    });

    document.getElementById('openAddCityModalBtn')?.addEventListener('click', () => openModal('addCityModal'));
    document.getElementById('openAddCategoryModalBtn')?.addEventListener('click', () => openModal('addCategoryModal'));

    // ========================================================
    // DYNAMIC USER AUTO-SUGGEST ENGINE FOR COMPOSE MAIL
    // ========================================================
    function setupAdminUserSuggest(inputId, popoverId) {
        const input = document.getElementById(inputId);
        const popover = document.getElementById(popoverId);
        if (!input || !popover) return;

        let selectedIndex = -1;

        function renderSuggestions(query) {
            let rawUsers = getDB(DB_KEYS.USERS, []);

            // Also check lb_current_user if local test session has a user not yet in rawUsers
            try {
                const rawCur = localStorage.getItem('lb_current_user');
                if (rawCur) {
                    const cur = JSON.parse(rawCur);
                    if (cur && cur.email && !rawUsers.some(u => u && u.email && u.email.toLowerCase() === cur.email.toLowerCase())) {
                        rawUsers.unshift(cur);
                    }
                }
            } catch(e) {}

            // Clean users (filter mocks and ensure consistent LB IDs)
            rawUsers = rawUsers.filter(u => u && u.name !== 'Sourav Das' && u.name !== 'Anirban Mukherjee' && u.name !== 'Priya Sharma' && u.name !== 'Rahul Sen' && u.name !== 'Sunita Roy' && (!u.email || (!u.email.includes('@example.com') && !u.email.includes('sourav.das'))));

            let usersMigrated = false;
            rawUsers.forEach(u => {
                if (u && (!u.id || !String(u.id).startsWith('LB'))) {
                    u.id = getCleanLBUserId(u);
                    usersMigrated = true;
                }
            });
            if (usersMigrated) {
                setDB(DB_KEYS.USERS, rawUsers);
            }

            const qRaw = (query || '').trim();
            if (!qRaw) {
                popover.style.display = 'none';
                popover.innerHTML = '';
                return;
            }

            // Normalize search query
            const qClean = qRaw.toLowerCase().replace(/^[#\s-]+/, ''); // remove leading #, space, dash
            const numOnly = qClean.replace(/^lb/i, '').replace(/\D+/g, ''); // get numbers e.g. "4" from "lb4"
            const isJustLB = qClean === 'lb' || qClean === 'l';

            let matches = [];

            if (isJustLB) {
                // When typing "LB" or "L", immediately suggest all registered users!
                matches = [...rawUsers];
            } else {
                matches = rawUsers.filter(u => {
                    if (!u) return false;
                    const id = String(u.id || '').toLowerCase();
                    const idNum = id.replace(/^lb/i, '');
                    const name = (u.name || '').toLowerCase();
                    const email = (u.email || '').toLowerCase();
                    const phone = (u.phone || '').toLowerCase();

                    // 1. Direct match on ID (e.g. "lb482915" includes "lb4")
                    if (id.includes(qClean)) return true;
                    // 2. Numeric match (e.g. user typed "LB4" or "4", idNum includes "4")
                    if (numOnly && idNum.includes(numOnly)) return true;
                    // 3. Name, email, phone match
                    if (name.includes(qClean) || email.includes(qClean) || phone.includes(qClean)) return true;

                    return false;
                });
            }

            // Priority sorting:
            matches.sort((a, b) => {
                const aId = String(a.id || '').toLowerCase();
                const bId = String(b.id || '').toLowerCase();
                const aNum = aId.replace(/^lb/i, '');
                const bNum = bId.replace(/^lb/i, '');

                // Matches where ID starts with query come first
                const aStarts = aId.startsWith(qClean);
                const bStarts = bId.startsWith(qClean);
                if (aStarts && !bStarts) return -1;
                if (!aStarts && bStarts) return 1;

                // If typing numbers, matches where ID number starts with typed number come first
                if (numOnly) {
                    const aNumStarts = aNum.startsWith(numOnly);
                    const bNumStarts = bNum.startsWith(numOnly);
                    if (aNumStarts && !bNumStarts) return -1;
                    if (!aNumStarts && bNumStarts) return 1;
                }

                // Next, name starts with query
                const aName = (a.name || '').toLowerCase();
                const bName = (b.name || '').toLowerCase();
                const aNameStarts = aName.startsWith(qClean);
                const bNameStarts = bName.startsWith(qClean);
                if (aNameStarts && !bNameStarts) return -1;
                if (!aNameStarts && bNameStarts) return 1;

                return 0;
            });

            matches = matches.slice(0, 12);

            if (matches.length === 0) {
                popover.style.display = 'block';
                popover.innerHTML = `
                    <div style="padding:0.85rem 1rem; color:#64748b; font-size:0.82rem; font-style:italic;">
                        <i class="fa-solid fa-user-xmark" style="margin-right:6px; color:#ef4444;"></i> No registered user found matching "<strong>${escapeAdminHtml(qRaw)}</strong>".
                    </div>
                `;
                return;
            }

            selectedIndex = -1;
            popover.style.display = 'block';
            popover.innerHTML = matches.map((u, idx) => {
                const initial = u.name ? u.name.charAt(0).toUpperCase() : 'U';
                const avatar = u.avatar || u.picture;
                const avatarHtml = avatar 
                    ? `<div class="admin-user-sugg-avatar"><img src="${avatar}" alt="${escapeAdminHtml(u.name || '')}"></div>`
                    : `<div class="admin-user-sugg-avatar">${initial}</div>`;

                return `
                    <div class="admin-user-sugg-item" data-index="${idx}" data-id="${escapeAdminHtml(u.id || '')}" data-email="${escapeAdminHtml(u.email || '')}" data-name="${escapeAdminHtml(u.name || '')}">
                        ${avatarHtml}
                        <div class="admin-user-sugg-info" style="flex:1; min-width:0;">
                            <div class="admin-user-sugg-name" style="display:flex; align-items:center; gap:0.5rem; justify-content:space-between;">
                                <div style="display:flex; align-items:center; gap:0.45rem;">
                                    <span class="admin-user-sugg-id" style="background:#dbeafe; color:#1d4ed8; font-weight:800; font-family:monospace; font-size:0.85rem; padding:2px 8px; border-radius:6px; border:1px solid #bfdbfe;">#${escapeAdminHtml(u.id || '')}</span>
                                    <span style="font-weight:700; color:#0f172a; font-size:0.88rem;">${escapeAdminHtml(u.name || 'User')}</span>
                                </div>
                                <span style="font-size:0.7rem; font-weight:700; color:#16a34a; background:#dcfce7; padding:2px 6px; border-radius:4px; flex-shrink:0;">Verified</span>
                            </div>
                            <div class="admin-user-sugg-details" style="font-size:0.75rem; color:#64748b; display:flex; gap:0.65rem; margin-top:3px; flex-wrap:wrap;">
                                <span><i class="fa-regular fa-envelope" style="color:#2563eb;"></i> ${escapeAdminHtml(u.email || 'No email')}</span>
                                ${u.phone ? `<span><i class="fa-solid fa-phone" style="color:#16a34a;"></i> ${escapeAdminHtml(u.phone)}</span>` : ''}
                                ${u.city ? `<span><i class="fa-solid fa-location-dot" style="color:#f59e0b;"></i> ${escapeAdminHtml(u.city)}</span>` : ''}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            popover.querySelectorAll('.admin-user-sugg-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = item.getAttribute('data-id');
                    input.value = id || '';
                    popover.style.display = 'none';
                    popover.innerHTML = '';
                    document.getElementById('mailSubjectInput')?.focus();
                });
            });
        }

        input.addEventListener('input', () => {
            // Auto uppercase LB prefix if typed as lb, Lb, or lB
            let val = input.value;
            if (/^lb/i.test(val)) {
                const start = input.selectionStart;
                const end = input.selectionEnd;
                val = 'LB' + val.slice(2);
                input.value = val;
                if (start !== null && end !== null) {
                    input.setSelectionRange(start, end);
                }
            }
            renderSuggestions(input.value);
        });

        input.addEventListener('focus', () => {
            renderSuggestions(input.value || 'LB');
        });

        input.addEventListener('keydown', (e) => {
            const items = popover.querySelectorAll('.admin-user-sugg-item');
            if (popover.style.display !== 'block' || items.length === 0) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedIndex = (selectedIndex + 1) % items.length;
                updateSelection(items);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedIndex = (selectedIndex - 1 + items.length) % items.length;
                updateSelection(items);
            } else if (e.key === 'Enter') {
                if (selectedIndex >= 0 && items[selectedIndex]) {
                    e.preventDefault();
                    items[selectedIndex].click();
                }
            } else if (e.key === 'Escape') {
                popover.style.display = 'none';
            }
        });

        function updateSelection(items) {
            items.forEach((it, idx) => {
                if (idx === selectedIndex) {
                    it.classList.add('selected');
                    it.scrollIntoView({ block: 'nearest' });
                } else {
                    it.classList.remove('selected');
                }
            });
        }

        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !popover.contains(e.target)) {
                popover.style.display = 'none';
            }
        });
    }

    document.getElementById('openComposeMailModalBtn')?.addEventListener('click', () => {
        openModal('composeMailModal');
    });
    document.getElementById('btnOpenTextAdModal')?.addEventListener('click', () => openModal('createTextAdModal'));
    document.getElementById('btnOpenBannerAdModal')?.addEventListener('click', () => openModal('createBannerAdModal'));
    document.getElementById('btnOpenProductAdModal')?.addEventListener('click', () => openModal('createProductAdModal'));
    document.getElementById('btnOpenDefaultBannersModal')?.addEventListener('click', () => openDefaultListingBannersModal());

    // ================= DATA RENDERING ENGINE =================

    function refreshAll() {
        renderStats();
        renderRecentListings();
        renderAllListings();
        renderAllUsers();
        renderAllCities();
        renderAllCategories();
        renderMailbox('inbox');
        renderNews();
        renderAdminProfile();
        populateAdminListingOwnerDropdown();
        renderListingClaims();
    }
    window.refreshAll = refreshAll;

    // 1. STATS CALCULATOR
    function renderStats() {
        const users = getDB(DB_KEYS.USERS);
        const listings = getDB(DB_KEYS.LISTINGS);
        const cities = getDB(DB_KEYS.CITIES);
        const categories = getDB(DB_KEYS.CATEGORIES);
        const mail = getDB(DB_KEYS.MAIL);
        const claims = getDB(DB_KEYS.CLAIMS);

        const unreadCount = mail.filter(m => !m.read && m.type === 'inbox').length;
        const pendingCount = listings.filter(l => l.status === 'Pending').length;
        const pendingClaimsCount = claims.filter(c => c.status === 'Pending').length;

        // City & Category Requests Stats
        let cityRequests = [];
        try {
            const rawCR = localStorage.getItem('lb_city_requests');
            cityRequests = rawCR ? JSON.parse(rawCR) : [];
        } catch {}
        const pendingCityReqCount = cityRequests.filter(r => r.status === 'Pending' || !r.status).length;

        let catRequests = [];
        try {
            const rawCatR = localStorage.getItem('lb_category_requests');
            catRequests = rawCatR ? JSON.parse(rawCatR) : [];
        } catch {}
        const pendingCatReqCount = catRequests.filter(r => r.status === 'Pending' || !r.status).length;

        // Approved Trust Badge Stores count
        const approvedTrustCount = listings.filter(l => l.hasTrustBadge || l.status === 'Verified').length;

        // Dashboard Top 12 Cards in 3 Structured Rows
        // ROW 1
        if (document.getElementById('totalUsersCount')) document.getElementById('totalUsersCount').textContent = users.length.toLocaleString();
        if (document.getElementById('totalListingsCount')) document.getElementById('totalListingsCount').textContent = listings.length.toLocaleString();
        if (document.getElementById('pendingCount')) document.getElementById('pendingCount').textContent = pendingCount;
        if (document.getElementById('totalClaimsCount')) document.getElementById('totalClaimsCount').textContent = claims.length.toLocaleString();
        if (document.getElementById('claimsPendingSubtext')) {
            document.getElementById('claimsPendingSubtext').innerHTML = pendingClaimsCount > 0 
                ? `<span style="color:#dc2626; font-weight:700;"><i class="fa-solid fa-circle-exclamation"></i> ${pendingClaimsCount} pending claims</span>`
                : 'No pending claims';
        }

        // ROW 2
        if (document.getElementById('totalCitiesCount')) document.getElementById('totalCitiesCount').textContent = cities.length;
        if (document.getElementById('totalCityRequestsCount')) document.getElementById('totalCityRequestsCount').textContent = pendingCityReqCount;
        if (document.getElementById('cityRequestsSubtext')) {
            document.getElementById('cityRequestsSubtext').innerHTML = pendingCityReqCount > 0
                ? `<span style="color:#d97706; font-weight:700;"><i class="fa-solid fa-bell"></i> ${pendingCityReqCount} pending requests</span>`
                : '0 pending requests';
        }

        if (document.getElementById('totalCategoriesCount')) document.getElementById('totalCategoriesCount').textContent = categories.length;
        if (document.getElementById('totalCatRequestsCount')) document.getElementById('totalCatRequestsCount').textContent = pendingCatReqCount;
        if (document.getElementById('catRequestsSubtext')) {
            document.getElementById('catRequestsSubtext').innerHTML = pendingCatReqCount > 0
                ? `<span style="color:#0284c7; font-weight:700;"><i class="fa-solid fa-bell"></i> ${pendingCatReqCount} pending requests</span>`
                : '0 pending requests';
        }

        // Action button badges in Cities & Categories view
        const badgeCR = document.getElementById('badgeCityRequestsCount');
        if (badgeCR) {
            badgeCR.textContent = pendingCityReqCount;
            badgeCR.style.display = pendingCityReqCount > 0 ? 'inline-block' : 'none';
        }
        const badgeCatR = document.getElementById('badgeCatRequestsCount');
        if (badgeCatR) {
            badgeCatR.textContent = pendingCatReqCount;
            badgeCatR.style.display = pendingCatReqCount > 0 ? 'inline-block' : 'none';
        }

        // ROW 3
        if (document.getElementById('totalApprovedTrustBadgeCount')) document.getElementById('totalApprovedTrustBadgeCount').textContent = approvedTrustCount;
        
        // Trust Badge requests stats
        let trustReqs = [];
        try {
            const rawTrust = localStorage.getItem('lb_trust_requests');
            trustReqs = rawTrust ? JSON.parse(rawTrust) : [];
        } catch {}
        const pendingTrustCount = trustReqs.filter(r => r.status === 'Pending').length;

        if (document.getElementById('totalTrustBadgeCount')) {
            document.getElementById('totalTrustBadgeCount').textContent = pendingTrustCount;
        }
        if (document.getElementById('trustPendingSubtext')) {
            document.getElementById('trustPendingSubtext').innerHTML = pendingTrustCount > 0
                ? `<span style="color:#d97706; font-weight:700;"><i class="fa-solid fa-circle-exclamation"></i> ${pendingTrustCount} pending review</span>`
                : 'No pending review';
        }

        if (document.getElementById('totalMailCount')) document.getElementById('totalMailCount').textContent = mail.length;
        if (document.getElementById('unreadMailCount')) document.getElementById('unreadMailCount').textContent = unreadCount;

        // Sidebar Badges
        document.getElementById('sidebarUsersBadge').textContent = users.length;
        document.getElementById('sidebarListingsBadge').textContent = listings.length;
        document.getElementById('sidebarCitiesBadge').textContent = cities.length;
        document.getElementById('sidebarCategoriesBadge').textContent = categories.length;
        document.getElementById('sidebarMailBadge').textContent = unreadCount;
        if (document.getElementById('sidebarClaimsBadge')) {
            document.getElementById('sidebarClaimsBadge').textContent = pendingClaimsCount;
        }
        if (document.getElementById('sidebarTrustBadge')) {
            document.getElementById('sidebarTrustBadge').textContent = pendingTrustCount;
            document.getElementById('sidebarTrustBadge').style.display = pendingTrustCount > 0 ? 'inline-block' : 'none';
        }

        const pStatus = document.getElementById('pendingStatusText');
        if (pStatus) {
            pStatus.innerHTML = pendingCount > 0 
                ? '<span style="color:#d97706; font-weight:700;"><i class="fa-solid fa-circle-exclamation"></i> Action required</span>' 
                : 'No pending verification';
        }
    }

    // 2. DASHBOARD RECENT LISTINGS TABLE
    function renderRecentListings() {
        const tbody = document.getElementById('dashboardRecentTableBody');
        const listings = getDB(DB_KEYS.LISTINGS);
        if (!tbody) return;

        if (listings.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:2.5rem; color:#94a3b8;"><i class="fa-solid fa-folder-open" style="font-size:1.8rem; display:block; margin-bottom:0.4rem; color:#cbd5e1;"></i>No listings added yet. Click "+ Add New Listing" above.</td></tr>`;
            return;
        }

        // Sort: Draft listings to the top so Admin immediately sees new submissions
        const sorted = [...listings].sort((a, b) => {
            const aDraft = !(a.isPublic || a.status === 'Approved' || a.status === 'Verified' || a.status === 'Public');
            const bDraft = !(b.isPublic || b.status === 'Approved' || b.status === 'Verified' || b.status === 'Public');
            if (aDraft && !bDraft) return -1;
            if (!aDraft && bDraft) return 1;
            return 0;
        });

        tbody.innerHTML = sorted.slice(0, 6).map(item => `
            <tr>
                <td>
                    <div class="place-cell">
                        <div class="place-avatar blue"><i class="fa-solid fa-store"></i></div>
                        <div>
                            <div class="place-name">${item.name}</div>
                            <div class="place-sub">ID: #${item.id}</div>
                        </div>
                    </div>
                </td>
                <td><span class="category-chip">${item.category}</span></td>
                <td>${item.city}</td>
                <td>${item.phone}</td>
                <td><span class="status-badge ${(item.isPublic || item.status === 'Approved' || item.status === 'Verified' || item.status === 'Public') ? 'verified' : (item.status === 'Rejected' ? 'rejected' : 'draft')}" style="${(item.isPublic || item.status === 'Approved' || item.status === 'Verified' || item.status === 'Public') ? 'background:#dcfce7; color:#15803d;' : (item.status === 'Rejected' ? 'background:#fee2e2; color:#b91c1c;' : 'background:#fef3c7; color:#b45309;')} font-weight:700;">${(item.isPublic || item.status === 'Approved' || item.status === 'Verified' || item.status === 'Public') ? '<i class="fa-solid fa-check"></i> Public' : (item.status === 'Rejected' ? '<i class="fa-solid fa-xmark"></i> Rejected' : '<i class="fa-solid fa-file-pen"></i> Draft')}</span></td>
                <td class="text-right">
                    <div class="action-buttons">
                        ${!(item.isPublic || item.status === 'Approved' || item.status === 'Verified' || item.status === 'Public') ? `
                            <button type="button" class="btn-action approve" onclick="approveListing('${item.id}')" title="Approve & Publish Live" style="background:#dcfce7; color:#15803d; border:1px solid #86efac; font-weight:700;"><i class="fa-solid fa-check"></i></button>
                            <button type="button" class="btn-action delete" onclick="rejectListing('${item.id}')" title="Reject Request" style="background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5;"><i class="fa-solid fa-xmark"></i></button>
                        ` : ''}
                        <button type="button" class="btn-action delete" onclick="deleteListing('${item.id}')" title="Delete"><i class="fa-regular fa-trash-can"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    // 3. ALL USERS MODULE (Enterprise Search, Filters, Edit Profile & Actions)
    function renderAllUsers() {
        const tbody = document.getElementById('allUsersTableBody');
        if (!tbody) return;

        let users = getDB(DB_KEYS.USERS, []);
        // Purge any legacy dummy mock users automatically
        const cleanedUsers = users.filter(u => u && u.name !== 'Sourav Das' && u.name !== 'Anirban Mukherjee' && u.name !== 'Priya Sharma' && u.name !== 'Rahul Sen' && u.name !== 'Sunita Roy' && (!u.email || (!u.email.includes('@example.com') && !u.email.includes('sourav.das'))));

        // Auto de-duplicate users with the same email
        const seenEmails = new Map();
        const dedupedUsers = [];
        for (const u of cleanedUsers) {
            if (!u) continue;
            const emailKey = (u.email || '').trim().toLowerCase();
            if (emailKey && seenEmails.has(emailKey)) {
                // duplicate found! Purge redundant doc from Firestore if cloud sync available
                const prev = seenEmails.get(emailKey);
                if (window.lbCloudSync && typeof window.lbCloudSync.deleteUser === 'function' && u.id && u.id !== prev.id) {
                    window.lbCloudSync.deleteUser(u.id);
                }
                continue;
            }
            if (emailKey) seenEmails.set(emailKey, u);
            dedupedUsers.push(u);
        }

        // Auto-upgrade legacy USR- IDs to clean LB + 6-digit format (supports 10 Lakh+ users)
        let idMigrated = false;
        dedupedUsers.forEach(u => {
            if (u && (!u.id || u.id.startsWith('USR-') || !u.id.startsWith('LB'))) {
                const oldId = u.id;
                let newLBId;
                let attempts = 0;
                do {
                    newLBId = 'LB' + Math.floor(100000 + Math.random() * 900000);
                    attempts++;
                } while (dedupedUsers.some(other => other && other.id === newLBId) && attempts < 100);

                u.id = newLBId;
                idMigrated = true;

                // Sync with Firestore
                if (window.lbCloudSync && typeof window.lbCloudSync.saveUser === 'function') {
                    window.lbCloudSync.saveUser(u);
                    if (oldId) {
                        window.lbCloudSync.deleteUser(oldId);
                    }
                }

                // If current logged-in user in localStorage matches, update it
                try {
                    const rawCurr = localStorage.getItem('lb_current_user');
                    if (rawCurr) {
                        const curr = JSON.parse(rawCurr);
                        if (curr && (curr.id === oldId || (curr.email && u.email && curr.email.toLowerCase() === u.email.toLowerCase()))) {
                            curr.id = newLBId;
                            localStorage.setItem('lb_current_user', JSON.stringify(curr));
                        }
                    }
                } catch(e) {}

                // Also update any listings owned by oldId
                try {
                    const rawL = localStorage.getItem('lb_listings');
                    if (rawL) {
                        const listings = JSON.parse(rawL);
                        let lChanged = false;
                        listings.forEach(l => {
                            if (l && (l.ownerId === oldId || (u.email && l.ownerId && l.ownerId.toLowerCase() === u.email.toLowerCase()))) {
                                l.ownerId = newLBId;
                                lChanged = true;
                                if (window.lbCloudSync && typeof window.lbCloudSync.saveListing === 'function') {
                                    window.lbCloudSync.saveListing(l);
                                }
                            }
                        });
                        if (lChanged) localStorage.setItem('lb_listings', JSON.stringify(listings));
                    }
                } catch(e) {}
            }
        });

        if (idMigrated || dedupedUsers.length !== users.length) {
            users = dedupedUsers;
            setDB(DB_KEYS.USERS, users);
        }

        if (users.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:3rem 1rem; color:#94a3b8;"><i class="fa-solid fa-users-slash" style="font-size:2rem; display:block; margin-bottom:0.5rem; color:#cbd5e1;"></i>No registered users yet. New user sign-ups via Google will automatically appear here.</td></tr>`;
            const badge = document.getElementById('sidebarUsersBadge');
            if (badge) badge.textContent = '0';
            return;
        }

        const keyword = (document.getElementById('userFilterKeyword')?.value || '').toLowerCase().trim();
        const methodFilter = document.getElementById('userFilterMethod')?.value || '';
        const roleFilter = document.getElementById('userFilterRole')?.value || '';
        const sortOrder = document.getElementById('userSortOrder')?.value || 'newest';

        const clearBtn = document.getElementById('btnClearUserSearch');
        if (clearBtn) clearBtn.style.display = keyword ? 'inline-flex' : 'none';

        let filtered = users.filter(u => {
            const name = (u.name || '').toLowerCase();
            const email = (u.email || '').toLowerCase();
            const phone = (u.phone || '').toLowerCase();
            const id = String(u.id || '').toLowerCase();

            const matchesKey = !keyword || name.includes(keyword) || email.includes(keyword) || phone.includes(keyword) || id.includes(keyword);
            const matchesMethod = !methodFilter || (u.method && u.method.toLowerCase() === methodFilter.toLowerCase());
            const matchesRole = !roleFilter || (u.role && u.role.toLowerCase() === roleFilter.toLowerCase());

            return matchesKey && matchesMethod && matchesRole;
        });

        // Sorting
        if (sortOrder === 'oldest') {
            filtered = [...filtered].reverse();
        } else if (sortOrder === 'name_asc') {
            filtered = [...filtered].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        }

        // Counter Summary Badge
        const countBadge = document.getElementById('userCountSummaryBadge');
        if (countBadge) {
            countBadge.innerHTML = `<i class="fa-solid fa-users"></i> ${filtered.length} ${filtered.length === 1 ? 'User' : 'Users'}`;
        }

        // Sidebar Users Badge
        const sidebarBadge = document.getElementById('sidebarUsersBadge');
        if (sidebarBadge) sidebarBadge.textContent = users.length;

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:3rem; color:#94a3b8;"><i class="fa-solid fa-users-slash" style="font-size:2rem; display:block; margin-bottom:0.5rem; color:#cbd5e1;"></i>No registered users match your search criteria.</td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(u => {
            const method = u.method || 'Email';
            let methodIcon = 'envelope';
            let methodClass = 'email';
            let methodLabel = method;

            if (method.toLowerCase().includes('google')) {
                methodIcon = 'google';
                methodClass = 'google';
                methodLabel = 'Google';
            } else if (method.toLowerCase().includes('facebook')) {
                methodIcon = 'facebook-f';
                methodClass = 'facebook';
                methodLabel = 'Facebook';
            } else if (method.toLowerCase().includes('phone')) {
                methodIcon = 'mobile-screen-button';
                methodClass = 'phone';
                methodLabel = 'Phone OTP';
            }

            const role = u.role || 'Member';
            const roleClass = role.toLowerCase().includes('admin') ? 'admin' : (role.toLowerCase().includes('merchant') ? 'merchant' : 'member');
            const initial = u.name ? u.name.charAt(0).toUpperCase() : 'U';

            const avatarHtml = (u.avatar || u.picture)
                ? `<div class="user-avatar-tag has-img"><img src="${u.avatar || u.picture}" alt="${u.name}" class="user-avatar-img"></div>`
                : `<div class="user-avatar-tag">${initial}</div>`;

            return `
                <tr>
                    <td>
                        <div class="user-cell" style="cursor:pointer;" onclick="window.openViewUserDetailsModal('${u.id}')" title="Click to view full user profile">
                            ${avatarHtml}
                            <div class="user-info-col">
                                <div class="user-name-row">
                                    <span class="user-name" style="color:var(--primary); font-weight:700;">${u.name || 'Anonymous User'}</span>
                                    <span class="user-role-pill ${roleClass}">${role}</span>
                                </div>
                                <div class="user-sub-details">
                                    <span class="user-sub-item"><i class="fa-regular fa-envelope"></i> ${u.email || 'No email registered'}</span>
                                    ${u.phone ? `<span class="user-sub-item"><i class="fa-solid fa-phone"></i> ${u.phone}</span>` : ''}
                                    <span class="user-id-chip">#${u.id}</span>
                                </div>
                            </div>
                        </div>
                    </td>
                    <td>
                        <span class="method-badge ${methodClass}">
                            <i class="${methodClass === 'phone' ? 'fa-solid' : (methodClass === 'email' ? 'fa-regular' : 'fa-brands')} fa-${methodIcon}"></i> 
                            ${methodLabel}
                        </span>
                    </td>
                    <td>
                        <div class="joined-date-cell">
                            <i class="fa-regular fa-calendar-days"></i>
                            <span>${u.date || 'Oct 24, 2026'}</span>
                        </div>
                    </td>
                    <td class="text-right">
                        <div class="action-buttons">
                            <button type="button" class="btn-action view" onclick="window.openViewUserDetailsModal('${u.id}')" title="View Full Profile Details" style="background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe;"><i class="fa-regular fa-eye"></i></button>
                            <button type="button" class="btn-action message" onclick="window.openComposeMailForUser('${u.id}')" title="Send Direct Message" style="background:#f0fdf4; color:#16a34a; border:1px solid #bbf7d0;"><i class="fa-regular fa-envelope"></i></button>
                            <button type="button" class="btn-action delete" onclick="deleteUser('${u.id}')" title="Delete User"><i class="fa-regular fa-trash-can"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // User Table Filter Listeners
    document.getElementById('userFilterKeyword')?.addEventListener('input', renderAllUsers);
    document.getElementById('userFilterMethod')?.addEventListener('change', renderAllUsers);
    document.getElementById('userFilterRole')?.addEventListener('change', renderAllUsers);
    document.getElementById('userSortOrder')?.addEventListener('change', renderAllUsers);
    document.getElementById('btnClearUserSearch')?.addEventListener('click', () => {
        const inp = document.getElementById('userFilterKeyword');
        if (inp) {
            inp.value = '';
            renderAllUsers();
            inp.focus();
        }
    });

    // 4. ALL LISTINGS MODULE
    function renderAllListings() {
        const tbody = document.getElementById('allListingsTableBody');
        const listings = getDB(DB_KEYS.LISTINGS);
        const cityFilter = document.getElementById('listingFilterCity');
        const catFilter = document.getElementById('listingFilterCategory');
        if (!tbody) return;

        // Populate dynamic filters (preserving current selection if present)
        const cities = getDB(DB_KEYS.CITIES);
        const categories = getDB(DB_KEYS.CATEGORIES);

        if (cityFilter) {
            const currentCity = cityFilter.value;
            cityFilter.innerHTML = '<option value="">All Cities</option>' + cities.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
            if (currentCity) cityFilter.value = currentCity;
        }
        if (catFilter) {
            const currentCat = catFilter.value;
            catFilter.innerHTML = '<option value="">All Categories</option>' + categories.map(cat => `<option value="${cat.name}">${cat.name}</option>`).join('');
            if (currentCat) catFilter.value = currentCat;
        }

        if (listings.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:3rem; color:#94a3b8;"><i class="fa-solid fa-map-pin" style="font-size:2rem; display:block; margin-bottom:0.5rem; color:#cbd5e1;"></i>No listings found. Click "+ Add Place" to create one.</td></tr>`;
            return;
        }

        // Sort: Draft listings appear first so Admin immediately sees them!
        const sortedListings = [...listings].sort((a, b) => {
            const aDraft = !(a.isPublic || a.status === 'Approved' || a.status === 'Verified' || a.status === 'Public');
            const bDraft = !(b.isPublic || b.status === 'Approved' || b.status === 'Verified' || b.status === 'Public');
            if (aDraft && !bDraft) return -1;
            if (!aDraft && bDraft) return 1;
            return 0;
        });

        tbody.innerHTML = sortedListings.map(l => {
            const isPublic = l.isPublic === true || l.status === 'Approved' || l.status === 'Verified' || l.status === 'Public';
            const isRejected = l.status === 'Rejected';
            const statusBadge = isPublic 
                ? `<span class="status-badge verified" style="background:#dcfce7; color:#15803d; font-weight:700;"><i class="fa-solid fa-check"></i> Public</span>` 
                : (isRejected 
                    ? `<span class="status-badge" style="background:#fee2e2; color:#b91c1c; font-weight:700;"><i class="fa-solid fa-xmark"></i> Rejected</span>` 
                    : `<span class="status-badge draft" style="background:#fef3c7; color:#b45309; font-weight:700;"><i class="fa-solid fa-file-pen"></i> Draft</span>`);

            const hasTrust = !!(l.hasTrustBadge || l.status === 'Verified');
            const trustBadgeHtml = hasTrust ? `<span class="badge-gold-trust" style="font-size:0.62rem; padding:0.1rem 0.45rem; margin-left:0.35rem;"><i class="fa-solid fa-shield-halved"></i> Trust</span>` : '';

            return `
            <tr>
                <td>
                    <div class="place-cell">
                        <div class="place-avatar ${isPublic ? 'blue' : 'amber'}"><i class="fa-solid fa-store"></i></div>
                        <div>
                            <div class="place-name" style="display:flex; align-items:center; gap:0.3rem; flex-wrap:wrap;">
                                <span>${l.name}</span>
                                ${trustBadgeHtml}
                            </div>
                            <div class="place-sub">${l.address || 'Address on file'} (ID: #${l.id})</div>
                        </div>
                    </div>
                </td>
                <td><span class="category-chip">${l.category}</span></td>
                <td>${l.city}</td>
                <td><span class="user-role-pill merchant" style="font-size:0.75rem; white-space:nowrap;"><i class="fa-solid fa-user-check"></i> ${l.ownerName || 'Platform Managed'}</span></td>
                <td>${l.phone}</td>
                <td>${statusBadge}</td>
                <td class="text-right">
                    <div class="action-buttons">
                        <a href="listing-detail.html?id=${encodeURIComponent(l.id)}" target="_blank" class="btn-action view" title="View Public Page"><i class="fa-solid fa-arrow-up-right-from-square"></i></a>
                        <button type="button" class="btn-action" onclick="adminToggleListingTrustBadge('${l.id}')" title="${hasTrust ? 'Remove Trust Badge' : 'Grant Gold Trust Badge'}" style="background:${hasTrust ? '#fef3c7' : '#f8fafc'}; color:${hasTrust ? '#b45309' : '#64748b'}; border:1px solid ${hasTrust ? '#fde68a' : '#cbd5e1'};">
                            <i class="fa-solid fa-shield-halved"></i>
                        </button>
                        ${!isPublic ? `
                            <button type="button" class="btn-action approve" onclick="approveListing('${l.id}')" title="Approve & Publish Live" style="background:#dcfce7; color:#15803d; border:1px solid #86efac; font-weight:700;"><i class="fa-solid fa-check"></i></button>
                            <button type="button" class="btn-action delete" onclick="rejectListing('${l.id}')" title="Reject Request" style="background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5;"><i class="fa-solid fa-xmark"></i></button>
                        ` : ''}
                        <button type="button" class="btn-action delete" onclick="deleteListing('${l.id}')" title="Delete"><i class="fa-regular fa-trash-can"></i></button>
                    </div>
                </td>
            </tr>
            `;
        }).join('');
    }

    // Filter listeners
    document.getElementById('listingFilterKeyword')?.addEventListener('input', filterListingsTable);
    document.getElementById('listingFilterCity')?.addEventListener('change', filterListingsTable);
    document.getElementById('listingFilterCategory')?.addEventListener('change', filterListingsTable);
    document.getElementById('listingFilterStatus')?.addEventListener('change', filterListingsTable);

    function filterListingsTable() {
        const keyword = (document.getElementById('listingFilterKeyword')?.value || '').toLowerCase();
        const city = (document.getElementById('listingFilterCity')?.value || '').toLowerCase();
        const cat = (document.getElementById('listingFilterCategory')?.value || '').toLowerCase();
        const status = (document.getElementById('listingFilterStatus')?.value || '').toLowerCase();

        const rows = document.querySelectorAll('#allListingsTableBody tr');
        rows.forEach(r => {
            const text = r.textContent.toLowerCase();
            const matchesKey = !keyword || text.includes(keyword);
            const matchesCity = !city || text.includes(city);
            const matchesCat = !cat || text.includes(cat);
            const matchesStatus = !status || (status === 'draft' ? (text.includes('draft') || text.includes('pending')) : (status === 'public' || status === 'verified' ? (text.includes('public') || text.includes('verified')) : true));

            r.style.display = (matchesKey && matchesCity && matchesCat && matchesStatus) ? '' : 'none';
        });
    }

    window.switchToListingsPending = function() {
        switchView('listingsView');
        const statusFilter = document.getElementById('listingFilterStatus');
        if (statusFilter) {
            statusFilter.value = 'draft';
            filterListingsTable();
        }
    };

    // 5. ALL CITIES MODULE
    function populateCityFilterDropdowns() {
        const distFilterEl = document.getElementById('cityFilterDistrict');
        const stateFilterEl = document.getElementById('cityFilterState');
        const pinFilterEl = document.getElementById('cityFilterPin');
        const cities = getDB(DB_KEYS.CITIES);

        if (distFilterEl) {
            const curDist = distFilterEl.value;
            const uniqueDistricts = Array.from(new Set(cities.map(c => c.district).filter(Boolean))).sort();
            distFilterEl.innerHTML = '<option value="">All Districts</option>' + uniqueDistricts.map(d => 
                `<option value="${d}">${d}</option>`
            ).join('');
            if (curDist && uniqueDistricts.includes(curDist)) distFilterEl.value = curDist;
        }

        if (stateFilterEl) {
            const curState = stateFilterEl.value;
            const uniqueStates = Array.from(new Set(cities.map(c => c.state).filter(Boolean))).sort();
            stateFilterEl.innerHTML = '<option value="">All States</option>' + uniqueStates.map(s => 
                `<option value="${s}">${s}</option>`
            ).join('');
            if (curState && uniqueStates.includes(curState)) stateFilterEl.value = curState;
        }

        if (pinFilterEl) {
            const curPin = pinFilterEl.value;
            const uniquePins = Array.from(new Set(cities.map(c => c.pincode).filter(Boolean))).sort();
            pinFilterEl.innerHTML = '<option value="">All PIN Codes</option>' + uniquePins.map(p => 
                `<option value="${p}">${p}</option>`
            ).join('');
            if (curPin && uniquePins.includes(curPin)) pinFilterEl.value = curPin;
        }
    }

    function renderAllCities() {
        const container = document.getElementById('citiesGridContainer');
        const distFilterEl = document.getElementById('cityFilterDistrict');
        const stateFilterEl = document.getElementById('cityFilterState');
        const pinFilterEl = document.getElementById('cityFilterPin');
        const searchInputEl = document.getElementById('citySearchInput');
        const cities = getDB(DB_KEYS.CITIES);
        if (!container) return;

        populateCityFilterDropdowns();

        const query = (searchInputEl?.value || '').trim().toLowerCase();
        const selectedDist = (distFilterEl?.value || '').trim().toLowerCase();
        const selectedState = (stateFilterEl?.value || '').trim().toLowerCase();
        const selectedPin = (pinFilterEl?.value || '').trim().toLowerCase();

        const filtered = cities.filter(c => {
            const name = (c.name || '').toLowerCase();
            const dist = (c.district || '').toLowerCase();
            const state = (c.state || '').toLowerCase();
            const pin = (c.pincode || '').toString().toLowerCase();

            const matchesQuery = !query || name.includes(query) || dist.includes(query) || pin.includes(query) || state.includes(query);
            const matchesDist = !selectedDist || dist === selectedDist;
            const matchesState = !selectedState || state === selectedState;
            const matchesPin = !selectedPin || pin === selectedPin;

            return matchesQuery && matchesDist && matchesState && matchesPin;
        });

        filtered.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));

        if (cities.length === 0) {
            container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:3rem; color:#94a3b8; background:#fff; border-radius:14px; border:1px solid #e2e8f0;"><i class="fa-solid fa-city" style="font-size:2rem; display:block; margin-bottom:0.5rem; color:#cbd5e1;"></i>No city hubs configured yet. Click "+ Add New City" to register one.</div>`;
            return;
        }

        if (filtered.length === 0) {
            container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:2.5rem; color:#94a3b8; background:#fff; border-radius:14px; border:1px solid #e2e8f0;"><i class="fa-solid fa-magnifying-glass" style="font-size:1.8rem; display:block; margin-bottom:0.5rem; color:#cbd5e1;"></i>No matching cities found for your selected filters.</div>`;
            return;
        }

        container.innerHTML = filtered.map(c => `
            <div class="meta-box-card">
                <div class="meta-box-info" style="flex:1; padding-right:0.75rem;">
                    <h3><i class="fa-solid fa-location-dot" style="color:#ef4444; margin-right:0.35rem;"></i> ${c.name}</h3>
                    <p style="margin-top:0.25rem;">
                        ${c.district ? `District: <strong>${c.district}</strong> • ` : ''}
                        <span style="color:#2563eb; font-weight:600;">${c.state ? c.state : 'Active Hub'}</span>
                        ${c.pincode ? ` • PIN: <strong>${c.pincode}</strong>` : ''}
                    </p>
                </div>
                <div class="actions-cell" style="display:flex; gap:0.4rem;">
                    <button type="button" class="btn-action edit" onclick="openEditCityModal('${encodeURIComponent(c.name)}')" title="Edit City"><i class="fa-regular fa-pen-to-square"></i></button>
                    <button type="button" class="btn-action delete" onclick="deleteCity('${encodeURIComponent(c.name)}')" title="Remove City"><i class="fa-regular fa-trash-can"></i></button>
                </div>
            </div>
        `).join('');
    }

    // Done Button: Applies the search & selected filters when clicked
    document.getElementById('cityApplyFilterBtn')?.addEventListener('click', renderAllCities);

    // Enter key inside search box triggers Done
    document.getElementById('citySearchInput')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            renderAllCities();
        }
    });

    // Reset Button: Clears all inputs and restores full list
    document.getElementById('cityClearFilterBtn')?.addEventListener('click', () => {
        const sInput = document.getElementById('citySearchInput');
        const distFilter = document.getElementById('cityFilterDistrict');
        const stFilter = document.getElementById('cityFilterState');
        const pinFilter = document.getElementById('cityFilterPin');

        if (sInput) sInput.value = '';
        if (distFilter) distFilter.value = '';
        if (stFilter) stFilter.value = '';
        if (pinFilter) pinFilter.value = '';

        renderAllCities();
    });

    // 6. ALL CATEGORIES MODULE
    function populateCatTagFilterDropdown() {
        const tagFilterEl = document.getElementById('catFilterTag');
        const categories = getDB(DB_KEYS.CATEGORIES);
        if (!tagFilterEl) return;

        const curSelected = tagFilterEl.value;
        const allTags = new Set();
        categories.forEach(c => {
            const tags = Array.isArray(c.tags) ? c.tags : (c.tags ? c.tags.split(',') : []);
            tags.forEach(t => {
                const trimmed = t.trim();
                if (trimmed) allTags.add(trimmed);
            });
        });

        const sortedTags = Array.from(allTags).sort();
        tagFilterEl.innerHTML = '<option value="">All Tags / Keywords</option>' + sortedTags.map(t => 
            `<option value="${t}">${t}</option>`
        ).join('');
        if (curSelected && sortedTags.includes(curSelected)) tagFilterEl.value = curSelected;
    }

    function renderAllCategories() {
        const container = document.getElementById('categoriesGridContainer');
        const tagFilterEl = document.getElementById('catFilterTag');
        const searchInputEl = document.getElementById('catSearchInput');
        const categories = getDB(DB_KEYS.CATEGORIES);

        // Also dynamically populate listing form category select if select element
        const formCatSelect = document.getElementById('fullListingCategory');
        if (formCatSelect && formCatSelect.tagName === 'SELECT') {
            const currentVal = formCatSelect.value;
            formCatSelect.innerHTML = '<option value="">Select Category</option>' + categories.map(cat => 
                `<option value="${cat.name}">${cat.name}</option>`
            ).join('');
            if (currentVal && categories.some(cat => cat.name === currentVal)) {
                formCatSelect.value = currentVal;
            }
        }

        if (!container) return;

        populateCatTagFilterDropdown();

        const query = (searchInputEl?.value || '').trim().toLowerCase();
        const selectedTag = (tagFilterEl?.value || '').trim().toLowerCase();

        const filtered = categories.filter(c => {
            const name = (c.name || '').toLowerCase();
            const tags = Array.isArray(c.tags) ? c.tags : (c.tags ? c.tags.split(',') : []);
            const tagsLower = tags.map(t => t.trim().toLowerCase());
            const desc = (c.desc || '').toLowerCase();

            const matchesQuery = !query || name.includes(query) || tagsLower.some(t => t.includes(query)) || desc.includes(query);
            const matchesTag = !selectedTag || tagsLower.includes(selectedTag);

            return matchesQuery && matchesTag;
        });

        filtered.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));

        if (categories.length === 0) {
            container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:3rem; color:#94a3b8; background:#fff; border-radius:14px; border:1px solid #e2e8f0;"><i class="fa-solid fa-layer-group" style="font-size:2rem; display:block; margin-bottom:0.5rem; color:#cbd5e1;"></i>No categories configured yet. Click "+ Add Category" to start grouping places.</div>`;
            return;
        }

        if (filtered.length === 0) {
            container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:2.5rem; color:#94a3b8; background:#fff; border-radius:14px; border:1px solid #e2e8f0;"><i class="fa-solid fa-magnifying-glass" style="font-size:1.8rem; display:block; margin-bottom:0.5rem; color:#cbd5e1;"></i>No matching categories found for your search or tag filter.</div>`;
            return;
        }

        container.innerHTML = filtered.map(cat => {
            const rawTags = Array.isArray(cat.tags) ? cat.tags : (cat.tags ? cat.tags.split(',') : (cat.desc ? cat.desc.split(',') : []));
            const validTags = rawTags.map(t => t.trim()).filter(Boolean);
            const tagCount = validTags.length;

            const tagSummaryHtml = tagCount > 0 
                ? `<p style="margin-top:0.3rem; font-size:0.8rem; color:#64748b;"><i class="fa-solid fa-tags" style="color:#2563eb; font-size:0.75rem; margin-right:0.3rem;"></i>Total <strong>${tagCount}</strong> Search Tags Added</p>`
                : `<p style="margin-top:0.3rem; font-size:0.8rem; color:#94a3b8;"><i class="fa-regular fa-circle" style="font-size:0.7rem; margin-right:0.3rem;"></i>No extra tags added</p>`;

            const storeCats = Array.isArray(cat.storeCategories) ? cat.storeCategories : (Array.isArray(cat.subcategories) ? cat.subcategories : []);
            const storeCatCount = storeCats.length;
            const storeCatHtml = storeCatCount > 0
                ? `<p style="margin-top:0.25rem; font-size:0.8rem; color:#059669;"><i class="fa-solid fa-store" style="font-size:0.73rem; margin-right:0.3rem;"></i><strong>${storeCatCount}</strong> Sliding Categories: ${storeCats.slice(0, 4).map(s => {
                    const lbl = typeof s === 'string' ? s : (s.label || s.name || '');
                    const ic = typeof s === 'object' && s ? (s.icon || '') : '';
                    return `<span style="background:#d1fae5;color:#065f46;padding:1px 7px;border-radius:20px;font-size:0.73rem;margin-left:2px;">${ic ? ic + ' ' : ''}${lbl}</span>`;
                }).join('')}${storeCatCount > 4 ? ` <span style="color:#94a3b8;font-size:0.73rem;">+${storeCatCount - 4} more</span>` : ''}</p>`
                : `<p style="margin-top:0.25rem; font-size:0.8rem; color:#94a3b8;"><i class="fa-solid fa-store" style="font-size:0.73rem; margin-right:0.3rem;"></i>No sliding categories set</p>`;

            return `
            <div class="meta-box-card">
                <div class="meta-box-info" style="flex:1; padding-right:0.75rem;">
                    <h3><i class="fa-solid fa-layer-group" style="color:#2563eb; margin-right:0.35rem;"></i> ${cat.name}</h3>
                    ${tagSummaryHtml}
                    ${storeCatHtml}
                </div>
                <div class="actions-cell" style="display:flex; gap:0.4rem;">
                    <button type="button" class="btn-action edit" onclick="openEditCategoryModal('${encodeURIComponent(cat.name)}')" title="Edit Category"><i class="fa-regular fa-pen-to-square"></i></button>
                    <button type="button" class="btn-action delete" onclick="deleteCategory('${encodeURIComponent(cat.name)}')" title="Delete Category"><i class="fa-regular fa-trash-can"></i></button>
                </div>
            </div>
            `;
        }).join('');
    }

    // Category Filter Listeners (Done button & Reset)
    document.getElementById('catApplyFilterBtn')?.addEventListener('click', renderAllCategories);
    document.getElementById('catSearchInput')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            renderAllCategories();
        }
    });

    document.getElementById('catClearFilterBtn')?.addEventListener('click', () => {
        const sInput = document.getElementById('catSearchInput');
        const tFilter = document.getElementById('catFilterTag');
        if (sInput) sInput.value = '';
        if (tFilter) tFilter.value = '';
        renderAllCategories();
    });

    // 7. MAILBOX MODULE (Lister/User Help & Support Tickets directly to Admin)
    function renderMailbox(type = 'inbox') {
        const container = document.getElementById('mailListContainer');
        const rawMail = getDB(DB_KEYS.MAIL);
        if (!container) return;

        // Reset bulk selection bar whenever switching tabs or re-rendering
        if (typeof window.clearSelectedMails === 'function') {
            window.clearSelectedMails();
        }

        // Strictly show support tickets/mail between User & Admin; filter out any legacy store chat inquiries
        const mail = (rawMail || []).filter(m => {
            const subj = (m.subject || '').trim();
            return !subj.startsWith('[Chat Inquiry]');
        });

        const filtered = mail.filter(m => m.type === type);

        document.getElementById('inboxBadgeCount').textContent = mail.filter(m => m.type === 'inbox').length;
        document.getElementById('sentBadgeCount').textContent = mail.filter(m => m.type === 'sent').length;

        if (filtered.length === 0) {
            container.innerHTML = `<div style="text-align:center; padding:3.5rem; color:#94a3b8;"><i class="fa-regular fa-envelope-open" style="font-size:2rem; display:block; margin-bottom:0.5rem; color:#cbd5e1;"></i>No messages in this folder.</div>`;
            return;
        }

        const headerHtml = `
            <div class="mail-list-header-row" style="display:flex; align-items:center; justify-content:space-between; padding:0.65rem 1.15rem; background:#f8fafc; border-bottom:1px solid #e2e8f0; font-size:0.82rem; font-weight:700; color:#475569;">
                <label style="display:inline-flex; align-items:center; gap:0.6rem; cursor:pointer; margin:0; user-select:none;">
                    <input type="checkbox" id="masterMailCheckbox" onchange="window.toggleSelectAllMails(this)" style="width:16px; height:16px; cursor:pointer; accent-color:#2563eb;">
                    <span>Select All</span>
                </label>
                <span style="font-weight:600; font-size:0.78rem; color:#94a3b8;">${filtered.length} total messages</span>
            </div>
        `;

        const itemsHtml = filtered.map(m => {
            const attachBadge = m.attachment && m.attachment.data ? `
                <a href="${m.attachment.data}" download="${m.attachment.name || 'attachment'}" onclick="event.stopPropagation();" class="mail-item-attachment-badge" title="Click to download attachment (${m.attachment.size || ''})">
                    <i class="fa-solid fa-paperclip"></i>
                    <span>${escapeMailHtml(m.attachment.name || 'File')} (${m.attachment.size || 'KB'})</span>
                </a>
            ` : '';

            const senderOrRecip = m.from || m.to || 'User';

            return `
            <div class="mail-item ${!m.read && m.type === 'inbox' ? 'unread' : ''}" onclick="openAdminMailViewer('${m.id}')" style="cursor:pointer;" title="Click to view message & reply">
                <div style="display:flex; align-items:center; padding-right:0.65rem;" onclick="event.stopPropagation();">
                    <input type="checkbox" class="mail-item-checkbox" data-mail-id="${m.id}" onchange="window.handleMailCheckboxChange()" style="width:16px; height:16px; cursor:pointer; accent-color:#2563eb;">
                </div>
                <div class="mail-item-left">
                    <i class="fa-regular fa-envelope${m.read ? '-open' : ''}" style="color:${m.read ? '#94a3b8' : '#2563eb'}; font-size:1.05rem;"></i>
                    <div class="mail-item-sender" title="${escapeMailHtml(senderOrRecip)}">${escapeMailHtml(senderOrRecip)}</div>
                    <div class="mail-item-snippet"><strong>${escapeMailHtml(m.subject || 'No Subject')}</strong> — ${escapeMailHtml(m.body || '')}</div>
                    ${attachBadge}
                </div>
                <div style="display:flex; align-items:center; gap:0.75rem;" onclick="event.stopPropagation();">
                    <span style="font-size:0.78rem; color:#94a3b8; white-space:nowrap;">${m.date || ''}</span>
                    <button type="button" class="btn-action delete" onclick="deleteMail('${m.id}')" title="Delete"><i class="fa-regular fa-trash-can"></i></button>
                </div>
            </div>
            `;
        }).join('');

        container.innerHTML = headerHtml + itemsHtml;
    }

    // Helper for HTML escaping
    function escapeMailHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Professional Admin Mail Viewer & Quick Reply
    window.openAdminMailViewer = function(id) {
        const mail = getDB(DB_KEYS.MAIL);
        const item = mail.find(m => String(m.id) === String(id));
        if (!item) return;

        // Mark as read by Admin if unread
        if (!item.read || !item.adminRead) {
            item.read = true;
            item.adminRead = true;
            setDB(DB_KEYS.MAIL, mail);
            if (window.lbCloudSync && typeof window.lbCloudSync.saveMail === 'function') {
                window.lbCloudSync.saveMail(item);
            }
            const unreadCount = mail.filter(m => !m.read && m.type === 'inbox').length;
            if (document.getElementById('unreadMailCount')) document.getElementById('unreadMailCount').textContent = unreadCount;
            if (document.getElementById('sidebarMailBadge')) document.getElementById('sidebarMailBadge').textContent = unreadCount;
            const currentTab = document.querySelector('.mail-tab-btn.active')?.getAttribute('data-mail-tab') || 'inbox';
            renderMailbox(currentTab);
        }

        const subjEl = document.getElementById('viewMailSubject');
        if (subjEl) {
            subjEl.innerHTML = `<i class="fa-regular fa-envelope-open" style="color:#2563eb;"></i> <span>${escapeMailHtml(item.subject || 'No Subject')}</span>`;
        }

        const typeBadge = document.getElementById('viewMailTypeBadge');
        if (typeBadge) {
            if (item.type === 'sent') {
                typeBadge.textContent = 'Sent Message';
                typeBadge.style.background = '#e0f2fe';
                typeBadge.style.color = '#0369a1';
            } else {
                typeBadge.textContent = 'Inbox / Received';
                typeBadge.style.background = '#dcfce7';
                typeBadge.style.color = '#15803d';
            }
        }

        const dateEl = document.getElementById('viewMailDate');
        if (dateEl) dateEl.innerHTML = `<i class="fa-regular fa-clock"></i> ${item.date || ''}`;

        const senderEl = document.getElementById('viewMailSender');
        if (senderEl) {
            const senderText = item.from || (item.type === 'sent' ? 'Super Admin' : 'User');
            const senderEmail = item.userEmail || (item.from && item.from.includes('@') ? item.from : '');
            senderEl.textContent = (senderEmail && senderText !== senderEmail) ? `${senderText} (${senderEmail})` : senderText;
        }

        const recEl = document.getElementById('viewMailRecipient');
        if (recEl) {
            recEl.textContent = item.to || (item.type === 'inbox' ? 'Super Admin' : 'User');
        }

        const bodyEl = document.getElementById('viewMailBody');
        if (bodyEl) bodyEl.textContent = item.body || '';

        // Attachment handling
        const attachSec = document.getElementById('viewMailAttachSection');
        const attachContent = document.getElementById('viewMailAttachContent');
        if (attachSec && attachContent) {
            if (item.attachment && item.attachment.data) {
                attachSec.style.display = 'block';
                const isImg = item.attachment.data.startsWith('data:image') || /\.(jpg|jpeg|png|webp|gif)$/i.test(item.attachment.name || '');
                attachContent.innerHTML = `
                    <div style="background:#f1f5f9; border:1px solid #cbd5e1; border-radius:10px; padding:0.75rem 1rem; display:inline-flex; align-items:center; gap:0.85rem; max-width:100%; box-sizing:border-box;">
                        <i class="fa-solid ${isImg ? 'fa-file-image' : 'fa-file-lines'}" style="font-size:1.5rem; color:#2563eb;"></i>
                        <div style="display:flex; flex-direction:column; overflow:hidden;">
                            <strong style="font-size:0.86rem; color:#1e293b; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; max-width:260px;">${escapeMailHtml(item.attachment.name || 'attachment')}</strong>
                            <span style="font-size:0.75rem; color:#64748b;">${item.attachment.size || 'Attached file'}</span>
                        </div>
                        <a href="${item.attachment.data}" download="${item.attachment.name || 'attachment'}" style="margin-left:auto; background:#2563eb; color:#ffffff; padding:0.4rem 0.85rem; border-radius:6px; font-size:0.8rem; font-weight:700; text-decoration:none; display:inline-flex; align-items:center; gap:0.4rem;">
                            <i class="fa-solid fa-download"></i> Download
                        </a>
                    </div>
                    ${isImg ? `
                        <div style="margin-top:0.75rem; width:100%; text-align:center;">
                            <a href="${item.attachment.data}" target="_blank" title="Click to view full image">
                                <img src="${item.attachment.data}" alt="Attachment preview" style="max-height:180px; max-width:100%; border-radius:8px; border:1px solid #e2e8f0; object-fit:contain; box-shadow:0 2px 6px rgba(0,0,0,0.06);">
                            </a>
                        </div>
                    ` : ''}
                `;
            } else {
                attachSec.style.display = 'none';
                attachContent.innerHTML = '';
            }
        }

        // Delete button inside modal
        const delBtn = document.getElementById('viewMailDeleteBtn');
        if (delBtn) {
            delBtn.onclick = function() {
                if (confirm('Are you sure you want to delete this message?')) {
                    const modal = document.getElementById('viewMailModal');
                    if (modal) modal.classList.remove('active');
                    deleteMail(id);
                }
            };
        }

        // Reply button
        const replyBtn = document.getElementById('viewMailReplyBtn');
        if (replyBtn) {
            replyBtn.onclick = function() {
                const modal = document.getElementById('viewMailModal');
                if (modal) modal.classList.remove('active');
                openComposeWithReply(item);
            };
        }

        openModal('viewMailModal');
    };

    window.openComposeWithReply = function(item) {
        if (!item) return;
        let targetRecipient = item.from;
        if (item.type === 'sent') {
            targetRecipient = item.to;
        }
        if (item.userEmail) {
            targetRecipient = item.userEmail;
        }

        const mailToInput = document.getElementById('mailToInput');
        const mailSubjInput = document.getElementById('mailSubjectInput');
        const mailBodyInput = document.getElementById('mailBodyInput');

        if (mailToInput) mailToInput.value = targetRecipient || '';
        if (mailSubjInput) {
            const rawSubj = (item.subject || '').replace(/^Re:\s*/i, '');
            mailSubjInput.value = `Re: ${rawSubj}`;
        }
        if (mailBodyInput) {
            mailBodyInput.value = '';
            setTimeout(() => mailBodyInput.focus(), 250);
        }

        openModal('composeMailModal');
    };

    document.querySelectorAll('.mail-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.mail-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderMailbox(btn.getAttribute('data-mail-tab'));
        });
    });
    window.renderMailbox = renderMailbox;

    // 8. NEWS & ADS MODULE
    let currentNewsFilter = 'all';

    window.filterNewsByType = function(type) {
        currentNewsFilter = type;
        const tabIds = {
            'all': 'newsTabAll',
            'text': 'newsTabText',
            'banner': 'newsTabBanner',
            'product': 'newsTabProduct',
            'empty-banners': 'newsTabEmptyBanners'
        };

        Object.keys(tabIds).forEach(t => {
            const btn = document.getElementById(tabIds[t]);
            if (btn) {
                if (t === type) {
                    btn.classList.add('active');
                    btn.style.background = '#1e293b';
                    btn.style.color = '#ffffff';
                    btn.style.borderColor = '#1e293b';
                    const cnt = btn.querySelector('.pill-count');
                    if (cnt) {
                        cnt.style.background = 'rgba(255,255,255,0.2)';
                        cnt.style.color = '#ffffff';
                    }
                } else {
                    btn.classList.remove('active');
                    btn.style.background = '#ffffff';
                    btn.style.color = '#475569';
                    btn.style.borderColor = '#e2e8f0';
                    const cnt = btn.querySelector('.pill-count');
                    if (cnt) {
                        cnt.style.background = '#f1f5f9';
                        cnt.style.color = '#475569';
                    }
                }
            }
        });

        renderNews();
    };

    function renderNews() {
        const gridContainer = document.getElementById('newsGridContainer');
        const emptyBannersContainer = document.getElementById('newsEmptyBannersContainer');
        const news = getDB(DB_KEYS.NEWS);
        if (!gridContainer) return;

        // Categorize campaigns
        const textAds = news.filter(n => n.type !== 'banner' && n.type !== 'product' && n.mode !== 'image' && n.mode !== 'product');
        const bannerAds = news.filter(n => (n.type === 'banner' || n.mode === 'image') && n.type !== 'product' && n.mode !== 'product');
        const productAds = news.filter(n => n.type === 'product' || n.mode === 'product');

        let defBanners = [];
        try {
            const raw = localStorage.getItem('lb_default_banners');
            defBanners = raw ? JSON.parse(raw) : [];
        } catch { defBanners = []; }
        const activeDefCount = Array.isArray(defBanners) ? defBanners.filter(Boolean).length : 0;

        // Update count badges
        const countAll = document.getElementById('countAllAds');
        const countText = document.getElementById('countTextAds');
        const countBanner = document.getElementById('countBannerAds');
        const countProduct = document.getElementById('countProductAds');
        const countEmpty = document.getElementById('countEmptyBanners');

        if (countAll) countAll.textContent = news.length;
        if (countText) countText.textContent = textAds.length;
        if (countBanner) countBanner.textContent = bannerAds.length;
        if (countProduct) countProduct.textContent = productAds.length;
        if (countEmpty) countEmpty.textContent = `${activeDefCount}/4`;

        // Case A: Listing Empty Banners Tab Selected
        if (currentNewsFilter === 'empty-banners') {
            gridContainer.style.display = 'none';
            if (emptyBannersContainer) {
                emptyBannersContainer.style.display = 'block';

                let slotsHtml = '';
                for (let i = 0; i < 4; i++) {
                    const rawVal = defBanners[i];
                    const imgUrl = typeof rawVal === 'string' ? rawVal : (rawVal?.image || '');
                    const hasImg = Boolean(imgUrl);

                    slotsHtml += `
                        <div style="background:#ffffff; border:1px solid ${hasImg ? '#e2e8f0' : '#cbd5e1'}; border-radius:12px; padding:1rem; box-shadow:0 1px 3px rgba(0,0,0,0.05); display:flex; flex-direction:column; justify-content:space-between;">
                            <div>
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
                                    <strong style="font-size:0.92rem; color:#1e293b;"><i class="fa-solid fa-image" style="color:#d97706;"></i> Slide ${i + 1} (16:9)</strong>
                                    <span style="font-size:0.72rem; font-weight:700; padding:0.2rem 0.6rem; border-radius:20px; background:${hasImg ? '#ecfdf5' : '#f1f5f9'}; color:${hasImg ? '#059669' : '#64748b'};">
                                        ${hasImg ? '● Active' : '○ Empty'}
                                    </span>
                                </div>
                                <div style="aspect-ratio:16/9; border-radius:8px; overflow:hidden; background:#0f172a; display:flex; align-items:center; justify-content:center; border:1px solid #cbd5e1; margin-bottom:0.75rem;">
                                    ${hasImg ? `<img src="${imgUrl}" alt="Fallback Slide ${i + 1}" style="width:100%; height:100%; object-fit:cover;">` : `<div style="text-align:center; color:#94a3b8; font-size:0.8rem;"><i class="fa-solid fa-image" style="font-size:2rem; display:block; margin-bottom:0.35rem; color:#475569;"></i> Empty Slide Slot</div>`}
                                </div>
                            </div>
                            <div style="display:flex; gap:0.5rem; justify-content:flex-end;">
                                <button type="button" class="btn-action" onclick="openDefaultListingBannersModal()" style="font-size:0.8rem; padding:0.35rem 0.75rem; border-radius:6px; background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe; font-weight:700; cursor:pointer;">
                                    <i class="fa-solid fa-pen-to-square"></i> ${hasImg ? 'Change' : 'Upload'}
                                </button>
                                ${hasImg ? `<button type="button" class="btn-action delete" onclick="clearDefBannerAndSave(${i})" style="font-size:0.8rem; padding:0.35rem 0.75rem; border-radius:6px; background:#fef2f2; color:#dc2626; border:1px solid #fecaca; font-weight:700; cursor:pointer;"><i class="fa-regular fa-trash-can"></i> Remove</button>` : ''}
                            </div>
                        </div>
                    `;
                }

                emptyBannersContainer.innerHTML = `
                    <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:14px; padding:1.5rem; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; margin-bottom:1.25rem; border-bottom:1px solid #f1f5f9; padding-bottom:1rem;">
                            <div>
                                <h3 style="margin:0; font-size:1.15rem; color:#1e293b; display:flex; align-items:center; gap:0.5rem;">
                                    <i class="fa-solid fa-images" style="color:#d97706;"></i> Listing Empty Banners (Fallback 16:9 Slides)
                                </h3>
                                <p style="margin:0.25rem 0 0 0; font-size:0.84rem; color:#64748b;">
                                    These 4 default banners are displayed on store detail pages when listings have not added their own promotional banners.
                                </p>
                            </div>
                            <button type="button" class="btn-primary-action" onclick="openDefaultListingBannersModal()" style="background:#d97706; color:#ffffff; border:none; display:inline-flex; align-items:center; gap:0.5rem; padding:0.6rem 1.2rem; font-weight:700; border-radius:10px; cursor:pointer;">
                                <i class="fa-solid fa-pen-to-square"></i> Configure / Upload Slides
                            </button>
                        </div>
                        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap:1rem;">
                            ${slotsHtml}
                        </div>
                    </div>
                `;
            }
            return;
        }

        // Case B: Filtered Ads (All, Text, Banner, Product)
        if (emptyBannersContainer) emptyBannersContainer.style.display = 'none';
        gridContainer.style.display = 'grid';

        let filteredNews = news;
        if (currentNewsFilter === 'text') {
            filteredNews = textAds;
        } else if (currentNewsFilter === 'banner') {
            filteredNews = bannerAds;
        } else if (currentNewsFilter === 'product') {
            filteredNews = productAds;
        }

        if (filteredNews.length === 0) {
            let emptyTitle = 'No Promotional Ads or Notices Published Yet';
            let emptySub = 'Create your first campaign using the action buttons above.';
            let emptyBtnHtml = '';

            if (currentNewsFilter === 'text') {
                emptyTitle = 'No Text Ads Published Yet';
                emptySub = 'Publish text notices with running marquee ticker and color highlights.';
                emptyBtnHtml = `<button type="button" onclick="openModal('createTextAdModal')" style="margin-top:0.75rem; background:#2563eb; color:#fff; border:none; padding:0.55rem 1.15rem; border-radius:8px; font-weight:700; cursor:pointer;"><i class="fa-solid fa-font"></i> + Create Text Ad</button>`;
            } else if (currentNewsFilter === 'banner') {
                emptyTitle = 'No Graphical Banner Ads Published Yet';
                emptySub = 'Upload visual banners with 16:9, 1:1, 9:16 or 4:1 aspect ratios.';
                emptyBtnHtml = `<button type="button" onclick="openModal('createBannerAdModal')" style="margin-top:0.75rem; background:#7c3aed; color:#fff; border:none; padding:0.55rem 1.15rem; border-radius:8px; font-weight:700; cursor:pointer;"><i class="fa-solid fa-image"></i> + Create Banner Ad</button>`;
            } else if (currentNewsFilter === 'product') {
                emptyTitle = 'No Product Promotions Published Yet';
                emptySub = 'Feature specific business products with special price tags.';
                emptyBtnHtml = `<button type="button" onclick="openModal('createProductAdModal')" style="margin-top:0.75rem; background:#059669; color:#fff; border:none; padding:0.55rem 1.15rem; border-radius:8px; font-weight:700; cursor:pointer;"><i class="fa-solid fa-bag-shopping"></i> + Create Product Promotion</button>`;
            }

            gridContainer.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:3.5rem 1.5rem; color:#94a3b8; background:#fff; border-radius:14px; border:1px solid #e2e8f0;">
                <i class="fa-solid fa-rectangle-ad" style="font-size:2.4rem; display:block; margin-bottom:0.75rem; color:#cbd5e1;"></i>
                <h4 style="color:#475569; margin:0 0 0.4rem 0;">${emptyTitle}</h4>
                <p style="margin:0; font-size:0.88rem;">${emptySub}</p>
                ${emptyBtnHtml}
            </div>`;
            return;
        }

        gridContainer.innerHTML = filteredNews.map(n => {
            const isProduct = n.type === 'product' || n.mode === 'product';
            const isBanner = (n.type === 'banner' || n.mode === 'image') && !isProduct;
            const ratio = n.aspectRatio || '16:9';
            const isActive = n.active !== false;

            let targetBadgeHtml = '';
            if (n.targetCity && n.targetCity !== 'All Cities') {
                targetBadgeHtml = `<span class="news-target-badge" style="background:#fef3c7; color:#b45309;"><i class="fa-solid fa-location-dot"></i> City: ${n.targetCity}</span>`;
            } else if (n.targetPage === 'home') {
                targetBadgeHtml = `<span class="news-target-badge" style="background:#eff6ff; color:#2563eb;"><i class="fa-solid fa-house"></i> Home</span>`;
            } else {
                targetBadgeHtml = `<span class="news-target-badge" style="background:#f0fdf4; color:#16a34a;"><i class="fa-solid fa-globe"></i> All</span>`;
            }

            let typeBadge = '';
            if (isProduct) {
                typeBadge = `<span class="news-type-badge product-badge" style="background:#ecfdf5; color:#059669; font-weight:700;"><i class="fa-solid fa-bag-shopping"></i> Product (${n.badge || 'Deal'})</span>`;
            } else if (isBanner) {
                typeBadge = `<span class="news-type-badge banner-badge"><i class="fa-solid fa-image"></i> Banner Ad (${ratio})</span>`;
            } else {
                typeBadge = `<span class="news-type-badge text-badge"><i class="fa-solid fa-font"></i> Text Ad</span>`;
            }

            const catBadgeHtml = (n.targetCategory && n.targetCategory !== 'all' && n.targetCategory !== 'All Categories') 
                ? `<span class="news-target-badge" style="background:#f3e8ff; color:#7e22ce;"><i class="fa-solid fa-tags"></i> ${n.targetCategory}</span>` 
                : '';

            const colorBadgeHtml = (!isBanner && !isProduct && n.textColor) 
                ? `<span class="news-target-badge" style="background:#f1f5f9; color:${n.textColor}; font-weight:700;"><span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${n.textColor}; margin-right:4px;"></span>${n.textColor}</span>` 
                : '';

            let mediaHtml = '';
            if (isProduct && n.image) {
                mediaHtml = `
                    <div style="margin: 0.75rem 0; display:flex; gap:0.85rem; align-items:center; background:#f8fafc; padding:0.65rem; border-radius:10px; border:1px solid #e2e8f0;">
                        <img src="${n.image}" alt="${n.title}" style="width:72px; height:72px; object-fit:cover; border-radius:8px; border:1px solid #cbd5e1; flex-shrink:0;">
                        <div style="flex:1; overflow:hidden;">
                            <div style="font-weight:700; color:#1e293b; font-size:0.92rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${n.title || n.productName}</div>
                            <div style="font-weight:800; color:#059669; font-size:1.05rem; margin:0.15rem 0;">${n.price}</div>
                            <div style="font-size:0.75rem; color:#64748b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"><i class="fa-solid fa-store" style="color:#d97706;"></i> ${n.listingName || 'Store'}</div>
                        </div>
                    </div>
                `;
            } else if (isBanner && n.image) {
                let ratioClass = 'ratio-16-9';
                if (ratio === '1:1') ratioClass = 'ratio-1-1';
                else if (ratio === '9:16') ratioClass = 'ratio-9-16';
                else if (ratio === '4:1') ratioClass = 'ratio-4-1';

                mediaHtml = `
                    <div style="margin: 0.75rem 0; border-radius:10px; overflow:hidden; background:#0f172a; border:1px solid #e2e8f0; display:flex; justify-content:center;">
                        <div class="banner-frame ${ratioClass}" style="width:100%; max-height:160px;">
                            <img src="${n.image}" alt="Banner" style="width:100%; height:100%; object-fit:cover;">
                        </div>
                    </div>
                `;
            }

            return `
            <div class="news-card-item" style="opacity:${isActive ? '1' : '0.65'}; transition:opacity 0.2s;">
                <div class="news-card-header" style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                        ${typeBadge}
                        ${targetBadgeHtml}
                        ${catBadgeHtml}
                        ${colorBadgeHtml}
                    </div>
                    <div style="display:flex; align-items:center; gap:0.4rem;">
                        <button type="button" class="btn-action" onclick="toggleNewsActive('${n.id}')" title="${isActive ? 'Click to pause ad' : 'Click to activate ad'}" style="background:transparent; border:none; cursor:pointer; font-size:1.25rem; color:${isActive ? '#10b981' : '#94a3b8'};">
                            <i class="${isActive ? 'fa-solid fa-toggle-on' : 'fa-solid fa-toggle-off'}"></i>
                        </button>
                        <button type="button" class="btn-action delete" onclick="deleteNews('${n.id}')" title="Remove ad"><i class="fa-regular fa-trash-can"></i></button>
                    </div>
                </div>
                ${isBanner ? `<h3 style="margin:0.5rem 0 0.35rem 0;">${n.title || 'Promotional Banner Ad'}</h3>` : ''}
                ${mediaHtml}
                ${!isBanner && !isProduct && n.content ? `<p style="margin:0.6rem 0; font-size:0.92rem; font-weight:600; color:${n.textColor || '#1e293b'}; line-height:1.5;">${n.content}</p>` : ''}
                ${isBanner && n.content ? `<p style="margin-bottom:0.75rem; color:#475569; font-size:0.88rem;">${n.content}</p>` : ''}
                <div class="news-card-footer" style="flex-wrap:wrap; gap:0.5rem; font-size:0.75rem; color:#64748b; padding-top:0.75rem; border-top:1px solid #f1f5f9;">
                    <span><i class="fa-solid fa-location-dot"></i> ${n.city || 'All Cities'}</span>
                    <span><i class="fa-solid fa-tags"></i> ${n.targetCategory && n.targetCategory !== 'all' ? n.targetCategory : 'All Categories'}</span>
                    <span><i class="fa-solid fa-layer-group"></i> ${n.placement || 'Standard Placement'}</span>
                    <span><i class="fa-regular fa-clock"></i> ${n.date}</span>
                </div>
            </div>
            `;
        }).join('');
    }

    // 9. SETTINGS, PROFILE, THEME & PUSH NOTIFICATIONS
    // Initialize default password if not set
    if (!localStorage.getItem('lb_admin_pwd')) {
        localStorage.setItem('lb_admin_pwd', DEFAULT_ADMIN_PWD);
    }

    function renderAdminProfile() {
        const admin = getDB(DB_KEYS.ADMIN, { name: 'Master Admin', email: DEFAULT_ADMIN_EMAIL });
        const emailToDisplay = admin.email || DEFAULT_ADMIN_EMAIL;
        
        const sideName = document.getElementById('sidebarAdminName');
        const sideEmail = document.getElementById('sidebarAdminEmail');
        const inputName = document.getElementById('adminProfileName');
        const inputEmail = document.getElementById('adminProfileEmail');

        if (sideName) sideName.textContent = admin.name || 'Master Admin';
        if (sideEmail) sideEmail.textContent = emailToDisplay;
        if (inputName) inputName.value = admin.name || 'Master Admin';
        if (inputEmail) inputEmail.value = emailToDisplay;
    }

    document.getElementById('adminProfileForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('adminProfileName').value.trim();
        const email = document.getElementById('adminProfileEmail').value.trim() || DEFAULT_ADMIN_EMAIL;

        setDB(DB_KEYS.ADMIN, { name, email });
        renderAdminProfile();
        alert('Admin Identity Profile updated successfully!');
    });

    // Password Update with Old Password Verification
    document.getElementById('adminPasswordForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const currentInput = document.getElementById('adminCurrentPwd')?.value || '';
        const newPwd = document.getElementById('adminNewPwd')?.value || '';
        const storedPwd = localStorage.getItem('lb_admin_pwd') || DEFAULT_ADMIN_PWD;

        if (currentInput !== storedPwd) {
            alert('Current password does not match! Please enter your valid current password.');
            document.getElementById('adminCurrentPwd')?.focus();
            return;
        }

        if (newPwd.length < 8) {
            alert('New password must be at least 8 characters long.');
            document.getElementById('adminNewPwd')?.focus();
            return;
        }

        if (newPwd === storedPwd) {
            alert('New password cannot be identical to your current password. Please choose a new password.');
            document.getElementById('adminNewPwd')?.focus();
            return;
        }

        localStorage.setItem('lb_admin_pwd', newPwd);
        document.getElementById('adminCurrentPwd').value = '';
        document.getElementById('adminNewPwd').value = '';
        alert('Admin password has been changed successfully! Keep your new credentials safe.');
    });

    // ================= APPEARANCE & THEME CONTROLLER =================
    window.setAdminTheme = function(theme) {
        localStorage.setItem('lb_admin_theme', theme);
        applyAdminTheme(theme);
    };

    function applyAdminTheme(theme) {
        const isDark = theme === 'dark';
        if (isDark) {
            document.body.classList.add('dark-theme');
        } else {
            document.body.classList.remove('dark-theme');
        }

        const lightBtn = document.getElementById('btnThemeLight');
        const darkBtn = document.getElementById('btnThemeDark');
        if (lightBtn && darkBtn) {
            if (isDark) {
                darkBtn.style.borderColor = '#6366f1';
                darkBtn.style.background = '#1e1b4b';
                lightBtn.style.borderColor = 'var(--border)';
                lightBtn.style.background = 'var(--card-bg)';
            } else {
                lightBtn.style.borderColor = '#f59e0b';
                lightBtn.style.background = '#fef3c7';
                darkBtn.style.borderColor = 'var(--border)';
                darkBtn.style.background = 'var(--card-bg)';
            }
        }
    }

    // Apply saved or default theme
    applyAdminTheme(localStorage.getItem('lb_admin_theme') || 'light');

    // ================= REAL-TIME PUSH NOTIFICATIONS ENGINE =================
    function getNotificationPrefs() {
        try {
            const raw = localStorage.getItem('lb_admin_notif_prefs');
            return raw ? JSON.parse(raw) : { listings: true, claims: true, inquiries: true, users: true };
        } catch {
            return { listings: true, claims: true, inquiries: true, users: true };
        }
    }

    window.saveNotificationPrefs = function() {
        const prefs = {
            listings: document.getElementById('notifPrefListings')?.checked ?? true,
            claims: document.getElementById('notifPrefClaims')?.checked ?? true,
            inquiries: document.getElementById('notifPrefInquiries')?.checked ?? true,
            users: document.getElementById('notifPrefUsers')?.checked ?? true
        };
        localStorage.setItem('lb_admin_notif_prefs', JSON.stringify(prefs));
    };

    function loadNotificationPrefs() {
        const prefs = getNotificationPrefs();
        const chkListings = document.getElementById('notifPrefListings');
        const chkClaims = document.getElementById('notifPrefClaims');
        const chkInquiries = document.getElementById('notifPrefInquiries');
        const chkUsers = document.getElementById('notifPrefUsers');

        if (chkListings) chkListings.checked = Boolean(prefs.listings);
        if (chkClaims) chkClaims.checked = Boolean(prefs.claims);
        if (chkInquiries) chkInquiries.checked = Boolean(prefs.inquiries);
        if (chkUsers) chkUsers.checked = Boolean(prefs.users);
    }

    function updateNotifPermissionStatusDisplay() {
        const statusEl = document.getElementById('notifPermissionStatus');
        const btnEl = document.getElementById('btnEnableBrowserNotifs');
        if (!statusEl) return;

        if (!('Notification' in window)) {
            statusEl.textContent = 'Browser Push: Not supported on this browser';
            if (btnEl) btnEl.style.display = 'none';
            return;
        }

        if (Notification.permission === 'granted') {
            statusEl.innerHTML = `<span style="color:#059669; font-weight:700;"><i class="fa-solid fa-circle-check"></i> Enabled & Active</span>`;
            if (btnEl) {
                btnEl.textContent = 'Notifications Allowed';
                btnEl.style.background = '#059669';
                btnEl.disabled = true;
                btnEl.style.cursor = 'default';
            }
        } else if (Notification.permission === 'denied') {
            statusEl.innerHTML = `<span style="color:#ef4444; font-weight:700;"><i class="fa-solid fa-circle-xmark"></i> Blocked by Browser (Enable in Site Settings)</span>`;
            if (btnEl) {
                btnEl.textContent = 'Permission Blocked';
                btnEl.style.background = '#94a3b8';
            }
        } else {
            statusEl.textContent = 'Status: Not enabled yet';
            if (btnEl) {
                btnEl.textContent = 'Enable Push Notifications';
                btnEl.style.background = '#2563eb';
                btnEl.disabled = false;
                btnEl.style.cursor = 'pointer';
            }
        }
    }

    window.requestAdminPushPermission = function() {
        if (!('Notification' in window)) {
            alert('Push Notifications are not supported by your current browser.');
            return;
        }

        Notification.requestPermission().then(permission => {
            updateNotifPermissionStatusDisplay();
            if (permission === 'granted') {
                window.sendAdminPushNotification('LocalBazar Notifications Enabled!', 'You will now receive instant push alerts whenever users add listings, submit claims, or send inquiries.', 'system');
            } else if (permission === 'denied') {
                alert('Notifications permission was blocked. To allow, please enable notifications in your browser address bar settings.');
            }
        });
    };

    window.sendAdminPushNotification = function(title, body, type = 'general', actionUrl = '#') {
        const prefs = getNotificationPrefs();
        if (type === 'listing' && !prefs.listings) return;
        if (type === 'claim' && !prefs.claims) return;
        if (type === 'inquiry' && !prefs.inquiries) return;
        if (type === 'user' && !prefs.users) return;

        // 1. Native Desktop / Mobile Browser Push Notification
        if ('Notification' in window && Notification.permission === 'granted') {
            try {
                const notif = new Notification(title, {
                    body: body,
                    icon: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=120',
                    tag: 'lb_' + type + '_' + Date.now()
                });
                notif.onclick = function() {
                    window.focus();
                    if (actionUrl && actionUrl !== '#') window.location.hash = actionUrl;
                    notif.close();
                };
            } catch (err) {
                console.warn('Native notification error:', err);
            }
        }

        // 2. In-App Floating Toast Notification on Admin Panel
        showAdminPushToast(title, body, type);
    };

    function showAdminPushToast(title, body, type) {
        let container = document.getElementById('adminPushToastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'adminPushToastContainer';
            container.className = 'admin-push-toast-container';
            document.body.appendChild(container);
        }

        let iconClass = 'fa-solid fa-bell';
        let typeClass = '';
        if (type === 'claim') {
            iconClass = 'fa-solid fa-file-circle-check';
            typeClass = 'claim-toast';
        } else if (type === 'listing') {
            iconClass = 'fa-solid fa-store';
            typeClass = 'listing-toast';
        } else if (type === 'inquiry') {
            iconClass = 'fa-solid fa-comments';
            typeClass = 'inquiry-toast';
        } else if (type === 'user') {
            iconClass = 'fa-solid fa-user-plus';
            typeClass = 'user-toast';
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

        // Auto remove after 6 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(110%)';
                setTimeout(() => toast.remove(), 250);
            }
        }, 6000);
    }

    window.testAdminPushNotification = function() {
        if ('Notification' in window && Notification.permission !== 'granted') {
            window.requestAdminPushPermission();
            return;
        }
        window.sendAdminPushNotification(
            'Test Push Alert: LocalBazar Active',
            'Push notification pipeline is working flawlessly! Real-time alerts will trigger as users interact with the site.',
            'general'
        );
    };

    // Initialize notification status and settings
    loadNotificationPrefs();
    updateNotifPermissionStatusDisplay();

    // ================= REAL-TIME CROSS-TAB ACTIVITY WATCHER =================
    // Listens for actions performed on user storefront or account tabs
    window.addEventListener('storage', (e) => {
        if (!e.key) return;

        // 1. New Listing Added
        if (e.key === DB_KEYS.LISTINGS && e.newValue) {
            try {
                const oldList = e.oldValue ? JSON.parse(e.oldValue) : [];
                const newList = JSON.parse(e.newValue);
                if (newList.length > oldList.length) {
                    const latest = newList[0] || {};
                    window.sendAdminPushNotification(
                        'New Listing Registered!',
                        `"${latest.title || latest.name || 'New Business'}" (${latest.city || 'Local'}) has been registered on LocalBazar.`,
                        'listing',
                        '#listings'
                    );
                    refreshAll();
                }
            } catch (err) {}
        }

        // 2. New Ownership Claim Submitted
        if (e.key === 'lb_listing_claims' && e.newValue) {
            try {
                const oldClaims = e.oldValue ? JSON.parse(e.oldValue) : [];
                const newClaims = JSON.parse(e.newValue);
                if (newClaims.length > oldClaims.length) {
                    const latestClaim = newClaims[0] || {};
                    window.sendAdminPushNotification(
                        'New Ownership Claim Request!',
                        `${latestClaim.claimantName || 'A merchant'} requested to claim "${latestClaim.businessName || 'Business'}".`,
                        'claim',
                        '#claims'
                    );
                    refreshAll();
                }
            } catch (err) {}
        }

        // 3. New User Registration
        if (e.key === DB_KEYS.USERS && e.newValue) {
            try {
                const oldUsers = e.oldValue ? JSON.parse(e.oldValue) : [];
                const newUsers = JSON.parse(e.newValue);
                if (newUsers.length > oldUsers.length) {
                    const latestUser = newUsers[0] || {};
                    window.sendAdminPushNotification(
                        'New User Registered!',
                        `${latestUser.name || 'New Member'} joined LocalBazar via ${latestUser.method || 'Sign-In'}.`,
                        'user',
                        '#users'
                    );
                    refreshAll();
                }
            } catch (err) {}
        }

        // 4. Customer Store Inquiry / Message Sent
        if (e.key === 'lb_notifications' && e.newValue) {
            try {
                const notifs = JSON.parse(e.newValue);
                const latest = notifs[0] || {};
                window.sendAdminPushNotification(
                    'New Customer Inquiry Received!',
                    `Inquiry from ${latest.senderName || 'Customer'} regarding "${latest.product || latest.storeName || 'Store Item'}".`,
                    'inquiry'
                );
            } catch (err) {}
        }
    });

    // ================= FORM SUBMISSION HANDLERS =================

    // Dynamic Products & Services Rows (3 Columns: Image Upload, Name, Price)
    const addProductBtn = document.getElementById('addProductRowBtn');
    const productsContainer = document.getElementById('productsContainer');
    if (addProductBtn && productsContainer) {
        addProductBtn.addEventListener('click', () => {
            const row = document.createElement('div');
            row.className = 'product-item-row';
            row.innerHTML = `
                <div class="prod-img-box" onclick="this.querySelector('input[type=file]').click()" title="Upload image">
                    <input type="file" class="prod-file-input" accept="image/*" style="display:none;" onchange="previewProductImg(this)">
                    <div class="prod-img-placeholder">
                        <i class="fa-solid fa-camera"></i>
                        <span>Image</span>
                    </div>
                    <img class="prod-img-preview" alt="Item preview" style="display:none;">
                </div>
                <input type="text" class="prod-name" placeholder="Item / Service Name" required>
                <input type="text" class="prod-price" placeholder="Price (e.g. ₹500, Free)">
                <button type="button" class="btn-remove-row" onclick="this.parentElement.remove()" title="Remove"><i class="fa-solid fa-trash-can"></i></button>
            `;
            productsContainer.appendChild(row);
        });
    }

    // Product Image Preview Helper (Auto-compressed to < 500KB)
    window.previewProductImg = function(input) {
        const file = input.files[0];
        if (file) {
            const parent = input.parentElement;
            const placeholder = parent.querySelector('.prod-img-placeholder');
            const preview = parent.querySelector('.prod-img-preview');

            window.compressImage(file, 400, 1080)
                .then(compressedDataUrl => {
                    if (preview) {
                        preview.src = compressedDataUrl;
                        preview.style.display = 'block';
                    }
                    if (placeholder) {
                        placeholder.style.display = 'none';
                    }
                })
                .catch(() => {
                    // Fallback to standard reader if compression fails
                    const reader = new FileReader();
                    reader.onload = function(e) {
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

    // =========================================================================
    // ENTERPRISE MULTI-STAGE LISTING CREATION PORTAL (ADMIN PANEL)
    // =========================================================================
    const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    let adminCurrentListingStep = 1;
    let adminUploadedImagesList = [];
    let adminDailyScheduleData = {
        'Monday':    { isOpen: true,  openTime: '09:00', openAmPm: 'AM', closeTime: '08:30', closeAmPm: 'PM' },
        'Tuesday':   { isOpen: true,  openTime: '09:00', openAmPm: 'AM', closeTime: '08:30', closeAmPm: 'PM' },
        'Wednesday': { isOpen: true,  openTime: '09:00', openAmPm: 'AM', closeTime: '08:30', closeAmPm: 'PM' },
        'Thursday':  { isOpen: true,  openTime: '09:00', openAmPm: 'AM', closeTime: '08:30', closeAmPm: 'PM' },
        'Friday':    { isOpen: true,  openTime: '09:00', openAmPm: 'AM', closeTime: '08:30', closeAmPm: 'PM' },
        'Saturday':  { isOpen: true,  openTime: '09:00', openAmPm: 'AM', closeTime: '08:30', closeAmPm: 'PM' },
        'Sunday':    { isOpen: false, openTime: '09:00', openAmPm: 'AM', closeTime: '08:30', closeAmPm: 'PM' }
    };
    let adminSelectedHolidaysSet = new Set();
    let adminCurrentCalDate = new Date();
    let isAdminDoctorChamberApplicable = false;

    // 1. Step-by-Step Multi-Stage Navigation Engine
    window.navigateAdminListingStep = function(stepNum) {
        adminCurrentListingStep = stepNum;

        // Switch active step pane
        for (let i = 1; i <= 4; i++) {
            const pane = document.getElementById(`adminListingStepPane${i}`);
            if (pane) {
                pane.style.display = (i === stepNum) ? 'block' : 'none';
            }
        }

        // Update step pills UI
        document.querySelectorAll('#adminListingStepsBar .step-nav-pill').forEach(btn => {
            const pStep = parseInt(btn.getAttribute('data-step'), 10);
            const isActive = (pStep === stepNum);
            btn.classList.toggle('active', isActive);
            if (isActive) {
                btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
            }
        });

        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // 2. City & Locality Autocomplete Dropdown
    function initAdminCityAutocomplete() {
        const cityInputEl = document.getElementById('fullListingCity');
        const cityDropdownEl = document.getElementById('adminCitySuggestionsDropdown') || document.getElementById('citySuggestionsDropdown');
        if (!cityInputEl || !cityDropdownEl) return;

        function updateCitySuggestions() {
            const val = cityInputEl.value.trim().toLowerCase();
            const cities = getDB(DB_KEYS.CITIES);

            if (!val) {
                cityDropdownEl.classList.remove('open');
                cityDropdownEl.innerHTML = '';
                return;
            }

            // Prefix match
            const matches = cities.filter(c => {
                const name = (c.name || '').toLowerCase();
                return name.startsWith(val);
            });

            if (matches.length === 0) {
                cityDropdownEl.innerHTML = `
                    <div style="padding:0.85rem 1rem; text-align:center; color:#64748b; font-size:0.82rem; background:#ffffff; border-radius:8px;">
                        <i class="fa-solid fa-location-crosshairs" style="color:#ef4444; margin-right:4px;"></i>
                        No City Available for "<strong>${escapeAdminHtml(cityInputEl.value.trim())}</strong>"
                        <div style="margin-top:8px;">
                            <button type="button" onclick="window.openModal('addCityModal')" style="background:#2563eb; color:#fff; border:none; padding:4px 12px; border-radius:6px; font-size:0.76rem; font-weight:700; cursor:pointer;">
                                <i class="fa-solid fa-plus"></i> Add New City Hub
                            </button>
                        </div>
                    </div>
                `;
                cityDropdownEl.classList.add('open');
                return;
            }

            cityDropdownEl.innerHTML = matches.map(c => `
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

            cityDropdownEl.classList.add('open');

            cityDropdownEl.querySelectorAll('.city-suggestion-item').forEach(item => {
                item.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const chosen = item.getAttribute('data-city-name');
                    cityInputEl.value = chosen;
                    cityDropdownEl.classList.remove('open');
                    cityDropdownEl.innerHTML = '';
                });
            });
        }

        cityInputEl.addEventListener('input', updateCitySuggestions);
        cityInputEl.addEventListener('focus', updateCitySuggestions);
        cityInputEl.addEventListener('keyup', updateCitySuggestions);

        document.addEventListener('click', (e) => {
            if (!cityInputEl.contains(e.target) && !cityDropdownEl.contains(e.target)) {
                cityDropdownEl.classList.remove('open');
            }
        });
    }

    // 2B. Business Category Autocomplete Dropdown (From Admin Categories)
    function initAdminCategoryAutocomplete() {
        const catInputEl = document.getElementById('fullListingCategory');
        const catDropdownEl = document.getElementById('adminCategorySuggestionsDropdown');
        if (!catInputEl || !catDropdownEl) return;

        function updateCategorySuggestions() {
            const val = catInputEl.value.trim().toLowerCase();
            const categories = getDB(DB_KEYS.CATEGORIES);

            if (!val) {
                const topCats = categories.slice(0, 8);
                if (topCats.length === 0) {
                    catDropdownEl.classList.remove('open');
                    catDropdownEl.innerHTML = '';
                    return;
                }
                renderCatDropdown(topCats);
                return;
            }

            const prefixMatches = [];
            const otherMatches = [];

            categories.forEach(c => {
                const name = (c.name || '').toLowerCase();
                const rawTags = Array.isArray(c.tags) ? c.tags : (c.tags ? c.tags.split(',') : (c.desc ? c.desc.split(',') : []));
                const tagsLower = rawTags.map(t => String(t).trim().toLowerCase());

                if (name.startsWith(val)) {
                    prefixMatches.push(c);
                } else if (name.includes(val) || tagsLower.some(t => t.startsWith(val) || t.includes(val))) {
                    otherMatches.push(c);
                }
            });

            const matches = [...prefixMatches, ...otherMatches].slice(0, 8);

            if (matches.length === 0) {
                catDropdownEl.classList.remove('open');
                catDropdownEl.innerHTML = '';
                return;
            }

            renderCatDropdown(matches);
        }

        function renderCatDropdown(matches) {
            catDropdownEl.innerHTML = matches.map(c => `
                <div class="city-suggestion-item" data-cat-name="${c.name}">
                    <div class="sugg-city-info">
                        <span class="sugg-city-name">
                            <i class="fa-solid fa-layer-group" style="color:#2563eb; font-size:0.85rem;"></i>
                            ${c.name}
                        </span>
                        <div class="sugg-city-details">
                            <span>Category</span>
                            ${c.desc ? ` • <span>${c.desc.slice(0, 45)}</span>` : ''}
                        </div>
                    </div>
                    <span class="sugg-select-hint"><i class="fa-solid fa-arrow-turn-down-left"></i> Select</span>
                </div>
            `).join('');

            catDropdownEl.classList.add('open');

            catDropdownEl.querySelectorAll('.city-suggestion-item').forEach(item => {
                item.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const chosen = item.getAttribute('data-cat-name');
                    catInputEl.value = chosen;
                    catDropdownEl.classList.remove('open');
                    catDropdownEl.innerHTML = '';
                    if (typeof window.handleAdminCategoryChange === 'function') {
                        window.handleAdminCategoryChange(chosen);
                    }
                });
            });
        }

        catInputEl.addEventListener('input', () => {
            updateCategorySuggestions();
            if (typeof window.handleAdminCategoryChange === 'function') {
                window.handleAdminCategoryChange(catInputEl.value.trim());
            }
        });
        catInputEl.addEventListener('focus', updateCategorySuggestions);
        catInputEl.addEventListener('keyup', updateCategorySuggestions);

        document.addEventListener('click', (e) => {
            if (!catInputEl.contains(e.target) && !catDropdownEl.contains(e.target)) {
                catDropdownEl.classList.remove('open');
            }
        });
    }

    // 3. Compact Fixed Photo Picker & Multi-HD Images Compression
    window.toggleAdminPhotoDrawer = function(forceOpen) {
        const drawer = document.getElementById('adminCompactPhotoDrawer');
        const chevron = document.getElementById('adminDrawerChevron');
        if (!drawer) return;
        const willOpen = typeof forceOpen === 'boolean' ? forceOpen : (drawer.style.display === 'none' || !drawer.style.display);
        drawer.style.display = willOpen ? 'block' : 'none';
        if (chevron) {
            chevron.classList.toggle('rotated', willOpen);
        }
    };

    window.renderAdminMultiImagesGrid = function() {
        const count = adminUploadedImagesList.length;
        const pill = document.getElementById('adminPhotoCountPill');
        const sub = document.getElementById('adminPhotoStatusSubText');
        const badge = document.getElementById('adminPhotoIconBadge');
        const btnToggle = document.getElementById('adminBtnTogglePreviewDrawer');
        const drawer = document.getElementById('adminCompactPhotoDrawer');
        const drawerChevron = document.getElementById('adminDrawerChevron');
        const drawerCount = document.getElementById('adminDrawerCountText');
        const grid = document.getElementById('adminMultiImagesPreviewGrid');
        const coverHidden = document.getElementById('adminUploadedImageData');

        if (pill) {
            pill.textContent = `${count} ${count === 1 ? 'Photo' : 'Photos'} Selected`;
            pill.classList.toggle('has-photos', count > 0);
        }
        if (drawerCount) {
            drawerCount.textContent = count.toString();
        }
        if (badge) {
            badge.classList.toggle('has-photos', count > 0);
            badge.innerHTML = count > 0 ? '<i class="fa-solid fa-check"></i>' : '<i class="fa-solid fa-camera"></i>';
        }
        if (sub) {
            if (count === 0) {
                sub.textContent = 'Upload single or multiple HD photos (Auto-compressed preserving quality)';
            } else if (count === 1) {
                sub.textContent = '1 photo attached (Cover photo ready)';
            } else {
                sub.textContent = `${count} photos attached. 1st photo is Cover photo.`;
            }
        }
        if (btnToggle) {
            btnToggle.style.display = count > 0 ? 'inline-flex' : 'none';
        }
        if (count === 0 && drawer) {
            drawer.style.display = 'none';
            if (drawerChevron) drawerChevron.classList.remove('rotated');
        }
        if (grid) {
            if (count === 0) {
                grid.innerHTML = '';
            } else {
                grid.innerHTML = adminUploadedImagesList.map((imgUrl, idx) => `
                    <div class="multi-img-item">
                        <img src="${imgUrl}" alt="Photo ${idx + 1}" class="multi-img-thumb">
                        ${idx === 0 ? '<span class="primary-badge-tag">Cover</span>' : ''}
                        <button type="button" class="btn-remove-multi-img" onclick="removeAdminMultiImage(${idx})" title="Remove photo">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                `).join('');
            }
        }
        if (coverHidden) {
            coverHidden.value = adminUploadedImagesList[0] || '';
        }
    };

    window.removeAdminMultiImage = function(index) {
        adminUploadedImagesList.splice(index, 1);
        window.renderAdminMultiImagesGrid();
    };

    document.getElementById('adminMultiImagesInput')?.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        for (const file of files) {
            try {
                const compressed = await window.compressImage(file, 400, 1400);
                adminUploadedImagesList.push(compressed);
            } catch {
                const reader = new FileReader();
                reader.onload = (evt) => {
                    adminUploadedImagesList.push(evt.target.result);
                    window.renderAdminMultiImagesGrid();
                };
                reader.readAsDataURL(file);
            }
        }
        window.renderAdminMultiImagesGrid();
        window.toggleAdminPhotoDrawer(true);
        e.target.value = '';
    });

    // 4. Dynamic Category Change Handler
    window.handleAdminCategoryChange = function(categoryVal) {
        const btnPublishFromTimings = document.getElementById('adminBtnPublishFromTimings');
        if (btnPublishFromTimings) btnPublishFromTimings.style.display = 'inline-flex';
    };

    // 5. Enterprise Day-by-Day Operating Schedule Matrix
    window.renderAdminDailyScheduleMatrix = function() {
        const container = document.getElementById('adminDailyScheduleMatrix');
        if (!container) return;

        container.innerHTML = `
            <div class="matrix-quick-actions">
                <span class="matrix-tip"><i class="fa-solid fa-wand-magic-sparkles text-amber"></i> Quick Tip: Customize each day's exact timings or toggle Closed.</span>
                <button type="button" class="btn-copy-timings" id="adminBtnApplyAllDays" onclick="applyAdminMondayTimeToAll()" title="Apply Monday timings to all open days">
                    <i class="fa-solid fa-copy"></i> Apply Mon Times to All Days
                </button>
            </div>
            <div class="matrix-rows-wrap">
                ${DAYS_OF_WEEK.map(day => {
                    const d = adminDailyScheduleData[day] || { isOpen: true, openTime: '09:00', openAmPm: 'AM', closeTime: '08:30', closeAmPm: 'PM' };
                    return `
                        <div class="matrix-day-row ${d.isOpen ? 'is-open' : 'is-closed'}" id="adminMatrixRow_${day}">
                            <div class="matrix-day-info">
                                <label class="day-toggle-switch">
                                    <input type="checkbox" class="chk-day-open" data-day="${day}" ${d.isOpen ? 'checked' : ''} onchange="handleAdminDayToggle('${day}', this.checked)">
                                    <span class="slider round"></span>
                                </label>
                                <span class="matrix-day-name">${day}</span>
                                <span class="matrix-status-tag ${d.isOpen ? 'tag-open' : 'tag-closed'}" id="adminMatrixTag_${day}">${d.isOpen ? 'Open' : 'Closed'}</span>
                            </div>

                            <div class="matrix-times-box" id="adminMatrixTimesBox_${day}" style="${d.isOpen ? '' : 'opacity:0.4; pointer-events:none;'}">
                                <div class="matrix-time-input-wrap">
                                    <span class="time-lbl">Open:</span>
                                    <div class="time-ampm-row">
                                        <input type="text" class="inp-open-val" data-day="${day}" value="${d.openTime}" maxlength="5" onchange="handleAdminDailyTimeChange('${day}', 'openTime', this.value)">
                                        <select class="sel-open-ampm" data-day="${day}" onchange="handleAdminDailyTimeChange('${day}', 'openAmPm', this.value)">
                                            <option value="AM" ${d.openAmPm === 'AM' ? 'selected' : ''}>AM</option>
                                            <option value="PM" ${d.openAmPm === 'PM' ? 'selected' : ''}>PM</option>
                                        </select>
                                    </div>
                                </div>
                                <span class="matrix-time-sep">—</span>
                                <div class="matrix-time-input-wrap">
                                    <span class="time-lbl">Close:</span>
                                    <div class="time-ampm-row">
                                        <input type="text" class="inp-close-val" data-day="${day}" value="${d.closeTime}" maxlength="5" onchange="handleAdminDailyTimeChange('${day}', 'closeTime', this.value)">
                                        <select class="sel-close-ampm" data-day="${day}" onchange="handleAdminDailyTimeChange('${day}', 'closeAmPm', this.value)">
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
    };

    window.handleAdminDayToggle = function(day, isOpen) {
        if (!adminDailyScheduleData[day]) adminDailyScheduleData[day] = {};
        adminDailyScheduleData[day].isOpen = isOpen;

        const row = document.getElementById(`adminMatrixRow_${day}`);
        const tag = document.getElementById(`adminMatrixTag_${day}`);
        const timesBox = document.getElementById(`adminMatrixTimesBox_${day}`);

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

    window.handleAdminDailyTimeChange = function(day, field, val) {
        if (!adminDailyScheduleData[day]) adminDailyScheduleData[day] = {};
        adminDailyScheduleData[day][field] = val;
    };

    window.applyAdminMondayTimeToAll = function() {
        const mon = adminDailyScheduleData['Monday'] || { openTime: '09:00', openAmPm: 'AM', closeTime: '08:30', closeAmPm: 'PM' };
        DAYS_OF_WEEK.forEach(day => {
            if (day !== 'Monday' && adminDailyScheduleData[day]?.isOpen) {
                adminDailyScheduleData[day].openTime = mon.openTime;
                adminDailyScheduleData[day].openAmPm = mon.openAmPm;
                adminDailyScheduleData[day].closeTime = mon.closeTime;
                adminDailyScheduleData[day].closeAmPm = mon.closeAmPm;
            }
        });
        window.renderAdminDailyScheduleMatrix();
    };

    // 6. Scheduled Holidays Popover Calendar
    window.toggleAdminHolidayCalendar = function() {
        const pop = document.getElementById('adminCalendarPopover');
        if (!pop) return;
        const willOpen = (pop.style.display === 'none' || !pop.style.display);
        pop.style.display = willOpen ? 'block' : 'none';
        if (willOpen) {
            window.renderAdminCalendarMonth();
        } else {
            window.updateAdminHolidaySummary();
        }
    };

    window.adminPrevMonth = function() {
        adminCurrentCalDate.setMonth(adminCurrentCalDate.getMonth() - 1);
        window.renderAdminCalendarMonth();
    };

    window.adminNextMonth = function() {
        adminCurrentCalDate.setMonth(adminCurrentCalDate.getMonth() + 1);
        window.renderAdminCalendarMonth();
    };

    window.updateAdminHolidaySummary = function() {
        const summaryEl = document.getElementById('adminHolidaySummaryDisplay');
        const countEl = document.getElementById('adminCalSelectedCountText');
        const count = adminSelectedHolidaysSet.size;
        if (summaryEl) {
            summaryEl.textContent = count > 0 ? `${count} Holidays Selected` : '0 Holidays Selected';
        }
        if (countEl) {
            countEl.textContent = `${count} selected`;
        }
    };

    window.renderAdminCalendarMonth = function() {
        const grid = document.getElementById('adminCalendarDaysGrid');
        const title = document.getElementById('adminCalMonthTitle');
        if (!grid || !title) return;

        const year = adminCurrentCalDate.getFullYear();
        const month = adminCurrentCalDate.getMonth();
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        title.textContent = `${monthNames[month]} ${year}`;

        const firstDayIndex = new Date(year, month, 1).getDay();
        const lastDate = new Date(year, month + 1, 0).getDate();

        grid.innerHTML = '';

        for (let i = 0; i < firstDayIndex; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'cal-day-cell empty';
            grid.appendChild(emptyCell);
        }

        for (let d = 1; d <= lastDate; d++) {
            const dayCell = document.createElement('div');
            dayCell.className = 'cal-day-cell';
            dayCell.textContent = d;

            const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            if (adminSelectedHolidaysSet.has(dateKey)) {
                dayCell.classList.add('selected');
            }

            dayCell.addEventListener('click', (e) => {
                e.stopPropagation();
                if (adminSelectedHolidaysSet.has(dateKey)) {
                    adminSelectedHolidaysSet.delete(dateKey);
                    dayCell.classList.remove('selected');
                } else {
                    adminSelectedHolidaysSet.add(dateKey);
                    dayCell.classList.add('selected');
                }
                window.updateAdminHolidaySummary();
            });

            grid.appendChild(dayCell);
        }
        window.updateAdminHolidaySummary();
    };

    // Close calendar popover on outside click
    document.addEventListener('click', (e) => {
        const pop = document.getElementById('adminCalendarPopover');
        const trigger = document.getElementById('adminHolidayTriggerBtn');
        if (pop && pop.style.display === 'block') {
            if (!pop.contains(e.target) && !trigger?.contains(e.target)) {
                pop.style.display = 'none';
                window.updateAdminHolidaySummary();
            }
        }
    });

    // 7. Doctor Chamber Dynamic Rows
    window.addAdminDoctorRow = function() {
        const container = document.getElementById('adminDoctorsContainer');
        if (!container) return;

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
        container.appendChild(card);
    };

    // 8. Form Reset & Submission Handler
    window.resetAdminListingForm = function() {
        const form = document.getElementById('fullListingCreationForm');
        if (form) form.reset();

        adminUploadedImagesList = [];
        window.renderAdminMultiImagesGrid();

        adminDailyScheduleData = {
            'Monday':    { isOpen: true,  openTime: '09:00', openAmPm: 'AM', closeTime: '08:30', closeAmPm: 'PM' },
            'Tuesday':   { isOpen: true,  openTime: '09:00', openAmPm: 'AM', closeTime: '08:30', closeAmPm: 'PM' },
            'Wednesday': { isOpen: true,  openTime: '09:00', openAmPm: 'AM', closeTime: '08:30', closeAmPm: 'PM' },
            'Thursday':  { isOpen: true,  openTime: '09:00', openAmPm: 'AM', closeTime: '08:30', closeAmPm: 'PM' },
            'Friday':    { isOpen: true,  openTime: '09:00', openAmPm: 'AM', closeTime: '08:30', closeAmPm: 'PM' },
            'Saturday':  { isOpen: true,  openTime: '09:00', openAmPm: 'AM', closeTime: '08:30', closeAmPm: 'PM' },
            'Sunday':    { isOpen: false, openTime: '09:00', openAmPm: 'AM', closeTime: '08:30', closeAmPm: 'PM' }
        };
        window.renderAdminDailyScheduleMatrix();

        adminSelectedHolidaysSet.clear();
        window.updateAdminHolidaySummary();

        isAdminDoctorChamberApplicable = false;
        const ownerSelect = document.getElementById('fullListingOwner');
        if (ownerSelect) ownerSelect.value = '';
        window.handleAdminCategoryChange('');
        window.navigateAdminListingStep(1);
    };

    window.handleAdminListingRegistrationSubmit = function() {
        const name = document.getElementById('fullListingName')?.value.trim();
        const category = document.getElementById('fullListingCategory')?.value;
        const city = document.getElementById('fullListingCity')?.value.trim();
        const phone = document.getElementById('fullListingContact')?.value.trim();
        const status = document.getElementById('fullListingStatus')?.value || 'Verified';
        const address = document.getElementById('fullListingAddress')?.value.trim();
        const mapLink = document.getElementById('fullListingMapLink')?.value.trim() || '';

        // Step 1 Validation
        if (!name || !category || !city || !phone) {
            alert('Please fill out all required fields in Step 1 (Name, Category, City, and Phone).');
            window.navigateAdminListingStep(1);
            if (!name) document.getElementById('fullListingName')?.focus();
            else if (!category) document.getElementById('fullListingCategory')?.focus();
            else if (!city) document.getElementById('fullListingCity')?.focus();
            else if (!phone) document.getElementById('fullListingContact')?.focus();
            return;
        }

        // Step 2 Validation
        if (!address) {
            alert('Please provide the business address in Step 2.');
            window.navigateAdminListingStep(2);
            document.getElementById('fullListingAddress')?.focus();
            return;
        }

        // Step 3: Open days validation
        const openDays = DAYS_OF_WEEK.filter(day => adminDailyScheduleData[day]?.isOpen);
        if (openDays.length === 0) {
            alert('Please select at least one open day for this business schedule.');
            window.navigateAdminListingStep(3);
            return;
        }

        const firstOpenDay = openDays[0];
        const defaultDayObj = adminDailyScheduleData[firstOpenDay] || { openTime: '09:00', openAmPm: 'AM', closeTime: '08:30', closeAmPm: 'PM' };
        const primaryScheduleTimings = `${defaultDayObj.openTime} ${defaultDayObj.openAmPm} - ${defaultDayObj.closeTime} ${defaultDayObj.closeAmPm}`;
        const holidays = Array.from(adminSelectedHolidaysSet);

        // Doctor Chamber Data
        const doctors = [];

        const listings = getDB(DB_KEYS.LISTINGS);
        const cities = getDB(DB_KEYS.CITIES);

        const ownerSelect = document.getElementById('fullListingOwner');
        const ownerId = ownerSelect ? ownerSelect.value : '';
        let ownerName = 'Platform Managed';
        if (ownerId) {
            const allUsers = getDB(DB_KEYS.USERS);
            const userObj = allUsers.find(u => String(u.id) === String(ownerId));
            if (userObj) ownerName = userObj.name;
        }

        const newListing = {
            id: 'LB-' + Math.floor(1000 + Math.random() * 9000),
            name,
            category,
            city,
            phone,
            status,
            address,
            mapLink,
            image: adminUploadedImagesList[0] || '',
            gallery: adminUploadedImagesList,
            images: adminUploadedImagesList,
            openDays: openDays,
            scheduleTimings: primaryScheduleTimings,
            dailySchedule: JSON.parse(JSON.stringify(adminDailyScheduleData)),
            holidays: holidays,
            doctors: doctors,
            products: [],
            desc: '',
            ownerId: ownerId || '',
            ownerName: ownerName,
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        };

        listings.unshift(newListing);
        setDB(DB_KEYS.LISTINGS, listings);

        // Auto add city if new
        if (!cities.some(c => c.name.toLowerCase() === city.toLowerCase())) {
            cities.push({ name: city, state: 'Active Hub' });
            setDB(DB_KEYS.CITIES, cities);
        }

        window.resetAdminListingForm();
        refreshAll();
        switchView('listingsView');
        alert(`Success! "${name}" has been published and added to listings.`);
    };

    document.getElementById('fullListingCreationForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        window.handleAdminListingRegistrationSubmit();
    });

    // Initialize City & Category Autocomplete & Schedule Matrix for Admin
    initAdminCityAutocomplete();
    initAdminCategoryAutocomplete();
    window.renderAdminDailyScheduleMatrix();
    window.renderAdminMultiImagesGrid();

    // Add City Form
    document.getElementById('newCityForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('cityNameInput').value.trim();
        const district = document.getElementById('cityDistrictInput')?.value.trim() || '';
        const state = document.getElementById('cityStateInput').value.trim();
        const pincode = document.getElementById('cityPincodeInput').value.trim();

        const cities = getDB(DB_KEYS.CITIES);
        if (cities.some(c => c.name.toLowerCase() === name.toLowerCase())) {
            alert('This city is already registered.');
            return;
        }

        cities.push({ 
            name, 
            district: district || '',
            state: state || 'Active Hub',
            pincode: pincode || ''
        });
        setDB(DB_KEYS.CITIES, cities);

        document.getElementById('addCityModal').classList.remove('active');
        document.getElementById('newCityForm').reset();
        refreshAll();
        alert(`City "${name}" (${district ? district + ', ' : ''}${state} - ${pincode}) added to coverage!`);
    });

    // Edit City Form Handler
    document.getElementById('editCityForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const originalName = decodeURIComponent(document.getElementById('editCityOriginalName').value.trim());
        const newName = document.getElementById('editCityNameInput').value.trim();
        const newDistrict = document.getElementById('editCityDistrictInput').value.trim();
        const newState = document.getElementById('editCityStateInput').value.trim();
        const newPincode = document.getElementById('editCityPincodeInput').value.trim();

        const ok = await window.adminSecurityConfirm({
            title: 'Save City Changes',
            message: `Are you sure you want to save changes for city <strong>"${originalName}"</strong>?`,
            actionType: 'edit'
        });
        if (!ok) return;

        let cities = getDB(DB_KEYS.CITIES);
        const cityIndex = cities.findIndex(c => c.name.toLowerCase() === originalName.toLowerCase());

        if (cityIndex === -1) {
            alert('City not found.');
            return;
        }

        // If city name changed, check duplicate
        if (originalName.toLowerCase() !== newName.toLowerCase() && cities.some(c => c.name.toLowerCase() === newName.toLowerCase())) {
            alert('Another city already exists with this name.');
            return;
        }

        // Update city
        cities[cityIndex] = {
            ...cities[cityIndex],
            name: newName,
            district: newDistrict,
            state: newState,
            pincode: newPincode
        };
        setDB(DB_KEYS.CITIES, cities);

        // Also update existing listings under this city if name changed
        if (originalName.toLowerCase() !== newName.toLowerCase()) {
            if (window.lbCloudSync && typeof window.lbCloudSync.deleteCity === 'function') {
                window.lbCloudSync.deleteCity(originalName);
            }
            let listings = getDB(DB_KEYS.LISTINGS);
            let updatedCount = 0;
            listings = listings.map(l => {
                if (l.city && l.city.toLowerCase() === originalName.toLowerCase()) {
                    updatedCount++;
                    return { ...l, city: newName };
                }
                return l;
            });
            if (updatedCount > 0) {
                setDB(DB_KEYS.LISTINGS, listings);
            }
        }

        document.getElementById('editCityModal').classList.remove('active');
        refreshAll();
        alert(`City "${newName}" updated successfully!`);
    });

    // ===== STORE SLIDING CATEGORIES CHIP BUILDER =====
    function resolveCategoryEmoji(label = '') {
        const l = (label || '').toLowerCase();
        if (/biryani|food|roll|thali|lunch|dinner|restaurant|hotel|dhabha|fast food|snack|cook|kitchen/.test(l)) return '🍲';
        if (/pizza/.test(l)) return '🍕';
        if (/burger/.test(l)) return '🍔';
        if (/sweet|mithai|laddu|rasgulla|dessert|ice cream/.test(l)) return '🍧';
        if (/cake|pastry|bakery/.test(l)) return '🎂';
        if (/tea|coffee|chai|cafe/.test(l)) return '☕';
        if (/saree|kurti|dress|gown|boutique|lehenga|women|ladies/.test(l)) return '👗';
        if (/shirt|pant|tshirt|jeans|cloth|garment|men|tailor|suit/.test(l)) return '👕';
        if (/shoe|boot|sneaker|sandal|footwear/.test(l)) return '👟';
        if (/doctor|consult|chamber|clinic|hospital/.test(l)) return '🩺';
        if (/medicine|pharmacy|chemist|tablet|capsule|syrup|drug/.test(l)) return '💊';
        if (/diagnostic|lab|test|blood|xray|pathology|scan/.test(l)) return '🔬';
        if (/mobile|phone|smartphone|iphone|android|screen/.test(l)) return '📱';
        if (/laptop|computer|pc|it |software|tech|printer/.test(l)) return '💻';
        if (/electric|wiring|fan|light|ac |ac repair|cooler|fridge|refrigerator/.test(l)) return '⚡';
        if (/plumber|pipe|water|sanitary|tap/.test(l)) return '🔧';
        if (/salon|parlor|beauty|hair|cut|spa|facial|makeup/.test(l)) return '💇';
        if (/jewelry|jeweller|gold|silver|diamond|ring|necklace/.test(l)) return '💍';
        if (/car|auto|vehicle|drive|motor|four wheeler/.test(l)) return '🚗';
        if (/bike|cycle|two wheeler|scooter/.test(l)) return '🏍️';
        if (/book|stationary|copy|pen|xerox|print|school|study/.test(l)) return '📚';
        if (/grocery|ration|kirana|supermarket|bazar|oil|rice|flour|atta/.test(l)) return '🛒';
        if (/fruit|apple|banana|mango/.test(l)) return '🍎';
        if (/veg|vegetable|sabzi/.test(l)) return '🥦';
        if (/meat|chicken|mutton|fish|mach/.test(l)) return '🍗';
        if (/flower|puja|temple|mandir/.test(l)) return '🌸';
        if (/gift|toy|game/.test(l)) return '🎁';
        if (/gym|fitness|workout|body/.test(l)) return '💪';
        if (/service|repair|clean|home/.test(l)) return '🛠️';
        return '🏷️';
    }

    function renderStoreIconHtml(icon) {
        if (!icon) return '<span class="cat-emoji">🏷️</span>';
        const isEmoji = /\p{Extended_Pictographic}/u.test(icon) || !icon.includes('fa-');
        if (isEmoji) {
            return `<span class="cat-emoji">${icon}</span>`;
        }
        let faClass = icon.trim();
        if (!faClass.includes('fa-solid') && !faClass.includes('fa-regular') && !faClass.includes('fa-brands')) {
            faClass = 'fa-solid ' + (faClass.startsWith('fa-') ? faClass : 'fa-' + faClass);
        }
        return `<i class="${faClass}"></i>`;
    }

    function initStoreCategoryBuilder(chipsId, nameInputId, iconInputId, previewId, addBtnId) {
        const chipsEl = document.getElementById(chipsId);
        const nameInput = document.getElementById(nameInputId);
        const iconInput = document.getElementById(iconInputId);
        const previewEl = document.getElementById(previewId);
        const addBtn = document.getElementById(addBtnId);

        if (!chipsEl || !nameInput || !addBtn) return null;

        function updatePreview() {
            if (!previewEl) return;
            const pasted = iconInput ? iconInput.value.trim() : '';
            const nameVal = nameInput ? nameInput.value.trim() : '';
            const chosenIcon = pasted || (nameVal ? resolveCategoryEmoji(nameVal) : '🏷️');
            previewEl.innerHTML = renderStoreIconHtml(chosenIcon);
        }

        if (iconInput) {
            iconInput.addEventListener('input', updatePreview);
        }
        nameInput.addEventListener('input', () => {
            if (!iconInput || !iconInput.value.trim()) {
                updatePreview();
            }
        });

        function getChips() {
            return Array.from(chipsEl.querySelectorAll('.store-chip')).map(c => ({
                name: c.dataset.label || c.dataset.value || '',
                label: c.dataset.label || c.dataset.value || '',
                icon: c.dataset.icon || '🏷️'
            })).filter(c => c.name);
        }

        function addChip(item) {
            let label = '';
            let icon = '';

            if (typeof item === 'string') {
                label = item.trim();
                icon = iconInput ? iconInput.value.trim() : '';
            } else if (item && typeof item === 'object') {
                label = (item.label || item.name || '').trim();
                icon = (item.icon || '').trim();
            }

            if (!label) return;
            if (!icon) {
                icon = resolveCategoryEmoji(label);
            }

            const existing = getChips();
            if (existing.some(c => c.name.toLowerCase() === label.toLowerCase())) {
                nameInput.value = '';
                if (iconInput) iconInput.value = '';
                updatePreview();
                return;
            }

            const chip = document.createElement('span');
            chip.className = 'store-chip';
            chip.dataset.label = label;
            chip.dataset.value = label;
            chip.dataset.icon = icon;
            chip.innerHTML = `
                ${renderStoreIconHtml(icon)}
                <span class="chip-label">${label}</span>
                <button type="button" class="chip-remove-btn" title="Remove"><i class="fa-solid fa-xmark"></i></button>
            `;

            chip.querySelector('.chip-remove-btn')?.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                chip.remove();
            });

            chipsEl.appendChild(chip);

            nameInput.value = '';
            if (iconInput) iconInput.value = '';
            updatePreview();
        }

        addBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            addChip(nameInput.value);
            nameInput.focus();
        });

        nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                addChip(nameInput.value);
            }
        });

        if (iconInput) {
            iconInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    addChip(nameInput.value);
                }
            });
        }

        return {
            getChips,
            setChips(arr) {
                chipsEl.innerHTML = '';
                (arr || []).forEach(item => addChip(item));
            },
            clear() {
                chipsEl.innerHTML = '';
                nameInput.value = '';
                if (iconInput) iconInput.value = '';
                updatePreview();
            }
        };
    }

    // Initialize both chip builders
    window.addStoreCatBuilder = initStoreCategoryBuilder('addStoreCatChips', 'addStoreCatInput', 'addStoreCatIconInput', 'addStoreCatIconPreview', 'addStoreCatBtn');
    window.editStoreCatBuilder = initStoreCategoryBuilder('editStoreCatChips', 'editStoreCatInput', 'editStoreCatIconInput', 'editStoreCatIconPreview', 'editStoreCatBtn');

    // Add Category Form
    document.getElementById('newCategoryForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('catNameInput').value.trim();
        const rawTags = document.getElementById('catTagsInput')?.value.trim() || '';
        const tags = rawTags.split(',').map(t => t.trim()).filter(Boolean);
        const storeCategories = window.addStoreCatBuilder ? window.addStoreCatBuilder.getChips() : [];

        const categories = getDB(DB_KEYS.CATEGORIES);
        if (categories.some(cat => cat.name.toLowerCase() === name.toLowerCase())) {
            alert('This category already exists.');
            return;
        }

        const catObj = { 
            name, 
            tags: tags,
            desc: tags.join(', '),
            storeCategories: storeCategories,
            subcategories: storeCategories.map(s => s.name || s.label || s)
        };
        categories.push(catObj);
        setDB(DB_KEYS.CATEGORIES, categories);

        if (window.lbCloudSync && typeof window.lbCloudSync.saveCategory === 'function') {
            window.lbCloudSync.saveCategory(catObj);
        }

        if (window.addStoreCatBuilder) window.addStoreCatBuilder.clear();
        document.getElementById('addCategoryModal').classList.remove('active');
        document.getElementById('newCategoryForm').reset();
        refreshAll();
        alert(`Category "${name}" created successfully!`);
    });

    // Edit Category Form Handler
    document.getElementById('editCategoryForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const originalName = decodeURIComponent(document.getElementById('editCatOriginalName').value.trim());
        const newName = document.getElementById('editCatNameInput').value.trim();
        const rawTags = document.getElementById('editCatTagsInput')?.value.trim() || '';
        const tags = rawTags.split(',').map(t => t.trim()).filter(Boolean);
        const storeCategories = window.editStoreCatBuilder ? window.editStoreCatBuilder.getChips() : [];

        let categories = getDB(DB_KEYS.CATEGORIES);
        const catIndex = categories.findIndex(c => c.name.toLowerCase() === originalName.toLowerCase());

        if (catIndex === -1) {
            alert('Category not found.');
            return;
        }

        // If category title changed, check duplicate
        if (originalName.toLowerCase() !== newName.toLowerCase() && categories.some(c => c.name.toLowerCase() === newName.toLowerCase())) {
            alert('Another category already exists with this name.');
            return;
        }

        // Update category
        categories[catIndex] = {
            ...categories[catIndex],
            name: newName,
            tags: tags,
            desc: tags.join(', '),
            storeCategories: storeCategories,
            subcategories: storeCategories.map(s => s.name || s.label || s)
        };
        setDB(DB_KEYS.CATEGORIES, categories);

        if (window.lbCloudSync && typeof window.lbCloudSync.saveCategory === 'function') {
            window.lbCloudSync.saveCategory(categories[catIndex]);
        }

        if (window.editStoreCatBuilder) window.editStoreCatBuilder.clear();

        // Also update listings under this category if name changed
        if (originalName.toLowerCase() !== newName.toLowerCase()) {
            if (window.lbCloudSync && typeof window.lbCloudSync.deleteCategory === 'function') {
                window.lbCloudSync.deleteCategory(originalName);
            }
            let listings = getDB(DB_KEYS.LISTINGS);
            let updatedCount = 0;
            listings = listings.map(l => {
                if (l.category && l.category.toLowerCase() === originalName.toLowerCase()) {
                    updatedCount++;
                    return { ...l, category: newName };
                }
                return l;
            });
            if (updatedCount > 0) {
                setDB(DB_KEYS.LISTINGS, listings);
            }
        }

        document.getElementById('editCategoryModal').classList.remove('active');
        refreshAll();
        alert(`Category "${newName}" updated successfully!`);
    });

    // Compose Mail Attachment Handler (Auto compression for images up to 5MB down to few KBs)
    const mailAttachTrigger = document.getElementById('mailAttachTrigger');
    const mailAttachmentInput = document.getElementById('mailAttachmentInput');
    const mailAttachPreview = document.getElementById('mailAttachPreview');
    const attachFileName = document.getElementById('attachFileName');
    const attachFileSize = document.getElementById('attachFileSize');
    const attachIcon = document.getElementById('attachIcon');
    const mailAttachmentData = document.getElementById('mailAttachmentData');
    const mailAttachmentName = document.getElementById('mailAttachmentName');
    const removeAttachBtn = document.getElementById('removeAttachBtn');

    if (mailAttachTrigger && mailAttachmentInput) {
        mailAttachTrigger.addEventListener('click', () => mailAttachmentInput.click());

        mailAttachmentInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Enforce 5MB limit
            const maxAllowedBytes = 5 * 1024 * 1024; // 5 MB
            if (file.size > maxAllowedBytes) {
                alert('File size exceeds 5 MB limit. Please select a file under 5 MB.');
                mailAttachmentInput.value = '';
                return;
            }

            const fileName = file.name;
            const isImage = file.type.startsWith('image/');

            if (attachFileName) attachFileName.textContent = fileName;
            if (attachIcon) attachIcon.className = isImage ? 'fa-solid fa-file-image' : 'fa-solid fa-file-lines';
            if (attachFileSize) attachFileSize.textContent = 'Optimizing...';
            if (mailAttachPreview) mailAttachPreview.style.display = 'flex';
            if (mailAttachTrigger) mailAttachTrigger.style.display = 'none';

            if (isImage) {
                try {
                    // Compress image aggressively to under 300 KB preserving clear text/sharpness
                    const compressedDataUrl = await window.compressImage(file, 280, 1600);
                    const approxKB = Math.round((compressedDataUrl.length * 3) / 4 / 1024);
                    if (attachFileSize) attachFileSize.textContent = `${approxKB} KB`;
                    if (mailAttachmentData) mailAttachmentData.value = compressedDataUrl;
                    if (mailAttachmentName) mailAttachmentName.value = `${fileName} (${approxKB} KB)`;
                } catch (err) {
                    // Fallback to FileReader
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                        const kb = Math.round(file.size / 1024);
                        if (attachFileSize) attachFileSize.textContent = `${kb} KB`;
                        if (mailAttachmentData) mailAttachmentData.value = evt.target.result;
                        if (mailAttachmentName) mailAttachmentName.value = fileName;
                    };
                    reader.readAsDataURL(file);
                }
            } else {
                // Documents (PDF, DOCX) read via FileReader
                const reader = new FileReader();
                reader.onload = (evt) => {
                    const kb = Math.round(file.size / 1024);
                    if (attachFileSize) attachFileSize.textContent = `${kb} KB`;
                    if (mailAttachmentData) mailAttachmentData.value = evt.target.result;
                    if (mailAttachmentName) mailAttachmentName.value = fileName;
                };
                reader.readAsDataURL(file);
            }
        });

        if (removeAttachBtn) {
            removeAttachBtn.addEventListener('click', () => {
                if (mailAttachmentInput) mailAttachmentInput.value = '';
                if (mailAttachmentData) mailAttachmentData.value = '';
                if (mailAttachmentName) mailAttachmentName.value = '';
                if (mailAttachPreview) mailAttachPreview.style.display = 'none';
                if (mailAttachTrigger) mailAttachTrigger.style.display = 'flex';
            });
        }
    }

    // Compose Mail Form
    document.getElementById('composeMailForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const toRaw = document.getElementById('mailToInput').value.trim();
        let to = toRaw;
        const emailMatch = toRaw.match(/<([^>]+)>/);
        if (emailMatch) to = emailMatch[1].trim();
        const subject = document.getElementById('mailSubjectInput').value.trim();
        const body = document.getElementById('mailBodyInput').value.trim();
        const attachData = document.getElementById('mailAttachmentData')?.value || '';
        const attachName = document.getElementById('mailAttachmentName')?.value || '';
        const attachSize = document.getElementById('attachFileSize')?.textContent || '';

        // Find recipient user to get their User ID & Email
        const users = getDB(DB_KEYS.USERS, []);
        const toClean = to.trim();
        let targetUser = users.find(u => 
            (u.id && String(u.id).toLowerCase() === toClean.toLowerCase()) || 
            (u.email && u.email.toLowerCase() === toClean.toLowerCase()) || 
            (u.name && u.name.toLowerCase() === toClean.toLowerCase())
        );

        let resolvedUserId = targetUser ? targetUser.id : (toClean.toUpperCase().startsWith('LB') ? toClean.toUpperCase() : toClean);
        let resolvedUserEmail = targetUser ? (targetUser.email || '') : (toClean.includes('@') ? toClean : '');
        let resolvedUserName = targetUser ? (targetUser.name || '') : '';

        // Async resolve from Firestore collections if not found locally
        if ((!targetUser || !resolvedUserId) && window.lbFirestore) {
            try {
                const searchVal = toClean.toLowerCase();
                const uSnap = await window.lbFirestore.collection('users').get();
                if (!uSnap.empty) {
                    uSnap.forEach(d => {
                        const dat = d.data();
                        const dId = String(dat.id || d.id);
                        if (dId.toLowerCase() === searchVal || (dat.email && dat.email.toLowerCase() === searchVal)) {
                            targetUser = dat;
                            resolvedUserId = dat.id || d.id;
                            resolvedUserEmail = dat.email || resolvedUserEmail;
                            resolvedUserName = dat.name || resolvedUserName;
                        }
                    });
                }
            } catch(e) {
                console.warn('[Admin] Firestore user lookup warning:', e);
            }
        }

        const mail = getDB(DB_KEYS.MAIL, []);
        const newMailItem = {
            id: 'ML-' + Date.now(),
            from: 'Super Admin',
            to: resolvedUserId || toClean,
            userId: resolvedUserId || '',
            userEmail: resolvedUserEmail || '',
            userName: resolvedUserName || '',
            subject, body,
            type: 'sent',
            read: true,
            adminRead: true,
            userRead: false,
            attachment: attachData ? { data: attachData, name: attachName, size: attachSize } : null,
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        };
        mail.unshift(newMailItem);
        setDB(DB_KEYS.MAIL, mail);

        if (window.lbCloudSync && typeof window.lbCloudSync.saveMail === 'function') {
            window.lbCloudSync.saveMail(newMailItem);
        }

        document.getElementById('composeMailModal').classList.remove('active');
        document.getElementById('composeMailForm').reset();
        const mailPop = document.getElementById('mailToSuggestionsPopover');
        if (mailPop) mailPop.style.display = 'none';
        const removeAttachBtn = document.getElementById('mailAttachRemoveBtn');
        if (removeAttachBtn) removeAttachBtn.click();
        refreshAll();

        alert(`Message sent successfully to User ID: ${resolvedUserId || toClean}`);
    });

    // ========================================================
    // DYNAMIC TARGET CITY & CATEGORY AUTO-SUGGEST ENGINE
    // ========================================================
    window.toggleAdCityTarget = function(val, cityWrapId, catWrapId) {
        const cityWrap = document.getElementById(cityWrapId);
        const catWrap = catWrapId ? document.getElementById(catWrapId) : null;

        if (val === 'city') {
            if (cityWrap) {
                cityWrap.style.display = 'block';
                const input = cityWrap.querySelector('input');
                if (input) input.focus();
            }
            if (catWrap) {
                catWrap.style.display = 'block';
            }
        } else {
            if (cityWrap) {
                cityWrap.style.display = 'none';
                const input = cityWrap.querySelector('input');
                if (input) input.value = '';
                const popover = cityWrap.querySelector('.admin-city-suggestions-popover');
                if (popover) {
                    popover.style.display = 'none';
                    popover.innerHTML = '';
                }
            }
            if (catWrap) {
                catWrap.style.display = 'none';
                const input = catWrap.querySelector('input');
                if (input) input.value = '';
                const popover = catWrap.querySelector('.admin-city-suggestions-popover');
                if (popover) {
                    popover.style.display = 'none';
                    popover.innerHTML = '';
                }
            }
        }
    };

    function setupAdminCitySuggest(inputId, popoverId) {
        const input = document.getElementById(inputId);
        const popover = document.getElementById(popoverId);
        if (!input || !popover) return;

        function getUniqueCities() {
            let citySet = new Set();
            try {
                // Strictly load ONLY cities registered in Admin Database (DB_KEYS.CITIES / lb_cities)
                const citiesList = getDB(DB_KEYS.CITIES, []);
                citiesList.forEach(c => {
                    const name = typeof c === 'string' ? c : c.name;
                    if (name && name.trim()) citySet.add(name.trim());
                });
            } catch (err) {
                console.error('Error loading admin cities:', err);
            }

            return Array.from(citySet).sort();
        }

        input.addEventListener('input', () => {
            const val = input.value.trim().toLowerCase();
            if (!val) {
                popover.style.display = 'none';
                popover.innerHTML = '';
                return;
            }

            const allCities = getUniqueCities();

            if (allCities.length === 0) {
                popover.style.display = 'block';
                popover.innerHTML = `<div style="padding:0.75rem 1rem; color:#94a3b8; font-size:0.82rem; font-style:italic;">No cities registered in Admin yet. Please add cities from "All Cities" panel first.</div>`;
                return;
            }

            // Strict prefix match: ONLY cities whose name begins with the typed characters
            const matches = allCities.filter(cityName => cityName.toLowerCase().startsWith(val));

            if (matches.length === 0) {
                popover.style.display = 'block';
                popover.innerHTML = `<div style="padding:0.75rem 1rem; color:#94a3b8; font-size:0.82rem; font-style:italic;">No registered city starts with "${val}"</div>`;
                return;
            }

            popover.style.display = 'block';
            popover.innerHTML = matches.map(cityName => `
                <div class="admin-sugg-city-item" data-city="${cityName}">
                    <i class="fa-solid fa-location-dot"></i>
                    <span style="font-weight:600;">${cityName}</span>
                </div>
            `).join('');

            popover.querySelectorAll('.admin-sugg-city-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const chosenCity = item.getAttribute('data-city');
                    input.value = chosenCity;
                    popover.style.display = 'none';
                    popover.innerHTML = '';
                });
            });
        });

        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !popover.contains(e.target)) {
                popover.style.display = 'none';
            }
        });
    }

    function setupAdminCategorySuggest(inputId, popoverId) {
        const input = document.getElementById(inputId);
        const popover = document.getElementById(popoverId);
        if (!input || !popover) return;

        function getUniqueCategories() {
            let catMap = new Map();
            try {
                // Strictly load categories registered from Admin (DB_KEYS.CATEGORIES)
                const categoriesList = getDB(DB_KEYS.CATEGORIES, []);
                categoriesList.forEach(c => {
                    const name = typeof c === 'string' ? c : c?.name;
                    if (name && name.trim()) catMap.set(name.trim().toLowerCase(), name.trim());
                });

                // Also include any categories present in listings
                const listingsList = getDB(DB_KEYS.LISTINGS, []);
                listingsList.forEach(l => {
                    if (l && l.category && l.category.trim()) {
                        catMap.set(l.category.trim().toLowerCase(), l.category.trim());
                    }
                });
            } catch (err) {
                console.error('Error loading admin categories:', err);
            }

            return Array.from(catMap.values()).sort();
        }

        input.addEventListener('input', () => {
            const val = input.value.trim().toLowerCase();
            if (!val) {
                popover.style.display = 'none';
                popover.innerHTML = '';
                return;
            }

            const allCategories = getUniqueCategories();

            if (allCategories.length === 0) {
                popover.style.display = 'block';
                popover.innerHTML = `<div style="padding:0.75rem 1rem; color:#94a3b8; font-size:0.82rem; font-style:italic;">No categories registered in Admin yet.</div>`;
                return;
            }

            // Strict prefix match: ONLY categories whose name begins with the typed characters
            const matches = allCategories.filter(catName => catName.toLowerCase().startsWith(val));

            if (matches.length === 0) {
                popover.style.display = 'block';
                popover.innerHTML = `<div style="padding:0.75rem 1rem; color:#94a3b8; font-size:0.82rem; font-style:italic;">No registered category starts with "${val}"</div>`;
                return;
            }

            popover.style.display = 'block';
            popover.innerHTML = matches.map(catName => `
                <div class="admin-sugg-city-item" data-category="${catName}">
                    <i class="fa-solid fa-tags" style="color:#7c3aed;"></i>
                    <span style="font-weight:600;">${catName}</span>
                </div>
            `).join('');

            popover.querySelectorAll('.admin-sugg-city-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const chosenCat = item.getAttribute('data-category');
                    input.value = chosenCat;
                    popover.style.display = 'none';
                    popover.innerHTML = '';
                });
            });
        });

        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !popover.contains(e.target)) {
                popover.style.display = 'none';
            }
        });
    }

    setupAdminCitySuggest('textAdCityInput', 'textAdCitySuggestions');
    setupAdminCitySuggest('bannerAdCityInput', 'bannerAdCitySuggestions');
    setupAdminCitySuggest('prodAdCityInput', 'prodAdCitySuggestions');
    setupAdminCategorySuggest('textAdCategoryInput', 'textAdCategorySuggestions');
    setupAdminCategorySuggest('bannerAdCategoryInput', 'bannerAdCategorySuggestions');
    setupAdminCategorySuggest('prodAdCategoryInput', 'prodAdCategorySuggestions');
    setupAdminUserSuggest('mailToInput', 'mailToSuggestionsPopover');

    // ========================================================
    // 1. TEXT AD SYSTEM & PREVIEW CONTROLLER
    // ========================================================
    function setupTextColorPicker() {
        const swatches = document.querySelectorAll('.text-color-btn');
        const customColorInput = document.getElementById('textAdCustomColor');
        const hiddenColorInput = document.getElementById('textAdSelectedColor');
        const colorLabel = document.getElementById('selectedTextColorLabel');
        const previewText = document.getElementById('demoTextAdDesc');

        function applyColor(color) {
            if (hiddenColorInput) hiddenColorInput.value = color;
            if (customColorInput) customColorInput.value = color;
            if (colorLabel) {
                colorLabel.textContent = color;
                colorLabel.style.color = color;
            }
            if (previewText) {
                previewText.style.color = color;
            }
        }

        swatches.forEach(btn => {
            btn.addEventListener('click', () => {
                const color = btn.getAttribute('data-color');
                swatches.forEach(b => {
                    b.classList.remove('active');
                    b.style.boxShadow = '0 0 0 1px #cbd5e1';
                });
                btn.classList.add('active');
                btn.style.boxShadow = '0 0 0 2px #2563eb';
                applyColor(color);
            });
        });

        customColorInput?.addEventListener('input', (e) => {
            const color = e.target.value;
            swatches.forEach(b => {
                b.classList.remove('active');
                b.style.boxShadow = '0 0 0 1px #cbd5e1';
            });
            applyColor(color);
        });
    }

    setupTextColorPicker();

    function updateTextAdLivePreview() {
        const demoDesc = document.getElementById('demoTextAdDesc');
        const descVal = document.getElementById('textAdContentInput')?.value.trim() || 'Your announcement details will auto-scroll smoothly here from right to left...';
        const colorVal = document.getElementById('textAdSelectedColor')?.value || '#1e293b';
        if (demoDesc) {
            demoDesc.textContent = descVal;
            demoDesc.style.color = colorVal;
        }
    }

    document.getElementById('textAdContentInput')?.addEventListener('input', updateTextAdLivePreview);

    document.getElementById('textAdForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const content = document.getElementById('textAdContentInput')?.value.trim() || '';
        const targetOption = document.getElementById('textAdTargetPage')?.value || 'all';
        const targetCity = targetOption === 'city' ? (document.getElementById('textAdCityInput')?.value.trim() || '') : '';
        const targetCategory = targetOption === 'city' ? (document.getElementById('textAdCategoryInput')?.value.trim() || 'all') : 'all';
        const link = document.getElementById('textAdLink')?.value.trim() || '';
        const textColor = document.getElementById('textAdSelectedColor')?.value || '#1e293b';

        if (!content) {
            alert('Please enter your announcement or ad text.');
            return;
        }

        if (targetOption === 'city' && !targetCity) {
            alert('Please select or type a target city.');
            document.getElementById('textAdCityInput')?.focus();
            return;
        }

        const news = getDB(DB_KEYS.NEWS);
        news.unshift({
            id: 'AD-TXT-' + Date.now(),
            type: 'text',
            mode: 'text',
            title: '',
            content,
            textColor,
            targetPage: targetOption === 'city' ? 'explore' : targetOption,
            targetCity: targetCity || '',
            city: targetCity || '',
            targetCategory: targetCategory || 'all',
            category: targetCategory || 'all',
            placement: 'top-bar',
            bgTheme: 'transparent',
            link,
            active: true,
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        });
        setDB(DB_KEYS.NEWS, news);

        document.getElementById('createTextAdModal')?.classList.remove('active');
        document.getElementById('textAdForm')?.reset();
        
        // Reset color picker state
        if (document.getElementById('textAdSelectedColor')) document.getElementById('textAdSelectedColor').value = '#1e293b';
        if (document.getElementById('textAdCustomColor')) document.getElementById('textAdCustomColor').value = '#1e293b';
        if (document.getElementById('selectedTextColorLabel')) {
            document.getElementById('selectedTextColorLabel').textContent = '#1e293b';
            document.getElementById('selectedTextColorLabel').style.color = '#1e293b';
        }
        document.querySelectorAll('.text-color-btn').forEach((b, i) => {
            if (i === 0) {
                b.classList.add('active');
                b.style.boxShadow = '0 0 0 2px #2563eb';
            } else {
                b.classList.remove('active');
                b.style.boxShadow = '0 0 0 1px #cbd5e1';
            }
        });

        toggleAdCityTarget('all', 'textAdCityWrap', 'textAdCategoryWrap');
        updateTextAdLivePreview();
        refreshAll();
        const targetDesc = targetOption === 'city' 
            ? `${targetCity}${targetCategory && targetCategory !== 'all' ? ' (' + targetCategory + ')' : ''}`
            : targetOption.toUpperCase();
        alert(`Text Announcement published successfully for ${targetDesc}!`);
    });

    // ========================================================
    // 2. BANNER AD SYSTEM (ASPECT RATIOS & IMAGE COMPRESSION)
    // ========================================================
    window.selectBannerRatio = function(ratio) {
        const input = document.getElementById('selectedBannerRatio');
        if (input) input.value = ratio;

        document.querySelectorAll('.ratio-option-card').forEach(card => {
            if (card.getAttribute('data-ratio') === ratio) {
                card.classList.add('active');
            } else {
                card.classList.remove('active');
            }
        });

        const frameBox = document.getElementById('bannerFrameBox');
        if (frameBox) {
            frameBox.className = 'banner-frame';
            if (ratio === '16:9') frameBox.classList.add('ratio-16-9');
            else if (ratio === '1:1') frameBox.classList.add('ratio-1-1');
            else if (ratio === '9:16') frameBox.classList.add('ratio-9-16');
            else if (ratio === '4:1') frameBox.classList.add('ratio-4-1');
        }
    };

    const bannerFileTrigger = document.getElementById('bannerFileTrigger');
    const bannerFileInput = document.getElementById('bannerFileInput');
    const bannerPreviewWrapper = document.getElementById('bannerPreviewWrapper');
    const bannerImgElement = document.getElementById('bannerImgElement');
    const bannerImageCompressedData = document.getElementById('bannerImageCompressedData');

    if (bannerFileTrigger && bannerFileInput) {
        bannerFileTrigger.addEventListener('click', () => bannerFileInput.click());

        bannerFileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (file.size > 8 * 1024 * 1024) {
                alert('File size exceeds 8MB. Please select an image under 8MB.');
                bannerFileInput.value = '';
                return;
            }

            try {
                // Instant local canvas compression (~100-140 KB, 1280px) in 0.1s without third-party network timeout
                const compressed = await compressLocalBannerImage(file, 1280, 150);
                if (bannerImgElement) bannerImgElement.src = compressed;
                if (bannerImageCompressedData) bannerImageCompressedData.value = compressed;
                if (bannerPreviewWrapper) bannerPreviewWrapper.style.display = 'flex';
                if (bannerFileTrigger) bannerFileTrigger.style.display = 'none';
            } catch (err) {
                console.error('Banner compression error:', err);
                alert('Could not process this image. Please select another image.');
            }
        });
    }

    document.getElementById('bannerAdForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = document.getElementById('bannerAdTitleInput')?.value.trim() || '';
        const image = document.getElementById('bannerImageCompressedData')?.value || '';
        const ratio = document.getElementById('selectedBannerRatio')?.value || '16:9';
        const targetOption = document.getElementById('bannerAdTargetPage')?.value || 'all';
        const targetCity = targetOption === 'city' ? (document.getElementById('bannerAdCityInput')?.value.trim() || '') : '';
        const targetCategory = targetOption === 'city' ? (document.getElementById('bannerAdCategoryInput')?.value.trim() || 'all') : 'all';
        const link = document.getElementById('bannerAdLink')?.value.trim() || '';

        if (!title) {
            alert('Please enter a campaign title for this banner ad.');
            return;
        }

        if (!image) {
            alert('Please upload a banner creative graphic.');
            return;
        }

        if (targetOption === 'city' && !targetCity) {
            alert('Please select or type a target city.');
            document.getElementById('bannerAdCityInput')?.focus();
            return;
        }

        const news = getDB(DB_KEYS.NEWS);
        news.unshift({
            id: 'AD-BAN-' + Date.now(),
            type: 'banner',
            mode: 'image',
            title,
            image,
            aspectRatio: ratio,
            targetPage: targetOption,
            targetCity: targetCity || 'All Cities',
            city: targetCity || 'All Cities',
            targetCategory: targetCategory || 'all',
            category: targetCategory || 'all',
            placement: 'below-search',
            link,
            active: true,
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        });
        setDB(DB_KEYS.NEWS, news);

        document.getElementById('createBannerAdModal')?.classList.remove('active');
        document.getElementById('bannerAdForm')?.reset();
        toggleAdCityTarget('all', 'bannerAdCityWrap', 'bannerAdCategoryWrap');
        if (bannerPreviewWrapper) bannerPreviewWrapper.style.display = 'none';
        if (bannerFileTrigger) bannerFileTrigger.style.display = 'flex';
        if (bannerImageCompressedData) bannerImageCompressedData.value = '';
        selectBannerRatio('16:9');

        refreshAll();
        const targetDesc = targetOption === 'city' 
            ? `${targetCity}${targetCategory && targetCategory !== 'all' ? ' (' + targetCategory + ')' : ''}`
            : targetOption.toUpperCase();
        alert(`Banner Ad (${ratio}) published successfully for ${targetDesc}!`);
    });

    // ========================================================
    // 3. MULTI-PRODUCT PROMOTION SYSTEM (Catalog Linking & Multi-Selection)
    // ========================================================
    window.toggleProductAdTarget = function(val) {
        // Keeps targeting consistent with City & Category filters
    };

    let multiCatalogProducts = [];

    function setupProductAdListingSuggest() {
        const listingInput = document.getElementById('prodAdListingInput');
        const listingSuggestions = document.getElementById('prodAdListingSuggestions');
        const listingIdInput = document.getElementById('prodAdListingId');
        const listingNameInput = document.getElementById('prodAdListingName');
        const storeNotice = document.getElementById('prodAdSelectedStoreNotice');
        const storeText = document.getElementById('prodAdSelectedStoreText');
        const cityInput = document.getElementById('prodAdCityInput');
        const categoryInput = document.getElementById('prodAdCategoryInput');
        const catalogListContainer = document.getElementById('prodAdCatalogItemsList');
        const selectedCountSpan = document.getElementById('prodAdSelectedCount');
        const btnSubmitText = document.getElementById('btnSubmitProductAdText');
        const btnSelectAll = document.getElementById('btnSelectAllProds');
        const btnDeselectAll = document.getElementById('btnDeselectAllProds');

        if (!listingInput || !listingSuggestions) return;

        function updateSelectedCountDisplay() {
            const count = multiCatalogProducts.filter(p => p.selected).length;
            if (selectedCountSpan) selectedCountSpan.textContent = count;
            if (btnSubmitText) btnSubmitText.textContent = `Publish Selected Products (${count})`;
        }

        window.renderCatalogItemsList = function() {
            if (!catalogListContainer) return;

            if (multiCatalogProducts.length === 0) {
                catalogListContainer.innerHTML = `
                    <div id="prodAdEmptyNotice" style="text-align:center; padding:1.5rem 1rem; color:#94a3b8; font-size:0.85rem; font-style:italic;">
                        <i class="fa-solid fa-store" style="font-size:1.5rem; display:block; margin-bottom:0.35rem; color:#cbd5e1;"></i>
                        No products found in this store's catalog. You can add custom products using the section below.
                    </div>
                `;
                updateSelectedCountDisplay();
                return;
            }

            catalogListContainer.innerHTML = multiCatalogProducts.map((p, idx) => {
                const isChecked = p.selected ? 'checked' : '';
                const bgStyle = p.selected ? 'background:#ecfdf5; border-color:#10b981;' : 'background:#ffffff; border-color:#e2e8f0;';
                const imgSrc = p.image || 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=120';
                const priceFormatted = p.price ? String(p.price).trim() : '₹0';

                return `
                    <div class="prod-select-row" data-idx="${idx}" style="display:flex; align-items:center; gap:0.75rem; padding:0.6rem 0.75rem; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:0.45rem; cursor:pointer; transition:all 0.15s ease; ${bgStyle}">
                        <input type="checkbox" class="prod-ad-chk" data-chk-idx="${idx}" ${isChecked} style="width:18px; height:18px; accent-color:#059669; cursor:pointer;">
                        <img src="${imgSrc}" alt="${p.name}" style="width:46px; height:46px; object-fit:cover; border-radius:6px; border:1px solid #cbd5e1; flex-shrink:0;">
                        <div style="flex:1; min-width:0;">
                            <div style="font-weight:700; font-size:0.88rem; color:#1e293b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.name}</div>
                            <div style="font-size:0.82rem; font-weight:700; color:#059669; margin-top:2px;">${priceFormatted}</div>
                        </div>
                        ${p.isCustom ? `
                            <button type="button" class="btn-remove-custom-prod" data-del-idx="${idx}" style="background:none; border:none; color:#ef4444; font-size:0.85rem; cursor:pointer; padding:0.3rem;" title="Remove this custom product">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        ` : ''}
                    </div>
                `;
            }).join('');

            // Bind toggle on row click & checkbox
            catalogListContainer.querySelectorAll('.prod-select-row').forEach(row => {
                row.addEventListener('click', (e) => {
                    if (e.target.closest('.btn-remove-custom-prod')) return;
                    const idx = parseInt(row.getAttribute('data-idx'), 10);
                    if (!isNaN(idx) && multiCatalogProducts[idx]) {
                        multiCatalogProducts[idx].selected = !multiCatalogProducts[idx].selected;
                        renderCatalogItemsList();
                    }
                });
            });

            // Bind remove custom product
            catalogListContainer.querySelectorAll('.btn-remove-custom-prod').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const delIdx = parseInt(btn.getAttribute('data-del-idx'), 10);
                    if (!isNaN(delIdx)) {
                        multiCatalogProducts.splice(delIdx, 1);
                        renderCatalogItemsList();
                    }
                });
            });

            updateSelectedCountDisplay();
        };

        btnSelectAll?.addEventListener('click', () => {
            multiCatalogProducts.forEach(p => p.selected = true);
            renderCatalogItemsList();
        });

        btnDeselectAll?.addEventListener('click', () => {
            multiCatalogProducts.forEach(p => p.selected = false);
            renderCatalogItemsList();
        });

        function renderListingMatches(query = '') {
            const listings = getDB(DB_KEYS.LISTINGS) || [];
            if (listings.length === 0) {
                listingSuggestions.style.display = 'block';
                listingSuggestions.innerHTML = `<div style="padding:0.75rem 1rem; color:#94a3b8; font-size:0.82rem; font-style:italic;">No registered listings in database yet.</div>`;
                return;
            }

            const q = query.trim().toLowerCase();
            const filterCity = cityInput ? cityInput.value.trim().toLowerCase() : '';
            const filterCat = categoryInput ? categoryInput.value.trim().toLowerCase() : '';

            let filtered = listings.filter(l => {
                const name = (l.title || l.name || '').toLowerCase();
                const city = (l.city || '').toLowerCase();
                const cat = (l.category || '').toLowerCase();

                if (filterCity && filterCity !== 'all' && city && !city.includes(filterCity)) {
                    return false;
                }
                if (filterCat && filterCat !== 'all' && cat && !cat.includes(filterCat)) {
                    return false;
                }

                if (!q) return true;
                return name.includes(q);
            });

            if (filtered.length === 0 && q) {
                filtered = listings.filter(l => (l.title || l.name || '').toLowerCase().includes(q));
            }

            if (filtered.length === 0) {
                listingSuggestions.style.display = 'block';
                listingSuggestions.innerHTML = `<div style="padding:0.75rem 1rem; color:#94a3b8; font-size:0.82rem; font-style:italic;">No listings found matching "${query}"</div>`;
                return;
            }

            listingSuggestions.style.display = 'block';
            listingSuggestions.innerHTML = filtered.slice(0, 15).map(l => {
                const lName = l.title || l.name || 'Untitled Store';
                const lCity = l.city || 'Any City';
                const lCat = l.category || 'General';
                const prodCount = (Array.isArray(l.products) && l.products.length) ? `${l.products.length} products` : '0 products';

                return `
                    <div class="admin-sugg-city-item" data-id="${l.id}" style="display:flex; justify-content:space-between; align-items:center; padding:0.6rem 0.85rem; border-bottom:1px solid #f1f5f9; cursor:pointer;">
                        <div>
                            <div style="font-weight:700; color:#1e293b; font-size:0.88rem;"><i class="fa-solid fa-store" style="color:#d97706; margin-right:5px;"></i>${lName}</div>
                            <div style="font-size:0.75rem; color:#64748b; margin-top:2px;">
                                <span><i class="fa-solid fa-location-dot" style="color:#ef4444; font-size:0.7rem;"></i> ${lCity}</span> • 
                                <span><i class="fa-solid fa-tags" style="color:#7c3aed; font-size:0.7rem;"></i> ${lCat}</span>
                            </div>
                        </div>
                        <span style="font-size:0.72rem; padding:0.2rem 0.5rem; background:#f1f5f9; border-radius:12px; font-weight:600; color:#475569;">${prodCount}</span>
                    </div>
                `;
            }).join('');

            listingSuggestions.querySelectorAll('.admin-sugg-city-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const chosenId = item.getAttribute('data-id');
                    const listing = listings.find(l => String(l.id) === String(chosenId));
                    if (!listing) return;

                    const lName = listing.title || listing.name || 'Untitled Store';
                    if (listingIdInput) listingIdInput.value = listing.id;
                    if (listingNameInput) listingNameInput.value = lName;
                    if (listingInput) listingInput.value = lName;

                    // Auto-fill City & Category if blank or all
                    if (cityInput && (!cityInput.value.trim() || cityInput.value.trim().toLowerCase() === 'all')) {
                        if (listing.city) cityInput.value = listing.city;
                    }
                    if (categoryInput && (!categoryInput.value.trim() || categoryInput.value.trim().toLowerCase() === 'all')) {
                        if (listing.category) categoryInput.value = listing.category;
                    }

                    // Store notice badge
                    if (storeNotice && storeText) {
                        storeNotice.style.display = 'block';
                        storeText.textContent = `Store "${lName}" selected (${listing.city || 'Any City'})`;
                    }

                    // Populate Multi Products from Store Catalog
                    const prods = Array.isArray(listing.products) ? listing.products : [];
                    multiCatalogProducts = prods.map(p => ({
                        name: p.name || p.title || 'Store Product',
                        price: p.price || '',
                        image: (Array.isArray(p.images) && p.images[0]) || p.image || '',
                        category: p.category || listing.category || '',
                        selected: true,
                        isCustom: false
                    }));

                    renderCatalogItemsList();

                    listingSuggestions.style.display = 'none';
                    listingSuggestions.innerHTML = '';
                });
            });
        }

        listingInput.addEventListener('focus', () => {
            renderListingMatches(listingInput.value);
        });

        listingInput.addEventListener('input', () => {
            renderListingMatches(listingInput.value);
        });

        document.addEventListener('click', (e) => {
            if (!listingInput.contains(e.target) && !listingSuggestions.contains(e.target)) {
                listingSuggestions.style.display = 'none';
            }
        });
    }

    setupProductAdListingSuggest();

    // Custom Product Addition Handler (When adding products not in catalog)
    const customProdFile = document.getElementById('customProdImageFile');
    const customProdData = document.getElementById('customProdImageData');
    const customProdThumb = document.getElementById('customProdImageThumb');
    const customProdLabel = document.getElementById('customProdImageLabel');
    const btnAddCustom = document.getElementById('btnAddCustomProdToList');

    if (customProdFile) {
        customProdFile.addEventListener('change', async function() {
            const file = this.files[0];
            if (!file) return;

            try {
                const compressed = await window.compressImage(file, 140, 800);
                if (customProdData) customProdData.value = compressed;
                if (customProdThumb) {
                    customProdThumb.src = compressed;
                    customProdThumb.style.display = 'block';
                }
                if (customProdLabel) customProdLabel.textContent = file.name;
            } catch (err) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const dataUrl = e.target.result;
                    if (customProdData) customProdData.value = dataUrl;
                    if (customProdThumb) {
                        customProdThumb.src = dataUrl;
                        customProdThumb.style.display = 'block';
                    }
                    if (customProdLabel) customProdLabel.textContent = file.name;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (btnAddCustom) {
        btnAddCustom.addEventListener('click', () => {
            const titleInput = document.getElementById('customProdTitle');
            const priceInput = document.getElementById('customProdPrice');
            const title = titleInput?.value.trim();
            const price = priceInput?.value.trim();
            const img = customProdData?.value || '';

            if (!title) {
                alert('Please enter a product name for the custom product.');
                titleInput?.focus();
                return;
            }

            if (!price) {
                alert('Please enter a price / offer (e.g. ₹499).');
                priceInput?.focus();
                return;
            }

            if (!img) {
                alert('Please choose a square product photo.');
                return;
            }

            multiCatalogProducts.push({
                name: title,
                price: price,
                image: img,
                selected: true,
                isCustom: true
            });

            // Reset custom product fields
            if (titleInput) titleInput.value = '';
            if (priceInput) priceInput.value = '';
            if (customProdFile) customProdFile.value = '';
            if (customProdData) customProdData.value = '';
            if (customProdThumb) {
                customProdThumb.src = '';
                customProdThumb.style.display = 'none';
            }
            if (customProdLabel) customProdLabel.textContent = 'No image chosen';

            if (typeof window.renderCatalogItemsList === 'function') {
                window.renderCatalogItemsList();
            }
        });
    }

    // Submit Multi-Product Ads Handler
    const productAdForm = document.getElementById('productAdForm');
    productAdForm?.addEventListener('submit', (e) => {
        e.preventDefault();

        const selectedProducts = multiCatalogProducts.filter(p => p.selected && (p.image || p.name));
        if (selectedProducts.length === 0) {
            alert('Please select at least 1 product from the list to publish.');
            return;
        }

        const targetPage = document.getElementById('prodAdTargetPage')?.value || 'home';
        const city = document.getElementById('prodAdCityInput')?.value.trim() || 'all';
        const category = document.getElementById('prodAdCategoryInput')?.value.trim() || 'all';
        const listingId = document.getElementById('prodAdListingId')?.value.trim() || '';
        const listingName = document.getElementById('prodAdListingName')?.value.trim() || document.getElementById('prodAdListingInput')?.value.trim() || 'Verified Store';

        if (!listingName) {
            alert('Please select a listing or store.');
            return;
        }

        let news = getDB(DB_KEYS.NEWS) || [];
        const nowTime = Date.now();
        const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

        selectedProducts.forEach((prod, index) => {
            const pName = prod.name || 'Featured Product';
            const pPrice = prod.price || '';
            const pImg = prod.image || 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=300';
            const actionLink = listingId 
                ? `listing-detail.html?id=${encodeURIComponent(listingId)}&product=${encodeURIComponent(pName)}&price=${encodeURIComponent(pPrice)}`
                : '#';

            const newProductAd = {
                id: 'PRD-' + nowTime + '-' + index,
                type: 'product',
                mode: 'product',
                title: pName,
                price: pPrice,
                image: pImg,
                listingId: listingId,
                listingName: listingName,
                targetPage: targetPage,
                city: city,
                category: prod.category || category,
                link: actionLink,
                active: true,
                date: dateStr,
                timestamp: nowTime + index
            };

            news.unshift(newProductAd);
        });

        setDB(DB_KEYS.NEWS, news);

        // Reset and close modal
        document.getElementById('createProductAdModal')?.classList.remove('active');
        productAdForm.reset();
        multiCatalogProducts = [];
        if (typeof window.renderCatalogItemsList === 'function') {
            window.renderCatalogItemsList();
        }
        const storeNotice = document.getElementById('prodAdSelectedStoreNotice');
        if (storeNotice) storeNotice.style.display = 'none';

        refreshAll();
        alert(`Successfully published ${selectedProducts.length} product promotion(s) for "${listingName}"!`);
    });

    // ================= LISTING EMPTY BANNERS (DEFAULT 16:9 FALLBACK SLIDES) =================
    let currentDefBanners = ['', '', '', ''];

    window.openDefaultListingBannersModal = function() {
        let saved = [];
        try {
            const raw = localStorage.getItem('lb_default_banners');
            saved = raw ? JSON.parse(raw) : [];
        } catch (e) {
            saved = [];
        }

        currentDefBanners = ['', '', '', ''];
        for (let i = 0; i < 4; i++) {
            if (saved[i]) {
                currentDefBanners[i] = typeof saved[i] === 'string' ? saved[i] : (saved[i].image || '');
            }
            renderDefBannerSlotPreview(i);
        }

        openModal('defaultListingBannersModal');
    };

    function renderDefBannerSlotPreview(slotIndex) {
        const imgEl = document.getElementById(`defBannerImg${slotIndex}`);
        const placeholderEl = document.getElementById(`defBannerPlaceholder${slotIndex}`);
        const val = currentDefBanners[slotIndex];

        if (val) {
            if (imgEl) {
                imgEl.src = val;
                imgEl.style.display = 'block';
            }
            if (placeholderEl) placeholderEl.style.display = 'none';
        } else {
            if (imgEl) {
                imgEl.src = '';
                imgEl.style.display = 'none';
            }
            if (placeholderEl) {
                placeholderEl.style.display = 'block';
                placeholderEl.innerHTML = `<i class="fa-solid fa-cloud-arrow-up" style="font-size:1.8rem; display:block; margin-bottom:0.35rem; color:#cbd5e1;"></i> Click to Upload Slide ${slotIndex + 1} Image`;
            }
        }
    }

    // Ultra-Fast Local Canvas Banner Processor (0.1s instant, high clarity, WebP/JPEG, ~60-90KB)
    function compressLocalBannerImage(file, maxDimension = 1280, maxKB = 140) {
        return new Promise((resolve, reject) => {
            if (!file || !file.type || !file.type.startsWith('image/')) {
                return reject(new Error('Invalid image file'));
            }
            const reader = new FileReader();
            reader.onerror = reject;
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
                    while (currentKB > maxKB && quality > 0.45) {
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

    window.handleDefBannerUpload = async function(slotIndex, input) {
        const file = input?.files?.[0];
        if (!file) return;

        const placeholder = document.getElementById(`defBannerPlaceholder${slotIndex}`);
        if (placeholder) {
            placeholder.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="font-size:1.6rem; color:#d97706; display:block; margin-bottom:0.35rem;"></i> Processing...`;
        }

        try {
            // Instant local canvas compression (~60-90 KB, 1280px) in 0.1s without waiting for network
            const uploadedUrl = await compressLocalBannerImage(file, 1280, 140);
            currentDefBanners[slotIndex] = uploadedUrl;
            renderDefBannerSlotPreview(slotIndex);
        } catch (err) {
            console.error('Default banner upload error:', err);
            alert('Failed to process image. Please try another image file.');
            renderDefBannerSlotPreview(slotIndex);
        } finally {
            input.value = '';
        }
    };

    window.clearDefBannerSlot = function(slotIndex) {
        currentDefBanners[slotIndex] = '';
        renderDefBannerSlotPreview(slotIndex);
    };

    window.clearDefBannerAndSave = function(slotIndex) {
        let saved = [];
        try {
            const raw = localStorage.getItem('lb_default_banners');
            saved = raw ? JSON.parse(raw) : [];
        } catch { saved = []; }

        if (saved[slotIndex]) {
            saved[slotIndex] = '';
            const active = saved.filter(Boolean);
            localStorage.setItem('lb_default_banners', JSON.stringify(active));
            if (window.lbCloudSync && typeof window.lbCloudSync.saveDefaultBanners === 'function') {
                window.lbCloudSync.saveDefaultBanners(active).catch(() => {});
            }
            renderNews();
        }
    };

    document.getElementById('defaultListingBannersForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const activeBanners = currentDefBanners.filter(Boolean);
        localStorage.setItem('lb_default_banners', JSON.stringify(activeBanners));

        // Close modal immediately and refresh admin views without UI lag
        document.getElementById('defaultListingBannersModal')?.classList.remove('active');
        renderNews();

        // Non-blocking async background cloud sync
        if (window.lbCloudSync && typeof window.lbCloudSync.saveDefaultBanners === 'function') {
            window.lbCloudSync.saveDefaultBanners(activeBanners).catch(err => {
                console.warn('Background sync default banners notice:', err);
            });
        }

        alert(`Successfully saved ${activeBanners.length} default listing fallback banner(s)! These will appear on listings that have not uploaded their own banners.`);
    });

    window.toggleNewsActive = function(id) {
        let news = getDB(DB_KEYS.NEWS);
        const item = news.find(n => n.id === id);
        if (!item) return;
        item.active = item.active === false ? true : false;
        setDB(DB_KEYS.NEWS, news);
        refreshAll();
    };

    // Global Search Bar across panels
    document.getElementById('adminGlobalSearch')?.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const activePanel = document.querySelector('.admin-view-panel.active');
        if (!activePanel) return;

        const items = activePanel.querySelectorAll('tbody tr, .meta-box-card, .news-card-item, .mail-item');
        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(query) ? '' : 'none';
        });
    });

    // Initial render
    refreshAll();

    // Professional Tab Persistence: Resolve view name cleanly from hash or storage
    function resolveViewId(hashOrId) {
        if (!hashOrId) return '';
        const clean = hashOrId.replace('#', '').trim();
        const viewMap = {
            'dashboard': 'dashboardView',
            'dashboardView': 'dashboardView',
            'users': 'usersView',
            'usersView': 'usersView',
            'listings': 'listingsView',
            'listingsView': 'listingsView',
            'claims': 'claimsView',
            'claimsView': 'claimsView',
            'trust': 'trustBadgeView',
            'trustBadgeView': 'trustBadgeView',
            'cities': 'citiesView',
            'citiesView': 'citiesView',
            'categories': 'categoriesView',
            'categoriesView': 'categoriesView',
            'mailbox': 'mailboxView',
            'mailboxView': 'mailboxView',
            'news': 'newsView',
            'newsView': 'newsView',
            'settings': 'settingsView',
            'settingsView': 'settingsView',
            'add-listing': 'createListingView',
            'createListingView': 'createListingView'
        };
        const resolved = viewMap[clean] || clean;
        const el = document.getElementById(resolved);
        return (el && el.classList.contains('admin-view-panel')) ? resolved : '';
    }

    const initialView = resolveViewId(window.location.hash) || resolveViewId(sessionStorage.getItem('admin_active_view')) || 'dashboardView';
    switchView(initialView, false);

    window.addEventListener('hashchange', () => {
        const resolved = resolveViewId(window.location.hash);
        if (resolved) {
            switchView(resolved, false);
        }
    });
});

// ================= UNIVERSAL ADMIN SECURITY VERIFICATION CONTROLLER (CONFIRM TO PROCEED) =================
window.adminSecurityConfirm = function({ title = 'Confirm Action', message = 'Are you sure you want to proceed?', actionType = 'delete' } = {}) {
    return new Promise((resolve) => {
        const modal = document.getElementById('adminSecurityModal');
        if (!modal) {
            const cleanMsg = (message || '').replace(/<[^>]*>/g, '');
            const val = window.prompt(`${title}\n\n${cleanMsg}\n\nPlease type CONFIRM in capital letters to verify:`);
            return resolve(val && val.trim() === 'CONFIRM');
        }

        const titleEl = document.getElementById('adminSecurityTitle');
        const msgEl = document.getElementById('adminSecurityMessage');
        const badge = document.getElementById('adminSecurityBadge');
        const icon = document.getElementById('adminSecurityIcon');
        const input = document.getElementById('adminSecurityInput');
        const errorEl = document.getElementById('adminSecurityInputError');
        const confirmBtn = document.getElementById('adminSecurityConfirmBtn');
        const cancelBtn = document.getElementById('adminSecurityCancelBtn');

        if (titleEl) titleEl.textContent = title;
        if (msgEl) msgEl.innerHTML = message;
        if (input) input.value = '';
        if (errorEl) errorEl.style.display = 'none';

        if (actionType === 'delete') {
            if (badge) { badge.style.background = '#fee2e2'; badge.style.color = '#ef4444'; }
            if (icon) icon.className = 'fa-solid fa-trash-can';
            if (confirmBtn) {
                confirmBtn.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
                confirmBtn.style.boxShadow = '0 4px 12px rgba(239,68,68,0.3)';
                confirmBtn.innerHTML = '<i class="fa-solid fa-trash-can" style="margin-right:6px;"></i> Yes, Delete';
            }
        } else {
            if (badge) { badge.style.background = '#eff6ff'; badge.style.color = '#2563eb'; }
            if (icon) icon.className = 'fa-solid fa-pen-to-square';
            if (confirmBtn) {
                confirmBtn.style.background = 'linear-gradient(135deg, #2563eb, #1d4ed8)';
                confirmBtn.style.boxShadow = '0 4px 12px rgba(37,99,235,0.3)';
                confirmBtn.innerHTML = '<i class="fa-solid fa-check" style="margin-right:6px;"></i> Yes, Save Changes';
            }
        }

        function getTyped() {
            return (input && input.value ? input.value : '')
                .trim()
                .toUpperCase()
                .replace(/[^A-Z]/g, '');
        }

        if (confirmBtn) {
            confirmBtn.style.opacity = '0.7';
            confirmBtn.style.pointerEvents = 'auto';
        }
        if (input) input.style.borderColor = '#cbd5e1';

        function validateInput() {
            if (!input || !confirmBtn) return;
            if (getTyped() === 'CONFIRM') {
                confirmBtn.style.opacity = '1';
                input.style.borderColor = '#16a34a';
                if (errorEl) errorEl.style.display = 'none';
            } else {
                confirmBtn.style.opacity = '0.7';
                input.style.borderColor = '#cbd5e1';
            }
        }

        function cleanup() {
            modal.style.display = 'none';
            modal.classList.remove('active');
            if (input) {
                input.oninput = null;
                input.onkeydown = null;
            }
            if (confirmBtn) confirmBtn.onclick = null;
            if (cancelBtn) cancelBtn.onclick = null;
            modal.onclick = null;
        }

        if (input) {
            input.oninput = () => {
                validateInput();
            };
            input.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (getTyped() === 'CONFIRM') {
                        cleanup();
                        resolve(true);
                    } else if (errorEl) {
                        errorEl.style.display = 'block';
                    }
                }
            };
        }

        if (confirmBtn) {
            confirmBtn.onclick = () => {
                if (getTyped() === 'CONFIRM') {
                    cleanup();
                    resolve(true);
                } else if (errorEl) {
                    errorEl.style.display = 'block';
                    if (input) input.focus();
                }
            };
        }

        if (cancelBtn) {
            cancelBtn.onclick = () => {
                cleanup();
                resolve(false);
            };
        }

        modal.onclick = (e) => {
            if (e.target === modal) {
                cleanup();
                resolve(false);
            }
        };

        modal.style.display = 'flex';
        modal.classList.add('active');
        setTimeout(() => input?.focus(), 100);
    });
};

// Global Window Actions (Approve, Reject, Delete)
window.approveListing = async function(id) {
    const listings = getDB(DB_KEYS.LISTINGS);
    const item = listings.find(l => String(l.id) === String(id));
    if (!item) return;

    const ok = await window.adminSecurityConfirm({
        title: 'Approve & Publish Listing',
        message: `Are you sure you want to approve <strong>"${item.name}"</strong> and publish it live on the platform?`,
        actionType: 'edit'
    });
    if (!ok) return;

    item.status = 'Verified';
    setDB(DB_KEYS.LISTINGS, listings);
    if (window.lbCloudSync && typeof window.lbCloudSync.saveListing === 'function') {
        await window.lbCloudSync.saveListing(item);
    }
    if (typeof window.refreshAll === 'function') window.refreshAll();
    alert(`Listing "${item.name}" has been Approved and is now Live to the public!`);
};

window.rejectListing = async function(id) {
    const listings = getDB(DB_KEYS.LISTINGS);
    const item = listings.find(l => String(l.id) === String(id));
    if (!item) return;

    const ok = await window.adminSecurityConfirm({
        title: 'Reject Listing Application',
        message: `Are you sure you want to reject <strong>"${item.name}"</strong>?`,
        actionType: 'delete'
    });
    if (!ok) return;

    item.status = 'Rejected';
    setDB(DB_KEYS.LISTINGS, listings);
    if (window.lbCloudSync && typeof window.lbCloudSync.saveListing === 'function') {
        await window.lbCloudSync.saveListing(item);
    }
    if (typeof window.refreshAll === 'function') window.refreshAll();
    alert(`Listing "${item.name}" has been marked as Rejected.`);
};

window.deleteListing = async function(id) {
    let listings = getDB(DB_KEYS.LISTINGS);
    const item = listings.find(l => String(l.id) === String(id));
    const title = item ? item.name : `Listing #${id}`;

    const ok = await window.adminSecurityConfirm({
        title: 'Delete Business Listing',
        message: `Are you sure you want to permanently delete <strong>"${title}"</strong>? This action cannot be undone.`,
        actionType: 'delete'
    });
    if (!ok) return;

    listings = listings.filter(l => String(l.id) !== String(id));
    setDB(DB_KEYS.LISTINGS, listings);
    if (window.lbCloudSync && typeof window.lbCloudSync.deleteListing === 'function') {
        window.lbCloudSync.deleteListing(id);
    }
    if (typeof window.refreshAll === 'function') window.refreshAll();
};

window.populateAdminListingOwnerDropdown = function() {
    const ownerSelect = document.getElementById('fullListingOwner');
    if (!ownerSelect) return;
    const users = getDB(DB_KEYS.USERS);
    const currentVal = ownerSelect.value;
    ownerSelect.innerHTML = '<option value="">-- No Owner (Platform Managed / Open for Claim) --</option>' +
        users.map(u => `<option value="${u.id}">${u.name} (${u.email || u.phone || u.id})</option>`).join('');
    if (currentVal) ownerSelect.value = currentVal;
};

window.openAdminReassignOwnerModal = function(listingId) {
    // Deprecated & removed per Admin UI cleanup
};

window.deleteUser = async function(id) {
    let users = getDB(DB_KEYS.USERS);
    const user = users.find(u => String(u.id) === String(id));
    const userName = user ? (user.name || user.email) : `User #${id}`;

    const ok = await window.adminSecurityConfirm({
        title: 'Delete User Account',
        message: `Are you sure you want to permanently delete user <strong>"${userName}"</strong>? This action cannot be undone.`,
        actionType: 'delete'
    });
    if (!ok) return;

    users = users.filter(u => String(u.id) !== String(id));
    setDB(DB_KEYS.USERS, users);
    if (window.lbCloudSync && typeof window.lbCloudSync.deleteUser === 'function') {
        window.lbCloudSync.deleteUser(id);
    }
    refreshAll();
};

window.openViewUserDetailsModal = function(id) {
    const users = getDB(DB_KEYS.USERS, []);
    const user = users.find(u => String(u.id) === String(id));
    if (!user) {
        alert('User profile not found.');
        return;
    }

    // 1. Hero Info
    const avatarSlot = document.getElementById('viewUserAvatarSlot');
    const nameEl = document.getElementById('viewUserNameDisplay');
    const rolePill = document.getElementById('viewUserRolePill');
    const idChip = document.getElementById('viewUserIdChip');
    const methodBadge = document.getElementById('viewUserMethodBadge');

    const initial = user.name ? user.name.charAt(0).toUpperCase() : 'U';
    if (avatarSlot) {
        if (user.avatar || user.picture) {
            avatarSlot.innerHTML = `<img src="${user.avatar || user.picture}" alt="${escapeAdminHtml(user.name || '')}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
        } else {
            avatarSlot.textContent = initial;
        }
    }

    if (nameEl) nameEl.textContent = user.name || 'Anonymous User';
    if (rolePill) {
        const role = user.role || 'Member';
        rolePill.textContent = role;
        rolePill.className = 'user-role-pill ' + (role.toLowerCase().includes('merchant') ? 'merchant' : (role.toLowerCase().includes('admin') ? 'admin' : 'member'));
    }
    if (idChip) idChip.textContent = '#' + user.id;
    if (methodBadge) {
        const m = user.method || 'Google';
        methodBadge.innerHTML = `<i class="fa-brands fa-google"></i> ${m} Verified`;
    }

    // 2. Personal & Contact
    const emailEl = document.getElementById('viewUserEmail');
    const phoneEl = document.getElementById('viewUserPhone');
    const genderEl = document.getElementById('viewUserGender');
    const dobEl = document.getElementById('viewUserDOB');

    if (emailEl) emailEl.textContent = user.email || 'No email registered';
    if (phoneEl) phoneEl.textContent = user.phone || 'Not provided';
    if (genderEl) genderEl.textContent = user.gender || 'Not specified';
    if (dobEl) dobEl.textContent = user.dob || 'Not provided';

    // 3. Location & Membership
    const cityEl = document.getElementById('viewUserCity');
    const stateEl = document.getElementById('viewUserState');
    const pinEl = document.getElementById('viewUserPincode');
    const memberEl = document.getElementById('viewUserMemberSince');

    if (cityEl) cityEl.textContent = user.city || 'Not specified';
    if (stateEl) stateEl.textContent = user.state || 'Not specified';
    if (pinEl) pinEl.textContent = user.pincode || 'Not specified';
    if (memberEl) memberEl.textContent = user.memberSince || user.date || 'Oct 2026';

    // 4. Platform Activity: Stores & Badges
    const listings = getDB(DB_KEYS.LISTINGS, []);
    const userStores = listings.filter(l => 
        (user.id && String(l.ownerId) === String(user.id)) ||
        (user.email && l.ownerId && l.ownerId.toLowerCase() === user.email.toLowerCase())
    );

    const listCountEl = document.getElementById('viewUserListingsCount');
    const badgeCountEl = document.getElementById('viewUserTrustBadgeCount');
    const storesContainer = document.getElementById('viewUserStoresContainer');

    if (listCountEl) listCountEl.textContent = userStores.length;
    
    // Count verified trust badges
    const trustBadgesCount = userStores.filter(l => l.isTrustBadge || l.trustBadge || l.verifiedBadge || l.claimed).length;
    if (badgeCountEl) badgeCountEl.textContent = trustBadgesCount;

    if (storesContainer) {
        if (userStores.length === 0) {
            storesContainer.innerHTML = `
                <div style="font-size:0.8rem; color:#94a3b8; font-style:italic; padding:0.5rem 0.25rem;">
                    <i class="fa-solid fa-store-slash" style="margin-right:5px; color:#cbd5e1;"></i> This user has not registered or claimed any store listings yet.
                </div>
            `;
        } else {
            storesContainer.innerHTML = userStores.map(store => `
                <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:0.5rem 0.75rem;">
                    <div>
                        <strong style="font-size:0.85rem; color:#0f172a;"><i class="fa-solid fa-store" style="color:#d97706; margin-right:4px;"></i> ${escapeAdminHtml(store.name || 'Store')}</strong>
                        <span style="font-size:0.75rem; color:#64748b; margin-left:8px;">${escapeAdminHtml(store.city || '')} • ${escapeAdminHtml(store.category || '')}</span>
                    </div>
                    <span style="font-size:0.72rem; padding:2px 8px; border-radius:12px; font-weight:700; ${store.status === 'Verified' ? 'background:#dcfce7; color:#15803d;' : 'background:#fef3c7; color:#92400e;'}">
                        ${store.status || 'Active'}
                    </span>
                </div>
            `).join('');
        }
    }

    // Direct Mail button inside modal
    const directMailBtn = document.getElementById('viewUserDirectMailBtn');
    if (directMailBtn) {
        directMailBtn.onclick = () => {
            const modal = document.getElementById('viewUserDetailsModal');
            if (modal) modal.classList.remove('active');
            window.openComposeMailForUser(user.id);
        };
    }

    window.openModal('viewUserDetailsModal');
};

window.openComposeMailForUser = function(id) {
    const users = getDB(DB_KEYS.USERS, []);
    const user = users.find(u => String(u.id) === String(id));
    const toInput = document.getElementById('mailToInput');
    if (toInput) {
        toInput.value = user ? user.id : id;
    }
    window.openModal('composeMailModal');
    document.getElementById('mailSubjectInput')?.focus();
};

window.openEditCityModal = function(encodedName) {
    const name = decodeURIComponent(encodedName);
    const cities = getDB(DB_KEYS.CITIES);
    const city = cities.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (!city) {
        alert('City not found.');
        return;
    }

    const origInput = document.getElementById('editCityOriginalName');
    const nameInput = document.getElementById('editCityNameInput');
    const distInput = document.getElementById('editCityDistrictInput');
    const stateInput = document.getElementById('editCityStateInput');
    const pinInput = document.getElementById('editCityPincodeInput');

    if (origInput) origInput.value = encodedName;
    if (nameInput) nameInput.value = city.name || '';
    if (distInput) distInput.value = city.district || '';
    if (stateInput) stateInput.value = city.state || '';
    if (pinInput) pinInput.value = city.pincode || '';

    const modal = document.getElementById('editCityModal');
    if (modal) {
        modal.classList.add('active');
    }
};

window.deleteCity = async function(encodedName) {
    const name = decodeURIComponent(encodedName);
    const ok = await window.adminSecurityConfirm({
        title: 'Delete City',
        message: `Are you sure you want to remove city <strong>"${name}"</strong> from LocalBazar coverage?`,
        actionType: 'delete'
    });
    if (!ok) return;

    let cities = getDB(DB_KEYS.CITIES);
    cities = cities.filter(c => (c.name || c).toLowerCase() !== name.toLowerCase());
    setDB(DB_KEYS.CITIES, cities);
    if (window.lbCloudSync && typeof window.lbCloudSync.deleteCity === 'function') {
        window.lbCloudSync.deleteCity(name);
    }
    if (typeof window.refreshAll === 'function') window.refreshAll();
};

window.clearAllCitiesPrompt = async function() {
    const ok = await window.adminSecurityConfirm({
        title: 'Clear All Cities',
        message: 'Are you sure you want to <strong>DELETE ALL CITIES</strong> from the entire system and Cloud? This cannot be undone.',
        actionType: 'delete'
    });
    if (!ok) return;

    try {
        if (window.lbCloudSync && typeof window.lbCloudSync.clearAllCities === 'function') {
            await window.lbCloudSync.clearAllCities();
        }
        setDB(DB_KEYS.CITIES, []);
        if (typeof window.refreshAll === 'function') window.refreshAll();
        alert('All cities have been permanently deleted from Cloud and Local storage!');
    } catch (err) {
        console.error('Error clearing cities:', err);
        alert('Failed to clear cities: ' + err.message);
    }
};

window.openEditCategoryModal = function(encodedName) {
    const name = decodeURIComponent(encodedName);
    const categories = getDB(DB_KEYS.CATEGORIES);
    const cat = categories.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (!cat) {
        alert('Category not found.');
        return;
    }

    const origInput = document.getElementById('editCatOriginalName');
    const nameInput = document.getElementById('editCatNameInput');
    const tagsInput = document.getElementById('editCatTagsInput');

    const tagsArr = Array.isArray(cat.tags) ? cat.tags : (cat.tags ? cat.tags.split(',') : (cat.desc ? cat.desc.split(',') : []));

    if (origInput) origInput.value = encodedName;
    if (nameInput) nameInput.value = cat.name || '';
    if (tagsInput) tagsInput.value = tagsArr.map(t => t.trim()).filter(Boolean).join(', ');

    // Populate existing Store Sliding Categories
    if (window.editStoreCatBuilder) {
        window.editStoreCatBuilder.setChips(cat.storeCategories || cat.subcategories || []);
    }

    const modal = document.getElementById('editCategoryModal');
    if (modal) {
        modal.classList.add('active');
    }
};

window.deleteCategory = async function(encodedName) {
    const name = decodeURIComponent(encodedName);
    const ok = await window.adminSecurityConfirm({
        title: 'Delete Category',
        message: `Are you sure you want to delete category <strong>"${name}"</strong> from LocalBazar?`,
        actionType: 'delete'
    });
    if (!ok) return;

    let categories = getDB(DB_KEYS.CATEGORIES);
    categories = categories.filter(c => (c.name || c).toLowerCase() !== name.toLowerCase());
    setDB(DB_KEYS.CATEGORIES, categories);
    if (window.lbCloudSync && typeof window.lbCloudSync.deleteCategory === 'function') {
        window.lbCloudSync.deleteCategory(name);
    }
    if (typeof window.refreshAll === 'function') window.refreshAll();
};

window.clearAllCategoriesPrompt = async function() {
    const ok = await window.adminSecurityConfirm({
        title: 'Clear All Categories',
        message: 'Are you sure you want to <strong>DELETE ALL CATEGORIES</strong> from the entire system and Cloud? This cannot be undone.',
        actionType: 'delete'
    });
    if (!ok) return;

    try {
        if (window.lbCloudSync && typeof window.lbCloudSync.clearAllCategories === 'function') {
            await window.lbCloudSync.clearAllCategories();
        }
        setDB(DB_KEYS.CATEGORIES, []);
        if (typeof window.refreshAll === 'function') window.refreshAll();
        alert('All categories have been permanently deleted from Cloud and Local storage!');
    } catch (err) {
        console.error('Error clearing categories:', err);
        alert('Failed to clear categories: ' + err.message);
    }
};

window.handleMailCheckboxChange = function() {
    const checkboxes = document.querySelectorAll('.mail-item-checkbox');
    const checked = document.querySelectorAll('.mail-item-checkbox:checked');
    const master = document.getElementById('masterMailCheckbox');
    const bulkBar = document.getElementById('mailBulkActionBar');
    const countText = document.getElementById('mailSelectedCountText');

    if (master && checkboxes.length > 0) {
        master.checked = checkboxes.length === checked.length;
        master.indeterminate = checked.length > 0 && checked.length < checkboxes.length;
    }

    if (bulkBar && countText) {
        if (checked.length > 0) {
            bulkBar.style.display = 'inline-flex';
            countText.textContent = `${checked.length} selected`;
        } else {
            bulkBar.style.display = 'none';
        }
    }
};

window.toggleSelectAllMails = function(masterCheckbox) {
    const isChecked = masterCheckbox ? masterCheckbox.checked : false;
    document.querySelectorAll('.mail-item-checkbox').forEach(cb => {
        cb.checked = isChecked;
    });
    window.handleMailCheckboxChange();
};

window.clearSelectedMails = function() {
    const master = document.getElementById('masterMailCheckbox');
    if (master) {
        master.checked = false;
        master.indeterminate = false;
    }
    document.querySelectorAll('.mail-item-checkbox').forEach(cb => {
        cb.checked = false;
    });
    const bulkBar = document.getElementById('mailBulkActionBar');
    if (bulkBar) bulkBar.style.display = 'none';
};

window.deleteMail = async function(id) {
    const ok = await window.adminSecurityConfirm({
        title: 'Delete Message',
        message: 'Are you sure you want to permanently delete this message?',
        actionType: 'delete'
    });
    if (!ok) return;

    let mail = getDB(DB_KEYS.MAIL);
    mail = mail.filter(m => String(m.id) !== String(id));
    setDB(DB_KEYS.MAIL, mail);

    if (window.lbCloudSync && typeof window.lbCloudSync.deleteMail === 'function') {
        await window.lbCloudSync.deleteMail(id);
    }

    if (typeof window.refreshAll === 'function') window.refreshAll();
    const currentTab = document.querySelector('.mail-tab-btn.active')?.getAttribute('data-mail-tab') || 'inbox';
    if (typeof renderMailbox === 'function') renderMailbox(currentTab);
};

window.deleteSelectedMails = async function() {
    const checked = document.querySelectorAll('.mail-item-checkbox:checked');
    const selectedIds = Array.from(checked).map(cb => cb.getAttribute('data-mail-id')).filter(Boolean);

    if (selectedIds.length === 0) {
        alert('Please select at least one message to delete.');
        return;
    }

    const ok = await window.adminSecurityConfirm({
        title: `Delete ${selectedIds.length} Messages`,
        message: `Are you sure you want to permanently delete these <strong>${selectedIds.length}</strong> selected messages from the database and cloud?`,
        actionType: 'delete'
    });
    if (!ok) return;

    let mail = getDB(DB_KEYS.MAIL);
    const idSet = new Set(selectedIds.map(String));
    mail = mail.filter(m => !idSet.has(String(m.id)));
    setDB(DB_KEYS.MAIL, mail);

    if (window.lbCloudSync && typeof window.lbCloudSync.deleteMultipleMails === 'function') {
        await window.lbCloudSync.deleteMultipleMails(selectedIds);
    } else if (window.lbCloudSync && typeof window.lbCloudSync.deleteMail === 'function') {
        for (const id of selectedIds) {
            await window.lbCloudSync.deleteMail(id);
        }
    }

    window.clearSelectedMails();
    if (typeof window.refreshAll === 'function') window.refreshAll();
    const currentTab = document.querySelector('.mail-tab-btn.active')?.getAttribute('data-mail-tab') || 'inbox';
    if (typeof renderMailbox === 'function') renderMailbox(currentTab);
    alert(`${selectedIds.length} messages permanently deleted.`);
};

window.deleteNews = async function(id) {
    const ok = await window.adminSecurityConfirm({
        title: 'Delete News Announcement',
        message: 'Are you sure you want to remove this news announcement?',
        actionType: 'delete'
    });
    if (!ok) return;

    let news = getDB(DB_KEYS.NEWS);
    news = news.filter(n => n.id !== id);
    setDB(DB_KEYS.NEWS, news);
    if (window.lbCloudSync && typeof window.lbCloudSync.deleteNewsItem === 'function') {
        window.lbCloudSync.deleteNewsItem(id);
    }
    if (typeof window.refreshAll === 'function') window.refreshAll();
};

// =========================================================================
// ENTERPRISE LISTING CLAIMS & OWNERSHIP VERIFICATION SYSTEM
// =========================================================================

let adminCurrentClaimsFilter = 'all';

window.setAdminClaimsFilter = function(filter) {
    adminCurrentClaimsFilter = filter;
    document.querySelectorAll('.claim-filter-pill').forEach(pill => {
        if (pill.getAttribute('data-claim-filter') === filter) {
            pill.classList.add('active');
        } else {
            pill.classList.remove('active');
        }
    });
    renderListingClaims();
};

window.renderListingClaims = function() {
    const listContainer = document.getElementById('adminClaimsList');
    if (!listContainer) return;

    const claims = getDB(DB_KEYS.CLAIMS, []);
    const searchVal = (document.getElementById('claimsFilterSearch')?.value || '').trim().toLowerCase();

    // 1. Update filter pill counts
    const pendingCount = claims.filter(c => c.status === 'Pending').length;
    const approvedCount = claims.filter(c => c.status === 'Approved').length;
    const rejectedCount = claims.filter(c => c.status === 'Rejected').length;

    if (document.getElementById('adminClaimAllCount')) document.getElementById('adminClaimAllCount').textContent = claims.length;
    if (document.getElementById('adminClaimPendingCount')) document.getElementById('adminClaimPendingCount').textContent = pendingCount;
    if (document.getElementById('adminClaimApprovedCount')) document.getElementById('adminClaimApprovedCount').textContent = approvedCount;
    if (document.getElementById('adminClaimRejectedCount')) document.getElementById('adminClaimRejectedCount').textContent = rejectedCount;
    if (document.getElementById('sidebarClaimsBadge')) document.getElementById('sidebarClaimsBadge').textContent = pendingCount;

    // 2. Filter claims
    let filtered = claims;
    if (adminCurrentClaimsFilter !== 'all') {
        filtered = filtered.filter(c => c.status === adminCurrentClaimsFilter);
    }
    if (searchVal) {
        filtered = filtered.filter(c => 
            (c.listingName || '').toLowerCase().includes(searchVal) ||
            (c.userName || '').toLowerCase().includes(searchVal) ||
            (c.userEmail || '').toLowerCase().includes(searchVal) ||
            (c.userPhone || '').toLowerCase().includes(searchVal) ||
            (c.city || '').toLowerCase().includes(searchVal) ||
            (c.category || '').toLowerCase().includes(searchVal)
        );
    }

    if (filtered.length === 0) {
        listContainer.innerHTML = `
            <div style="text-align:center; padding:3.5rem 1rem; background:var(--bg-card); border:1px solid var(--border); border-radius:12px; color:var(--text-muted);">
                <div style="font-size:3rem; color:#cbd5e1; margin-bottom:0.75rem;"><i class="fa-solid fa-file-circle-question"></i></div>
                <h3 style="color:var(--text-main); margin-bottom:0.25rem;">No Listing Claims Found</h3>
                <p style="font-size:0.88rem;">${adminCurrentClaimsFilter === 'all' ? 'No ownership claim requests submitted by business owners yet.' : `No claims matching the "${adminCurrentClaimsFilter}" filter.`}</p>
            </div>
        `;
        return;
    }

    listContainer.innerHTML = filtered.map(c => {
        let statusBadge = '';
        if (c.status === 'Approved') {
            statusBadge = `<span style="background:#d1fae5; color:#065f46; font-weight:700; font-size:0.8rem; padding:0.3rem 0.75rem; border-radius:20px;"><i class="fa-solid fa-circle-check"></i> Approved</span>`;
        } else if (c.status === 'Rejected') {
            statusBadge = `<span style="background:#fee2e2; color:#991b1b; font-weight:700; font-size:0.8rem; padding:0.3rem 0.75rem; border-radius:20px;"><i class="fa-solid fa-circle-xmark"></i> Rejected</span>`;
        } else {
            statusBadge = `<span style="background:#fef3c7; color:#b45309; font-weight:700; font-size:0.8rem; padding:0.3rem 0.75rem; border-radius:20px;"><i class="fa-solid fa-clock"></i> Pending Review</span>`;
        }

        const dateStr = c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recent';

        // Documents chips
        const docsHtml = (c.documents && c.documents.length > 0) ? `
            <div style="margin-top:0.75rem;">
                <div style="font-size:0.78rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.4rem;">
                    <i class="fa-solid fa-paperclip"></i> Attached Proof Documents (${c.documents.length}/5) - Click to view
                </div>
                <div style="display:flex; flex-wrap:wrap; gap:0.5rem;">
                    ${c.documents.map((d, dIdx) => {
                        let icon = '<i class="fa-solid fa-file-lines" style="color:#6366f1;"></i>';
                        if (d.isImage) icon = '<i class="fa-solid fa-file-image" style="color:#10b981;"></i>';
                        else if ((d.name || '').toLowerCase().endsWith('.pdf')) icon = '<i class="fa-solid fa-file-pdf" style="color:#ef4444;"></i>';
                        else if ((d.name || '').toLowerCase().endsWith('.doc') || (d.name || '').toLowerCase().endsWith('.docx')) icon = '<i class="fa-solid fa-file-word" style="color:#2563eb;"></i>';

                        return `
                            <button type="button" class="admin-claim-doc-chip" onclick="openClaimDocModal('${c.id}', ${dIdx})" title="Click to view full preview">
                                ${icon} <span>${d.name}</span> <small style="color:var(--text-muted);">(${d.size || ''})</small>
                            </button>
                        `;
                    }).join('')}
                </div>
            </div>
        ` : `<div style="margin-top:0.5rem; font-size:0.8rem; color:#94a3b8;"><i class="fa-solid fa-circle-info"></i> No proof documents attached</div>`;

        // Admin resolution / reply box
        let adminNoteHtml = '';
        if (c.adminReply) {
            const isRej = c.status === 'Rejected';
            adminNoteHtml = `
                <div style="margin-top:0.85rem; padding:0.75rem 1rem; background:${isRej ? '#fef2f2' : '#f0fdf4'}; border-left:3px solid ${isRej ? '#dc2626' : '#16a34a'}; border-radius:6px;">
                    <div style="font-weight:700; font-size:0.82rem; color:${isRej ? '#991b1b' : '#166534'};">
                        <i class="fa-solid fa-comment-dots"></i> ${isRej ? 'Rejection Reason (Kano reject holo):' : 'Admin Note / Reply:'}
                    </div>
                    <p style="margin:0.25rem 0 0 0; font-size:0.85rem; color:${isRej ? '#b91c1c' : '#15803d'};">${c.adminReply}</p>
                </div>
            `;
        }

        // Action Buttons
        let actionsHtml = `
            <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:1rem; padding-top:0.85rem; border-top:1px dashed #e2e8f0;">
                <button type="button" class="btn-primary-action" onclick="approveListingClaim('${c.id}')" style="background:#16a34a; color:#ffffff; border:none; padding:0.45rem 0.95rem; font-size:0.82rem; font-weight:700; border-radius:8px; cursor:pointer; display:inline-flex; align-items:center; gap:0.4rem;">
                    <i class="fa-solid fa-circle-check"></i> Approve Claim
                </button>
                <button type="button" class="btn-primary-action" onclick="openRejectClaimModal('${c.id}')" style="background:#dc2626; color:#ffffff; border:none; padding:0.45rem 0.95rem; font-size:0.82rem; font-weight:700; border-radius:8px; cursor:pointer; display:inline-flex; align-items:center; gap:0.4rem;">
                    <i class="fa-solid fa-circle-xmark"></i> Reject Claim
                </button>
                <button type="button" class="btn-primary-action" onclick="openReplyClaimModal('${c.id}')" style="background:#4f46e5; color:#ffffff; border:none; padding:0.45rem 0.95rem; font-size:0.82rem; font-weight:700; border-radius:8px; cursor:pointer; display:inline-flex; align-items:center; gap:0.4rem;">
                    <i class="fa-solid fa-reply"></i> Reply to Claimant
                </button>
            </div>
        `;

        return `
            <div class="admin-claim-card">
                <div class="admin-claim-card-header">
                    <div>
                        <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                            <h3 style="margin:0; font-size:1.1rem; color:var(--text-main);">
                                <i class="fa-solid fa-store" style="color:#d97706; margin-right:0.35rem;"></i>${c.listingName}
                            </h3>
                            ${c.listingId ? `<span style="font-size:0.75rem; background:#f1f5f9; color:#475569; padding:0.2rem 0.5rem; border-radius:6px; font-weight:700;">Listing ID: #${c.listingId}</span>` : ''}
                            <span style="font-size:0.75rem; background:#e0e7ff; color:#4338ca; padding:0.2rem 0.5rem; border-radius:6px; font-weight:700;">Claim ID: ${c.id}</span>
                        </div>
                        <div style="font-size:0.82rem; color:var(--text-muted); margin-top:0.35rem; display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap;">
                            <span><i class="fa-solid fa-location-dot" style="color:#ef4444;"></i> ${c.city}</span>
                            <span>•</span>
                            <span><i class="fa-solid fa-layer-group" style="color:#6366f1;"></i> ${c.category}</span>
                            <span>•</span>
                            <span><i class="fa-regular fa-clock"></i> ${dateStr}</span>
                        </div>
                    </div>
                    <div>${statusBadge}</div>
                </div>

                <!-- Claimant profile row -->
                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:0.75rem 1rem; margin-bottom:0.75rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem;">
                    <div>
                        <div style="font-size:0.72rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Claimant Details</div>
                        <div style="font-weight:700; color:var(--text-main); font-size:0.95rem; margin-top:0.15rem;">
                            <i class="fa-solid fa-user-circle" style="color:var(--primary); margin-right:0.3rem;"></i> ${c.userName}
                        </div>
                        <div style="font-size:0.82rem; color:var(--text-muted); margin-top:0.2rem; display:flex; gap:0.75rem; flex-wrap:wrap;">
                            ${c.userEmail ? `<span><i class="fa-regular fa-envelope"></i> ${c.userEmail}</span>` : ''}
                            ${c.userPhone ? `<span><i class="fa-solid fa-phone"></i> ${c.userPhone}</span>` : ''}
                            <span><i class="fa-solid fa-fingerprint"></i> UID: ${c.userId || 'Guest'}</span>
                        </div>
                    </div>
                </div>

                <!-- Description / Ownership Statement -->
                <div style="background:var(--bg-main); border:1px solid var(--border); border-radius:8px; padding:0.85rem 1rem;">
                    <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.35rem;">
                        <i class="fa-solid fa-quote-left" style="color:var(--primary);"></i> Ownership Claim Statement
                    </div>
                    <div style="font-size:0.88rem; color:var(--text-main); line-height:1.5;">${c.description}</div>
                </div>

                ${docsHtml}
                ${adminNoteHtml}
                ${actionsHtml}
            </div>
        `;
    }).join('');
};

window.approveListingClaim = async function(claimId) {
    const claims = getDB(DB_KEYS.CLAIMS, []);
    const idx = claims.findIndex(c => String(c.id) === String(claimId));
    if (idx === -1) return;

    const claim = claims[idx];
    const ok = await window.adminSecurityConfirm({
        title: 'Approve Ownership Claim',
        message: `Are you sure you want to APPROVE ownership of <strong>"${claim.listingName}"</strong> to user <strong>"${claim.userName}"</strong>?<br><br>This will transfer the listing into their business dashboard.`,
        actionType: 'edit'
    });
    if (!ok) return;

    // 1. Assign ownership on target listing in lb_listings
    const listings = getDB(DB_KEYS.LISTINGS, []);
    let targetIdx = -1;
    if (claim.listingId) {
        targetIdx = listings.findIndex(l => String(l.id) === String(claim.listingId));
    }
    if (targetIdx === -1) {
        // Fallback: match by listing name & city
        targetIdx = listings.findIndex(l => 
            (l.name || '').toLowerCase() === (claim.listingName || '').toLowerCase() &&
            (l.city || '').toLowerCase() === (claim.city || '').toLowerCase()
        );
    }

    if (targetIdx !== -1) {
        listings[targetIdx].ownerId = claim.userId;
        listings[targetIdx].ownerName = claim.userName;
        setDB(DB_KEYS.LISTINGS, listings);
        if (window.lbCloudSync && typeof window.lbCloudSync.saveListing === 'function') {
            window.lbCloudSync.saveListing(listings[targetIdx]);
        }
    }

    // 2. Mark claim as Approved
    claims[idx].status = 'Approved';
    claims[idx].adminReply = 'Approved! Ownership of this business listing has been verified and transferred to your account.';
    claims[idx].repliedAt = new Date().toISOString();
    setDB(DB_KEYS.CLAIMS, claims);

    // 3. Send notification mail to user
    try {
        const mail = getDB(DB_KEYS.MAIL, []);
        mail.unshift({
            id: 'ML-' + Date.now(),
            from: 'Super Admin',
            to: claim.userEmail || claim.userName,
            subject: `[Claim Approved] Ownership Verified for "${claim.listingName}"`,
            body: `Dear ${claim.userName},\n\nCongratulations! Your ownership claim for "${claim.listingName}" located in ${claim.city} has been verified and approved by Super Admin.\n\nThis listing has been officially assigned to your account. You can now manage catalog, schedule, images, and sales leads from your "Manage Your Business" dashboard.\n\nBest regards,\nLocalBazar Admin Team`,
            type: 'inbox',
            read: false,
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        });
        setDB(DB_KEYS.MAIL, mail);
    } catch {}

    refreshAll();
    alert(`Success: Claim for "${claim.listingName}" approved! Ownership has been transferred to "${claim.userName}".`);
};

window.openRejectClaimModal = function(claimId) {
    const claims = getDB(DB_KEYS.CLAIMS, []);
    const claim = claims.find(c => String(c.id) === String(claimId));
    if (!claim) return;

    document.getElementById('rejectClaimId').value = claim.id;
    document.getElementById('rejectClaimBusinessName').textContent = `${claim.listingName} (${claim.city})`;
    document.getElementById('rejectClaimantName').textContent = `${claim.userName} (${claim.userEmail || claim.userId})`;
    document.getElementById('rejectClaimReason').value = '';

    openModal('rejectClaimModal');
};

window.submitAdminRejectClaim = async function() {
    const claimId = document.getElementById('rejectClaimId')?.value;
    const reason = document.getElementById('rejectClaimReason')?.value.trim();
    if (!claimId || !reason) {
        alert('Please specify the reason explaining why this claim was rejected.');
        return;
    }

    const ok = await window.adminSecurityConfirm({
        title: 'Reject Ownership Claim',
        message: 'Are you sure you want to reject this ownership claim request?',
        actionType: 'delete'
    });
    if (!ok) return;

    const claims = getDB(DB_KEYS.CLAIMS, []);
    const idx = claims.findIndex(c => String(c.id) === String(claimId));
    if (idx === -1) return;

    claims[idx].status = 'Rejected';
    claims[idx].adminReply = reason;
    claims[idx].repliedAt = new Date().toISOString();
    setDB(DB_KEYS.CLAIMS, claims);

    // Send rejection explanation to user
    try {
        const mail = getDB(DB_KEYS.MAIL, []);
        mail.unshift({
            id: 'ML-' + Date.now(),
            from: 'Super Admin',
            to: claims[idx].userEmail || claims[idx].userName,
            subject: `[Claim Rejected] Ownership Claim for "${claims[idx].listingName}"`,
            body: `Dear ${claims[idx].userName},\n\nYour claim request for "${claims[idx].listingName}" (${claims[idx].city}) was reviewed and rejected by Super Admin.\n\nReason: ${reason}\n\nIf you have further questions or would like to submit updated verification documents, please feel free to submit a new claim.\n\nLocalBazar Team`,
            type: 'inbox',
            read: false,
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        });
        setDB(DB_KEYS.MAIL, mail);
    } catch {}

    closeModal('rejectClaimModal');
    refreshAll();
    alert(`Claim for "${claims[idx].listingName}" has been rejected with reason recorded.`);
};

window.openReplyClaimModal = function(claimId) {
    const claims = getDB(DB_KEYS.CLAIMS, []);
    const claim = claims.find(c => String(c.id) === String(claimId));
    if (!claim) return;

    document.getElementById('replyClaimId').value = claim.id;
    document.getElementById('replyClaimBusinessName').textContent = `${claim.listingName} (${claim.city})`;
    document.getElementById('replyClaimantName').textContent = `${claim.userName} (${claim.userEmail || claim.userId})`;
    document.getElementById('replyClaimMessage').value = claim.adminReply || '';

    openModal('replyClaimModal');
};

window.submitAdminReplyClaim = function() {
    const claimId = document.getElementById('replyClaimId')?.value;
    const message = document.getElementById('replyClaimMessage')?.value.trim();
    if (!claimId || !message) {
        alert('Please write a message to the claimant.');
        return;
    }

    const claims = getDB(DB_KEYS.CLAIMS, []);
    const idx = claims.findIndex(c => String(c.id) === String(claimId));
    if (idx === -1) return;

    claims[idx].adminReply = message;
    claims[idx].repliedAt = new Date().toISOString();
    setDB(DB_KEYS.CLAIMS, claims);

    closeModal('replyClaimModal');
    refreshAll();
    alert(`Reply recorded and delivered to ${claims[idx].userName}.`);
};

window.openClaimDocModal = function(claimId, docIndex) {
    const claims = getDB(DB_KEYS.CLAIMS, []);
    const claim = claims.find(c => String(c.id) === String(claimId));
    if (!claim || !claim.documents || !claim.documents[docIndex]) return;

    const doc = claim.documents[docIndex];
    document.getElementById('viewClaimDocTitle').innerHTML = `<i class="fa-solid fa-file-shield" style="color:var(--primary);"></i> ${doc.name}`;
    document.getElementById('viewClaimDocSubtitle').textContent = `Submitted by ${claim.userName} for "${claim.listingName}" (${doc.size || ''})`;

    const body = document.getElementById('viewClaimDocBody');
    const dlBtn = document.getElementById('btnDownloadClaimDoc');

    if (dlBtn) {
        dlBtn.href = doc.data;
        dlBtn.download = doc.name;
    }

    if (doc.isImage || (doc.type && doc.type.startsWith('image/'))) {
        body.innerHTML = `<img src="${doc.data}" alt="${doc.name}" style="max-width:100%; max-height:70vh; object-fit:contain; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.15);">`;
    } else if (doc.name.toLowerCase().endsWith('.pdf') || (doc.type && doc.type.includes('pdf'))) {
        body.innerHTML = `
            <iframe src="${doc.data}" style="width:100%; height:65vh; border:none; border-radius:8px;"></iframe>
        `;
    } else {
        body.innerHTML = `
            <div style="padding:2.5rem; color:#475569;">
                <i class="fa-solid fa-file-lines" style="font-size:3.5rem; color:#6366f1; margin-bottom:1rem;"></i>
                <h4>${doc.name}</h4>
                <p style="font-size:0.88rem; color:#64748b; margin-top:0.35rem;">Document file cannot be previewed directly inline.</p>
                <a href="${doc.data}" download="${doc.name}" class="btn-primary-action" style="display:inline-flex; align-items:center; gap:0.5rem; margin-top:1rem; text-decoration:none;">
                    <i class="fa-solid fa-download"></i> Download ${doc.name}
                </a>
            </div>
        `;
    }

    openModal('viewClaimDocModal');
};

// Search filter listener for listing claims
document.getElementById('claimsFilterSearch')?.addEventListener('input', () => {
    renderListingClaims();
});

// Professional Strict Title Case: Converts input so first letter is Capital, all middle letters are Small, and words/tags after spaces, commas, slashes, or hashes start with Capital
function formatToTitleCase(str) {
    if (!str) return '';
    // Lowercase everything first, then capitalize the start of each word/token
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

    // Strict Capitalize First Letter, remainder small for each word / tag token
    const transformed = formatToTitleCase(val);

    if (transformed !== val) {
        el.value = transformed;
        if (start !== null && end !== null) {
            el.setSelectionRange(start, end);
        }
    }
});

// ========================================================
// FREE CLOUD IMAGE CDN SETTINGS & LIVE TESTER
// ========================================================
window.saveAdminImgbbApiKey = function() {
    const input = document.getElementById('settingImgbbApiKey');
    if (!input) return;
    const key = input.value.trim();
    if (!key) {
        alert('Please enter a valid ImgBB API Key.');
        return;
    }
    localStorage.setItem('lb_imgbb_api_key', key);
    if (window.imageHostConfig) window.imageHostConfig.apiKey = key;
    
    const badge = document.getElementById('imgbbKeyStatusBadge');
    if (badge) badge.innerHTML = `<i class="fa-solid fa-circle-check" style="color:#059669;"></i> Status: Saved & Active`;
    alert('ImgBB API Key saved successfully! All shop & product photos will now use this CDN key.');
};

window.testImgbbCdnUpload = async function() {
    const btn = document.getElementById('btnTestImgbbUpload');
    const notice = document.getElementById('imgbbTestNotice');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Uploading...`;
    }
    if (notice) notice.textContent = 'Testing connection with ImgBB CDN...';

    try {
        // 1x1 green test png dataUrl
        const testPixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
        const cdnUrl = await window.uploadImageToCloud(testPixel);
        if (cdnUrl && cdnUrl.startsWith('http')) {
            if (notice) notice.innerHTML = `<span style="color:#059669; font-weight:700;"><i class="fa-solid fa-circle-check"></i> Connected! CDN URL: <a href="${cdnUrl}" target="_blank" style="color:#2563eb;">View Uploaded Test Photo</a></span>`;
            alert('Success! Image uploaded directly to Free Cloud CDN:\n\n' + cdnUrl);
        } else {
            if (notice) notice.innerHTML = `<span style="color:#d97706;">Using local storage fallback. (Check internet or API key)</span>`;
            alert('Notice: Upload fell back to local storage.');
        }
    } catch (err) {
        if (notice) notice.innerHTML = `<span style="color:#ef4444;">Error: ${err.message}</span>`;
        alert('Test error: ' + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-bolt" style="color:#f59e0b; margin-right:4px;"></i> Test CDN Upload`;
        }
    }
};



// Initialize Admin Settings ImgBB Input on load
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('settingImgbbApiKey');
    if (input) {
        const savedKey = localStorage.getItem('lb_imgbb_api_key');
        if (savedKey) input.value = savedKey;
    }
});

// Auto-pull fresh cloud data and attach real-time listeners for instant admin updates
window.addEventListener('lb:cloud-synced', () => {
    console.log('[Admin] Cloud sync completed. Updating dashboard...');
    if (typeof window.refreshAll === 'function') window.refreshAll();
});

function initAdminCloudListeners() {
    if (!window.lbCloudSync) return;

    if (typeof window.lbCloudSync.listenListings === 'function') {
        window.lbCloudSync.listenListings(() => {
            console.log('[Admin] Real-time listings update received from Firestore.');
            if (typeof window.refreshAll === 'function') window.refreshAll();
        });
    }

    if (typeof window.lbCloudSync.listenClaims === 'function') {
        window.lbCloudSync.listenClaims(() => {
            console.log('[Admin] Real-time claims update received from Firestore.');
            if (typeof window.refreshAll === 'function') window.refreshAll();
        });
    }

    if (typeof window.lbCloudSync.listenUsers === 'function') {
        window.lbCloudSync.listenUsers(() => {
            console.log('[Admin] Real-time users update received from Firestore.');
            if (typeof window.refreshAll === 'function') window.refreshAll();
        });
    }

    if (typeof window.lbCloudSync.listenMail === 'function') {
        window.lbCloudSync.listenMail(() => {
            console.log('[Admin] Real-time mail update received from Firestore.');
            if (typeof window.refreshAll === 'function') window.refreshAll();
        });
    }

    if (typeof window.lbCloudSync.listenTrustRequests === 'function') {
        window.lbCloudSync.listenTrustRequests(() => {
            console.log('[Admin] Real-time trust requests update received from Firestore.');
            if (typeof window.refreshAll === 'function') window.refreshAll();
        });
    }

    if (typeof window.lbCloudSync.listenCityRequests === 'function') {
        window.lbCloudSync.listenCityRequests(() => {
            console.log('[Admin] Real-time city requests update received from Firestore.');
            if (typeof window.refreshAll === 'function') window.refreshAll();
            if (typeof window.renderAdminCityRequests === 'function') window.renderAdminCityRequests();
        });
    }

    if (typeof window.lbCloudSync.listenCategoryRequests === 'function') {
        window.lbCloudSync.listenCategoryRequests(() => {
            console.log('[Admin] Real-time category requests update received from Firestore.');
            if (typeof window.refreshAll === 'function') window.refreshAll();
            if (typeof window.renderAdminCategoryRequests === 'function') window.renderAdminCategoryRequests();
        });
    }
}

// ================= TRUST BADGE & PAID VERIFICATIONS MODULE =================
let adminCurrentTrustFilter = 'all';
let adminCurrentTrustSubTab = 'active'; // 'active' or 'requests'

window.switchAdminTrustSubTab = function(subTab) {
    adminCurrentTrustSubTab = subTab;
    const btnActive = document.getElementById('btnAdminTrustTabActive');
    const btnRequests = document.getElementById('btnAdminTrustTabRequests');
    const secActive = document.getElementById('adminTrustActiveSection');
    const secRequests = document.getElementById('adminTrustRequestsSection');

    if (subTab === 'active') {
        if (btnActive) btnActive.classList.add('active');
        if (btnRequests) btnRequests.classList.remove('active');
        if (secActive) secActive.style.display = 'block';
        if (secRequests) secRequests.style.display = 'none';
        window.renderAdminTrustedListings();
    } else {
        if (btnRequests) btnRequests.classList.add('active');
        if (btnActive) btnActive.classList.remove('active');
        if (secRequests) secRequests.style.display = 'block';
        if (secActive) secActive.style.display = 'none';
        window.renderAdminTrustBadgeRequests();
    }
};

window.renderAdminTrustedListings = function() {
    const tbody = document.getElementById('adminTrustedTableBody');
    const totalCountText = document.getElementById('adminTrustedTotalText');
    const activeTabCount = document.getElementById('adminTrustActiveCount');
    const cityFilter = document.getElementById('adminTrustedCityFilter');
    if (!tbody) return;

    let listings = [];
    try {
        const raw = localStorage.getItem('lb_listings');
        listings = raw ? JSON.parse(raw) : [];
    } catch {}

    const trustedListings = listings.filter(l => (l.hasTrustBadge || l.status === 'Verified'));

    if (totalCountText) totalCountText.textContent = trustedListings.length;
    if (activeTabCount) activeTabCount.textContent = trustedListings.length;

    // Populate unique cities filter if empty
    if (cityFilter && cityFilter.options.length <= 1) {
        const cities = [...new Set(trustedListings.map(l => (l.city || '').trim()).filter(Boolean))].sort();
        cities.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.textContent = c;
            cityFilter.appendChild(opt);
        });
    }

    const keyword = (document.getElementById('adminTrustedSearch')?.value || '').trim().toLowerCase();
    const selectedCity = (cityFilter?.value || '').trim().toLowerCase();

    let filtered = trustedListings;
    if (keyword) {
        filtered = filtered.filter(l => 
            (l.name || '').toLowerCase().includes(keyword) ||
            (l.category || '').toLowerCase().includes(keyword) ||
            (l.city || '').toLowerCase().includes(keyword) ||
            (l.phone || '').toLowerCase().includes(keyword) ||
            (l.ownerName || '').toLowerCase().includes(keyword)
        );
    }
    if (selectedCity) {
        filtered = filtered.filter(l => (l.city || '').toLowerCase() === selectedCity);
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center; padding:3.5rem 1rem; color:var(--text-muted);">
                    <div style="font-size:2.5rem; color:#fde68a; margin-bottom:0.5rem;"><i class="fa-solid fa-crown"></i></div>
                    <strong style="display:block; font-size:1rem; color:var(--text-main);">No Trusted Listings Found</strong>
                    <span style="font-size:0.84rem;">${trustedListings.length === 0 ? 'No listings currently have the Trust Badge. Approve a request or grant Trust Badge to any listing.' : 'No listings match your search/filter.'}</span>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtered.map(l => {
        const coverImg = l.image || (Array.isArray(l.gallery) && l.gallery[0]) || 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=100&auto=format&fit=crop&q=80';
        const expTime = l.trustExpiresAt ? new Date(l.trustExpiresAt).getTime() : (new Date(l.trustActivatedAt || l.createdAt || Date.now()).getTime() + 365 * 24 * 60 * 60 * 1000);
        const daysLeft = Math.max(0, Math.ceil((expTime - Date.now()) / (1000 * 60 * 60 * 24)));
        const expDateStr = new Date(expTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        return `
            <tr>
                <td>
                    <div class="place-cell" onclick="openAdminTrustDetailsModal('${l.id}')" style="cursor:pointer;" title="Click to view full trust & payment audit details">
                        <img src="${coverImg}" alt="${l.name}" style="width:38px; height:38px; border-radius:8px; object-fit:cover; border:1px solid var(--border);">
                        <div>
                            <div class="place-name" style="display:flex; align-items:center; gap:0.35rem; flex-wrap:wrap;">
                                <span>${l.name}</span>
                                <span class="badge-gold-trust"><i class="fa-solid fa-shield-halved"></i> Trust</span>
                            </div>
                            <div class="place-sub">${l.address || 'Address on file'} (#${l.id})</div>
                        </div>
                    </div>
                </td>
                <td><span class="category-chip">${l.category}</span></td>
                <td>${l.city}</td>
                <td><span class="user-role-pill merchant" style="font-size:0.75rem;"><i class="fa-solid fa-user-check"></i> ${l.trustOwnerName || l.ownerName || 'Merchant'}</span></td>
                <td>
                    <div style="font-size:0.76rem; font-weight:700; color:#15803d; background:#f0fdf4; border:1px solid #bbf7d0; padding:0.2rem 0.55rem; border-radius:10px; display:inline-block;">
                        <i class="fa-regular fa-calendar-check"></i> Till ${expDateStr}
                        <div style="font-size:0.7rem; color:${daysLeft > 30 ? '#166534' : '#b91c1c'}; font-weight:800;">${daysLeft} Days Left</div>
                    </div>
                </td>
                <td><span style="background:#fef3c7; color:#78350f; border:1px solid #fde68a; font-weight:800; font-size:0.75rem; padding:0.2rem 0.55rem; border-radius:14px;"><i class="fa-solid fa-circle-check"></i> Active</span></td>
                <td class="text-right">
                    <div class="action-buttons" style="display:flex; gap:0.35rem; justify-content:flex-end;">
                        <button type="button" class="btn-action edit" onclick="openAdminTrustDetailsModal('${l.id}')" title="View Full Trust & Audit Details" style="background:#eff6ff; color:#1d4ed8; border-color:#bfdbfe;">
                            <i class="fa-solid fa-receipt"></i> Details
                        </button>
                        <a href="listing-detail.html?id=${encodeURIComponent(l.id)}" target="_blank" class="btn-action view" title="View Store Public Page"><i class="fa-solid fa-arrow-up-right-from-square"></i></a>
                        <button type="button" class="btn-action delete" onclick="adminRevokeDirectTrustBadge('${l.id}')" title="Revoke Trust Badge" style="background:#fee2e2; color:#b91c1c; border-color:#fecaca;"><i class="fa-solid fa-ban"></i></button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
};

window.openAdminTrustDetailsModal = function(listingId) {
    let listings = [];
    try {
        const raw = localStorage.getItem('lb_listings');
        listings = raw ? JSON.parse(raw) : [];
    } catch {}

    const item = listings.find(l => String(l.id).trim() === String(listingId).trim());
    if (!item) return;

    let reqs = [];
    try {
        const rawReqs = localStorage.getItem('lb_trust_requests');
        reqs = rawReqs ? JSON.parse(rawReqs) : [];
    } catch {}

    const matchReq = reqs.find(r => String(r.listingId).trim() === String(item.id).trim()) || {};

    const activatedDateStr = item.trustActivatedAt 
        ? new Date(item.trustActivatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : (item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '28 Oct 2026');

    const expTimestamp = item.trustExpiresAt 
        ? new Date(item.trustExpiresAt).getTime()
        : (new Date(item.trustActivatedAt || item.createdAt || Date.now()).getTime() + 365 * 24 * 60 * 60 * 1000);

    const expiryDateStr = new Date(expTimestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const daysRemaining = Math.max(0, Math.ceil((expTimestamp - Date.now()) / (1000 * 60 * 60 * 24)));

    const modal = document.getElementById('adminTrustDetailsModal');
    if (!modal) return;

    const modalTitle = document.getElementById('atdModalTitle');
    if (modalTitle) modalTitle.textContent = `${item.name} - Trust Details`;

    const storeImgEl = document.getElementById('atdStoreImg');
    if (storeImgEl) {
        storeImgEl.src = item.image || (Array.isArray(item.gallery) && item.gallery[0]) || 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=100&auto=format&fit=crop&q=80';
    }
    const storeNameEl = document.getElementById('atdStoreName');
    if (storeNameEl) storeNameEl.textContent = item.name;
    const storeCatEl = document.getElementById('atdStoreCategory');
    if (storeCatEl) storeCatEl.textContent = item.category || 'Business';
    const storeCityEl = document.getElementById('atdStoreCity');
    if (storeCityEl) storeCityEl.textContent = item.city || 'Local Area';

    const actDateEl = document.getElementById('atdActivatedDate');
    if (actDateEl) actDateEl.textContent = activatedDateStr;
    const expDateEl = document.getElementById('atdExpiryDate');
    if (expDateEl) expDateEl.textContent = expiryDateStr;
    const daysEl = document.getElementById('atdRemainingDays');
    if (daysEl) {
        daysEl.textContent = `${daysRemaining} Days Left`;
        daysEl.style.color = daysRemaining > 30 ? '#15803d' : '#b91c1c';
    }

    const ownerNameEl = document.getElementById('atdOwnerName');
    if (ownerNameEl) ownerNameEl.textContent = item.trustOwnerName || matchReq.ownerName || item.ownerName || 'Verified Merchant';
    const phoneEl = document.getElementById('atdPhone');
    if (phoneEl) phoneEl.textContent = item.phone || matchReq.userPhone || 'Registered Official Phone';
    const utrEl = document.getElementById('atdPaymentUtr');
    if (utrEl) utrEl.textContent = item.trustPaymentUtr || matchReq.paymentUtr || 'UPI-VERIFIED-99';
    const docTypeEl = document.getElementById('atdDocType');
    if (docTypeEl) docTypeEl.textContent = item.trustDocType || matchReq.docType || 'Trade License / Business Proof';

    const proofImg = item.trustDocProof || matchReq.docProof;
    const docImgEl = document.getElementById('atdDocImg');
    const docWrap = document.getElementById('atdDocProofWrap');
    if (proofImg && docImgEl) {
        docImgEl.src = proofImg;
        if (docWrap) docWrap.style.display = 'block';
    } else if (docWrap) {
        docWrap.style.display = 'none';
    }

    // Action Buttons
    const btnExtend = document.getElementById('btnAtdExtendValidity');
    if (btnExtend) {
        btnExtend.onclick = async () => {
            if (!confirm(`Extend Trust Badge validity for "${item.name}" by 1 Year (+365 days)?`)) return;
            const newExp = new Date(expTimestamp + 365 * 24 * 60 * 60 * 1000).toISOString();
            item.trustExpiresAt = newExp;
            item.hasTrustBadge = true;
            localStorage.setItem('lb_listings', JSON.stringify(listings));
            if (window.lbCloudSync && typeof window.lbCloudSync.saveListing === 'function') {
                await window.lbCloudSync.saveListing(item);
            }
            window.renderAdminTrustedListings();
            window.openAdminTrustDetailsModal(listingId);
            alert(`Extended validity for "${item.name}" until ${new Date(newExp).toLocaleDateString()}!`);
        };
    }

    const btnRevoke = document.getElementById('btnAtdRevoke');
    if (btnRevoke) {
        btnRevoke.onclick = async () => {
            modal.classList.remove('active');
            modal.style.display = 'none';
            await window.adminRevokeDirectTrustBadge(item.id);
        };
    }

    modal.classList.add('active');
    modal.style.display = 'flex';
};

window.filterAdminTrustedListings = function() {
    window.renderAdminTrustedListings();
};

window.adminRevokeDirectTrustBadge = async function(listingId) {
    if (!confirm('Are you sure you want to revoke the Gold Trust Badge for this listing?')) return;
    let listings = [];
    try {
        const raw = localStorage.getItem('lb_listings');
        listings = raw ? JSON.parse(raw) : [];
    } catch {}

    const item = listings.find(l => String(l.id).trim() === String(listingId).trim());
    if (!item) return;

    item.hasTrustBadge = false;
    localStorage.setItem('lb_listings', JSON.stringify(listings));
    if (window.lbCloudSync && typeof window.lbCloudSync.saveListing === 'function') {
        await window.lbCloudSync.saveListing(item);
    }

    window.renderAdminTrustedListings();
    if (typeof loadAllListingsTable === 'function') loadAllListingsTable();
    if (typeof updateDashboardStats === 'function') updateDashboardStats();
    alert(`Trust Badge removed for "${item.name}".`);
};

window.setAdminTrustFilter = function(filter) {
    adminCurrentTrustFilter = filter;
    document.querySelectorAll('#trustBadgeView .claim-filter-pill').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('id') === `filterTrust${filter === 'all' ? 'All' : filter}Btn`);
    });
    window.renderAdminTrustBadgeRequests();
};

window.filterAdminTrustRequests = function() {
    window.renderAdminTrustBadgeRequests();
};

window.renderAdminTrustBadgeRequests = function() {
    const listContainer = document.getElementById('adminTrustRequestsList');
    if (!listContainer) return;

    let reqs = [];
    try {
        const raw = localStorage.getItem('lb_trust_requests');
        reqs = raw ? JSON.parse(raw) : [];
    } catch {}

    const searchVal = (document.getElementById('trustFilterSearch')?.value || '').trim().toLowerCase();

    // 1. Update filter pill counts
    const pendingCount = reqs.filter(r => r.status === 'Pending').length;
    const approvedCount = reqs.filter(r => r.status === 'Approved').length;
    const rejectedCount = reqs.filter(r => r.status === 'Rejected').length;

    if (document.getElementById('adminTrustAllCount')) document.getElementById('adminTrustAllCount').textContent = reqs.length;
    if (document.getElementById('adminTrustPendingCount')) document.getElementById('adminTrustPendingCount').textContent = pendingCount;
    if (document.getElementById('adminTrustApprovedCount')) document.getElementById('adminTrustApprovedCount').textContent = approvedCount;
    if (document.getElementById('adminTrustRejectedCount')) document.getElementById('adminTrustRejectedCount').textContent = rejectedCount;
    if (document.getElementById('sidebarTrustBadge')) {
        document.getElementById('sidebarTrustBadge').textContent = pendingCount;
        document.getElementById('sidebarTrustBadge').style.display = pendingCount > 0 ? 'inline-block' : 'none';
    }
    if (document.getElementById('adminTrustPendingBadge')) {
        document.getElementById('adminTrustPendingBadge').textContent = pendingCount;
        document.getElementById('adminTrustPendingBadge').style.display = pendingCount > 0 ? 'inline-block' : 'none';
    }

    // 2. Filter list
    let filtered = reqs;
    if (adminCurrentTrustFilter !== 'all') {
        filtered = filtered.filter(r => r.status === adminCurrentTrustFilter);
    }
    if (searchVal) {
        filtered = filtered.filter(r => 
            (r.listingName || '').toLowerCase().includes(searchVal) ||
            (r.ownerName || '').toLowerCase().includes(searchVal) ||
            (r.paymentUtr || '').toLowerCase().includes(searchVal) ||
            (r.listingCity || '').toLowerCase().includes(searchVal) ||
            (r.docType || '').toLowerCase().includes(searchVal)
        );
    }

    if (filtered.length === 0) {
        listContainer.innerHTML = `
            <div style="text-align:center; padding:3.5rem 1rem; background:var(--bg-card); border:1px solid var(--border); border-radius:12px; color:var(--text-muted);">
                <div style="font-size:3rem; color:#fde68a; margin-bottom:0.75rem;"><i class="fa-solid fa-shield-halved"></i></div>
                <h3 style="color:var(--text-main); margin-bottom:0.25rem;">No Verification Requests Found</h3>
                <p style="font-size:0.88rem;">${adminCurrentTrustFilter === 'all' ? 'No merchants have applied for the ₹99 Gold Trust Badge yet.' : `No requests matching the "${adminCurrentTrustFilter}" filter.`}</p>
            </div>
        `;
        return;
    }

    listContainer.innerHTML = filtered.map(r => {
        let statusBadge = '';
        if (r.status === 'Approved') {
            statusBadge = `<span style="background:#fef3c7; color:#78350f; border:1px solid #fde68a; font-weight:800; font-size:0.8rem; padding:0.3rem 0.75rem; border-radius:20px; display:inline-flex; align-items:center; gap:0.3rem;"><i class="fa-solid fa-crown" style="color:#d97706;"></i> Gold Trust Badge Active</span>`;
        } else if (r.status === 'Rejected') {
            statusBadge = `<span style="background:#fee2e2; color:#991b1b; font-weight:700; font-size:0.8rem; padding:0.3rem 0.75rem; border-radius:20px;"><i class="fa-solid fa-circle-xmark"></i> Rejected</span>`;
        } else {
            statusBadge = `<span style="background:#fffbeb; color:#b45309; border:1px solid #fde68a; font-weight:700; font-size:0.8rem; padding:0.3rem 0.75rem; border-radius:20px;"><i class="fa-solid fa-clock"></i> Pending Audit</span>`;
        }

        const dateStr = r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recent';

        return `
            <div class="admin-claim-card" style="border-left:4px solid #f59e0b; background:var(--bg-card); border-radius:12px; padding:1.25rem; border:1px solid var(--border); box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.75rem; flex-wrap:wrap;">
                    <div>
                        <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                            <h3 style="margin:0; font-size:1.15rem; color:var(--text-main); font-weight:800;">
                                <i class="fa-solid fa-store" style="color:#d97706; margin-right:0.3rem;"></i> ${r.listingName}
                            </h3>
                            <span style="font-size:0.75rem; background:#f1f5f9; color:#475569; padding:0.15rem 0.5rem; border-radius:6px; font-weight:600;">#${r.listingId}</span>
                        </div>
                        <div style="font-size:0.82rem; color:var(--text-muted); margin-top:0.35rem; display:flex; gap:0.6rem; flex-wrap:wrap;">
                            <span><i class="fa-solid fa-location-dot"></i> ${r.listingCity}</span>
                            <span>•</span>
                            <span><i class="fa-solid fa-user"></i> ${r.ownerName}</span>
                            <span>•</span>
                            <span><i class="fa-solid fa-phone"></i> ${r.userPhone || 'N/A'}</span>
                            <span>•</span>
                            <span><i class="fa-solid fa-envelope"></i> ${r.userEmail || 'N/A'}</span>
                            <span>•</span>
                            <span><i class="fa-regular fa-calendar"></i> ${dateStr}</span>
                        </div>
                    </div>
                    <div>${statusBadge}</div>
                </div>

                <!-- Proof & Payment Inspection Row -->
                <div style="margin-top:1rem; display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:1rem;">
                    <!-- Verification Doc Details -->
                    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:0.85rem;">
                        <div style="font-size:0.76rem; font-weight:800; color:#64748b; text-transform:uppercase; margin-bottom:0.35rem;">
                            <i class="fa-solid fa-file-shield" style="color:#d97706;"></i> Verification Document
                        </div>
                        <div style="font-size:0.88rem; font-weight:700; color:#1e293b;">${r.docType}</div>
                        <div style="font-size:0.8rem; color:#475569; margin-top:0.2rem;">Doc / Reg No: <strong>${r.docNumber}</strong></div>
                        ${r.docProof ? `
                            <div style="margin-top:0.6rem;">
                                <a href="${r.docProof}" target="_blank" style="display:inline-flex; align-items:center; gap:0.35rem; background:#ffffff; border:1px solid #cbd5e1; padding:0.3rem 0.65rem; border-radius:6px; font-size:0.78rem; font-weight:700; color:#2563eb; text-decoration:none;">
                                    <i class="fa-solid fa-image"></i> View Document Preview
                                </a>
                            </div>
                        ` : ''}
                    </div>

                    <!-- Payment UTR Details -->
                    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:0.85rem;">
                        <div style="font-size:0.76rem; font-weight:800; color:#64748b; text-transform:uppercase; margin-bottom:0.35rem;">
                            <i class="fa-solid fa-receipt" style="color:#059669;"></i> ₹99 Fee Payment Audit (1 Year Plan)
                        </div>
                        <div style="font-size:0.88rem; font-weight:700; color:#059669;">₹${r.paymentAmount || 99} Received via UPI</div>
                        <div style="font-size:0.85rem; color:#1e293b; margin-top:0.2rem; font-family:monospace; font-weight:700;">
                            UTR: <span style="background:#fef3c7; color:#78350f; padding:0.15rem 0.4rem; border-radius:4px;">${r.paymentUtr}</span>
                        </div>
                        <div style="font-size:0.75rem; color:#64748b; margin-top:0.3rem;">Verify this UTR in your business bank / UPI statement.</div>
                    </div>
                </div>

                ${r.adminRemarks ? `
                    <div style="margin-top:0.85rem; padding:0.65rem 0.85rem; background:#fef2f2; border-left:3px solid #dc2626; border-radius:6px; font-size:0.82rem; color:#991b1b;">
                        <strong>Admin Remarks:</strong> ${r.adminRemarks}
                    </div>
                ` : ''}

                <!-- Action Buttons -->
                <div style="display:flex; gap:0.6rem; flex-wrap:wrap; margin-top:1rem; padding-top:0.85rem; border-top:1px dashed #e2e8f0;">
                    ${r.status !== 'Approved' ? `
                        <button type="button" onclick="adminApproveTrustBadge('${r.id}')" style="background:linear-gradient(135deg, #f59e0b, #d97706); color:#ffffff; border:none; padding:0.5rem 1.1rem; font-size:0.85rem; font-weight:800; border-radius:8px; cursor:pointer; display:inline-flex; align-items:center; gap:0.4rem; box-shadow:0 2px 8px rgba(245,158,11,0.3);">
                            <i class="fa-solid fa-crown"></i> Approve & Award Gold Trust Badge
                        </button>
                    ` : `
                        <button type="button" onclick="adminRevokeTrustBadge('${r.id}')" style="background:#fee2e2; color:#b91c1c; border:1px solid #fecaca; padding:0.45rem 0.85rem; font-size:0.82rem; font-weight:700; border-radius:8px; cursor:pointer;">
                            <i class="fa-solid fa-ban"></i> Revoke Trust Badge
                        </button>
                    `}
                    ${r.status === 'Pending' ? `
                        <button type="button" onclick="adminRejectTrustBadge('${r.id}')" style="background:#dc2626; color:#ffffff; border:none; padding:0.5rem 1rem; font-size:0.82rem; font-weight:700; border-radius:8px; cursor:pointer; display:inline-flex; align-items:center; gap:0.4rem;">
                            <i class="fa-solid fa-circle-xmark"></i> Reject Request
                        </button>
                    ` : ''}
                    <a href="listing-detail.html?id=${encodeURIComponent(r.listingId)}" target="_blank" style="background:#ffffff; color:#334155; border:1px solid #cbd5e1; padding:0.5rem 0.85rem; font-size:0.82rem; font-weight:700; border-radius:8px; text-decoration:none; display:inline-flex; align-items:center; gap:0.35rem;">
                        <i class="fa-solid fa-arrow-up-right-from-square"></i> View Store Public Page
                    </a>
                </div>
            </div>
        `;
    }).join('');
};

window.adminApproveTrustBadge = async function(reqId) {
    let reqs = [];
    try {
        const raw = localStorage.getItem('lb_trust_requests');
        reqs = raw ? JSON.parse(raw) : [];
    } catch {}

    const req = reqs.find(r => String(r.id) === String(reqId));
    if (!req) return;

    const ok = await window.adminSecurityConfirm({
        title: 'Approve Trust Badge',
        message: `Are you sure you want to activate the Gold Verified Trust Badge for <strong>"${req.listingName}"</strong>?`,
        actionType: 'edit'
    });
    if (!ok) return;

    req.status = 'Approved';
    req.approvedAt = new Date().toISOString();
    localStorage.setItem('lb_trust_requests', JSON.stringify(reqs));

    if (window.lbCloudSync && typeof window.lbCloudSync.saveTrustRequest === 'function') {
        window.lbCloudSync.saveTrustRequest(req);
    }

    // Award Trust Badge to the listing in lb_listings
    let listings = [];
    try {
        const rawListings = localStorage.getItem('lb_listings');
        listings = rawListings ? JSON.parse(rawListings) : [];
    } catch {}

    const listing = listings.find(l => String(l.id).trim() === String(req.listingId).trim());
    if (listing) {
        listing.hasTrustBadge = true;
        listing.isVerified = true;
        listing.status = 'Verified';
        listing.trustBadgeAwardedAt = new Date().toISOString();
        listing.trustActivatedAt = new Date().toISOString();
        listing.trustExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
        listing.trustPaymentUtr = req.paymentUtr;
        listing.trustDocType = req.docType;
        listing.trustDocProof = req.docProof;
        listing.trustOwnerName = req.ownerName;
        localStorage.setItem('lb_listings', JSON.stringify(listings));

        if (window.lbCloudSync && typeof window.lbCloudSync.saveListing === 'function') {
            await window.lbCloudSync.saveListing(listing);
        }
    }

    // Refresh UI
    window.renderAdminTrustBadgeRequests();
    window.renderAdminTrustedListings();
    if (typeof loadAllListingsTable === 'function') loadAllListingsTable();
    if (typeof updateDashboardStats === 'function') updateDashboardStats();
    alert(`Gold ✔ Trust Badge successfully awarded to "${req.listingName}"!`);
};

window.adminRejectTrustBadge = async function(reqId) {
    const reason = prompt('Please enter rejection reason (e.g. Invalid UTR or Document mismatch):', 'Document proof or UTR could not be verified.');
    if (reason === null) return;

    let reqs = [];
    try {
        const raw = localStorage.getItem('lb_trust_requests');
        reqs = raw ? JSON.parse(raw) : [];
    } catch {}

    const req = reqs.find(r => String(r.id) === String(reqId));
    if (!req) return;

    const ok = await window.adminSecurityConfirm({
        title: 'Reject Trust Badge Request',
        message: `Are you sure you want to reject the Trust Badge application for <strong>"${req.listingName}"</strong>?`,
        actionType: 'delete'
    });
    if (!ok) return;

    req.status = 'Rejected';
    req.adminRemarks = reason;
    req.rejectedAt = new Date().toISOString();
    localStorage.setItem('lb_trust_requests', JSON.stringify(reqs));

    if (window.lbCloudSync && typeof window.lbCloudSync.saveTrustRequest === 'function') {
        window.lbCloudSync.saveTrustRequest(req);
    }

    window.renderAdminTrustBadgeRequests();
    if (typeof updateDashboardStats === 'function') updateDashboardStats();
    alert('Request marked as Rejected.');
};

window.adminRevokeTrustBadge = async function(reqId) {
    let reqs = [];
    try {
        const raw = localStorage.getItem('lb_trust_requests');
        reqs = raw ? JSON.parse(raw) : [];
    } catch {}

    const req = reqs.find(r => String(r.id) === String(reqId));
    if (!req) return;

    const ok = await window.adminSecurityConfirm({
        title: 'Revoke Trust Badge',
        message: `Are you sure you want to revoke the Trust Badge for <strong>"${req.listingName}"</strong>?`,
        actionType: 'delete'
    });
    if (!ok) return;

    req.status = 'Pending';
    localStorage.setItem('lb_trust_requests', JSON.stringify(reqs));
    if (window.lbCloudSync && typeof window.lbCloudSync.saveTrustRequest === 'function') {
        window.lbCloudSync.saveTrustRequest(req);
    }

    let listings = [];
    try {
        const rawListings = localStorage.getItem('lb_listings');
        listings = rawListings ? JSON.parse(rawListings) : [];
    } catch {}

    const listing = listings.find(l => String(l.id).trim() === String(req.listingId).trim());
    if (listing) {
        listing.hasTrustBadge = false;
        localStorage.setItem('lb_listings', JSON.stringify(listings));
        if (window.lbCloudSync && typeof window.lbCloudSync.saveListing === 'function') {
            await window.lbCloudSync.saveListing(listing);
        }
    }

    window.renderAdminTrustBadgeRequests();
    if (typeof loadAllListingsTable === 'function') loadAllListingsTable();
    if (typeof updateDashboardStats === 'function') updateDashboardStats();
};

window.adminToggleListingTrustBadge = async function(listingId) {
    let listings = [];
    try {
        const raw = localStorage.getItem('lb_listings');
        listings = raw ? JSON.parse(raw) : [];
    } catch {}

    const item = listings.find(l => String(l.id).trim() === String(listingId).trim());
    if (!item) return;

    const willBeTrusted = !(item.hasTrustBadge || item.status === 'Verified');
    const ok = await window.adminSecurityConfirm({
        title: willBeTrusted ? 'Grant Verified Trust Badge' : 'Revoke Verified Trust Badge',
        message: willBeTrusted 
            ? `Are you sure you want to grant the Verified Trust Badge to <strong>"${item.name}"</strong>?`
            : `Are you sure you want to remove the Verified Trust Badge from <strong>"${item.name}"</strong>?`,
        actionType: willBeTrusted ? 'edit' : 'delete'
    });
    if (!ok) return;

    item.hasTrustBadge = willBeTrusted;
    if (willBeTrusted) {
        item.isVerified = true;
        item.status = 'Verified';
    }

    localStorage.setItem('lb_listings', JSON.stringify(listings));
    if (window.lbCloudSync && typeof window.lbCloudSync.saveListing === 'function') {
        await window.lbCloudSync.saveListing(item);
    }

    if (typeof loadAllListingsTable === 'function') loadAllListingsTable();
    if (typeof updateDashboardStats === 'function') updateDashboardStats();
    alert(`Trust Badge ${willBeTrusted ? 'ACTIVATED' : 'REMOVED'} for "${item.name}"!`);
};

document.addEventListener('DOMContentLoaded', () => {
    if (window.isFirebaseReady && window.isFirebaseReady()) {
        initAdminCloudListeners();
    } else {
        setTimeout(initAdminCloudListeners, 1500);
    }
});



// ================= USER CITY REQUESTS & CATEGORY REQUESTS CONTROLLERS =================

// 1. City Requests Modal Controller
window.openCityRequestsModal = function() {
    window.renderAdminCityRequests();
    window.openModal('adminCityRequestsModal');
};

window.renderAdminCityRequests = function() {
    const listContainer = document.getElementById('adminCityRequestsContainer') || document.getElementById('adminCityRequestsList');
    const badge = document.getElementById('badgeCityRequestsCount');
    const statVal = document.getElementById('totalCityRequestsCount');
    const statSub = document.getElementById('cityRequestsSubtext');
    if (!listContainer) return;

    let reqs = [];
    try {
        const raw = localStorage.getItem('lb_city_requests');
        reqs = raw ? JSON.parse(raw) : [];
    } catch {}

    // Strictly show only active Pending requests so approved/rejected items never clutter the popup
    const pending = reqs.filter(r => r && (r.status === 'Pending' || !r.status));
    const pendingCount = pending.length;

    if (badge) {
        badge.textContent = pendingCount;
        badge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
    }
    if (statVal) statVal.textContent = pendingCount;
    if (statSub) {
        statSub.innerHTML = pendingCount > 0
            ? `<span style="color:#d97706; font-weight:700;"><i class="fa-solid fa-bell"></i> ${pendingCount} pending requests</span>`
            : '0 pending requests';
    }

    if (pendingCount === 0) {
        listContainer.innerHTML = `
            <div style="text-align:center; padding:3rem 1rem; color:#94a3b8;">
                <i class="fa-solid fa-map-location-dot" style="font-size:2.5rem; margin-bottom:0.75rem; color:#cbd5e1; display:block;"></i>
                <h4 style="margin:0 0 0.25rem 0; color:#475569; font-size:1.05rem; font-weight:700;">No Pending City Requests</h4>
                <p style="margin:0; font-size:0.85rem;">All user city requests have been reviewed and approved or cleared.</p>
            </div>
        `;
        return;
    }

    // Sort pending requests: newest first
    const sorted = [...pending].sort((a, b) => {
        const aDate = new Date(a.createdAt || a.submittedAt || 0).getTime();
        const bDate = new Date(b.createdAt || b.submittedAt || 0).getTime();
        return bDate - aDate;
    });

    listContainer.innerHTML = sorted.map(r => {
        const isPending = (r.status === 'Pending' || !r.status);
        const isApproved = r.status === 'Approved';
        const isRejected = r.status === 'Rejected';

        const statusBadge = isPending 
            ? '<span style="background:#fef3c7; color:#92400e; padding:3px 10px; border-radius:20px; font-size:0.75rem; font-weight:700; display:inline-flex; align-items:center; gap:4px;"><i class="fa-solid fa-clock"></i> Pending Review</span>'
            : (isApproved
                ? '<span style="background:#dcfce7; color:#15803d; padding:3px 10px; border-radius:20px; font-size:0.75rem; font-weight:700; display:inline-flex; align-items:center; gap:4px;"><i class="fa-solid fa-check"></i> Approved</span>'
                : '<span style="background:#fee2e2; color:#b91c1c; padding:3px 10px; border-radius:20px; font-size:0.75rem; font-weight:700; display:inline-flex; align-items:center; gap:4px;"><i class="fa-solid fa-xmark"></i> Rejected</span>');

        const submittedDate = r.createdAt || r.submittedAt 
            ? new Date(r.createdAt || r.submittedAt).toLocaleDateString('en-US', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) 
            : 'Recently';

        const cityName = r.cityName || r.name || 'City Request';
        const district = r.district || 'N/A';
        const state = r.state || 'West Bengal';
        const pincode = r.pincode || r.pin || 'N/A';
        const userDisplay = r.userName || r.userEmail || (r.userId ? '#' + r.userId : 'Local User');

        return `
            <div style="background:#ffffff; border:1px solid ${isPending ? '#fcd34d' : '#e2e8f0'}; border-radius:12px; padding:1.1rem 1.25rem; display:flex; flex-direction:column; gap:0.75rem; box-shadow:0 1px 4px rgba(0,0,0,0.03);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.5rem; flex-wrap:wrap;">
                    <div>
                        <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                            <h4 style="margin:0; font-size:1.1rem; font-weight:800; color:#0f172a;"><i class="fa-solid fa-city" style="color:#d97706; margin-right:4px;"></i> ${escapeAdminHtml(cityName)}</h4>
                            ${statusBadge}
                        </div>
                        <div style="font-size:0.84rem; color:#475569; margin-top:0.35rem; display:flex; gap:0.75rem; flex-wrap:wrap;">
                            <span><strong>District:</strong> ${escapeAdminHtml(district)}</span> &bull; 
                            <span><strong>State:</strong> ${escapeAdminHtml(state)}</span> &bull; 
                            <span><strong>PIN:</strong> ${escapeAdminHtml(pincode)}</span>
                        </div>
                    </div>
                    <div style="font-size:0.76rem; color:#94a3b8; text-align:right;">
                        <div style="font-weight:600;"><i class="fa-regular fa-clock"></i> ${submittedDate}</div>
                        <div style="margin-top:2px;"><i class="fa-regular fa-user"></i> By: <strong>${escapeAdminHtml(userDisplay)}</strong></div>
                    </div>
                </div>

                ${isPending ? `
                    <div style="display:flex; justify-content:flex-end; gap:0.5rem; padding-top:0.5rem; border-top:1px dashed #e2e8f0;">
                        <button type="button" onclick="window.adminRejectCityRequest('${escapeAdminHtml(r.id)}')" style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; padding:0.45rem 0.95rem; border-radius:8px; font-weight:700; font-size:0.82rem; cursor:pointer; display:inline-flex; align-items:center; gap:0.35rem;">
                            <i class="fa-solid fa-xmark"></i> Reject
                        </button>
                        <button type="button" onclick="window.adminToggleCityEdit('${escapeAdminHtml(r.id)}', true)" style="background:linear-gradient(135deg, #16a34a, #15803d); color:#ffffff; border:none; padding:0.45rem 1.15rem; border-radius:8px; font-weight:800; font-size:0.84rem; cursor:pointer; box-shadow:0 2px 8px rgba(22,163,74,0.3); display:inline-flex; align-items:center; gap:0.4rem;">
                            <i class="fa-solid fa-pen-to-square"></i> Edit & Approve
                        </button>
                    </div>

                    <!-- Inline Edit Form -->
                    <div id="cityEditForm_${escapeAdminHtml(r.id)}" style="display:none; background:#f8fafc; border:1px solid #cbd5e1; border-radius:10px; padding:1rem; margin-top:0.5rem;">
                        <div style="font-size:0.85rem; font-weight:800; color:#1e293b; margin-bottom:0.75rem; display:flex; align-items:center; gap:0.4rem;">
                            <i class="fa-solid fa-sliders" style="color:#2563eb;"></i> Verify / Edit City Details Before Publishing
                        </div>
                        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:0.75rem; margin-bottom:0.85rem;">
                            <div>
                                <label style="display:block; font-size:0.75rem; font-weight:700; color:#475569; margin-bottom:3px;">City Name *</label>
                                <input type="text" id="editCityName_${escapeAdminHtml(r.id)}" value="${escapeAdminHtml(cityName)}" style="width:100%; padding:0.45rem 0.65rem; border:1px solid #cbd5e1; border-radius:6px; font-size:0.85rem; font-weight:700; box-sizing:border-box;">
                            </div>
                            <div>
                                <label style="display:block; font-size:0.75rem; font-weight:700; color:#475569; margin-bottom:3px;">District *</label>
                                <input type="text" id="editCityDistrict_${escapeAdminHtml(r.id)}" value="${escapeAdminHtml(district)}" style="width:100%; padding:0.45rem 0.65rem; border:1px solid #cbd5e1; border-radius:6px; font-size:0.85rem; box-sizing:border-box;">
                            </div>
                            <div>
                                <label style="display:block; font-size:0.75rem; font-weight:700; color:#475569; margin-bottom:3px;">State *</label>
                                <input type="text" id="editCityState_${escapeAdminHtml(r.id)}" value="${escapeAdminHtml(state)}" style="width:100%; padding:0.45rem 0.65rem; border:1px solid #cbd5e1; border-radius:6px; font-size:0.85rem; box-sizing:border-box;">
                            </div>
                            <div>
                                <label style="display:block; font-size:0.75rem; font-weight:700; color:#475569; margin-bottom:3px;">PIN Code (Optional)</label>
                                <input type="text" id="editCityPin_${escapeAdminHtml(r.id)}" value="${escapeAdminHtml(pincode === 'N/A' ? '' : pincode)}" style="width:100%; padding:0.45rem 0.65rem; border:1px solid #cbd5e1; border-radius:6px; font-size:0.85rem; box-sizing:border-box;">
                            </div>
                        </div>
                        <div style="display:flex; justify-content:flex-end; gap:0.5rem;">
                            <button type="button" onclick="window.adminToggleCityEdit('${escapeAdminHtml(r.id)}', false)" style="background:#ffffff; color:#64748b; border:1px solid #cbd5e1; padding:0.45rem 0.85rem; border-radius:6px; font-size:0.82rem; font-weight:700; cursor:pointer;">Cancel</button>
                            <button type="button" onclick="window.adminSubmitApproveCity('${escapeAdminHtml(r.id)}')" style="background:#16a34a; color:#ffffff; border:none; padding:0.45rem 1.15rem; border-radius:6px; font-size:0.84rem; font-weight:800; cursor:pointer; box-shadow:0 2px 6px rgba(22,163,74,0.3); display:inline-flex; align-items:center; gap:0.35rem;">
                                <i class="fa-solid fa-check"></i> Save & Publish City
                            </button>
                        </div>
                    </div>
                ` : (isApproved ? `
                    <div style="background:#f0fdf4; border:1px solid #bbf7d0; color:#15803d; padding:0.45rem 0.85rem; border-radius:8px; font-size:0.8rem; font-weight:700; display:flex; align-items:center; gap:0.4rem;">
                        <i class="fa-solid fa-circle-check"></i> Published to All Cities as "${escapeAdminHtml(r.approvedCityName || cityName)}"
                    </div>
                ` : `
                    <div style="background:#fef2f2; border:1px solid #fecaca; color:#b91c1c; padding:0.45rem 0.85rem; border-radius:8px; font-size:0.8rem; font-weight:700; display:flex; align-items:center; gap:0.4rem;">
                        <i class="fa-solid fa-circle-xmark"></i> Request Rejected
                    </div>
                `)}
            </div>
        `;
    }).join('');
};

window.adminToggleCityEdit = function(reqId, show) {
    const form = document.getElementById('cityEditForm_' + reqId);
    if (form) {
        form.style.display = show ? 'block' : 'none';
        if (show) {
            document.getElementById('editCityName_' + reqId)?.focus();
        }
    }
};

window.adminSubmitApproveCity = async function(reqId) {
    let reqs = [];
    try {
        const raw = localStorage.getItem('lb_city_requests');
        reqs = raw ? JSON.parse(raw) : [];
    } catch {}

    const req = reqs.find(r => r && String(r.id) === String(reqId));
    if (!req) return;

    const finalCityName = (document.getElementById('editCityName_' + reqId)?.value || '').trim();
    const finalDistrict = (document.getElementById('editCityDistrict_' + reqId)?.value || '').trim();
    const finalState = (document.getElementById('editCityState_' + reqId)?.value || 'West Bengal').trim();
    const finalPin = (document.getElementById('editCityPin_' + reqId)?.value || '').trim();

    if (!finalCityName) {
        alert('City name cannot be empty.');
        return;
    }

    const cities = getDB(DB_KEYS.CITIES, []);
    const existing = cities.find(c => (c.name || '').toLowerCase() === finalCityName.toLowerCase());
    let newCityObj = null;

    if (!existing) {
        newCityObj = {
            id: 'CITY-' + Date.now(),
            name: finalCityName,
            district: finalDistrict,
            state: finalState,
            pincode: finalPin,
            placesCount: 0,
            activeStores: 0,
            isMetro: false,
            createdAt: new Date().toISOString()
        };
        cities.push(newCityObj);
        setDB(DB_KEYS.CITIES, cities);

        if (window.lbCloudSync && typeof window.lbCloudSync.saveCity === 'function') {
            window.lbCloudSync.saveCity(newCityObj);
        }
    }

    // Permanently remove request from pending queue and cloud database
    reqs = reqs.filter(r => r && String(r.id) !== String(reqId));
    localStorage.setItem('lb_city_requests', JSON.stringify(reqs));

    if (window.lbCloudSync && typeof window.lbCloudSync.deleteCityRequest === 'function') {
        window.lbCloudSync.deleteCityRequest(reqId);
    }

    refreshAll();
    window.renderAdminCityRequests();
    alert(`City "${finalCityName}" approved and added to All Cities!`);
};

window.adminRejectCityRequest = async function(reqId) {
    let reqs = [];
    try {
        const raw = localStorage.getItem('lb_city_requests');
        reqs = raw ? JSON.parse(raw) : [];
    } catch {}

    const req = reqs.find(r => r && String(r.id) === String(reqId));
    if (!req) return;

    if (!confirm(`Are you sure you want to reject the request for city "${req.cityName || req.name}"?`)) return;

    // Permanently remove rejected request from pending queue and cloud database
    reqs = reqs.filter(r => r && String(r.id) !== String(reqId));
    localStorage.setItem('lb_city_requests', JSON.stringify(reqs));

    if (window.lbCloudSync && typeof window.lbCloudSync.deleteCityRequest === 'function') {
        window.lbCloudSync.deleteCityRequest(reqId);
    }

    refreshAll();
    window.renderAdminCityRequests();
};

// 2. Category Requests Modal Controller
window.openCategoryRequestsModal = function() {
    window.renderAdminCategoryRequests();
    window.openModal('adminCategoryRequestsModal');
};

window.renderAdminCategoryRequests = function() {
    const listContainer = document.getElementById('adminCategoryRequestsContainer') || document.getElementById('adminCategoryRequestsList');
    const badge = document.getElementById('badgeCatRequestsCount');
    const statVal = document.getElementById('totalCatRequestsCount');
    const statSub = document.getElementById('catRequestsSubtext');
    if (!listContainer) return;

    let reqs = [];
    try {
        const raw = localStorage.getItem('lb_category_requests');
        reqs = raw ? JSON.parse(raw) : [];
    } catch {}

    // Strictly show only active Pending requests so approved/rejected items never clutter the popup
    const pending = reqs.filter(r => r && (r.status === 'Pending' || !r.status));
    const pendingCount = pending.length;

    if (badge) {
        badge.textContent = pendingCount;
        badge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
    }
    if (statVal) statVal.textContent = pendingCount;
    if (statSub) {
        statSub.innerHTML = pendingCount > 0
            ? `<span style="color:#d97706; font-weight:700;"><i class="fa-solid fa-bell"></i> ${pendingCount} pending requests</span>`
            : '0 pending requests';
    }

    if (pendingCount === 0) {
        listContainer.innerHTML = `
            <div style="text-align:center; padding:3rem 1rem; color:#94a3b8;">
                <i class="fa-solid fa-layer-group" style="font-size:2.5rem; margin-bottom:0.75rem; color:#cbd5e1; display:block;"></i>
                <h4 style="margin:0 0 0.25rem 0; color:#475569; font-size:1.05rem; font-weight:700;">No Pending Category Requests</h4>
                <p style="margin:0; font-size:0.85rem;">All user category requests have been reviewed and approved or cleared.</p>
            </div>
        `;
        return;
    }

    // Sort pending requests: newest first
    const sorted = [...pending].sort((a, b) => {
        const aDate = new Date(a.createdAt || a.submittedAt || 0).getTime();
        const bDate = new Date(b.createdAt || b.submittedAt || 0).getTime();
        return bDate - aDate;
    });

    listContainer.innerHTML = sorted.map(r => {
        const isPending = (r.status === 'Pending' || !r.status);
        const isApproved = r.status === 'Approved';
        const isRejected = r.status === 'Rejected';

        const statusBadge = isPending 
            ? '<span style="background:#fef3c7; color:#92400e; padding:3px 10px; border-radius:20px; font-size:0.75rem; font-weight:700; display:inline-flex; align-items:center; gap:4px;"><i class="fa-solid fa-clock"></i> Pending Review</span>'
            : (isApproved
                ? '<span style="background:#dcfce7; color:#15803d; padding:3px 10px; border-radius:20px; font-size:0.75rem; font-weight:700; display:inline-flex; align-items:center; gap:4px;"><i class="fa-solid fa-check"></i> Approved</span>'
                : '<span style="background:#fee2e2; color:#b91c1c; padding:3px 10px; border-radius:20px; font-size:0.75rem; font-weight:700; display:inline-flex; align-items:center; gap:4px;"><i class="fa-solid fa-xmark"></i> Rejected</span>');

        const submittedDate = r.createdAt || r.submittedAt 
            ? new Date(r.createdAt || r.submittedAt).toLocaleDateString('en-US', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) 
            : 'Recently';

        const catName = r.categoryName || r.name || 'Category Request';
        const tags = r.subcategories || r.keywords || r.tags || r.tag || 'General';
        const userDisplay = r.userName || r.userEmail || (r.userId ? '#' + r.userId : 'Local User');

        return `
            <div style="background:#ffffff; border:1px solid ${isPending ? '#fcd34d' : '#e2e8f0'}; border-radius:12px; padding:1.1rem 1.25rem; display:flex; flex-direction:column; gap:0.75rem; box-shadow:0 1px 4px rgba(0,0,0,0.03);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.5rem; flex-wrap:wrap;">
                    <div>
                        <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                            <h4 style="margin:0; font-size:1.1rem; font-weight:800; color:#0f172a;"><i class="fa-solid fa-layer-group" style="color:#0284c7; margin-right:4px;"></i> ${escapeAdminHtml(catName)}</h4>
                            ${statusBadge}
                        </div>
                        <div style="font-size:0.84rem; color:#475569; margin-top:0.35rem;">
                            <span><i class="fa-solid fa-tags" style="color:#2563eb;"></i> <strong>Suggested Tags / Subcategories:</strong> ${escapeAdminHtml(tags)}</span>
                        </div>
                        ${r.note ? `<div style="font-size:0.8rem; color:#475569; margin-top:0.35rem; background:#f8fafc; padding:0.35rem 0.6rem; border-radius:6px;"><strong>Note:</strong> ${escapeAdminHtml(r.note)}</div>` : ''}
                    </div>
                    <div style="font-size:0.76rem; color:#94a3b8; text-align:right;">
                        <div style="font-weight:600;"><i class="fa-regular fa-clock"></i> ${submittedDate}</div>
                        <div style="margin-top:2px;"><i class="fa-regular fa-user"></i> By: <strong>${escapeAdminHtml(userDisplay)}</strong></div>
                    </div>
                </div>

                ${isPending ? `
                    <div style="display:flex; justify-content:flex-end; gap:0.5rem; padding-top:0.5rem; border-top:1px dashed #e2e8f0;">
                        <button type="button" onclick="window.adminRejectCategoryRequest('${escapeAdminHtml(r.id)}')" style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; padding:0.45rem 0.95rem; border-radius:8px; font-weight:700; font-size:0.82rem; cursor:pointer; display:inline-flex; align-items:center; gap:0.35rem;">
                            <i class="fa-solid fa-xmark"></i> Reject
                        </button>
                        <button type="button" onclick="window.adminToggleCatEdit('${escapeAdminHtml(r.id)}', true)" style="background:linear-gradient(135deg, #0284c7, #0369a1); color:#ffffff; border:none; padding:0.45rem 1.15rem; border-radius:8px; font-weight:800; font-size:0.84rem; cursor:pointer; box-shadow:0 2px 8px rgba(2,132,199,0.3); display:inline-flex; align-items:center; gap:0.4rem;">
                            <i class="fa-solid fa-pen-to-square"></i> Edit & Approve
                        </button>
                    </div>

                    <!-- Inline Edit Form -->
                    <div id="catEditForm_${escapeAdminHtml(r.id)}" style="display:none; background:#f8fafc; border:1px solid #cbd5e1; border-radius:10px; padding:1rem; margin-top:0.5rem;">
                        <div style="font-size:0.85rem; font-weight:800; color:#1e293b; margin-bottom:0.75rem; display:flex; align-items:center; gap:0.4rem;">
                            <i class="fa-solid fa-sliders" style="color:#0284c7;"></i> Verify / Edit Category Details Before Publishing
                        </div>
                        <div style="display:flex; flex-direction:column; gap:0.75rem; margin-bottom:0.85rem;">
                            <div>
                                <label style="display:block; font-size:0.75rem; font-weight:700; color:#475569; margin-bottom:3px;">Category Title *</label>
                                <input type="text" id="editCatName_${escapeAdminHtml(r.id)}" value="${escapeAdminHtml(catName)}" style="width:100%; padding:0.45rem 0.65rem; border:1px solid #cbd5e1; border-radius:6px; font-size:0.85rem; font-weight:700; box-sizing:border-box;">
                            </div>
                            <div>
                                <label style="display:block; font-size:0.75rem; font-weight:700; color:#475569; margin-bottom:3px;">Search Keywords / Tags (Comma-separated)</label>
                                <input type="text" id="editCatTags_${escapeAdminHtml(r.id)}" value="${escapeAdminHtml(tags)}" style="width:100%; padding:0.45rem 0.65rem; border:1px solid #cbd5e1; border-radius:6px; font-size:0.85rem; box-sizing:border-box;">
                            </div>
                        </div>
                        <div style="display:flex; justify-content:flex-end; gap:0.5rem;">
                            <button type="button" onclick="window.adminToggleCatEdit('${escapeAdminHtml(r.id)}', false)" style="background:#ffffff; color:#64748b; border:1px solid #cbd5e1; padding:0.45rem 0.85rem; border-radius:6px; font-size:0.82rem; font-weight:700; cursor:pointer;">Cancel</button>
                            <button type="button" onclick="window.adminSubmitApproveCategory('${escapeAdminHtml(r.id)}')" style="background:#0284c7; color:#ffffff; border:none; padding:0.45rem 1.15rem; border-radius:6px; font-size:0.84rem; font-weight:800; cursor:pointer; box-shadow:0 2px 6px rgba(2,132,199,0.3); display:inline-flex; align-items:center; gap:0.35rem;">
                                <i class="fa-solid fa-check"></i> Save & Publish Category
                            </button>
                        </div>
                    </div>
                ` : (isApproved ? `
                    <div style="background:#f0fdf4; border:1px solid #bbf7d0; color:#15803d; padding:0.45rem 0.85rem; border-radius:8px; font-size:0.8rem; font-weight:700; display:flex; align-items:center; gap:0.4rem;">
                        <i class="fa-solid fa-circle-check"></i> Published to All Categories as "${escapeAdminHtml(r.approvedCategoryName || catName)}"
                    </div>
                ` : `
                    <div style="background:#fef2f2; border:1px solid #fecaca; color:#b91c1c; padding:0.45rem 0.85rem; border-radius:8px; font-size:0.8rem; font-weight:700; display:flex; align-items:center; gap:0.4rem;">
                        <i class="fa-solid fa-circle-xmark"></i> Request Rejected
                    </div>
                `)}
            </div>
        `;
    }).join('');
};

window.adminToggleCatEdit = function(reqId, show) {
    const form = document.getElementById('catEditForm_' + reqId);
    if (form) {
        form.style.display = show ? 'block' : 'none';
        if (show) {
            document.getElementById('editCatName_' + reqId)?.focus();
        }
    }
};

window.adminSubmitApproveCategory = async function(reqId) {
    let reqs = [];
    try {
        const raw = localStorage.getItem('lb_category_requests');
        reqs = raw ? JSON.parse(raw) : [];
    } catch {}

    const req = reqs.find(r => r && String(r.id) === String(reqId));
    if (!req) return;

    const finalCatName = (document.getElementById('editCatName_' + reqId)?.value || '').trim();
    const finalTags = (document.getElementById('editCatTags_' + reqId)?.value || '').trim();

    if (!finalCatName) {
        alert('Category title cannot be empty.');
        return;
    }

    const categories = getDB(DB_KEYS.CATEGORIES, []);
    const existing = categories.find(c => (c.name || '').toLowerCase() === finalCatName.toLowerCase());
    let newCatObj = null;

    if (!existing) {
        newCatObj = {
            id: 'CAT-' + Date.now(),
            name: finalCatName,
            icon: 'fa-solid fa-store',
            tags: finalTags ? finalTags.split(',').map(s => s.trim()).filter(Boolean) : [finalCatName],
            subcategories: finalTags ? finalTags.split(',').map(s => s.trim()).filter(Boolean) : [],
            placesCount: 0,
            featured: false,
            createdAt: new Date().toISOString()
        };
        categories.push(newCatObj);
        setDB(DB_KEYS.CATEGORIES, categories);

        if (window.lbCloudSync && typeof window.lbCloudSync.saveCategory === 'function') {
            window.lbCloudSync.saveCategory(newCatObj);
        }
    }

    // Permanently remove request from pending category queue and cloud database
    reqs = reqs.filter(r => r && String(r.id) !== String(reqId));
    localStorage.setItem('lb_category_requests', JSON.stringify(reqs));

    if (window.lbCloudSync && typeof window.lbCloudSync.deleteCategoryRequest === 'function') {
        window.lbCloudSync.deleteCategoryRequest(reqId);
    }

    refreshAll();
    window.renderAdminCategoryRequests();
    alert(`Category "${finalCatName}" approved and added to All Categories!`);
};

window.adminRejectCategoryRequest = async function(reqId) {
    let reqs = [];
    try {
        const raw = localStorage.getItem('lb_category_requests');
        reqs = raw ? JSON.parse(raw) : [];
    } catch {}

    const req = reqs.find(r => r && String(r.id) === String(reqId));
    if (!req) return;

    if (!confirm(`Are you sure you want to reject the request for category "${req.categoryName || req.name}"?`)) return;

    // Permanently remove rejected request from category queue and cloud database
    reqs = reqs.filter(r => r && String(r.id) !== String(reqId));
    localStorage.setItem('lb_category_requests', JSON.stringify(reqs));

    if (window.lbCloudSync && typeof window.lbCloudSync.deleteCategoryRequest === 'function') {
        window.lbCloudSync.deleteCategoryRequest(reqId);
    }

    refreshAll();
    window.renderAdminCategoryRequests();
};


