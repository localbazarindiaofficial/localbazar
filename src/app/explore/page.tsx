'use client';

import React, { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { cloudSync } from '@/lib/firebase';
import { Listing, NewsItem, TargetNewsBannerItem, CategoryItem, isTrustBadgeActive } from '@/types';

// Smart Category Matching Helper (Strictly category-accurate, no loose bleeding)
const matchCategory = (listingCat: string, searchCat: string, categoriesList: CategoryItem[]): boolean => {
  if (!searchCat || searchCat === 'all' || searchCat === 'all categories') return true;
  if (!listingCat) return false;

  const lCat = listingCat.trim().toLowerCase();
  const sCat = searchCat.trim().toLowerCase();

  // 1. Direct equality
  if (lCat === sCat) return true;

  // 2. Direct containment (e.g. "Grocery" matches "Grocery Store" or "Grocery & Supermarket")
  if (lCat.includes(sCat) || sCat.includes(lCat)) return true;

  // 3. Synonym / Taxonomy match through categories definition
  const matchedDef = categoriesList.find((c) => {
    const cName = (c.name || '').trim().toLowerCase();
    const cAlt = (c.alternativeName || '').trim().toLowerCase();
    const subList = (c.storeCategories || []).map((sc) => (typeof sc === 'string' ? sc.toLowerCase() : (sc.label || sc.name || '').toLowerCase()));
    if (Array.isArray(c.subcategories)) {
      c.subcategories.forEach((sub) => subList.push(sub.toLowerCase()));
    }

    const matchesL = cName === lCat || cAlt === lCat || subList.includes(lCat);
    const matchesS = cName === sCat || cAlt === sCat || subList.includes(sCat);
    return matchesL && matchesS;
  });

  return Boolean(matchedDef);
};

// Smart City Matching Helper (Strict city separation - never bleeds into other cities)
const matchCity = (listingCity: string, searchCity: string, listingAddress?: string): boolean => {
  if (!searchCity || searchCity === 'all' || searchCity === 'all cities') return true;
  const sCity = searchCity.trim().toLowerCase();
  const lCity = (listingCity || '').trim().toLowerCase();
  const lAddr = (listingAddress || '').trim().toLowerCase();

  // If a listing has no city information, it does NOT match the requested city
  if (!lCity && !lAddr) return false;

  // 1. Exact city name match
  if (lCity === sCity) return true;

  // 2. City name contained in city field (e.g., "Kolkata, WB" matches "Kolkata")
  if (lCity.includes(sCity) || sCity.includes(lCity)) return true;

  // 3. Address match only if the city explicitly appears in address
  if (lAddr) {
    const cleanAddr = lAddr.replace(/[^a-z0-9\s]/g, ' ');
    const addrTokens = cleanAddr.split(/\s+/).filter(Boolean);
    if (addrTokens.includes(sCity) || lAddr.includes(sCity)) return true;
  }

  return false;
};

function ExploreContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const cityParam = searchParams.get('city') || '';
  const catParam = searchParams.get('category') || '';

  const [listings, setListings] = useState<Listing[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Progressive Infinite Scroll (Initial 10, then +5 on each scroll down)
  const INITIAL_LIMIT = 10;
  const SCROLL_BATCH = 5;
  const [visibleCount, setVisibleCount] = useState(INITIAL_LIMIT);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset pagination on search change
  useEffect(() => {
    setVisibleCount(INITIAL_LIMIT);
    setIsLoadingMore(false);
  }, [cityParam, catParam]);

  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [newsAds, setNewsAds] = useState<NewsItem[]>([]);
  const [targetCampaigns, setTargetCampaigns] = useState<TargetNewsBannerItem[]>([]);

  useEffect(() => {
    // Load categories & campaign banners directly from Cloud
    cloudSync.pullTargetNewsBanners().then((targets) => {
      if (targets && targets.length) setTargetCampaigns(targets);
    }).catch(() => {});

    cloudSync.pullCategories().then((cats) => {
      if (cats && cats.length) setCategories(cats);
    }).catch(() => {});
  }, []);

  const matchedTarget = useMemo(() => {
    if (!cityParam && !catParam) return null;
    return targetCampaigns.find((t) => {
      const cityMatch = !t.city || (cityParam && t.city.toLowerCase() === cityParam.toLowerCase());
      const catMatch = !t.category || (catParam && t.category.toLowerCase() === catParam.toLowerCase());
      return cityMatch && catMatch;
    });
  }, [targetCampaigns, cityParam, catParam]);

  useEffect(() => {
    // Saved bookmarks from cloud user profile
    try {
      const rawUser = localStorage.getItem('lb_current_user');
      if (rawUser) {
        const u = JSON.parse(rawUser);
        if (u && (u.id || u.uid)) {
          cloudSync.pullUserSavedPlaces(u.id || u.uid).then((places) => {
            if (places && places.length > 0) setSavedIds(places);
          }).catch(() => {});
        }
      }
    } catch {}

    // Load listings purely live from Cloud Firestore (Zero demo data)
    setLoading(true);
    cloudSync.pullListings().then((cloudItems) => {
      if (cloudItems && Array.isArray(cloudItems)) {
        setListings(cloudItems);
      } else {
        setListings([]);
      }
      setLoading(false);
    }).catch((err) => {
      console.error('Error loading live listings:', err);
      setListings([]);
      setLoading(false);
    });
  }, []);

  const toggleBookmark = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    let updated = [...savedIds];
    if (updated.includes(id)) {
      updated = updated.filter((x) => x !== id);
    } else {
      updated.push(id);
    }
    setSavedIds(updated);
    try {
      const rawUser = localStorage.getItem('lb_current_user');
      if (rawUser) {
        const u = JSON.parse(rawUser);
        if (u && (u.id || u.uid)) {
          cloudSync.saveUserSavedPlaces(u.id || u.uid, updated);
        }
      }
    } catch {}
  };

  // Filter listings
  const cityQuery = cityParam.trim().toLowerCase();
  const catQuery = catParam.trim().toLowerCase();

  const filtered = listings.filter((l) => {
    if (l.status?.toLowerCase() === 'rejected') return false;
    if (l.isPublic === false && (l.status?.toLowerCase() === 'draft' || l.status?.toLowerCase() === 'hidden')) {
      return false;
    }

    const matchesCity = matchCity(l.city || '', cityQuery, l.address);
    const matchesCat = matchCategory(l.category || '', catQuery, categories);

    return matchesCity && matchesCat;
  });

  // Priority Sorting:
  // 1. Trust Badge active listings ALWAYS appear first at the top!
  // 2. Among Trust Badge stores, sort by highest rating (descending), then review count
  // 3. Free (non-Trust Badge) stores appear below, also sorted by rating (descending), then review count
  const sortListingsByTrustAndRating = (list: Listing[]) => {
    return list.sort((a, b) => {
      const aTrust = isTrustBadgeActive(a) ? 1 : 0;
      const bTrust = isTrustBadgeActive(b) ? 1 : 0;
      if (aTrust !== bTrust) {
        return bTrust - aTrust; // Trust badge verified listings come first
      }
      const aRating = a.rating || 0;
      const bRating = b.rating || 0;
      if (bRating !== aRating) {
        return bRating - aRating; // Highest rating first
      }
      const aReviews = a.reviewsCount || 0;
      const bReviews = b.reviewsCount || 0;
      return bReviews - aReviews;
    });
  };

  sortListingsByTrustAndRating(filtered);

  // STRICT DIRECTORY RULE: Listings stay STRICTLY in their own city and category.
  // Never bleed or show listings from another city when a city search returns 0 results.
  const totalListings = filtered;
  const hasMore = visibleCount < totalListings.length;
  const displayedListings = totalListings.slice(0, visibleCount);

  // Progressive infinite scroll: loads +5 items automatically as user scrolls down
  useEffect(() => {
    if (!hasMore || isLoadingMore) return;

    // 1. Intersection Observer Trigger
    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first && first.isIntersecting && hasMore && !isLoadingMore) {
          setIsLoadingMore(true);
          setTimeout(() => {
            setVisibleCount((prev) => Math.min(prev + SCROLL_BATCH, totalListings.length));
            setIsLoadingMore(false);
          }, 280);
        }
      },
      { root: null, rootMargin: '180px', threshold: 0.1 }
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    // 2. Window Scroll Event Fallback (100% reliable across all mobile browsers)
    const onScroll = () => {
      if (isLoadingMore || !hasMore) return;
      const scrollY = window.scrollY || window.pageYOffset;
      const windowHeight = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;
      if (scrollY + windowHeight >= docHeight - 220) {
        setIsLoadingMore(true);
        setTimeout(() => {
          setVisibleCount((prev) => Math.min(prev + SCROLL_BATCH, totalListings.length));
          setIsLoadingMore(false);
        }, 280);
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
  }, [hasMore, isLoadingMore, totalListings.length]);

  let title = 'All Verified Places';
  if (catParam && cityParam) {
    title = `${catParam} in ${cityParam}`;
  } else if (catParam) {
    title = `${catParam}`;
  } else if (cityParam) {
    title = `Places in ${cityParam}`;
  }

  return (
    <div className="explore-body">
      <main className="explore-main">
        <div className="explore-container">
          {/* Clean Header Line */}
          <div className="clean-results-top">
            <div className="clean-results-left-wrap">
              <button
                type="button"
                className="explore-nav-back-btn"
                onClick={() => router.push('/')}
                title="Back to Home"
              >
                <i className="fa-solid fa-arrow-left"></i>
              </button>
              <h1 className="clean-results-title" id="resultsMainTitle">
                {title}
              </h1>
            </div>
            <span className="clean-badge-count" id="resultsCountBadge">
              {totalListings.length} {totalListings.length === 1 ? 'Place' : 'Places'}
            </span>
          </div>

          {/* Targeted News & Banners for this City / Category */}
          {matchedTarget && (
            <div style={{ marginBottom: '1.25rem' }}>
              {matchedTarget.textNews && (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.88rem', color: '#1e40af' }}>
                  <i className="fa-solid fa-bullhorn" style={{ color: '#2563eb' }}></i>
                  <span style={{ fontWeight: 600 }}>{matchedTarget.textNews}</span>
                </div>
              )}
              {matchedTarget.slideBanners && matchedTarget.slideBanners.length > 0 && (
                <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', scrollSnapType: 'x mandatory', paddingBottom: '0.5rem', scrollbarWidth: 'none' }}>
                  {matchedTarget.slideBanners.map((b) => (
                    <div
                      key={b.id}
                      style={{ flex: '0 0 auto', width: '280px', height: '120px', borderRadius: '12px', overflow: 'hidden', scrollSnapAlign: 'start', position: 'relative', border: '1px solid #e2e8f0', background: '#0f172a', boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={b.imageUrl} alt={b.title || 'Promotion'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      {b.title && (
                        <div style={{ position: 'absolute', bottom: 0, insetInline: 0, padding: '4px 8px', background: 'linear-gradient(to top, rgba(0,0,0,0.75), transparent)', color: '#fff', fontSize: '0.76rem', fontWeight: 700 }}>
                          {b.title}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Listings Feed */}
          {loading ? (
            <div className="listings-empty-state" style={{ padding: '3.5rem 1.5rem', textAlign: 'center' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  border: '3.5px solid #e2e8f0',
                  borderTopColor: '#1a73e8',
                  borderRadius: '50%',
                  margin: '0 auto 1.25rem',
                  animation: 'lbSpin 0.75s linear infinite',
                }}
              ></div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' }}>
                Searching Verified Places...
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
                Connecting to verified local records in {cityParam || 'your area'}...
              </p>
              <style>{`@keyframes lbSpin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : displayedListings.length === 0 ? (
            <div className="listings-empty-state" style={{ padding: '3.5rem 1.5rem', textAlign: 'center' }}>
              <i
                className="fa-solid fa-store-slash"
                style={{ fontSize: '3rem', color: '#cbd5e1', marginBottom: '1rem', display: 'block' }}
              ></i>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.5rem' }}>
                No places found in this area
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.92rem', maxWidth: '420px', margin: '0 auto 1.5rem' }}>
                We couldn&apos;t find verified {catParam ? `"${catParam}"` : 'businesses'} matching your search in{' '}
                {cityParam ? `"${cityParam}"` : 'this city'}.
              </p>
              <Link
                href="/"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1.75rem',
                  background: '#2563eb',
                  color: '#ffffff',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '0.92rem',
                  textDecoration: 'none',
                }}
              >
                <i className="fa-solid fa-arrow-left"></i> Try Another Search
              </Link>
            </div>
          ) : (
            <div className="listings-grid-feed" id="listingsGridFeed">
              {displayedListings.map((item) => {
                const coverImg =
                  item.image ||
                  (Array.isArray(item.gallery) && item.gallery[0]) ||
                  (Array.isArray(item.images) && item.images[0]) ||
                  'https://images.unsplash.com/photo-1497366216548-37526070297c?w=150&auto=format&fit=crop&q=80';

                const isSaved = savedIds.includes(item.id);
                const isTrusted = isTrustBadgeActive(item);

                let displayLocation = item.city || '';
                if (item.address) {
                  if (item.address.toLowerCase().includes((item.city || '').toLowerCase())) {
                    displayLocation = item.address;
                  } else {
                    displayLocation = `${item.city} • ${item.address}`;
                  }
                }

                return (
                  <Link
                    key={item.id}
                    href={`/shops/${encodeURIComponent(item.id)}`}
                    prefetch={true}
                    className="listing-compact-row"
                    title={`View details of ${item.name}`}
                  >
                    <div className="listing-row-left">
                      <img src={coverImg} alt={item.name} className="listing-row-thumb" />
                      <div className="listing-row-info">
                        <div className="listing-row-header">
                          <h3 className="listing-row-title" title={item.name}>
                            {item.name}
                            {isTrusted && (
                              <span className="listing-row-trust-pill" title="LocalBazar Verified & Trusted Business">
                                <i className="fa-solid fa-shield-halved"></i> Trust
                              </span>
                            )}
                          </h3>
                          <div className="listing-row-badges-wrap">
                            <span className="listing-row-cat-pill">{item.category || 'General'}</span>
                            {item.rating ? (
                              <div className="listing-row-rating-badge" title={`Customer Rating: ${item.rating} out of 5`}>
                                <i className="fa-solid fa-star"></i>
                                <span className="rating-val-num">{item.rating.toFixed(1)}</span>
                                {item.reviewsCount ? (
                                  <span className="rating-reviews-paren">({item.reviewsCount})</span>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </div>
                        <div className="listing-row-meta-line">
                          <span className="meta-item-loc">
                            <i className="fa-solid fa-location-dot"></i>
                            <span>{displayLocation}</span>
                          </span>
                          <span className="meta-item-time">
                            <i className="fa-regular fa-clock"></i>
                            <span>{item.scheduleTimings || '09:00 AM - 08:30 PM'}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="listing-row-right" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button
                        type="button"
                        className={`btn-row-bookmark ${isSaved ? 'active' : ''}`}
                        style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '50%',
                          border: `1px solid ${isSaved ? '#f59e0b' : '#e2e8f0'}`,
                          background: isSaved ? '#fef3c7' : '#ffffff',
                          color: isSaved ? '#d97706' : '#94a3b8',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                        }}
                        onClick={(e) => toggleBookmark(e, item.id)}
                        title={isSaved ? 'Saved to bookmarks' : 'Save place'}
                      >
                        <i className={`${isSaved ? 'fa-solid' : 'fa-regular'} fa-bookmark`}></i>
                      </button>
                      <span className="btn-view-profile-pill">
                        <span>Details</span>
                        <i className="fa-solid fa-chevron-right" style={{ fontSize: '0.72rem' }}></i>
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Silent Progressive Infinite Scroll (Seamless, No Text Popups) */}
          {hasMore && (
            <div
              ref={sentinelRef}
              style={{
                width: '100%',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0.75rem 0',
              }}
            >
              {isLoadingMore && (
                <i className="fa-solid fa-circle-notch fa-spin" style={{ color: '#94a3b8', fontSize: '1.15rem' }}></i>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function ExplorePage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: '4rem', textAlign: 'center', color: '#64748b' }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2rem', color: '#2563eb' }}></i>
          <p style={{ marginTop: '1rem', fontWeight: 600 }}>Loading LocalBazar Explore...</p>
        </div>
      }
    >
      <ExploreContent />
    </Suspense>
  );
}
