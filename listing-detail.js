// LocalBazar - Dedicated Listing Detail Page Engine

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    let listingId = urlParams.get('id');
    if (listingId) {
        listingId = decodeURIComponent(listingId).trim();
    }

    let listings = [];
    try {
        const raw = localStorage.getItem('lb_listings');
        listings = raw ? JSON.parse(raw) : [];
    } catch {}

    // Find listing by exact ID or case-insensitive ID or fallback to first
    let item = listings.find(l => String(l.id).trim() === String(listingId).trim());
    if (!item && listingId) {
        item = listings.find(l => String(l.id).toLowerCase() === String(listingId).toLowerCase());
    }
    if (!item && listingId) {
        const cleanParamId = String(listingId).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        item = listings.find(l => String(l.id).replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === cleanParamId);
    }
    if (!item && listingId) {
        item = listings.find(l => l.name && l.name.toLowerCase() === listingId.toLowerCase());
    }

    if (!item) {
        document.body.innerHTML = `
            <div class="lb-not-found-layout" style="min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #f8fafc; padding: 2.5rem 1.25rem; font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif; text-align: center; box-sizing: border-box;">
                <div style="background: #ffffff; max-width: 480px; width: 100%; border-radius: 24px; padding: 2.75rem 2rem; box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04); border: 1px solid #e2e8f0;">
                    <div style="width: 80px; height: 80px; margin: 0 auto 1.5rem; background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); color: #ef4444; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2.25rem; box-shadow: 0 8px 16px -4px rgba(239, 68, 68, 0.2);">
                        <i class="fa-solid fa-store-slash"></i>
                    </div>
                    <span style="display: inline-block; background: #f1f5f9; color: #475569; font-size: 0.76rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; padding: 0.35rem 0.85rem; border-radius: 20px; margin-bottom: 0.85rem;">Error 404 • Listing Not Found</span>
                    <h2 style="color: #0f172a; font-size: 1.45rem; font-weight: 800; margin-bottom: 0.65rem; line-height: 1.3;">দোকান বা লিস্টিংটি খুঁজে পাওয়া যায়নি</h2>
                    <p style="color: #64748b; font-size: 0.94rem; line-height: 1.55; margin-bottom: 2rem;">The business or place you are looking for may have been removed, closed, or the link may be invalid.</p>
                    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                        <a href="explore.html" style="background: #1a73e8; color: #ffffff; text-decoration: none; padding: 0.8rem 1.25rem; border-radius: 12px; font-weight: 700; font-size: 0.95rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem; box-shadow: 0 4px 12px rgba(26, 115, 232, 0.25); transition: background 0.2s;">
                            <i class="fa-solid fa-compass"></i> Explore All Places
                        </a>
                        <a href="index.html" style="background: #f1f5f9; color: #334155; text-decoration: none; padding: 0.8rem 1.25rem; border-radius: 12px; font-weight: 600; font-size: 0.92rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem; transition: background 0.2s;">
                            <i class="fa-solid fa-magnifying-glass"></i> Back to Home Search
                        </a>
                    </div>
                </div>
                <div style="margin-top: 2rem; color: #94a3b8; font-size: 0.88rem; font-weight: 700; display: flex; align-items: center; gap: 0.4rem;">
                    <i class="fa-solid fa-store" style="color: #1a73e8;"></i> Local<span style="color: #0f172a;">Bazar</span>
                </div>
            </div>
        `;
        return;
    }

    // Dynamic SEO, OpenGraph & JSON-LD Microdata Injection
    function updateListingSeoMetadata(item) {
        document.title = `${item.name} - ${item.city || 'Local Area'} | LocalBazar`;
        const currentUrl = window.location.href;
        const metaDesc = item.desc 
            ? item.desc.slice(0, 160) 
            : `${item.name} in ${item.city || 'Local Area'}. Category: ${item.category || 'Business'}. Timings: ${item.scheduleTimings || 'Regular Hours'}. Find phone, address, timings, live chat and customer reviews on LocalBazar.`;
        const metaImage = item.image || (Array.isArray(item.gallery) && item.gallery[0]) || (Array.isArray(item.images) && item.images[0]) || 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&auto=format&fit=crop&q=80';

        const setOrUpdateMeta = (nameOrProp, val, isProperty = true) => {
            if (!val) return;
            const selector = isProperty ? `meta[property="${nameOrProp}"]` : `meta[name="${nameOrProp}"]`;
            let el = document.querySelector(selector);
            if (!el) {
                el = document.createElement('meta');
                if (isProperty) el.setAttribute('property', nameOrProp);
                else el.setAttribute('name', nameOrProp);
                document.head.appendChild(el);
            }
            el.setAttribute('content', val);
        };

        setOrUpdateMeta('description', metaDesc, false);
        setOrUpdateMeta('og:title', `${item.name} - LocalBazar`);
        setOrUpdateMeta('og:description', metaDesc);
        setOrUpdateMeta('og:image', metaImage);
        setOrUpdateMeta('og:url', currentUrl);
        setOrUpdateMeta('og:type', 'business.business');
        setOrUpdateMeta('og:site_name', 'LocalBazar');
        setOrUpdateMeta('twitter:card', 'summary_large_image', false);
        setOrUpdateMeta('twitter:title', `${item.name} - LocalBazar`, false);
        setOrUpdateMeta('twitter:description', metaDesc, false);
        setOrUpdateMeta('twitter:image', metaImage, false);

        // Inject Google Search Schema.org JSON-LD structured data
        try {
            let schemaEl = document.getElementById('listingJsonLdSchema');
            if (!schemaEl) {
                schemaEl = document.createElement('script');
                schemaEl.id = 'listingJsonLdSchema';
                schemaEl.type = 'application/ld+json';
                document.head.appendChild(schemaEl);
            }
            const schemaData = {
                "@context": "https://schema.org",
                "@type": "LocalBusiness",
                "name": item.name,
                "image": metaImage,
                "telephone": item.phone || "",
                "address": {
                    "@type": "PostalAddress",
                    "streetAddress": item.address || "",
                    "addressLocality": item.city || "",
                    "addressCountry": "IN"
                },
                "url": currentUrl
            };
            schemaEl.textContent = JSON.stringify(schemaData);
        } catch {}
    }
    updateListingSeoMetadata(item);

    // 1. Title & Header
    const topNavPlaceName = document.getElementById('topNavPlaceName');
    if (topNavPlaceName) topNavPlaceName.textContent = item.name;

    document.getElementById('detailHeroImg').src = item.image || 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&auto=format&fit=crop&q=80';
    document.getElementById('detailPlaceName').textContent = item.name;
    document.getElementById('detailCatPill').textContent = item.category || 'Business';
    document.getElementById('detailCityTag').textContent = item.city || 'Local Area';

    // Show Premium Gold Trust Badge if listing is verified/awarded Trust Badge
    const goldTrustBadge = document.getElementById('detailGoldTrustBadge');
    if (goldTrustBadge) {
        const isTrusted = item.hasTrustBadge || item.isVerified || item.status === 'Verified';
        goldTrustBadge.style.display = isTrusted ? 'inline-flex' : 'none';
    }

    // Photo count badge & Store Photos Showcase setup
    // STRICT RULE: Only Listing/Store Photos (item.gallery / item.images & item.image) belong here.
    let currentStorePhotos = [];

    // 1. Collect store photos seamlessly from item.gallery or item.images
    const rawPhotoList = Array.isArray(item.gallery) && item.gallery.length > 0
        ? item.gallery
        : (Array.isArray(item.images) && item.images.length > 0 ? item.images : []);
    currentStorePhotos = rawPhotoList.filter(url => Boolean(url && typeof url === 'string'));

    // 2. Add primary listing cover photo if not already in gallery
    if (item.image && typeof item.image === 'string' && !currentStorePhotos.includes(item.image)) {
        currentStorePhotos.unshift(item.image);
    }

    // 3. Fallback only if no store image exists at all
    if (currentStorePhotos.length === 0) {
        currentStorePhotos = ['https://images.unsplash.com/photo-1497366216548-37526070297c?w=1000&auto=format&fit=crop&q=80'];
    }

    const photoCount = document.getElementById('detailPhotoCountNum');
    if (photoCount) photoCount.textContent = currentStorePhotos.length;
    if (currentStorePhotos.length > 0) {
        const heroImg = document.getElementById('detailHeroImg');
        if (heroImg) {
            heroImg.src = currentStorePhotos[0];
        }
    }

    // =========================================================================
    // STORE PHOTO GALLERY MODAL & HIGH-RES LIGHTBOX VIEWER
    // =========================================================================
    let activeLightboxIndex = 0;

    window.openStoreGalleryModal = function() {
        // If listing has only 1 store photo, directly open the high-res Lightbox viewer
        if (currentStorePhotos.length <= 1) {
            window.openStoreLightbox(0);
            return;
        }

        const modalBackdrop = document.getElementById('storeGalleryModalBackdrop');
        const grid = document.getElementById('storeGalleryGrid');
        const countBadge = document.getElementById('galleryPhotoCountBadge');
        const titleEl = document.getElementById('galleryStoreTitle');

        if (titleEl) titleEl.textContent = `${item.name} Photos`;
        if (countBadge) countBadge.innerHTML = `<i class="fa-solid fa-camera"></i> ${currentStorePhotos.length} Photos`;

        if (grid) {
            grid.innerHTML = currentStorePhotos.map((url, idx) => `
                <div class="store-gallery-item" onclick="openStoreLightbox(${idx})" title="Click to view full photo">
                    <img src="${url}" alt="${item.name} Photo ${idx + 1}" class="store-gallery-thumb" loading="lazy">
                    <span class="gallery-item-chip">#${idx + 1}</span>
                    <div class="gallery-item-expand">
                        <i class="fa-solid fa-magnifying-glass-plus"></i>
                    </div>
                </div>
            `).join('');
        }

        if (modalBackdrop) {
            modalBackdrop.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            if (window.lbPushModal) window.lbPushModal('galleryModal', window.closeStoreGalleryModal);
        }
    };

    window.closeStoreGalleryModal = function() {
        const modalBackdrop = document.getElementById('storeGalleryModalBackdrop');
        if (modalBackdrop) {
            modalBackdrop.style.display = 'none';
        }
        if (window.lbPopModal) window.lbPopModal('galleryModal');
        const lightboxBackdrop = document.getElementById('storeLightboxModalBackdrop');
        if (!lightboxBackdrop || lightboxBackdrop.style.display === 'none') {
            document.body.style.overflow = '';
        }
    };

    function renderLightboxFilmstrip() {
        const filmstrip = document.getElementById('lightboxFilmstrip');
        if (!filmstrip) return;
        if (currentStorePhotos.length <= 1) {
            filmstrip.style.display = 'none';
            return;
        }
        filmstrip.style.display = 'flex';
        filmstrip.innerHTML = currentStorePhotos.map((url, idx) => `
            <img src="${url}" class="lightbox-filmstrip-thumb ${idx === activeLightboxIndex ? 'active' : ''}" 
                 onclick="openStoreLightbox(${idx})" alt="Thumb ${idx + 1}">
        `).join('');
    }

    function updateLightboxDisplay() {
        const mainImg = document.getElementById('lightboxMainImg');
        const counter = document.getElementById('lightboxCounter');
        const storeNameEl = document.getElementById('lightboxStoreName');
        const btnBackToGrid = document.getElementById('btnLightboxBackToGrid');
        const btnPrev = document.getElementById('btnLightboxPrev');
        const btnNext = document.getElementById('btnLightboxNext');

        if (storeNameEl) storeNameEl.textContent = item.name;
        if (counter) counter.textContent = `${activeLightboxIndex + 1} / ${currentStorePhotos.length}`;

        // Toggle multi-photo controls based on whether more than 1 store photo exists
        const isMultiple = currentStorePhotos.length > 1;
        if (btnBackToGrid) btnBackToGrid.style.display = isMultiple ? 'inline-flex' : 'none';
        if (btnPrev) btnPrev.style.display = isMultiple ? 'flex' : 'none';
        if (btnNext) btnNext.style.display = isMultiple ? 'flex' : 'none';

        if (mainImg) {
            mainImg.style.opacity = '0';
            mainImg.style.transform = 'scale(0.96)';
            setTimeout(() => {
                mainImg.src = currentStorePhotos[activeLightboxIndex];
                mainImg.style.opacity = '1';
                mainImg.style.transform = 'scale(1)';
            }, 80);
        }

        // Update active class on thumbnails & auto-scroll filmstrip
        if (isMultiple) {
            const thumbs = document.querySelectorAll('.lightbox-filmstrip-thumb');
            thumbs.forEach((th, idx) => {
                if (idx === activeLightboxIndex) {
                    th.classList.add('active');
                    th.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                } else {
                    th.classList.remove('active');
                }
            });
        }
    }

    window.openStoreLightbox = function(index) {
        if (index < 0 || index >= currentStorePhotos.length) index = 0;
        activeLightboxIndex = index;

        // Hide gallery modal card if open
        const galleryBackdrop = document.getElementById('storeGalleryModalBackdrop');
        if (galleryBackdrop) galleryBackdrop.style.display = 'none';

        const lightboxBackdrop = document.getElementById('storeLightboxModalBackdrop');
        if (lightboxBackdrop) {
            lightboxBackdrop.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            if (window.lbPushModal) window.lbPushModal('lightboxModal', window.closeStoreLightbox);
        }

        renderLightboxFilmstrip();
        updateLightboxDisplay();
    };

    window.slideLightboxNext = function() {
        if (currentStorePhotos.length <= 1) return;
        activeLightboxIndex = (activeLightboxIndex + 1) % currentStorePhotos.length;
        updateLightboxDisplay();
    };

    window.slideLightboxPrev = function() {
        if (currentStorePhotos.length <= 1) return;
        activeLightboxIndex = (activeLightboxIndex - 1 + currentStorePhotos.length) % currentStorePhotos.length;
        updateLightboxDisplay();
    };

    window.backToGalleryGrid = function() {
        const lightboxBackdrop = document.getElementById('storeLightboxModalBackdrop');
        if (lightboxBackdrop) lightboxBackdrop.style.display = 'none';
        if (window.lbPopModal) window.lbPopModal('lightboxModal');
        if (currentStorePhotos.length > 1) {
            window.openStoreGalleryModal();
        } else {
            document.body.style.overflow = '';
        }
    };

    window.closeStoreLightbox = function() {
        const lightboxBackdrop = document.getElementById('storeLightboxModalBackdrop');
        if (lightboxBackdrop) lightboxBackdrop.style.display = 'none';
        if (window.lbPopModal) window.lbPopModal('lightboxModal');
        const galleryBackdrop = document.getElementById('storeGalleryModalBackdrop');
        if (!galleryBackdrop || galleryBackdrop.style.display === 'none') {
            document.body.style.overflow = '';
        }
    };

    // Keyboard navigation (Arrow keys & Escape)
    document.addEventListener('keydown', (e) => {
        const lightboxBackdrop = document.getElementById('storeLightboxModalBackdrop');
        const galleryBackdrop = document.getElementById('storeGalleryModalBackdrop');

        const isLightboxOpen = lightboxBackdrop && lightboxBackdrop.style.display !== 'none';
        const isGalleryOpen = galleryBackdrop && galleryBackdrop.style.display !== 'none';

        if (isLightboxOpen) {
            if (e.key === 'ArrowRight' && currentStorePhotos.length > 1) {
                window.slideLightboxNext();
            } else if (e.key === 'ArrowLeft' && currentStorePhotos.length > 1) {
                window.slideLightboxPrev();
            } else if (e.key === 'Escape') {
                window.closeStoreLightbox();
            }
        } else if (isGalleryOpen) {
            if (e.key === 'Escape') {
                window.closeStoreGalleryModal();
            }
        }
    });

    // Touch swipe support for mobile lightbox
    const lightboxStage = document.querySelector('.lightbox-main-stage');
    if (lightboxStage) {
        let touchStartX = 0;
        let touchEndX = 0;
        lightboxStage.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        lightboxStage.addEventListener('touchend', (e) => {
            if (currentStorePhotos.length <= 1) return;
            touchEndX = e.changedTouches[0].screenX;
            const diffX = touchEndX - touchStartX;
            if (Math.abs(diffX) > 40) {
                if (diffX < 0) {
                    window.slideLightboxNext(); // Swipe left -> next
                } else {
                    window.slideLightboxPrev(); // Swipe right -> prev
                }
            }
        }, { passive: true });
    }

    // Rating
    function getListingRatingData(id) {
        try {
            const raw = localStorage.getItem(`lb_reviews_${id}`);
            const revs = raw ? JSON.parse(raw) : [];
            if (revs && revs.length > 0) {
                const sum = revs.reduce((acc, cur) => acc + (Number(cur.rating) || 5), 0);
                return { avg: (sum / revs.length).toFixed(1), count: revs.length };
            }
        } catch {}
        return { avg: '0.0', count: 0 };
    }

    const rating = getListingRatingData(item.id);
    document.getElementById('detailAvgRating').textContent = rating.avg;
    document.getElementById('detailReviewsTotalText').textContent = `${rating.count} ratings`;

    // Live Open Status
    const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const todayISO = new Date().toISOString().split('T')[0];
    const openDaysList = Array.isArray(item.openDays) && item.openDays.length > 0 
        ? item.openDays 
        : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const holidays = Array.isArray(item.holidays) ? item.holidays : [];
    const isHolidayToday = holidays.includes(todayISO);
    const isOpenDayToday = openDaysList.includes(todayName);

    const liveText = document.getElementById('detailLiveOpenText');

    if (isOpenDayToday && !isHolidayToday) {
        liveText.textContent = 'Open Today';
        liveText.style.color = '#16a34a';
    } else {
        liveText.textContent = 'Closed Today';
        liveText.style.color = '#dc2626';
    }

    // 2. Action Buttons (Call, WhatsApp, Direction, Chat, Share)
    const cleanPhone = (item.phone || '').trim();
    const detailCallAction = document.getElementById('detailCallAction');
    if (detailCallAction) detailCallAction.href = cleanPhone ? `tel:${cleanPhone}` : '#';

    // WhatsApp number (dedicated whatsapp field if configured, else phone fallback)
    const rawWa = (item.whatsapp || item.phone || '').trim();
    const waNum = rawWa.replace(/[^0-9]/g, '');
    const detailWhatsappAction = document.getElementById('detailWhatsappAction');
    if (detailWhatsappAction) {
        detailWhatsappAction.href = waNum 
            ? `https://wa.me/${waNum}?text=${encodeURIComponent('Hello, I saw your listing on LocalBazar: ' + item.name + '. I would like to inquire about your service.')}` 
            : (cleanPhone ? `tel:${cleanPhone}` : '#');
    }

    const detailDirectionsAction = document.getElementById('detailDirectionsAction');
    if (detailDirectionsAction) {
        detailDirectionsAction.href = item.mapLink || `https://maps.google.com/?q=${encodeURIComponent(item.name + ' ' + (item.city || ''))}`;
    }

    // Share Button Action: Opens the Luxury Store QR & Share Standee Modal
    const btnShareListing = document.getElementById('btnShareListing');
    if (btnShareListing) {
        btnShareListing.addEventListener('click', (e) => {
            e.preventDefault();
            window.openListingShareQRModal();
        });
    }

    // ================= BOOKMARK / SAVE PLACES SUITE =================
    const btnBookmarkListing = document.getElementById('btnBookmarkListing');
    const bookmarkIconBox = document.getElementById('bookmarkIconBox');
    const bookmarkIcon = document.getElementById('bookmarkIcon');
    const bookmarkBtnLabel = document.getElementById('bookmarkBtnLabel');

    function getSavedPlaceEntries() {
        try {
            const raw = localStorage.getItem('lb_saved_places');
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }

    function isCurrentPlaceSaved() {
        const list = getSavedPlaceEntries();
        return list.some(entry => (typeof entry === 'string' ? entry === item.id : entry.id === item.id));
    }

    function updateBookmarkButtonUI() {
        const saved = isCurrentPlaceSaved();
        if (bookmarkIconBox) {
            bookmarkIconBox.classList.toggle('active', saved);
        }
        if (bookmarkIcon) {
            bookmarkIcon.className = saved ? 'fa-solid fa-bookmark' : 'fa-regular fa-bookmark';
        }
        if (bookmarkBtnLabel) {
            bookmarkBtnLabel.textContent = saved ? 'Saved' : 'Save';
        }
    }

    function showListingToast(msg, icon = 'fa-solid fa-circle-check') {
        let toast = document.getElementById('lbDynamicToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'lbDynamicToast';
            toast.style.cssText = `
                position: fixed;
                bottom: 80px;
                left: 50%;
                transform: translateX(-50%) translateY(20px);
                background: #0f172a;
                color: #ffffff;
                padding: 0.75rem 1.25rem;
                border-radius: 30px;
                font-size: 0.88rem;
                font-weight: 600;
                display: flex;
                align-items: center;
                gap: 0.6rem;
                box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3);
                z-index: 999999;
                opacity: 0;
                transition: transform 0.25s ease, opacity 0.25s ease;
                pointer-events: none;
            `;
            document.body.appendChild(toast);
        }
        toast.innerHTML = `<i class="${icon}" style="color: #38bdf8;"></i> <span>${msg}</span>`;
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(20px)';
        }, 2500);
    }

    if (btnBookmarkListing) {
        updateBookmarkButtonUI();
        btnBookmarkListing.addEventListener('click', (e) => {
            e.preventDefault();
            let list = getSavedPlaceEntries();
            const saved = isCurrentPlaceSaved();
            if (saved) {
                list = list.filter(entry => (typeof entry === 'string' ? entry !== item.id : entry.id !== item.id));
                localStorage.setItem('lb_saved_places', JSON.stringify(list));
                updateBookmarkButtonUI();
                showListingToast(`Removed "${item.name}" from saved places`, 'fa-regular fa-bookmark');
            } else {
                list.unshift({
                    id: item.id,
                    name: item.name,
                    category: item.category || 'Business',
                    city: item.city || '',
                    image: item.image || (Array.isArray(item.gallery) && item.gallery[0]) || '',
                    savedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                });
                localStorage.setItem('lb_saved_places', JSON.stringify(list));
                updateBookmarkButtonUI();
                showListingToast(`"${item.name}" saved to your favorite places!`, 'fa-solid fa-bookmark');
            }

            try {
                const rawUser = localStorage.getItem('lb_current_user');
                if (rawUser) {
                    const usr = JSON.parse(rawUser);
                    usr.savedPlaces = list.length;
                    localStorage.setItem('lb_current_user', JSON.stringify(usr));
                }
            } catch {}
        });
    }

    // ================= OFFICIAL STORE QR & SHARE STANDEE SUITE =================
    window.openListingShareQRModal = function() {
        const storeUrl = window.location.href;

        // Populate Standee Identity
        const avatarEl = document.getElementById('qrStandeeAvatar');
        const nameEl = document.getElementById('qrStandeeName');
        const metaEl = document.getElementById('qrStandeeMeta');
        const linkEl = document.getElementById('qrStandeeLinkText');
        const linkAnchor = document.getElementById('qrStandeeLinkAnchor');

        if (avatarEl) avatarEl.src = item.image || 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=160&auto=format&fit=crop&q=80';
        if (nameEl) nameEl.textContent = item.name || 'Store';
        if (metaEl) metaEl.textContent = `${item.category || 'Store'} • ${item.city || 'Local'}`;
        if (linkEl) linkEl.textContent = storeUrl;
        if (linkAnchor) {
            linkAnchor.href = storeUrl;
            linkAnchor.title = `Visit ${item.name || 'Store'} Home Page`;
        }
        resetStandeeCopyBtnState();

        // Generate QR Code
        const qrContainer = document.getElementById('qrCodeContainer');
        if (qrContainer) {
            qrContainer.innerHTML = '';
            if (typeof QRCode !== 'undefined') {
                try {
                    new QRCode(qrContainer, {
                        text: storeUrl,
                        width: 175,
                        height: 175,
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
            if (window.lbPushModal) window.lbPushModal('shareQRModal', window.closeListingShareQRModal);
        }
    };

    window.closeListingShareQRModal = function() {
        const modal = document.getElementById('listingShareQRModal');
        if (modal) {
            modal.classList.remove('active');
            modal.style.display = 'none';
        }
        if (window.lbPopModal) window.lbPopModal('shareQRModal');
    };

    function resetStandeeCopyBtnState() {
        const standeeBtn = document.getElementById('standeeCopyBtn');
        const standeeIcon = document.getElementById('standeeCopyIcon');
        const standeeText = document.getElementById('standeeCopyText');
        if (standeeBtn) standeeBtn.classList.remove('copied');
        if (standeeIcon) standeeIcon.className = 'fa-regular fa-copy';
        if (standeeText) standeeText.textContent = 'Copy';
    }

    window.copyStoreShareLink = function() {
        const url = window.location.href;

        const showCopySuccess = () => {
            const standeeBtn = document.getElementById('standeeCopyBtn');
            const standeeIcon = document.getElementById('standeeCopyIcon');
            const standeeText = document.getElementById('standeeCopyText');
            if (standeeBtn) standeeBtn.classList.add('copied');
            if (standeeIcon) standeeIcon.className = 'fa-solid fa-check';
            if (standeeText) standeeText.textContent = 'Copied!';

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

    function generateStandeeCanvas() {
        const storeName = item.name || 'Store';
        const storeCategory = (item.category || 'Local Business') + ' • ' + (item.city || 'India');

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
        ctx.beginPath(); ctx.moveTo(180, 270); ctx.lineTo(180, 245); ctx.lineTo(205, 245); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(595, 245); ctx.lineTo(620, 245); ctx.lineTo(620, 270); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(180, 660); ctx.lineTo(180, 685); ctx.lineTo(205, 685); ctx.stroke();
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

    window.downloadStoreQRStandee = function() {
        const storeName = item.name || 'Store';
        const canvas = generateStandeeCanvas();

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

    window.shareStoreQRStandee = async function() {
        const storeName = item.name || 'Store';
        const storeUrl = window.location.href;
        const shareTitle = `${storeName} - LocalBazar Official Store`;
        const shareText = `Check out ${storeName} on LocalBazar! Scan QR or click link to browse catalog, view offers & order directly:\n${storeUrl}`;

        try {
            const canvas = generateStandeeCanvas();

            canvas.toBlob(async (blob) => {
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
                            if (shareErr.name === 'AbortError') return;
                            console.warn('File sharing failed, attempting URL sharing:', shareErr);
                        }
                    }
                }

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

    // 3. Apple-Style Floating Segmented Control (Products, Services, Reviews)
    const segmentButtons = document.querySelectorAll('.segment-btn');
    const tabPanes = document.querySelectorAll('.jd-tab-pane');
    const segmentIndicator = document.getElementById('segmentSliderIndicator');

    function updateSegmentSlider(index) {
        if (segmentIndicator) {
            segmentIndicator.style.transform = `translateX(${index * 100}%)`;
        }
    }

    segmentButtons.forEach((btn, index) => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            segmentButtons.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));

            btn.classList.add('active');
            const targetPane = document.getElementById(targetId);
            if (targetPane) targetPane.classList.add('active');

            updateSegmentSlider(index);
        });
    });

    // Populate Products Tab & Flipkart/Amazon Style Features
    const productsGrid = document.getElementById('detailProductsGrid');
    const noProductsFallback = document.getElementById('noProductsFallback');
    const tabProductCountBadge = document.getElementById('tabProductCountBadge');
    const shelfProductsSlider = document.getElementById('shelfProductsSlider');
    const storeFeaturedShelf = document.getElementById('storeFeaturedShelf');
    const storeProductSearchInput = document.getElementById('storeProductSearchInput');
    const storeCatsSlideTrack = document.getElementById('storeCatsSlideTrack');
    const storeAdsSlider = document.getElementById('storeAdsSlider');
    const storeAdsDots = document.getElementById('storeAdsDots');

    const products = Array.isArray(item.products) ? item.products : [];
    let displayProducts = products;

    if (tabProductCountBadge) tabProductCountBadge.textContent = displayProducts.length;

    // Show ALL store products on the shelf, with Top/Starred products prioritized first
    const initialTopProducts = [...displayProducts].sort((a, b) => {
        const aTop = (a.isTopProduct === true || a.isTop === true) ? 1 : 0;
        const bTop = (b.isTopProduct === true || b.isTop === true) ? 1 : 0;
        return bTop - aTop;
    });
    let currentShelfProducts = initialTopProducts;

    const shelfTitle = document.getElementById('shelfTitle');

    // Dedicated INR Currency Formatter (Ensures ₹ and amount are ALWAYS strictly on 1 line without wrapping)
    function formatCurrencyINR(val) {
        if (val === undefined || val === null || val === '') return '₹0';
        let str = String(val).trim();
        if (str.toLowerCase() === 'on request' || str.toLowerCase() === 'free') return str;

        const cleanDigits = str.replace(/[^\d.]/g, '');
        if (cleanDigits !== '' && !isNaN(Number(cleanDigits))) {
            const num = Number(cleanDigits);
            return `₹${num.toLocaleString('en-IN')}`;
        }
        str = str.replace(/^rs\.?\s*/i, '').replace(/^₹\s*/, '');
        return `₹${str}`;
    }

    // Helper: Render Square Box Products in Quick Shelf
    function renderProductList(itemsToRender, title = 'Featured Top Picks') {
        if (!shelfProductsSlider) return;
        currentShelfProducts = itemsToRender || [];

        if (shelfTitle) shelfTitle.textContent = title;

        if (currentShelfProducts.length > 0) {
            shelfProductsSlider.innerHTML = currentShelfProducts.map((p, idx) => {
                const prodImg = (Array.isArray(p.images) && p.images[0]) || p.image || p.img || 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=300&auto=format&fit=crop&q=80';
                const prodName = p.name || 'Product';
                const prodPrice = formatCurrencyINR(p.price);
                return `
                    <div class="shelf-prod-card" onclick="openDetailProductViewer(${idx})" style="cursor:pointer;" title="Click to view details">
                        <div class="shelf-prod-thumb-box">
                            <img src="${prodImg}" alt="${prodName}" class="shelf-prod-thumb" loading="lazy">
                        </div>
                        <div class="shelf-prod-meta">
                            <span class="shelf-prod-name" title="${prodName}">${prodName}</span>
                            <span class="shelf-prod-price">${prodPrice}</span>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            shelfProductsSlider.innerHTML = `
                <div style="width:100%; text-align:center; padding:1.75rem 1rem; background:#f8fafc; border:1px dashed #cbd5e1; border-radius:14px;">
                    <span style="font-size:1.8rem; display:block; margin-bottom:0.35rem;">📦</span>
                    <p style="margin:0; font-weight:700; color:#334155; font-size:0.92rem;">No Products Listed Under "${title}"</p>
                    <span style="font-size:0.8rem; color:#64748b;">This store currently has 0 items added under this category.</span>
                </div>
            `;
        }

        setTimeout(() => {
            if (typeof startShelfAutoSlide === 'function') startShelfAutoSlide();
        }, 400);
    }

    // Default Initial View: Render Top Products (or hide shelf if no products added to this store)
    if (displayProducts.length > 0) {
        renderProductList(
            initialTopProducts,
            'Featured Top Picks',
            '<i class="fa-solid fa-star" style="color:#f59e0b;"></i> Top Products',
            `${initialTopProducts.length} Products`
        );
    } else if (storeFeaturedShelf) {
        storeFeaturedShelf.style.display = 'none';
    }

    // Safe HTML Escape Helper
    function safeEscape(str = '') {
        return String(str).replace(/[&<>"']/g, m => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[m]);
    }

    // Highlight matching query characters in product name
    function highlightMatchText(text = '', query = '') {
        if (!query) return safeEscape(text);
        const escapedQ = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const parts = String(text).split(new RegExp(`(${escapedQ})`, 'gi'));
        return parts.map(part => {
            if (part.toLowerCase() === query.toLowerCase()) {
                return `<mark>${safeEscape(part)}</mark>`;
            }
            return safeEscape(part);
        }).join('');
    }

    // ================= FLIPKART/AMAZON STYLE AUTO-SUGGEST STORE SEARCH =================
    const storeSearchSuggestions = document.getElementById('storeSearchSuggestions');
    const btnClearStoreSearch = document.getElementById('btnClearStoreSearch');
    const storeSearchBarWrap = document.getElementById('storeSearchBarWrap');

    function renderAutoSuggestions(query = '') {
        if (!storeSearchSuggestions) return;
        const q = (query || '').toLowerCase().trim();

        if (!q) {
            storeSearchSuggestions.style.display = 'none';
            storeSearchSuggestions.innerHTML = '';
            if (btnClearStoreSearch) btnClearStoreSearch.style.display = 'none';
            return;
        }

        if (btnClearStoreSearch) btnClearStoreSearch.style.display = 'inline-flex';

        // Filter ONLY products whose name STARTS WITH the searched word (strict prefix matching)
        const matched = displayProducts.filter(p => {
            const rawName = (p.name || '').trim().toLowerCase();
            const cleanName = rawName.replace(/^[^\p{L}\p{N}]+/u, '').trim();
            return cleanName.startsWith(q) || rawName.startsWith(q);
        });

        // Sort results alphabetically for professional presentation
        matched.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        if (matched.length === 0) {
            storeSearchSuggestions.innerHTML = `
                <div class="search-sugg-empty">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    No products found matching "<strong>${safeEscape(q)}</strong>"
                </div>
            `;
            storeSearchSuggestions.style.display = 'block';
            return;
        }

        storeSearchSuggestions.innerHTML = `
            <div class="search-sugg-header">
                <span>Matching Products (${matched.length})</span>
                <span>Click to view details</span>
            </div>
            ${matched.map((p, idx) => {
                const coverImg = (Array.isArray(p.images) && p.images[0]) || p.image || p.img || 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=120';
                const priceFormatted = formatCurrencyINR(p.price);
                const highlightedName = highlightMatchText(p.name || 'Product', q);
                const catLabel = p.category || 'Store Item';

                return `
                    <div class="search-sugg-item" data-sugg-idx="${idx}">
                        <img src="${coverImg}" alt="${safeEscape(p.name)}" class="search-sugg-thumb" loading="lazy">
                        <div class="search-sugg-info">
                            <span class="search-sugg-title">${highlightedName}</span>
                            <div class="search-sugg-meta">
                                <span class="search-sugg-price">${priceFormatted}</span>
                                <span class="search-sugg-cat">${safeEscape(catLabel)}</span>
                            </div>
                        </div>
                        <i class="fa-solid fa-chevron-right search-sugg-action"></i>
                    </div>
                `;
            }).join('')}
        `;

        storeSearchSuggestions.style.display = 'block';

        // Bind click handler to open the professional product popup modal
        storeSearchSuggestions.querySelectorAll('.search-sugg-item').forEach(el => {
            el.addEventListener('click', () => {
                const suggIdx = parseInt(el.getAttribute('data-sugg-idx'), 10);
                const selectedProd = matched[suggIdx];
                if (selectedProd) {
                    storeSearchSuggestions.style.display = 'none';
                    if (storeProductSearchInput) storeProductSearchInput.value = selectedProd.name;
                    openDetailProductViewer(selectedProd);
                }
            });
        });
    }

    storeProductSearchInput?.addEventListener('input', (e) => {
        renderAutoSuggestions(e.target.value);
    });

    storeProductSearchInput?.addEventListener('focus', () => {
        if (storeProductSearchInput.value.trim()) {
            renderAutoSuggestions(storeProductSearchInput.value);
        }
    });

    btnClearStoreSearch?.addEventListener('click', () => {
        if (storeProductSearchInput) storeProductSearchInput.value = '';
        renderAutoSuggestions('');
        storeProductSearchInput?.focus();
    });

    // Close suggestions dropdown on outside click
    document.addEventListener('click', (e) => {
        if (storeSearchBarWrap && !storeSearchBarWrap.contains(e.target)) {
            if (storeSearchSuggestions) storeSearchSuggestions.style.display = 'none';
        }
    });

    // Icon / Emoji Resolver for public store sliding category track
    function resolvePublicStoreCategoryIcon(label = '') {
        if (typeof window.resolveStoreCategoryIcon === 'function') {
            return window.resolveStoreCategoryIcon(label);
        }
        const l = (label || '').toLowerCase().trim();
        if (l.includes('biryani') || l.includes('rice') || l.includes('pulao')) return '🍚';
        if (l.includes('burger') || l.includes('fast food') || l.includes('roll') || l.includes('sandwich')) return '🍔';
        if (l.includes('pizza')) return '🍕';
        if (l.includes('starter') || l.includes('main course') || l.includes('thali') || l.includes('snack') || l.includes('food')) return '🍛';
        if (l.includes('drink') || l.includes('tea') || l.includes('coffee') || l.includes('juice') || l.includes('soda')) return '🥤';
        if (l.includes('ice cream')) return '🍨';
        if (l.includes('dessert') || l.includes('sweet') || l.includes('cake') || l.includes('bakery')) return '🍰';
        if (l.includes('saree') || l.includes('women') || l.includes('ladies') || l.includes('dress')) return '👗';
        if (l.includes('kid') || l.includes('baby') || l.includes('child')) return '🧒';
        if (l.includes('shoe') || l.includes('footwear') || l.includes('sneaker')) return '👟';
        if (l.includes('shirt') || l.includes('pant') || l.includes('jeans') || l.includes('men') || l.includes('cloth')) return '👕';
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

    function formatPublicCatIcon(icon, label = '') {
        if (typeof window.formatCatIconHtml === 'function') {
            return window.formatCatIconHtml(icon, label);
        }
        let ic = (icon || '').trim();
        if (!ic) ic = resolvePublicStoreCategoryIcon(label);
        if (ic.includes('fa-') && window.faToEmoji) {
            ic = window.faToEmoji(ic);
        }
        if (/fa-[a-z0-9-]+/i.test(ic)) {
            const cls = ic.includes(' ') ? ic : `fa-solid ${ic}`;
            return `<i class="${cls}"></i>`;
        }
        return `<span class="cat-emoji" style="font-family:'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif; font-style:normal; line-height:1;">${ic}</span>`;
    }

    // Dynamic In-Store Category Slide Track (Render from Listing's custom categories if saved, or Admin defaults for this Category)
    if (storeCatsSlideTrack) {
        let rawStoreCats = Array.isArray(item.storeCategories) && item.storeCategories.length > 0
            ? item.storeCategories
            : [];

        if (rawStoreCats.length === 0 && item.category) {
            try {
                const rawCats = localStorage.getItem('lb_categories');
                const allCats = rawCats ? JSON.parse(rawCats) : [];
                const matched = allCats.find(c => (c.name || '').trim().toLowerCase() === (item.category || '').trim().toLowerCase());
                if (matched && Array.isArray(matched.storeCategories) && matched.storeCategories.length > 0) {
                    rawStoreCats = matched.storeCategories;
                }
            } catch (err) {}
        }

        if (rawStoreCats.length === 0) {
            rawStoreCats = [
                { label: 'For You', tag: 'all', icon: '🛍️' },
                { label: 'Popular', tag: 'popular', icon: '🔥' },
                { label: 'Featured', tag: 'featured', icon: '⭐' },
                { label: 'Offers', tag: 'offers', icon: '🏷️' }
            ];
        }

        // Color theme palette for colorful and distinctive icon backgrounds
        const SLIDE_THEMES = [
            'cat-box-for-you',     // Blue
            'cat-box-popular',     // Rose / Red
            'cat-box-fashion',     // Purple
            'cat-box-electronics', // Cyan / Teal
            'cat-box-grocery',     // Emerald Green
            'cat-box-beauty',      // Pink
            'cat-box-home'         // Warm Amber
        ];

        // Normalize every category item so label, tag, icon, and theme are always 100% valid
        const normalizedCats = rawStoreCats.map((c, idx) => {
            const label = typeof c === 'string' ? c.trim() : (c.label || c.name || 'Category').trim();
            const tag = typeof c === 'string'
                ? label.toLowerCase().replace(/[^a-z0-9]+/g, '-')
                : (c.tag || label.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
            let icon = (typeof c === 'object' && c && c.icon && c.icon !== 'fa-tag' && c.icon !== 'fa-bag-shopping')
                ? c.icon
                : resolvePublicStoreCategoryIcon(label);
            if (!icon || icon === 'fa-tag') {
                icon = resolvePublicStoreCategoryIcon(label);
            }
            const themeClass = SLIDE_THEMES[idx % SLIDE_THEMES.length];
            return { label, tag, icon, themeClass };
        });

        storeCatsSlideTrack.innerHTML = normalizedCats.map((c, idx) => {
            return `
            <button type="button" class="store-cat-item ${c.themeClass} ${idx === 0 ? 'active' : ''}" data-cat-filter="${c.tag}">
                <div class="store-cat-icon-circle">${formatPublicCatIcon(c.icon, c.label)}</div>
                <span>${c.label}</span>
            </button>
            `;
        }).join('');

        const catBtns = storeCatsSlideTrack.querySelectorAll('.store-cat-item');
        catBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const catType = (btn.getAttribute('data-cat-filter') || '').toLowerCase().trim();
                const matchedItem = normalizedCats.find(c => (c.tag || '').toLowerCase() === catType);
                const catTag = matchedItem ? matchedItem.tag : catType;

                // Professional Experience: Open the dedicated Store Category Page!
                const targetId = encodeURIComponent(item.id || '');
                window.location.href = `store-category.html?id=${targetId}&cat=${encodeURIComponent(catTag)}`;
            });
        });
    }

    // ================= STOREFRONT PRODUCT DETAIL VIEWER MODAL =================
    const detailProductModalBackdrop = document.getElementById('detailProductModalBackdrop');
    const dpmCategory = document.getElementById('dpmCategory');
    const dpmSliderTrack = document.getElementById('dpmSliderTrack');
    const dpmSliderDots = document.getElementById('dpmSliderDots');
    const dpmPrice = document.getElementById('dpmPrice');
    const dpmStockPill = document.getElementById('dpmStockPill');
    const dpmTitle = document.getElementById('dpmTitle');
    const dpmDesc = document.getElementById('dpmDesc');
    const btnDpmChat = document.getElementById('btnDpmChat');
    const btnDpmCall = document.getElementById('btnDpmCall');

    window.openDetailProductViewer = function(productOrIdx) {
        if (!detailProductModalBackdrop) return;
        const p = (typeof productOrIdx === 'object' && productOrIdx !== null)
            ? productOrIdx
            : currentShelfProducts[productOrIdx];
        if (!p) return;

        if (dpmCategory) dpmCategory.textContent = p.category || 'Product';
        if (dpmTitle) dpmTitle.textContent = p.name || 'Product Details';
        if (dpmPrice) dpmPrice.textContent = formatCurrencyINR(p.price);
        if (dpmDesc) dpmDesc.textContent = p.details || p.description || 'Contact the merchant directly for orders, home delivery, custom sizes, or inquiries.';

        const isOutOfStock = p.stockStatus === 'out_of_stock';
        if (dpmStockPill) {
            dpmStockPill.textContent = isOutOfStock ? 'Out of Stock' : 'In Stock';
            dpmStockPill.className = `dpm-stock-pill ${isOutOfStock ? 'out' : 'in'}`;
        }

        const images = Array.isArray(p.images) && p.images.length > 0
            ? p.images
            : (p.image ? [p.image] : ['https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=400']);

        if (dpmSliderTrack) {
            dpmSliderTrack.innerHTML = images.map(src => `<img src="${src}" class="dpm-slide-img" alt="${p.name}">`).join('');
            dpmSliderTrack.scrollLeft = 0;
        }

        if (dpmSliderDots) {
            if (images.length > 1) {
                dpmSliderDots.style.display = 'flex';
                dpmSliderDots.innerHTML = images.map((_, i) => `<span class="dot ${i === 0 ? 'active' : ''}"></span>`).join('');
                dpmSliderTrack.onscroll = () => {
                    const scrollLeft = dpmSliderTrack.scrollLeft;
                    const width = dpmSliderTrack.offsetWidth || 1;
                    const active = Math.round(scrollLeft / width);
                    dpmSliderDots.querySelectorAll('.dot').forEach((d, i) => d.classList.toggle('active', i === active));
                };
            } else {
                dpmSliderDots.style.display = 'none';
            }
        }

        if (btnDpmChat) {
            btnDpmChat.onclick = () => {
                const prod = p;
                if (detailProductModalBackdrop) detailProductModalBackdrop.style.display = 'none';
                if (window.lbTransitionModal) {
                    window.lbTransitionModal('detailProductViewer', 'chatModal', () => {
                        chatModalBackdrop?.classList.remove('open');
                    });
                }
                window.openProductInquiryChat(prod, true);
            };
        }

        if (btnDpmCall) {
            btnDpmCall.onclick = () => {
                window.location.href = `tel:${item.phone || ''}`;
            };
        }

        detailProductModalBackdrop.style.display = 'flex';
        if (window.lbPushModal) window.lbPushModal('detailProductViewer', window.closeDetailProductViewer);
    };

    window.closeDetailProductViewer = function() {
        if (detailProductModalBackdrop) {
            detailProductModalBackdrop.style.display = 'none';
        }
        if (window.lbPopModal) window.lbPopModal('detailProductViewer');
    };

    // ================= 1. 16:9 PROMOTIONAL BANNERS AUTO-SLIDER (CIRCULAR LOOP) =================
    const storeAdsCarouselWrap = document.getElementById('storeAdsCarouselWrap');
    const btnAdsPrev = document.getElementById('btnAdsPrev');
    const btnAdsNext = document.getElementById('btnAdsNext');
    let adsAutoSlideTimer = null;
    let isAdsPaused = false;

    // Render Dynamic 16:9 Store Banners (Max 4 slides: Lister Banners first, remaining filled with Admin Default Banners)
    function initStoreBanners() {
        if (!storeAdsSlider) return;

        // 1. Lister's custom banners
        let listerBanners = [];
        if (Array.isArray(item.banners)) {
            listerBanners = item.banners.filter(b => b && (b.image || b.heading || b.title));
        }

        // 2. Admin's default fallback banners
        let adminBanners = [];
        try {
            const rawDef = localStorage.getItem('lb_default_banners');
            if (rawDef) {
                const parsed = JSON.parse(rawDef);
                if (Array.isArray(parsed)) {
                    adminBanners = parsed.filter(b => b && (typeof b === 'string' ? b : b.image));
                }
            }
        } catch (e) {}

        // 3. Compose combined banners (Maximum 4 slides)
        // If lister added 2: show lister's 2, then Admin's 1 & 2
        // If lister added 4: show lister's 4, 0 Admin banners
        // If lister added 0: show Admin's 4 banners
        const finalBanners = [];

        // Add lister banners (up to 4)
        const listerCountToAdd = Math.min(listerBanners.length, 4);
        for (let i = 0; i < listerCountToAdd; i++) {
            const b = listerBanners[i];
            const img = typeof b === 'string' ? b : (b.image || '');
            if (img) {
                finalBanners.push({
                    image: img,
                    isLister: true,
                    heading: b.heading || item.name
                });
            }
        }

        // Fill remaining slots up to 4 with Admin default fallback banners
        const remainingSlots = 4 - finalBanners.length;
        if (remainingSlots > 0 && adminBanners.length > 0) {
            for (let i = 0; i < remainingSlots && i < adminBanners.length; i++) {
                const ab = adminBanners[i];
                const img = typeof ab === 'string' ? ab : (ab.image || '');
                if (img) {
                    finalBanners.push({
                        image: img,
                        isAdmin: true,
                        heading: item.name
                    });
                }
            }
        }

        // If no banners from either lister or admin, completely hide the banner carousel
        if (finalBanners.length === 0) {
            if (storeAdsCarouselWrap) storeAdsCarouselWrap.style.display = 'none';
            return;
        }

        if (storeAdsCarouselWrap) storeAdsCarouselWrap.style.display = 'block';

        storeAdsSlider.innerHTML = finalBanners.map((b, idx) => `
            <div class="store-ad-card is-custom-img" data-banner-idx="${idx}">
                <img src="${b.image}" alt="${item.name} Banner ${idx + 1}" class="store-ad-custom-img" loading="lazy">
            </div>
        `).join('');

        if (storeAdsDots) {
            storeAdsDots.innerHTML = finalBanners.map((_, i) => `<span class="ad-dot ${i === 0 ? 'active' : ''}" data-dot-idx="${i}"></span>`).join('');
            storeAdsDots.style.display = finalBanners.length > 1 ? 'flex' : 'none';
        }

        setupAdsCarouselEvents();
        startAdsAutoSlide();
    }

    function getAdsScrollStep() {
        if (!storeAdsSlider) return 320;
        const firstCard = storeAdsSlider.querySelector('.store-ad-card');
        if (firstCard) {
            const gap = parseFloat(window.getComputedStyle(storeAdsSlider).gap) || 16;
            return firstCard.offsetWidth + gap;
        }
        return storeAdsSlider.offsetWidth;
    }

    function isAdsOverflowing() {
        if (!storeAdsSlider) return false;
        return storeAdsSlider.scrollWidth > storeAdsSlider.clientWidth + 12;
    }

    function updateAdsControlsVisibility() {
        const isOverflow = isAdsOverflowing();
        if (btnAdsPrev) btnAdsPrev.style.display = isOverflow ? 'flex' : 'none';
        if (btnAdsNext) btnAdsNext.style.display = isOverflow ? 'flex' : 'none';
        if (storeAdsDots) storeAdsDots.style.display = isOverflow ? 'flex' : 'none';
    }

    function slideAdsNext() {
        if (!storeAdsSlider || !isAdsOverflowing()) return;

        const step = getAdsScrollStep();
        const maxScroll = storeAdsSlider.scrollWidth - storeAdsSlider.clientWidth - 15;
        const currentScroll = storeAdsSlider.scrollLeft;

        if (currentScroll >= maxScroll) {
            // Round/Circular loop smoothly to the first slide
            storeAdsSlider.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
            storeAdsSlider.scrollBy({ left: step, behavior: 'smooth' });
        }
    }

    function slideAdsPrev() {
        if (!storeAdsSlider || !isAdsOverflowing()) return;

        const step = getAdsScrollStep();
        const currentScroll = storeAdsSlider.scrollLeft;

        if (currentScroll <= 15) {
            storeAdsSlider.scrollTo({ left: storeAdsSlider.scrollWidth - storeAdsSlider.clientWidth, behavior: 'smooth' });
        } else {
            storeAdsSlider.scrollBy({ left: -step, behavior: 'smooth' });
        }
    }

    function startAdsAutoSlide() {
        stopAdsAutoSlide();
        if (!isAdsOverflowing()) return;

        adsAutoSlideTimer = setInterval(() => {
            if (!isAdsPaused) {
                slideAdsNext();
            }
        }, 3600);
    }

    function stopAdsAutoSlide() {
        if (adsAutoSlideTimer) {
            clearInterval(adsAutoSlideTimer);
            adsAutoSlideTimer = null;
        }
    }

    function setupAdsCarouselEvents() {
        if (!storeAdsSlider) return;

        // Auto indicator sync
        storeAdsSlider.addEventListener('scroll', () => {
            if (!storeAdsDots) return;
            const scrollLeft = storeAdsSlider.scrollLeft;
            const step = getAdsScrollStep() || 1;
            const activeIndex = Math.min(
                Math.round(scrollLeft / step),
                (storeAdsDots.querySelectorAll('.ad-dot').length - 1)
            );
            storeAdsDots.querySelectorAll('.ad-dot').forEach((dot, idx) => {
                dot.classList.toggle('active', idx === activeIndex);
            });
        });

        // Click on dots to jump
        storeAdsDots?.querySelectorAll('.ad-dot').forEach(dot => {
            dot.addEventListener('click', () => {
                const idx = parseInt(dot.getAttribute('data-dot-idx'), 10);
                const step = getAdsScrollStep();
                storeAdsSlider.scrollTo({ left: idx * step, behavior: 'smooth' });
            });
        });

        // Prev & Next buttons
        btnAdsPrev?.addEventListener('click', (e) => {
            e.stopPropagation();
            slideAdsPrev();
        });

        btnAdsNext?.addEventListener('click', (e) => {
            e.stopPropagation();
            slideAdsNext();
        });

        // Pause on hover or touch, resume smoothly on leave
        storeAdsCarouselWrap?.addEventListener('mouseenter', () => { isAdsPaused = true; });
        storeAdsCarouselWrap?.addEventListener('mouseleave', () => { isAdsPaused = false; });
        storeAdsCarouselWrap?.addEventListener('touchstart', () => { isAdsPaused = true; }, { passive: true });
        storeAdsCarouselWrap?.addEventListener('touchend', () => {
            setTimeout(() => { isAdsPaused = false; }, 1500);
        }, { passive: true });

        window.addEventListener('resize', () => {
            updateAdsControlsVisibility();
            if (!isAdsOverflowing()) {
                stopAdsAutoSlide();
            } else if (!adsAutoSlideTimer) {
                startAdsAutoSlide();
            }
        });

        // Initial controls sync
        updateAdsControlsVisibility();
    }

    initStoreBanners();

    // ================= 2. FEATURED TOP PICKS AUTO-SLIDER (CIRCULAR LOOP) =================
    const btnShelfPrev = document.getElementById('btnShelfPrev');
    const btnShelfNext = document.getElementById('btnShelfNext');
    let shelfAutoSlideTimer = null;
    let isShelfPaused = false;

    function isShelfOverflowing() {
        if (!shelfProductsSlider) return false;
        return (shelfProductsSlider.scrollWidth - shelfProductsSlider.clientWidth) > 20;
    }

    function slideShelfNext() {
        if (!shelfProductsSlider || !isShelfOverflowing()) return;

        const firstCard = shelfProductsSlider.querySelector('.shelf-prod-card');
        const cardWidth = firstCard ? firstCard.offsetWidth : 120;
        const step = cardWidth + 12; // Card width + gap
        const maxScroll = shelfProductsSlider.scrollWidth - shelfProductsSlider.clientWidth;
        const currentScroll = shelfProductsSlider.scrollLeft;

        if (currentScroll >= (maxScroll - 15)) {
            // Round/Circular loop smoothly to the beginning
            shelfProductsSlider.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
            shelfProductsSlider.scrollBy({ left: step, behavior: 'smooth' });
        }
    }

    function slideShelfPrev() {
        if (!shelfProductsSlider) return;

        const firstCard = shelfProductsSlider.querySelector('.shelf-prod-card');
        const cardWidth = firstCard ? firstCard.offsetWidth : 120;
        const step = cardWidth + 12;
        const currentScroll = shelfProductsSlider.scrollLeft;

        if (currentScroll <= 15) {
            shelfProductsSlider.scrollTo({ left: shelfProductsSlider.scrollWidth, behavior: 'smooth' });
        } else {
            shelfProductsSlider.scrollBy({ left: -step, behavior: 'smooth' });
        }
    }

    function startShelfAutoSlide() {
        stopShelfAutoSlide();
        if (!isShelfOverflowing()) return;

        shelfAutoSlideTimer = setInterval(() => {
            if (!isShelfPaused && isShelfOverflowing()) {
                slideShelfNext();
            }
        }, 2800);
    }

    function stopShelfAutoSlide() {
        if (shelfAutoSlideTimer) {
            clearInterval(shelfAutoSlideTimer);
            shelfAutoSlideTimer = null;
        }
    }

    function setupShelfAutoSlideEvents() {
        if (!shelfProductsSlider) return;

        btnShelfPrev?.addEventListener('click', (e) => {
            e.stopPropagation();
            slideShelfPrev();
        });

        btnShelfNext?.addEventListener('click', (e) => {
            e.stopPropagation();
            slideShelfNext();
        });

        // Pause on hover or touch, resume smoothly on leave
        storeFeaturedShelf?.addEventListener('mouseenter', () => { isShelfPaused = true; });
        storeFeaturedShelf?.addEventListener('mouseleave', () => { isShelfPaused = false; });
        storeFeaturedShelf?.addEventListener('touchstart', () => { isShelfPaused = true; }, { passive: true });
        storeFeaturedShelf?.addEventListener('touchend', () => {
            setTimeout(() => { isShelfPaused = false; }, 1500);
        }, { passive: true });

        // Check and start
        setTimeout(() => {
            startShelfAutoSlide();
        }, 800);
    }

    setupShelfAutoSlideEvents();

    // Populate Services Tab
    const servicesGrid = document.getElementById('detailServicesGrid');
    const noServicesFallback = document.getElementById('noServicesFallback');
    const tabServiceCountBadge = document.getElementById('tabServiceCountBadge');
    const services = Array.isArray(item.services) ? item.services : [];

    if (tabServiceCountBadge) tabServiceCountBadge.textContent = services.length;

    if (services.length > 0) {
        if (noServicesFallback) noServicesFallback.style.display = 'none';
        if (servicesGrid) {
            servicesGrid.style.display = 'grid';
            servicesGrid.innerHTML = services.map(s => {
                const serviceName = typeof s === 'string' ? s : (s.name || 'Service');
                const servicePrice = typeof s === 'object' && s.price ? s.price : 'Available on Request';
                return `
                    <div class="service-item-card">
                        <div class="service-card-icon">
                            <i class="fa-solid fa-check-circle"></i>
                        </div>
                        <div class="service-card-info">
                            <h4 class="service-card-title">${serviceName}</h4>
                            <span class="service-card-price">${servicePrice}</span>
                        </div>
                    </div>
                `;
            }).join('');
        }
    } else {
        if (servicesGrid) servicesGrid.style.display = 'none';
        if (noServicesFallback) noServicesFallback.style.display = 'block';
    }

    // ================= RATINGS & REVIEWS ENGINE (SINGLE REVIEW PER USER & EDITABLE) =================
    const tabReviewCountBadge = document.getElementById('tabReviewCountBadge');
    const reviewsTabScore = document.getElementById('reviewsTabScore');
    const reviewsTabCountText = document.getElementById('reviewsTabCountText');
    const detailReviewsList = document.getElementById('detailReviewsList');
    const btnWriteReviewToggle = document.getElementById('btnWriteReviewToggle');
    const writeReviewBtnText = document.getElementById('writeReviewBtnText');
    const writeReviewCard = document.getElementById('writeReviewCard');
    const writeReviewCardTitle = document.getElementById('writeReviewCardTitle');
    const writeReviewCardSub = document.getElementById('writeReviewCardSub');
    const btnCancelReview = document.getElementById('btnCancelReview');
    const btnCancelReviewBtn = document.getElementById('btnCancelReviewBtn');
    const writeReviewForm = document.getElementById('writeReviewForm');
    const starPicker = document.getElementById('starRatingPicker');
    const reviewStarValue = document.getElementById('reviewStarValue');
    const starRatingLabel = document.getElementById('starRatingLabel');
    const editingReviewIdInput = document.getElementById('editingReviewId');
    const submitReviewBtnText = document.getElementById('submitReviewBtnText');
    const ownerReviewNotice = document.getElementById('ownerReviewNotice');

    const starDescMap = {
        1: 'Poor (1 Star)',
        2: 'Fair (2 Stars)',
        3: 'Average (3 Stars)',
        4: 'Very Good (4 Stars)',
        5: 'Excellent (5 Stars)'
    };

    function setStarRatingDisplay(val) {
        if (!starPicker) return;
        const num = Math.max(1, Math.min(5, Number(val) || 5));
        if (reviewStarValue) reviewStarValue.value = num;
        if (starRatingLabel) starRatingLabel.textContent = starDescMap[num] || `${num} Stars`;
        const stars = starPicker.querySelectorAll('.star-pick');
        stars.forEach(s => {
            const sVal = parseInt(s.getAttribute('data-val'), 10);
            if (sVal <= num) {
                s.classList.add('active');
            } else {
                s.classList.remove('active');
            }
        });
    }

    function isCurrentUserManagerOrOwner() {
        let currentUser = null;
        try { currentUser = JSON.parse(localStorage.getItem('lb_current_user')); } catch {}
        if (!currentUser) return false;

        const uId = String(currentUser.id || '').trim();
        const uEmail = (currentUser.email || '').trim().toLowerCase();
        const uPhone = (currentUser.phone || '').replace(/\D/g, '');

        if (item.userId && String(item.userId).trim() === uId) return true;
        if (item.userEmail && uEmail && item.userEmail.trim().toLowerCase() === uEmail) return true;
        if (item.email && uEmail && item.email.trim().toLowerCase() === uEmail) return true;
        if (item.phone && uPhone && item.phone.replace(/\D/g, '') === uPhone) return true;

        return false;
    }

    function findCurrentUserReview(reviewsList) {
        let currentUser = null;
        try { currentUser = JSON.parse(localStorage.getItem('lb_current_user')); } catch {}
        if (!currentUser || !Array.isArray(reviewsList) || reviewsList.length === 0) return null;

        const uId = String(currentUser.id || '').trim();
        const uEmail = (currentUser.email || '').trim().toLowerCase();
        const uPhone = (currentUser.phone || '').replace(/\D/g, '');

        return reviewsList.find(r => {
            if (uId && r.userId && String(r.userId).trim() === uId) return true;
            if (uEmail && r.userEmail && r.userEmail.trim().toLowerCase() === uEmail) return true;
            if (uPhone && r.userPhone && r.userPhone.replace(/\D/g, '') === uPhone) return true;
            return false;
        });
    }

    function loadAndRenderReviews() {
        let storedReviews = [];
        try {
            const raw = localStorage.getItem(`lb_reviews_${item.id}`);
            storedReviews = raw ? JSON.parse(raw) : [];
        } catch {}

        const count = storedReviews.length;
        let avg = '0.0';
        if (count > 0) {
            const sum = storedReviews.reduce((acc, cur) => acc + (Number(cur.rating) || 5), 0);
            avg = (sum / count).toFixed(1);
        } else {
            avg = (item.rating && !isNaN(item.rating)) ? Number(item.rating).toFixed(1) : '4.5';
        }

        // Header updates
        const avgEl = document.getElementById('detailAvgRating');
        const countEl = document.getElementById('detailReviewsTotalText');
        if (avgEl) avgEl.textContent = avg;
        if (countEl) countEl.textContent = `${count} ratings`;

        // Section Summary Card updates
        if (reviewsTabScore) reviewsTabScore.textContent = avg;
        if (reviewsTabCountText) {
            reviewsTabCountText.textContent = count > 0 
                ? `Based on ${count} verified rating${count > 1 ? 's' : ''}` 
                : 'No customer ratings yet';
        }
        if (tabReviewCountBadge) {
            tabReviewCountBadge.textContent = count;
            tabReviewCountBadge.style.display = count > 0 ? 'inline-block' : 'none';
        }

        // Star breakdown progress bars
        for (let star = 1; star <= 5; star++) {
            const starCount = storedReviews.filter(r => Math.round(Number(r.rating) || 5) === star).length;
            const pct = count > 0 ? Math.round((starCount / count) * 100) : 0;
            const fillEl = document.getElementById(`starBarFill${star}`);
            const countTextEl = document.getElementById(`starBarCount${star}`);
            if (fillEl) fillEl.style.width = `${pct}%`;
            if (countTextEl) countTextEl.textContent = starCount;
        }

        // Owner check
        const isOwner = isCurrentUserManagerOrOwner();
        if (isOwner) {
            if (ownerReviewNotice) ownerReviewNotice.style.display = 'flex';
            if (btnWriteReviewToggle) btnWriteReviewToggle.style.display = 'none';
            if (writeReviewCard) writeReviewCard.style.display = 'none';
        } else {
            if (ownerReviewNotice) ownerReviewNotice.style.display = 'none';
            if (btnWriteReviewToggle) btnWriteReviewToggle.style.display = 'inline-flex';
        }

        // Check if current user already submitted a review
        const myReview = findCurrentUserReview(storedReviews);
        if (myReview) {
            if (writeReviewBtnText) writeReviewBtnText.textContent = 'Edit Your Review';
            if (writeReviewCardTitle) writeReviewCardTitle.textContent = 'Edit Your Review & Rating';
            if (writeReviewCardSub) writeReviewCardSub.textContent = 'You have already reviewed this business. You can update your rating or feedback anytime.';
            if (submitReviewBtnText) submitReviewBtnText.textContent = 'Update Review';
        } else {
            if (writeReviewBtnText) writeReviewBtnText.textContent = 'Write a Review';
            if (writeReviewCardTitle) writeReviewCardTitle.textContent = 'Rate & Review This Business';
            if (writeReviewCardSub) writeReviewCardSub.textContent = 'Tap stars to rate and write your genuine customer experience';
            if (submitReviewBtnText) submitReviewBtnText.textContent = 'Submit Review';
        }

        // Render customer review list
        if (detailReviewsList) {
            if (storedReviews.length === 0) {
                detailReviewsList.innerHTML = `
                    <div style="text-align:center; padding:2rem 1.5rem; color:#64748b; font-size:0.88rem; background:#f8fafc; border-radius:16px; border:1.5px dashed #cbd5e1;">
                        <i class="fa-regular fa-star" style="font-size:2rem; color:#f59e0b; display:block; margin-bottom:0.6rem;"></i>
                        <p style="margin:0 0 0.25rem 0; font-weight:800; color:#0f172a; font-size:0.95rem;">No customer reviews yet</p>
                        <span style="font-size:0.82rem; color:#64748b;">Be the first customer to share your experience with <strong>${item.name}</strong>.</span>
                    </div>
                `;
            } else {
                detailReviewsList.innerHTML = storedReviews.map(r => {
                    const isMine = myReview && (r.id === myReview.id || (r.userId && r.userId === myReview.userId));
                    const initial = (r.name || 'U').charAt(0).toUpperCase();
                    const rStar = Math.max(1, Math.min(5, Number(r.rating) || 5));
                    return `
                        <div class="review-single-item ${isMine ? 'my-review-card' : ''}" style="${isMine ? 'border: 1.5px solid #60a5fa; background: #f0f9ff;' : ''}">
                            <div class="rev-item-header">
                                <div class="rev-user-meta">
                                    <div class="rev-avatar-circle" style="${isMine ? 'background: linear-gradient(135deg, #2563eb, #1d4ed8);' : ''}">${initial}</div>
                                    <div>
                                        <div style="display:flex; align-items:center; gap:0.35rem; flex-wrap:wrap;">
                                            <span class="rev-name">${r.name || 'Local Customer'}</span>
                                            ${isMine ? '<span style="background:#2563eb; color:#ffffff; font-size:0.65rem; font-weight:800; padding:0.1rem 0.4rem; border-radius:10px;">YOU</span>' : '<span class="rev-user-badge-verified"><i class="fa-solid fa-circle-check"></i> Verified</span>'}
                                            ${r.isEdited ? '<span class="rev-edited-tag">(Edited)</span>' : ''}
                                        </div>
                                        <span class="rev-date">${r.date || 'Recent'}</span>
                                    </div>
                                </div>
                                <div style="display:flex; align-items:center; gap:0.5rem;">
                                    <span class="rev-star-pill">${rStar} <i class="fa-solid fa-star"></i></span>
                                    ${isMine ? `<button type="button" class="btn-edit-my-rev" onclick="openEditMyReview()" title="Edit your review"><i class="fa-solid fa-pen"></i> Edit</button>` : ''}
                                </div>
                            </div>
                            <p class="rev-text-comment">${r.comment || ''}</p>
                        </div>
                    `;
                }).join('');
            }
        }
    }

    // Toggle Review Form Card
    btnWriteReviewToggle?.addEventListener('click', () => {
        if (!writeReviewCard) return;
        const isOpen = writeReviewCard.style.display !== 'none';
        if (isOpen) {
            writeReviewCard.style.display = 'none';
        } else {
            openReviewFormWithPrefill();
        }
    });

    window.openEditMyReview = function() {
        openReviewFormWithPrefill();
    };

    function openReviewFormWithPrefill() {
        if (!writeReviewCard) return;
        let storedReviews = [];
        try {
            const raw = localStorage.getItem(`lb_reviews_${item.id}`);
            storedReviews = raw ? JSON.parse(raw) : [];
        } catch {}

        let currentUser = null;
        try { currentUser = JSON.parse(localStorage.getItem('lb_current_user')); } catch {}

        const myReview = findCurrentUserReview(storedReviews);

        if (myReview) {
            if (writeReviewCardTitle) writeReviewCardTitle.textContent = 'Edit Your Review & Rating';
            if (writeReviewCardSub) writeReviewCardSub.textContent = 'Update your rating or comments below.';
            if (submitReviewBtnText) submitReviewBtnText.textContent = 'Update Review';
            if (editingReviewIdInput) editingReviewIdInput.value = myReview.id || 'my_rev';

            const nameInput = document.getElementById('reviewUserName');
            const textInput = document.getElementById('reviewUserText');
            if (nameInput) nameInput.value = myReview.name || '';
            if (textInput) textInput.value = myReview.comment || '';
            setStarRatingDisplay(myReview.rating || 5);
        } else {
            if (writeReviewCardTitle) writeReviewCardTitle.textContent = 'Rate & Review This Business';
            if (writeReviewCardSub) writeReviewCardSub.textContent = 'Tap stars to rate and write your genuine customer experience';
            if (submitReviewBtnText) submitReviewBtnText.textContent = 'Submit Review';
            if (editingReviewIdInput) editingReviewIdInput.value = '';

            const nameInput = document.getElementById('reviewUserName');
            const textInput = document.getElementById('reviewUserText');
            if (nameInput) nameInput.value = currentUser?.name || '';
            if (textInput) textInput.value = '';
            setStarRatingDisplay(5);
        }

        writeReviewCard.style.display = 'block';
        writeReviewCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
            document.getElementById('reviewUserText')?.focus();
        }, 150);
    }

    const closeFormHandler = () => {
        if (writeReviewCard) writeReviewCard.style.display = 'none';
    };
    btnCancelReview?.addEventListener('click', closeFormHandler);
    btnCancelReviewBtn?.addEventListener('click', closeFormHandler);

    // Interactive Star Picker Clicks
    if (starPicker) {
        const stars = starPicker.querySelectorAll('.star-pick');
        stars.forEach(s => {
            s.addEventListener('click', () => {
                const val = parseInt(s.getAttribute('data-val'), 10);
                setStarRatingDisplay(val);
            });
        });
    }

    // Submit / Update Review Form Handler
    writeReviewForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        const userName = document.getElementById('reviewUserName')?.value.trim();
        const userText = document.getElementById('reviewUserText')?.value.trim();
        const starVal = Number(reviewStarValue?.value) || 5;

        if (!userName || !userText) {
            alert('Please provide your name and review comments.');
            return;
        }

        let currentUser = null;
        try { currentUser = JSON.parse(localStorage.getItem('lb_current_user')); } catch {}

        let storedReviews = [];
        try {
            const raw = localStorage.getItem(`lb_reviews_${item.id}`);
            storedReviews = raw ? JSON.parse(raw) : [];
        } catch {}

        // Check if user already reviewed
        let myRev = findCurrentUserReview(storedReviews);

        const nowFormatted = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const nowTs = Date.now();

        if (myRev) {
            // Update existing review!
            myRev.name = userName;
            myRev.rating = starVal;
            myRev.comment = userText;
            myRev.date = nowFormatted;
            myRev.timestamp = nowTs;
            myRev.isEdited = true;
            if (currentUser) {
                if (currentUser.id) myRev.userId = currentUser.id;
                if (currentUser.email) myRev.userEmail = currentUser.email;
                if (currentUser.phone) myRev.userPhone = currentUser.phone;
            }
        } else {
            // New single review!
            const newRevId = 'rev_' + nowTs + '_' + Math.random().toString(36).substr(2, 4);
            myRev = {
                id: newRevId,
                userId: currentUser?.id || ('usr_' + nowTs),
                userEmail: currentUser?.email || '',
                userPhone: currentUser?.phone || '',
                name: userName,
                rating: starVal,
                date: nowFormatted,
                timestamp: nowTs,
                comment: userText,
                isEdited: false
            };
            storedReviews.unshift(myRev);
        }

        // Save locally
        localStorage.setItem(`lb_reviews_${item.id}`, JSON.stringify(storedReviews));

        // Recalculate listing rating
        const sum = storedReviews.reduce((acc, cur) => acc + (Number(cur.rating) || 5), 0);
        const newAvg = (sum / storedReviews.length).toFixed(1);
        const newCount = storedReviews.length;

        // Update in global listings database
        try {
            const rawListings = localStorage.getItem('lb_listings');
            let listings = rawListings ? JSON.parse(rawListings) : [];
            const idx = listings.findIndex(l => String(l.id) === String(item.id));
            if (idx !== -1) {
                listings[idx].rating = parseFloat(newAvg);
                listings[idx].reviewsCount = newCount;
                localStorage.setItem('lb_listings', JSON.stringify(listings));
            }
        } catch (lErr) {}

        // Sync to Cloud Firestore if available
        if (window.lbCloudSync && typeof window.lbCloudSync.saveListingReview === 'function') {
            window.lbCloudSync.saveListingReview(item.id, myRev);
        }

        // Close form & re-render
        if (writeReviewCard) writeReviewCard.style.display = 'none';
        loadAndRenderReviews();

        // Show friendly toast or alert
        alert('Thank you! Your rating and review has been successfully submitted.');
    });

    // Real-time Cloud Listener for Reviews
    if (window.lbCloudSync && typeof window.lbCloudSync.listenListingReviews === 'function') {
        try {
            window.lbCloudSync.listenListingReviews(item.id, (cloudReviews) => {
                if (!Array.isArray(cloudReviews) || cloudReviews.length === 0) return;
                let localReviews = [];
                try {
                    const raw = localStorage.getItem(`lb_reviews_${item.id}`);
                    localReviews = raw ? JSON.parse(raw) : [];
                } catch {}

                let changed = false;
                cloudReviews.forEach(cr => {
                    const matchIdx = localReviews.findIndex(lr => 
                        (lr.id && lr.id === cr.id) || 
                        (lr.userId && cr.userId && lr.userId === cr.userId)
                    );
                    if (matchIdx !== -1) {
                        if (localReviews[matchIdx].timestamp !== cr.timestamp) {
                            localReviews[matchIdx] = cr;
                            changed = true;
                        }
                    } else {
                        localReviews.push(cr);
                        changed = true;
                    }
                });

                if (changed) {
                    localReviews.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                    localStorage.setItem(`lb_reviews_${item.id}`, JSON.stringify(localReviews));
                    loadAndRenderReviews();
                }
            });
        } catch (e) {
            console.warn('Reviews cloud sync notice:', e);
        }
    }

    // Initial render of reviews
    loadAndRenderReviews();

    // ================= LISTING BOTTOM NAVBAR VIEW CONTROLLER =================
    window.switchListingView = function(view) {
        const tabHome = document.getElementById('tabListingHome');
        const tabRevs = document.getElementById('tabListingReviews');
        const revSection = document.getElementById('storeReviewsSection');

        if (view === 'reviews') {
            tabHome?.classList.remove('active');
            tabRevs?.classList.add('active');
            if (revSection) {
                revSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                revSection.classList.add('highlight-pulse');
                setTimeout(() => revSection.classList.remove('highlight-pulse'), 1200);
            }
        } else {
            tabRevs?.classList.remove('active');
            tabHome?.classList.add('active');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    // Auto-update active navbar tab on scroll
    window.addEventListener('scroll', () => {
        const revSection = document.getElementById('storeReviewsSection');
        const tabHome = document.getElementById('tabListingHome');
        const tabRevs = document.getElementById('tabListingReviews');
        if (!revSection || !tabHome || !tabRevs) return;

        const rect = revSection.getBoundingClientRect();
        if (rect.top <= window.innerHeight * 0.45) {
            tabHome.classList.remove('active');
            tabRevs.classList.add('active');
        } else {
            tabRevs.classList.remove('active');
            tabHome.classList.add('active');
        }
    }, { passive: true });

    // 4. Operating Schedule & Timings in 70% Bottom Sheet
    const btnTriggerScheduleSheet = document.getElementById('btnTriggerScheduleSheet');
    const scheduleSheetBackdrop = document.getElementById('scheduleSheetBackdrop');
    const btnCloseScheduleSheet = document.getElementById('btnCloseScheduleSheet');
    const sheetTodayStatusTitle = document.getElementById('sheetTodayStatusTitle');
    const sheetTodayTimingBadge = document.getElementById('sheetTodayTimingBadge');
    const sheetPlaceNameSub = document.getElementById('sheetPlaceNameSub');
    const sheetWeekDaysTable = document.getElementById('sheetWeekDaysTable');
    const sheetHolidaysBox = document.getElementById('sheetHolidaysBox');
    const sheetHolidayCountText = document.getElementById('sheetHolidayCountText');
    const sheetHolidaysPillGrid = document.getElementById('sheetHolidaysPillGrid');

    if (sheetPlaceNameSub) sheetPlaceNameSub.textContent = item.name;

    // Build 7-day schedule list using dailySchedule if available, or fallback to scheduleTimings
    const allWeekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const dailySchedule = item.dailySchedule && typeof item.dailySchedule === 'object' ? item.dailySchedule : null;

    if (sheetWeekDaysTable) {
        sheetWeekDaysTable.innerHTML = allWeekDays.map(day => {
            const isToday = day === todayName;
            let isOpen = openDaysList.includes(day);
            let timeStr = 'Closed';

            if (dailySchedule && dailySchedule[day]) {
                isOpen = dailySchedule[day].isOpen;
                if (isOpen) {
                    timeStr = `${dailySchedule[day].openTime} ${dailySchedule[day].openAmPm} - ${dailySchedule[day].closeTime} ${dailySchedule[day].closeAmPm}`;
                }
            } else if (isOpen) {
                timeStr = item.scheduleTimings || '09:00 AM - 08:30 PM';
            }

            return `
                <div class="sheet-day-row ${isToday ? 'is-today-active' : ''}">
                    <div class="sheet-day-col">
                        <span class="day-label">${day}</span>
                        ${isToday ? '<span class="today-badge-chip">Today</span>' : ''}
                    </div>
                    <div class="sheet-hours-col ${isOpen ? 'open-hours' : 'closed-hours'}">
                        ${isOpen ? `<i class="fa-regular fa-clock"></i> <span>${timeStr}</span>` : '<span class="closed-tag">Closed</span>'}
                    </div>
                </div>
            `;
        }).join('');
    }

    // Determine today's exact hours
    let todayHoursStr = item.scheduleTimings || '09:00 AM - 08:30 PM';
    if (dailySchedule && dailySchedule[todayName]) {
        if (dailySchedule[todayName].isOpen) {
            todayHoursStr = `${dailySchedule[todayName].openTime} ${dailySchedule[todayName].openAmPm} - ${dailySchedule[todayName].closeTime} ${dailySchedule[todayName].closeAmPm}`;
        }
    }

    if (sheetTodayStatusTitle) {
        sheetTodayStatusTitle.textContent = isOpenDayToday && !isHolidayToday ? 'Open Today' : (isHolidayToday ? 'Closed Today (Holiday)' : 'Closed Today');
        sheetTodayStatusTitle.style.color = isOpenDayToday && !isHolidayToday ? '#15803d' : '#dc2626';
    }
    if (sheetTodayTimingBadge) {
        sheetTodayTimingBadge.textContent = isOpenDayToday && !isHolidayToday ? todayHoursStr : 'Closed';
    }

    // Populate Holidays inside Bottom Sheet (Current Active Month Only, Auto-updates with Month Change)
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed
    const currentMonthName = now.toLocaleDateString('en-US', { month: 'long' });

    const sheetHolidayMonthName = document.getElementById('sheetHolidayMonthName');
    if (sheetHolidayMonthName) {
        sheetHolidayMonthName.textContent = currentMonthName;
    }

    // Filter holidays belonging ONLY to the current calendar month and year
    const currentMonthHolidays = holidays.filter(dateStr => {
        if (!dateStr) return false;
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return false;
        return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    }).sort((a, b) => new Date(a) - new Date(b));

    // Address & Contact 70% Bottom Slide Sheet logic
    const btnTriggerAddressSheet = document.getElementById('btnTriggerAddressSheet');
    const addressSheetBackdrop = document.getElementById('addressSheetBackdrop');
    const btnCloseAddressSheet = document.getElementById('btnCloseAddressSheet');
    const sheetAddressPlaceNameSub = document.getElementById('sheetAddressPlaceNameSub');
    const sheetFullAddressText = document.getElementById('sheetFullAddressText');
    const sheetContactPhone = document.getElementById('sheetContactPhone');
    const sheetGetDirectionsBtn = document.getElementById('sheetGetDirectionsBtn');
    const sheetCallBtn = document.getElementById('sheetCallBtn');
    const sheetWhatsappBtn = document.getElementById('sheetWhatsappBtn');

    if (sheetAddressPlaceNameSub) sheetAddressPlaceNameSub.textContent = item.name;
    if (sheetFullAddressText) {
        const addr = (item.address || '').trim();
        const city = (item.city || '').trim();
        let displayAddr = addr;
        if (!displayAddr) {
            displayAddr = city ? `${city}, India` : 'Address not specified';
        } else if (city && !displayAddr.toLowerCase().includes(city.toLowerCase())) {
            displayAddr = `${displayAddr}, ${city}`;
        }
        sheetFullAddressText.textContent = displayAddr;
    }
    if (sheetContactPhone) sheetContactPhone.textContent = item.phone || 'Contact not provided';

    if (sheetGetDirectionsBtn) {
        sheetGetDirectionsBtn.href = item.mapLink || `https://maps.google.com/?q=${encodeURIComponent(item.name + ' ' + (item.address || item.city || ''))}`;
    }
    if (sheetCallBtn) {
        sheetCallBtn.href = cleanPhone ? `tel:${cleanPhone}` : '#';
    }
    if (sheetWhatsappBtn) {
        sheetWhatsappBtn.href = waNum 
            ? `https://wa.me/${waNum}?text=${encodeURIComponent('Hello, I am contacting you regarding your listing on LocalBazar: ' + item.name)}`
            : (cleanPhone ? `tel:${cleanPhone}` : '#');
    }

    function openAddressSheet() {
        if (addressSheetBackdrop) {
            addressSheetBackdrop.classList.add('open');
            document.body.style.overflow = 'hidden';
            if (window.lbPushModal) window.lbPushModal('addressSheet', closeAddressSheet);
        }
    }

    function closeAddressSheet() {
        if (addressSheetBackdrop) {
            addressSheetBackdrop.classList.remove('open');
            document.body.style.overflow = '';
        }
        if (window.lbPopModal) window.lbPopModal('addressSheet');
    }

    btnTriggerAddressSheet?.addEventListener('click', (e) => {
        e.preventDefault();
        openAddressSheet();
    });

    btnCloseAddressSheet?.addEventListener('click', closeAddressSheet);
    addressSheetBackdrop?.addEventListener('click', (e) => {
        if (e.target === addressSheetBackdrop) closeAddressSheet();
    });

    // Store Branches & Multi-City Outlets
    let allStoredListings = [];
    try {
        const raw = localStorage.getItem('lb_listings');
        allStoredListings = raw ? JSON.parse(raw) : [];
    } catch {}

    let linkedBranchListings = [];
    if (item.isBranch) {
        const parentId = item.parentStoreId;
        linkedBranchListings = allStoredListings.filter(l => 
            l.id !== item.id && (l.id === parentId || (parentId && l.parentStoreId === parentId))
        );
    } else {
        linkedBranchListings = allStoredListings.filter(l => l.parentStoreId === item.id);
    }

    const legacyBranches = Array.isArray(item.branches) ? item.branches : [];
    const branches = [
        ...linkedBranchListings.map(lb => ({
            id: lb.id,
            name: lb.name + (lb.city ? ` (${lb.city} Branch)` : ''),
            city: lb.city,
            district: lb.district || '',
            address: lb.address,
            phone: lb.phone,
            mapLink: lb.mapLink || `https://maps.google.com/?q=${encodeURIComponent(lb.name + ' ' + (lb.address || lb.city || ''))}`,
            detailUrl: `listing-detail.html?id=${encodeURIComponent(lb.id)}`,
            isDirectListing: true
        })),
        ...legacyBranches
    ];

    const btnTriggerBranchesModal = document.getElementById('btnTriggerBranchesModal');
    const branchesHeaderCountText = document.getElementById('branchesHeaderCountText');
    const sheetBranchesBlock = document.getElementById('sheetBranchesBlock');
    const sheetBranchesCount = document.getElementById('sheetBranchesCount');
    const sheetBranchesList = document.getElementById('sheetBranchesList');
    const branchesListModalBackdrop = document.getElementById('branchesListModalBackdrop');
    const branchesModalFullList = document.getElementById('branchesModalFullList');

    if (branches.length > 0) {
        if (btnTriggerBranchesModal) {
            btnTriggerBranchesModal.style.display = 'inline-flex';
            if (branchesHeaderCountText) {
                branchesHeaderCountText.textContent = `${branches.length} ${branches.length === 1 ? 'Branch' : 'Branches'}`;
            }
            btnTriggerBranchesModal.addEventListener('click', (e) => {
                e.preventDefault();
                openBranchesListModal();
            });
        }

        if (sheetBranchesBlock) {
            sheetBranchesBlock.style.display = 'block';
            if (sheetBranchesCount) sheetBranchesCount.textContent = branches.length;
            if (sheetBranchesList) {
                sheetBranchesList.innerHTML = branches.map((b, idx) => `
                    <div class="sheet-branch-item">
                        <div class="sheet-branch-info">
                            <div class="sheet-branch-top">
                                <span class="sheet-branch-city-tag"><i class="fa-solid fa-location-dot"></i> ${b.city || 'Branch'}</span>
                                <strong class="sheet-branch-name">${b.detailUrl ? `<a href="${b.detailUrl}" style="color:inherit; text-decoration:none;">${b.name || 'Store Branch'}</a>` : (b.name || 'Store Branch')}</strong>
                            </div>
                            <p class="sheet-branch-addr">${b.address || ''}</p>
                        </div>
                        <div class="sheet-branch-actions">
                            ${b.detailUrl ? `
                                <a href="${b.detailUrl}" class="btn-branch-action map" title="View Branch Profile" style="background:#f0fdf4; color:#16a34a; border-color:#bbf7d0;">
                                    <i class="fa-solid fa-arrow-up-right-from-square"></i>
                                </a>
                            ` : ''}
                            ${(b.phone || cleanPhone) ? `
                                <a href="tel:${b.phone || cleanPhone}" class="btn-branch-action call" title="Call this branch">
                                    <i class="fa-solid fa-phone"></i>
                                </a>
                            ` : ''}
                            ${b.mapLink ? `
                                <a href="${b.mapLink}" target="_blank" class="btn-branch-action map" title="Directions to this branch">
                                    <i class="fa-solid fa-diamond-turn-right"></i>
                                </a>
                            ` : ''}
                        </div>
                    </div>
                `).join('');
            }
        }
    }

    window.openBranchesListModal = function() {
        if (!branchesListModalBackdrop || !branchesModalFullList) return;

        // Render Main Office + all Branches
        const mainBranchHtml = `
            <div class="modal-branch-card main-hub">
                <div class="modal-branch-badge-row">
                    <span class="modal-branch-city-pill"><i class="fa-solid fa-location-dot"></i> ${item.city || 'Headquarters'}</span>
                    <span class="modal-branch-main-chip"><i class="fa-solid fa-crown"></i> ${item.isBranch ? 'Current Location' : 'Main Store / Head Office'}</span>
                </div>
                <h4 class="modal-branch-title">${item.name}</h4>
                <p class="modal-branch-address">${item.address || `${item.city || 'City'}, India`}</p>
                <div class="modal-branch-action-row">
                    ${cleanPhone ? `
                        <a href="tel:${cleanPhone}" class="btn-modal-branch-call">
                            <i class="fa-solid fa-phone"></i> Call Store
                        </a>
                    ` : ''}
                    <a href="${item.mapLink || `https://maps.google.com/?q=${encodeURIComponent(item.name + ' ' + (item.address || item.city || ''))}`}" target="_blank" class="btn-modal-branch-map">
                        <i class="fa-solid fa-location-arrow"></i> Directions
                    </a>
                </div>
            </div>
        `;

        const otherBranchesHtml = branches.map((b, idx) => `
            <div class="modal-branch-card">
                <div class="modal-branch-badge-row">
                    <span class="modal-branch-city-pill"><i class="fa-solid fa-location-dot"></i> ${b.city || 'Branch'}</span>
                    ${b.district ? `<span class="modal-branch-dist-pill">District: ${b.district}</span>` : ''}
                </div>
                <h4 class="modal-branch-title">${b.name || 'Store Branch'}</h4>
                <p class="modal-branch-address">${b.address || ''}</p>
                <div class="modal-branch-action-row">
                    ${b.detailUrl ? `
                        <a href="${b.detailUrl}" class="btn-modal-branch-map" style="background:#ecfdf5; color:#047857; border-color:#a7f3d0;">
                            <i class="fa-solid fa-arrow-up-right-from-square"></i> Open Branch
                        </a>
                    ` : ''}
                    ${(b.phone || cleanPhone) ? `
                        <a href="tel:${b.phone || cleanPhone}" class="btn-modal-branch-call">
                            <i class="fa-solid fa-phone"></i> Call Branch
                        </a>
                    ` : ''}
                    ${b.mapLink ? `
                        <a href="${b.mapLink}" target="_blank" class="btn-modal-branch-map">
                            <i class="fa-solid fa-location-arrow"></i> Directions
                        </a>
                    ` : ''}
                </div>
            </div>
        `).join('');

        branchesModalFullList.innerHTML = mainBranchHtml + otherBranchesHtml;
        branchesListModalBackdrop.style.display = 'flex';
        if (window.lbPushModal) window.lbPushModal('branchesListModal', window.closeBranchesListModal);
    };

    window.closeBranchesListModal = function() {
        if (branchesListModalBackdrop) {
            branchesListModalBackdrop.style.display = 'none';
        }
        if (window.lbPopModal) window.lbPopModal('branchesListModal');
    };

    // Elements for Holidays Full Modal Popup
    const holidaysModalBackdrop = document.getElementById('holidaysModalBackdrop');
    const btnCloseHolidaysModal = document.getElementById('btnCloseHolidaysModal');
    const holidaysModalMonthTitle = document.getElementById('holidaysModalMonthTitle');
    const holidaysModalPlaceName = document.getElementById('holidaysModalPlaceName');
    const holidaysModalFullList = document.getElementById('holidaysModalFullList');

    if (holidaysModalMonthTitle) holidaysModalMonthTitle.textContent = currentMonthName;
    if (holidaysModalPlaceName) holidaysModalPlaceName.textContent = item.name;

    function openHolidaysModal() {
        if (!holidaysModalBackdrop || !holidaysModalFullList) return;
        holidaysModalFullList.innerHTML = currentMonthHolidays.map(dateStr => {
            let formatted = dateStr;
            let dayName = '';
            try {
                const parsed = new Date(dateStr);
                if (!isNaN(parsed.getTime())) {
                    formatted = parsed.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                    dayName = parsed.toLocaleDateString('en-US', { weekday: 'long' });
                }
            } catch {}
            return `
                <div class="holidays-modal-item">
                    <div class="holidays-modal-item-left">
                        <span class="hol-modal-cal-icon"><i class="fa-solid fa-calendar-day"></i></span>
                        <div>
                            <strong class="hol-modal-date">${formatted}</strong>
                            <span class="hol-modal-day">${dayName}</span>
                        </div>
                    </div>
                    <span class="hol-modal-badge"><i class="fa-solid fa-store-slash"></i> Closed</span>
                </div>
            `;
        }).join('');
        holidaysModalBackdrop.classList.add('open');
    }

    function closeHolidaysModal() {
        if (holidaysModalBackdrop) {
            holidaysModalBackdrop.classList.remove('open');
        }
    }

    btnCloseHolidaysModal?.addEventListener('click', closeHolidaysModal);
    holidaysModalBackdrop?.addEventListener('click', (e) => {
        if (e.target === holidaysModalBackdrop) closeHolidaysModal();
    });

    if (currentMonthHolidays.length > 0 && sheetHolidaysBox && sheetHolidaysPillGrid) {
        sheetHolidaysBox.style.display = 'block';
        if (sheetHolidayCountText) sheetHolidayCountText.textContent = currentMonthHolidays.length;

        // Show max 2 dates. If more, 3rd item is "More" button that triggers popup modal
        const displayList = currentMonthHolidays.slice(0, 2);
        const remainingCount = currentMonthHolidays.length - 2;

        let html = displayList.map(dateStr => {
            let formatted = dateStr;
            let dayName = '';
            try {
                const parsed = new Date(dateStr);
                if (!isNaN(parsed.getTime())) {
                    formatted = parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    dayName = parsed.toLocaleDateString('en-US', { weekday: 'short' });
                }
            } catch {}
            return `
                <div class="sheet-holiday-tag">
                    <i class="fa-regular fa-calendar-xmark"></i>
                    <span class="hol-date-text">${formatted}</span>
                    ${dayName ? `<span class="hol-day-text">(${dayName})</span>` : ''}
                </div>
            `;
        }).join('');

        if (currentMonthHolidays.length > 2) {
            html += `
                <button type="button" class="sheet-holiday-more-btn" id="btnOpenHolidaysModal" title="View all holidays in a popup">
                    More <i class="fa-solid fa-arrow-up-right-from-square"></i>
                </button>
            `;
        }

        sheetHolidaysPillGrid.innerHTML = html;

        const btnOpenModal = document.getElementById('btnOpenHolidaysModal');
        if (btnOpenModal) {
            btnOpenModal.addEventListener('click', (e) => {
                e.stopPropagation();
                openHolidaysModal();
            });
        }
    } else if (sheetHolidaysBox) {
        sheetHolidaysBox.style.display = 'none';
    }

    // Open/Close Handlers
    function openScheduleSheet() {
        if (scheduleSheetBackdrop) {
            scheduleSheetBackdrop.classList.add('open');
            document.body.style.overflow = 'hidden';
            if (window.lbPushModal) window.lbPushModal('scheduleSheet', closeScheduleSheet);
        }
    }

    function closeScheduleSheet() {
        if (scheduleSheetBackdrop) {
            scheduleSheetBackdrop.classList.remove('open');
            document.body.style.overflow = '';
        }
        if (window.lbPopModal) window.lbPopModal('scheduleSheet');
    }

    btnTriggerScheduleSheet?.addEventListener('click', (e) => {
        e.preventDefault();
        openScheduleSheet();
    });

    btnCloseScheduleSheet?.addEventListener('click', closeScheduleSheet);

    scheduleSheetBackdrop?.addEventListener('click', (e) => {
        if (e.target === scheduleSheetBackdrop) {
            closeScheduleSheet();
        }
    });

    // 5. Live Chat Modal Interaction & Product Inquiry Support
    const btnOpenChatModal = document.getElementById('btnOpenChatModal');
    const chatModalBackdrop = document.getElementById('chatModalBackdrop');
    const btnCloseChatModal = document.getElementById('btnCloseChatModal');
    const chatPartnerImg = document.getElementById('chatPartnerImg');
    const chatPartnerName = document.getElementById('chatPartnerName');
    const chatAutoGreetingMsg = document.getElementById('chatAutoGreetingMsg');
    const chatMessageForm = document.getElementById('chatMessageForm');
    const chatInputField = document.getElementById('chatInputField');
    const chatModalBody = document.getElementById('chatModalBody');
    const chatProductPreviewBar = document.getElementById('chatProductPreviewBar');
    const chatProductThumb = document.getElementById('chatProductThumb');
    const chatProductName = document.getElementById('chatProductName');
    const chatProductPrice = document.getElementById('chatProductPrice');
    const btnClearChatProduct = document.getElementById('btnClearChatProduct');

    let currentAttachedChatProduct = null;

    if (chatPartnerImg) chatPartnerImg.src = item.image || 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=100&auto=format&fit=crop&q=80';
    if (chatPartnerName) chatPartnerName.textContent = item.name;
    if (chatAutoGreetingMsg) {
        chatAutoGreetingMsg.innerHTML = `Hello! Welcome to <strong>${item.name}</strong> on LocalBazar. How can we assist you today?`;
    }

    // Chat History Persistence
    function getChatHistoryKey() {
        return `lb_chat_history_${item.id}`;
    }

    function renderChatHistory() {
        if (!chatModalBody) return;
        let msgs = [];
        try {
            const raw = localStorage.getItem(getChatHistoryKey());
            msgs = raw ? JSON.parse(raw) : [];
        } catch (e) {
            msgs = [];
        }

        let html = `
            <div class="chat-msg-row incoming">
                <div class="msg-bubble">
                    Hello! Welcome to <strong>${item.name}</strong> on LocalBazar. How can we assist you today?
                    <span class="msg-time">Official Business Support</span>
                </div>
            </div>
        `;

        msgs.forEach(m => {
            const isOut = m.sender === 'customer';
            let attachmentHtml = '';
            if (m.product) {
                const prodImg = (Array.isArray(m.product.images) && m.product.images[0]) || m.product.image || '';
                const prodPrice = m.product.price ? (typeof m.product.price === 'number' ? formatCurrencyINR(m.product.price) : m.product.price) : '';
                attachmentHtml = `
                    <div class="chat-card-attachment">
                        ${prodImg ? `<img src="${prodImg}" alt="${m.product.name || ''}">` : ''}
                        <div class="chat-card-attachment-meta">
                            <span class="chat-card-attachment-title">${m.product.name || 'Product'}</span>
                            ${prodPrice ? `<span class="chat-card-attachment-price">${prodPrice}</span>` : ''}
                        </div>
                    </div>
                `;
            }
            html += `
                <div class="chat-msg-row ${isOut ? 'outgoing' : 'incoming'}">
                    <div class="msg-bubble">${attachmentHtml}${m.text}<span class="msg-time">${m.time || ''}</span></div>
                </div>
            `;
        });

        chatModalBody.innerHTML = html;
        chatModalBody.scrollTop = chatModalBody.scrollHeight;
    }

    // Direct Website Chat Trigger for Product Inquiries
    window.openProductInquiryChat = function(p, isTransition = false) {
        if (!p) return;
        currentAttachedChatProduct = p;
        renderChatHistory();

        if (chatProductPreviewBar) {
            chatProductPreviewBar.style.display = 'flex';
            const prodImg = (Array.isArray(p.images) && p.images[0]) || p.image || item.image || '';
            if (chatProductThumb) {
                chatProductThumb.src = prodImg;
                chatProductThumb.style.display = prodImg ? 'block' : 'none';
            }
            if (chatProductName) chatProductName.textContent = p.name || 'Product Inquiry';
            if (chatProductPrice) {
                const pr = p.price ? (typeof p.price === 'number' ? formatCurrencyINR(p.price) : p.price) : 'Price on Request';
                chatProductPrice.textContent = pr;
            }
        }

        if (chatInputField) {
            const pr = p.price ? ` (${typeof p.price === 'number' ? formatCurrencyINR(p.price) : p.price})` : '';
            chatInputField.value = `Hi, I am interested in inquiring about "${p.name || 'this item'}"${pr}. Is this available in stock?`;
        }

        if (chatModalBackdrop) {
            chatModalBackdrop.classList.add('open');
            if (!isTransition && window.lbPushModal) {
                window.lbPushModal('chatModal', () => {
                    chatModalBackdrop?.classList.remove('open');
                });
            }
            setTimeout(() => {
                chatInputField?.focus();
            }, 150);
        }
    };

    btnClearChatProduct?.addEventListener('click', () => {
        currentAttachedChatProduct = null;
        if (chatProductPreviewBar) chatProductPreviewBar.style.display = 'none';
    });

    btnOpenChatModal?.addEventListener('click', () => {
        renderChatHistory();
        chatModalBackdrop?.classList.add('open');
        chatInputField?.focus();
        if (window.lbPushModal) window.lbPushModal('chatModal', () => {
            chatModalBackdrop?.classList.remove('open');
        });
    });

    btnCloseChatModal?.addEventListener('click', () => {
        chatModalBackdrop?.classList.remove('open');
        if (window.lbPopModal) window.lbPopModal('chatModal');
    });

    chatModalBackdrop?.addEventListener('click', (e) => {
        if (e.target === chatModalBackdrop) {
            chatModalBackdrop.classList.remove('open');
            if (window.lbPopModal) window.lbPopModal('chatModal');
        }
    });

    // Initial render of saved chat on page load
    renderChatHistory();

    // Real-time Cloud Listener for Replies from Store / Merchant
    let storeChatCloudUnsub = null;
    function initStoreChatCloudSync() {
        if (!item || !item.id) return;
        if (window.lbCloudSync && typeof window.lbCloudSync.listenStoreInbox === 'function') {
            try {
                if (typeof storeChatCloudUnsub === 'function') {
                    storeChatCloudUnsub();
                }
                storeChatCloudUnsub = window.lbCloudSync.listenStoreInbox(item.id, (cloudMessages) => {
                    if (!Array.isArray(cloudMessages) || cloudMessages.length === 0) return;
                    let history = [];
                    try {
                        const raw = localStorage.getItem(getChatHistoryKey());
                        history = raw ? JSON.parse(raw) : [];
                    } catch (e) { history = []; }

                    let updated = false;
                    cloudMessages.forEach(m => {
                        if (m.sender === 'store') {
                            const exists = history.some(h => 
                                h.sender === 'store' && 
                                h.text === m.text && 
                                (h.time === m.time || Math.abs((h.timestamp || 0) - (m.timestamp || 0)) < 4000)
                            );
                            if (!exists) {
                                history.push({
                                    sender: 'store',
                                    text: m.text,
                                    time: m.time || 'Just now',
                                    timestamp: m.timestamp || Date.now()
                                });
                                updated = true;
                            }
                        }
                    });

                    if (updated) {
                        try {
                            localStorage.setItem(getChatHistoryKey(), JSON.stringify(history));
                        } catch (e) {}
                        renderChatHistory();
                    }
                });
            } catch (err) {
                console.warn('Customer chat cloud sync error:', err);
            }
        }
    }

    // Initialize listener immediately and retry after Firebase ready
    initStoreChatCloudSync();
    if (window.firebase) {
        setTimeout(initStoreChatCloudSync, 1200);
    }

    chatMessageForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = chatInputField.value.trim();
        if (!text) return;

        const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const attachedProd = currentAttachedChatProduct;

        let attachmentHtml = '';
        if (attachedProd) {
            const prodImg = (Array.isArray(attachedProd.images) && attachedProd.images[0]) || attachedProd.image || '';
            const prodPrice = attachedProd.price ? (typeof attachedProd.price === 'number' ? formatCurrencyINR(attachedProd.price) : attachedProd.price) : '';
            attachmentHtml = `
                <div class="chat-card-attachment">
                    ${prodImg ? `<img src="${prodImg}" alt="${attachedProd.name || ''}">` : ''}
                    <div class="chat-card-attachment-meta">
                        <span class="chat-card-attachment-title">${attachedProd.name || 'Product'}</span>
                        ${prodPrice ? `<span class="chat-card-attachment-price">${prodPrice}</span>` : ''}
                    </div>
                </div>
            `;
        }

        const outRow = document.createElement('div');
        outRow.className = 'chat-msg-row outgoing';
        outRow.innerHTML = `<div class="msg-bubble">${attachmentHtml}${text}<span class="msg-time">${timeNow}</span></div>`;
        chatModalBody.appendChild(outRow);
        chatInputField.value = '';
        chatModalBody.scrollTop = chatModalBody.scrollHeight;

        // Persist outgoing message to local chat history so refreshing the page never deletes it
        try {
            const rawH = localStorage.getItem(getChatHistoryKey());
            let historyList = rawH ? JSON.parse(rawH) : [];
            historyList.push({
                sender: 'customer',
                text: text,
                product: attachedProd ? { name: attachedProd.name, price: attachedProd.price, image: attachedProd.image } : null,
                time: timeNow
            });
            localStorage.setItem(getChatHistoryKey(), JSON.stringify(historyList));
        } catch (hErr) {}

        // Clear product attachment after sending inquiry
        currentAttachedChatProduct = null;
        if (chatProductPreviewBar) chatProductPreviewBar.style.display = 'none';

        // Persist message to merchant portal store inbox (lb_store_inbox_{storeId})
        try {
            const rawInbox = localStorage.getItem(`lb_store_inbox_${item.id}`);
            let inboxList = rawInbox ? JSON.parse(rawInbox) : [];
            let currentUser = null;
            try { currentUser = JSON.parse(localStorage.getItem('lb_current_user')); } catch {}
            const customerName = currentUser?.name || 'Local Customer';
            const customerPhone = currentUser?.phone || 'In-App Direct Chat';

            let thread = inboxList.find(t => t.userName === customerName);
            if (!thread) {
                thread = {
                    id: 'msg_' + Date.now(),
                    userName: customerName,
                    userPhone: customerPhone,
                    lastTime: timeNow,
                    unread: true,
                    messages: []
                };
                inboxList.unshift(thread);
            }
            thread.messages.push({ 
                sender: 'customer', 
                text: text, 
                product: attachedProd ? { name: attachedProd.name, price: attachedProd.price, image: attachedProd.image } : null,
                time: timeNow 
            });
            thread.lastTime = timeNow;
            thread.unread = true;
            localStorage.setItem(`lb_store_inbox_${item.id}`, JSON.stringify(inboxList));

            // Sync inquiry strictly to the merchant store's inbox (never to Admin Mailbox)
            if (window.lbCloudSync && typeof window.lbCloudSync.saveInquiryMessage === 'function') {
                window.lbCloudSync.saveInquiryMessage(item.id, {
                    sender: 'customer',
                    customerName: customerName,
                    customerPhone: customerPhone,
                    text: text,
                    product: attachedProd ? { name: attachedProd.name, price: attachedProd.price, image: attachedProd.image } : null,
                    time: timeNow
                });
            }

            // Trigger Real-time Merchant Push Notification & In-app Alert
            try {
                // Background Push Notification via OneSignal (Delivered even if merchant app is completely closed!)
                if (window.lbPushService && typeof window.lbPushService.notifyStoreOwner === 'function') {
                    window.lbPushService.notifyStoreOwner({
                        storeId: item.id,
                        storeName: item.name,
                        customerName: customerName,
                        messageText: text,
                        product: attachedProd,
                        ownerId: item.ownerId
                    });
                }

                const notifTitle = `New Customer Inquiry: ${item.name}`;
                const notifBody = `${customerName}: "${text.slice(0, 80)}"`;
                if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification(notifTitle, {
                        body: notifBody,
                        icon: item.image || 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=120&auto=format&fit=crop&q=80'
                    });
                }
                const rawNotifs = localStorage.getItem('lb_notifications');
                const notifs = rawNotifs ? JSON.parse(rawNotifs) : [];
                notifs.unshift({
                    id: 'notif_' + Date.now(),
                    storeId: item.id,
                    storeName: item.name,
                    senderName: customerName,
                    text: text,
                    product: attachedProd ? attachedProd.name : null,
                    time: timeNow,
                    read: false
                });
                localStorage.setItem('lb_notifications', JSON.stringify(notifs.slice(0, 50)));
            } catch (nErr) {
                console.error('Notification error:', nErr);
            }
        } catch (err) {
            console.error('Error syncing chat to merchant inbox:', err);
        }

        setTimeout(() => {
            const autoReply = attachedProd
                ? `Thanks for your interest in <strong>${attachedProd.name}</strong>! We have received your query. Our team at <strong>${item.name}</strong> will assist you right away.`
                : `Thanks for reaching out! We have received your query regarding <strong>${item.name}</strong>.`;
            
            // Persist incoming auto-reply in local chat history
            try {
                const rawH = localStorage.getItem(getChatHistoryKey());
                let historyList = rawH ? JSON.parse(rawH) : [];
                historyList.push({
                    sender: 'store',
                    text: autoReply,
                    time: timeNow
                });
                localStorage.setItem(getChatHistoryKey(), JSON.stringify(historyList));
            } catch (hErr) {}

            const inRow = document.createElement('div');
            inRow.className = 'chat-msg-row incoming';
            inRow.innerHTML = `<div class="msg-bubble">${autoReply}<span class="msg-time">${timeNow}</span></div>`;
            chatModalBody.appendChild(inRow);
            chatModalBody.scrollTop = chatModalBody.scrollHeight;
        }, 800);
    });

    // Check if user arrived with pending product inquiry from sessionStorage or URL
    try {
        const pendingInquiryRaw = sessionStorage.getItem('lb_pending_inquire_product');
        if (pendingInquiryRaw) {
            sessionStorage.removeItem('lb_pending_inquire_product');
            const p = JSON.parse(pendingInquiryRaw);
            setTimeout(() => {
                window.openProductInquiryChat(p);
            }, 300);
        } else if (urlParams.get('inquire') || window.location.hash === '#chat') {
            const inqName = urlParams.get('inquire');
            const inqPrice = urlParams.get('price');
            setTimeout(() => {
                window.openProductInquiryChat({
                    name: inqName || 'Product Inquiry',
                    price: inqPrice || ''
                });
            }, 300);
        }

        // Check if user arrived via Product Ad / Deal click (navigate to store category & open product popup details)
        const targetProdParam = urlParams.get('product') || urlParams.get('prod') || urlParams.get('productId');
        if (targetProdParam) {
            const cleanQuery = decodeURIComponent(targetProdParam).trim().toLowerCase();
            const allStoreProds = (Array.isArray(item.products) && item.products.length > 0)
                ? item.products
                : (displayProducts || []);

            const matchedProduct = allStoreProds.find(p => {
                const pName = (p.name || '').trim().toLowerCase();
                return pName === cleanQuery || (p.id && String(p.id) === targetProdParam) || pName.includes(cleanQuery);
            });

            // Smooth scroll to store's product / category shelf
            const shelfSection = document.getElementById('storeFeaturedShelf');
            if (shelfSection) {
                setTimeout(() => {
                    shelfSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 250);
            }

            if (matchedProduct) {
                // If product has a category or tag, activate that category in the category track
                if (matchedProduct.category && storeCatsSlideTrack) {
                    const normCatTag = matchedProduct.category.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                    const catBtns = storeCatsSlideTrack.querySelectorAll('.store-cat-item');
                    catBtns.forEach(btn => {
                        const btnTag = (btn.getAttribute('data-cat-filter') || '').toLowerCase();
                        if (btnTag === normCatTag) {
                            catBtns.forEach(b => b.classList.remove('active'));
                            btn.classList.add('active');
                        }
                    });
                }
                setTimeout(() => {
                    if (typeof window.openDetailProductViewer === 'function') {
                        window.openDetailProductViewer(matchedProduct);
                    }
                }, 400);
            } else {
                // Fallback: If product wasn't found in current catalog array, construct from query params
                const fallbackPrice = urlParams.get('price');
                const fallbackImg = urlParams.get('image') || urlParams.get('img');
                const fallbackProd = {
                    name: decodeURIComponent(targetProdParam),
                    price: fallbackPrice ? decodeURIComponent(fallbackPrice) : '',
                    image: fallbackImg ? decodeURIComponent(fallbackImg) : '',
                    category: item.category || 'Product'
                };
                setTimeout(() => {
                    if (typeof window.openDetailProductViewer === 'function') {
                        window.openDetailProductViewer(fallbackProd);
                    }
                }, 400);
            }
        }
    } catch (e) {
        console.warn('Error handling deep product link:', e);
    }
});
