export interface Destination {
  id: string;
  city: string;
  country: string;
  emoji: string;
  lat: number;
  lng: number;
  rating: number;
  pop: string;
  speed: number;
  safetyScore: number;
  monthlyCost: number;
  weatherDesc: string;
  temp: number;
  tags: string[];
  popular: boolean;
  desc: string;
}

export interface Trip {
  id: string;
  dest: string;
  country: string;
  emoji: string;
  start: string;
  end: string;
  notes: string;
  status: 'upcoming' | 'active' | 'completed';
  items: ItineraryItem[];
}

export interface ItineraryItem {
  id: string;
  day: number;
  time: string;
  title: string;
  done: boolean;
}

export interface PlaceCategory {
  id: string;
  label: string;
  emoji: string;
  query: string;
}

export interface SubCategory {
  label: string;
  query: string;
  emoji: string;
}

export interface CryptoPrice {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  icon: string;
}

export interface BTCMerchant {
  lat: number;
  lng: number;
  name: string;
  type: string;
  source: 'btcmap' | 'cashapp';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
  timestamp: number;
}

export interface Group {
  id: string;
  name: string;
  emoji: string;
  members: number;
  lastMessage: string;
  unread: number;
  messages: GroupMessage[];
}

export interface GroupMessage {
  id: string;
  sender: string;
  text: string;
  mine: boolean;
  time: string;
}

export type TabId = 'home' | 'ai' | 'trips' | 'places' | 'maps' | 'wallet' | 'groups';
