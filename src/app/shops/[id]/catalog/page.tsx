'use client';

import React, { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Listing, ProductItem, StoreCategoryItem, EmptyStoreBannerSlot, CategoryItem } from '@/types';
import { cloudSync } from '@/lib/firebase';
import '@/styles/listing-detail.css';
import '@/styles/store-category.css';
import '@/styles/pwa.css';

// Helper: Category Icon / Emoji Resolver
function resolveCatEmoji(label = ''): string {
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

function formatEmojiOrIcon(icon?: string, label = ''): React.ReactNode {
  let ic = (icon || '').trim();
  if (!ic) ic = resolveCatEmoji(label);
  if (ic.includes('fa-')) {
    const cls = ic.includes(' ') ? ic : `fa-solid ${ic}`;
    return <i className={cls}></i>;
  }
  return <span className="cat-emoji" style={{ fontStyle: 'normal', lineHeight: 1 }}>{ic}</span>;
}

// Helper to normalize any string to a clean comparison slug
function normalizeSlug(s = ''): string {
  return (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function StoreCategoryCatalogContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const listingId = params?.id ? String(params.id) : '';
  const initialCat = (searchParams.get('cat') || '').toLowerCase().trim();
  const prodParam = (searchParams.get('product') || searchParams.get('prod') || '').trim();

  const [listing, setListing] = useState<Listing | null>(() => {
    if (typeof window !== 'undefined' && listingId) {
      try {
        const raw = localStorage.getItem('lb_cached_listings');
        if (raw) {
          const list: Listing[] = JSON.parse(raw);
          const found = list.find((l) => String(l.id) === String(listingId));
          if (found) return found;
        }
      } catch {}
    }
    return null;
  });

  const [allCategories, setAllCategories] = useState<CategoryItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('lb_cached_categories');
        if (raw) return JSON.parse(raw);
      } catch {}
    }
    return [];
  });

  const [loading, setLoading] = useState(!listing);
  const [currentCatTag, setCurrentCatTag] = useState(initialCat);
  const [currentSortBy, setCurrentSortBy] = useState<'featured' | 'price_low' | 'price_high' | 'name_asc'>('featured');
  const [filterInStockOnly, setFilterInStockOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [emptyStoreBanners, setEmptyStoreBanners] = useState<EmptyStoreBannerSlot[]>([]);

  useEffect(() => {
    cloudSync.pullEmptyStoreBanners().then((cloudSlots) => {
      if (cloudSlots && cloudSlots.length > 0) {
        setEmptyStoreBanners(cloudSlots);
      }
    }).catch(() => {});

    // Dynamic Admin categories for 100% future-proof in-store category synchronization
    cloudSync.pullCategories().then((cats) => {
      if (cats && Array.isArray(cats)) {
        setAllCategories(cats);
        try { localStorage.setItem('lb_cached_categories', JSON.stringify(cats)); } catch {}
      }
    }).catch(() => {});
  }, []);

  // Modals state
  const [activeViewerProduct, setActiveViewerProduct] = useState<ProductItem | null>(null);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const productSliderTrackRef = useRef<HTMLDivElement>(null);

  // Chat Modal state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatProduct, setChatProduct] = useState<ProductItem | null>(null);
  const [chatInputText, setChatInputText] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'customer' | 'store'; text: string; time: string; product?: ProductItem | null }>>([]);
  const chatBodyRef = useRef<HTMLDivElement>(null);

  // 1. Load listing data directly from Cloud Firestore (Zero demo data)
  useEffect(() => {
    if (!listingId) return;

    if (!listing) setLoading(true);
    cloudSync.getListingById(listingId).then((cloudItem) => {
      if (cloudItem) {
        setListing(cloudItem);
      }
      setLoading(false);
    }).catch((err) => {
      console.error('Error fetching listing catalog:', err);
      setLoading(false);
    });
  }, [listingId]);

  // Normalized Store Categories (Fully dynamic & synchronized with Admin Categories and Store Products)
  const storeCategories = useMemo<{ label: string; tag: string; icon: string }[]>(() => {
    if (!listing) return [];
    let rawCats: any[] = [];

    // 1. If listing has its own custom in-store categories defined by merchant:
    if (Array.isArray(listing.storeCategories) && listing.storeCategories.length > 0) {
      rawCats = [...listing.storeCategories];
    }

    // 2. Dynamic lookup: match Admin Global Category from Firestore for this store's category
    const storeMainCat = (listing.category || '').trim().toLowerCase();
    const matchedAdminCat = allCategories.find((c) => {
      const cName = (c.name || '').trim().toLowerCase();
      const cAlt = (c.alternativeName || '').trim().toLowerCase();
      return cName === storeMainCat || cAlt === storeMainCat || cName.includes(storeMainCat) || storeMainCat.includes(cName);
    });

    if (rawCats.length === 0 && matchedAdminCat) {
      if (Array.isArray(matchedAdminCat.storeCategories) && matchedAdminCat.storeCategories.length > 0) {
        rawCats = [...matchedAdminCat.storeCategories];
      } else if (Array.isArray(matchedAdminCat.subcategories) && matchedAdminCat.subcategories.length > 0) {
        rawCats = [...matchedAdminCat.subcategories];
      }
    }

    // 3. Dynamically include any distinct in-store categories assigned to store products
    if (Array.isArray(listing.products) && listing.products.length > 0) {
      const prodCats = Array.from(new Set(listing.products.map((p) => p.storeCategory || p.category).filter(Boolean)));
      prodCats.forEach((pc) => {
        const pcStr = typeof pc === 'string' ? pc.trim() : ((pc as any).label || (pc as any).name);
        const exists = rawCats.some((rc) => {
          const rcStr = typeof rc === 'string' ? rc.trim() : (rc.label || rc.name || rc.tag);
          return rcStr && rcStr.toLowerCase() === pcStr?.toLowerCase();
        });
        if (!exists && pcStr) {
          rawCats.push(pc);
        }
      });
    }

    if (rawCats.length > 0) {
      return rawCats.map((c: any) => {
        const label = typeof c === 'string' ? c.trim() : (c.label || c.name || 'Category').trim();
        const tag = typeof c === 'string'
          ? normalizeSlug(label)
          : (c.tag || normalizeSlug(label));
        const icon = (typeof c === 'object' && c && c.icon) ? c.icon : resolveCatEmoji(label);
        return { label, tag, icon };
      });
    }

    return [];
  }, [listing, allCategories]);

  // Keep currentCatTag in sync with URL searchParams if URL changes
  useEffect(() => {
    if (initialCat) {
      setCurrentCatTag(initialCat);
    }
  }, [initialCat]);

  // Set default active category tag if none set or URL has no cat param
  useEffect(() => {
    if (storeCategories.length > 0) {
      if (!currentCatTag) {
        setCurrentCatTag(storeCategories[0].tag);
      }
    }
  }, [storeCategories, currentCatTag]);

  const activeCategory = useMemo(() => {
    if (currentCatTag === 'all' || currentCatTag === 'all-products') {
      return { label: 'All Products', tag: 'all', icon: '🛍️' };
    }

    if (storeCategories.length === 0) {
      if (initialCat) {
        return {
          label: initialCat.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
          tag: initialCat,
          icon: resolveCatEmoji(initialCat)
        };
      }
      return null;
    }

    const targetSlug = normalizeSlug(currentCatTag);
    const targetClean = (currentCatTag || '').toLowerCase().trim();

    const found = storeCategories.find((c) => {
      const cTagSlug = normalizeSlug(c.tag);
      const cLabelSlug = normalizeSlug(c.label);
      const cLabelLower = c.label.toLowerCase().trim();
      return (
        c.tag === currentCatTag ||
        cTagSlug === targetSlug ||
        cLabelSlug === targetSlug ||
        cLabelLower === targetClean ||
        cTagSlug.includes(targetSlug) ||
        targetSlug.includes(cTagSlug) ||
        cLabelLower.includes(targetClean) ||
        targetClean.includes(cLabelLower)
      );
    });

    return found || storeCategories[0];
  }, [storeCategories, currentCatTag, initialCat]);

  // Filter & sort products
  const displayProducts = useMemo(() => {
    if (!listing) return [];
    const prods = (Array.isArray(listing.products) && listing.products.length > 0)
      ? listing.products
      : [];

    const isAll = !activeCategory || activeCategory.tag === 'all';
    const catTargetSlug = normalizeSlug(activeCategory?.tag || '');
    const catTargetLabel = (activeCategory?.label || '').toLowerCase().trim();

    // 1. Category Filter
    let filtered = prods.filter((p) => {
      if (isAll) return true;
      const pCat = (p.storeCategory || p.category || '').toLowerCase().trim();
      const pCatSlug = normalizeSlug(pCat);
      return (
        pCatSlug === catTargetSlug ||
        pCat === catTargetLabel ||
        pCat.includes(catTargetLabel) ||
        catTargetLabel.includes(pCat) ||
        pCatSlug.includes(catTargetSlug) ||
        catTargetSlug.includes(pCatSlug)
      );
    });

    // 2. Search Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((p) => (p.name || '').toLowerCase().includes(q) || (p.details || '').toLowerCase().includes(q));
    }

    // 3. In-Stock Filter
    if (filterInStockOnly) {
      filtered = filtered.filter((p) => p.stockStatus !== 'out_of_stock');
    }

    // 4. Sort
    if (currentSortBy === 'price_low') {
      filtered.sort((a, b) => {
        const pA = parseFloat(String(a.price || '').replace(/[^0-9.]/g, '')) || 0;
        const pB = parseFloat(String(b.price || '').replace(/[^0-9.]/g, '')) || 0;
        return pA - pB;
      });
    } else if (currentSortBy === 'price_high') {
      filtered.sort((a, b) => {
        const pA = parseFloat(String(a.price || '').replace(/[^0-9.]/g, '')) || 0;
        const pB = parseFloat(String(b.price || '').replace(/[^0-9.]/g, '')) || 0;
        return pB - pA;
      });
    } else if (currentSortBy === 'name_asc') {
      filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    return filtered;
  }, [listing, activeCategory, searchQuery, filterInStockOnly, currentSortBy]);

  // Auto-open product from url query
  useEffect(() => {
    if (prodParam && displayProducts.length > 0) {
      const cleanTarget = decodeURIComponent(prodParam).trim().toLowerCase();
      const target = displayProducts.find((p) => {
        const pName = (p.name || '').trim().toLowerCase();
        return pName === cleanTarget || pName.includes(cleanTarget);
      });
      if (target) {
        setActiveViewerProduct(target);
      }
    }
  }, [prodParam, displayProducts]);

  // Open Product Inquire Chat
  const handleOpenChat = (product: ProductItem | null) => {
    setChatProduct(product);
    setActiveViewerProduct(null);
    if (product) {
      const pr = product.price ? ` (${product.price})` : '';
      setChatInputText(`Hi, I am interested in inquiring about "${product.name || 'this item'}"${pr}. Is this available in stock?`);
    } else {
      setChatInputText(`Hi, I would like to inquire about products at ${listing?.name || 'your store'}.`);
    }
    setIsChatOpen(true);
  };

  // Send message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatInputText.trim();
    if (!text || !listing) return;

    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const currentProd = chatProduct;

    const newMsg = {
      sender: 'customer' as const,
      text,
      time: timeNow,
      product: currentProd
    };

    setChatMessages((prev) => [...prev, newMsg]);
    setChatInputText('');
    setChatProduct(null);

    // Persist to store inbox directly in Cloud Firestore
    try {
      let currentUser: any = null;
      try { currentUser = JSON.parse(localStorage.getItem('lb_current_user') || 'null'); } catch {}
      const customerName = currentUser?.name || 'Local Customer';
      const customerPhone = currentUser?.phone || 'In-App Direct Chat';

      const thread = {
        id: 'msg_' + Date.now(),
        userName: customerName,
        userPhone: customerPhone,
        lastTime: timeNow,
        unread: true,
        messages: [{
          sender: 'customer',
          text,
          product: currentProd ? { name: currentProd.name, price: currentProd.price, image: currentProd.image } : null,
          time: timeNow
        }]
      };
      cloudSync.saveStoreMessage(listing.id, thread).catch(() => {});
    } catch {}

    // Auto store response
    setTimeout(() => {
      const autoReplyText = currentProd
        ? `Thanks for your interest in ${currentProd.name}! We have received your query. Our team at ${listing.name} will assist you right away.`
        : `Thanks for reaching out! We have received your query regarding ${listing.name}.`;

      setChatMessages((prev) => [
        ...prev,
        {
          sender: 'store',
          text: autoReplyText,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      if (chatBodyRef.current) {
        chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
      }
    }, 800);
  };

  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#ffffff', zIndex: 99999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Plus Jakarta Sans, sans-serif', textAlign: 'center', padding: '1.5rem' }}>
        <div style={{ width: 44, height: 44, border: '3.5px solid #e2e8f0', borderTopColor: '#1a73e8', borderRadius: '50%', animation: 'lbSpin 0.75s linear infinite' }}></div>
        <div style={{ marginTop: '1.15rem', fontWeight: 700, color: '#0f172a', fontSize: '1.05rem' }}>Loading Store Catalog...</div>
        <div style={{ marginTop: '0.35rem', color: '#64748b', fontSize: '0.86rem' }}>Connecting to verified local records...</div>
        <style>{`@keyframes lbSpin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="lb-not-found-layout" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '2.5rem 1.25rem', fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif', textAlign: 'center' }}>
        <div style={{ background: '#ffffff', maxWidth: 480, width: '100%', borderRadius: 24, padding: '2.75rem 2rem', boxShadow: '0 20px 25px -5px rgba(15, 23, 42, 0.08)', border: '1px solid #e2e8f0' }}>
          <div style={{ width: 80, height: 80, margin: '0 auto 1.5rem', background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)', color: '#ef4444', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.25rem' }}>
            <i className="fa-solid fa-store-slash"></i>
          </div>
          <span style={{ display: 'inline-block', background: '#f1f5f9', color: '#475569', fontSize: '0.76rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0.35rem 0.85rem', borderRadius: 20, marginBottom: '0.85rem' }}>
            Error 404 • Store Not Found
          </span>
          <h2 style={{ color: '#0f172a', fontSize: '1.45rem', fontWeight: 800, marginBottom: '0.65rem' }}>Store or Business Not Found</h2>
          <p style={{ color: '#64748b', fontSize: '0.94rem', lineHeight: 1.55, marginBottom: '2rem' }}>The business you are trying to browse is currently unavailable or the link is invalid.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Link href="/explore" style={{ background: '#1a73e8', color: '#ffffff', textDecoration: 'none', padding: '0.8rem 1.25rem', borderRadius: 12, fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <i className="fa-solid fa-compass"></i> Explore All Places
            </Link>
            <Link href="/" style={{ background: '#f1f5f9', color: '#334155', textDecoration: 'none', padding: '0.8rem 1.25rem', borderRadius: 12, fontWeight: 600, fontSize: '0.92rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <i className="fa-solid fa-magnifying-glass"></i> Back to Home Search
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="store-cat-page-body" style={{ minHeight: '100vh', paddingBottom: '2rem', background: '#f8fafc' }}>
      {/* Sticky Top Navigation Bar */}
      <header className="store-cat-top-nav">
        <div className="store-cat-nav-container">
          <Link href={`/shops/${encodeURIComponent(listing.id)}`} className="nav-back-btn" title="Back to Store">
            <i className="fa-solid fa-arrow-left"></i>
          </Link>
          <div className="nav-store-meta">
            <h2 className="nav-store-name">{activeCategory?.label || listing.name}</h2>
            <span className="nav-store-sub">
              <i className="fa-solid fa-store"></i> {listing.name} • {displayProducts.length} {displayProducts.length === 1 ? 'Product' : 'Products'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="store-cat-main-layout">
        <div className="store-cat-container">
          {/* Amazon / Flipkart Style Filter & Sort Bar */}
          <div className="fk-toolbar-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.65rem', margin: '0.75rem 0' }}>
            <div className="fk-toolbar-filters" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', width: '100%' }}>
              <select
                id="fkSortSelect"
                className="fk-sort-select"
                value={currentSortBy}
                onChange={(e) => setCurrentSortBy(e.target.value as any)}
                style={{ flex: 1, padding: '0.55rem 0.85rem', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}
              >
                <option value="featured">Sort: Featured</option>
                <option value="price_low">Price: Low to High</option>
                <option value="price_high">Price: High to Low</option>
                <option value="name_asc">Name: A to Z</option>
              </select>

              <button
                type="button"
                className={`fk-filter-pill-btn ${filterInStockOnly ? 'active' : ''}`}
                onClick={() => setFilterInStockOnly(!filterInStockOnly)}
                style={{ padding: '0.55rem 0.95rem', borderRadius: 10, border: filterInStockOnly ? '1.5px solid #16a34a' : '1px solid #cbd5e1', background: filterInStockOnly ? '#f0fdf4' : '#fff', color: filterInStockOnly ? '#16a34a' : '#475569', fontWeight: 700, fontSize: '0.82rem', whiteSpace: 'nowrap', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <i className="fa-solid fa-check"></i> In Stock Only
              </button>
            </div>
          </div>

          {/* Horizontal Scrolling Category Pills Bar (Synchronized with Admin Dynamic Subcategories) */}
          {storeCategories.length > 0 && (
            <div
              style={{
                display: 'flex',
                gap: '0.5rem',
                overflowX: 'auto',
                padding: '0.35rem 0 0.85rem 0',
                scrollbarWidth: 'none',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              <button
                type="button"
                onClick={() => setCurrentCatTag('all')}
                style={{
                  padding: '0.45rem 0.85rem',
                  borderRadius: '999px',
                  border: currentCatTag === 'all' ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                  background: currentCatTag === 'all' ? '#eff6ff' : '#ffffff',
                  color: currentCatTag === 'all' ? '#1d4ed8' : '#475569',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  boxShadow: currentCatTag === 'all' ? '0 1px 4px rgba(37, 99, 235, 0.15)' : 'none',
                  flexShrink: 0,
                  transition: 'all 0.15s ease',
                }}
              >
                <span>🛍️</span>
                <span>All Products</span>
                <span style={{ fontSize: '0.72rem', opacity: 0.85 }}>({listing.products?.length || 0})</span>
              </button>

              {storeCategories.map((c) => {
                const isSelected = activeCategory?.tag === c.tag;
                const cSlug = normalizeSlug(c.tag);
                const cLabel = c.label.toLowerCase().trim();
                const count = (listing.products || []).filter((p) => {
                  const pCat = (p.storeCategory || p.category || '').toLowerCase().trim();
                  const pSlug = normalizeSlug(pCat);
                  return pSlug === cSlug || pCat === cLabel || pCat.includes(cLabel) || cLabel.includes(pCat);
                }).length;

                return (
                  <button
                    key={c.tag}
                    type="button"
                    onClick={() => setCurrentCatTag(c.tag)}
                    style={{
                      padding: '0.45rem 0.85rem',
                      borderRadius: '999px',
                      border: isSelected ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                      background: isSelected ? '#eff6ff' : '#ffffff',
                      color: isSelected ? '#1d4ed8' : '#475569',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      boxShadow: isSelected ? '0 1px 4px rgba(37, 99, 235, 0.15)' : 'none',
                      flexShrink: 0,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>{c.icon || resolveCatEmoji(c.label)}</span>
                    <span>{c.label}</span>
                    {count > 0 && (
                      <span
                        style={{
                          fontSize: '0.7rem',
                          background: isSelected ? '#2563eb' : '#f1f5f9',
                          color: isSelected ? '#fff' : '#64748b',
                          padding: '0.05rem 0.45rem',
                          borderRadius: '999px',
                          fontWeight: 800,
                        }}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Product Grid / Catalog Feed */}
          <div className="store-products-catalog-section">
            <div className="store-products-catalog-grid view-list">
              {displayProducts.length === 0 ? (
                <div className="empty-cat-state-wrap">
                  <span className="empty-cat-state-icon">{formatEmojiOrIcon(activeCategory?.icon || '📦', activeCategory?.label || '')}</span>
                  <h3 className="empty-cat-state-title">No Products Listed in &quot;{activeCategory?.label || 'Category'}&quot;</h3>
                  <p className="empty-cat-state-sub">This business currently has 0 items added under this category matching your filter. Please check other categories or contact the store directly.</p>
                  <div style={{ display: 'flex', gap: '0.65rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '1rem' }}>
                    <button
                      type="button"
                      onClick={() => setCurrentCatTag('all')}
                      style={{
                        background: '#2563eb',
                        color: '#fff',
                        border: 'none',
                        padding: '0.55rem 1rem',
                        borderRadius: 10,
                        fontWeight: 700,
                        fontSize: '0.86rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                      }}
                    >
                      <i className="fa-solid fa-boxes-stacked"></i> View All Store Products ({listing.products?.length || 0})
                    </button>
                    <Link href={`/shops/${encodeURIComponent(listing.id)}`} className="btn-return-store-link" style={{ marginTop: 0 }}>
                      <i className="fa-solid fa-arrow-left"></i> Return to Store Home
                    </Link>
                  </div>
                </div>
              ) : (
                displayProducts.map((p, idx) => {
                  const coverImg = (Array.isArray(p.images) && p.images[0]) || p.image || p.img || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300';
                  const imgCount = Array.isArray(p.images) ? p.images.length : (p.image ? 1 : 0);
                  const isOutOfStock = p.stockStatus === 'out_of_stock';

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

                  return (
                    <div
                      key={p.id || idx}
                      className={`cat-prod-card ${isOutOfStock ? 'is-out-of-stock' : ''}`}
                      onClick={() => {
                        router.push(`/shops/${encodeURIComponent(listing.id)}/product/${encodeURIComponent(p.id || p.name)}`);
                      }}
                      style={{ cursor: 'pointer' }}
                      title="Click to view full details"
                    >
                      <div className="cat-prod-thumb-box">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={coverImg} alt={p.name} className="cat-prod-thumb" loading="lazy" />
                        {imgCount > 1 && (
                          <span className="fk-img-count-chip"><i className="fa-regular fa-images"></i> {imgCount}</span>
                        )}
                        {isOutOfStock && <span className="fk-stock-out-chip">Out of Stock</span>}
                      </div>

                      <div className="cat-prod-content">
                        <div className="fk-brand-row">
                          <span className="fk-brand-name">{listing.name}</span>
                        </div>

                        <h3 className="fk-product-name" title={p.name}>{p.name}</h3>

                        <div className="fk-ratings-row">
                          <span className="fk-rating-pill">4.3 <i className="fa-solid fa-star"></i></span>
                          <span className="fk-verified-reviews">(Local Pick)</span>
                        </div>

                        <div className="fk-pricing-block">
                          <span className="fk-selling-price">{priceFormatted}</span>
                          {mrpFormatted && <del className="fk-mrp-price">{mrpFormatted}</del>}
                          {discountRate && <span className="fk-discount-rate">{discountRate}</span>}
                        </div>

                        <ul className="fk-features-list">
                          {detailsSnippet && (
                            <li className="fk-feature-item">
                              <i className="fa-solid fa-check" style={{ color: '#059669' }}></i> {detailsSnippet}
                            </li>
                          )}
                          <li className={`fk-feature-item ${isOutOfStock ? 'stock-out' : 'stock-in'}`}>
                            <i className={`fa-solid ${isOutOfStock ? 'fa-circle-xmark' : 'fa-truck-fast'}`}></i>
                            {isOutOfStock ? 'Currently Out of Stock' : 'In Stock • Ready for Store Pickup & Delivery'}
                          </li>
                        </ul>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Fullscreen Lightbox Modal */}
      {lightboxImg && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={() => setLightboxImg(null)}
        >
          <button
            onClick={() => setLightboxImg(null)}
            style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', fontSize: '1.5rem', width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            &times;
          </button>
          <img
            src={lightboxImg}
            alt="Fullscreen view"
            style={{ maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: '8px' }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Store In-Page Live Chat Modal */}
      {isChatOpen && (
        <div className="chat-modal-backdrop open" onClick={() => setIsChatOpen(false)}>
          <div className="chat-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="chat-modal-header">
              <div className="chat-partner-meta">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={listing.image || 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=100&auto=format&fit=crop&q=80'}
                  alt="Store Logo"
                  className="chat-partner-avatar"
                />
                <div>
                  <h4 className="chat-partner-name">{listing.name}</h4>
                  <span className="chat-status-text"><i className="fa-solid fa-circle-check"></i> Verified Business</span>
                </div>
              </div>
              <button type="button" className="btn-close-chat" onClick={() => setIsChatOpen(false)}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <div className="chat-modal-body" ref={chatBodyRef}>
              <div className="chat-msg-row incoming">
                <div className="msg-bubble">
                  Hello! Welcome to <strong>{listing.name}</strong> on LocalBazar. How can we assist you today?
                </div>
              </div>

              {chatMessages.map((m, idx) => (
                <div key={idx} className={`chat-msg-row ${m.sender === 'customer' ? 'outgoing' : 'incoming'}`}>
                  <div className="msg-bubble">
                    {m.product && (
                      <div className="chat-card-attachment">
                        {(m.product.image || (Array.isArray(m.product.images) && m.product.images[0])) && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.product.image || m.product.images?.[0]} alt={m.product.name} />
                        )}
                        <div className="chat-card-attachment-meta">
                          <span className="chat-card-attachment-title">{m.product.name}</span>
                          {m.product.price && <span className="chat-card-attachment-price">{m.product.price}</span>}
                        </div>
                      </div>
                    )}
                    {m.text}
                    <span className="msg-time">{m.time}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="chat-modal-footer">
              {chatProduct && (
                <div className="chat-product-preview-bar" style={{ display: 'flex' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={chatProduct.image || (Array.isArray(chatProduct.images) && chatProduct.images[0]) || ''}
                    alt={chatProduct.name}
                    className="chat-product-thumb"
                  />
                  <div className="chat-product-info">
                    <span className="chat-product-tag"><i className="fa-solid fa-tag"></i> Inquiring About:</span>
                    <div className="chat-product-name">{chatProduct.name}</div>
                    <div className="chat-product-price">{chatProduct.price || 'Price on Request'}</div>
                  </div>
                  <button type="button" className="btn-clear-chat-product" onClick={() => setChatProduct(null)}>
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>
              )}

              <form onSubmit={handleSendMessage} className="chat-input-form">
                <input
                  type="text"
                  placeholder="Type your message here..."
                  value={chatInputText}
                  onChange={(e) => setChatInputText(e.target.value)}
                  autoComplete="off"
                  required
                />
                <button type="submit" className="btn-send-chat">
                  <i className="fa-solid fa-paper-plane"></i>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StoreCategoryCatalogPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <div style={{ width: 44, height: 44, border: '3.5px solid #e2e8f0', borderTopColor: '#1a73e8', borderRadius: '50%', animation: 'lbSpin 0.75s linear infinite' }}></div>
      </div>
    }>
      <StoreCategoryCatalogContent />
    </Suspense>
  );
}
