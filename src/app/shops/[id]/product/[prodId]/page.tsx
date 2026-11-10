'use client';

import React, { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Listing, ProductItem, ReviewItem, UserProfile, formatWhatsAppUrl, formatTelUrl } from '@/types';
import { cloudSync, auth, formatLBUserId } from '@/lib/firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import '@/styles/listing-detail.css';
import '@/styles/product-detail.css';

// Real product review helper
const isValidRealReview = (r: any): boolean => {
  if (!r) return false;
  const name = typeof r.userName === 'string' ? r.userName.trim() : '';
  const comment = typeof r.comment === 'string' ? r.comment.trim() : '';
  if (!name || name === 'U' || name.toLowerCase() === 'user' || (name.toLowerCase() === 'verified customer' && !r.userEmail)) return false;
  if (!comment) return false;
  return true;
};

function ProductDetailPageContent() {
  const params = useParams();
  const router = useRouter();

  const shopId = decodeURIComponent(String(params?.id || ''));
  const prodId = decodeURIComponent(String(params?.prodId || ''));

  const initialData = useMemo(() => {
    if (typeof window !== 'undefined' && shopId) {
      try {
        const raw = localStorage.getItem('lb_cached_listings');
        if (raw) {
          const list: Listing[] = JSON.parse(raw);
          const foundShop = list.find((l) => String(l.id).toLowerCase() === shopId.toLowerCase());
          if (foundShop) {
            const prods = (foundShop.products && foundShop.products.length > 0) ? foundShop.products : [];
            const target = prodId.toLowerCase();
            const foundProd = prods.find((p) => {
              const pId = String(p.id || '').toLowerCase();
              const pName = String(p.name || '').toLowerCase();
              return pId === target || pName === target || encodeURIComponent(pName) === target;
            }) || null;
            return { shop: foundShop, product: foundProd };
          }
        }
      } catch {}
    }
    return { shop: null, product: null };
  }, [shopId, prodId]);

  const [shop, setShop] = useState<Listing | null>(() => initialData.shop);
  const [product, setProduct] = useState<ProductItem | null>(() => initialData.product);
  const [loading, setLoading] = useState(!initialData.shop || !initialData.product);

  // Gallery slider state
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const sliderTrackRef = useRef<HTMLDivElement>(null);
  const reviewsSectionRef = useRef<HTMLDivElement>(null);

  // User state
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Reviews state
  const [reviewsList, setReviewsList] = useState<ReviewItem[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  // Check if current user already submitted a review for this product (Strictly 1 review per account)
  const userExistingReview = useMemo(() => {
    if (!currentUser || !reviewsList || reviewsList.length === 0) return null;
    return reviewsList.find((r) =>
      isValidRealReview(r) && (
        (currentUser.email && r.userEmail && r.userEmail.toLowerCase() === currentUser.email.toLowerCase()) ||
        (currentUser.id && r.userId === currentUser.id)
      )
    ) || null;
  }, [currentUser, reviewsList]);

  // Contact Auth Gate State
  const [showContactAuthModal, setShowContactAuthModal] = useState(false);
  const [pendingContactAction, setPendingContactAction] = useState<{ type: 'call' | 'whatsapp'; url: string } | null>(null);
  const [contactAuthLoading, setContactAuthLoading] = useState(false);

  // Native App-Like Back Navigation (PWA Android Hardware Back Button Support)
  const isAnyModalOpen = Boolean(lightboxImg || showReviewModal || showContactAuthModal);
  const isAnyModalOpenRef = useRef(false);
  isAnyModalOpenRef.current = isAnyModalOpen;
  const modalHistoryPushedRef = useRef(false);
  const isHardwareBackActionRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isAnyModalOpen) {
      if (!modalHistoryPushedRef.current) {
        window.history.pushState({ modalOpen: true }, '');
        modalHistoryPushedRef.current = true;
      }
    } else {
      if (modalHistoryPushedRef.current) {
        modalHistoryPushedRef.current = false;
        if (!isHardwareBackActionRef.current && window.history.state?.modalOpen) {
          window.history.back();
        }
      }
      isHardwareBackActionRef.current = false;
    }
  }, [isAnyModalOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onPopState = () => {
      if (isAnyModalOpenRef.current) {
        isHardwareBackActionRef.current = true;
        setLightboxImg(null);
        setShowReviewModal(false);
        setShowContactAuthModal(false);
        setPendingContactAction(null);
        modalHistoryPushedRef.current = false;
        return;
      }

      const isStandalone = (
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://')
      );

      if (isStandalone && window.history.length <= 2) {
        router.push(shop?.id ? `/shops/${shop.id}` : '/explore');
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, [router, shop]);

  const handleProductBack = () => {
    if (isAnyModalOpenRef.current) {
      setLightboxImg(null);
      setShowReviewModal(false);
      return;
    }

    // Clean up any lingering modal history state
    if (typeof window !== 'undefined' && window.history.state?.modalOpen) {
      modalHistoryPushedRef.current = false;
      try { window.history.back(); } catch {}
    }

    const targetShopUrl = shop?.id || shopId ? `/shops/${encodeURIComponent(shop?.id || shopId)}` : '/explore';

    // Attempt router.back() if internal referrer exists, with reliable instant fallback
    try {
      if (typeof window !== 'undefined' && document.referrer && document.referrer.includes(window.location.host)) {
        router.back();
        setTimeout(() => {
          if (typeof window !== 'undefined' && window.location.pathname.includes('/product/')) {
            router.push(targetShopUrl);
          }
        }, 250);
        return;
      }
    } catch {}

    router.push(targetShopUrl);
  };

  // Auth observer
  useEffect(() => {
    try {
      const cached = localStorage.getItem('lb_current_user');
      if (cached) setCurrentUser(JSON.parse(cached));
    } catch {}

    const unsub = auth.onAuthStateChanged((u) => {
      if (u) {
        let existingUser: UserProfile | null = null;
        try {
          const raw = localStorage.getItem('lb_current_user');
          if (raw) existingUser = JSON.parse(raw);
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
      } else {
        setCurrentUser(null);
      }
    });
    return () => unsub();
  }, []);


  // Load shop and product
  useEffect(() => {
    if (!shopId) return;

    function resolveData(allListings: Listing[]) {
      const foundShop = allListings.find(
        (l) => String(l.id).toLowerCase() === shopId.toLowerCase()
      );
      if (foundShop) {
        setShop(foundShop);

        // Find product (Zero demo data)
        const prods = (foundShop.products && foundShop.products.length > 0)
          ? foundShop.products
          : [];

        const foundProd = prods.find((p) => {
          const pId = String(p.id || '').toLowerCase();
          const pName = String(p.name || '').toLowerCase();
          const target = prodId.toLowerCase();
          return pId === target || pName === target || encodeURIComponent(pName) === target;
        }) || null;

        setProduct(foundProd);

        // Load reviews strictly for THIS specific product from Cloud Firestore (Zero mixing with other products or store)
        if (foundProd) {
          const targetProdKey = String(foundProd.id || prodId || '').trim();
          cloudSync.pullProductReviews(foundShop.id, targetProdKey).then((cloudRevs) => {
            if (Array.isArray(cloudRevs)) {
              setReviewsList(cloudRevs.filter(isValidRealReview));
            } else if (foundProd.reviews && foundProd.reviews.length > 0) {
              setReviewsList(foundProd.reviews.filter(isValidRealReview));
            } else {
              setReviewsList([]);
            }
          }).catch(() => {
            setReviewsList([]);
          });
        }
      }
      setLoading(false);
    }

    // Fetch live listing from Cloud Firestore (Zero demo data)
    if (!shop || !product) {
      setLoading(true);
    }
    cloudSync.getListingById(shopId).then((cloudItem) => {
      if (cloudItem) {
        resolveData([cloudItem]);
      } else {
        setLoading(false);
      }
    }).catch((err) => {
      console.error('Error fetching product shop:', err);
      setLoading(false);
    });
  }, [shopId, prodId]);

  // Scroll to reviews
  const handleScrollToReviews = () => {
    if (reviewsSectionRef.current) {
      reviewsSectionRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Contact Auth Flow: Lead generation & Phone Number gating
  const triggerContactAuth = (type: 'call' | 'whatsapp', targetUrl: string) => {
    if (currentUser) {
      if (type === 'call') {
        window.location.href = targetUrl;
      } else {
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
      }
      return;
    }

    setPendingContactAction({ type, url: targetUrl });
    setShowContactAuthModal(true);
  };

  const handleContactGoogleSignIn = async () => {
    setContactAuthLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, provider);
      const u = res.user;
      let existingUser: UserProfile | null = null;
      try {
        const raw = localStorage.getItem('lb_current_user');
        if (raw) existingUser = JSON.parse(raw);
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

      setShowContactAuthModal(false);

      if (pendingContactAction) {
        const action = pendingContactAction;
        setPendingContactAction(null);
        setTimeout(() => {
          if (action.type === 'call') {
            window.location.href = action.url;
          } else {
            window.open(action.url, '_blank', 'noopener,noreferrer');
          }
        }, 150);
      }
    } catch (err) {
      console.warn('Google sign-in cancelled or failed:', err);
    } finally {
      setContactAuthLoading(false);
    }
  };

  // Open Review Modal (Auto sign-in with Google if guest)
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
          const raw = localStorage.getItem('lb_current_user');
          if (raw) existingUser = JSON.parse(raw);
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

    // Pre-fill if review already exists
    const existing = reviewsList.find((r) =>
      (user?.email && r.userEmail && r.userEmail.toLowerCase() === user.email.toLowerCase()) ||
      (user?.id && r.userId === user.id)
    );

    if (existing) {
      setReviewRating(existing.rating || 5);
      setReviewComment(existing.comment || '');
    } else {
      setReviewRating(5);
      setReviewComment('');
    }

    setShowReviewModal(true);
  };

  // Submit or Update Product Review (Strictly 1 review per account for this specific product)
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !reviewComment.trim() || !product || !shop) return;

    setReviewSubmitting(true);

    const targetProdKey = String(product.id || prodId || '').trim();

    const existing = reviewsList.find((r) =>
      (currentUser.email && r.userEmail && r.userEmail.toLowerCase() === currentUser.email.toLowerCase()) ||
      (currentUser.id && r.userId === currentUser.id)
    );

    let updatedList: ReviewItem[];

    if (existing) {
      // Update existing review (Strictly 1 review per account for this specific product)
      const updatedRev: ReviewItem = {
        ...existing,
        type: 'product',
        productId: targetProdKey,
        productName: product.name,
        userName: currentUser.name || existing.userName,
        userAvatar: currentUser.photoURL || existing.userAvatar,
        userEmail: currentUser.email || existing.userEmail,
        rating: reviewRating,
        comment: reviewComment.trim(),
        timestamp: Date.now(),
        dateStr: `${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} (Updated)`
      };
      updatedList = reviewsList.map((r) => (r.id === existing.id ? updatedRev : r));
      cloudSync.saveProductReview(shop.id, targetProdKey, updatedRev);
    } else {
      // First review from this account for this product
      const newRev: ReviewItem = {
        id: `rev_prod_${targetProdKey}_${currentUser.id || Date.now()}`,
        type: 'product',
        productId: targetProdKey,
        productName: product.name,
        userId: currentUser.id,
        userEmail: currentUser.email,
        userName: currentUser.name || 'Verified Customer',
        userAvatar: currentUser.photoURL,
        rating: reviewRating,
        comment: reviewComment.trim(),
        timestamp: Date.now(),
        dateStr: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      };
      updatedList = [newRev, ...reviewsList];
      cloudSync.saveProductReview(shop.id, targetProdKey, newRev);
    }

    setReviewsList(updatedList);
    setReviewComment('');
    setReviewRating(5);
    setReviewSubmitting(false);
    setShowReviewModal(false);
  };

  // Delete product review
  const handleDeleteReview = (reviewId: string) => {
    if (!confirm('Are you sure you want to remove this review?')) return;
    const updated = reviewsList.filter((r) => r.id !== reviewId);
    setReviewsList(updated);
    if (shop && product) {
      cloudSync.deleteProductReview(shop.id, reviewId);
    }
  };

  // Share Product Link (With instant 1st image attachment in native share sheet)
  const handleShareProduct = async () => {
    if (!product || !shop) return;
    const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
    const priceText = product.price ? ` (${product.price.startsWith('₹') ? product.price : `₹${product.price}`})` : '';
    const title = `${product.name} - ${shop.name} | LocalBazar`;
    const text = `Check out "${product.name}"${priceText} at ${shop.name}, ${shop.city || ''} on LocalBazar!`;

    // 1. Resolve product's 1st image URL
    const rawImg =
      (product.images && product.images.length > 0 && product.images[0]) ||
      product.image ||
      product.img ||
      shop.image ||
      '';

    let fileToShare: File | null = null;

    // 2. Non-blocking image conversion (Fast 350ms abort timeout so share sheet pops up instantly)
    if (rawImg && typeof navigator !== 'undefined' && typeof (navigator as any).canShare === 'function') {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 350);

        const res = await fetch(rawImg, { signal: controller.signal, mode: 'cors' });
        clearTimeout(timeoutId);

        if (res.ok) {
          const blob = await res.blob();
          const cleanName = (product.name || 'product').toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30);
          const ext = blob.type.includes('png') ? 'png' : 'jpg';
          const file = new File([blob], `${cleanName}.${ext}`, { type: blob.type || 'image/jpeg' });

          if ((navigator as any).canShare({ files: [file] })) {
            fileToShare = file;
          }
        }
      } catch {
        fileToShare = null;
      }
    }

    // 3. Trigger native share sheet with image file if supported
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        if (fileToShare) {
          await navigator.share({
            files: [fileToShare],
            title,
            text: `${text}\n${shareUrl}`,
            url: shareUrl,
          });
          return;
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }

      // 4. Safe fallback: native text & URL share
      try {
        await navigator.share({
          title,
          text,
          url: shareUrl,
        });
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }

    // 5. Desktop fallback: Clipboard copy
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        alert('Product link copied to clipboard!');
      } catch {}
    }
  };



  // Computed average rating & breakdown
  const { avgRating, ratingCounts } = useMemo(() => {
    if (reviewsList.length === 0) {
      return { avgRating: 0, ratingCounts: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } };
    }
    const counts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let sum = 0;
    reviewsList.forEach((r) => {
      const val = Math.max(1, Math.min(5, Math.round(r.rating || 5)));
      counts[val] = (counts[val] || 0) + 1;
      sum += val;
    });
    const avg = Number((sum / reviewsList.length).toFixed(1));
    return { avgRating: avg, ratingCounts: counts };
  }, [reviewsList]);

  if (loading) {
    return (
      <div className="product-page-wrapper" style={{ maxWidth: 680, margin: '0 auto', padding: '1rem', minHeight: '100vh', background: '#f8fafc' }}>
        {/* Skeleton Top Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div className="lb-skeleton" style={{ width: 38, height: 38, borderRadius: '50%' }}></div>
          <div className="lb-skeleton" style={{ width: 140, height: 22, borderRadius: 6 }}></div>
          <div className="lb-skeleton" style={{ width: 38, height: 38, borderRadius: '50%' }}></div>
        </div>
        {/* Skeleton Product Image Card */}
        <div className="lb-skeleton" style={{ width: '100%', aspectRatio: '1 / 1', borderRadius: 18, marginBottom: '1.25rem' }}></div>
        {/* Skeleton Title & Price */}
        <div className="lb-skeleton" style={{ width: '70%', height: 26, borderRadius: 6, marginBottom: '0.75rem' }}></div>
        <div className="lb-skeleton" style={{ width: '35%', height: 22, borderRadius: 6, marginBottom: '1.5rem' }}></div>
        {/* Skeleton Store Badge */}
        <div className="lb-skeleton" style={{ width: '100%', height: 56, borderRadius: 14, marginBottom: '1.25rem' }}></div>
        {/* Skeleton Action Button */}
        <div className="lb-skeleton" style={{ width: '100%', height: 46, borderRadius: 12 }}></div>
      </div>
    );
  }

  if (!shop || !product) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', textAlign: 'center', background: '#f8fafc' }}>
        <i className="fa-solid fa-box-open" style={{ fontSize: '3rem', color: '#94a3b8', marginBottom: '1rem' }}></i>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a' }}>Product Not Found</h2>
        <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '320px', marginBottom: '1.5rem' }}>The product you are looking for does not exist or may have been removed.</p>
        <Link href={`/shops/${encodeURIComponent(shopId)}`} style={{ background: '#2563eb', color: '#fff', padding: '0.75rem 1.4rem', borderRadius: '12px', fontWeight: 700, textDecoration: 'none' }}>
          Return to Store Home
        </Link>
      </div>
    );
  }

  // Images list
  const prodImages: string[] = (Array.isArray(product.images) && product.images.length > 0)
    ? product.images.slice(0, 3)
    : (product.image ? [product.image] : ['https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500']);

  // Pricing calculations
  const numPrice = parseFloat(String(product.price || '').replace(/[^0-9.]/g, ''));
  const isOutOfStock = product.stockStatus === 'out_of_stock';
  let formattedPrice = product.price || '₹999';
  let mrpFormatted = '';
  let discountTag = '';

  if (!isNaN(numPrice) && numPrice > 0) {
    if (!formattedPrice.includes('₹') && formattedPrice !== 'On Request') {
      formattedPrice = `₹${Number(numPrice).toLocaleString('en-IN')}`;
    }
    const mrp = Math.round(numPrice * 1.25);
    mrpFormatted = `₹${Number(mrp).toLocaleString('en-IN')}`;
    discountTag = '20% OFF';
  }

  // Other products from this store (Zero demo data)
  const otherProducts = ((shop.products && shop.products.length > 0 ? shop.products : []))
    .filter((p) => p.name !== product.name)
    .slice(0, 6);

  return (
    <div className="pdp-page-container">
      {/* Sticky Top Navigation */}
      <header className="pdp-top-nav">
        <div className="pdp-nav-inner">
          <div className="pdp-nav-left">
            <button
              type="button"
              className="pdp-back-btn"
              onClick={handleProductBack}
              title="Back"
            >
              <i className="fa-solid fa-arrow-left"></i>
            </button>
            <div className="pdp-nav-title-box">
              <h1 className="pdp-nav-title">{product.name}</h1>
              <span className="pdp-nav-subtitle">
                <i className="fa-solid fa-store" style={{ color: '#2563eb' }}></i> {shop.name}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="pdp-share-btn"
            onClick={handleShareProduct}
            title="Share Product"
          >
            <i className="fa-solid fa-share-nodes"></i>
          </button>
        </div>
      </header>

      {/* Main PDP Content */}
      <main className="pdp-main-content">
        {/* 1. Media Carousel Card */}
        <section className="pdp-card">
          <div className="pdp-gallery-wrap">
            <div
              className="pdp-slider-track"
              ref={sliderTrackRef}
              onScroll={(e) => {
                const target = e.currentTarget;
                const idx = Math.round(target.scrollLeft / (target.offsetWidth || 1));
                setActiveSlideIndex(idx);
              }}
            >
              {prodImages.map((src, i) => (
                <div
                  key={i}
                  className="pdp-slide-item"
                  onClick={() => setLightboxImg(src)}
                  title="Click to zoom image"
                >
                  <img
                    src={src}
                    alt={`${product.name} - Photo ${i + 1}`}
                    className="pdp-slide-img"
                  />
                </div>
              ))}
            </div>

            {prodImages.length > 1 && (
              <div className="pdp-slider-dots">
                {prodImages.map((_, i) => (
                  <span
                    key={i}
                    className={`dot ${i === activeSlideIndex ? 'active' : ''}`}
                    onClick={() => {
                      setActiveSlideIndex(i);
                      if (sliderTrackRef.current) {
                        sliderTrackRef.current.scrollTo({
                          left: i * sliderTrackRef.current.offsetWidth,
                          behavior: 'smooth'
                        });
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Product Header Info */}
          <div style={{ marginTop: '0.85rem' }}>
            <span className="pdp-cat-pill">
              <i className="fa-solid fa-tag"></i> {product.category || product.storeCategory || 'General Product'}
            </span>

            <h2 className="pdp-title">{product.name}</h2>

            {/* Ratings Bar */}
            <div className="pdp-rating-strip">
              <span className="pdp-rating-badge" style={reviewsList.length === 0 ? { background: '#f1f5f9', color: '#64748b' } : undefined}>
                {reviewsList.length > 0 ? avgRating : 'New'} <i className={reviewsList.length > 0 ? "fa-solid fa-star" : "fa-regular fa-star"}></i>
              </span>
              <span className="pdp-reviews-link" onClick={handleScrollToReviews}>
                {reviewsList.length > 0 ? `${reviewsList.length} ${reviewsList.length === 1 ? 'Rating & Review' : 'Ratings & Reviews'}` : 'No ratings yet'}
              </span>
            </div>

            {/* Pricing Row */}
            <div className="pdp-price-row">
              <span className="pdp-main-price">{formattedPrice}</span>
              {mrpFormatted && <span className="pdp-mrp-price">{mrpFormatted}</span>}
              {discountTag && <span className="pdp-discount-pill">{discountTag}</span>}
              <span className={`pdp-stock-chip ${isOutOfStock ? 'out' : 'in'}`}>
                <i className={`fa-solid ${isOutOfStock ? 'fa-circle-xmark' : 'fa-circle-check'}`}></i>
                {isOutOfStock ? 'Out of Stock' : 'In Stock'}
              </span>
            </div>
          </div>
        </section>

        {/* 2. Product Details & Specifications Card (Directly below product) */}
        <section className="pdp-card">
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.65rem 0' }}>
            Product Details & Specifications
          </h3>
          <p className="pdp-desc-text">
            {product.details || product.desc || product.description || 'This authentic item is directly supplied by the verified merchant. Contact the store directly for bulk orders, custom specifications, or express local delivery.'}
          </p>
        </section>

        {/* 3. Seller & Store Info Card */}
        <section className="pdp-card">
          <div className="pdp-seller-card">
            <div className="pdp-seller-left">
              <img
                src={shop.image || 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=100'}
                alt={shop.name}
                className="pdp-seller-avatar"
              />
              <div style={{ minWidth: 0 }}>
                <h4 className="pdp-seller-name">{shop.name}</h4>
                {shop.city && (
                  <span className="pdp-seller-badge" style={{ color: '#64748b', fontSize: '0.78rem' }}>
                    <i className="fa-solid fa-location-dot" style={{ color: '#2563eb', marginRight: '3px' }}></i> {shop.city}
                  </span>
                )}
              </div>
            </div>
            <Link href={`/shops/${encodeURIComponent(shop.id)}`} className="pdp-btn-visit-store">
              Visit Store <i className="fa-solid fa-chevron-right" style={{ fontSize: '0.72rem', marginLeft: '3px' }}></i>
            </Link>
          </div>
        </section>

        {/* 4. Customer Ratings & Reviews Section */}
        <section className="pdp-card" ref={reviewsSectionRef} id="pdpReviewsSection">
          <div className="pdp-section-header">
            <h3 className="pdp-section-title">
              Ratings & Reviews ({reviewsList.length})
            </h3>
            <button
              type="button"
              className="pdp-btn-write-review"
              onClick={handleOpenReviewModal}
              disabled={googleLoading}
            >
              <i className={`fa-solid ${userExistingReview ? 'fa-pen-to-square' : 'fa-star'}`}></i>
              <span>{googleLoading ? 'Connecting...' : userExistingReview ? 'Update Your Review' : 'Rate Product'}</span>
            </button>
          </div>

          {/* Rating Summary Breakdown */}
          <div className="pdp-rating-overview">
            <div className="pdp-rating-big-score">
              <div className="pdp-rating-big-val">{reviewsList.length > 0 ? avgRating : 'New'}</div>
              <div className="pdp-rating-stars-row">
                {[1, 2, 3, 4, 5].map((s) => (
                  <i
                    key={s}
                    className={`fa-star ${reviewsList.length > 0 && s <= Math.round(avgRating) ? 'fa-solid' : 'fa-regular'}`}
                  ></i>
                ))}
              </div>
              <span className="pdp-rating-total-count">{reviewsList.length > 0 ? `${reviewsList.length} Reviews` : 'No reviews yet'}</span>
            </div>

            <div className="pdp-rating-bars-col">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = ratingCounts[star] || 0;
                const total = Math.max(1, reviewsList.length);
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={star} className="pdp-bar-row">
                    <span style={{ width: '22px' }}>{star} ★</span>
                    <div className="pdp-bar-track">
                      <div className="pdp-bar-fill" style={{ width: `${pct}%` }}></div>
                    </div>
                    <span style={{ width: '24px', textAlign: 'right', color: '#94a3b8' }}>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Reviews List */}
          <div className="pdp-reviews-feed">
            {reviewsList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>
                <i className="fa-regular fa-comment-dots" style={{ fontSize: '2rem', color: '#cbd5e1', marginBottom: '0.5rem', display: 'block' }}></i>
                No reviews yet. Be the first to share your experience with this product!
              </div>
            ) : (
              reviewsList.map((rev) => {
                const isOwnReview = currentUser && (
                  (currentUser.email && rev.userEmail && rev.userEmail.toLowerCase() === currentUser.email.toLowerCase()) ||
                  (currentUser.id && rev.userId === currentUser.id)
                );
                const canDelete = isOwnReview || currentUser?.role === 'admin' || !rev.userEmail;

                return (
                  <div key={rev.id} className="pdp-review-card" style={isOwnReview ? { border: '1.5px solid #93c5fd' } : undefined}>
                    <div className="pdp-review-header">
                      <div className="pdp-reviewer-meta">
                        {rev.userAvatar ? (
                          <img
                            src={rev.userAvatar}
                            alt={rev.userName}
                            style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div className="pdp-reviewer-avatar">
                            {(rev.userName || 'U').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className="pdp-reviewer-name">{rev.userName}</span>
                            {isOwnReview && (
                              <span style={{ fontSize: '0.68rem', background: '#eff6ff', color: '#2563eb', padding: '1px 6px', borderRadius: 4, fontWeight: 800 }}>
                                You
                              </span>
                            )}
                          </div>
                          <span className="pdp-verified-buyer-tag">
                            <i className="fa-solid fa-circle-check"></i> Verified Buyer
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="pdp-review-date">{rev.dateStr || 'Recently'}</span>
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
                            onClick={() => handleDeleteReview(rev.id)}
                            style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 700 }}
                            title="Delete review"
                          >
                            <i className="fa-solid fa-trash-can"></i>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="pdp-review-stars">
                      {rev.rating} <i className="fa-solid fa-star"></i>
                    </div>
                    <p className="pdp-review-comment">{rev.comment}</p>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* 5. More Products from this Store */}
        {otherProducts.length > 0 && (
          <section className="pdp-card">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.75rem 0' }}>
              More from {shop.name}
            </h3>
            <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.5rem', scrollbarWidth: 'none' }}>
              {otherProducts.map((op, idx) => {
                const opImg = (Array.isArray(op.images) && op.images[0]) || op.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200';
                return (
                  <Link
                    key={op.id || idx}
                    href={`/shops/${encodeURIComponent(shop.id)}/product/${encodeURIComponent(op.id || op.name)}`}
                    style={{ flex: '0 0 140px', textDecoration: 'none', color: 'inherit', background: '#f8fafc', padding: '0.65rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                  >
                    <div style={{ width: '100%', aspectRatio: '1/1', borderRadius: '8px', overflow: 'hidden', background: '#fff', marginBottom: '0.45rem' }}>
                      <img src={opImg} alt={op.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{op.name}</div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#16a34a', marginTop: '2px' }}>{op.price || '₹999'}</div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </main>

      {/* Sticky Bottom Action Bar */}
      <div className="pdp-sticky-bar">
        <div className="pdp-sticky-bar-inner">
          {/* Call Button */}
          {shop.phone && (
            <button
              type="button"
              onClick={() => triggerContactAuth('call', formatTelUrl(shop.phone))}
              className="pdp-action-btn call"
              title="Call Store"
              style={{ border: 'none', cursor: 'pointer' }}
            >
              <i className="fa-solid fa-phone"></i> Call Store
            </button>
          )}

          {/* WhatsApp Order Button */}
          {(shop.whatsapp || shop.phone) && (
            <button
              type="button"
              onClick={() => triggerContactAuth('whatsapp', formatWhatsAppUrl(shop.whatsapp || shop.phone, `Hi, I am interested in purchasing "${product.name}" (${formattedPrice}) from ${shop.name} on LocalBazar. Is this in stock?`))}
              className="pdp-action-btn whatsapp"
              title="Buy on WhatsApp"
              style={{ border: 'none', cursor: 'pointer' }}
            >
              <i className="fa-brands fa-whatsapp" style={{ fontSize: '1.1rem' }}></i> Buy on WhatsApp
            </button>
          )}
        </div>
      </div>

      {/* Write / Update Review Modal */}
      {showReviewModal && (
        <div className="pdp-modal-backdrop" onClick={() => setShowReviewModal(false)}>
          <div className="pdp-modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.15rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                  {userExistingReview ? 'Update Your Review' : 'Rate this Product'}
                </h3>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>{product.name}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#64748b', lineHeight: 1 }}
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
                style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #3b82f6' }}
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
                    {reviewRating === 5 ? '5 ★ Excellent' : reviewRating === 4 ? '4 ★ Very Good' : reviewRating === 3 ? '3 ★ Good' : reviewRating === 2 ? '2 ★ Fair' : '1 ★ Poor'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.65rem', fontSize: '1.6rem', color: '#f59e0b', cursor: 'pointer' }}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <i
                      key={s}
                      className={`fa-star ${s <= reviewRating ? 'fa-solid' : 'fa-regular'}`}
                      onClick={() => setReviewRating(s)}
                    ></i>
                  ))}
                </div>
              </div>

              {/* Review Comment Textarea */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>Your Review *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Share details of your experience with this product..."
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.9rem', boxSizing: 'border-box', outline: 'none' }}
                />
              </div>

              {userExistingReview && (
                <div style={{ fontSize: '0.74rem', color: '#059669', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <i className="fa-solid fa-circle-info"></i>
                  <span>You have already reviewed this product. Saving will update your rating & feedback.</span>
                </div>
              )}

              <button
                type="submit"
                disabled={reviewSubmitting}
                style={{ width: '100%', padding: '0.75rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: '0.92rem' }}
              >
                {reviewSubmitting ? 'Saving...' : userExistingReview ? 'Update Review' : 'Submit Review'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Fullscreen Lightbox Modal */}
      {lightboxImg && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
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
            alt="Fullscreen Product View"
            style={{ maxWidth: '92vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: '8px' }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Contact Auth Gate Modal: Reveal Phone & Instant Connect */}
      {showContactAuthModal && (
        <div
          className="lb-auth-modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.72)',
            backdropFilter: 'blur(5px)',
            WebkitBackdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            zIndex: 99999
          }}
          onClick={() => {
            if (!contactAuthLoading) {
              setShowContactAuthModal(false);
              setPendingContactAction(null);
            }
          }}
        >
          <div
            className="lb-auth-modal-card"
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              maxWidth: '420px',
              width: '100%',
              padding: '1.75rem 1.5rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              position: 'relative',
              textAlign: 'center'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                setShowContactAuthModal(false);
                setPendingContactAction(null);
              }}
              disabled={contactAuthLoading}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: '#f1f5f9',
                border: 'none',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                cursor: 'pointer',
                fontSize: '1rem',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              aria-label="Close"
            >
              &times;
            </button>

            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: pendingContactAction?.type === 'whatsapp' ? '#dcfce7' : '#eff6ff', color: pendingContactAction?.type === 'whatsapp' ? '#16a34a' : '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', margin: '0 auto 1rem' }}>
              <i className={pendingContactAction?.type === 'whatsapp' ? 'fa-brands fa-whatsapp' : 'fa-solid fa-phone-volume'}></i>
            </div>

            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.4rem 0' }}>
              Connect with {shop?.name || 'Seller'}
            </h3>

            <p style={{ fontSize: '0.86rem', color: '#64748b', margin: '0 0 1.25rem 0', lineHeight: 1.45 }}>
              Sign in with Google to reveal the verified phone number & directly {pendingContactAction?.type === 'whatsapp' ? 'order on WhatsApp' : 'call the store'}.
            </p>

            <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '0.75rem', marginBottom: '1.25rem', textAlign: 'left', border: '1px solid #e2e8f0', fontSize: '0.78rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <i className="fa-solid fa-check" style={{ color: '#16a34a' }}></i>
                <span>Direct 1-tap connection with seller</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <i className="fa-solid fa-check" style={{ color: '#16a34a' }}></i>
                <span>100% Free & Verified by LocalBazar</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleContactGoogleSignIn}
              disabled={contactAuthLoading}
              style={{
                width: '100%',
                padding: '0.85rem 1rem',
                background: '#ffffff',
                border: '1.5px solid #cbd5e1',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.65rem',
                fontSize: '0.95rem',
                fontWeight: 700,
                color: '#1e293b',
                cursor: contactAuthLoading ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
                transition: 'all 0.15s ease'
              }}
            >
              {contactAuthLoading ? (
                <div style={{ width: '20px', height: '20px', border: '2.5px solid #cbd5e1', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'lbSpin 0.75s linear infinite' }}></div>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                    <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                  </svg>
                  <span>Continue with Google</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}


    </div>
  );
}

export default function ProductDetailPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
          <div style={{ width: 44, height: 44, border: '3.5px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'lbSpin 0.75s linear infinite' }}></div>
        </div>
      }
    >
      <ProductDetailPageContent />
    </Suspense>
  );
}
