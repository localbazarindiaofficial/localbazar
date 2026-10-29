// ================= STORE CATEGORY DEDICATED PAGE LOGIC (AMAZON / FLIPKART STYLE) =================
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const listingId = urlParams.get('id');
    let currentCatTag = (urlParams.get('cat') || '').toLowerCase().trim();

    // Toolbar states
    let currentViewMode = 'list'; // 'list' or 'grid'
    let currentSortBy = 'featured';
    let filterInStockOnly = false;

    // Load Listings Database
    let listings = [];
    try {
        const raw = localStorage.getItem('lb_listings');
        listings = raw ? JSON.parse(raw) : [];
    } catch {
        listings = [];
    }

    let item = listings.find(l => String(l.id).trim() === String(listingId).trim());
    if (!item && listingId) {
        item = listings.find(l => String(l.id).toLowerCase() === String(listingId).toLowerCase());
    }

    if (!item) {
        document.body.innerHTML = `
            <div class="lb-not-found-layout" style="min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #f8fafc; padding: 2.5rem 1.25rem; font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif; text-align: center; box-sizing: border-box;">
                <div style="background: #ffffff; max-width: 480px; width: 100%; border-radius: 24px; padding: 2.75rem 2rem; box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04); border: 1px solid #e2e8f0;">
                    <div style="width: 80px; height: 80px; margin: 0 auto 1.5rem; background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); color: #ef4444; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2.25rem; box-shadow: 0 8px 16px -4px rgba(239, 68, 68, 0.2);">
                        <i class="fa-solid fa-store-slash"></i>
                    </div>
                    <span style="display: inline-block; background: #f1f5f9; color: #475569; font-size: 0.76rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; padding: 0.35rem 0.85rem; border-radius: 20px; margin-bottom: 0.85rem;">Error 404 • Store Not Found</span>
                    <h2 style="color: #0f172a; font-size: 1.45rem; font-weight: 800; margin-bottom: 0.65rem; line-height: 1.3;">দোকান বা স্টোর পাওয়া যায়নি</h2>
                    <p style="color: #64748b; font-size: 0.94rem; line-height: 1.55; margin-bottom: 2rem;">The business you are trying to browse is currently unavailable or the link is invalid.</p>
                    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                        <a href="explore.html" style="background: #1a73e8; color: #ffffff; text-decoration: none; padding: 0.8rem 1.25rem; border-radius: 12px; font-weight: 700; font-size: 0.95rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem; box-shadow: 0 4px 12px rgba(26, 115, 232, 0.25);">
                            <i class="fa-solid fa-compass"></i> Explore All Places
                        </a>
                        <a href="index.html" style="background: #f1f5f9; color: #334155; text-decoration: none; padding: 0.8rem 1.25rem; border-radius: 12px; font-weight: 600; font-size: 0.92rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
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

    // Dynamic SEO Metadata
    try {
        document.title = `${item.name} - Store Catalog | LocalBazar`;
        const metaDesc = `Browse products and catalog of ${item.name} in ${item.city || 'Local Area'} on LocalBazar.`;
        const metaImage = item.image || (Array.isArray(item.gallery) && item.gallery[0]) || '';
        const setMeta = (prop, val) => {
            let el = document.querySelector(`meta[property="${prop}"]`);
            if (!el) {
                el = document.createElement('meta');
                el.setAttribute('property', prop);
                document.head.appendChild(el);
            }
            el.setAttribute('content', val);
        };
        setMeta('og:title', `${item.name} - Products & Menu`);
        setMeta('og:description', metaDesc);
        setMeta('og:image', metaImage);
    } catch {}

    // Helper: Category Icon / Emoji Resolver
    function resolveCatEmoji(label = '') {
        const l = (label || '').toLowerCase().trim();
        if (l.includes('biryani') || l.includes('rice') || l.includes('pulao')) return '🍚';
        if (l.includes('burger') || l.includes('fast food') || l.includes('roll') || l.includes('sandwich')) return '🍔';
        if (l.includes('pizza')) return '🍕';
        if (l.includes('starter') || l.includes('snack') || l.includes('main course') || l.includes('thali') || l.includes('curry')) return '🍛';
        if (l.includes('drink') || l.includes('tea') || l.includes('coffee') || l.includes('beverage')) return '🥤';
        if (l.includes('ice cream') || l.includes('dessert') || l.includes('cake') || l.includes('sweet')) return '🍰';
        if (l.includes('saree') || l.includes('women') || l.includes('ladies') || l.includes('dress') || l.includes('kurti')) return '👗';
        if (l.includes('kid') || l.includes('baby') || l.includes('child')) return '🧒';
        if (l.includes('shoe') || l.includes('footwear') || l.includes('sneaker')) return '👟';
        if (l.includes('shirt') || l.includes('pant') || l.includes('men') || l.includes('cloth')) return '👕';
        if (l.includes('mobile') || l.includes('phone') || l.includes('smartphone')) return '📱';
        if (l.includes('laptop') || l.includes('computer') || l.includes('pc')) return '💻';
        if (l.includes('headphone') || l.includes('audio') || l.includes('sound')) return '🎧';
        if (l.includes('tv') || l.includes('appliance')) return '📺';
        if (l.includes('vegetable') || l.includes('fruit') || l.includes('fresh')) return '🥦';
        if (l.includes('grocery') || l.includes('ration') || l.includes('supermarket')) return '🛒';
        if (l.includes('beauty') || l.includes('cosmetic') || l.includes('salon') || l.includes('makeup')) return '💄';
        if (l.includes('doctor') || l.includes('health') || l.includes('clinic') || l.includes('medicine')) return '🩺';
        if (l.includes('jewel') || l.includes('gold') || l.includes('diamond')) return '💎';
        if (l.includes('watch') || l.includes('clock')) return '⌚';
        if (l.includes('fire') || l.includes('popular')) return '🔥';
        if (l.includes('star') || l.includes('featured')) return '⭐';
        return '🏷️';
    }

    function formatEmojiOrIcon(icon, label = '') {
        let ic = (icon || '').trim();
        if (!ic) ic = resolveCatEmoji(label);
        if (ic.includes('fa-')) {
            const cls = ic.includes(' ') ? ic : `fa-solid ${ic}`;
            return `<i class="${cls}"></i>`;
        }
        return `<span class="cat-emoji" style="font-style:normal; line-height:1;">${ic}</span>`;
    }

    // Load In-Store Categories for this listing
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
        } catch {}
    }

    if (rawStoreCats.length === 0) {
        rawStoreCats = [
            { label: 'Popular', tag: 'popular', icon: '🔥' },
            { label: 'Featured', tag: 'featured', icon: '⭐' },
            { label: 'Offers', tag: 'offers', icon: '🏷️' }
        ];
    }

    const normalizedCats = rawStoreCats.map(c => {
        const label = typeof c === 'string' ? c.trim() : (c.label || c.name || 'Category').trim();
        const tag = typeof c === 'string'
            ? label.toLowerCase().replace(/[^a-z0-9]+/g, '-')
            : (c.tag || label.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
        const icon = (typeof c === 'object' && c && c.icon) ? c.icon : resolveCatEmoji(label);
        return { label, tag, icon };
    });

    // Determine initial active category
    let activeCat = normalizedCats.find(c => c.tag === currentCatTag || c.label.toLowerCase() === currentCatTag);
    if (!activeCat && normalizedCats.length > 0) {
        activeCat = normalizedCats[0];
        currentCatTag = activeCat.tag;
    }

    // Set Top Navigation Meta
    const storeNavName = document.getElementById('storeNavName');
    const storeNavSub = document.getElementById('storeNavSub');
    const btnBackToStore = document.getElementById('btnBackToStore');

    if (storeNavName) storeNavName.textContent = item.name || 'Store Category';
    if (storeNavSub) storeNavSub.innerHTML = `<i class="fa-solid fa-location-dot"></i> ${item.city || 'Local Area'} • ${item.category || 'Store'}`;
    if (btnBackToStore) {
        btnBackToStore.addEventListener('click', (e) => {
            e.preventDefault();
            window.lbSmartBack(`listing-detail.html?id=${encodeURIComponent(item.id)}`);
        });
    }

    // Load Store Products (Strictly load actual merchant products; no mock demo products)
    let allProducts = Array.isArray(item.products) && item.products.length > 0 ? item.products : [];

    let currentFilteredCategoryProducts = [];

    // Render Category Switcher Pills
    function renderCategorySwitcherPills() {
        const pillsTrack = document.getElementById('storeCatPillsTrack');
        if (!pillsTrack) return;

        pillsTrack.innerHTML = normalizedCats.map(c => {
            const isActive = (c.tag === currentCatTag || c.label.toLowerCase() === currentCatTag);
            return `
                <button type="button" class="store-cat-nav-pill ${isActive ? 'active' : ''}" data-cat-tag="${c.tag}">
                    <span class="pill-emoji">${formatEmojiOrIcon(c.icon, c.label)}</span>
                    <span>${c.label}</span>
                </button>
            `;
        }).join('');

        pillsTrack.querySelectorAll('.store-cat-nav-pill').forEach(btn => {
            btn.addEventListener('click', () => {
                const tag = btn.getAttribute('data-cat-tag');
                selectCategory(tag);
            });
        });
    }

    // Select & Switch Category
    function selectCategory(tag) {
        currentCatTag = tag;
        activeCat = normalizedCats.find(c => c.tag === tag || c.label.toLowerCase() === tag) || { label: tag, tag, icon: '🏷️' };
        
        // Update URL without page reload
        const newUrl = `store-category.html?id=${encodeURIComponent(item.id)}&cat=${encodeURIComponent(currentCatTag)}`;
        window.history.replaceState({ path: newUrl }, '', newUrl);

        renderCategorySwitcherPills();
        renderActiveCategoryView();
    }

    // Render Active Category View & Products
    function renderActiveCategoryView() {
        if (!activeCat) return;

        // Filter products matching this category FIRST
        const catTargetTag = (activeCat.tag || '').toLowerCase();
        const catTargetLabel = (activeCat.label || '').toLowerCase();

        currentFilteredCategoryProducts = allProducts.filter(p => {
            const pCat = (p.category || '').toLowerCase().trim();
            const pCatSlug = pCat.replace(/[^a-z0-9]+/g, '-');
            return pCatSlug === catTargetTag || pCat === catTargetLabel || pCat.includes(catTargetLabel) || catTargetLabel.includes(pCat);
        });

        // Update Top Navigation Bar with active Category, Store Name & Accurate Products Count
        const storeNavName = document.getElementById('storeNavName');
        const storeNavSub = document.getElementById('storeNavSub');
        const totalCount = currentFilteredCategoryProducts.length;
        if (storeNavName) storeNavName.textContent = activeCat.label;
        if (storeNavSub) {
            storeNavSub.innerHTML = `<i class="fa-solid fa-store"></i> ${item.name || 'Store'} • ${totalCount} ${totalCount === 1 ? 'Product' : 'Products'}`;
        }

        applyFiltersAndSort();
    }

    // Toolbar Controls (Amazon / Flipkart Sort & In-Stock Filter)
    const fkSortSelect = document.getElementById('fkSortSelect');
    const btnFilterInStock = document.getElementById('btnFilterInStock');

    btnFilterInStock?.addEventListener('click', () => {
        filterInStockOnly = !filterInStockOnly;
        btnFilterInStock.classList.toggle('active', filterInStockOnly);
        applyFiltersAndSort();
    });

    fkSortSelect?.addEventListener('change', (e) => {
        currentSortBy = e.target.value;
        applyFiltersAndSort();
    });

    function applyFiltersAndSort() {
        const query = (document.getElementById('catProductSearchInput')?.value || '').toLowerCase().trim();
        let prods = [...currentFilteredCategoryProducts];

        if (query) {
            prods = prods.filter(p => (p.name || '').toLowerCase().includes(query) || (p.details || '').toLowerCase().includes(query));
        }

        if (filterInStockOnly) {
            prods = prods.filter(p => p.stockStatus !== 'out_of_stock');
        }

        if (currentSortBy === 'price_low') {
            prods.sort((a, b) => {
                const pA = parseFloat(String(a.price || '').replace(/[^0-9.]/g, '')) || 0;
                const pB = parseFloat(String(b.price || '').replace(/[^0-9.]/g, '')) || 0;
                return pA - pB;
            });
        } else if (currentSortBy === 'price_high') {
            prods.sort((a, b) => {
                const pA = parseFloat(String(a.price || '').replace(/[^0-9.]/g, '')) || 0;
                const pB = parseFloat(String(b.price || '').replace(/[^0-9.]/g, '')) || 0;
                return pB - pA;
            });
        } else if (currentSortBy === 'name_asc') {
            prods.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        }

        renderProductsGrid(prods);
    }

    // Search filter inside active category
    const searchInput = document.getElementById('catProductSearchInput');
    searchInput?.addEventListener('input', () => {
        applyFiltersAndSort();
    });

    // Render Product Grid (Amazon / Flipkart Professional Card Format)
    function renderProductsGrid(productsToRender) {
        const grid = document.getElementById('categoryProductsGrid');
        if (!grid) return;

        if (productsToRender.length === 0) {
            grid.innerHTML = `
                <div class="empty-cat-state-wrap">
                    <span class="empty-cat-state-icon">${formatEmojiOrIcon(activeCat?.icon || '📦', activeCat?.label || '')}</span>
                    <h3 class="empty-cat-state-title">No Products Listed in "${activeCat?.label || 'Category'}"</h3>
                    <p class="empty-cat-state-sub">This business currently has 0 items added under this category matching your filter. Please check other categories or contact the store directly.</p>
                    <a href="listing-detail.html?id=${encodeURIComponent(item.id)}" class="btn-return-store-link">
                        <i class="fa-solid fa-arrow-left"></i> Return to Store Home
                    </a>
                </div>
            `;
            return;
        }

        grid.innerHTML = productsToRender.map((p) => {
            const realIdx = currentFilteredCategoryProducts.indexOf(p);
            const coverImg = (Array.isArray(p.images) && p.images[0]) || p.image || p.img || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300';
            const imgCount = Array.isArray(p.images) ? p.images.length : (p.image ? 1 : 0);
            const isOutOfStock = p.stockStatus === 'out_of_stock';
            
            // Format Pricing (Amazon / Flipkart: Selling Price, MRP strikethrough, Discount %)
            let numPrice = parseFloat(String(p.price || '').replace(/[^0-9.]/g, ''));
            let priceFormatted = p.price || '₹ 0';
            let mrpFormatted = '';
            let discountRate = '';

            if (!isNaN(numPrice) && numPrice > 0) {
                if (!priceFormatted.includes('₹') && priceFormatted !== 'On Request') {
                    priceFormatted = `₹ ${Number(numPrice).toLocaleString('en-IN')}`;
                }
                const mrp = Math.round(numPrice * 1.25);
                mrpFormatted = `₹ ${Number(mrp).toLocaleString('en-IN')}`;
                discountRate = '20% off';
            }

            const detailsSnippet = p.details ? p.details.trim() : '';

            return `
                <div class="cat-prod-card ${isOutOfStock ? 'is-out-of-stock' : ''}" onclick="openCatProductViewer(${realIdx})" style="cursor:pointer;" title="Click to view full details">
                    <!-- Left / Top Thumbnail -->
                    <div class="cat-prod-thumb-box">
                        <img src="${coverImg}" alt="${p.name}" class="cat-prod-thumb" loading="lazy">
                        ${imgCount > 1 ? `<span class="fk-img-count-chip"><i class="fa-regular fa-images"></i> ${imgCount}</span>` : ''}
                        ${isOutOfStock ? '<span class="fk-stock-out-chip">Out of Stock</span>' : ''}
                    </div>

                    <!-- Right / Main Content -->
                    <div class="cat-prod-content">
                        <!-- Brand & Verified Tag -->
                        <div class="fk-brand-row">
                            <span class="fk-brand-name">${item.name || 'Store'}</span>
                            <span class="fk-assured-badge"><i class="fa-solid fa-shield-halved"></i> Assured</span>
                        </div>

                        <!-- Product Title -->
                        <h3 class="fk-product-name" title="${p.name}">${p.name}</h3>

                        <!-- Ratings Row -->
                        <div class="fk-ratings-row">
                            <span class="fk-rating-pill">4.3 <i class="fa-solid fa-star"></i></span>
                            <span class="fk-verified-reviews">(Local Pick)</span>
                        </div>

                        <!-- Pricing Row -->
                        <div class="fk-pricing-block">
                            <span class="fk-selling-price">${priceFormatted}</span>
                            ${mrpFormatted ? `<del class="fk-mrp-price">${mrpFormatted}</del>` : ''}
                            ${discountRate ? `<span class="fk-discount-rate">${discountRate}</span>` : ''}
                        </div>

                        <!-- Feature highlights -->
                        <ul class="fk-features-list">
                            ${detailsSnippet ? `<li class="fk-feature-item"><i class="fa-solid fa-check" style="color:#059669;"></i> ${detailsSnippet}</li>` : ''}
                            <li class="fk-feature-item ${isOutOfStock ? 'stock-out' : 'stock-in'}">
                                <i class="fa-solid ${isOutOfStock ? 'fa-circle-xmark' : 'fa-truck-fast'}"></i>
                                ${isOutOfStock ? 'Currently Out of Stock' : 'In Stock • Ready for Store Pickup & Delivery'}
                            </li>
                        </ul>
                    </div>
                </div>
            `;
        }).join('');
    }

    // ================= PRODUCT DETAIL VIEWER MODAL =================
    const catProductModalBackdrop = document.getElementById('catProductModalBackdrop');
    const cpmCategory = document.getElementById('cpmCategory');
    const cpmSliderTrack = document.getElementById('cpmSliderTrack');
    const cpmSliderDots = document.getElementById('cpmSliderDots');
    const cpmPrice = document.getElementById('cpmPrice');
    const cpmStockPill = document.getElementById('cpmStockPill');
    const cpmTitle = document.getElementById('cpmTitle');
    const cpmDesc = document.getElementById('cpmDesc');
    const btnCpmChat = document.getElementById('btnCpmChat');
    const btnCpmCall = document.getElementById('btnCpmCall');

    window.openCatProductViewer = function(idx) {
        const p = currentFilteredCategoryProducts[idx];
        if (!p || !catProductModalBackdrop) return;

        if (cpmCategory) cpmCategory.textContent = p.category || activeCat?.label || 'Product';
        if (cpmTitle) cpmTitle.textContent = p.name || 'Product Details';
        if (cpmPrice) cpmPrice.textContent = p.price || 'Price on Request';
        if (cpmDesc) cpmDesc.textContent = p.details || p.description || 'Contact merchant directly for immediate availability, size options, and home delivery.';

        const isOutOfStock = p.stockStatus === 'out_of_stock';
        if (cpmStockPill) {
            cpmStockPill.textContent = isOutOfStock ? 'Out of Stock' : 'In Stock';
            cpmStockPill.className = `dpm-stock-pill ${isOutOfStock ? 'out' : 'in'}`;
        }

        const images = Array.isArray(p.images) && p.images.length > 0
            ? p.images
            : (p.image ? [p.image] : ['https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400']);

        if (cpmSliderTrack) {
            cpmSliderTrack.innerHTML = images.map(src => `<img src="${src}" class="dpm-slide-img" alt="${p.name}">`).join('');
            cpmSliderTrack.scrollLeft = 0;
        }

        if (cpmSliderDots) {
            if (images.length > 1) {
                cpmSliderDots.style.display = 'flex';
                cpmSliderDots.innerHTML = images.map((_, i) => `<span class="dot ${i === 0 ? 'active' : ''}"></span>`).join('');
                cpmSliderTrack.onscroll = () => {
                    const scrollLeft = cpmSliderTrack.scrollLeft;
                    const width = cpmSliderTrack.offsetWidth || 1;
                    const active = Math.round(scrollLeft / width);
                    cpmSliderDots.querySelectorAll('.dot').forEach((d, i) => d.classList.toggle('active', i === active));
                };
            } else {
                cpmSliderDots.style.display = 'none';
            }
        }

        if (btnCpmChat) {
            btnCpmChat.onclick = () => {
                const prod = currentFilteredCategoryProducts[idx];
                if (catProductModalBackdrop) catProductModalBackdrop.style.display = 'none';
                if (window.lbTransitionModal) {
                    window.lbTransitionModal('catProductModal', 'catChatModal', () => {
                        chatModalBackdrop?.classList.remove('open');
                    });
                }
                window.openProductInquiryChat(prod, true);
            };
        }

        if (btnCpmCall) {
            btnCpmCall.onclick = () => {
                callStoreForProduct(idx);
            };
        }

        catProductModalBackdrop.style.display = 'flex';
        if (window.lbPushModal) window.lbPushModal('catProductModal', window.closeCatProductViewer);
    };

    window.closeCatProductViewer = function() {
        if (catProductModalBackdrop) {
            catProductModalBackdrop.style.display = 'none';
        }
        if (window.lbPopModal) window.lbPopModal('catProductModal');
    };

    window.inquireProduct = function(idx) {
        const p = currentFilteredCategoryProducts[idx];
        if (!p) return;
        window.openProductInquiryChat(p);
    };

    window.callStoreForProduct = function(idx) {
        if (item.phone) {
            window.location.href = `tel:${item.phone}`;
        } else {
            alert('Store phone number is not available.');
        }
    };

    // ================= IN-PAGE LIVE CHAT MODAL ENGINE =================
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

    window.openProductInquiryChat = function(p, isTransition = false) {
        if (!p) return;
        currentAttachedChatProduct = p;

        if (!isTransition && typeof window.closeCatProductViewer === 'function') {
            window.closeCatProductViewer();
        }

        if (chatProductPreviewBar) {
            chatProductPreviewBar.style.display = 'flex';
            const prodImg = (Array.isArray(p.images) && p.images[0]) || p.image || item.image || '';
            if (chatProductThumb) {
                chatProductThumb.src = prodImg;
                chatProductThumb.style.display = prodImg ? 'block' : 'none';
            }
            if (chatProductName) chatProductName.textContent = p.name || 'Product Inquiry';
            if (chatProductPrice) {
                chatProductPrice.textContent = p.price || 'Price on Request';
            }
        }

        if (chatInputField) {
            const pr = p.price ? ` (${p.price})` : '';
            chatInputField.value = `Hi, I am interested in inquiring about "${p.name || 'this item'}"${pr}. Is this available in stock?`;
        }

        if (chatModalBackdrop) {
            chatModalBackdrop.classList.add('open');
            if (!isTransition && window.lbPushModal) {
                window.lbPushModal('catChatModal', () => {
                    chatModalBackdrop?.classList.remove('open');
                });
            }
            setTimeout(() => {
                chatInputField?.focus();
            }, 100);
        }
    };

    btnClearChatProduct?.addEventListener('click', () => {
        currentAttachedChatProduct = null;
        if (chatProductPreviewBar) chatProductPreviewBar.style.display = 'none';
    });

    btnCloseChatModal?.addEventListener('click', () => {
        chatModalBackdrop?.classList.remove('open');
        if (window.lbPopModal) window.lbPopModal('catChatModal');
    });

    chatModalBackdrop?.addEventListener('click', (e) => {
        if (e.target === chatModalBackdrop) {
            chatModalBackdrop.classList.remove('open');
            if (window.lbPopModal) window.lbPopModal('catChatModal');
        }
    });

    chatMessageForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = chatInputField.value.trim();
        if (!text) return;

        const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const attachedProd = currentAttachedChatProduct;

        let attachmentHtml = '';
        if (attachedProd) {
            const prodImg = (Array.isArray(attachedProd.images) && attachedProd.images[0]) || attachedProd.image || '';
            const prodPrice = attachedProd.price || '';
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

            // Trigger Real-time Merchant Push Notification & In-app Alert
            try {
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
            const inRow = document.createElement('div');
            inRow.className = 'chat-msg-row incoming';
            const autoReply = attachedProd
                ? `Thanks for your interest in <strong>${attachedProd.name}</strong>! We have received your query. Our team at <strong>${item.name}</strong> will assist you right away.`
                : `Thanks for reaching out! We have received your query regarding <strong>${item.name}</strong>.`;
            inRow.innerHTML = `<div class="msg-bubble">${autoReply}<span class="msg-time">${timeNow}</span></div>`;
            chatModalBody.appendChild(inRow);
            chatModalBody.scrollTop = chatModalBody.scrollHeight;
        }, 800);
    });

    // Initial render
    renderCategorySwitcherPills();
    renderActiveCategoryView();

    // Check if user arrived via product link
    try {
        const prodParam = urlParams.get('product') || urlParams.get('prod');
        if (prodParam) {
            const cleanTarget = decodeURIComponent(prodParam).trim().toLowerCase();
            setTimeout(() => {
                const foundIdx = currentFilteredCategoryProducts.findIndex(p => {
                    const pName = (p.name || '').trim().toLowerCase();
                    return pName === cleanTarget || pName.includes(cleanTarget);
                });
                if (foundIdx !== -1 && typeof window.openCatProductViewer === 'function') {
                    window.openCatProductViewer(foundIdx);
                }
            }, 300);
        }
    } catch (e) {}
});
