import type { Destination, PlaceCategory, SubCategory, Group } from './types';

export const DESTINATIONS: Destination[] = [
  { id: 'chiangmai', city: 'Chiang Mai', country: 'Thailand', emoji: '🏔️', lat: 18.7883, lng: 98.9853, rating: 4.8, pop: '7M+ nomads', wikiTitle: 'Chiang Mai', speed: 52, safetyScore: 8.2, monthlyCost: 1200, weatherDesc: 'Warm & Sunny', temp: 28, tags: ['Affordable', 'Digital Nomad'], popular: true, desc: 'Ancient temples, cool mountains, fast internet, and the most affordable nomad lifestyle in Asia.' },
  { id: 'lisbon', city: 'Lisbon', country: 'Portugal', emoji: '🇵🇹', lat: 38.7169, lng: -9.1399, rating: 4.7, pop: '6M+ nomads', wikiTitle: 'Lisbon', speed: 48, safetyScore: 8.7, monthlyCost: 1605, weatherDesc: 'Mild & Breezy', temp: 18, tags: ['Bitcoin-Friendly', 'Tax Perks'], popular: true, desc: 'Sunny capital with pastel streets, great food, crypto-friendly culture, and NHR tax regime.' },
  { id: 'bali', city: 'Bali', country: 'Indonesia', emoji: '🌴', lat: -8.3405, lng: 115.0919, rating: 4.8, pop: '8M+ nomads', wikiTitle: 'Bali', speed: 38, safetyScore: 7.9, monthlyCost: 1400, weatherDesc: 'Tropical & Lush', temp: 30, tags: ['Surf & Co-Work', 'Nomad Hub'], popular: true, desc: 'Tropical paradise with rice terraces, temples, and a world-class digital nomad community in Canggu.' },
  { id: 'bangkok', city: 'Bangkok', country: 'Thailand', emoji: '🛕', lat: 13.7563, lng: 100.5018, rating: 4.7, pop: '11M+ nomads', wikiTitle: 'Bangkok', speed: 45, safetyScore: 7.5, monthlyCost: 1100, weatherDesc: 'Hot & Vibrant', temp: 32, tags: ['Street Food', 'Nightlife'], popular: true, desc: 'Vibrant street food, temples, and a booming nomad scene. Low cost of living with fast fiber internet.' },
  { id: 'tokyo', city: 'Tokyo', country: 'Japan', emoji: '🗼', lat: 35.6762, lng: 139.6503, rating: 4.9, pop: '14M+ nomads', wikiTitle: 'Tokyo', speed: 78, safetyScore: 9.4, monthlyCost: 2800, weatherDesc: 'Cool & Clear', temp: 16, tags: ['BTC Friendly', 'Ultra-Modern'], popular: false, desc: 'Ultra-modern city with ancient temples, perfect transit, and incredible food. Bitcoin-friendly with thousands of merchants.' },
  { id: 'barcelona', city: 'Barcelona', country: 'Spain', emoji: '🏖️', lat: 41.3851, lng: 2.1734, rating: 4.8, pop: '7M+ nomads', wikiTitle: 'Barcelona', speed: 55, safetyScore: 7.8, monthlyCost: 2200, weatherDesc: 'Sunny & Warm', temp: 22, tags: ['Beach Life', 'Startup Hub'], popular: false, desc: "Architecture, beaches, and an incredible startup scene. One of Europe's top Bitcoin cities." },
  { id: 'medellin', city: 'Medellín', country: 'Colombia', emoji: '🌺', lat: 6.2476, lng: -75.5658, rating: 4.6, pop: '5M+ nomads', wikiTitle: 'Medellín', speed: 32, safetyScore: 6.8, monthlyCost: 900, weatherDesc: 'Spring All Year', temp: 22, tags: ['Budget Pick', 'Crypto Scene'], popular: false, desc: 'The city of eternal spring. Growing crypto scene, affordable living, and a welcoming local culture.' },
  { id: 'dubai', city: 'Dubai', country: 'UAE', emoji: '🏙️', lat: 25.2048, lng: 55.2708, rating: 4.7, pop: '9M+ nomads', wikiTitle: 'Dubai', speed: 62, safetyScore: 8.9, monthlyCost: 3200, weatherDesc: 'Sunny & Hot', temp: 35, tags: ['Tax-Free', 'Luxury'], popular: false, desc: 'Tax-free hub with world-class infrastructure, crypto-friendly regulations, and 0% income tax.' },
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
    { label: 'Bar & Grill', query: 'bar grill', emoji: '🍺' },
    { label: 'Burger', query: 'burger restaurant', emoji: '🍔' },
    { label: 'Chinese', query: 'chinese restaurant', emoji: '🥡' },
    { label: 'Fast Food', query: 'fast food', emoji: '🍟' },
    { label: 'Italian', query: 'italian restaurant', emoji: '🍝' },
    { label: 'Japanese', query: 'japanese restaurant', emoji: '🍱' },
    { label: 'Mexican', query: 'mexican restaurant', emoji: '🌮' },
    { label: 'Pizza', query: 'pizza restaurant', emoji: '🍕' },
    { label: 'Seafood', query: 'seafood restaurant', emoji: '🦞' },
    { label: 'Thai', query: 'thai restaurant', emoji: '🍜' },
    { label: 'Vietnamese', query: 'vietnamese restaurant', emoji: '🍲' },
    { label: 'Steak', query: 'steakhouse', emoji: '🥩' },
    { label: 'All Food', query: 'restaurants', emoji: '🍽️' },
  ],
  cafe: [
    { label: 'Coffee', query: 'coffee cafe', emoji: '☕' },
    { label: 'Boba / Tea', query: 'boba tea shop', emoji: '🧋' },
    { label: 'Coworking', query: 'coworking cafe wifi', emoji: '💻' },
    { label: 'Bakery Café', query: 'bakery cafe', emoji: '🥐' },
    { label: 'Juice Bar', query: 'juice bar smoothie', emoji: '🧃' },
    { label: 'All Cafes', query: 'cafes', emoji: '🍵' },
  ],
  shop: [
    { label: 'Mall', query: 'shopping mall', emoji: '🏬' },
    { label: 'Grocery', query: 'supermarket grocery', emoji: '🛒' },
    { label: 'Electronics', query: 'electronics store', emoji: '📱' },
    { label: 'Clothing', query: 'clothing store fashion', emoji: '👔' },
    { label: 'Market', query: 'local market bazaar', emoji: '🏪' },
    { label: 'All Shops', query: 'shopping', emoji: '🛍️' },
  ],
  nightlife: [
    { label: 'Bar', query: 'bar cocktail lounge', emoji: '🍸' },
    { label: 'Nightclub', query: 'nightclub dance', emoji: '🎉' },
    { label: 'Live Music', query: 'live music venue', emoji: '🎵' },
    { label: 'Rooftop', query: 'rooftop bar', emoji: '🌃' },
    { label: 'Pub', query: 'pub sports bar', emoji: '🍺' },
  ],
  hotel: [
    { label: 'Hotel', query: 'hotel', emoji: '🏨' },
    { label: 'Hostel', query: 'hostel backpacker', emoji: '🛏️' },
    { label: 'Airbnb', query: 'vacation rental', emoji: '🏠' },
    { label: 'Resort', query: 'resort luxury', emoji: '🏖️' },
    { label: 'Boutique', query: 'boutique hotel', emoji: '🌟' },
  ],
  transport: [
    { label: 'Bus', query: 'bus station stop', emoji: '🚌' },
    { label: 'Train / MRT', query: 'train station metro', emoji: '🚇' },
    { label: 'Airport', query: 'airport', emoji: '✈️' },
    { label: 'Taxi / Grab', query: 'taxi grab ride share', emoji: '🚕' },
    { label: 'Ferry', query: 'ferry boat terminal', emoji: '⛴️' },
    { label: 'Bike Share', query: 'bike rental bicycle', emoji: '🚲' },
  ],
  gym: [
    { label: 'Gym', query: 'gym fitness center', emoji: '💪' },
    { label: 'Yoga', query: 'yoga studio', emoji: '🧘' },
    { label: 'Swimming', query: 'swimming pool', emoji: '🏊' },
    { label: 'Muay Thai', query: 'muay thai boxing gym', emoji: '🥊' },
    { label: 'Rock Climb', query: 'rock climbing gym', emoji: '🧗' },
  ],
};

export const PHRASES: Record<string, { label: string; phrases: { en: string; local: string; phon: string }[] }> = {
  es: { label: '🇪🇸 Spanish', phrases: [
    { en: 'Hello', local: 'Hola', phon: 'OH-lah' },
    { en: 'Thank you', local: 'Gracias', phon: 'GRAH-syahs' },
    { en: 'Where is…?', local: '¿Dónde está…?', phon: 'DON-day es-TAH' },
    { en: 'How much?', local: '¿Cuánto cuesta?', phon: 'KWAHN-toh KWES-tah' },
    { en: 'I need a doctor', local: 'Necesito un médico', phon: 'neh-seh-SEE-toh oon MEH-dee-koh' },
    { en: 'Help!', local: '¡Ayuda!', phon: 'ah-YOO-dah' },
    { en: 'Do you accept Bitcoin?', local: '¿Acepta Bitcoin?', phon: 'ah-SEP-tah Bitcoin' },
    { en: 'Where is the airport?', local: '¿Dónde está el aeropuerto?', phon: 'DON-day es-TAH el ah-eh-roh-PWER-toh' },
  ]},
  fr: { label: '🇫🇷 French', phrases: [
    { en: 'Hello', local: 'Bonjour', phon: 'bohn-ZHOOR' },
    { en: 'Thank you', local: 'Merci', phon: 'mehr-SEE' },
    { en: 'Where is…?', local: 'Où est…?', phon: 'oo AY' },
    { en: 'How much?', local: 'Combien ça coûte?', phon: 'kohm-BYEH sah KOOT' },
    { en: 'I need a doctor', local: "J'ai besoin d'un médecin", phon: 'zhay buh-ZWEH dun med-SAN' },
    { en: 'Help!', local: 'Au secours!', phon: 'oh skoor' },
    { en: 'Do you accept Bitcoin?', local: 'Acceptez-vous Bitcoin?', phon: 'ak-sep-TAY voo Bitcoin' },
    { en: 'Where is the airport?', local: "Où est l'aéroport?", phon: 'oo AY lay-ro-POUR' },
  ]},
  th: { label: '🇹🇭 Thai', phrases: [
    { en: 'Hello', local: 'สวัสดี', phon: 'sa-wat-dee' },
    { en: 'Thank you', local: 'ขอบคุณ', phon: 'khop khun' },
    { en: 'Where is…?', local: '…อยู่ที่ไหน?', phon: '...yoo tee nai' },
    { en: 'How much?', local: 'ราคาเท่าไหร่?', phon: 'ra-kaa tao-rai' },
    { en: 'I need a doctor', local: 'ฉันต้องการหมอ', phon: 'chan dtong gaan mor' },
    { en: 'Help!', local: 'ช่วยด้วย!', phon: 'chuay duay' },
    { en: 'Do you accept Bitcoin?', local: 'รับ Bitcoin ไหม?', phon: 'rap Bitcoin mai' },
    { en: 'Where is the airport?', local: 'สนามบินอยู่ที่ไหน?', phon: 'sa-naam bin yoo tee nai' },
  ]},
  ja: { label: '🇯🇵 Japanese', phrases: [
    { en: 'Hello', local: 'こんにちは', phon: 'kon-nee-chee-wa' },
    { en: 'Thank you', local: 'ありがとうございます', phon: 'a-ree-ga-toh go-zai-mas' },
    { en: 'Where is…?', local: '…はどこですか?', phon: '...wa do-ko des-ka' },
    { en: 'How much?', local: 'いくらですか?', phon: 'ee-koo-ra des-ka' },
    { en: 'I need a doctor', local: '医者が必要です', phon: 'ee-sha ga hee-tsu-yo des' },
    { en: 'Help!', local: '助けて!', phon: 'ta-soo-ke-te' },
    { en: 'Do you accept Bitcoin?', local: 'ビットコインは使えますか?', phon: 'bit-to-ko-in wa tsoo-ka-e-mas-ka' },
    { en: 'Where is the airport?', local: '空港はどこですか?', phon: 'koo-koh wa do-ko des-ka' },
  ]},
  pt: { label: '🇵🇹 Portuguese', phrases: [
    { en: 'Hello', local: 'Olá', phon: 'oh-LAH' },
    { en: 'Thank you', local: 'Obrigado / Obrigada', phon: 'oh-bree-GAH-doo' },
    { en: 'Where is…?', local: 'Onde fica…?', phon: 'ON-jee FEE-kah' },
    { en: 'How much?', local: 'Quanto custa?', phon: 'KWAHN-too KOO-stah' },
    { en: 'I need a doctor', local: 'Preciso de um médico', phon: 'preh-SEE-zoo jee oong MEH-jee-koo' },
    { en: 'Help!', local: 'Socorro!', phon: 'so-KOH-hoo' },
    { en: 'Do you accept Bitcoin?', local: 'Aceita Bitcoin?', phon: 'ah-SAY-ta Bitcoin' },
    { en: 'Where is the airport?', local: 'Onde fica o aeroporto?', phon: 'ON-jee FEE-kah oh ah-eh-roh-POR-too' },
  ]},
  de: { label: '🇩🇪 German', phrases: [
    { en: 'Hello', local: 'Hallo', phon: 'HAL-oh' },
    { en: 'Thank you', local: 'Danke schön', phon: 'DAHN-keh shern' },
    { en: 'Where is…?', local: 'Wo ist…?', phon: 'voh ist' },
    { en: 'How much?', local: 'Wie viel kostet das?', phon: 'vee feel KOS-tet dahs' },
    { en: 'I need a doctor', local: 'Ich brauche einen Arzt', phon: 'ikh BROW-kheh eye-nen artst' },
    { en: 'Help!', local: 'Hilfe!', phon: 'HIL-feh' },
    { en: 'Do you accept Bitcoin?', local: 'Nehmen Sie Bitcoin?', phon: 'NAY-men zee Bitcoin' },
    { en: 'Where is the airport?', local: 'Wo ist der Flughafen?', phon: 'voh ist dair FLOOK-hah-fen' },
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
  { emoji: '✈️', label: 'Flights', url: 'https://www.skyscanner.com/?utm_source=kipita&utm_medium=app&utm_campaign=KIPITA10' },
  { emoji: '🏨', label: 'Hotels', url: 'https://www.hotels.com/affiliate/RrZ7bmg' },
  { emoji: '🏨', label: 'Expedia', url: 'https://expedia.com/affiliate/eA2cKky' },
  { emoji: '🚗', label: 'Car Rental', url: 'https://www.rentalcars.com/?utm_source=kipita&utm_medium=app' },
  { emoji: '🚢', label: 'Cruise', url: 'https://www.cruisecritic.com/?utm_source=kipita&utm_medium=app' },
  { emoji: '🚕', label: 'Uber', url: 'https://uber.com/?utm_source=kipita&utm_medium=app' },
  { emoji: '🛻', label: 'Lyft', url: 'https://lyft.com/?utm_source=kipita&utm_medium=app' },
];

export const BOOKING_TILES = [
  { emoji: '✈️', label: 'Flights', desc: 'Compare & book flights worldwide', url: 'https://www.skyscanner.com/?utm_source=kipita&utm_medium=app&utm_campaign=KIPITA10', provider: 'Skyscanner' },
  { emoji: '🏨', label: 'Hotels', desc: 'Best rates on 2M+ properties', url: 'https://www.booking.com/?utm_source=kipita&utm_medium=app&utm_campaign=KIPITAGENI', provider: 'Booking.com' },
  { emoji: '🏨', label: 'Expedia', desc: 'Bundle deals on flights + hotels', url: 'https://expedia.com/affiliate/eA2cKky', provider: 'Expedia' },
  { emoji: '🏨', label: 'Hotels.com', desc: 'Earn free nights on every 10 stays', url: 'https://www.hotels.com/affiliate/RrZ7bmg', provider: 'Hotels.com' },
  { emoji: '🏠', label: 'Stays', desc: 'Unique homes & apartments', url: 'https://www.airbnb.com/', provider: 'Airbnb' },
  { emoji: '🚗', label: 'Car Rental', desc: 'Vehicles in 60,000+ locations', url: 'https://www.rentalcars.com/?utm_source=kipita&utm_medium=app', provider: 'RentalCars' },
  { emoji: '🚢', label: 'Cruises', desc: 'Deals on cruises worldwide', url: 'https://www.cruisecritic.com/?utm_source=kipita&utm_medium=app', provider: 'CruiseCritic' },
  { emoji: '🛡️', label: 'Insurance', desc: 'Travel insurance for nomads', url: 'https://www.worldnomads.com/', provider: 'World Nomads' },
  { emoji: '📶', label: 'eSIM Data', desc: 'Instant data in 200+ countries', url: 'https://www.airalo.com/?utm_source=kipita&utm_medium=app&utm_campaign=KIPITA5', provider: 'Airalo' },
  { emoji: '🔐', label: 'VPN', desc: 'Secure connection worldwide', url: 'https://nordvpn.com/?utm_source=kipita&utm_medium=app&utm_campaign=KIPITAVPN', provider: 'NordVPN' },
];

export const SAVETRAVELDEALS = [
  { emoji: '✈️', label: 'Flights & Hotels', desc: 'Search and book at the best prices', url: 'https://savetraveldeals.com/book-hotels-app/' },
  { emoji: '🚗', label: 'Car Rental', desc: 'Rent a car anywhere in the world', url: 'https://savetraveldeals.com/car-rental-app/' },
  { emoji: '🚐', label: 'Airport Transfers', desc: 'Reliable airport transfer services', url: 'https://savetraveldeals.com/airport-transfers/' },
  { emoji: '🚲', label: 'Bike Rental', desc: 'Explore cities on two wheels', url: 'https://savetraveldeals.com/bike-rental-app/' },
];

export const PERKS = [
  { icon: '✈️', title: 'Skyscanner', desc: '10% off flights when booked through Kipita.', code: 'KIPITA10', expiry: 'Dec 2026', url: 'https://www.skyscanner.com/?utm_source=kipita&utm_medium=app&utm_campaign=KIPITA10', category: 'travel' },
  { icon: '🏨', title: 'Booking.com', desc: 'Genius Level 2 instant unlock — up to 20% off.', code: 'KIPITAGENI', expiry: 'Ongoing', url: 'https://www.booking.com/?utm_source=kipita&utm_medium=app&utm_campaign=KIPITAGENI', category: 'travel' },
  { icon: '🏨', title: 'Expedia', desc: 'Bundle & save on flights + hotels.', code: '', expiry: 'Ongoing', url: 'https://expedia.com/affiliate/eA2cKky', category: 'travel' },
  { icon: '🏨', title: 'Hotels.com', desc: 'Earn a free night for every 10 stays.', code: '', expiry: 'Ongoing', url: 'https://www.hotels.com/affiliate/RrZ7bmg', category: 'travel' },
  { icon: '🏠', title: 'Airbnb', desc: '$25 off your first stay with Kipita referral.', code: 'KIPITABNB', expiry: 'Mar 2027', url: 'https://www.airbnb.com/', category: 'travel' },
  { icon: '🚢', title: 'CruiseCritic', desc: 'Exclusive nomad cruise deals + onboard credits.', code: 'KIPITACRUISE', expiry: 'Ongoing', url: 'https://www.cruisecritic.com/?utm_source=kipita&utm_medium=app', category: 'travel' },
  { icon: '🚕', title: 'Uber', desc: 'Rides worldwide — fast & reliable.', code: '', expiry: 'Ongoing', url: 'https://uber.com/?utm_source=kipita&utm_medium=app', category: 'travel' },
  { icon: '🛻', title: 'Lyft', desc: 'Affordable rides across North America.', code: '', expiry: 'Ongoing', url: 'https://lyft.com/?utm_source=kipita&utm_medium=app', category: 'travel' },
  { icon: '🦢', title: 'Swan Bitcoin', desc: 'Auto-stack sats — $10 free Bitcoin on signup.', code: 'KIPITASWAN', expiry: 'Dec 2026', url: 'https://www.swanbitcoin.com/kipita/', category: 'btc' },
  { icon: '💳', title: 'Fold Card', desc: 'Earn BTC rewards on every purchase. Spin the wheel daily.', code: 'MAJL4MYU', expiry: 'Ongoing', url: 'https://use.foldapp.com/r/MAJL4MYU', category: 'btc' },
  { icon: '⚡', title: 'Strike', desc: 'Send money globally via Lightning. Zero fees for Kipita users.', code: 'KIPITASTRIKE', expiry: 'Jun 2026', url: 'https://strike.me/', category: 'btc' },
  { icon: '🏦', title: 'River', desc: 'Buy Bitcoin with zero spread. $5 free on first purchase.', code: 'KIPITARIVER', expiry: 'Dec 2026', url: 'https://river.com/', category: 'btc' },
  { icon: '🥇', title: 'Kinesis', desc: 'Gold & silver-backed digital currency. Trade precious metals.', code: 'KM00083150', expiry: 'Ongoing', url: 'https://kms.kinesis.money/signup/KM00083150', category: 'btc' },
  { icon: '⛽', title: 'Upside', desc: 'Cash back on gas, food & groceries.', code: '', expiry: 'Ongoing', url: 'https://upside.com/', category: 'btc' },
  { icon: '🗺️', title: 'BTCMap', desc: 'Find Bitcoin merchants worldwide.', code: '', expiry: 'Ongoing', url: 'https://btcmap.org/?utm_source=kipita&utm_medium=app', category: 'btc' },
  { icon: '💻', title: 'NomadList Pro', desc: '3 months free NomadList Pro subscription.', code: 'KIPITANOMAD', expiry: 'Mar 2027', url: 'https://nomadlist.com/?utm_source=kipita&utm_medium=app&utm_campaign=KIPITANOMAD', category: 'tools' },
  { icon: '📶', title: 'Airalo eSIM', desc: '5% off any eSIM data plan worldwide.', code: 'KIPITA5', expiry: 'Jun 2026', url: 'https://www.airalo.com/?utm_source=kipita&utm_medium=app&utm_campaign=KIPITA5', category: 'tools' },
  { icon: '🏋️', title: 'ClassPass', desc: 'First month free — access gyms, yoga and fitness globally.', code: 'KIPITAFIT', expiry: 'Ongoing', url: 'https://classpass.com/?utm_source=kipita&utm_medium=app&utm_campaign=KIPITAFIT', category: 'tools' },
  { icon: '🔐', title: 'NordVPN', desc: '2-year plan at 70% off. Secure your connection.', code: 'KIPITAVPN', expiry: 'Dec 2026', url: 'https://nordvpn.com/?utm_source=kipita&utm_medium=app&utm_campaign=KIPITAVPN', category: 'tools' },
  { icon: '🛡️', title: 'World Nomads', desc: 'Travel insurance built for nomads. 10% off with code.', code: 'KIPITASAFE', expiry: 'Ongoing', url: 'https://www.worldnomads.com/', category: 'tools' },
  { icon: '💼', title: 'Wise', desc: 'Multi-currency account. First transfer free.', code: 'KIPITAWISE', expiry: 'Ongoing', url: 'https://wise.com/', category: 'tools' },
];

export const DEMO_REVIEWS = [
  { id: 'r1', author: 'Alex M.', flag: '🇺🇸', dest: 'Bangkok', emoji: '🛕', rating: 5, wifi: 5, budget: 5, vibe: 4, text: "Bangkok is unreal for nomads. Lightning-fast fiber at every cafe, street food for $2, and you can pay BTC at loads of spots." },
  { id: 'r2', author: 'Sara K.', flag: '🇬🇧', dest: 'Bali', emoji: '🌴', rating: 4, wifi: 3, budget: 4, vibe: 5, text: "Canggu has the best nomad community on earth. The vibe is incredible, co-working spaces everywhere." },
  { id: 'r3', author: 'Marco B.', flag: '🇮🇹', dest: 'Lisbon', emoji: '🇵🇹', rating: 5, wifi: 4, budget: 3, vibe: 5, text: "Europe's best city for nomads right now. NHR tax regime, incredible food, great tech scene." },
  { id: 'r4', author: 'Yuki T.', flag: '🇯🇵', dest: 'Tokyo', emoji: '🗼', rating: 5, wifi: 5, budget: 2, vibe: 5, text: "Tokyo is the most organised city in the world. Thousands of BTC merchants, insane food, 100% safe." },
  { id: 'r5', author: 'Priya N.', flag: '🇮🇳', dest: 'Chiang Mai', emoji: '🏔️', rating: 5, wifi: 5, budget: 5, vibe: 4, text: "$800/month comfortable lifestyle. Best Internet cafes in the world." },
  { id: 'r6', author: 'Leo C.', flag: '🇨🇦', dest: 'Medellín', emoji: '🌺', rating: 4, wifi: 4, budget: 5, vibe: 5, text: "Spring weather all year, incredible food, and a booming crypto scene." },
];

export const GROUPS: Group[] = [
  { id: '1', name: 'BTC Nomads 🌍', emoji: '₿', members: 342, lastMessage: 'Anyone know good BTC cafes in Lisbon?', unread: 3, messages: [
    { id: 'm1', sender: 'SatoshiTraveler', text: 'Anyone know good BTC cafes in Lisbon?', mine: false, time: '10:30 AM' },
    { id: 'm2', sender: 'PortugalNomad', text: 'Check out Copenhagen Coffee Lab — they accept Lightning!', mine: false, time: '10:32 AM' },
    { id: 'm3', sender: 'You', text: 'Also try Zenith Brunch & Cocktails, great vibe 🔥', mine: true, time: '10:35 AM' },
  ]},
  { id: '2', name: 'SE Asia Digital Nomads', emoji: '🌴', members: 1205, lastMessage: 'New coworking space opened in Canggu!', unread: 7, messages: [
    { id: 'm4', sender: 'BaliRemote', text: 'New coworking space opened in Canggu!', mine: false, time: '9:15 AM' },
    { id: 'm5', sender: 'ChiangMaiDev', text: "What's the day rate?", mine: false, time: '9:20 AM' },
  ]},
  { id: '3', name: 'Safety Alerts Network', emoji: '🛡️', members: 890, lastMessage: 'Flooding advisory lifted for Bangkok', unread: 0, messages: [
    { id: 'm6', sender: 'SafetyBot', text: 'Flooding advisory lifted for Bangkok. All clear! ✅', mine: false, time: 'Yesterday' },
  ]},
  { id: '4', name: 'Budget Travelers Club', emoji: '💰', members: 567, lastMessage: '$15/night hostels in Medellín 🔥', unread: 2, messages: [
    { id: 'm7', sender: 'BudgetKing', text: '$15/night hostels in Medellín 🔥', mine: false, time: '8:00 AM' },
  ]},
];

/* ── AI RESPONSES (matching latest build + deep trip integration) ── */
export const AI_RESPONSES = {
  plan: (dest: string) => `✈️ **Trip Plan: ${dest || 'Your Dream Destination'}**\n\n**Day 1: Arrival & Orientation**\n• Check into your accommodation\n• Explore the local neighborhood on foot\n• Try street food or a local restaurant\n• Currency exchange and SIM card setup\n\n**Day 2: Culture & History**\n• Morning: Visit main historical landmarks\n• Afternoon: Local markets or museum\n• Evening: Sunset viewpoint + dinner\n\n**Day 3: Off the Beaten Path**\n• Day trip to nearby nature or town\n• Connect with local nomads at a co-working space\n• Try Bitcoin payments at local merchants (BTCMap)\n\n**Day 4: Food & Community**\n• Cooking class or food tour\n• Social events / meetups\n• Evening: Night market or bar crawl\n\n**Day 5: Departure**\n• Final shopping and souvenirs\n• Airport transfer via Uber/Lyft\n\n📦 **Book Your Trip:**\n• ✈️ Flights → Skyscanner (code KIPITA10)\n• 🏨 Hotels → Booking.com (KIPITAGENI) / Expedia / Hotels.com\n• 🚗 Car Rental → RentalCars\n• 🚢 Cruises → CruiseCritic\n• 📶 eSIM → Airalo (code KIPITA5)\n• 🛡️ Insurance → World Nomads (KIPITASAFE)\n\n₿ **BTC Travel Tips:**\n• Find BTC merchants on BTCMap\n• Stack sats with Swan Bitcoin (swanbitcoin.com/kipita/ — $10 free)\n• Earn BTC rewards with Fold Card (code MAJL4MYU)\n• Trade gold/silver on Kinesis (KM00083150)\n• Cash back on gas with Upside`,

  safety: (loc: string) => `🛡️ **Safety Overview — ${loc}**\n\n**General Safety Tips:**\n• Keep digital copies of all documents\n• Use a VPN on public WiFi (NordVPN code: KIPITAVPN — 70% off)\n• Register with your embassy\n• Share your itinerary with someone at home\n• Keep emergency numbers saved offline\n\n**Emergency Resources:**\n• 🚨 Tap the Emergency 🚨 button in the header for numbers\n• 🏥 Find nearest hospital in the **Places** tab\n• 📱 Offline maps available for download\n• 🛡️ Travel insurance: World Nomads (code KIPITASAFE)\n\n*Always check your government's travel advisory before traveling.*`,

  advisories: () => `📋 **Current Travel Advisories (2026)**\n\n🟢 **Low Risk:** Japan, Singapore, Portugal, UAE, Iceland\n🟡 **Exercise Caution:** Thailand, Mexico, Colombia, India\n🟠 **Elevated Caution:** South Africa, Kenya, Turkey\n🔴 **Reconsider Travel:** Myanmar, Sudan, Haiti\n\n⚠️ *These are general advisories. Always check your government's official portal for the most current information.*\n\n🛡️ *Get travel insurance: World Nomads (code KIPITASAFE)*`,

  phrases: () => `🌐 **Essential Travel Phrases**\n\nOpen the **Places → Phrases** section for 15+ languages with pronunciation guides!\n\nQuick essentials:\n• Hello / Thank you / Help!\n• Where is…? / How much?\n• Do you accept Bitcoin?\n• Where is the airport?\n\n*Tip: Screenshot phrases for offline access!*`,

  perks: () => `🎁 **Kipita Perks & Deals**\n\n**✈️ Travel:**\n• Skyscanner — 10% off flights (KIPITA10)\n• Booking.com — Genius Level 2 (KIPITAGENI)\n• Expedia — Bundle deals (expedia.com/affiliate/eA2cKky)\n• Hotels.com — Free night every 10 stays\n• Airbnb — $25 off first stay (KIPITABNB)\n• CruiseCritic — Onboard credits (KIPITACRUISE)\n• World Nomads — 10% off insurance (KIPITASAFE)\n• Uber & Lyft — Rides worldwide\n\n**₿ Bitcoin & Finance:**\n• Swan Bitcoin — $10 free BTC (swanbitcoin.com/kipita/)\n• Fold Card — BTC rewards (use.foldapp.com/r/MAJL4MYU)\n• Strike — Zero-fee Lightning transfers (KIPITASTRIKE)\n• River — $5 free on first buy (KIPITARIVER)\n• Kinesis — Gold/silver trading (KM00083150)\n• BTCMap — Find BTC merchants worldwide\n• Upside — Cash back on gas & food\n• Wise — First transfer free (KIPITAWISE)\n\n**🛠️ Nomad Tools:**\n• NomadList Pro — 3 months free (KIPITANOMAD)\n• Airalo eSIM — 5% off data (KIPITA5)\n• ClassPass — First month free (KIPITAFIT)\n• NordVPN — 70% off 2-year plan (KIPITAVPN)`,

  default: (topic: string) => `Great question about "${topic}"! As your AI travel companion, I can help with:\n\n✈️ **Trip Planning** — Custom itineraries with budgets & booking links\n🛡️ **Safety Info** — Real-time advisories & emergency contacts\n₿ **Bitcoin** — Find BTC-friendly spots + Swan, Fold, Kinesis deals\n🌐 **Phrases** — Essential phrases in 15+ languages\n🗺️ **Destinations** — Nomad scores, costs, weather\n💱 **Currency** — Live exchange rates & converter\n🎁 **Perks** — Exclusive codes for flights, hotels, insurance\n🎒 **Packing** — Smart packing lists\n\nTry asking me to "Plan a trip to Tokyo" or "Show me perks and deals" 🌍`,
};

/* ── DEMO PLACE GENERATION (matching latest build) ───────── */
const placeNames: Record<string, string[]> = {
  food: ['Nomad Kitchen', 'Street Bites', 'The Wanderer Grill', 'Local Eats', 'Spice Route', 'Fusion Corner'],
  cafe: ['Digital Nomad Café', 'Bean & Browse', 'The Grind', 'Pour Over Paradise', 'Roast & Relax', 'Brew Corner'],
  hotel: ['Nomad Hostel', 'The Co-Living Hub', 'Modern Suites', 'Budget Inn', 'Artisan Rooms', 'City Stay'],
  transport: ['City Metro', 'Express Bus', 'BTS Station', 'MRT Hub', 'Tuk-Tuk Stand', 'Grab Point'],
  atm: ['BTC ATM', 'Lightning ATM', 'Crypto Kiosk', 'Exchange Point', 'Bitcoin Corner', 'Crypto ATM'],
  shop: ['Local Market', 'Nomad Shop', 'Night Bazaar', 'Weekend Market', 'Tech Store', 'Street Market'],
  gym: ['Nomad Gym', 'FitHub', 'Iron Zone', 'CrossFit Box', 'Yoga Studio', 'Sports Club'],
  beach: ['Sunset Beach', 'Chill Cove', 'Digital Nomad Beach', 'Surf Spot', 'Kite Beach', 'Hidden Bay'],
  nightlife: ['Rooftop Bar', 'Night Market', 'Jazz Lounge', 'Sky Bar', 'Night Club', 'Live Music Venue'],
  default: ['Place 1', 'Place 2', 'Place 3', 'Place 4', 'Place 5', 'Place 6'],
};
const streets = ['Main Street', 'Market Ave', 'Digital Lane', 'Nomad Road', 'BTC Boulevard', 'Satoshi St'];

export function generateDemoPlaces(query: string, label: string, count: number, locationName: string) {
  const cat = query.includes('restaurant') || query.includes('food') ? 'food'
    : query.includes('cafe') || query.includes('coffee') ? 'cafe'
    : query.includes('hotel') || query.includes('hostel') ? 'hotel'
    : query.includes('transit') || query.includes('transport') || query.includes('bus') || query.includes('metro') ? 'transport'
    : query.includes('bitcoin') || query.includes('atm') || query.includes('crypto') ? 'atm'
    : query.includes('shopping') || query.includes('market') ? 'shop'
    : query.includes('gym') || query.includes('fitness') ? 'gym'
    : query.includes('beach') ? 'beach'
    : query.includes('nightlife') || query.includes('bar') ? 'nightlife'
    : 'default';
  const emojis: Record<string, string> = { food: '🍜', cafe: '☕', hotel: '🏨', transport: '🚇', atm: '₿', shop: '🛍', gym: '💪', beach: '🏖️', nightlife: '🎵', default: '📍' };
  const names = placeNames[cat] || placeNames.default;
  const cityStreets = locationName && locationName !== 'Detecting…'
    ? streets.map(s => s + ', ' + locationName.split(',')[0])
    : streets;
  return Array.from({ length: count }, (_, i) => ({
    emoji: emojis[cat],
    name: names[i % names.length],
    addr: `${Math.floor(Math.random() * 200) + 1} ${cityStreets[i % cityStreets.length]}`,
    rating: (3.8 + Math.random() * 1.1).toFixed(1),
    dist: (0.2 + Math.random() * 4).toFixed(1),
    isOpen: Math.random() > 0.3,
    reviews: Math.floor(20 + Math.random() * 200),
    price: ['$', '$$', '$$$'][Math.floor(Math.random() * 3)],
  }));
}
