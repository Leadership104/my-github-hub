# New User Flow

## Goal
- Minimum steps in Places.
- Wallet removed from bottom tab and moved to Profile dashboard.
- Advisory restored as a primary tab with tabbed info flow.
- Destination group hidden by default and controlled by a Settings toggle.

## Updated Navigation Hierarchy
```text
Bottom Tabs
1. Places (default open on app load)
2. AI
3. Trips
4. Advisory
5. Social

Profile Menu
- View / Edit Profile
- Wallet (opens Wallet screen)
- Settings
- Sign Out
```

## Places: 1–3 Click Retrieval Flow
```text
Entry State: App opens directly on Places

1 Click:
- Tap a visible category chip -> opens result screen.

2 Clicks:
- Tap category chip -> tap a place card in results.

3 Clicks:
- Enter search text -> tap search/category -> tap place card.
```

## Removed / Changed UX
- Removed Wallet tab from bottom nav.
- Added Advisory tab in bottom nav.
- City/County/State filtering flow removed from map interactions for now.
- Kept a visible Filter icon on map as a placeholder for future scoped filters.
- Destinations in Places are disabled by default.
- Added Settings toggle: `Enable Destinations Tab`.

## Advisory Flow (Old Kipita style)
```text
Advisory Tab
-> Tab Row:
   - Advisory
   - Safety
   - Health
-> Tap tab
-> Read notices list for selected tab
```

## API / Key References (Old Kipita aligned)
- Primary old backend: `https://api.dwaat.com/`
- Dwaat endpoints in app:
  - `login.php`, `register.php`, `socialLogin.php`, `validateProfile.php`
  - `advisorySections.php`, `restrictions.php`, `placesSections.php`
  - `affiliates.php`, `imageList.php`, `imageSearch.php`
- Google Places (New) API:
  - `https://places.googleapis.com/v1/places:searchNearby`
  - `https://places.googleapis.com/v1/places:searchText`
- BTC map source:
  - `https://api.btcmap.org/`

## Local Runtime Key Wiring
- `local.properties` is used for key injection:
  - `GOOGLE_PLACES_API_KEY`
  - `MAPS_API_KEY` (falls back to `GOOGLE_PLACES_API_KEY` if absent)
- BuildConfig field:
  - `BuildConfig.GOOGLE_PLACES_API_KEY`

## Implementation Files Updated
- `app/src/main/java/com/kipita/presentation/main/KipitaApp.kt`
- `app/src/main/java/com/kipita/presentation/advisory/AdvisoryScreen.kt`
- `app/src/main/java/com/kipita/presentation/advisory/AdvisoryViewModel.kt`
- `app/src/main/java/com/kipita/presentation/settings/SettingsScreen.kt`
- `app/src/main/java/com/kipita/presentation/settings/SettingsViewModel.kt`
- `app/src/main/java/com/kipita/presentation/places/PlacesScreen.kt`
- `app/src/main/java/com/kipita/presentation/places/PlacesViewModel.kt`
- `app/src/main/java/com/kipita/presentation/map/MapScreen.kt`
- `app/src/main/java/com/kipita/data/repository/UiPreferencesRepository.kt`
