'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cloudSync, auth, formatLBUserId, db } from '@/lib/firebase';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { CityItem, CategoryItem, UserProfile, PromotedProductItem } from '@/types';

// Default enriched cities with district, state, pin code
const DEFAULT_CITIES: CityItem[] = [
  { name: 'Kolkata', district: 'Kolkata', state: 'West Bengal', pinCode: '700001', popular: true },
  { name: 'Howrah', district: 'Howrah', state: 'West Bengal', pinCode: '711101', popular: true },
  { name: 'Durgapur', district: 'Paschim Bardhaman', state: 'West Bengal', pinCode: '713216', popular: true },
  { name: 'Siliguri', district: 'Darjeeling', state: 'West Bengal', pinCode: '734001', popular: true },
  { name: 'Asansol', district: 'Paschim Bardhaman', state: 'West Bengal', pinCode: '713301', popular: true },
  { name: 'Bardhaman', district: 'Purba Bardhaman', state: 'West Bengal', pinCode: '713101' },
  { name: 'Kharagpur', district: 'Paschim Medinipur', state: 'West Bengal', pinCode: '721301' },
  { name: 'Malda', district: 'Malda', state: 'West Bengal', pinCode: '732101' },
  { name: 'Berhampore', district: 'Murshidabad', state: 'West Bengal', pinCode: '742101' },
  { name: 'Barasat', district: 'North 24 Parganas', state: 'West Bengal', pinCode: '700124' },
  { name: 'Haldia', district: 'Purba Medinipur', state: 'West Bengal', pinCode: '721602' },
  { name: 'Mumbai', district: 'Mumbai Suburban', state: 'Maharashtra', pinCode: '400001', popular: true },
  { name: 'New Delhi', district: 'Central Delhi', state: 'Delhi', pinCode: '110001', popular: true },
  { name: 'Bengaluru', district: 'Bengaluru Urban', state: 'Karnataka', pinCode: '560001', popular: true },
];

const DEFAULT_CATEGORIES: CategoryItem[] = [
  {
    name: 'Grocery & Supermarket',
    alternativeName: 'Ration, Kirana, Daily Needs',
    icon: 'fa-basket-shopping',
    storeCategories: [
      { label: 'Kirana', tag: 'kirana', icon: '🛒' },
      { label: 'Ration', tag: 'ration', icon: '🌾' },
      { label: 'Rice & Wheat', tag: 'rice-wheat', icon: '🍚' },
      { label: 'Spices & Masala', tag: 'spices-masala', icon: '🌶️' },
      { label: 'Dairy & Milk', tag: 'dairy-milk', icon: '🥛' },
      { label: 'Snacks & Beverages', tag: 'snacks-beverages', icon: '🍿' }
    ],
    subcategories: ['Kirana', 'Ration', 'Rice & Wheat', 'Spices & Masala', 'Dairy & Milk', 'Daily Needs']
  },
  {
    name: 'Pharmacy & Medical',
    alternativeName: 'Chemist, Medicine Store, Pharmacy',
    icon: 'fa-prescription-bottle-medical',
    storeCategories: [
      { label: 'Medicine', tag: 'medicine', icon: '💊' },
      { label: 'Chemist', tag: 'chemist', icon: '💉' },
      { label: 'Health Supplements', tag: 'health-supplements', icon: '🧪' },
      { label: 'Baby Care', tag: 'baby-care', icon: '🍼' },
      { label: 'Ayurvedic', tag: 'ayurvedic', icon: '🌿' }
    ],
    subcategories: ['Medicine', 'Chemist', 'Health Supplements', 'Baby Care', 'Ayurvedic']
  },
  {
    name: 'Doctor & Clinics',
    alternativeName: 'Specialist, Chambers, Healthcare',
    icon: 'fa-user-doctor',
    storeCategories: [
      { label: 'General Physician', tag: 'general-physician', icon: '🩺' },
      { label: 'Dentist', tag: 'dentist', icon: '🦷' },
      { label: 'Pediatrician', tag: 'pediatrician', icon: '👶' },
      { label: 'Eye Specialist', tag: 'eye-specialist', icon: '👁️' },
      { label: 'Pathology & Blood Test', tag: 'pathology', icon: '🔬' }
    ],
    subcategories: ['General Physician', 'Dentist', 'Pediatrician', 'Eye Specialist', 'Pathology']
  },
  {
    name: 'Electronics & Mobiles',
    alternativeName: 'Smartphones, Laptops, Gadgets',
    icon: 'fa-mobile-screen-button',
    storeCategories: [
      { label: 'Smartphones', tag: 'smartphones', icon: '📱' },
      { label: 'Laptops & Computers', tag: 'laptops-computers', icon: '💻' },
      { label: 'Mobile Repair', tag: 'mobile-repair', icon: '🛠️' },
      { label: 'Home Appliances', tag: 'home-appliances', icon: '📺' },
      { label: 'Accessories', tag: 'accessories', icon: '🎧' }
    ],
    subcategories: ['Smartphones', 'Laptops', 'Mobile Repair', 'Home Appliances', 'Accessories']
  },
  {
    name: 'Fashion & Clothing',
    alternativeName: 'Garments, Apparels, Boutiques',
    icon: 'fa-shirt',
    storeCategories: [
      { label: 'Men Clothing', tag: 'men-clothing', icon: '👔' },
      { label: 'Women Wear & Sarees', tag: 'women-wear-sarees', icon: '👗' },
      { label: 'Kids Fashion', tag: 'kids-fashion', icon: '🧒' },
      { label: 'Footwear & Shoes', tag: 'footwear-shoes', icon: '👟' },
      { label: 'Tailoring & Boutiques', tag: 'tailoring-boutiques', icon: '✂️' }
    ],
    subcategories: ['Men Clothing', 'Women Wear', 'Sarees', 'Kids Fashion', 'Footwear', 'Boutique']
  },
  {
    name: 'Restaurants & Cafe',
    alternativeName: 'Food, Dining, Sweets, Snacks',
    icon: 'fa-utensils',
    storeCategories: [
      { label: 'Fast Food & Biryani', tag: 'fast-food-biryani', icon: '🍔' },
      { label: 'Sweets & Bakery', tag: 'sweets-bakery', icon: '🍰' },
      { label: 'Cafe & Tea Stalls', tag: 'cafe-tea', icon: '☕' },
      { label: 'Family Restaurant', tag: 'family-restaurant', icon: '🍽️' },
      { label: 'Ice Cream & Shakes', tag: 'ice-cream-shakes', icon: '🍨' }
    ],
    subcategories: ['Fast Food', 'Biryani', 'Sweets & Bakery', 'Cafe', 'Restaurant', 'Ice Cream']
  },
  {
    name: 'Hardware & Electrical',
    alternativeName: 'Sanitary, Paints, Tools',
    icon: 'fa-wrench',
    storeCategories: [
      { label: 'Paints & Wallpapers', tag: 'paints-wallpapers', icon: '🎨' },
      { label: 'Electrical Fittings', tag: 'electrical-fittings', icon: '💡' },
      { label: 'Sanitary & Plumbing', tag: 'sanitary-plumbing', icon: '🚿' },
      { label: 'Plywood & Timber', tag: 'plywood-timber', icon: '🪵' },
      { label: 'Tools & Machines', tag: 'tools-machines', icon: '🔨' }
    ],
    subcategories: ['Paints', 'Electrical', 'Sanitary', 'Plumbing', 'Plywood', 'Hardware Tools']
  },
  {
    name: 'Automobile & Garage',
    alternativeName: 'Bike & Car Repair, Spare Parts',
    icon: 'fa-motorcycle',
    storeCategories: [
      { label: 'Bike Service & Repair', tag: 'bike-service-repair', icon: '🏍️' },
      { label: 'Car Wash & Garage', tag: 'car-wash-garage', icon: '🚗' },
      { label: 'Spare Parts & Tyres', tag: 'spare-parts-tyres', icon: '⚙️' },
      { label: 'Battery & Electrical', tag: 'battery-electrical', icon: '🔋' }
    ],
    subcategories: ['Bike Service', 'Car Garage', 'Spare Parts', 'Tyres', 'Car Wash']
  },
];

// Helper: match only when word starts with typed query
const matchStartsWithWord = (text: string, q: string): boolean => {
  if (!text || !q) return false;
  const cleanText = text.trim().toLowerCase();
  const cleanQ = q.trim().toLowerCase();
  if (cleanText.startsWith(cleanQ)) return true;
  // If multi-word string, check if any word starts with q
  const words = cleanText.split(/[\s,/-]+/);
  return words.some((w) => w.startsWith(cleanQ));
};

export default function HomePage() {
  const router = useRouter();

  const [cities, setCities] = useState<CityItem[]>(DEFAULT_CITIES);
  const [categories, setCategories] = useState<CategoryItem[]>(DEFAULT_CATEGORIES);
  const [cityInput, setCityInput] = useState('');
  const [queryInput, setQueryInput] = useState('');
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [homeNewsTicker, setHomeNewsTicker] = useState('Welcome to LocalBazar - India\'s Trusted Hyperlocal Directory.');
  const [homeSlideBanners, setHomeSlideBanners] = useState<any[]>([]);
  const [promotedProducts, setPromotedProducts] = useState<PromotedProductItem[]>([]);
  const promoRowRef = useRef<HTMLDivElement>(null);
  const [promoPaused, setPromoPaused] = useState(false);

  const [showCitySugg, setShowCitySugg] = useState(false);
  const [showCatSugg, setShowCatSugg] = useState(false);

  const [cityError, setCityError] = useState('');
  const [queryError, setQueryError] = useState('');
  const [shakeCity, setShakeCity] = useState(false);
  const [shakeQuery, setShakeQuery] = useState(false);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [modalTargetText, setModalTargetText] = useState('Local Stores');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const bannerTouchStartX = useRef<number | null>(null);

  const cityRef = useRef<HTMLDivElement>(null);
  const queryRef = useRef<HTMLDivElement>(null);
  const cityInputRef = useRef<HTMLInputElement>(null);
  const queryInputRef = useRef<HTMLInputElement>(null);

  // Auto-slide home banners every 4 seconds if > 1 banner
  useEffect(() => {
    if (homeSlideBanners.length <= 1) return;
    const interval = setInterval(() => {
      setActiveBannerIndex((prev) => (prev + 1) % homeSlideBanners.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [homeSlideBanners.length]);

  // Auto-slide promoted products row horizontally when items overflow
  useEffect(() => {
    if (promotedProducts.length <= 1 || promoPaused) return;
    const interval = setInterval(() => {
      const el = promoRowRef.current;
      if (!el) return;
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (maxScroll <= 0) return;
      if (el.scrollLeft >= maxScroll - 10) {
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        el.scrollBy({ left: 160, behavior: 'smooth' });
      }
    }, 3500);
    return () => clearInterval(interval);
  }, [promotedProducts.length, promoPaused]);

  // Load User, Cities & Categories (Non-blocking: instant 0ms paint + background cloud sync)
  useEffect(() => {
    // 1. Instant local user auth load
    try {
      const rawUser = localStorage.getItem('lb_current_user');
      if (rawUser) setCurrentUser(JSON.parse(rawUser));
    } catch {}

    // 2. Prefetch explore route only after browser is completely idle (prevents network contention)
    const idlePrefetchTimer = setTimeout(() => {
      try {
        router.prefetch('/explore');
      } catch {}
    }, 2500);

    // 3. Defer Firestore network pulls by 60ms so browser paints the UI immediately at 0ms
    const cloudSyncTimer = setTimeout(() => {
      cloudSync.pullCities().then((c) => {
        if (c && c.length) {
          const enriched = c.map((city) => {
            const def = DEFAULT_CITIES.find((dc) => dc.name.toLowerCase() === (city.name || '').toLowerCase());
            return {
              ...city,
              district: city.district || def?.district || '',
              state: city.state || def?.state || 'India',
              pinCode: city.pinCode || city.pincode || def?.pinCode || ''
            };
          });
          setCities(enriched);
        }
      });

      cloudSync.pullCategories().then((cat) => {
        if (cat && cat.length) {
          const enrichedCats = cat.map((ct) => {
            const def = DEFAULT_CATEGORIES.find((d) => d.name.toLowerCase() === (ct.name || '').toLowerCase());
            return {
              ...ct,
              alternativeName: ct.alternativeName || def?.alternativeName || '',
              icon: ct.icon || def?.icon || 'fa-store',
              storeCategories: (ct.storeCategories && ct.storeCategories.length > 0) ? ct.storeCategories : (def?.storeCategories || []),
              subcategories: (ct.subcategories && ct.subcategories.length > 0) ? ct.subcategories : (def?.subcategories || [])
            };
          });
          setCategories(enrichedCats);
        }
      });

      cloudSync.pullNewsTicker().then((t) => {
        if (t) setHomeNewsTicker(t);
      });

      cloudSync.pullHomeBanners().then((banners) => {
        if (banners && banners.length) setHomeSlideBanners(banners);
      });

      cloudSync.pullPromotedProducts().then((p) => {
        if (p && p.length) setPromotedProducts(p);
      });
    }, 60);

    // Real-time Auth sync: instant update of Google profile avatar and status
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      if (u) {
        let existingUser: UserProfile | null = null;
        try {
          const raw = localStorage.getItem('lb_current_user');
          if (raw) existingUser = JSON.parse(raw);
        } catch {}

        const stdId = formatLBUserId(u.email || u.uid);
        const userProfile: UserProfile = {
          ...(existingUser || {}),
          id: stdId,
          uid: u.uid,
          name: u.displayName || existingUser?.name || 'Member User',
          email: u.email || existingUser?.email || '',
          photoURL: u.photoURL || existingUser?.photoURL || '',
          role: existingUser?.role || 'user',
        };
        setCurrentUser(userProfile);
      } else {
        const raw = localStorage.getItem('lb_current_user');
        if (!raw) setCurrentUser(null);
      }
    });

    // Close suggestions on outside click
    const handleOutsideClick = (e: MouseEvent) => {
      if (cityRef.current && !cityRef.current.contains(e.target as Node)) {
        setShowCitySugg(false);
      }
      if (queryRef.current && !queryRef.current.contains(e.target as Node)) {
        setShowCatSugg(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => {
      clearTimeout(idlePrefetchTimer);
      clearTimeout(cloudSyncTimer);
      unsubAuth();
      document.removeEventListener('click', handleOutsideClick);
    };
  }, []);

  // Filtered Cities: ONLY words starting with the typed query
  const cityQuery = cityInput.trim().toLowerCase();
  const filteredCities = cityQuery
    ? cities
        .filter((c) => {
          const nameMatch = matchStartsWithWord(c.name || '', cityQuery);
          const pinMatch = (c.pinCode || c.pincode || '').toLowerCase().startsWith(cityQuery);
          return nameMatch || pinMatch;
        })
        .sort((a, b) => {
          const aStarts = (a.name || '').toLowerCase().startsWith(cityQuery);
          const bStarts = (b.name || '').toLowerCase().startsWith(cityQuery);
          if (aStarts && !bStarts) return -1;
          if (!aStarts && bStarts) return 1;
          if (a.popular && !b.popular) return -1;
          if (!a.popular && b.popular) return 1;
          return (a.name || '').localeCompare(b.name || '');
        })
        .slice(0, 8)
    : [];

  // Filtered Categories: ONLY categories starting with typed query (strictly like City)
  const catQuery = queryInput.trim().toLowerCase();
  const filteredCategories: CategoryItem[] = catQuery
    ? (() => {
        // 1. Direct name prefix match (e.g. "Doc" -> "Doctor & Clinics", "G" -> "Grocery & Supermarket")
        const directMatches = categories.filter((cat) =>
          (cat.name || '').toLowerCase().startsWith(catQuery)
        );

        if (directMatches.length > 0) {
          return directMatches
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
            .slice(0, 8);
        }

        // 2. If no direct match and typed at least 2 chars, match words in category name
        // (e.g. "clinic", "cafe", "garage", "mobiles", "medical")
        if (catQuery.length >= 2) {
          const wordMatches = categories.filter((cat) => {
            const words = (cat.name || '').toLowerCase().split(/[\s,/-]+/);
            return words.some((w) => w.startsWith(catQuery));
          });
          if (wordMatches.length > 0) {
            return wordMatches
              .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
              .slice(0, 8);
          }
        }

        return [];
      })()
    : [];

  const handleSearchSubmit = (e?: React.FormEvent | React.SyntheticEvent) => {
    if (e && e.preventDefault) e.preventDefault();
    if (isSearching) return;

    // 1. Immediately dismiss mobile virtual keyboard
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    // 2. Immediately close suggestions
    setShowCitySugg(false);
    setShowCatSugg(false);

    const city = cityInput.trim();
    const query = queryInput.trim();

    setCityError('');
    setQueryError('');

    if (!city && !query) {
      setCityError('Please enter city');
      setShakeCity(true);
      setTimeout(() => setShakeCity(false), 600);
      return;
    }

    if (city && !query) {
      setQueryError(`Select a Category for "${city}"`);
      setShakeQuery(true);
      setTimeout(() => setShakeQuery(false), 600);
      return;
    }

    if (!city && query) {
      setCityError(`Enter City for "${query}"`);
      setShakeCity(true);
      setTimeout(() => setShakeCity(false), 600);
      return;
    }

    if (!currentUser) {
      setModalTargetText(`${query} in ${city}`);
      setShowAuthModal(true);
      return;
    }

    // 3. Instant 0ms visual feedback: button turns to spinner immediately
    setIsSearching(true);
    setTimeout(() => setIsSearching(false), 5000);

    const params = new URLSearchParams();
    params.set('city', city);
    params.set('category', query);
    const targetUrl = `/explore?${params.toString()}`;

    // Soft client transition
    try {
      router.push(targetUrl);
    } catch {
      window.location.assign(targetUrl);
      return;
    }

    // Fail-safe bulletproof fallback: if router.push gets stuck (stale PWA socket, chunk hash mismatch, sleeping mobile browser)
    // navigate directly after 750ms so user is 100% guaranteed to reach the explore page
    setTimeout(() => {
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/explore')) {
        window.location.assign(targetUrl);
      }
    }, 750);
  };

  const handleModalGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, provider);
      const u = res.user;

      const userEmail = u.email || '';
      const lbId = formatLBUserId(userEmail || u.uid);

      let originalJoinedDate = '';
      try {
        const userDocSnap = await getDoc(doc(db, 'users', lbId));
        if (userDocSnap.exists()) {
          const cloudData = userDocSnap.data() as UserProfile;
          if (cloudData.joinedDate) {
            originalJoinedDate = cloudData.joinedDate;
          }
        }
      } catch {}

      if (!originalJoinedDate && u.metadata?.creationTime) {
        const cDate = new Date(u.metadata.creationTime);
        if (!isNaN(cDate.getTime())) {
          originalJoinedDate = cDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
      }

      if (!originalJoinedDate) {
        originalJoinedDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }

      const userProfile: UserProfile = {
        id: lbId,
        uid: u.uid,
        name: u.displayName || 'Member User',
        email: userEmail,
        photoURL: u.photoURL || '',
        role: 'user',
        joinedDate: originalJoinedDate
      };

      setCurrentUser(userProfile);
      localStorage.setItem('lb_current_user', JSON.stringify(userProfile));
      await cloudSync.saveUser(userProfile);

      setShowAuthModal(false);

      const params = new URLSearchParams();
      params.set('city', cityInput.trim());
      params.set('category', queryInput.trim());
      router.push(`/explore?${params.toString()}`);
    } catch (err) {
      console.error('Google Sign In Error:', err);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <>
      {/* Minimal Header */}
      <header className="app-header">
        <div className="header-left" id="headerTickerSlot" style={{ flex: 1, minWidth: 0, overflow: 'hidden', maxWidth: '75vw' }}>
          {homeNewsTicker && (
            <div className="header-ticker-bar" style={{ width: '100%', overflow: 'hidden' }}>
              <div className="lb-ticker-track">
                <span className="lb-ticker-text-item" style={{ fontSize: '0.88rem', fontWeight: 600, color: '#475569' }}>
                  {homeNewsTicker}
                </span>
                <span className="lb-ticker-sep" style={{ margin: '0 2rem', color: '#94a3b8', opacity: 0.6 }}>•</span>
                <span className="lb-ticker-text-item" style={{ fontSize: '0.88rem', fontWeight: 600, color: '#475569' }}>
                  {homeNewsTicker}
                </span>
              </div>
            </div>
          )}
        </div>
        <div className="header-right" id="headerUserArea">
          {!currentUser ? (
            <Link href="/auth" prefetch={true} className="user-avatar-btn" id="guestSignInBtn" title="Account / Sign In">
              <i className="fa-regular fa-user"></i>
            </Link>
          ) : (
            <div className="user-profile-widget" id="userProfileWidget" style={{ display: 'block' }}>
              <Link href="/account" prefetch={true} className="user-profile-trigger" id="profileTriggerBtn" title="Account, Settings & Support">
                <img
                  id="userHeaderAvatar"
                  src={currentUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name || 'User')}&background=1a73e8&color=fff&size=100&bold=true`}
                  alt="Profile"
                  className="header-user-img"
                  referrerPolicy="no-referrer"
                />
                <span className="user-status-indicator"></span>
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Center Stage: The Heart of LocalBazar */}
      <main className="center-stage">
        <div className="stage-container">
          {/* Brand Mark */}
          <div className="brand-hero">
            <div className="brand-icon">
              <i className="fa-solid fa-store"></i>
            </div>
            <h1 className="brand-title">
              Local<span>Bazar</span>
            </h1>
            <p className="brand-tagline">Every Destination. Every Detail.</p>
          </div>

          {/* Focused Unified Search Bar */}
          <form className="omni-search-bar" id="omniSearchForm" onSubmit={handleSearchSubmit}>
            {/* Location Part */}
            <div
              className={`omni-segment location-segment ${shakeCity ? 'input-require-shake' : ''}`}
              style={{ position: 'relative' }}
              ref={cityRef}
            >
              <i className="fa-solid fa-location-crosshairs segment-icon"></i>
              <input
                ref={cityInputRef}
                type="text"
                id="cityInput"
                placeholder="City, District or PIN"
                autoComplete="off"
                value={cityInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setCityInput(val);
                  setCityError('');
                  setShowCitySugg(val.trim().length > 0);
                  setShowCatSugg(false);
                }}
                onFocus={() => {
                  setShowCitySugg(cityInput.trim().length > 0);
                  setShowCatSugg(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setShowCitySugg(false);
                }}
              />
              {cityError && (
                <div className="omni-input-error-tip show" id="cityInputError">
                  {cityError}
                </div>
              )}
              {showCitySugg && cityInput.trim().length > 0 && (
                <div className="omni-suggestions-popover open" id="homeCitySuggestions">
                  <div className="omni-sugg-header">
                    <span><i className="fa-solid fa-location-dot"></i> Suggested Locations</span>
                  </div>
                  {filteredCities.length > 0 ? (
                    filteredCities.map((c) => (
                      <div
                        key={c.name}
                        className="omni-sugg-item"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          setCityInput(c.name);
                          setShowCitySugg(false);
                          setCityError('');
                          setTimeout(() => {
                            queryInputRef.current?.focus();
                          }, 40);
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setCityInput(c.name);
                          setShowCitySugg(false);
                          setCityError('');
                          setTimeout(() => {
                            queryInputRef.current?.focus();
                          }, 40);
                        }}
                      >
                        <div className="omni-sugg-icon-badge city-badge">
                          <i className="fa-solid fa-location-dot"></i>
                        </div>
                        <div className="omni-sugg-main">
                          <div className="omni-sugg-title-row">
                            <span className="omni-sugg-title">{c.name}</span>
                            {c.popular && <span className="omni-popular-tag">Popular</span>}
                          </div>
                          <div className="omni-sugg-meta-details">
                            {c.district && (
                              <span className="omni-meta-item">
                                <i className="fa-solid fa-map-location-dot"></i> Dist: {c.district}
                              </span>
                            )}
                            <span className="omni-meta-item">
                              <i className="fa-solid fa-landmark"></i> {c.state || 'India'}
                            </span>
                            {(c.pinCode || c.pincode) && (
                              <span className="omni-meta-item omni-pin-pill">
                                Pin {(c.pinCode || c.pincode || '').replace(/^[#\s]+/, '')}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="omni-sugg-action-arrow">
                          <span>Select</span>
                          <i className="fa-solid fa-arrow-turn-down-left"></i>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="omni-sugg-empty">
                      <i className="fa-solid fa-circle-exclamation"></i>
                      <span>No matching city, district or PIN found</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="omni-separator"></div>

            {/* Query Part */}
            <div
              className={`omni-segment query-segment ${shakeQuery ? 'input-require-shake' : ''}`}
              style={{ position: 'relative' }}
              ref={queryRef}
            >
              <i className="fa-solid fa-magnifying-glass segment-icon"></i>
              <input
                ref={queryInputRef}
                type="text"
                id="queryInput"
                placeholder="Search categories, offices, clinics, shops..."
                autoComplete="off"
                value={queryInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setQueryInput(val);
                  setQueryError('');
                  setShowCatSugg(val.trim().length > 0);
                  setShowCitySugg(false);
                }}
                onFocus={() => {
                  setShowCatSugg(queryInput.trim().length > 0);
                  setShowCitySugg(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setShowCatSugg(false);
                }}
              />
              {queryError && (
                <div className="omni-input-error-tip show" id="queryInputError">
                  {queryError}
                </div>
              )}
              {showCatSugg && queryInput.trim().length > 0 && (
                <div className="omni-suggestions-popover open" id="homeCategorySuggestions">
                  <div className="omni-sugg-header">
                    <span><i className="fa-solid fa-layer-group"></i> Suggested Categories</span>
                  </div>
                  {filteredCategories.length > 0 ? (
                    filteredCategories.map((cat) => (
                      <div
                        key={cat.name}
                        className="omni-sugg-item"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          setQueryInput(cat.name);
                          setShowCatSugg(false);
                          setQueryError('');
                          queryInputRef.current?.blur();
                          if (cityInput.trim()) {
                            try { router.prefetch(`/explore?city=${encodeURIComponent(cityInput.trim())}&category=${encodeURIComponent(cat.name)}`); } catch {}
                          }
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setQueryInput(cat.name);
                          setShowCatSugg(false);
                          setQueryError('');
                          queryInputRef.current?.blur();
                          if (cityInput.trim()) {
                            try { router.prefetch(`/explore?city=${encodeURIComponent(cityInput.trim())}&category=${encodeURIComponent(cat.name)}`); } catch {}
                          }
                        }}
                      >
                        <div className="omni-sugg-icon-badge cat-badge">
                          <i className={`fa-solid ${cat.icon || 'fa-layer-group'}`}></i>
                        </div>
                        <div className="omni-sugg-main">
                          <div className="omni-sugg-title-row">
                            <span className="omni-sugg-title">{cat.name}</span>
                          </div>
                          {cat.alternativeName && (
                            <div className="omni-sugg-meta-details">
                              <span className="omni-meta-item">
                                <i className="fa-solid fa-tags"></i> {cat.alternativeName}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="omni-sugg-action-arrow">
                          <span>Select</span>
                          <i className="fa-solid fa-arrow-turn-down-left"></i>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="omni-sugg-empty">
                      <i className="fa-solid fa-circle-exclamation"></i>
                      <span>No category found matching &quot;{queryInput}&quot;</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Search Action */}
            <button
              type="submit"
              className="omni-submit-btn"
              aria-label="Search"
              disabled={isSearching}
              onPointerDown={(e) => {
                // Instant mobile touch trigger on 1st tap (no double tap needed)
                if (cityInput.trim() && queryInput.trim() && !isSearching) {
                  e.preventDefault();
                  handleSearchSubmit();
                }
              }}
            >
              {isSearching ? (
                <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '1.15rem' }}></i>
              ) : (
                <i className="fa-solid fa-arrow-right"></i>
              )}
            </button>
          </form>

          {/* Home Slide Banners (Full-width, auto-sliding, zero gap, clean display) */}
          {homeSlideBanners.length > 0 && (
            <div
              style={{
                marginTop: '2rem',
                width: '100%',
                maxWidth: 760,
                position: 'relative',
                borderRadius: '18px',
                overflow: 'hidden',
                boxShadow: '0 8px 24px -4px rgba(15, 23, 42, 0.12), 0 2px 6px rgba(0, 0, 0, 0.04)',
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
              }}
              onTouchStart={(e) => {
                bannerTouchStartX.current = e.touches[0].clientX;
              }}
              onTouchEnd={(e) => {
                if (bannerTouchStartX.current === null || homeSlideBanners.length <= 1) return;
                const touchEndX = e.changedTouches[0].clientX;
                const diff = bannerTouchStartX.current - touchEndX;
                if (Math.abs(diff) > 40) {
                  if (diff > 0) {
                    setActiveBannerIndex((prev) => (prev + 1) % homeSlideBanners.length);
                  } else {
                    setActiveBannerIndex((prev) => (prev - 1 + homeSlideBanners.length) % homeSlideBanners.length);
                  }
                }
                bannerTouchStartX.current = null;
              }}
            >
              {/* Carousel Track */}
              <div
                style={{
                  display: 'flex',
                  width: `${homeSlideBanners.length * 100}%`,
                  transform: `translateX(-${(activeBannerIndex * 100) / homeSlideBanners.length}%)`,
                  transition: 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)',
                }}
              >
                {homeSlideBanners.map((b: any, idx: number) => {
                  const bannerLink = b.link || b.url || b.actionUrl;
                  const slideContent = (
                    <div
                      key={b.id || idx}
                      style={{
                        width: `${100 / homeSlideBanners.length}%`,
                        position: 'relative',
                        aspectRatio: '16 / 9',
                        overflow: 'hidden',
                        background: '#f1f5f9',
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={b.imageUrl}
                        alt={b.title || 'LocalBazar Banner'}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          display: 'block',
                        }}
                      />
                    </div>
                  );

                  return bannerLink ? (
                    <Link
                      key={b.id || idx}
                      href={bannerLink}
                      style={{
                        display: 'block',
                        width: `${100 / homeSlideBanners.length}%`,
                        textDecoration: 'none',
                      }}
                    >
                      {slideContent}
                    </Link>
                  ) : (
                    slideContent
                  );
                })}
              </div>

              {/* Indicator Dots (Only if > 1 banner) */}
              {homeSlideBanners.length > 1 && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '10px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    gap: '6px',
                    alignItems: 'center',
                    background: 'rgba(0, 0, 0, 0.35)',
                    padding: '4px 8px',
                    borderRadius: '20px',
                    backdropFilter: 'blur(4px)',
                    zIndex: 2,
                  }}
                >
                  {homeSlideBanners.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveBannerIndex(idx)}
                      aria-label={`Go to banner ${idx + 1}`}
                      style={{
                        width: activeBannerIndex === idx ? '18px' : '6px',
                        height: '6px',
                        borderRadius: '3px',
                        border: 'none',
                        padding: 0,
                        background: activeBannerIndex === idx ? '#ffffff' : 'rgba(255, 255, 255, 0.5)',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Promoted Products (Square Cards, Side-by-Side Auto-Sliding Row) */}
          {promotedProducts.length > 0 && (
            <div
              style={{
                marginTop: '1.75rem',
                width: '100%',
                maxWidth: 760,
                textAlign: 'left',
              }}
              onMouseEnter={() => setPromoPaused(true)}
              onMouseLeave={() => setPromoPaused(false)}
              onTouchStart={() => setPromoPaused(true)}
              onTouchEnd={() => {
                setTimeout(() => setPromoPaused(false), 2000);
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '0.65rem',
                  padding: '0 0.25rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <span
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.72rem',
                    }}
                  >
                    <i className="fa-solid fa-fire"></i>
                  </span>
                  <span
                    style={{
                      fontSize: '0.95rem',
                      fontWeight: 800,
                      color: '#0f172a',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    Featured Products
                  </span>
                </div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                  Swipe to explore &rarr;
                </span>
              </div>

              {/* Horizontal Square Card Track */}
              <div
                ref={promoRowRef}
                style={{
                  display: 'flex',
                  gap: '0.85rem',
                  overflowX: 'auto',
                  paddingBottom: '0.5rem',
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                  WebkitOverflowScrolling: 'touch',
                  scrollSnapType: 'x mandatory',
                }}
              >
                {promotedProducts.map((p) => {
                  const targetUrl = `/shops/${encodeURIComponent(p.shopId)}/product/${encodeURIComponent(p.productId)}`;
                  return (
                    <Link
                      key={p.id}
                      href={targetUrl}
                      style={{
                        flex: '0 0 148px',
                        width: '148px',
                        textDecoration: 'none',
                        color: 'inherit',
                        scrollSnapAlign: 'start',
                      }}
                    >
                      <div
                        style={{
                          background: '#fff',
                          borderRadius: 14,
                          overflow: 'hidden',
                          border: '1px solid #e2e8f0',
                          boxShadow: '0 4px 14px -2px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(0,0,0,0.04)',
                          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                          display: 'flex',
                          flexDirection: 'column',
                        }}
                      >
                        {/* 1:1 Exact Square Product Image */}
                        <div
                          style={{
                            width: '100%',
                            aspectRatio: '1 / 1',
                            position: 'relative',
                            background: '#f8fafc',
                            overflow: 'hidden',
                          }}
                        >
                          {p.image ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={p.image}
                              alt={p.productName}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                display: 'block',
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#cbd5e1',
                                fontSize: '1.75rem',
                              }}
                            >
                              <i className="fa-solid fa-box"></i>
                            </div>
                          )}

                          {p.price && (
                            <span
                              style={{
                                position: 'absolute',
                                bottom: 6,
                                right: 6,
                                background: 'rgba(15, 23, 42, 0.85)',
                                color: '#10b981',
                                backdropFilter: 'blur(4px)',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                padding: '2px 7px',
                                borderRadius: 6,
                              }}
                            >
                              ₹{p.price}
                            </span>
                          )}
                        </div>

                        {/* Title & Store info */}
                        <div style={{ padding: '0.55rem 0.65rem' }}>
                          <div
                            style={{
                              fontSize: '0.82rem',
                              fontWeight: 800,
                              color: '#0f172a',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              lineHeight: 1.25,
                            }}
                            title={p.productName}
                          >
                            {p.productName}
                          </div>
                          <div
                            style={{
                              fontSize: '0.7rem',
                              color: '#64748b',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              marginTop: 2,
                            }}
                          >
                            {p.shopName}
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Professional Google Login Required Modal for Search */}
      {showAuthModal && (
        <div
          className="lb-auth-modal-overlay"
          id="searchAuthModalOverlay"
          style={{ display: 'flex' }}
          onClick={() => setShowAuthModal(false)}
        >
          <div className="lb-auth-modal-card" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="lb-auth-modal-close"
              onClick={() => setShowAuthModal(false)}
              title="Close"
            >
              &times;
            </button>

            <div className="lb-auth-modal-header">
              <div className="lb-auth-brand-badge">
                <div className="lb-brand-icon-box">
                  <i className="fa-solid fa-store"></i>
                </div>
                <span className="lb-brand-title">
                  Local<span>Bazar</span>
                </span>
              </div>
              <div className="lb-auth-lock-shield">
                <i className="fa-solid fa-lock"></i>
              </div>
            </div>

            <div className="lb-auth-modal-body">
              <h3 className="lb-auth-modal-title">Sign in to Explore Local Places</h3>
              <p className="lb-auth-modal-desc">
                To view verified businesses, contacts, and live deals for{' '}
                <strong id="modalTargetSearchLabel" className="target-search-chip">
                  {modalTargetText}
                </strong>
                , please continue with your Google account.
              </p>

              <div className="lb-auth-perks-list">
                <div className="perk-item">
                  <i className="fa-solid fa-check"></i> <span>Direct phone & WhatsApp to verified shops</span>
                </div>
                <div className="perk-item">
                  <i className="fa-solid fa-check"></i> <span>View live catalog & in-store deals</span>
                </div>
                <div className="perk-item">
                  <i className="fa-solid fa-check"></i> <span>Save favorite places & write reviews</span>
                </div>
              </div>

              <button
                type="button"
                className="btn-modal-google-login"
                id="btnModalGoogleLogin"
                onClick={handleModalGoogleSignIn}
                disabled={googleLoading}
              >
                {googleLoading ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin" style={{ color: '#2563eb' }}></i>{' '}
                    <span>Signing in with Google...</span>
                  </>
                ) : (
                  <>
                    <svg className="google-icon" width="20" height="20" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Continue with Google</span>
                  </>
                )}
              </button>
            </div>

            <div className="lb-auth-modal-footer">
              <i className="fa-solid fa-shield-halved"></i>
              <span>Fast, verified and secure 1-click sign-in</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
