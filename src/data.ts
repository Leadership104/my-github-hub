import type { Destination, PlaceCategory, SubCategory, Group } from './types';

/* ── Destination-specific cost data (realistic 2026 prices in USD) ── */
export const CITY_COSTS: Record<string, {
  photoUrl: string;
  landmark: string;
  food: { item: string; price: string }[];
  drinks: { item: string; price: string }[];
  entertainment: { item: string; price: string }[];
}> = {
  'Chiang Mai': {
    photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Wat_Phra_That_Doi_Suthep_-_Chiang_Mai.jpg/1280px-Wat_Phra_That_Doi_Suthep_-_Chiang_Mai.jpg',
    landmark: 'Wat Phra That Doi Suthep',
    food: [
      { item: 'Pad Thai (street stall)', price: '$1.50' },
      { item: 'Khao Soi (curry noodle soup)', price: '$2.00' },
      { item: 'Mango sticky rice', price: '$1.00' },
      { item: 'Meal at local restaurant', price: '$3–5' },
      { item: 'Western café meal', price: '$6–9' },
      { item: 'Fine dining entrée', price: '$12–20' },
    ],
    drinks: [
      { item: 'Iced coffee (local café)', price: '$1.00' },
      { item: 'Fresh fruit smoothie', price: '$1.50' },
      { item: 'Local beer (Chang/Leo)', price: '$1.50' },
      { item: 'Craft cocktail at bar', price: '$4–6' },
      { item: 'Boba tea', price: '$2.00' },
    ],
    entertainment: [
      { item: 'Night Bazaar shopping', price: 'Free–$20' },
      { item: 'Thai cooking class (half day)', price: '$25–35' },
      { item: 'Doi Suthep temple entry', price: '$1.00' },
      { item: 'Full-day trekking tour', price: '$25–40' },
      { item: 'Muay Thai class', price: '$8–12' },
      { item: 'Movie theater ticket', price: '$4–6' },
    ],
  },
  'Lisbon': {
    photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Lisbon_%2836831596786%29_%28cropped%29.jpg/1280px-Lisbon_%2836831596786%29_%28cropped%29.jpg',
    landmark: 'Belém Tower & Tram 28',
    food: [
      { item: 'Pastel de nata (custard tart)', price: '$1.20' },
      { item: 'Bifana sandwich', price: '$3.50' },
      { item: 'Meal at tascas (local tavern)', price: '$8–12' },
      { item: 'Seafood restaurant entrée', price: '$15–25' },
      { item: 'Lunch menu of the day', price: '$7–10' },
      { item: 'Fine dining (Michelin)', price: '$50–80' },
    ],
    drinks: [
      { item: 'Espresso (bica)', price: '$0.80' },
      { item: 'Glass of Vinho Verde', price: '$2.50' },
      { item: 'Craft beer (local)', price: '$3–5' },
      { item: 'Ginjinha (cherry liqueur shot)', price: '$1.50' },
      { item: 'Cocktail at rooftop bar', price: '$8–12' },
    ],
    entertainment: [
      { item: 'Fado show at Alfama', price: '$15–25' },
      { item: 'Tram 28 ride', price: '$3.50' },
      { item: 'Jerónimos Monastery entry', price: '$12' },
      { item: 'Surf lesson at Costa da Caparica', price: '$35–50' },
      { item: 'Day trip to Sintra', price: '$15–25' },
      { item: 'LX Factory market browse', price: 'Free' },
    ],
  },
  'Bali': {
    photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Tanah-Lot_Bali_Indonesia_Pura-Tanah-Lot-01.jpg/1280px-Tanah-Lot_Bali_Indonesia_Pura-Tanah-Lot-01.jpg',
    landmark: 'Tanah Lot Temple',
    food: [
      { item: 'Nasi Goreng (fried rice)', price: '$1.50–3' },
      { item: 'Babi Guling (suckling pig)', price: '$3–5' },
      { item: 'Warung meal (local)', price: '$2–4' },
      { item: 'Smoothie bowl (Canggu café)', price: '$5–7' },
      { item: 'Western restaurant meal', price: '$8–15' },
      { item: 'Beach club dinner', price: '$20–40' },
    ],
    drinks: [
      { item: 'Bintang beer', price: '$1.50–2' },
      { item: 'Fresh coconut', price: '$1.00' },
      { item: 'Iced latte (café)', price: '$2.50–4' },
      { item: 'Cocktail at beach bar', price: '$5–8' },
      { item: 'Fresh juice', price: '$1.50–3' },
    ],
    entertainment: [
      { item: 'Ubud Monkey Forest entry', price: '$4.50' },
      { item: 'Tegallalang rice terrace', price: '$1.50' },
      { item: 'Surf lesson (2 hrs)', price: '$20–30' },
      { item: 'Full-day scooter rental', price: '$5–7' },
      { item: 'Balinese spa massage (1 hr)', price: '$10–15' },
      { item: 'Uluwatu Kecak fire dance', price: '$7' },
    ],
  },
  'Bangkok': {
    photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bf/Wat_Arun%2C_Bangkok_%28I%29.jpg/800px-Wat_Arun%2C_Bangkok_%28I%29.jpg',
    landmark: 'Wat Arun (Temple of Dawn)',
    food: [
      { item: 'Street Pad Thai', price: '$1.00–2' },
      { item: 'Som Tam (papaya salad)', price: '$1.00' },
      { item: 'Rice & curry plate', price: '$1.50–2.50' },
      { item: 'Yaowarat (Chinatown) street food', price: '$2–4' },
      { item: 'Mid-range restaurant', price: '$6–12' },
      { item: 'Rooftop restaurant', price: '$25–50' },
    ],
    drinks: [
      { item: 'Thai iced tea', price: '$0.75' },
      { item: 'Chang/Singha beer', price: '$1.50' },
      { item: 'Fresh coconut water', price: '$0.75' },
      { item: 'Rooftop bar cocktail', price: '$8–15' },
      { item: 'Café latte', price: '$2.50–4' },
    ],
    entertainment: [
      { item: 'Grand Palace entry', price: '$16' },
      { item: 'Wat Pho (reclining Buddha)', price: '$7' },
      { item: 'Chatuchak Weekend Market', price: 'Free entry' },
      { item: 'Muay Thai ringside ticket', price: '$30–60' },
      { item: 'River boat day pass (Chao Phraya)', price: '$1–3' },
      { item: 'Thai massage (1 hr)', price: '$6–10' },
    ],
  },
  'Tokyo': {
    photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/Skyscrapers_of_Shinjuku_2009_January.jpg/1280px-Skyscrapers_of_Shinjuku_2009_January.jpg',
    landmark: 'Shinjuku Skyline & Senso-ji Temple',
    food: [
      { item: 'Ramen bowl', price: '$7–10' },
      { item: 'Conveyor belt sushi (10 pcs)', price: '$8–12' },
      { item: 'Onigiri (convenience store)', price: '$1.20' },
      { item: 'Bento box (station)', price: '$5–8' },
      { item: 'Izakaya dinner (per person)', price: '$15–25' },
      { item: 'Omakase sushi (mid-range)', price: '$60–120' },
    ],
    drinks: [
      { item: 'Vending machine coffee', price: '$1.00' },
      { item: 'Draft beer at izakaya', price: '$3–5' },
      { item: 'Sake (glass)', price: '$4–6' },
      { item: 'Café latte (Blue Bottle/etc)', price: '$4–5' },
      { item: 'Highball cocktail', price: '$3–5' },
    ],
    entertainment: [
      { item: 'Senso-ji Temple', price: 'Free' },
      { item: 'Shibuya Sky observation', price: '$15' },
      { item: 'Tsukiji Outer Market food tour', price: '$40–60' },
      { item: 'TeamLab Borderless', price: '$25' },
      { item: 'Onsen day pass', price: '$10–20' },
      { item: 'Karaoke (1 hr per person)', price: '$5–10' },
    ],
  },
  'Barcelona': {
    photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Sagrada_Familia_01.jpg/1280px-Sagrada_Familia_01.jpg',
    landmark: 'Sagrada Família',
    food: [
      { item: 'Patatas bravas (tapas)', price: '$4–6' },
      { item: 'Pintxos (each)', price: '$2–3' },
      { item: 'Menú del día (lunch set)', price: '$10–14' },
      { item: 'Paella for two', price: '$25–40' },
      { item: 'Jamón Ibérico plate', price: '$12–18' },
      { item: 'Fine dining entrée', price: '$30–50' },
    ],
    drinks: [
      { item: 'Café con leche', price: '$1.50–2' },
      { item: 'Glass of cava', price: '$3–5' },
      { item: 'Sangria pitcher', price: '$8–12' },
      { item: 'Caña (small draft beer)', price: '$2–3' },
      { item: 'Cocktail at beach bar', price: '$8–14' },
    ],
    entertainment: [
      { item: 'Sagrada Família ticket', price: '$28' },
      { item: 'Park Güell entry', price: '$12' },
      { item: 'Flamenco show (Tablao)', price: '$30–50' },
      { item: 'Barceloneta beach', price: 'Free' },
      { item: 'Camp Nou stadium tour', price: '$28' },
      { item: 'La Boqueria market browse', price: 'Free' },
    ],
  },
  'Paris': {
    photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Tour_Eiffel_Wikimedia_Commons.jpg/800px-Tour_Eiffel_Wikimedia_Commons.jpg',
    landmark: 'Eiffel Tower & Montmartre',
    food: [
      { item: 'Croissant (boulangerie)', price: '$1.50' },
      { item: 'Crêpe (street stall)', price: '$3–5' },
      { item: 'Baguette sandwich', price: '$4–6' },
      { item: 'Lunch menu du jour', price: '$14–18' },
      { item: 'Bistro dinner entrée', price: '$20–35' },
      { item: 'Fine dining (Michelin)', price: '$80–200' },
    ],
    drinks: [
      { item: 'Espresso (café)', price: '$2–3' },
      { item: 'Glass of house wine', price: '$5–8' },
      { item: 'Café au lait', price: '$3–4' },
      { item: 'Craft beer (bar)', price: '$6–9' },
      { item: 'Cocktail at wine bar', price: '$12–18' },
    ],
    entertainment: [
      { item: 'Eiffel Tower summit', price: '$28' },
      { item: 'Louvre Museum entry', price: '$22' },
      { item: 'Musée d\'Orsay', price: '$16' },
      { item: 'Seine river cruise', price: '$15–20' },
      { item: 'Versailles day trip', price: '$20–30' },
      { item: 'Moulin Rouge show', price: '$100–200' },
    ],
  },
  'Medellín': {
    photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/db/Medellin_Skyline.jpg/1280px-Medellin_Skyline.jpg',
    landmark: 'Medellín Skyline & Comuna 13',
    food: [
      { item: 'Bandeja Paisa (national dish)', price: '$3–5' },
      { item: 'Arepa con queso', price: '$1.00' },
      { item: 'Empanadas (3 pcs)', price: '$1.00' },
      { item: 'Corrientazo (set lunch)', price: '$2.50–4' },
      { item: 'Mid-range restaurant', price: '$8–15' },
      { item: 'Upscale restaurant dinner', price: '$20–35' },
    ],
    drinks: [
      { item: 'Tinto (black coffee)', price: '$0.30' },
      { item: 'Fresh fruit juice (natural)', price: '$1.00' },
      { item: 'Aguardiente shot', price: '$0.75' },
      { item: 'Club Colombia beer', price: '$1.00–2' },
      { item: 'Craft cocktail', price: '$4–7' },
    ],
    entertainment: [
      { item: 'Comuna 13 graffiti tour', price: '$10–15' },
      { item: 'Metrocable ride (one way)', price: '$0.75' },
      { item: 'Botanical Garden entry', price: 'Free' },
      { item: 'Paragliding', price: '$40–60' },
      { item: 'Guatapé day trip (inc. El Peñón)', price: '$20–30' },
      { item: 'Salsa class', price: '$5–10' },
    ],
  },
  'Dubai': {
    photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Dubai_Marina_Skyline.jpg/1280px-Dubai_Marina_Skyline.jpg',
    landmark: 'Burj Khalifa & Dubai Marina',
    food: [
      { item: 'Shawarma wrap (street)', price: '$2–3' },
      { item: 'Karak chai', price: '$1.00' },
      { item: 'Al Machboos rice platter', price: '$5–8' },
      { item: 'Food court meal (mall)', price: '$7–12' },
      { item: 'Mid-range restaurant', price: '$20–35' },
      { item: 'Fine dining (Burj)', price: '$80–200' },
    ],
    drinks: [
      { item: 'Fresh juice (mango/orange)', price: '$2–3' },
      { item: 'Arabic coffee (qahwa)', price: '$2–4' },
      { item: 'Beer at licensed venue', price: '$10–14' },
      { item: 'Cocktail at sky bar', price: '$18–30' },
      { item: 'Café latte (specialty)', price: '$5–7' },
    ],
    entertainment: [
      { item: 'Burj Khalifa observation deck', price: '$40–55' },
      { item: 'Dubai Mall (inc. aquarium)', price: '$35' },
      { item: 'Desert safari (half day)', price: '$40–70' },
      { item: 'Dubai Frame entry', price: '$14' },
      { item: 'Dhow dinner cruise', price: '$30–60' },
      { item: 'Museum of the Future', price: '$40' },
    ],
  },
};

export const DESTINATIONS: Destination[] = [
  { id: 'chiangmai', city: 'Chiang Mai', country: 'Thailand', emoji: '🏔️', lat: 18.7883, lng: 98.9853, rating: 4.8, pop: '7M+ nomads', wikiTitle: 'Chiang Mai', speed: 52, safetyScore: 8.2, monthlyCost: 1200, weatherDesc: 'Warm & Sunny', temp: 28, tags: ['Affordable', 'Digital Nomad'], popular: true, desc: 'Ancient temples, cool mountains, fast internet, and the most affordable nomad lifestyle in Asia.' },
  { id: 'lisbon', city: 'Lisbon', country: 'Portugal', emoji: '🇵🇹', lat: 38.7169, lng: -9.1399, rating: 4.7, pop: '6M+ nomads', wikiTitle: 'Lisbon', speed: 48, safetyScore: 8.7, monthlyCost: 1605, weatherDesc: 'Mild & Breezy', temp: 18, tags: ['Bitcoin-Friendly', 'Tax Perks'], popular: true, desc: 'Sunny capital with pastel streets, great food, crypto-friendly culture, and NHR tax regime.' },
  { id: 'bali', city: 'Bali', country: 'Indonesia', emoji: '🌴', lat: -8.3405, lng: 115.0919, rating: 4.8, pop: '8M+ nomads', wikiTitle: 'Bali', speed: 38, safetyScore: 7.9, monthlyCost: 1400, weatherDesc: 'Tropical & Lush', temp: 30, tags: ['Surf & Co-Work', 'Nomad Hub'], popular: true, desc: 'Tropical paradise with rice terraces, temples, and a world-class digital nomad community in Canggu.' },
  { id: 'bangkok', city: 'Bangkok', country: 'Thailand', emoji: '🛕', lat: 13.7563, lng: 100.5018, rating: 4.7, pop: '11M+ nomads', wikiTitle: 'Bangkok', speed: 45, safetyScore: 7.5, monthlyCost: 1100, weatherDesc: 'Hot & Vibrant', temp: 32, tags: ['Street Food', 'Nightlife'], popular: true, desc: 'Vibrant street food, temples, and a booming nomad scene. Low cost of living with fast fiber internet.' },
  { id: 'tokyo', city: 'Tokyo', country: 'Japan', emoji: '🗼', lat: 35.6762, lng: 139.6503, rating: 4.9, pop: '14M+ nomads', wikiTitle: 'Tokyo', speed: 78, safetyScore: 9.4, monthlyCost: 2800, weatherDesc: 'Cool & Clear', temp: 16, tags: ['BTC Friendly', 'Ultra-Modern'], popular: false, desc: 'Ultra-modern city with ancient temples, perfect transit, and incredible food. Bitcoin-friendly with thousands of merchants.' },
  { id: 'barcelona', city: 'Barcelona', country: 'Spain', emoji: '🏖️', lat: 41.3851, lng: 2.1734, rating: 4.8, pop: '7M+ nomads', wikiTitle: 'Barcelona', speed: 55, safetyScore: 7.8, monthlyCost: 2200, weatherDesc: 'Sunny & Warm', temp: 22, tags: ['Beach Life', 'Startup Hub'], popular: false, desc: "Architecture, beaches, and an incredible startup scene. One of Europe's top Bitcoin cities." },
  { id: 'paris', city: 'Paris', country: 'France', emoji: '🗼', lat: 48.8566, lng: 2.3522, rating: 4.7, pop: '5M+ nomads', wikiTitle: 'Paris', speed: 50, safetyScore: 7.2, monthlyCost: 2500, weatherDesc: 'Mild & Romantic', temp: 15, tags: ['Art & Culture', 'Startup Hub'], popular: false, desc: "City of light with world-class cuisine, a thriving tech startup scene, and some of Europe's best museums and cafés." },
  { id: 'medellin', city: 'Medellín', country: 'Colombia', emoji: '🌺', lat: 6.2476, lng: -75.5658, rating: 4.6, pop: '5M+ nomads', wikiTitle: 'Medellín', speed: 32, safetyScore: 6.8, monthlyCost: 900, weatherDesc: 'Spring All Year', temp: 22, tags: ['Budget Pick', 'Crypto Scene'], popular: false, desc: 'The city of eternal spring. Growing crypto scene, affordable living, and a welcoming local culture.' },
  { id: 'dubai', city: 'Dubai', country: 'UAE', emoji: '🏙️', lat: 25.2048, lng: 55.2708, rating: 4.7, pop: '9M+ nomads', wikiTitle: 'Dubai', speed: 62, safetyScore: 8.9, monthlyCost: 3200, weatherDesc: 'Sunny & Hot', temp: 35, tags: ['Tax-Free', 'Luxury'], popular: false, desc: 'Tax-free hub with world-class infrastructure, crypto-friendly regulations, and 0% income tax.' },
];

const getHour = () => new Date().getHours();

export const getCategories = (): PlaceCategory[] => [
  { id: 'food', label: 'Food', emoji: getHour() < 10 ? '🍳' : getHour() < 15 ? '🍜' : getHour() < 20 ? '🍽️' : '🌮', query: 'restaurants' },
  { id: 'cafe', label: 'Cafes', emoji: getHour() < 11 ? '☕' : getHour() < 16 ? '🧋' : '🍵', query: 'cafes' },
  { id: 'drinks', label: 'Drinks', emoji: '🍸', query: 'bars lounges' },
  { id: 'hotel', label: 'Hotels', emoji: '🏨', query: 'hotels' },
  { id: 'shop', label: 'Shopping', emoji: '🛍️', query: 'shopping' },
  { id: 'transport', label: 'Transit', emoji: '🚇', query: 'public transit' },
  { id: 'gym', label: 'Fitness', emoji: '💪', query: 'gym' },
  { id: 'beach', label: 'Beaches', emoji: '🏖️', query: 'beach' },
  { id: 'nightlife', label: 'Nightlife', emoji: '🎵', query: 'nightlife bars' },
  { id: 'attractions', label: 'Attractions', emoji: '🎡', query: 'tourist attractions things to do' },
  { id: 'atm', label: 'ATM', emoji: '🏧', query: 'atm cash machine' },
  { id: 'bank', label: 'Bank', emoji: '🏦', query: 'bank' },
  { id: 'btcatm', label: 'BTC ATM', emoji: '₿', query: 'bitcoin atm cryptocurrency' },
  { id: 'hospital', label: 'Hospital', emoji: '🏥', query: 'hospital' },
  { id: 'er', label: 'Emergency Room', emoji: '🚑', query: 'emergency room ER' },
  { id: 'childrenhospital', label: "Children's Hospital", emoji: '👶', query: "children's hospital pediatric" },
  { id: 'urgentcare', label: 'Urgent Care', emoji: '⚕️', query: 'urgent care clinic' },
  { id: 'pharmacy', label: 'Pharmacy', emoji: '💊', query: 'pharmacy' },
  { id: 'pharmacy24', label: '24hr Pharmacy', emoji: '🕐', query: '24 hour pharmacy open now' },
  { id: 'dentist', label: 'Dentist', emoji: '🦷', query: 'dentist dental clinic' },
  { id: 'auto', label: 'Auto Care', emoji: '🔧', query: 'auto repair car maintenance' },
  { id: 'gas', label: 'Gas Stations', emoji: '⛽', query: 'gas station fuel' },
  { id: 'laundry', label: 'Laundry', emoji: '🧺', query: 'laundromat laundry service' },
  { id: 'coworking', label: 'Coworking', emoji: '💻', query: 'coworking space shared office' },
  { id: 'spa', label: 'Spa & Beauty', emoji: '💆', query: 'spa beauty salon massage' },
  { id: 'ev', label: 'EV Charging', emoji: '⚡', query: 'electric vehicle charging station' },
  { id: 'library', label: 'Libraries', emoji: '📚', query: 'public library' },
  { id: 'park', label: 'Parks', emoji: '🌳', query: 'park nature garden' },
  { id: 'parking', label: 'Parking', emoji: '🅿️', query: 'parking lot garage' },
  { id: 'lodge', label: 'Lodges', emoji: '🏕️', query: 'lodge cabin resort inn' },
  { id: 'outdoor', label: 'Outdoor', emoji: '🏕️', query: 'campground hiking trail recreation' },
  { id: 'watersports', label: 'Water Sports', emoji: '🏄', query: 'surfing kayaking diving snorkeling sailing' },
  { id: 'wintersports', label: 'Winter Sports', emoji: '⛷️', query: 'ski resort snowboarding ice skating' },
];

export const CATEGORY_SUBS: Record<string, SubCategory[]> = {
  food: [
    { label: 'American', query: 'american restaurant', emoji: '🍔' },
    { label: 'Bakery', query: 'bakery bread', emoji: '🥐' },
    { label: 'Burger', query: 'burger restaurant', emoji: '🍔' },
    { label: 'Caribbean', query: 'caribbean restaurant', emoji: '🍹' },
    { label: 'Chinese', query: 'chinese restaurant', emoji: '🥡' },
    { label: 'European', query: 'european restaurant', emoji: '🇪🇺' },
    { label: 'Fast Food', query: 'fast food', emoji: '🍟' },
    { label: 'French', query: 'french restaurant', emoji: '🥐' },
    { label: 'Indian', query: 'indian restaurant', emoji: '🍛' },
    { label: 'Italian', query: 'italian restaurant', emoji: '🍝' },
    { label: 'Japanese', query: 'japanese restaurant', emoji: '🍱' },
    { label: 'Mediterranean', query: 'mediterranean restaurant', emoji: '🥙' },
    { label: 'Mexican', query: 'mexican restaurant', emoji: '🌮' },
    { label: 'Pizza', query: 'pizza restaurant', emoji: '🍕' },
    { label: 'Seafood', query: 'seafood restaurant', emoji: '🦞' },
    { label: 'Thai', query: 'thai restaurant', emoji: '🍜' },
    { label: 'Vietnamese', query: 'vietnamese restaurant', emoji: '🍲' },
    { label: 'Steak', query: 'steakhouse', emoji: '🥩' },
  ],
  cafe: [
    { label: 'Coffee', query: 'coffee cafe', emoji: '☕' },
    { label: 'Boba / Tea', query: 'boba tea shop', emoji: '🧋' },
    { label: 'Juice Bar', query: 'juice bar smoothie', emoji: '🧃' },
  ],
  drinks: [
    { label: 'Cocktail Bar', query: 'cocktail bar lounge', emoji: '🍸' },
    { label: 'Brewery', query: 'brewery craft beer taproom', emoji: '🍺' },
    { label: 'Wine Bar', query: 'wine bar', emoji: '🍷' },
    { label: 'Sports Bar', query: 'sports bar pub', emoji: '📺' },
    { label: 'Rooftop Bar', query: 'rooftop bar', emoji: '🌃' },
    { label: 'Hookah', query: 'hookah lounge shisha', emoji: '💨' },
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
    { label: 'Nightclub', query: 'nightclub dance', emoji: '🎉' },
    { label: 'Live Music', query: 'live music venue', emoji: '🎵' },
    { label: 'Comedy Club', query: 'comedy club', emoji: '🎤' },
    { label: 'Karaoke', query: 'karaoke bar', emoji: '🎙️' },
    { label: 'Lounge', query: 'lounge nightlife', emoji: '🛋️' },
  ],
  attractions: [
    { label: 'Museums', query: 'museum art gallery', emoji: '🏛️' },
    { label: 'Tours', query: 'sightseeing tour', emoji: '🗺️' },
    { label: 'Theme Parks', query: 'theme park amusement', emoji: '🎢' },
    { label: 'Landmarks', query: 'landmark monument', emoji: '🗽' },
    { label: 'Events', query: 'events concerts festivals', emoji: '🎪' },
    { label: 'Cinema', query: 'movie theater cinema', emoji: '🎬' },
    { label: 'Bowling', query: 'bowling alley', emoji: '🎳' },
    { label: 'Arcade', query: 'arcade game center', emoji: '🕹️' },
  ],
  hotel: [
    { label: 'Hotel', query: 'hotel', emoji: '🏨' },
    { label: 'Villa', query: 'villa vacation rental', emoji: '🏡' },
    { label: 'Resort', query: 'resort luxury', emoji: '🏖️' },
    { label: 'Boutique', query: 'boutique hotel', emoji: '🌟' },
    { label: 'Hostel', query: 'hostel backpacker', emoji: '🛏️' },
    { label: 'Airbnb', query: 'vacation rental short-term', emoji: '🏠' },
    { label: 'Motel', query: 'motel', emoji: '🛌' },
  ],
  lodge: [
    { label: 'Lodge', query: 'lodge', emoji: '🏕️' },
    { label: 'Cabin', query: 'cabin rental', emoji: '🪵' },
    { label: 'Inn', query: 'inn bed and breakfast', emoji: '🏡' },
    { label: 'B&B', query: 'bed and breakfast', emoji: '🍳' },
    { label: 'Campground', query: 'campground RV park', emoji: '⛺' },
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
  auto: [
    { label: 'Oil Change', query: 'oil change auto service', emoji: '🛢️' },
    { label: 'Tire Shop', query: 'tire shop tire service', emoji: '🛞' },
    { label: 'Body Shop', query: 'auto body shop collision repair', emoji: '🚗' },
    { label: 'Mechanic', query: 'auto mechanic car repair', emoji: '🔧' },
    { label: 'Car Wash', query: 'car wash detailing', emoji: '🧽' },
    { label: 'Brakes', query: 'brake repair service', emoji: '🛑' },
    { label: 'Transmission', query: 'transmission repair service', emoji: '⚙️' },
    { label: 'Towing', query: 'towing service roadside assistance', emoji: '🚛' },
    { label: 'All Auto', query: 'auto repair car maintenance', emoji: '🔧' },
  ],
  beach: [
    { label: 'Beach', query: 'beach ocean swimming', emoji: '🏖️' },
    { label: 'Park', query: 'park garden', emoji: '🌳' },
    { label: 'Lake', query: 'lake waterfront', emoji: '🏞️' },
    { label: 'Hiking', query: 'hiking trail nature', emoji: '🥾' },
  ],
  gas: [
    { label: 'Gas Station', query: 'gas station fuel', emoji: '⛽' },
    { label: 'Diesel', query: 'diesel fuel station', emoji: '🛢️' },
  ],
  laundry: [
    { label: 'Laundromat', query: 'laundromat self service laundry', emoji: '🧺' },
    { label: 'Dry Cleaner', query: 'dry cleaning service', emoji: '👔' },
  ],
  coworking: [
    { label: 'Coworking', query: 'coworking space shared office', emoji: '💻' },
    { label: 'Library', query: 'public library study', emoji: '📚' },
    { label: 'Business Center', query: 'business center office rental', emoji: '🏢' },
  ],
  spa: [
    { label: 'Spa', query: 'spa massage wellness', emoji: '💆' },
    { label: 'Hair Salon', query: 'hair salon barbershop', emoji: '💇' },
    { label: 'Nail Salon', query: 'nail salon manicure', emoji: '💅' },
    { label: 'Massage', query: 'massage therapy', emoji: '🧖' },
  ],
  ev: [
    { label: 'EV Charger', query: 'electric vehicle charging station', emoji: '⚡' },
    { label: 'Tesla', query: 'tesla supercharger', emoji: '🔌' },
  ],
  library: [
    { label: 'Public Library', query: 'public library', emoji: '📚' },
    { label: 'University Library', query: 'university library', emoji: '🎓' },
    { label: 'Bookstore', query: 'bookstore book shop', emoji: '📖' },
  ],
  park: [
    { label: 'Parks', query: 'park nature garden', emoji: '🌳' },
    { label: 'Hiking', query: 'hiking trail nature path', emoji: '🥾' },
    { label: 'Dog Park', query: 'dog park off leash', emoji: '🐕' },
    { label: 'Playground', query: 'playground park children', emoji: '🛝' },
    { label: 'Botanical Garden', query: 'botanical garden arboretum', emoji: '🌸' },
    { label: 'National Park', query: 'national park state park', emoji: '🏞️' },
  ],
  outdoor: [
    { label: 'Campgrounds', query: 'campground camping site', emoji: '⛺' },
    { label: 'Hiking Trails', query: 'hiking trail trailhead', emoji: '🥾' },
    { label: 'Rock Climbing', query: 'rock climbing bouldering', emoji: '🧗' },
    { label: 'Cycling Trails', query: 'mountain bike trail cycling path', emoji: '🚴' },
    { label: 'Wildlife Areas', query: 'nature reserve wildlife sanctuary', emoji: '🦅' },
    { label: 'Picnic Areas', query: 'picnic area park pavilion', emoji: '🧺' },
  ],
  watersports: [
    { label: 'Surfing', query: 'surf school surfing beach', emoji: '🏄' },
    { label: 'Kayaking', query: 'kayak rental kayaking', emoji: '🛶' },
    { label: 'Scuba & Snorkel', query: 'scuba diving snorkeling', emoji: '🤿' },
    { label: 'Sailing', query: 'sailing charter boat tour', emoji: '⛵' },
    { label: 'Fishing', query: 'fishing charter pier fishing', emoji: '🎣' },
    { label: 'Whitewater', query: 'whitewater rafting river kayak', emoji: '🌊' },
  ],
  wintersports: [
    { label: 'Skiing', query: 'ski resort ski area', emoji: '⛷️' },
    { label: 'Snowboarding', query: 'snowboard park terrain', emoji: '🏂' },
    { label: 'Ice Skating', query: 'ice skating rink', emoji: '⛸️' },
    { label: 'Snowshoeing', query: 'snowshoe trail winter hiking', emoji: '🌨️' },
    { label: 'Sledding', query: 'sledding hill tubing park', emoji: '🛷' },
  ],
};

export const PHRASES: Record<string, { label: string; phrases: { en: string; local: string; phon: string }[] }> = {
  es: { label: '🇪🇸 Spanish', phrases: [
    { en: 'Hello', local: 'Hola', phon: 'OH-lah' },
    { en: 'Goodbye', local: 'Adiós', phon: 'ah-dee-OHS' },
    { en: 'Please', local: 'Por favor', phon: 'por fah-VOR' },
    { en: 'Thank you', local: 'Gracias', phon: 'GRAH-syahs' },
    { en: 'Yes / No', local: 'Sí / No', phon: 'see / noh' },
    { en: 'Excuse me', local: 'Disculpe', phon: 'dees-KOOL-peh' },
    { en: 'I don\'t understand', local: 'No entiendo', phon: 'noh en-tee-EN-doh' },
    { en: 'Do you speak English?', local: '¿Habla inglés?', phon: 'AH-blah een-GLES' },
    { en: 'Where is…?', local: '¿Dónde está…?', phon: 'DON-day es-TAH' },
    { en: 'Where is the bathroom?', local: '¿Dónde está el baño?', phon: 'DON-day es-TAH el BAH-nyoh' },
    { en: 'Where is the airport?', local: '¿Dónde está el aeropuerto?', phon: 'DON-day es-TAH el ah-eh-roh-PWER-toh' },
    { en: 'How much does this cost?', local: '¿Cuánto cuesta?', phon: 'KWAHN-toh KWES-tah' },
    { en: 'I need a taxi', local: 'Necesito un taxi', phon: 'neh-seh-SEE-toh oon TAK-see' },
    { en: 'I need a doctor', local: 'Necesito un médico', phon: 'neh-seh-SEE-toh oon MEH-dee-koh' },
    { en: 'Help!', local: '¡Ayuda!', phon: 'ah-YOO-dah' },
    { en: 'Water', local: 'Agua', phon: 'AH-gwah' },
    { en: 'The check, please', local: 'La cuenta, por favor', phon: 'lah KWEN-tah por fah-VOR' },
    { en: 'Left / Right / Straight', local: 'Izquierda / Derecha / Recto', phon: 'ees-kee-ER-dah / deh-REH-chah / REK-toh' },
    { en: 'I\'m lost', local: 'Estoy perdido/a', phon: 'es-TOY per-DEE-doh' },
    { en: 'Can you help me?', local: '¿Puede ayudarme?', phon: 'PWEH-deh ah-yoo-DAR-meh' },
    { en: 'Do you accept Bitcoin?', local: '¿Acepta Bitcoin?', phon: 'ah-SEP-tah Bitcoin' },
    { en: 'Good morning', local: 'Buenos días', phon: 'BWEH-nohs DEE-ahs' },
  ]},
  zh: { label: '🇨🇳 Mandarin', phrases: [
    { en: 'Hello', local: '你好', phon: 'nee-HOW' },
    { en: 'Goodbye', local: '再见', phon: 'zai-jee-EN' },
    { en: 'Please', local: '请', phon: 'ching' },
    { en: 'Thank you', local: '谢谢', phon: 'shyeh-shyeh' },
    { en: 'Yes / No', local: '是 / 不是', phon: 'shir / boo-shir' },
    { en: 'Excuse me', local: '请问', phon: 'ching-wen' },
    { en: 'I don\'t understand', local: '我不明白', phon: 'woh boo ming-bai' },
    { en: 'Do you speak English?', local: '你会说英语吗？', phon: 'nee hway shwoh ying-yoo mah' },
    { en: 'Where is…?', local: '…在哪里？', phon: '...zai nah-lee' },
    { en: 'Where is the bathroom?', local: '洗手间在哪里？', phon: 'shee-show-jee-en zai nah-lee' },
    { en: 'Where is the airport?', local: '机场在哪里？', phon: 'jee-chahng zai nah-lee' },
    { en: 'How much does this cost?', local: '这个多少钱？', phon: 'jeh-guh dwoh-shaow chee-en' },
    { en: 'I need a taxi', local: '我需要出租车', phon: 'woh shoo-yaow choo-zoo-chuh' },
    { en: 'I need a doctor', local: '我需要医生', phon: 'woh shoo-yaow ee-sheng' },
    { en: 'Help!', local: '救命！', phon: 'jyo-ming' },
    { en: 'Water', local: '水', phon: 'shway' },
    { en: 'The check, please', local: '买单', phon: 'mai-dahn' },
    { en: 'Left / Right / Straight', local: '左 / 右 / 直走', phon: 'zwoh / yo / jr-zoh' },
    { en: 'I\'m lost', local: '我迷路了', phon: 'woh mee-loo luh' },
    { en: 'Can you help me?', local: '你能帮我吗？', phon: 'nee nung bahng woh mah' },
  ]},
  fr: { label: '🇫🇷 French', phrases: [
    { en: 'Hello', local: 'Bonjour', phon: 'bohn-ZHOOR' },
    { en: 'Goodbye', local: 'Au revoir', phon: 'oh reh-VWAHR' },
    { en: 'Please', local: 'S\'il vous plaît', phon: 'seel voo PLAY' },
    { en: 'Thank you', local: 'Merci', phon: 'mehr-SEE' },
    { en: 'Yes / No', local: 'Oui / Non', phon: 'wee / nohn' },
    { en: 'Excuse me', local: 'Excusez-moi', phon: 'ex-koo-ZAY mwah' },
    { en: 'I don\'t understand', local: 'Je ne comprends pas', phon: 'zhuh nuh kohm-PRAHN pah' },
    { en: 'Do you speak English?', local: 'Parlez-vous anglais?', phon: 'par-LAY voo ahn-GLAY' },
    { en: 'Where is…?', local: 'Où est…?', phon: 'oo AY' },
    { en: 'Where is the bathroom?', local: 'Où sont les toilettes?', phon: 'oo sohn lay twa-LET' },
    { en: 'Where is the airport?', local: "Où est l'aéroport?", phon: 'oo AY lay-ro-POUR' },
    { en: 'How much does this cost?', local: 'Combien ça coûte?', phon: 'kohm-BYEH sah KOOT' },
    { en: 'I need a taxi', local: 'J\'ai besoin d\'un taxi', phon: 'zhay buh-ZWEH dun TAK-see' },
    { en: 'I need a doctor', local: 'J\'ai besoin d\'un médecin', phon: 'zhay buh-ZWEH dun med-SAN' },
    { en: 'Help!', local: 'Au secours!', phon: 'oh skoor' },
    { en: 'Water', local: 'De l\'eau', phon: 'duh LOH' },
    { en: 'The check, please', local: 'L\'addition, s\'il vous plaît', phon: 'lah-dee-SYOHN seel voo PLAY' },
    { en: 'Left / Right / Straight', local: 'Gauche / Droite / Tout droit', phon: 'gohsh / drwaht / too DRWAH' },
    { en: 'I\'m lost', local: 'Je suis perdu(e)', phon: 'zhuh swee pair-DOO' },
    { en: 'Can you help me?', local: 'Pouvez-vous m\'aider?', phon: 'poo-VAY voo may-DAY' },
    { en: 'Do you accept Bitcoin?', local: 'Acceptez-vous Bitcoin?', phon: 'ak-sep-TAY voo Bitcoin' },
  ]},
  ar: { label: '🇸🇦 Arabic', phrases: [
    { en: 'Hello', local: 'مرحبا', phon: 'MAR-ha-ba' },
    { en: 'Goodbye', local: 'مع السلامة', phon: 'ma-ah sa-LAH-mah' },
    { en: 'Please', local: 'من فضلك', phon: 'min FAD-lak' },
    { en: 'Thank you', local: 'شكراً', phon: 'SHOOK-ran' },
    { en: 'Yes / No', local: 'نعم / لا', phon: 'NA-am / lah' },
    { en: 'Excuse me', local: 'عفواً', phon: 'AF-wan' },
    { en: 'I don\'t understand', local: 'لا أفهم', phon: 'lah AF-ham' },
    { en: 'Do you speak English?', local: 'هل تتكلم الإنجليزية؟', phon: 'hal ta-ta-KAL-lam al-in-glee-ZEE-ya' },
    { en: 'Where is…?', local: 'أين…؟', phon: 'AY-na' },
    { en: 'Where is the bathroom?', local: 'أين الحمام؟', phon: 'AY-na al-ham-MAHM' },
    { en: 'Where is the airport?', local: 'أين المطار؟', phon: 'AY-na al-ma-TAHR' },
    { en: 'How much does this cost?', local: 'بكم هذا؟', phon: 'bi-KAM HAH-tha' },
    { en: 'I need a taxi', local: 'أحتاج تاكسي', phon: 'ah-TAHJ TAK-see' },
    { en: 'I need a doctor', local: 'أحتاج طبيب', phon: 'ah-TAHJ ta-BEEB' },
    { en: 'Help!', local: '!مساعدة', phon: 'moo-SAH-ah-dah' },
    { en: 'Water', local: 'ماء', phon: 'MAH' },
    { en: 'The check, please', local: 'الحساب من فضلك', phon: 'al-hee-SAHB min FAD-lak' },
    { en: 'Left / Right / Straight', local: 'يسار / يمين / مستقيم', phon: 'ya-SAHR / ya-MEEN / mus-ta-QEEM' },
    { en: 'I\'m lost', local: 'أنا ضائع', phon: 'AH-na DAH-ee' },
    { en: 'Can you help me?', local: 'هل يمكنك مساعدتي؟', phon: 'hal yum-ki-nak moo-SAH-ah-da-tee' },
  ]},
  hi: { label: '🇮🇳 Hindi', phrases: [
    { en: 'Hello', local: 'नमस्ते', phon: 'nah-mah-STAY' },
    { en: 'Goodbye', local: 'अलविदा', phon: 'al-vee-DAH' },
    { en: 'Please', local: 'कृपया', phon: 'KRIP-yah' },
    { en: 'Thank you', local: 'धन्यवाद', phon: 'dhun-yah-VAHD' },
    { en: 'Yes / No', local: 'हाँ / नहीं', phon: 'hahn / nah-HEE' },
    { en: 'Excuse me', local: 'माफ़ कीजिए', phon: 'MAHF kee-jee-ay' },
    { en: 'I don\'t understand', local: 'मुझे समझ नहीं आया', phon: 'MOO-jhay sa-MAHJ nah-HEE AH-yah' },
    { en: 'Do you speak English?', local: 'क्या आप अंग्रेज़ी बोलते हैं?', phon: 'kyah aap ANG-reh-zee BOL-tay hain' },
    { en: 'Where is…?', local: '…कहाँ है?', phon: '...ka-HAHN hai' },
    { en: 'Where is the bathroom?', local: 'बाथरूम कहाँ है?', phon: 'BATH-room ka-HAHN hai' },
    { en: 'Where is the airport?', local: 'हवाई अड्डा कहाँ है?', phon: 'ha-VAH-ee ADD-dah ka-HAHN hai' },
    { en: 'How much does this cost?', local: 'यह कितने का है?', phon: 'yeh KIT-nay kah hai' },
    { en: 'I need a taxi', local: 'मुझे टैक्सी चाहिए', phon: 'MOO-jhay TAK-see CHAH-hee-ay' },
    { en: 'I need a doctor', local: 'मुझे डॉक्टर चाहिए', phon: 'MOO-jhay DOK-tar CHAH-hee-ay' },
    { en: 'Help!', local: 'मदद!', phon: 'MAH-dahd' },
    { en: 'Water', local: 'पानी', phon: 'PAH-nee' },
    { en: 'The check, please', local: 'बिल दीजिए', phon: 'bill DEE-jee-ay' },
    { en: 'Left / Right / Straight', local: 'बाएँ / दाएँ / सीधा', phon: 'BAH-ay / DAH-ay / SEE-dhah' },
    { en: 'I\'m lost', local: 'मैं खो गया/गयी हूँ', phon: 'main KHO gah-YAH hoon' },
    { en: 'Can you help me?', local: 'क्या आप मेरी मदद कर सकते हैं?', phon: 'kyah aap MEH-ree MAH-dahd kar SAK-tay hain' },
  ]},
  pt: { label: '🇧🇷 Portuguese', phrases: [
    { en: 'Hello', local: 'Olá', phon: 'oh-LAH' },
    { en: 'Goodbye', local: 'Tchau', phon: 'CHOW' },
    { en: 'Please', local: 'Por favor', phon: 'por fah-VOR' },
    { en: 'Thank you', local: 'Obrigado / Obrigada', phon: 'oh-bree-GAH-doo' },
    { en: 'Yes / No', local: 'Sim / Não', phon: 'seem / now' },
    { en: 'Excuse me', local: 'Com licença', phon: 'kohm lee-SEN-sah' },
    { en: 'I don\'t understand', local: 'Não entendo', phon: 'now en-TEN-doo' },
    { en: 'Do you speak English?', local: 'Você fala inglês?', phon: 'voh-SAY FAH-lah een-GLES' },
    { en: 'Where is…?', local: 'Onde fica…?', phon: 'ON-jee FEE-kah' },
    { en: 'Where is the bathroom?', local: 'Onde fica o banheiro?', phon: 'ON-jee FEE-kah oh ban-YAY-roo' },
    { en: 'Where is the airport?', local: 'Onde fica o aeroporto?', phon: 'ON-jee FEE-kah oh ah-eh-roh-POR-too' },
    { en: 'How much does this cost?', local: 'Quanto custa?', phon: 'KWAHN-too KOO-stah' },
    { en: 'I need a taxi', local: 'Preciso de um táxi', phon: 'preh-SEE-zoo jee oong TAK-see' },
    { en: 'I need a doctor', local: 'Preciso de um médico', phon: 'preh-SEE-zoo jee oong MEH-jee-koo' },
    { en: 'Help!', local: 'Socorro!', phon: 'so-KOH-hoo' },
    { en: 'Water', local: 'Água', phon: 'AH-gwah' },
    { en: 'The check, please', local: 'A conta, por favor', phon: 'ah KOHN-tah por fah-VOR' },
    { en: 'Left / Right / Straight', local: 'Esquerda / Direita / Em frente', phon: 'esh-KEHR-dah / jee-RAY-tah / en FREN-chee' },
    { en: 'I\'m lost', local: 'Estou perdido/a', phon: 'es-TOH per-JEE-doo' },
    { en: 'Can you help me?', local: 'Pode me ajudar?', phon: 'POH-jee mee ah-zhoo-DAR' },
    { en: 'Do you accept Bitcoin?', local: 'Aceita Bitcoin?', phon: 'ah-SAY-ta Bitcoin' },
  ]},
  ja: { label: '🇯🇵 Japanese', phrases: [
    { en: 'Hello', local: 'こんにちは', phon: 'kon-nee-chee-wa' },
    { en: 'Goodbye', local: 'さようなら', phon: 'sah-yoh-nah-rah' },
    { en: 'Please', local: 'お願いします', phon: 'oh-neh-gai shee-mas' },
    { en: 'Thank you', local: 'ありがとうございます', phon: 'a-ree-ga-toh go-zai-mas' },
    { en: 'Yes / No', local: 'はい / いいえ', phon: 'hai / ee-eh' },
    { en: 'Excuse me', local: 'すみません', phon: 'soo-mee-mah-sen' },
    { en: 'I don\'t understand', local: 'わかりません', phon: 'wah-ka-ree-mah-sen' },
    { en: 'Do you speak English?', local: '英語を話せますか？', phon: 'AY-go oh ha-nah-seh-mas-ka' },
    { en: 'Where is…?', local: '…はどこですか？', phon: '...wa do-ko des-ka' },
    { en: 'Where is the bathroom?', local: 'トイレはどこですか？', phon: 'TOY-reh wa do-ko des-ka' },
    { en: 'Where is the airport?', local: '空港はどこですか？', phon: 'koo-koh wa do-ko des-ka' },
    { en: 'How much does this cost?', local: 'いくらですか？', phon: 'ee-koo-ra des-ka' },
    { en: 'I need a taxi', local: 'タクシーをお願いします', phon: 'TAK-shee oh oh-neh-gai shee-mas' },
    { en: 'I need a doctor', local: '医者が必要です', phon: 'ee-sha ga hee-tsu-yo des' },
    { en: 'Help!', local: '助けて！', phon: 'ta-soo-ke-te' },
    { en: 'Water', local: '水', phon: 'mee-zoo' },
    { en: 'The check, please', local: 'お会計お願いします', phon: 'oh-kai-kay oh-neh-gai shee-mas' },
    { en: 'Left / Right / Straight', local: '左 / 右 / まっすぐ', phon: 'hee-da-ree / mee-gee / mas-soo-goo' },
    { en: 'I\'m lost', local: '道に迷いました', phon: 'mee-chee nee mah-yoy-mah-shta' },
    { en: 'Can you help me?', local: '助けてもらえますか？', phon: 'ta-soo-ke-te mo-rah-eh-mas-ka' },
    { en: 'Do you accept Bitcoin?', local: 'ビットコインは使えますか？', phon: 'bit-to-ko-in wa tsoo-ka-e-mas-ka' },
  ]},
  de: { label: '🇩🇪 German', phrases: [
    { en: 'Hello', local: 'Hallo', phon: 'HAL-oh' },
    { en: 'Goodbye', local: 'Auf Wiedersehen', phon: 'owf VEE-der-zay-en' },
    { en: 'Please', local: 'Bitte', phon: 'BIT-teh' },
    { en: 'Thank you', local: 'Danke schön', phon: 'DAHN-keh shern' },
    { en: 'Yes / No', local: 'Ja / Nein', phon: 'yah / nine' },
    { en: 'Excuse me', local: 'Entschuldigung', phon: 'ent-SHOOL-dee-goong' },
    { en: 'I don\'t understand', local: 'Ich verstehe nicht', phon: 'ikh fer-SHTAY-eh nikht' },
    { en: 'Do you speak English?', local: 'Sprechen Sie Englisch?', phon: 'SHPRE-khen zee ENG-lish' },
    { en: 'Where is…?', local: 'Wo ist…?', phon: 'voh ist' },
    { en: 'Where is the bathroom?', local: 'Wo ist die Toilette?', phon: 'voh ist dee twa-LET-teh' },
    { en: 'Where is the airport?', local: 'Wo ist der Flughafen?', phon: 'voh ist dair FLOOK-hah-fen' },
    { en: 'How much does this cost?', local: 'Wie viel kostet das?', phon: 'vee feel KOS-tet dahs' },
    { en: 'I need a taxi', local: 'Ich brauche ein Taxi', phon: 'ikh BROW-kheh ayn TAK-see' },
    { en: 'I need a doctor', local: 'Ich brauche einen Arzt', phon: 'ikh BROW-kheh eye-nen artst' },
    { en: 'Help!', local: 'Hilfe!', phon: 'HIL-feh' },
    { en: 'Water', local: 'Wasser', phon: 'VAH-ser' },
    { en: 'The check, please', local: 'Die Rechnung, bitte', phon: 'dee REKH-noong BIT-teh' },
    { en: 'Left / Right / Straight', local: 'Links / Rechts / Geradeaus', phon: 'links / rekhts / geh-RAH-deh-ows' },
    { en: 'I\'m lost', local: 'Ich habe mich verlaufen', phon: 'ikh HAH-beh mikh fer-LOW-fen' },
    { en: 'Can you help me?', local: 'Können Sie mir helfen?', phon: 'KER-nen zee meer HEL-fen' },
    { en: 'Do you accept Bitcoin?', local: 'Nehmen Sie Bitcoin?', phon: 'NAY-men zee Bitcoin' },
  ]},
  ko: { label: '🇰🇷 Korean', phrases: [
    { en: 'Hello', local: '안녕하세요', phon: 'ahn-nyeong-ha-SE-yo' },
    { en: 'Goodbye', local: '안녕히 가세요', phon: 'ahn-nyeong-hee ga-SE-yo' },
    { en: 'Please', local: '주세요', phon: 'joo-SE-yo' },
    { en: 'Thank you', local: '감사합니다', phon: 'gam-sa-HAM-ni-da' },
    { en: 'Yes / No', local: '네 / 아니요', phon: 'neh / ah-nee-yo' },
    { en: 'Excuse me', local: '실례합니다', phon: 'shil-lye-HAM-ni-da' },
    { en: 'I don\'t understand', local: '이해 못 해요', phon: 'ee-HAY moht HAY-yo' },
    { en: 'Do you speak English?', local: '영어 하세요?', phon: 'YUNG-uh ha-SE-yo' },
    { en: 'Where is…?', local: '…어디에요?', phon: '...uh-dee-AY-yo' },
    { en: 'Where is the bathroom?', local: '화장실 어디에요?', phon: 'hwa-jang-SHIL uh-dee-AY-yo' },
    { en: 'Where is the airport?', local: '공항 어디에요?', phon: 'gong-HANG uh-dee-AY-yo' },
    { en: 'How much does this cost?', local: '이거 얼마예요?', phon: 'ee-guh UHL-ma-YE-yo' },
    { en: 'I need a taxi', local: '택시 불러주세요', phon: 'TEK-shee bool-luh-joo-SE-yo' },
    { en: 'I need a doctor', local: '의사가 필요해요', phon: 'ee-sa-ga PIL-yo-HAY-yo' },
    { en: 'Help!', local: '도와주세요!', phon: 'do-wa-joo-SE-yo' },
    { en: 'Water', local: '물', phon: 'mool' },
    { en: 'The check, please', local: '계산서 주세요', phon: 'gye-san-SUH joo-SE-yo' },
    { en: 'Left / Right / Straight', local: '왼쪽 / 오른쪽 / 직진', phon: 'wen-JJOK / oh-run-JJOK / jik-JIN' },
    { en: 'I\'m lost', local: '길을 잃었어요', phon: 'GHEE-rool ee-ruh-ssuh-yo' },
    { en: 'Can you help me?', local: '도와주실 수 있어요?', phon: 'do-wa-joo-SHIL soo ee-ssuh-yo' },
  ]},
  th: { label: '🇹🇭 Thai', phrases: [
    { en: 'Hello', local: 'สวัสดี', phon: 'sa-wat-DEE' },
    { en: 'Goodbye', local: 'ลาก่อน', phon: 'lah-GORN' },
    { en: 'Please', local: 'กรุณา', phon: 'ga-roo-NAH' },
    { en: 'Thank you', local: 'ขอบคุณ', phon: 'khop KHUN' },
    { en: 'Yes / No', local: 'ใช่ / ไม่ใช่', phon: 'chai / mai-chai' },
    { en: 'Excuse me', local: 'ขอโทษ', phon: 'khor-TOHT' },
    { en: 'I don\'t understand', local: 'ไม่เข้าใจ', phon: 'mai khao-JAI' },
    { en: 'Do you speak English?', local: 'คุณพูดภาษาอังกฤษได้ไหม?', phon: 'khun POOT pah-SAH ang-GRIT dai mai' },
    { en: 'Where is…?', local: '…อยู่ที่ไหน?', phon: '...yoo tee NAI' },
    { en: 'Where is the bathroom?', local: 'ห้องน้ำอยู่ที่ไหน?', phon: 'hong-NAHM yoo tee NAI' },
    { en: 'Where is the airport?', local: 'สนามบินอยู่ที่ไหน?', phon: 'sa-NAHM bin yoo tee NAI' },
    { en: 'How much does this cost?', local: 'ราคาเท่าไหร่?', phon: 'ra-KAH tao-RAI' },
    { en: 'I need a taxi', local: 'ต้องการแท็กซี่', phon: 'dtong-GAHN TAEK-see' },
    { en: 'I need a doctor', local: 'ต้องการหมอ', phon: 'dtong-GAHN mor' },
    { en: 'Help!', local: 'ช่วยด้วย!', phon: 'chuay DUAY' },
    { en: 'Water', local: 'น้ำ', phon: 'nahm' },
    { en: 'The check, please', local: 'เช็คบิล', phon: 'chek BIN' },
    { en: 'Left / Right / Straight', local: 'ซ้าย / ขวา / ตรงไป', phon: 'SAI / KWAH / dtrong-BPai' },
    { en: 'I\'m lost', local: 'ฉันหลงทาง', phon: 'chan LONG tahng' },
    { en: 'Can you help me?', local: 'ช่วยได้ไหม?', phon: 'chuay DAI mai' },
    { en: 'Do you accept Bitcoin?', local: 'รับ Bitcoin ไหม?', phon: 'rap Bitcoin mai' },
  ]},
};

// Only verified Kipita affiliate partners. Do NOT add Skyscanner, Booking.com, Airbnb, RentalCars, Uber, Lyft, Airalo, NordVPN, etc.
export const TRANSPORT_LINKS = [
  { emoji: '✈️', label: 'Flights', url: 'https://expedia.com/affiliate/eA2cKky' },
  { emoji: '🏨', label: 'Hotels', url: 'https://www.hotels.com/affiliate/RrZ7bmg' },
  { emoji: '🚢', label: 'Cruise', url: 'https://www.expedia.com/?siteid=1&langid=1033&clickref=1110l34GXzfF&affcid=US.DIRECT.PHG.1100l360011.1100l68075&ref_id=1110l34GXzfF&my_ad=AFF.US.DIRECT.PHG.1100l360011.1100l68075&afflid=1110l34GXzfF&affdtl=PHG.1110l34GXzfF.PZ2TDkyK4w' },
];

export const BOOKING_TILES = [
  { emoji: '✈️', label: 'Flights', desc: 'Bundle deals on flights worldwide', url: 'https://expedia.com/affiliate/eA2cKky', provider: 'Expedia' },
  { emoji: '🏨', label: 'Hotels', desc: 'Earn a free night for every 10 stays', url: 'https://www.hotels.com/affiliate/RrZ7bmg', provider: 'Hotels.com' },
  { emoji: '🚢', label: 'Cruises', desc: 'Deals on cruises worldwide', url: 'https://www.expedia.com/?siteid=1&langid=1033&clickref=1110l34GXzfF&affcid=US.DIRECT.PHG.1100l360011.1100l68075&ref_id=1110l34GXzfF&my_ad=AFF.US.DIRECT.PHG.1100l360011.1100l68075&afflid=1110l34GXzfF&affdtl=PHG.1110l34GXzfF.PZ2TDkyK4w', provider: 'Expedia Cruises' },
];

export const PERKS = [
  // Travel partners
  { icon: '🏨', title: 'Hotels.com', url: 'https://www.hotels.com/affiliate/RrZ7bmg', category: 'travel' },
  { icon: '✈️', title: 'Expedia', url: 'https://expedia.com/affiliate/eA2cKky', category: 'travel' },
  { icon: '🚢', title: 'Expedia Cruises', url: 'https://www.expedia.com/?siteid=1&langid=1033&clickref=1110l34GXzfF&affcid=US.DIRECT.PHG.1100l360011.1100l68075&ref_id=1110l34GXzfF&my_ad=AFF.US.DIRECT.PHG.1100l360011.1100l68075&afflid=1110l34GXzfF&affdtl=PHG.1110l34GXzfF.PZ2TDkyK4w', category: 'travel' },
  { icon: '🦢', title: 'Swan Bitcoin', url: 'https://www.swanbitcoin.com/kipita/', category: 'btc' },
  { icon: '💳', title: 'Fold Card', url: 'https://use.foldapp.com/r/MAJL4MYU', category: 'btc' },
  { icon: '🥇', title: 'Kinesis', url: 'https://kms.kinesis.money/signup/KM00083150', category: 'btc' },
  { icon: '⛽', title: 'Upside', url: 'https://upside.com/', category: 'tools' },
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
  plan: (dest: string) => `✈️ **Trip Plan: ${dest || 'Your Dream Destination'}**\n\n**Day 1: Arrival & Orientation**\n• Check into your accommodation\n• Explore the local neighborhood on foot\n• Try street food or a local restaurant\n• Currency exchange and SIM card setup\n\n**Day 2: Culture & History**\n• Morning: Visit main historical landmarks\n• Afternoon: Local markets or museum\n• Evening: Sunset viewpoint + dinner\n\n**Day 3: Off the Beaten Path**\n• Day trip to nearby nature or town\n• Connect with local nomads at a co-working space\n• Try Bitcoin payments at local merchants (BTCMap)\n\n**Day 4: Food & Community**\n• Cooking class or food tour\n• Social events / meetups\n• Evening: Night market or bar crawl\n\n**Day 5: Departure**\n• Final shopping and souvenirs\n• Airport transfer via Uber/Lyft\n\n📦 **Book Your Trip:**\n• ✈️ Flights → [Expedia](https://expedia.com/affiliate/eA2cKky)\n• 🏨 Hotels → [Hotels.com](https://www.hotels.com/affiliate/RrZ7bmg)\n• 🚢 Cruises → [Expedia Cruises](https://www.expedia.com/?siteid=1&langid=1033&clickref=1110l34GXzfF&affcid=US.DIRECT.PHG.1100l360011.1100l68075&ref_id=1110l34GXzfF&my_ad=AFF.US.DIRECT.PHG.1100l360011.1100l68075&afflid=1110l34GXzfF&affdtl=PHG.1110l34GXzfF.PZ2TDkyK4w)\n\n₿ **BTC & Finance:**\n• 🦢 Stack sats → [Swan Bitcoin](https://www.swanbitcoin.com/kipita/) — $10 free BTC on signup\n• 💳 BTC rewards → [Fold Card](https://use.foldapp.com/r/MAJL4MYU) — earn Bitcoin on every purchase\n• 🥇 Gold & silver → [Kinesis](https://kms.kinesis.money/signup/KM00083150) — trade precious metals\n• ⛽ Cash back → [Upside](https://upside.com/) — save on gas, food & groceries`,

  safety: (loc: string) => `🛡️ **Safety Overview — ${loc}**\n\n**General Safety Tips:**\n• Keep digital copies of all documents\n• Use a VPN on public WiFi\n• Register with your embassy\n• Share your itinerary with someone at home\n• Keep emergency numbers saved offline\n\n**Emergency Resources:**\n• 🚨 Tap the Emergency 🚨 button in the header for numbers\n• 🏥 Find nearest hospital in the **Places** tab\n• 📱 Offline maps available for download\n\n*Always check your government's travel advisory before traveling.*`,

  advisories: () => `📋 **Current Travel Advisories (2026)**\n\n🟢 **Low Risk:** Japan, Singapore, Portugal, UAE, Iceland\n🟡 **Exercise Caution:** Thailand, Mexico, Colombia, India\n🟠 **Elevated Caution:** South Africa, Kenya, Turkey\n🔴 **Reconsider Travel:** Myanmar, Sudan, Haiti\n\n⚠️ *These are general advisories. Always check your government's official portal for the most current information.*`,

  phrases: () => `🌐 **Essential Travel Phrases**\n\nOpen the **Places → Phrases** section for 10 languages with 20+ survival phrases each!\n\nCovers: Spanish, Mandarin, French, Arabic, Hindi, Portuguese, Japanese, German, Korean & Thai.\n\nQuick essentials:\n• Hello / Goodbye / Please / Thank you\n• Where is the bathroom? / airport?\n• I need a taxi / doctor\n• Left / Right / Straight\n• I\'m lost / Can you help me?\n\n*Tip: Screenshot phrases for offline access!*`,

  perks: () => `🎁 **Kipita Perks & Deals**\n\n**✈️ Travel:**\n• [Expedia](https://expedia.com/affiliate/eA2cKky) — Bundle & save on flights + hotels\n• [Hotels.com](https://www.hotels.com/affiliate/RrZ7bmg) — Earn a free night for every 10 stays\n• [Expedia Cruises](https://www.expedia.com/?siteid=1&langid=1033&clickref=1110l34GXzfF&affcid=US.DIRECT.PHG.1100l360011.1100l68075&ref_id=1110l34GXzfF&my_ad=AFF.US.DIRECT.PHG.1100l360011.1100l68075&afflid=1110l34GXzfF&affdtl=PHG.1110l34GXzfF.PZ2TDkyK4w) — Cruise deals worldwide\n\n**₿ Bitcoin & Finance:**\n• [Swan Bitcoin](https://www.swanbitcoin.com/kipita/) — $10 free BTC on signup\n• [Fold Card](https://use.foldapp.com/r/MAJL4MYU) — Earn BTC rewards on every purchase\n• [Kinesis](https://kms.kinesis.money/signup/KM00083150) — Gold & silver-backed digital currency\n• [Upside](https://upside.com/) — Cash back on gas, food & groceries`,

  default: (topic: string) => `Great question about "${topic}"! As your AI travel companion, I can help with:\n\n✈️ **Trip Planning** — Custom itineraries with booking links\n🛡️ **Safety Info** — Real-time advisories & emergency contacts\n₿ **Bitcoin** — Find BTC-friendly spots + Swan, Fold, Kinesis deals\n🌐 **Phrases** — 20+ survival phrases in 10 languages\n🗺️ **Destinations** — Nomad scores, costs, weather\n💱 **Currency** — Live exchange rates & converter\n🎁 **Perks** — Exclusive deals for flights, hotels & crypto\n🎒 **Packing** — Smart packing lists\n\nTry asking me to "Plan a trip to Tokyo" or "Show me perks and deals" 🌍`,
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

/* ── Recreation Highlights (curated per destination city) ── */
export interface RecreationHighlight {
  name: string;
  category: 'hiking' | 'water' | 'adventure' | 'cycling' | 'wildlife' | 'camping' | 'winter' | 'cultural';
  emoji: string;
  difficulty?: string;
  duration?: string;
  cost?: string;
  description: string;
  tip?: string;
  source?: string;
  bookingUrl?: string;
}

export const RECREATION_HIGHLIGHTS: Record<string, RecreationHighlight[]> = {
  'Tokyo': [
    { name: 'Mount Takao (Takaosan)', category: 'hiking', emoji: '🏔️', difficulty: 'Easy', duration: '3–4 hrs', cost: 'Free (cable car $6)', description: 'World\'s most-climbed mountain with 8 trails, temples, and sweeping views of Fuji on clear days. 45 min by train from Shinjuku.', tip: 'Trail 1 has a paved surface — ideal for beginners. Take the summit cable car down.', source: 'OpenStreetMap', bookingUrl: 'https://www.takaotozan.co.jp/english/' },
    { name: 'Nikko National Park', category: 'hiking', emoji: '🌲', difficulty: 'Moderate', duration: 'Full day', cost: '$10–15 shrines', description: 'UNESCO-listed mountain park 2 hrs from Tokyo featuring waterfalls, shrines, and alpine hiking.', tip: 'Kegon Falls and Senjogahara Marshland are unmissable stops.', source: 'NPS-equivalent (Japan)' },
    { name: 'Tama River Cycling Path', category: 'cycling', emoji: '🚴', difficulty: 'Easy', duration: '2–4 hrs', cost: 'Bike rental ~$8', description: '130 km dedicated cycling path along the Tama River through western Tokyo — flat, scenic, and car-free.', tip: 'Start near Futako-Tamagawa station and ride toward the mountains.', source: 'OpenStreetMap' },
    { name: 'Odaiba Beach Park', category: 'water', emoji: '🏖️', difficulty: 'Easy', duration: '2–3 hrs', cost: 'Free', description: 'Artificial waterfront park with views of Rainbow Bridge. Kayak rentals available seasonally.', source: 'OpenStreetMap' },
    { name: 'Fujikawaguchiko Fishing', category: 'water', emoji: '🎣', difficulty: 'Easy', duration: 'Half day', cost: '$15–25', description: 'Freshwater fishing for rainbow trout and carp in the Fuji Five Lakes region with Mount Fuji as backdrop.', source: 'Featured' },
  ],
  'Bangkok': [
    { name: 'Khao Yai National Park', category: 'hiking', emoji: '🌿', difficulty: 'Moderate', duration: 'Full day', cost: '$8 entry', description: 'UNESCO World Heritage Site 2.5 hrs from Bangkok — elephants, hornbills, gibbons, and 50+ km of trails through monsoon forest.', tip: 'Haew Narok Waterfall (5-tier, 150m) is the highlight. Book a guide — wildlife tracking is rewarding.', source: 'Thailand National Parks', bookingUrl: 'https://www.thainationalparks.com/khao-yai-national-park' },
    { name: 'Erawan National Park', category: 'water', emoji: '💧', difficulty: 'Easy', duration: 'Full day', cost: '$7 entry', description: 'Emerald-green tiered waterfalls in Kanchanaburi. Swim in natural rock pools among small fish. 3 hrs from Bangkok.', tip: 'Arrive early — pools get crowded by noon. Bring food; vendors close at 4 PM.', source: 'Thailand National Parks' },
    { name: 'Kanchanaburi River Kayaking', category: 'water', emoji: '🛶', difficulty: 'Easy', duration: '3–5 hrs', cost: '$15–25', description: 'Paddle the Kwai River past limestone cliffs, floating rafthouses, and lush jungle scenery.', source: 'Featured' },
    { name: 'Chatuchak Park Cycling', category: 'cycling', emoji: '🚴', difficulty: 'Easy', duration: '1–2 hrs', cost: 'Bike rental $3/hr', description: 'Weekend cycling hub next to one of the world\'s largest markets. Flat paths through gardens and past the canal.', source: 'OpenStreetMap' },
    { name: 'Phang Nga Bay Kayaking', category: 'water', emoji: '⛵', difficulty: 'Easy', duration: 'Full day', cost: '$40–70', description: 'Sea-kayak through cave-pocked limestone karsts and hidden lagoons (hongs) — one of SE Asia\'s iconic tours. Day trip from Bangkok (fly 1hr) or Phuket.', source: 'Featured' },
  ],
  'Bali': [
    { name: 'Mount Batur Sunrise Hike', category: 'hiking', emoji: '🌋', difficulty: 'Moderate', duration: '4–5 hrs', cost: '$30–50 guided', description: 'Active volcano rising 1,717m — hike through lava fields to reach the summit for a spectacular caldera sunrise.', tip: 'Start at 2 AM to reach summit by dawn. Hire a guide — required and well worth it.', source: 'Featured', bookingUrl: 'https://www.klook.com/en-US/activity/1063-mount-batur-sunrise-trek/' },
    { name: 'Canggu Surf Lessons', category: 'water', emoji: '🏄', difficulty: 'Easy', duration: '2 hrs', cost: '$20–30', description: 'Beginner-friendly beach breaks at Echo Beach and Old Man\'s. Batu Bolong Beach suits all levels.', tip: 'Morning sessions (7–9 AM) have smaller, cleaner waves. Avoid wet season chop (Nov–Mar).', source: 'Featured' },
    { name: 'Nusa Penida Snorkeling', category: 'water', emoji: '🤿', difficulty: 'Easy', duration: 'Full day', cost: '$35–55 boat tour', description: 'Swim with giant manta rays at Manta Point and see crystal-clear coral gardens at Gamat Bay. Fast boat from Sanur (45 min).', tip: 'Manta rays are most active 7–10 AM. Bring reef-safe sunscreen.', source: 'Featured' },
    { name: 'Ubud Rice Terrace Cycling', category: 'cycling', emoji: '🚴', difficulty: 'Easy', duration: '3–4 hrs', cost: '$20–35 guided', description: 'Downhill bike tour through Tegallalang rice terraces, traditional villages, and coffee plantations.', source: 'Featured' },
    { name: 'Munduk Waterfall Trek', category: 'hiking', emoji: '🌊', difficulty: 'Easy', duration: '3–4 hrs', cost: '$5–10', description: 'Trek through highland forest to 3 stunning waterfalls — Golden Valley, Melanting, and Munduk Falls — near Bedugul.', source: 'Featured' },
  ],
  'Barcelona': [
    { name: 'Montserrat Mountain Hike', category: 'hiking', emoji: '⛰️', difficulty: 'Moderate', duration: 'Full day', cost: 'Train ~$14 return', description: 'Serrated limestone mountain 1 hr from city. Hike to Sant Joan chapel (1,236m) past medieval monastery and panoramic Catalonia views.', tip: 'Take the rack railway (cremallera) to the monastery, then hike above. Early train avoids crowds.', source: 'Featured' },
    { name: 'Fontainebleau-style Rock Climbing (Montserrat)', category: 'adventure', emoji: '🧗', difficulty: 'Moderate', duration: 'Full day', cost: 'Gear rental ~$20', description: 'World-class trad and sport climbing on Montserrat\'s conglomerate pinnacles. 300+ routes for all grades.', source: 'Featured' },
    { name: 'Costa Brava Snorkeling', category: 'water', emoji: '🤿', difficulty: 'Easy', duration: 'Full day', cost: '$10–30', description: 'Crystal Mediterranean waters at Cap de Creus — sea caves, octopuses, posidonia meadows. 2 hrs from Barcelona.', source: 'Featured' },
    { name: 'Collserola Park Trails', category: 'hiking', emoji: '🌲', difficulty: 'Easy', duration: '2–4 hrs', cost: 'Free', description: 'Barcelona\'s 8,000-hectare forested ridge park — 40+ marked trails, mountain biking, picnic areas, and city viewpoints.', tip: 'Take bus V3 or L6 FGC to Peu del Funicular for easy access.', source: 'OpenStreetMap' },
    { name: 'Barceloneta Paddleboarding', category: 'water', emoji: '🏄', difficulty: 'Easy', duration: '2 hrs', cost: '$20–30', description: 'SUP and kayak rentals right on the beach, plus guided coastal paddle tours. Best April–October.', source: 'Featured' },
  ],
  'Paris': [
    { name: 'Fontainebleau Rock Climbing', category: 'adventure', emoji: '🧗', difficulty: 'Moderate', duration: 'Full day', cost: 'Free (park entry)', description: 'World\'s most iconic bouldering destination with 100,000+ problems in Fontainebleau Forest, 45 min from Paris. The birthplace of bouldering.', tip: 'Bas Cuvier and Cuisinière are the classic circuits. Grades marked by colored arrows on boulders.', source: 'Featured' },
    { name: 'Loire Valley Cycling', category: 'cycling', emoji: '🚴', difficulty: 'Easy', duration: '2 days+', cost: 'Train + bike rental ~$30', description: 'World\'s best cycling route along France\'s largest river — châteaux every few km, wine country, and entirely flat paths.', tip: 'La Loire à Vélo is a 900 km marked route. Blois–Amboise section (40 km) is the most scenic day ride.', source: 'Featured', bookingUrl: 'https://www.loireavelo.fr/en/' },
    { name: 'Bois de Vincennes Running & Cycling', category: 'cycling', emoji: '🏃', difficulty: 'Easy', duration: '1–3 hrs', cost: 'Free', description: 'Paris\'s largest park (995 ha) with a 10 km lake circuit, mountain bike trails, archery ranges, and horse riding.', source: 'OpenStreetMap' },
    { name: 'Seine River Kayaking', category: 'water', emoji: '🛶', difficulty: 'Easy', duration: '2–3 hrs', cost: '$30–50', description: 'Paddle past Notre-Dame, the Eiffel Tower, and Île de la Cité on guided Seine kayak tours.', tip: 'Book through Paris Kayak — morning tours have calmer water and better light for photos.', source: 'Featured' },
    { name: 'Vercors Ski Area (Day Trip)', category: 'winter', emoji: '⛷️', difficulty: 'Moderate', duration: 'Full day', cost: '$40–60 pass', description: 'Closest major ski area to Paris (~2.5 hrs). Cross-country skiing, snowshoeing, and moderate downhill runs in the pre-Alps.', source: 'Featured' },
  ],
  'Lisbon': [
    { name: 'Sintra Hiking Trails', category: 'hiking', emoji: '🏰', difficulty: 'Moderate', duration: 'Full day', cost: 'Free trail access', description: 'UNESCO-protected mountain with fairy-tale palaces connected by woodland trails. Cruz Alta peak offers views from Serra da Sintra to the Atlantic.', tip: 'Hike from Sintra train station to Pena Palace (2 km steep), then continue to Moorish Castle. Avoid weekends — very crowded.', source: 'Featured' },
    { name: 'Costa da Caparica Surfing', category: 'water', emoji: '🏄', difficulty: 'Easy', duration: '2–4 hrs', cost: '$35–50 lesson', description: '30 km of Atlantic beach break — Portugal\'s most popular beginner surf spot, 30 min from Lisbon by ferry + bus.', source: 'Featured' },
    { name: 'Arrábida Natural Park Snorkeling', category: 'water', emoji: '🤿', difficulty: 'Easy', duration: 'Full day', cost: '$30–50 boat trip', description: 'Portugal\'s clearest waters in a protected limestone park south of Setúbal. Vibrant marine life, sea caves, and turquoise coves.', source: 'Featured', bookingUrl: 'https://www.arrábida.pt' },
    { name: 'Cascais Coast Cycling', category: 'cycling', emoji: '🚴', difficulty: 'Easy', duration: '3–4 hrs', cost: 'Bike rental $12/day', description: '30 km coastal cycleway from Lisbon to Cascais following the Tagus estuary and Atlantic coastline — flat and spectacular.', source: 'Featured' },
    { name: 'Gerês National Park (Day Trip)', category: 'hiking', emoji: '🌿', difficulty: 'Moderate', duration: 'Full day', cost: 'Free', description: 'Portugal\'s only national park with granite peaks, glacial valleys, wolves, and wild horses. 3.5 hrs north of Lisbon.', source: 'Featured' },
  ],
  'Medellín': [
    { name: 'El Peñón de Guatapé', category: 'hiking', emoji: '🪨', difficulty: 'Moderate', duration: 'Full day', cost: '$6 climb + transport', description: '740 steps carved into a 200m granite monolith — summit gives 360° views over Colombia\'s reservoir lake district. 2 hrs from Medellín.', tip: 'Start early to beat heat. Combine with a catamaran tour on Guatapé Lake.', source: 'Featured' },
    { name: 'Paragliding in San Félix', category: 'adventure', emoji: '🪂', difficulty: 'Easy (tandem)', duration: '30–45 min flight', cost: '$40–60', description: 'Tandem paragliding above the Andes with views of Medellín\'s "City of Eternal Spring" valley. Colombia\'s most popular paragliding site.', source: 'Featured' },
    { name: 'Arví Park Eco-Trails', category: 'hiking', emoji: '🌿', difficulty: 'Easy', duration: '2–4 hrs', cost: '$2 cable car', description: '16,000-hectare cloud forest park accessed by metro + cable car from the city. 44 km of marked trails, butterflies, orchids, and local food markets.', tip: 'Take Line L cable car from Acevedo — the cable ride itself is a highlight.', source: 'Featured' },
    { name: 'Río Claro Canyon Kayaking', category: 'water', emoji: '🛶', difficulty: 'Moderate', duration: '2 days', cost: '$80–120 tour', description: 'White-water kayaking and rafting through a marble canyon in tropical forest, 3 hrs east of Medellín. Ziplining and caving also available.', source: 'Featured' },
    { name: 'Guatapé Lake Paddle', category: 'water', emoji: '⛵', difficulty: 'Easy', duration: '2–3 hrs', cost: '$20–40', description: 'Kayak or SUP through the flooded lake district\'s colorful island villages. Combine with El Peñón for a full day trip.', source: 'Featured' },
  ],
  'Chiang Mai': [
    { name: 'Doi Inthanon National Park', category: 'hiking', emoji: '🌿', difficulty: 'Easy–Moderate', duration: 'Full day', cost: '$9 entry', description: 'Roof of Thailand (2,565m) with cloud forest, royal twin chedis, 400+ bird species, and Siriphum Waterfall. 2 hrs from city.', tip: 'Kew Mae Pan Nature Trail (3 km loop) is the scenic highland walk. Visit November–February for best weather and rarest birds.', source: 'Thailand National Parks', bookingUrl: 'https://www.dnp.go.th/' },
    { name: 'Crazy Horse Buttress Rock Climbing', category: 'adventure', emoji: '🧗', difficulty: 'Moderate', duration: 'Full day', cost: '$20–30 guided', description: 'Stunning limestone sport climbing 45 min from Chiang Mai — 150+ routes on towering karst towers in jungle setting.', source: 'Featured' },
    { name: 'Mae Taeng River Rafting', category: 'water', emoji: '🌊', difficulty: 'Moderate', duration: 'Half day', cost: '$25–40', description: 'White-water rafting Grade 3–4 rapids through forested gorges in the Mae Taeng valley, 45 min from the city.', source: 'Featured' },
    { name: 'Doi Suthep Cycling Tour', category: 'cycling', emoji: '🚴', difficulty: 'Hard', duration: '4–5 hrs', cost: 'Bike rental $8', description: 'Classic climb from city center to Doi Suthep temple (1,050m) — 15 km of switchbacks through forest. Thrilling descent.', tip: 'Rent from Chiang Mai Mountain Biking shop. Start before 7 AM to beat traffic and heat.', source: 'OpenStreetMap' },
    { name: 'Flight of the Gibbon Zip-line', category: 'adventure', emoji: '🌿', difficulty: 'Easy', duration: '3 hrs', cost: '$90–120', description: 'Award-winning zip-line through Mae Kampong\'s old-growth forest canopy — 33 lines, sky bridges, and rappels. Ethical wildlife sanctuary included.', source: 'Featured', bookingUrl: 'https://www.treetopasia.com/' },
  ],
  'Dubai': [
    { name: 'Hatta Mountain Hiking', category: 'hiking', emoji: '🏔️', difficulty: 'Moderate', duration: 'Full day', cost: 'Free', description: 'Rocky Hajar Mountain trails 1.5 hrs from Dubai with wadis, heritage villages, and a mountain lake. Hatta Dam trail is most scenic.', tip: 'Visit October–March only — summer heat is dangerous. Hatta Road Biking Trail (11 km loop) is excellent for cycling.', source: 'Featured' },
    { name: 'Dubai Desert Dune Sports', category: 'adventure', emoji: '🏜️', difficulty: 'Easy', duration: 'Half day', cost: '$40–80 tour', description: 'Sandboarding, quad biking, and camel trekking on the red dunes of Dubai Desert Conservation Reserve. Evening tours include stargazing.', source: 'Featured' },
    { name: 'Jebel Ali Mangrove Kayaking', category: 'water', emoji: '🛶', difficulty: 'Easy', duration: '2 hrs', cost: '$30–45', description: 'Paddle through the Jebel Ali mangrove forest — a rare marine ecosystem teeming with herons, flamingos, and rays. Best at sunrise.', source: 'Featured' },
    { name: 'Palm Beach Paddleboarding', category: 'water', emoji: '🏄', difficulty: 'Easy', duration: '2 hrs', cost: '$25–40', description: 'SUP along the Palm Jumeirah shoreline with views of the Atlantis hotel and Dubai Marina skyline.', source: 'Featured' },
    { name: 'Wadi Wurayah Waterfall Trek', category: 'hiking', emoji: '💧', difficulty: 'Moderate', duration: 'Full day', cost: 'Free', description: 'UAE\'s only perennial waterfall in a federally protected wadi (Fujairah emirate). Wild swimming pools, leopard habitat, and dramatic canyon walls.', tip: 'Only accessible Oct–May. 4WD vehicle required for the rough track. Bring ample water.', source: 'Featured' },
  ],
};

/* ── Outdoor Activity Type Guide ── */
export interface ActivityTypeGuide {
  id: string;
  name: string;
  emoji: string;
  description: string;
  difficulty: string;
  bestSeason: string;
  gear: string[];
  globalBest: string[];
  bookingTip: string;
  sourceUrl?: string;
}

export const OUTDOOR_ACTIVITY_GUIDE: ActivityTypeGuide[] = [
  {
    id: 'camping',
    name: 'Camping',
    emoji: '⛺',
    description: 'Sleep under the stars in national forests, lakeside campgrounds, or backcountry wilderness.',
    difficulty: 'Easy–Hard depending on site type',
    bestSeason: 'Spring–Fall (US), Year-round (tropics)',
    gear: ['Tent', 'Sleeping bag', 'Headlamp', 'Bear canister (backcountry)', 'Camp stove'],
    globalBest: ['Yosemite, USA', 'Fiordland, New Zealand', 'Scottish Highlands', 'Patagonia, Argentina'],
    bookingTip: 'Book US sites 6 months ahead on Recreation.gov. International sites often walk-in only.',
    sourceUrl: 'https://www.recreation.gov/camping',
  },
  {
    id: 'hiking',
    name: 'Hiking & Trekking',
    emoji: '🥾',
    description: 'From easy forest walks to multi-day mountain traverses — hiking is the most universal outdoor activity.',
    difficulty: 'Easy day walks to Expert multi-week expeditions',
    bestSeason: 'Year-round (altitude/region dependent)',
    gear: ['Trail shoes/boots', 'Trekking poles', 'Rain jacket', 'Navigation app', '2L+ water'],
    globalBest: ['Torres del Paine, Chile', 'Everest Base Camp, Nepal', 'Milford Track, NZ', 'Camino de Santiago, Spain', 'Pacific Crest Trail, USA'],
    bookingTip: 'Many iconic treks (Inca Trail, Everest) require permits booked months ahead. Check NPS.gov for US permits.',
    sourceUrl: 'https://www.nps.gov/subjects/hiking/index.htm',
  },
  {
    id: 'water',
    name: 'Water Sports',
    emoji: '🌊',
    description: 'Ocean surfing, river kayaking, lake paddleboarding, snorkeling coral reefs — water opens up a world of adventure.',
    difficulty: 'Easy (snorkeling) to Expert (big wave surfing)',
    bestSeason: 'Varies by sport and location',
    gear: ['Wetsuit (cold water)', 'Reef-safe sunscreen', 'Waterproof bag', 'Life jacket (whitewater)'],
    globalBest: ['Pipeline, Hawaii (surfing)', 'Great Barrier Reef (snorkeling)', 'Colorado River (rafting)', 'Komodo, Indonesia (diving)', 'Amazon tributaries (kayaking)'],
    bookingTip: 'US river permits via Recreation.gov. International dive centers on PADI website.',
    sourceUrl: 'https://www.recreation.gov/activities/2607',
  },
  {
    id: 'cycling',
    name: 'Cycling & Mountain Biking',
    emoji: '🚴',
    description: 'Road touring through vineyards, mountain bike singletrack, or gravel adventures off the beaten path.',
    difficulty: 'Easy (flat rail trails) to Expert (technical DH singletrack)',
    bestSeason: 'Spring–Fall (temperate), dry season (tropics)',
    gear: ['Helmet', 'Gloves', 'Padded shorts', 'Repair kit', 'GPS/navigation'],
    globalBest: ['Loire Valley, France', 'Moab Utah, USA', 'Queenstown, NZ', 'Mallorca, Spain', 'Kyoto–Osaka, Japan'],
    bookingTip: 'EuroVelo (eurovelo.com) maps 17 long-distance European routes. US trails on TrailForks.com.',
  },
  {
    id: 'adventure',
    name: 'Adventure Sports',
    emoji: '🧗',
    description: 'Rock climbing, paragliding, zip-lining, canyoneering — push your limits in the vertical world.',
    difficulty: 'Easy tandem flights to Expert alpine routes',
    bestSeason: 'Varies — check local conditions',
    gear: ['Harness + helmet (climbing)', 'Tandem guide required (paragliding)', 'Canyoneering wetsuit'],
    globalBest: ['Kalymnos, Greece (climbing)', 'Interlaken, Switzerland (paragliding)', 'Chamonix, France (mountaineering)', 'Queenstown, NZ (multi-sport)', 'Moab, USA (canyoneering)'],
    bookingTip: 'Always use certified instructors. Mountain guides: IFMGA certified. Paragliding: USHPA (US) / BHPA (UK) qualified schools.',
  },
  {
    id: 'wildlife',
    name: 'Wildlife Watching',
    emoji: '🦅',
    description: 'Birdwatching, safari game drives, whale watching, and wildlife sanctuaries — observe Earth\'s magnificent creatures.',
    difficulty: 'Easy',
    bestSeason: 'Migration periods (spring/fall for birds), dry season (African safari)',
    gear: ['Binoculars 8×42', 'Field guide app (Merlin)', 'Long lens camera', 'Neutral clothing'],
    globalBest: ['Serengeti, Tanzania (safari)', 'Galápagos (endemic species)', 'Costa Rica (biodiversity)', 'Khao Yai, Thailand (elephants)', 'Alaska (bears/whales)'],
    bookingTip: 'African safaris: book 12+ months ahead for peak season. US wildlife refuges: recreation.gov and fws.gov.',
    sourceUrl: 'https://www.fws.gov/recreation',
  },
  {
    id: 'winter',
    name: 'Winter Sports',
    emoji: '⛷️',
    description: 'Skiing, snowboarding, cross-country, snowshoeing, ice climbing — winter transforms landscapes into playgrounds.',
    difficulty: 'Easy (beginner ski area) to Expert (backcountry touring)',
    bestSeason: 'December–March (N. Hemisphere), June–September (S. Hemisphere)',
    gear: ['Helmet (mandatory most resorts)', 'Avalanche beacon (backcountry)', 'Goggles', 'Layering system'],
    globalBest: ['Whistler, Canada', 'Zermatt, Switzerland', 'Niseko, Japan', 'Portillo, Chile', 'Aspen, USA'],
    bookingTip: 'US ski resorts on iSki or Liftopia. Backcountry safety: take an avalanche course before venturing off-piste.',
  },
  {
    id: 'fitness',
    name: 'Outdoor Fitness',
    emoji: '💪',
    description: 'Trail running, outdoor yoga, calisthenics parks, open-water swimming — fitness without four walls.',
    difficulty: 'All levels',
    bestSeason: 'Year-round',
    gear: ['Trail running shoes', 'GPS watch', 'Hydration vest (long runs)'],
    globalBest: ['Ultra-Trail du Mont-Blanc (UTMB)', 'Comrades Marathon, South Africa', 'Spartan Race series', 'Outdoor gyms in Singapore\'s parks', 'Tel Aviv beachfront fitness parks'],
    bookingTip: 'Free outdoor workout spots globally via Workout.World (app). Yoga retreats on YogaTrail.com.',
  },
];

/* ── Recreation.gov & NPS external search links ── */
export const RECREATION_EXTERNAL_LINKS = {
  recreationGov: {
    search: 'https://www.recreation.gov/search',
    camping: 'https://www.recreation.gov/camping',
    permits: 'https://www.recreation.gov/permits',
    tours: 'https://www.recreation.gov/tours',
    dayUse: 'https://www.recreation.gov/day-use',
  },
  nps: {
    findApark: 'https://www.nps.gov/findapark/',
    trails: 'https://www.nps.gov/subjects/hiking/index.htm',
    camping: 'https://www.nps.gov/subjects/camping/campgrounds.htm',
    events: 'https://www.nps.gov/subjects/events/index.htm',
  },
  parksCanada: {
    home: 'https://parks.canada.ca/en',
    reservations: 'https://reservation.pc.gc.ca/',
    findApark: 'https://parks.canada.ca/pn-np',
  },
  international: {
    alltrails: 'https://www.alltrails.com/',
    komoot: 'https://www.komoot.com/',
    outdooractive: 'https://www.outdooractive.com/',
    wikiloc: 'https://www.wikiloc.com/',
  },
};
