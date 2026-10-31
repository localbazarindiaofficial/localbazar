// LocalBazar Minimalist Interactive Logic

document.addEventListener('DOMContentLoaded', () => {
    const searchForm = document.getElementById('omniSearchForm');
    const cityInput = document.getElementById('cityInput');
    const queryInput = document.getElementById('queryInput');

    // ================= HOME OMNI-SEARCH AUTOCOMPLETE (CITIES & CATEGORIES) =================
    const homeCityPopover = document.getElementById('homeCitySuggestions');
    const homeCatPopover = document.getElementById('homeCategorySuggestions');

    // High-performance In-Memory Cache for 0ms Instant Autocomplete
    let _cachedCities = null;
    let _cachedCategories = null;

    // Load ONLY real cities registered by Admin / synchronized from Cloud Firestore (Zero demo items)
    function getAdminCities() {
        if (_cachedCities) return _cachedCities;

        let stored = [];
        try {
            const raw = localStorage.getItem('lb_cities');
            stored = raw ? JSON.parse(raw) : [];
        } catch (e) {}

        if (!Array.isArray(stored)) {
            _cachedCities = [];
            return _cachedCities;
        }

        const validCities = stored
            .filter(c => c && (typeof c === 'string' ? c.trim() : (c.name && c.name.trim())))
            .map(c => typeof c === 'string' ? { name: c.trim() } : c)
            .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));

        _cachedCities = validCities;
        return _cachedCities;
    }

    // Load ONLY real categories registered by Admin / synchronized from Cloud Firestore (Zero demo items)
    function getAdminCategories() {
        if (_cachedCategories) return _cachedCategories;

        let stored = [];
        try {
            const rawCat = localStorage.getItem('lb_categories');
            stored = rawCat ? JSON.parse(rawCat) : [];
        } catch (e) {}

        if (!Array.isArray(stored)) {
            _cachedCategories = [];
            return _cachedCategories;
        }

        const validCategories = stored
            .filter(cat => cat && (typeof cat === 'string' ? cat.trim() : (cat.name && cat.name.trim())))
            .map(cat => typeof cat === 'string' ? { name: cat.trim() } : cat)
            .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));

        _cachedCategories = validCategories;
        return _cachedCategories;
    }

    // Invalidate in-memory caches whenever cloud sync completes or storage updates
    window.addEventListener('lb:cloud-synced', () => {
        _cachedCities = null;
        _cachedCategories = null;
    });
    window.addEventListener('storage', (e) => {
        if (e.key === 'lb_cities' || e.key === 'lb_categories' || e.key === 'lb_listings') {
            _cachedCities = null;
            _cachedCategories = null;
        }
    });

    // 1. City Auto-Suggest
    if (cityInput && homeCityPopover) {
        function updateHomeCitySuggestions() {
            const val = cityInput.value.trim().toLowerCase();
            const cities = getAdminCities();

            if (!val) {
                homeCityPopover.classList.remove('open');
                homeCityPopover.innerHTML = '';
                return;
            }

            // Only cities whose name starts with the typed characters (Strict Prefix Match, A-Z)
            const matches = cities
                .filter(c => (c.name || '').toLowerCase().startsWith(val))
                .slice(0, 8);

            if (matches.length === 0) {
                homeCityPopover.classList.remove('open');
                homeCityPopover.innerHTML = '';
                return;
            }

            homeCityPopover.innerHTML = matches.map(c => `
                <div class="omni-sugg-item" data-city-name="${c.name}">
                    <div class="omni-sugg-main">
                        <span class="omni-sugg-title">
                            <i class="fa-solid fa-location-dot omni-sugg-icon-city"></i>
                            ${c.name}
                        </span>
                        <div class="omni-sugg-meta">
                            ${c.district ? `<span>District: <strong>${c.district}</strong></span> • ` : ''}
                            <span>${c.state ? c.state : 'Active Hub'}</span>
                            ${c.pincode ? ` • <span class="omni-sugg-badge">PIN: ${c.pincode}</span>` : ''}
                        </div>
                    </div>
                    <span class="omni-sugg-action-arrow"><i class="fa-solid fa-arrow-turn-down-left"></i></span>
                </div>
            `).join('');

            homeCityPopover.classList.add('open');

            homeCityPopover.querySelectorAll('.omni-sugg-item').forEach(item => {
                item.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const chosen = item.getAttribute('data-city-name');
                    cityInput.value = chosen;
                    homeCityPopover.classList.remove('open');
                    homeCityPopover.innerHTML = '';
                    queryInput?.focus();
                });
            });
        }

        cityInput.addEventListener('input', updateHomeCitySuggestions);
        cityInput.addEventListener('focus', updateHomeCitySuggestions);
        cityInput.addEventListener('keyup', updateHomeCitySuggestions);
    }

    // 2. Category Auto-Suggest
    if (queryInput && homeCatPopover) {
        function updateHomeCatSuggestions() {
            const val = queryInput.value.trim().toLowerCase();
            const categories = getAdminCategories();

            if (!val) {
                homeCatPopover.classList.remove('open');
                homeCatPopover.innerHTML = '';
                return;
            }

            // Only categories whose name starts with the typed characters (Strict Prefix Match, A-Z)
            const catMatches = categories
                .filter(cat => (cat.name || '').toLowerCase().startsWith(val))
                .slice(0, 8);

            if (catMatches.length === 0) {
                homeCatPopover.classList.remove('open');
                homeCatPopover.innerHTML = '';
                return;
            }

            const html = catMatches.map(cat => {
                const rawTags = Array.isArray(cat.tags) ? cat.tags : (cat.tags ? cat.tags.split(',') : (cat.desc ? cat.desc.split(',') : []));
                const tagCount = rawTags.filter(Boolean).length;
                return `
                <div class="omni-sugg-item" data-query-val="${cat.name}">
                    <div class="omni-sugg-main">
                        <span class="omni-sugg-title">
                            <i class="fa-solid fa-layer-group omni-sugg-icon-cat"></i>
                            ${cat.name}
                        </span>
                        <div class="omni-sugg-meta">
                            <span class="omni-sugg-badge">Category</span>
                            ${tagCount > 0 ? `<span>• ${tagCount} Search Tags</span>` : ''}
                        </div>
                    </div>
                    <span class="omni-sugg-action-arrow"><i class="fa-solid fa-arrow-turn-down-left"></i> Select</span>
                </div>
                `;
            }).join('');

            homeCatPopover.innerHTML = html;
            homeCatPopover.classList.add('open');

            homeCatPopover.querySelectorAll('.omni-sugg-item').forEach(item => {
                item.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const chosen = item.getAttribute('data-query-val');
                    queryInput.value = chosen;
                    homeCatPopover.classList.remove('open');
                    homeCatPopover.innerHTML = '';
                });
            });
        }

        queryInput.addEventListener('input', updateHomeCatSuggestions);
        queryInput.addEventListener('focus', updateHomeCatSuggestions);
        queryInput.addEventListener('keyup', updateHomeCatSuggestions);

        window.addEventListener('lb:cloud-synced', () => {
            if (cityInput && document.activeElement === cityInput) updateHomeCitySuggestions();
            if (queryInput && document.activeElement === queryInput) updateHomeCatSuggestions();
        });
    }

    // Close popovers when clicking outside
    document.addEventListener('click', (e) => {
        if (cityInput && homeCityPopover && !cityInput.contains(e.target) && !homeCityPopover.contains(e.target)) {
            homeCityPopover.classList.remove('open');
        }
        if (queryInput && homeCatPopover && !queryInput.contains(e.target) && !homeCatPopover.contains(e.target)) {
            homeCatPopover.classList.remove('open');
        }
    });

    // Form Submit handling -> Redirect to listings search results page
    const cityInputError = document.getElementById('cityInputError');
    const queryInputError = document.getElementById('queryInputError');

    // Clear error highlights when user types
    cityInput?.addEventListener('input', () => {
        cityInputError?.classList.remove('show');
        cityInput?.classList.remove('input-require-shake');
    });

    queryInput?.addEventListener('input', () => {
        queryInputError?.classList.remove('show');
        queryInput?.classList.remove('input-require-shake');
    });

    if (searchForm) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const city = (cityInput?.value || '').trim();
            const query = (queryInput?.value || '').trim();

            // Reset previous tips
            cityInputError?.classList.remove('show');
            queryInputError?.classList.remove('show');

            // Professional MNC-style validation: No browser popup alerts, clean inline red badge
            if (!city && !query) {
                cityInput?.focus();
                cityInput?.classList.add('input-require-shake');
                cityInputError?.classList.add('show');
                setTimeout(() => cityInput?.classList.remove('input-require-shake'), 600);
                return;
            }

            if (city && !query) {
                // User entered city but forgot category -> Red highlighted category box & MNC tooltip
                queryInput?.focus();
                queryInput?.classList.add('input-require-shake');
                if (queryInputError) {
                    queryInputError.textContent = `Select a Category for "${city}"`;
                    queryInputError.classList.add('show');
                }
                setTimeout(() => queryInput?.classList.remove('input-require-shake'), 600);
                return;
            }

            if (!city && query) {
                // User entered category but forgot city
                cityInput?.focus();
                cityInput?.classList.add('input-require-shake');
                if (cityInputError) {
                    cityInputError.textContent = `Enter City for "${query}"`;
                    cityInputError.classList.add('show');
                }
                setTimeout(() => cityInput?.classList.remove('input-require-shake'), 600);
                return;
            }

            // Check if user is authenticated
            const rawUser = localStorage.getItem('lb_current_user');
            let currentUser = null;
            try {
                if (rawUser) currentUser = JSON.parse(rawUser);
            } catch { currentUser = null; }

            if (!currentUser) {
                // Prompt high-converting Google Login Modal before exploring
                openSearchLoginModal(city, query);
                return;
            }

            // Encode params and redirect cleanly to explore.html
            const params = new URLSearchParams();
            params.set('city', city);
            params.set('category', query);

            window.location.href = `explore.html?${params.toString()}`;
        });
    }

    // ================= PROFESSIONAL SEARCH LOGIN GATEWAY =================
    let pendingSearchData = null;

    window.openSearchLoginModal = function(city, category) {
        pendingSearchData = { city, category };
        const modal = document.getElementById('searchAuthModalOverlay');
        const label = document.getElementById('modalTargetSearchLabel');
        if (label) {
            label.textContent = `${category || 'All Categories'} in ${city || 'Your City'}`;
        }
        if (modal) {
            modal.style.display = 'flex';
        }
    };

    window.closeSearchAuthModal = function(e) {
        if (e && e.target !== e.currentTarget && e.currentTarget.id === 'searchAuthModalOverlay') return;
        const modal = document.getElementById('searchAuthModalOverlay');
        if (modal) modal.style.display = 'none';
    };

    window.handleModalGoogleSignIn = async function() {
        const btn = document.getElementById('btnModalGoogleLogin');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="color:#2563eb;"></i> <span>Signing in with Google...</span>`;
        }

        if (window.isFirebaseReady && window.isFirebaseReady() && window.firebase && window.firebase.auth) {
            try {
                const provider = new firebase.auth.GoogleAuthProvider();
                const result = await firebase.auth().signInWithPopup(provider);
                const user = result.user;

                // 1. Check existing users in localStorage to prevent duplicate accounts
                let users = [];
                try {
                    const raw = localStorage.getItem('lb_users');
                    users = raw ? JSON.parse(raw) : [];
                } catch (e) {
                    users = [];
                }

                const userEmail = (user.email || '').trim().toLowerCase();
                const userUid = user.uid || '';

                let existingUser = users.find(u => 
                    (userEmail && u.email && u.email.trim().toLowerCase() === userEmail) ||
                    (userUid && u.uid === userUid)
                );

                let deterministicId = existingUser ? existingUser.id : ('LB' + Math.floor(100000 + Math.random() * 900000));
                if (deterministicId && (deterministicId.startsWith('USR-') || !deterministicId.startsWith('LB'))) {
                    deterministicId = 'LB' + Math.floor(100000 + Math.random() * 900000);
                }

                const activeUser = {
                    id: deterministicId,
                    uid: userUid,
                    name: user.displayName || (existingUser ? existingUser.name : 'Google User'),
                    email: user.email || (existingUser ? existingUser.email : ''),
                    method: 'Google',
                    role: existingUser ? (existingUser.role || 'Member') : 'Member',
                    avatar: user.photoURL || (existingUser ? existingUser.avatar : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'),
                    phone: user.phoneNumber || (existingUser ? existingUser.phone : ''),
                    city: pendingSearchData ? pendingSearchData.city : (existingUser ? existingUser.city : ''),
                    date: existingUser ? (existingUser.date || existingUser.memberSince) : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                    memberSince: existingUser ? (existingUser.memberSince || existingUser.date) : new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }),
                    savedPlaces: existingUser ? (existingUser.savedPlaces || 0) : 0,
                    reviewsCount: existingUser ? (existingUser.reviewsCount || 0) : 0
                };

                if (existingUser) {
                    const idx = users.findIndex(u => u.id === existingUser.id);
                    if (idx !== -1) users[idx] = activeUser;
                } else {
                    users.unshift(activeUser);
                }
                localStorage.setItem('lb_users', JSON.stringify(users));

                // Sync user to Cloud Firestore
                if (window.lbCloudSync && window.lbCloudSync.saveUser) {
                    await window.lbCloudSync.saveUser(activeUser);
                }

                localStorage.setItem('lb_current_user', JSON.stringify(activeUser));

                // Immediately proceed to search results!
                if (pendingSearchData && pendingSearchData.city && pendingSearchData.category) {
                    const params = new URLSearchParams();
                    params.set('city', pendingSearchData.city);
                    params.set('category', pendingSearchData.category);
                    window.location.href = `explore.html?${params.toString()}`;
                } else {
                    window.location.reload();
                }
                return;
            } catch (err) {
                console.error('Modal Google Sign-in error:', err);
                if (err.code !== 'auth/popup-closed-by-user') {
                    alert('Google Sign-In notice: ' + (err.message || 'Failed to sign in.'));
                }
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = `
                        <svg class="google-icon" width="20" height="20" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                        </svg>
                        <span>Continue with Google</span>
                    `;
                }
            }
        } else {
            if (pendingSearchData) {
                sessionStorage.setItem('lb_pending_search', JSON.stringify(pendingSearchData));
            }
            window.location.href = 'auth.html';
        }
    };

    // ================= LOGGED IN USER PROFILE MANAGEMENT =================
    function initUserProfileHeader() {
        const guestBtn = document.getElementById('guestSignInBtn');
        const profileWidget = document.getElementById('userProfileWidget');
        const headerImg = document.getElementById('userHeaderAvatar');

        let currentUser = null;
        try {
            const raw = localStorage.getItem('lb_current_user');
            if (raw) currentUser = JSON.parse(raw);
            if (currentUser && (currentUser.name === 'Sourav Das' || (currentUser.email && currentUser.email.includes('sourav.das')))) {
                localStorage.removeItem('lb_current_user');
                currentUser = null;
            }
        } catch {
            currentUser = null;
        }

        if (currentUser) {
            // User is signed in: Hide guest icon, show professional profile avatar linking to profile.html
            if (guestBtn) guestBtn.style.display = 'none';
            if (profileWidget) profileWidget.style.display = 'block';

            if (headerImg) {
                const defaultAvatar = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'><circle cx='64' cy='64' r='64' fill='%23e2e8f0'/><circle cx='64' cy='48' r='26' fill='%2394a3b8'/><path d='M64 82c-28 0-48 18-50 36 6 6 13 10 21 10h58c8 0 15-4 21-10-2-18-22-36-50-36z' fill='%2394a3b8'/></svg>";
                headerImg.src = currentUser.avatar || defaultAvatar;
            }
        } else {
            // Guest mode
            if (guestBtn) guestBtn.style.display = 'flex';
            if (profileWidget) profileWidget.style.display = 'none';
        }
    }

    initUserProfileHeader();

    // Check if user was bounced from explore page because login is strictly required
    const homeUrlParams = new URLSearchParams(window.location.search);
    if (homeUrlParams.get('auth_required') === '1') {
        const reqCity = homeUrlParams.get('city') || '';
        const reqCat = homeUrlParams.get('category') || '';
        if (cityInput && reqCity) cityInput.value = reqCity;
        if (queryInput && reqCat) queryInput.value = reqCat;
        setTimeout(() => {
            openSearchLoginModal(reqCity, reqCat);
        }, 300);
    }

    // ================= DYNAMIC NEWS & PROMOTIONAL ADS RENDERER =================
    function normalizeAdLink(link) {
        if (!link) return '';
        link = link.trim();
        if (!link) return '';
        if (!/^https?:\/\//i.test(link)) {
            return 'https://' + link;
        }
        return link;
    }

    function renderWebsiteAds() {
        let ads = [];
        try {
            ads = JSON.parse(localStorage.getItem('lb_news') || '[]');
        } catch {
            return;
        }

        if (!ads || ads.length === 0) return;

        // Current page is Home ("home", "all", or targeted locality)
        const currentHomeCity = (document.getElementById('cityInput')?.value || '').trim().toLowerCase();
        const activeAds = ads.filter(ad => {
            if (ad.active === false) return false;
            if (!ad.targetPage || ad.targetPage === 'all' || ad.targetPage === 'home') {
                if (ad.targetCity && ad.targetCity.toLowerCase() !== 'all cities') {
                    if (!currentHomeCity) return true;
                    const adCity = ad.targetCity.toLowerCase();
                    return adCity.includes(currentHomeCity) || currentHomeCity.includes(adCity);
                }
                return true;
            }
            if (ad.targetPage === 'city' || ad.targetPage === 'explore') {
                if (!currentHomeCity) return true;
                const adCity = (ad.city || ad.targetCity || '').toLowerCase();
                return adCity === 'all cities' || adCity.includes(currentHomeCity) || currentHomeCity.includes(adCity);
            }
            return false;
        });
        if (activeAds.length === 0) return;

        const productAds = activeAds.filter(ad => (ad.type === 'product' || ad.mode === 'product') && ad.image);
        const bannerAds = activeAds.filter(ad => (ad.type === 'banner' || ad.mode === 'image') && ad.type !== 'product' && ad.mode !== 'product' && ad.image);
        const textAds = activeAds.filter(ad => ad.type !== 'product' && ad.mode !== 'product' && !((ad.type === 'banner' || ad.mode === 'image') && ad.image));

        // 1. Render Running Ticker for Text Ads (Smooth right-to-left scrolling at profile icon level)
        const headerTickerSlot = document.getElementById('headerTickerSlot') || document.querySelector('.header-left');

        if (textAds.length > 0) {
            let hasAnyLink = false;
            const items = textAds.map(ad => {
                const textContent = (ad.content || (ad.title !== 'Announcement' ? ad.title : '') || '').trim();
                if (!textContent) return '';
                const cleanLink = normalizeAdLink(ad.link);
                const colorStyle = ad.textColor ? `style="color:${ad.textColor};"` : '';
                if (cleanLink) {
                    hasAnyLink = true;
                    return `<a href="${cleanLink}" target="_blank" rel="noopener" class="lb-ticker-text-item" ${colorStyle}>${textContent}</a>`;
                } else {
                    return `<span class="lb-ticker-text-item lb-ticker-no-link" ${colorStyle}>${textContent}</span>`;
                }
            }).filter(Boolean);

            if (items.length > 0) {
                const repeatedList = items.length === 1 ? [...items, ...items, ...items] : [...items, ...items];
                const itemsMarkup = repeatedList.join('<span class="lb-ticker-sep">•</span>');

                if (headerTickerSlot) {
                    headerTickerSlot.innerHTML = `
                        <div class="lb-ticker-bar header-ticker-bar ${hasAnyLink ? 'has-link' : 'no-link'}" ${hasAnyLink ? 'title="Click text to open link"' : ''}>
                            <div class="lb-ticker-track">
                                ${itemsMarkup}
                            </div>
                        </div>
                    `;

                    const track = headerTickerSlot.querySelector('.lb-ticker-track');
                    if (track) {
                        track.style.animationPlayState = 'running';

                        headerTickerSlot.querySelectorAll('a.lb-ticker-text-item').forEach(linkEl => {
                            linkEl.addEventListener('click', () => {
                                linkEl.blur();
                                track.style.animationPlayState = 'running';
                            });
                        });

                        headerTickerSlot.addEventListener('click', () => {
                            track.style.animationPlayState = 'running';
                        });

                        headerTickerSlot.addEventListener('touchend', () => {
                            track.style.animationPlayState = 'running';
                        });
                    }
                }
            } else if (headerTickerSlot) {
                headerTickerSlot.innerHTML = '';
            }
        } else if (headerTickerSlot) {
            headerTickerSlot.innerHTML = '';
        }

        // 2. Render Banner Ads (Responsive Slider: 3 on Desktop, 1 on Mobile, Auto-Slide if exceeding)
        if (bannerAds.length > 0) {
            const stageContainer = document.querySelector('.stage-container');
            const searchFormEl = document.getElementById('omniSearchForm');

            const slidesHtml = bannerAds.map(ad => {
                const ratio = ad.aspectRatio || '16:9';
                let ratioClass = 'ratio-16-9';
                if (ratio === '1:1') ratioClass = 'ratio-1-1';
                else if (ratio === '9:16') ratioClass = 'ratio-9-16';
                else if (ratio === '4:1') ratioClass = 'ratio-4-1';

                const imgTag = `<img src="${ad.image}" alt="${ad.title || 'Promotional Banner'}" class="home-ad-img">`;
                const cleanLink = normalizeAdLink(ad.link);
                const contentHtml = cleanLink 
                    ? `<a href="${cleanLink}" target="_blank" rel="noopener" style="display:block; width:100%; height:100%; text-decoration:none;">${imgTag}</a>` 
                    : imgTag;

                return `
                    <div class="home-banner-slide">
                        <div class="home-ad-banner-card ${ratioClass}">
                            <span class="home-ad-sponsor-pill"><i class="fa-solid fa-rectangle-ad"></i> Sponsored</span>
                            ${contentHtml}
                        </div>
                    </div>
                `;
            }).join('');

            const carouselWrapper = document.createElement('div');
            carouselWrapper.className = 'home-banner-carousel-wrap';
            carouselWrapper.innerHTML = `
                <div class="home-banner-track" id="homeBannerSliderTrack">
                    ${slidesHtml}
                </div>
            `;

            // Position right below search bar (inside stage-container before quick-pills)
            if (searchFormEl && searchFormEl.nextSibling) {
                searchFormEl.parentNode.insertBefore(carouselWrapper, searchFormEl.nextSibling);
            } else if (stageContainer) {
                stageContainer.appendChild(carouselWrapper);
            } else {
                document.body.appendChild(carouselWrapper);
            }

            // Auto-Slide Engine for Home Banner Ads
            const homeTrack = document.getElementById('homeBannerSliderTrack');
            if (homeTrack && bannerAds.length > 1) {
                let homeSlideTimer = null;

                function getHomeSlideWidth() {
                    const firstSlide = homeTrack.querySelector('.home-banner-slide');
                    if (!firstSlide) return 0;
                    const gap = parseFloat(window.getComputedStyle(homeTrack).gap) || 12;
                    return firstSlide.getBoundingClientRect().width + gap;
                }

                function shouldHomeSlide() {
                    const width = window.innerWidth;
                    const total = homeTrack.querySelectorAll('.home-banner-slide').length;
                    if (width <= 540) return total > 1;
                    if (width <= 768) return total > 2;
                    return total > 3;
                }

                function startHomeBannerAutoSlide() {
                    if (homeSlideTimer) clearInterval(homeSlideTimer);
                    homeSlideTimer = setInterval(() => {
                        if (!shouldHomeSlide()) return;
                        const step = getHomeSlideWidth();
                        if (step <= 0) return;

                        const maxScroll = homeTrack.scrollWidth - homeTrack.clientWidth - 5;
                        if (homeTrack.scrollLeft >= maxScroll) {
                            homeTrack.scrollTo({ left: 0, behavior: 'smooth' });
                        } else {
                            homeTrack.scrollBy({ left: step, behavior: 'smooth' });
                        }
                    }, 3800);
                }

                startHomeBannerAutoSlide();

                homeTrack.addEventListener('mouseenter', () => {
                    if (homeSlideTimer) clearInterval(homeSlideTimer);
                });
                homeTrack.addEventListener('mouseleave', startHomeBannerAutoSlide);
                homeTrack.addEventListener('touchstart', () => {
                    if (homeSlideTimer) clearInterval(homeSlideTimer);
                }, { passive: true });
                homeTrack.addEventListener('touchend', startHomeBannerAutoSlide);
            }
        }

        // 3. Render Square Product Promotion Ads (Featured Products Showcase)
        if (productAds.length > 0) {
            const stageContainer = document.querySelector('.stage-container');
            const searchFormEl = document.getElementById('omniSearchForm');
            const bannerCarouselEl = document.querySelector('.home-banner-carousel-wrap');

            const prodCardsHtml = productAds.map(ad => {
                const prodTitle = ad.title || ad.productName || 'Product';
                const priceText = ad.price || '';
                const storeText = ad.listingName || ad.city || 'Verified Business';

                let rawLink = ad.link || '';
                if (!rawLink || rawLink === '#' || rawLink === '') {
                    if (ad.listingId) {
                        rawLink = `listing-detail.html?id=${encodeURIComponent(ad.listingId)}&product=${encodeURIComponent(prodTitle)}&price=${encodeURIComponent(priceText)}`;
                    }
                } else if (rawLink.includes('listing-detail.html') && !rawLink.includes('product=')) {
                    const sep = rawLink.includes('?') ? '&' : '?';
                    rawLink += `${sep}product=${encodeURIComponent(prodTitle)}&price=${encodeURIComponent(priceText)}`;
                }

                const prodLink = normalizeAdLink(rawLink || '#');

                return `
                    <a href="${prodLink}" class="home-product-card" title="${prodTitle}">
                        <div class="home-product-thumb-wrap">
                            <img src="${ad.image}" alt="${prodTitle}" class="home-product-thumb-img" loading="lazy">
                        </div>
                        <div class="home-product-info">
                            <div class="home-product-name">${prodTitle}</div>
                            <div class="home-product-store"><i class="fa-solid fa-store" style="color:#d97706; font-size:0.75rem;"></i> ${storeText}</div>
                            <div class="home-product-price-row">
                                <span class="home-product-price">${priceText}</span>
                                <span class="home-product-action-btn">View <i class="fa-solid fa-arrow-right"></i></span>
                            </div>
                        </div>
                    </a>
                `;
            }).join('');

            const productShowcaseWrap = document.createElement('div');
            productShowcaseWrap.className = 'home-products-showcase-wrap';
            productShowcaseWrap.innerHTML = `
                <div class="home-products-header-row">
                    <div class="home-products-title">
                        <i class="fa-solid fa-bag-shopping" style="color:#059669;"></i>
                        <span>Featured Products & Deals</span>
                    </div>
                    <span class="home-products-subtext">Verified Local Offers</span>
                </div>
                <div class="home-products-track" id="homeProductSliderTrack">
                    ${prodCardsHtml}
                </div>
            `;

            // Position right after the banner slider if available, or after search form
            if (bannerCarouselEl && bannerCarouselEl.nextSibling) {
                bannerCarouselEl.parentNode.insertBefore(productShowcaseWrap, bannerCarouselEl.nextSibling);
            } else if (bannerCarouselEl) {
                bannerCarouselEl.parentNode.appendChild(productShowcaseWrap);
            } else if (searchFormEl && searchFormEl.nextSibling) {
                searchFormEl.parentNode.insertBefore(productShowcaseWrap, searchFormEl.nextSibling);
            } else if (stageContainer) {
                stageContainer.appendChild(productShowcaseWrap);
            } else {
                document.body.appendChild(productShowcaseWrap);
            }

            // Auto-Slide Engine for Home Product Showcase (Stepped sliding when cards exceed container width)
            const prodTrack = document.getElementById('homeProductSliderTrack');
            if (prodTrack && productAds.length > 2) {
                let prodSlideTimer = null;

                function getProdSlideWidth() {
                    const firstCard = prodTrack.querySelector('.home-product-card');
                    if (!firstCard) return 0;
                    const gap = parseFloat(window.getComputedStyle(prodTrack).gap) || 14;
                    return firstCard.getBoundingClientRect().width + gap;
                }

                function shouldProdSlide() {
                    return prodTrack.scrollWidth > prodTrack.clientWidth + 10;
                }

                function startProdAutoSlide() {
                    if (prodSlideTimer) clearInterval(prodSlideTimer);
                    prodSlideTimer = setInterval(() => {
                        if (!shouldProdSlide()) return;
                        const step = getProdSlideWidth();
                        if (step <= 0) return;

                        const maxScroll = prodTrack.scrollWidth - prodTrack.clientWidth - 5;
                        if (prodTrack.scrollLeft >= maxScroll) {
                            prodTrack.scrollTo({ left: 0, behavior: 'smooth' });
                        } else {
                            prodTrack.scrollBy({ left: step, behavior: 'smooth' });
                        }
                    }, 4200);
                }

                startProdAutoSlide();

                prodTrack.addEventListener('mouseenter', () => {
                    if (prodSlideTimer) clearInterval(prodSlideTimer);
                });
                prodTrack.addEventListener('mouseleave', startProdAutoSlide);
                prodTrack.addEventListener('touchstart', () => {
                    if (prodSlideTimer) clearInterval(prodSlideTimer);
                }, { passive: true });
                prodTrack.addEventListener('touchend', startProdAutoSlide);
            }
        }
    }

    renderWebsiteAds();
});

// Professional Strict Title Case: First letter capital, all subsequent letters small per word/tag
function formatToTitleCase(str) {
    if (!str) return '';
    return str.toLowerCase().replace(/(^|[^\p{L}\p{N}'])([\p{L}])/gu, (match, prefix, char) => prefix + char.toUpperCase());
}

// Auto-capitalize First Letter of each word / sentence while typing in text inputs
document.addEventListener('input', (e) => {
    const el = e.target;
    if (!el || !(el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
    
    // Skip inputs where case conversion shouldn't apply (passwords, emails, urls, numbers, file, checkboxes)
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
