import { useEffect, useState, useCallback } from 'react';

export interface FavoritePlace {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating: number | null;
  photoUrl: string | null;
  mapsUrl: string | null;
  website: string | null;
  phone: string | null;
  typeLabel: string | null;
  savedAt: number;
}

const STORAGE_KEY = 'kip_favorites_v1';
const EVENT = 'kip:favorites-changed';

function read(): FavoritePlace[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(list: FavoritePlace[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* ignore quota errors */
  }
}

export function getFavorites(): FavoritePlace[] {
  return read();
}

export function isFavorite(placeId: string): boolean {
  if (!placeId) return false;
  return read().some(f => f.placeId === placeId);
}

export function toggleFavorite(place: Omit<FavoritePlace, 'savedAt'>): boolean {
  if (!place.placeId) return false;
  const list = read();
  const idx = list.findIndex(f => f.placeId === place.placeId);
  if (idx >= 0) {
    list.splice(idx, 1);
    write(list);
    return false;
  }
  list.unshift({ ...place, savedAt: Date.now() });
  write(list);
  return true;
}

export function removeFavorite(placeId: string) {
  write(read().filter(f => f.placeId !== placeId));
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoritePlace[]>(() => read());
  useEffect(() => {
    const sync = () => setFavorites(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  const has = useCallback((id: string) => favorites.some(f => f.placeId === id), [favorites]);
  return { favorites, isFavorite: has, toggleFavorite, removeFavorite };
}
