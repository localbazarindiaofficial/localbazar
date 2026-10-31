// LocalBazar Explore Engine - Clean Minimalist Listing Results Inspector

document.addEventListener('DOMContentLoaded', () => {
    // 0. STRICT LOGIN GATE: If not signed in, never display listings page. Instantly bounce to Home Page!
    const rawUser = localStorage.getItem('lb_current_user');
    let currentUser = null;
    try {
        if (rawUser) currentUser = JSON.parse(rawUser);
    } catch { currentUser = null; }

    const urlParams = new URLSearchParams(window.location.search);
    let selectedCity = (urlParams.get('city') || '').trim();
    let selectedCategory = (urlParams.get('category') || '').trim();

    if (!currentUser) {
        sessionStorage.setItem('lb_pending_search', JSON.stringify({ city: selectedCity, category: selectedCategory }));
        const bounceParams = new URLSearchParams();
        bounceParams.set('auth_required', '1');
        if (selectedCity) bounceParams.set('city', selectedCity);
        if (selectedCategory) bounceParams.set('category', selectedCategory);
        window.location.replace(`index.html?${bounceParams.toString()}`);
        return;
    }

    const capsuleSearchText = document.getElementById('capsuleSearchText');
    const resultsMainTitle = document.getElementById('resultsMainTitle');
    const resultsCountBadge = document.getElementById('resultsCountBadge');
    const listingsGridFeed = document.getElementById('listingsGridFeed');

    // Update capsule search text
    if (capsuleSearchText) {
        if (selectedCategory && selectedCity) {
            capsuleSearchText.textContent = `${selectedCategory} • ${selectedCity}`;
        } else if (selectedCategory) {
            capsuleSearchText.textContent = selectedCategory;
        } else if (selectedCity) {
            capsuleSearchText.textContent = selectedCity;
        } else {
            capsuleSearchText.textContent = 'All Listings';
        }
    }

    // Filter and Render Listings
    // Helper: Compute average rating and count for any listing ID
    function getListingRatingData(listingId) {
        const storageKey = `lb_reviews_${listingId}`;
        let reviews = [];
        try {
            const raw = localStorage.getItem(storageKey);
            if (raw) reviews = JSON.parse(raw);
        } catch {}

        if (!reviews || reviews.length === 0) {
            return {
                avg: 0,
                count: 0
            };
        }

        const count = reviews.length;
        const sum = reviews.reduce((acc, cur) => acc + (Number(cur.rating) || 5), 0);
        const avg = count > 0 ? (sum / count) : 0;
        return {
            avg: Number(avg.toFixed(1)),
            count: count
        };
    }

    function filterAndRenderListings() {
        let listings = [];
        try {
            const raw = localStorage.getItem('lb_listings');
            listings = raw ? JSON.parse(raw) : [];
        } catch {
            listings = [];
        }

        const cityQuery = selectedCity.trim().toLowerCase();
        const catQuery = selectedCategory.trim().toLowerCase();

        // Strict Targeted Search Match:
        // 1. Only Verified listings appear in public view (Pending registrations require Admin approval)
        // 2. If cityQuery is provided, listing city MUST strictly match the searched city (never show listings from other cities)
        // 3. If catQuery is provided, listing category MUST match strictly
        let filtered = listings.filter(l => {
            // Public Guard: Do not display pending listings publicly
            if (l.status === 'Pending') return false;

            const lCity = (l.city || '').trim().toLowerCase();
            const lCat = (l.category || '').trim().toLowerCase();

            // Strict City Match: A store in Chandrakona Town must NEVER appear for Khirpai or any other city
            let matchesCity = true;
            if (cityQuery && cityQuery !== 'all' && cityQuery !== 'all cities') {
                if (!lCity) return false;
                matchesCity = (lCity === cityQuery);
                if (!matchesCity) {
                    const cleanLCity = lCity.replace(/[\s\-_.]/g, '');
                    const cleanQuery = cityQuery.replace(/[\s\-_.]/g, '');
                    matchesCity = (cleanLCity === cleanQuery);
                }
            }

            // Category Match (Exact or category contains query word)
            let matchesCat = true;
            if (catQuery && catQuery !== 'all' && catQuery !== 'all categories') {
                if (!lCat) return false;
                matchesCat = (lCat === catQuery) || lCat.includes(catQuery) || catQuery.includes(lCat);
            }

            return matchesCity && matchesCat;
        });

        // Attach rating stats to each listing and sort by rating descending (Highest rating on top)
        filtered.forEach(item => {
            item._ratingData = getListingRatingData(item.id);
        });

        filtered.sort((a, b) => {
            if (b._ratingData.avg !== a._ratingData.avg) {
                return b._ratingData.avg - a._ratingData.avg; // Higher rating first
            }
            return b._ratingData.count - a._ratingData.count; // More reviews first
        });

        // Set Clean Title
        if (resultsMainTitle) {
            if (selectedCategory && selectedCity) {
                resultsMainTitle.textContent = `${selectedCategory} in ${selectedCity}`;
            } else if (selectedCategory) {
                resultsMainTitle.textContent = `${selectedCategory}`;
            } else if (selectedCity) {
                resultsMainTitle.textContent = `Places in ${selectedCity}`;
            } else {
                resultsMainTitle.textContent = `All Places`;
            }
        }

        if (resultsCountBadge) {
            resultsCountBadge.textContent = `${filtered.length} ${filtered.length === 1 ? 'Result' : 'Results'}`;
        }

        if (!listingsGridFeed) return;

        // If no items match
        if (filtered.length === 0) {
            listingsGridFeed.innerHTML = `
                <div class="listings-empty-state">
                    <i class="fa-solid fa-store-slash"></i>
                    <h3>No listings found</h3>
                    <p>No places match "${selectedCategory || 'your query'}" in "${selectedCity || 'All Cities'}".</p>
                    <a href="index.html" class="btn-modal-action primary" style="max-width:200px; margin:0 auto;"><i class="fa-solid fa-magnifying-glass"></i> Try New Search</a>
                </div>
            `;
            return;
        }

        // Render Targeted Sponsored Ads on Explore / Results Page
        renderExploreAds();

        listingsGridFeed.innerHTML = filtered.map(item => renderListingCardHtml(item)).join('');
    }

    function normalizeAdLink(link) {
        if (!link) return '';
        link = link.trim();
        if (!link) return '';
        if (!/^https?:\/\//i.test(link)) {
            return 'https://' + link;
        }
        return link;
    }

    function renderExploreAds() {
        const adsContainer = document.getElementById('exploreAdsContainer');
        if (!adsContainer) return;

        let ads = [];
        try {
            ads = JSON.parse(localStorage.getItem('lb_news') || '[]');
        } catch {
            return;
        }

        const activeAds = ads.filter(ad => {
            if (ad.active === false) return false;

            const pageMatch = (ad.targetPage === 'all' || ad.targetPage === 'explore' || ad.targetPage === 'city');
            if (!pageMatch) return false;

            // If ad is specifically targeted to a city
            if (ad.targetCity && ad.targetCity.trim() && ad.targetCity.toLowerCase() !== 'all cities') {
                const adCity = ad.targetCity.trim().toLowerCase();
                if (selectedCity && selectedCity.trim() && selectedCity.toLowerCase() !== 'all cities') {
                    if (selectedCity.toLowerCase() !== adCity && !selectedCity.toLowerCase().includes(adCity) && !adCity.includes(selectedCity.toLowerCase())) {
                        return false;
                    }
                }
            }

            // If ad is specifically targeted to a category
            const adCat = (ad.targetCategory || ad.category || '').trim().toLowerCase();
            if (adCat && adCat !== 'all' && adCat !== 'all categories') {
                if (!selectedCategory) {
                    return false;
                }
                const selCat = selectedCategory.trim().toLowerCase();
                const matchesCat = (adCat === selCat || adCat.includes(selCat) || selCat.includes(adCat));
                if (!matchesCat) {
                    return false;
                }
            }

            return true;
        });

        if (activeAds.length === 0) {
            adsContainer.style.display = 'none';
            adsContainer.innerHTML = '';
            return;
        }

        const bannerAds = activeAds.filter(ad => (ad.type === 'banner' || ad.mode === 'image') && ad.image);
        const textAds = activeAds.filter(ad => !((ad.type === 'banner' || ad.mode === 'image') && ad.image));

        let textAdsHtml = '';
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
                // Smooth continuous ticker: repeat items seamlessly so track never goes blank
                const repeatedList = items.length === 1 ? [...items, ...items, ...items] : [...items, ...items];
                const itemsMarkup = repeatedList.join('<span class="lb-ticker-sep">•</span>');

                textAdsHtml = `
                    <div class="lb-ticker-bar ${hasAnyLink ? 'has-link' : 'no-link'}" ${hasAnyLink ? 'title="Click text to open link"' : ''}>
                        <div class="lb-ticker-track">
                            ${itemsMarkup}
                        </div>
                    </div>
                `;
            }
        }

        let bannerAdsHtml = '';
        if (bannerAds.length > 0) {
            const cardsHtml = bannerAds.map(ad => {
                const ratio = ad.aspectRatio || '16:9';
                let ratioClass = 'ratio-16-9';
                if (ratio === '1:1') ratioClass = 'ratio-1-1';
                else if (ratio === '9:16') ratioClass = 'ratio-9-16';
                else if (ratio === '4:1') ratioClass = 'ratio-4-1';

                const imgTag = `<img src="${ad.image}" alt="${ad.title || 'Promotional Banner'}" class="explore-ad-img">`;
                const cleanLink = normalizeAdLink(ad.link);
                const contentHtml = cleanLink 
                    ? `<a href="${cleanLink}" target="_blank" rel="noopener" class="explore-ad-link">${imgTag}</a>` 
                    : imgTag;

                return `
                    <div class="explore-banner-slide">
                        <div class="explore-ad-banner-card ${ratioClass}">
                            <span class="explore-ad-sponsor-pill"><i class="fa-solid fa-rectangle-ad"></i> Sponsored</span>
                            ${contentHtml}
                        </div>
                    </div>
                `;
            }).join('');

            bannerAdsHtml = `
                <div class="explore-banner-carousel-wrap">
                    <div class="explore-banner-track" id="exploreBannerSliderTrack">
                        ${cardsHtml}
                    </div>
                </div>
            `;
        }

        if (!textAdsHtml && !bannerAdsHtml) {
            adsContainer.style.display = 'none';
            adsContainer.innerHTML = '';
            return;
        }

        adsContainer.style.display = 'flex';
        adsContainer.style.flexDirection = 'column';
        adsContainer.style.gap = '0.35rem';
        adsContainer.innerHTML = textAdsHtml + bannerAdsHtml;

        // Auto-Slide Engine for Banner Ads
        // Rules:
        // - Mobile (width <= 540px): 1 ad visible, auto-slides if > 1 ad
        // - Desktop (width > 768px): 3 ads side-by-side, auto-slides if > 3 ads
        // - Tablet (541px to 768px): 2 ads side-by-side, auto-slides if > 2 ads
        const bannerTrack = document.getElementById('exploreBannerSliderTrack');
        if (bannerTrack && bannerAds.length > 1) {
            let autoSlideTimer = null;

            function getSlideWidth() {
                const firstSlide = bannerTrack.querySelector('.explore-banner-slide');
                if (!firstSlide) return 0;
                const gap = parseFloat(window.getComputedStyle(bannerTrack).gap) || 12;
                return firstSlide.getBoundingClientRect().width + gap;
            }

            function shouldSlide() {
                const width = window.innerWidth;
                const total = bannerTrack.querySelectorAll('.explore-banner-slide').length;
                if (width <= 540) return total > 1;
                if (width <= 768) return total > 2;
                return total > 3;
            }

            function startBannerAutoSlide() {
                if (autoSlideTimer) clearInterval(autoSlideTimer);
                autoSlideTimer = setInterval(() => {
                    if (!shouldSlide()) return;
                    const step = getSlideWidth();
                    if (step <= 0) return;

                    const maxScroll = bannerTrack.scrollWidth - bannerTrack.clientWidth - 5;
                    if (bannerTrack.scrollLeft >= maxScroll) {
                        // Smooth loop back to start
                        bannerTrack.scrollTo({ left: 0, behavior: 'smooth' });
                    } else {
                        bannerTrack.scrollBy({ left: step, behavior: 'smooth' });
                    }
                }, 3800);
            }

            startBannerAutoSlide();

            // Pause on hover or touch, resume smoothly on leave
            bannerTrack.addEventListener('mouseenter', () => {
                if (autoSlideTimer) clearInterval(autoSlideTimer);
            });
            bannerTrack.addEventListener('mouseleave', startBannerAutoSlide);
            bannerTrack.addEventListener('touchstart', () => {
                if (autoSlideTimer) clearInterval(autoSlideTimer);
            }, { passive: true });
            bannerTrack.addEventListener('touchend', startBannerAutoSlide);
        }

        // Ensure ticker NEVER pauses or freezes on click, hover, or tab switch
        const tickerEl = adsContainer.querySelector('.lb-ticker-bar');
        if (tickerEl) {
            const track = tickerEl.querySelector('.lb-ticker-track');
            if (track) {
                track.style.animationPlayState = 'running';

                tickerEl.querySelectorAll('a.lb-ticker-text-item').forEach(linkEl => {
                    linkEl.addEventListener('click', () => {
                        linkEl.blur();
                        track.style.animationPlayState = 'running';
                    });
                });

                tickerEl.addEventListener('click', () => {
                    track.style.animationPlayState = 'running';
                });

                tickerEl.addEventListener('touchend', () => {
                    track.style.animationPlayState = 'running';
                });
            }
        }
    }

    function renderListingCardHtml(item) {
        const rating = item._ratingData || getListingRatingData(item.id);
        const ratingBadgeHtml = (rating && rating.count > 0) ? `
            <div class="listing-row-rating-badge" title="Customer Rating: ${rating.avg} out of 5">
                <i class="fa-solid fa-star"></i>
                <span class="rating-val-num">${rating.avg.toFixed(1)}</span>
                <span class="rating-reviews-paren">(${rating.count})</span>
            </div>
        ` : '';

        // Format clean address without duplicate city/locality
        const cityName = (item.city || '').trim();
        let fullAddr = (item.address || '').trim();
        let displayLocation = cityName;

        if (fullAddr) {
            const lowerAddr = fullAddr.toLowerCase();
            const lowerCity = cityName.toLowerCase();
            if (lowerAddr === lowerCity) {
                displayLocation = cityName;
            } else if (lowerAddr.startsWith(lowerCity)) {
                displayLocation = fullAddr;
            } else if (lowerAddr.includes(lowerCity)) {
                displayLocation = fullAddr;
            } else {
                displayLocation = `${cityName} • ${fullAddr}`;
            }
        }

        const timings = item.scheduleTimings || '09:00 AM - 08:30 PM';
        const coverImg = item.image || (Array.isArray(item.gallery) && item.gallery[0]) || (Array.isArray(item.images) && item.images[0]) || 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=150&auto=format&fit=crop&q=80';
        const isSaved = getExploreSavedIds().includes(item.id);

        const isTrusted = item.hasTrustBadge || item.isVerified || item.status === 'Verified';
        const trustBadgeHtml = isTrusted ? `
            <span class="listing-row-trust-pill" title="LocalBazar Verified & Trusted Business">
                <i class="fa-solid fa-shield-halved"></i> Trust
            </span>
        ` : '';

        return `
            <a href="listing-detail.html?id=${encodeURIComponent(item.id)}" class="listing-compact-row" title="View details of ${item.name}">
                <div class="listing-row-left">
                    <img src="${coverImg}" alt="${item.name}" class="listing-row-thumb">
                    <div class="listing-row-info">
                        <div class="listing-row-header">
                            <h3 class="listing-row-title" title="${item.name}">
                                ${item.name}
                                ${trustBadgeHtml}
                            </h3>
                            <div class="listing-row-badges-wrap">
                                <span class="listing-row-cat-pill">${item.category || 'General'}</span>
                                ${ratingBadgeHtml}
                            </div>
                        </div>
                        <div class="listing-row-meta-line">
                            <span class="meta-item-loc">
                                <i class="fa-solid fa-location-dot"></i>
                                <span>${displayLocation}</span>
                            </span>
                            <span class="meta-item-time">
                                <i class="fa-regular fa-clock"></i>
                                <span>${timings}</span>
                            </span>
                        </div>
                    </div>
                </div>
                <div class="listing-row-right" style="display:flex; align-items:center; gap:0.5rem;">
                    <button type="button" class="btn-row-bookmark ${isSaved ? 'active' : ''}" style="width:34px; height:34px; border-radius:50%; border:1px solid ${isSaved ? '#f59e0b' : '#e2e8f0'}; background:${isSaved ? '#fef3c7' : '#ffffff'}; color:${isSaved ? '#d97706' : '#94a3b8'}; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:0.9rem;" onclick="toggleExploreBookmark(event, '${item.id}')" title="${isSaved ? 'Saved to bookmarks' : 'Save place'}">
                        <i class="${isSaved ? 'fa-solid' : 'fa-regular'} fa-bookmark"></i>
                    </button>
                    <span class="btn-view-profile-pill">
                        <span>Details</span>
                        <i class="fa-solid fa-chevron-right" style="font-size:0.72rem;"></i>
                    </span>
                </div>
            </a>
        `;
    }

    function getExploreSavedIds() {
        try {
            const raw = localStorage.getItem('lb_saved_places');
            const arr = raw ? JSON.parse(raw) : [];
            return arr.map(e => typeof e === 'string' ? e : e.id);
        } catch { return []; }
    }

    window.toggleExploreBookmark = function(e, id) {
        e.preventDefault();
        e.stopPropagation();

        let listings = [];
        try { listings = JSON.parse(localStorage.getItem('lb_listings')) || []; } catch {}
        const item = listings.find(l => l.id === id);
        if (!item) return;

        let rawSaved = [];
        try { rawSaved = JSON.parse(localStorage.getItem('lb_saved_places')) || []; } catch {}

        const exists = rawSaved.some(entry => (typeof entry === 'string' ? entry === id : entry.id === id));
        if (exists) {
            rawSaved = rawSaved.filter(entry => (typeof entry === 'string' ? entry !== id : entry.id !== id));
        } else {
            rawSaved.unshift({
                id: item.id,
                name: item.name,
                category: item.category || 'Business',
                city: item.city || '',
                image: item.image || (Array.isArray(item.gallery) && item.gallery[0]) || '',
                savedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            });
        }
        localStorage.setItem('lb_saved_places', JSON.stringify(rawSaved));

        try {
            const u = JSON.parse(localStorage.getItem('lb_current_user'));
            if (u) {
                u.savedPlaces = rawSaved.length;
                localStorage.setItem('lb_current_user', JSON.stringify(u));
            }
        } catch {}

        filterAndRenderListings();
    };

    // ---------------- Listing Detail Inspection Modal ----------------
    const modalBackdrop = document.getElementById('listingDetailModal');
    const closeDetailModalBtn = document.getElementById('closeDetailModalBtn');

    window.openListingDetailModal = function(id) {
        let listings = [];
        try {
            const raw = localStorage.getItem('lb_listings');
            listings = raw ? JSON.parse(raw) : [];
        } catch {}

        const item = listings.find(l => l.id === id);
        if (!item) return;

        // Cover Photo & Counter
        const coverImg = document.getElementById('modalCoverImg');
        if (coverImg) coverImg.src = item.image || 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&auto=format&fit=crop&q=80';
        
        const photoCount = document.getElementById('modalPhotoCountNum');
        const prodCount = Array.isArray(item.products) ? item.products.length : 0;
        if (photoCount) photoCount.textContent = (prodCount + (item.image ? 1 : 0)) || 1;

        // Title, Category, City
        document.getElementById('modalPlaceName').textContent = item.name;
        document.getElementById('modalCategoryTag').textContent = item.category || 'Business';
        document.getElementById('modalLocality').textContent = item.city || 'Local Area';

        // Rating
        const rating = item._ratingData || getListingRatingData(item.id);
        const modalAvgRating = document.getElementById('modalAvgRating');
        const modalReviewsTotalText = document.getElementById('modalReviewsTotalText');
        if (modalAvgRating) modalAvgRating.textContent = rating.count > 0 ? rating.avg.toFixed(1) : 'New';
        if (modalReviewsTotalText) modalReviewsTotalText.textContent = rating.count > 0 ? `${rating.count} ratings` : '0 ratings';

        // Live Open Status
        const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
        const todayISO = new Date().toISOString().split('T')[0];
        const openDays = Array.isArray(item.openDays) && item.openDays.length > 0 
            ? item.openDays 
            : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const holidays = Array.isArray(item.holidays) ? item.holidays : [];
        const isHoliday = holidays.includes(todayISO);
        const isOpenToday = openDays.includes(todayName);

        const liveOpenEl = document.getElementById('modalLiveOpenText');
        if (liveOpenEl) {
            if (isOpenToday && !isHoliday) {
                const closeTime = (item.scheduleTimings || '08:30 PM').split('-')[1]?.trim() || 'Late';
                liveOpenEl.textContent = `Open Today • until ${closeTime}`;
                liveOpenEl.style.color = '#16a34a';
            } else {
                liveOpenEl.textContent = 'Closed Today';
                liveOpenEl.style.color = '#dc2626';
            }
        }

        // Action Buttons: Call, WhatsApp, Direction, Chat
        const cleanPhone = (item.phone || '').trim();
        const callBtn = document.getElementById('modalCallBtn');
        if (callBtn) callBtn.href = cleanPhone ? `tel:${cleanPhone}` : '#';

        const waBtn = document.getElementById('modalWhatsappBtn');
        const waNum = cleanPhone.replace(/[^0-9]/g, '');
        if (waBtn) {
            waBtn.href = waNum 
                ? `https://wa.me/${waNum}?text=${encodeURIComponent('Hello, I saw your listing on LocalBazar: ' + item.name + '. I would like to inquire about your service.')}` 
                : (cleanPhone ? `tel:${cleanPhone}` : '#');
        }

        function getSafeGoogleMapsUrl(target) {
            if (!target) return 'https://www.google.com/maps';

            let raw = (typeof target === 'string' ? target : (target.mapLink || '')).trim();

            if (raw.includes('<iframe')) {
                const match = raw.match(/src=["']([^"']+)["']/i);
                if (match && match[1]) {
                    raw = match[1].trim();
                }
            }

            if (raw.includes('/maps/embed')) {
                try {
                    const u = new URL(raw.startsWith('http') ? raw : 'https://' + raw);
                    const q = u.searchParams.get('q');
                    if (q) {
                        return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
                    }
                } catch (e) {}
                raw = '';
            }

            if (raw && raw.includes('maps.google.') && (raw.includes('?q=') || raw.includes('&q='))) {
                try {
                    const u = new URL(raw.startsWith('http') ? raw : 'https://' + raw);
                    const q = u.searchParams.get('q');
                    if (q) {
                        return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
                    }
                } catch (e) {}
            }

            if (raw) {
                if (!/^https?:\/\//i.test(raw)) {
                    raw = 'https://' + raw;
                }
                return raw;
            }

            const name = (typeof target === 'object' && target.name) ? target.name.trim() : '';
            const address = (typeof target === 'object' && target.address) ? target.address.trim() : '';
            const city = (typeof target === 'object' && target.city) ? target.city.trim() : '';

            const queryParts = [name, address, city].filter(Boolean);
            const dest = queryParts.length > 0 ? queryParts.join(', ') : 'India';

            return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
        }

        const mapBtn = document.getElementById('modalMapBtn');
        if (mapBtn) {
            const safeMapUrl = getSafeGoogleMapsUrl(item);
            mapBtn.href = safeMapUrl;
            mapBtn.setAttribute('target', '_blank');
            mapBtn.setAttribute('rel', 'noopener noreferrer');
            mapBtn.onclick = (e) => {
                e.preventDefault();
                window.open(safeMapUrl, '_blank', 'noopener,noreferrer');
            };
        }

        const chatBtn = document.getElementById('modalChatBtn');
        if (chatBtn) {
            chatBtn.onclick = () => {
                if (cleanPhone) {
                    window.open(`https://wa.me/${cleanPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Hi ' + item.name + ', I would like to chat with you regarding your listing on LocalBazar.')}`, '_blank');
                } else {
                    alert('Chat is connecting... Phone number is not configured for direct chat.');
                }
            };
        }

        // Operating Schedule & Address
        document.getElementById('modalTimingsText').textContent = item.scheduleTimings || '09:00 AM - 08:30 PM';
        document.getElementById('modalFullAddressText').textContent = item.address || 'Full address available on request';
        document.getElementById('modalDescText').textContent = item.desc || 'Premier destination with complete verified facilities and direct owner support.';

        // Open Days Pills
        const daysContainer = document.getElementById('modalOpenDaysPills');
        if (daysContainer) {
            daysContainer.innerHTML = openDays.map(d => `<span class="day-pill-badge">${d.substring(0, 3)}</span>`).join('');
        }

        // Products & Services
        const prodContainer = document.getElementById('modalProductsList');
        const prodSection = document.getElementById('modalProductsSection');
        const products = Array.isArray(item.products) ? item.products : [];

        if (products.length > 0) {
            if (prodSection) prodSection.style.display = 'block';
            if (prodContainer) {
                prodContainer.innerHTML = products.map(p => {
                    const prodImg = p.image || p.img || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100&auto=format&fit=crop&q=80';
                    return `
                        <div class="modal-prod-item">
                            <div class="modal-prod-left">
                                <img src="${prodImg}" class="modal-prod-thumb" alt="${p.name}">
                                <span class="modal-prod-name">${p.name}</span>
                            </div>
                            <span class="modal-prod-price">${p.price || 'On Request'}</span>
                        </div>
                    `;
                }).join('');
            }
        } else {
            if (prodSection) prodSection.style.display = 'none';
        }

        modalBackdrop.classList.add('open');
        if (window.lbPushModal) window.lbPushModal('exploreDetailModal', () => {
            modalBackdrop?.classList.remove('open');
        });
    };

    closeDetailModalBtn?.addEventListener('click', () => {
        modalBackdrop.classList.remove('open');
        if (window.lbPopModal) window.lbPopModal('exploreDetailModal');
    });

    modalBackdrop?.addEventListener('click', (e) => {
        if (e.target === modalBackdrop) {
            modalBackdrop.classList.remove('open');
            if (window.lbPopModal) window.lbPopModal('exploreDetailModal');
        }
    });

    // Initial render
    filterAndRenderListings();
});

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
        if (window.lbPushModal) window.lbPushModal('searchAuthModal', () => {
            if (modal) modal.style.display = 'none';
        });
    }
};

window.closeSearchAuthModal = function(e) {
    if (e && e.target !== e.currentTarget && e.currentTarget.id === 'searchAuthModalOverlay') return;
    const modal = document.getElementById('searchAuthModalOverlay');
    if (modal) modal.style.display = 'none';
    if (window.lbPopModal) window.lbPopModal('searchAuthModal');
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

            let activeUser;
            if (typeof window.syncAuthUser === 'function') {
                activeUser = window.syncAuthUser(user.displayName, user.email, user.photoURL, 'Google', user.uid, user.phoneNumber, pendingSearchData ? pendingSearchData.city : '');
            } else {
                let existingUser = null;
                try {
                    const users = JSON.parse(localStorage.getItem('lb_users') || '[]');
                    existingUser = users.find(u => (user.email && u.email && u.email.toLowerCase() === user.email.toLowerCase()) || (user.uid && u.uid === user.uid));
                } catch(e) {}

                let uniqueId = existingUser ? existingUser.id : ('LB' + Math.floor(100000 + Math.random() * 900000));
                if (uniqueId && (uniqueId.startsWith('USR-') || !uniqueId.startsWith('LB'))) {
                    uniqueId = 'LB' + Math.floor(100000 + Math.random() * 900000);
                }

                activeUser = {
                    id: uniqueId,
                    uid: user.uid,
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
            }

            // Sync user to Cloud Firestore
            if (window.lbCloudSync && window.lbCloudSync.saveUser) {
                await window.lbCloudSync.saveUser(activeUser);
            }

            localStorage.setItem('lb_current_user', JSON.stringify(activeUser));

            // Close modal & refresh feed
            const modal = document.getElementById('searchAuthModalOverlay');
            if (modal) modal.style.display = 'none';
            window.location.reload();
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

// Global Strict Title Case
function formatToTitleCase(str) {
    if (!str) return '';
    return str.toLowerCase().replace(/(^|[^\p{L}\p{N}'])([\p{L}])/gu, (match, prefix, char) => prefix + char.toUpperCase());
}

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
        if (start !== null && end !== null) el.setSelectionRange(start, end);
    }
});