import { ProductItem, StoreCategoryItem, Listing } from '@/types';

export const DEFAULT_LISTINGS: Listing[] = [
  {
    id: 'LB-GROCERY-01',
    name: 'Maa Tara Grocery & Supermarket',
    category: 'Grocery Store',
    city: 'Kolkata',
    address: '14/2 Rashbehari Avenue, Gariahat, Kolkata - 700019',
    phone: '+91 98301 23456',
    whatsapp: '+91 98301 23456',
    status: 'approved',
    isPublic: true,
    verified: true,
    trustBadge: true,
    rating: 4.8,
    reviewsCount: 34,
    image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&auto=format&fit=crop&q=80',
    desc: 'Complete grocery, daily staples, fresh dairy, packaged foods, and daily essentials with instant home delivery.',
    openDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    scheduleTimings: '08:00 AM - 10:00 PM',
    products: [
      { name: 'Basmati Rice Premium (5kg)', price: '₹450', inStock: true, category: 'Rice & Wheat', image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500' },
      { name: 'Fortune Mustard Oil (1L)', price: '₹145', inStock: true, category: 'Cooking Oil', image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=500' },
      { name: 'Tata Salt (1kg)', price: '₹28', inStock: true, category: 'Spices & Salt', image: 'https://images.unsplash.com/photo-1518843875459-f738682238a6?w=500' },
      { name: 'Amul Taaza Milk (500ml)', price: '₹27', inStock: true, category: 'Dairy & Milk', image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=500' }
    ]
  },
  {
    id: 'LB-PHARMACY-01',
    name: 'Apollo Pharmacy & Medical Store',
    category: 'Pharmacy & Medical Store',
    city: 'Kolkata',
    address: '88 Shyama Prasad Mukherjee Road, Kalighat, Kolkata - 700026',
    phone: '+91 98310 98765',
    whatsapp: '+91 98310 98765',
    status: 'approved',
    isPublic: true,
    verified: true,
    trustBadge: true,
    rating: 4.9,
    reviewsCount: 52,
    image: 'https://images.unsplash.com/photo-1586015555751-63bb77f4322a?w=800&auto=format&fit=crop&q=80',
    desc: '24x7 verified retail pharmacy offering genuine medicines, healthcare devices, baby care, and emergency first aid.',
    openDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    scheduleTimings: '24 Hours Open',
    products: [
      { name: 'Paracetamol 650mg Dolo', price: '₹32', inStock: true, category: 'Medicine', image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500' },
      { name: 'Digital Blood Pressure Monitor', price: '₹1,450', inStock: true, category: 'Health Devices', image: 'https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=500' },
      { name: 'N95 Protective Face Masks (5 Pack)', price: '₹120', inStock: true, category: 'First Aid', image: 'https://images.unsplash.com/photo-1584634731339-252c581abfc5?w=500' },
      { name: 'Dettol Antiseptic Liquid (500ml)', price: '₹195', inStock: true, category: 'Healthcare', image: 'https://images.unsplash.com/photo-1584744982491-665216d95f8b?w=500' }
    ]
  },
  {
    id: 'LB-GROCERY-02',
    name: 'Annapurna Daily Needs & Kirana Store',
    category: 'Grocery Store',
    city: 'Durgapur',
    address: 'City Centre Market, Durgapur, Paschim Bardhaman - 713216',
    phone: '+91 94340 11223',
    whatsapp: '+91 94340 11223',
    status: 'approved',
    isPublic: true,
    verified: true,
    trustBadge: true,
    rating: 4.7,
    reviewsCount: 28,
    image: 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=800&auto=format&fit=crop&q=80',
    desc: 'Authentic local Kirana store with fresh spices, pulses, rice, wheat flour, and branded packaged snacks.',
    openDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    scheduleTimings: '07:30 AM - 09:30 PM'
  },
  {
    id: 'LB-PHARMACY-02',
    name: 'Sanjivani Chemist & Medicine Counter',
    category: 'Pharmacy & Medical Store',
    city: 'Howrah',
    address: '22 G.T. Road, Howrah Maidan, Howrah - 711101',
    phone: '+91 98322 44556',
    whatsapp: '+91 98322 44556',
    status: 'approved',
    isPublic: true,
    verified: true,
    trustBadge: true,
    rating: 4.8,
    reviewsCount: 41,
    image: 'https://images.unsplash.com/photo-1576602976047-174e57a47881?w=800&auto=format&fit=crop&q=80',
    desc: 'Government licensed retail chemist stocked with chronic medicines, diabetic care, surgical supplies, and baby formulas.',
    openDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    scheduleTimings: '08:00 AM - 11:00 PM'
  }
];

export const DEFAULT_GROCERY_CATS: StoreCategoryItem[] = [
  { label: 'Oils & Ghee', tag: 'oils-ghee', icon: '🍯' },
  { label: 'Rice', tag: 'rice', icon: '🍚' },
  { label: 'Masala', tag: 'masala', icon: '🧂' },
  { label: 'Dal & Pulses', tag: 'dal-pulses', icon: '🥘' },
  { label: 'Atta & Flours', tag: 'atta-flours', icon: '🌾' },
];

export const DEMO_GROCERY_PRODUCTS: ProductItem[] = [
  {
    id: 'prod-demo-1',
    name: 'Mobile Keypad Phone',
    price: '₹999',
    storeCategory: 'oils-ghee',
    stockStatus: 'in_stock',
    isTop: true,
    isTopProduct: true,
    images: [
      'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1580910051074-3eb694886505?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80'
    ],
    details: 'Dual SIM 4G feature mobile phone with long-lasting battery, torch, FM radio & 1 year brand warranty.'
  },
  {
    id: 'prod-demo-2',
    name: 'Fortune Kachi Ghani Mustard Oil (1L)',
    price: '₹155',
    storeCategory: 'oils-ghee',
    stockStatus: 'in_stock',
    isTop: true,
    isTopProduct: true,
    images: [
      'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=500&auto=format&fit=crop&q=80'
    ],
    details: 'Pure cold-pressed mustard oil with natural pungency and strong aroma. Rich in Omega-3.'
  },
  {
    id: 'prod-demo-3',
    name: 'Amul Pure Cow Ghee (1L)',
    price: '₹590',
    storeCategory: 'oils-ghee',
    stockStatus: 'in_stock',
    isTop: true,
    images: [
      'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=500&auto=format&fit=crop&q=80'
    ],
    details: 'Traditional granular golden cow ghee made from fresh milk cream. Ideal for daily cooking & sweets.'
  },
  {
    id: 'prod-demo-4',
    name: 'India Gate Basmati Rice Rozzana (5kg)',
    price: '₹410',
    storeCategory: 'rice',
    stockStatus: 'in_stock',
    images: [
      'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80'
    ],
    details: 'Daily feast medium grain aromatic Basmati rice. Aged for fluffy non-sticky grains.'
  },
  {
    id: 'prod-demo-5',
    name: 'Daawat Super Basmati Rice (1kg)',
    price: '₹140',
    storeCategory: 'rice',
    stockStatus: 'in_stock',
    images: [
      'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80'
    ],
    details: 'Extra long slender basmati grains with rich aroma, perfect for special occasions & Pulao.'
  },
  {
    id: 'prod-demo-6',
    name: 'Tata Sampann Turmeric Powder (500g)',
    price: '₹125',
    storeCategory: 'masala',
    stockStatus: 'in_stock',
    images: [
      'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80'
    ],
    details: 'Contains natural essential oils. Minimum 3% curcumin guarantee for immunity & health.'
  },
  {
    id: 'prod-demo-7',
    name: 'Everest Garam Masala (100g)',
    price: '₹88',
    storeCategory: 'masala',
    stockStatus: 'in_stock',
    images: [
      'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80'
    ],
    details: 'Select blend of 13 whole aromatic spices roasted and ground to perfection.'
  },
  {
    id: 'prod-demo-8',
    name: 'Tata Sampann Unpolished Toor Dal (1kg)',
    price: '₹168',
    storeCategory: 'dal-pulses',
    stockStatus: 'in_stock',
    images: [
      'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=500&auto=format&fit=crop&q=80'
    ],
    details: 'Rich in dietary protein. Unpolished dal retains natural wholesomeness & authentic taste.'
  },
  {
    id: 'prod-demo-9',
    name: 'Aashirvaad Sharbati Atta (10kg)',
    price: '₹420',
    storeCategory: 'atta-flours',
    stockStatus: 'in_stock',
    images: [
      'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500&auto=format&fit=crop&q=80'
    ],
    details: 'Made from grains grown in Sehore MP. Makes softer, sweet rotis with great aroma.'
  }
];
