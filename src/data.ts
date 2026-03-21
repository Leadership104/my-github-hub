import type { Destination, PlaceCategory, SubCategory, Group } from './types';

export const DESTINATIONS: Destination[] = [
  { id: 'chiangmai', city: 'Chiang Mai', country: 'Thailand', emoji: '🏔️', lat: 18.7883, lng: 98.9853, rating: 4.8, pop: '7M+ nomads', speed: 52, safetyScore: 8.2, monthlyCost: 1200, weatherDesc: 'Warm & Sunny', temp: 28, tags: ['Affordable', 'Digital Nomad'], popular: true, desc: 'Ancient temples, cool mountains, fast internet, and the most affordable nomad lifestyle in Asia.' },
  { id: 'lisbon', city: 'Lisbon', country: 'Portugal', emoji: '🇵🇹', lat: 38.7169, lng: -9.1399, rating: 4.7, pop: '6M+ nomads', speed: 48, safetyScore: 8.7, monthlyCost: 1605, weatherDesc: 'Mild & Breezy', temp: 18, tags: ['Bitcoin-Friendly', 'Tax Perks'], popular: true, desc: 'Sunny capital with pastel streets, great food, crypto-friendly culture, and NHR tax regime.' },
  { id: 'bali', city: 'Bali', country: 'Indonesia', emoji: '🌴', lat: -8.3405, lng: 115.0919, rating: 4.8, pop: '8M+ nomads', speed: 38, safetyScore: 7.9, monthlyCost: 1400, weatherDesc: 'Tropical & Lush', temp: 30, tags: ['Surf & Co-Work', 'Nomad Hub'], popular: true, desc: 'Tropical paradise with rice terraces, temples, and a world-class digital nomad community in Canggu.' },
  { id: 'bangkok', city: 'Bangkok', country: 'Thailand', emoji: '🛕', lat: 13.7563, lng: 100.5018, rating: 4.7, pop: '11M+ nomads', speed: 45, safetyScore: 7.5, monthlyCost: 1100, weatherDesc: 'Hot & Vibrant', temp: 32, tags: ['Street Food', 'Nightlife'], popular: true, desc: 'Vibrant street food, temples, and a booming nomad scene.' },
  { id: 'tokyo', city: 'Tokyo', country: 'Japan', emoji: '🗼', lat: 35.6762, lng: 139.6503, rating: 4.9, pop: '14M+ nomads', speed: 78, safetyScore: 9.4, monthlyCost: 2800, weatherDesc: 'Cool & Clear', temp: 16, tags: ['BTC Friendly', 'Ultra-Modern'], popular: false, desc: 'Ultra-modern city with ancient temples, perfect transit, and incredible food.' },
  { id: 'barcelona', city: 'Barcelona', country: 'Spain', emoji: '🏖️', lat: 41.3851, lng: 2.1734, rating: 4.8, pop: '7M+ nomads', speed: 55, safetyScore: 7.8, monthlyCost: 2200, weatherDesc: 'Sunny & Warm', temp: 22, tags: ['Beach Life', 'Startup Hub'], popular: false, desc: "Architecture, beaches, and an incredible startup scene." },
  { id: 'medellin', city: 'Medellín', country: 'Colombia', emoji: '🌺', lat: 6.2476, lng: -75.5658, rating: 4.6, pop: '5M+ nomads', speed: 32, safetyScore: 6.8, monthlyCost: 900, weatherDesc: 'Spring All Year', temp: 22, tags: ['Budget Pick', 'Crypto Scene'], popular: false, desc: 'The city of eternal spring. Growing crypto scene, affordable living.' },
  { id: 'dubai', city: 'Dubai', country: 'UAE', emoji: '🏙️', lat: 25.2048, lng: 55.2708, rating: 4.7, pop: '9M+ nomads', speed: 62, safetyScore: 8.9, monthlyCost: 3200, weatherDesc: 'Sunny & Hot', temp: 35, tags: ['Tax-Free', 'Luxury'], popular: false, desc: 'Tax-free hub with world-class infrastructure and crypto-friendly regulations.' },
];

const getHour = () => new Date().getHours();

export const getCategories = (): PlaceCategory[] => [
  { id: 'food', label: 'Food', emoji: getHour() < 10 ? '🍳' : getHour() < 15 ? '🍜' : getHour() < 20 ? '🍽️' : '🌮', query: 'restaurants' },
  { id: 'cafe', label: 'Cafes', emoji: getHour() < 11 ? '☕' : getHour() < 16 ? '🧋' : '🍵', query: 'cafes' },
  { id: 'hotel', label: 'Hotels', emoji: '🏨', query: 'hotels' },
  { id: 'shop', label: 'Shopping', emoji: '🛍️', query: 'shopping' },
  { id: 'transport', label: 'Transit', emoji: '🚇', query: 'public transit' },
  { id: 'gym', label: 'Fitness', emoji: '💪', query: 'gym' },
  { id: 'beach', label: 'Beaches', emoji: '🏖️', query: 'beach' },
  { id: 'nightlife', label: 'Nightlife', emoji: '🎵', query: 'nightlife bars' },
  { id: 'atm', label: 'ATM', emoji: '🏧', query: 'atm cash machine' },
  { id: 'btcatm', label: 'BTC ATM', emoji: '₿', query: 'bitcoin atm cryptocurrency' },
  { id: 'hospital', label: 'Medical', emoji: '🏥', query: 'hospital' },
  { id: 'pharmacy', label: 'Pharmacy', emoji: '💊', query: 'pharmacy' },
];

export const CATEGORY_SUBS: Record<string, SubCategory[]> = {
  food: [
    { label: 'American', query: 'american restaurant', emoji: '🍔' },
    { label: 'Bakery', query: 'bakery bread', emoji: '🥐' },
    { label: 'Chinese', query: 'chinese restaurant', emoji: '🥡' },
    { label: 'Fast Food', query: 'fast food', emoji: '🍟' },
    { label: 'Italian', query: 'italian restaurant', emoji: '🍝' },
    { label: 'Japanese', query: 'japanese restaurant', emoji: '🍱' },
    { label: 'Mexican', query: 'mexican restaurant', emoji: '🌮' },
    { label: 'Pizza', query: 'pizza restaurant', emoji: '🍕' },
    { label: 'Seafood', query: 'seafood restaurant', emoji: '🦞' },
    { label: 'Thai', query: 'thai restaurant', emoji: '🍜' },
    { label: 'All Food', query: 'restaurants', emoji: '🍽️' },
  ],
  cafe: [
    { label: 'Coffee', query: 'coffee cafe', emoji: '☕' },
    { label: 'Boba / Tea', query: 'boba tea shop', emoji: '🧋' },
    { label: 'Coworking', query: 'coworking cafe wifi', emoji: '💻' },
    { label: 'Juice Bar', query: 'juice bar smoothie', emoji: '🧃' },
    { label: 'All Cafes', query: 'cafes', emoji: '🍵' },
  ],
  shop: [
    { label: 'Mall', query: 'shopping mall', emoji: '🏬' },
    { label: 'Grocery', query: 'supermarket grocery', emoji: '🛒' },
    { label: 'Electronics', query: 'electronics store', emoji: '📱' },
    { label: 'Clothing', query: 'clothing store fashion', emoji: '👔' },
    { label: 'All Shops', query: 'shopping', emoji: '🛍️' },
  ],
  nightlife: [
    { label: 'Bar', query: 'bar cocktail lounge', emoji: '🍸' },
    { label: 'Nightclub', query: 'nightclub dance', emoji: '🎉' },
    { label: 'Live Music', query: 'live music venue', emoji: '🎵' },
    { label: 'Rooftop', query: 'rooftop bar', emoji: '🌃' },
  ],
};

export const PHRASES: Record<string, { label: string; phrases: { en: string; local: string; phon: string }[] }> = {
  es: { label: '🇪🇸 Spanish', phrases: [
    { en: 'Hello', local: 'Hola', phon: 'OH-lah' },
    { en: 'Thank you', local: 'Gracias', phon: 'GRAH-see-ahs' },
    { en: 'Where is…?', local: '¿Dónde está…?', phon: 'DOHN-deh eh-STAH' },
    { en: 'How much?', local: '¿Cuánto cuesta?', phon: 'KWAHN-toh KWES-tah' },
    { en: 'Help!', local: '¡Ayuda!', phon: 'ah-YOO-dah' },
    { en: 'Bathroom', local: 'Baño', phon: 'BAH-nyoh' },
  ]},
  ja: { label: '🇯🇵 Japanese', phrases: [
    { en: 'Hello', local: 'こんにちは', phon: 'kon-NEE-chee-wah' },
    { en: 'Thank you', local: 'ありがとう', phon: 'ah-ree-GAH-toh' },
    { en: 'Where is…?', local: '…はどこですか？', phon: 'wa DOH-koh des-ka' },
    { en: 'How much?', local: 'いくらですか？', phon: 'ee-KOO-rah des-ka' },
    { en: 'Help!', local: '助けて！', phon: 'tah-SOO-keh-teh' },
  ]},
  th: { label: '🇹🇭 Thai', phrases: [
    { en: 'Hello', local: 'สวัสดี', phon: 'sa-wat-DEE' },
    { en: 'Thank you', local: 'ขอบคุณ', phon: 'kohp-KOON' },
    { en: 'How much?', local: 'เท่าไหร่', phon: 'tao-RAI' },
    { en: 'Help!', local: 'ช่วยด้วย', phon: 'CHOO-ay duay' },
  ]},
  pt: { label: '🇵🇹 Portuguese', phrases: [
    { en: 'Hello', local: 'Olá', phon: 'oh-LAH' },
    { en: 'Thank you', local: 'Obrigado/a', phon: 'oh-bree-GAH-doo' },
    { en: 'Where is…?', local: 'Onde fica…?', phon: 'OHN-jee FEE-kah' },
    { en: 'How much?', local: 'Quanto custa?', phon: 'KWAHN-too KOOS-tah' },
  ]},
  fr: { label: '🇫🇷 French', phrases: [
    { en: 'Hello', local: 'Bonjour', phon: 'bohn-ZHOOR' },
    { en: 'Thank you', local: 'Merci', phon: 'mehr-SEE' },
    { en: 'Where is…?', local: 'Où est…?', phon: 'oo EH' },
    { en: 'Help!', local: 'Au secours!', phon: 'oh suh-KOOR' },
  ]},
  id: { label: '🇮🇩 Indonesian', phrases: [
    { en: 'Hello', local: 'Halo', phon: 'HAH-loh' },
    { en: 'Thank you', local: 'Terima kasih', phon: 'teh-REE-mah KAH-see' },
    { en: 'How much?', local: 'Berapa?', phon: 'beh-RAH-pah' },
    { en: 'Help!', local: 'Tolong!', phon: 'TOH-long' },
  ]},
  ar: { label: '🇦🇪 Arabic', phrases: [
    { en: 'Hello', local: 'مرحبا', phon: 'MAR-ha-ba' },
    { en: 'Thank you', local: 'شكرا', phon: 'SHOOK-ran' },
    { en: 'How much?', local: 'بكم؟', phon: 'bi-KAM' },
    { en: 'Help!', local: 'مساعدة!', phon: 'moo-SAH-ah-dah' },
  ]},
  ko: { label: '🇰🇷 Korean', phrases: [
    { en: 'Hello', local: '안녕하세요', phon: 'ahn-nyeong-ha-SE-yo' },
    { en: 'Thank you', local: '감사합니다', phon: 'gam-sa-HAM-ni-da' },
    { en: 'How much?', local: '얼마예요?', phon: 'eol-MA-ye-yo' },
  ]},
};

export const TRANSPORT_LINKS = [
  { emoji: '✈️', label: 'Flights', url: 'https://www.skyscanner.com/' },
  { emoji: '🏨', label: 'Hotels', url: 'https://www.booking.com/' },
  { emoji: '🚗', label: 'Car Rental', url: 'https://www.rentalcars.com/' },
  { emoji: '🚢', label: 'Cruise', url: 'https://www.cruisecritic.com/' },
  { emoji: '🚕', label: 'Uber', url: 'https://uber.com/' },
  { emoji: '🛻', label: 'Lyft', url: 'https://lyft.com/' },
];

export const GROUPS: Group[] = [
  { id: '1', name: 'BTC Nomads 🌍', emoji: '₿', members: 342, lastMessage: 'Anyone know good BTC cafes in Lisbon?', unread: 3, messages: [
    { id: 'm1', sender: 'SatoshiTraveler', text: 'Anyone know good BTC cafes in Lisbon?', mine: false, time: '10:30 AM' },
    { id: 'm2', sender: 'PortugalNomad', text: 'Check out Copenhagen Coffee Lab — they accept Lightning!', mine: false, time: '10:32 AM' },
    { id: 'm3', sender: 'You', text: 'Also try Zenith Brunch & Cocktails, great vibe 🔥', mine: true, time: '10:35 AM' },
  ]},
  { id: '2', name: 'SE Asia Digital Nomads', emoji: '🌴', members: 1205, lastMessage: 'New coworking space opened in Canggu!', unread: 7, messages: [
    { id: 'm4', sender: 'BaliRemote', text: 'New coworking space opened in Canggu!', mine: false, time: '9:15 AM' },
    { id: 'm5', sender: 'ChiangMaiDev', text: 'Nice! What\'s the day rate?', mine: false, time: '9:20 AM' },
  ]},
  { id: '3', name: 'Safety Alerts Network', emoji: '🛡️', members: 890, lastMessage: 'Flooding advisory lifted for Bangkok', unread: 0, messages: [
    { id: 'm6', sender: 'SafetyBot', text: 'Flooding advisory lifted for Bangkok. All clear! ✅', mine: false, time: 'Yesterday' },
  ]},
  { id: '4', name: 'Budget Travelers Club', emoji: '💰', members: 567, lastMessage: '$15/night hostels in Medellín 🔥', unread: 2, messages: [
    { id: 'm7', sender: 'BudgetKing', text: '$15/night hostels in Medellín 🔥', mine: false, time: '8:00 AM' },
  ]},
];
