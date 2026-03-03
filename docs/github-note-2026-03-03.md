# Kipita Restore Note (2026-03-03)

## Scope
- Restored core UI/UX and feature behavior to the earlier clean build style (`b186ed7`) for key screens where functionality had drifted.

## Restored Screens
- `app/src/main/java/com/kipita/presentation/map/MapScreen.kt`
- `app/src/main/java/com/kipita/presentation/map/MapViewModel.kt`
- `app/src/main/java/com/kipita/presentation/main/KipitaApp.kt`
- `app/src/main/java/com/kipita/presentation/explore/ExploreScreen.kt`
- `app/src/main/java/com/kipita/presentation/home/HomeScreen.kt`
- `app/src/main/java/com/kipita/presentation/trips/MyTripsScreen.kt`
- `app/src/main/java/com/kipita/presentation/trips/TripDetailScreen.kt`
- `app/src/main/java/com/kipita/presentation/settings/SettingsScreen.kt`
- `app/src/main/java/com/kipita/presentation/auth/AuthScreen.kt`

## Feature Areas Recovered
- Map screen returned to prior clean Google Map layout with:
  - Search bar geocoding and camera recenter behavior
  - BTC overlay toggle and BTC source filters
  - Nearby category filtering (BTC/Food/Cafe/Shops)
  - Offline cache action and travel notice cards
- Trips flow preserved:
  - Upcoming/Past/Cancelled views
  - Plan trip bottom sheet, transport links, quick tools
  - Trip details with notes, invite, cancel, and mark-complete flows
- Home/Explore/Settings/Auth screens restored to prior UI behavior and button routes used in earlier builds.

## Compatibility Fixes Applied
- Aligned restored navigation with current AI screen signature in `KipitaApp.kt`.
- Added required Material3 opt-ins for restored composables using experimental APIs.

## Validation
- `gradlew.bat -g .gradle-local :app:compileDevDebugKotlin` passed.
- Emulator launch/install run attempted after restore (see commit terminal logs for final run status).
