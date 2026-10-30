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

// ================= USER CITY REQUESTS & CATEGORY REQUESTS CONTROLLERS =================

// 1. City Requests Modal Controller
window.openCityRequestsModal = function() {
    window.renderAdminCityRequests();
    const modal = document.getElementById('adminCityRequestsModal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
    }
};

window.renderAdminCityRequests = function() {
    const container = document.getElementById('adminCityRequestsContainer');
    if (!container) return;

    let reqs = [];
    try {
        const raw = localStorage.getItem('lb_city_requests');
        reqs = raw ? JSON.parse(raw) : [];
    } catch {}

    const pending = reqs.filter(r => r.status === 'Pending' || !r.status);

    if (pending.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:2.5rem 1rem; color:#64748b;">
                <i class="fa-solid fa-city" style="font-size:2.5rem; color:#cbd5e1; margin-bottom:0.75rem; display:block;"></i>
                <h4 style="margin:0 0 0.35rem 0; color:#334155; font-size:1.05rem;">No Pending City Requests</h4>
                <p style="margin:0; font-size:0.85rem;">When users request new cities during listing creation, they will appear here for verification and approval.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = pending.map((r, idx) => {
        const dateStr = r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : 'Recently';
        return `
            <div class="city-request-card" id="cityReqCard_${r.id}" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px; padding:1.1rem; margin-bottom:1rem; transition:all 0.2s;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.75rem; flex-wrap:wrap; gap:0.5rem;">
                    <div>
                        <span style="display:inline-block; background:#fef3c7; color:#b45309; padding:2px 8px; border-radius:6px; font-size:0.72rem; font-weight:800; text-transform:uppercase; margin-bottom:4px;">City Request #${idx + 1}</span>
                        <h4 style="margin:0; font-size:1.15rem; color:#1e293b; font-weight:800;">
                            <span id="dispCityName_${r.id}">${escapeHtml(r.cityName || r.name || '')}</span>
                        </h4>
                        <div style="font-size:0.8rem; color:#64748b; margin-top:2px;">
                            District: <strong>${escapeHtml(r.district || 'N/A')}</strong> | State: <strong>${escapeHtml(r.state || 'West Bengal')}</strong> | PIN: <strong>${escapeHtml(r.pincode || 'N/A')}</strong>
                        </div>
                    </div>
                    <div style="text-align:right;">
                        <span style="font-size:0.75rem; color:#94a3b8;"><i class="fa-regular fa-clock"></i> ${dateStr}</span>
                        <div style="font-size:0.75rem; color:#64748b; margin-top:2px;">By: <strong>${escapeHtml(r.userName || r.userEmail || 'User')}</strong></div>
                    </div>
                </div>

                <!-- Editable Fields for Admin to clean spelling/case before approval -->
                <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:10px; padding:0.85rem; margin-bottom:0.75rem;">
                    <div style="font-size:0.75rem; font-weight:700; color:#475569; margin-bottom:0.5rem; text-transform:uppercase; letter-spacing:0.5px;">
                        <i class="fa-solid fa-pen-to-square" style="color:#3b82f6;"></i> Admin Edit & Verify Spelling
                    </div>
                    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:0.5rem;">
                        <div>
                            <label style="font-size:0.72rem; font-weight:700; color:#64748b; display:block; margin-bottom:2px;">City Name *</label>
                            <input type="text" id="editCityReqName_${r.id}" value="${escapeHtml(r.cityName || r.name || '')}" style="width:100%; padding:0.45rem 0.6rem; border:1px solid #cbd5e1; border-radius:6px; font-size:0.82rem; font-weight:700; color:#1e293b; box-sizing:border-box;">
                        </div>
                        <div>
                            <label style="font-size:0.72rem; font-weight:700; color:#64748b; display:block; margin-bottom:2px;">District *</label>
                            <input type="text" id="editCityReqDistrict_${r.id}" value="${escapeHtml(r.district || '')}" style="width:100%; padding:0.45rem 0.6rem; border:1px solid #cbd5e1; border-radius:6px; font-size:0.82rem; font-weight:600; color:#1e293b; box-sizing:border-box;">
                        </div>
                        <div>
                            <label style="font-size:0.72rem; font-weight:700; color:#64748b; display:block; margin-bottom:2px;">State *</label>
                            <input type="text" id="editCityReqState_${r.id}" value="${escapeHtml(r.state || 'West Bengal')}" style="width:100%; padding:0.45rem 0.6rem; border:1px solid #cbd5e1; border-radius:6px; font-size:0.82rem; font-weight:600; color:#1e293b; box-sizing:border-box;">
                        </div>
                        <div>
                            <label style="font-size:0.72rem; font-weight:700; color:#64748b; display:block; margin-bottom:2px;">PIN Code *</label>
                            <input type="text" id="editCityReqPin_${r.id}" value="${escapeHtml(r.pincode || '')}" style="width:100%; padding:0.45rem 0.6rem; border:1px solid #cbd5e1; border-radius:6px; font-size:0.82rem; font-weight:600; color:#1e293b; box-sizing:border-box;">
                        </div>
                    </div>
                </div>

                <div style="display:flex; justify-content:flex-end; gap:0.5rem;">
                    <button type="button" onclick="window.adminRejectCityRequest('${r.id}')" style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; padding:0.45rem 0.9rem; border-radius:8px; font-weight:700; font-size:0.8rem; cursor:pointer;">
                        <i class="fa-solid fa-xmark"></i> Reject
                    </button>
                    <button type="button" onclick="window.adminApproveCityRequest('${r.id}')" style="background:linear-gradient(135deg, #16a34a, #15803d); color:#ffffff; border:none; padding:0.45rem 1.1rem; border-radius:8px; font-weight:800; font-size:0.82rem; cursor:pointer; box-shadow:0 2px 8px rgba(22,163,74,0.3);">
                        <i class="fa-solid fa-circle-check"></i> Approve & Add to All Cities
                    </button>
                </div>
            </div>
        `;
    }).join('');
};

window.adminApproveCityRequest = async function(reqId) {
    let reqs = [];
    try {
        const raw = localStorage.getItem('lb_city_requests');
        reqs = raw ? JSON.parse(raw) : [];
    } catch {}

    const req = reqs.find(r => String(r.id) === String(reqId));
    if (!req) return;

    const finalCityName = (document.getElementById(`editCityReqName_${reqId}`)?.value || req.cityName || req.name || '').trim();
    const finalDistrict = (document.getElementById(`editCityReqDistrict_${reqId}`)?.value || req.district || '').trim();
    const finalState = (document.getElementById(`editCityReqState_${reqId}`)?.value || req.state || 'West Bengal').trim();
    const finalPin = (document.getElementById(`editCityReqPin_${reqId}`)?.value || req.pincode || '').trim();

    if (!finalCityName) {
        alert('Please provide a valid City Name.');
        return;
    }

    const ok = await window.adminSecurityConfirm({
        title: 'Approve City Request',
        message: `Are you sure you want to approve <strong>"${finalCityName}"</strong> (${finalDistrict}, ${finalState} - ${finalPin}) and add it permanently to All Cities?`,
        actionType: 'edit'
    });
    if (!ok) return;

    // 1. Add city to lb_cities
    let cities = getDB(DB_KEYS.CITIES);
    const existingIndex = cities.findIndex(c => (c.name || c).toLowerCase() === finalCityName.toLowerCase());

    const cityObj = {
        name: finalCityName,
        district: finalDistrict,
        state: finalState,
        pincode: finalPin
    };

    if (existingIndex > -1) {
        cities[existingIndex] = cityObj;
    } else {
        cities.push(cityObj);
    }
    setDB(DB_KEYS.CITIES, cities);

    // 2. Mark request as Approved
    req.status = 'Approved';
    req.approvedCityName = finalCityName;
    req.approvedAt = new Date().toISOString();
    localStorage.setItem('lb_city_requests', JSON.stringify(reqs));

    if (window.lbCloudSync && typeof window.lbCloudSync.saveCityRequest === 'function') {
        window.lbCloudSync.saveCityRequest(req);
    }
    if (window.lbCloudSync && typeof window.lbCloudSync.saveCity === 'function') {
        window.lbCloudSync.saveCity(cityObj);
    }

    refreshAll();
    window.renderAdminCityRequests();
    alert(`City "${finalCityName}" approved and live in All Cities! Users can now search and add listings in ${finalCityName}.`);
};

window.adminRejectCityRequest = async function(reqId) {
    let reqs = [];
    try {
        const raw = localStorage.getItem('lb_city_requests');
        reqs = raw ? JSON.parse(raw) : [];
    } catch {}

    const req = reqs.find(r => String(r.id) === String(reqId));
    if (!req) return;

    const ok = await window.adminSecurityConfirm({
        title: 'Reject City Request',
        message: `Are you sure you want to reject the request for city <strong>"${req.cityName || req.name}"</strong>?`,
        actionType: 'delete'
    });
    if (!ok) return;

    req.status = 'Rejected';
    req.rejectedAt = new Date().toISOString();
    localStorage.setItem('lb_city_requests', JSON.stringify(reqs));

    if (window.lbCloudSync && typeof window.lbCloudSync.saveCityRequest === 'function') {
        window.lbCloudSync.saveCityRequest(req);
    }

    refreshAll();
    window.renderAdminCityRequests();
};

// 2. Category Requests Modal Controller
window.openCategoryRequestsModal = function() {
    window.renderAdminCategoryRequests();
    const modal = document.getElementById('adminCategoryRequestsModal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
    }
};

window.renderAdminCategoryRequests = function() {
    const container = document.getElementById('adminCategoryRequestsContainer');
    if (!container) return;

    let reqs = [];
    try {
        const raw = localStorage.getItem('lb_category_requests');
        reqs = raw ? JSON.parse(raw) : [];
    } catch {}

    const pending = reqs.filter(r => r.status === 'Pending' || !r.status);

    if (pending.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:2.5rem 1rem; color:#64748b;">
                <i class="fa-solid fa-tags" style="font-size:2.5rem; color:#cbd5e1; margin-bottom:0.75rem; display:block;"></i>
                <h4 style="margin:0 0 0.35rem 0; color:#334155; font-size:1.05rem;">No Pending Category Requests</h4>
                <p style="margin:0; font-size:0.85rem;">When users request new categories during listing creation, they will appear here for verification and approval.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = pending.map((r, idx) => {
        const dateStr = r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : 'Recently';
        return `
            <div class="cat-request-card" id="catReqCard_${r.id}" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px; padding:1.1rem; margin-bottom:1rem; transition:all 0.2s;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.75rem; flex-wrap:wrap; gap:0.5rem;">
                    <div>
                        <span style="display:inline-block; background:#e0f2fe; color:#0369a1; padding:2px 8px; border-radius:6px; font-size:0.72rem; font-weight:800; text-transform:uppercase; margin-bottom:4px;">Category Request #${idx + 1}</span>
                        <h4 style="margin:0; font-size:1.15rem; color:#1e293b; font-weight:800;">
                            <span id="dispCatName_${r.id}">${escapeHtml(r.categoryName || r.name || '')}</span>
                        </h4>
                        <div style="font-size:0.8rem; color:#64748b; margin-top:2px;">
                            Sector/Tag: <strong>${escapeHtml(r.tag || 'General')}</strong> | Subcategories: <strong>${escapeHtml(r.subcategories || r.desc || 'None')}</strong>
                        </div>
                    </div>
                    <div style="text-align:right;">
                        <span style="font-size:0.75rem; color:#94a3b8;"><i class="fa-regular fa-clock"></i> ${dateStr}</span>
                        <div style="font-size:0.75rem; color:#64748b; margin-top:2px;">By: <strong>${escapeHtml(r.userName || r.userEmail || 'User')}</strong></div>
                    </div>
                </div>

                <!-- Editable Fields for Admin to clean spelling/case before approval -->
                <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:10px; padding:0.85rem; margin-bottom:0.75rem;">
                    <div style="font-size:0.75rem; font-weight:700; color:#475569; margin-bottom:0.5rem; text-transform:uppercase; letter-spacing:0.5px;">
                        <i class="fa-solid fa-pen-to-square" style="color:#0284c7;"></i> Admin Edit & Set Icon
                    </div>
                    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:0.5rem;">
                        <div>
                            <label style="font-size:0.72rem; font-weight:700; color:#64748b; display:block; margin-bottom:2px;">Category Title *</label>
                            <input type="text" id="editCatReqName_${r.id}" value="${escapeHtml(r.categoryName || r.name || '')}" style="width:100%; padding:0.45rem 0.6rem; border:1px solid #cbd5e1; border-radius:6px; font-size:0.82rem; font-weight:700; color:#1e293b; box-sizing:border-box;">
                        </div>
                        <div>
                            <label style="font-size:0.72rem; font-weight:700; color:#64748b; display:block; margin-bottom:2px;">Sector / Group Tag *</label>
                            <input type="text" id="editCatReqTag_${r.id}" value="${escapeHtml(r.tag || 'Shopping')}" style="width:100%; padding:0.45rem 0.6rem; border:1px solid #cbd5e1; border-radius:6px; font-size:0.82rem; font-weight:600; color:#1e293b; box-sizing:border-box;">
                        </div>
                        <div>
                            <label style="font-size:0.72rem; font-weight:700; color:#64748b; display:block; margin-bottom:2px;">Subcategories (comma separated)</label>
                            <input type="text" id="editCatReqSub_${r.id}" value="${escapeHtml(r.subcategories || '')}" placeholder="e.g. Mens, Womens, Kids" style="width:100%; padding:0.45rem 0.6rem; border:1px solid #cbd5e1; border-radius:6px; font-size:0.82rem; font-weight:600; color:#1e293b; box-sizing:border-box;">
                        </div>
                        <div>
                            <label style="font-size:0.72rem; font-weight:700; color:#64748b; display:block; margin-bottom:2px;">Emoji / Icon</label>
                            <input type="text" id="editCatReqIcon_${r.id}" value="${escapeHtml(r.icon || '🏷️')}" placeholder="e.g. 🏷️ or 🛍️" style="width:100%; padding:0.45rem 0.6rem; border:1px solid #cbd5e1; border-radius:6px; font-size:0.82rem; font-weight:600; color:#1e293b; box-sizing:border-box;">
                        </div>
                    </div>
                </div>

                <div style="display:flex; justify-content:flex-end; gap:0.5rem;">
                    <button type="button" onclick="window.adminRejectCategoryRequest('${r.id}')" style="background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; padding:0.45rem 0.9rem; border-radius:8px; font-weight:700; font-size:0.8rem; cursor:pointer;">
                        <i class="fa-solid fa-xmark"></i> Reject
                    </button>
                    <button type="button" onclick="window.adminApproveCategoryRequest('${r.id}')" style="background:linear-gradient(135deg, #0284c7, #0369a1); color:#ffffff; border:none; padding:0.45rem 1.1rem; border-radius:8px; font-weight:800; font-size:0.82rem; cursor:pointer; box-shadow:0 2px 8px rgba(2,132,199,0.3);">
                        <i class="fa-solid fa-circle-check"></i> Approve & Add to All Categories
                    </button>
                </div>
            </div>
        `;
    }).join('');
};

window.adminApproveCategoryRequest = async function(reqId) {
    let reqs = [];
    try {
        const raw = localStorage.getItem('lb_category_requests');
        reqs = raw ? JSON.parse(raw) : [];
    } catch {}

    const req = reqs.find(r => String(r.id) === String(reqId));
    if (!req) return;

    const finalCatName = (document.getElementById(`editCatReqName_${reqId}`)?.value || req.categoryName || req.name || '').trim();
    const finalTag = (document.getElementById(`editCatReqTag_${reqId}`)?.value || req.tag || 'Shopping').trim();
    const finalSub = (document.getElementById(`editCatReqSub_${reqId}`)?.value || req.subcategories || '').trim();
    const finalIcon = (document.getElementById(`editCatReqIcon_${reqId}`)?.value || req.icon || '🏷️').trim();

    if (!finalCatName) {
        alert('Please provide a valid Category Name.');
        return;
    }

    const ok = await window.adminSecurityConfirm({
        title: 'Approve Category Request',
        message: `Are you sure you want to approve <strong>"${finalCatName}"</strong> (Sector: ${finalTag}) and add it permanently to All Categories?`,
        actionType: 'edit'
    });
    if (!ok) return;

    const subList = finalSub ? finalSub.split(',').map(s => s.trim()).filter(Boolean) : [];

    // 1. Add category to lb_categories
    let categories = getDB(DB_KEYS.CATEGORIES);
    const existingIndex = categories.findIndex(c => (c.name || c).toLowerCase() === finalCatName.toLowerCase());

    const catObj = {
        name: finalCatName,
        tag: finalTag,
        tags: [finalTag],
        icon: finalIcon,
        storeCategories: subList.map(s => ({ name: s, icon: '🏷️' }))
    };

    if (existingIndex > -1) {
        categories[existingIndex] = catObj;
    } else {
        categories.push(catObj);
    }
    setDB(DB_KEYS.CATEGORIES, categories);

    // 2. Mark request as Approved
    req.status = 'Approved';
    req.approvedCatName = finalCatName;
    req.approvedAt = new Date().toISOString();
    localStorage.setItem('lb_category_requests', JSON.stringify(reqs));

    if (window.lbCloudSync && typeof window.lbCloudSync.saveCategoryRequest === 'function') {
        window.lbCloudSync.saveCategoryRequest(req);
    }
    if (window.lbCloudSync && typeof window.lbCloudSync.saveCategory === 'function') {
        window.lbCloudSync.saveCategory(catObj);
    }

    refreshAll();
    window.renderAdminCategoryRequests();
    alert(`Category "${finalCatName}" approved and live in All Categories! Users can now search and list shops under ${finalCatName}.`);
};

window.adminRejectCategoryRequest = async function(reqId) {
    let reqs = [];
    try {
        const raw = localStorage.getItem('lb_category_requests');
        reqs = raw ? JSON.parse(raw) : [];
    } catch {}

    const req = reqs.find(r => String(r.id) === String(reqId));
    if (!req) return;

    const ok = await window.adminSecurityConfirm({
        title: 'Reject Category Request',
        message: `Are you sure you want to reject the request for category <strong>"${req.categoryName || req.name}"</strong>?`,
        actionType: 'delete'
    });
    if (!ok) return;

    req.status = 'Rejected';
    req.rejectedAt = new Date().toISOString();
    localStorage.setItem('lb_category_requests', JSON.stringify(reqs));

    if (window.lbCloudSync && typeof window.lbCloudSync.saveCategoryRequest === 'function') {
        window.lbCloudSync.saveCategoryRequest(req);
    }

    refreshAll();
    window.renderAdminCategoryRequests();
};

document.addEventListener('DOMContentLoaded', () => {
    if (window.isFirebaseReady && window.isFirebaseReady()) {
        initAdminCloudListeners();
    } else {
        setTimeout(initAdminCloudListeners, 1500);
    }
});
