'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Listing, ProductItem, ReviewItem, StoreCategoryItem, EmptyStoreBannerSlot, UserProfile, isTrustBadgeActive } from '@/types';
import { cloudSync, auth, formatLBUserId } from '@/lib/firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { DEFAULT_GROCERY_CATS, DEMO_GROCERY_PRODUCTS, DEFAULT_LISTINGS } from '@/lib/shopData';

// Helper to resolve an emoji / icon for store categories
function resolveCatEmoji(label?: string): string {
  if (!label) return '🏷️';
  const l = label.toLowerCase();
  if (l.includes('oil') || l.includes('ghee') || l.includes('mustard')) return '🍯';
  if (l.includes('rice') || l.includes('chawal') || l.includes('pulao')) return '🍚';
  if (l.includes('masala') || l.includes('spice') || l.includes('turmeric')) return '🧂';
  if (l.includes('dal') || l.includes('pulse') || l.includes('toor')) return '🥘';
  if (l.includes('atta') || l.includes('flour') || l.includes('wheat') || l.includes('besan')) return '🌾';
  if (l.includes('phone') || l.includes('mobile') || l.includes('electronic')) return '📱';
  if (l.includes('cloth') || l.includes('fashion') || l.includes('wear') || l.includes('shirt')) return '👕';
  if (l.includes('snack') || l.includes('biscuit') || l.includes('bakery')) return '🍪';
  if (l.includes('beverage') || l.includes('tea') || l.includes('coffee') || l.includes('cold drink')) return '☕';
  if (l.includes('grocery') || l.includes('ration') || l.includes('supermarket') || l.includes('kirana')) return '🛒';
  if (l.includes('beauty') || l.includes('cosmetic') || l.includes('salon') || l.includes('makeup')) return '💄';
  if (l.includes('doctor') || l.includes('health') || l.includes('clinic') || l.includes('medicine')) return '🩺';
  if (l.includes('jewel') || l.includes('gold') || l.includes('diamond')) return '💎';
  if (l.includes('watch') || l.includes('clock')) return '⌚';
  return '🏷️';
}

export default function ShopDetailPage() {
  const params = useParams();
  const router = useRouter();
  const shopId = decodeURIComponent(String(params?.id || ''));

  const [shop, setShop] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);

  // Bottom Navigation Active Tab ('home' | 'reviews')
  const [bottomTab, setBottomTab] = useState<'home' | 'reviews'>('home');
  const reviewsSectionRef = useRef<HTMLDivElement>(null);

  // Search Filter in store
  const [searchQuery, setSearchQuery] = useState('');

  // Product Viewer 3-Images Slider Ref
  const productSliderTrackRef = useRef<HTMLDivElement>(null);

  // Empty store fallback banners from admin
  const [emptyStoreBanners, setEmptyStoreBanners] = useState<EmptyStoreBannerSlot[]>([]);
  const [activeBannerIdx, setActiveBannerIdx] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 992);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Favorites / Saved state
  const [isSaved, setIsSaved] = useState(false);

  // Product Viewer Popup Modal (3 images slider + details)
  const [activeViewerProduct, setActiveViewerProduct] = useState<ProductItem | null>(null);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);


  // Sheets & Modals
  const [showAddressSheet, setShowAddressSheet] = useState(false);
  const [showScheduleSheet, setShowScheduleSheet] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  // User Auth State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Reviews State
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [ratingVal, setRatingVal] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [replyingReviewId, setReplyingReviewId] = useState<string | null>(null);
  const [ownerReplyText, setOwnerReplyText] = useState('');
  const [ownerReplySubmitting, setOwnerReplySubmitting] = useState(false);

  // Track Current User
  useEffect(() => {
    try {
      const rawUser = localStorage.getItem('lb_current_user');
      if (rawUser) setCurrentUser(JSON.parse(rawUser));
    } catch {}

    const unsub = auth.onAuthStateChanged((u) => {
      if (u) {
        let existingUser: UserProfile | null = null;
        try {
          const rawUser = localStorage.getItem('lb_current_user');
          if (rawUser) existingUser = JSON.parse(rawUser);
        } catch {}

        const stdId = formatLBUserId(u.email || u.uid);
        const originalJoined = existingUser?.joinedDate || (u.metadata?.creationTime ? new Date(u.metadata.creationTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));

        const profile: UserProfile = {
          ...(existingUser || {}),
          id: existingUser?.id && String(existingUser.id).startsWith('LB') ? existingUser.id : stdId,
          uid: u.uid,
          name: existingUser?.name || u.displayName || 'Member User',
          email: u.email || existingUser?.email || '',
          photoURL: u.photoURL || existingUser?.photoURL || '',
          role: existingUser?.role || 'user',
          joinedDate: originalJoined
        };
        setCurrentUser(profile);
        try {
          localStorage.setItem('lb_current_user', JSON.stringify(profile));
        } catch {}
      }
    });
    return () => unsub();
  }, []);

  // Helper to validate whether a review is authentic & has a real reviewer name
  const isValidRealReview = (r: any): boolean => {
    if (!r) return false;
    const name = typeof r.userName === 'string' ? r.userName.trim() : '';
    const comment = typeof r.comment === 'string' ? r.comment.trim() : '';
    // Purge fake reviews: empty name, placeholder 'U', or missing comment
    if (!name || name === 'U' || name.toLowerCase() === 'user' || (name.toLowerCase() === 'verified user' && !r.userEmail)) {
      return false;
    }
    if (!comment) return false;
    return true;
  };

  // Real Calculated Rating from Actual Customer Reviews (Strictly valid reviews only)
  const realRatingData = useMemo(() => {
    const valids = (reviews || []).filter(isValidRealReview);
    if (valids.length === 0) {
      return {
        avgRating: 0,
        avgRatingStr: 'New',
        totalCount: 0,
        hasRatings: false
      };
    }
    const sum = valids.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
    const avg = sum / valids.length;
    return {
      avgRating: avg,
      avgRatingStr: avg.toFixed(1),
      totalCount: valids.length,
      hasRatings: true
    };
  }, [reviews]);

  // Check if logged-in user already has a review for this store (Strictly 1 review per account)
  const userExistingReview = useMemo(() => {
    if (!currentUser || !reviews || reviews.length === 0) return null;
    return reviews.find((r) =>
      isValidRealReview(r) && (
        (currentUser.email && r.userEmail && r.userEmail.toLowerCase() === currentUser.email.toLowerCase()) ||
        (currentUser.id && r.userId === currentUser.id)
      )
    ) || null;
  }, [currentUser, reviews]);

  // Load shop data directly from Cloud Firestore
  useEffect(() => {
    if (!shopId) return;

    // 1. Initial fallback to DEFAULT_LISTINGS in memory
    const foundShop = DEFAULT_LISTINGS.find((dl) => String(dl.id).trim().toLowerCase() === shopId.toLowerCase());
    if (foundShop) {
      setShop(foundShop);
      setLoading(false);
    }

    // 2. Fetch live listing from Firebase Firestore
    cloudSync.getListingById(shopId).then((cloudListing) => {
      if (cloudListing) {
        setShop(cloudListing);
      }
      setLoading(false);
    }).catch(() => {
      if (!foundShop) setLoading(false);
    });

    // 3. Load reviews directly from Cloud Firestore
    cloudSync.pullProductReviews(shopId).then((cloudRevs) => {
      if (Array.isArray(cloudRevs)) {
        const valids: ReviewItem[] = [];
        cloudRevs.forEach((r) => {
          if (isValidRealReview(r)) {
            valids.push(r);
          } else {
            // Automatically purge fake or nameless review document from Firestore
            if (r.id) {
              cloudSync.deleteProductReview(shopId, r.id);
            }
          }
        });
        setReviews(valids);
      }
    }).catch(() => {});

    // 4. Load bookmarks state from Cloud Firestore
    try {
      const rawUser = localStorage.getItem('lb_current_user');
      if (rawUser) {
        const u = JSON.parse(rawUser);
        if (u && (u.id || u.uid)) {
          cloudSync.pullUserSavedPlaces(u.id || u.uid).then((bmList) => {
            if (Array.isArray(bmList)) {
              setIsSaved(bmList.includes(shopId));
            }
          }).catch(() => {});
        }
      }
    } catch {}

    // 5. Load empty store banners from Cloud Firestore
    cloudSync.pullEmptyStoreBanners().then((cloudSlots) => {
      if (cloudSlots && cloudSlots.length > 0) {
        setEmptyStoreBanners(cloudSlots);
      }
    }).catch(() => {});
  }, [shopId]);

  // Gallery & Cover Image
  const gallery = useMemo(() => {
    if (!shop) return [];
    return [
      shop.image,
      ...(shop.gallery || []),
      ...(shop.images || [])
    ].filter((img): img is string => Boolean(img && img.trim()));
  }, [shop]);

  const coverImg = gallery[0] || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80';

  // Live Open / Closed computation
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayName = daysOfWeek[new Date().getDay()];
  const todaySchedule = shop?.dailySchedule?.[todayName];
  const isOpenToday = todaySchedule ? todaySchedule.isOpen : (shop?.openDays?.includes(todayName) ?? true);

  // Store Categories List
  const storeCategories: StoreCategoryItem[] = useMemo(() => {
    if (shop?.storeCategories && shop.storeCategories.length > 0) {
      return (shop.storeCategories as any[]).map((c: any) => {
        if (typeof c === 'string') {
          return { label: c, tag: String(c).toLowerCase().replace(/\s+/g, '-'), icon: resolveCatEmoji(c) };
        }
        return {
          label: c.label || '',
          tag: c.tag || String(c.label || '').toLowerCase().replace(/\s+/g, '-'),
          icon: c.icon || resolveCatEmoji(c.label)
        };
      });
    }

    const catLow = (shop?.category || '').toLowerCase();
    if (catLow.includes('grocery') || catLow.includes('kirana') || catLow.includes('supermarket')) {
      return DEFAULT_GROCERY_CATS;
    }

    return [
      { label: 'Popular', tag: 'popular', icon: '🔥' },
      { label: 'Special Deals', tag: 'deals', icon: '⭐' },
      { label: 'Best Sellers', tag: 'best-sellers', icon: '🏷️' },
      { label: 'All Items', tag: 'all-items', icon: '📦' }
    ];
  }, [shop]);

  // 16:9 Banner Carousel Images (Trust Badge Exclusive: Trust stores show custom banners; Free stores show Admin default banners)
  const bannersList = useMemo(() => {
    let customList: any[] = [];
    const hasTrust = isTrustBadgeActive(shop);

    if (hasTrust && Array.isArray(shop?.banners) && shop.banners.length > 0) {
      customList = shop.banners
        .map((b) => (typeof b === 'string' ? b.trim() : b))
        .filter(Boolean);
    } else {
      const activeSlots = emptyStoreBanners
        .filter((s) => Boolean(s.imageUrl && typeof s.imageUrl === 'string' && s.imageUrl.trim()))
        .map((s) => s.imageUrl.trim());
      if (activeSlots.length > 0) {
        customList = activeSlots;
      }
    }

    const defaultFallbacks = [
      {
        id: 'def-1',
        headline: 'Special Discount Offer',
        deal: 'Visit today for exclusive deals & big savings',
        tag: 'EXCLUSIVE OFFER',
        bgGradient: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
        icon: 'fa-bolt'
      },
      {
        id: 'def-2',
        headline: 'Verified Quality Products',
        deal: '100% Genuine & Trusted Local Merchant',
        tag: 'QUALITY ASSURED',
        bgGradient: 'linear-gradient(135deg, #065f46 0%, #059669 100%)',
        icon: 'fa-certificate'
      },
      {
        id: 'def-3',
        headline: 'Fast Home Delivery & Pickup',
        deal: 'Call or WhatsApp for quick order fulfillment',
        tag: 'INSTANT CONNECT',
        bgGradient: 'linear-gradient(135deg, #7c2d12 0%, #ea580c 100%)',
        icon: 'fa-truck-fast'
      }
    ];

    // Combine custom banners, and fill remaining slots up to 3 with default banners
    const combined = [...customList];
    for (const def of defaultFallbacks) {
      if (combined.length >= 3) break;
      combined.push(def);
    }

    return combined.slice(0, 3);
  }, [shop?.banners, emptyStoreBanners]);

  // Banner rotation interval (every 3.5s on mobile only)
  useEffect(() => {
    if (!isMobile || bannersList.length <= 1) return;
    const interval = setInterval(() => {
      setActiveBannerIdx((prev) => (prev + 1) % bannersList.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [isMobile, bannersList.length]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null || bannersList.length <= 1) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        setActiveBannerIdx((prev) => (prev + 1) % bannersList.length);
      } else {
        setActiveBannerIdx((prev) => (prev - 1 + bannersList.length) % bannersList.length);
      }
    }
    setTouchStartX(null);
  };

  // Combined Products Pool: Merchant custom products + Category demo products
  const allStoreProducts = useMemo(() => {
    const customProds = shop?.products || [];
    if (customProds.length > 0) {
      return customProds;
    }
    return DEMO_GROCERY_PRODUCTS;
  }, [shop?.products]);

  // Top Picks: Only products marked as isTop or isTopProduct (or first 4-6 featured products)
  const topProducts = useMemo(() => {
    const top = allStoreProducts.filter((p) => p.isTop || p.isTopProduct);
    if (top.length > 0) return top;
    return allStoreProducts.slice(0, 6);
  }, [allStoreProducts]);

  // Real-time Search suggestions matching products in this store
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return allStoreProducts.filter((p) => {
      const name = (p.name || '').toLowerCase();
      const cat = (p.storeCategory || p.category || '').toLowerCase();
      const details = (p.details || '').toLowerCase();
      return name.includes(q) || cat.includes(q) || details.includes(q);
    });
  }, [allStoreProducts, searchQuery]);

  // Scroll listener to update bottom navbar active state ('home' vs 'reviews')
  useEffect(() => {
    const handleScroll = () => {
      if (!reviewsSectionRef.current) return;
      const rect = reviewsSectionRef.current.getBoundingClientRect();
      if (rect.top <= 260) {
        setBottomTab('reviews');
      } else {
        setBottomTab('home');
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Open Product Viewer Modal with reset slide index
  const handleOpenProductViewer = (prod: ProductItem) => {
    setActiveViewerProduct(prod);
    setActiveSlideIndex(0);
  };



  // Toggle Favorite / Save
  const handleToggleSave = () => {
    setIsSaved((prev) => {
      const next = !prev;
      try {
        const rawUser = localStorage.getItem('lb_current_user');
        if (rawUser) {
          const u = JSON.parse(rawUser);
          if (u && (u.id || u.uid)) {
            cloudSync.pullUserSavedPlaces(u.id || u.uid).then((existing) => {
              const currentList = Array.isArray(existing) ? existing : [];
              const updated = next
                ? Array.from(new Set([...currentList, shopId]))
                : currentList.filter((id) => id !== shopId);
              cloudSync.saveUserSavedPlaces(u.id || u.uid, updated).catch(() => {});
            }).catch(() => {});
          }
        }
      } catch {}
      return next;
    });
  };

  // Open Review Modal (Auto sign-in with Google if not logged in)
  const handleOpenReviewModal = async () => {
    let user = currentUser;
    if (!user) {
      setGoogleLoading(true);
      try {
        const provider = new GoogleAuthProvider();
        const res = await signInWithPopup(auth, provider);
        const u = res.user;
        let existingUser: UserProfile | null = null;
        try {
          const rawUser = localStorage.getItem('lb_current_user');
          if (rawUser) existingUser = JSON.parse(rawUser);
        } catch {}

        const stdId = formatLBUserId(u.email || u.uid);
        const originalJoined = existingUser?.joinedDate || (u.metadata?.creationTime ? new Date(u.metadata.creationTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));

        const profile: UserProfile = {
          ...(existingUser || {}),
          id: existingUser?.id && String(existingUser.id).startsWith('LB') ? existingUser.id : stdId,
          uid: u.uid,
          name: existingUser?.name || u.displayName || 'Member User',
          email: u.email || existingUser?.email || '',
          photoURL: u.photoURL || existingUser?.photoURL || '',
          role: existingUser?.role || 'user',
          joinedDate: originalJoined
        };
        setCurrentUser(profile);
        try {
          localStorage.setItem('lb_current_user', JSON.stringify(profile));
        } catch {}
        await cloudSync.saveUser(profile);
        user = profile;
      } catch (err) {
        console.warn('Google sign-in cancelled or failed:', err);
        setGoogleLoading(false);
        return;
      } finally {
        setGoogleLoading(false);
      }
    }

    if (!user) return;

    // Check if this account already submitted a review
    const existing = reviews.find((r) =>
      (user?.email && r.userEmail && r.userEmail.toLowerCase() === user.email.toLowerCase()) ||
      (user?.id && r.userId === user.id)
    );

    if (existing) {
      // Pre-fill existing rating & comment for updating
      setRatingVal(existing.rating || 5);
      setReviewComment(existing.comment || '');
    } else {
      // Fresh review
      setRatingVal(5);
      setReviewComment('');
    }

    setShowReviewModal(true);
  };

  // Submit or Update Customer Review (Strictly 1 review per account)
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!reviewComment.trim()) return;

    setReviewSubmitting(true);

    const existing = reviews.find((r) =>
      (currentUser.email && r.userEmail && r.userEmail.toLowerCase() === currentUser.email.toLowerCase()) ||
      (currentUser.id && r.userId === currentUser.id)
    );

    let updatedList: ReviewItem[];

    if (existing) {
      // UPDATE EXISTING REVIEW (User cannot add a new separate rating, only update their existing one!)
      const updatedRev: ReviewItem = {
        ...existing,
        userName: currentUser.name || existing.userName,
        userAvatar: currentUser.photoURL || existing.userAvatar,
        userEmail: currentUser.email || existing.userEmail,
        rating: ratingVal,
        comment: reviewComment.trim(),
        timestamp: Date.now(),
        dateStr: `${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} (Updated)`
      };
      updatedList = reviews.map((r) => (r.id === existing.id ? updatedRev : r));
      await cloudSync.saveProductReview(shopId, updatedRev);
    } else {
      // FIRST TIME REVIEW FROM THIS ACCOUNT
      const newRev: ReviewItem = {
        id: `rev_${currentUser.id || Date.now()}`,
        userId: currentUser.id,
        userEmail: currentUser.email,
        userName: currentUser.name || 'Verified User',
        userAvatar: currentUser.photoURL,
        rating: ratingVal,
        comment: reviewComment.trim(),
        timestamp: Date.now(),
        dateStr: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      };
      updatedList = [newRev, ...reviews];
      await cloudSync.saveProductReview(shopId, newRev);
    }

    setReviews(updatedList);
    setReviewSubmitting(false);
    setShowReviewModal(false);
  };

  // Delete Review
  const handleDeleteUserReview = async (reviewId: string) => {
    if (!confirm('Are you sure you want to remove this review?')) return;
    const updated = reviews.filter((r) => r.id !== reviewId);
    setReviews(updated);
    await cloudSync.deleteProductReview(shopId, reviewId);
  };

  // Check if current user is owner of this shop
  const isStoreOwner = useMemo(() => {
    if (!currentUser || !shop) return false;
    if (currentUser.role === 'admin') return true;
    const shopOwnerId = shop.ownerId || shop.createdBy || (shop as any).userId;
    if (shopOwnerId && String(shopOwnerId) === String(currentUser.id)) return true;
    const shopOwnerEmail = shop.ownerEmail || (shop as any).email;
    if (shopOwnerEmail && currentUser.email && shopOwnerEmail.toLowerCase() === currentUser.email.toLowerCase()) return true;
    return false;
  }, [currentUser, shop]);

  // Official Store Owner Reply (Trust Badge Exclusive)
  const handleSaveOwnerReply = async (reviewId: string) => {
    if (!ownerReplyText.trim() || ownerReplySubmitting) return;
    setOwnerReplySubmitting(true);
    const targetRev = reviews.find((r) => r.id === reviewId);
    if (!targetRev) {
      setOwnerReplySubmitting(false);
      return;
    }
    const updatedRev: ReviewItem = {
      ...targetRev,
      ownerReply: {
        text: ownerReplyText.trim(),
        timestamp: Date.now(),
        dateStr: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      }
    };
    const updatedList = reviews.map((r) => (r.id === reviewId ? updatedRev : r));
    setReviews(updatedList);
    await cloudSync.saveProductReview(shopId, updatedRev);
    setReplyingReviewId(null);
    setOwnerReplyText('');
    setOwnerReplySubmitting(false);
  };

  const handleDeleteOwnerReply = async (reviewId: string) => {
    if (!confirm('Are you sure you want to delete this owner response?')) return;
    const targetRev = reviews.find((r) => r.id === reviewId);
    if (!targetRev) return;
    const { ownerReply, ...rest } = targetRev;
    const updatedRev: ReviewItem = { ...rest };
    const updatedList = reviews.map((r) => (r.id === reviewId ? updatedRev : r));
    setReviews(updatedList);
    await cloudSync.saveProductReview(shopId, updatedRev);
    await cloudSync.saveProductReview(shopId, updatedRev);
  };

  const handleCopyShareLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <div style={{ width: '46px', height: '46px', border: '4px solid #e2e8f0', borderTopColor: '#1a73e8', borderRadius: '50%', animation: 'lbSpin 0.75s linear infinite' }}></div>
        <div style={{ marginTop: '1.15rem', fontWeight: 700, color: '#0f172a', fontSize: '1.05rem' }}>Loading Store Details...</div>
        <div style={{ marginTop: '0.35rem', color: '#64748b', fontSize: '0.86rem' }}>Connecting to verified local records...</div>
        <style>{`@keyframes lbSpin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!shop) {
    return (
      <div style={{ minHeight: '100vh', padding: '3rem 1.5rem', textAlign: 'center', background: '#f8fafc' }}>
        <div style={{ maxWidth: '440px', margin: '3rem auto', background: '#fff', padding: '2.5rem', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
          <i className="fa-solid fa-store-slash" style={{ fontSize: '3rem', color: '#94a3b8', marginBottom: '1rem', display: 'block' }}></i>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>Listing Not Found</h2>
          <p style={{ color: '#64748b', fontSize: '0.92rem', marginBottom: '1.5rem' }}>The business you are looking for may have been updated or removed.</p>
          <button
            onClick={() => router.push('/')}
            style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0.75rem 1.75rem', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}
          >
            <i className="fa-solid fa-arrow-left"></i> Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="detail-body">
      {/* Sticky App Top Bar */}
      <header className="detail-top-nav">
        <div className="nav-content">
          <button
            type="button"
            className="btn-detail-back"
            id="btnListingDetailBack"
            onClick={() => router.back()}
            title="Back"
          >
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <h2 className="top-nav-title" id="topNavPlaceName">
            {shop.name}
          </h2>
          <div style={{ width: '36px', height: '36px' }}></div>
        </div>
      </header>

      {/* Main Container */}
      <main className="detail-main-layout">
        <div className="detail-container">
          <div className="detail-content-card">
            
            {/* Header Top Row: Left Details + Right Square Photo with Counter */}
            <div className="jd-app-header-top">
              <div className="jd-app-info-col">
                
                {/* 1. Listing Name at the Very Top with Trust Badge */}
                <div className="jd-app-title-line">
                  <span className="jd-app-thumb-icon">
                    <i className="fa-solid fa-thumbs-up"></i>
                  </span>
                  <h1 className="jd-app-title" id="detailPlaceName">
                    {shop.name}
                  </h1>
                  {isTrustBadgeActive(shop) && (
                    <span className="badge-gold-trust" title="LocalBazar Verified & Trusted Business (Gold Badge Active)">
                      <i className="fa-solid fa-shield-halved"></i> Trust
                    </span>
                  )}
                </div>

                {/* 2. Rating Line Under Name (Clicking slides smoothly to reviews) */}
                <div
                  className="jd-app-rating-line"
                  onClick={() => {
                    setBottomTab('reviews');
                    reviewsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  style={{ cursor: 'pointer' }}
                  title="Click to view customer ratings & reviews"
                >
                  <div
                    className="jd-app-score-pill"
                    id="detailScoreBadge"
                    style={!realRatingData.hasRatings ? { background: '#f1f5f9', color: '#64748b' } : undefined}
                  >
                    <span id="detailAvgRating">{realRatingData.hasRatings ? realRatingData.avgRatingStr : 'New'}</span>
                    <i className={realRatingData.hasRatings ? 'fa-solid fa-star' : 'fa-regular fa-star'}></i>
                  </div>
                  <span className="jd-app-ratings-count" id="detailReviewsTotalText">
                    {realRatingData.hasRatings
                      ? `${realRatingData.totalCount} ${realRatingData.totalCount === 1 ? 'rating' : 'ratings'}`
                      : 'No ratings yet'}
                  </span>
                </div>

                {/* 3. City Under Rating + Arrow to Open Full Address Bottom Sheet */}
                <div className="jd-app-city-verified-row">
                  <span className="jd-app-locality-name" id="detailCityTag">
                    {shop.city}
                  </span>
                  <button
                    type="button"
                    className="btn-open-address-sheet"
                    id="btnTriggerAddressSheet"
                    onClick={() => setShowAddressSheet(true)}
                    title="View Full Address, Phone & Map"
                  >
                    <i className="fa-solid fa-chevron-down jd-address-arrow"></i>
                  </button>
                </div>

                {/* 4. Category Under City • Live Open/Closed Status + Arrow to Open Weekly Schedule & Holidays */}
                <div className="jd-app-meta-line">
                  <strong className="jd-meta-cat" id="detailCatPill">
                    {shop.category}
                  </strong>
                  <span className="jd-meta-dot">•</span>
                  <button
                    type="button"
                    className="btn-open-schedule-sheet"
                    id="btnTriggerScheduleSheet"
                    onClick={() => setShowScheduleSheet(true)}
                    title="View Weekly Schedule & Upcoming Holidays"
                  >
                    <span className="jd-live-status-span" style={{ color: isOpenToday ? '#16a34a' : '#dc2626' }}>
                      {isOpenToday ? 'Open Today' : 'Closed Today'}
                    </span>
                    <i className="fa-solid fa-chevron-down jd-schedule-arrow"></i>
                  </button>
                </div>
              </div>

              {/* Right: Square Thumbnail Photo Box with Counter */}
              <div
                className="jd-app-photo-square jd-app-thumb-box"
                onClick={() => setLightboxImg(coverImg)}
                style={{ cursor: 'pointer' }}
                title="Click to view photos"
              >
                <img src={coverImg} alt={shop.name} className="jd-app-thumb-img" />
                <span className="jd-photo-count-badge jd-photo-counter-overlay">
                  <i className="fa-solid fa-camera"></i> {gallery.length || 1}
                </span>
              </div>
            </div>

            {/* 5 Quick Interactive App Action Buttons */}
            <div className="jd-app-action-grid">
              {/* 1. Call */}
              <a
                href={shop.phone ? `tel:${shop.phone}` : '#'}
                className="jd-app-btn-box"
                title="Call Business Directly"
              >
                <div className="jd-app-icon-squircle bg-blue">
                  <i className="fa-solid fa-phone"></i>
                </div>
                <span className="jd-app-btn-lbl">Call</span>
              </a>

              {/* 2. WhatsApp */}
              <a
                href={shop.phone ? `https://wa.me/${shop.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hi, I found ${shop.name} on LocalBazar.`)}` : '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="jd-app-btn-box"
                title="Chat on WhatsApp"
              >
                <div className="jd-app-icon-squircle bg-green">
                  <i className="fa-brands fa-whatsapp"></i>
                </div>
                <span className="jd-app-btn-lbl">WhatsApp</span>
              </a>

              {/* 3. Direction */}
              <a
                href={shop.mapLink || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${shop.name} ${shop.address || ''} ${shop.city}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="jd-app-btn-box"
                title="Open Google Maps Directions"
              >
                <div className="jd-app-icon-squircle bg-white-border">
                  <i className="fa-solid fa-location-arrow"></i>
                </div>
                <span className="jd-app-btn-lbl">Direction</span>
              </a>

              {/* 4. Share */}
              <button
                type="button"
                className="jd-app-btn-box"
                onClick={() => setShowShareModal(true)}
                title="Share Business & Link"
              >
                <div className="jd-app-icon-squircle bg-share-purple">
                  <i className="fa-solid fa-share-nodes"></i>
                </div>
                <span className="jd-app-btn-lbl">Share</span>
              </button>

              {/* 5. Save */}
              <button
                type="button"
                className="jd-app-btn-box"
                onClick={handleToggleSave}
                title={isSaved ? 'Saved to Favorites' : 'Save this Store'}
              >
                <div className={`jd-app-icon-squircle bg-bookmark-gold ${isSaved ? 'active' : ''}`}>
                  <i className={`fa-${isSaved ? 'solid' : 'regular'} fa-bookmark`}></i>
                </div>
                <span className="jd-app-btn-lbl">{isSaved ? 'Saved' : 'Save'}</span>
              </button>
            </div>

            {/* Product Search Bar with Live Auto-Suggestions */}
            <div className="store-search-bar-wrap" style={{ position: 'relative' }}>
              <div className="store-search-pill">
                <i className="fa-solid fa-magnifying-glass search-leading-icon"></i>
                <input
                  type="text"
                  placeholder="Search in this store..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery.trim().length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0 6px' }}
                    title="Clear"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                )}
              </div>

              {/* Real-time Search Suggestions Dropdown */}
              {searchQuery.trim().length > 0 && (
                <div
                  className="store-search-suggestions"
                  style={{
                    display: 'block',
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: '#ffffff',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
                    border: '1px solid #e2e8f0',
                    marginTop: '6px',
                    zIndex: 50,
                    maxHeight: '260px',
                    overflowY: 'auto'
                  }}
                >
                  {searchResults.length === 0 ? (
                    <div style={{ padding: '0.85rem 1rem', color: '#64748b', fontSize: '0.84rem', textAlign: 'center' }}>
                      No products found matching &ldquo;<strong>{searchQuery}</strong>&rdquo;
                    </div>
                  ) : (
                    searchResults.map((prod, idx) => (
                      <div
                        key={prod.id || idx}
                        onClick={() => {
                          setSearchQuery('');
                          router.push(`/shops/${encodeURIComponent(shop.id)}/product/${encodeURIComponent(prod.id || prod.name)}`);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.65rem',
                          padding: '0.65rem 0.85rem',
                          borderBottom: '1px solid #f1f5f9',
                          cursor: 'pointer'
                        }}
                      >
                        <img
                          src={prod.images?.[0] || prod.image || coverImg}
                          alt={prod.name}
                          style={{ width: '36px', height: '36px', borderRadius: '6px', objectFit: 'cover' }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {prod.name}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: '#16a34a', fontWeight: 800 }}>
                            {prod.price || '₹999'}
                          </div>
                        </div>
                        <i className="fa-solid fa-chevron-right" style={{ color: '#94a3b8', fontSize: '0.7rem' }}></i>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Horizontal Sliding Store Categories Bar (Clicking opens dedicated category catalog page) */}
            <div className="store-cats-slide-wrap">
              <div className="store-cats-track">
                {storeCategories.map((cat, idx) => {
                  return (
                    <button
                      key={cat.tag || idx}
                      type="button"
                      className="store-cat-item"
                      onClick={() => {
                        router.push(`/shops/${encodeURIComponent(shop.id)}/catalog?cat=${encodeURIComponent(cat.tag)}`);
                      }}
                      title={`Browse ${cat.label} in ${shop.name}`}
                    >
                      <div className="store-cat-icon-circle">
                        <span className="cat-emoji">{cat.icon || resolveCatEmoji(cat.label)}</span>
                      </div>
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 16:9 Banner Carousel */}
            <div
              className="store-ads-carousel-wrap"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              <div
                className="store-ads-slider"
                style={
                  isMobile
                    ? {
                        display: 'flex',
                        width: '100%',
                        transform: `translateX(-${activeBannerIdx * 100}%)`,
                        transition: 'transform 0.45s cubic-bezier(0.25, 1, 0.5, 1)',
                        overflow: 'visible',
                      }
                    : {
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '1.15rem',
                        width: '100%',
                        transform: 'none',
                        overflow: 'visible',
                      }
                }
              >
                {bannersList.map((banner: any, idx: number) => {
                  const imgSrc = typeof banner === 'string'
                    ? banner.trim()
                    : (banner?.imageUrl || banner?.url || banner?.image || banner?.src || '');
                  const isImg = Boolean(imgSrc);

                  if (isImg) {
                    return (
                      <div
                        key={idx}
                        className="store-ad-card is-custom-img"
                        style={
                          isMobile
                            ? {
                                minWidth: '100%',
                                maxWidth: '100%',
                                width: '100%',
                                flex: '0 0 100%',
                                aspectRatio: '16 / 9',
                                boxSizing: 'border-box',
                              }
                            : {
                                minWidth: 0,
                                maxWidth: '100%',
                                width: '100%',
                                aspectRatio: '16 / 9',
                                boxSizing: 'border-box',
                              }
                        }
                      >
                        <img
                          src={imgSrc}
                          alt={banner?.title || banner?.headline || `Promotion ${idx + 1}`}
                          className="store-ad-custom-img"
                          onError={(e) => {
                            const target = e.currentTarget;
                            target.onerror = null;
                            target.src = 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&auto=format&fit=crop&q=80';
                          }}
                        />
                      </div>
                    );
                  }

                  return (
                    <div
                      key={idx}
                      className="store-ad-card festive-ad-1"
                      style={{
                        background: banner.bgGradient || 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
                        ...(isMobile
                          ? { minWidth: '100%', maxWidth: '100%', width: '100%', flex: '0 0 100%', aspectRatio: '16 / 9', boxSizing: 'border-box' }
                          : { minWidth: 0, maxWidth: '100%', width: '100%', aspectRatio: '16 / 9', boxSizing: 'border-box' })
                      }}
                    >
                      <div className="store-ad-badge">
                        <i className={`fa-solid ${banner.icon || 'fa-bolt'}`}></i> {banner.tag || 'SPECIAL OFFER'}
                      </div>
                      <div className="store-ad-content">
                        <span className="store-ad-sub">Verified Business Offer</span>
                        <h3 className="store-ad-heading">{banner.headline || banner.title || 'Exclusive Discount'}</h3>
                        <p className="store-ad-deal">{banner.deal || banner.subtitle || 'Visit or contact today for best prices'}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {bannersList.length > 1 && (
                <div className="store-ads-dots">
                  {bannersList.map((_, i) => (
                    <span
                      key={i}
                      className={`ad-dot ${i === activeBannerIdx ? 'active' : ''}`}
                      onClick={() => setActiveBannerIdx(i)}
                      style={{ cursor: 'pointer' }}
                      title={`Slide ${i + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Featured Top Picks Shelf (Strictly Top Picks, NO "View all" link) */}
            <div className="store-featured-shelf">
              <div className="store-shelf-header">
                <div className="shelf-header-left">
                  <span className="shelf-header-badge" style={{ background: '#fef3c7', color: '#d97706' }}>
                    <i className="fa-solid fa-star"></i>
                  </span>
                  <h4 className="shelf-header-title">Featured Top Picks</h4>
                  <span className="shelf-header-count">{topProducts.length} items</span>
                </div>
                {/* No View All link as explicitly instructed */}
              </div>

              <div className="shelf-products-slider">
                {topProducts.map((prod, idx) => {
                  const prodImages = Array.isArray(prod.images) && prod.images.length > 0
                    ? prod.images
                    : [prod.image || coverImg];
                  return (
                    <div
                      key={prod.id || idx}
                      className="shelf-prod-card"
                      onClick={() => {
                        router.push(`/shops/${encodeURIComponent(shop.id)}/product/${encodeURIComponent(prod.id || prod.name)}`);
                      }}
                      title="Click to view product details & photos"
                    >
                      <div className="shelf-prod-thumb-box" style={{ position: 'relative' }}>
                        <img
                          src={prodImages[0]}
                          alt={prod.name}
                          className="shelf-prod-thumb"
                        />
                        {prodImages.length > 1 && (
                          <span style={{ position: 'absolute', bottom: '4px', right: '4px', background: 'rgba(15,23,42,0.75)', color: '#fff', fontSize: '0.62rem', fontWeight: 800, padding: '1px 5px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <i className="fa-solid fa-camera"></i> {prodImages.length}
                          </span>
                        )}
                      </div>
                      <div className="shelf-prod-meta">
                        <span className="shelf-prod-name">{prod.name}</span>
                        <span className="shelf-prod-price">{prod.price || '₹999'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* About / Store Description if present */}
            {shop.desc && (
              <div style={{ marginTop: '0.85rem', padding: '0.9rem', background: '#f8fafc', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                <h5 style={{ fontSize: '0.86rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem' }}>
                  <i className="fa-solid fa-circle-info" style={{ color: '#2563eb', marginRight: '5px' }}></i> About {shop.name}
                </h5>
                <p style={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.5, margin: 0 }}>
                  {shop.desc}
                </p>
              </div>
            )}

            {/* Customer Ratings & Reviews Section (Directly on the page) */}
            <div
              ref={reviewsSectionRef}
              id="listingReviewsSection"
              style={{
                marginTop: '1.25rem',
                padding: '1.15rem',
                background: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                scrollMarginTop: '65px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="fa-solid fa-star" style={{ color: '#f59e0b' }}></i> Customer Ratings & Reviews
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    {realRatingData.hasRatings ? (
                      <>Overall Rating: <strong style={{ color: '#0f172a' }}>{realRatingData.avgRatingStr} ★</strong> ({realRatingData.totalCount} {realRatingData.totalCount === 1 ? 'review' : 'reviews'} total)</>
                    ) : (
                      <>No customer ratings yet (0 reviews)</>
                    )}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleOpenReviewModal}
                  disabled={googleLoading}
                  style={{
                    background: userExistingReview ? '#059669' : '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.5rem 1.05rem',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.08)'
                  }}
                >
                  <i className={`fa-solid ${userExistingReview ? 'fa-pen-to-square' : 'fa-pen'}`}></i>
                  <span>{googleLoading ? 'Connecting...' : userExistingReview ? 'Update Your Review' : 'Write Review'}</span>
                </button>
              </div>

              {(() => {
                const validList = (reviews || []).filter(isValidRealReview);
                if (validList.length === 0) {
                  return (
                    <div style={{ padding: '2rem 1rem', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                      <i className="fa-regular fa-star" style={{ fontSize: '2.2rem', color: '#cbd5e1', marginBottom: '0.5rem', display: 'block' }}></i>
                      <h4 style={{ fontWeight: 800, color: '#0f172a', marginBottom: '0.25rem', fontSize: '0.92rem' }}>No customer reviews yet for {shop.name}</h4>
                      <p style={{ color: '#64748b', fontSize: '0.82rem', marginBottom: '0.85rem' }}>Be the first customer to rate and share your experience!</p>
                      <button
                        type="button"
                        onClick={handleOpenReviewModal}
                        disabled={googleLoading}
                        style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0.5rem 1.15rem', borderRadius: '8px', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}
                      >
                        <i className="fa-solid fa-pen"></i> {googleLoading ? 'Connecting...' : 'Add First Review'}
                      </button>
                    </div>
                  );
                }

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {validList.map((rev) => {
                      const isOwnReview = currentUser && (
                        (currentUser.email && rev.userEmail && rev.userEmail.toLowerCase() === currentUser.email.toLowerCase()) ||
                        (currentUser.id && rev.userId === currentUser.id)
                      );
                      const canDelete = isOwnReview || currentUser?.role === 'admin' || !rev.userEmail;

                      return (
                        <div
                          key={rev.id}
                          style={{
                            background: '#f8fafc',
                            padding: '0.85rem 1rem',
                            borderRadius: '12px',
                            border: isOwnReview ? '1.5px solid #93c5fd' : '1px solid #f1f5f9'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {rev.userAvatar ? (
                                <img
                                  src={rev.userAvatar}
                                  alt={rev.userName}
                                  style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
                                />
                              ) : (
                                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#2563eb', color: '#fff', fontSize: '0.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {(rev.userName || 'U')[0].toUpperCase()}
                                </div>
                              )}
                              <div>
                                <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.88rem' }}>{rev.userName}</span>
                                {isOwnReview && (
                                  <span style={{ marginLeft: 6, fontSize: '0.68rem', background: '#eff6ff', color: '#2563eb', padding: '1px 6px', borderRadius: 4, fontWeight: 800 }}>
                                    You
                                  </span>
                                )}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>{rev.dateStr}</span>
                              {isOwnReview && (
                                <button
                                  type="button"
                                  onClick={handleOpenReviewModal}
                                  style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 700 }}
                                  title="Edit your review"
                                >
                                  <i className="fa-solid fa-pen"></i> Edit
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUserReview(rev.id)}
                                  style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 700 }}
                                  title="Delete review"
                                >
                                  <i className="fa-solid fa-trash-can"></i>
                                </button>
                              )}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '2px', color: '#f59e0b', fontSize: '0.78rem', marginBottom: '0.4rem' }}>
                            {[1, 2, 3, 4, 5].map((s) => (
                              <i key={s} className={`fa-star ${s <= rev.rating ? 'fa-solid' : 'fa-regular'}`}></i>
                            ))}
                          </div>
                          <p style={{ margin: 0, fontSize: '0.84rem', color: '#334155', lineHeight: 1.5 }}>{rev.comment}</p>

                          {/* Official Owner Reply (if exists) */}
                          {rev.ownerReply && (
                            <div
                              style={{
                                marginTop: '0.65rem',
                                padding: '0.65rem 0.85rem',
                                background: '#f0fdf4',
                                borderLeft: '3.5px solid #16a34a',
                                borderRadius: '8px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#16a34a', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                  <i className="fa-solid fa-shield-halved" style={{ color: '#f59e0b' }}></i>
                                  <span>Official Response from Store Owner</span>
                                </span>
                                {rev.ownerReply.dateStr && (
                                  <span style={{ fontSize: '0.70rem', color: '#86efac' }}>{rev.ownerReply.dateStr}</span>
                                )}
                              </div>
                              <p style={{ margin: 0, fontSize: '0.84rem', color: '#14532d', lineHeight: 1.45 }}>
                                {rev.ownerReply.text}
                              </p>
                              {isStoreOwner && (
                                <div style={{ display: 'flex', gap: '10px', marginTop: '3px' }}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setReplyingReviewId(rev.id);
                                      setOwnerReplyText(rev.ownerReply?.text || '');
                                    }}
                                    style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.74rem', cursor: 'pointer', fontWeight: 700, padding: 0 }}
                                  >
                                    <i className="fa-solid fa-pen"></i> Edit Reply
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteOwnerReply(rev.id)}
                                    style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.74rem', cursor: 'pointer', fontWeight: 700, padding: 0 }}
                                  >
                                    <i className="fa-solid fa-trash-can"></i> Delete Reply
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {/* If no reply yet and user is Store Owner */}
                          {!rev.ownerReply && isStoreOwner && replyingReviewId !== rev.id && (
                            <div style={{ marginTop: '0.55rem' }}>
                              {isTrustBadgeActive(shop) ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReplyingReviewId(rev.id);
                                    setOwnerReplyText('');
                                  }}
                                  style={{
                                    background: '#eff6ff',
                                    color: '#2563eb',
                                    border: '1px solid #bfdbfe',
                                    padding: '0.35rem 0.75rem',
                                    borderRadius: '6px',
                                    fontSize: '0.76rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px'
                                  }}
                                >
                                  <i className="fa-solid fa-reply"></i>
                                  <span>Reply as Store Owner</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => alert('Official store owner replies to customer reviews require a verified Trust Badge. Please upgrade your store to Trust Badge to unlock this feature!')}
                                  style={{
                                    background: '#fffbeb',
                                    color: '#b45309',
                                    border: '1px solid #fde68a',
                                    padding: '0.35rem 0.75rem',
                                    borderRadius: '6px',
                                    fontSize: '0.76rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px'
                                  }}
                                  title="Upgrade to Trust Badge to reply to customer reviews"
                                >
                                  <i className="fa-solid fa-lock" style={{ color: '#d97706' }}></i>
                                  <span>Reply as Store Owner (Trust Badge Required)</span>
                                </button>
                              )}
                            </div>
                          )}

                          {/* Inline Reply Input Box for Store Owner */}
                          {replyingReviewId === rev.id && (
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                handleSaveOwnerReply(rev.id);
                              }}
                              style={{ marginTop: '0.65rem', display: 'flex', gap: '6px', flexWrap: 'wrap' }}
                            >
                              <input
                                type="text"
                                placeholder={`Write official response from ${shop.name}...`}
                                value={ownerReplyText}
                                onChange={(e) => setOwnerReplyText(e.target.value)}
                                style={{
                                  flex: 1,
                                  minWidth: '200px',
                                  padding: '0.5rem 0.85rem',
                                  fontSize: '0.84rem',
                                  border: '1.5px solid #2563eb',
                                  borderRadius: '8px',
                                  outline: 'none'
                                }}
                                autoFocus
                              />
                              <button
                                type="submit"
                                disabled={ownerReplySubmitting || !ownerReplyText.trim()}
                                style={{
                                  background: ownerReplyText.trim() ? '#16a34a' : '#94a3b8',
                                  color: '#ffffff',
                                  border: 'none',
                                  padding: '0.5rem 0.95rem',
                                  borderRadius: '8px',
                                  fontWeight: 700,
                                  fontSize: '0.8rem',
                                  cursor: ownerReplyText.trim() ? 'pointer' : 'not-allowed',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px'
                                }}
                              >
                                {ownerReplySubmitting ? <i className="fa-solid fa-spinner fa-spin"></i> : <><i className="fa-solid fa-paper-plane"></i> Post Reply</>}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setReplyingReviewId(null);
                                  setOwnerReplyText('');
                                }}
                                style={{
                                  background: '#f1f5f9',
                                  color: '#64748b',
                                  border: 'none',
                                  padding: '0.5rem 0.75rem',
                                  borderRadius: '8px',
                                  fontWeight: 700,
                                  fontSize: '0.8rem',
                                  cursor: 'pointer'
                                }}
                              >
                                Cancel
                              </button>
                            </form>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

          </div>
        </div>
      </main>

      {/* Listing Bottom Navigation Bar (Strictly Home & Reviews, with smooth scroll) */}
      <nav className="app-bottom-navbar" id="listingBottomNavbar">
        {/* 1. Store Home (Scrolls to top) */}
        <button
          type="button"
          className={`app-nav-tab ${bottomTab === 'home' ? 'active' : ''}`}
          id="tabListingHome"
          onClick={() => {
            setBottomTab('home');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          title="Store Overview"
        >
          <i className="fa-solid fa-store"></i>
          <span>Home</span>
        </button>

        {/* 2. Reviews Tab (Scrolls down to reviews section) */}
        <button
          type="button"
          className={`app-nav-tab ${bottomTab === 'reviews' ? 'active' : ''}`}
          id="tabListingReviews"
          onClick={() => {
            setBottomTab('reviews');
            reviewsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
          title="Ratings & Customer Reviews"
        >
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fa-solid fa-star"></i>
            <span className="app-tab-badge" id="tabReviewCountBadge">
              {realRatingData.totalCount}
            </span>
          </div>
          <span>Reviews</span>
        </button>
      </nav>

      {/* ========================================================
          PRODUCT DETAIL VIEWER POPUP MODAL (3 images slider + dots)
         ======================================================== */}
      {activeViewerProduct && (
        <div
          className="detail-product-modal-backdrop"
          style={{ display: 'flex' }}
          id="detailProductModalBackdrop"
          onClick={() => setActiveViewerProduct(null)}
        >
          <div
            className="detail-product-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="detail-product-modal-header">
              <span className="detail-modal-cat-badge">
                <i className="fa-solid fa-tag" style={{ marginRight: '5px' }}></i>
                {activeViewerProduct.category || activeViewerProduct.storeCategory || 'Product'}
              </span>
              <button
                type="button"
                className="btn-close-dpm"
                onClick={() => setActiveViewerProduct(null)}
                title="Close"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Modal Body */}
            <div className="detail-product-modal-body">
              {/* Left Column: Product 3-Images Horizontal Slider */}
              {(() => {
                const images = Array.isArray(activeViewerProduct.images) && activeViewerProduct.images.length > 0
                  ? activeViewerProduct.images.slice(0, 3)
                  : (activeViewerProduct.image ? [activeViewerProduct.image] : [coverImg]);

                return (
                  <div className="dpm-slider-wrap">
                    <div
                      className="dpm-slider-track"
                      ref={productSliderTrackRef}
                      onScroll={(e) => {
                        const target = e.currentTarget;
                        const idx = Math.round(target.scrollLeft / (target.offsetWidth || 1));
                        setActiveSlideIndex(idx);
                      }}
                    >
                      {images.map((src, i) => (
                        <img
                          key={i}
                          src={src}
                          alt={`${activeViewerProduct.name} - ${i + 1}`}
                          className="dpm-slide-img"
                          onClick={() => setLightboxImg(src)}
                          style={{ cursor: 'zoom-in' }}
                        />
                      ))}
                    </div>

                    {/* 3 Dots Indicator */}
                    {images.length > 1 && (
                      <div className="dpm-slider-dots">
                        {images.map((_, i) => (
                          <span
                            key={i}
                            className={`dot ${i === activeSlideIndex ? 'active' : ''}`}
                            onClick={() => {
                              setActiveSlideIndex(i);
                              if (productSliderTrackRef.current) {
                                productSliderTrackRef.current.scrollTo({
                                  left: i * productSliderTrackRef.current.offsetWidth,
                                  behavior: 'smooth'
                                });
                              }
                            }}
                            style={{ cursor: 'pointer' }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Right Column: Product Metadata (Properly contained in .dpm-meta) */}
              <div className="dpm-meta">
                <div className="dpm-price-row">
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <span className="dpm-price">
                      {activeViewerProduct.price || '₹999'}
                    </span>
                    {(() => {
                      const numP = parseFloat(String(activeViewerProduct.price || '').replace(/[^0-9.]/g, ''));
                      if (!isNaN(numP) && numP > 0) {
                        const mrp = Math.round(numP * 1.25);
                        return (
                          <>
                            <del style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>₹{mrp}</del>
                            <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 800 }}>20% OFF</span>
                          </>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  <span className={`dpm-stock-pill ${activeViewerProduct.stockStatus === 'out_of_stock' ? 'out' : 'in'}`}>
                    <i className={`fa-solid ${activeViewerProduct.stockStatus === 'out_of_stock' ? 'fa-circle-xmark' : 'fa-circle-check'}`} style={{ marginRight: '4px' }}></i>
                    {activeViewerProduct.stockStatus === 'out_of_stock' ? 'Out of Stock' : 'In Stock'}
                  </span>
                </div>

                <h3 className="dpm-title">
                  {activeViewerProduct.name}
                </h3>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.65rem', fontSize: '0.8rem', color: '#64748b' }}>
                  <i className="fa-solid fa-store" style={{ color: '#2563eb' }}></i>
                  <span>Store: <strong>{shop.name}</strong></span>
                </div>

                <div style={{ background: '#f8fafc', padding: '0.75rem 0.85rem', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '0.25rem' }}>
                    Product Details & Description
                  </span>
                  <p className="dpm-desc">
                    {activeViewerProduct.details || activeViewerProduct.desc || activeViewerProduct.description || 'Contact the merchant directly for orders, home delivery, custom sizes, or inquiries.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Action Buttons Footer */}
            <div className="detail-product-modal-footer">
              {shop.phone && (
                <a
                  href={`tel:${shop.phone}`}
                  className="btn-dpm-action call"
                  style={{ textDecoration: 'none' }}
                  title="Call Store Directly"
                >
                  <i className="fa-solid fa-phone"></i> Call Store
                </a>
              )}

              {shop.phone && (
                <a
                  href={`https://wa.me/${(shop.whatsapp || shop.phone || '').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hi, I am interested in purchasing "${activeViewerProduct.name}" (${activeViewerProduct.price || ''}) from ${shop.name} on LocalBazar. Is this in stock?`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-dpm-action whatsapp"
                  style={{ textDecoration: 'none' }}
                  title="Buy on WhatsApp"
                >
                  <i className="fa-brands fa-whatsapp"></i> Buy on WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          FULL ADDRESS & CONTACT 70% BOTTOM SLIDE SHEET
         ======================================================== */}
      {showAddressSheet && (
        <div
          className="address-bottom-sheet-backdrop open"
          id="addressSheetBackdrop"
          onClick={() => setShowAddressSheet(false)}
        >
          <div
            className="address-bottom-sheet-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sheet-pull-bar">
              <span className="sheet-pull-handle"></span>
            </div>

            {/* Sheet Header */}
            <div className="schedule-sheet-header">
              <div className="sheet-title-meta">
                <div className="sheet-icon-circle blue-tint">
                  <i className="fa-solid fa-map-location-dot"></i>
                </div>
                <div>
                  <h3 className="sheet-main-title">Full Address & Contact</h3>
                  <p className="sheet-sub-title">{shop.name}</p>
                </div>
              </div>
              <button
                type="button"
                className="btn-close-sheet"
                onClick={() => setShowAddressSheet(false)}
                title="Close"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Sheet Scroll Body */}
            <div className="schedule-sheet-body" style={{ padding: '1rem 1.25rem', overflowY: 'auto' }}>
              {/* Location Card */}
              <div className="addr-sheet-card" style={{ marginBottom: '0.85rem' }}>
                <div className="addr-sheet-card-header" style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <span className="addr-sheet-icon" style={{ fontSize: '1.25rem', color: '#2563eb', marginTop: '2px' }}>
                    <i className="fa-solid fa-location-dot"></i>
                  </span>
                  <div className="addr-sheet-info-col" style={{ flex: 1 }}>
                    <span className="addr-sheet-label" style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                      Street Address & City
                    </span>
                    <p className="addr-sheet-val" style={{ margin: '0.2rem 0 0 0', color: '#0f172a', fontWeight: 600, fontSize: '0.92rem', lineHeight: 1.5 }}>
                      {shop.address || `${shop.name}, ${shop.city}`}
                    </p>
                  </div>
                </div>
                <a
                  href={shop.mapLink || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${shop.name} ${shop.address || ''} ${shop.city}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-sheet-direction"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    background: '#eff6ff',
                    color: '#2563eb',
                    padding: '0.65rem',
                    borderRadius: '10px',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    textDecoration: 'none'
                  }}
                >
                  <i className="fa-solid fa-diamond-turn-right"></i>
                  <span>Get Directions on Google Maps</span>
                </a>
              </div>

              {/* Contact & Phone Card */}
              <div className="addr-sheet-card" style={{ marginBottom: '0.85rem' }}>
                <div className="addr-sheet-card-header" style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <span className="addr-sheet-icon green" style={{ fontSize: '1.25rem', color: '#16a34a', marginTop: '2px' }}>
                    <i className="fa-solid fa-phone-volume"></i>
                  </span>
                  <div className="addr-sheet-info-col" style={{ flex: 1 }}>
                    <span className="addr-sheet-label" style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                      Primary Phone & Helpline
                    </span>
                    <p className="addr-sheet-val" style={{ margin: '0.2rem 0 0 0', color: '#0f172a', fontWeight: 700, fontSize: '1.05rem' }}>
                      {shop.phone || 'Contact not provided'}
                    </p>
                  </div>
                </div>
                {shop.phone && (
                  <div className="addr-sheet-action-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                    <a
                      href={`tel:${shop.phone}`}
                      className="btn-sheet-action call"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                        background: '#2563eb',
                        color: '#fff',
                        padding: '0.6rem',
                        borderRadius: '10px',
                        fontWeight: 700,
                        fontSize: '0.84rem',
                        textDecoration: 'none'
                      }}
                    >
                      <i className="fa-solid fa-phone"></i> Call Now
                    </a>
                    <a
                      href={`https://wa.me/${shop.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hi, I am contacting you regarding ${shop.name} on LocalBazar.`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-sheet-action wa"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                        background: '#16a34a',
                        color: '#fff',
                        padding: '0.6rem',
                        borderRadius: '10px',
                        fontWeight: 700,
                        fontSize: '0.84rem',
                        textDecoration: 'none'
                      }}
                    >
                      <i className="fa-brands fa-whatsapp"></i> WhatsApp
                    </a>
                  </div>
                )}
              </div>

              {/* Verified Local Listing Card */}
              <div
                className="addr-sheet-verified-card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  background: '#f8fafc',
                  padding: '0.85rem',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0'
                }}
              >
                <i className="fa-solid fa-shield-halved" style={{ color: '#16a34a', fontSize: '1.5rem' }}></i>
                <div>
                  <strong style={{ fontSize: '0.86rem', color: '#0f172a', display: 'block' }}>Verified Local Business</strong>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>Address & business details verified on Local-Bazar platform.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          FULL OPERATING SCHEDULE & SCHEDULED HOLIDAYS 70% SHEET
         ======================================================== */}
      {showScheduleSheet && (
        <div
          className="schedule-bottom-sheet-backdrop open"
          id="scheduleSheetBackdrop"
          onClick={() => setShowScheduleSheet(false)}
        >
          <div
            className="schedule-bottom-sheet-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sheet-pull-bar">
              <span className="sheet-pull-handle"></span>
            </div>

            {/* Sheet Header */}
            <div className="schedule-sheet-header">
              <div className="sheet-title-meta">
                <div className="sheet-icon-circle">
                  <i className="fa-solid fa-clock"></i>
                </div>
                <div>
                  <h3 className="sheet-main-title">Full Operating Schedule</h3>
                  <p className="sheet-sub-title">{shop.name}</p>
                </div>
              </div>
              <button
                type="button"
                className="btn-close-sheet"
                onClick={() => setShowScheduleSheet(false)}
                title="Close"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Sheet Scroll Body */}
            <div className="schedule-sheet-body" style={{ padding: '1rem 1.25rem', overflowY: 'auto' }}>
              {/* Weekly 7-Day Timings Table */}
              <div style={{ background: '#f8fafc', borderRadius: '16px', padding: '0.75rem 1rem', border: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
                <h5 style={{ fontSize: '0.84rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 0.5rem 0' }}>
                  <i className="fa-regular fa-calendar-days" style={{ color: '#2563eb', marginRight: '6px' }}></i> Weekly Hours
                </h5>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {daysOfWeek.map((day) => {
                    const isToday = day === todayName;
                    const sched = shop.dailySchedule?.[day];
                    const open = sched ? sched.isOpen : (shop.openDays?.includes(day) ?? true);
                    const timeStr = sched
                      ? `${sched.openTime} ${sched.openAmPm} - ${sched.closeTime} ${sched.closeAmPm}`
                      : (shop.scheduleTimings || '09:00 AM - 08:30 PM');

                    return (
                      <div
                        key={day}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.55rem 0.4rem',
                          borderBottom: '1px solid #edf2f7',
                          background: isToday ? '#eff6ff' : 'transparent',
                          borderRadius: isToday ? '8px' : '0'
                        }}
                      >
                        <span style={{ fontWeight: isToday ? 800 : 600, fontSize: '0.88rem', color: isToday ? '#1d4ed8' : '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {day} {isToday && <span style={{ background: '#2563eb', color: '#fff', fontSize: '0.62rem', padding: '1px 6px', borderRadius: '10px', fontWeight: 800 }}>TODAY</span>}
                        </span>
                        <span
                          style={{
                            color: open ? '#16a34a' : '#ef4444',
                            fontWeight: 700,
                            fontSize: '0.84rem',
                            background: open ? '#f0fdf4' : '#fef2f2',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            border: `1px solid ${open ? '#bbf7d0' : '#fecaca'}`
                          }}
                        >
                          {open ? timeStr : 'Closed'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Scheduled Holidays Section */}
              <div style={{ background: '#ffffff', borderRadius: '16px', padding: '0.9rem 1rem', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <h5 style={{ fontSize: '0.84rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
                    <i className="fa-solid fa-umbrella-beach" style={{ color: '#f59e0b', marginRight: '6px' }}></i> Scheduled Holidays & Off Days
                  </h5>
                  <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>
                    {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
                  </span>
                </div>

                {Array.isArray(shop.holidays) && shop.holidays.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                    {shop.holidays.map((hDate, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.5rem 0.75rem',
                          background: '#fef2f2',
                          borderRadius: '8px',
                          border: '1px solid #fee2e2'
                        }}
                      >
                        <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#991b1b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <i className="fa-solid fa-circle-xmark" style={{ color: '#ef4444' }}></i> {hDate}
                        </span>
                        <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: '12px' }}>
                          HOLIDAY
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: '0.85rem', background: '#f8fafc', borderRadius: '10px', textAlign: 'center', color: '#64748b', fontSize: '0.82rem' }}>
                    <i className="fa-regular fa-calendar-check" style={{ color: '#16a34a', marginRight: '5px' }}></i>
                    No special holidays scheduled for this month. Store follows standard weekly timings.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= OFFICIAL STORE QR & MULTI-PLATFORM SHARE MODAL ================= */}
      {showShareModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            backdropFilter: 'blur(4px)',
          }}
          onClick={() => setShowShareModal(false)}
        >
          <div
            className="qr-modal-card"
            style={{
              background: '#ffffff',
              borderRadius: '24px',
              maxWidth: '440px',
              width: '100%',
              maxHeight: '94vh',
              overflowY: 'auto',
              boxShadow: '0 25px 60px rgba(15, 23, 42, 0.35)',
              position: 'relative',
              boxSizing: 'border-box'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="m-submodal-header"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid #f1f5f9',
                padding: '1rem 1.25rem',
                position: 'sticky',
                top: 0,
                background: '#ffffff',
                zIndex: 2,
                borderRadius: '24px 24px 0 0'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <i className="fa-solid fa-qrcode" style={{ color: '#2563eb', fontSize: '1.2rem' }}></i>
                <strong style={{ fontSize: '1rem', color: '#0f172a' }}>Store QR & Share</strong>
              </div>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#64748b', lineHeight: 1 }}
              >
                &times;
              </button>
            </div>

            {/* Standee Body */}
            <div className="qr-modal-body" style={{ padding: '1rem 1.25rem' }}>
              <div className="qr-standee-card">
                <div className="standee-header">
                  <span className="standee-brand-pill">
                    <i className="fa-solid fa-store"></i> LOCAL BAZAR
                  </span>
                  <span className="standee-verified-badge">
                    <i className="fa-solid fa-circle-check"></i> {shop.status === 'Approved' ? 'Verified Business' : 'Verified Store'}
                  </span>
                </div>

                <div className="standee-store-info">
                  <img
                    src={shop.image || 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=140&auto=format&fit=crop&q=80'}
                    alt={shop.name}
                    className="standee-avatar"
                  />
                  <h3 className="standee-store-name">{shop.name}</h3>
                  <p className="standee-store-meta">
                    <i className="fa-solid fa-location-dot" style={{ color: '#ef4444' }}></i>
                    <span>{shop.category} • {shop.city}</span>
                  </p>
                </div>

                {/* QR Box with corner brackets */}
                <div className="standee-qr-frame">
                  <div className="qr-corner-bracket top-left"></div>
                  <div className="qr-corner-bracket top-right"></div>
                  <div className="qr-corner-bracket bottom-left"></div>
                  <div className="qr-corner-bracket bottom-right"></div>
                  <div className="standee-qr-box">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(
                        typeof window !== 'undefined' ? `${window.location.origin}/shops/${shop.id}` : ''
                      )}`}
                      alt={`${shop.name} QR Code`}
                    />
                  </div>
                </div>

                <div className="standee-footer">
                  <div className="standee-scan-prompt">
                    <i className="fa-solid fa-camera"></i>
                    <span>Scan with any Camera or UPI app to view store</span>
                  </div>

                  {/* Copy Link Row */}
                  <div className="standee-link-row">
                    <span className="standee-link-text">
                      {typeof window !== 'undefined' ? `${window.location.host}/shops/${shop.id}` : ''}
                    </span>
                    <button
                      type="button"
                      className={`standee-copy-btn ${shareCopied ? 'copied' : ''}`}
                      onClick={() => {
                        if (typeof window !== 'undefined') {
                          navigator.clipboard.writeText(`${window.location.origin}/shops/${shop.id}`);
                          setShareCopied(true);
                          setTimeout(() => setShareCopied(false), 2000);
                        }
                      }}
                    >
                      <i className={shareCopied ? 'fa-solid fa-check' : 'fa-regular fa-copy'}></i>
                      <span>{shareCopied ? 'Copied!' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Multi-Platform Social Share Grid */}
              <div style={{ marginTop: '1rem', paddingBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.65rem', textAlign: 'center' }}>
                  Share on Social Platforms
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.65rem' }}>
                  {/* 1. WhatsApp */}
                  <button
                    type="button"
                    onClick={() => {
                      const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/shops/${shop.id}` : '';
                      const text = `Check out *${shop.name}* (${shop.category}) in ${shop.city} on LocalBazar:\n${shareUrl}`;
                      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
                    }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0.7rem 0.35rem',
                      borderRadius: '12px',
                      background: '#ecfdf5',
                      border: '1px solid #a7f3d0',
                      color: '#059669',
                      cursor: 'pointer',
                      gap: '4px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <i className="fa-brands fa-whatsapp" style={{ fontSize: '1.4rem', color: '#16a34a' }}></i>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>WhatsApp</span>
                  </button>

                  {/* 2. Facebook */}
                  <button
                    type="button"
                    onClick={() => {
                      const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/shops/${shop.id}` : '';
                      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank');
                    }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0.7rem 0.35rem',
                      borderRadius: '12px',
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      color: '#1d4ed8',
                      cursor: 'pointer',
                      gap: '4px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <i className="fa-brands fa-facebook-f" style={{ fontSize: '1.4rem', color: '#1877f2' }}></i>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>Facebook</span>
                  </button>

                  {/* 3. Twitter / X */}
                  <button
                    type="button"
                    onClick={() => {
                      const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/shops/${shop.id}` : '';
                      const text = `Check out ${shop.name} on LocalBazar!`;
                      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`, '_blank');
                    }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0.7rem 0.35rem',
                      borderRadius: '12px',
                      background: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      color: '#0f172a',
                      cursor: 'pointer',
                      gap: '4px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <i className="fa-brands fa-x-twitter" style={{ fontSize: '1.4rem', color: '#0f172a' }}></i>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>Twitter/X</span>
                  </button>

                  {/* 4. More Share (Native Sheet) */}
                  <button
                    type="button"
                    onClick={() => {
                      const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/shops/${shop.id}` : '';
                      if (navigator.share) {
                        navigator.share({
                          title: shop.name,
                          text: `Check out ${shop.name} on LocalBazar:`,
                          url: shareUrl,
                        }).catch(() => {});
                      } else {
                        if (typeof window !== 'undefined') {
                          navigator.clipboard.writeText(shareUrl);
                          setShareCopied(true);
                          setTimeout(() => setShareCopied(false), 2000);
                        }
                      }
                    }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0.7rem 0.35rem',
                      borderRadius: '12px',
                      background: '#f1f5f9',
                      border: '1px solid #e2e8f0',
                      color: '#475569',
                      cursor: 'pointer',
                      gap: '4px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <i className="fa-solid fa-share-nodes" style={{ fontSize: '1.4rem', color: '#2563eb' }}></i>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>More...</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Write / Update Review Modal */}
      {showReviewModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(3px)' }}
          onClick={() => setShowReviewModal(false)}
        >
          <div style={{ background: '#fff', borderRadius: '20px', padding: '1.75rem', maxWidth: '440px', width: '100%', boxShadow: '0 20px 45px rgba(0,0,0,0.22)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.15rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                  {userExistingReview ? 'Update Your Review' : 'Write a Review'}
                </h3>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>{shop.name}</span>
              </div>
              <button
                onClick={() => setShowReviewModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#94a3b8', lineHeight: 1 }}
              >
                &times;
              </button>
            </div>

            {/* Signed-in Google User Profile Card (Name auto-fetched from Google account) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#f8fafc', padding: '0.75rem 0.85rem', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
              <img
                src={currentUser?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.name || 'User')}&background=1a73e8&color=fff&size=100&bold=true`}
                alt="Profile"
                referrerPolicy="no-referrer"
                style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #3b82f6' }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {currentUser?.name || 'Google Account User'}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {currentUser?.email || 'Signed in via Google'}
                </div>
              </div>
              <span style={{ fontSize: '0.68rem', background: '#dcfce7', color: '#166534', padding: '3px 8px', borderRadius: 999, fontWeight: 700 }}>
                Verified
              </span>
            </div>

            <form onSubmit={handleSubmitReview}>
              {/* Star Rating Picker */}
              <div style={{ marginBottom: '1.15rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>Your Rating *</label>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#f59e0b' }}>
                    {ratingVal === 5 ? '5 ★ Excellent' : ratingVal === 4 ? '4 ★ Very Good' : ratingVal === 3 ? '3 ★ Good' : ratingVal === 2 ? '2 ★ Fair' : '1 ★ Poor'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.6rem', fontSize: '1.75rem', color: '#f59e0b', cursor: 'pointer' }}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <i
                      key={s}
                      className={`fa-star ${s <= ratingVal ? 'fa-solid' : 'fa-regular'}`}
                      onClick={() => setRatingVal(s)}
                    ></i>
                  ))}
                </div>
              </div>

              {/* Feedback Textarea */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.4rem', color: '#334155' }}>Your Feedback *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Tell others about your experience, product quality, or customer service..."
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '0.88rem', boxSizing: 'border-box', outline: 'none', resize: 'vertical' }}
                />
              </div>

              {userExistingReview && (
                <div style={{ fontSize: '0.74rem', color: '#059669', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <i className="fa-solid fa-circle-info"></i>
                  <span>You have already reviewed this store. Saving will update your rating & feedback.</span>
                </div>
              )}

              <button
                type="submit"
                disabled={reviewSubmitting}
                style={{ width: '100%', padding: '0.8rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', boxShadow: '0 2px 8px rgba(37,99,235,0.25)' }}
              >
                {reviewSubmitting ? 'Saving...' : userExistingReview ? 'Update Review' : 'Publish Review'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxImg && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
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
    </div>
  );
}
