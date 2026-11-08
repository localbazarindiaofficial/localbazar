'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Listing, UserProfile, CategoryItem, StoreCategoryItem, CityItem, MailItem, ClaimItem, ClaimDocument, TrustRequest, TrustBadgeSettings, CityRequestItem, CategoryRequestItem, SlideBannerItem, TargetNewsBannerItem, EmptyStoreBannerSlot, isTrustBadgeActive, getTrustBadgeDaysRemaining, PromotedProductItem, ProductItem, formatTelUrl } from '@/types';
import { cloudSync, uploadImageToCloud, formatLBUserId } from '@/lib/firebase';
import '@/styles/admin.css';

const DEFAULT_ADMIN_EMAIL = 'localbazar@adminmanaspan.com';
const ADMIN_AUTH_SALT = 'lb_admin_auth_salt_9876';
const DEFAULT_ADMIN_PWD_HASH = '4e0d268d927e16d587c63f68290e711004538d0c769325991f0dcef7392145cb';

async function computeAdminPwdHash(pwd: string): Promise<string> {
  if (!pwd) return '';
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(pwd + ADMIN_AUTH_SALT);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    let h = 0;
    for (let i = 0; i < pwd.length; i++) {
      h = ((h << 5) - h) + pwd.charCodeAt(i);
      h |= 0;
    }
    return 'fb_' + Math.abs(h);
  }
}

export default function SuperAdminPage() {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [gateEmail, setGateEmail] = useState('');
  const [gatePwd, setGatePwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Panel View Navigation
  type AdminView = 'dashboard' | 'listings' | 'users' | 'claims' | 'trust' | 'cities' | 'categories' | 'mailbox' | 'news' | 'settings';
  const [activeView, setActiveView] = useState<AdminView>('dashboard');
  
  // Sidebar State (Mobile Drawer + Desktop Collapse)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false);

  const toggleSidebar = () => {
    if (typeof window !== 'undefined' && window.innerWidth <= 992) {
      setSidebarMobileOpen(prev => !prev);
    } else {
      setSidebarCollapsed(prev => !prev);
    }
  };

  const closeMobileSidebar = () => {
    setSidebarMobileOpen(false);
  };

  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== 'undefined' && window.innerWidth > 992) {
        setSidebarMobileOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Core Data
  const [listings, setListings] = useState<Listing[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [cities, setCities] = useState<CityItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [mailItems, setMailItems] = useState<MailItem[]>([]);
  const [claims, setClaims] = useState<ClaimItem[]>([]);
  const [claimSearch, setClaimSearch] = useState('');
  const [claimStatusFilter, setClaimStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  // Modals for Claim Approval, Rejection, Reply & Document Preview
  const [claimToApprove, setClaimToApprove] = useState<ClaimItem | null>(null);
  const [claimApprovalNote, setClaimApprovalNote] = useState('');
  const [claimToReject, setClaimToReject] = useState<ClaimItem | null>(null);
  const [claimRejectReason, setClaimRejectReason] = useState('');
  const [claimToReply, setClaimToReply] = useState<ClaimItem | null>(null);
  const [claimReplyText, setClaimReplyText] = useState('');
  const [claimDocPreview, setClaimDocPreview] = useState<{ name: string; url: string; type: string } | null>(null);
  const [trustRequests, setTrustRequests] = useState<TrustRequest[]>([]);

  // Trust Badge Pricing & QR Scanner Settings State
  const [trustBadgeSettings, setTrustBadgeSettings] = useState<TrustBadgeSettings>({
    originalPrice: 999,
    offerPrice: 299,
    period: 'Year',
    upiId: 'localbazar@upi',
    upiName: 'LocalBazar Official',
    qrImageUrl: '',
    instructions: 'Scan QR code via Google Pay, PhonePe, Paytm, or BHIM UPI, pay ₹299, and enter the 12-digit UTR/Reference number below.'
  });
  const [showTrustSettingsModal, setShowTrustSettingsModal] = useState(false);
  const [settingOrigPrice, setSettingOrigPrice] = useState('999');
  const [settingOfferPrice, setSettingOfferPrice] = useState('299');
  const [settingUpiId, setSettingUpiId] = useState('localbazar@upi');
  const [settingUpiName, setSettingUpiName] = useState('LocalBazar Official');
  const [settingQrImage, setSettingQrImage] = useState('');
  const [settingQrUploading, setSettingQrUploading] = useState(false);

  // Trust Requests Filter & Modals
  const [trustSearch, setTrustSearch] = useState('');
  const [trustStatusFilter, setTrustStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [trustToApprove, setTrustToApprove] = useState<TrustRequest | null>(null);
  const [trustApprovalNote, setTrustApprovalNote] = useState('');
  const [trustToReject, setTrustToReject] = useState<TrustRequest | null>(null);
  const [trustRejectReason, setTrustRejectReason] = useState('');
  const [trustDocPreview, setTrustDocPreview] = useState<{ name: string; url: string; type: string } | null>(null);
  const [cityRequests, setCityRequests] = useState<CityRequestItem[]>([]);
  const [catRequests, setCatRequests] = useState<CategoryRequestItem[]>([]);
  // News & Banner States (Home / Target / Empty Store / Product Promotion)
  const [newsTab, setNewsTab] = useState<'home' | 'target' | 'empty_store' | 'product_promotion'>('home');
  const [newsTicker, setNewsTicker] = useState('Welcome to LocalBazar - India\'s Trusted Hyperlocal Directory.');
  
  // Product Promotion States
  const [promotedProducts, setPromotedProducts] = useState<PromotedProductItem[]>([]);
  const [promoCityInput, setPromoCityInput] = useState('');
  const [promoCatInput, setPromoCatInput] = useState('');
  const [promoListingQuery, setPromoListingQuery] = useState('');
  const [selectedPromoListing, setSelectedPromoListing] = useState<Listing | null>(null);
  const [showPromoCitySugg, setShowPromoCitySugg] = useState(false);
  const [showPromoCatSugg, setShowPromoCatSugg] = useState(false);
  const [showPromoListingSugg, setShowPromoListingSugg] = useState(false);

  // Home Banners
  const [homeBanners, setHomeBanners] = useState<SlideBannerItem[]>([]);
  const [isHomeBannerModalOpen, setIsHomeBannerModalOpen] = useState(false);
  const [newHomeBannerTitle, setNewHomeBannerTitle] = useState('');
  const [newHomeBannerUrl, setNewHomeBannerUrl] = useState('');
  const [newHomeBannerLink, setNewHomeBannerLink] = useState('');

  // Target City & Category
  const [targetList, setTargetList] = useState<TargetNewsBannerItem[]>([]);
  const [targetCity, setTargetCity] = useState('');
  const [targetCat, setTargetCat] = useState('');
  const [targetTextNews, setTargetTextNews] = useState('');
  const [isTargetBannerModalOpen, setIsTargetBannerModalOpen] = useState(false);
  const [newTargetBannerTitle, setNewTargetBannerTitle] = useState('');
  const [newTargetBannerUrl, setNewTargetBannerUrl] = useState('');
  const [newTargetBannerLink, setNewTargetBannerLink] = useState('');

  // Empty Store Banners (3 Slots Max)
  const [emptyStoreBanners, setEmptyStoreBanners] = useState<EmptyStoreBannerSlot[]>([
    { slot: 1, title: 'Super Deals & Offers', imageUrl: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&auto=format&fit=crop&q=80', link: '', active: true },
    { slot: 2, title: 'Mega Savings Festival', imageUrl: 'https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?w=800&auto=format&fit=crop&q=80', link: '', active: true },
    { slot: 3, title: 'Fresh Quality Guaranteed', imageUrl: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800&auto=format&fit=crop&q=80', link: '', active: true },
  ]);

  // Listings Tab Filter & Modals
  const [listingFilterTab, setListingFilterTab] = useState<'all' | 'published' | 'draft' | 'pending' | 'rejected'>('all');
  const [listingSearch, setListingSearch] = useState('');
  const [listingCityFilter, setListingCityFilter] = useState('all');
  const [listingCategoryFilter, setListingCategoryFilter] = useState('all');
  const [viewingListingModal, setViewingListingModal] = useState<Listing | null>(null);
  const [hidingListingModal, setHidingListingModal] = useState<Listing | null>(null);
  const [hideListingConfirmText, setHideListingConfirmText] = useState('');
  const [deletingListingModal, setDeletingListingModal] = useState<Listing | null>(null);
  const [deleteListingConfirmText, setDeleteListingConfirmText] = useState('');

  // Users Filter & Modals
  const [userSearch, setUserSearch] = useState('');
  const [userFilterTab, setUserFilterTab] = useState<'all' | 'has_listings' | 'trust_badge' | 'blocked' | 'active'>('all');
  const [viewingUserModal, setViewingUserModal] = useState<UserProfile | null>(null);
  const [blockingUserModal, setBlockingUserModal] = useState<UserProfile | null>(null);
  const [blockConfirmText, setBlockConfirmText] = useState('');
  const [deletingUserModal, setDeletingUserModal] = useState<UserProfile | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // City & Category Modals
  const [citySearch, setCitySearch] = useState('');
  const [newCityName, setNewCityName] = useState('');
  const [newCityDistrict, setNewCityDistrict] = useState('');
  const [newCityState, setNewCityState] = useState('West Bengal');
  const [newCityPinCode, setNewCityPinCode] = useState('');
  const [isCityModalOpen, setIsCityModalOpen] = useState(false);
  const [editingCity, setEditingCity] = useState<CityItem | null>(null);
  const [editingCityOriginalName, setEditingCityOriginalName] = useState('');
  const [isCityRequestsModalOpen, setIsCityRequestsModalOpen] = useState(false);
  const [editingCityReq, setEditingCityReq] = useState<{ id: string; cityName: string; district?: string; state: string; pinCode?: string; popular: boolean } | null>(null);

  // Category State
  const [categorySearch, setCategorySearch] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [newCatAltName, setNewCatAltName] = useState('');
  const [newCatStoreCategories, setNewCatStoreCategories] = useState<StoreCategoryItem[]>([]);
  const [tempSubCatLabel, setTempSubCatLabel] = useState('');
  const [tempSubCatIcon, setTempSubCatIcon] = useState('🏷️');
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);

  // Edit Category State (All-in-one unified modal)
  const [editingCat, setEditingCat] = useState<CategoryItem | null>(null);
  const [editingCatOriginalName, setEditingCatOriginalName] = useState('');
  const [editSubCatLabel, setEditSubCatLabel] = useState('');
  const [editSubCatIcon, setEditSubCatIcon] = useState('🏷️');

  // Delete Category State
  const [deletingCatModal, setDeletingCatModal] = useState<CategoryItem | null>(null);
  const [deleteCatConfirmText, setDeleteCatConfirmText] = useState('');
  const [isCatRequestsModalOpen, setIsCatRequestsModalOpen] = useState(false);
  const [editingCatReq, setEditingCatReq] = useState<{ id: string; categoryName: string; icon: string } | null>(null);

  // Mailbox States (Inbox / Sent / Compose)
  const [mailTab, setMailTab] = useState<'inbox' | 'sent'>('inbox');
  const [mailSearch, setMailSearch] = useState('');
  const [activeMailDetail, setActiveMailDetail] = useState<MailItem | null>(null);
  const [composeModalOpen, setComposeModalOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeSending, setComposeSending] = useState(false);
  const [deletingMailItem, setDeletingMailItem] = useState<MailItem | null>(null);

  // Settings Credentials
  const [adminEmailInput, setAdminEmailInput] = useState('');
  const [adminNewPwd, setAdminNewPwd] = useState('');
  const [adminConfirmPwd, setAdminConfirmPwd] = useState('');
  const [settingsNotice, setSettingsNotice] = useState('');

  // 1. Initial Session Check (100% Cloud-First Data Architecture)
  const loadCachedData = () => {};

  // 1. Server-Side Cryptographic Session Verification (Zero Client Bypass)
  useEffect(() => {
    let isMounted = true;
    fetch('/api/admin/auth', { method: 'GET', credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data?.authenticated) {
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      })
      .catch(() => {
        if (isMounted) setIsAuthenticated(false);
      })
      .finally(() => {
        if (isMounted) setAuthChecking(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Background Asynchronous Revalidation from Cloud (Single Parallel Batch)
  const refreshAllData = async () => {
    try {
      const [
        cloudListings,
        cloudUsers,
        cloudCities,
        cloudCats,
        cloudMails,
        cloudClaims,
        cloudTrust,
        cloudCityReqs,
        cloudCatReqs,
        cloudSettings,
        cloudHomeBanners,
        cloudTargets,
        cloudEmptyStore,
        cloudTicker,
        cloudPromos
      ] = await Promise.all([
        cloudSync.pullListings().catch(() => []),
        cloudSync.pullUsers().catch(() => []),
        cloudSync.pullCities().catch(() => []),
        cloudSync.pullCategories().catch(() => []),
        cloudSync.pullMail().catch(() => []),
        cloudSync.pullClaims().catch(() => []),
        cloudSync.pullTrustRequests().catch(() => []),
        cloudSync.pullCityRequests().catch(() => []),
        cloudSync.pullCategoryRequests().catch(() => []),
        cloudSync.pullTrustBadgeSettings().catch(() => null),
        cloudSync.pullHomeBanners().catch(() => []),
        cloudSync.pullTargetNewsBanners().catch(() => []),
        cloudSync.pullEmptyStoreBanners().catch(() => []),
        cloudSync.pullNewsTicker().catch(() => null),
        cloudSync.pullPromotedProducts().catch(() => [])
      ]);

      if (Array.isArray(cloudListings) && cloudListings.length > 0) {
        setListings(cloudListings);
      }

      if (Array.isArray(cloudUsers) && cloudUsers.length > 0) {
        setUsers(cloudUsers);
      }

      if (Array.isArray(cloudCities) && cloudCities.length > 0) {
        setCities(cloudCities);
      }

      if (Array.isArray(cloudCats) && cloudCats.length > 0) {
        setCategories(cloudCats);
      }

      if (Array.isArray(cloudMails)) {
        setMailItems(cloudMails);
      }

      if (Array.isArray(cloudClaims)) {
        setClaims(cloudClaims);
      }

      if (Array.isArray(cloudTrust)) {
        setTrustRequests(cloudTrust);
      }

      if (cloudSettings) {
        setTrustBadgeSettings(cloudSettings);
        setSettingOrigPrice(String(cloudSettings.originalPrice || 999));
        setSettingOfferPrice(String(cloudSettings.offerPrice || 299));
        setSettingUpiId(cloudSettings.upiId || 'localbazar@upi');
        setSettingUpiName(cloudSettings.upiName || 'LocalBazar Official');
        setSettingQrImage(cloudSettings.qrImageUrl || '');
      }

      if (Array.isArray(cloudCityReqs)) {
        setCityRequests(cloudCityReqs);
      }

      if (Array.isArray(cloudCatReqs)) {
        setCatRequests(cloudCatReqs);
      }

      if (cloudHomeBanners && cloudHomeBanners.length > 0) {
        setHomeBanners(cloudHomeBanners);
      }

      if (cloudTargets && cloudTargets.length > 0) {
        setTargetList(cloudTargets);
      }

      if (cloudEmptyStore && cloudEmptyStore.length > 0) {
        setEmptyStoreBanners(cloudEmptyStore);
      }

      if (cloudTicker) {
        setNewsTicker(cloudTicker);
      }

      if (Array.isArray(cloudPromos)) {
        setPromotedProducts(cloudPromos);
      }
    } catch (err) {
      console.warn('Error refreshing admin data:', err);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      refreshAllData();
    }
  }, [isAuthenticated]);

  // Handle Login Authentication via Secure Server Route (Zero Client-Side Hash Leaks)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsVerifying(true);

    try {
      const email = gateEmail.trim();
      const pwd = gatePwd;

      // Verify credentials on Next.js Server & obtain HttpOnly signed session cookie
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'login', email, password: pwd }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data?.success) {
        setIsAuthenticated(true);
        setGatePwd('');
      } else {
        setAuthError(data?.error || 'Invalid Admin ID or Secret Password.');
      }
    } catch {
      setAuthError('Authentication verification failed.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleLogout = async () => {
    if (confirm('Are you sure you want to log out from the Admin Command Center?')) {
      try {
        await fetch('/api/admin/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ action: 'logout' }),
        });
      } catch {}
      setIsAuthenticated(false);
      setGatePwd('');
    }
  };

  // Deduplicated Unique Users by Email or ID
  const uniqueUsers = useMemo(() => {
    const emailMap = new Map<string, UserProfile>();
    const withoutEmail: UserProfile[] = [];

    for (const rawU of users) {
      if (!rawU) continue;
      const stdId = formatLBUserId(rawU.email || rawU.id);
      const rawUid = rawU.uid || (!String(rawU.id).startsWith('LB') ? String(rawU.id) : undefined);
      const u: UserProfile = {
        ...rawU,
        id: stdId,
        uid: rawUid,
      };

      const emailKey = u.email ? u.email.trim().toLowerCase() : '';
      if (emailKey) {
        if (!emailMap.has(emailKey)) {
          emailMap.set(emailKey, u);
        } else {
          const existing = emailMap.get(emailKey)!;
          emailMap.set(emailKey, {
            ...existing,
            ...u,
            id: stdId,
            uid: existing.uid || u.uid,
            phone: u.phone || existing.phone || '',
            city: u.city || existing.city || '',
            state: u.state || existing.state || '',
            pincode: u.pincode || existing.pincode || '',
            verified: u.verified ?? existing.verified ?? true,
          });
        }
      } else {
        const idKey = String(u.id || '');
        if (!withoutEmail.some((x) => String(x.id) === idKey)) {
          withoutEmail.push(u);
        }
      }
    }
    return [...Array.from(emailMap.values()), ...withoutEmail];
  }, [users]);

  // Metrics Counters
  const metrics = useMemo(() => {
    const totalUsers = uniqueUsers.length;
    const totalListings = listings.length;
    const draftListings = listings.filter((l) => l.isPublic === false || l.status === 'draft' || l.status === 'Draft').length;
    const publishedListings = listings.filter((l) => (!l.status || l.status === 'approved' || l.status === 'published') && l.isPublic !== false).length;
    const pendingListings = listings.filter((l) => l.status === 'pending').length;
    const rejectedListings = listings.filter((l) => l.status === 'rejected').length;
    const pendingClaims = claims.filter((c) => (c.status || '').toLowerCase() === 'pending').length;
    const totalCities = cities.length;
    const totalCategories = categories.length;
    const totalCityRequests = cityRequests.filter((r) => (r.status || '').toLowerCase() === 'pending').length;
    const totalCatRequests = catRequests.filter((r) => (r.status || '').toLowerCase() === 'pending').length;
    const approvedTrust = listings.filter((l) => l.trustBadge).length;
    const pendingTrust = trustRequests.filter((t) => (t.status || '').toLowerCase() === 'pending').length;
    const totalMails = mailItems.filter((m) => !m.isSent && m.folder !== 'sent' && m.from !== 'admin').length;
    const unreadMails = mailItems.filter((m) => !m.read && !m.isSent && m.folder !== 'sent' && m.from !== 'admin').length;

    return {
      totalUsers,
      totalListings,
      publishedListings,
      draftListings,
      pendingListings,
      rejectedListings,
      pendingClaims,
      totalCities,
      totalCategories,
      totalCityRequests,
      totalCatRequests,
      approvedTrust,
      pendingTrust,
      totalMails,
      unreadMails
    };
  }, [users, listings, claims, cities, categories, cityRequests, catRequests, trustRequests, mailItems]);

  // Listings operations
  const handleApproveListing = async (listingId: string) => {
    const target = listings.find((l) => String(l.id) === String(listingId));
    if (!target) return;
    const updated: Listing = { ...target, status: 'approved', isPublic: true };
    const nextListings = listings.map((l) => (String(l.id) === String(listingId) ? updated : l));
    setListings(nextListings);
    await cloudSync.saveListing(updated);
  };

  const handleRejectListing = async (listingId: string) => {
    const target = listings.find((l) => String(l.id) === String(listingId));
    if (!target) return;
    const updated: Listing = { ...target, status: 'rejected' };
    const nextListings = listings.map((l) => (String(l.id) === String(listingId) ? updated : l));
    setListings(nextListings);
    await cloudSync.saveListing(updated);
  };

  // Toggle Hide / Unhide Listing (Public vs Draft/Hidden)
  const handleConfirmToggleHideListing = async () => {
    if (!hidingListingModal) return;
    if (hideListingConfirmText.trim().toUpperCase() !== 'CONFIRM') {
      alert('Please type "CONFIRM" to proceed.');
      return;
    }

    const target = hidingListingModal;
    const isCurrentlyPublic = target.isPublic !== false && target.status !== 'draft';
    const updated: Listing = {
      ...target,
      isPublic: !isCurrentlyPublic,
      status: !isCurrentlyPublic ? 'approved' : 'draft'
    };

    const nextListings = listings.map((l) => (String(l.id) === String(target.id) ? updated : l));
    setListings(nextListings);
    await cloudSync.saveListing(updated);

    setHidingListingModal(null);
    setHideListingConfirmText('');
  };

  // Permanently Delete Single Listing with CONFIRM
  const handleConfirmDeleteListing = async () => {
    if (!deletingListingModal) return;
    if (deleteListingConfirmText.trim().toUpperCase() !== 'CONFIRM') {
      alert('Please type "CONFIRM" to proceed.');
      return;
    }

    const targetId = deletingListingModal.id;
    const nextListings = listings.filter((l) => String(l.id) !== String(targetId));
    setListings(nextListings);
    await cloudSync.deleteListing(targetId);

    setDeletingListingModal(null);
    setDeleteListingConfirmText('');
  };

  const handleToggleVerifiedBadge = async (listingId: string) => {
    const target = listings.find((l) => String(l.id) === String(listingId));
    if (!target) return;
    const updated: Listing = { ...target, verified: !target.verified };
    const nextListings = listings.map((l) => (String(l.id) === String(listingId) ? updated : l));
    setListings(nextListings);
    await cloudSync.saveListing(updated);
  };

  const handleToggleTrustBadge = async (listingId: string) => {
    const target = listings.find((l) => String(l.id) === String(listingId));
    if (!target) return;
    const willEnable = !target.trustBadge;
    const updated: Listing = {
      ...target,
      trustBadge: willEnable,
      trustBadgeActivatedAt: willEnable ? Date.now() : undefined,
      trustBadgeExpiresAt: willEnable ? Date.now() + 365 * 24 * 60 * 60 * 1000 : undefined,
    };
    const nextListings = listings.map((l) => (String(l.id) === String(listingId) ? updated : l));
    setListings(nextListings);
    await cloudSync.saveListing(updated);
  };

  // Fast O(1) user listings lookup map
  const userListingsMap = useMemo(() => {
    const map = new Map<string, Listing[]>();
    for (const l of listings) {
      const keys = [
        l.ownerId?.toLowerCase(),
        l.createdBy?.toLowerCase(),
        l.ownerEmail?.toLowerCase(),
      ].filter(Boolean) as string[];

      for (const k of keys) {
        if (!map.has(k)) map.set(k, []);
        const arr = map.get(k)!;
        if (!arr.some((x) => String(x.id) === String(l.id))) {
          arr.push(l);
        }
      }
    }
    return map;
  }, [listings]);

  // Helper: Find listings owned by a user (Fast & Strictly by ID/Email, never by general shop phone)
  const getUserListings = useCallback((u: UserProfile | null): Listing[] => {
    if (!u) return [];
    const uId = String(u.id || '').toLowerCase();
    const uUid = String(u.uid || '').toLowerCase();
    const uEmail = String(u.email || '').toLowerCase();

    const results = new Map<string, Listing>();
    if (uId && userListingsMap.has(uId)) {
      for (const l of userListingsMap.get(uId)!) results.set(String(l.id), l);
    }
    if (uUid && userListingsMap.has(uUid)) {
      for (const l of userListingsMap.get(uUid)!) results.set(String(l.id), l);
    }
    if (uEmail && userListingsMap.has(uEmail)) {
      for (const l of userListingsMap.get(uEmail)!) results.set(String(l.id), l);
    }
    return Array.from(results.values());
  }, [userListingsMap]);

  // Toggle Block / Unblock User
  const handleConfirmToggleBlockUser = async () => {
    if (!blockingUserModal) return;
    if (blockConfirmText.trim().toUpperCase() !== 'CONFIRM') {
      alert('Please type "CONFIRM" to proceed.');
      return;
    }

    const targetUser = blockingUserModal;
    const isCurrentlyBlocked = !!(targetUser.blocked || targetUser.isBlocked);
    const updatedUser: UserProfile = {
      ...targetUser,
      blocked: !isCurrentlyBlocked,
      isBlocked: !isCurrentlyBlocked
    };

    const nextUsers = users.map((u) => (String(u.id) === String(targetUser.id) ? updatedUser : u));
    setUsers(nextUsers);
    await cloudSync.saveUser(updatedUser);

    setBlockingUserModal(null);
    setBlockConfirmText('');
  };

  // Permanently Delete User AND All Their Listings
  const handleConfirmDeleteUserAndListings = async () => {
    if (!deletingUserModal) return;
    if (deleteConfirmText.trim().toUpperCase() !== 'CONFIRM') {
      alert('Please type "CONFIRM" to proceed.');
      return;
    }

    const targetUser = deletingUserModal;
    const userOwnedListings = getUserListings(targetUser);

    // 1. Delete all user listings
    const listingIdsToDelete = new Set(userOwnedListings.map((l) => String(l.id)));
    const nextListings = listings.filter((l) => !listingIdsToDelete.has(String(l.id)));
    setListings(nextListings);

    for (const l of userOwnedListings) {
      await cloudSync.deleteListing(l.id);
    }

    // 2. Delete user profile
    const nextUsers = users.filter((u) => String(u.id) !== String(targetUser.id));
    setUsers(nextUsers);
    await cloudSync.deleteUser(targetUser.id);

    setDeletingUserModal(null);
    setDeleteConfirmText('');
  };

  // City operations
  const handleAddCity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCityName.trim()) return;
    const newCity: CityItem = {
      name: newCityName.trim(),
      district: newCityDistrict.trim(),
      state: newCityState.trim() || 'India',
      pinCode: newCityPinCode.replace(/^[#\s]+/, '').trim()
    };
    const nextCities = [...cities.filter((c) => c.name.toLowerCase() !== newCity.name.toLowerCase()), newCity].sort((a, b) => a.name.localeCompare(b.name));
    setCities(nextCities);
    await cloudSync.saveCity(newCity);
    setNewCityName('');
    setNewCityDistrict('');
    setNewCityState('West Bengal');
    setNewCityPinCode('');
    setIsCityModalOpen(false);
  };

  const handleSaveEditedCity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCity || !editingCity.name.trim()) return;
    const origName = editingCityOriginalName || editingCity.name;
    const updatedCity: CityItem = {
      ...editingCity,
      name: editingCity.name.trim(),
      district: (editingCity.district || '').trim(),
      state: (editingCity.state || '').trim() || 'India',
      pinCode: (editingCity.pinCode || '').replace(/^[#\s]+/, '').trim()
    };
    const nextCities = cities.map((c) => (c.name.toLowerCase() === origName.toLowerCase() ? updatedCity : c));
    setCities(nextCities);
    if (origName.toLowerCase() !== updatedCity.name.toLowerCase()) {
      await cloudSync.deleteCity(origName).catch(() => {});
    }
    await cloudSync.saveCity(updatedCity);
    setEditingCity(null);
    setEditingCityOriginalName('');
  };

  const handleDeleteCity = async (cityName: string) => {
    if (!confirm(`Delete city "${cityName}"?`)) return;
    const nextCities = cities.filter((c) => c.name.toLowerCase() !== cityName.toLowerCase());
    setCities(nextCities);
    await cloudSync.deleteCity(cityName);
  };

  const handleApproveCityRequest = async (id: string, name: string, district?: string, state?: string, pinCode?: string) => {
    const cleanName = name.trim();
    if (!cleanName) return;

    // 1. Add clean edited city to cities list
    const newCity: CityItem = {
      name: cleanName,
      district: (district || '').trim(),
      state: (state || '').trim() || 'India',
      pinCode: (pinCode || '').replace(/^[#\s]+/, '').trim()
    };
    const nextCities = [...cities.filter((c) => c.name.toLowerCase() !== newCity.name.toLowerCase()), newCity].sort((a, b) => a.name.localeCompare(b.name));
    setCities(nextCities);
    await cloudSync.saveCity(newCity);

    // 2. Permanently remove / delete this request from list and cloud
    const nextReqs = cityRequests.filter((r) => r.id !== id);
    setCityRequests(nextReqs);
    await cloudSync.deleteCityRequest(id);
    setEditingCityReq(null);
  };

  const handleRejectCityRequest = async (id: string) => {
    if (!confirm('Are you sure you want to reject and remove this city request?')) return;
    const nextReqs = cityRequests.filter((r) => r.id !== id);
    setCityRequests(nextReqs);
    await cloudSync.deleteCityRequest(id);
    if (editingCityReq?.id === id) setEditingCityReq(null);
  };

  // Category operations
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    const newCat: CategoryItem = {
      name: newCatName.trim(),
      alternativeName: newCatAltName.trim(),
      icon: 'fa-store',
      storeCategories: newCatStoreCategories
    };
    const nextCats = [...categories.filter((c) => c.name.toLowerCase() !== newCat.name.toLowerCase()), newCat].sort((a, b) => a.name.localeCompare(b.name));
    setCategories(nextCats);
    await cloudSync.saveCategory(newCat);
    setNewCatName('');
    setNewCatAltName('');
    setNewCatStoreCategories([]);
    setTempSubCatLabel('');
    setTempSubCatIcon('🏷️');
    setIsCatModalOpen(false);
  };

  // Add/Remove subcategories in Add Modal
  const handleAddSubCatToNew = () => {
    if (!tempSubCatLabel.trim()) return;
    const label = tempSubCatLabel.trim();
    const tag = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    if (newCatStoreCategories.some((s) => s.tag === tag || s.label.toLowerCase() === label.toLowerCase())) {
      alert('This subcategory is already in the list.');
      return;
    }
    setNewCatStoreCategories([...newCatStoreCategories, { label, tag, icon: tempSubCatIcon || '🏷️' }]);
    setTempSubCatLabel('');
    setTempSubCatIcon('🏷️');
  };

  const handleRemoveSubCatFromNew = (tag: string) => {
    setNewCatStoreCategories(newCatStoreCategories.filter((s) => s.tag !== tag));
  };

  // Save edited category (all in one)
  const handleSaveEditedCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCat || !editingCat.name.trim()) return;
    const origName = editingCatOriginalName || editingCat.name;
    const updatedCat: CategoryItem = {
      ...editingCat,
      name: editingCat.name.trim(),
      alternativeName: (editingCat.alternativeName || '').trim(),
      icon: editingCat.icon || 'fa-store',
      storeCategories: editingCat.storeCategories || []
    };
    const nextCats = categories.map((c) => (c.name.toLowerCase() === origName.toLowerCase() ? updatedCat : c));
    setCategories(nextCats);
    if (origName.toLowerCase() !== updatedCat.name.toLowerCase()) {
      await cloudSync.deleteCategory(origName).catch(() => {});
    }
    await cloudSync.saveCategory(updatedCat);
    setEditingCat(null);
    setEditingCatOriginalName('');
  };

  // Add/Remove subcategories in Edit Modal
  const handleAddSubCatToEdit = () => {
    if (!editingCat || !editSubCatLabel.trim()) return;
    const label = editSubCatLabel.trim();
    const tag = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const existing = editingCat.storeCategories || [];
    if (existing.some((s) => (typeof s === 'string' ? s : s.tag) === tag || (typeof s === 'string' ? s : (s.label || '')).toLowerCase() === label.toLowerCase())) {
      alert('This subcategory already exists.');
      return;
    }
    const updatedStoreCats = [...existing, { label, tag, icon: editSubCatIcon || '🏷️' }];
    setEditingCat({ ...editingCat, storeCategories: updatedStoreCats });
    setEditSubCatLabel('');
    setEditSubCatIcon('🏷️');
  };

  const handleRemoveSubCatFromEdit = (tagToRemove: string) => {
    if (!editingCat) return;
    const existing = editingCat.storeCategories || [];
    const updatedStoreCats = existing.filter((s) => (typeof s === 'string' ? s !== tagToRemove : s.tag !== tagToRemove));
    setEditingCat({ ...editingCat, storeCategories: updatedStoreCats });
  };

  const handleConfirmDeleteCategory = async () => {
    if (!deletingCatModal) return;
    if (deleteCatConfirmText.trim().toUpperCase() !== 'CONFIRM') {
      alert('Please type "CONFIRM" to proceed.');
      return;
    }
    const catName = deletingCatModal.name;
    const nextCats = categories.filter((c) => c.name.toLowerCase() !== catName.toLowerCase());
    setCategories(nextCats);
    await cloudSync.deleteCategory(catName);
    setDeletingCatModal(null);
    setDeleteCatConfirmText('');
  };

  const handleApproveCatRequest = async (id: string, name: string, icon: string) => {
    const cleanName = name.trim();
    if (!cleanName) return;

    // 1. Add clean edited category to categories list
    const newCat: CategoryItem = {
      name: cleanName,
      icon: icon.trim() || 'fa-store',
      storeCategories: [
        { label: 'Popular', tag: 'popular', icon: '🔥' },
        { label: 'Featured', tag: 'featured', icon: '⭐' }
      ]
    };
    const nextCats = [...categories.filter((c) => c.name.toLowerCase() !== newCat.name.toLowerCase()), newCat].sort((a, b) => a.name.localeCompare(b.name));
    setCategories(nextCats);
    await cloudSync.saveCategory(newCat);

    // 2. Permanently remove / delete this request from list and cloud
    const nextReqs = catRequests.filter((r) => r.id !== id);
    setCatRequests(nextReqs);
    await cloudSync.deleteCategoryRequest(id);
    setEditingCatReq(null);
  };

  const handleRejectCatRequest = async (id: string) => {
    if (!confirm('Are you sure you want to reject and remove this category request?')) return;
    const nextReqs = catRequests.filter((r) => r.id !== id);
    setCatRequests(nextReqs);
    await cloudSync.deleteCategoryRequest(id);
    if (editingCatReq?.id === id) setEditingCatReq(null);
  };

  // Claims Filter & Handlers
  const filteredClaims = useMemo(() => {
    let result = claims;
    if (claimStatusFilter !== 'all') {
      result = result.filter((c) => (c.status || '').toLowerCase() === claimStatusFilter);
    }
    if (claimSearch.trim()) {
      const q = claimSearch.trim().toLowerCase();
      result = result.filter(
        (c) =>
          c.listingName?.toLowerCase().includes(q) ||
          c.claimantName?.toLowerCase().includes(q) ||
          c.applicantName?.toLowerCase().includes(q) ||
          c.claimantPhone?.includes(q) ||
          c.applicantPhone?.includes(q) ||
          c.city?.toLowerCase().includes(q) ||
          c.category?.toLowerCase().includes(q) ||
          c.id?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [claims, claimStatusFilter, claimSearch]);

  const handleApproveClaimConfirm = async () => {
    if (!claimToApprove) return;
    const claim = claimToApprove;

    // 1. Reassign listing ownership
    const targetListing = listings.find((l) => String(l.id) === String(claim.listingId));
    if (targetListing) {
      const claimantId = claim.claimantId || (claim.claimantEmail ? formatLBUserId(claim.claimantEmail) : targetListing.ownerId);
      const updatedListing: Listing = {
        ...targetListing,
        ownerId: claimantId,
        ownerEmail: claim.claimantEmail || claim.applicantEmail || targetListing.ownerEmail,
        ownerName: claim.claimantName || claim.applicantName || targetListing.ownerName,
        createdBy: claimantId,
        verified: true,
        lastUpdated: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      };
      const nextListings = listings.map((l) => (String(l.id) === String(targetListing.id) ? updatedListing : l));
      setListings(nextListings);
      await cloudSync.saveListing(updatedListing);
    }

    // 2. Mark claim as Approved
    const updatedClaim: ClaimItem = {
      ...claim,
      status: 'approved',
      adminReply: claimApprovalNote.trim() || 'Your ownership claim has been verified and approved.',
      updatedAt: Date.now()
    };
    const nextClaims = claims.map((c) => (c.id === claim.id ? updatedClaim : c));
    setClaims(nextClaims);
    await cloudSync.saveClaim(updatedClaim);

    setClaimToApprove(null);
    setClaimApprovalNote('');
    alert(`Claim Approved! Ownership of "${claim.listingName}" reassigned to ${claim.claimantName || claim.applicantName}.`);
  };

  const handleRejectClaimConfirm = async () => {
    if (!claimToReject) return;
    if (!claimRejectReason.trim()) {
      alert('Please enter a rejection reason explaining why the claim cannot be approved.');
      return;
    }
    const claim = claimToReject;
    const updatedClaim: ClaimItem = {
      ...claim,
      status: 'rejected',
      adminReply: claimRejectReason.trim(),
      updatedAt: Date.now()
    };
    const nextClaims = claims.map((c) => (c.id === claim.id ? updatedClaim : c));
    setClaims(nextClaims);
    await cloudSync.saveClaim(updatedClaim);

    setClaimToReject(null);
    setClaimRejectReason('');
    alert(`Claim Marked as Rejected. Feedback recorded for user.`);
  };

  const handleSendClaimReply = async () => {
    if (!claimToReply) return;
    if (!claimReplyText.trim()) {
      alert('Please enter a message or reply.');
      return;
    }
    const claim = claimToReply;
    const updatedClaim: ClaimItem = {
      ...claim,
      adminReply: claimReplyText.trim(),
      updatedAt: Date.now()
    };
    const nextClaims = claims.map((c) => (c.id === claim.id ? updatedClaim : c));
    setClaims(nextClaims);
    await cloudSync.saveClaim(updatedClaim);

    setClaimToReply(null);
    setClaimReplyText('');
    alert(`Reply sent to ${claim.claimantName || claim.applicantName || 'claimant'}.`);
  };

  const handleDeleteClaim = async (claimId: string) => {
    if (!confirm('Are you sure you want to permanently delete this claim?')) return;
    const nextClaims = claims.filter((c) => c.id !== claimId);
    setClaims(nextClaims);
    await cloudSync.deleteClaim(claimId);
  };

  const getAdminDocIcon = (type: string) => {
    const t = (type || '').toLowerCase();
    if (['pdf'].includes(t)) return { icon: 'fa-file-pdf', color: '#ef4444', label: 'PDF' };
    if (['doc', 'docx'].includes(t)) return { icon: 'fa-file-word', color: '#2563eb', label: 'Word' };
    if (['xls', 'xlsx', 'csv'].includes(t)) return { icon: 'fa-file-excel', color: '#16a34a', label: 'Excel' };
    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(t)) return { icon: 'fa-file-image', color: '#d97706', label: 'Image' };
    return { icon: 'fa-file-lines', color: '#64748b', label: 'Doc' };
  };

  // Legacy wrappers for compatibility
  const handleApproveClaim = async (claim: ClaimItem) => {
    setClaimToApprove(claim);
    setClaimApprovalNote('');
  };

  const handleRejectClaim = async (claim: ClaimItem) => {
    setClaimToReject(claim);
    setClaimRejectReason('');
  };

  // Trust Badge Requests Filter & Handlers
  const filteredTrustRequests = useMemo(() => {
    let result = trustRequests;
    if (trustStatusFilter !== 'all') {
      result = result.filter((t) => (t.status || '').toLowerCase() === trustStatusFilter);
    }
    if (trustSearch.trim()) {
      const q = trustSearch.trim().toLowerCase();
      result = result.filter(
        (t) =>
          t.businessName?.toLowerCase().includes(q) ||
          t.listingName?.toLowerCase().includes(q) ||
          t.applicantName?.toLowerCase().includes(q) ||
          t.ownerName?.toLowerCase().includes(q) ||
          t.phone?.includes(q) ||
          t.transactionId?.toLowerCase().includes(q) ||
          t.tradeLicense?.toLowerCase().includes(q) ||
          t.city?.toLowerCase().includes(q) ||
          t.id?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [trustRequests, trustStatusFilter, trustSearch]);

  const handleSaveTrustSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const orig = parseFloat(settingOrigPrice) || 999;
    const offer = parseFloat(settingOfferPrice) || 299;
    if (offer <= 0) {
      alert('Offer price must be greater than 0');
      return;
    }
    const newSettings: TrustBadgeSettings = {
      originalPrice: orig,
      offerPrice: offer,
      period: 'Year',
      upiId: settingUpiId.trim() || 'localbazar@upi',
      upiName: settingUpiName.trim() || 'LocalBazar Official',
      qrImageUrl: settingQrImage.trim(),
      instructions: trustBadgeSettings.instructions || 'Scan QR code and pay.',
      updatedAt: Date.now()
    };
    setTrustBadgeSettings(newSettings);
    await cloudSync.saveTrustBadgeSettings(newSettings);
    setShowTrustSettingsModal(false);
    alert('Trust Badge pricing & QR scanner settings saved successfully!');
  };

  const handleQrFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSettingQrUploading(true);
    try {
      const url = await uploadImageToCloud(file, 60, 1200);
      if (url) {
        setSettingQrImage(url);
        alert('QR code image uploaded successfully!');
      }
    } catch (err) {
      console.error('Failed to upload QR code:', err);
      alert('Failed to upload QR image. Please try again.');
    } finally {
      setSettingQrUploading(false);
    }
  };

  const handleApproveTrustConfirm = async () => {
    if (!trustToApprove) return;
    const req = trustToApprove;
    const targetListing = listings.find((l) => String(l.id) === String(req.listingId));
    if (targetListing) {
      const now = Date.now();
      const oneYearMs = 365 * 24 * 60 * 60 * 1000;
      const updatedListing: Listing = {
        ...targetListing,
        trustBadge: true,
        verified: true,
        trustBadgeActivatedAt: now,
        trustBadgeExpiresAt: now + oneYearMs,
        lastUpdated: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      };
      const nextListings = listings.map((l) => (String(l.id) === String(targetListing.id) ? updatedListing : l));
      setListings(nextListings);
      await cloudSync.saveListing(updatedListing);
    }
    const updatedReq: TrustRequest = {
      ...req,
      status: 'approved',
      adminReply: trustApprovalNote.trim() || 'Gold Verified Trust Badge activated.',
      updatedAt: Date.now()
    };
    const nextReqs = trustRequests.map((t) => (t.id === req.id ? updatedReq : t));
    setTrustRequests(nextReqs);
    await cloudSync.saveTrustRequest(updatedReq);

    setTrustToApprove(null);
    setTrustApprovalNote('');
    alert(`Gold Trust Badge approved & activated for "${req.businessName || req.listingName}"!`);
  };

  const handleRejectTrustConfirm = async () => {
    if (!trustToReject) return;
    if (!trustRejectReason.trim()) {
      alert('Please enter a rejection reason.');
      return;
    }
    const req = trustToReject;
    const updatedReq: TrustRequest = {
      ...req,
      status: 'rejected',
      adminReply: trustRejectReason.trim(),
      updatedAt: Date.now()
    };
    const nextReqs = trustRequests.map((t) => (t.id === req.id ? updatedReq : t));
    setTrustRequests(nextReqs);
    await cloudSync.saveTrustRequest(updatedReq);

    setTrustToReject(null);
    setTrustRejectReason('');
    alert(`Trust application marked as Rejected. Reason recorded for user.`);
  };

  const handleDeleteTrustRequest = async (id: string) => {
    if (!confirm('Are you sure you want to delete this trust badge application?')) return;
    const nextReqs = trustRequests.filter((t) => t.id !== id);
    setTrustRequests(nextReqs);
    await cloudSync.deleteTrustRequest(id);
  };

  // Legacy wrapper
  const handleApproveTrust = async (req: TrustRequest) => {
    setTrustToApprove(req);
    setTrustApprovalNote('');
  };

  // Current active target item
  const currentTargetItem = useMemo(() => {
    return targetList.find(
      (t) => (t.city || '').toLowerCase() === (targetCity || '').toLowerCase() &&
             (t.category || '').toLowerCase() === (targetCat || '').toLowerCase()
    );
  }, [targetList, targetCity, targetCat]);

  useEffect(() => {
    if (currentTargetItem) {
      setTargetTextNews(currentTargetItem.textNews || '');
    } else {
      setTargetTextNews('');
    }
  }, [currentTargetItem]);

  // Helper: Process and crop local image to exact 16:9 aspect ratio and compressed Base64
  const processBannerFile = (file: File, targetRatio = 16 / 9): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!file || !file.type.startsWith('image/')) return resolve(null);
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const targetWidth = 1280;
          const targetHeight = 720;
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(e.target?.result as string);

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          const imgRatio = img.width / img.height;
          let sx = 0, sy = 0, sWidth = img.width, sHeight = img.height;
          if (imgRatio > targetRatio) {
            sWidth = Math.round(img.height * targetRatio);
            sx = Math.round((img.width - sWidth) / 2);
          } else {
            sHeight = Math.round(img.width / targetRatio);
            sy = Math.round((img.height - sHeight) / 2);
          }

          ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          resolve(dataUrl);
        };
        img.onerror = () => resolve(e.target?.result as string);
        img.src = e.target?.result as string;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  };

  const handleHomeBannerFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await processBannerFile(file);
    if (base64) {
      setNewHomeBannerUrl(base64);
    }
  };

  const handleTargetBannerFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await processBannerFile(file);
    if (base64) {
      setNewTargetBannerUrl(base64);
    }
  };

  const handleEmptyStoreFileChange = async (slotNum: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const base64 = await processBannerFile(file);
    if (base64) {
      handleUpdateEmptyStoreSlot(slotNum, 'imageUrl', base64);
    }
  };

  // 1. Home News & Banners Handlers
  const handleSaveHomeNewsTicker = async (e: React.FormEvent) => {
    e.preventDefault();
    await cloudSync.saveNewsTicker(newsTicker).catch(() => {});
    alert('Home marquee announcement updated successfully!');
  };

  const handleAddHomeBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHomeBannerUrl.trim()) {
      alert('Please select or upload a 16:9 banner image from your device.');
      return;
    }
    const newBanner: SlideBannerItem = {
      id: 'h_ban_' + Date.now(),
      title: newHomeBannerTitle.trim() || 'Home Slide Banner',
      imageUrl: newHomeBannerUrl.trim(),
      link: newHomeBannerLink.trim(),
      active: true,
      createdAt: Date.now(),
    };
    const updated = [newBanner, ...homeBanners];
    setHomeBanners(updated);
    await cloudSync.saveHomeBanners(updated).catch(() => {});
    setNewHomeBannerTitle('');
    setNewHomeBannerUrl('');
    setNewHomeBannerLink('');
    setIsHomeBannerModalOpen(false);
    alert('Home slide banner added successfully!');
  };

  const handleDeleteHomeBanner = async (bannerId: string) => {
    if (!confirm('Are you sure you want to delete this home slide banner?')) return;
    const updated = homeBanners.filter(b => b.id !== bannerId);
    setHomeBanners(updated);
    await cloudSync.saveHomeBanners(updated).catch(() => {});
  };

  // 2. Target City & Category Handlers
  const handleSaveTargetNews = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCity || !targetCat) {
      alert('Please select a City and Category.');
      return;
    }
    let updatedList = [...targetList];
    const existingIdx = updatedList.findIndex(
      (t) => (t.city || '').toLowerCase() === targetCity.toLowerCase() &&
             (t.category || '').toLowerCase() === targetCat.toLowerCase()
    );

    if (existingIdx >= 0) {
      updatedList[existingIdx] = {
        ...updatedList[existingIdx],
        textNews: targetTextNews.trim(),
        updatedAt: Date.now(),
      };
    } else {
      updatedList.push({
        id: `target_${Date.now()}`,
        city: targetCity,
        category: targetCat,
        textNews: targetTextNews.trim(),
        slideBanners: [],
        updatedAt: Date.now(),
      });
    }

    setTargetList(updatedList);
    await cloudSync.saveTargetNewsBanners(updatedList).catch(() => {});
    alert(`Target text news saved for ${targetCity} & ${targetCat}!`);
  };

  const handleAddTargetBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCity || !targetCat) {
      alert('Please select a City and Category.');
      return;
    }
    if (!newTargetBannerUrl.trim()) {
      alert('Please enter a banner image URL.');
      return;
    }

    const newBanner: SlideBannerItem = {
      id: 't_ban_' + Date.now(),
      title: newTargetBannerTitle.trim() || `${targetCity} - ${targetCat} Banner`,
      imageUrl: newTargetBannerUrl.trim(),
      link: newTargetBannerLink.trim(),
      active: true,
      createdAt: Date.now(),
    };

    let updatedList = [...targetList];
    const existingIdx = updatedList.findIndex(
      (t) => (t.city || '').toLowerCase() === targetCity.toLowerCase() &&
             (t.category || '').toLowerCase() === targetCat.toLowerCase()
    );

    if (existingIdx >= 0) {
      const existingBanners = updatedList[existingIdx].slideBanners || [];
      updatedList[existingIdx] = {
        ...updatedList[existingIdx],
        slideBanners: [newBanner, ...existingBanners],
        updatedAt: Date.now(),
      };
    } else {
      updatedList.push({
        id: `target_${Date.now()}`,
        city: targetCity,
        category: targetCat,
        textNews: targetTextNews.trim(),
        slideBanners: [newBanner],
        updatedAt: Date.now(),
      });
    }

    setTargetList(updatedList);
    await cloudSync.saveTargetNewsBanners(updatedList).catch(() => {});
    setNewTargetBannerTitle('');
    setNewTargetBannerUrl('');
    setNewTargetBannerLink('');
    setIsTargetBannerModalOpen(false);
    alert(`Target slide banner added for ${targetCity} & ${targetCat}!`);
  };

  const handleDeleteTargetBanner = async (bannerId: string) => {
    if (!confirm('Are you sure you want to delete this target banner?')) return;
    let updatedList = [...targetList];
    const existingIdx = updatedList.findIndex(
      (t) => (t.city || '').toLowerCase() === targetCity.toLowerCase() &&
             (t.category || '').toLowerCase() === targetCat.toLowerCase()
    );
    if (existingIdx >= 0) {
      const filteredBanners = (updatedList[existingIdx].slideBanners || []).filter(b => b.id !== bannerId);
      updatedList[existingIdx] = {
        ...updatedList[existingIdx],
        slideBanners: filteredBanners,
        updatedAt: Date.now(),
      };
      setTargetList(updatedList);
      await cloudSync.saveTargetNewsBanners(updatedList).catch(() => {});
    }
  };

  const handleDeleteTargetRule = async (targetId: string) => {
    if (!confirm('Are you sure you want to delete this entire targeted rule?')) return;
    const updated = targetList.filter(t => t.id !== targetId);
    setTargetList(updated);
    await cloudSync.saveTargetNewsBanners(updated).catch(() => {});
  };

  // 3. Empty Store Handlers
  const handleUpdateEmptyStoreSlot = (slotNum: number, field: keyof EmptyStoreBannerSlot, value: any) => {
    setEmptyStoreBanners(prev => prev.map(s => s.slot === slotNum ? { ...s, [field]: value } : s));
  };

  const handleSaveAllEmptyStoreBanners = async () => {
    await cloudSync.saveEmptyStoreBanners(emptyStoreBanners).catch(() => {});
    alert('All 3 Empty Store fallback banners have been updated & saved successfully!');
  };

  // 4. Product Promotion Handlers
  const handleToggleProductPromotion = async (prod: ProductItem, shop: Listing) => {
    if (!prod || !shop) return;
    const prodKey = String(prod.id || prod.name || '').trim();
    const existingIdx = promotedProducts.findIndex((p) => p.shopId === shop.id && p.productId === prodKey);

    let updatedList: PromotedProductItem[];
    if (existingIdx >= 0) {
      updatedList = promotedProducts.filter((_, i) => i !== existingIdx);
    } else {
      const rawImg = (prod.images && prod.images.length > 0 && prod.images[0]) || prod.image || prod.img || shop.image || '';
      const newItem: PromotedProductItem = {
        id: `promo_${shop.id}_${prodKey}_${Date.now()}`,
        shopId: shop.id,
        shopName: shop.name,
        shopCity: shop.city || '',
        shopCategory: shop.category || '',
        productId: prodKey,
        productName: prod.name,
        price: prod.price || '',
        image: rawImg,
        addedAt: Date.now(),
      };
      updatedList = [newItem, ...promotedProducts];
    }

    setPromotedProducts(updatedList);
    await cloudSync.savePromotedProducts(updatedList).catch(() => {});
  };

  const handleRemovePromotedProduct = async (promoId: string) => {
    const updatedList = promotedProducts.filter((p) => p.id !== promoId);
    setPromotedProducts(updatedList);
    await cloudSync.savePromotedProducts(updatedList).catch(() => {});
  };

  // Change Admin Credentials in Settings
  const handleSaveSettingsCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsNotice('');

    if (adminNewPwd && adminNewPwd !== adminConfirmPwd) {
      alert('Passwords do not match.');
      return;
    }

    try {
      let pwdHash = DEFAULT_ADMIN_PWD_HASH;
      if (adminNewPwd) {
        pwdHash = await computeAdminPwdHash(adminNewPwd);
      }
      const email = adminEmailInput.trim() || DEFAULT_ADMIN_EMAIL;

      await cloudSync.saveAdminSecurity({ pwdHash, email });
      setSettingsNotice('Admin credentials updated successfully.');
      setAdminNewPwd('');
      setAdminConfirmPwd('');
    } catch {
      alert('Failed to update credentials.');
    }
  };

  // Export JSON Backup
  const handleExportBackup = () => {
    const data = {
      timestamp: new Date().toISOString(),
      listings,
      users,
      cities,
      categories,
      claims,
      trustRequests,
      mailItems
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `localbazar-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filtered Listings
  const displayListings = useMemo(() => {
    let list = [...listings];
    if (listingFilterTab === 'pending') {
      list = list.filter((l) => l.status === 'pending');
    } else if (listingFilterTab === 'draft') {
      list = list.filter((l) => l.isPublic === false || l.status === 'draft' || l.status === 'Draft');
    } else if (listingFilterTab === 'published') {
      list = list.filter((l) => (!l.status || l.status === 'approved' || l.status === 'published') && l.isPublic !== false);
    } else if (listingFilterTab === 'rejected') {
      list = list.filter((l) => l.status === 'rejected');
    }

    if (listingCityFilter !== 'all') {
      list = list.filter((l) => (l.city || '').toLowerCase() === listingCityFilter.toLowerCase());
    }

    if (listingCategoryFilter !== 'all') {
      list = list.filter((l) => (l.category || '').toLowerCase() === listingCategoryFilter.toLowerCase());
    }

    if (listingSearch.trim()) {
      const q = listingSearch.toLowerCase().trim();
      list = list.filter(
        (l) =>
          (l.name || '').toLowerCase().includes(q) ||
          (l.city || '').toLowerCase().includes(q) ||
          (l.category || '').toLowerCase().includes(q) ||
          String(l.id).toLowerCase().includes(q) ||
          (l.phone || '').includes(q)
      );
    }
    return list;
  }, [listings, listingFilterTab, listingCityFilter, listingCategoryFilter, listingSearch]);

  // Filtered Users
  const displayUsers = useMemo(() => {
    let list = [...uniqueUsers];

    // Filter by tab
    if (userFilterTab === 'has_listings') {
      list = list.filter((u) => getUserListings(u).length > 0);
    } else if (userFilterTab === 'trust_badge') {
      list = list.filter((u) => getUserListings(u).some((l) => l.trustBadge));
    } else if (userFilterTab === 'blocked') {
      list = list.filter((u) => u.blocked || u.isBlocked);
    } else if (userFilterTab === 'active') {
      list = list.filter((u) => !u.blocked && !u.isBlocked);
    }

    if (userSearch.trim()) {
      const q = userSearch.toLowerCase().trim();
      list = list.filter(
        (u) =>
          (u.name || '').toLowerCase().includes(q) ||
          (u.email || '').toLowerCase().includes(q) ||
          (u.phone || '').includes(q) ||
          String(u.id).toLowerCase().includes(q)
      );
    }
    return list;
  }, [uniqueUsers, listings, userFilterTab, userSearch]);

  // Filtered Cities
  const displayCities = useMemo(() => {
    if (!citySearch.trim()) return cities;
    const q = citySearch.toLowerCase().trim();
    return cities.filter(
      (c) =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.district || '').toLowerCase().includes(q) ||
        (c.state || '').toLowerCase().includes(q) ||
        (c.pinCode || '').includes(q)
    );
  }, [cities, citySearch]);

  // Filtered Categories
  const displayCategories = useMemo(() => {
    if (!categorySearch.trim()) return categories;
    const q = categorySearch.toLowerCase().trim();
    return categories.filter(
      (c) =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.alternativeName || '').toLowerCase().includes(q) ||
        (Array.isArray(c.storeCategories) &&
          c.storeCategories.some((sc) =>
            (typeof sc === 'string' ? sc : sc.label || sc.tag).toLowerCase().includes(q)
          ))
    );
  }, [categories, categorySearch]);

  // Mailbox Filtering
  const inboxMails = useMemo(() => {
    return mailItems.filter(m => !m.isSent && m.folder !== 'sent' && m.from !== 'admin');
  }, [mailItems]);

  const sentMails = useMemo(() => {
    return mailItems.filter(m => m.isSent === true || m.folder === 'sent' || m.from === 'admin');
  }, [mailItems]);

  const displayMails = useMemo(() => {
    const list = mailTab === 'inbox' ? inboxMails : sentMails;
    if (!mailSearch.trim()) return list;
    const q = mailSearch.toLowerCase().trim();
    return list.filter((m) =>
      (m.subject || '').toLowerCase().includes(q) ||
      (m.senderName || '').toLowerCase().includes(q) ||
      (m.senderEmail || '').toLowerCase().includes(q) ||
      (m.senderPhone || '').toLowerCase().includes(q) ||
      (m.toEmail || '').toLowerCase().includes(q) ||
      (m.toName || '').toLowerCase().includes(q) ||
      (m.body || m.message || '').toLowerCase().includes(q)
    );
  }, [mailTab, inboxMails, sentMails, mailSearch]);

  const handleOpenMailDetail = async (m: MailItem) => {
    setActiveMailDetail(m);
    if (!m.read && !m.isSent && m.folder !== 'sent' && m.from !== 'admin') {
      const updated = mailItems.map(item => item.id === m.id ? { ...item, read: true } : item);
      setMailItems(updated);
      await cloudSync.saveMail({ ...m, read: true }).catch(() => {});
    }
  };

  const handleQuickReply = (m: MailItem) => {
    setComposeTo(m.senderEmail || '');
    setComposeSubject(m.subject?.startsWith('Re:') ? m.subject : `Re: ${m.subject || 'Inquiry'}`);
    setComposeBody(`\n\n--- In reply to message from ${m.senderName || 'Visitor'} ---\n${m.body || m.message || ''}`);
    setComposeModalOpen(true);
  };

  const handleSendComposeMail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeTo.trim()) {
      alert('Please enter a recipient email.');
      return;
    }
    if (!composeSubject.trim()) {
      alert('Please enter a subject.');
      return;
    }
    if (!composeBody.trim()) {
      alert('Please enter message content.');
      return;
    }

    setComposeSending(true);
    try {
      const newMail: MailItem = {
        id: `sent_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        toEmail: composeTo.trim(),
        from: 'admin',
        senderName: 'LocalBazar Super Admin',
        senderEmail: 'admin@localbazar.com',
        subject: composeSubject.trim(),
        message: composeBody.trim(),
        body: composeBody.trim(),
        date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        timestamp: Date.now(),
        read: true,
        folder: 'sent',
        isSent: true,
      };

      await cloudSync.saveMail(newMail).catch(err => console.warn('Cloud sync error for sent mail:', err));

      const matchedTicket = mailItems.find((m) => m.senderEmail?.toLowerCase() === composeTo.trim().toLowerCase());
      let updatedMails = [newMail, ...mailItems];
      if (matchedTicket) {
        const replyObj = {
          id: `rep_${Date.now()}`,
          sender: 'admin' as const,
          senderName: 'LocalBazar Super Admin',
          message: composeBody.trim(),
          timestamp: Date.now(),
          date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        };
        const updatedTicket: MailItem = {
          ...matchedTicket,
          status: 'replied',
          userRead: false,
          replies: [...(matchedTicket.replies || []), replyObj],
        };
        await cloudSync.saveMail(updatedTicket).catch(() => {});
        updatedMails = updatedMails.map((m) => (m.id === matchedTicket.id ? updatedTicket : m));
      }

      setMailItems(updatedMails);

      setComposeTo('');
      setComposeSubject('');
      setComposeBody('');
      setComposeModalOpen(false);
      setMailTab('sent');
      alert('Mail composed and saved successfully in System Sent folder!');
    } catch (err: any) {
      alert('Failed to send mail: ' + (err.message || 'Unknown error'));
    } finally {
      setComposeSending(false);
    }
  };

  const handleConfirmDeleteMail = async () => {
    if (!deletingMailItem) return;
    const targetId = deletingMailItem.id;
    const updated = mailItems.filter(m => m.id !== targetId);
    setMailItems(updated);
    if (activeMailDetail?.id === targetId) {
      setActiveMailDetail(null);
    }
    setDeletingMailItem(null);
    await cloudSync.deleteMail(targetId).catch((err) => console.warn('Cloud delete mail error:', err));
  };

  if (authChecking) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a' }}>
        <div style={{ width: 44, height: 44, border: '3.5px solid #334155', borderTopColor: '#38bdf8', borderRadius: '50%', animation: 'lbSpin 0.75s linear infinite' }}></div>
        <style>{`@keyframes lbSpin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ================= ADMIN LOGIN GATE =================
  if (!isAuthenticated) {
    return (
      <div className="admin-body">
        <div className="admin-login-stage" id="adminLoginGate">
          <div className="admin-login-modal-box">
            <div className="login-brand-head">
              <div className="login-brand-icon"><i className="fa-solid fa-shield-halved"></i></div>
              <h2>Local<span>Bazar</span></h2>
              <span className="login-role-tag">Super Admin Command Center</span>
            </div>

            <form onSubmit={handleLogin} className="admin-gate-form">
              {authError && (
                <div className="admin-login-error" style={{ display: 'flex' }}>
                  <i className="fa-solid fa-triangle-exclamation"></i>
                  <span>{authError}</span>
                </div>
              )}

              <div className="gate-field-group">
                <label htmlFor="adminGateEmail"><i className="fa-solid fa-user-shield"></i> Admin ID / Email</label>
                <input
                  type="email"
                  id="adminGateEmail"
                  placeholder="localbazar@adminmanaspan.com"
                  value={gateEmail}
                  onChange={(e) => setGateEmail(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>

              <div className="gate-field-group">
                <label htmlFor="adminGatePassword"><i className="fa-solid fa-key"></i> Secret Password</label>
                <div className="pwd-input-wrap">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    id="adminGatePassword"
                    placeholder="Enter super admin password"
                    value={gatePwd}
                    onChange={(e) => setGatePwd(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="btn-pwd-eye"
                    onClick={() => setShowPwd(!showPwd)}
                    title="Show/Hide Password"
                  >
                    <i className={`fa-regular ${showPwd ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                  </button>
                </div>
              </div>

              <button type="submit" className="btn-admin-gate-submit" disabled={isVerifying}>
                <i className={`fa-solid ${isVerifying ? 'fa-spinner fa-spin' : 'fa-lock-open'}`}></i>
                <span>{isVerifying ? 'Verifying...' : 'Authenticate & Access'}</span>
              </button>
            </form>

            <div className="admin-login-footer-notice">
              <i className="fa-solid fa-fingerprint"></i>
              <span>Strict Security: Access attempts are logged & verified.</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ================= MAIN ADMIN DASHBOARD =================
  return (
    <div className="admin-body">
      {/* Mobile Drawer Overlay */}
      <div
        className={`sidebar-overlay ${sidebarMobileOpen ? 'active' : ''}`}
        onClick={closeMobileSidebar}
      ></div>

      <div className="admin-wrapper" style={{ display: 'flex' }}>
        {/* Sidebar Navigation */}
        <aside className={`admin-sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${sidebarMobileOpen ? 'open' : ''}`} style={{ zIndex: 1000 }}>
          <div className="sidebar-brand">
            <div className="brand-icon-sm"><i className="fa-solid fa-store"></i></div>
            <div className="brand-info">
              <span className="brand-name">Local<span>Bazar</span></span>
              <span className="badge-role">Super Admin</span>
            </div>
            <button
              type="button"
              className="btn-close-sidebar-mobile"
              onClick={closeMobileSidebar}
              title="Close Sidebar"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>

          <nav className="sidebar-menu">
            <button
              type="button"
              className={`menu-item ${activeView === 'dashboard' ? 'active' : ''}`}
              onClick={() => { setActiveView('dashboard'); closeMobileSidebar(); }}
              style={{ background: 'none', border: 'none', textAlign: 'left', width: '100%', cursor: 'pointer' }}
            >
              <i className="fa-solid fa-chart-pie"></i>
              <span>Dashboard</span>
            </button>

            <button
              type="button"
              className={`menu-item ${activeView === 'users' ? 'active' : ''}`}
              onClick={() => { setActiveView('users'); closeMobileSidebar(); }}
              style={{ background: 'none', border: 'none', textAlign: 'left', width: '100%', cursor: 'pointer' }}
            >
              <i className="fa-solid fa-users"></i>
              <span>All Users</span>
              <span className="badge-count" style={{ marginLeft: 'auto' }}>{metrics.totalUsers}</span>
            </button>

            <button
              type="button"
              className={`menu-item ${activeView === 'listings' ? 'active' : ''}`}
              onClick={() => { setActiveView('listings'); closeMobileSidebar(); }}
              style={{ background: 'none', border: 'none', textAlign: 'left', width: '100%', cursor: 'pointer' }}
            >
              <i className="fa-solid fa-list-check"></i>
              <span>All Listings</span>
              <span className="badge-count" style={{ marginLeft: 'auto' }}>{metrics.totalListings}</span>
            </button>

            <button
              type="button"
              className={`menu-item ${activeView === 'claims' ? 'active' : ''}`}
              onClick={() => { setActiveView('claims'); closeMobileSidebar(); }}
              style={{ background: 'none', border: 'none', textAlign: 'left', width: '100%', cursor: 'pointer' }}
            >
              <i className="fa-solid fa-file-circle-check"></i>
              <span>Listing Claims</span>
              {metrics.pendingClaims > 0 && (
                <span className="badge-count-red" style={{ marginLeft: 'auto' }}>{metrics.pendingClaims}</span>
              )}
            </button>

            <button
              type="button"
              className={`menu-item ${activeView === 'trust' ? 'active' : ''}`}
              onClick={() => { setActiveView('trust'); closeMobileSidebar(); }}
              style={{ background: 'none', border: 'none', textAlign: 'left', width: '100%', cursor: 'pointer' }}
            >
              <i className="fa-solid fa-shield-halved" style={{ color: '#d97706' }}></i>
              <span>Trust Badges</span>
              {metrics.pendingTrust > 0 && (
                <span className="badge-count-red" style={{ marginLeft: 'auto' }}>{metrics.pendingTrust}</span>
              )}
            </button>

            <button
              type="button"
              className={`menu-item ${activeView === 'cities' ? 'active' : ''}`}
              onClick={() => { setActiveView('cities'); closeMobileSidebar(); }}
              style={{ background: 'none', border: 'none', textAlign: 'left', width: '100%', cursor: 'pointer' }}
            >
              <i className="fa-solid fa-map-location-dot"></i>
              <span>All Cities</span>
              <span className="badge-count" style={{ marginLeft: 'auto' }}>{metrics.totalCities}</span>
            </button>

            <button
              type="button"
              className={`menu-item ${activeView === 'categories' ? 'active' : ''}`}
              onClick={() => { setActiveView('categories'); closeMobileSidebar(); }}
              style={{ background: 'none', border: 'none', textAlign: 'left', width: '100%', cursor: 'pointer' }}
            >
              <i className="fa-solid fa-layer-group"></i>
              <span>All Categories</span>
              <span className="badge-count" style={{ marginLeft: 'auto' }}>{metrics.totalCategories}</span>
            </button>

            <button
              type="button"
              className={`menu-item ${activeView === 'mailbox' ? 'active' : ''}`}
              onClick={() => { setActiveView('mailbox'); closeMobileSidebar(); }}
              style={{ background: 'none', border: 'none', textAlign: 'left', width: '100%', cursor: 'pointer' }}
            >
              <i className="fa-regular fa-envelope"></i>
              <span>Mail Box</span>
              {metrics.unreadMails > 0 && (
                <span className="badge-count-red" style={{ marginLeft: 'auto' }}>{metrics.unreadMails}</span>
              )}
            </button>

            <button
              type="button"
              className={`menu-item ${activeView === 'news' ? 'active' : ''}`}
              onClick={() => { setActiveView('news'); closeMobileSidebar(); }}
              style={{ background: 'none', border: 'none', textAlign: 'left', width: '100%', cursor: 'pointer' }}
            >
              <i className="fa-solid fa-bullhorn"></i>
              <span>News & Banner</span>
            </button>

            <button
              type="button"
              className={`menu-item ${activeView === 'settings' ? 'active' : ''}`}
              onClick={() => { setActiveView('settings'); closeMobileSidebar(); }}
              style={{ background: 'none', border: 'none', textAlign: 'left', width: '100%', cursor: 'pointer' }}
            >
              <i className="fa-solid fa-sliders"></i>
              <span>Settings</span>
            </button>
          </nav>

          <div className="sidebar-footer">
            <button
              type="button"
              onClick={handleLogout}
              className="menu-item logout-btn"
              style={{ background: 'none', border: 'none', textAlign: 'left', width: '100%', cursor: 'pointer', color: '#ef4444' }}
            >
              <i className="fa-solid fa-arrow-right-from-bracket"></i>
              <span>Log Out</span>
            </button>
          </div>
        </aside>

        {/* Main Content Arena */}
        <main className={`admin-main ${sidebarCollapsed ? 'expanded' : ''}`} style={{ flex: 1, minHeight: '100vh', background: '#f8fafc', overflowX: 'hidden' }}>
          {/* Top Header */}
          <header className="main-topbar">
            <div className="topbar-left-group">
              <button
                type="button"
                className="btn-hamburger"
                onClick={toggleSidebar}
                title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
              >
                <i className="fa-solid fa-bars"></i>
              </button>
            </div>
          </header>

          {/* VIEW: DASHBOARD */}
          {activeView === 'dashboard' && (
            <div className="admin-view-panel active">
              <div className="dashboard-container" style={{ padding: '1.5rem' }}>
                <div className="dashboard-greeting" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a' }}>Platform Overview</h1>
                    <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Real-time metrics calculated from your live database.</p>
                  </div>
                  <div className="greeting-date" style={{ color: '#64748b', fontSize: '0.85rem' }}>
                    <i className="fa-regular fa-calendar"></i> Today
                  </div>
                </div>

                {/* 12 Stat Cards Grid */}
                <section className="stat-cards-grid">
                  {/* ROW 1: TOTAL USERS, TOTAL LISTINGS, DRAFT LISTINGS, LISTING CLAIMS */}
                  <div className="stat-card" onClick={() => setActiveView('users')} style={{ cursor: 'pointer' }}>
                    <div className="stat-card-header">
                      <span className="stat-label">Total Users</span>
                      <div className="stat-icon-wrap blue"><i className="fa-solid fa-users"></i></div>
                    </div>
                    <div className="stat-value">{metrics.totalUsers}</div>
                    <div className="stat-subtext">Google & Authenticated Users</div>
                  </div>

                  <div className="stat-card" onClick={() => { setActiveView('listings'); setListingFilterTab('all'); }} style={{ cursor: 'pointer' }}>
                    <div className="stat-card-header">
                      <span className="stat-label">Total Listings</span>
                      <div className="stat-icon-wrap emerald"><i className="fa-solid fa-store"></i></div>
                    </div>
                    <div className="stat-value">{metrics.totalListings}</div>
                    <div className="stat-subtext">Active places & businesses</div>
                  </div>

                  <div
                    className="stat-card highlight-card"
                    onClick={() => { setActiveView('listings'); setListingFilterTab('draft'); }}
                    style={{ cursor: 'pointer' }}
                    title="Click to view draft / unpublished listings"
                  >
                    <div className="stat-card-header">
                      <span className="stat-label">Draft Listings</span>
                      <div className="stat-icon-wrap amber"><i className="fa-solid fa-file-pen"></i></div>
                    </div>
                    <div className="stat-value">{metrics.draftListings}</div>
                    <div className="stat-subtext">{metrics.draftListings} unpublished by users</div>
                  </div>

                  <div className="stat-card" onClick={() => setActiveView('claims')} style={{ cursor: 'pointer' }}>
                    <div className="stat-card-header">
                      <span className="stat-label">Listing Claims</span>
                      <div className="stat-icon-wrap indigo" style={{ background: '#e0e7ff', color: '#4338ca' }}><i className="fa-solid fa-file-circle-check"></i></div>
                    </div>
                    <div className="stat-value">{claims.length}</div>
                    <div className="stat-subtext">{metrics.pendingClaims} pending claims</div>
                  </div>

                  {/* ROW 2: TOTAL CITY, TOTAL CATEGORY, REQUEST CITY, REQUEST CATEGORY */}
                  <div className="stat-card" onClick={() => setActiveView('cities')} style={{ cursor: 'pointer' }}>
                    <div className="stat-card-header">
                      <span className="stat-label">Total City</span>
                      <div className="stat-icon-wrap purple"><i className="fa-solid fa-map-location-dot"></i></div>
                    </div>
                    <div className="stat-value">{metrics.totalCities}</div>
                    <div className="stat-subtext">Registered city hubs</div>
                  </div>

                  <div className="stat-card" onClick={() => setActiveView('categories')} style={{ cursor: 'pointer' }}>
                    <div className="stat-card-header">
                      <span className="stat-label">Total Category</span>
                      <div className="stat-icon-wrap indigo"><i className="fa-solid fa-layer-group"></i></div>
                    </div>
                    <div className="stat-value">{metrics.totalCategories}</div>
                    <div className="stat-subtext">Managed sectors & groups</div>
                  </div>

                  <div
                    className="stat-card highlight-card"
                    onClick={() => setIsCityRequestsModalOpen(true)}
                    style={{ cursor: 'pointer' }}
                    title="Click to review requested cities"
                  >
                    <div className="stat-card-header">
                      <span className="stat-label">Request City</span>
                      <div className="stat-icon-wrap amber" style={{ background: '#fef3c7', color: '#d97706' }}><i className="fa-solid fa-city"></i></div>
                    </div>
                    <div className="stat-value">{metrics.totalCityRequests}</div>
                    <div className="stat-subtext">{metrics.totalCityRequests} pending requests</div>
                  </div>

                  <div
                    className="stat-card highlight-card"
                    onClick={() => setIsCatRequestsModalOpen(true)}
                    style={{ cursor: 'pointer' }}
                    title="Click to review requested categories"
                  >
                    <div className="stat-card-header">
                      <span className="stat-label">Request Category</span>
                      <div className="stat-icon-wrap cyan" style={{ background: '#e0f2fe', color: '#0284c7' }}><i className="fa-solid fa-tags"></i></div>
                    </div>
                    <div className="stat-value">{metrics.totalCatRequests}</div>
                    <div className="stat-subtext">{metrics.totalCatRequests} pending requests</div>
                  </div>

                  {/* ROW 3: TOTAL TRUST BADGE, TRUST BADGE REQUEST, TOTAL MAIL, UNREAD MAIL */}
                  <div className="stat-card" onClick={() => setActiveView('trust')} style={{ cursor: 'pointer' }}>
                    <div className="stat-card-header">
                      <span className="stat-label">Total Trust Badge</span>
                      <div className="stat-icon-wrap emerald" style={{ background: '#dcfce7', color: '#15803d' }}><i className="fa-solid fa-certificate"></i></div>
                    </div>
                    <div className="stat-value">{metrics.approvedTrust}</div>
                    <div className="stat-subtext">Verified gold stores</div>
                  </div>

                  <div className="stat-card" onClick={() => setActiveView('trust')} style={{ cursor: 'pointer' }}>
                    <div className="stat-card-header">
                      <span className="stat-label">Trust Badge Request</span>
                      <div className="stat-icon-wrap" style={{ background: '#fef3c7', color: '#d97706' }}><i className="fa-solid fa-shield-halved"></i></div>
                    </div>
                    <div className="stat-value">{trustRequests.length}</div>
                    <div className="stat-subtext">{metrics.pendingTrust} pending review</div>
                  </div>

                  <div className="stat-card" onClick={() => setActiveView('mailbox')} style={{ cursor: 'pointer' }}>
                    <div className="stat-card-header">
                      <span className="stat-label">Total Mail</span>
                      <div className="stat-icon-wrap cyan"><i className="fa-regular fa-envelope"></i></div>
                    </div>
                    <div className="stat-value">{metrics.totalMails}</div>
                    <div className="stat-subtext">Inbound user messages</div>
                  </div>

                  <div className="stat-card" onClick={() => setActiveView('mailbox')} style={{ cursor: 'pointer' }}>
                    <div className="stat-card-header">
                      <span className="stat-label">Unread Mail</span>
                      <div className="stat-icon-wrap red"><i className="fa-solid fa-envelope-open-text"></i></div>
                    </div>
                    <div className="stat-value">{metrics.unreadMails}</div>
                    <div className="stat-subtext">Pending user replies</div>
                  </div>
                </section>
              </div>
            </div>
          )}

          {/* VIEW: ALL LISTINGS */}
          {activeView === 'listings' && (
            <div className="admin-view-panel active" style={{ padding: '1.5rem' }}>
              {/* Header Title & Filter Tabs */}
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>All Business Listings</h1>
                  <p style={{ color: '#64748b', fontSize: '0.88rem' }}>Manage approvals, visibility, gold trust badges, and listings database.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setListingFilterTab('all')}
                    style={{ padding: '0.45rem 0.9rem', borderRadius: 8, border: '1px solid #cbd5e1', background: listingFilterTab === 'all' ? '#0f172a' : '#ffffff', color: listingFilterTab === 'all' ? '#ffffff' : '#334155', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
                  >
                    All ({listings.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setListingFilterTab('published')}
                    style={{ padding: '0.45rem 0.9rem', borderRadius: 8, border: '1px solid #10b981', background: listingFilterTab === 'published' ? '#10b981' : '#ecfdf5', color: listingFilterTab === 'published' ? '#ffffff' : '#047857', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
                  >
                    Published ({metrics.publishedListings})
                  </button>
                  <button
                    type="button"
                    onClick={() => setListingFilterTab('draft')}
                    style={{ padding: '0.45rem 0.9rem', borderRadius: 8, border: '1px solid #f59e0b', background: listingFilterTab === 'draft' ? '#f59e0b' : '#fffbeb', color: listingFilterTab === 'draft' ? '#ffffff' : '#b45309', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
                  >
                    Drafts ({metrics.draftListings})
                  </button>
                  <button
                    type="button"
                    onClick={() => setListingFilterTab('pending')}
                    style={{ padding: '0.45rem 0.9rem', borderRadius: 8, border: '1px solid #6366f1', background: listingFilterTab === 'pending' ? '#6366f1' : '#e0e7ff', color: listingFilterTab === 'pending' ? '#ffffff' : '#4338ca', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
                  >
                    Pending ({metrics.pendingListings})
                  </button>
                  <button
                    type="button"
                    onClick={() => setListingFilterTab('rejected')}
                    style={{ padding: '0.45rem 0.9rem', borderRadius: 8, border: '1px solid #ef4444', background: listingFilterTab === 'rejected' ? '#ef4444' : '#fef2f2', color: listingFilterTab === 'rejected' ? '#ffffff' : '#b91c1c', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
                  >
                    Rejected ({metrics.rejectedListings})
                  </button>
                </div>
              </div>

              {/* Search Bar + City & Category Filters */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div style={{ flex: 1, minWidth: '240px', maxWidth: '420px' }}>
                  <input
                    type="text"
                    placeholder="Search listings by name, phone, city, category, ID..."
                    value={listingSearch}
                    onChange={(e) => setListingSearch(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {/* City Filter */}
                  <select
                    value={listingCityFilter}
                    onChange={(e) => setListingCityFilter(e.target.value)}
                    style={{ padding: '0.55rem 0.85rem', borderRadius: 8, border: '1px solid #cbd5e1', background: '#ffffff', fontSize: '0.85rem', color: '#334155', cursor: 'pointer' }}
                  >
                    <option value="all">All Cities ({cities.length})</option>
                    {cities.map((c) => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>

                  {/* Category Filter */}
                  <select
                    value={listingCategoryFilter}
                    onChange={(e) => setListingCategoryFilter(e.target.value)}
                    style={{ padding: '0.55rem 0.85rem', borderRadius: 8, border: '1px solid #cbd5e1', background: '#ffffff', fontSize: '0.85rem', color: '#334155', cursor: 'pointer' }}
                  >
                    <option value="all">All Categories ({categories.length})</option>
                    {categories.map((c) => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>

                  {(listingSearch || listingCityFilter !== 'all' || listingCategoryFilter !== 'all') && (
                    <button
                      type="button"
                      onClick={() => {
                        setListingSearch('');
                        setListingCityFilter('all');
                        setListingCategoryFilter('all');
                      }}
                      style={{ padding: '0.55rem 0.85rem', borderRadius: 8, border: '1px solid #fecdd3', background: '#fff1f2', color: '#e11d48', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                      <i className="fa-solid fa-xmark"></i> Clear Filters
                    </button>
                  )}
                </div>
              </div>

              {/* Table */}
              <div style={{ background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', overflowX: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                      <th style={{ padding: '0.85rem 1rem' }}>Listing Name</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Category & City</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Mobile No</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Status</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Badge</th>
                      <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayListings.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8' }}>
                          No listings found matching your search or filters.
                        </td>
                      </tr>
                    ) : (
                      displayListings.map((l) => {
                        const isHiddenOrDraft = l.isPublic === false || l.status === 'draft' || l.status === 'Draft';

                        return (
                          <tr key={l.id} style={{ borderBottom: '1px solid #f1f5f9', background: isHiddenOrDraft ? '#fffbeb' : 'transparent' }}>
                            {/* 1. Listing Name */}
                            <td style={{ padding: '0.85rem 1rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={l.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100'}
                                  alt={l.name}
                                  style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover' }}
                                />
                                <div>
                                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{l.name}</div>
                                  <div style={{ color: '#64748b', fontSize: '0.78rem' }}>ID: <span style={{ color: '#1a73e8', fontWeight: 600 }}>{l.id}</span></div>
                                </div>
                              </div>
                            </td>

                            {/* 2. Category & City */}
                            <td style={{ padding: '0.85rem 1rem' }}>
                              <div style={{ color: '#0f172a', fontWeight: 600 }}>{l.category || 'General'}</div>
                              <div style={{ color: '#64748b', fontSize: '0.78rem' }}>{l.city || 'India'}</div>
                            </td>

                            {/* 3. Mobile No */}
                            <td style={{ padding: '0.85rem 1rem' }}>
                              <div style={{ color: '#334155', fontWeight: 600 }}>{l.phone || 'N/A'}</div>
                              {l.whatsapp && l.whatsapp !== l.phone && (
                                <div style={{ color: '#16a34a', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: 2 }}>
                                  <i className="fa-brands fa-whatsapp"></i> {l.whatsapp}
                                </div>
                              )}
                            </td>

                            {/* 4. Status */}
                            <td style={{ padding: '0.85rem 1rem' }}>
                              {isHiddenOrDraft ? (
                                <span style={{ background: '#fef3c7', color: '#b45309', padding: '0.25rem 0.6rem', borderRadius: 12, fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                                  <i className="fa-solid fa-eye-slash" style={{ fontSize: '0.7rem' }}></i> Hidden / Draft
                                </span>
                              ) : l.status === 'pending' ? (
                                <span style={{ background: '#e0e7ff', color: '#4338ca', padding: '0.25rem 0.6rem', borderRadius: 12, fontSize: '0.75rem', fontWeight: 700 }}>
                                  Pending
                                </span>
                              ) : l.status === 'rejected' ? (
                                <span style={{ background: '#fef2f2', color: '#b91c1c', padding: '0.25rem 0.6rem', borderRadius: 12, fontSize: '0.75rem', fontWeight: 700 }}>
                                  Rejected
                                </span>
                              ) : (
                                <span style={{ background: '#ecfdf5', color: '#047857', padding: '0.25rem 0.6rem', borderRadius: 12, fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                                  <i className="fa-solid fa-check" style={{ fontSize: '0.7rem' }}></i> Published
                                </span>
                              )}
                            </td>

                            {/* 5. Badge (ONLY Gold Trust Badge) */}
                            <td style={{ padding: '0.85rem 1rem' }}>
                              <button
                                type="button"
                                onClick={() => handleToggleTrustBadge(l.id)}
                                title={l.trustBadge ? 'Gold Trust Badge Active (Click to toggle)' : 'No Trust Badge (Click to grant Trust Badge)'}
                                style={{
                                  border: 'none',
                                  background: l.trustBadge ? '#fef3c7' : '#f1f5f9',
                                  color: l.trustBadge ? '#b45309' : '#94a3b8',
                                  padding: '0.35rem 0.7rem',
                                  borderRadius: 8,
                                  cursor: 'pointer',
                                  fontSize: '0.78rem',
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.35rem'
                                }}
                              >
                                <i className="fa-solid fa-shield-halved"></i> {l.trustBadge ? 'Gold Trust' : 'Trust'}
                              </button>
                            </td>

                            {/* 6. Actions (Eye, View/Hide, Delete) */}
                            <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: '0.45rem', alignItems: 'center' }}>
                                {/* 1. Eye Button: Full Listing Details */}
                                <button
                                  type="button"
                                  onClick={() => setViewingListingModal(l)}
                                  title="View Full Listing Details & Catalog"
                                  style={{
                                    background: '#eff6ff',
                                    color: '#2563eb',
                                    border: 'none',
                                    width: 32,
                                    height: 32,
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                >
                                  <i className="fa-solid fa-eye"></i>
                                </button>

                                {/* 2. Mail Button: Send Direct Email to Listing Owner */}
                                {(() => {
                                  const ownerUser = users.find(
                                    (u) =>
                                      (u.id && (u.id === l.ownerId || u.id === l.createdBy)) ||
                                      (u.email && l.ownerEmail && u.email.toLowerCase() === l.ownerEmail.toLowerCase()) ||
                                      (l.createdBy && u.email && u.email.toLowerCase() === l.createdBy.toLowerCase())
                                  );
                                  const ownerEmail = l.ownerEmail || (l.createdBy?.includes('@') ? l.createdBy : '') || ownerUser?.email || '';
                                  const ownerName = l.ownerName || ownerUser?.name || l.name;

                                  return (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setComposeTo(ownerEmail);
                                        setComposeSubject(`Important update regarding your listing "${l.name}"`);
                                        setComposeBody(`Dear ${ownerName},\n\nWe are contacting you from LocalBazar administration regarding your listing "${l.name}" (${l.category || 'Business'} in ${l.city || 'India'}).\n\n`);
                                        setComposeModalOpen(true);
                                      }}
                                      title={ownerEmail ? `Send Email to ${ownerName} (${ownerEmail})` : `Send Email to owner of ${l.name}`}
                                      style={{
                                        background: '#ecfdf5',
                                        color: '#059669',
                                        border: 'none',
                                        width: 32,
                                        height: 32,
                                        borderRadius: 6,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                      }}
                                    >
                                      <i className="fa-solid fa-envelope"></i>
                                    </button>
                                  );
                                })()}

                                {/* 2. View / Hide Button */}
                                <button
                                  type="button"
                                  onClick={() => { setHidingListingModal(l); setHideListingConfirmText(''); }}
                                  title={isHiddenOrDraft ? 'Unhide / Make Public' : 'Hide from Public'}
                                  style={{
                                    background: isHiddenOrDraft ? '#ecfdf5' : '#fffbeb',
                                    color: isHiddenOrDraft ? '#047857' : '#d97706',
                                    border: 'none',
                                    width: 32,
                                    height: 32,
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                >
                                  <i className={`fa-solid ${isHiddenOrDraft ? 'fa-eye' : 'fa-eye-slash'}`}></i>
                                </button>

                                {/* 3. Delete Button */}
                                <button
                                  type="button"
                                  onClick={() => { setDeletingListingModal(l); setDeleteListingConfirmText(''); }}
                                  title="Permanently Delete Listing"
                                  style={{
                                    background: '#fef2f2',
                                    color: '#ef4444',
                                    border: 'none',
                                    width: 32,
                                    height: 32,
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                >
                                  <i className="fa-solid fa-trash-can"></i>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW: ALL USERS */}
          {activeView === 'users' && (
            <div className="admin-view-panel active" style={{ padding: '1.5rem' }}>
              <div style={{ marginBottom: '1.25rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>Registered Users</h1>
                <p style={{ color: '#64748b', fontSize: '0.88rem' }}>All authenticated users, Google accounts &amp; merchants ({uniqueUsers.length}).</p>
              </div>

              {/* Search bar & Filter Bar */}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ flex: 1, minWidth: '260px', maxWidth: '420px' }}>
                  <input
                    type="text"
                    placeholder="Search users by name, email, phone, LB ID..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                  />
                </div>

                {/* Filter Tabs */}
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setUserFilterTab('all')}
                    style={{ padding: '0.45rem 0.8rem', borderRadius: 8, border: '1px solid #cbd5e1', background: userFilterTab === 'all' ? '#0f172a' : '#ffffff', color: userFilterTab === 'all' ? '#ffffff' : '#334155', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}
                  >
                    All ({uniqueUsers.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserFilterTab('has_listings')}
                    style={{ padding: '0.45rem 0.8rem', borderRadius: 8, border: '1px solid #2563eb', background: userFilterTab === 'has_listings' ? '#2563eb' : '#eff6ff', color: userFilterTab === 'has_listings' ? '#ffffff' : '#1d4ed8', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}
                  >
                    Has Listings ({uniqueUsers.filter((u) => getUserListings(u).length > 0).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserFilterTab('trust_badge')}
                    style={{ padding: '0.45rem 0.8rem', borderRadius: 8, border: '1px solid #d97706', background: userFilterTab === 'trust_badge' ? '#d97706' : '#fffbeb', color: userFilterTab === 'trust_badge' ? '#ffffff' : '#b45309', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}
                  >
                    Trust Badge ({uniqueUsers.filter((u) => getUserListings(u).some((l) => l.trustBadge)).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserFilterTab('blocked')}
                    style={{ padding: '0.45rem 0.8rem', borderRadius: 8, border: '1px solid #ef4444', background: userFilterTab === 'blocked' ? '#ef4444' : '#fef2f2', color: userFilterTab === 'blocked' ? '#ffffff' : '#b91c1c', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}
                  >
                    Blocked ({uniqueUsers.filter((u) => u.blocked || u.isBlocked).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserFilterTab('active')}
                    style={{ padding: '0.45rem 0.8rem', borderRadius: 8, border: '1px solid #10b981', background: userFilterTab === 'active' ? '#10b981' : '#ecfdf5', color: userFilterTab === 'active' ? '#ffffff' : '#047857', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}
                  >
                    Active ({uniqueUsers.filter((u) => !u.blocked && !u.isBlocked).length})
                  </button>
                </div>
              </div>

              {/* Users Table */}
              <div style={{ background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', overflowX: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                      <th style={{ padding: '0.85rem 1rem' }}>User ID</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Name & Email</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Total Listings</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Total Trust Badge</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Phone</th>
                      <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8' }}>
                          No users found matching your search.
                        </td>
                      </tr>
                    ) : (
                      displayUsers.map((u) => {
                        const userListings = getUserListings(u);
                        const trustCount = userListings.filter((l) => l.trustBadge).length;
                        const isBlocked = !!(u.blocked || u.isBlocked);

                        return (
                          <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9', background: isBlocked ? '#fff5f5' : 'transparent' }}>
                            <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#1a73e8' }}>
                              {u.id}
                            </td>
                            <td style={{ padding: '0.85rem 1rem' }}>
                              <div style={{ fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span>{u.name || 'Anonymous User'}</span>
                                {isBlocked && (
                                  <span style={{ background: '#fef2f2', color: '#ef4444', fontSize: '0.7rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: 4 }}>
                                    BLOCKED
                                  </span>
                                )}
                              </div>
                              <div style={{ color: '#64748b', fontSize: '0.78rem' }}>{u.email || 'No email registered'}</div>
                            </td>
                            <td style={{ padding: '0.85rem 1rem' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: userListings.length > 0 ? '#eff6ff' : '#f1f5f9', color: userListings.length > 0 ? '#1d4ed8' : '#64748b', padding: '0.25rem 0.65rem', borderRadius: 12, fontWeight: 700, fontSize: '0.82rem' }}>
                                <i className="fa-solid fa-store" style={{ fontSize: '0.75rem' }}></i> {userListings.length}
                              </span>
                            </td>
                            <td style={{ padding: '0.85rem 1rem' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: trustCount > 0 ? '#fef3c7' : '#f1f5f9', color: trustCount > 0 ? '#b45309' : '#64748b', padding: '0.25rem 0.65rem', borderRadius: 12, fontWeight: 700, fontSize: '0.82rem' }}>
                                <i className="fa-solid fa-shield-halved" style={{ fontSize: '0.75rem' }}></i> {trustCount}
                              </span>
                            </td>
                            <td style={{ padding: '0.85rem 1rem', color: '#334155' }}>
                              {u.phone || 'N/A'}
                            </td>
                            <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
                                {/* 1. Eye Button: View Details */}
                                <button
                                  type="button"
                                  onClick={() => setViewingUserModal(u)}
                                  title="View User Profile & Listings"
                                  style={{ background: '#eff6ff', color: '#2563eb', border: 'none', width: 32, height: 32, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  <i className="fa-solid fa-eye"></i>
                                </button>

                                {/* 2. Mail Button: Send Direct Mail */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setComposeTo(u.email || '');
                                    setComposeSubject(`Notice regarding your LocalBazar account (${u.name || 'User'})`);
                                    setComposeBody(`Dear ${u.name || 'User'},\n\n`);
                                    setComposeModalOpen(true);
                                  }}
                                  title={`Send Email to ${u.name || u.email || 'User'}`}
                                  style={{ background: '#ecfdf5', color: '#059669', border: 'none', width: 32, height: 32, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  <i className="fa-solid fa-envelope"></i>
                                </button>

                                {/* 3. Block / Unblock Button */}
                                <button
                                  type="button"
                                  onClick={() => { setBlockingUserModal(u); setBlockConfirmText(''); }}
                                  title={isBlocked ? 'Unblock User' : 'Block User'}
                                  style={{ background: isBlocked ? '#fef3c7' : '#fff1f2', color: isBlocked ? '#d97706' : '#e11d48', border: 'none', width: 32, height: 32, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  <i className={`fa-solid ${isBlocked ? 'fa-lock-open' : 'fa-ban'}`}></i>
                                </button>

                                {/* 4. Delete Button */}
                                <button
                                  type="button"
                                  onClick={() => { setDeletingUserModal(u); setDeleteConfirmText(''); }}
                                  title="Permanently Delete User & All Listings"
                                  style={{ background: '#fef2f2', color: '#ef4444', border: 'none', width: 32, height: 32, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  <i className="fa-solid fa-trash-can"></i>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW: CLAIMS */}
          {activeView === 'claims' && (
            <div className="admin-view-panel active" style={{ padding: '1.5rem' }}>
              <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>Listing Ownership Claims</h1>
                  <p style={{ color: '#64748b', fontSize: '0.88rem' }}>Review claims submitted by local shop owners seeking management rights & verify uploaded proof documents.</p>
                </div>

                {/* Filter Tabs */}
                <div style={{ display: 'flex', gap: '0.4rem', background: '#f1f5f9', padding: '0.3rem', borderRadius: '10px' }}>
                  {(['all', 'pending', 'approved', 'rejected'] as const).map((st) => {
                    const count = st === 'all'
                      ? claims.length
                      : claims.filter((c) => (c.status || '').toLowerCase() === st).length;
                    const isActive = claimStatusFilter === st;
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setClaimStatusFilter(st)}
                        style={{
                          padding: '0.45rem 0.85rem',
                          borderRadius: '8px',
                          border: 'none',
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          background: isActive ? '#fff' : 'transparent',
                          color: isActive ? '#0f172a' : '#64748b',
                          boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                          textTransform: 'capitalize',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                        }}
                      >
                        <span>{st}</span>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            padding: '0.08rem 0.45rem',
                            borderRadius: '999px',
                            background: isActive
                              ? st === 'pending'
                                ? '#fef3c7'
                                : st === 'approved'
                                ? '#ecfdf5'
                                : st === 'rejected'
                                ? '#fef2f2'
                                : '#e2e8f0'
                              : '#e2e8f0',
                            color: isActive
                              ? st === 'pending'
                                ? '#b45309'
                                : st === 'approved'
                                ? '#047857'
                                : st === 'rejected'
                                ? '#b91c1c'
                                : '#475569'
                              : '#64748b',
                            fontWeight: 800,
                          }}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Search Bar */}
              <div style={{ marginBottom: '1.25rem', position: 'relative' }}>
                <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}></i>
                <input
                  type="text"
                  placeholder="Search claims by listing name, claimant name, phone, city, or claim ID..."
                  value={claimSearch}
                  onChange={(e) => setClaimSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 1rem 0.65rem 2.4rem',
                    borderRadius: '10px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '0.88rem',
                    background: '#fff',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Claims List */}
              {filteredClaims.length === 0 ? (
                <div style={{ background: '#fff', padding: '3.5rem 1.5rem', borderRadius: 14, textAlign: 'center', color: '#94a3b8', border: '1px dashed #cbd5e1' }}>
                  <i className="fa-solid fa-file-circle-check" style={{ fontSize: '2.8rem', marginBottom: '0.85rem', display: 'block', color: '#cbd5e1' }}></i>
                  <h4 style={{ fontWeight: 800, color: '#334155', marginBottom: 4 }}>No Claims Found</h4>
                  <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                    {claimSearch || claimStatusFilter !== 'all'
                      ? 'No claim requests match your current search or status filter.'
                      : 'There are no listing claim submissions in the system right now.'}
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '1.15rem' }}>
                  {filteredClaims.map((c) => {
                    const st = (c.status || 'pending').toLowerCase();
                    const isApproved = st === 'approved';
                    const isRejected = st === 'rejected';
                    const isPending = !isApproved && !isRejected;

                    const claimantDisplayName = c.claimantName || c.applicantName || 'Anonymous Claimant';
                    const claimantPhone = c.claimantPhone || c.applicantPhone || '';
                    const claimantEmail = c.claimantEmail || c.applicantEmail || '';

                    return (
                      <div
                        key={c.id}
                        style={{
                          background: '#fff',
                          padding: '1.35rem',
                          borderRadius: 14,
                          border: isApproved ? '1.5px solid #86efac' : isRejected ? '1.5px solid #fca5a5' : '1px solid #e2e8f0',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                        }}
                      >
                        {/* Top Row: Listing Name & Badges */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '1.15rem' }}>{c.listingName}</span>
                              <span style={{ fontSize: '0.74rem', background: '#f1f5f9', color: '#64748b', padding: '0.15rem 0.55rem', borderRadius: 6, fontWeight: 700 }}>
                                Listing ID: {c.listingId}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 4, flexWrap: 'wrap', fontSize: '0.8rem', color: '#64748b' }}>
                              {c.city && <span><i className="fa-solid fa-location-dot" style={{ color: '#2563eb', marginRight: 3 }}></i>{c.city}</span>}
                              {c.category && (
                                <>
                                  <span>•</span>
                                  <span><i className="fa-solid fa-tag" style={{ color: '#16a34a', marginRight: 3 }}></i>{c.category}</span>
                                </>
                              )}
                              <span>•</span>
                              <span>Date: {c.date || 'Recent'}</span>
                              <span>•</span>
                              <span style={{ color: '#94a3b8' }}>Claim #{c.id}</span>
                            </div>
                          </div>

                          {/* Status Pill */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span
                              style={{
                                fontSize: '0.78rem',
                                fontWeight: 800,
                                padding: '0.3rem 0.8rem',
                                borderRadius: '999px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                background: isApproved ? '#ecfdf5' : isRejected ? '#fef2f2' : '#fef3c7',
                                color: isApproved ? '#047857' : isRejected ? '#b91c1c' : '#b45309',
                                border: isApproved ? '1px solid #a7f3d0' : isRejected ? '1px solid #fecdd3' : '1px solid #fde68a',
                              }}
                            >
                              <i className={`fa-solid ${isApproved ? 'fa-circle-check' : isRejected ? 'fa-circle-xmark' : 'fa-clock'}`}></i>
                              {isApproved ? 'Approved' : isRejected ? 'Rejected' : 'Pending Verification'}
                            </span>

                            <button
                              type="button"
                              onClick={() => handleDeleteClaim(c.id)}
                              title="Delete this claim"
                              style={{
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                color: '#94a3b8',
                                width: 30,
                                height: 30,
                                borderRadius: 8,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = '#ef4444';
                                e.currentTarget.style.borderColor = '#fca5a5';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = '#94a3b8';
                                e.currentTarget.style.borderColor = '#e2e8f0';
                              }}
                            >
                              <i className="fa-solid fa-trash-can" style={{ fontSize: '0.8rem' }}></i>
                            </button>
                          </div>
                        </div>

                        {/* Middle Grid: Claimant Info & Verification Documents */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '1rem' }}>
                          {/* Column 1: Claimant Details & Remarks */}
                          <div style={{ background: '#f8fafc', padding: '0.95rem', borderRadius: 10, border: '1px solid #f1f5f9' }}>
                            <div style={{ fontWeight: 800, fontSize: '0.82rem', color: '#475569', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <i className="fa-solid fa-user-tie" style={{ color: '#2563eb' }}></i> Claimant Information
                            </div>
                            <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a' }}>{claimantDisplayName}</div>
                            <div style={{ fontSize: '0.82rem', color: '#475569', marginTop: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                              {claimantPhone && (
                                <a href={formatTelUrl(claimantPhone)} style={{ color: '#2563eb', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                  <i className="fa-solid fa-phone" style={{ fontSize: '0.75rem' }}></i> {claimantPhone}
                                </a>
                              )}
                              {claimantEmail && (
                                <a href={`mailto:${claimantEmail}`} style={{ color: '#2563eb', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                  <i className="fa-solid fa-envelope" style={{ fontSize: '0.75rem' }}></i> {claimantEmail}
                                </a>
                              )}
                              {c.claimantId && (
                                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>User ID: {c.claimantId}</span>
                              )}
                            </div>

                            {/* Remarks */}
                            <div style={{ marginTop: '0.75rem', paddingTop: '0.65rem', borderTop: '1px solid #e2e8f0' }}>
                              <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#64748b', marginBottom: 2 }}>Claimant Remarks:</div>
                              <div style={{ fontSize: '0.84rem', color: '#1e293b', fontStyle: 'italic', lineHeight: 1.4 }}>
                                &ldquo;{c.remarks || c.message || 'No specific remarks provided.'}&rdquo;
                              </div>
                            </div>
                          </div>

                          {/* Column 2: Uploaded Verification Proof Documents */}
                          <div style={{ background: '#f8fafc', padding: '0.95rem', borderRadius: 10, border: '1px solid #f1f5f9' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                              <div style={{ fontWeight: 800, fontSize: '0.82rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <i className="fa-solid fa-folder-open" style={{ color: '#d97706' }}></i> Verification Documents
                              </div>
                              <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b' }}>
                                {c.documents ? c.documents.length : c.proofDoc ? 1 : 0} file(s)
                              </span>
                            </div>

                            {/* Render docs */}
                            {(!c.documents || c.documents.length === 0) && !c.proofDoc ? (
                              <div style={{ fontSize: '0.82rem', color: '#94a3b8', fontStyle: 'italic', padding: '1rem', textAlign: 'center' }}>
                                No verification documents attached.
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                                {(c.documents && c.documents.length > 0 ? c.documents : c.proofDoc ? [{ name: 'Proof Document', url: c.proofDoc, type: 'file' }] : []).map((doc, dIdx) => {
                                  const docObj: ClaimDocument = typeof doc === 'string' ? { name: `Verification Proof ${dIdx + 1}`, url: doc, type: 'file' } : doc;
                                  const docInfo = getAdminDocIcon(docObj.type);
                                  const isImg = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes((docObj.type || '').toLowerCase()) || (docObj.url && docObj.url.startsWith('data:image'));

                                  return (
                                    <div
                                      key={dIdx}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        background: '#fff',
                                        padding: '0.5rem 0.75rem',
                                        borderRadius: 8,
                                        border: '1px solid #e2e8f0',
                                        gap: '0.5rem',
                                      }}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                                        <i className={`fa-solid ${docInfo.icon}`} style={{ color: docInfo.color, fontSize: '0.95rem', flexShrink: 0 }}></i>
                                        <div style={{ minWidth: 0 }}>
                                          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {docObj.name}
                                          </div>
                                          <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                                            {docObj.size ? `${docObj.size} • ` : ''}{docInfo.label}
                                          </div>
                                        </div>
                                      </div>

                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                                        {isImg ? (
                                          <button
                                            type="button"
                                            onClick={() => setClaimDocPreview({ name: docObj.name, url: docObj.url, type: 'image' })}
                                            style={{
                                              background: '#eff6ff',
                                              color: '#2563eb',
                                              border: '1px solid #bfdbfe',
                                              padding: '0.3rem 0.65rem',
                                              borderRadius: 6,
                                              fontSize: '0.74rem',
                                              fontWeight: 700,
                                              cursor: 'pointer',
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '0.3rem',
                                            }}
                                          >
                                            <i className="fa-solid fa-eye"></i> Preview
                                          </button>
                                        ) : (
                                          <a
                                            href={docObj.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                              background: '#eff6ff',
                                              color: '#2563eb',
                                              border: '1px solid #bfdbfe',
                                              padding: '0.3rem 0.65rem',
                                              borderRadius: 6,
                                              fontSize: '0.74rem',
                                              fontWeight: 700,
                                              textDecoration: 'none',
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '0.3rem',
                                            }}
                                          >
                                            <i className="fa-solid fa-arrow-up-right-from-square"></i> Open
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Admin Reply or Rejection Reason Banner if Present */}
                        {c.adminReply && (
                          <div
                            style={{
                              background: isRejected ? '#fef2f2' : '#eff6ff',
                              border: isRejected ? '1px solid #fecdd3' : '1px solid #bfdbfe',
                              borderRadius: 10,
                              padding: '0.75rem 1rem',
                              marginBottom: '0.9rem',
                              fontSize: '0.84rem',
                              color: isRejected ? '#991b1b' : '#1e40af',
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '0.5rem',
                            }}
                          >
                            <i className={`fa-solid ${isRejected ? 'fa-triangle-exclamation' : 'fa-comment-dots'}`} style={{ marginTop: 2, flexShrink: 0 }}></i>
                            <div>
                              <strong>{isRejected ? 'Admin Rejection Reason:' : 'Admin Reply / Feedback:'}</strong>
                              <span style={{ marginLeft: 6 }}>{c.adminReply}</span>
                            </div>
                          </div>
                        )}

                        {/* Bottom Actions Bar */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.65rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            {isApproved && (
                              <span style={{ color: '#059669', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <i className="fa-solid fa-circle-check"></i> Ownership assigned to {claimantDisplayName}
                              </span>
                            )}
                            {isRejected && (
                              <span style={{ color: '#dc2626', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <i className="fa-solid fa-circle-xmark"></i> Rejected
                              </span>
                            )}
                            {isPending && (
                              <span style={{ color: '#d97706', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <i className="fa-solid fa-clock"></i> Awaiting verification decision
                              </span>
                            )}
                          </div>

                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            {/* Reply button */}
                            <button
                              type="button"
                              onClick={() => {
                                setClaimToReply(c);
                                setClaimReplyText(c.adminReply || '');
                              }}
                              style={{
                                background: '#fff',
                                border: '1px solid #cbd5e1',
                                color: '#334155',
                                padding: '0.45rem 0.9rem',
                                borderRadius: 8,
                                fontWeight: 700,
                                fontSize: '0.82rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                              }}
                            >
                              <i className="fa-solid fa-reply"></i>
                              {c.adminReply ? 'Update Reply' : 'Reply / Message'}
                            </button>

                            {/* Approve & Reject for Pending */}
                            {isPending && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleRejectClaim(c)}
                                  style={{
                                    background: '#fef2f2',
                                    color: '#ef4444',
                                    border: '1px solid #fecdd3',
                                    padding: '0.45rem 1rem',
                                    borderRadius: 8,
                                    fontWeight: 700,
                                    fontSize: '0.82rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                  }}
                                >
                                  <i className="fa-solid fa-xmark"></i> Reject
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleApproveClaim(c)}
                                  style={{
                                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                    color: '#fff',
                                    border: 'none',
                                    padding: '0.45rem 1.15rem',
                                    borderRadius: 8,
                                    fontWeight: 700,
                                    fontSize: '0.82rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)',
                                  }}
                                >
                                  <i className="fa-solid fa-check"></i> Approve Claim
                                </button>
                              </>
                            )}

                            {/* If Rejected, offer Re-evaluate & Approve */}
                            {isRejected && (
                              <button
                                type="button"
                                onClick={() => handleApproveClaim(c)}
                                style={{
                                  background: '#ecfdf5',
                                  color: '#059669',
                                  border: '1px solid #a7f3d0',
                                  padding: '0.45rem 0.95rem',
                                  borderRadius: 8,
                                  fontWeight: 700,
                                  fontSize: '0.82rem',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                }}
                              >
                                <i className="fa-solid fa-rotate-left"></i> Re-evaluate & Approve
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* VIEW: TRUST BADGES */}
          {activeView === 'trust' && (
            <div className="admin-view-panel active" style={{ padding: '1.5rem' }}>
              <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className="fa-solid fa-shield-halved" style={{ fontSize: '1.2rem' }}></i>
                    </div>
                    <div>
                      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Gold Trust Badge Requests</h1>
                      <p style={{ color: '#64748b', fontSize: '0.88rem', margin: '2px 0 0' }}>Review applications, verify UPI payments & documents, and activate Gold Trust Badges.</p>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                  {/* Current Pricing Info Pill */}
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '0.45rem 0.85rem', borderRadius: 8, fontSize: '0.82rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span>Active Price:</span>
                    <span style={{ textDecoration: 'line-through', color: '#94a3b8' }}>₹{trustBadgeSettings.originalPrice || 999}</span>
                    <strong style={{ color: '#16a34a' }}>₹{trustBadgeSettings.offerPrice || 299}/Yr</strong>
                  </div>

                  {/* Settings Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setSettingOrigPrice(String(trustBadgeSettings.originalPrice || 999));
                      setSettingOfferPrice(String(trustBadgeSettings.offerPrice || 299));
                      setSettingUpiId(trustBadgeSettings.upiId || 'localbazar@upi');
                      setSettingUpiName(trustBadgeSettings.upiName || 'LocalBazar Official');
                      setSettingQrImage(trustBadgeSettings.qrImageUrl || '');
                      setShowTrustSettingsModal(true);
                    }}
                    style={{
                      background: '#d97706',
                      color: '#fff',
                      border: 'none',
                      padding: '0.55rem 1.1rem',
                      borderRadius: 8,
                      fontWeight: 700,
                      fontSize: '0.84rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      boxShadow: '0 2px 6px rgba(217, 119, 6, 0.25)',
                    }}
                  >
                    <i className="fa-solid fa-gear"></i>
                    Badge Pricing & Scanner Settings
                  </button>
                </div>
              </div>

              {/* Status Filter Tabs & Search */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.85rem', marginBottom: '1.25rem' }}>
                {/* Filter Tabs */}
                <div style={{ display: 'flex', gap: '0.4rem', background: '#f1f5f9', padding: '0.3rem', borderRadius: '10px' }}>
                  {(['all', 'pending', 'approved', 'rejected'] as const).map((st) => {
                    const count = st === 'all'
                      ? trustRequests.length
                      : trustRequests.filter((t) => (t.status || '').toLowerCase() === st).length;
                    const isActive = trustStatusFilter === st;
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setTrustStatusFilter(st)}
                        style={{
                          padding: '0.45rem 0.85rem',
                          borderRadius: '8px',
                          border: 'none',
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          background: isActive ? '#fff' : 'transparent',
                          color: isActive ? '#0f172a' : '#64748b',
                          boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                          textTransform: 'capitalize',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                        }}
                      >
                        <span>{st}</span>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            padding: '0.08rem 0.45rem',
                            borderRadius: '999px',
                            background: isActive
                              ? st === 'pending'
                                ? '#fef3c7'
                                : st === 'approved'
                                ? '#ecfdf5'
                                : st === 'rejected'
                                ? '#fef2f2'
                                : '#e2e8f0'
                              : '#e2e8f0',
                            color: isActive
                              ? st === 'pending'
                                ? '#b45309'
                                : st === 'approved'
                                ? '#047857'
                                : st === 'rejected'
                                ? '#b91c1c'
                                : '#475569'
                              : '#64748b',
                            fontWeight: 800,
                          }}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Search Box */}
                <div style={{ position: 'relative', minWidth: '280px', flex: '1', maxWidth: '420px' }}>
                  <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}></i>
                  <input
                    type="text"
                    placeholder="Search by business, owner, phone, or UTR..."
                    value={trustSearch}
                    onChange={(e) => setTrustSearch(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.55rem 1rem 0.55rem 2.2rem',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '0.86rem',
                      background: '#fff',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {/* Requests List */}
              {filteredTrustRequests.length === 0 ? (
                <div style={{ background: '#fff', padding: '3.5rem 1.5rem', borderRadius: 14, textAlign: 'center', color: '#94a3b8', border: '1px dashed #cbd5e1' }}>
                  <i className="fa-solid fa-shield-halved" style={{ fontSize: '2.8rem', color: '#cbd5e1', marginBottom: '0.85rem', display: 'block' }}></i>
                  <h4 style={{ fontWeight: 800, color: '#334155', marginBottom: 4 }}>No Trust Badge Applications Found</h4>
                  <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                    {trustSearch || trustStatusFilter !== 'all'
                      ? 'No applications match your search or filter.'
                      : 'There are no Gold Trust Badge requests submitted yet.'}
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '1.15rem' }}>
                  {filteredTrustRequests.map((tr) => {
                    const st = (tr.status || 'pending').toLowerCase();
                    const isApproved = st === 'approved';
                    const isRejected = st === 'rejected';
                    const isPending = !isApproved && !isRejected;

                    return (
                      <div
                        key={tr.id}
                        style={{
                          background: '#fff',
                          padding: '1.35rem',
                          borderRadius: 14,
                          border: isApproved ? '1.5px solid #86efac' : isRejected ? '1.5px solid #fca5a5' : '1.5px solid #fde68a',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                        }}
                      >
                        {/* Top Row: Business Name & Status */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '1.15rem' }}>{tr.businessName || tr.listingName}</span>
                              <span style={{ fontSize: '0.74rem', background: '#f1f5f9', color: '#64748b', padding: '0.15rem 0.55rem', borderRadius: 6, fontWeight: 700 }}>
                                Listing ID: {tr.listingId}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 4, flexWrap: 'wrap', fontSize: '0.8rem', color: '#64748b' }}>
                              {tr.city && <span><i className="fa-solid fa-location-dot" style={{ color: '#2563eb', marginRight: 3 }}></i>{tr.city}</span>}
                              {tr.category && (
                                <>
                                  <span>•</span>
                                  <span><i className="fa-solid fa-tag" style={{ color: '#16a34a', marginRight: 3 }}></i>{tr.category}</span>
                                </>
                              )}
                              <span>•</span>
                              <span>Date: {tr.date || 'Recent'}</span>
                              <span>•</span>
                              <span style={{ color: '#94a3b8' }}>App #{tr.id}</span>
                            </div>
                          </div>

                          {/* Status Pill & Delete */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span
                              style={{
                                fontSize: '0.78rem',
                                fontWeight: 800,
                                padding: '0.3rem 0.8rem',
                                borderRadius: '999px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                background: isApproved ? '#ecfdf5' : isRejected ? '#fef2f2' : '#fef3c7',
                                color: isApproved ? '#047857' : isRejected ? '#b91c1c' : '#b45309',
                                border: isApproved ? '1px solid #a7f3d0' : isRejected ? '1px solid #fecdd3' : '1px solid #fde68a',
                              }}
                            >
                              <i className={`fa-solid ${isApproved ? 'fa-circle-check' : isRejected ? 'fa-circle-xmark' : 'fa-clock'}`}></i>
                              {isApproved ? 'Gold Badge Active 👑' : isRejected ? 'Rejected' : 'Pending Verification'}
                            </span>

                            <button
                              type="button"
                              onClick={() => handleDeleteTrustRequest(tr.id)}
                              title="Delete application"
                              style={{
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                color: '#94a3b8',
                                width: 30,
                                height: 30,
                                borderRadius: 8,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <i className="fa-solid fa-trash-can" style={{ fontSize: '0.8rem' }}></i>
                            </button>
                          </div>
                        </div>

                        {/* Middle Grid: Applicant/Document vs Payment Info */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '1rem' }}>
                          {/* Column 1: Applicant & Verification Proof */}
                          <div style={{ background: '#f8fafc', padding: '0.95rem', borderRadius: 10, border: '1px solid #f1f5f9' }}>
                            <div style={{ fontWeight: 800, fontSize: '0.82rem', color: '#475569', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <i className="fa-solid fa-user-shield" style={{ color: '#2563eb' }}></i> Applicant & Verification Document
                            </div>
                            <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a' }}>{tr.applicantName || tr.ownerName}</div>
                            <div style={{ fontSize: '0.82rem', color: '#475569', marginTop: 3 }}>
                              {tr.phone && (
                                <a href={formatTelUrl(tr.phone)} style={{ color: '#2563eb', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                  <i className="fa-solid fa-phone" style={{ fontSize: '0.75rem' }}></i> {tr.phone}
                                </a>
                              )}
                            </div>

                            <div style={{ marginTop: '0.65rem', paddingTop: '0.65rem', borderTop: '1px solid #e2e8f0' }}>
                              <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                                Document Type: <strong style={{ color: '#0f172a' }}>{tr.docType || 'Trade License'}</strong>
                              </div>
                              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>
                                Reg / License No:{' '}
                                <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>
                                  {tr.tradeLicense || tr.gstNumber || 'Not provided'}
                                </strong>
                              </div>

                              {tr.docProof && (
                                <div style={{ marginTop: '0.5rem' }}>
                                  <button
                                    type="button"
                                    onClick={() => setTrustDocPreview({ name: `${tr.docType || 'Document'} Proof`, url: tr.docProof!, type: 'file' })}
                                    style={{
                                      background: '#eff6ff',
                                      color: '#2563eb',
                                      border: '1px solid #bfdbfe',
                                      padding: '0.35rem 0.75rem',
                                      borderRadius: 6,
                                      fontSize: '0.76rem',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.35rem',
                                    }}
                                  >
                                    <i className="fa-solid fa-file-lines"></i> View Document Proof
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Column 2: UPI Payment Verification */}
                          <div style={{ background: '#fffbeb', padding: '0.95rem', borderRadius: 10, border: '1px solid #fde68a' }}>
                            <div style={{ fontWeight: 800, fontSize: '0.82rem', color: '#92400e', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <i className="fa-solid fa-indian-rupee-sign" style={{ color: '#d97706' }}></i> Payment Verification Details
                            </div>

                            <div style={{ fontSize: '0.84rem', color: '#78350f', marginBottom: '0.5rem' }}>
                              Amount Paid: <strong style={{ fontSize: '1.1rem', color: '#16a34a' }}>₹{tr.amountPaid || 299}</strong>
                            </div>

                            {/* Highlighted UTR Box with Copy */}
                            <div style={{ background: '#fff', border: '1.5px solid #d97706', borderRadius: 8, padding: '0.6rem 0.85rem', marginBottom: '0.65rem' }}>
                              <div style={{ fontSize: '0.72rem', color: '#78350f', fontWeight: 800 }}>12-Digit UPI Transaction ID / UTR:</div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginTop: 2 }}>
                                <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.98rem', color: '#0f172a' }}>
                                  {tr.transactionId || 'NOT PROVIDED'}
                                </span>
                                {tr.transactionId && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(tr.transactionId || '');
                                      alert(`UTR copied: ${tr.transactionId}`);
                                    }}
                                    style={{ background: '#fef3c7', border: '1px solid #fde68a', color: '#92400e', fontSize: '0.72rem', padding: '0.2rem 0.5rem', borderRadius: 4, cursor: 'pointer', fontWeight: 700 }}
                                  >
                                    <i className="fa-solid fa-copy"></i> Copy UTR
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Payment screenshot if available */}
                            {tr.paymentProof && (
                              <div>
                                <button
                                  type="button"
                                  onClick={() => setTrustDocPreview({ name: 'Payment Receipt Screenshot', url: tr.paymentProof!, type: 'image' })}
                                  style={{
                                    background: '#fff',
                                    border: '1px solid #cbd5e1',
                                    color: '#334155',
                                    padding: '0.35rem 0.75rem',
                                    borderRadius: 6,
                                    fontSize: '0.76rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                  }}
                                >
                                  <i className="fa-solid fa-receipt"></i> View Payment Screenshot
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Admin Feedback if Present */}
                        {tr.adminReply && (
                          <div
                            style={{
                              background: isRejected ? '#fef2f2' : '#eff6ff',
                              border: isRejected ? '1px solid #fecdd3' : '1px solid #bfdbfe',
                              borderRadius: 10,
                              padding: '0.75rem 1rem',
                              marginBottom: '0.85rem',
                              fontSize: '0.84rem',
                              color: isRejected ? '#991b1b' : '#1e40af',
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '0.5rem',
                            }}
                          >
                            <i className={`fa-solid ${isRejected ? 'fa-triangle-exclamation' : 'fa-comment-dots'}`} style={{ marginTop: 2 }}></i>
                            <div>
                              <strong>{isRejected ? 'Rejection Reason:' : 'Admin Note:'}</strong>
                              <span style={{ marginLeft: 6 }}>{tr.adminReply}</span>
                            </div>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.65rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
                          <div>
                            {isApproved && (
                              <span style={{ color: '#059669', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <i className="fa-solid fa-shield-halved" style={{ color: '#d97706' }}></i> Gold Trust Badge Granted
                              </span>
                            )}
                            {isPending && (
                              <span style={{ color: '#b45309', fontSize: '0.82rem', fontWeight: 700 }}>
                                Cross-verify UTR in UPI app then approve.
                              </span>
                            )}
                          </div>

                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            {isPending && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTrustToReject(tr);
                                    setTrustRejectReason('');
                                  }}
                                  style={{
                                    background: '#fef2f2',
                                    color: '#ef4444',
                                    border: '1px solid #fecdd3',
                                    padding: '0.45rem 1rem',
                                    borderRadius: 8,
                                    fontWeight: 700,
                                    fontSize: '0.82rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                  }}
                                >
                                  <i className="fa-solid fa-xmark"></i> Reject
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setTrustToApprove(tr);
                                    setTrustApprovalNote('');
                                  }}
                                  style={{
                                    background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                                    color: '#fff',
                                    border: 'none',
                                    padding: '0.45rem 1.15rem',
                                    borderRadius: 8,
                                    fontWeight: 700,
                                    fontSize: '0.82rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    boxShadow: '0 2px 6px rgba(217, 119, 6, 0.3)',
                                  }}
                                >
                                  <i className="fa-solid fa-shield-halved"></i> Approve Trust Badge
                                </button>
                              </>
                            )}

                            {isRejected && (
                              <button
                                type="button"
                                onClick={() => {
                                  setTrustToApprove(tr);
                                  setTrustApprovalNote('Re-evaluated and approved.');
                                }}
                                style={{
                                  background: '#ecfdf5',
                                  color: '#059669',
                                  border: '1px solid #a7f3d0',
                                  padding: '0.45rem 0.95rem',
                                  borderRadius: 8,
                                  fontWeight: 700,
                                  fontSize: '0.82rem',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                }}
                              >
                                <i className="fa-solid fa-rotate-left"></i> Re-evaluate & Grant Badge
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* VIEW: CITIES */}
          {activeView === 'cities' && (
            <div className="admin-view-panel active" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>City Hubs</h1>
                  <p style={{ color: '#64748b', fontSize: '0.88rem' }}>Manage all registered cities & districts across India ({cities.length}).</p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {/* Search box to the left of Add City Button */}
                  <div style={{ position: 'relative', minWidth: '240px' }}>
                    <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '0.85rem' }}></i>
                    <input
                      type="text"
                      placeholder="Search city, district, state, pin..."
                      value={citySearch}
                      onChange={(e) => setCitySearch(e.target.value)}
                      style={{ padding: '0.55rem 2rem 0.55rem 2.2rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.88rem', width: '100%' }}
                    />
                    {citySearch && (
                      <button
                        type="button"
                        onClick={() => setCitySearch('')}
                        style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem' }}
                      >
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    )}
                  </div>

                  {/* Add City Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setNewCityName('');
                      setNewCityDistrict('');
                      setNewCityState('West Bengal');
                      setNewCityPinCode('');
                      setIsCityModalOpen(true);
                    }}
                    style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0.55rem 1.1rem', borderRadius: 8, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}
                  >
                    <i className="fa-solid fa-plus"></i> Add New City
                  </button>
                </div>
              </div>

              {/* Cities Grid Display */}
              {displayCities.length === 0 ? (
                <div style={{ background: '#fff', padding: '3rem', borderRadius: 12, textAlign: 'center', color: '#94a3b8', border: '1px solid #e2e8f0' }}>
                  <i className="fa-solid fa-city" style={{ fontSize: '2.5rem', marginBottom: '0.75rem', color: '#cbd5e1' }}></i>
                  <div>No cities found matching your search.</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
                  {displayCities.map((c) => (
                    <div key={c.name} style={{ background: '#fff', padding: '1.1rem', borderRadius: 12, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                          <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '1.05rem' }}>{c.name}</div>
                          <span style={{ fontSize: '0.72rem', fontWeight: 600, background: '#eff6ff', color: '#1d4ed8', padding: '0.15rem 0.45rem', borderRadius: 6 }}>
                            {c.state || 'India'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', marginTop: 6, fontSize: '0.82rem', color: '#64748b' }}>
                          <div>
                            <i className="fa-solid fa-map-pin" style={{ color: '#2563eb', marginRight: 6, fontSize: '0.75rem' }}></i>
                            District: <strong style={{ color: '#334155' }}>{c.district || 'Not specified'}</strong>
                          </div>
                          <div>
                            PIN: <strong style={{ color: '#334155' }}>{(c.pinCode || c.pincode || 'N/A').replace(/^[#\s]+/, '')}</strong>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.65rem' }}>
                        {/* Edit City Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCity(c);
                            setEditingCityOriginalName(c.name);
                          }}
                          title="Edit District, State & PIN Code"
                          style={{ background: '#eff6ff', color: '#2563eb', border: 'none', padding: '0.35rem 0.75rem', borderRadius: 6, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                        >
                          <i className="fa-solid fa-pen-to-square"></i> Edit
                        </button>

                        {/* Delete City Button */}
                        <button
                          type="button"
                          onClick={() => handleDeleteCity(c.name)}
                          title="Delete City"
                          style={{ background: '#fef2f2', color: '#ef4444', border: 'none', width: 30, height: 30, borderRadius: 6, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <i className="fa-solid fa-trash-can"></i>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add City Modal */}
              {isCityModalOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                  <div style={{ background: '#fff', maxWidth: 440, width: '100%', borderRadius: 16, padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>Add New City</h3>
                      <button
                        type="button"
                        onClick={() => setIsCityModalOpen(false)}
                        style={{ background: 'none', border: 'none', fontSize: '1.25rem', color: '#64748b', cursor: 'pointer' }}
                      >
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </div>

                    <form onSubmit={handleAddCity} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                      <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>City / Hub Name *</label>
                        <input
                          type="text"
                          placeholder="e.g. Kolkata, Asansol, Siliguri"
                          value={newCityName}
                          onChange={(e) => setNewCityName(e.target.value)}
                          required
                          style={{ width: '100%', padding: '0.55rem', borderRadius: 8, border: '1px solid #cbd5e1', marginTop: 4, fontSize: '0.9rem' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>District</label>
                        <input
                          type="text"
                          placeholder="e.g. Paschim Bardhaman, Howrah"
                          value={newCityDistrict}
                          onChange={(e) => setNewCityDistrict(e.target.value)}
                          style={{ width: '100%', padding: '0.55rem', borderRadius: 8, border: '1px solid #cbd5e1', marginTop: 4, fontSize: '0.9rem' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>State</label>
                        <input
                          type="text"
                          placeholder="e.g. West Bengal"
                          value={newCityState}
                          onChange={(e) => setNewCityState(e.target.value)}
                          style={{ width: '100%', padding: '0.55rem', borderRadius: 8, border: '1px solid #cbd5e1', marginTop: 4, fontSize: '0.9rem' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>PIN Code</label>
                        <input
                          type="text"
                          placeholder="e.g. 700001, 713301"
                          value={newCityPinCode}
                          onChange={(e) => setNewCityPinCode(e.target.value)}
                          style={{ width: '100%', padding: '0.55rem', borderRadius: 8, border: '1px solid #cbd5e1', marginTop: 4, fontSize: '0.9rem' }}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
                        <button
                          type="button"
                          onClick={() => setIsCityModalOpen(false)}
                          style={{ padding: '0.55rem 1.1rem', borderRadius: 8, border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem' }}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          style={{ padding: '0.55rem 1.25rem', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem' }}
                        >
                          Save City
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Edit Existing City Modal */}
              {editingCity && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                  <div style={{ background: '#fff', maxWidth: 440, width: '100%', borderRadius: 16, padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                        Edit City Details
                      </h3>
                      <button
                        type="button"
                        onClick={() => setEditingCity(null)}
                        style={{ background: 'none', border: 'none', fontSize: '1.25rem', color: '#64748b', cursor: 'pointer' }}
                      >
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </div>

                    <form onSubmit={handleSaveEditedCity} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                      <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>City / Hub Name *</label>
                        <input
                          type="text"
                          value={editingCity.name}
                          onChange={(e) => setEditingCity({ ...editingCity, name: e.target.value })}
                          required
                          style={{ width: '100%', padding: '0.55rem', borderRadius: 8, border: '1px solid #cbd5e1', marginTop: 4, fontSize: '0.9rem' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>District</label>
                        <input
                          type="text"
                          placeholder="e.g. Paschim Bardhaman, Howrah"
                          value={editingCity.district || ''}
                          onChange={(e) => setEditingCity({ ...editingCity, district: e.target.value })}
                          style={{ width: '100%', padding: '0.55rem', borderRadius: 8, border: '1px solid #cbd5e1', marginTop: 4, fontSize: '0.9rem' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>State</label>
                        <input
                          type="text"
                          placeholder="e.g. West Bengal"
                          value={editingCity.state || ''}
                          onChange={(e) => setEditingCity({ ...editingCity, state: e.target.value })}
                          style={{ width: '100%', padding: '0.55rem', borderRadius: 8, border: '1px solid #cbd5e1', marginTop: 4, fontSize: '0.9rem' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>PIN Code</label>
                        <input
                          type="text"
                          placeholder="e.g. 700001, 713301"
                          value={editingCity.pinCode || editingCity.pincode || ''}
                          onChange={(e) => setEditingCity({ ...editingCity, pinCode: e.target.value })}
                          style={{ width: '100%', padding: '0.55rem', borderRadius: 8, border: '1px solid #cbd5e1', marginTop: 4, fontSize: '0.9rem' }}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
                        <button
                          type="button"
                          onClick={() => setEditingCity(null)}
                          style={{ padding: '0.55rem 1.1rem', borderRadius: 8, border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem' }}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          style={{ padding: '0.55rem 1.25rem', borderRadius: 8, border: 'none', background: '#10b981', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem' }}
                        >
                          Update City
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VIEW: CATEGORIES */}
          {activeView === 'categories' && (
            <div className="admin-view-panel active" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>Business Sectors & Categories</h1>
                  <p style={{ color: '#64748b', fontSize: '0.88rem' }}>Manage categories, alternative keywords, and in-store subcategories ({categories.length}).</p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {/* Search box to the left of Add Category Button */}
                  <div style={{ position: 'relative', minWidth: '240px' }}>
                    <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '0.85rem' }}></i>
                    <input
                      type="text"
                      placeholder="Search category, alternative name..."
                      value={categorySearch}
                      onChange={(e) => setCategorySearch(e.target.value)}
                      style={{ padding: '0.55rem 2rem 0.55rem 2.2rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.88rem', width: '100%' }}
                    />
                    {categorySearch && (
                      <button
                        type="button"
                        onClick={() => setCategorySearch('')}
                        style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem' }}
                      >
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    )}
                  </div>

                  {/* Add Category Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setNewCatName('');
                      setNewCatAltName('');
                      setNewCatStoreCategories([]);
                      setTempSubCatLabel('');
                      setTempSubCatIcon('🏷️');
                      setIsCatModalOpen(true);
                    }}
                    style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0.55rem 1.1rem', borderRadius: 8, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem' }}
                  >
                    <i className="fa-solid fa-plus"></i> Add Category
                  </button>
                </div>
              </div>

              {/* Categories Grid */}
              {displayCategories.length === 0 ? (
                <div style={{ background: '#fff', padding: '3rem', borderRadius: 12, textAlign: 'center', color: '#94a3b8', border: '1px solid #e2e8f0' }}>
                  <i className="fa-solid fa-layer-group" style={{ fontSize: '2.5rem', marginBottom: '0.75rem', color: '#cbd5e1' }}></i>
                  <div>No categories found matching your search.</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                  {displayCategories.map((cat) => {
                    const altText = cat.alternativeName || (cat.altNames && cat.altNames.length > 0 ? cat.altNames.join(', ') : '');
                    const subList = Array.isArray(cat.storeCategories) ? cat.storeCategories : [];

                    return (
                      <div key={cat.name} style={{ background: '#fff', padding: '1.2rem', borderRadius: 12, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '0.85rem', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '1.1rem' }}>{cat.name}</div>
                              {altText && (
                                <div style={{ marginTop: '0.35rem', fontSize: '0.8rem', color: '#64748b' }}>
                                  <i className="fa-solid fa-tags" style={{ color: '#0284c7', marginRight: 5 }}></i>
                                  Alt: <strong style={{ color: '#334155' }}>{altText}</strong>
                                </div>
                              )}
                            </div>

                            {/* Action Buttons: Edit & Delete */}
                            <div style={{ display: 'flex', gap: '0.35rem' }}>
                              {/* Edit Button */}
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCat({
                                    ...cat,
                                    storeCategories: Array.isArray(cat.storeCategories) ? [...cat.storeCategories] : []
                                  });
                                  setEditingCatOriginalName(cat.name);
                                  setEditSubCatLabel('');
                                  setEditSubCatIcon('🏷️');
                                }}
                                title="Edit Category & In-Store Subcategories"
                                style={{ background: '#eff6ff', color: '#2563eb', border: 'none', width: 32, height: 32, borderRadius: 6, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                <i className="fa-solid fa-pen-to-square"></i>
                              </button>

                              {/* Delete Button */}
                              <button
                                type="button"
                                onClick={() => { setDeletingCatModal(cat); setDeleteCatConfirmText(''); }}
                                title="Permanently Delete Category"
                                style={{ background: '#fef2f2', color: '#ef4444', border: 'none', width: 32, height: 32, borderRadius: 6, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                <i className="fa-solid fa-trash-can"></i>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* In-Store Subcategories Display */}
                        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
                          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            In-Store Subcategories ({subList.length}):
                          </div>
                          {subList.length === 0 ? (
                            <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontStyle: 'italic' }}>No subcategories added.</span>
                          ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                              {subList.map((sc, idx) => {
                                const label = typeof sc === 'string' ? sc : sc.label;
                                const icon = typeof sc === 'string' ? '🏷️' : (sc.icon || '🏷️');
                                return (
                                  <span
                                    key={idx}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: '#f1f5f9', color: '#334155', padding: '0.2rem 0.55rem', borderRadius: 12, fontSize: '0.78rem', fontWeight: 600 }}
                                  >
                                    <span>{icon}</span>
                                    <span>{label}</span>
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add Category Modal (Unified with In-Store Subcategories) */}
              {isCatModalOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                  <div style={{ background: '#fff', maxWidth: 500, width: '100%', borderRadius: 16, padding: '1.75rem', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>Add New Category</h3>
                      <button
                        type="button"
                        onClick={() => setIsCatModalOpen(false)}
                        style={{ background: 'none', border: 'none', fontSize: '1.25rem', color: '#64748b', cursor: 'pointer' }}
                      >
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </div>

                    <form onSubmit={handleAddCategory} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div>
                        <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>Category Name *</label>
                        <input
                          type="text"
                          placeholder="e.g. Restaurants, Electronics, Fashion"
                          value={newCatName}
                          onChange={(e) => setNewCatName(e.target.value)}
                          required
                          style={{ width: '100%', padding: '0.55rem', borderRadius: 8, border: '1px solid #cbd5e1', marginTop: 4, fontSize: '0.9rem' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>Category Alternative Name (Optional)</label>
                        <input
                          type="text"
                          placeholder="e.g. Food, Cafe, Hotel, Dhaba, Dining"
                          value={newCatAltName}
                          onChange={(e) => setNewCatAltName(e.target.value)}
                          style={{ width: '100%', padding: '0.55rem', borderRadius: 8, border: '1px solid #cbd5e1', marginTop: 4, fontSize: '0.9rem' }}
                        />
                      </div>

                      {/* In-Store Category Builder inside Add Modal */}
                      <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                        <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.5rem' }}>
                          In-Store Categories with Emoji
                        </label>

                        {/* Input Row: Category Name + Emoji + Add Button */}
                        <div style={{ display: 'flex', gap: '0.45rem', marginBottom: '0.75rem' }}>
                          <input
                            type="text"
                            placeholder="In-Store Category (e.g. Pizza, Shirts)"
                            value={tempSubCatLabel}
                            onChange={(e) => setTempSubCatLabel(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSubCatToNew(); } }}
                            style={{ flex: 1, padding: '0.5rem 0.65rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                          />
                          <input
                            type="text"
                            placeholder="Emoji"
                            value={tempSubCatIcon}
                            onChange={(e) => setTempSubCatIcon(e.target.value)}
                            style={{ width: 65, textAlign: 'center', padding: '0.5rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '1rem' }}
                          />
                          <button
                            type="button"
                            onClick={handleAddSubCatToNew}
                            style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0.5rem 0.9rem', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                          >
                            <i className="fa-solid fa-plus"></i> Add
                          </button>
                        </div>

                        {/* Chips of added subcategories with X button */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', minHeight: 34 }}>
                          {newCatStoreCategories.length === 0 ? (
                            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>No subcategories added yet. Add items above.</span>
                          ) : (
                            newCatStoreCategories.map((sc, idx) => (
                              <div
                                key={idx}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '0.25rem 0.6rem', borderRadius: 16, fontSize: '0.82rem', fontWeight: 600 }}
                              >
                                <span>{sc.icon}</span>
                                <span>{sc.label}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSubCatFromNew(sc.tag)}
                                  style={{ background: 'none', border: 'none', color: '#ef4444', marginLeft: 3, cursor: 'pointer', padding: 0, fontSize: '0.75rem' }}
                                  title="Remove subcategory"
                                >
                                  <i className="fa-solid fa-xmark"></i>
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => setIsCatModalOpen(false)}
                          style={{ padding: '0.6rem 1.2rem', borderRadius: 8, border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem' }}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          style={{ padding: '0.6rem 1.4rem', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem' }}
                        >
                          Add Category
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Edit Category Modal (Unified: Name, Alternative Name, In-Store Subcategories with Emoji & X) */}
              {editingCat && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                  <div style={{ background: '#fff', maxWidth: 520, width: '100%', borderRadius: 16, padding: '1.75rem', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>Edit Category: {editingCat.name}</h3>
                      <button
                        type="button"
                        onClick={() => setEditingCat(null)}
                        style={{ background: 'none', border: 'none', fontSize: '1.25rem', color: '#64748b', cursor: 'pointer' }}
                      >
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </div>

                    <form onSubmit={handleSaveEditedCategory} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div>
                        <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>Category Name *</label>
                        <input
                          type="text"
                          value={editingCat.name}
                          onChange={(e) => setEditingCat({ ...editingCat, name: e.target.value })}
                          required
                          style={{ width: '100%', padding: '0.55rem', borderRadius: 8, border: '1px solid #cbd5e1', marginTop: 4, fontSize: '0.9rem' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>Category Alternative Name (Optional)</label>
                        <input
                          type="text"
                          placeholder="e.g. Food, Cafe, Hotel, Dhaba, Dining"
                          value={editingCat.alternativeName || ''}
                          onChange={(e) => setEditingCat({ ...editingCat, alternativeName: e.target.value })}
                          style={{ width: '100%', padding: '0.55rem', borderRadius: 8, border: '1px solid #cbd5e1', marginTop: 4, fontSize: '0.9rem' }}
                        />
                      </div>

                      {/* In-Store Subcategories Management Section */}
                      <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.5rem' }}>
                          In-Store Categories with Emoji
                        </div>

                        {/* List of current subcategories with X button to remove */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.85rem', minHeight: 34 }}>
                          {(!editingCat.storeCategories || editingCat.storeCategories.length === 0) ? (
                            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>No subcategories yet. Add one below.</span>
                          ) : (
                            editingCat.storeCategories.map((sub, idx) => {
                              const label = typeof sub === 'string' ? sub : sub.label;
                              const icon = typeof sub === 'string' ? '🏷️' : (sub.icon || '🏷️');
                              const tag = typeof sub === 'string' ? sub : sub.tag;

                              return (
                                <div
                                  key={idx}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '0.25rem 0.6rem', borderRadius: 16, fontSize: '0.82rem', fontWeight: 600 }}
                                >
                                  <span>{icon}</span>
                                  <span>{label}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveSubCatFromEdit(tag)}
                                    style={{ background: 'none', border: 'none', color: '#ef4444', marginLeft: 3, cursor: 'pointer', padding: 0, fontSize: '0.75rem' }}
                                    title="Remove subcategory"
                                  >
                                    <i className="fa-solid fa-xmark"></i>
                                  </button>
                                </div>
                              );
                            })
                          )}
                        </div>

                        {/* Add more In-Store Subcategories Row */}
                        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.65rem' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.35rem' }}>
                            Add New In-Store Subcategory:
                          </span>
                          <div style={{ display: 'flex', gap: '0.45rem' }}>
                            <input
                              type="text"
                              placeholder="Subcategory (e.g. Biryani, Pizza)"
                              value={editSubCatLabel}
                              onChange={(e) => setEditSubCatLabel(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSubCatToEdit(); } }}
                              style={{ flex: 1, padding: '0.5rem 0.65rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
                            />
                            <input
                              type="text"
                              placeholder="Emoji"
                              value={editSubCatIcon}
                              onChange={(e) => setEditSubCatIcon(e.target.value)}
                              style={{ width: 65, textAlign: 'center', padding: '0.5rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '1rem' }}
                            />
                            <button
                              type="button"
                              onClick={handleAddSubCatToEdit}
                              style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0.5rem 0.9rem', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                            >
                              <i className="fa-solid fa-plus"></i> Add
                            </button>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => setEditingCat(null)}
                          style={{ padding: '0.6rem 1.2rem', borderRadius: 8, border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem' }}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          style={{ padding: '0.6rem 1.4rem', borderRadius: 8, border: 'none', background: '#10b981', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem' }}
                        >
                          Update Category
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Confirm Delete Category Modal */}
              {deletingCatModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                  <div style={{ background: '#fff', maxWidth: 450, width: '100%', borderRadius: 16, padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                    <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                      <div style={{ width: 56, height: 56, margin: '0 auto 0.75rem', borderRadius: '50%', background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem' }}>
                        <i className="fa-solid fa-trash-can"></i>
                      </div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                        Permanently Delete Category?
                      </h3>
                      <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 10, padding: '0.75rem 0.9rem', marginTop: '0.75rem', textAlign: 'left', fontSize: '0.82rem', color: '#9f1239', lineHeight: 1.5 }}>
                        <strong>Warning:</strong> This will permanently delete category <strong>&quot;{deletingCatModal.name}&quot;</strong> and all its {Array.isArray(deletingCatModal.storeCategories) ? deletingCatModal.storeCategories.length : 0} store subcategories from the database. This action CANNOT be undone!
                      </div>
                    </div>

                    <div style={{ marginBottom: '1.25rem' }}>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                        Type <span style={{ color: '#ef4444' }}>CONFIRM</span> to permanently delete:
                      </label>
                      <input
                        type="text"
                        placeholder='Type "CONFIRM"'
                        value={deleteCatConfirmText}
                        onChange={(e) => setDeleteCatConfirmText(e.target.value)}
                        style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: '0.9rem', textAlign: 'center', letterSpacing: '0.05em' }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '0.6rem' }}>
                      <button
                        type="button"
                        onClick={() => { setDeletingCatModal(null); setDeleteCatConfirmText(''); }}
                        style={{ flex: 1, padding: '0.6rem', borderRadius: 8, border: '1px solid #cbd5e1', background: '#f8fafc', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={deleteCatConfirmText.trim().toUpperCase() !== 'CONFIRM'}
                        onClick={handleConfirmDeleteCategory}
                        style={{
                          flex: 1,
                          padding: '0.6rem',
                          borderRadius: 8,
                          border: 'none',
                          background: deleteCatConfirmText.trim().toUpperCase() === 'CONFIRM' ? '#ef4444' : '#cbd5e1',
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: '0.88rem',
                          cursor: deleteCatConfirmText.trim().toUpperCase() === 'CONFIRM' ? 'pointer' : 'not-allowed'
                        }}
                      >
                        Permanently Delete
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VIEW: MAILBOX */}
          {activeView === 'mailbox' && (
            <div className="admin-view-panel active" style={{ padding: '1.5rem' }}>
              {/* Header with Compose Button */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>Mailbox & System Messages</h1>
                  <p style={{ color: '#64748b', fontSize: '0.88rem' }}>
                    Platform internal communication center &bull; {inboxMails.length} Inbox ({inboxMails.filter(m => !m.read).length} unread) &bull; {sentMails.length} Sent
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setComposeTo('');
                    setComposeSubject('');
                    setComposeBody('');
                    setComposeModalOpen(true);
                  }}
                  style={{
                    background: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    padding: '0.65rem 1.25rem',
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    boxShadow: '0 2px 6px rgba(37,99,235,0.25)',
                    transition: 'all 0.2s',
                  }}
                >
                  <i className="fa-solid fa-pen-to-square"></i> Compose Mail
                </button>
              </div>

              {/* Sub-bar: Tabs & Search */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setMailTab('inbox')}
                    style={{
                      padding: '0.5rem 1.15rem',
                      borderRadius: 8,
                      fontWeight: 700,
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                      border: mailTab === 'inbox' ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                      background: mailTab === 'inbox' ? '#eff6ff' : '#fff',
                      color: mailTab === 'inbox' ? '#2563eb' : '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <i className="fa-solid fa-inbox"></i>
                    <span>Inbox</span>
                    <span style={{
                      background: mailTab === 'inbox' ? '#2563eb' : '#e2e8f0',
                      color: mailTab === 'inbox' ? '#fff' : '#475569',
                      borderRadius: 12,
                      fontSize: '0.75rem',
                      padding: '2px 8px',
                      fontWeight: 800,
                    }}>
                      {inboxMails.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMailTab('sent')}
                    style={{
                      padding: '0.5rem 1.15rem',
                      borderRadius: 8,
                      fontWeight: 700,
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                      border: mailTab === 'sent' ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                      background: mailTab === 'sent' ? '#eff6ff' : '#fff',
                      color: mailTab === 'sent' ? '#2563eb' : '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <i className="fa-solid fa-paper-plane"></i>
                    <span>Sent</span>
                    <span style={{
                      background: mailTab === 'sent' ? '#2563eb' : '#e2e8f0',
                      color: mailTab === 'sent' ? '#fff' : '#475569',
                      borderRadius: 12,
                      fontSize: '0.75rem',
                      padding: '2px 8px',
                      fontWeight: 800,
                    }}>
                      {sentMails.length}
                    </span>
                  </button>
                </div>

                {/* Search Bar */}
                <div style={{ position: 'relative', minWidth: 260, maxWidth: 360, width: '100%' }}>
                  <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}></i>
                  <input
                    type="text"
                    placeholder={mailTab === 'inbox' ? "Search inbox messages..." : "Search sent messages..."}
                    value={mailSearch}
                    onChange={(e) => setMailSearch(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.55rem 1rem 0.55rem 2.25rem',
                      borderRadius: 8,
                      border: '1px solid #cbd5e1',
                      background: '#fff',
                      fontSize: '0.88rem',
                      outline: 'none',
                    }}
                  />
                  {mailSearch && (
                    <button
                      type="button"
                      onClick={() => setMailSearch('')}
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.8rem' }}
                    >
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  )}
                </div>
              </div>

              {/* Mail Cards List */}
              {displayMails.length === 0 ? (
                <div style={{ background: '#fff', padding: '3.5rem 1.5rem', borderRadius: 12, textAlign: 'center', color: '#94a3b8', border: '1px dashed #cbd5e1' }}>
                  <i className={mailTab === 'inbox' ? "fa-regular fa-envelope-open" : "fa-regular fa-paper-plane"} style={{ fontSize: '2.5rem', marginBottom: '0.75rem', color: '#cbd5e1' }}></i>
                  <div style={{ fontWeight: 600, fontSize: '1rem', color: '#64748b' }}>
                    {mailSearch ? 'No messages matched your search query.' : (mailTab === 'inbox' ? 'Your inbox is empty.' : 'No sent messages yet.')}
                  </div>
                  <div style={{ fontSize: '0.82rem', marginTop: 4 }}>
                    {mailTab === 'inbox' ? 'User contact form inquiries will appear here.' : 'Click "Compose Mail" above to create and record a system message.'}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  {displayMails.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        background: '#fff',
                        padding: '1rem 1.25rem',
                        borderRadius: 12,
                        border: !m.read && mailTab === 'inbox' ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                        boxShadow: !m.read && mailTab === 'inbox' ? '0 2px 8px rgba(37,99,235,0.08)' : '0 1px 3px rgba(0,0,0,0.03)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '1rem',
                        transition: 'border 0.2s, transform 0.15s',
                        cursor: 'pointer',
                      }}
                      onClick={() => handleOpenMailDetail(m)}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem', flex: 1, minWidth: 0 }}>
                        <div style={{
                          width: 38,
                          height: 38,
                          borderRadius: 10,
                          background: mailTab === 'inbox' ? (!m.read ? '#eff6ff' : '#f1f5f9') : '#f0fdf4',
                          color: mailTab === 'inbox' ? (!m.read ? '#2563eb' : '#64748b') : '#16a34a',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1rem',
                          flexShrink: 0,
                        }}>
                          <i className={mailTab === 'inbox' ? (!m.read ? "fa-solid fa-envelope" : "fa-regular fa-envelope") : "fa-solid fa-paper-plane"}></i>
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>
                              {m.subject || 'No Subject'}
                            </span>
                            {!m.read && mailTab === 'inbox' && (
                              <span style={{ background: '#2563eb', color: '#fff', fontSize: '0.7rem', padding: '1px 6px', borderRadius: 6, fontWeight: 700 }}>
                                NEW
                              </span>
                            )}
                          </div>
                          <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: 2 }}>
                            {mailTab === 'inbox' ? (
                              <>From: <strong>{m.senderName || 'Visitor'}</strong> &bull; {m.senderEmail || m.senderPhone || 'No contact info'}</>
                            ) : (
                              <>To: <strong>{m.toEmail || m.toName || 'User'}</strong> &bull; From: Super Admin</>
                            )}
                          </div>
                          <div style={{ color: '#475569', fontSize: '0.85rem', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {(m.body || m.message || '').slice(0, 120)}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem', flexShrink: 0 }}>
                        <span style={{ fontSize: '0.78rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                          {m.date || (m.timestamp ? new Date(m.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Recent')}
                        </span>
                        <div style={{ display: 'flex', gap: '0.35rem' }} onClick={(e) => e.stopPropagation()}>
                          {mailTab === 'inbox' && m.senderEmail && (
                            <button
                              type="button"
                              title="Quick Reply"
                              onClick={() => handleQuickReply(m)}
                              style={{ background: '#f1f5f9', border: 'none', color: '#2563eb', width: 30, height: 30, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <i className="fa-solid fa-reply" style={{ fontSize: '0.82rem' }}></i>
                            </button>
                          )}
                          <button
                            type="button"
                            title="Delete Message"
                            onClick={() => setDeletingMailItem(m)}
                            style={{ background: '#fef2f2', border: 'none', color: '#ef4444', width: 30, height: 30, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <i className="fa-solid fa-trash-can" style={{ fontSize: '0.82rem' }}></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Mail Detail Modal */}
              {activeMailDetail && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                  <div style={{ background: '#fff', maxWidth: 540, width: '100%', borderRadius: 16, padding: '1.75rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>
                      <div>
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: 4, background: activeMailDetail.isSent || activeMailDetail.folder === 'sent' ? '#f0fdf4' : '#eff6ff', color: activeMailDetail.isSent || activeMailDetail.folder === 'sent' ? '#16a34a' : '#2563eb', textTransform: 'uppercase' }}>
                          {activeMailDetail.isSent || activeMailDetail.folder === 'sent' ? 'Sent Mail' : 'Inbox Inquiry'}
                        </span>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginTop: 6, marginBottom: 2 }}>
                          {activeMailDetail.subject || 'No Subject'}
                        </h3>
                        <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                          {activeMailDetail.date || (activeMailDetail.timestamp ? new Date(activeMailDetail.timestamp).toLocaleString('en-IN') : 'Recent')}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveMailDetail(null)}
                        style={{ background: 'none', border: 'none', fontSize: '1.25rem', color: '#94a3b8', cursor: 'pointer' }}
                      >
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: 8, fontSize: '0.85rem', color: '#475569', marginBottom: '1rem' }}>
                      {activeMailDetail.isSent || activeMailDetail.folder === 'sent' ? (
                        <>
                          <div><strong>To:</strong> {activeMailDetail.toEmail || activeMailDetail.toName || 'User'}</div>
                          <div style={{ marginTop: 2 }}><strong>From:</strong> LocalBazar Super Admin</div>
                        </>
                      ) : (
                        <>
                          <div><strong>From:</strong> {activeMailDetail.senderName || 'Visitor'}</div>
                          <div style={{ marginTop: 2 }}><strong>Email:</strong> {activeMailDetail.senderEmail || 'N/A'}</div>
                          {activeMailDetail.senderPhone && <div style={{ marginTop: 2 }}><strong>Phone:</strong> {activeMailDetail.senderPhone}</div>}
                        </>
                      )}
                    </div>

                    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '1.15rem', fontSize: '0.9rem', lineHeight: 1.6, color: '#1e293b', maxHeight: 280, overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                      {activeMailDetail.body || activeMailDetail.message || 'No content.'}
                    </div>

                    {/* Attached Files if present */}
                    {activeMailDetail.attachments && activeMailDetail.attachments.length > 0 && (
                      <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', marginBottom: '0.4rem' }}>
                          Attached Files ({activeMailDetail.attachments.length}):
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                          {activeMailDetail.attachments.map((att, i) => (
                            <a
                              key={i}
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                padding: '0.35rem 0.65rem',
                                background: '#f1f5f9',
                                border: '1px solid #cbd5e1',
                                borderRadius: 6,
                                fontSize: '0.78rem',
                                color: '#1e293b',
                                textDecoration: 'none',
                                fontWeight: 600,
                              }}
                            >
                              <i className="fa-solid fa-paperclip" style={{ color: '#2563eb' }}></i>
                              <span>{att.name}</span>
                              {att.size && <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>({att.size})</span>}
                              <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: '0.68rem', color: '#64748b', marginLeft: 2 }}></i>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Conversation Thread / Replies if present */}
                    {activeMailDetail.replies && activeMailDetail.replies.length > 0 && (
                      <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#334155', marginBottom: '0.5rem' }}>
                          Conversation Thread ({activeMailDetail.replies.length} replies):
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: 200, overflowY: 'auto' }}>
                          {activeMailDetail.replies.map((rep) => (
                            <div
                              key={rep.id}
                              style={{
                                background: rep.sender === 'admin' ? '#eff6ff' : '#f8fafc',
                                border: rep.sender === 'admin' ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                                borderRadius: 8,
                                padding: '0.6rem 0.85rem',
                                fontSize: '0.84rem',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                                <strong style={{ color: rep.sender === 'admin' ? '#1d4ed8' : '#0f172a', fontSize: '0.78rem' }}>
                                  {rep.sender === 'admin' ? '🛡️ Admin Reply' : rep.senderName}
                                </strong>
                                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{rep.date}</span>
                              </div>
                              <div style={{ color: '#334155', whiteSpace: 'pre-wrap' }}>{rep.message}</div>
                              {rep.attachments && rep.attachments.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: 4 }}>
                                  {rep.attachments.map((att, aIdx) => (
                                    <a key={aIdx} href={att.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.72rem', color: '#2563eb', textDecoration: 'none' }}>
                                      📎 {att.name}
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
                      <button
                        type="button"
                        onClick={() => {
                          const target = activeMailDetail;
                          setActiveMailDetail(null);
                          setDeletingMailItem(target);
                        }}
                        style={{ padding: '0.5rem 0.9rem', borderRadius: 8, background: '#fef2f2', color: '#ef4444', border: 'none', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                      >
                        <i className="fa-solid fa-trash-can"></i> Delete
                      </button>

                      <div style={{ display: 'flex', gap: '0.65rem' }}>
                        {(!activeMailDetail.isSent && activeMailDetail.folder !== 'sent' && activeMailDetail.senderEmail) && (
                          <button
                            type="button"
                            onClick={() => {
                              const target = activeMailDetail;
                              setActiveMailDetail(null);
                              handleQuickReply(target);
                            }}
                            style={{ padding: '0.5rem 1rem', borderRadius: 8, background: '#eff6ff', color: '#2563eb', border: 'none', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                          >
                            <i className="fa-solid fa-reply"></i> Reply
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setActiveMailDetail(null)}
                          style={{ padding: '0.5rem 1.15rem', borderRadius: 8, background: '#2563eb', color: '#fff', border: 'none', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Delete Mail Confirmation Modal */}
              {deletingMailItem && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                  <div style={{ background: '#fff', maxWidth: 420, width: '100%', borderRadius: 16, padding: '1.5rem', textAlign: 'center', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', fontSize: '1.25rem' }}>
                      <i className="fa-solid fa-trash-can"></i>
                    </div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>Delete Message?</h3>
                    <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                      Are you sure you want to delete &ldquo;<strong>{deletingMailItem.subject || 'this message'}</strong>&rdquo;? This cannot be undone.
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
                      <button
                        type="button"
                        onClick={() => setDeletingMailItem(null)}
                        style={{ padding: '0.55rem 1.25rem', borderRadius: 8, background: '#f1f5f9', color: '#475569', border: 'none', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmDeleteMail}
                        style={{ padding: '0.55rem 1.25rem', borderRadius: 8, background: '#dc2626', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Delete Permanently
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VIEW: NEWS & BANNER */}
          {activeView === 'news' && (
            <div className="admin-view-panel active" style={{ padding: '1.5rem' }}>
              {/* Header */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>News &amp; Banner Management</h1>
                <p style={{ color: '#64748b', fontSize: '0.88rem' }}>
                  Manage Home Announcements, Slide Banners, Targeted City &amp; Category Campaigns, and Default Empty Store Banners.
                </p>
              </div>

              {/* 3 Main Tabs: HOME, TARGET CITY & CATEGORY, EMPTY STORE */}
              <div style={{ display: 'flex', gap: '0.65rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setNewsTab('home')}
                  style={{
                    padding: '0.6rem 1.25rem',
                    borderRadius: 10,
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    border: newsTab === 'home' ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                    background: newsTab === 'home' ? '#eff6ff' : '#fff',
                    color: newsTab === 'home' ? '#2563eb' : '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <i className="fa-solid fa-house"></i>
                  <span>HOME</span>
                </button>

                <button
                  type="button"
                  onClick={() => setNewsTab('target')}
                  style={{
                    padding: '0.6rem 1.25rem',
                    borderRadius: 10,
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    border: newsTab === 'target' ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                    background: newsTab === 'target' ? '#eff6ff' : '#fff',
                    color: newsTab === 'target' ? '#2563eb' : '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <i className="fa-solid fa-bullseye"></i>
                  <span>TARGET CITY &amp; CATEGORY</span>
                  {targetList.length > 0 && (
                    <span style={{ background: newsTab === 'target' ? '#2563eb' : '#e2e8f0', color: newsTab === 'target' ? '#fff' : '#475569', borderRadius: 10, padding: '1px 7px', fontSize: '0.72rem' }}>
                      {targetList.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setNewsTab('empty_store')}
                  style={{
                    padding: '0.6rem 1.25rem',
                    borderRadius: 10,
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    border: newsTab === 'empty_store' ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                    background: newsTab === 'empty_store' ? '#eff6ff' : '#fff',
                    color: newsTab === 'empty_store' ? '#2563eb' : '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <i className="fa-solid fa-store"></i>
                  <span>EMPTY STORE (3 BANNERS)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setNewsTab('product_promotion')}
                  style={{
                    padding: '0.6rem 1.25rem',
                    borderRadius: 10,
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    border: newsTab === 'product_promotion' ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                    background: newsTab === 'product_promotion' ? '#eff6ff' : '#fff',
                    color: newsTab === 'product_promotion' ? '#2563eb' : '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <i className="fa-solid fa-bullhorn"></i>
                  <span>PRODUCT PROMOTION</span>
                  {promotedProducts.length > 0 && (
                    <span style={{ background: newsTab === 'product_promotion' ? '#2563eb' : '#e2e8f0', color: newsTab === 'product_promotion' ? '#fff' : '#475569', borderRadius: 10, padding: '1px 7px', fontSize: '0.72rem' }}>
                      {promotedProducts.length}
                    </span>
                  )}
                </button>
              </div>

              {/* ================= TAB 1: HOME ================= */}
              {newsTab === 'home' && (
                <div style={{ display: 'grid', gap: '1.5rem', maxWidth: 1100 }}>
                  {/* Card 1: Home Text News Ticker */}
                  <div style={{ background: '#fff', padding: '1.5rem', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.75rem' }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i className="fa-solid fa-bullhorn"></i>
                      </div>
                      <div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Home Text News (Marquee Ticker)</h3>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Headline notice scrolling across the homepage banner bar</p>
                      </div>
                    </div>

                    <form onSubmit={handleSaveHomeNewsTicker} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <textarea
                        rows={3}
                        required
                        value={newsTicker}
                        onChange={(e) => setNewsTicker(e.target.value)}
                        placeholder="Enter announcement text to scroll on the homepage..."
                        style={{ width: '100%', padding: '0.75rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none' }}
                      />
                      <button
                        type="submit"
                        style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0.65rem 1.25rem', borderRadius: 8, fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                      >
                        <i className="fa-solid fa-floppy-disk"></i> Save Home Headline
                      </button>
                    </form>
                  </div>

                  {/* Card 2: Home Slide Banners */}
                  <div style={{ background: '#fff', padding: '1.5rem', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div style={{ width: 34, height: 34, borderRadius: 8, background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <i className="fa-regular fa-images"></i>
                        </div>
                        <div>
                          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Home Slide Banners ({homeBanners.length})</h3>
                          <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Slide carousel images displayed on the homepage</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsHomeBannerModalOpen(true)}
                        style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0.55rem 1rem', borderRadius: 8, fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                      >
                        <i className="fa-solid fa-plus"></i> Add Slide Banner
                      </button>
                    </div>

                    {homeBanners.length === 0 ? (
                      <div style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8', border: '1px dashed #cbd5e1', borderRadius: 10 }}>
                        <i className="fa-regular fa-image" style={{ fontSize: '2.2rem', marginBottom: '0.5rem', color: '#cbd5e1' }}></i>
                        <div style={{ fontWeight: 600 }}>No Home Slide Banners Added Yet</div>
                        <p style={{ fontSize: '0.82rem', marginTop: 4 }}>Click &quot;Add Slide Banner&quot; above to upload your first 16:9 homepage slider image.</p>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                        {homeBanners.map((b) => (
                          <div key={b.id} style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', background: '#f8fafc', boxShadow: '0 2px 5px rgba(0,0,0,0.04)' }}>
                            <div style={{ aspectRatio: '16 / 9', width: '100%', background: '#0f172a', position: 'relative', overflow: 'hidden' }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={b.imageUrl} alt={b.title || 'Banner'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              <span style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: '0.7rem', padding: '2px 6px', borderRadius: 4, fontWeight: 800 }}>
                                16 : 9
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDeleteHomeBanner(b.id)}
                                title="Delete Banner"
                                style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(239, 68, 68, 0.95)', color: '#fff', border: 'none', width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                <i className="fa-solid fa-trash-can" style={{ fontSize: '0.75rem' }}></i>
                              </button>
                            </div>
                            <div style={{ padding: '0.85rem' }}>
                              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>{b.title || 'Untitled Banner'}</div>
                              {b.link && (
                                <div style={{ fontSize: '0.78rem', color: '#2563eb', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  <i className="fa-solid fa-link" style={{ marginRight: 4 }}></i>{b.link}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ================= TAB 2: TARGET CITY & CATEGORY ================= */}
              {newsTab === 'target' && (
                <div style={{ display: 'grid', gap: '1.5rem', maxWidth: 1100 }}>
                  {/* Selector Box */}
                  <div style={{ background: '#fff', padding: '1.5rem', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1rem' }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i className="fa-solid fa-crosshairs"></i>
                      </div>
                      <div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Target Location &amp; Category Selection</h3>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Choose a City and Category to configure specific announcements and slide banners</p>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                          <i className="fa-solid fa-location-dot" style={{ color: '#2563eb', marginRight: 4 }}></i> Select Target City
                        </label>
                        <select
                          value={targetCity}
                          onChange={(e) => setTargetCity(e.target.value)}
                          style={{ width: '100%', padding: '0.65rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', background: '#fff' }}
                        >
                          {cities.map((c) => (
                            <option key={c.name} value={c.name}>{c.name} ({c.state || 'India'})</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                          <i className="fa-solid fa-layer-group" style={{ color: '#2563eb', marginRight: 4 }}></i> Select Target Category
                        </label>
                        <select
                          value={targetCat}
                          onChange={(e) => setTargetCat(e.target.value)}
                          style={{ width: '100%', padding: '0.65rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', background: '#fff' }}
                        >
                          {categories.map((cat) => (
                            <option key={cat.name} value={cat.name}>{cat.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div style={{ marginTop: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.84rem', color: '#475569' }}>
                      <span>Active Selection:</span>
                      <strong style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: 6 }}>{targetCity || 'City'}</strong>
                      <span>+</span>
                      <strong style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 6 }}>{targetCat || 'Category'}</strong>
                    </div>
                  </div>

                  {/* Targeted Text News Card */}
                  <div style={{ background: '#fff', padding: '1.5rem', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.75rem' }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i className="fa-solid fa-comment-dots"></i>
                      </div>
                      <div>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                          Targeted Text News for &quot;{targetCity}&quot; &bull; &quot;{targetCat}&quot;
                        </h3>
                        <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>Custom announcement shown to users searching this city &amp; category</p>
                      </div>
                    </div>

                    <form onSubmit={handleSaveTargetNews} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                      <textarea
                        rows={3}
                        value={targetTextNews}
                        onChange={(e) => setTargetTextNews(e.target.value)}
                        placeholder={`e.g. Special discounts available for ${targetCat} in ${targetCity} this weekend!`}
                        style={{ width: '100%', padding: '0.75rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none' }}
                      />
                      <button
                        type="submit"
                        style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0.65rem 1.25rem', borderRadius: 8, fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                      >
                        <i className="fa-solid fa-floppy-disk"></i> Save Target News
                      </button>
                    </form>
                  </div>

                  {/* Targeted Slide Banners Card */}
                  <div style={{ background: '#fff', padding: '1.5rem', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div style={{ width: 34, height: 34, borderRadius: 8, background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <i className="fa-solid fa-panorama"></i>
                        </div>
                        <div>
                          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                            Targeted Slide Banners ({currentTargetItem?.slideBanners?.length || 0})
                          </h3>
                          <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>Custom banners displayed when filtering {targetCity} &amp; {targetCat}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsTargetBannerModalOpen(true)}
                        style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0.55rem 1rem', borderRadius: 8, fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                      >
                        <i className="fa-solid fa-plus"></i> Add Targeted Banner
                      </button>
                    </div>

                    {(!currentTargetItem || !currentTargetItem.slideBanners || currentTargetItem.slideBanners.length === 0) ? (
                      <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', border: '1px dashed #cbd5e1', borderRadius: 10 }}>
                        <i className="fa-regular fa-image" style={{ fontSize: '2rem', marginBottom: '0.5rem', color: '#cbd5e1' }}></i>
                        <div style={{ fontWeight: 600 }}>No Targeted Banners for this combination yet</div>
                        <p style={{ fontSize: '0.82rem', marginTop: 4 }}>Add banners tailored exclusively for {targetCity} and {targetCat}.</p>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                        {currentTargetItem.slideBanners.map((b) => (
                          <div key={b.id} style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', background: '#f8fafc', boxShadow: '0 2px 5px rgba(0,0,0,0.04)' }}>
                            <div style={{ aspectRatio: '16 / 9', width: '100%', background: '#0f172a', position: 'relative', overflow: 'hidden' }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={b.imageUrl} alt={b.title || 'Banner'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              <span style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: '0.7rem', padding: '2px 6px', borderRadius: 4, fontWeight: 800 }}>
                                16 : 9
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDeleteTargetBanner(b.id)}
                                title="Delete Banner"
                                style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(239, 68, 68, 0.95)', color: '#fff', border: 'none', width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                <i className="fa-solid fa-trash-can" style={{ fontSize: '0.75rem' }}></i>
                              </button>
                            </div>
                            <div style={{ padding: '0.85rem' }}>
                              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>{b.title || 'Targeted Banner'}</div>
                              {b.link && (
                                <div style={{ fontSize: '0.78rem', color: '#2563eb', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  <i className="fa-solid fa-link" style={{ marginRight: 4 }}></i>{b.link}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* All Configured Targeted Rules Overview Table */}
                  {targetList.length > 0 && (
                    <div style={{ background: '#fff', padding: '1.5rem', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.85rem' }}>
                        All Active Targeted Combinations ({targetList.length})
                      </h3>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                          <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                              <th style={{ padding: '0.65rem 0.85rem' }}>City</th>
                              <th style={{ padding: '0.65rem 0.85rem' }}>Category</th>
                              <th style={{ padding: '0.65rem 0.85rem' }}>Has Text News</th>
                              <th style={{ padding: '0.65rem 0.85rem' }}>Slide Banners</th>
                              <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {targetList.map((t) => (
                              <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700 }}>{t.city}</td>
                                <td style={{ padding: '0.65rem 0.85rem' }}>{t.category}</td>
                                <td style={{ padding: '0.65rem 0.85rem' }}>
                                  {t.textNews ? <span style={{ color: '#16a34a', fontWeight: 700 }}><i className="fa-solid fa-check"></i> Yes</span> : <span style={{ color: '#94a3b8' }}>None</span>}
                                </td>
                                <td style={{ padding: '0.65rem 0.85rem' }}>
                                  <span style={{ background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
                                    {t.slideBanners?.length || 0}
                                  </span>
                                </td>
                                <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTargetCity(t.city);
                                      setTargetCat(t.category);
                                    }}
                                    style={{ background: '#eff6ff', color: '#2563eb', border: 'none', padding: '4px 10px', borderRadius: 6, fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', marginRight: 6 }}
                                  >
                                    Load / Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteTargetRule(t.id)}
                                    style={{ background: '#fef2f2', color: '#ef4444', border: 'none', padding: '4px 8px', borderRadius: 6, fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}
                                  >
                                    <i className="fa-solid fa-trash-can"></i>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ================= TAB 3: EMPTY STORE (4 BANNERS) ================= */}
              {newsTab === 'empty_store' && (
                <div style={{ display: 'grid', gap: '1.5rem', maxWidth: 1100 }}>
                  <div style={{ background: '#fff', padding: '1.5rem', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div style={{ width: 34, height: 34, borderRadius: 8, background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <i className="fa-solid fa-store-slash"></i>
                        </div>
                        <div>
                          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                            Empty Store Fallback Banners (Default 4 Banners)
                          </h3>
                          <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>
                            Shown under the search bar in listings where merchant has not uploaded their own store banners
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleSaveAllEmptyStoreBanners}
                        style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0.65rem 1.35rem', borderRadius: 8, fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 2px 6px rgba(37,99,235,0.2)' }}
                      >
                        <i className="fa-solid fa-floppy-disk"></i> Save All 3 Banners
                      </button>
                    </div>

                    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '0.85rem 1rem', fontSize: '0.84rem', color: '#1e40af', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <i className="fa-solid fa-circle-info" style={{ fontSize: '1rem' }}></i>
                      <span>
                        <strong>Policy:</strong> When a merchant does not have a verified Trust Badge, these 3 default platform banners are shown on their store. Trust Badge merchants with custom banners will display their own promotional banners (up to 3).
                      </span>
                    </div>

                    {/* 3 Banner Slots Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
                      {[1, 2, 3].map((slotNum) => {
                        const slotData = emptyStoreBanners.find(s => s.slot === slotNum) || {
                          slot: slotNum,
                          title: `Banner Slot ${slotNum}`,
                          imageUrl: '',
                          link: '',
                          active: true,
                        };

                        return (
                          <div key={slotNum} style={{ border: '1px solid #cbd5e1', borderRadius: 12, overflow: 'hidden', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ padding: '0.65rem 0.85rem', background: '#0f172a', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>Banner #{slotNum}</span>
                              <span style={{ fontSize: '0.72rem', background: '#2563eb', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>Slot {slotNum}</span>
                            </div>

                            {/* Preview */}
                            <div style={{ aspectRatio: '16 / 9', width: '100%', background: '#0f172a', position: 'relative', overflow: 'hidden' }}>
                              {slotData.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={slotData.imageUrl} alt={slotData.title || `Slot ${slotNum}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.78rem', padding: '1rem', textAlign: 'center' }}>
                                  <i className="fa-regular fa-image" style={{ fontSize: '1.8rem', marginBottom: 4 }}></i>
                                  <span>No 16:9 image uploaded for Slot {slotNum}</span>
                                </div>
                              )}
                              <span style={{ position: 'absolute', top: 6, left: 6, background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: '0.68rem', padding: '1px 6px', borderRadius: 4, fontWeight: 800 }}>
                                16 : 9
                              </span>
                            </div>

                            {/* Inputs */}
                            <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
                              <div>
                                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                                  16:9 Banner Image (Device Upload) <span style={{ color: '#ef4444' }}>*</span>
                                </label>
                                <input
                                  type="file"
                                  accept="image/*"
                                  id={`empty-banner-file-${slotNum}`}
                                  onChange={(e) => handleEmptyStoreFileChange(slotNum, e)}
                                  style={{ display: 'none' }}
                                />
                                <label
                                  htmlFor={`empty-banner-file-${slotNum}`}
                                  style={{
                                    background: '#eff6ff',
                                    border: '1.5px dashed #93c5fd',
                                    color: '#1d4ed8',
                                    padding: '0.6rem 0.85rem',
                                    borderRadius: 8,
                                    fontWeight: 700,
                                    fontSize: '0.8rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    textAlign: 'center',
                                    transition: 'all 0.2s',
                                  }}
                                >
                                  <i className="fa-solid fa-cloud-arrow-up"></i>
                                  <span>{slotData.imageUrl ? 'Change Image from Device' : 'Upload 16:9 from Device'}</span>
                                </label>
                              </div>

                              <div>
                                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#334155', marginBottom: 3 }}>
                                  Banner Title
                                </label>
                                <input
                                  type="text"
                                  value={slotData.title || ''}
                                  placeholder={`Banner Title #${slotNum}`}
                                  onChange={(e) => handleUpdateEmptyStoreSlot(slotNum, 'title', e.target.value)}
                                  style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.85rem', outline: 'none' }}
                                />
                              </div>

                              <div>
                                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#334155', marginBottom: 3 }}>
                                  Redirect Link (Optional)
                                </label>
                                <input
                                  type="text"
                                  value={slotData.link || ''}
                                  placeholder="/explore or https://..."
                                  onChange={(e) => handleUpdateEmptyStoreSlot(slotNum, 'link', e.target.value)}
                                  style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.85rem', outline: 'none' }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ================= TAB 4: PRODUCT PROMOTION ================= */}
              {newsTab === 'product_promotion' && (
                <div style={{ display: 'grid', gap: '1.5rem', maxWidth: 1100 }}>
                  {/* Info / Description Card */}
                  <div style={{ background: '#fff', padding: '1.5rem', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                        <i className="fa-solid fa-bullhorn"></i>
                      </div>
                      <div>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                          Home Page Product Promotion
                        </h3>
                        <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>
                          Select any store by City &amp; Category &rarr; Tick products to feature them on the Home Page under the slide banner as square cards.
                        </p>
                      </div>
                    </div>

                    {/* Filter / Search Form */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginTop: '1.25rem', background: '#f8fafc', padding: '1.25rem', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                      {/* 1. City Auto-Suggest */}
                      <div style={{ position: 'relative' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                          <i className="fa-solid fa-location-dot" style={{ color: '#2563eb', marginRight: 4 }}></i> 1. Select / Type City
                        </label>
                        <div style={{ position: 'relative' }}>
                          <input
                            type="text"
                            placeholder="Type 1st letter of City..."
                            value={promoCityInput}
                            onChange={(e) => {
                              setPromoCityInput(e.target.value);
                              setShowPromoCitySugg(true);
                              setSelectedPromoListing(null);
                            }}
                            onFocus={() => setShowPromoCitySugg(true)}
                            style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.88rem', outline: 'none' }}
                          />
                          {promoCityInput && (
                            <button
                              type="button"
                              onClick={() => {
                                setPromoCityInput('');
                                setShowPromoCitySugg(false);
                                setSelectedPromoListing(null);
                              }}
                              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem' }}
                            >
                              <i className="fa-solid fa-xmark"></i>
                            </button>
                          )}
                        </div>

                        {showPromoCitySugg && (
                          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#fff', borderRadius: 8, border: '1px solid #cbd5e1', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: 200, overflowY: 'auto' }}>
                            {cities
                              .filter((c) => !promoCityInput || (c.name || '').toLowerCase().includes(promoCityInput.toLowerCase()))
                              .map((c) => (
                                <div
                                  key={c.name}
                                  onClick={() => {
                                    setPromoCityInput(c.name);
                                    setShowPromoCitySugg(false);
                                    setSelectedPromoListing(null);
                                  }}
                                  style={{ padding: '0.55rem 0.85rem', cursor: 'pointer', fontSize: '0.85rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between' }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
                                >
                                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{c.name}</span>
                                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{c.district || c.state}</span>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>

                      {/* 2. Category Auto-Suggest */}
                      <div style={{ position: 'relative' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                          <i className="fa-solid fa-layer-group" style={{ color: '#2563eb', marginRight: 4 }}></i> 2. Select / Type Category
                        </label>
                        <div style={{ position: 'relative' }}>
                          <input
                            type="text"
                            placeholder="Type 1st letter of Category..."
                            value={promoCatInput}
                            onChange={(e) => {
                              setPromoCatInput(e.target.value);
                              setShowPromoCatSugg(true);
                              setSelectedPromoListing(null);
                            }}
                            onFocus={() => setShowPromoCatSugg(true)}
                            style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.88rem', outline: 'none' }}
                          />
                          {promoCatInput && (
                            <button
                              type="button"
                              onClick={() => {
                                setPromoCatInput('');
                                setShowPromoCatSugg(false);
                                setSelectedPromoListing(null);
                              }}
                              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem' }}
                            >
                              <i className="fa-solid fa-xmark"></i>
                            </button>
                          )}
                        </div>

                        {showPromoCatSugg && (
                          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#fff', borderRadius: 8, border: '1px solid #cbd5e1', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: 200, overflowY: 'auto' }}>
                            {categories
                              .filter((cat) => !promoCatInput || (cat.name || '').toLowerCase().includes(promoCatInput.toLowerCase()))
                              .map((cat) => (
                                <div
                                  key={cat.name}
                                  onClick={() => {
                                    setPromoCatInput(cat.name);
                                    setShowPromoCatSugg(false);
                                    setSelectedPromoListing(null);
                                  }}
                                  style={{ padding: '0.55rem 0.85rem', cursor: 'pointer', fontSize: '0.85rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
                                >
                                  <i className={`fa-solid ${cat.icon || 'fa-tag'}`} style={{ color: '#2563eb', fontSize: '0.8rem' }}></i>
                                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{cat.name}</span>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>

                      {/* 3. Listing Search Auto-Suggest */}
                      <div style={{ position: 'relative' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                          <i className="fa-solid fa-shop" style={{ color: '#2563eb', marginRight: 4 }}></i> 3. Select Store / Listing
                        </label>
                        <div style={{ position: 'relative' }}>
                          <input
                            type="text"
                            placeholder="Type store name..."
                            value={promoListingQuery}
                            onChange={(e) => {
                              setPromoListingQuery(e.target.value);
                              setShowPromoListingSugg(true);
                            }}
                            onFocus={() => setShowPromoListingSugg(true)}
                            style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.88rem', outline: 'none' }}
                          />
                          {promoListingQuery && (
                            <button
                              type="button"
                              onClick={() => {
                                setPromoListingQuery('');
                                setShowPromoListingSugg(false);
                                setSelectedPromoListing(null);
                              }}
                              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem' }}
                            >
                              <i className="fa-solid fa-xmark"></i>
                            </button>
                          )}
                        </div>

                        {showPromoListingSugg && (
                          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#fff', borderRadius: 8, border: '1px solid #cbd5e1', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: 240, overflowY: 'auto' }}>
                            {listings
                              .filter((l) => {
                                const cityMatch = !promoCityInput || (l.city || '').toLowerCase() === promoCityInput.toLowerCase().trim();
                                const catMatch = !promoCatInput || (l.category || '').toLowerCase() === promoCatInput.toLowerCase().trim();
                                const queryMatch = !promoListingQuery || (l.name || '').toLowerCase().includes(promoListingQuery.toLowerCase().trim());
                                return cityMatch && catMatch && queryMatch;
                              })
                              .map((l) => (
                                <div
                                  key={l.id}
                                  onClick={() => {
                                    setSelectedPromoListing(l);
                                    setPromoListingQuery(l.name);
                                    setShowPromoListingSugg(false);
                                  }}
                                  style={{ padding: '0.6rem 0.85rem', cursor: 'pointer', fontSize: '0.85rem', borderBottom: '1px solid #f1f5f9' }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
                                >
                                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{l.name}</div>
                                  <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', gap: '0.5rem', marginTop: 2 }}>
                                    <span><i className="fa-solid fa-location-dot"></i> {l.city || 'Any City'}</span>
                                    <span>&bull;</span>
                                    <span><i className="fa-solid fa-tag"></i> {l.category || 'Any Category'}</span>
                                    <span>&bull;</span>
                                    <span>{(l.products || []).length} Products</span>
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Selected Store & Product Checklist */}
                    {selectedPromoListing && (
                      <div style={{ marginTop: '1.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem', background: '#eff6ff', padding: '0.85rem 1rem', borderRadius: 10, border: '1px solid #bfdbfe' }}>
                          <div>
                            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#1e3a8a' }}>
                              <i className="fa-solid fa-store" style={{ marginRight: 6 }}></i>
                              {selectedPromoListing.name}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: '#3b82f6', marginTop: 2 }}>
                              {selectedPromoListing.city} &bull; {selectedPromoListing.category} &bull; {(selectedPromoListing.products || []).length} Total Products
                            </div>
                          </div>
                          <span style={{ fontSize: '0.8rem', background: '#2563eb', color: '#fff', padding: '4px 10px', borderRadius: 6, fontWeight: 700 }}>
                            Tick checkbox to promote / unpromote
                          </span>
                        </div>

                        {(!selectedPromoListing.products || selectedPromoListing.products.length === 0) ? (
                          <div style={{ padding: '2rem', textAlign: 'center', background: '#f8fafc', borderRadius: 10, color: '#64748b' }}>
                            <i className="fa-solid fa-box-open" style={{ fontSize: '2rem', marginBottom: '0.5rem', color: '#94a3b8' }}></i>
                            <div style={{ fontWeight: 700 }}>No products found in this store</div>
                            <div style={{ fontSize: '0.8rem' }}>Add products to this listing under the Listings tab to promote them here.</div>
                          </div>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
                            {selectedPromoListing.products.map((prod, idx) => {
                              const prodKey = String(prod.id || prod.name || idx).trim();
                              const isPromoted = promotedProducts.some((p) => p.shopId === selectedPromoListing.id && p.productId === prodKey);
                              const prodImg = (prod.images && prod.images[0]) || prod.image || prod.img || selectedPromoListing.image || '';

                              return (
                                <div
                                  key={prodKey}
                                  onClick={() => handleToggleProductPromotion(prod, selectedPromoListing)}
                                  style={{
                                    border: isPromoted ? '2px solid #10b981' : '1px solid #e2e8f0',
                                    borderRadius: 12,
                                    padding: '0.85rem',
                                    background: isPromoted ? '#f0fdf4' : '#fff',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.5rem',
                                    position: 'relative',
                                  }}
                                >
                                  {/* Checkbox indicator */}
                                  <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 2 }}>
                                    {isPromoted ? (
                                      <span style={{ background: '#10b981', color: '#fff', width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)' }}>
                                        <i className="fa-solid fa-check"></i>
                                      </span>
                                    ) : (
                                      <span style={{ background: '#f1f5f9', color: '#94a3b8', width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', border: '1px solid #cbd5e1' }}>
                                        <i className="fa-solid fa-plus"></i>
                                      </span>
                                    )}
                                  </div>

                                  {/* Product Square Image */}
                                  <div style={{ width: '100%', aspectRatio: '1 / 1', borderRadius: 8, overflow: 'hidden', background: '#f1f5f9' }}>
                                    {prodImg ? (
                                      /* eslint-disable-next-line @next/next/no-img-element */
                                      <img src={prodImg} alt={prod.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                                        <i className="fa-solid fa-image" style={{ fontSize: '1.5rem' }}></i>
                                      </div>
                                    )}
                                  </div>

                                  {/* Product Info */}
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {prod.name}
                                    </div>
                                    {prod.price && (
                                      <div style={{ color: '#059669', fontWeight: 800, fontSize: '0.88rem', marginTop: 2 }}>
                                        ₹{prod.price}
                                      </div>
                                    )}
                                  </div>

                                  {/* Button indicator */}
                                  <button
                                    type="button"
                                    style={{
                                      width: '100%',
                                      padding: '0.45rem',
                                      borderRadius: 8,
                                      border: 'none',
                                      fontSize: '0.78rem',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      background: isPromoted ? '#10b981' : '#2563eb',
                                      color: '#fff',
                                    }}
                                  >
                                    {isPromoted ? '✓ Promoted' : '+ Promote to Home'}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Active Promoted Products List (Currently on Home Page) */}
                  <div style={{ background: '#fff', padding: '1.5rem', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                          Currently Promoted Products on Home ({promotedProducts.length})
                        </h4>
                        <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
                          These appear as square (1:1) cards in the auto-sliding row directly below the slide banner on the Home Page.
                        </p>
                      </div>
                    </div>

                    {promotedProducts.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                        <i className="fa-solid fa-rectangle-ad" style={{ fontSize: '2.5rem', marginBottom: '0.5rem', color: '#cbd5e1' }}></i>
                        <div style={{ fontWeight: 700, color: '#475569' }}>No products currently promoted on Home Page</div>
                        <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: 4 }}>
                          Select a city, category and store above, then tick products to feature them.
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
                        {promotedProducts.map((p) => (
                          <div
                            key={p.id}
                            style={{
                              border: '1px solid #e2e8f0',
                              borderRadius: 12,
                              padding: '0.85rem',
                              background: '#fff',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.5rem',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                            }}
                          >
                            {/* Square Image */}
                            <div style={{ width: '100%', aspectRatio: '1 / 1', borderRadius: 8, overflow: 'hidden', background: '#f8fafc', position: 'relative' }}>
                              {p.image ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img src={p.image} alt={p.productName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                                  <i className="fa-solid fa-image" style={{ fontSize: '1.5rem' }}></i>
                                </div>
                              )}
                              <span style={{ position: 'absolute', top: 6, left: 6, background: '#10b981', color: '#fff', fontSize: '0.68rem', fontWeight: 800, padding: '2px 6px', borderRadius: 4 }}>
                                Live on Home
                              </span>
                            </div>

                            {/* Info */}
                            <div>
                              <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {p.productName}
                              </div>
                              {p.price && (
                                <div style={{ color: '#059669', fontWeight: 800, fontSize: '0.85rem' }}>
                                  ₹{p.price}
                                </div>
                              )}
                              <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                <i className="fa-solid fa-store" style={{ marginRight: 4 }}></i>
                                {p.shopName} ({p.shopCity})
                              </div>
                            </div>

                            {/* Remove Button */}
                            <button
                              type="button"
                              onClick={() => handleRemovePromotedProduct(p.id)}
                              style={{
                                marginTop: 'auto',
                                width: '100%',
                                padding: '0.45rem',
                                borderRadius: 8,
                                border: '1px solid #fecaca',
                                background: '#fef2f2',
                                color: '#ef4444',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.35rem',
                              }}
                            >
                              <i className="fa-solid fa-trash-can"></i>
                              Remove from Home
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Modal: Add Home Slide Banner */}
              {isHomeBannerModalOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                  <div style={{ background: '#fff', maxWidth: 480, width: '100%', borderRadius: 16, padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
                      <div>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>Add Home Slide Banner</h3>
                        <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>Select image from device &bull; Auto-formatted to 16:9 HD ratio</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsHomeBannerModalOpen(false)}
                        style={{ background: 'none', border: 'none', fontSize: '1.2rem', color: '#94a3b8', cursor: 'pointer' }}
                      >
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </div>

                    <form onSubmit={handleAddHomeBanner} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                          16:9 Banner Image (Device Upload) <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          id="home-banner-file-input"
                          onChange={handleHomeBannerFileChange}
                          style={{ display: 'none' }}
                        />
                        <label
                          htmlFor="home-banner-file-input"
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '2px dashed #93c5fd',
                            background: '#eff6ff',
                            borderRadius: 10,
                            padding: '1.25rem 1rem',
                            cursor: 'pointer',
                            textAlign: 'center',
                            transition: 'all 0.2s',
                          }}
                        >
                          <i className="fa-solid fa-cloud-arrow-up" style={{ fontSize: '1.8rem', color: '#2563eb', marginBottom: 6 }}></i>
                          <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#1e40af' }}>
                            {newHomeBannerUrl ? 'Change Image from Device' : 'Click to Upload 16:9 Image from Device'}
                          </span>
                          <span style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 2 }}>
                            JPG, PNG, WebP &bull; Auto-centered to exact 16:9 HD
                          </span>
                        </label>

                        {newHomeBannerUrl && (
                          <div style={{ marginTop: 10, aspectRatio: '16 / 9', width: '100%', borderRadius: 10, overflow: 'hidden', border: '1px solid #cbd5e1', position: 'relative', background: '#0f172a' }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={newHomeBannerUrl} alt="16:9 Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <span style={{ position: 'absolute', top: 6, left: 6, background: '#16a34a', color: '#fff', fontSize: '0.7rem', padding: '2px 7px', borderRadius: 4, fontWeight: 800 }}>
                              16 : 9 HD READY
                            </span>
                          </div>
                        )}
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                          Banner Title (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Festive Sale / Welcome to LocalBazar"
                          value={newHomeBannerTitle}
                          onChange={(e) => setNewHomeBannerTitle(e.target.value)}
                          style={{ width: '100%', padding: '0.65rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                          Target / Redirect Link (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="/explore or https://..."
                          value={newHomeBannerLink}
                          onChange={(e) => setNewHomeBannerLink(e.target.value)}
                          style={{ width: '100%', padding: '0.65rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none' }}
                        />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
                        <button
                          type="button"
                          onClick={() => setIsHomeBannerModalOpen(false)}
                          style={{ padding: '0.6rem 1.25rem', borderRadius: 8, background: '#f1f5f9', color: '#475569', border: 'none', fontWeight: 600, cursor: 'pointer' }}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          style={{ padding: '0.6rem 1.35rem', borderRadius: 8, background: '#2563eb', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer' }}
                        >
                          Add Banner
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Modal: Add Target Slide Banner */}
              {isTargetBannerModalOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                  <div style={{ background: '#fff', maxWidth: 480, width: '100%', borderRadius: 16, padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
                      <div>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>Add Targeted Banner</h3>
                        <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>For {targetCity} &bull; {targetCat} (16:9 Ratio)</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsTargetBannerModalOpen(false)}
                        style={{ background: 'none', border: 'none', fontSize: '1.2rem', color: '#94a3b8', cursor: 'pointer' }}
                      >
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </div>

                    <form onSubmit={handleAddTargetBanner} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                          16:9 Banner Image (Device Upload) <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          id="target-banner-file-input"
                          onChange={handleTargetBannerFileChange}
                          style={{ display: 'none' }}
                        />
                        <label
                          htmlFor="target-banner-file-input"
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '2px dashed #93c5fd',
                            background: '#eff6ff',
                            borderRadius: 10,
                            padding: '1.25rem 1rem',
                            cursor: 'pointer',
                            textAlign: 'center',
                            transition: 'all 0.2s',
                          }}
                        >
                          <i className="fa-solid fa-cloud-arrow-up" style={{ fontSize: '1.8rem', color: '#2563eb', marginBottom: 6 }}></i>
                          <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#1e40af' }}>
                            {newTargetBannerUrl ? 'Change Image from Device' : 'Click to Upload 16:9 Image from Device'}
                          </span>
                          <span style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 2 }}>
                            JPG, PNG, WebP &bull; Auto-centered to exact 16:9 HD
                          </span>
                        </label>

                        {newTargetBannerUrl && (
                          <div style={{ marginTop: 10, aspectRatio: '16 / 9', width: '100%', borderRadius: 10, overflow: 'hidden', border: '1px solid #cbd5e1', position: 'relative', background: '#0f172a' }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={newTargetBannerUrl} alt="16:9 Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <span style={{ position: 'absolute', top: 6, left: 6, background: '#16a34a', color: '#fff', fontSize: '0.7rem', padding: '2px 7px', borderRadius: 4, fontWeight: 800 }}>
                              16 : 9 HD READY
                            </span>
                          </div>
                        )}
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                          Banner Title (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder={`e.g. Best ${targetCat} in ${targetCity}`}
                          value={newTargetBannerTitle}
                          onChange={(e) => setNewTargetBannerTitle(e.target.value)}
                          style={{ width: '100%', padding: '0.65rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                          Target / Redirect Link (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="/explore or https://..."
                          value={newTargetBannerLink}
                          onChange={(e) => setNewTargetBannerLink(e.target.value)}
                          style={{ width: '100%', padding: '0.65rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none' }}
                        />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
                        <button
                          type="button"
                          onClick={() => setIsTargetBannerModalOpen(false)}
                          style={{ padding: '0.6rem 1.25rem', borderRadius: 8, background: '#f1f5f9', color: '#475569', border: 'none', fontWeight: 600, cursor: 'pointer' }}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          style={{ padding: '0.6rem 1.35rem', borderRadius: 8, background: '#2563eb', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer' }}
                        >
                          Add Target Banner
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VIEW: SETTINGS */}
          {activeView === 'settings' && (
            <div className="admin-view-panel active" style={{ padding: '1.5rem' }}>
              <div style={{ marginBottom: '1.25rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>Command Center Settings</h1>
                <p style={{ color: '#64748b', fontSize: '0.88rem' }}>Security credentials, password updates, and full database backups.</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                {/* Security Credentials Card */}
                <div style={{ background: '#fff', padding: '1.5rem', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '1rem', color: '#0f172a' }}>
                    <i className="fa-solid fa-lock" style={{ color: '#2563eb', marginRight: 8 }}></i> Change Admin Credentials
                  </h3>
                  {settingsNotice && (
                    <div style={{ background: '#ecfdf5', color: '#047857', padding: '0.65rem', borderRadius: 8, fontSize: '0.85rem', marginBottom: '1rem' }}>
                      {settingsNotice}
                    </div>
                  )}
                  <form onSubmit={handleSaveSettingsCredentials} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Admin Email</label>
                      <input
                        type="email"
                        placeholder="localbazar@adminmanaspan.com"
                        value={adminEmailInput}
                        onChange={(e) => setAdminEmailInput(e.target.value)}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1px solid #cbd5e1', marginTop: 4 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>New Password</label>
                      <input
                        type="password"
                        placeholder="Enter new password"
                        value={adminNewPwd}
                        onChange={(e) => setAdminNewPwd(e.target.value)}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1px solid #cbd5e1', marginTop: 4 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Confirm Password</label>
                      <input
                        type="password"
                        placeholder="Re-enter new password"
                        value={adminConfirmPwd}
                        onChange={(e) => setAdminConfirmPwd(e.target.value)}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1px solid #cbd5e1', marginTop: 4 }}
                      />
                    </div>
                    <button
                      type="submit"
                      style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0.65rem', borderRadius: 8, fontWeight: 700, cursor: 'pointer', marginTop: 4 }}
                    >
                      Update Credentials
                    </button>
                  </form>
                </div>

                {/* Database Backup Card */}
                <div style={{ background: '#fff', padding: '1.5rem', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.5rem', color: '#0f172a' }}>
                    <i className="fa-solid fa-database" style={{ color: '#10b981', marginRight: 8 }}></i> Database Backup
                  </h3>
                  <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                    Download a full JSON archive containing all verified listings, users, categories, cities, and claims.
                  </p>
                  <button
                    type="button"
                    onClick={handleExportBackup}
                    style={{ background: '#0f172a', color: '#fff', border: 'none', padding: '0.75rem 1.25rem', borderRadius: 8, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    <i className="fa-solid fa-download"></i> Export Full Backup JSON
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* User Requested Cities Modal */}
          {isCityRequestsModalOpen && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
              <div style={{ background: '#fff', maxWidth: 540, width: '100%', borderRadius: 16, padding: '1.5rem', maxHeight: '85vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>User-Requested Cities</h3>
                    <p style={{ color: '#64748b', fontSize: '0.82rem' }}>Edit spelling/state, then approve to add into database.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setIsCityRequestsModalOpen(false); setEditingCityReq(null); }}
                    style={{ background: 'none', border: 'none', fontSize: '1.25rem', color: '#64748b', cursor: 'pointer' }}
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>

                {cityRequests.length === 0 ? (
                  <div style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8' }}>
                    <i className="fa-solid fa-city" style={{ fontSize: '2.5rem', marginBottom: '0.75rem', color: '#cbd5e1' }}></i>
                    <div>No pending city requests from users right now.</div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '0.85rem' }}>
                    {cityRequests.map((cr) => {
                      const isEditing = editingCityReq?.id === cr.id;
                      if (isEditing) {
                        return (
                          <div key={cr.id} style={{ background: '#eff6ff', padding: '1rem', borderRadius: 10, border: '1.5px solid #2563eb' }}>
                            <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#1e3a8a', marginBottom: 8 }}>
                              <i className="fa-solid fa-pen-to-square"></i> Edit City Details before Approving:
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                              <div>
                                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>City / Hub Name</label>
                                <input
                                  type="text"
                                  value={editingCityReq.cityName}
                                  onChange={(e) => setEditingCityReq({ ...editingCityReq, cityName: e.target.value })}
                                  style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid #93c5fd', marginTop: 2, fontSize: '0.88rem' }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>State</label>
                                <input
                                  type="text"
                                  value={editingCityReq.state}
                                  onChange={(e) => setEditingCityReq({ ...editingCityReq, state: e.target.value })}
                                  placeholder="e.g. West Bengal"
                                  style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid #93c5fd', marginTop: 2, fontSize: '0.88rem' }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>District</label>
                                <input
                                  type="text"
                                  value={editingCityReq.district || ''}
                                  onChange={(e) => setEditingCityReq({ ...editingCityReq, district: e.target.value })}
                                  placeholder="e.g. Paschim Bardhaman"
                                  style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid #93c5fd', marginTop: 2, fontSize: '0.88rem' }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>PIN Code</label>
                                <input
                                  type="text"
                                  value={editingCityReq.pinCode || ''}
                                  onChange={(e) => setEditingCityReq({ ...editingCityReq, pinCode: e.target.value })}
                                  placeholder="e.g. 713301"
                                  style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid #93c5fd', marginTop: 2, fontSize: '0.88rem' }}
                                />
                              </div>
                              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: 4 }}>
                                <button
                                  type="button"
                                  onClick={() => setEditingCityReq(null)}
                                  style={{ padding: '0.4rem 0.8rem', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.8rem', cursor: 'pointer' }}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleApproveCityRequest(editingCityReq.id, editingCityReq.cityName, editingCityReq.district, editingCityReq.state, editingCityReq.pinCode)}
                                  style={{ padding: '0.4rem 0.9rem', borderRadius: 6, border: 'none', background: '#10b981', color: '#fff', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
                                >
                                  <i className="fa-solid fa-check"></i> Approve & Add
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={cr.id}
                          style={{ background: '#f8fafc', padding: '1rem', borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        >
                          <div>
                            <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '1rem' }}>
                              <i className="fa-solid fa-location-dot" style={{ color: '#2563eb', marginRight: 6 }}></i>
                              {cr.cityName}
                            </div>
                            <div style={{ color: '#64748b', fontSize: '0.78rem', marginTop: 2 }}>
                              Requested by: {cr.requestedBy || cr.userPhone || 'User'} • {cr.date || 'Recent'}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <button
                              type="button"
                              onClick={() => setEditingCityReq({ id: cr.id, cityName: cr.cityName, district: '', state: 'West Bengal', pinCode: '', popular: false })}
                              style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0.45rem 0.85rem', borderRadius: 6, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                            >
                              <i className="fa-solid fa-pen-to-square"></i> Edit & Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectCityRequest(cr.id)}
                              style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fecdd3', padding: '0.45rem 0.75rem', borderRadius: 6, fontSize: '0.8rem', cursor: 'pointer' }}
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* User Requested Categories Modal */}
          {isCatRequestsModalOpen && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
              <div style={{ background: '#fff', maxWidth: 540, width: '100%', borderRadius: 16, padding: '1.5rem', maxHeight: '85vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>User-Requested Categories</h3>
                    <p style={{ color: '#64748b', fontSize: '0.82rem' }}>Edit name/icon, then approve to add into database.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setIsCatRequestsModalOpen(false); setEditingCatReq(null); }}
                    style={{ background: 'none', border: 'none', fontSize: '1.25rem', color: '#64748b', cursor: 'pointer' }}
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>

                {catRequests.length === 0 ? (
                  <div style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8' }}>
                    <i className="fa-solid fa-tags" style={{ fontSize: '2.5rem', marginBottom: '0.75rem', color: '#cbd5e1' }}></i>
                    <div>No pending category requests from users right now.</div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '0.85rem' }}>
                    {catRequests.map((cr) => {
                      const isEditing = editingCatReq?.id === cr.id;
                      if (isEditing) {
                        return (
                          <div key={cr.id} style={{ background: '#eff6ff', padding: '1rem', borderRadius: 10, border: '1.5px solid #2563eb' }}>
                            <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#1e3a8a', marginBottom: 8 }}>
                              <i className="fa-solid fa-pen-to-square"></i> Edit Category Details before Approving:
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                              <div>
                                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>Category Name</label>
                                <input
                                  type="text"
                                  value={editingCatReq.categoryName}
                                  onChange={(e) => setEditingCatReq({ ...editingCatReq, categoryName: e.target.value })}
                                  style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid #93c5fd', marginTop: 2, fontSize: '0.88rem' }}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>FontAwesome Icon (e.g. fa-utensils, fa-store)</label>
                                <input
                                  type="text"
                                  value={editingCatReq.icon}
                                  onChange={(e) => setEditingCatReq({ ...editingCatReq, icon: e.target.value })}
                                  style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid #93c5fd', marginTop: 2, fontSize: '0.88rem' }}
                                />
                              </div>
                              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: 4 }}>
                                <button
                                  type="button"
                                  onClick={() => setEditingCatReq(null)}
                                  style={{ padding: '0.4rem 0.8rem', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.8rem', cursor: 'pointer' }}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleApproveCatRequest(editingCatReq.id, editingCatReq.categoryName, editingCatReq.icon)}
                                  style={{ padding: '0.4rem 0.9rem', borderRadius: 6, border: 'none', background: '#10b981', color: '#fff', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
                                >
                                  <i className="fa-solid fa-check"></i> Approve & Add
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={cr.id}
                          style={{ background: '#f8fafc', padding: '1rem', borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        >
                          <div>
                            <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '1rem' }}>
                              <i className="fa-solid fa-tag" style={{ color: '#0284c7', marginRight: 6 }}></i>
                              {cr.categoryName}
                            </div>
                            <div style={{ color: '#64748b', fontSize: '0.78rem', marginTop: 2 }}>
                              Requested by: {cr.requestedBy || cr.userPhone || 'User'} • {cr.date || 'Recent'}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <button
                              type="button"
                              onClick={() => setEditingCatReq({ id: cr.id, categoryName: cr.categoryName, icon: 'fa-store' })}
                              style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0.45rem 0.85rem', borderRadius: 6, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                            >
                              <i className="fa-solid fa-pen-to-square"></i> Edit & Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectCatRequest(cr.id)}
                              style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fecdd3', padding: '0.45rem 0.75rem', borderRadius: 6, fontSize: '0.8rem', cursor: 'pointer' }}
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 1. User Profile & Details Modal */}
          {viewingUserModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
              <div style={{ background: '#fff', maxWidth: 640, width: '100%', borderRadius: 16, padding: '1.75rem', maxHeight: '90vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={viewingUserModal.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                      alt="Avatar"
                      style={{ width: 50, height: 50, borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>{viewingUserModal.name || 'Member User'}</h3>
                      <div style={{ color: '#64748b', fontSize: '0.82rem', marginTop: 2 }}>
                        ID: <strong style={{ color: '#1a73e8' }}>{viewingUserModal.id}</strong> • Role: {viewingUserModal.role || 'User'}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setViewingUserModal(null)}
                    style={{ background: 'none', border: 'none', fontSize: '1.3rem', color: '#64748b', cursor: 'pointer' }}
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>

                {/* Account Details Matrix */}
                <div style={{ background: '#f8fafc', padding: '1rem 1.25rem', borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#334155', marginBottom: '0.75rem' }}>
                    <i className="fa-regular fa-address-card" style={{ color: '#2563eb', marginRight: 6 }}></i> Personal & Contact Info
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', fontSize: '0.85rem' }}>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Gender</span>
                      <strong style={{ color: '#0f172a' }}>{viewingUserModal.gender || 'Not specified'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Date of Birth</span>
                      <strong style={{ color: '#0f172a' }}>{viewingUserModal.dob || viewingUserModal.dateOfBirth || 'Not specified'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Mobile No</span>
                      <strong style={{ color: '#0f172a' }}>{viewingUserModal.phone || 'N/A'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Email ID</span>
                      <strong style={{ color: '#0f172a' }}>{viewingUserModal.email || 'N/A'}</strong>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Full Address</span>
                      <strong style={{ color: '#0f172a' }}>{viewingUserModal.address || viewingUserModal.city || 'Not specified'}</strong>
                    </div>
                  </div>
                </div>

                {/* All Listings of this User */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      <i className="fa-solid fa-store" style={{ color: '#10b981', marginRight: 6 }}></i>
                      User&apos;s Business Listings ({getUserListings(viewingUserModal).length})
                    </h4>
                  </div>

                  {getUserListings(viewingUserModal).length === 0 ? (
                    <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: 10, fontSize: '0.85rem' }}>
                      No business listings added by this user yet.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: '0.65rem' }}>
                      {getUserListings(viewingUserModal).map((l) => (
                        <div
                          key={l.id}
                          style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: 10, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={l.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100'}
                              alt={l.name}
                              style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }}
                            />
                            <div>
                              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.92rem' }}>{l.name}</div>
                              <div style={{ color: '#64748b', fontSize: '0.78rem' }}>{l.category} • {l.city}</div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            {l.trustBadge ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: '#fef3c7', color: '#b45309', padding: '0.25rem 0.55rem', borderRadius: 8, fontWeight: 700, fontSize: '0.75rem' }}>
                                <i className="fa-solid fa-shield-halved"></i> Gold Trust Badge
                              </span>
                            ) : (
                              <span style={{ background: '#f1f5f9', color: '#64748b', padding: '0.25rem 0.55rem', borderRadius: 8, fontSize: '0.75rem' }}>
                                Standard Store
                              </span>
                            )}
                            <Link
                              href={`/shops/${encodeURIComponent(l.id)}`}
                              target="_blank"
                              style={{ background: '#eff6ff', color: '#2563eb', padding: '0.3rem 0.6rem', borderRadius: 6, textDecoration: 'none', fontSize: '0.78rem', fontWeight: 600 }}
                            >
                              <i className="fa-solid fa-arrow-up-right-from-square"></i>
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '1.5rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      const email = viewingUserModal.email || '';
                      const name = viewingUserModal.name || 'User';
                      setViewingUserModal(null);
                      setComposeTo(email);
                      setComposeSubject(`Notice regarding your LocalBazar account (${name})`);
                      setComposeBody(`Dear ${name},\n\n`);
                      setComposeModalOpen(true);
                    }}
                    style={{ padding: '0.55rem 1.15rem', borderRadius: 8, background: '#2563eb', color: '#fff', border: 'none', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.45rem' }}
                  >
                    <i className="fa-solid fa-envelope"></i> Send Mail
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewingUserModal(null)}
                    style={{ padding: '0.55rem 1.25rem', borderRadius: 8, background: '#0f172a', color: '#fff', border: 'none', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 2. Block / Unblock Confirmation Modal */}
          {blockingUserModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
              <div style={{ background: '#fff', maxWidth: 440, width: '100%', borderRadius: 16, padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                  <div style={{ width: 56, height: 56, margin: '0 auto 0.75rem', borderRadius: '50%', background: (blockingUserModal.blocked || blockingUserModal.isBlocked) ? '#ecfdf5' : '#fef2f2', color: (blockingUserModal.blocked || blockingUserModal.isBlocked) ? '#047857' : '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
                    <i className={`fa-solid ${(blockingUserModal.blocked || blockingUserModal.isBlocked) ? 'fa-lock-open' : 'fa-ban'}`}></i>
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    {(blockingUserModal.blocked || blockingUserModal.isBlocked) ? 'Unblock User Account?' : 'Block User Account?'}
                  </h3>
                  <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: 6, lineHeight: 1.5 }}>
                    {(blockingUserModal.blocked || blockingUserModal.isBlocked)
                      ? `Unblocking ${blockingUserModal.name} (${blockingUserModal.id}) will restore their full access to sign in and manage business listings.`
                      : `Blocking ${blockingUserModal.name} (${blockingUserModal.id}) will instantly prevent them from signing in, submitting listings, or reviewing on LocalBazar.`
                    }
                  </p>
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Type <span style={{ color: '#ef4444' }}>CONFIRM</span> to proceed:
                  </label>
                  <input
                    type="text"
                    placeholder='Type "CONFIRM"'
                    value={blockConfirmText}
                    onChange={(e) => setBlockConfirmText(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: '0.9rem', textAlign: 'center', letterSpacing: '0.05em' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.6rem' }}>
                  <button
                    type="button"
                    onClick={() => { setBlockingUserModal(null); setBlockConfirmText(''); }}
                    style={{ flex: 1, padding: '0.6rem', borderRadius: 8, border: '1px solid #cbd5e1', background: '#f8fafc', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={blockConfirmText.trim().toUpperCase() !== 'CONFIRM'}
                    onClick={handleConfirmToggleBlockUser}
                    style={{
                      flex: 1,
                      padding: '0.6rem',
                      borderRadius: 8,
                      border: 'none',
                      background: blockConfirmText.trim().toUpperCase() === 'CONFIRM'
                        ? ((blockingUserModal.blocked || blockingUserModal.isBlocked) ? '#10b981' : '#e11d48')
                        : '#cbd5e1',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: '0.88rem',
                      cursor: blockConfirmText.trim().toUpperCase() === 'CONFIRM' ? 'pointer' : 'not-allowed'
                    }}
                  >
                    {(blockingUserModal.blocked || blockingUserModal.isBlocked) ? 'Confirm Unblock' : 'Confirm Block'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 3. Delete User & All Listings Modal */}
          {deletingUserModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
              <div style={{ background: '#fff', maxWidth: 460, width: '100%', borderRadius: 16, padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                  <div style={{ width: 56, height: 56, margin: '0 auto 0.75rem', borderRadius: '50%', background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem' }}>
                    <i className="fa-solid fa-triangle-exclamation"></i>
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    Delete User & All Listings?
                  </h3>
                  <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 10, padding: '0.75rem 0.9rem', marginTop: '0.75rem', textAlign: 'left', fontSize: '0.82rem', color: '#9f1239', lineHeight: 1.5 }}>
                    <strong>Warning:</strong> This will permanently delete user <strong>{deletingUserModal.name}</strong> ({deletingUserModal.id}) AND completely erase all <strong>{getUserListings(deletingUserModal).length} listing(s)</strong> created by this user from the entire database. This action is irreversible!
                  </div>
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Type <span style={{ color: '#ef4444' }}>CONFIRM</span> to permanently delete:
                  </label>
                  <input
                    type="text"
                    placeholder='Type "CONFIRM"'
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: '0.9rem', textAlign: 'center', letterSpacing: '0.05em' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.6rem' }}>
                  <button
                    type="button"
                    onClick={() => { setDeletingUserModal(null); setDeleteConfirmText(''); }}
                    style={{ flex: 1, padding: '0.6rem', borderRadius: 8, border: '1px solid #cbd5e1', background: '#f8fafc', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={deleteConfirmText.trim().toUpperCase() !== 'CONFIRM'}
                    onClick={handleConfirmDeleteUserAndListings}
                    style={{
                      flex: 1,
                      padding: '0.6rem',
                      borderRadius: 8,
                      border: 'none',
                      background: deleteConfirmText.trim().toUpperCase() === 'CONFIRM' ? '#ef4444' : '#cbd5e1',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: '0.88rem',
                      cursor: deleteConfirmText.trim().toUpperCase() === 'CONFIRM' ? 'pointer' : 'not-allowed'
                    }}
                  >
                    Permanently Delete
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 4. Complete Listing Details Modal */}
          {viewingListingModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
              <div style={{ background: '#fff', maxWidth: 760, width: '100%', borderRadius: 16, padding: '1.75rem', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={viewingListingModal.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=120'}
                      alt={viewingListingModal.name}
                      style={{ width: 60, height: 60, borderRadius: 10, objectFit: 'cover' }}
                    />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                          {viewingListingModal.name}
                        </h2>
                        {viewingListingModal.trustBadge && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: '#fef3c7', color: '#b45309', padding: '0.2rem 0.55rem', borderRadius: 8, fontWeight: 700, fontSize: '0.75rem' }}>
                            <i className="fa-solid fa-shield-halved"></i> Gold Trust Badge
                          </span>
                        )}
                        {(viewingListingModal.isPublic === false || viewingListingModal.status === 'draft') ? (
                          <span style={{ background: '#fef3c7', color: '#b45309', padding: '0.2rem 0.55rem', borderRadius: 8, fontSize: '0.75rem', fontWeight: 700 }}>
                            Hidden / Draft
                          </span>
                        ) : (
                          <span style={{ background: '#ecfdf5', color: '#047857', padding: '0.2rem 0.55rem', borderRadius: 8, fontSize: '0.75rem', fontWeight: 700 }}>
                            Published
                          </span>
                        )}
                      </div>
                      <div style={{ color: '#64748b', fontSize: '0.82rem', marginTop: 4 }}>
                        ID: <strong style={{ color: '#1a73e8' }}>{viewingListingModal.id}</strong> • Category: <strong>{viewingListingModal.category || 'General'}</strong> • City: <strong>{viewingListingModal.city || 'India'}</strong>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Link
                      href={`/shops/${encodeURIComponent(viewingListingModal.id)}`}
                      target="_blank"
                      style={{ background: '#eff6ff', color: '#2563eb', padding: '0.45rem 0.85rem', borderRadius: 8, textDecoration: 'none', fontSize: '0.82rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                      <span>Open Live Store</span>
                      <i className="fa-solid fa-arrow-up-right-from-square"></i>
                    </Link>
                    <button
                      type="button"
                      onClick={() => setViewingListingModal(null)}
                      style={{ background: 'none', border: 'none', fontSize: '1.4rem', color: '#64748b', cursor: 'pointer', padding: '0.25rem' }}
                    >
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  </div>
                </div>

                {/* Slider Banners & Gallery photos if present */}
                {((viewingListingModal.gallery && viewingListingModal.gallery.length > 0) || (viewingListingModal.images && viewingListingModal.images.length > 0) || (viewingListingModal.banners && viewingListingModal.banners.length > 0)) && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#475569', marginBottom: 6 }}>
                      <i className="fa-regular fa-images" style={{ color: '#2563eb', marginRight: 6 }}></i> Slide Banners & Store Photos
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: 6 }}>
                      {Array.from(new Set([
                        ...(viewingListingModal.gallery || []),
                        ...(viewingListingModal.images || []),
                        ...(viewingListingModal.banners || [])
                      ])).map((imgSrc, idx) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={idx}
                          src={imgSrc}
                          alt={`Gallery ${idx + 1}`}
                          style={{ width: 110, height: 75, borderRadius: 8, objectFit: 'cover', border: '1px solid #e2e8f0', flexShrink: 0 }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Details Matrix */}
                <div style={{ background: '#f8fafc', padding: '1rem 1.25rem', borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#334155', marginBottom: '0.75rem' }}>
                    <i className="fa-solid fa-circle-info" style={{ color: '#0284c7', marginRight: 6 }}></i> Business & Contact Information
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem', fontSize: '0.85rem' }}>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Mobile Number</span>
                      <strong style={{ color: '#0f172a' }}>{viewingListingModal.phone || 'N/A'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>WhatsApp Number</span>
                      <strong style={{ color: '#16a34a' }}>
                        <i className="fa-brands fa-whatsapp" style={{ marginRight: 4 }}></i>
                        {viewingListingModal.whatsapp || viewingListingModal.phone || 'N/A'}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Operating Timings</span>
                      <strong style={{ color: '#0f172a' }}>{viewingListingModal.scheduleTimings || 'Standard business hours'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Created / Owner ID</span>
                      <strong style={{ color: '#0f172a' }}>{viewingListingModal.createdBy || viewingListingModal.ownerId || viewingListingModal.ownerPhone || 'Merchant'}</strong>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Full Address</span>
                      <strong style={{ color: '#0f172a' }}>{viewingListingModal.address || 'Address not listed'}</strong>
                    </div>
                    {viewingListingModal.mapLink && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem' }}>Google Maps Location</span>
                        <a
                          href={viewingListingModal.mapLink}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: '#2563eb', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.35rem', textDecoration: 'none', marginTop: 2 }}
                        >
                          <i className="fa-solid fa-location-dot" style={{ color: '#ef4444' }}></i>
                          <span>View on Google Maps</span>
                          <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: '0.75rem' }}></i>
                        </a>
                      </div>
                    )}
                    {viewingListingModal.desc && (
                      <div style={{ gridColumn: '1 / -1', background: '#ffffff', padding: '0.75rem', borderRadius: 8, border: '1px solid #e2e8f0', marginTop: 4 }}>
                        <span style={{ color: '#64748b', display: 'block', fontSize: '0.75rem', marginBottom: 2 }}>About Business</span>
                        <div style={{ color: '#334155', lineHeight: 1.5, fontSize: '0.82rem' }}>{viewingListingModal.desc}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Product Catalog */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      <i className="fa-solid fa-box-open" style={{ color: '#f59e0b', marginRight: 6 }}></i>
                      Products & Catalog ({(viewingListingModal.products || []).length})
                    </h3>
                  </div>

                  {(!viewingListingModal.products || viewingListingModal.products.length === 0) ? (
                    <div style={{ padding: '1.75rem', textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: 10, fontSize: '0.85rem' }}>
                      <i className="fa-solid fa-basket-shopping" style={{ fontSize: '1.75rem', marginBottom: 6, display: 'block', color: '#cbd5e1' }}></i>
                      No products or catalog items added to this store yet.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
                      {viewingListingModal.products.map((p, idx) => (
                        <div key={idx} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '0.75rem', display: 'flex', flexDirection: 'column' }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={p.image || p.img || (p.images && p.images[0]) || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=150'}
                            alt={p.name}
                            style={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 8, marginBottom: '0.5rem' }}
                          />
                          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.88rem' }}>{p.name}</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                            <span style={{ color: '#16a34a', fontWeight: 800, fontSize: '0.88rem' }}>
                              {p.price ? (p.price.startsWith('₹') ? p.price : `₹${p.price}`) : 'Price on request'}
                            </span>
                            <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.15rem 0.45rem', borderRadius: 6, background: (p.inStock === false || p.stockStatus === 'out_of_stock') ? '#fef2f2' : '#ecfdf5', color: (p.inStock === false || p.stockStatus === 'out_of_stock') ? '#ef4444' : '#047857' }}>
                              {(p.inStock === false || p.stockStatus === 'out_of_stock') ? 'Out of Stock' : 'In Stock'}
                            </span>
                          </div>
                          {(p.details || p.desc || p.description) && (
                            <p style={{ color: '#64748b', fontSize: '0.78rem', marginTop: 4, margin: '4px 0 0', lineHeight: 1.4 }}>
                              {p.details || p.desc || p.description}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '1.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      const ownerUser = users.find(
                        (u) =>
                          (u.id && (u.id === viewingListingModal.ownerId || u.id === viewingListingModal.createdBy)) ||
                          (u.email && viewingListingModal.ownerEmail && u.email.toLowerCase() === viewingListingModal.ownerEmail.toLowerCase()) ||
                          (viewingListingModal.createdBy && u.email && u.email.toLowerCase() === viewingListingModal.createdBy.toLowerCase())
                      );
                      const ownerEmail = viewingListingModal.ownerEmail || (viewingListingModal.createdBy?.includes('@') ? viewingListingModal.createdBy : '') || ownerUser?.email || '';
                      const ownerName = viewingListingModal.ownerName || ownerUser?.name || viewingListingModal.name;

                      setViewingListingModal(null);
                      setComposeTo(ownerEmail);
                      setComposeSubject(`Important update regarding your listing "${viewingListingModal.name}"`);
                      setComposeBody(`Dear ${ownerName},\n\nWe are contacting you from LocalBazar administration regarding your listing "${viewingListingModal.name}" (${viewingListingModal.category || 'Business'} in ${viewingListingModal.city || 'India'}).\n\n`);
                      setComposeModalOpen(true);
                    }}
                    style={{ padding: '0.55rem 1.15rem', borderRadius: 8, background: '#2563eb', color: '#fff', border: 'none', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.45rem' }}
                  >
                    <i className="fa-solid fa-envelope"></i> Mail Owner
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewingListingModal(null)}
                    style={{ padding: '0.55rem 1.5rem', borderRadius: 8, background: '#0f172a', color: '#fff', border: 'none', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 5. View / Hide Confirmation Modal */}
          {hidingListingModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
              <div style={{ background: '#fff', maxWidth: 450, width: '100%', borderRadius: 16, padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                  <div style={{
                    width: 56,
                    height: 56,
                    margin: '0 auto 0.75rem',
                    borderRadius: '50%',
                    background: (hidingListingModal.isPublic === false || hidingListingModal.status === 'draft') ? '#ecfdf5' : '#fef3c7',
                    color: (hidingListingModal.isPublic === false || hidingListingModal.status === 'draft') ? '#047857' : '#d97706',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem'
                  }}>
                    <i className={`fa-solid ${(hidingListingModal.isPublic === false || hidingListingModal.status === 'draft') ? 'fa-eye' : 'fa-eye-slash'}`}></i>
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    {(hidingListingModal.isPublic === false || hidingListingModal.status === 'draft')
                      ? 'Unhide / Publish Listing?'
                      : 'Hide Listing from Public?'}
                  </h3>
                  <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: 6, lineHeight: 1.5 }}>
                    {(hidingListingModal.isPublic === false || hidingListingModal.status === 'draft')
                      ? `Unhiding "${hidingListingModal.name}" (ID: ${hidingListingModal.id}) will make it publicly visible again across all search and city directory pages.`
                      : `Hiding "${hidingListingModal.name}" (ID: ${hidingListingModal.id}) will instantly take it off public searches. Regular users will not be able to find or view it.`
                    }
                  </p>
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Type <span style={{ color: '#ef4444' }}>CONFIRM</span> to proceed:
                  </label>
                  <input
                    type="text"
                    placeholder='Type "CONFIRM"'
                    value={hideListingConfirmText}
                    onChange={(e) => setHideListingConfirmText(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: '0.9rem', textAlign: 'center', letterSpacing: '0.05em' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.6rem' }}>
                  <button
                    type="button"
                    onClick={() => { setHidingListingModal(null); setHideListingConfirmText(''); }}
                    style={{ flex: 1, padding: '0.6rem', borderRadius: 8, border: '1px solid #cbd5e1', background: '#f8fafc', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={hideListingConfirmText.trim().toUpperCase() !== 'CONFIRM'}
                    onClick={handleConfirmToggleHideListing}
                    style={{
                      flex: 1,
                      padding: '0.6rem',
                      borderRadius: 8,
                      border: 'none',
                      background: hideListingConfirmText.trim().toUpperCase() === 'CONFIRM'
                        ? ((hidingListingModal.isPublic === false || hidingListingModal.status === 'draft') ? '#10b981' : '#d97706')
                        : '#cbd5e1',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: '0.88rem',
                      cursor: hideListingConfirmText.trim().toUpperCase() === 'CONFIRM' ? 'pointer' : 'not-allowed'
                    }}
                  >
                    {(hidingListingModal.isPublic === false || hidingListingModal.status === 'draft') ? 'Confirm Unhide' : 'Confirm Hide'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 6. Permanently Delete Single Listing Confirmation Modal */}
          {deletingListingModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
              <div style={{ background: '#fff', maxWidth: 450, width: '100%', borderRadius: 16, padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                  <div style={{ width: 56, height: 56, margin: '0 auto 0.75rem', borderRadius: '50%', background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem' }}>
                    <i className="fa-solid fa-trash-can"></i>
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    Permanently Delete Listing?
                  </h3>
                  <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 10, padding: '0.75rem 0.9rem', marginTop: '0.75rem', textAlign: 'left', fontSize: '0.82rem', color: '#9f1239', lineHeight: 1.5 }}>
                    <strong>Warning:</strong> This will permanently delete <strong>{deletingListingModal.name}</strong> (ID: {deletingListingModal.id}) along with its product catalog and photos from the database. This action CANNOT be undone!
                  </div>
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Type <span style={{ color: '#ef4444' }}>CONFIRM</span> to permanently delete:
                  </label>
                  <input
                    type="text"
                    placeholder='Type "CONFIRM"'
                    value={deleteListingConfirmText}
                    onChange={(e) => setDeleteListingConfirmText(e.target.value)}
                    style={{ width: '100%', padding: '0.55rem 0.85rem', borderRadius: 8, border: '1.5px solid #cbd5e1', fontSize: '0.9rem', textAlign: 'center', letterSpacing: '0.05em' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.6rem' }}>
                  <button
                    type="button"
                    onClick={() => { setDeletingListingModal(null); setDeleteListingConfirmText(''); }}
                    style={{ flex: 1, padding: '0.6rem', borderRadius: 8, border: '1px solid #cbd5e1', background: '#f8fafc', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={deleteListingConfirmText.trim().toUpperCase() !== 'CONFIRM'}
                    onClick={handleConfirmDeleteListing}
                    style={{
                      flex: 1,
                      padding: '0.6rem',
                      borderRadius: 8,
                      border: 'none',
                      background: deleteListingConfirmText.trim().toUpperCase() === 'CONFIRM' ? '#ef4444' : '#cbd5e1',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: '0.88rem',
                      cursor: deleteListingConfirmText.trim().toUpperCase() === 'CONFIRM' ? 'pointer' : 'not-allowed'
                    }}
                  >
                    Permanently Delete
                  </button>
                </div>
              </div>
            </div>
          )}
          {/* Global Compose Mail Modal */}
          {composeModalOpen && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
              <div style={{ background: '#fff', maxWidth: 540, width: '100%', borderRadius: 16, padding: '1.75rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
                      <i className="fa-solid fa-pen-to-square"></i>
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Compose Mail</h3>
                      <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>Send and record an official system message</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setComposeModalOpen(false)}
                    style={{ background: 'none', border: 'none', fontSize: '1.2rem', color: '#94a3b8', cursor: 'pointer' }}
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>

                <form onSubmit={handleSendComposeMail} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                      To (Recipient Email) <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="email"
                      list="registered-users-datalist"
                      required
                      placeholder="user@example.com or choose registered user"
                      value={composeTo}
                      onChange={(e) => setComposeTo(e.target.value)}
                      style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none' }}
                    />
                    <datalist id="registered-users-datalist">
                      {uniqueUsers.filter(u => u.email).map((u) => (
                        <option key={u.id || u.email} value={u.email}>
                          {u.name || 'User'} ({u.email})
                        </option>
                      ))}
                    </datalist>
                    <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: 3 }}>
                      Tip: Type or select an email from registered platform users.
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                      Subject <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Enter message subject..."
                      value={composeSubject}
                      onChange={(e) => setComposeSubject(e.target.value)}
                      style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                      Message Body <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <textarea
                      rows={6}
                      required
                      placeholder="Type your official message or instructions here..."
                      value={composeBody}
                      onChange={(e) => setComposeBody(e.target.value)}
                      style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', resize: 'vertical' }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
                    <button
                      type="button"
                      onClick={() => setComposeModalOpen(false)}
                      style={{ padding: '0.6rem 1.25rem', borderRadius: 8, background: '#f1f5f9', color: '#475569', border: 'none', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={composeSending}
                      style={{ padding: '0.6rem 1.35rem', borderRadius: 8, background: '#2563eb', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.88rem', cursor: composeSending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                      {composeSending ? (
                        <>
                          <i className="fa-solid fa-spinner fa-spin"></i> Sending...
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-paper-plane"></i> Send Mail
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
          {/* ================= MODAL: APPROVE CLAIM ================= */}
          {claimToApprove && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
              <div style={{ background: '#fff', maxWidth: 520, width: '100%', borderRadius: 16, padding: '1.5rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className="fa-solid fa-check" style={{ fontSize: '1.1rem' }}></i>
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Approve Ownership Claim</h3>
                      <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0 }}>Transfer listing management to claimant</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setClaimToApprove(null)}
                    style={{ background: 'none', border: 'none', fontSize: '1.2rem', color: '#94a3b8', cursor: 'pointer' }}
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>

                <div style={{ background: '#f8fafc', padding: '0.9rem', borderRadius: 10, border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.84rem', color: '#475569', marginBottom: 4 }}>
                    Target Listing: <strong style={{ color: '#0f172a' }}>{claimToApprove.listingName}</strong> (ID: {claimToApprove.listingId})
                  </div>
                  <div style={{ fontSize: '0.84rem', color: '#475569' }}>
                    New Owner: <strong style={{ color: '#0f172a' }}>{claimToApprove.claimantName || claimToApprove.applicantName}</strong>
                    {' '}({claimToApprove.claimantPhone || claimToApprove.claimantEmail})
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#059669', marginTop: 6, fontWeight: 600 }}>
                    <i className="fa-solid fa-circle-check" style={{ marginRight: 4 }}></i>
                    Listing will instantly move to this user&apos;s &quot;Manage Your Business&quot; account.
                  </div>
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    Approval Message / Note to User (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Your verification documents have been approved. Welcome to LocalBazar Business!"
                    value={claimApprovalNote}
                    onChange={(e) => setClaimApprovalNote(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.86rem', boxSizing: 'border-box' }}
                  ></textarea>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
                  <button
                    type="button"
                    onClick={() => setClaimToApprove(null)}
                    style={{ padding: '0.55rem 1.15rem', borderRadius: 8, background: '#f1f5f9', color: '#475569', border: 'none', fontWeight: 600, fontSize: '0.86rem', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleApproveClaimConfirm}
                    style={{ padding: '0.55rem 1.35rem', borderRadius: 8, background: '#10b981', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.86rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', boxShadow: '0 2px 6px rgba(16,185,129,0.3)' }}
                  >
                    <i className="fa-solid fa-check"></i>
                    Confirm & Transfer Ownership
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ================= MODAL: REJECT CLAIM ================= */}
          {claimToReject && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
              <div style={{ background: '#fff', maxWidth: 520, width: '100%', borderRadius: 16, padding: '1.5rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#fef2f2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '1.1rem' }}></i>
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Reject Ownership Claim</h3>
                      <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0 }}>Provide clear feedback so user can re-apply</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setClaimToReject(null)}
                    style={{ background: 'none', border: 'none', fontSize: '1.2rem', color: '#94a3b8', cursor: 'pointer' }}
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>

                <div style={{ background: '#fef2f2', padding: '0.75rem 0.9rem', borderRadius: 10, border: '1px solid #fecdd3', marginBottom: '1rem', fontSize: '0.82rem', color: '#991b1b' }}>
                  Rejecting claim for <strong>{claimToReject.listingName}</strong> by <strong>{claimToReject.claimantName || claimToReject.applicantName}</strong>.
                </div>

                {/* Quick Presets */}
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#64748b', marginBottom: '0.35rem' }}>
                    Quick Presets (Click to insert):
                  </label>
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    {[
                      'Trade license / GST name does not match applicant.',
                      'Uploaded documents are blurry or unreadable.',
                      'Insufficient proof of ownership. Please upload trade license or electricity bill.',
                      'Contact number could not be verified with shop records.',
                    ].map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setClaimRejectReason(preset)}
                        style={{
                          fontSize: '0.72rem',
                          background: '#f1f5f9',
                          border: '1px solid #cbd5e1',
                          padding: '0.2rem 0.55rem',
                          borderRadius: 6,
                          color: '#334155',
                          cursor: 'pointer',
                        }}
                      >
                        {preset.slice(0, 32)}...
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    Rejection Reason & Explanation *
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Write why this claim was rejected so the applicant can submit correct documents..."
                    value={claimRejectReason}
                    onChange={(e) => setClaimRejectReason(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.86rem', boxSizing: 'border-box' }}
                  ></textarea>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
                  <button
                    type="button"
                    onClick={() => setClaimToReject(null)}
                    style={{ padding: '0.55rem 1.15rem', borderRadius: 8, background: '#f1f5f9', color: '#475569', border: 'none', fontWeight: 600, fontSize: '0.86rem', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleRejectClaimConfirm}
                    style={{ padding: '0.55rem 1.35rem', borderRadius: 8, background: '#ef4444', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.86rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', boxShadow: '0 2px 6px rgba(239,68,68,0.3)' }}
                  >
                    <i className="fa-solid fa-xmark"></i>
                    Confirm Rejection
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ================= MODAL: REPLY TO CLAIMANT ================= */}
          {claimToReply && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
              <div style={{ background: '#fff', maxWidth: 500, width: '100%', borderRadius: 16, padding: '1.5rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className="fa-solid fa-reply" style={{ fontSize: '1rem' }}></i>
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Message / Reply to Claimant</h3>
                      <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0 }}>Visible directly in applicant&apos;s account</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setClaimToReply(null)}
                    style={{ background: 'none', border: 'none', fontSize: '1.2rem', color: '#94a3b8', cursor: 'pointer' }}
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>

                <div style={{ background: '#f8fafc', padding: '0.75rem 0.9rem', borderRadius: 10, border: '1px solid #e2e8f0', marginBottom: '1rem', fontSize: '0.82rem', color: '#334155' }}>
                  To: <strong>{claimToReply.claimantName || claimToReply.applicantName}</strong> for <strong>{claimToReply.listingName}</strong>
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    Admin Message / Instructions *
                  </label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Enter instructions, request additional documents, or provide verification feedback..."
                    value={claimReplyText}
                    onChange={(e) => setClaimReplyText(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.86rem', boxSizing: 'border-box' }}
                  ></textarea>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
                  <button
                    type="button"
                    onClick={() => setClaimToReply(null)}
                    style={{ padding: '0.55rem 1.15rem', borderRadius: 8, background: '#f1f5f9', color: '#475569', border: 'none', fontWeight: 600, fontSize: '0.86rem', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSendClaimReply}
                    style={{ padding: '0.55rem 1.35rem', borderRadius: 8, background: '#2563eb', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.86rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', boxShadow: '0 2px 6px rgba(37,99,235,0.3)' }}
                  >
                    <i className="fa-solid fa-paper-plane"></i>
                    Send Message
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ================= MODAL: TRUST BADGE SETTINGS ================= */}
          {showTrustSettingsModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
              <div style={{ background: '#fff', maxWidth: 540, width: '100%', borderRadius: 16, padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className="fa-solid fa-gear" style={{ fontSize: '1.1rem' }}></i>
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Trust Badge Pricing & QR Settings</h3>
                      <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0 }}>Control user pricing and payment QR scanner</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTrustSettingsModal(false)}
                    style={{ background: 'none', border: 'none', fontSize: '1.2rem', color: '#94a3b8', cursor: 'pointer' }}
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>

                <form onSubmit={handleSaveTrustSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* Two Prices: Crossed Price & Final Price */}
                  <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '1rem' }}>
                    <div style={{ fontWeight: 800, color: '#92400e', fontSize: '0.84rem', marginBottom: '0.65rem' }}>
                      <i className="fa-solid fa-tags" style={{ marginRight: 5 }}></i>
                      Pricing Display (Strikethrough Price + Final Offer Price)
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#78350f', marginBottom: '0.25rem' }}>
                          Original / Strikethrough MRP *
                        </label>
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontWeight: 800, color: '#94a3b8' }}>₹</span>
                          <input
                            type="number"
                            required
                            min="1"
                            value={settingOrigPrice}
                            onChange={(e) => setSettingOrigPrice(e.target.value)}
                            placeholder="999"
                            style={{ width: '100%', padding: '0.55rem 0.55rem 0.55rem 1.6rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.9rem', fontWeight: 700, boxSizing: 'border-box' }}
                          />
                        </div>
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 2, display: 'block' }}>e.g. ₹999 (crossed out)</span>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#78350f', marginBottom: '0.25rem' }}>
                          Discounted Offer Price *
                        </label>
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontWeight: 800, color: '#16a34a' }}>₹</span>
                          <input
                            type="number"
                            required
                            min="1"
                            value={settingOfferPrice}
                            onChange={(e) => setSettingOfferPrice(e.target.value)}
                            placeholder="299"
                            style={{ width: '100%', padding: '0.55rem 0.55rem 0.55rem 1.6rem', borderRadius: 8, border: '1.5px solid #16a34a', fontSize: '0.9rem', fontWeight: 800, color: '#16a34a', boxSizing: 'border-box' }}
                          />
                        </div>
                        <span style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: 700, marginTop: 2, display: 'block' }}>User pays this amount / Year</span>
                      </div>
                    </div>
                  </div>

                  {/* UPI Details */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '0.25rem' }}>
                        Official UPI ID *
                      </label>
                      <input
                        type="text"
                        required
                        value={settingUpiId}
                        onChange={(e) => setSettingUpiId(e.target.value)}
                        placeholder="e.g. localbazar@upi"
                        style={{ width: '100%', padding: '0.55rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.86rem', boxSizing: 'border-box' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '0.25rem' }}>
                        Payee / Beneficiary Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={settingUpiName}
                        onChange={(e) => setSettingUpiName(e.target.value)}
                        placeholder="e.g. LocalBazar Official"
                        style={{ width: '100%', padding: '0.55rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.86rem', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>

                  {/* QR Scanner Image Upload */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '0.25rem' }}>
                      Payment QR Scanner Image (Upload Scanner Photo or enter URL)
                    </label>

                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <label
                        style={{
                          background: '#f8fafc',
                          border: '1.5px dashed #94a3b8',
                          borderRadius: 8,
                          padding: '0.55rem 1rem',
                          cursor: 'pointer',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          color: '#334155',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                        }}
                      >
                        <i className="fa-solid fa-cloud-arrow-up" style={{ color: '#d97706' }}></i>
                        {settingQrUploading ? 'Uploading Image...' : 'Upload QR Photo from Computer'}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleQrFileUpload}
                          style={{ display: 'none' }}
                        />
                      </label>
                    </div>

                    <input
                      type="text"
                      placeholder="Or paste QR Image URL..."
                      value={settingQrImage}
                      onChange={(e) => setSettingQrImage(e.target.value)}
                      style={{ width: '100%', padding: '0.55rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.84rem', boxSizing: 'border-box' }}
                    />

                    {/* QR Preview Box */}
                    <div style={{ marginTop: '0.75rem', textAlign: 'center', background: '#f8fafc', padding: '0.85rem', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 700, marginBottom: 6 }}>
                        Current Scanner Preview (What User Will See):
                      </div>
                      <div style={{ width: 140, height: 140, margin: '0 auto', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {settingQrImage ? (
                          <img src={settingQrImage} alt="Custom QR" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        ) : (
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                              `upi://pay?pa=${settingUpiId || 'localbazar@upi'}&pn=${encodeURIComponent(
                                settingUpiName || 'LocalBazar'
                              )}&am=${settingOfferPrice || 299}&cu=INR`
                            )}`}
                            alt="Dynamic UPI QR"
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                          />
                        )}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 700, marginTop: 4 }}>
                        {settingQrImage ? 'Custom QR Image Active' : 'Auto-generated UPI QR Active'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
                    <button
                      type="button"
                      onClick={() => setShowTrustSettingsModal(false)}
                      style={{ padding: '0.55rem 1.15rem', borderRadius: 8, background: '#f1f5f9', color: '#475569', border: 'none', fontWeight: 600, fontSize: '0.86rem', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      style={{ padding: '0.55rem 1.35rem', borderRadius: 8, background: '#d97706', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.86rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', boxShadow: '0 2px 6px rgba(217,119,6,0.3)' }}
                    >
                      <i className="fa-solid fa-check"></i>
                      Save Pricing & Scanner Settings
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ================= MODAL: APPROVE TRUST BADGE ================= */}
          {trustToApprove && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
              <div style={{ background: '#fff', maxWidth: 500, width: '100%', borderRadius: 16, padding: '1.5rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className="fa-solid fa-shield-halved" style={{ fontSize: '1.1rem' }}></i>
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Grant Gold Trust Badge</h3>
                      <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0 }}>Verify payment & activate verified shield</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTrustToApprove(null)}
                    style={{ background: 'none', border: 'none', fontSize: '1.2rem', color: '#94a3b8', cursor: 'pointer' }}
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>

                <div style={{ background: '#f8fafc', padding: '0.9rem', borderRadius: 10, border: '1px solid #e2e8f0', marginBottom: '1rem', fontSize: '0.84rem', color: '#334155' }}>
                  <div>Business: <strong style={{ color: '#0f172a' }}>{trustToApprove.businessName || trustToApprove.listingName}</strong></div>
                  <div style={{ marginTop: 3 }}>Owner: <strong>{trustToApprove.applicantName || trustToApprove.ownerName}</strong> ({trustToApprove.phone})</div>
                  <div style={{ marginTop: 3 }}>
                    UTR Number: <strong style={{ fontFamily: 'monospace', color: '#b45309' }}>{trustToApprove.transactionId || 'N/A'}</strong>
                    {' '}• Amount: <strong style={{ color: '#16a34a' }}>₹{trustToApprove.amountPaid || 299}</strong>
                  </div>
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    Approval Message / Note (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Payment verified & Gold Trust Badge activated."
                    value={trustApprovalNote}
                    onChange={(e) => setTrustApprovalNote(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.86rem', boxSizing: 'border-box' }}
                  ></textarea>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
                  <button
                    type="button"
                    onClick={() => setTrustToApprove(null)}
                    style={{ padding: '0.55rem 1.15rem', borderRadius: 8, background: '#f1f5f9', color: '#475569', border: 'none', fontWeight: 600, fontSize: '0.86rem', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleApproveTrustConfirm}
                    style={{ padding: '0.55rem 1.35rem', borderRadius: 8, background: 'linear-gradient(135deg, #d97706, #b45309)', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.86rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', boxShadow: '0 2px 6px rgba(217,119,6,0.3)' }}
                  >
                    <i className="fa-solid fa-shield-halved"></i>
                    Confirm & Grant Badge
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ================= MODAL: REJECT TRUST BADGE ================= */}
          {trustToReject && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
              <div style={{ background: '#fff', maxWidth: 500, width: '100%', borderRadius: 16, padding: '1.5rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#fef2f2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '1.1rem' }}></i>
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Reject Trust Application</h3>
                      <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0 }}>Provide explanation for claimant</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTrustToReject(null)}
                    style={{ background: 'none', border: 'none', fontSize: '1.2rem', color: '#94a3b8', cursor: 'pointer' }}
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </div>

                <div style={{ background: '#fef2f2', padding: '0.75rem 0.9rem', borderRadius: 10, border: '1px solid #fecdd3', marginBottom: '1rem', fontSize: '0.82rem', color: '#991b1b' }}>
                  Rejecting application for <strong>{trustToReject.businessName || trustToReject.listingName}</strong> (UTR: {trustToReject.transactionId || 'None'}).
                </div>

                {/* Quick Presets */}
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#64748b', marginBottom: '0.35rem' }}>
                    Quick Presets (Click to insert):
                  </label>
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    {[
                      'Transaction ID / UTR could not be verified in bank statement.',
                      'Amount paid does not match the ₹299 fee.',
                      'Attached trade license / GST certificate is invalid or unreadable.',
                      'Contact number could not be verified.',
                    ].map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setTrustRejectReason(preset)}
                        style={{
                          fontSize: '0.72rem',
                          background: '#f1f5f9',
                          border: '1px solid #cbd5e1',
                          padding: '0.2rem 0.55rem',
                          borderRadius: 6,
                          color: '#334155',
                          cursor: 'pointer',
                        }}
                      >
                        {preset.slice(0, 32)}...
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                    Rejection Reason & Explanation *
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Enter reason why this application was rejected..."
                    value={trustRejectReason}
                    onChange={(e) => setTrustRejectReason(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.86rem', boxSizing: 'border-box' }}
                  ></textarea>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
                  <button
                    type="button"
                    onClick={() => setTrustToReject(null)}
                    style={{ padding: '0.55rem 1.15rem', borderRadius: 8, background: '#f1f5f9', color: '#475569', border: 'none', fontWeight: 600, fontSize: '0.86rem', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleRejectTrustConfirm}
                    style={{ padding: '0.55rem 1.35rem', borderRadius: 8, background: '#ef4444', color: '#fff', border: 'none', fontWeight: 700, fontSize: '0.86rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', boxShadow: '0 2px 6px rgba(239,68,68,0.3)' }}
                  >
                    <i className="fa-solid fa-xmark"></i>
                    Confirm Rejection
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ================= MODAL: TRUST DOCUMENT / PAYMENT PREVIEW ================= */}
          {trustDocPreview && (
            <div
              onClick={() => setTrustDocPreview(null)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(6px)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{ background: '#0f172a', borderRadius: 16, maxWidth: 800, width: '100%', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column' }}
              >
                <div style={{ padding: '0.9rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.92rem' }}>{trustDocPreview.name}</div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <a
                      href={trustDocPreview.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#38bdf8', fontSize: '0.82rem', textDecoration: 'none', fontWeight: 700, padding: '0.35rem 0.75rem', borderRadius: 6, background: 'rgba(56,189,248,0.1)' }}
                    >
                      <i className="fa-solid fa-arrow-up-right-from-square"></i> Open Full
                    </a>
                    <button
                      type="button"
                      onClick={() => setTrustDocPreview(null)}
                      style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.3rem', cursor: 'pointer', padding: 4 }}
                    >
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  </div>
                </div>
                <div style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', maxHeight: '75vh', overflow: 'auto', background: '#020617' }}>
                  <img
                    src={trustDocPreview.url}
                    alt={trustDocPreview.name}
                    style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 8 }}
                  />
                </div>
              </div>
            </div>
          )}
          {claimDocPreview && (
            <div
              onClick={() => setClaimDocPreview(null)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(6px)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{ background: '#0f172a', borderRadius: 16, maxWidth: 800, width: '100%', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column' }}
              >
                <div style={{ padding: '0.9rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.92rem' }}>{claimDocPreview.name}</div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <a
                      href={claimDocPreview.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#38bdf8', fontSize: '0.82rem', textDecoration: 'none', fontWeight: 700, padding: '0.35rem 0.75rem', borderRadius: 6, background: 'rgba(56,189,248,0.1)' }}
                    >
                      <i className="fa-solid fa-arrow-up-right-from-square"></i> Open Full
                    </a>
                    <button
                      type="button"
                      onClick={() => setClaimDocPreview(null)}
                      style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.3rem', cursor: 'pointer', padding: 4 }}
                    >
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  </div>
                </div>
                <div style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', maxHeight: '75vh', overflow: 'auto', background: '#020617' }}>
                  <img
                    src={claimDocPreview.url}
                    alt={claimDocPreview.name}
                    style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 8 }}
                  />
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
