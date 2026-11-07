'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cloudSync, uploadImageToCloud, formatLBUserId, auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Listing, UserProfile, CategoryItem, CityItem, ProductItem, DoctorItem, DailyScheduleDay, EmptyStoreBannerSlot, ClaimItem, ClaimDocument, TrustRequest, TrustBadgeSettings, MailItem, MailAttachment, MailReplyItem, isTrustBadgeActive, getTrustBadgeDaysRemaining } from '@/types';

type AccountScreen =
  | 'viewMainMenu'
  | 'viewAccount'
  | 'viewAddListing'
  | 'viewManageListings'
  | 'viewSavedPlaces'
  | 'viewHelp'
  | 'viewSettings'
  | 'viewClaimListing'
  | 'viewTrustBadge';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const DEFAULT_SCHEDULE: Record<string, DailyScheduleDay> = {
  Monday: { isOpen: true, openTime: '09:00', openAmPm: 'AM', closeTime: '08:30', closeAmPm: 'PM' },
  Tuesday: { isOpen: true, openTime: '09:00', openAmPm: 'AM', closeTime: '08:30', closeAmPm: 'PM' },
  Wednesday: { isOpen: true, openTime: '09:00', openAmPm: 'AM', closeTime: '08:30', closeAmPm: 'PM' },
  Thursday: { isOpen: true, openTime: '09:00', openAmPm: 'AM', closeTime: '08:30', closeAmPm: 'PM' },
  Friday: { isOpen: true, openTime: '09:00', openAmPm: 'AM', closeTime: '08:30', closeAmPm: 'PM' },
  Saturday: { isOpen: true, openTime: '09:00', openAmPm: 'AM', closeTime: '08:30', closeAmPm: 'PM' },
  Sunday: { isOpen: false, openTime: '09:00', openAmPm: 'AM', closeTime: '08:30', closeAmPm: 'PM' },
};

// Helper to format Date of Birth to YYYY-MM-DD for native calendar inputs
const formatDobForInput = (val?: string): string => {
  if (!val) return '';
  const trimmed = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  // If DD/MM/YYYY or DD-MM-YYYY
  if (/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.test(trimmed)) {
    const parts = trimmed.split(/[\/\-]/);
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    const y = parts[2];
    return `${y}-${m}-${d}`;
  }
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return '';
};

export default function AccountPage() {
  const router = useRouter();

  // Active Screen
  const [activeScreen, setActiveScreen] = useState<AccountScreen>('viewMainMenu');
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('lb_current_user');
        if (raw) return JSON.parse(raw);
      } catch {}
    }
    return null;
  });
  const [authChecked, setAuthChecked] = useState(false);
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [savedPlaces, setSavedPlaces] = useState<Listing[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [cities, setCities] = useState<CityItem[]>([]);
  const [allListings, setAllListings] = useState<Listing[]>([]);

  // Personal Profile Form State
  const [profileName, setProfileName] = useState('');
  const [profileGender, setProfileGender] = useState('');
  const [profileDob, setProfileDob] = useState('1995-01-05');
  const [profileCity, setProfileCity] = useState('');
  const [profileState, setProfileState] = useState('');
  const [profilePincode, setProfilePincode] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileMemberSince, setProfileMemberSince] = useState('');
  const [avatarLoadError, setAvatarLoadError] = useState(false);

  // Modern Toast Notification State (Replacing intrusive alerts)
  const [toastMsg, setToastMsg] = useState<{ show: boolean; text: string; type: 'success' | 'info' | 'error' }>({
    show: false,
    text: '',
    type: 'success'
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Add / Edit Listing Form State
  const [listingStep, setListingStep] = useState(1);
  const goToListingStep = (step: number) => {
    setListingStep(step);
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        const activePill = document.querySelector('.listing-steps-bar .step-nav-pill.active') as HTMLElement | null;
        if (activePill) {
          activePill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
        const stepsBar = document.getElementById('listingStepsBar');
        if (stepsBar) {
          stepsBar.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 60);
    }
  };

  useEffect(() => {
    if (activeScreen === 'viewAddListing' && typeof window !== 'undefined') {
      const activePill = document.querySelector('.listing-steps-bar .step-nav-pill.active') as HTMLElement | null;
      if (activePill) {
        activePill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [listingStep, activeScreen]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formMapLink, setFormMapLink] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPhotos, setFormPhotos] = useState<string[]>([]);
  const [formSchedule, setFormSchedule] = useState<Record<string, DailyScheduleDay>>(DEFAULT_SCHEDULE);
  const [formHolidays, setFormHolidays] = useState<string[]>([]);
  const [calDate, setCalDate] = useState<Date>(new Date());
  const [formProducts, setFormProducts] = useState<ProductItem[]>([]);
  const [formDoctors, setFormDoctors] = useState<DoctorItem[]>([]);

  // Suggestions
  const [showCatSuggestions, setShowCatSuggestions] = useState(false);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);

  // Manage Your Business Filters & Search
  const [bizSearch, setBizSearch] = useState('');
  const [bizCityFilter, setBizCityFilter] = useState('ALL');
  const [bizTypeFilter, setBizTypeFilter] = useState<'all' | 'main' | 'branches'>('all');
  const [qrModalListing, setQrModalListing] = useState<Listing | null>(null);
  const [qrCopied, setQrCopied] = useState(false);

  // Merchant Portal Drawer (Matching media_1793697023434_8b2f0362.jpg)
  const [activePortalListing, setActivePortalListing] = useState<Listing | null>(null);
  const activePortalListingRef = useRef<Listing | null>(null);
  activePortalListingRef.current = activePortalListing;

  const [portalTab, setPortalTab] = useState<'gallery' | 'identity' | 'actions' | 'catalog' | 'banners' | 'schedule'>('gallery');
  const [portalDrawerOpen, setPortalDrawerOpen] = useState(true);
  const portalDrawerOpenRef = useRef<boolean>(portalDrawerOpen);
  portalDrawerOpenRef.current = portalDrawerOpen;

  // Portal Form Editing States
  const [portalName, setPortalName] = useState('');
  const [portalCategory, setPortalCategory] = useState('');
  const [showPortalCatSuggestions, setShowPortalCatSuggestions] = useState(false);
  const [portalCity, setPortalCity] = useState('');
  const [showPortalCitySuggestions, setShowPortalCitySuggestions] = useState(false);
  const [portalAddress, setPortalAddress] = useState('');
  const [portalMapLink, setPortalMapLink] = useState('');
  const [portalDesc, setPortalDesc] = useState('');
  const [portalPhone, setPortalPhone] = useState('');
  const [portalWhatsapp, setPortalWhatsapp] = useState('');
  const [portalSchedule, setPortalSchedule] = useState<Record<string, DailyScheduleDay>>(DEFAULT_SCHEDULE);
  const [portalHolidays, setPortalHolidays] = useState<string[]>([]);
  const [portalBanners, setPortalBanners] = useState<string[]>([]);
  const [emptyStoreBanners, setEmptyStoreBanners] = useState<EmptyStoreBannerSlot[]>([]);

  // Holiday Selection Modal & Bottom Sheet States
  const [showHolidayCalModal, setShowHolidayCalModal] = useState(false);
  const [showHolidayListSheet, setShowHolidayListSheet] = useState(false);
  const [tempSelectedHolidays, setTempSelectedHolidays] = useState<string[]>([]);
  const [calViewingDate, setCalViewingDate] = useState<Date>(new Date());
  const [holidayTarget, setHolidayTarget] = useState<'form' | 'portal'>('form');

  // Add / Edit Product Modal State (Matching media_1793702691549_ce9bc242.jpg)
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [editingProductIdx, setEditingProductIdx] = useState<number | null>(null);
  const [prodName, setProdName] = useState('');
  const [prodCategory, setProdCategory] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodStockStatus, setProdStockStatus] = useState<'in_stock' | 'out_of_stock'>('in_stock');
  const [prodDescription, setProdDescription] = useState('');
  const [prodIsTop, setProdIsTop] = useState(false);
  const [prodImages, setProdImages] = useState<string[]>([]);
  const [prodUploading, setProdUploading] = useState(false);
  const prodFileInputRef = useRef<HTMLInputElement>(null);

  // Products & Services View Controls (Matching media_1793702691549_72856844.jpg)
  const [catalogCatFilter, setCatalogCatFilter] = useState('all');
  const [previewProduct, setPreviewProduct] = useState<ProductItem | null>(null);
  const [showSelectTopModal, setShowSelectTopModal] = useState(false);

  // Notification Alert Modal
  const [alertData, setAlertData] = useState<{
    show: boolean;
    title: string;
    message: string;
    type: 'success' | 'warning' | 'error';
    buttonText: string;
    onConfirm?: () => void;
  }>({
    show: false,
    title: '',
    message: '',
    type: 'warning',
    buttonText: 'Understood',
  });

  // Theme State
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');

  // Claim My Listing States
  const [claimTab, setClaimTab] = useState<'form' | 'myClaims'>('form');
  const [userClaims, setUserClaims] = useState<ClaimItem[]>([]);
  const [claimCityInput, setClaimCityInput] = useState('');
  const [claimCityDropdownOpen, setClaimCityDropdownOpen] = useState(false);
  const [claimCategoryInput, setClaimCategoryInput] = useState('');
  const [claimCategoryDropdownOpen, setClaimCategoryDropdownOpen] = useState(false);
  const [claimListingQuery, setClaimListingQuery] = useState('');
  const [claimListingDropdownOpen, setClaimListingDropdownOpen] = useState(false);
  const [claimSelectedListing, setClaimSelectedListing] = useState<Listing | null>(null);
  const [claimApplicantName, setClaimApplicantName] = useState('');
  const [claimApplicantPhone, setClaimApplicantPhone] = useState('');
  const [claimApplicantEmail, setClaimApplicantEmail] = useState('');
  const [claimRemarks, setClaimRemarks] = useState('');
  const [claimFiles, setClaimFiles] = useState<ClaimDocument[]>([]);
  const [claimUploading, setClaimUploading] = useState(false);
  const [claimSubmitting, setClaimSubmitting] = useState(false);
  const claimFileInputRef = useRef<HTMLInputElement>(null);

  // Gold Trust Badge Settings & Application States
  const [trustBadgeSettings, setTrustBadgeSettings] = useState<TrustBadgeSettings>({
    originalPrice: 999,
    offerPrice: 299,
    period: 'Year',
    upiId: 'localbazar@upi',
    upiName: 'LocalBazar Official',
    qrImageUrl: '',
    instructions: 'Scan QR code with any UPI app (Google Pay, PhonePe, Paytm, BHIM), pay ₹299, and enter the 12-digit UTR/Reference number below.'
  });
  const [trustViewMode, setTrustViewMode] = useState<'hero' | 'listings' | 'form'>('hero');
  const [trustTab, setTrustTab] = useState<'apply' | 'myRequests'>('apply');
  const [trustStep, setTrustStep] = useState<1 | 2 | 3>(1);
  const [userTrustRequests, setUserTrustRequests] = useState<TrustRequest[]>([]);
  const [selectedTrustListing, setSelectedTrustListing] = useState<Listing | null>(null);
  const [trustApplicantName, setTrustApplicantName] = useState('');
  const [trustPhone, setTrustPhone] = useState('');
  const [trustDocType, setTrustDocType] = useState('Trade License');
  const [trustDocNumber, setTrustDocNumber] = useState('');
  const [trustDocProofUrl, setTrustDocProofUrl] = useState('');
  const [trustDocUploading, setTrustDocUploading] = useState(false);
  const [trustTxnId, setTrustTxnId] = useState('');
  const [trustPaymentProofUrl, setTrustPaymentProofUrl] = useState('');
  const [trustPaymentUploading, setTrustPaymentUploading] = useState(false);
  const [trustSubmitting, setTrustSubmitting] = useState(false);

  // Help & Support States (Compose & Inbox)
  const [helpTab, setHelpTab] = useState<'compose' | 'inbox'>('compose');
  const [helpSubject, setHelpSubject] = useState('');
  const [helpMessage, setHelpMessage] = useState('');
  const [helpAttachments, setHelpAttachments] = useState<MailAttachment[]>([]);
  const [helpAttUploading, setHelpAttUploading] = useState(false);
  const [helpSending, setHelpSending] = useState(false);
  const [allMails, setAllMails] = useState<MailItem[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketReplyText, setTicketReplyText] = useState('');
  const [ticketReplySending, setTicketReplySending] = useState(false);
  const [ticketReplyFiles, setTicketReplyFiles] = useState<MailAttachment[]>([]);
  const [ticketReplyUploading, setTicketReplyUploading] = useState(false);
  const helpFileInputRef = useRef<HTMLInputElement>(null);
  const ticketReplyFileRef = useRef<HTMLInputElement>(null);

  // PWA App Installation Auto-Detection State
  const [isAppInstalled, setIsAppInstalled] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkStatus = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://') ||
        (localStorage.getItem('lb_pwa_installed') === 'true' && window.matchMedia('(display-mode: standalone)').matches);
      setIsAppInstalled(isStandalone);
    };
    checkStatus();

    const handler = (e: any) => {
      setIsAppInstalled(!!e.detail?.isInstalled);
    };
    window.addEventListener('lb_pwa_status', handler);
    return () => window.removeEventListener('lb_pwa_status', handler);
  }, []);

  const handleInstallAppFromSettings = () => {
    if (typeof window !== 'undefined' && window.__triggerPwaInstall) {
      window.__triggerPwaInstall();
    }
  };

  const allListingsVerified = useMemo(() => {
    return myListings.length > 0 && myListings.every((l) => isTrustBadgeActive(l));
  }, [myListings]);

  const userMails = useMemo(() => {
    if (!currentUser) return [];
    const userEmail = (currentUser.email || '').toLowerCase().trim();
    const userId = currentUser.id || '';
    const userPhone = (currentUser.phone || '').trim();

    return allMails.filter((m) => {
      const sEmail = (m.senderEmail || '').toLowerCase().trim();
      const tEmail = (m.toEmail || '').toLowerCase().trim();
      const sId = m.senderId || '';
      const sPhone = (m.senderPhone || '').trim();

      const isSender = (userEmail && sEmail === userEmail) || (userId && sId === userId) || (userPhone && sPhone === userPhone);
      const isRecipient = userEmail && (tEmail === userEmail || tEmail === userId.toLowerCase());
      return isSender || isRecipient;
    }).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [allMails, currentUser]);

  const unreadMailsCount = useMemo(() => {
    return userMails.filter((m) => {
      if (m.toEmail?.toLowerCase() === currentUser?.email?.toLowerCase() && !m.read) return true;
      if (m.status === 'replied') return true;
      return false;
    }).length;
  }, [userMails, currentUser]);

  const handleSelectTheme = (targetTheme: 'light' | 'dark') => {
    setThemeMode(targetTheme);
    if (targetTheme === 'dark') {
      document.documentElement.classList.add('dark-theme');
      document.documentElement.setAttribute('data-theme', 'dark');
      document.body.classList.add('dark-theme');
      localStorage.setItem('lb_theme', 'dark');
      showToast('Dark Mode activated site-wide', 'info');
    } else {
      document.documentElement.classList.remove('dark-theme');
      document.documentElement.removeAttribute('data-theme');
      document.body.classList.remove('dark-theme');
      localStorage.setItem('lb_theme', 'light');
      showToast('Light Mode activated site-wide', 'info');
    }
  };

  const toggleTheme = () => {
    handleSelectTheme(themeMode === 'light' ? 'dark' : 'light');
  };

  const handleClearAppCache = () => {
    try {
      const keysToClear = ['lb_cities_cache', 'lb_banners_cache', 'lb_explore_cache', 'lb_temp_search'];
      keysToClear.forEach((k) => {
        try { localStorage.removeItem(k); } catch {}
      });
      showToast('App cache cleared successfully! Data refreshed.', 'success');
    } catch {
      showToast('Cache refreshed.', 'info');
    }
  };

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMsg({ show: true, text, type });
    setTimeout(() => {
      setToastMsg((prev) => ({ ...prev, show: false }));
    }, 3200);
  };

  const showAlert = (
    title: string,
    message: string,
    type: 'success' | 'warning' | 'error' = 'warning',
    buttonText = 'Understood',
    onConfirm?: () => void
  ) => {
    setAlertData({ show: true, title, message, type, buttonText, onConfirm });
  };

  useEffect(() => {
    if (alertData.show) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [alertData.show]);

  // Screen URL Hashes
  const SCREEN_HASHES: Record<AccountScreen, string> = {
    viewMainMenu: '',
    viewAccount: 'account-details',
    viewAddListing: 'add-listing',
    viewManageListings: 'manage-business',
    viewSavedPlaces: 'saved-places',
    viewHelp: 'help',
    viewSettings: 'settings',
    viewClaimListing: 'claim-listing',
    viewTrustBadge: 'trust-badge',
  };

  // Navigate to screen with native app-like history stack
  const goToScreen = (nextScreen: AccountScreen) => {
    if (nextScreen === activeScreen) return;
    const hash = SCREEN_HASHES[nextScreen];
    const newUrl = hash ? `/account#${hash}` : '/account';

    const currentIdx = typeof window !== 'undefined' && window.history.state?.idx !== undefined
      ? Number(window.history.state.idx)
      : 0;
    const nextIdx = currentIdx + 1;

    if (nextScreen === 'viewMainMenu') {
      window.history.pushState({ screen: 'viewMainMenu', idx: nextIdx }, '', '/account');
    } else {
      window.history.pushState({ screen: nextScreen, idx: nextIdx }, '', newUrl);
    }
    setActiveScreen(nextScreen);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  // Close Business Portal and sync browser history
  const closeBusinessPortal = () => {
    setActivePortalListing(null);
    activePortalListingRef.current = null;
    setPortalDrawerOpen(false);

    if (typeof window !== 'undefined' && window.history.state?.isPortal) {
      window.history.back();
    } else {
      goToScreen('viewManageListings');
    }
  };

  // App Back button handler (for both on-screen < button and phone hardware back)
  const handleAppBack = (fallback: AccountScreen | 'home' = 'viewMainMenu') => {
    // 0. If Business Portal is open, close it first!
    if (activePortalListingRef.current) {
      closeBusinessPortal();
      return;
    }

    // 1. If any modal is open, close it first
    if (showHolidayCalModal) {
      setShowHolidayCalModal(false);
      return;
    }
    if (showHolidayListSheet) {
      setShowHolidayListSheet(false);
      return;
    }
    if (alertData.show) {
      setAlertData((prev) => ({ ...prev, show: false }));
      return;
    }
    if (previewProduct) {
      setPreviewProduct(null);
      return;
    }
    if (showSelectTopModal) {
      setShowSelectTopModal(false);
      return;
    }
    if (showAddProductModal) {
      setShowAddProductModal(false);
      return;
    }

    // 2. If at main menu, return to Home page
    if (activeScreen === 'viewMainMenu') {
      router.push('/');
      return;
    }

    // 3. If in browser history with internal depth, call back()
    const currentIdx = typeof window !== 'undefined' ? window.history.state?.idx : 0;
    if (typeof window !== 'undefined' && currentIdx && currentIdx > 0) {
      window.history.back();
    } else {
      if (fallback === 'home') {
        router.push('/');
      } else {
        goToScreen(fallback);
      }
    }
  };

  // Native App-like Back button & PopState listener
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if arrived with a hash
    const initialHash = window.location.hash.replace('#', '');
    let initialScreen: AccountScreen = 'viewMainMenu';
    (Object.keys(SCREEN_HASHES) as AccountScreen[]).forEach((s) => {
      if (SCREEN_HASHES[s] && SCREEN_HASHES[s] === initialHash) {
        initialScreen = s;
      }
    });

    if (initialHash.startsWith('portal-')) {
      initialScreen = 'viewManageListings';
      const portalId = initialHash.replace('portal-', '');
      setTimeout(() => {
        try {
          const uRaw = localStorage.getItem('lb_current_user');
          const curUser = uRaw ? JSON.parse(uRaw) : null;
          cloudSync.getListingById(portalId).then((found) => {
            if (found && curUser) {
              const isOwner = (
                found.ownerId === curUser.id ||
                (curUser.uid && found.ownerId === curUser.uid) ||
                (curUser.email && found.ownerEmail?.toLowerCase() === curUser.email.toLowerCase()) ||
                found.createdBy === curUser.id ||
                (curUser.uid && found.createdBy === curUser.uid) ||
                (curUser.email && found.createdBy?.toLowerCase() === curUser.email.toLowerCase())
              );
              if (isOwner) {
                setActivePortalListing(found);
                activePortalListingRef.current = found;
              }
            }
          }).catch(() => {});
        } catch {}
      }, 100);
    }

    if (initialScreen !== 'viewMainMenu') {
      setActiveScreen(initialScreen);
      window.history.replaceState({ screen: initialScreen, idx: 0 }, '', window.location.href);
    } else {
      window.history.replaceState({ screen: 'viewMainMenu', idx: 0 }, '', '/account');
    }

    const onPopState = (e: PopStateEvent) => {
      // 0. If Business Portal is open, close it and stay on Manage Your Business!
      if (activePortalListingRef.current) {
        setActivePortalListing(null);
        activePortalListingRef.current = null;
        setPortalDrawerOpen(false);
        setActiveScreen('viewManageListings');
        return;
      }

      // 1. If any modal is open, dismiss it
      if (showHolidayCalModal) {
        setShowHolidayCalModal(false);
      }
      if (showHolidayListSheet) {
        setShowHolidayListSheet(false);
      }
      if (alertData.show) {
        setAlertData((prev) => ({ ...prev, show: false }));
      }
      if (previewProduct) {
        setPreviewProduct(null);
      }
      if (showSelectTopModal) {
        setShowSelectTopModal(false);
      }
      if (showAddProductModal) {
        setShowAddProductModal(false);
      }

      // 2. Step back to previous screen
      const targetScreen: AccountScreen = e.state?.screen || 'viewMainMenu';
      setActiveScreen(targetScreen);
      window.scrollTo({ top: 0, behavior: 'instant' });
    };

    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  useEffect(() => {
    // 1. Verify User
    let u: UserProfile | null = null;
    try {
      const rawUser = localStorage.getItem('lb_current_user');
      if (rawUser) u = JSON.parse(rawUser);
    } catch {}

    if (!u) {
      router.push('/auth');
      return;
    }

    // Standardize user ID to LBxxxxxx format
    const stdId = formatLBUserId(u.email || u.id);
    const rawUid = u.uid || (!String(u.id).startsWith('LB') ? String(u.id) : undefined);
    if (u.id !== stdId || (rawUid && !u.uid)) {
      u = {
        ...u,
        id: stdId,
        uid: rawUid,
      };
      localStorage.setItem('lb_current_user', JSON.stringify(u));
    }

    setAuthChecked(true);

    // Sync theme on initial account load
    try {
      const savedTheme = localStorage.getItem('lb_theme');
      if (savedTheme === 'dark') {
        setThemeMode('dark');
        document.documentElement.classList.add('dark-theme');
        document.documentElement.setAttribute('data-theme', 'dark');
        document.body.classList.add('dark-theme');
      } else {
        setThemeMode('light');
        document.documentElement.classList.remove('dark-theme');
        document.documentElement.removeAttribute('data-theme');
        document.body.classList.remove('dark-theme');
      }
    } catch {}

    // Check live auth.currentUser immediately if already initialized
    if (auth.currentUser?.photoURL && u.photoURL !== auth.currentUser.photoURL) {
      u.photoURL = auth.currentUser.photoURL;
      try { localStorage.setItem('lb_current_user', JSON.stringify(u)); } catch {}
    }

    setCurrentUser(u);
    setProfileName(u.name || '');
    setProfileGender(u.gender || '');
    setProfileDob(formatDobForInput(u.dob || u.dateOfBirth || '1995-01-05'));
    setProfileCity(u.city || '');
    setProfileState(u.state || '');
    setProfilePincode(u.pincode || u.pinCode || '');
    setProfileEmail(u.email || '');
    setProfilePhone(u.phone || '');
    setProfileMemberSince(u.joinedDate || '');

    // Listen to Firebase Auth state to sync live Google photoURL and recover authentic joinedDate
    const unsubAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        let needsUpdate = false;
        let updatedUser: UserProfile = { ...u };

        // 1. Sync live Google avatar
        if (fbUser.photoURL && updatedUser.photoURL !== fbUser.photoURL) {
          updatedUser.photoURL = fbUser.photoURL;
          needsUpdate = true;
          setAvatarLoadError(false);
        }

        // 2. Recover authentic original joined date
        try {
          let authenticDate = '';
          const snap = await getDoc(doc(db, 'users', stdId));
          if (snap.exists()) {
            const data = snap.data() as UserProfile;
            if (data.joinedDate) authenticDate = data.joinedDate;
          }
          if (fbUser.metadata?.creationTime) {
            const cDate = new Date(fbUser.metadata.creationTime);
            if (!isNaN(cDate.getTime())) {
              const permanentDate = cDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
              if (!authenticDate) {
                authenticDate = permanentDate;
              }
            }
          }
          if (authenticDate && (updatedUser.joinedDate !== authenticDate || profileMemberSince !== authenticDate)) {
            updatedUser.joinedDate = authenticDate;
            setProfileMemberSince(authenticDate);
            needsUpdate = true;
          }
        } catch {}

        if (needsUpdate) {
          setCurrentUser(updatedUser);
          try {
            localStorage.setItem('lb_current_user', JSON.stringify(updatedUser));
          } catch {}
          try {
            await cloudSync.saveUser(updatedUser);
          } catch {}
        }
      }
    });

    // Pre-fill Claim My Listing details
    if (u.name) setClaimApplicantName(u.name);
    if (u.phone) setClaimApplicantPhone(u.phone);
    if (u.email) setClaimApplicantEmail(u.email);

    // Pre-fill Trust Badge details
    if (u.name) setTrustApplicantName(u.name);
    if (u.phone) setTrustPhone(u.phone);

    // 2. Load Listings & Filter for current user + Robust Saved Places (Online Cloud First, Zero Demo Data)
    const applyListingsData = (items: Listing[]) => {
      setAllListings(items);

      const mine = items.filter(
        (l) =>
          l.ownerId === u?.id ||
          (u?.uid && l.ownerId === u.uid) ||
          (u?.email && l.ownerEmail?.toLowerCase() === u.email.toLowerCase()) ||
          l.createdBy === u?.id ||
          (u?.uid && l.createdBy === u.uid) ||
          (u?.email && l.createdBy?.toLowerCase() === u.email.toLowerCase())
      );
      setMyListings(mine);

      // Load saved places directly from Cloud Firestore
      if (u && (u.id || u.uid)) {
        cloudSync.pullUserSavedPlaces(u.id || u.uid).then((savedIds) => {
          if (Array.isArray(savedIds)) {
            const setIds = new Set(savedIds.map((s) => String(s).trim().toLowerCase()));
            const matched = items.filter((l) => setIds.has(String(l.id).trim().toLowerCase()));
            setSavedPlaces(matched);
          }
        }).catch(() => {});
      }
    };

    // Load purely live from Cloud Firestore
    cloudSync.pullListings().then((cloudItems) => {
      if (cloudItems && Array.isArray(cloudItems)) {
        applyListingsData(cloudItems);
      } else {
        applyListingsData([]);
      }
    }).catch(() => {
      applyListingsData([]);
    });

    cloudSync.pullCategories().then((cats) => cats && setCategories(cats)).catch(() => {});
    cloudSync.pullCities().then((cts) => cts && setCities(cts)).catch(() => {});

    // Load Claims from Cloud Firestore
    cloudSync.pullClaims().then((allClaims) => {
      if (allClaims && allClaims.length > 0) {
        const mine = allClaims.filter(
          (c) =>
            c.claimantId === u?.id ||
            (u?.email && c.claimantEmail?.toLowerCase() === u.email.toLowerCase()) ||
            (u?.phone && c.claimantPhone === u.phone) ||
            (u?.email && c.applicantEmail?.toLowerCase() === u.email.toLowerCase()) ||
            (u?.phone && c.applicantPhone === u.phone)
        );
        setUserClaims(mine);
      }
    }).catch(() => {});

    // Load Trust Badge Settings from Cloud Firestore
    cloudSync.pullTrustBadgeSettings().then((s) => {
      if (s) {
        setTrustBadgeSettings(s);
      }
    }).catch(() => {});

    // Load User Trust Requests from Cloud Firestore
    cloudSync.pullTrustRequests().then((allReqs) => {
      if (allReqs && allReqs.length > 0) {
        const mine = allReqs.filter(
          (t) =>
            t.applicantId === u?.id ||
            (u?.phone && t.phone === u.phone) ||
            (u?.email && t.email?.toLowerCase() === u.email.toLowerCase())
        );
        setUserTrustRequests(mine);
      }
    }).catch(() => {});

    // Load Empty Store Banners from Cloud Firestore
    cloudSync.pullEmptyStoreBanners().then((slots) => {
      if (slots && slots.length > 0) {
        setEmptyStoreBanners(slots);
      }
    }).catch(() => {});

    // Load Help & Support Mails from Cloud Firestore
    cloudSync.pullMail().then((mails) => {
      if (mails && Array.isArray(mails)) {
        setAllMails(mails);
      }
    }).catch(() => {});

    return () => {
      unsubAuth();
    };
  }, [router]);

  // Reset form
  const resetForm = () => {
    setEditingId(null);
    setListingStep(1);
    setFormName('');
    setFormCategory('');
    setFormCity('');
    setFormPhone(currentUser?.phone || '');
    setFormAddress('');
    setFormMapLink('');
    setFormDesc('');
    setFormPhotos([]);
    setFormSchedule(DEFAULT_SCHEDULE);
    setFormHolidays([]);
    setFormProducts([]);
    setFormDoctors([]);
  };



  // Open Edit Mode
  const openEditMode = (listing: Listing) => {
    setEditingId(listing.id);
    setFormName(listing.name);
    setFormCategory(listing.category);
    setFormCity(listing.city);
    setFormPhone(listing.phone || '');
    setFormAddress(listing.address || '');
    setFormMapLink(listing.mapLink || '');
    setFormDesc(listing.desc || '');
    setFormPhotos(listing.gallery || (listing.image ? [listing.image] : []));
    setFormSchedule(listing.dailySchedule || DEFAULT_SCHEDULE);
    setFormHolidays(listing.holidays || []);
    setFormProducts(listing.products || []);
    setFormDoctors(listing.doctors || []);
    setListingStep(1);
    goToScreen('viewAddListing');
  };

  // Photo Upload Handler with micro-compressor
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    for (const f of files) {
      const url = await uploadImageToCloud(f);
      if (url) {
        setFormPhotos((prev) => [...prev, url]);
      }
    }
  };

  // Handle Form Submission
  const handleSubmitListing = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formName.trim() || !formCategory.trim() || !formCity.trim() || !formPhone.trim()) {
      showAlert(
        'Missing Required Information',
        'Please complete all required fields in <strong>Step 1: Basic & Photos</strong> (Business Name, Category, City, and Phone).',
        'warning',
        'Fill Step 1 Now',
        () => goToListingStep(1)
      );
      return;
    }

    if (!formAddress.trim()) {
      showAlert(
        'Address is Required',
        'Please enter your physical shop or office address in <strong>Step 2: Address & Location</strong>.',
        'warning',
        'Add Address Now',
        () => goToListingStep(2)
      );
      return;
    }

    const openDays = DAYS_OF_WEEK.filter((d) => formSchedule[d]?.isOpen);
    if (openDays.length === 0) {
      showAlert(
        'Opening Schedule Required',
        'Please mark at least one day of the week as <strong>Open</strong> in Step 3.',
        'warning',
        'Configure Hours',
        () => goToListingStep(3)
      );
      return;
    }

    const firstOpenDay = openDays[0];
    const defaultDay = formSchedule[firstOpenDay];
    const primaryTiming = `${defaultDay.openTime} ${defaultDay.openAmPm} - ${defaultDay.closeTime} ${defaultDay.closeAmPm}`;

    try {
      const allList: Listing[] = [...allListings];

      let updatedListing: Listing;

      if (editingId) {
        const idx = allList.findIndex((l) => String(l.id) === String(editingId));
        const existing: Partial<Listing> = allList[idx] || {};

        const isOwner = currentUser && (
          existing.ownerId === currentUser.id ||
          (currentUser.uid && existing.ownerId === currentUser.uid) ||
          (currentUser.email && existing.ownerEmail?.toLowerCase() === currentUser.email.toLowerCase()) ||
          existing.createdBy === currentUser.id ||
          (currentUser.uid && existing.createdBy === currentUser.uid) ||
          (currentUser.email && existing.createdBy?.toLowerCase() === currentUser.email.toLowerCase())
        );
        if (!isOwner) {
          showAlert('Unauthorized', 'You do not have permission to modify this business.', 'error');
          return;
        }

        updatedListing = {
          ...existing,
          id: editingId,
          name: formName.trim(),
          category: formCategory.trim(),
          city: formCity.trim(),
          phone: formPhone.trim(),
          address: formAddress.trim(),
          mapLink: formMapLink.trim(),
          desc: formDesc.trim(),
          image: formPhotos[0] || existing.image || '',
          gallery: formPhotos,
          images: formPhotos,
          openDays,
          scheduleTimings: primaryTiming,
          dailySchedule: formSchedule,
          holidays: formHolidays,
          products: formProducts.length ? formProducts : existing.products || [],
          doctors: formDoctors.length ? formDoctors : existing.doctors || [],
          ownerId: currentUser?.id || existing.ownerId,
          ownerEmail: currentUser?.email || existing.ownerEmail,
          ownerName: currentUser?.name || existing.ownerName,
          lastUpdated: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        };

        if (idx !== -1) {
          allList[idx] = updatedListing;
        } else {
          allList.unshift(updatedListing);
        }
      } else {
        const randId = `LB-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        updatedListing = {
          id: randId,
          name: formName.trim(),
          category: formCategory.trim(),
          city: formCity.trim(),
          phone: formPhone.trim(),
          address: formAddress.trim(),
          mapLink: formMapLink.trim(),
          desc: formDesc.trim(),
          status: 'Draft',
          isPublic: false,
          image: formPhotos[0] || '',
          gallery: formPhotos,
          images: formPhotos,
          openDays,
          scheduleTimings: primaryTiming,
          dailySchedule: formSchedule,
          holidays: formHolidays,
          products: formProducts,
          doctors: formDoctors,
          ownerId: currentUser?.id,
          ownerEmail: currentUser?.email,
          ownerName: currentUser?.name,
          createdBy: currentUser?.email || currentUser?.id,
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        };
        allList.unshift(updatedListing);
      }

      setAllListings(allList);
      await cloudSync.saveListing(updatedListing);

      // Auto add city to cloud
      await cloudSync.saveCity({ name: formCity.trim(), state: 'Active Hub' });

      // Update local state
      const mine = allList.filter(
        (l) =>
          l.ownerId === currentUser?.id ||
          (currentUser?.uid && l.ownerId === currentUser.uid) ||
          (currentUser?.email && l.ownerEmail?.toLowerCase() === currentUser.email.toLowerCase()) ||
          l.createdBy === currentUser?.id ||
          (currentUser?.uid && l.createdBy === currentUser.uid) ||
          (currentUser?.email && l.createdBy?.toLowerCase() === currentUser.email.toLowerCase())
      );
      setMyListings(mine);

      const isEditing = !!editingId;
      const savedListingName = updatedListing.name;
      resetForm();

      showAlert(
        isEditing ? 'Listing Updated Successfully! 🎉' : 'Registration Successful! 🎉',
        `<div style="margin-bottom: 0.65rem;"><span style="display: inline-flex; align-items: center; gap: 6px; background: #f0fdf4; color: #16a34a; font-weight: 700; padding: 4px 12px; border-radius: 8px; border: 1px solid #bbf7d0; font-size: 0.92rem;"><i class="fa-solid fa-store"></i>${savedListingName}</span></div>Your business has been successfully registered on Local Bazar! You can now manage your catalog, view leads, and update business details.`,
        'success',
        'Go to Manage Business',
        () => goToScreen('viewManageListings')
      );
    } catch (err) {
      console.error('Error saving listing:', err);
    }
  };

  // Publish Listing (Draft -> Approved / Public)
  const handlePublishListing = async (listing: Listing) => {
    // Strict Ownership Verification Guard
    const isOwner = currentUser && (
      listing.ownerId === currentUser.id ||
      (currentUser.uid && listing.ownerId === currentUser.uid) ||
      (currentUser.email && listing.ownerEmail?.toLowerCase() === currentUser.email.toLowerCase()) ||
      listing.createdBy === currentUser.id ||
      (currentUser.uid && listing.createdBy === currentUser.uid) ||
      (currentUser.email && listing.createdBy?.toLowerCase() === currentUser.email.toLowerCase())
    );
    if (!isOwner) {
      showAlert('Unauthorized', 'You do not have permission to publish this listing.', 'error');
      return;
    }

    try {
      const allList: Listing[] = [...allListings];
      const idx = allList.findIndex((l) => l.id === listing.id);

      const publishedListing: Listing = {
        ...listing,
        status: 'Approved',
        isPublic: true,
        lastUpdated: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      };

      if (idx !== -1) {
        allList[idx] = publishedListing;
      } else {
        allList.unshift(publishedListing);
      }

      setAllListings(allList);
      await cloudSync.saveListing(publishedListing);

      const mine = allList.filter(
        (l) =>
          l.ownerId === currentUser?.id ||
          (currentUser?.uid && l.ownerId === currentUser.uid) ||
          (currentUser?.email && l.ownerEmail?.toLowerCase() === currentUser.email.toLowerCase()) ||
          l.createdBy === currentUser?.id ||
          (currentUser?.uid && l.createdBy === currentUser.uid) ||
          (currentUser?.email && l.createdBy?.toLowerCase() === currentUser.email.toLowerCase())
      );
      setMyListings(mine);

      showAlert(
        'Store is Live & Public! 🎉',
        `<strong>"${listing.name}"</strong> has been published successfully! Your business is now live on Local Bazar, visible to all customers and reachable in searches.`,
        'success'
      );
    } catch (err) {
      console.error('Error publishing listing:', err);
      showAlert('Publish Failed', 'Could not publish listing right now. Please try again.', 'error');
    }
  };

  // Delete listing
  const handleDeleteListing = async (listingId: string) => {
    if (!confirm('Are you sure you want to permanently delete this listing?')) return;
    try {
      const allList: Listing[] = [...allListings];
      const targetListing = allList.find((l) => l.id === listingId);
      if (targetListing) {
        const isOwner = currentUser && (
          targetListing.ownerId === currentUser.id ||
          (currentUser.uid && targetListing.ownerId === currentUser.uid) ||
          (currentUser.email && targetListing.ownerEmail?.toLowerCase() === currentUser.email.toLowerCase()) ||
          targetListing.createdBy === currentUser.id ||
          (currentUser.uid && targetListing.createdBy === currentUser.uid) ||
          (currentUser.email && targetListing.createdBy?.toLowerCase() === currentUser.email.toLowerCase())
        );
        if (!isOwner) {
          showAlert('Unauthorized', 'You do not have permission to delete this listing.', 'error');
          return;
        }
      }
      setAllListings((prev) => prev.filter((l) => l.id !== listingId));
      setMyListings((prev) => prev.filter((l) => l.id !== listingId));
      await cloudSync.deleteListing(listingId);
    } catch (err) {
      console.error('Error deleting listing:', err);
    }
  };

  // Product Add / Edit in Merchant Portal (Matching media_1793702691549_ce9bc242.jpg)
  const handleOpenAddProduct = () => {
    setEditingProductIdx(null);
    setProdName('');
    setProdCategory('');
    setProdPrice('');
    setProdStockStatus('in_stock');
    setProdDescription('');
    setProdIsTop(false);
    setProdImages([]);
    setShowAddProductModal(true);
  };

  const handleOpenEditProduct = (idx: number, item: ProductItem) => {
    setEditingProductIdx(idx);
    setProdName(item.name || '');
    setProdCategory(item.storeCategory || item.category || '');
    setProdPrice(item.price || '');
    setProdStockStatus(item.inStock === false || item.stockStatus === 'out_of_stock' ? 'out_of_stock' : 'in_stock');
    setProdDescription(item.details || item.desc || item.description || '');
    setProdIsTop(!!(item.isTop || item.isTopProduct));
    const imgs = Array.isArray(item.images) && item.images.length > 0 ? item.images : (item.image ? [item.image] : []);
    setProdImages(imgs);
    setShowAddProductModal(true);
  };

  const handleToggleProductTop = async (productIdx: number) => {
    if (!activePortalListing || !activePortalListing.products) return;
    const updatedProds = activePortalListing.products.map((p, i) => {
      if (i === productIdx) {
        const nextTop = !(p.isTop || p.isTopProduct);
        return { ...p, isTop: nextTop, isTopProduct: nextTop };
      }
      return p;
    });
    await handleSavePortalFields({ products: updatedProds });
  };

  const handleRemoveTopProduct = async (prodIdOrName: string) => {
    if (!activePortalListing || !activePortalListing.products) return;
    const updatedProds = activePortalListing.products.map((p) => {
      const isMatch = (p.id && p.id === prodIdOrName) || p.name === prodIdOrName;
      if (isMatch) {
        return { ...p, isTop: false, isTopProduct: false };
      }
      return p;
    });
    await handleSavePortalFields({ products: updatedProds });
  };

  const handleProductUploadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setProdUploading(true);
    const uploadedUrls: string[] = [];
    for (let i = 0; i < files.length && (prodImages.length + uploadedUrls.length) < 3; i++) {
      try {
        const url = await uploadImageToCloud(files[i]);
        if (url) uploadedUrls.push(url);
      } catch (err) {
        console.error('Failed to upload product image:', err);
      }
    }
    setProdImages((prev) => [...prev, ...uploadedUrls].slice(0, 3));
    setProdUploading(false);
  };

  const handleSaveProductForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePortalListing || !prodName.trim()) {
      showAlert('Name Required', 'Please enter a product or service name.', 'warning');
      return;
    }

    const targetCat = (prodCategory.trim() || 'General').toLowerCase();
    const hasTrust = isTrustBadgeActive(activePortalListing);
    if (!hasTrust && editingProductIdx === null) {
      const existingInCat = (activePortalListing.products || []).filter(
        (p) => ((p.storeCategory || p.category || 'General').trim().toLowerCase()) === targetCat
      );
      if (existingInCat.length >= 5) {
        showAlert(
          'Category Product Limit',
          `Free listings can have up to 5 products per in-store category slide. The "${prodCategory.trim() || 'General'}" category already has 5 products. Please upgrade to Trust Badge to unlock unlimited products!`,
          'warning'
        );
        return;
      }
    }

    const isInStock = prodStockStatus === 'in_stock';
    const finalProd: ProductItem = {
      id: editingProductIdx !== null && activePortalListing.products?.[editingProductIdx]?.id
        ? activePortalListing.products[editingProductIdx].id
        : `p_${Date.now()}`,
      name: prodName.trim(),
      price: prodPrice.trim() || 'On Request',
      storeCategory: prodCategory.trim() || undefined,
      category: prodCategory.trim() || undefined,
      inStock: isInStock,
      stockStatus: prodStockStatus,
      details: prodDescription.trim() || undefined,
      desc: prodDescription.trim() || undefined,
      description: prodDescription.trim() || undefined,
      isTop: prodIsTop,
      isTopProduct: prodIsTop,
      image: prodImages[0] || (editingProductIdx !== null ? activePortalListing.products?.[editingProductIdx]?.image : '') || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&auto=format&fit=crop&q=80',
      images: prodImages.length > 0 ? prodImages : (editingProductIdx !== null && activePortalListing.products?.[editingProductIdx]?.images ? activePortalListing.products[editingProductIdx].images : [])
    };

    let updatedProducts = [...(activePortalListing.products || [])];
    if (editingProductIdx !== null && editingProductIdx >= 0 && editingProductIdx < updatedProducts.length) {
      updatedProducts[editingProductIdx] = finalProd;
    } else {
      updatedProducts.push(finalProd);
    }

    await handleSavePortalFields({ products: updatedProducts });
    setShowAddProductModal(false);
    showAlert(
      editingProductIdx !== null ? 'Product Updated' : 'Product Added',
      `"${finalProd.name}" has been ${editingProductIdx !== null ? 'updated' : 'added'} to your catalog.`,
      'success'
    );
  };

  const handleLogout = () => {
    localStorage.removeItem('lb_current_user');
    router.push('/');
  };

  const handleRemoveBookmark = (e: React.MouseEvent, id: string, name: string) => {
    e.preventDefault();
    e.stopPropagation();
    const updated = savedPlaces.filter((s) => String(s.id).toLowerCase() !== String(id).toLowerCase());
    setSavedPlaces(updated);
    const idList = updated.map((x) => String(x.id));
    if (currentUser && (currentUser.id || currentUser.uid)) {
      cloudSync.saveUserSavedPlaces(currentUser.id || currentUser.uid, idList).catch(() => {});
    }
    showToast(`Removed "${name}" from Saved Places`, 'info');
  };

  const handleSaveProfile = async () => {
    if (!profileName.trim()) {
      showToast('Please enter your full name.', 'error');
      return;
    }

    setIsSavingProfile(true);

    const safeEmail = currentUser?.email || profileEmail.trim();

    const updatedUser: UserProfile = {
      ...(currentUser || { id: 'usr_' + Date.now() }),
      name: profileName.trim(),
      gender: profileGender,
      dob: profileDob,
      dateOfBirth: profileDob,
      city: profileCity.trim(),
      state: profileState.trim(),
      pincode: profilePincode.trim(),
      pinCode: profilePincode.trim(),
      email: safeEmail,
      phone: profilePhone.trim(),
      joinedDate: profileMemberSince || currentUser?.joinedDate || (auth.currentUser?.metadata?.creationTime ? new Date(auth.currentUser.metadata.creationTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }))
    };

    setCurrentUser(updatedUser);
    localStorage.setItem('lb_current_user', JSON.stringify(updatedUser));
    try {
      await cloudSync.saveUser(updatedUser);
    } catch (err) {
      console.error('Failed to sync profile to cloud:', err);
    }

    setIsSavingProfile(false);
    setSaveSuccess(true);
    showToast('Profile updated successfully!', 'success');
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  // Schedule Presets & Holiday Helpers
  const applyPresetMonSat = () => {
    const newSched: Record<string, DailyScheduleDay> = {};
    DAYS_OF_WEEK.forEach((d) => {
      if (d === 'Sunday') {
        newSched[d] = { isOpen: false, openTime: '09:00', openAmPm: 'AM', closeTime: '08:30', closeAmPm: 'PM' };
      } else {
        newSched[d] = { isOpen: true, openTime: '09:00', openAmPm: 'AM', closeTime: '08:30', closeAmPm: 'PM' };
      }
    });
    setFormSchedule(newSched);
  };

  const applyPresetOpenAllDays = () => {
    const newSched: Record<string, DailyScheduleDay> = {};
    DAYS_OF_WEEK.forEach((d) => {
      newSched[d] = { isOpen: true, openTime: '09:00', openAmPm: 'AM', closeTime: '09:00', closeAmPm: 'PM' };
    });
    setFormSchedule(newSched);
  };

  const applyPresetCloseSunday = () => {
    setFormSchedule((prev) => ({
      ...prev,
      Sunday: { ...(prev['Sunday'] || { openTime: '09:00', openAmPm: 'AM', closeTime: '08:30', closeAmPm: 'PM' }), isOpen: false },
    }));
  };

  const handlePrevCalMonth = () => {
    setCalDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextCalMonth = () => {
    setCalDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleTodayCalMonth = () => {
    setCalDate(new Date());
  };

  const toggleHolidayDate = (dateStr: string) => {
    setFormHolidays((prev) =>
      prev.includes(dateStr) ? prev.filter((d) => d !== dateStr) : [...prev, dateStr]
    );
  };

  // Business Portal Opening & Management (Matching media_1793697023434_8b2f0362.jpg)
  const openBusinessPortal = (
    listing: Listing,
    defaultTab: 'gallery' | 'identity' | 'actions' | 'catalog' | 'banners' | 'schedule' = 'gallery'
  ) => {
    setActivePortalListing(listing);
    activePortalListingRef.current = listing;
    setPortalTab(defaultTab);
    setPortalDrawerOpen(false);
    setPortalName(listing.name || '');
    setPortalCategory(listing.category || '');
    setShowPortalCatSuggestions(false);
    setPortalCity(listing.city || '');
    setShowPortalCitySuggestions(false);
    setPortalAddress(listing.address || '');
    setPortalMapLink(listing.mapLink || '');
    setPortalDesc(listing.desc || '');
    setPortalPhone(listing.phone || '');
    setPortalWhatsapp((listing as any).whatsapp || listing.phone || '');
    setPortalSchedule(listing.dailySchedule || DEFAULT_SCHEDULE);
    setPortalHolidays(listing.holidays || []);
    const bList: string[] = Array.isArray((listing as any).banners)
      ? (listing as any).banners.filter(Boolean)
      : [];
    setPortalBanners(bList);

    const currentIdx = typeof window !== 'undefined' && window.history.state?.idx !== undefined
      ? Number(window.history.state.idx)
      : 1;
    const nextIdx = currentIdx + 1;

    window.history.pushState(
      { screen: 'viewManageListings', isPortal: true, portalListingId: listing.id, idx: nextIdx },
      '',
      `/account#portal-${listing.id}`
    );
  };

  const handleSavePortalFields = async (fieldsToUpdate: Partial<Listing>, silent = false) => {
    const currentListing = activePortalListingRef.current || activePortalListing;
    if (!currentListing) return;

    // Strict Ownership Verification Guard
    const isOwner = currentUser && (
      currentListing.ownerId === currentUser.id ||
      (currentUser.uid && currentListing.ownerId === currentUser.uid) ||
      (currentUser.email && currentListing.ownerEmail?.toLowerCase() === currentUser.email.toLowerCase()) ||
      currentListing.createdBy === currentUser.id ||
      (currentUser.uid && currentListing.createdBy === currentUser.uid) ||
      (currentUser.email && currentListing.createdBy?.toLowerCase() === currentUser.email.toLowerCase())
    );
    if (!isOwner) {
      showAlert('Unauthorized', 'You do not have permission to modify this business.', 'error');
      return;
    }

    const updated: Listing = {
      ...currentListing,
      ...fieldsToUpdate,
      lastUpdated: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    };

    try {
      setAllListings((prev) =>
        prev.map((l) => (String(l.id).trim().toLowerCase() === String(updated.id).trim().toLowerCase() ? updated : l))
      );
      await cloudSync.saveListing(updated);

      activePortalListingRef.current = updated;
      setActivePortalListing(updated);
      setMyListings((prev) => prev.map((l) => (String(l.id).trim().toLowerCase() === String(updated.id).trim().toLowerCase() ? updated : l)));
      if (!silent) {
        showAlert('Changes Saved', 'Your business details have been updated successfully.', 'success');
      }
    } catch (err) {
      console.error('Error saving portal changes:', err);
      showAlert('Save Failed', 'Could not save changes. Please try again.', 'error');
    }
  };

  const handlePortalPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !activePortalListing) return;
    const currentGallery = (activePortalListing.gallery && activePortalListing.gallery.length > 0)
      ? [...activePortalListing.gallery]
      : (activePortalListing.image ? [activePortalListing.image] : []);

    if (currentGallery.length >= 2) {
      showAlert('Photo Limit Reached', 'You can upload a maximum of 2 listing photos. Please delete an existing photo to upload a new one.', 'warning');
      return;
    }

    const availableSlots = 2 - currentGallery.length;
    const files = Array.from(e.target.files).slice(0, availableSlots);
    const uploadedUrls: string[] = [];
    for (const f of files) {
      const url = await uploadImageToCloud(f);
      if (url) uploadedUrls.push(url);
    }
    if (uploadedUrls.length > 0) {
      const newGallery = [...currentGallery, ...uploadedUrls].slice(0, 2);
      const newPrimary = activePortalListing.image && newGallery.includes(activePortalListing.image)
        ? activePortalListing.image
        : newGallery[0];
      await handleSavePortalFields({
        gallery: newGallery,
        images: newGallery,
        image: newPrimary,
      });
      showToast('Store photo uploaded successfully', 'success');
    }
  };

  const handleSetPrimaryPhoto = async (photoUrl: string) => {
    if (!activePortalListing) return;
    await handleSavePortalFields({ image: photoUrl });
    showToast('Cover photo set as primary', 'success');
  };

  const handleDeletePortalPhoto = async (photoUrl: string) => {
    if (!activePortalListing) return;
    const currentGallery = (activePortalListing.gallery && activePortalListing.gallery.length > 0)
      ? [...activePortalListing.gallery]
      : (activePortalListing.image ? [activePortalListing.image] : []);
    const newGallery = currentGallery.filter((u) => u !== photoUrl);
    const newPrimary = activePortalListing.image === photoUrl ? (newGallery[0] || '') : activePortalListing.image;
    await handleSavePortalFields({ gallery: newGallery, images: newGallery, image: newPrimary });
    showToast('Photo removed', 'info');
  };

  const handleToggleProductStock = async (productIdx: number) => {
    if (!activePortalListing || !activePortalListing.products) return;
    const updatedProds = activePortalListing.products.map((p, i) =>
      i === productIdx ? { ...p, inStock: !(p.inStock !== false) } : p
    );
    await handleSavePortalFields({ products: updatedProds });
  };

  const handleDeletePortalProduct = async (productIdx: number) => {
    if (!activePortalListing || !activePortalListing.products) return;
    const updatedProds = activePortalListing.products.filter((_, i) => i !== productIdx);
    await handleSavePortalFields({ products: updatedProds });
  };

  // 16:9 Promotional Banners (Max 3, Trust Badge Exclusive)
  const handlePortalBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const listing = activePortalListingRef.current || activePortalListing;
    if (!e.target.files || !listing) return;

    if (!isTrustBadgeActive(listing)) {
      showAlert(
        'Trust Badge Required',
        'Custom 16:9 promotional slide banners are exclusive to Trust Badge verified merchants. Free listings display default platform banners from admin. Please upgrade to Trust Badge to unlock custom banners!',
        'warning'
      );
      e.target.value = '';
      return;
    }
    const currentBanners = (portalBanners && portalBanners.length > 0)
      ? [...portalBanners]
      : (Array.isArray(listing.banners) ? [...listing.banners] : []);
    if (currentBanners.length >= 3) {
      showAlert('Banner Limit Reached', 'You can upload a maximum of 3 promotional 16:9 banners. Please remove one before adding another.', 'warning');
      e.target.value = '';
      return;
    }
    const remainingSlots = 3 - currentBanners.length;
    const files = Array.from(e.target.files).slice(0, remainingSlots);
    const uploadedUrls: string[] = [];
    for (const f of files) {
      const url = await uploadImageToCloud(f);
      if (url && typeof url === 'string' && url.trim()) {
        uploadedUrls.push(url.trim());
      }
    }
    if (uploadedUrls.length > 0) {
      const updated = [...currentBanners, ...uploadedUrls].slice(0, 3);
      setPortalBanners(updated);
      await handleSavePortalFields({ banners: updated }, true);
      showToast('16:9 Banner uploaded successfully', 'success');
    }
    e.target.value = '';
  };

  const handleDeletePortalBanner = async (bannerUrl: string) => {
    const listing = activePortalListingRef.current || activePortalListing;
    if (!listing) return;
    const currentBanners = (portalBanners && portalBanners.length > 0)
      ? [...portalBanners]
      : (Array.isArray(listing.banners) ? [...listing.banners] : []);
    const updated = currentBanners.filter((b) => b !== bannerUrl);
    setPortalBanners(updated);
    await handleSavePortalFields({ banners: updated }, true);
    showToast('Banner removed', 'info');
  };

  // Calendar Helpers for Holiday Modal
  const getDaysInMonth = (year: number, month: number) => {
    const days: Array<{ dateStr: string; dayNum: number; isCurrentMonth: boolean }> = [];
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    // Previous month padding
    const prevMonthTotalDays = new Date(year, month, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = prevMonthTotalDays - i;
      const mStr = String(month === 0 ? 12 : month).padStart(2, '0');
      const yStr = month === 0 ? year - 1 : year;
      days.push({
        dateStr: `${yStr}-${mStr}-${String(d).padStart(2, '0')}`,
        dayNum: d,
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let d = 1; d <= totalDays; d++) {
      const mStr = String(month + 1).padStart(2, '0');
      days.push({
        dateStr: `${year}-${mStr}-${String(d).padStart(2, '0')}`,
        dayNum: d,
        isCurrentMonth: true,
      });
    }

    // Next month padding to fill grid
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const mStr = String(month === 11 ? 1 : month + 2).padStart(2, '0');
      const yStr = month === 11 ? year + 1 : year;
      days.push({
        dateStr: `${yStr}-${mStr}-${String(d).padStart(2, '0')}`,
        dayNum: d,
        isCurrentMonth: false,
      });
    }

    return days;
  };

  const toggleTempHoliday = (dateStr: string) => {
    setTempSelectedHolidays((prev) =>
      prev.includes(dateStr) ? prev.filter((d) => d !== dateStr) : [...prev, dateStr]
    );
  };

  const confirmCalendarHolidays = () => {
    if (holidayTarget === 'form') {
      setFormHolidays(tempSelectedHolidays);
    } else {
      setPortalHolidays(tempSelectedHolidays);
    }
    setShowHolidayCalModal(false);
    showToast(`${tempSelectedHolidays.length} holiday dates saved`, 'success');
  };

  const removeHoliday = (dateStr: string) => {
    if (holidayTarget === 'form') {
      setFormHolidays((prev) => prev.filter((d) => d !== dateStr));
    } else {
      setPortalHolidays((prev) => prev.filter((d) => d !== dateStr));
    }
  };

  const handleSavePortalSchedule = async () => {
    const openDays = DAYS_OF_WEEK.filter((d) => portalSchedule[d]?.isOpen);
    const firstOpenDay = openDays[0] || 'Monday';
    const defaultDay = portalSchedule[firstOpenDay] || { openTime: '09:00', openAmPm: 'AM', closeTime: '08:30', closeAmPm: 'PM' };
    const primaryTiming = `${defaultDay.openTime} ${defaultDay.openAmPm} - ${defaultDay.closeTime} ${defaultDay.closeAmPm}`;

    await handleSavePortalFields({
      dailySchedule: portalSchedule,
      scheduleTimings: primaryTiming,
      openDays,
      holidays: portalHolidays,
    });
  };

  // Claim Auto-suggestions
  const claimFilteredCities = useMemo(() => {
    const q = claimCityInput.trim().toLowerCase();
    if (!q) return cities.slice(0, 15);
    return cities.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 15);
  }, [cities, claimCityInput]);

  const claimFilteredCategories = useMemo(() => {
    const q = claimCategoryInput.trim().toLowerCase();
    if (!q) return categories.slice(0, 15);
    return categories
      .filter(
        (cat) =>
          cat.name.toLowerCase().includes(q) ||
          (cat.alternativeName && cat.alternativeName.toLowerCase().includes(q))
      )
      .slice(0, 15);
  }, [categories, claimCategoryInput]);

  const claimFilteredListings = useMemo(() => {
    let pool = allListings;
    if (claimCityInput.trim()) {
      const cQ = claimCityInput.trim().toLowerCase();
      pool = pool.filter((l) => l.city && l.city.toLowerCase() === cQ);
    }
    if (claimCategoryInput.trim()) {
      const catQ = claimCategoryInput.trim().toLowerCase();
      pool = pool.filter((l) => l.category && l.category.toLowerCase() === catQ);
    }
    const q = claimListingQuery.trim().toLowerCase();
    if (!q) return pool.slice(0, 15);
    return pool
      .filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          (l.address && l.address.toLowerCase().includes(q)) ||
          (l.phone && l.phone.includes(q))
      )
      .slice(0, 15);
  }, [allListings, claimCityInput, claimCategoryInput, claimListingQuery]);

  const handleClaimFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (claimFiles.length >= 5) {
      showAlert('Limit Reached', 'You can upload a maximum of 5 verification documents.', 'warning');
      return;
    }

    const availableSlots = 5 - claimFiles.length;
    const filesToUpload = Array.from(files).slice(0, availableSlots);
    setClaimUploading(true);

    const uploadedList: ClaimDocument[] = [];

    for (const file of filesToUpload) {
      try {
        const ext = (file.name.split('.').pop() || '').toLowerCase();
        const isImage = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) || file.type.startsWith('image/');
        
        let fileUrl = '';
        let displaySize = '';

        if (isImage) {
          fileUrl = await uploadImageToCloud(file, 45, 1200);
          displaySize = (file.size / 1024 > 1024) 
            ? `${(file.size / (1024 * 1024)).toFixed(1)} MB (compressed)` 
            : `${(file.size / 1024).toFixed(0)} KB (optimized)`;
        } else {
          const base64Data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          fileUrl = base64Data;
          displaySize = (file.size / 1024 > 1024)
            ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
            : `${(file.size / 1024).toFixed(0)} KB`;
        }

        if (fileUrl) {
          uploadedList.push({
            name: file.name,
            type: ext || (isImage ? 'jpg' : 'doc'),
            size: displaySize,
            url: fileUrl,
          });
        }
      } catch (err) {
        console.error('Failed to process claim document:', err);
      }
    }

    setClaimFiles((prev) => [...prev, ...uploadedList].slice(0, 5));
    setClaimUploading(false);
    if (claimFileInputRef.current) claimFileInputRef.current.value = '';
  };

  const removeClaimFile = (index: number) => {
    setClaimFiles((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimSelectedListing) {
      showAlert('Select Listing', 'Please search and select the business listing you want to claim.', 'warning');
      return;
    }
    if (!claimApplicantName.trim()) {
      showAlert('Name Required', 'Please enter your legal name or applicant name.', 'warning');
      return;
    }
    if (!claimApplicantPhone.trim()) {
      showAlert('Phone Required', 'Please provide your mobile number for verification.', 'warning');
      return;
    }
    if (!claimRemarks.trim() || claimRemarks.trim().length < 5) {
      showAlert('Remarks Required', 'Please provide remarks or details explaining your ownership of this business.', 'warning');
      return;
    }
    if (claimFiles.length === 0) {
      showAlert('Proof Required', 'Please upload at least 1 proof document or photo (e.g. Trade License, Electricity Bill, Business Card, or Shop Photo).', 'warning');
      return;
    }

    setClaimSubmitting(true);
    try {
      const claimId = `CLM-${Date.now()}`;
      const newClaim: ClaimItem = {
        id: claimId,
        listingId: String(claimSelectedListing.id),
        listingName: claimSelectedListing.name,
        city: claimSelectedListing.city || claimCityInput || '',
        category: claimSelectedListing.category || claimCategoryInput || '',
        claimantId: currentUser?.id || '',
        claimantName: claimApplicantName.trim(),
        claimantPhone: claimApplicantPhone.trim(),
        claimantEmail: claimApplicantEmail.trim() || currentUser?.email || '',
        applicantName: claimApplicantName.trim(),
        applicantPhone: claimApplicantPhone.trim(),
        applicantEmail: claimApplicantEmail.trim() || currentUser?.email || '',
        remarks: claimRemarks.trim(),
        message: claimRemarks.trim(),
        documents: claimFiles,
        proofDoc: claimFiles[0]?.url || '',
        status: 'Pending',
        date: new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }),
        createdAt: Date.now(),
      };

      // Save to Cloud Firestore
      await cloudSync.saveClaim(newClaim);
      setUserClaims((prev) => [newClaim, ...prev.filter((c) => c.id !== claimId)]);

      // 3. Clear form & switch to My Claims
      setClaimSelectedListing(null);
      setClaimListingQuery('');
      setClaimRemarks('');
      setClaimFiles([]);
      setClaimTab('myClaims');

      showAlert(
        'Claim Submitted! 🎉',
        `Your ownership claim for "${claimSelectedListing.name}" has been submitted to the Admin team. We will verify your documents and update you soon.`,
        'success'
      );
    } catch (err) {
      console.error('Error submitting claim:', err);
      showAlert('Error', 'Failed to submit claim request. Please check connection and try again.', 'error');
    } finally {
      setClaimSubmitting(false);
    }
  };

  const getClaimDocIcon = (type: string) => {
    const t = (type || '').toLowerCase();
    if (['pdf'].includes(t)) return { icon: 'fa-file-pdf', color: '#ef4444', label: 'PDF' };
    if (['doc', 'docx'].includes(t)) return { icon: 'fa-file-word', color: '#2563eb', label: 'Word' };
    if (['xls', 'xlsx', 'csv'].includes(t)) return { icon: 'fa-file-excel', color: '#16a34a', label: 'Excel' };
    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(t)) return { icon: 'fa-file-image', color: '#d97706', label: 'Image' };
    return { icon: 'fa-file-lines', color: '#64748b', label: 'Doc' };
  };

  // Trust Badge Handlers
  const handleSelectListingForTrust = (listing: Listing) => {
    if (isTrustBadgeActive(listing)) {
      showAlert('Badge Active', `"${listing.name}" already has an active Gold Trust Badge! 👑`, 'success');
      return;
    }
    const pendingReq = userTrustRequests.find(
      (r) => String(r.listingId) === String(listing.id) && (r.status || '').toLowerCase() === 'pending'
    );
    if (pendingReq) {
      showAlert('Under Review', `An application for "${listing.name}" is already pending admin review.`, 'warning');
      return;
    }
    setSelectedTrustListing(listing);
    setTrustApplicantName(currentUser?.name || listing.ownerName || '');
    setTrustPhone(currentUser?.phone || listing.phone || '');
    setTrustDocType('Trade License');
    setTrustDocNumber('');
    setTrustDocProofUrl('');
    setTrustTxnId('');
    setTrustPaymentProofUrl('');
    setTrustViewMode('form');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleTrustDocProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTrustDocUploading(true);
    try {
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      const isImg = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) || file.type.startsWith('image/');
      let url = '';
      if (isImg) {
        url = await uploadImageToCloud(file, 45, 1200);
      } else {
        url = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }
      if (url) {
        setTrustDocProofUrl(url);
        showToast('Document proof attached', 'success');
      }
    } catch (err) {
      console.error('Failed to upload document proof:', err);
      showAlert('Upload Failed', 'Could not process document. Please try again.', 'error');
    } finally {
      setTrustDocUploading(false);
    }
  };

  const handleTrustPaymentProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTrustPaymentUploading(true);
    try {
      const url = await uploadImageToCloud(file, 45, 1200);
      if (url) {
        setTrustPaymentProofUrl(url);
        showToast('Payment receipt attached', 'success');
      }
    } catch (err) {
      console.error('Failed to upload payment proof:', err);
    } finally {
      setTrustPaymentUploading(false);
    }
  };

  const handleSubmitTrustRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrustListing) {
      showAlert('Select Business', 'Please select a business listing to apply for Gold Trust Badge.', 'warning');
      return;
    }
    if (!trustApplicantName.trim()) {
      showAlert('Name Required', 'Please enter applicant / owner full name.', 'warning');
      return;
    }
    if (!trustPhone.trim()) {
      showAlert('Phone Required', 'Please enter your contact mobile number.', 'warning');
      return;
    }
    if (!trustDocNumber.trim()) {
      showAlert('Document Number Required', `Please enter your ${trustDocType} registration number.`, 'warning');
      return;
    }
    if (!trustTxnId.trim() || trustTxnId.trim().length < 4) {
      showAlert('Transaction ID Required', 'Please enter the 12-digit UPI Transaction / UTR reference number from your payment receipt.', 'warning');
      return;
    }

    setTrustSubmitting(true);
    try {
      const reqId = `TRST-${Date.now()}`;
      const newReq: TrustRequest = {
        id: reqId,
        listingId: String(selectedTrustListing.id),
        listingName: selectedTrustListing.name,
        businessName: selectedTrustListing.name,
        city: selectedTrustListing.city || '',
        category: selectedTrustListing.category || '',
        ownerName: trustApplicantName.trim(),
        applicantName: trustApplicantName.trim(),
        applicantId: currentUser?.id || '',
        phone: trustPhone.trim(),
        email: currentUser?.email || '',
        docType: trustDocType,
        tradeLicense: trustDocNumber.trim(),
        gstNumber: trustDocType === 'GST Certificate' ? trustDocNumber.trim() : undefined,
        docProof: trustDocProofUrl,
        amountPaid: trustBadgeSettings.offerPrice || 299,
        transactionId: trustTxnId.trim(),
        paymentProof: trustPaymentProofUrl,
        status: 'Pending',
        date: new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }),
        createdAt: Date.now(),
      };

      // Save to Cloud Firestore
      await cloudSync.saveTrustRequest(newReq);
      setUserTrustRequests((prev) => [newReq, ...prev.filter((t) => t.id !== reqId)]);

      // Reset form & view my requests
      setSelectedTrustListing(null);
      setTrustDocNumber('');
      setTrustDocProofUrl('');
      setTrustTxnId('');
      setTrustPaymentProofUrl('');
      setTrustViewMode('listings');
      setTrustTab('myRequests');

      showAlert(
        'Trust Badge Request Submitted! 👑',
        `Your Gold Trust Badge application for "${selectedTrustListing.name}" and payment reference (${newReq.transactionId}) have been received. Admin will verify and activate your badge shortly.`,
        'success'
      );
    } catch (err) {
      console.error('Error submitting trust request:', err);
      showAlert('Submission Failed', 'Could not submit your application. Please check connection and try again.', 'error');
    } finally {
      setTrustSubmitting(false);
    }
  };

  // Help & Support Handlers (Compose & Inbox)
  const handleHelpFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (helpAttachments.length + files.length > 5) {
      showAlert('Limit Exceeded', 'You can attach a maximum of 5 files per support ticket.', 'warning');
      return;
    }

    setHelpAttUploading(true);
    try {
      const newAtts: MailAttachment[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = (file.name.split('.').pop() || '').toLowerCase();
        const allowed = ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv'];
        if (!allowed.includes(ext) && !file.type.startsWith('image/')) {
          showAlert('Unsupported Format', `File "${file.name}" is not supported. Please attach JPG, PNG, PDF, Word, or Excel files.`, 'warning');
          continue;
        }

        const sizeKb = Math.round(file.size / 1024);
        const formattedSize = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;

        let url = '';
        if (['jpg', 'jpeg', 'png', 'webp'].includes(ext) || file.type.startsWith('image/')) {
          url = await uploadImageToCloud(file, 45, 1200);
        } else {
          url = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        }

        if (url) {
          newAtts.push({
            name: file.name,
            type: ext,
            size: formattedSize,
            url,
          });
        }
      }

      setHelpAttachments((prev) => [...prev, ...newAtts]);
      if (newAtts.length > 0) {
        showToast(`${newAtts.length} file(s) attached`, 'success');
      }
    } catch (err) {
      console.error('Error uploading support files:', err);
      showAlert('Upload Failed', 'Failed to attach file. Please try again.', 'error');
    } finally {
      setHelpAttUploading(false);
      if (helpFileInputRef.current) helpFileInputRef.current.value = '';
    }
  };

  const handleHelpFileRemove = (index: number) => {
    setHelpAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSendHelpTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!helpSubject.trim()) {
      showAlert('Subject Required', 'Please enter a subject for your support message.', 'warning');
      return;
    }
    if (!helpMessage.trim()) {
      showAlert('Message Required', 'Please enter your message or inquiry.', 'warning');
      return;
    }

    setHelpSending(true);
    try {
      const ticketId = `ticket_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const nowStr = new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const newMail: MailItem = {
        id: ticketId,
        toEmail: 'admin@localbazar.com',
        toName: 'Super Admin',
        from: 'user',
        senderName: currentUser?.name || 'LocalBazar User',
        senderEmail: currentUser?.email || '',
        senderPhone: currentUser?.phone || '',
        senderId: currentUser?.id || '',
        subject: helpSubject.trim(),
        message: helpMessage.trim(),
        body: helpMessage.trim(),
        attachments: helpAttachments,
        date: nowStr,
        timestamp: Date.now(),
        read: false,
        folder: 'inbox',
        status: 'open',
        replies: [],
      };

      // Save locally
      const updatedMails = [newMail, ...allMails.filter((m) => m.id !== ticketId)];
      setAllMails(updatedMails);

      // Save to Firebase Cloud
      await cloudSync.saveMail(newMail);

      // Reset form & navigate to Inbox
      setHelpSubject('');
      setHelpMessage('');
      setHelpAttachments([]);
      setHelpTab('inbox');
      setSelectedTicketId(ticketId);

      showAlert(
        'Support Ticket Sent! 📩',
        'Your message has been delivered to LocalBazar Admin Support. You can check admin replies directly in this Inbox tab.',
        'success'
      );
    } catch (err) {
      console.error('Error sending support ticket:', err);
      showAlert('Send Failed', 'Could not send message. Please check internet connection and try again.', 'error');
    } finally {
      setHelpSending(false);
    }
  };

  const handleSendTicketReply = async (ticketId: string) => {
    if (!ticketReplyText.trim() && ticketReplyFiles.length === 0) {
      showToast('Please enter a reply message', 'error');
      return;
    }

    const targetTicket = allMails.find((m) => m.id === ticketId);
    if (!targetTicket) return;

    setTicketReplySending(true);
    try {
      const nowStr = new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const replyObj: MailReplyItem = {
        id: `rep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        sender: 'user',
        senderName: currentUser?.name || 'You',
        message: ticketReplyText.trim(),
        attachments: ticketReplyFiles,
        timestamp: Date.now(),
        date: nowStr,
      };

      const updatedTicket: MailItem = {
        ...targetTicket,
        status: 'open',
        read: false,
        replies: [...(targetTicket.replies || []), replyObj],
        timestamp: Date.now(),
      };

      const updatedMails = allMails.map((m) => (m.id === ticketId ? updatedTicket : m));
      setAllMails(updatedMails);
      await cloudSync.saveMail(updatedTicket);

      setTicketReplyText('');
      setTicketReplyFiles([]);
      showToast('Reply sent to Admin Support', 'success');
    } catch (err) {
      console.error('Error replying to ticket:', err);
      showAlert('Reply Failed', 'Could not send reply. Please try again.', 'error');
    } finally {
      setTicketReplySending(false);
    }
  };

  const handleTicketReplyFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (ticketReplyFiles.length + files.length > 3) {
      showAlert('Limit', 'Max 3 attachments per reply', 'warning');
      return;
    }

    setTicketReplyUploading(true);
    try {
      const newAtts: MailAttachment[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = (file.name.split('.').pop() || '').toLowerCase();
        const sizeKb = Math.round(file.size / 1024);
        const formattedSize = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;

        let url = '';
        if (['jpg', 'jpeg', 'png', 'webp'].includes(ext) || file.type.startsWith('image/')) {
          url = await uploadImageToCloud(file, 45, 1200);
        } else {
          url = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        }

        if (url) {
          newAtts.push({
            name: file.name,
            type: ext,
            size: formattedSize,
            url,
          });
        }
      }
      setTicketReplyFiles((prev) => [...prev, ...newAtts]);
    } catch (err) {
      console.error('Error uploading reply file:', err);
    } finally {
      setTicketReplyUploading(false);
      if (ticketReplyFileRef.current) ticketReplyFileRef.current.value = '';
    }
  };

  if (!authChecked && !currentUser) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: themeMode === 'dark' ? '#0b0f19' : '#f8fafc' }}>
        <div style={{ width: 42, height: 42, border: '3.5px solid #cbd5e1', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'lbSpin 0.7s linear infinite' }}></div>
        <style>{`@keyframes lbSpin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="account-hub-main">
      {/* High-End Modern Toast Notification (Zero Layout Shift) */}
      <div
        style={{
          position: 'fixed',
          top: toastMsg.show ? '24px' : '-90px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 999999,
          transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          pointerEvents: toastMsg.show ? 'auto' : 'none',
          maxWidth: '92vw',
          width: 'max-content'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: toastMsg.type === 'error' ? '#ef4444' : '#0f172a',
            color: '#ffffff',
            padding: '0.8rem 1.4rem',
            borderRadius: '999px',
            boxShadow: '0 14px 34px rgba(0, 0, 0, 0.28)',
            fontSize: '0.88rem',
            fontWeight: 700,
            border: '1px solid rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(12px)'
          }}
        >
          <i
            className={`fa-solid ${
              toastMsg.type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'
            }`}
            style={{ color: toastMsg.type === 'error' ? '#fee2e2' : '#4ade80', fontSize: '1.1rem' }}
          ></i>
          <span>{toastMsg.text}</span>
        </div>
      </div>

      <div className={`account-hub-card ${activeScreen === 'viewAddListing' || activeScreen === 'viewManageListings' ? 'expanded-mode' : ''}`}>
        {/* ================= SCREEN 1: MAIN MENU ================= */}
        {activeScreen === 'viewMainMenu' && (
          <div className="account-view-screen active" id="viewMainMenu">
            {/* Top Navigation */}
            <div className="account-sub-top-bar">
              <button
                type="button"
                className="account-sub-back-btn"
                onClick={() => handleAppBack('home')}
                title="Back to Home"
              >
                <i className="fa-solid fa-arrow-left"></i>
              </button>
              <div className="account-sub-title-wrap">
                <h2 className="account-sub-title">Account & Settings</h2>
              </div>
            </div>

            {/* Profile Overview Card */}
            <div className="account-profile-header">
              <div className="profile-avatar-wrapper">
                <img
                  src={
                    !avatarLoadError && (currentUser?.photoURL || auth.currentUser?.photoURL)
                      ? (currentUser?.photoURL || auth.currentUser?.photoURL || '')
                      : `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.name || 'User')}&background=1a73e8&color=fff&size=128&bold=true`
                  }
                  alt={currentUser?.name || 'Profile'}
                  className="profile-avatar-circle"
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarLoadError(true)}
                />
                <div className="auth-source-badge" title="Verified Account">
                  <svg width="15" height="15" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                </div>
              </div>
              <h3 className="user-display-name">
                {currentUser?.name ? currentUser.name.toUpperCase() : ''}
              </h3>
              <p className="user-display-email">
                {currentUser?.email || currentUser?.phone || ''}
              </p>
              {(currentUser?.joinedDate || profileMemberSince) && (
                <div className="member-since-chip">
                  <i className="fa-regular fa-calendar-days"></i>
                  <span>Member Since {currentUser?.joinedDate || profileMemberSince}</span>
                </div>
              )}
            </div>

            {/* Menu List */}
            <div className="account-menu-list">
              {/* 1. Account */}
              <button
                type="button"
                className="menu-list-row"
                onClick={() => goToScreen('viewAccount')}
              >
                <div className="menu-row-left">
                  <div className="menu-icon-box blue">
                    <i className="fa-regular fa-user"></i>
                  </div>
                  <div className="menu-row-info">
                    <strong>Account</strong>
                    <span>Personal profile, contact & identity details</span>
                  </div>
                </div>
                <i className="fa-solid fa-chevron-right menu-chevron"></i>
              </button>

              {/* 2. Saved Places */}
              <button
                type="button"
                className="menu-list-row"
                onClick={() => goToScreen('viewSavedPlaces')}
              >
                <div className="menu-row-left">
                  <div className="menu-icon-box amber">
                    <i className="fa-solid fa-bookmark"></i>
                  </div>
                  <div className="menu-row-info">
                    <strong>Saved Places</strong>
                    <span>Bookmarked shops, clinics & favorite spots</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ background: '#fef3c7', color: '#b45309', padding: '2px 8px', borderRadius: '12px', fontSize: '0.74rem', fontWeight: 800 }}>
                    {savedPlaces.length}
                  </span>
                  <i className="fa-solid fa-chevron-right menu-chevron"></i>
                </div>
              </button>

              {/* 3. Add Listing */}
              <button
                type="button"
                className="menu-list-row"
                onClick={() => {
                  resetForm();
                  goToScreen('viewAddListing');
                }}
              >
                <div className="menu-row-left">
                  <div className="menu-icon-box gold" style={{ background: '#ffedd5', color: '#ea580c' }}>
                    <i className="fa-solid fa-circle-plus"></i>
                  </div>
                  <div className="menu-row-info">
                    <strong>Add Listing</strong>
                    <span>Register a new business, service, office, or shop</span>
                  </div>
                </div>
                <i className="fa-solid fa-chevron-right menu-chevron"></i>
              </button>

              {/* 4. Manage Your Business (Card Outline Highlight) */}
              <button
                type="button"
                className="menu-list-row"
                onClick={() => goToScreen('viewManageListings')}
                style={{ border: '1.5px solid #e2e8f0', borderRadius: '16px', background: '#ffffff', boxShadow: '0 2px 6px rgba(0,0,0,0.02)', margin: '0.2rem 0' }}
              >
                <div className="menu-row-left">
                  <div className="menu-icon-box teal">
                    <i className="fa-solid fa-briefcase"></i>
                  </div>
                  <div className="menu-row-info">
                    <strong>Manage Your Business</strong>
                    <span>Overview, sales leads, catalog & operation dashboard</span>
                  </div>
                </div>
                <i className="fa-solid fa-chevron-right menu-chevron" style={{ color: '#0284c7' }}></i>
              </button>

              {/* 5. Claim My Listing */}
              <button
                type="button"
                className="menu-list-row"
                onClick={() => goToScreen('viewClaimListing')}
              >
                <div className="menu-row-left">
                  <div className="menu-icon-box purple">
                    <i className="fa-solid fa-id-badge"></i>
                  </div>
                  <div className="menu-row-info">
                    <strong>Claim My Listing</strong>
                    <span>Verify & claim ownership of your business or shop</span>
                  </div>
                </div>
                <i className="fa-solid fa-chevron-right menu-chevron"></i>
              </button>

              {/* 6. Trust Badge */}
              <button
                type="button"
                className="menu-list-row"
                onClick={() => goToScreen('viewTrustBadge')}
              >
                <div className="menu-row-left">
                  <div className="menu-icon-box gold">
                    <i className="fa-solid fa-shield-halved"></i>
                  </div>
                  <div className="menu-row-info">
                    <strong>Trust Badge</strong>
                    <span>Check verification status & apply for Gold ✓ Trust badge</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      background: themeMode === 'dark' ? '#78350f' : '#fef3c7',
                      color: themeMode === 'dark' ? '#fde68a' : '#b45309',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      border: themeMode === 'dark' ? '1px solid #92400e' : 'none'
                    }}
                  >
                    ₹{trustBadgeSettings.offerPrice || 299}/{trustBadgeSettings.period === 'Year' ? 'Yr' : (trustBadgeSettings.period || 'Yr')}
                  </span>
                  <i className="fa-solid fa-chevron-right menu-chevron"></i>
                </div>
              </button>

              {/* 7. Help & Support */}
              <button
                type="button"
                className="menu-list-row"
                onClick={() => goToScreen('viewHelp')}
              >
                <div className="menu-row-left">
                  <div className="menu-icon-box green">
                    <i className="fa-solid fa-circle-question"></i>
                  </div>
                  <div className="menu-row-info">
                    <strong>Help & Support</strong>
                    <span>Support inbox, messages & direct inquiries</span>
                  </div>
                </div>
                <i className="fa-solid fa-chevron-right menu-chevron"></i>
              </button>

              {/* 8. Settings */}
              <button
                type="button"
                className="menu-list-row"
                onClick={() => goToScreen('viewSettings')}
              >
                <div className="menu-row-left">
                  <div className="menu-icon-box purple">
                    <i className="fa-solid fa-sliders"></i>
                  </div>
                  <div className="menu-row-info">
                    <strong>Settings</strong>
                    <span>Display theme, cache & sign out</span>
                  </div>
                </div>
                <i className="fa-solid fa-chevron-right menu-chevron"></i>
              </button>

              {/* Safe Bottom Clearance: Ensures Settings is never obscured by the fixed PWA Install banner */}
              <div style={{ height: '5.5rem', width: '100%', flexShrink: 0 }} aria-hidden="true" />
            </div>
          </div>
        )}

        {/* ================= SCREEN 2: ADD / EDIT LISTING (3-STEP WIZARD) ================= */}
        {activeScreen === 'viewAddListing' && (
          <div className="account-view-screen active" id="viewAddListing">
            <div className="account-sub-top-bar">
              <button
                type="button"
                className="account-sub-back-btn"
                onClick={() => {
                  const targetFallback = editingId ? 'viewManageListings' : 'viewMainMenu';
                  resetForm();
                  handleAppBack(targetFallback);
                }}
                title="Back"
              >
                <i className="fa-solid fa-arrow-left"></i>
              </button>
              <div className="account-sub-title-wrap">
                <h2 className="account-sub-title" id="uFormScreenTitle">
                  {editingId ? 'Edit Listing' : 'Create New Listing'}
                </h2>
                <span className="account-sub-desc">Step {listingStep} of 3 • {listingStep === 1 ? 'Basic Details & Photos' : listingStep === 2 ? 'Address & Map' : 'Operating Schedule'}</span>
              </div>
            </div>

            {/* Step Indicator Tabs */}
            <div className="listing-steps-bar" id="listingStepsBar">
              <button
                type="button"
                className={`step-nav-pill ${listingStep === 1 ? 'active' : ''} ${listingStep > 1 ? 'completed' : ''}`}
                onClick={() => goToListingStep(1)}
              >
                <span className="step-num">{listingStep > 1 ? <i className="fa-solid fa-check"></i> : '1'}</span>
                <span className="step-lbl">
                  <span className="step-lbl-full">1. Basic & Photos</span>
                  <span className="step-lbl-compact">Basic</span>
                </span>
              </button>
              <button
                type="button"
                className={`step-nav-pill ${listingStep === 2 ? 'active' : ''} ${listingStep > 2 ? 'completed' : ''}`}
                onClick={() => goToListingStep(2)}
              >
                <span className="step-num">{listingStep > 2 ? <i className="fa-solid fa-check"></i> : '2'}</span>
                <span className="step-lbl">
                  <span className="step-lbl-full">2. Address & Map</span>
                  <span className="step-lbl-compact">Address</span>
                </span>
              </button>
              <button
                type="button"
                className={`step-nav-pill ${listingStep === 3 ? 'active' : ''}`}
                onClick={() => goToListingStep(3)}
              >
                <span className="step-num">3</span>
                <span className="step-lbl">
                  <span className="step-lbl-full">3. Timings</span>
                  <span className="step-lbl-compact">Timings</span>
                </span>
              </button>
            </div>

            <div className="sub-screen-content">
              <form id="userAddListingForm" className="enterprise-form-card" onSubmit={handleSubmitListing}>
                {/* STAGE 1: BASIC & PHOTOS */}
                {listingStep === 1 && (
                  <div className="listing-step-pane active">
                    <div className="compact-photo-picker-box">
                      <div className="compact-photo-top-bar">
                        <div className="compact-photo-title-wrap">
                          <div className="compact-photo-icon-badge">
                            <i className="fa-solid fa-camera"></i>
                          </div>
                          <div className="compact-photo-meta-info">
                            <h4 className="compact-photo-title">Listing Photos</h4>
                            <p className="compact-photo-sub">Upload store images & banners</p>
                          </div>
                        </div>
                        <span className="compact-photo-count-pill">{formPhotos.length} Selected</span>
                      </div>

                      <div className="compact-photo-action-bar">
                        <label className="btn-compact-add-photo" style={{ cursor: 'pointer' }}>
                          <i className="fa-solid fa-cloud-arrow-up"></i> <span>Choose Photos</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handlePhotoUpload}
                            style={{ display: 'none' }}
                          />
                        </label>
                      </div>

                      {formPhotos.length > 0 && (
                        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', padding: '0.75rem 0' }}>
                          {formPhotos.map((img, i) => (
                            <div key={i} style={{ position: 'relative' }}>
                              <img src={img} alt={`Preview ${i}`} style={{ width: '70px', height: '70px', objectFit: 'cover', borderRadius: '8px' }} />
                              <button
                                type="button"
                                onClick={() => setFormPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                                style={{ position: 'absolute', top: -5, right: -5, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: '20px', height: '20px', fontSize: '10px', cursor: 'pointer' }}
                              >
                                &times;
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="form-section-block">
                      <h3 className="form-section-title">
                        <i className="fa-solid fa-circle-info"></i> Basic Information
                      </h3>
                      <div className="form-grid-3">
                        <div className="form-field span-2">
                          <label>Business / Shop Name *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Apollo Pharmacy, New Bengal Sweet"
                            value={formName}
                            onChange={(e) => setFormName(e.target.value)}
                          />
                        </div>

                        <div className="form-field" style={{ position: 'relative' }}>
                          <label>Category *</label>
                          <input
                            type="text"
                            required
                            placeholder="Type category (e.g. Salon, Restaurant)..."
                            value={formCategory}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormCategory(val);
                              setShowCatSuggestions(val.trim().length > 0);
                            }}
                            onFocus={() => {
                              if (formCategory.trim().length > 0) setShowCatSuggestions(true);
                            }}
                            onBlur={() => setTimeout(() => setShowCatSuggestions(false), 200)}
                            autoComplete="off"
                          />
                          {showCatSuggestions && formCategory.trim().length > 0 && categories.length > 0 && (() => {
                            const filtered = categories
                              .filter((c) => c.name.toLowerCase().includes(formCategory.trim().toLowerCase()))
                              .slice(0, 8);
                            if (filtered.length === 0) return null;
                            return (
                              <div className="city-suggestions-dropdown" style={{ display: 'block', maxHeight: '180px', overflowY: 'auto' }}>
                                {filtered.map((c) => (
                                  <div
                                    key={c.name}
                                    style={{ padding: '0.55rem 0.85rem', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '8px' }}
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      setFormCategory(c.name);
                                      setShowCatSuggestions(false);
                                    }}
                                  >
                                    <i className={`fa-solid ${c.icon || 'fa-tag'}`} style={{ color: '#2563eb', fontSize: '0.85rem', width: '16px', textAlign: 'center' }}></i>
                                    <span style={{ fontWeight: 600 }}>{c.name}</span>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </div>

                        <div className="form-field" style={{ position: 'relative' }}>
                          <label>City / Locality *</label>
                          <input
                            type="text"
                            required
                            placeholder="Type city (e.g. Kolkata, Mumbai)..."
                            value={formCity}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormCity(val);
                              setShowCitySuggestions(val.trim().length > 0);
                            }}
                            onFocus={() => {
                              if (formCity.trim().length > 0) setShowCitySuggestions(true);
                            }}
                            onBlur={() => setTimeout(() => setShowCitySuggestions(false), 200)}
                            autoComplete="off"
                          />
                          {showCitySuggestions && formCity.trim().length > 0 && cities.length > 0 && (() => {
                            const filtered = cities
                              .filter((c) => c.name.toLowerCase().includes(formCity.trim().toLowerCase()))
                              .slice(0, 8);
                            if (filtered.length === 0) return null;
                            return (
                              <div className="city-suggestions-dropdown" style={{ display: 'block', maxHeight: '180px', overflowY: 'auto' }}>
                                {filtered.map((c) => (
                                  <div
                                    key={c.name}
                                    style={{ padding: '0.55rem 0.85rem', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '8px' }}
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      setFormCity(c.name);
                                      setShowCitySuggestions(false);
                                    }}
                                  >
                                    <i className="fa-solid fa-location-dot" style={{ color: '#ef4444', fontSize: '0.85rem', width: '16px', textAlign: 'center' }}></i>
                                    <span style={{ fontWeight: 600 }}>{c.name}</span>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </div>

                        <div className="form-field span-2">
                          <label>Contact Phone Number *</label>
                          <input
                            type="text"
                            required
                            placeholder="+91 98300 12345"
                            value={formPhone}
                            onChange={(e) => setFormPhone(e.target.value)}
                          />
                        </div>

                        <div className="form-field span-3">
                          <label>Description / About Business</label>
                          <textarea
                            rows={3}
                            placeholder="Tell customers about your products, services and specialties..."
                            value={formDesc}
                            onChange={(e) => setFormDesc(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="step-action-bar">
                      <div></div>
                      <button type="button" className="btn-step-next" onClick={() => goToListingStep(2)}>
                        <span>Continue to Address</span> <i className="fa-solid fa-arrow-right"></i>
                      </button>
                    </div>
                  </div>
                )}

                {/* STAGE 2: ADDRESS & GOOGLE MAP */}
                {listingStep === 2 && (
                  <div className="listing-step-pane active">
                    <div className="form-section-block">
                      <h3 className="form-section-title">
                        <i className="fa-solid fa-map-location-dot"></i> Store Location & Address
                      </h3>
                      <div className="form-grid-2">
                        <div className="form-field">
                          <label>Full Detailed Address *</label>
                          <textarea
                            rows={4}
                            required
                            placeholder="Building name, Floor, Street, Landmark, Pin Code"
                            value={formAddress}
                            onChange={(e) => setFormAddress(e.target.value)}
                          />
                        </div>
                        <div className="form-field">
                          <label>Google Map Link / Share URL</label>
                          <textarea
                            rows={4}
                            placeholder="https://maps.google.com/?q=... or Share location URL"
                            value={formMapLink}
                            onChange={(e) => setFormMapLink(e.target.value)}
                          />
                          <small className="field-hint">Paste Google Maps share link so customers can navigate with one tap.</small>
                        </div>
                      </div>
                    </div>

                    <div className="step-action-bar">
                      <button type="button" className="btn-step-prev" onClick={() => goToListingStep(1)}>
                        <i className="fa-solid fa-arrow-left"></i> <span>Back</span>
                      </button>
                      <button type="button" className="btn-step-next" onClick={() => goToListingStep(3)}>
                        <span>Continue to Timings</span> <i className="fa-solid fa-arrow-right"></i>
                      </button>
                    </div>
                  </div>
                )}

                {/* STAGE 3: TIMINGS & SUBMIT */}
                {listingStep === 3 && (
                  <div className="listing-step-pane active">
                      <div className="form-section-block">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <h3 className="form-section-title" style={{ margin: 0 }}>
                            <i className="fa-regular fa-clock"></i> Operating Schedule & Timings
                          </h3>
                          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Weekly Store Hours</span>
                        </div>
                        <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 1rem 0', lineHeight: 1.4 }}>
                          Set your standard daily opening and closing hours. Turn the switch off for scheduled weekly off-days.
                        </p>

                        <div className="schedule-step-container">
                          {/* Quick Presets Bar */}
                          <div className="schedule-presets-bar">
                            <span className="schedule-presets-label">
                              <i className="fa-solid fa-wand-magic-sparkles" style={{ color: '#2563eb' }}></i> Presets:
                            </span>
                            <button type="button" className="schedule-preset-btn" onClick={applyPresetMonSat}>
                              Mon - Sat (9:00 AM - 8:30 PM)
                            </button>
                            <button type="button" className="schedule-preset-btn" onClick={applyPresetOpenAllDays}>
                              Open All 7 Days
                            </button>
                            <button type="button" className="schedule-preset-btn" onClick={applyPresetCloseSunday}>
                              Close Sunday Only
                            </button>
                          </div>

                          {/* Daily Schedule List (Zero-Overflow Mobile Responsive) */}
                          <div className="schedule-days-list">
                            {DAYS_OF_WEEK.map((day) => {
                              const sched = formSchedule[day] || { isOpen: true, openTime: '09:00', openAmPm: 'AM', closeTime: '08:30', closeAmPm: 'PM' };
                              return (
                                <div key={day} className={`schedule-day-card ${!sched.isOpen ? 'is-closed' : ''}`}>
                                  <div className="schedule-day-header-col">
                                    <label className="schedule-day-switch">
                                      <input
                                        type="checkbox"
                                        checked={sched.isOpen}
                                        onChange={(e) => {
                                          setFormSchedule((prev) => ({
                                            ...prev,
                                            [day]: { ...sched, isOpen: e.target.checked },
                                          }));
                                        }}
                                      />
                                      <span className="schedule-day-slider"></span>
                                    </label>
                                    <span className="schedule-day-name">{day}</span>
                                    <span className={`schedule-status-pill ${sched.isOpen ? 'open' : 'closed'}`}>
                                      {sched.isOpen ? 'Open' : 'Closed'}
                                    </span>
                                  </div>

                                  {sched.isOpen ? (
                                    <div className="schedule-day-times-wrap">
                                      <div className="schedule-time-box">
                                        <input
                                          type="text"
                                          value={sched.openTime}
                                          placeholder="09:00"
                                          aria-label={`${day} opening time`}
                                          onChange={(e) => setFormSchedule((prev) => ({ ...prev, [day]: { ...sched, openTime: e.target.value } }))}
                                        />
                                        <select
                                          value={sched.openAmPm}
                                          aria-label={`${day} opening AM/PM`}
                                          onChange={(e) => setFormSchedule((prev) => ({ ...prev, [day]: { ...sched, openAmPm: e.target.value } }))}
                                        >
                                          <option value="AM">AM</option>
                                          <option value="PM">PM</option>
                                        </select>
                                      </div>

                                      <span className="schedule-time-divider">to</span>

                                      <div className="schedule-time-box">
                                        <input
                                          type="text"
                                          value={sched.closeTime}
                                          placeholder="08:30"
                                          aria-label={`${day} closing time`}
                                          onChange={(e) => setFormSchedule((prev) => ({ ...prev, [day]: { ...sched, closeTime: e.target.value } }))}
                                        />
                                        <select
                                          value={sched.closeAmPm}
                                          aria-label={`${day} closing AM/PM`}
                                          onChange={(e) => setFormSchedule((prev) => ({ ...prev, [day]: { ...sched, closeAmPm: e.target.value } }))}
                                        >
                                          <option value="AM">AM</option>
                                          <option value="PM">PM</option>
                                        </select>
                                      </div>
                                    </div>
                                  ) : (
                                    <span style={{ color: '#ef4444', fontWeight: 700, fontSize: '0.86rem' }}>
                                      <i className="fa-regular fa-circle-xmark"></i> Closed all day
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* ================= HOLIDAY CALENDAR SELECTOR ================= */}
                        <div className="holiday-section-card">
                          <div className="holiday-section-header">
                            <div>
                              <h4 className="holiday-section-title">
                                <i className="fa-solid fa-umbrella-beach" style={{ color: '#ef4444' }}></i> Scheduled Holidays & Special Off-Days
                              </h4>
                              <p className="holiday-section-sub">
                                Pick specific calendar dates when your shop is closed for festivals, maintenance, or holidays.
                              </p>
                            </div>
                          </div>

                          <div className="holiday-controls-container">
                            <div className="holiday-btn-row">
                              <button
                                type="button"
                                className="btn-open-holiday-cal"
                                onClick={() => {
                                  setHolidayTarget('form');
                                  setTempSelectedHolidays([...formHolidays]);
                                  setCalViewingDate(new Date());
                                  setShowHolidayCalModal(true);
                                }}
                              >
                                <i className="fa-regular fa-calendar-plus"></i>
                                <span>Add Holiday</span>
                              </button>

                              {formHolidays.length > 0 && (
                                <button
                                  type="button"
                                  className="btn-clear-all-holidays-outline"
                                  onClick={() => {
                                    if (confirm('Clear all scheduled holidays?')) {
                                      setFormHolidays([]);
                                    }
                                  }}
                                >
                                  <i className="fa-regular fa-trash-can"></i>
                                  <span>Clear All</span>
                                </button>
                              )}
                            </div>

                            {/* Holiday Total Counter Banner / Card */}
                            <div
                              className={`holiday-total-card ${formHolidays.length > 0 ? 'active-holidays' : 'zero-holidays'}`}
                              onClick={() => {
                                if (formHolidays.length > 0) {
                                  setHolidayTarget('form');
                                  setShowHolidayListSheet(true);
                                } else {
                                  setHolidayTarget('form');
                                  setTempSelectedHolidays([...formHolidays]);
                                  setCalViewingDate(new Date());
                                  setShowHolidayCalModal(true);
                                }
                              }}
                              role="button"
                              tabIndex={0}
                              title={formHolidays.length > 0 ? "Click to view or remove scheduled holidays" : "Click to select holidays"}
                            >
                              <div className="holiday-total-icon-wrap">
                                <i className={formHolidays.length > 0 ? "fa-solid fa-calendar-check" : "fa-regular fa-calendar"}></i>
                              </div>
                              <div className="holiday-total-info">
                                <div className="holiday-total-main-text">
                                  Total: <strong>{formHolidays.length} {formHolidays.length === 1 ? 'Holiday' : 'Holidays'}</strong>
                                </div>
                                <div className="holiday-total-sub-text">
                                  {formHolidays.length > 0
                                    ? 'Click to view scheduled dates or make changes'
                                    : 'No holidays scheduled yet. Click "Add Holiday" to pick dates.'}
                                </div>
                              </div>
                              {formHolidays.length > 0 && (
                                <div className="holiday-total-action-badge">
                                  <span>View Dates</span>
                                  <i className="fa-solid fa-chevron-right"></i>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="step-action-bar">
                        <button type="button" className="btn-step-prev" onClick={() => goToListingStep(2)}>
                          <i className="fa-solid fa-arrow-left"></i> <span>Back</span>
                        </button>
                        <button type="submit" className="btn-primary-action btn-large" id="btnPublishFromTimings">
                          <i className="fa-solid fa-store"></i> <span>{editingId ? 'Update Listing' : 'Complete Your Registration'}</span>
                        </button>
                      </div>
                    </div>
                )}
              </form>
            </div>
          </div>
        )}

        {/* ================= SCREEN 3: MANAGE LISTINGS ================= */}
        {activeScreen === 'viewManageListings' && (() => {
          const totalCount = myListings.length;
          const mainCount = myListings.filter((l) => !(l as any).isBranch).length;
          const branchCount = myListings.filter((l) => !!(l as any).isBranch).length;
          const uniqueCities = Array.from(new Set(myListings.map((l) => l.city).filter(Boolean)));

          const filteredBusinesses = myListings.filter((biz) => {
            const q = bizSearch.toLowerCase().trim();
            if (!q) return true;
            return (
              biz.name.toLowerCase().includes(q) ||
              (biz.city && biz.city.toLowerCase().includes(q)) ||
              (biz.address && biz.address.toLowerCase().includes(q)) ||
              (biz.category && biz.category.toLowerCase().includes(q)) ||
              (biz.phone && biz.phone.toLowerCase().includes(q))
            );
          });

          return (
            <div className="account-view-screen active" id="viewManageListings">
              <div className="account-sub-top-bar">
                <button
                  type="button"
                  className="account-sub-back-btn"
                  onClick={() => handleAppBack('viewMainMenu')}
                  title="Back to Menu"
                >
                  <i className="fa-solid fa-arrow-left"></i>
                </button>
                <div className="account-sub-title-wrap">
                  <h2 className="account-sub-title">Manage Your Business</h2>
                </div>
              </div>

              <div className="sub-screen-content" style={{ padding: '1.25rem 1rem' }}>
                {/* Search Box */}
                <div className="biz-search-box" style={{ width: '100%', marginBottom: '1.25rem', position: 'relative' }}>
                  <i className="fa-solid fa-magnifying-glass"></i>
                  <input
                    type="text"
                    className="biz-search-input"
                    placeholder="Search store name, city, address..."
                    value={bizSearch}
                    onChange={(e) => setBizSearch(e.target.value)}
                    style={{ height: '46px', margin: 0 }}
                  />
                  {bizSearch && (
                    <button
                      type="button"
                      onClick={() => setBizSearch('')}
                      style={{
                        position: 'absolute',
                        right: '0.85rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        padding: '4px',
                        fontSize: '0.9rem'
                      }}
                      title="Clear search"
                    >
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  )}
                </div>

                {/* Businesses Cards List */}
                {filteredBusinesses.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem 1.5rem', background: '#f8fafc', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
                    <i className="fa-solid fa-store" style={{ fontSize: '2.5rem', color: '#94a3b8', marginBottom: '0.75rem', display: 'block' }}></i>
                    <h4 style={{ fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem' }}>
                      {myListings.length === 0 ? 'No Businesses Registered Yet' : 'No Matching Businesses Found'}
                    </h4>
                    <p style={{ color: '#64748b', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
                      {myListings.length === 0
                        ? 'Start reaching local customers by adding your shop or office.'
                        : 'Try adjusting your search terms or filters above.'}
                    </p>
                    {myListings.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => {
                          resetForm();
                          goToScreen('viewAddListing');
                        }}
                        style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0.7rem 1.5rem', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Create Your First Listing
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setBizSearch('');
                          setBizCityFilter('ALL');
                          setBizTypeFilter('all');
                        }}
                        style={{ background: '#e2e8f0', color: '#334155', border: 'none', padding: '0.6rem 1.25rem', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Reset Filters
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {filteredBusinesses.map((item) => (
                      <div key={item.id} className="biz-card-item">
                        {/* Top Clickable Row that opens Merchant Portal */}
                        <div
                          className="biz-card-main-row"
                          onClick={() => openBusinessPortal(item, 'gallery')}
                        >
                          <div className="biz-card-thumb-wrap">
                            <img
                              src={item.image || 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=140&auto=format&fit=crop&q=80'}
                              alt={item.name}
                              className="biz-card-thumb"
                            />
                            <span className={`biz-card-badge ${item.status === 'Approved' ? 'is-public' : 'is-draft'}`}>
                              <i className={item.status === 'Approved' ? 'fa-solid fa-check' : 'fa-solid fa-clock'}></i>
                              <span>{item.status === 'Approved' ? 'Public' : 'Draft'}</span>
                            </span>
                          </div>

                          <div className="biz-card-info-wrap">
                            <div className="biz-card-title-row">
                              <h4 className="biz-card-name">{item.name}</h4>
                              <span className="biz-card-cat-pill">{item.category}</span>
                            </div>

                            <div className="biz-card-meta-row">
                              <span className="biz-card-meta-loc">
                                <i className="fa-solid fa-location-dot" style={{ color: '#ef4444' }}></i>
                                <span>{item.city}</span>
                              </span>
                              {item.phone && (
                                <span className="biz-card-meta-phone">
                                  <i className="fa-solid fa-phone" style={{ color: '#475569' }}></i>
                                  <span>{item.phone}</span>
                                </span>
                              )}
                            </div>

                            <div className="biz-card-timing-wrap">
                              <span className="biz-card-timing-pill">
                                <i className="fa-regular fa-clock"></i>
                                <span>{item.scheduleTimings || '09:00 AM - 08:30 PM'}</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Dotted Divider */}
                        <div className="biz-card-divider"></div>

                        {/* Bottom Actions Row */}
                        <div className="biz-card-actions-row">
                          {item.status === 'Approved' ? (
                            <button
                              type="button"
                              className="btn-biz-action btn-biz-share"
                              onClick={(e) => {
                                e.stopPropagation();
                                setQrModalListing(item);
                              }}
                              style={{ width: '100%' }}
                            >
                              <i className="fa-solid fa-qrcode"></i>
                              <span>Share & QR</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn-biz-action btn-biz-publish-now"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePublishListing(item);
                              }}
                              style={{ width: '100%' }}
                            >
                              <i className="fa-solid fa-rocket"></i>
                              <span>Public Now</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* ================= SCREEN 4: SAVED PLACES ================= */}
        {activeScreen === 'viewSavedPlaces' && (
          <div className="account-view-screen active" id="viewSavedPlaces">
            <div className="account-sub-top-bar">
              <button
                type="button"
                className="account-sub-back-btn"
                onClick={() => handleAppBack('viewMainMenu')}
                title="Back to Menu"
              >
                <i className="fa-solid fa-arrow-left"></i>
              </button>
              <div className="account-sub-title-wrap">
                <h2 className="account-sub-title">Saved Places</h2>
                <span className="account-sub-desc">
                  {savedPlaces.length} Bookmarked {savedPlaces.length === 1 ? 'place' : 'places'}
                </span>
              </div>
            </div>

            <div className="sub-screen-content" style={{ padding: '1rem 1.25rem 2.5rem' }}>
              {savedPlaces.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3.5rem 1.5rem', background: '#f8fafc', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
                  <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', color: '#2563eb', fontSize: '1.75rem' }}>
                    <i className="fa-regular fa-bookmark"></i>
                  </div>
                  <h4 style={{ fontWeight: 800, color: '#0f172a', marginBottom: '0.4rem', fontSize: '1.05rem' }}>No Saved Places Yet</h4>
                  <p style={{ fontSize: '0.86rem', color: '#64748b', maxWidth: '320px', margin: '0 auto 1.25rem', lineHeight: 1.5 }}>
                    Bookmark your favorite local stores, clinics, and essentials across the platform to access them instantly from here.
                  </p>
                  <button
                    type="button"
                    onClick={() => router.push('/explore')}
                    style={{
                      background: '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      padding: '0.65rem 1.4rem',
                      borderRadius: '10px',
                      fontWeight: 700,
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)'
                    }}
                  >
                    <i className="fa-solid fa-compass" style={{ marginRight: '6px' }}></i> Explore Local Stores
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', width: '100%', boxSizing: 'border-box' }}>
                  {savedPlaces.map((item) => {
                    const shopCover = item.image || (Array.isArray(item.gallery) && item.gallery[0]) || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=200';
                    const targetShopId = String(item.id || '').trim();

                    return (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.85rem',
                          padding: '0.85rem 1rem',
                          background: '#ffffff',
                          borderRadius: '14px',
                          border: '1px solid #e2e8f0',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                          width: '100%',
                          boxSizing: 'border-box'
                        }}
                      >
                        {/* Direct Link to Store Home */}
                        <Link
                          href={`/shops/${encodeURIComponent(targetShopId)}`}
                          prefetch={true}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.85rem',
                            textDecoration: 'none',
                            color: 'inherit',
                            flex: 1,
                            minWidth: 0
                          }}
                        >
                          <img
                            src={shopCover}
                            alt={item.name}
                            style={{
                              width: '64px',
                              height: '64px',
                              borderRadius: '12px',
                              objectFit: 'cover',
                              border: '1px solid #f1f5f9',
                              flexShrink: 0
                            }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                              <h4
                                style={{
                                  fontWeight: 800,
                                  color: '#0f172a',
                                  margin: 0,
                                  fontSize: '0.94rem',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}
                              >
                                {item.name}
                              </h4>
                              {item.verified && (
                                <i className="fa-solid fa-circle-check" style={{ color: '#2563eb', fontSize: '0.8rem', flexShrink: 0 }}></i>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: '#64748b', marginBottom: '5px' }}>
                              <span style={{ background: '#f1f5f9', padding: '2px 7px', borderRadius: '6px', fontWeight: 600, color: '#334155' }}>
                                {item.category || 'Store'}
                              </span>
                              {item.city && (
                                <span>
                                  <i className="fa-solid fa-location-dot" style={{ color: '#94a3b8', marginRight: '3px' }}></i>
                                  {item.city}
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', color: '#16a34a', fontWeight: 700 }}>
                              <span>Visit Store Page</span>
                              <i className="fa-solid fa-arrow-right" style={{ fontSize: '0.7rem' }}></i>
                            </div>
                          </div>
                        </Link>

                        {/* Remove Bookmark Button */}
                        <button
                          type="button"
                          onClick={(e) => handleRemoveBookmark(e, item.id, item.name)}
                          style={{
                            background: '#fef2f2',
                            border: '1px solid #fee2e2',
                            color: '#ef4444',
                            cursor: 'pointer',
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                          title="Remove from saved places"
                        >
                          <i className="fa-solid fa-trash-can" style={{ fontSize: '0.85rem' }}></i>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= SCREEN 5: PERSONAL PROFILE ================= */}
        {activeScreen === 'viewAccount' && (
          <div className="account-view-screen active" id="viewAccount">
            <div className="account-sub-top-bar">
              <button
                type="button"
                className="account-sub-back-btn"
                onClick={() => handleAppBack('viewMainMenu')}
                title="Back to Menu"
              >
                <i className="fa-solid fa-arrow-left"></i>
              </button>
              <div className="account-sub-title-wrap">
                <h2 className="account-sub-title">Account</h2>
                <span className="account-sub-desc">Personal profile, contact & identity details</span>
              </div>
            </div>

            <div className="sub-screen-content" style={{ padding: '1rem 1.25rem 2.5rem' }}>
              <div className="account-profile-container">
                {/* Top Info Banner */}
                <div className="profile-info-banner">
                  <div className="profile-info-icon-badge">
                    <i className="fa-solid fa-id-badge"></i>
                  </div>
                  <p className="profile-info-text">
                    Manage your personal profile details. Empty fields can be completed and updated below.
                  </p>
                </div>

                {/* Google Profile Card */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.85rem 1rem', background: '#f8fafc', borderRadius: '14px', border: '1px solid #e2e8f0', marginBottom: '1.25rem' }}>
                  <img
                    src={
                      !avatarLoadError && (currentUser?.photoURL || auth.currentUser?.photoURL)
                        ? (currentUser?.photoURL || auth.currentUser?.photoURL || '')
                        : `https://ui-avatars.com/api/?name=${encodeURIComponent(profileName || currentUser?.name || 'User')}&background=1a73e8&color=fff&size=100&bold=true`
                    }
                    alt={currentUser?.name || 'Profile'}
                    style={{ width: '52px', height: '52px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #2563eb', flexShrink: 0 }}
                    referrerPolicy="no-referrer"
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {profileName || currentUser?.name || 'Google Account User'}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {profileEmail || currentUser?.email || 'Google Account'}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.7rem', background: '#dcfce7', color: '#166534', padding: '3px 8px', borderRadius: 999, fontWeight: 700, flexShrink: 0 }}>
                    <i className="fa-solid fa-circle-check" style={{ marginRight: '4px' }}></i> Verified
                  </span>
                </div>

                {/* Full Name * */}
                <div className="profile-field-group">
                  <label className="profile-field-label">Full Name *</label>
                  <input
                    type="text"
                    className="profile-field-input"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="Enter your full name"
                  />
                </div>

                {/* Gender */}
                <div className="profile-field-group">
                  <label className="profile-field-label">Gender</label>
                  <div className="profile-field-select-wrapper">
                    <select
                      className="profile-field-select"
                      value={profileGender}
                      onChange={(e) => setProfileGender(e.target.value)}
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                    <i className="fa-solid fa-chevron-down profile-select-arrow"></i>
                  </div>
                </div>

                {/* Date of Birth (Interactive Native Calendar) */}
                <div className="profile-field-group">
                  <label className="profile-field-label">Date of Birth</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type="date"
                      className="profile-field-input"
                      value={formatDobForInput(profileDob)}
                      onChange={(e) => setProfileDob(e.target.value)}
                      max={new Date().toISOString().split('T')[0]}
                      style={{ cursor: 'pointer', paddingRight: '2.5rem' }}
                    />
                    <i
                      className="fa-regular fa-calendar-days"
                      style={{
                        position: 'absolute',
                        right: '12px',
                        color: '#2563eb',
                        fontSize: '1.05rem',
                        pointerEvents: 'none'
                      }}
                    ></i>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                    Click the calendar icon or field to select your birth date.
                  </span>
                </div>

                {/* City */}
                <div className="profile-field-group">
                  <label className="profile-field-label">City</label>
                  <input
                    type="text"
                    className="profile-field-input"
                    value={profileCity}
                    onChange={(e) => setProfileCity(e.target.value)}
                    placeholder="City"
                  />
                </div>

                {/* State */}
                <div className="profile-field-group">
                  <label className="profile-field-label">State</label>
                  <input
                    type="text"
                    className="profile-field-input"
                    value={profileState}
                    onChange={(e) => setProfileState(e.target.value)}
                    placeholder="State"
                  />
                </div>

                {/* PIN Code */}
                <div className="profile-field-group">
                  <label className="profile-field-label">PIN Code</label>
                  <input
                    type="text"
                    className="profile-field-input"
                    value={profilePincode}
                    onChange={(e) => setProfilePincode(e.target.value)}
                    placeholder="PIN Code"
                  />
                </div>

                {/* Email Address (Permanently linked to Google Account - Read Only) */}
                <div className="profile-field-group">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <label className="profile-field-label" style={{ margin: 0 }}>Email Address</label>
                    <span style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#dcfce7', padding: '2px 8px', borderRadius: '999px' }}>
                      <i className="fa-solid fa-lock" style={{ fontSize: '0.68rem' }}></i> Google Verified
                    </span>
                  </div>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type="email"
                      className="profile-field-input disabled"
                      value={profileEmail || currentUser?.email || ''}
                      readOnly
                      disabled
                      style={{ background: '#f8fafc', color: '#64748b', cursor: 'not-allowed', borderColor: '#e2e8f0', paddingRight: '2.5rem' }}
                      title="Email is securely linked to your Google Account and cannot be edited"
                    />
                    <i
                      className="fa-solid fa-lock"
                      style={{
                        position: 'absolute',
                        right: '12px',
                        color: '#94a3b8',
                        fontSize: '0.85rem'
                      }}
                    ></i>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                    Primary email is securely tied to your Google login.
                  </span>
                </div>

                {/* Mobile Phone Number */}
                <div className="profile-field-group">
                  <label className="profile-field-label">Mobile Phone Number</label>
                  <input
                    type="tel"
                    className="profile-field-input"
                    value={profilePhone}
                    onChange={(e) => setProfilePhone(e.target.value)}
                    placeholder="Mobile Phone Number"
                  />
                </div>

                {/* Member Since */}
                <div className="profile-field-group">
                  <label className="profile-field-label">Member Since</label>
                  <input
                    type="text"
                    className="profile-field-input disabled"
                    value={profileMemberSince || currentUser?.joinedDate || ''}
                    disabled
                    readOnly
                  />
                </div>

                {/* Save & Update Profile Button */}
                <button
                  type="button"
                  className="btn-save-profile"
                  onClick={handleSaveProfile}
                  disabled={isSavingProfile}
                  style={saveSuccess ? { background: '#16a34a', borderColor: '#16a34a', boxShadow: '0 4px 14px rgba(22, 163, 74, 0.3)' } : undefined}
                >
                  <i className={`fa-solid ${saveSuccess ? 'fa-circle-check' : isSavingProfile ? 'fa-spinner fa-spin' : 'fa-check'}`}></i>
                  <span>{saveSuccess ? 'Profile Saved Successfully!' : isSavingProfile ? 'Saving...' : 'Save & Update Profile'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= SCREEN 6: CLAIM LISTING ================= */}
        {activeScreen === 'viewClaimListing' && (
          <div className="account-view-screen active" id="viewClaimListing">
            <div className="account-sub-top-bar">
              <button
                type="button"
                className="account-sub-back-btn"
                onClick={() => handleAppBack('viewMainMenu')}
                title="Back to Menu"
              >
                <i className="fa-solid fa-arrow-left"></i>
              </button>
              <div className="account-sub-title-wrap">
                <h2 className="account-sub-title">Claim My Listing</h2>
                <span className="account-sub-desc">Verify & claim business ownership</span>
              </div>
            </div>

            <div className="sub-screen-content" style={{ padding: '1.25rem', maxWidth: '720px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
              {/* Sub-tabs: Submit Claim vs My Submitted Claims */}
              <div style={{ display: 'flex', gap: '0.5rem', background: '#f1f5f9', padding: '0.35rem', borderRadius: '12px', marginBottom: '1.25rem' }}>
                <button
                  type="button"
                  onClick={() => setClaimTab('form')}
                  style={{
                    flex: 1,
                    padding: '0.65rem 1rem',
                    border: 'none',
                    borderRadius: '9px',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    background: claimTab === 'form' ? '#ffffff' : 'transparent',
                    color: claimTab === 'form' ? '#0f172a' : '#64748b',
                    boxShadow: claimTab === 'form' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.45rem',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <i className="fa-solid fa-file-pen" style={{ color: claimTab === 'form' ? '#2563eb' : '#94a3b8' }}></i>
                  Claim Business Form
                </button>
                <button
                  type="button"
                  onClick={() => setClaimTab('myClaims')}
                  style={{
                    flex: 1,
                    padding: '0.65rem 1rem',
                    border: 'none',
                    borderRadius: '9px',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    background: claimTab === 'myClaims' ? '#ffffff' : 'transparent',
                    color: claimTab === 'myClaims' ? '#0f172a' : '#64748b',
                    boxShadow: claimTab === 'myClaims' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.45rem',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <i className="fa-solid fa-list-check" style={{ color: claimTab === 'myClaims' ? '#16a34a' : '#94a3b8' }}></i>
                  My Submitted Claims
                  {userClaims.length > 0 && (
                    <span style={{ background: '#2563eb', color: '#fff', fontSize: '0.72rem', padding: '0.1rem 0.5rem', borderRadius: '999px', fontWeight: 800 }}>
                      {userClaims.length}
                    </span>
                  )}
                </button>
              </div>

              {/* TAB 1: CLAIM SUBMISSION FORM */}
              {claimTab === 'form' && (
                <div>
                  {/* Informational Banner */}
                  <div
                    style={{
                      background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)',
                      border: '1px solid #bfdbfe',
                      borderRadius: '14px',
                      padding: '1rem 1.25rem',
                      display: 'flex',
                      gap: '0.85rem',
                      alignItems: 'flex-start',
                      marginBottom: '1.25rem',
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: '#2563eb',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      <i className="fa-solid fa-shield-halved" style={{ fontSize: '1.05rem' }}></i>
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, color: '#1e3a8a', fontSize: '0.94rem' }}>
                        Claim Ownership of Your Business
                      </div>
                      <div style={{ color: '#475569', fontSize: '0.82rem', marginTop: 3, lineHeight: 1.45 }}>
                        Search and select your listed shop using the smart City & Category filters below. Upload your ownership proof (Trade License, Electricity Bill, Business Card, or Shop Front Photo) for fast Admin verification.
                      </div>
                    </div>
                  </div>

                  <form onSubmit={handleSubmitClaim} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                    {/* SECTION 1: CITY & CATEGORY AUTO-SUGGEST */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                      {/* 1. City Auto-Suggest */}
                      <div style={{ position: 'relative' }}>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                          1. City / Location (Admin Verified) *
                        </label>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <i className="fa-solid fa-location-dot" style={{ position: 'absolute', left: '12px', color: '#64748b', fontSize: '0.9rem', pointerEvents: 'none' }}></i>
                          <input
                            type="text"
                            placeholder="Type to search city..."
                            value={claimCityInput}
                            onChange={(e) => {
                              setClaimCityInput(e.target.value);
                              setClaimCityDropdownOpen(true);
                            }}
                            onFocus={() => setClaimCityDropdownOpen(true)}
                            style={{
                              width: '100%',
                              padding: '0.68rem 2.2rem 0.68rem 2.2rem',
                              borderRadius: '10px',
                              border: '1.5px solid #cbd5e1',
                              fontSize: '0.88rem',
                              fontWeight: 600,
                              color: '#0f172a',
                              boxSizing: 'border-box',
                              background: '#fff',
                            }}
                          />
                          {claimCityInput && (
                            <button
                              type="button"
                              onClick={() => {
                                setClaimCityInput('');
                                setClaimCityDropdownOpen(false);
                              }}
                              style={{ position: 'absolute', right: '10px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', fontSize: '0.85rem' }}
                            >
                              <i className="fa-solid fa-xmark"></i>
                            </button>
                          )}
                        </div>

                        {/* City Dropdown Menu */}
                        {claimCityDropdownOpen && claimFilteredCities.length > 0 && (
                          <div
                            style={{
                              position: 'absolute',
                              top: '100%',
                              left: 0,
                              right: 0,
                              marginTop: 4,
                              background: '#fff',
                              borderRadius: '10px',
                              boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
                              border: '1px solid #e2e8f0',
                              maxHeight: '210px',
                              overflowY: 'auto',
                              zIndex: 100,
                            }}
                          >
                            {claimFilteredCities.map((c) => (
                              <div
                                key={c.id || c.name}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setClaimCityInput(c.name);
                                  setClaimCityDropdownOpen(false);
                                  if (claimSelectedListing && claimSelectedListing.city?.toLowerCase() !== c.name.toLowerCase()) {
                                    setClaimSelectedListing(null);
                                    setClaimListingQuery('');
                                  }
                                }}
                                style={{
                                  padding: '0.65rem 0.9rem',
                                  cursor: 'pointer',
                                  fontSize: '0.85rem',
                                  fontWeight: 600,
                                  color: '#334155',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                  borderBottom: '1px solid #f1f5f9',
                                  transition: 'background 0.12s ease',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
                              >
                                <i className="fa-solid fa-location-dot" style={{ color: '#2563eb', fontSize: '0.8rem' }}></i>
                                <span>{c.name}</span>
                                {c.district && <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginLeft: 'auto' }}>{c.district}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 2. Category Auto-Suggest */}
                      <div style={{ position: 'relative' }}>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                          2. Business Category *
                        </label>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <i className="fa-solid fa-layer-group" style={{ position: 'absolute', left: '12px', color: '#64748b', fontSize: '0.9rem', pointerEvents: 'none' }}></i>
                          <input
                            type="text"
                            placeholder="Type to search category..."
                            value={claimCategoryInput}
                            onChange={(e) => {
                              setClaimCategoryInput(e.target.value);
                              setClaimCategoryDropdownOpen(true);
                            }}
                            onFocus={() => setClaimCategoryDropdownOpen(true)}
                            style={{
                              width: '100%',
                              padding: '0.68rem 2.2rem 0.68rem 2.2rem',
                              borderRadius: '10px',
                              border: '1.5px solid #cbd5e1',
                              fontSize: '0.88rem',
                              fontWeight: 600,
                              color: '#0f172a',
                              boxSizing: 'border-box',
                              background: '#fff',
                            }}
                          />
                          {claimCategoryInput && (
                            <button
                              type="button"
                              onClick={() => {
                                setClaimCategoryInput('');
                                setClaimCategoryDropdownOpen(false);
                              }}
                              style={{ position: 'absolute', right: '10px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', fontSize: '0.85rem' }}
                            >
                              <i className="fa-solid fa-xmark"></i>
                            </button>
                          )}
                        </div>

                        {/* Category Dropdown Menu */}
                        {claimCategoryDropdownOpen && claimFilteredCategories.length > 0 && (
                          <div
                            style={{
                              position: 'absolute',
                              top: '100%',
                              left: 0,
                              right: 0,
                              marginTop: 4,
                              background: '#fff',
                              borderRadius: '10px',
                              boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
                              border: '1px solid #e2e8f0',
                              maxHeight: '210px',
                              overflowY: 'auto',
                              zIndex: 100,
                            }}
                          >
                            {claimFilteredCategories.map((cat) => (
                              <div
                                key={cat.id || cat.name}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setClaimCategoryInput(cat.name);
                                  setClaimCategoryDropdownOpen(false);
                                  if (claimSelectedListing && claimSelectedListing.category?.toLowerCase() !== cat.name.toLowerCase()) {
                                    setClaimSelectedListing(null);
                                    setClaimListingQuery('');
                                  }
                                }}
                                style={{
                                  padding: '0.65rem 0.9rem',
                                  cursor: 'pointer',
                                  fontSize: '0.85rem',
                                  fontWeight: 600,
                                  color: '#334155',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                  borderBottom: '1px solid #f1f5f9',
                                  transition: 'background 0.12s ease',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
                              >
                                <i className="fa-solid fa-tag" style={{ color: '#10b981', fontSize: '0.8rem' }}></i>
                                <span>{cat.name}</span>
                                {cat.alternativeName && <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginLeft: 'auto' }}>({cat.alternativeName})</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* SECTION 2: LISTING NAME AUTO-SUGGEST */}
                    <div style={{ position: 'relative' }}>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                        3. Business Name (Type to search & pick from matching listings) *
                      </label>

                      {/* If a listing is selected, display high-end Selected Card */}
                      {claimSelectedListing ? (
                        <div
                          style={{
                            background: '#f0fdf4',
                            border: '1.5px solid #86efac',
                            borderRadius: '12px',
                            padding: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '1rem',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
                            <div
                              style={{
                                width: 52,
                                height: 52,
                                borderRadius: '10px',
                                background: '#e2e8f0',
                                overflow: 'hidden',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              {claimSelectedListing.image ? (
                                <img
                                  src={claimSelectedListing.image}
                                  alt={claimSelectedListing.name}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                              ) : (
                                <i className="fa-solid fa-store" style={{ color: '#94a3b8', fontSize: '1.4rem' }}></i>
                              )}
                            </div>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: 2 }}>
                                <span style={{ background: '#16a34a', color: '#fff', fontSize: '0.68rem', fontWeight: 800, padding: '0.15rem 0.5rem', borderRadius: '6px' }}>
                                  <i className="fa-solid fa-check" style={{ marginRight: 3 }}></i> Selected
                                </span>
                                <span style={{ fontSize: '0.74rem', color: '#64748b' }}>ID: {claimSelectedListing.id}</span>
                              </div>
                              <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '1.02rem' }}>
                                {claimSelectedListing.name}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 4, flexWrap: 'wrap', fontSize: '0.78rem', color: '#475569' }}>
                                <span><i className="fa-solid fa-tag" style={{ color: '#16a34a', marginRight: 3 }}></i>{claimSelectedListing.category || 'General'}</span>
                                <span>•</span>
                                <span><i className="fa-solid fa-location-dot" style={{ color: '#2563eb', marginRight: 3 }}></i>{claimSelectedListing.city || 'Local'}</span>
                                {claimSelectedListing.address && (
                                  <>
                                    <span>•</span>
                                    <span style={{ color: '#64748b' }}>{claimSelectedListing.address.slice(0, 35)}...</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setClaimSelectedListing(null);
                              setClaimListingQuery('');
                            }}
                            style={{
                              background: '#fff',
                              border: '1px solid #cbd5e1',
                              color: '#ef4444',
                              fontWeight: 700,
                              fontSize: '0.8rem',
                              padding: '0.45rem 0.85rem',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              flexShrink: 0,
                            }}
                          >
                            <i className="fa-solid fa-arrow-rotate-left"></i>
                            Change
                          </button>
                        </div>
                      ) : (
                        <div style={{ position: 'relative' }}>
                          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <i className="fa-solid fa-store" style={{ position: 'absolute', left: '12px', color: '#64748b', fontSize: '0.9rem', pointerEvents: 'none' }}></i>
                            <input
                              type="text"
                              placeholder={
                                claimCityInput || claimCategoryInput
                                  ? `Search listings in ${claimCityInput || 'all cities'}${claimCategoryInput ? ` (${claimCategoryInput})` : ''}...`
                                  : 'Type business name to search...'
                              }
                              value={claimListingQuery}
                              onChange={(e) => {
                                setClaimListingQuery(e.target.value);
                                setClaimListingDropdownOpen(true);
                              }}
                              onFocus={() => setClaimListingDropdownOpen(true)}
                              style={{
                                width: '100%',
                                padding: '0.72rem 2.2rem 0.72rem 2.2rem',
                                borderRadius: '10px',
                                border: '1.5px solid #cbd5e1',
                                fontSize: '0.9rem',
                                fontWeight: 600,
                                color: '#0f172a',
                                boxSizing: 'border-box',
                                background: '#fff',
                              }}
                            />
                            {claimListingQuery && (
                              <button
                                type="button"
                                onClick={() => {
                                  setClaimListingQuery('');
                                  setClaimListingDropdownOpen(false);
                                }}
                                style={{ position: 'absolute', right: '10px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', fontSize: '0.85rem' }}
                              >
                                <i className="fa-solid fa-xmark"></i>
                              </button>
                            )}
                          </div>

                          {/* Filter helper note */}
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <i className="fa-solid fa-circle-info" style={{ color: '#3b82f6' }}></i>
                            <span>
                              {claimCityInput ? `Filtered by City: ${claimCityInput}` : 'All Cities'}
                              {' • '}
                              {claimCategoryInput ? `Category: ${claimCategoryInput}` : 'All Categories'}
                              {` (${claimFilteredListings.length} matching)`}
                            </span>
                          </div>

                          {/* Listing Suggestions Dropdown */}
                          {claimListingDropdownOpen && (
                            <div
                              style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                right: 0,
                                marginTop: 4,
                                background: '#fff',
                                borderRadius: '12px',
                                boxShadow: '0 12px 30px rgba(0,0,0,0.14)',
                                border: '1px solid #e2e8f0',
                                maxHeight: '280px',
                                overflowY: 'auto',
                                zIndex: 120,
                              }}
                            >
                              {claimFilteredListings.length === 0 ? (
                                <div style={{ padding: '1.25rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                                  <i className="fa-solid fa-store-slash" style={{ fontSize: '1.5rem', marginBottom: 6, display: 'block' }}></i>
                                  No listings found matching your search.
                                </div>
                              ) : (
                                claimFilteredListings.map((biz) => (
                                  <div
                                    key={biz.id}
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      setClaimSelectedListing(biz);
                                      setClaimListingQuery(biz.name);
                                      if (!claimCityInput && biz.city) setClaimCityInput(biz.city);
                                      if (!claimCategoryInput && biz.category) setClaimCategoryInput(biz.category);
                                      setClaimListingDropdownOpen(false);
                                    }}
                                    style={{
                                      padding: '0.75rem 1rem',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.75rem',
                                      borderBottom: '1px solid #f1f5f9',
                                      transition: 'background 0.12s ease',
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
                                  >
                                    <div
                                      style={{
                                        width: 42,
                                        height: 42,
                                        borderRadius: '8px',
                                        background: '#f1f5f9',
                                        overflow: 'hidden',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                      }}
                                    >
                                      {biz.image ? (
                                        <img src={biz.image} alt={biz.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                      ) : (
                                        <i className="fa-solid fa-store" style={{ color: '#cbd5e1', fontSize: '1rem' }}></i>
                                      )}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {biz.name}
                                      </div>
                                      <div style={{ fontSize: '0.76rem', color: '#64748b', display: 'flex', gap: '0.5rem', marginTop: 2 }}>
                                        <span style={{ color: '#16a34a', fontWeight: 600 }}>{biz.category || 'Shop'}</span>
                                        <span>•</span>
                                        <span>{biz.city || 'Local'}</span>
                                        {biz.address && (
                                          <>
                                            <span>•</span>
                                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{biz.address}</span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                    <span style={{ color: '#2563eb', fontSize: '0.8rem', fontWeight: 700 }}>
                                      Select <i className="fa-solid fa-chevron-right" style={{ fontSize: '0.7rem' }}></i>
                                    </span>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* SECTION 3: APPLICANT IDENTITY DETAILS */}
                    <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontWeight: 800, color: '#334155', fontSize: '0.85rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <i className="fa-solid fa-user-shield" style={{ color: '#2563eb' }}></i>
                        Applicant / Owner Contact Details
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '0.25rem' }}>Full Legal Name *</label>
                          <input
                            type="text"
                            required
                            placeholder="Your full name"
                            value={claimApplicantName}
                            onChange={(e) => setClaimApplicantName(e.target.value)}
                            style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '0.25rem' }}>Registered Mobile Number *</label>
                          <input
                            type="tel"
                            required
                            placeholder="Mobile number"
                            value={claimApplicantPhone}
                            onChange={(e) => setClaimApplicantPhone(e.target.value)}
                            style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '0.25rem' }}>Official Email Address</label>
                          <input
                            type="email"
                            placeholder="Official email address"
                            value={claimApplicantEmail}
                            onChange={(e) => setClaimApplicantEmail(e.target.value)}
                            style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box' }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* SECTION 4: REMARKS / DESCRIPTION */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                        4. Ownership Statement / Remarks *
                      </label>
                      <textarea
                        required
                        rows={3}
                        placeholder="State your role (Proprietor, Managing Partner, Store Manager), business registration number (if any), and any details to verify your claim..."
                        value={claimRemarks}
                        onChange={(e) => setClaimRemarks(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          borderRadius: '10px',
                          border: '1.5px solid #cbd5e1',
                          fontSize: '0.88rem',
                          fontFamily: 'inherit',
                          color: '#0f172a',
                          boxSizing: 'border-box',
                          resize: 'vertical',
                          minHeight: '80px',
                        }}
                      ></textarea>
                    </div>

                    {/* SECTION 5: PROOF DOCUMENTS UPLOAD (MAX 5 FILES) */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
                          5. Verification Documents / Proof (Max 5 files) *
                        </label>
                        <span style={{ fontSize: '0.76rem', fontWeight: 700, color: claimFiles.length >= 5 ? '#ef4444' : '#64748b' }}>
                          {claimFiles.length} of 5 files uploaded
                        </span>
                      </div>

                      {/* Supported Formats Pills */}
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
                        <span style={{ fontSize: '0.7rem', background: '#fef3c7', color: '#b45309', padding: '0.15rem 0.5rem', borderRadius: '6px', fontWeight: 700 }}>JPG</span>
                        <span style={{ fontSize: '0.7rem', background: '#fef3c7', color: '#b45309', padding: '0.15rem 0.5rem', borderRadius: '6px', fontWeight: 700 }}>PNG</span>
                        <span style={{ fontSize: '0.7rem', background: '#fee2e2', color: '#b91c1c', padding: '0.15rem 0.5rem', borderRadius: '6px', fontWeight: 700 }}>PDF</span>
                        <span style={{ fontSize: '0.7rem', background: '#dbeafe', color: '#1d4ed8', padding: '0.15rem 0.5rem', borderRadius: '6px', fontWeight: 700 }}>WORD (.doc, .docx)</span>
                        <span style={{ fontSize: '0.7rem', background: '#dcfce7', color: '#15803d', padding: '0.15rem 0.5rem', borderRadius: '6px', fontWeight: 700 }}>EXCEL (.xls, .xlsx)</span>
                        <span style={{ fontSize: '0.7rem', color: '#16a34a', marginLeft: 'auto', fontWeight: 600 }}>
                          <i className="fa-solid fa-compress" style={{ marginRight: 3 }}></i> Auto-compressed & optimized
                        </span>
                      </div>

                      {/* Dropzone Area */}
                      {claimFiles.length < 5 && (
                        <div
                          onClick={() => claimFileInputRef.current?.click()}
                          style={{
                            border: '2px dashed #94a3b8',
                            borderRadius: '12px',
                            padding: '1.25rem',
                            textAlign: 'center',
                            cursor: 'pointer',
                            background: '#f8fafc',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <input
                            ref={claimFileInputRef}
                            type="file"
                            multiple
                            accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/*"
                            onChange={handleClaimFileUpload}
                            style={{ display: 'none' }}
                          />
                          <i className="fa-solid fa-cloud-arrow-up" style={{ fontSize: '1.8rem', color: '#3b82f6', marginBottom: '0.4rem', display: 'block' }}></i>
                          <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#1e293b' }}>
                            {claimUploading ? 'Processing & optimizing files...' : 'Click or tap to upload ownership proof'}
                          </div>
                          <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: 2 }}>
                            Attach Trade License, Electricity Bill, Business Card, or Shop Front Photo
                          </div>
                        </div>
                      )}

                      {/* Uploaded File Cards */}
                      {claimFiles.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
                          {claimFiles.map((file, idx) => {
                            const docInfo = getClaimDocIcon(file.type);
                            return (
                              <div
                                key={idx}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '0.65rem 0.9rem',
                                  background: '#fff',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '10px',
                                  gap: '0.75rem',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
                                  <div
                                    style={{
                                      width: 34,
                                      height: 34,
                                      borderRadius: '8px',
                                      background: '#f1f5f9',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      flexShrink: 0,
                                      color: docInfo.color,
                                    }}
                                  >
                                    <i className={`fa-solid ${docInfo.icon}`} style={{ fontSize: '1.1rem' }}></i>
                                  </div>
                                  <div style={{ minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.84rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {file.name}
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                      {file.size || 'Attached'} • {docInfo.label}
                                    </div>
                                  </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0 }}>
                                  {file.url && (
                                    <a
                                      href={file.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{
                                        background: '#f1f5f9',
                                        color: '#2563eb',
                                        border: 'none',
                                        padding: '0.35rem 0.65rem',
                                        borderRadius: '6px',
                                        fontSize: '0.74rem',
                                        fontWeight: 700,
                                        textDecoration: 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.3rem',
                                      }}
                                    >
                                      <i className="fa-solid fa-arrow-up-right-from-square"></i> View
                                    </a>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => removeClaimFile(idx)}
                                    title="Remove document"
                                    style={{
                                      background: '#fef2f2',
                                      color: '#ef4444',
                                      border: 'none',
                                      width: 28,
                                      height: 28,
                                      borderRadius: '6px',
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
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* SUBMIT BUTTON */}
                    <button
                      type="submit"
                      disabled={claimSubmitting || claimUploading}
                      style={{
                        background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                        color: '#fff',
                        border: 'none',
                        padding: '0.85rem 1.5rem',
                        borderRadius: '12px',
                        fontWeight: 800,
                        fontSize: '0.96rem',
                        cursor: claimSubmitting || claimUploading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.6rem',
                        boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)',
                        marginTop: '0.5rem',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <i className={`fa-solid ${claimSubmitting ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`}></i>
                      {claimSubmitting ? 'Submitting Claim to Admin...' : 'Submit Claim Request'}
                    </button>
                  </form>
                </div>
              )}

              {/* TAB 2: MY SUBMITTED CLAIMS */}
              {claimTab === 'myClaims' && (
                <div>
                  {userClaims.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3.5rem 1.5rem', background: '#f8fafc', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
                      <i className="fa-solid fa-file-circle-question" style={{ fontSize: '2.8rem', color: '#94a3b8', marginBottom: '0.85rem', display: 'block' }}></i>
                      <h4 style={{ fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem' }}>No Claim Requests Yet</h4>
                      <p style={{ color: '#64748b', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
                        You haven&apos;t submitted any business claim requests yet. Switch to the Claim Form tab to claim your business.
                      </p>
                      <button
                        type="button"
                        onClick={() => setClaimTab('form')}
                        style={{
                          background: '#2563eb',
                          color: '#fff',
                          border: 'none',
                          padding: '0.65rem 1.25rem',
                          borderRadius: '10px',
                          fontWeight: 700,
                          fontSize: '0.86rem',
                          cursor: 'pointer',
                        }}
                      >
                        <i className="fa-solid fa-pen-to-square" style={{ marginRight: 6 }}></i>
                        Claim a Business Now
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {userClaims.map((claim) => {
                        const statusLower = (claim.status || '').toLowerCase();
                        const isApproved = statusLower === 'approved';
                        const isRejected = statusLower === 'rejected';
                        const isPending = !isApproved && !isRejected;

                        return (
                          <div
                            key={claim.id}
                            style={{
                              background: '#fff',
                              border: isApproved ? '1.5px solid #86efac' : isRejected ? '1.5px solid #fca5a5' : '1px solid #e2e8f0',
                              borderRadius: '14px',
                              padding: '1.25rem',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                            }}
                          >
                            {/* Card Top: Title & Status Badge */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.8rem', marginBottom: '0.75rem' }}>
                              <div>
                                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '1.1rem' }}>
                                  {claim.listingName}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: 3, flexWrap: 'wrap', fontSize: '0.78rem', color: '#64748b' }}>
                                  {claim.category && <span><i className="fa-solid fa-tag" style={{ color: '#16a34a', marginRight: 3 }}></i>{claim.category}</span>}
                                  {claim.city && (
                                    <>
                                      <span>•</span>
                                      <span><i className="fa-solid fa-location-dot" style={{ color: '#2563eb', marginRight: 3 }}></i>{claim.city}</span>
                                    </>
                                  )}
                                  <span>•</span>
                                  <span>Submitted: {claim.date || 'Recent'}</span>
                                  <span>•</span>
                                  <span style={{ color: '#94a3b8' }}>ID: {claim.id}</span>
                                </div>
                              </div>

                              {/* Status Badge */}
                              <span
                                style={{
                                  padding: '0.3rem 0.75rem',
                                  borderRadius: '999px',
                                  fontSize: '0.76rem',
                                  fontWeight: 800,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  background: isApproved ? '#ecfdf5' : isRejected ? '#fef2f2' : '#fef3c7',
                                  color: isApproved ? '#047857' : isRejected ? '#b91c1c' : '#b45309',
                                  border: isApproved ? '1px solid #a7f3d0' : isRejected ? '1px solid #fecdd3' : '1px solid #fde68a',
                                  flexShrink: 0,
                                }}
                              >
                                <i className={`fa-solid ${isApproved ? 'fa-circle-check' : isRejected ? 'fa-circle-xmark' : 'fa-clock'}`}></i>
                                {isApproved ? 'Approved' : isRejected ? 'Rejected' : 'Under Review'}
                              </span>
                            </div>

                            {/* Remarks */}
                            {claim.remarks && (
                              <div style={{ background: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: '8px', fontSize: '0.82rem', color: '#334155', fontStyle: 'italic', marginBottom: '0.75rem' }}>
                                &ldquo;{claim.remarks}&rdquo;
                              </div>
                            )}

                            {/* Uploaded Documents List */}
                            {claim.documents && claim.documents.length > 0 && (
                              <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                                {claim.documents.map((doc, dIdx) => {
                                  const docObj: ClaimDocument = typeof doc === 'string' ? { name: `Document ${dIdx + 1}`, url: doc, type: 'file' } : doc;
                                  const dIcon = getClaimDocIcon(docObj.type);
                                  return (
                                    <a
                                      key={dIdx}
                                      href={docObj.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{
                                        fontSize: '0.74rem',
                                        padding: '0.25rem 0.6rem',
                                        background: '#f1f5f9',
                                        borderRadius: '6px',
                                        color: '#334155',
                                        textDecoration: 'none',
                                        fontWeight: 600,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.3rem',
                                      }}
                                    >
                                      <i className={`fa-solid ${dIcon.icon}`} style={{ color: dIcon.color }}></i>
                                      <span>{docObj.name}</span>
                                    </a>
                                  );
                                })}
                              </div>
                            )}

                            {/* If Approved Banner */}
                            {isApproved && (
                              <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '10px', padding: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.8rem', marginTop: '0.5rem' }}>
                                <div style={{ fontSize: '0.83rem', color: '#065f46' }}>
                                  <strong>Ownership Granted!</strong> This business is now linked to your account. You can manage photos, products, and details in your Business Portal.
                                </div>
                                <button
                                  type="button"
                                  onClick={() => goToScreen('viewManageListings')}
                                  style={{
                                    background: '#059669',
                                    color: '#fff',
                                    border: 'none',
                                    padding: '0.45rem 0.9rem',
                                    borderRadius: '8px',
                                    fontWeight: 700,
                                    fontSize: '0.78rem',
                                    cursor: 'pointer',
                                    flexShrink: 0,
                                  }}
                                >
                                  Manage Shop
                                </button>
                              </div>
                            )}

                            {/* If Rejected with Admin Feedback */}
                            {isRejected && (
                              <div style={{ background: '#fef2f2', border: '1px solid #fecdd3', borderRadius: '10px', padding: '0.85rem', marginTop: '0.5rem' }}>
                                <div style={{ fontWeight: 800, color: '#991b1b', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: 3 }}>
                                  <i className="fa-solid fa-triangle-exclamation"></i>
                                  Admin Rejection Reason:
                                </div>
                                <div style={{ color: '#7f1d1d', fontSize: '0.84rem', lineHeight: 1.4 }}>
                                  {claim.adminReply || 'Uploaded documentation was insufficient or could not verify legal ownership.'}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setClaimTab('form')}
                                  style={{
                                    background: '#fff',
                                    border: '1px solid #f87171',
                                    color: '#b91c1c',
                                    padding: '0.35rem 0.75rem',
                                    borderRadius: '6px',
                                    fontSize: '0.76rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    marginTop: '0.5rem',
                                  }}
                                >
                                  Submit New Claim with Updated Proof
                                </button>
                              </div>
                            )}

                            {/* General Admin Reply if Present */}
                            {claim.adminReply && !isRejected && (
                              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '0.75rem', marginTop: '0.5rem', fontSize: '0.82rem', color: '#1e40af' }}>
                                <strong>Admin Note:</strong> {claim.adminReply}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= SCREEN 7: TRUST BADGE ================= */}
        {activeScreen === 'viewTrustBadge' && (
          <div className="account-view-screen active" id="viewTrustBadge">
            <div className="account-sub-top-bar">
              <button
                type="button"
                className="account-sub-back-btn"
                onClick={() => {
                  if (trustViewMode === 'form') {
                    setTrustViewMode('listings');
                    setSelectedTrustListing(null);
                  } else if (trustViewMode === 'listings') {
                    setTrustViewMode('hero');
                  } else {
                    handleAppBack('viewMainMenu');
                  }
                }}
                title="Back"
              >
                <i className="fa-solid fa-arrow-left"></i>
              </button>
              <div className="account-sub-title-wrap">
                <h2 className="account-sub-title">
                  {trustViewMode === 'form'
                    ? 'Apply for Gold Badge'
                    : trustViewMode === 'listings'
                    ? (trustTab === 'apply' ? 'Select Business' : 'Trust Applications')
                    : 'Gold Trust Badge'}
                </h2>
                <span className="account-sub-desc">
                  {trustViewMode === 'form'
                    ? (selectedTrustListing ? selectedTrustListing.name : 'Document Verification & UPI Payment')
                    : trustViewMode === 'listings'
                    ? (trustTab === 'apply' ? 'Choose business to verify' : 'Track verification review status')
                    : 'Official Verification & Verified Badge'}
                </span>
              </div>
            </div>

            <div className="sub-screen-content" style={{ padding: '1.25rem', maxWidth: '740px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
              {/* ================= VIEW 1: HERO / LANDING VIEW ================= */}
              {trustViewMode === 'hero' && (
                <div>
                  {allListingsVerified ? (
                    /* All Verified Merchant Showcase */
                    <div
                      style={{
                        background: 'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 40%, #fefce8 100%)',
                        border: '2px solid #86efac',
                        borderRadius: '20px',
                        padding: '2rem 1.5rem',
                        textAlign: 'center',
                        boxShadow: '0 8px 24px rgba(16, 185, 129, 0.12)',
                      }}
                    >
                      <div
                        style={{
                          width: 80,
                          height: 80,
                          borderRadius: '50%',
                          background: '#ffffff',
                          margin: '0 auto 1rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 8px 20px rgba(217, 119, 6, 0.25)',
                          border: '3px solid #fcd34d',
                        }}
                      >
                        <i className="fa-solid fa-shield-halved" style={{ fontSize: '2.5rem', color: '#d97706' }}></i>
                      </div>

                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#dcfce7', color: '#15803d', padding: '0.35rem 0.85rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 800, marginBottom: '0.65rem' }}>
                        <i className="fa-solid fa-circle-check"></i> ALL STORES VERIFIED
                      </div>

                      <h3 style={{ margin: '0 0 0.4rem 0', color: '#064e3b', fontWeight: 900, fontSize: '1.45rem' }}>
                        Official Verified Merchant 👑
                      </h3>
                      <p style={{ margin: '0 auto 1.5rem', color: '#047857', fontSize: '0.9rem', maxWidth: '520px', lineHeight: 1.5 }}>
                        Congratulations! All of your registered businesses are active with the official <strong>Gold Trust Badge</strong>, verified store checkmark, and priority top rank visibility.
                      </p>

                      {/* Verified Stores List */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '560px', margin: '0 auto 1.5rem', textAlign: 'left' }}>
                        {myListings.map((biz) => {
                          const daysLeft = getTrustBadgeDaysRemaining(biz);
                          return (
                            <div
                              key={biz.id}
                              style={{
                                background: '#ffffff',
                                border: '1.5px solid #86efac',
                                borderRadius: '12px',
                                padding: '0.85rem 1rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '0.75rem',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
                                <div style={{ width: 40, height: 40, borderRadius: '8px', background: '#f1f5f9', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid #e2e8f0' }}>
                                  {biz.image ? <img src={biz.image} alt={biz.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <i className="fa-solid fa-store" style={{ color: '#94a3b8' }}></i>}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.94rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {biz.name}
                                  </div>
                                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                    {biz.category || 'Business'} • {biz.city || 'Local'}
                                  </div>
                                </div>
                              </div>

                              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <span style={{ background: '#ecfdf5', color: '#059669', padding: '0.2rem 0.55rem', borderRadius: '6px', fontSize: '0.76rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                                  <i className="fa-solid fa-shield-halved" style={{ color: '#d97706' }}></i> Verified 👑
                                </span>
                                <div style={{ fontSize: '0.72rem', color: '#b45309', fontWeight: 700, marginTop: 2 }}>
                                  {daysLeft} days remaining
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setTrustViewMode('listings');
                            setTrustTab('myRequests');
                          }}
                          style={{
                            background: '#ffffff',
                            color: '#065f46',
                            border: '1.5px solid #86efac',
                            padding: '0.65rem 1.25rem',
                            borderRadius: '10px',
                            fontWeight: 800,
                            fontSize: '0.86rem',
                            cursor: 'pointer',
                          }}
                        >
                          <i className="fa-solid fa-list-check" style={{ marginRight: 6 }}></i> View Applications
                        </button>
                        <button
                          type="button"
                          onClick={() => goToScreen('viewManageListings')}
                          style={{
                            background: '#059669',
                            color: '#ffffff',
                            border: 'none',
                            padding: '0.65rem 1.25rem',
                            borderRadius: '10px',
                            fontWeight: 800,
                            fontSize: '0.86rem',
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(5,150,105,0.3)',
                          }}
                        >
                          <i className="fa-solid fa-shop" style={{ marginRight: 6 }}></i> Manage Businesses
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ONLY HERO SHOWCASE CARD + GREEN 'GET NOW' BUTTON */
                    <div>
                      <div
                        style={{
                          background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 50%, #fde68a 100%)',
                          border: '1.5px solid #fcd34d',
                          borderRadius: '20px',
                          padding: '1.75rem 1.5rem',
                          textAlign: 'center',
                          boxShadow: '0 8px 24px rgba(217, 119, 6, 0.14)',
                        }}
                      >
                        <div
                          style={{
                            width: 68,
                            height: 68,
                            borderRadius: '50%',
                            background: '#ffffff',
                            margin: '0 auto 0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 4px 15px rgba(217, 119, 6, 0.25)',
                          }}
                        >
                          <i className="fa-solid fa-shield-halved" style={{ fontSize: '2.1rem', color: '#d97706' }}></i>
                        </div>

                        <h3 style={{ margin: '0 0 0.25rem 0', color: '#78350f', fontWeight: 900, fontSize: '1.45rem' }}>
                          Gold Verified Trust Badge
                        </h3>

                        {/* Strikethrough + Final Price Display */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.65rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              textDecoration: 'line-through',
                              color: '#94a3b8',
                              fontSize: '1.35rem',
                              fontWeight: 700,
                            }}
                          >
                            ₹{trustBadgeSettings.originalPrice || 999}
                          </span>
                          <span
                            style={{
                              fontSize: '2.1rem',
                              fontWeight: 900,
                              color: '#92400e',
                              letterSpacing: '-0.5px',
                            }}
                          >
                            ₹{trustBadgeSettings.offerPrice || 299}
                          </span>
                          <span style={{ fontSize: '0.9rem', color: '#b45309', fontWeight: 800 }}>
                            / {trustBadgeSettings.period || 'Year'}
                          </span>
                          <span
                            style={{
                              background: '#16a34a',
                              color: '#fff',
                              fontSize: '0.74rem',
                              padding: '0.25rem 0.7rem',
                              borderRadius: '999px',
                              fontWeight: 800,
                              boxShadow: '0 2px 4px rgba(22, 163, 74, 0.25)',
                            }}
                          >
                            SAVE {Math.max(1, Math.round((1 - (trustBadgeSettings.offerPrice || 299) / (trustBadgeSettings.originalPrice || 999)) * 100))}% OFF
                          </span>
                        </div>

                        <p style={{ margin: '0.85rem auto 1.35rem', color: '#78350f', fontSize: '0.88rem', maxWidth: '520px', lineHeight: 1.5 }}>
                          Build 100% confidence with local shoppers. Get the prestigious Gold Shield badge next to your store name and appear at the top of local search results.
                        </p>

                        {/* 4 Benefits Pills */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.75rem', textAlign: 'left' }}>
                          <div style={{ background: 'rgba(255,255,255,0.75)', padding: '0.65rem 0.85rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: '#78350f', fontWeight: 700 }}>
                            <i className="fa-solid fa-certificate" style={{ color: '#d97706' }}></i>
                            Official Verified Gold Checkmark
                          </div>
                          <div style={{ background: 'rgba(255,255,255,0.75)', padding: '0.65rem 0.85rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: '#78350f', fontWeight: 700 }}>
                            <i className="fa-solid fa-arrow-trend-up" style={{ color: '#16a34a' }}></i>
                            Priority Top Ranking in City & Category
                          </div>
                          <div style={{ background: 'rgba(255,255,255,0.75)', padding: '0.65rem 0.85rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: '#78350f', fontWeight: 700 }}>
                            <i className="fa-solid fa-phone-volume" style={{ color: '#2563eb' }}></i>
                            3x More Direct Customer Inquiries & Calls
                          </div>
                          <div style={{ background: 'rgba(255,255,255,0.75)', padding: '0.65rem 0.85rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: '#78350f', fontWeight: 700 }}>
                            <i className="fa-solid fa-shield-check" style={{ color: '#d97706' }}></i>
                            Digital Verification Trust Certificate
                          </div>
                        </div>
                      </div>

                      {/* GREEN COLOR BUTTON: GET NOW */}
                      <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setTrustViewMode('listings');
                            setTrustTab('apply');
                            if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          style={{
                            width: '100%',
                            maxWidth: '380px',
                            padding: '1rem 2rem',
                            background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '14px',
                            fontSize: '1.15rem',
                            fontWeight: 900,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.65rem',
                            boxShadow: '0 8px 24px rgba(22, 163, 74, 0.35)',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <span>Get Now</span>
                          <i className="fa-solid fa-arrow-right"></i>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ================= VIEW 2: LISTINGS LIST & APPLICATIONS ================= */}
              {trustViewMode === 'listings' && (
                <div>
                  {/* Sub-tabs: Badge Benefits & Apply vs My Applications */}
                  <div style={{ display: 'flex', gap: '0.5rem', background: '#f1f5f9', padding: '0.35rem', borderRadius: '12px', marginBottom: '1.25rem' }}>
                    <button
                      type="button"
                      onClick={() => setTrustTab('apply')}
                      style={{
                        flex: 1,
                        padding: '0.65rem 1rem',
                        border: 'none',
                        borderRadius: '9px',
                        fontWeight: 700,
                        fontSize: '0.88rem',
                        cursor: 'pointer',
                        background: trustTab === 'apply' ? '#ffffff' : 'transparent',
                        color: trustTab === 'apply' ? '#b45309' : '#64748b',
                        boxShadow: trustTab === 'apply' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.45rem',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <i className="fa-solid fa-shield-halved" style={{ color: trustTab === 'apply' ? '#d97706' : '#94a3b8' }}></i>
                      Badge Benefits & Apply
                    </button>
                    <button
                      type="button"
                      onClick={() => setTrustTab('myRequests')}
                      style={{
                        flex: 1,
                        padding: '0.65rem 1rem',
                        border: 'none',
                        borderRadius: '9px',
                        fontWeight: 700,
                        fontSize: '0.88rem',
                        cursor: 'pointer',
                        background: trustTab === 'myRequests' ? '#ffffff' : 'transparent',
                        color: trustTab === 'myRequests' ? '#0f172a' : '#64748b',
                        boxShadow: trustTab === 'myRequests' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.45rem',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <i className="fa-solid fa-list-check" style={{ color: trustTab === 'myRequests' ? '#16a34a' : '#94a3b8' }}></i>
                      My Applications
                      {userTrustRequests.length > 0 && (
                        <span style={{ background: '#d97706', color: '#fff', fontSize: '0.72rem', padding: '0.1rem 0.5rem', borderRadius: '999px', fontWeight: 800 }}>
                          {userTrustRequests.length}
                        </span>
                      )}
                    </button>
                  </div>

                  {/* TAB 1: BADGE BENEFITS & APPLY (SHOWS ALL USER LISTINGS) */}
                      {trustTab === 'apply' && (
                        <div>
                          {/* Compact Benefits Reminder Banner */}
                          <div
                            style={{
                              background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                              border: '1px solid #fde68a',
                              borderRadius: '14px',
                              padding: '1rem 1.25rem',
                              marginBottom: '1.25rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: '0.75rem',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(217,119,6,0.2)', flexShrink: 0 }}>
                                <i className="fa-solid fa-shield-halved" style={{ color: '#d97706', fontSize: '1.3rem' }}></i>
                              </div>
                              <div>
                                <div style={{ fontWeight: 800, color: '#78350f', fontSize: '0.98rem' }}>
                                  Select a store to apply for Gold Verified Badge
                                </div>
                                <div style={{ fontSize: '0.78rem', color: '#92400e' }}>
                                  Official gold shield, top ranking in search & 3x more customer inquiries
                                </div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ textDecoration: 'line-through', color: '#94a3b8', fontSize: '0.92rem', fontWeight: 700 }}>
                                ₹{trustBadgeSettings.originalPrice || 999}
                              </span>
                              <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#92400e' }}>
                                ₹{trustBadgeSettings.offerPrice || 299}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: '#b45309', fontWeight: 700 }}>
                                /{trustBadgeSettings.period || 'Year'}
                              </span>
                            </div>
                          </div>

                          {/* Store Listings Header */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                            <div>
                              <h4 style={{ margin: 0, fontWeight: 800, color: '#0f172a', fontSize: '1rem' }}>
                                Your Business Stores ({myListings.length})
                              </h4>
                              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                                Click any unverified store to open the verification form
                              </span>
                            </div>
                            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, background: '#f1f5f9', padding: '0.25rem 0.65rem', borderRadius: '8px' }}>
                              {myListings.filter((l) => isTrustBadgeActive(l)).length}/{myListings.length} Verified
                            </span>
                          </div>

                          {myListings.length === 0 ? (
                            <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center', background: '#f8fafc', borderRadius: '14px', border: '1px dashed #cbd5e1' }}>
                              <i className="fa-solid fa-store" style={{ fontSize: '2.2rem', color: '#94a3b8', marginBottom: '0.65rem', display: 'block' }}></i>
                              <div style={{ fontWeight: 800, color: '#334155', fontSize: '0.96rem' }}>No Businesses Registered Yet</div>
                              <p style={{ color: '#64748b', fontSize: '0.84rem', margin: '0.35rem auto 1.25rem', maxWidth: '400px' }}>
                                Please add your shop or business first before applying for a Gold Trust Badge.
                              </p>
                              <button
                                type="button"
                                onClick={() => goToScreen('viewAddListing')}
                                style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0.65rem 1.25rem', borderRadius: '10px', fontWeight: 700, fontSize: '0.86rem', cursor: 'pointer', boxShadow: '0 2px 8px rgba(37,99,235,0.25)' }}
                              >
                                <i className="fa-solid fa-plus" style={{ marginRight: 6 }}></i> Add Business Listing
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.95rem' }}>
                              {myListings.map((biz) => {
                                const isVerified = isTrustBadgeActive(biz);
                                const daysLeft = isVerified ? getTrustBadgeDaysRemaining(biz) : 0;
                                const pendingReq = userTrustRequests.find(
                                  (r) => String(r.listingId) === String(biz.id) && (r.status || '').toLowerCase() === 'pending'
                                );

                                return (
                                  <div
                                    key={biz.id}
                                    onClick={() => {
                                      // User strictly specified: if already verified, clicking CANNOT do anything ("tata click korlou khulba na")
                                      if (isVerified) {
                                        return;
                                      }
                                      if (pendingReq) {
                                        showAlert('Under Review', `Verification for "${biz.name}" is already pending admin review.`, 'warning');
                                        return;
                                      }
                                      // Opens dedicated form page
                                      handleSelectListingForTrust(biz);
                                    }}
                                    style={{
                                      padding: '1.1rem',
                                      borderRadius: '16px',
                                      background: isVerified ? '#f0fdf4' : pendingReq ? '#fffbeb' : '#ffffff',
                                      border: isVerified
                                        ? '2px solid #86efac'
                                        : pendingReq
                                        ? '1.5px solid #fde68a'
                                        : '1.5px solid #e2e8f0',
                                      cursor: isVerified ? 'default' : 'pointer',
                                      pointerEvents: isVerified ? 'none' : 'auto',
                                      transition: 'all 0.15s ease',
                                      boxShadow: isVerified
                                        ? '0 2px 8px rgba(22, 163, 74, 0.08)'
                                        : '0 2px 8px rgba(0,0,0,0.04)',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      justifyContent: 'space-between',
                                    }}
                                  >
                                    <div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '0.75rem' }}>
                                        <div
                                          style={{
                                            width: 52,
                                            height: 52,
                                            borderRadius: '12px',
                                            background: '#f1f5f9',
                                            overflow: 'hidden',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0,
                                            border: isVerified ? '2px solid #86efac' : '1px solid #e2e8f0',
                                          }}
                                        >
                                          {biz.image ? (
                                            <img src={biz.image} alt={biz.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                          ) : (
                                            <i className="fa-solid fa-store" style={{ color: '#94a3b8', fontSize: '1.35rem' }}></i>
                                          )}
                                        </div>
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.98rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                              {biz.name}
                                            </div>
                                            {isVerified && (
                                              <i className="fa-solid fa-circle-check" style={{ color: '#16a34a', fontSize: '0.95rem' }} title="Verified"></i>
                                            )}
                                          </div>
                                          <div style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', gap: '0.35rem', marginTop: 2 }}>
                                            <span>{biz.category || 'Business'}</span>
                                            <span>•</span>
                                            <span>{biz.city || 'Local'}</span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    <div style={{ marginTop: '0.65rem', paddingTop: '0.65rem', borderTop: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                      {isVerified ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                          <span style={{ fontSize: '0.82rem', fontWeight: 900, color: '#15803d', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: '#dcfce7', padding: '0.25rem 0.65rem', borderRadius: '999px' }}>
                                            <i className="fa-solid fa-shield-halved" style={{ color: '#d97706' }}></i> Verified 👑
                                          </span>
                                          <span style={{ fontSize: '0.76rem', color: '#166534', fontWeight: 800 }}>
                                            ({daysLeft} days remaining)
                                          </span>
                                        </div>
                                      ) : pendingReq ? (
                                        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#b45309', display: 'flex', alignItems: 'center', gap: '0.35rem', background: '#fef3c7', padding: '0.25rem 0.65rem', borderRadius: '999px' }}>
                                          <i className="fa-solid fa-clock"></i> Verification in Review ⏳
                                        </span>
                                      ) : (
                                        <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#b45309', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                          Apply for Badge ➔
                                        </span>
                                      )}

                                      {!isVerified && !pendingReq && (
                                        <span style={{ fontSize: '0.84rem', fontWeight: 900, color: '#16a34a', background: '#ecfdf5', padding: '0.2rem 0.6rem', borderRadius: '8px' }}>
                                          ₹{trustBadgeSettings.offerPrice || 299}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* TAB 2: MY TRUST APPLICATIONS */}
              {trustTab === 'myRequests' && (
                <div>
                  {userTrustRequests.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3.5rem 1.5rem', background: '#f8fafc', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
                      <i className="fa-solid fa-shield-halved" style={{ fontSize: '2.8rem', color: '#cbd5e1', marginBottom: '0.85rem', display: 'block' }}></i>
                      <h4 style={{ fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem' }}>No Trust Badge Applications Yet</h4>
                      <p style={{ color: '#64748b', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
                        You haven&apos;t submitted any Gold Trust Badge verification requests yet. Select your business under the Apply tab to get verified.
                      </p>
                      <button
                        type="button"
                        onClick={() => setTrustTab('apply')}
                        style={{
                          background: '#d97706',
                          color: '#fff',
                          border: 'none',
                          padding: '0.65rem 1.25rem',
                          borderRadius: '10px',
                          fontWeight: 700,
                          fontSize: '0.86rem',
                          cursor: 'pointer',
                        }}
                      >
                        <i className="fa-solid fa-shield-halved" style={{ marginRight: 6 }}></i>
                        Apply for Gold Badge Now
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {userTrustRequests.map((req) => {
                        const statusLower = (req.status || '').toLowerCase();
                        const isApproved = statusLower === 'approved';
                        const isRejected = statusLower === 'rejected';
                        const isPending = !isApproved && !isRejected;

                        return (
                          <div
                            key={req.id}
                            style={{
                              background: '#fff',
                              border: isApproved ? '1.5px solid #86efac' : isRejected ? '1.5px solid #fca5a5' : '1.5px solid #fde68a',
                              borderRadius: '14px',
                              padding: '1.25rem',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.8rem', marginBottom: '0.75rem' }}>
                              <div>
                                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '1.1rem' }}>
                                  {req.businessName || req.listingName}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: 3, flexWrap: 'wrap', fontSize: '0.78rem', color: '#64748b' }}>
                                  <span>Applied: {req.date || 'Recent'}</span>
                                  <span>•</span>
                                  <span>ID: {req.id}</span>
                                  <span>•</span>
                                  <span>Paid: ₹{req.amountPaid || 99}</span>
                                </div>
                              </div>

                              {/* Status Badge */}
                              <span
                                style={{
                                  padding: '0.3rem 0.75rem',
                                  borderRadius: '999px',
                                  fontSize: '0.76rem',
                                  fontWeight: 800,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  background: isApproved ? '#ecfdf5' : isRejected ? '#fef2f2' : '#fef3c7',
                                  color: isApproved ? '#047857' : isRejected ? '#b91c1c' : '#b45309',
                                  border: isApproved ? '1px solid #a7f3d0' : isRejected ? '1px solid #fecdd3' : '1px solid #fde68a',
                                  flexShrink: 0,
                                }}
                              >
                                <i className={`fa-solid ${isApproved ? 'fa-circle-check' : isRejected ? 'fa-circle-xmark' : 'fa-clock'}`}></i>
                                {isApproved ? 'Gold Badge Active 👑' : isRejected ? 'Application Rejected' : 'Under Review ⏳'}
                              </span>
                            </div>

                            {/* Transaction Reference & Doc summary */}
                            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '10px', border: '1px solid #f1f5f9', display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.82rem', color: '#334155' }}>
                              <div>
                                <span style={{ color: '#64748b' }}>UTR / Txn ID:</span>{' '}
                                <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>{req.transactionId || 'N/A'}</strong>
                              </div>
                              <div>
                                <span style={{ color: '#64748b' }}>Doc:</span>{' '}
                                <strong>{req.docType || 'License'} ({req.tradeLicense || req.gstNumber || 'Attached'})</strong>
                              </div>
                              {req.docProof && (
                                <a href={req.docProof} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}>
                                  <i className="fa-solid fa-arrow-up-right-from-square"></i> View Doc
                                </a>
                              )}
                            </div>

                            {/* Approved Message */}
                            {isApproved && (
                              <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '10px', padding: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.8rem', marginTop: '0.75rem' }}>
                                <div style={{ fontSize: '0.83rem', color: '#065f46' }}>
                                  <strong>Gold Verified Active!</strong> Your business is verified with the official gold shield badge and priority top search rank.
                                </div>
                                <button
                                  type="button"
                                  onClick={() => goToScreen('viewManageListings')}
                                  style={{
                                    background: '#059669',
                                    color: '#fff',
                                    border: 'none',
                                    padding: '0.45rem 0.9rem',
                                    borderRadius: '8px',
                                    fontWeight: 700,
                                    fontSize: '0.78rem',
                                    cursor: 'pointer',
                                    flexShrink: 0,
                                  }}
                                >
                                  View in Shop
                                </button>
                              </div>
                            )}

                            {/* Rejected Feedback */}
                            {isRejected && (
                              <div style={{ background: '#fef2f2', border: '1px solid #fecdd3', borderRadius: '10px', padding: '0.85rem', marginTop: '0.75rem' }}>
                                <div style={{ fontWeight: 800, color: '#991b1b', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: 3 }}>
                                  <i className="fa-solid fa-triangle-exclamation"></i>
                                  Reason for Rejection:
                                </div>
                                <div style={{ color: '#7f1d1d', fontSize: '0.84rem', lineHeight: 1.4 }}>
                                  {req.adminReply || 'Payment reference or verification documents could not be validated.'}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTrustTab('apply');
                                    const matchBiz = myListings.find((l) => String(l.id) === String(req.listingId));
                                    if (matchBiz) handleSelectListingForTrust(matchBiz);
                                  }}
                                  style={{
                                    background: '#fff',
                                    border: '1px solid #f87171',
                                    color: '#b91c1c',
                                    padding: '0.35rem 0.75rem',
                                    borderRadius: '6px',
                                    fontSize: '0.76rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    marginTop: '0.5rem',
                                  }}
                                >
                                  Re-apply with Correct Details
                                </button>
                              </div>
                            )}

                            {/* Admin Note if Present */}
                            {req.adminReply && !isRejected && (
                              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '0.75rem', marginTop: '0.75rem', fontSize: '0.82rem', color: '#1e40af' }}>
                                <strong>Admin Note:</strong> {req.adminReply}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ================= VIEW 3: DEDICATED APPLICATION & PAYMENT FORM PAGE ================= */}
          {trustViewMode === 'form' && selectedTrustListing && (
            <div>
              {/* Top Selected Store Summary Banner */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                  border: '1.5px solid #fde68a',
                  borderRadius: '16px',
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1.25rem',
                  gap: '0.75rem',
                  boxShadow: '0 2px 8px rgba(217, 119, 6, 0.08)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: '10px',
                      background: '#fff',
                      border: '1px solid #fcd34d',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      overflow: 'hidden',
                    }}
                  >
                    {selectedTrustListing.image ? (
                      <img src={selectedTrustListing.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <i className="fa-solid fa-store" style={{ color: '#d97706', fontSize: '1.2rem' }}></i>
                    )}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ fontSize: '0.72rem', background: '#d97706', color: '#fff', padding: '0.1rem 0.45rem', borderRadius: '6px', fontWeight: 800 }}>Applying For</span>
                      <span style={{ fontWeight: 900, color: '#92400e', fontSize: '1.05rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {selectedTrustListing.name}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#78350f', marginTop: 2 }}>
                      {selectedTrustListing.category || 'Business'} • {selectedTrustListing.city || 'Local'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setTrustViewMode('listings')}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #fcd34d',
                    color: '#b45309',
                    padding: '0.45rem 0.85rem',
                    borderRadius: '9px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <i className="fa-solid fa-arrows-rotate" style={{ marginRight: 4 }}></i> Change Store
                </button>
              </div>

              {/* Dedicated Application & Payment Form */}
              <form
                onSubmit={handleSubmitTrustRequest}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                }}
              >
                {/* SECTION 1: BUSINESS VERIFICATION DETAILS */}
                <div
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '16px',
                    padding: '1.35rem',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ background: '#d97706', color: '#fff', width: 24, height: 24, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 900 }}>1</span>
                    <div>
                      <h4 style={{ margin: 0, fontWeight: 900, color: '#0f172a', fontSize: '1.05rem' }}>
                        Store & Owner Verification Details
                      </h4>
                      <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        Official identification documents to authenticate store ownership
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.3rem' }}>
                        Applicant / Proprietor Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Your full legal name"
                        value={trustApplicantName}
                        onChange={(e) => setTrustApplicantName(e.target.value)}
                        style={{ width: '100%', padding: '0.65rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.3rem' }}>
                        Contact Mobile / WhatsApp *
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="10-digit mobile number"
                        value={trustPhone}
                        onChange={(e) => setTrustPhone(e.target.value)}
                        style={{ width: '100%', padding: '0.65rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.3rem' }}>
                        Document Type *
                      </label>
                      <select
                        value={trustDocType}
                        onChange={(e) => setTrustDocType(e.target.value)}
                        style={{ width: '100%', padding: '0.65rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box', background: '#fff' }}
                      >
                        <option value="Trade License">Trade License</option>
                        <option value="GST Certificate">GST Certificate (GSTIN)</option>
                        <option value="Shop & Establishment Act">Shop & Establishment Act</option>
                        <option value="FSSAI Food License">FSSAI License</option>
                        <option value="Business PAN Card">Business PAN Card</option>
                        <option value="Electricity Bill">Electricity / Utility Bill</option>
                        <option value="Other Official ID Proof">Other Official ID Proof</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.3rem' }}>
                        {trustDocType} Registration No. *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder={`e.g. ${trustDocType === 'GST Certificate' ? '19AAAAA0000A1Z5' : 'Registration number'}`}
                        value={trustDocNumber}
                        onChange={(e) => setTrustDocNumber(e.target.value)}
                        style={{ width: '100%', padding: '0.65rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>

                  {/* Document Proof Upload */}
                  <div style={{ marginTop: '1.15rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                      Upload Document Proof (JPG, PNG, or PDF)
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <label
                        style={{
                          background: '#f8fafc',
                          border: '1.5px dashed #94a3b8',
                          borderRadius: '10px',
                          padding: '0.6rem 1.15rem',
                          cursor: 'pointer',
                          fontSize: '0.84rem',
                          fontWeight: 700,
                          color: '#334155',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                        }}
                      >
                        <i className="fa-solid fa-cloud-arrow-up" style={{ color: '#2563eb' }}></i>
                        {trustDocUploading ? 'Optimizing & Uploading...' : 'Choose Document File'}
                        <input
                          type="file"
                          accept=".jpg,.jpeg,.png,.webp,.pdf,application/pdf,image/*"
                          onChange={handleTrustDocProofUpload}
                          style={{ display: 'none' }}
                        />
                      </label>
                      {trustDocProofUrl && (
                        <span style={{ color: '#16a34a', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <i className="fa-solid fa-circle-check"></i> Document Attached
                          <a href={trustDocProofUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', marginLeft: 4, textDecoration: 'underline' }}>
                            (View File)
                          </a>
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 4 }}>
                      Clear photo or scanned copy of your certificate or shop license.
                    </div>
                  </div>
                </div>

                {/* SECTION 2: PAYMENT VIA QR & UTR TRANSACTION ID */}
                <div
                  style={{
                    background: '#ffffff',
                    border: '1.5px solid #fde68a',
                    borderRadius: '16px',
                    padding: '1.35rem',
                    boxShadow: '0 4px 16px rgba(217, 119, 6, 0.08)',
                  }}
                >
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', paddingBottom: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ background: '#d97706', color: '#fff', width: 24, height: 24, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 900 }}>2</span>
                      <div>
                        <h4 style={{ margin: 0, fontWeight: 900, color: '#0f172a', fontSize: '1.05rem' }}>
                          Scan UPI QR & Payment Reference
                        </h4>
                        <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                          Admin verifies UTR number in bank statements before badge activation
                        </span>
                      </div>
                    </div>
                    <span style={{ background: '#16a34a', color: '#fff', fontSize: '0.74rem', fontWeight: 800, padding: '0.2rem 0.65rem', borderRadius: '999px' }}>
                      ₹{trustBadgeSettings.offerPrice || 299} for 1 Year
                    </span>
                  </div>

                  {/* Scanner & Payment Details */}
                  <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: '14px', padding: '1.15rem', marginTop: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', alignItems: 'center' }}>
                      {/* QR Scanner */}
                      <div style={{ textAlign: 'center', background: '#fff', padding: '1rem', borderRadius: '12px', border: '1px solid #fde68a', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                        <div
                          style={{
                            width: '180px',
                            height: '180px',
                            margin: '0 auto',
                            background: '#fff',
                            border: '2px solid #e2e8f0',
                            borderRadius: '10px',
                            padding: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                          }}
                        >
                          {trustBadgeSettings.qrImageUrl ? (
                            <img
                              src={trustBadgeSettings.qrImageUrl}
                              alt="UPI QR Scanner"
                              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            />
                          ) : (
                            <img
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
                                `upi://pay?pa=${trustBadgeSettings.upiId || 'localbazar@upi'}&pn=${encodeURIComponent(
                                  trustBadgeSettings.upiName || 'LocalBazar'
                                )}&am=${trustBadgeSettings.offerPrice || 299}&cu=INR`
                              )}`}
                              alt="UPI QR Scanner"
                              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            />
                          )}
                        </div>

                        <div style={{ fontSize: '0.76rem', color: '#78350f', fontWeight: 800, marginTop: 8 }}>
                          Scan with GPay, PhonePe, Paytm, BHIM or any UPI app
                        </div>
                      </div>

                      {/* Payment Info */}
                      <div>
                        <div style={{ marginBottom: '0.85rem' }}>
                          <div style={{ fontSize: '0.76rem', color: '#92400e', fontWeight: 700 }}>Beneficiary Name:</div>
                          <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0f172a' }}>
                            {trustBadgeSettings.upiName || 'LocalBazar Official'}
                          </div>
                        </div>

                        <div style={{ marginBottom: '0.85rem' }}>
                          <div style={{ fontSize: '0.76rem', color: '#92400e', fontWeight: 700 }}>Official UPI ID:</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 2 }}>
                            <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#2563eb', background: '#eff6ff', padding: '0.25rem 0.65rem', borderRadius: 6, border: '1px solid #bfdbfe' }}>
                              {trustBadgeSettings.upiId || 'localbazar@upi'}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(trustBadgeSettings.upiId || 'localbazar@upi');
                                showToast('UPI ID copied to clipboard', 'info');
                              }}
                              style={{ background: '#fff', border: '1px solid #cbd5e1', padding: '0.25rem 0.55rem', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', color: '#334155' }}
                            >
                              <i className="fa-solid fa-copy"></i> Copy
                            </button>
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: '0.76rem', color: '#92400e', fontWeight: 700 }}>Payable Amount:</div>
                          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#16a34a' }}>
                            ₹{trustBadgeSettings.offerPrice || 299}{' '}
                            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>for 1 Year Gold Badge</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Transaction Reference Input (Required) */}
                    <div style={{ marginTop: '1.15rem', paddingTop: '1rem', borderTop: '1px solid #fde68a' }}>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#78350f', marginBottom: '0.35rem' }}>
                        Enter 12-Digit UPI Transaction ID / UTR Number *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 412356789012 (found on your payment receipt)"
                        value={trustTxnId}
                        onChange={(e) => setTrustTxnId(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          borderRadius: '8px',
                          border: '1.5px solid #d97706',
                          fontSize: '0.94rem',
                          fontWeight: 700,
                          color: '#0f172a',
                          background: '#fff',
                          boxSizing: 'border-box',
                        }}
                      />
                      <div style={{ fontSize: '0.74rem', color: '#92400e', marginTop: 4 }}>
                        <i className="fa-solid fa-circle-info" style={{ marginRight: 3 }}></i>
                        Admin will cross-verify this UTR number in bank records to activate your 1-year badge.
                      </div>
                    </div>

                    {/* Optional Payment Screenshot */}
                    <div style={{ marginTop: '0.85rem' }}>
                      <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#78350f', marginBottom: '0.25rem' }}>
                        Payment Screenshot Receipt (Optional)
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <label
                          style={{
                            background: '#fff',
                            border: '1px solid #cbd5e1',
                            padding: '0.45rem 0.85rem',
                            borderRadius: 6,
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            color: '#334155',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                          }}
                        >
                          <i className="fa-solid fa-camera" style={{ color: '#d97706' }}></i>
                          {trustPaymentUploading ? 'Uploading Receipt...' : 'Attach Payment Screenshot'}
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleTrustPaymentProofUpload}
                            style={{ display: 'none' }}
                          />
                        </label>
                        {trustPaymentProofUrl && (
                          <span style={{ color: '#16a34a', fontSize: '0.76rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <i className="fa-solid fa-circle-check"></i> Screenshot Attached
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Form Action Buttons */}
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setTrustViewMode('listings')}
                    style={{
                      flex: 1,
                      padding: '0.9rem',
                      borderRadius: '12px',
                      border: '1px solid #cbd5e1',
                      background: '#fff',
                      color: '#475569',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                    }}
                  >
                    <i className="fa-solid fa-arrow-left" style={{ marginRight: 6 }}></i> Back to Stores
                  </button>
                  <button
                    type="submit"
                    disabled={trustSubmitting || trustDocUploading || trustPaymentUploading}
                    style={{
                      flex: 2,
                      background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                      color: '#fff',
                      border: 'none',
                      padding: '0.9rem 1.25rem',
                      borderRadius: '12px',
                      fontWeight: 900,
                      fontSize: '1rem',
                      cursor: trustSubmitting ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.6rem',
                      boxShadow: '0 4px 15px rgba(22, 163, 74, 0.35)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <i className={`fa-solid ${trustSubmitting ? 'fa-spinner fa-spin' : 'fa-shield-halved'}`}></i>
                    {trustSubmitting ? 'Submitting Application...' : `Request Trust Badge (₹${trustBadgeSettings.offerPrice || 299}) 👑`}
                  </button>
                </div>
              </form>
            </div>
          )}
            </div>
          </div>
        )}

        {/* ================= SCREEN 8: HELP & SUPPORT ================= */}
        {activeScreen === 'viewHelp' && (
          <div className="account-view-screen active" id="viewHelp">
            <div className="account-sub-top-bar">
              <button
                type="button"
                className="account-sub-back-btn"
                onClick={() => {
                  if (selectedTicketId) {
                    setSelectedTicketId(null);
                  } else {
                    handleAppBack('viewMainMenu');
                  }
                }}
                title="Back"
              >
                <i className="fa-solid fa-arrow-left"></i>
              </button>
              <div className="account-sub-title-wrap">
                <h2 className="account-sub-title">Help & Support</h2>
                <span className="account-sub-desc">
                  {selectedTicketId ? 'Support Conversation Thread' : (helpTab === 'compose' ? 'Submit New Ticket to Admin' : 'Admin Messages & Support Replies')}
                </span>
              </div>
            </div>

            <div className="sub-screen-content" style={{ padding: '1.25rem', maxWidth: '720px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
              {/* 2 Tabs: Compose & Inbox */}
              <div style={{ display: 'flex', gap: '0.5rem', background: '#f1f5f9', padding: '0.35rem', borderRadius: '12px', marginBottom: '1.25rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setHelpTab('compose');
                    setSelectedTicketId(null);
                  }}
                  style={{
                    flex: 1,
                    padding: '0.65rem 1rem',
                    border: 'none',
                    borderRadius: '9px',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    background: helpTab === 'compose' ? '#ffffff' : 'transparent',
                    color: helpTab === 'compose' ? '#2563eb' : '#64748b',
                    boxShadow: helpTab === 'compose' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.45rem',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <i className="fa-solid fa-pen-to-square" style={{ color: helpTab === 'compose' ? '#2563eb' : '#94a3b8' }}></i>
                  Compose
                </button>

                <button
                  type="button"
                  onClick={() => setHelpTab('inbox')}
                  style={{
                    flex: 1,
                    padding: '0.65rem 1rem',
                    border: 'none',
                    borderRadius: '9px',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    background: helpTab === 'inbox' ? '#ffffff' : 'transparent',
                    color: helpTab === 'inbox' ? '#0f172a' : '#64748b',
                    boxShadow: helpTab === 'inbox' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.45rem',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <i className="fa-solid fa-inbox" style={{ color: helpTab === 'inbox' ? '#16a34a' : '#94a3b8' }}></i>
                  Inbox
                  {unreadMailsCount > 0 && (
                    <span style={{ background: '#ef4444', color: '#fff', fontSize: '0.72rem', padding: '0.1rem 0.5rem', borderRadius: '999px', fontWeight: 800 }}>
                      {unreadMailsCount}
                    </span>
                  )}
                  {unreadMailsCount === 0 && userMails.length > 0 && (
                    <span style={{ background: '#e2e8f0', color: '#475569', fontSize: '0.72rem', padding: '0.1rem 0.5rem', borderRadius: '999px', fontWeight: 800 }}>
                      {userMails.length}
                    </span>
                  )}
                </button>
              </div>

              {/* ================= TAB 1: COMPOSE ================= */}
              {helpTab === 'compose' && (
                <div>
                  {/* Top Helpdesk Info Banner */}
                  <div
                    style={{
                      background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)',
                      border: '1px solid #bfdbfe',
                      borderRadius: '14px',
                      padding: '1rem 1.15rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      marginBottom: '1.25rem',
                    }}
                  >
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(37,99,235,0.15)', flexShrink: 0 }}>
                      <i className="fa-solid fa-headset" style={{ color: '#2563eb', fontSize: '1.25rem' }}></i>
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, color: '#1e3a8a', fontSize: '0.94rem' }}>
                        LocalBazar Admin Support Center
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#3b82f6', marginTop: 2 }}>
                        Send any question, technical issue, or account inquiry directly to the platform admin. Replies will appear in your Inbox tab.
                      </div>
                    </div>
                  </div>

                  {/* Compose Form */}
                  <form
                    onSubmit={handleSendHelpTicket}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '16px',
                      padding: '1.35rem',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1.15rem',
                    }}
                  >
                    {/* Subject */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#334155', marginBottom: '0.35rem' }}>
                        Subject <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Issue with shop listing / Trust badge payment / Account update"
                        value={helpSubject}
                        onChange={(e) => setHelpSubject(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.72rem 0.9rem',
                          borderRadius: '10px',
                          border: '1.5px solid #cbd5e1',
                          fontSize: '0.92rem',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    {/* Message Body */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#334155', marginBottom: '0.35rem' }}>
                        Message <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <textarea
                        required
                        rows={5}
                        placeholder="Please describe your problem or question in detail so our support team can assist you quickly..."
                        value={helpMessage}
                        onChange={(e) => setHelpMessage(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.75rem 0.9rem',
                          borderRadius: '10px',
                          border: '1.5px solid #cbd5e1',
                          fontSize: '0.9rem',
                          lineHeight: 1.5,
                          outline: 'none',
                          resize: 'vertical',
                          boxSizing: 'border-box',
                          fontFamily: 'inherit',
                        }}
                      ></textarea>
                    </div>

                    {/* Attach File Section */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#334155' }}>
                          Attach Files (JPG, PNG, PDF, Word, Excel)
                        </label>
                        <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                          {helpAttachments.length}/5 files
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <label
                          style={{
                            background: helpAttachments.length >= 5 ? '#f1f5f9' : '#eff6ff',
                            border: '1.5px dashed #3b82f6',
                            borderRadius: '10px',
                            padding: '0.6rem 1.15rem',
                            cursor: helpAttachments.length >= 5 || helpAttUploading ? 'not-allowed' : 'pointer',
                            fontSize: '0.84rem',
                            fontWeight: 700,
                            color: '#1d4ed8',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.45rem',
                          }}
                        >
                          <i className="fa-solid fa-paperclip"></i>
                          {helpAttUploading ? 'Uploading & Optimizing...' : 'Attach File'}
                          <input
                            ref={helpFileInputRef}
                            type="file"
                            multiple
                            disabled={helpAttachments.length >= 5 || helpAttUploading}
                            accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xls,.xlsx,.csv,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                            onChange={handleHelpFileUpload}
                            style={{ display: 'none' }}
                          />
                        </label>
                        <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                          Formats: JPG, PNG, PDF, DOC, XLS
                        </span>
                      </div>

                      {/* Attachments Pills List */}
                      {helpAttachments.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
                          {helpAttachments.map((att, idx) => {
                            const iconData = getClaimDocIcon(att.type);
                            return (
                              <div
                                key={idx}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.45rem',
                                  background: '#f8fafc',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '8px',
                                  padding: '0.4rem 0.65rem',
                                  fontSize: '0.78rem',
                                  color: '#1e293b',
                                }}
                              >
                                <span
                                  style={{
                                    background: `${iconData.color}20`,
                                    color: iconData.color,
                                    padding: '0.15rem 0.45rem',
                                    borderRadius: '4px',
                                    fontWeight: 800,
                                    fontSize: '0.7rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 3,
                                  }}
                                >
                                  <i className={`fa-solid ${iconData.icon}`}></i>
                                  {iconData.label}
                                </span>
                                <span style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                                  {att.name}
                                </span>
                                {att.size && <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>({att.size})</span>}
                                <button
                                  type="button"
                                  onClick={() => handleHelpFileRemove(idx)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#ef4444',
                                    cursor: 'pointer',
                                    padding: '0 2px',
                                    fontSize: '0.82rem',
                                  }}
                                  title="Remove File"
                                >
                                  <i className="fa-solid fa-xmark"></i>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={helpSending || helpAttUploading}
                      style={{
                        padding: '0.85rem 1.5rem',
                        background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '12px',
                        fontSize: '0.96rem',
                        fontWeight: 800,
                        cursor: helpSending ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.6rem',
                        boxShadow: '0 4px 14px rgba(37,99,235,0.28)',
                        marginTop: '0.5rem',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <i className={`fa-solid ${helpSending ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`}></i>
                      {helpSending ? 'Sending Message to Admin...' : 'Send Message to Admin'}
                    </button>
                  </form>
                </div>
              )}

              {/* ================= TAB 2: INBOX ================= */}
              {helpTab === 'inbox' && (
                <div>
                  {selectedTicketId ? (() => {
                    const ticket = userMails.find((m) => m.id === selectedTicketId);
                    if (!ticket) {
                      return (
                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                          <p>Ticket not found.</p>
                          <button type="button" onClick={() => setSelectedTicketId(null)} style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: 8, cursor: 'pointer' }}>
                            Back to Inbox
                          </button>
                        </div>
                      );
                    }

                    const isReplied = ticket.status === 'replied' || (ticket.replies && ticket.replies.length > 0);

                    return (
                      <div>
                        {/* Back to Inbox Bar */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                          <button
                            type="button"
                            onClick={() => setSelectedTicketId(null)}
                            style={{
                              background: '#fff',
                              border: '1px solid #cbd5e1',
                              padding: '0.45rem 0.85rem',
                              borderRadius: '8px',
                              fontSize: '0.82rem',
                              fontWeight: 700,
                              color: '#334155',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                            }}
                          >
                            <i className="fa-solid fa-arrow-left"></i> Back to All Messages
                          </button>
                          <span
                            style={{
                              padding: '0.25rem 0.75rem',
                              borderRadius: '999px',
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              background: isReplied ? '#dbeafe' : '#fef3c7',
                              color: isReplied ? '#1d4ed8' : '#b45309',
                              border: isReplied ? '1px solid #bfdbfe' : '1px solid #fde68a',
                            }}
                          >
                            {isReplied ? 'Admin Replied 💬' : 'Awaiting Reply ⏳'}
                          </span>
                        </div>

                        {/* Ticket Card */}
                        <div
                          style={{
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '16px',
                            padding: '1.25rem',
                            boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
                            marginBottom: '1rem',
                          }}
                        >
                          <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem', marginBottom: '0.85rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: '#0f172a' }}>
                              {ticket.subject || 'Support Message'}
                            </h3>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginTop: 4, fontSize: '0.76rem', color: '#64748b' }}>
                              <span>Ticket ID: {ticket.id}</span>
                              <span>•</span>
                              <span>Sent: {ticket.date}</span>
                              {ticket.from === 'admin' && (
                                <span style={{ background: '#dbeafe', color: '#1e40af', padding: '0.1rem 0.45rem', borderRadius: 4, fontWeight: 700 }}>
                                  Direct From Admin
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Initial Message */}
                          <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #f1f5f9', marginBottom: '0.85rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                              <span style={{ fontWeight: 800, fontSize: '0.84rem', color: '#0f172a' }}>
                                {ticket.senderName || 'You'}
                              </span>
                              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                ({ticket.senderEmail || 'User'})
                              </span>
                            </div>
                            <div style={{ fontSize: '0.88rem', color: '#334155', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                              {ticket.body || ticket.message || 'No message content.'}
                            </div>

                            {/* Attachments */}
                            {ticket.attachments && ticket.attachments.length > 0 && (
                              <div style={{ marginTop: '0.75rem', paddingTop: '0.65rem', borderTop: '1px solid #e2e8f0' }}>
                                <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b', marginBottom: '0.35rem' }}>
                                  Attachments ({ticket.attachments.length}):
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                                  {ticket.attachments.map((att, i) => {
                                    const iconData = getClaimDocIcon(att.type);
                                    return (
                                      <a
                                        key={i}
                                        href={att.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '0.4rem',
                                          background: '#ffffff',
                                          border: '1px solid #cbd5e1',
                                          padding: '0.3rem 0.65rem',
                                          borderRadius: 6,
                                          fontSize: '0.75rem',
                                          textDecoration: 'none',
                                          color: '#1e293b',
                                          fontWeight: 600,
                                        }}
                                      >
                                        <i className={`fa-solid ${iconData.icon}`} style={{ color: iconData.color }}></i>
                                        <span>{att.name}</span>
                                        <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: '0.65rem', color: '#94a3b8' }}></i>
                                      </a>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Conversation Replies Thread */}
                          {ticket.replies && ticket.replies.length > 0 && (
                            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                              <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a' }}>
                                Conversation Replies ({ticket.replies.length})
                              </div>
                              {ticket.replies.map((rep) => {
                                const isAdmin = rep.sender === 'admin';
                                return (
                                  <div
                                    key={rep.id}
                                    style={{
                                      background: isAdmin ? '#eff6ff' : '#f8fafc',
                                      border: isAdmin ? '1.5px solid #bfdbfe' : '1px solid #e2e8f0',
                                      borderRadius: '12px',
                                      padding: '0.85rem 1rem',
                                      marginLeft: isAdmin ? '0' : '1.5rem',
                                      marginRight: isAdmin ? '1.5rem' : '0',
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        {isAdmin && (
                                          <i className="fa-solid fa-shield-halved" style={{ color: '#2563eb', fontSize: '0.85rem' }}></i>
                                        )}
                                        <span style={{ fontWeight: 800, fontSize: '0.84rem', color: isAdmin ? '#1e40af' : '#0f172a' }}>
                                          {isAdmin ? 'LocalBazar Admin Helpdesk' : rep.senderName}
                                        </span>
                                      </div>
                                      <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                        {rep.date}
                                      </span>
                                    </div>
                                    <div style={{ fontSize: '0.86rem', color: '#1e293b', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                                      {rep.message}
                                    </div>
                                    {rep.attachments && rep.attachments.length > 0 && (
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem' }}>
                                        {rep.attachments.map((att, aIdx) => (
                                          <a
                                            key={aIdx}
                                            href={att.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '0.35rem',
                                              background: '#fff',
                                              border: '1px solid #cbd5e1',
                                              padding: '0.25rem 0.55rem',
                                              borderRadius: 6,
                                              fontSize: '0.74rem',
                                              textDecoration: 'none',
                                              color: '#2563eb',
                                              fontWeight: 600,
                                            }}
                                          >
                                            <i className="fa-solid fa-paperclip"></i> {att.name}
                                          </a>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Reply Form */}
                        <div
                          style={{
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '14px',
                            padding: '1.15rem',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                          }}
                        >
                          <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <i className="fa-solid fa-reply" style={{ color: '#2563eb' }}></i> Send Follow-up Reply to Admin
                          </div>
                          <textarea
                            rows={3}
                            placeholder="Type your response to the support team..."
                            value={ticketReplyText}
                            onChange={(e) => setTicketReplyText(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '0.65rem 0.85rem',
                              borderRadius: '8px',
                              border: '1px solid #cbd5e1',
                              fontSize: '0.88rem',
                              lineHeight: 1.45,
                              outline: 'none',
                              resize: 'vertical',
                              boxSizing: 'border-box',
                              fontFamily: 'inherit',
                            }}
                          ></textarea>

                          {/* Reply Attachment pills */}
                          {ticketReplyFiles.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem' }}>
                              {ticketReplyFiles.map((att, fIdx) => (
                                <span
                                  key={fIdx}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    background: '#f1f5f9',
                                    padding: '0.25rem 0.55rem',
                                    borderRadius: 6,
                                    fontSize: '0.74rem',
                                    color: '#334155',
                                  }}
                                >
                                  <i className="fa-solid fa-paperclip"></i> {att.name}
                                  <button
                                    type="button"
                                    onClick={() => setTicketReplyFiles((prev) => prev.filter((_, i) => i !== fIdx))}
                                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}
                                  >
                                    <i className="fa-solid fa-xmark"></i>
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
                            <label
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                padding: '0.45rem 0.85rem',
                                background: '#f8fafc',
                                border: '1px solid #cbd5e1',
                                borderRadius: '8px',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                color: '#334155',
                                cursor: 'pointer',
                              }}
                            >
                              <i className="fa-solid fa-paperclip"></i>
                              {ticketReplyUploading ? 'Attaching...' : 'Attach File'}
                              <input
                                ref={ticketReplyFileRef}
                                type="file"
                                multiple
                                accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xls,.xlsx,.csv"
                                onChange={handleTicketReplyFileUpload}
                                style={{ display: 'none' }}
                              />
                            </label>

                            <button
                              type="button"
                              onClick={() => handleSendTicketReply(ticket.id)}
                              disabled={ticketReplySending || ticketReplyUploading}
                              style={{
                                padding: '0.55rem 1.25rem',
                                background: '#2563eb',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '0.86rem',
                                fontWeight: 800,
                                cursor: ticketReplySending ? 'not-allowed' : 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.45rem',
                              }}
                            >
                              <i className={`fa-solid ${ticketReplySending ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`}></i>
                              Send Reply
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })() : (
                    /* Tickets List */
                    <div>
                      {userMails.length === 0 ? (
                        <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center', background: '#f8fafc', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
                          <i className="fa-solid fa-inbox" style={{ fontSize: '2.8rem', color: '#cbd5e1', marginBottom: '0.85rem', display: 'block' }}></i>
                          <h4 style={{ fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem' }}>Your Support Inbox is Empty</h4>
                          <p style={{ color: '#64748b', fontSize: '0.88rem', marginBottom: '1.25rem', maxWidth: '420px', margin: '0 auto 1.25rem' }}>
                            You have not submitted any support tickets yet. Click the Compose tab to send a direct message to LocalBazar Admin.
                          </p>
                          <button
                            type="button"
                            onClick={() => setHelpTab('compose')}
                            style={{
                              background: '#2563eb',
                              color: '#fff',
                              border: 'none',
                              padding: '0.65rem 1.25rem',
                              borderRadius: '10px',
                              fontWeight: 700,
                              fontSize: '0.86rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.45rem',
                            }}
                          >
                            <i className="fa-solid fa-pen-to-square"></i> Compose Support Message
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                          {userMails.map((mail) => {
                            const isReplied = mail.status === 'replied' || (mail.replies && mail.replies.length > 0);
                            const hasAdminDirect = mail.from === 'admin';
                            const repliesCount = mail.replies ? mail.replies.length : 0;

                            return (
                              <div
                                key={mail.id}
                                onClick={() => setSelectedTicketId(mail.id)}
                                style={{
                                  background: '#ffffff',
                                  border: isReplied ? '1.5px solid #bfdbfe' : '1px solid #e2e8f0',
                                  borderRadius: '14px',
                                  padding: '1.1rem 1.25rem',
                                  cursor: 'pointer',
                                  boxShadow: isReplied ? '0 2px 8px rgba(37,99,235,0.06)' : '0 2px 6px rgba(0,0,0,0.03)',
                                  transition: 'all 0.15s ease',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  gap: '1rem',
                                }}
                              >
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: 4 }}>
                                    <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.98rem' }}>
                                      {mail.subject || 'Support Message'}
                                    </span>
                                    {isReplied ? (
                                      <span style={{ background: '#dbeafe', color: '#1d4ed8', fontSize: '0.72rem', padding: '0.15rem 0.55rem', borderRadius: '999px', fontWeight: 800 }}>
                                        Admin Replied 💬
                                      </span>
                                    ) : hasAdminDirect ? (
                                      <span style={{ background: '#ecfdf5', color: '#047857', fontSize: '0.72rem', padding: '0.15rem 0.55rem', borderRadius: '999px', fontWeight: 800 }}>
                                        Direct from Admin 📩
                                      </span>
                                    ) : (
                                      <span style={{ background: '#fef3c7', color: '#b45309', fontSize: '0.72rem', padding: '0.15rem 0.55rem', borderRadius: '999px', fontWeight: 800 }}>
                                        Open ⏳
                                      </span>
                                    )}
                                  </div>

                                  <div style={{ fontSize: '0.83rem', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 6 }}>
                                    {mail.body || mail.message || 'No description'}
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.75rem', color: '#94a3b8' }}>
                                    <span>{mail.date}</span>
                                    <span>•</span>
                                    <span>ID: {mail.id}</span>
                                    {mail.attachments && mail.attachments.length > 0 && (
                                      <>
                                        <span>•</span>
                                        <span style={{ color: '#2563eb', fontWeight: 700 }}>
                                          <i className="fa-solid fa-paperclip"></i> {mail.attachments.length} file(s)
                                        </span>
                                      </>
                                    )}
                                    {repliesCount > 0 && (
                                      <>
                                        <span>•</span>
                                        <span style={{ color: '#16a34a', fontWeight: 700 }}>
                                          {repliesCount} repl{repliesCount > 1 ? 'ies' : 'y'}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', color: '#94a3b8', fontSize: '0.9rem', flexShrink: 0 }}>
                                  <i className="fa-solid fa-chevron-right"></i>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= SCREEN 9: SETTINGS ================= */}
        {activeScreen === 'viewSettings' && (
          <div className="account-view-screen active" id="viewSettings">
            <div className="account-sub-top-bar">
              <button
                type="button"
                className="account-sub-back-btn"
                onClick={() => handleAppBack('viewMainMenu')}
                title="Back to Menu"
              >
                <i className="fa-solid fa-arrow-left"></i>
              </button>
              <div className="account-sub-title-wrap">
                <h2 className="account-sub-title">Settings & Preferences</h2>
                <span className="account-sub-desc">Display theme, cache & account session</span>
              </div>
            </div>

            <div className="sub-screen-content" style={{ padding: '1.25rem 1.25rem 2.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                {/* 0. PWA APP INSTALLATION OPTION (Auto hidden when installed) */}
                {!isAppInstalled && (
                  <div>
                    <div style={{
                      fontSize: '0.8rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: themeMode === 'dark' ? '#94a3b8' : '#64748b',
                      marginBottom: '0.65rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <i className="fa-solid fa-mobile-screen-button" style={{ color: '#2563eb' }}></i>
                      <span>LocalBazar App</span>
                    </div>

                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.95rem 1.1rem',
                      background: themeMode === 'dark' ? '#1e293b' : '#f8fafc',
                      borderRadius: '14px',
                      border: `1.5px solid ${themeMode === 'dark' ? '#3b82f6' : '#bfdbfe'}`,
                      boxShadow: '0 4px 14px rgba(37, 99, 235, 0.08)',
                      gap: '1rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                        <div style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '10px',
                          background: '#eff6ff',
                          border: '1px solid #dbeafe',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <img src="/app-logo-hd-192.png" alt="App" style={{ width: '32px', height: '32px', borderRadius: '6px', objectFit: 'contain' }} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <strong style={{ fontSize: '0.92rem', color: themeMode === 'dark' ? '#f8fafc' : '#0f172a', display: 'block' }}>
                            Install LocalBazar App
                          </strong>
                          <div style={{ fontSize: '0.78rem', color: themeMode === 'dark' ? '#94a3b8' : '#64748b', marginTop: '2px', lineHeight: 1.25 }}>
                            Fast, 1-tap home screen access & app experience
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleInstallAppFromSettings}
                        style={{
                          padding: '0.55rem 1.1rem',
                          borderRadius: '10px',
                          background: '#2563eb',
                          border: 'none',
                          color: '#ffffff',
                          fontSize: '0.84rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          whiteSpace: 'nowrap',
                          boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <i className="fa-solid fa-download"></i>
                        <span>Install App</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* 1. APPEARANCE & THEME SECTION */}
                <div>
                  <div style={{
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: themeMode === 'dark' ? '#94a3b8' : '#64748b',
                    marginBottom: '0.65rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <i className="fa-solid fa-circle-half-stroke" style={{ color: '#2563eb' }}></i>
                    <span>Appearance & Theme</span>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '0.65rem'
                  }}>
                    {/* Light Mode Card */}
                    <div
                      onClick={() => handleSelectTheme('light')}
                      style={{
                        padding: '0.85rem 0.75rem',
                        borderRadius: '14px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        border: themeMode === 'light'
                          ? '2px solid #2563eb'
                          : (themeMode === 'dark' ? '1.5px solid #334155' : '1.5px solid #e2e8f0'),
                        background: themeMode === 'light'
                          ? '#ffffff'
                          : (themeMode === 'dark' ? '#0f172a' : '#f8fafc'),
                        boxShadow: themeMode === 'light'
                          ? '0 4px 16px rgba(37, 99, 235, 0.12)'
                          : 'none',
                        position: 'relative'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.55rem' }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '10px',
                          background: '#fef3c7',
                          color: '#d97706',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.1rem'
                        }}>
                          <i className="fa-solid fa-sun"></i>
                        </div>
                        {themeMode === 'light' && (
                          <span style={{
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: '12px',
                            background: '#2563eb',
                            color: '#ffffff',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}>
                            <i className="fa-solid fa-check"></i> Active
                          </span>
                        )}
                      </div>
                      <div style={{ fontWeight: 800, fontSize: '0.9rem', color: themeMode === 'dark' ? '#f8fafc' : '#0f172a' }}>
                        Light Mode
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px', lineHeight: 1.25 }}>
                        Clean & bright
                      </div>
                    </div>

                    {/* Dark Mode Card */}
                    <div
                      onClick={() => handleSelectTheme('dark')}
                      style={{
                        padding: '0.85rem 0.75rem',
                        borderRadius: '14px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        border: themeMode === 'dark'
                          ? '2px solid #3b82f6'
                          : '1.5px solid #e2e8f0',
                        background: themeMode === 'dark'
                          ? '#1e293b'
                          : '#ffffff',
                        boxShadow: themeMode === 'dark'
                          ? '0 4px 16px rgba(59, 130, 246, 0.2)'
                          : 'none',
                        position: 'relative'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.55rem' }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '10px',
                          background: '#1e1b4b',
                          color: '#818cf8',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.1rem'
                        }}>
                          <i className="fa-solid fa-moon"></i>
                        </div>
                        {themeMode === 'dark' && (
                          <span style={{
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: '12px',
                            background: '#3b82f6',
                            color: '#ffffff',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}>
                            <i className="fa-solid fa-check"></i> Active
                          </span>
                        )}
                      </div>
                      <div style={{ fontWeight: 800, fontSize: '0.9rem', color: themeMode === 'dark' ? '#f8fafc' : '#0f172a' }}>
                        Dark Mode
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px', lineHeight: 1.25 }}>
                        Sleek & eye ease
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. DATA & PERFORMANCE (REPLACING DUMMIES) */}
                <div>
                  <div style={{
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: themeMode === 'dark' ? '#94a3b8' : '#64748b',
                    marginBottom: '0.65rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <i className="fa-solid fa-database" style={{ color: '#0ea5e9' }}></i>
                    <span>Storage & Performance</span>
                  </div>

                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.95rem 1.1rem',
                    background: themeMode === 'dark' ? '#1e293b' : '#f8fafc',
                    borderRadius: '14px',
                    border: `1px solid ${themeMode === 'dark' ? '#334155' : '#e2e8f0'}`,
                    gap: '1rem'
                  }}>
                    <div>
                      <strong style={{ fontSize: '0.92rem', color: themeMode === 'dark' ? '#f8fafc' : '#0f172a' }}>
                        Clear Local Cache
                      </strong>
                      <div style={{ fontSize: '0.78rem', color: themeMode === 'dark' ? '#94a3b8' : '#64748b', marginTop: '2px' }}>
                        Free up temporary offline cache to load fresh listings & images
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearAppCache}
                      style={{
                        padding: '0.5rem 0.95rem',
                        borderRadius: '10px',
                        background: themeMode === 'dark' ? '#0f172a' : '#ffffff',
                        border: `1.5px solid ${themeMode === 'dark' ? '#475569' : '#cbd5e1'}`,
                        color: themeMode === 'dark' ? '#93c5fd' : '#2563eb',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <i className="fa-solid fa-arrows-rotate"></i>
                      <span>Clear Cache</span>
                    </button>
                  </div>
                </div>

                {/* 3. ACCOUNT & ACTIVE SESSION */}
                <div>
                  <div style={{
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: themeMode === 'dark' ? '#94a3b8' : '#64748b',
                    marginBottom: '0.65rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <i className="fa-solid fa-shield-halved" style={{ color: '#10b981' }}></i>
                    <span>Account & Session</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {/* Session Info Card */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.95rem 1.1rem',
                      background: themeMode === 'dark' ? '#1e293b' : '#f8fafc',
                      borderRadius: '14px',
                      border: `1px solid ${themeMode === 'dark' ? '#334155' : '#e2e8f0'}`,
                      gap: '0.75rem'
                    }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                          <strong style={{ fontSize: '0.92rem', color: themeMode === 'dark' ? '#f8fafc' : '#0f172a' }}>
                            Signed In Account
                          </strong>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: themeMode === 'dark' ? '#94a3b8' : '#64748b', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {currentUser?.email || currentUser?.phone || 'Verified User Account'}
                        </div>
                      </div>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '4px 8px',
                        borderRadius: '8px',
                        background: '#dcfce7',
                        color: '#15803d',
                        whiteSpace: 'nowrap'
                      }}>
                        Active
                      </span>
                    </div>

                    {/* Quick Sign Out Card */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.95rem 1.1rem',
                      background: themeMode === 'dark' ? '#1e293b' : '#f8fafc',
                      borderRadius: '14px',
                      border: `1px solid ${themeMode === 'dark' ? '#334155' : '#e2e8f0'}`,
                      gap: '1rem'
                    }}>
                      <div>
                        <strong style={{ fontSize: '0.92rem', color: '#ef4444' }}>
                          Sign Out
                        </strong>
                        <div style={{ fontSize: '0.78rem', color: themeMode === 'dark' ? '#94a3b8' : '#64748b', marginTop: '2px' }}>
                          Safely log out of this device
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          showAlert(
                            'Sign Out Confirmation',
                            'Are you sure you want to log out of LocalBazar on this device?',
                            'warning',
                            'Yes, Sign Out',
                            () => handleLogout()
                          );
                        }}
                        style={{
                          padding: '0.5rem 0.95rem',
                          borderRadius: '10px',
                          background: '#fef2f2',
                          border: '1.5px solid #fecaca',
                          color: '#dc2626',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          whiteSpace: 'nowrap',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <i className="fa-solid fa-power-off"></i>
                        <span>Log Out</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* 4. PLATFORM & VERSION INFO */}
                <div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.75rem 1rem',
                    background: themeMode === 'dark' ? '#0f172a' : '#f1f5f9',
                    borderRadius: '12px',
                    border: `1px dashed ${themeMode === 'dark' ? '#334155' : '#cbd5e1'}`
                  }}>
                    <span style={{ fontSize: '0.76rem', color: themeMode === 'dark' ? '#94a3b8' : '#64748b' }}>
                      <i className="fa-solid fa-code-branch" style={{ marginRight: '5px' }}></i>
                      LocalBazar v1.2.0 • Ultra-Responsive
                    </span>
                    <span style={{ fontSize: '0.74rem', color: '#10b981', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <i className="fa-solid fa-circle" style={{ fontSize: '0.5rem' }}></i> Operational
                    </span>
                  </div>
                </div>

                {/* Safe Bottom Clearance for Settings screen */}
                <div style={{ height: '4.5rem', width: '100%', flexShrink: 0 }} aria-hidden="true" />

              </div>
            </div>
          </div>
        )}
      </div>

      {/* ================= MULTINATIONAL ENTERPRISE MERCHANT PORTAL SUITE ================= */}
      {/* Matching media_1793697023434_8b2f0362.jpg */}
      {activePortalListing && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: '#f8fafc',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* 1. AUTO-HIDE SIDEBAR DRAWER BACKDROP */}
          <div
            className={`m-portal-drawer-backdrop ${portalDrawerOpen ? 'active' : ''}`}
            onClick={() => setPortalDrawerOpen(false)}
          />

          {/* 2. AUTO-HIDE SIDEBAR DRAWER (Exact match to media_1793697023434_8b2f0362.jpg) */}
          <div className={`m-portal-drawer ${portalDrawerOpen ? 'active' : ''}`}>
            {/* Drawer Header */}
            <div className="m-portal-drawer-header">
              <div className="m-portal-brand">
                <div className="m-brand-avatar">
                  <img
                    src={activePortalListing.image || 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=120&auto=format&fit=crop&q=80'}
                    alt={activePortalListing.name}
                  />
                </div>
                <div className="m-brand-text">
                  <h4>{activePortalListing.name}</h4>
                  <span className="m-brand-badge">Business Portal</span>
                </div>
              </div>
              <button
                type="button"
                className="btn-drawer-close"
                onClick={() => setPortalDrawerOpen(false)}
                title="Close Sidebar Menu"
              >
                &times;
              </button>
            </div>

            {/* Drawer Menu (The 6 Items from user screenshot) */}
            <div className="m-portal-drawer-menu">
              {/* Item 1: Listing Images */}
              <button
                type="button"
                className={`m-drawer-item ${portalTab === 'gallery' ? 'active' : ''}`}
                onClick={() => {
                  setPortalTab('gallery');
                  setPortalDrawerOpen(false);
                }}
              >
                <div className="m-drawer-item-icon">
                  <i className="fa-regular fa-image"></i>
                </div>
                <div className="m-drawer-item-content">
                  <span className="m-drawer-item-title">Listing Images</span>
                  <span className="m-drawer-item-sub">Store photos, upload & gallery view</span>
                </div>
              </button>

              {/* Item 2: Identity & Address */}
              <button
                type="button"
                className={`m-drawer-item ${portalTab === 'identity' ? 'active' : ''}`}
                onClick={() => {
                  setPortalTab('identity');
                  setPortalDrawerOpen(false);
                }}
              >
                <div className="m-drawer-item-icon">
                  <i className="fa-solid fa-location-dot"></i>
                </div>
                <div className="m-drawer-item-content">
                  <span className="m-drawer-item-title">Identity & Address</span>
                  <span className="m-drawer-item-sub">Shop name, category, city & address</span>
                </div>
              </button>

              {/* Item 3: Action Buttons */}
              <button
                type="button"
                className={`m-drawer-item ${portalTab === 'actions' ? 'active' : ''}`}
                onClick={() => {
                  setPortalTab('actions');
                  setPortalDrawerOpen(false);
                }}
              >
                <div className="m-drawer-item-icon">
                  <i className="fa-solid fa-sliders"></i>
                </div>
                <div className="m-drawer-item-content">
                  <span className="m-drawer-item-title">Action Buttons</span>
                  <span className="m-drawer-item-sub">Call, WhatsApp & Direction setup</span>
                </div>
              </button>

              {/* Item 4: Products & Services */}
              <button
                type="button"
                className={`m-drawer-item ${portalTab === 'catalog' ? 'active' : ''}`}
                onClick={() => {
                  setPortalTab('catalog');
                  setPortalDrawerOpen(false);
                }}
              >
                <div className="m-drawer-item-icon">
                  <i className="fa-solid fa-boxes-stacked"></i>
                </div>
                <div className="m-drawer-item-content">
                  <span className="m-drawer-item-title">Products & Services</span>
                  <span className="m-drawer-item-sub">Product catalog, prices & stock status</span>
                </div>
              </button>

              {/* Item 5: Banners */}
              <button
                type="button"
                className={`m-drawer-item ${portalTab === 'banners' ? 'active' : ''}`}
                onClick={() => {
                  setPortalTab('banners');
                  setPortalDrawerOpen(false);
                }}
              >
                <div className="m-drawer-item-icon">
                  <i className="fa-solid fa-bullhorn"></i>
                </div>
                <div className="m-drawer-item-content">
                  <span className="m-drawer-item-title">Banners</span>
                  <span className="m-drawer-item-sub">16:9 promotional banners & deals</span>
                </div>
              </button>

              {/* Item 6: Schedule */}
              <button
                type="button"
                className={`m-drawer-item ${portalTab === 'schedule' ? 'active' : ''}`}
                onClick={() => {
                  setPortalTab('schedule');
                  setPortalDrawerOpen(false);
                }}
              >
                <div className="m-drawer-item-icon">
                  <i className="fa-regular fa-clock"></i>
                </div>
                <div className="m-drawer-item-content">
                  <span className="m-drawer-item-title">Schedule</span>
                  <span className="m-drawer-item-sub">Daily open/close times & off-days</span>
                </div>
              </button>
            </div>

            {/* Drawer Footer: Exit Business Portal */}
            <div className="m-portal-drawer-footer">
              <button
                type="button"
                className="btn-drawer-exit"
                onClick={closeBusinessPortal}
              >
                <i className="fa-solid fa-arrow-left"></i>
                <span>Back to Manage Business</span>
              </button>
            </div>
          </div>

          {/* 3. FLOATING TOPBAR WITH HAMBURGER BUTTON */}
          <div className="m-portal-floating-topbar">
            {/* Native App-Style Back Arrow to Return to Manage Business */}
            <button
              type="button"
              className="account-sub-back-btn"
              onClick={closeBusinessPortal}
              title="Back to Manage Business"
              style={{
                flexShrink: 0,
              }}
            >
              <i className="fa-solid fa-arrow-left"></i>
            </button>

            <button
              type="button"
              className="m-hamburger-btn"
              onClick={() => setPortalDrawerOpen(true)}
              title="Open Portal Sidebar Menu"
            >
              <i className="fa-solid fa-bars"></i>
              <span>Menu</span>
            </button>

            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
              <button
                type="button"
                className="btn-portal-close"
                onClick={closeBusinessPortal}
                title="Exit Business Portal"
              >
                &times;
              </button>
            </div>
          </div>

          {/* 4. SCROLLABLE TAB CONTENT BODY */}
          <div className="m-portal-body">
            {/* TAB 1: LISTING IMAGES (Max 2 Photos with Primary Selection) */}
            {portalTab === 'gallery' && (() => {
              const currentGallery = (activePortalListing.gallery && activePortalListing.gallery.length > 0)
                ? activePortalListing.gallery
                : (activePortalListing.image ? [activePortalListing.image] : []);

              return (
                <div className="m-panel-box">
                  <div className="m-panel-box-header">
                    <div>
                      <h4>Listing Images & Primary Cover</h4>
                      <p>Upload maximum 2 photos. Choose which photo is your primary cover.</p>
                    </div>
                    {currentGallery.length < 2 ? (
                      <label className="btn-portal-primary" style={{ cursor: 'pointer' }}>
                        <i className="fa-solid fa-cloud-arrow-up"></i>
                        <span>Upload Store Photos ({currentGallery.length}/2)</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePortalPhotoUpload}
                          style={{ display: 'none' }}
                        />
                      </label>
                    ) : (
                      <div style={{ background: '#f1f5f9', color: '#64748b', padding: '0.45rem 0.85rem', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 700 }}>
                        <i className="fa-solid fa-lock" style={{ marginRight: '6px' }}></i> Limit Reached (2/2)
                      </div>
                    )}
                  </div>

                  {/* Primary Photo Showcase */}
                  <div style={{ marginBottom: '1.5rem', background: '#f8fafc', padding: '1rem', borderRadius: '14px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <img
                      src={activePortalListing.image || 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=160&auto=format&fit=crop&q=80'}
                      alt="Store Cover"
                      style={{ width: '90px', height: '90px', borderRadius: '12px', objectFit: 'cover', border: '2.5px solid #2563eb' }}
                    />
                    <div>
                      <span style={{ background: '#dbeafe', color: '#1d4ed8', fontSize: '0.74rem', fontWeight: 800, padding: '0.2rem 0.65rem', borderRadius: '6px' }}>
                        ★ Primary Store Cover
                      </span>
                      <h5 style={{ margin: '0.4rem 0 0.2rem 0', fontWeight: 800, color: '#0f172a' }}>{activePortalListing.name}</h5>
                      <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>This photo appears on the storefront header and main card searches.</p>
                    </div>
                  </div>

                  {/* All Gallery Photos (Max 2) */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                    <h5 style={{ fontWeight: 800, margin: 0, color: '#0f172a' }}>
                      Store Photos ({currentGallery.length} / 2)
                    </h5>
                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Max 2 photos allowed</span>
                  </div>

                  <div className="m-gallery-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                    {currentGallery.map((photoUrl, idx) => {
                      const isPrimary = activePortalListing.image === photoUrl;
                      return (
                        <div key={idx} className={`m-gallery-card ${isPrimary ? 'is-primary' : ''}`} style={{ border: isPrimary ? '2px solid #2563eb' : '1px solid #e2e8f0' }}>
                          <div className="m-gallery-img-box" style={{ height: '170px' }}>
                            <img src={photoUrl} alt={`Photo ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            {isPrimary && (
                              <span className="m-gallery-primary-chip">★ Primary Cover</span>
                            )}
                          </div>
                          <div className="m-gallery-actions" style={{ padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                            {!isPrimary ? (
                              <button
                                type="button"
                                className="btn-gallery-action"
                                onClick={() => handleSetPrimaryPhoto(photoUrl)}
                                style={{ flex: 1, padding: '0.45rem', fontSize: '0.82rem', fontWeight: 700, borderRadius: '8px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', cursor: 'pointer' }}
                              >
                                <i className="fa-regular fa-star"></i> Set as Primary
                              </button>
                            ) : (
                              <span style={{ color: '#16a34a', fontWeight: 700, fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <i className="fa-solid fa-check-circle"></i> Active Cover
                              </span>
                            )}
                            <button
                              type="button"
                              className="btn-gallery-action del"
                              onClick={() => handleDeletePortalPhoto(photoUrl)}
                              title="Delete photo"
                              style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', cursor: 'pointer' }}
                            >
                              <i className="fa-solid fa-trash"></i>
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {currentGallery.length < 2 && (
                      <label
                        style={{
                          border: '2px dashed #cbd5e1',
                          borderRadius: '16px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minHeight: '220px',
                          cursor: 'pointer',
                          background: '#f8fafc',
                          transition: 'all 0.15s ease',
                          padding: '1.5rem',
                          textAlign: 'center',
                        }}
                      >
                        <i className="fa-solid fa-cloud-arrow-up" style={{ fontSize: '2rem', color: '#94a3b8', marginBottom: '0.5rem' }}></i>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#334155' }}>Upload Second Photo</span>
                        <span style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>Slot 2 of 2 available</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePortalPhotoUpload}
                          style={{ display: 'none' }}
                        />
                      </label>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* TAB 2: IDENTITY & ADDRESS */}
            {portalTab === 'identity' && (
              <div className="m-panel-box">
                <div className="m-panel-box-header">
                  <div>
                    <h4>Business Identity & Physical Address</h4>
                    <p>Update shop name, select admin-registered category & city, and full address.</p>
                  </div>
                </div>

                <div className="m-form-grid">
                  <div className="m-field span-2">
                    <label>Business / Shop Name *</label>
                    <input
                      type="text"
                      value={portalName}
                      onChange={(e) => setPortalName(e.target.value)}
                      placeholder="e.g. Apex Pharmacy & Supermarket"
                    />
                  </div>

                  {/* Category with Admin Auto-Suggest */}
                  <div className="m-field" style={{ position: 'relative' }}>
                    <label>Category (Admin Registered Only) *</label>
                    <input
                      type="text"
                      value={portalCategory}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPortalCategory(val);
                        setShowPortalCatSuggestions(val.trim().length > 0);
                      }}
                      onFocus={() => {
                        if (portalCategory.trim().length > 0) setShowPortalCatSuggestions(true);
                      }}
                      onBlur={() => setTimeout(() => setShowPortalCatSuggestions(false), 200)}
                      placeholder="Type to search admin categories..."
                      autoComplete="off"
                    />
                    {showPortalCatSuggestions && portalCategory.trim().length > 0 && categories.length > 0 && (() => {
                      const filtered = categories
                        .filter((c) => c.name.toLowerCase().includes(portalCategory.trim().toLowerCase()))
                        .slice(0, 8);
                      if (filtered.length === 0) return null;
                      return (
                        <div className="city-suggestions-dropdown" style={{ display: 'block', maxHeight: '180px', overflowY: 'auto' }}>
                          {filtered.map((c) => (
                            <div
                              key={c.name}
                              style={{ padding: '0.6rem 0.85rem', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '8px' }}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setPortalCategory(c.name);
                                setShowPortalCatSuggestions(false);
                              }}
                            >
                              <i className={`fa-solid ${c.icon || 'fa-tag'}`} style={{ color: '#2563eb', fontSize: '0.85rem', width: '16px', textAlign: 'center' }}></i>
                              <span style={{ fontWeight: 600 }}>{c.name}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  {/* City with Admin Auto-Suggest */}
                  <div className="m-field" style={{ position: 'relative' }}>
                    <label>City / Locality (Admin Registered Only) *</label>
                    <input
                      type="text"
                      value={portalCity}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPortalCity(val);
                        setShowPortalCitySuggestions(val.trim().length > 0);
                      }}
                      onFocus={() => {
                        if (portalCity.trim().length > 0) setShowPortalCitySuggestions(true);
                      }}
                      onBlur={() => setTimeout(() => setShowPortalCitySuggestions(false), 200)}
                      placeholder="Type to search admin cities..."
                      autoComplete="off"
                    />
                    {showPortalCitySuggestions && portalCity.trim().length > 0 && cities.length > 0 && (() => {
                      const filtered = cities
                        .filter((c) => c.name.toLowerCase().includes(portalCity.trim().toLowerCase()))
                        .slice(0, 8);
                      if (filtered.length === 0) return null;
                      return (
                        <div className="city-suggestions-dropdown" style={{ display: 'block', maxHeight: '180px', overflowY: 'auto' }}>
                          {filtered.map((c) => (
                            <div
                              key={c.name}
                              style={{ padding: '0.6rem 0.85rem', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '8px' }}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setPortalCity(c.name);
                                setShowPortalCitySuggestions(false);
                              }}
                            >
                              <i className="fa-solid fa-location-dot" style={{ color: '#ef4444', fontSize: '0.85rem', width: '16px', textAlign: 'center' }}></i>
                              <span style={{ fontWeight: 600 }}>{c.name}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Physical Store Address */}
                  <div className="m-field span-2">
                    <label>Physical Store / Office Address *</label>
                    <input
                      type="text"
                      value={portalAddress}
                      onChange={(e) => setPortalAddress(e.target.value)}
                      placeholder="Building, street, market area, landmark, PIN"
                    />
                  </div>
                </div>

                <div className="m-form-action-row">
                  <button
                    type="button"
                    className="btn-portal-primary"
                    onClick={() => {
                      if (!portalName.trim()) {
                        showAlert('Store Name Required', 'Please enter your business or shop name.', 'warning');
                        return;
                      }
                      if (!portalCategory.trim()) {
                        showAlert('Category Required', 'Please choose a category from the admin list.', 'warning');
                        return;
                      }
                      if (!portalCity.trim()) {
                        showAlert('City Required', 'Please choose a city from the admin list.', 'warning');
                        return;
                      }
                      handleSavePortalFields({
                        name: portalName.trim(),
                        category: portalCategory.trim(),
                        city: portalCity.trim(),
                        address: portalAddress.trim(),
                      });
                      showToast('Business identity & address updated', 'success');
                    }}
                  >
                    <i className="fa-solid fa-floppy-disk"></i> Save Identity Changes
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: ACTION BUTTONS */}
            {portalTab === 'actions' && (
              <div className="m-panel-box">
                <div className="m-panel-box-header">
                  <div>
                    <h4>Action Buttons Setup</h4>
                    <p>Setup Call, WhatsApp Chat, and Directions for customers.</p>
                  </div>
                </div>

                <div className="m-form-grid">
                  <div className="m-field span-2">
                    <label><i className="fa-solid fa-phone" style={{ color: '#2563eb' }}></i> Primary Call Phone Number</label>
                    <input
                      type="tel"
                      value={portalPhone}
                      onChange={(e) => setPortalPhone(e.target.value)}
                      placeholder="e.g. 9876543210"
                    />
                    <small style={{ color: '#64748b' }}>Used when visitors click the Call button.</small>
                  </div>

                  <div className="m-field span-2">
                    <label><i className="fa-brands fa-whatsapp" style={{ color: '#16a34a' }}></i> WhatsApp Business Number</label>
                    <input
                      type="tel"
                      value={portalWhatsapp}
                      onChange={(e) => setPortalWhatsapp(e.target.value)}
                      placeholder="e.g. 9876543210"
                    />
                    <small style={{ color: '#64748b' }}>Opens WhatsApp chat directly with your store.</small>
                  </div>

                  <div className="m-field span-2">
                    <label><i className="fa-solid fa-location-arrow" style={{ color: '#ef4444' }}></i> Google Maps Direction URL</label>
                    <input
                      type="url"
                      value={portalMapLink}
                      onChange={(e) => setPortalMapLink(e.target.value)}
                      placeholder="https://maps.google.com/?q=..."
                    />
                    <small style={{ color: '#64748b' }}>Used when customers tap Direction to navigate to your shop.</small>
                  </div>
                </div>

                <div className="m-form-action-row">
                  <button
                    type="button"
                    className="btn-portal-primary"
                    onClick={() =>
                      handleSavePortalFields({
                        phone: portalPhone.trim(),
                        mapLink: portalMapLink.trim(),
                        whatsapp: portalWhatsapp.trim(),
                      } as any)
                    }
                  >
                    <i className="fa-solid fa-floppy-disk"></i> Save Action Buttons
                  </button>
                </div>
              </div>
            )}

            {/* TAB 4: PRODUCTS & SERVICES (Matching media_1793702691549_72856844.jpg) */}
            {portalTab === 'catalog' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* 1. Products & Services Catalog Card */}
                <div className="m-prod-section-card">
                  {/* Trust Badge vs Free Category Product Limit Status Pill */}
                  {isTrustBadgeActive(activePortalListing) ? (
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '0.45rem 0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.85rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#15803d', fontSize: '0.82rem', fontWeight: 700 }}>
                        <i className="fa-solid fa-shield-halved" style={{ color: '#f59e0b' }}></i>
                        <span>Trust Badge Active: Unlimited Products Unlocked</span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 800 }}>Unlimited Products</span>
                    </div>
                  ) : (
                    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '0.55rem 0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.85rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#b45309', fontSize: '0.82rem', fontWeight: 700 }}>
                        <i className="fa-solid fa-lock" style={{ color: '#d97706' }}></i>
                        <span>Free Tier Limit: Max 5 products per in-store category slide</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          closeBusinessPortal();
                          goToScreen('viewTrustBadge');
                        }}
                        style={{
                          background: '#d97706',
                          color: '#ffffff',
                          border: 'none',
                          padding: '3px 10px',
                          borderRadius: '6px',
                          fontSize: '0.76rem',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >
                        Upgrade to Trust Badge
                      </button>
                    </div>
                  )}

                  <div className="m-prod-section-header">
                    <div>
                      <h3 className="m-prod-section-title">
                        <i className="fa-solid fa-boxes-stacked" style={{ color: '#0f172a' }}></i>
                        1. Products &amp; Services Catalog
                      </h3>
                      <p className="m-prod-section-desc">
                        Manage your products &amp; services with multi-image gallery, price, details, and In Stock / Out of Stock toggle.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn-add-product-main"
                      onClick={handleOpenAddProduct}
                    >
                      <i className="fa-solid fa-plus"></i> Add Product
                    </button>
                  </div>

                  {/* Filter by Category: Horizontal scroll row */}
                  {(() => {
                    const uniqueCats = Array.from(
                      new Set(
                        (activePortalListing.products || [])
                          .map((p) => p.storeCategory || p.category)
                          .filter(Boolean) as string[]
                      )
                    );
                    return (
                      <div className="m-prod-filter-row">
                        <span className="m-prod-filter-label">Filter by Category:</span>
                        <button
                          type="button"
                          className={`m-prod-filter-pill ${catalogCatFilter === 'all' ? 'active' : ''}`}
                          onClick={() => setCatalogCatFilter('all')}
                        >
                          All
                        </button>
                        {uniqueCats.map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            className={`m-prod-filter-pill ${catalogCatFilter.toLowerCase() === cat.toLowerCase() ? 'active' : ''}`}
                            onClick={() => setCatalogCatFilter(cat)}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    );
                  })()}

                  {/* Products Catalog Rows */}
                  {(() => {
                    const prods = activePortalListing.products || [];
                    const filtered = prods
                      .map((item, originalIdx) => ({ item, originalIdx }))
                      .filter(({ item }) => {
                        if (catalogCatFilter === 'all') return true;
                        const cat = (item.storeCategory || item.category || '').toLowerCase();
                        return cat === catalogCatFilter.toLowerCase();
                      });

                    if (filtered.length === 0) {
                      return (
                        <div style={{ textAlign: 'center', padding: '2.5rem 1.5rem', background: '#f8fafc', borderRadius: '16px', border: '1.5px dashed #cbd5e1' }}>
                          <i className="fa-solid fa-boxes-stacked" style={{ fontSize: '2.4rem', color: '#94a3b8', marginBottom: '0.6rem', display: 'block' }}></i>
                          <h5 style={{ fontWeight: 800, color: '#0f172a', marginBottom: '0.25rem', fontSize: '1rem' }}>No Products in this Category</h5>
                          <p style={{ color: '#64748b', fontSize: '0.84rem', marginBottom: '1.15rem' }}>Add items to your catalog to showcase them on your storefront.</p>
                          <button
                            type="button"
                            className="btn-add-product-main"
                            style={{ margin: '0 auto' }}
                            onClick={handleOpenAddProduct}
                          >
                            <i className="fa-solid fa-plus"></i> Add Product
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div>
                        {filtered.map(({ item, originalIdx }) => {
                          const isInStock = item.inStock !== false && item.stockStatus !== 'out_of_stock';
                          const isTop = !!(item.isTop || item.isTopProduct);
                          const imgs = Array.isArray(item.images) && item.images.length > 0 ? item.images : (item.image ? [item.image] : []);
                          const thumbUrl = imgs[0] || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=140&auto=format&fit=crop&q=80';
                          const photoCount = imgs.length || 1;

                          return (
                            <div key={originalIdx} className="m-prod-card-row">
                              <div className="m-prod-card-left">
                                <div className="m-prod-thumb-box">
                                  <img src={thumbUrl} alt={item.name} className="m-prod-thumb-img" />
                                  <span className="m-prod-cam-badge">
                                    <i className="fa-solid fa-camera"></i> {photoCount}
                                  </span>
                                </div>
                                <div className="m-prod-details-col">
                                  <span className="m-prod-title-text">{item.name}</span>
                                  <div className="m-prod-meta-line">
                                    <span className="m-prod-price-text">{item.price || 'On Request'}</span>
                                    <span className={`m-prod-stock-badge ${isInStock ? 'in' : 'out'}`}>
                                      {isInStock ? 'In Stock' : 'Out of Stock'}
                                    </span>
                                  </div>
                                  <p className="m-prod-cat-subtext">
                                    Category: {item.storeCategory || item.category || 'General'}
                                  </p>
                                </div>
                              </div>

                              <div className="m-prod-actions-row">
                                <button
                                  type="button"
                                  className={`btn-prod-action-btn star ${isTop ? 'active' : ''}`}
                                  onClick={() => handleToggleProductTop(originalIdx)}
                                  title={isTop ? 'Remove from Top Products' : 'Mark as Top Product'}
                                >
                                  <i className={isTop ? 'fa-solid fa-star' : 'fa-regular fa-star'}></i>
                                </button>
                                <button
                                  type="button"
                                  className="btn-prod-action-btn view"
                                  onClick={() => setPreviewProduct(item)}
                                  title="Preview Product"
                                >
                                  <i className="fa-solid fa-eye"></i>
                                </button>
                                <button
                                  type="button"
                                  className="btn-prod-action-btn edit"
                                  onClick={() => handleOpenEditProduct(originalIdx, item)}
                                  title="Edit Product"
                                >
                                  <i className="fa-solid fa-pencil"></i>
                                </button>
                                <button
                                  type="button"
                                  className="btn-prod-action-btn del"
                                  onClick={() => handleDeletePortalProduct(originalIdx)}
                                  title="Delete Product"
                                >
                                  <i className="fa-solid fa-trash"></i>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                {/* 2. Top Products Showcase Card */}
                <div className="m-prod-section-card">
                  <div className="m-prod-section-header">
                    <div>
                      <h3 className="m-prod-section-title">
                        <i className="fa-solid fa-star" style={{ color: '#eab308' }}></i>
                        2. Top Products Showcase
                      </h3>
                      <p className="m-prod-section-desc">
                        Select which products from your catalog to feature prominently in the square product shelf at the bottom of your storefront page.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn-select-top-main"
                      onClick={() => setShowSelectTopModal(true)}
                    >
                      <i className="fa-solid fa-star"></i> Select Top Products
                    </button>
                  </div>

                  {(() => {
                    const topItems = (activePortalListing.products || []).filter(
                      (p) => p.isTop || p.isTopProduct
                    );

                    if (topItems.length === 0) {
                      return (
                        <div style={{ textAlign: 'center', padding: '1.75rem 1rem', background: '#fffbeb', borderRadius: '14px', border: '1.5px dashed #fde047', color: '#854d0e' }}>
                          <i className="fa-solid fa-star" style={{ fontSize: '1.6rem', color: '#eab308', marginBottom: '0.4rem', display: 'block' }}></i>
                          <strong style={{ fontSize: '0.92rem' }}>No top showcase products selected yet</strong>
                          <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#a16207' }}>
                            Tap the star icon on any product above or click "Select Top Products" to feature items here.
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div>
                        {topItems.map((item, tIdx) => {
                          const imgs = Array.isArray(item.images) && item.images.length > 0 ? item.images : (item.image ? [item.image] : []);
                          const thumbUrl = imgs[0] || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=140&auto=format&fit=crop&q=80';

                          return (
                            <div key={tIdx} className="m-showcase-item-card">
                              <div className="m-showcase-item-left">
                                <img src={thumbUrl} alt={item.name} className="m-showcase-thumb" />
                                <div>
                                  <span className="m-showcase-title">{item.name}</span>
                                  <div className="m-showcase-meta">
                                    <span className="m-showcase-price">{item.price || 'On Request'}</span>
                                    <span className="m-showcase-cat-pill">
                                      {item.storeCategory || item.category || 'General'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <button
                                type="button"
                                className="btn-remove-showcase"
                                onClick={() => handleRemoveTopProduct(item.id || item.name)}
                                title="Remove from showcase"
                              >
                                &times;
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* TAB 5: PROMOTIONAL 16:9 SLIDE BANNERS */}
            {portalTab === 'banners' && (() => {
              const hasTrust = isTrustBadgeActive(activePortalListing);

              if (!hasTrust) {
                return (
                  <div className="m-panel-box">
                    <div style={{ textAlign: 'center', padding: '2.5rem 1.25rem 2rem', background: '#fffbeb', border: '1.5px dashed #f59e0b', borderRadius: '16px', marginBottom: '1.5rem' }}>
                      <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                        color: '#d97706',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.6rem',
                        margin: '0 auto 1rem',
                        boxShadow: '0 4px 12px rgba(245, 158, 11, 0.25)',
                        border: '2px solid #f59e0b'
                      }}>
                        <i className="fa-solid fa-lock"></i>
                      </div>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.4rem' }}>
                        Custom Banner Slider is Locked
                      </h3>
                      <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '480px', margin: '0 auto 1.35rem', lineHeight: 1.55 }}>
                        To unlock 3 custom 16:9 promotional slide banners and exclusive offer posters for your store, a verified <strong>Trust Badge</strong> is required. Free listings display default platform banners from admin.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          closeBusinessPortal();
                          goToScreen('viewTrustBadge');
                        }}
                        style={{
                          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                          color: '#ffffff',
                          border: 'none',
                          padding: '0.75rem 1.5rem',
                          borderRadius: '12px',
                          fontWeight: 800,
                          fontSize: '0.92rem',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          boxShadow: '0 4px 14px rgba(217, 119, 6, 0.35)'
                        }}
                      >
                        <i className="fa-solid fa-shield-halved"></i>
                        <span>Upgrade to Trust Badge</span>
                      </button>
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                        <h5 style={{ fontWeight: 800, margin: 0, color: '#0f172a' }}>
                          Currently Active on Your Store: Admin Default Banners
                        </h5>
                        <span style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 700 }}>
                          <i className="fa-solid fa-circle-info" style={{ marginRight: '4px' }}></i> Shown to All Visitors
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                        {(emptyStoreBanners.filter((s) => Boolean(s.imageUrl)).length > 0
                          ? emptyStoreBanners.filter((s) => Boolean(s.imageUrl))
                          : [
                              { slot: 1, title: 'Super Deals & Offers', imageUrl: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&auto=format&fit=crop&q=80' },
                              { slot: 2, title: 'Mega Savings Festival', imageUrl: 'https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?w=800&auto=format&fit=crop&q=80' },
                              { slot: 3, title: 'Local Bazar Offers', imageUrl: 'https://images.unsplash.com/photo-1555421689-491a97ff2040?w=800&auto=format&fit=crop&q=80' },
                            ]
                        ).slice(0, 3).map((s: any, idx: number) => (
                          <div
                            key={idx}
                            style={{
                              background: '#ffffff',
                              borderRadius: '16px',
                              border: '1.5px dashed #cbd5e1',
                              overflow: 'hidden',
                              opacity: 0.9,
                            }}
                          >
                            <div style={{ width: '100%', aspectRatio: '16 / 9', position: 'relative' }}>
                              <img
                                src={s.imageUrl}
                                alt={s.title || `Default Banner ${idx + 1}`}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                              <span
                                style={{
                                  position: 'absolute',
                                  top: '8px',
                                  left: '8px',
                                  background: '#334155',
                                  color: '#ffffff',
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                }}
                              >
                                Admin Default Slot {idx + 1}
                              </span>
                            </div>
                            <div style={{ padding: '0.65rem 0.85rem', background: '#f8fafc', fontSize: '0.8rem', color: '#64748b' }}>
                              {s.title || 'Platform Promotional Banner'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div className="m-panel-box">
                  <div className="m-panel-box-header">
                  <div>
                    <h4>16:9 Promotional Slide Banners</h4>
                    <p>Upload up to 3 custom 16:9 image banners from your local storage. If none uploaded, default system banners from admin are shown.</p>
                  </div>
                  {portalBanners.length < 3 ? (
                    <label className="btn-portal-primary" style={{ cursor: 'pointer' }}>
                      <i className="fa-solid fa-cloud-arrow-up"></i>
                      <span>Upload 16:9 Banner ({portalBanners.length}/3)</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handlePortalBannerUpload}
                        style={{ display: 'none' }}
                      />
                    </label>
                  ) : (
                    <div style={{ background: '#f1f5f9', color: '#64748b', padding: '0.45rem 0.85rem', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 700 }}>
                      <i className="fa-solid fa-lock" style={{ marginRight: '6px' }}></i> Banner Limit Reached (3/3)
                    </div>
                  )}
                </div>

                {/* If Merchant has uploaded custom banners */}
                {portalBanners.length > 0 ? (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                      <h5 style={{ fontWeight: 800, margin: 0, color: '#0f172a' }}>
                        Your Custom Store Banners ({portalBanners.length} / 3)
                      </h5>
                      <span style={{ fontSize: '0.78rem', color: '#16a34a', fontWeight: 700 }}>
                        <i className="fa-solid fa-circle-check" style={{ marginRight: '4px' }}></i> Active on Storefront
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                      {portalBanners.map((bnUrl, idx) => (
                        <div
                          key={idx}
                          style={{
                            background: '#ffffff',
                            borderRadius: '16px',
                            border: '1.5px solid #e2e8f0',
                            overflow: 'hidden',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                            display: 'flex',
                            flexDirection: 'column',
                          }}
                        >
                          <div style={{ width: '100%', aspectRatio: '16 / 9', position: 'relative', background: '#0f172a' }}>
                            <img
                              src={bnUrl}
                              alt={`Banner ${idx + 1}`}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                            <span
                              style={{
                                position: 'absolute',
                                top: '8px',
                                left: '8px',
                                background: 'rgba(15, 23, 42, 0.8)',
                                backdropFilter: 'blur(4px)',
                                color: '#ffffff',
                                fontSize: '0.74rem',
                                fontWeight: 800,
                                padding: '3px 8px',
                                borderRadius: '6px',
                              }}
                            >
                              Slide {idx + 1} of 3
                            </span>
                          </div>
                          <div style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#ffffff' }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
                              Custom 16:9 Banner
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeletePortalBanner(bnUrl)}
                              style={{
                                background: '#fef2f2',
                                color: '#ef4444',
                                border: '1px solid #fecaca',
                                padding: '0.4rem 0.85rem',
                                borderRadius: '8px',
                                fontSize: '0.82rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                              }}
                            >
                              <i className="fa-solid fa-trash"></i> Delete
                            </button>
                          </div>
                        </div>
                      ))}

                      {portalBanners.length < 3 && (
                        <label
                          style={{
                            border: '2px dashed #cbd5e1',
                            borderRadius: '16px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            aspectRatio: '16 / 9',
                            cursor: 'pointer',
                            background: '#f8fafc',
                            padding: '1.25rem',
                            textAlign: 'center',
                          }}
                        >
                          <i className="fa-solid fa-cloud-arrow-up" style={{ fontSize: '2rem', color: '#94a3b8', marginBottom: '0.5rem' }}></i>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#334155' }}>Upload Next 16:9 Banner</span>
                          <span style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>Slot {portalBanners.length + 1} of 3</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handlePortalBannerUpload}
                            style={{ display: 'none' }}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    {/* Empty State: Admin Banners Fallback */}
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '0.85rem 1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <i className="fa-solid fa-info-circle" style={{ color: '#16a34a', fontSize: '1.1rem' }}></i>
                      <div style={{ fontSize: '0.85rem', color: '#166534' }}>
                        <strong>No custom banners added yet.</strong> Your shop is currently displaying the default fallback banners from Admin. Upload your own 16:9 banners above to replace them.
                      </div>
                    </div>

                    <h5 style={{ fontWeight: 800, margin: '0 0 0.85rem 0', color: '#64748b' }}>
                      Default Admin Fallback Banners (Preview)
                    </h5>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                      {(emptyStoreBanners.filter((b) => b.imageUrl).length > 0
                        ? emptyStoreBanners.filter((b) => b.imageUrl)
                        : [
                            { slot: 1, title: 'Super Deals & Offers', imageUrl: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&auto=format&fit=crop&q=80' },
                            { slot: 2, title: 'Mega Savings Festival', imageUrl: 'https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?w=800&auto=format&fit=crop&q=80' },
                            { slot: 3, title: 'Local Bazar Offers', imageUrl: 'https://images.unsplash.com/photo-1555421689-491a97ff2040?w=800&auto=format&fit=crop&q=80' },
                          ]
                      ).slice(0, 3).map((s: any, idx: number) => (
                        <div
                          key={idx}
                          style={{
                            background: '#ffffff',
                            borderRadius: '16px',
                            border: '1.5px dashed #cbd5e1',
                            overflow: 'hidden',
                            opacity: 0.85,
                          }}
                        >
                          <div style={{ width: '100%', aspectRatio: '16 / 9', position: 'relative' }}>
                            <img
                              src={s.imageUrl}
                              alt={s.title || `Default Banner ${idx + 1}`}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                            <span
                              style={{
                                position: 'absolute',
                                top: '8px',
                                left: '8px',
                                background: '#334155',
                                color: '#ffffff',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: '6px',
                              }}
                            >
                              Admin Default Slot {idx + 1}
                            </span>
                          </div>
                          <div style={{ padding: '0.65rem 0.85rem', background: '#f8fafc', fontSize: '0.8rem', color: '#64748b' }}>
                            {s.title || 'Admin Promotional Banner'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
                );
              })()}

            {/* TAB 6: SCHEDULE */}
            {portalTab === 'schedule' && (
              <div className="m-panel-box">
                <div className="m-panel-box-header">
                  <div>
                    <h4>Operating Schedule & Timings</h4>
                    <p>Manage daily opening/closing hours and scheduled holidays.</p>
                  </div>
                  <button
                    type="button"
                    className="btn-portal-primary"
                    onClick={handleSavePortalSchedule}
                  >
                    <i className="fa-solid fa-floppy-disk"></i> Save Schedule & Holidays
                  </button>
                </div>

                {/* Daily Schedule List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1.5rem' }}>
                  {DAYS_OF_WEEK.map((day) => {
                    const sched = portalSchedule[day] || { isOpen: true, openTime: '09:00', openAmPm: 'AM', closeTime: '08:30', closeAmPm: 'PM' };
                    return (
                      <div key={day} className={`schedule-day-card ${!sched.isOpen ? 'is-closed' : ''}`}>
                        <div className="schedule-day-header-col">
                          <label className="schedule-day-switch">
                            <input
                              type="checkbox"
                              checked={sched.isOpen}
                              onChange={(e) => {
                                setPortalSchedule((prev) => ({
                                  ...prev,
                                  [day]: { ...sched, isOpen: e.target.checked },
                                }));
                              }}
                            />
                            <span className="schedule-day-slider"></span>
                          </label>
                          <span className="schedule-day-name">{day}</span>
                          <span className={`schedule-status-pill ${sched.isOpen ? 'open' : 'closed'}`}>
                            {sched.isOpen ? 'Open' : 'Closed'}
                          </span>
                        </div>

                        {sched.isOpen ? (
                          <div className="schedule-day-times-wrap">
                            <div className="schedule-time-box">
                              <input
                                type="text"
                                value={sched.openTime}
                                onChange={(e) => setPortalSchedule((prev) => ({ ...prev, [day]: { ...sched, openTime: e.target.value } }))}
                              />
                              <select
                                value={sched.openAmPm}
                                onChange={(e) => setPortalSchedule((prev) => ({ ...prev, [day]: { ...sched, openAmPm: e.target.value } }))}
                              >
                                <option value="AM">AM</option>
                                <option value="PM">PM</option>
                              </select>
                            </div>

                            <span className="schedule-time-divider">to</span>

                            <div className="schedule-time-box">
                              <input
                                type="text"
                                value={sched.closeTime}
                                onChange={(e) => setPortalSchedule((prev) => ({ ...prev, [day]: { ...sched, closeTime: e.target.value } }))}
                              />
                              <select
                                value={sched.closeAmPm}
                                onChange={(e) => setPortalSchedule((prev) => ({ ...prev, [day]: { ...sched, closeAmPm: e.target.value } }))}
                              >
                                <option value="AM">AM</option>
                                <option value="PM">PM</option>
                              </select>
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: '#ef4444', fontWeight: 700, fontSize: '0.86rem' }}>
                            <i className="fa-regular fa-circle-xmark"></i> Closed all day
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Scheduled Holidays Section */}
                <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid #e2e8f0' }}>
                  <div style={{ marginBottom: '0.85rem' }}>
                    <h5 style={{ fontWeight: 800, margin: '0 0 0.25rem 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <i className="fa-solid fa-umbrella-beach" style={{ color: '#ef4444' }}></i>
                      Scheduled Holidays & Special Off-Days
                    </h5>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>
                      Pick specific calendar dates when your shop is closed for festivals, maintenance, or holidays.
                    </p>
                  </div>

                  {/* Add Holiday Button and Holiday Count Pill */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setHolidayTarget('portal');
                        setTempSelectedHolidays([...portalHolidays]);
                        setCalViewingDate(new Date());
                        setShowHolidayCalModal(true);
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: '#2563eb',
                        color: '#ffffff',
                        border: 'none',
                        padding: '0.65rem 1.25rem',
                        borderRadius: '12px',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        boxShadow: '0 2px 6px rgba(37, 99, 235, 0.2)',
                      }}
                    >
                      <i className="fa-regular fa-calendar-plus"></i>
                      <span>Add Holiday</span>
                    </button>

                    {/* Holiday Count Button / Trigger for Bottom Sheet */}
                    <button
                      type="button"
                      onClick={() => {
                        setHolidayTarget('portal');
                        setShowHolidayListSheet(true);
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: portalHolidays.length > 0 ? '#fef2f2' : '#f8fafc',
                        color: portalHolidays.length > 0 ? '#dc2626' : '#64748b',
                        border: `1.5px solid ${portalHolidays.length > 0 ? '#fecaca' : '#cbd5e1'}`,
                        padding: '0.65rem 1.25rem',
                        borderRadius: '12px',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                      }}
                      title="Click to view all selected holiday dates"
                    >
                      <i className="fa-solid fa-calendar-check"></i>
                      <span>Total: <strong>{portalHolidays.length} {portalHolidays.length === 1 ? 'Holiday' : 'Holidays'}</strong></span>
                      <i className="fa-solid fa-chevron-up" style={{ fontSize: '0.75rem', marginLeft: '4px' }}></i>
                    </button>
                  </div>
                </div>

                <div className="m-form-action-row">
                  <button
                    type="button"
                    className="btn-portal-primary"
                    onClick={handleSavePortalSchedule}
                  >
                    <i className="fa-solid fa-floppy-disk"></i> Save Schedule & Holidays
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= CALENDAR SELECTION MODAL ================= */}
      {showHolidayCalModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 100000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => setShowHolidayCalModal(false)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              maxWidth: '380px',
              width: '100%',
              padding: '1.25rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h4 style={{ margin: 0, fontWeight: 800, color: '#0f172a', fontSize: '1.1rem' }}>
                Select Holidays
              </h4>
              <button
                type="button"
                onClick={() => setShowHolidayCalModal(false)}
                style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', color: '#64748b', cursor: 'pointer', lineHeight: 1 }}
              >
                &times;
              </button>
            </div>

            {/* Month Navigation */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', background: '#f8fafc', padding: '0.5rem 0.85rem', borderRadius: '12px' }}>
              <button
                type="button"
                onClick={() => setCalViewingDate(new Date(calViewingDate.getFullYear(), calViewingDate.getMonth() - 1, 1))}
                style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <i className="fa-solid fa-chevron-left" style={{ fontSize: '0.8rem' }}></i>
              </button>

              <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>
                {calViewingDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </span>

              <button
                type="button"
                onClick={() => setCalViewingDate(new Date(calViewingDate.getFullYear(), calViewingDate.getMonth() + 1, 1))}
                style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <i className="fa-solid fa-chevron-right" style={{ fontSize: '0.8rem' }}></i>
              </button>
            </div>

            {/* Days of week header */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', gap: '4px', marginBottom: '6px' }}>
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d, i) => (
                <span key={i} style={{ fontSize: '0.74rem', fontWeight: 800, color: i === 0 ? '#ef4444' : '#64748b' }}>
                  {d}
                </span>
              ))}
            </div>

            {/* Month Days Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '1.25rem' }}>
              {getDaysInMonth(calViewingDate.getFullYear(), calViewingDate.getMonth()).map((dayItem, idx) => {
                const isSelected = tempSelectedHolidays.includes(dayItem.dateStr);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleTempHoliday(dayItem.dateStr)}
                    style={{
                      aspectRatio: '1',
                      borderRadius: '10px',
                      border: isSelected ? '2px solid #2563eb' : '1px solid #f1f5f9',
                      background: isSelected ? '#2563eb' : dayItem.isCurrentMonth ? '#ffffff' : '#f8fafc',
                      color: isSelected ? '#ffffff' : dayItem.isCurrentMonth ? '#0f172a' : '#cbd5e1',
                      fontWeight: isSelected || dayItem.isCurrentMonth ? 700 : 400,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      transition: 'all 0.1s ease',
                    }}
                  >
                    <span>{dayItem.dayNum}</span>
                    {isSelected && (
                      <span style={{ fontSize: '0.65rem', lineHeight: 1 }}>✓</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
              <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#334155' }}>
                {tempSelectedHolidays.length} Selected
              </span>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowHolidayCalModal(false)}
                  style={{ background: '#f1f5f9', color: '#475569', border: 'none', padding: '0.5rem 1rem', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmCalendarHolidays}
                  style={{
                    background: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.5rem 1.25rem',
                    borderRadius: '10px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <i className="fa-solid fa-check"></i>
                  <span>Save Holidays</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= HOLIDAY BOTTOM SHEET POPUP ================= */}
      {showHolidayListSheet && (() => {
        const activeHolidays = holidayTarget === 'form' ? formHolidays : portalHolidays;
        return (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.55)',
              backdropFilter: 'blur(4px)',
              zIndex: 100000,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
            }}
            onClick={() => setShowHolidayListSheet(false)}
          >
            <div
              style={{
                background: '#ffffff',
                borderTopLeftRadius: '24px',
                borderTopRightRadius: '24px',
                maxWidth: '540px',
                width: '100%',
                maxHeight: '80vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 -10px 25px rgba(0,0,0,0.15)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Grab Handle */}
              <div style={{ width: '40px', height: '4px', background: '#cbd5e1', borderRadius: '4px', margin: '10px auto 0' }} />

              {/* Header */}
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1.5px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h4 style={{ margin: 0, fontWeight: 800, color: '#0f172a', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-umbrella-beach" style={{ color: '#ef4444' }}></i>
                    <span>Selected Holidays</span>
                    <span style={{ background: '#fef2f2', color: '#ef4444', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem' }}>
                      {activeHolidays.length}
                    </span>
                  </h4>
                </div>

                <button
                  type="button"
                  onClick={() => setShowHolidayListSheet(false)}
                  style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', cursor: 'pointer', fontSize: '1.1rem' }}
                >
                  &times;
                </button>
              </div>

              {/* Dates List */}
              <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1 }}>
                {activeHolidays.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}>
                    <i className="fa-regular fa-calendar-xmark" style={{ fontSize: '2.5rem', color: '#cbd5e1', marginBottom: '0.75rem', display: 'block' }}></i>
                    <p style={{ margin: 0, fontWeight: 700 }}>No holidays currently scheduled.</p>
                    <p style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>Click &quot;Add Holiday&quot; to pick dates from the calendar.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {activeHolidays
                      .slice()
                      .sort()
                      .map((dStr) => {
                        const parsedDate = new Date(dStr.includes('T') ? dStr : dStr + 'T00:00:00');
                        const isValid = !isNaN(parsedDate.getTime());
                        const formattedDate = isValid
                          ? parsedDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
                          : dStr;
                        const dayName = isValid
                          ? parsedDate.toLocaleDateString('en-US', { weekday: 'long' })
                          : '';

                        return (
                          <div
                            key={dStr}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '0.75rem 1rem',
                              background: '#f8fafc',
                              borderRadius: '12px',
                              border: '1px solid #e2e8f0',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                                <i className="fa-regular fa-calendar-day"></i>
                              </div>
                              <div>
                                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.92rem' }}>
                                  {formattedDate}
                                </div>
                                {dayName && (
                                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                                    {dayName}
                                  </div>
                                )}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => removeHoliday(dStr)}
                              style={{
                                background: '#fef2f2',
                                color: '#ef4444',
                                border: '1px solid #fecaca',
                                borderRadius: '8px',
                                width: '32px',
                                height: '32px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                              }}
                              title="Remove this holiday"
                            >
                              <i className="fa-solid fa-trash" style={{ fontSize: '0.85rem' }}></i>
                            </button>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Bottom Sheet Footer */}
              <div style={{ padding: '1rem 1.25rem', borderTop: '1.5px solid #f1f5f9', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowHolidayListSheet(false);
                    setTempSelectedHolidays([...activeHolidays]);
                    setCalViewingDate(new Date());
                    setShowHolidayCalModal(true);
                  }}
                  style={{
                    background: '#eff6ff',
                    color: '#2563eb',
                    border: '1px solid #bfdbfe',
                    padding: '0.65rem 1rem',
                    borderRadius: '10px',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <i className="fa-regular fa-calendar-plus"></i>
                  <span>Add / Edit Dates</span>
                </button>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {activeHolidays.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Clear all scheduled holidays?')) {
                          if (holidayTarget === 'form') {
                            setFormHolidays([]);
                          } else {
                            setPortalHolidays([]);
                          }
                        }
                      }}
                      style={{
                        background: '#f1f5f9',
                        color: '#64748b',
                        border: 'none',
                        padding: '0.65rem 1rem',
                        borderRadius: '10px',
                        fontWeight: 700,
                        fontSize: '0.88rem',
                        cursor: 'pointer',
                      }}
                    >
                      Clear All
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowHolidayListSheet(false)}
                    style={{
                      background: '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      padding: '0.65rem 1.25rem',
                      borderRadius: '10px',
                      fontWeight: 700,
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                    }}
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ================= ADD / EDIT PRODUCT MODAL (Matching media_1793702691549_ce9bc242.jpg) ================= */}
      {showAddProductModal && (
        <div
          className="m-prod-modal-overlay"
          onClick={() => setShowAddProductModal(false)}
        >
          <div
            className="m-prod-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="m-prod-modal-header">
              <h3 className="m-prod-modal-title">
                <i className="fa-solid fa-box-open" style={{ color: '#0f172a' }}></i>
                {editingProductIdx !== null ? 'Edit Product' : 'Add Product'}
              </h3>
              <button
                type="button"
                className="m-prod-modal-close"
                onClick={() => setShowAddProductModal(false)}
              >
                &times;
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveProductForm} className="m-prod-modal-body">
              {/* Field 1: Name */}
              <div className="m-prod-modal-field">
                <label className="m-prod-modal-label">Product / Service Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Wireless Noise Cancelling Headphones"
                  className="m-prod-modal-input"
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                />
              </div>

              {/* Field 2: Category */}
              <div className="m-prod-modal-field">
                <label className="m-prod-modal-label">Category *</label>
                {(() => {
                  const catOptions = Array.from(
                    new Set([
                      ...(activePortalListing?.storeCategories?.map((c: any) => c.label || c.name || c.tag) || []),
                      ...(activePortalListing?.products?.map((p: any) => p.storeCategory || p.category) || []),
                      activePortalListing?.category,
                      'Medicines',
                      'Baby & Mother',
                      'Health & Nutrition',
                      'Grocery & Staples',
                      'Personal Care',
                      'Beverages & Snacks',
                      'Services',
                      prodCategory,
                    ].filter(Boolean) as string[])
                  );

                  return (
                    <select
                      required
                      className="m-prod-modal-select"
                      value={prodCategory}
                      onChange={(e) => setProdCategory(e.target.value)}
                    >
                      <option value="">Select In-Store Category</option>
                      {catOptions.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  );
                })()}
              </div>

              {/* Field 3: Price */}
              <div className="m-prod-modal-field">
                <label className="m-prod-modal-label">Price *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ₹ 1,499 or On Request"
                  className="m-prod-modal-input"
                  value={prodPrice}
                  onChange={(e) => setProdPrice(e.target.value)}
                />
              </div>

              {/* Field 4: Stock Status */}
              <div className="m-prod-modal-field">
                <label className="m-prod-modal-label">Stock Status</label>
                <select
                  className="m-prod-modal-select"
                  value={prodStockStatus}
                  onChange={(e) => setProdStockStatus(e.target.value as 'in_stock' | 'out_of_stock')}
                >
                  <option value="in_stock">In Stock (Available)</option>
                  <option value="out_of_stock">Out of Stock</option>
                </select>
              </div>

              {/* Field 5: Description */}
              <div className="m-prod-modal-field">
                <label className="m-prod-modal-label">Product Description / Specifications</label>
                <textarea
                  rows={3}
                  placeholder="Enter key details, brand, warranty, colors, sizes or package contents..."
                  className="m-prod-modal-textarea"
                  value={prodDescription}
                  onChange={(e) => setProdDescription(e.target.value)}
                />
              </div>

              {/* Field 6: Mark as Top Product Highlight Box */}
              <div
                className="m-prod-top-highlight-box"
                onClick={() => setProdIsTop(!prodIsTop)}
              >
                <input
                  type="checkbox"
                  checked={prodIsTop}
                  onChange={(e) => setProdIsTop(e.target.checked)}
                  onClick={(e) => e.stopPropagation()}
                />
                <div>
                  <span className="m-prod-top-title">
                    <i className="fa-solid fa-star" style={{ color: '#eab308' }}></i> Mark as Top Product
                  </span>
                  <span className="m-prod-top-sub">(Feature in Storefront Square Shelf)</span>
                </div>
              </div>

              {/* Field 7: Product Images */}
              <div className="m-prod-modal-field">
                <label className="m-prod-modal-label">
                  Product Images (Upload up to 3 photos - 1st image is Cover)
                </label>
                <input
                  ref={prodFileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleProductUploadFiles}
                  style={{ display: 'none' }}
                />
                <div
                  className="m-prod-upload-dropzone"
                  onClick={() => prodFileInputRef.current?.click()}
                >
                  <div className="m-prod-upload-icon-circle">
                    <i className="fa-solid fa-cloud-arrow-up"></i>
                  </div>
                  <span className="m-prod-upload-hint">
                    {prodUploading
                      ? 'Uploading photos to cloud...'
                      : 'Click to upload photos (Max 3 photos - 1st is Cover)'}
                  </span>
                </div>

                {prodImages.length > 0 && (
                  <div className="m-prod-thumb-strip">
                    {prodImages.map((imgUrl, i) => (
                      <div key={i} className="m-prod-thumb-slot">
                        <img src={imgUrl} alt={`Product ${i + 1}`} />
                        {i === 0 && <span className="m-prod-thumb-cover-tag">Cover</span>}
                        <button
                          type="button"
                          className="btn-remove-thumb-slot"
                          onClick={() => setProdImages((prev) => prev.filter((_, idx) => idx !== i))}
                          title="Remove photo"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="btn-modal-save-product"
                disabled={prodUploading}
              >
                <i className="fa-solid fa-check"></i>
                {prodUploading
                  ? 'Uploading Photos...'
                  : editingProductIdx !== null
                  ? 'Save & Update Product'
                  : 'Add Product to Catalog'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ================= SELECT TOP PRODUCTS MODAL ================= */}
      {showSelectTopModal && activePortalListing && (
        <div
          className="m-prod-modal-overlay"
          onClick={() => setShowSelectTopModal(false)}
        >
          <div
            className="m-prod-modal-card"
            style={{ maxWidth: '440px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="m-prod-modal-header">
              <h3 className="m-prod-modal-title">
                <i className="fa-solid fa-star" style={{ color: '#eab308' }}></i>
                Select Top Products
              </h3>
              <button
                type="button"
                className="m-prod-modal-close"
                onClick={() => setShowSelectTopModal(false)}
              >
                &times;
              </button>
            </div>
            <div className="m-prod-modal-body">
              <p style={{ fontSize: '0.84rem', color: '#64748b', margin: '0 0 0.5rem 0' }}>
                Check the products from your catalog to feature prominently on the square shelf at the bottom of your storefront:
              </p>
              {(!activePortalListing.products || activePortalListing.products.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8', fontSize: '0.85rem' }}>
                  No products in catalog yet. Please add products to your catalog first.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {activePortalListing.products.map((p, idx) => {
                    const isTop = !!(p.isTop || p.isTopProduct);
                    const thumb = (Array.isArray(p.images) && p.images[0]) || p.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100&auto=format&fit=crop&q=80';
                    return (
                      <div
                        key={idx}
                        onClick={() => handleToggleProductTop(idx)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          padding: '0.65rem 0.85rem',
                          borderRadius: '12px',
                          border: `1.5px solid ${isTop ? '#2563eb' : '#e2e8f0'}`,
                          background: isTop ? '#eff6ff' : '#ffffff',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isTop}
                          onChange={() => handleToggleProductTop(idx)}
                          onClick={(e) => e.stopPropagation()}
                          style={{ width: '18px', height: '18px', accentColor: '#2563eb', cursor: 'pointer' }}
                        />
                        <img
                          src={thumb}
                          alt={p.name}
                          style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover' }}
                        />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <strong style={{ display: 'block', fontSize: '0.9rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {p.name}
                          </strong>
                          <span style={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: 700 }}>
                            {p.price || 'On Request'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <button
                type="button"
                className="btn-modal-save-product"
                onClick={() => setShowSelectTopModal(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= PRODUCT DETAILS PREVIEW MODAL ================= */}
      {previewProduct && (
        <div
          className="m-prod-modal-overlay"
          onClick={() => setPreviewProduct(null)}
        >
          <div
            className="m-prod-modal-card"
            style={{ maxWidth: '440px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="m-prod-modal-header">
              <h3 className="m-prod-modal-title">
                <i className="fa-solid fa-eye" style={{ color: '#2563eb' }}></i>
                Product Details
              </h3>
              <button
                type="button"
                className="m-prod-modal-close"
                onClick={() => setPreviewProduct(null)}
              >
                &times;
              </button>
            </div>
            <div className="m-prod-modal-body">
              {(() => {
                const imgs = Array.isArray(previewProduct.images) && previewProduct.images.length > 0
                  ? previewProduct.images
                  : (previewProduct.image ? [previewProduct.image] : []);
                const mainImg = imgs[0] || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&auto=format&fit=crop&q=80';
                const isInStock = previewProduct.inStock !== false && previewProduct.stockStatus !== 'out_of_stock';

                return (
                  <div>
                    <div style={{ width: '100%', height: '220px', borderRadius: '14px', overflow: 'hidden', marginBottom: '0.85rem', background: '#f1f5f9' }}>
                      <img src={mainImg} alt={previewProduct.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    {imgs.length > 1 && (
                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.85rem', overflowX: 'auto' }}>
                        {imgs.map((src, i) => (
                          <img key={i} src={src} alt="" style={{ width: '56px', height: '56px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #cbd5e1' }} />
                        ))}
                      </div>
                    )}
                    <h3 style={{ fontSize: '1.18rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.35rem 0' }}>
                      {previewProduct.name}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#2563eb' }}>
                        {previewProduct.price || 'On Request'}
                      </span>
                      <span className={`m-prod-stock-badge ${isInStock ? 'in' : 'out'}`}>
                        {isInStock ? 'In Stock' : 'Out of Stock'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.84rem', color: '#64748b', marginBottom: '0.75rem' }}>
                      <strong>Category:</strong> {previewProduct.storeCategory || previewProduct.category || 'General'}
                    </div>
                    {(previewProduct.details || previewProduct.desc || previewProduct.description) && (
                      <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '10px', fontSize: '0.85rem', color: '#334155', lineHeight: 1.5 }}>
                        {previewProduct.details || previewProduct.desc || previewProduct.description}
                      </div>
                    )}
                  </div>
                );
              })()}
              <button
                type="button"
                className="btn-modal-save-product"
                onClick={() => setPreviewProduct(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= OFFICIAL STORE QR & SHARE STANDEE MODAL ================= */}
      {qrModalListing && (
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
            backdropFilter: 'blur(3px)',
          }}
          onClick={() => setQrModalListing(null)}
        >
          <div
            className="qr-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="m-submodal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', padding: '1rem 1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <i className="fa-solid fa-qrcode" style={{ color: '#2563eb', fontSize: '1.2rem' }}></i>
                <strong style={{ fontSize: '1rem', color: '#0f172a' }}>Store QR & Table Standee</strong>
              </div>
              <button
                type="button"
                onClick={() => setQrModalListing(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#64748b' }}
              >
                &times;
              </button>
            </div>

            {/* Standee Body */}
            <div className="qr-modal-body">
              <div className="qr-standee-card">
                <div className="standee-header">
                  <span className="standee-brand-pill">
                    <i className="fa-solid fa-store"></i> LOCAL BAZAR
                  </span>
                  <span className="standee-verified-badge">
                    <i className="fa-solid fa-circle-check"></i> Verified Merchant
                  </span>
                </div>

                <div className="standee-store-info">
                  <img
                    src={qrModalListing.image || 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=140&auto=format&fit=crop&q=80'}
                    alt={qrModalListing.name}
                    className="standee-avatar"
                  />
                  <h3 className="standee-store-name">{qrModalListing.name}</h3>
                  <p className="standee-store-meta">
                    <i className="fa-solid fa-location-dot" style={{ color: '#ef4444' }}></i>
                    <span>{qrModalListing.category} • {qrModalListing.city}</span>
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
                        typeof window !== 'undefined' ? `${window.location.origin}/shops/${qrModalListing.id}` : ''
                      )}`}
                      alt="Store QR Code"
                    />
                  </div>
                </div>

                <div className="standee-footer">
                  <div className="standee-scan-prompt">
                    <i className="fa-solid fa-camera"></i>
                    <span>Scan with any Camera or UPI app to view catalog</span>
                  </div>

                  <div className="standee-link-row">
                    <span className="standee-link-text">
                      {typeof window !== 'undefined' ? `${window.location.host}/shops/${qrModalListing.id}` : ''}
                    </span>
                    <button
                      type="button"
                      className={`standee-copy-btn ${qrCopied ? 'copied' : ''}`}
                      onClick={() => {
                        if (typeof window !== 'undefined') {
                          navigator.clipboard.writeText(`${window.location.origin}/shops/${qrModalListing.id}`);
                          setQrCopied(true);
                          setTimeout(() => setQrCopied(false), 2000);
                        }
                      }}
                    >
                      <i className={qrCopied ? 'fa-solid fa-check' : 'fa-regular fa-copy'}></i>
                      <span>{qrCopied ? 'Copied!' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="qr-modal-footer">
              <button
                type="button"
                className="btn-qr-action download"
                onClick={() => {
                  window.open(
                    `https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=12&data=${encodeURIComponent(
                      typeof window !== 'undefined' ? `${window.location.origin}/shops/${qrModalListing.id}` : ''
                    )}`,
                    '_blank'
                  );
                }}
              >
                <i className="fa-solid fa-arrow-down-to-bracket"></i>
                <span>Save / Print QR</span>
              </button>
              <button
                type="button"
                className="btn-qr-action share"
                onClick={() => {
                  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/shops/${qrModalListing.id}` : '';
                  if (navigator.share) {
                    navigator.share({
                      title: qrModalListing.name,
                      text: `Visit ${qrModalListing.name} on Local Bazar:`,
                      url: shareUrl,
                    }).catch(() => {});
                  } else {
                    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(`Check out ${qrModalListing.name} on Local Bazar: ${shareUrl}`)}`, '_blank');
                  }
                }}
              >
                <i className="fa-brands fa-whatsapp"></i>
                <span>Share</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Alert Notification Modal (Popup) */}
      {alertData.show && (
        <div
          className="lb-alert-overlay lb-alert-modal-overlay"
          id="lbAlertOverlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 9999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.25rem',
            boxSizing: 'border-box'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setAlertData((prev) => ({ ...prev, show: false }));
              if (alertData.onConfirm) alertData.onConfirm();
            }
          }}
        >
          <div
            className="lb-alert-card lb-alert-modal-card"
            style={{
              background: '#ffffff',
              width: '100%',
              maxWidth: '430px',
              borderRadius: '24px',
              padding: '2.2rem 1.8rem 1.8rem 1.8rem',
              boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.4), 0 0 0 1px rgba(226, 232, 240, 0.9)',
              textAlign: 'center',
              position: 'relative',
              boxSizing: 'border-box'
            }}
          >
            {/* Close Cross Button */}
            <button
              type="button"
              aria-label="Close"
              onClick={() => {
                setAlertData((prev) => ({ ...prev, show: false }));
                if (alertData.onConfirm) alertData.onConfirm();
              }}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: '#f1f5f9',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.9rem',
                transition: 'all 0.2s ease'
              }}
            >
              <i className="fa-solid fa-xmark"></i>
            </button>

            {/* Icon */}
            <div
              className={`lb-alert-icon-wrap ${alertData.type}`}
              id="lbAlertIconWrap"
              style={{
                width: '72px',
                height: '72px',
                margin: '0 auto 1.25rem auto',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem'
              }}
            >
              <i
                className={
                  alertData.type === 'success'
                    ? 'fa-solid fa-circle-check'
                    : alertData.type === 'error'
                    ? 'fa-solid fa-circle-xmark'
                    : 'fa-solid fa-triangle-exclamation'
                }
                id="lbAlertIcon"
              ></i>
            </div>

            {/* Title */}
            <h3
              className="lb-alert-title"
              id="lbAlertTitle"
              style={{
                fontSize: '1.3rem',
                fontWeight: 800,
                color: '#0f172a',
                margin: '0 0 0.55rem 0',
                letterSpacing: '-0.3px',
                lineHeight: 1.3
              }}
            >
              {alertData.title}
            </h3>

            {/* Description */}
            <div
              className="lb-alert-desc"
              id="lbAlertDesc"
              style={{
                fontSize: '0.93rem',
                color: '#475569',
                lineHeight: 1.58,
                margin: '0 0 1.6rem 0',
                fontWeight: 500
              }}
              dangerouslySetInnerHTML={{ __html: alertData.message }}
            ></div>

            {/* Action Button Row */}
            <div className="lb-alert-action-row" style={{ width: '100%' }}>
              <button
                type="button"
                className={`btn-lb-alert-primary ${alertData.type}`}
                id="lbAlertOkBtn"
                onClick={() => {
                  setAlertData((prev) => ({ ...prev, show: false }));
                  if (alertData.onConfirm) alertData.onConfirm();
                }}
                style={{
                  width: '100%',
                  padding: '0.85rem 1.6rem',
                  fontSize: '0.96rem',
                  fontWeight: 700,
                  borderRadius: '14px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.65rem',
                  cursor: 'pointer',
                  border: 'none',
                  boxShadow: alertData.type === 'success' ? '0 4px 16px rgba(22, 163, 74, 0.35)' : undefined
                }}
              >
                <span>{alertData.buttonText}</span>
                <i className={alertData.type === 'success' ? 'fa-solid fa-arrow-right' : 'fa-solid fa-check'}></i>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
