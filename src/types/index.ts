export interface ProductItem {
  id?: string;
  name: string;
  price?: string;
  image?: string;
  images?: string[];
  img?: string;
  inStock?: boolean;
  stockStatus?: 'in_stock' | 'out_of_stock' | string;
  storeCategory?: string;
  category?: string;
  desc?: string;
  details?: string;
  description?: string;
  isTop?: boolean;
  isTopProduct?: boolean;
  reviews?: ReviewItem[];
  rating?: number;
  ratingCount?: number;
}

export interface DoctorItem {
  id?: string;
  name: string;
  degree?: string;
  specialty?: string;
  days?: string;
  timing?: string;
  fees?: string;
}

export interface DailyScheduleDay {
  isOpen: boolean;
  openTime: string;
  openAmPm: string;
  closeTime: string;
  closeAmPm: string;
}

export interface StoreCategoryItem {
  label: string;
  tag: string;
  icon?: string;
  name?: string;
}

export interface Listing {
  id: string;
  name: string;
  category: string;
  city: string;
  phone: string;
  address: string;
  mapLink?: string;
  whatsapp?: string;
  website?: string;
  facebook?: string;
  instagram?: string;
  image?: string;
  gallery?: string[];
  images?: string[];
  banners?: string[];
  openDays?: string[];
  scheduleTimings?: string;
  dailySchedule?: Record<string, DailyScheduleDay>;
  holidays?: string[];
  products?: ProductItem[];
  storeCategories?: StoreCategoryItem[];
  doctors?: DoctorItem[];
  desc?: string;
  ownerId?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  ownerName?: string;
  createdBy?: string;
  status?: 'Approved' | 'Pending' | 'Draft' | 'Rejected' | string;
  isPublic?: boolean;
  verified?: boolean;
  trustBadge?: boolean;
  trustBadgeActivatedAt?: number;
  trustBadgeExpiresAt?: number;
  reviews?: ReviewItem[];
  date?: string;
  lastUpdated?: string;
  rating?: number;
  reviewsCount?: number;
}

export interface UserProfile {
  id: string;
  uid?: string;
  name: string;
  email: string;
  phone?: string;
  city?: string;
  state?: string;
  pincode?: string;
  pinCode?: string;
  address?: string;
  gender?: string;
  dob?: string;
  dateOfBirth?: string;
  photoURL?: string;
  role?: string;
  joinedDate?: string;
  verified?: boolean;
  blocked?: boolean;
  isBlocked?: boolean;
}

export interface CategoryItem {
  id?: string;
  name: string;
  alternativeName?: string;
  altNames?: string[];
  icon?: string;
  image?: string;
  storeCategories?: (string | StoreCategoryItem)[];
  subcategories?: string[];
}

export interface CityItem {
  id?: string;
  name: string;
  district?: string;
  state?: string;
  pinCode?: string;
  pincode?: string;
  popular?: boolean;
  active?: boolean;
  image?: string;
  icon?: string;
}

export interface ReviewItem {
  id: string;
  userId?: string;
  userEmail?: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  comment: string;
  timestamp: number;
  dateStr?: string;
  ownerReply?: {
    text: string;
    timestamp: number;
    dateStr?: string;
  };
}

export interface MailAttachment {
  name: string;
  type: string; // 'jpg' | 'png' | 'pdf' | 'doc' | 'docx' | 'xls' | 'xlsx' | string;
  size?: string;
  url: string;
}

export interface MailReplyItem {
  id: string;
  sender: 'user' | 'admin';
  senderName: string;
  message: string;
  attachments?: MailAttachment[];
  timestamp: number;
  date: string;
}

export interface MailItem {
  id: string;
  toEmail?: string;
  toName?: string;
  from?: string;
  senderName?: string;
  senderEmail?: string;
  senderPhone?: string;
  senderId?: string;
  subject: string;
  message?: string;
  body?: string;
  date?: string;
  timestamp?: number;
  read?: boolean;
  folder?: 'inbox' | 'sent';
  isSent?: boolean;
  attachments?: MailAttachment[];
  replies?: MailReplyItem[];
  status?: 'open' | 'replied' | 'closed' | string;
}

export interface ClaimDocument {
  name: string;
  type: string; // 'jpg' | 'png' | 'pdf' | 'doc' | 'docx' | 'xls' | 'xlsx' | string;
  size?: string;
  url: string;
}

export interface ClaimItem {
  id: string;
  listingId: string;
  listingName: string;
  city?: string;
  category?: string;
  applicantName?: string;
  applicantPhone?: string;
  applicantEmail?: string;
  claimantName?: string;
  claimantPhone?: string;
  claimantEmail?: string;
  claimantId?: string;
  proofDoc?: string;
  documents?: (ClaimDocument | string)[];
  remarks?: string;
  message?: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'pending' | 'approved' | 'rejected' | string;
  adminReply?: string;
  date?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface TrustBadgeSettings {
  originalPrice: number; // strikethrough / crossed price e.g. 499
  offerPrice: number; // final price e.g. 99
  period: string; // e.g. "Year"
  upiId?: string;
  upiName?: string;
  qrImageUrl?: string;
  instructions?: string;
  updatedAt?: number;
}

export interface TrustRequest {
  id: string;
  listingId: string;
  listingName?: string;
  businessName?: string;
  city?: string;
  category?: string;
  ownerName?: string;
  applicantName?: string;
  applicantId?: string;
  phone?: string;
  email?: string;
  docType?: string;
  tradeLicense?: string;
  gstNumber?: string;
  docProof?: string;
  amountPaid?: number | string;
  transactionId?: string;
  paymentProof?: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'pending' | 'approved' | 'rejected' | string;
  adminReply?: string;
  date?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface CityRequestItem {
  id: string;
  cityName: string;
  requestedBy?: string;
  userPhone?: string;
  date?: string;
  status: 'pending' | 'approved' | 'rejected' | string;
}

export interface CategoryRequestItem {
  id: string;
  categoryName: string;
  requestedBy?: string;
  userPhone?: string;
  date?: string;
  status: 'pending' | 'approved' | 'rejected' | string;
}

export interface NewsItem {
  id: string;
  title: string;
  content: string;
  image?: string;
  link?: string;
  active?: boolean;
  date?: string;
}

export interface SlideBannerItem {
  id: string;
  title?: string;
  imageUrl: string;
  link?: string;
  active?: boolean;
  createdAt?: number;
}

export interface TargetNewsBannerItem {
  id: string;
  city: string;
  category: string;
  textNews?: string;
  slideBanners?: SlideBannerItem[];
  updatedAt?: number;
}

export interface EmptyStoreBannerSlot {
  slot: number; // 1, 2, 3, 4
  title?: string;
  imageUrl: string;
  link?: string;
  active?: boolean;
}

export interface InquiryReply {
  sender: 'store' | 'merchant' | 'customer';
  text: string;
  time: string;
  createdAt: number;
}

export interface InquiryItem {
  id: string;
  storeId: string;
  storeName?: string;
  storePhone?: string;
  sender: 'customer' | 'store';
  customerName?: string;
  customerPhone?: string;
  customerId?: string;
  text: string;
  time: string;
  createdAt: number;
  product?: {
    id?: string;
    name: string;
    price?: string;
    image?: string;
  } | null;
  status?: 'unread' | 'read' | 'replied';
  replies?: InquiryReply[];
}

export function isTrustBadgeActive(listing: Partial<Listing> | null | undefined): boolean {
  if (!listing || !listing.trustBadge) return false;
  if (listing.trustBadgeExpiresAt && Date.now() > listing.trustBadgeExpiresAt) {
    return false;
  }
  return true;
}

export function getTrustBadgeDaysRemaining(listing: Partial<Listing> | null | undefined): number {
  if (!listing || !listing.trustBadge) return 0;
  if (!listing.trustBadgeExpiresAt) return 365;
  const diff = listing.trustBadgeExpiresAt - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
