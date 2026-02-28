# Kipita Application Synopsis (Full Codebase Walkthrough)

Date: 2026-02-28  
Scope: Android app + companion web app + core data/service layers currently present in this repository.

## 1. Product-Level Overview

Kipita is a travel-focused super-app that combines:
1. Trip planning and trip lifecycle management.
2. AI assistance (chat + itinerary generation + contextual prompts).
3. Local discovery (Google Places + map overlays + Bitcoin merchants).
4. Travel safety workflows (advisories + SOS actions).
5. Financial tooling (crypto wallet aggregation + live crypto prices + FX conversion).
6. Social/community features (groups, nearby travelers, direct messaging).
7. Translation and language support.
8. In-app browsing to keep external links inside the app shell.
9. Background sync/reconciliation workers.
10. Companion web PWA for browser-based access to core discovery/itinerary features.

Primary Android navigation shell is in `KipitaApp` with routes:
1. `Home`
2. `Explore`
3. `AI`
4. `Trips`
5. `Wallet`
6. `Social`
7. `Settings` (via profile menu, not bottom-tab)

## 2. Global Navigation and App Shell

### What this section does
Main orchestration in `app/src/main/java/com/kipita/presentation/main/KipitaApp.kt`:
1. Hosts top bar + profile menu + bottom tabs.
2. Controls modal/fullscreen transitions:
   1. Auth
   2. Profile setup
   3. Map
   4. Translate
   5. In-app browser
   6. Nearby travelers
   7. Travel groups
   8. Trip detail
   9. Places category results
3. Handles guest vs signed-in gating for group access.
4. Syncs avatar and profile identity from `AuthViewModel`.

### How to use
1. Launch app.
2. Use bottom tabs for primary features.
3. Tap top-right avatar for:
   1. Sign in/create profile
   2. Continue as guest
   3. Edit profile
   4. Settings
   5. Sign out
4. Use top-left back button to exit modal screens.

### Feature note
`Social -> Join travel groups` is guarded for guests; it prompts auth/profile first.

## 3. Home Section

### What it includes
Defined in `app/src/main/java/com/kipita/presentation/home/HomeScreen.kt`:
1. Hero greeting/search bar.
2. Voice input entry to AI prompt flow.
3. Quick tools:
   1. Currency
   2. Maps
   3. Translate
   4. Packing List
   5. Weather
4. Transport booking tiles (Flights, Hotels, Car Rental, Cruise, Uber, Lyft) opening in in-app browser.
5. AI quick prompts for planning/safety/BTC suggestions.
6. Visa and travel-prep informational content.
7. SOS emergency system:
   1. Collects invite emails from upcoming trips.
   2. Alert-all email action.
   3. In-app “nearest hospital” and “nearest fire station” map searches.
   4. Native dialer call to 911.

### How to use each feature
1. Open `Home`.
2. Tap search bar to jump into AI with starter prompt.
3. Tap mic icon and grant `RECORD_AUDIO` to dictate AI query.
4. Use quick tools:
   1. Currency -> opens Wallet.
   2. Maps -> opens Map screen.
   3. Translate -> opens Translate screen.
   4. Packing List -> opens packing sheet.
   5. Weather -> opens weather sheet (currently placeholder messaging for key setup).
5. Tap transport tiles to open partner sites in-app.
6. Use SOS:
   1. Tap red SOS action.
   2. Send group alert email.
   3. Open hospital/fire routing links in-app.
   4. Tap call action for emergency dialer.

## 4. Explore Section

### What it includes
Defined in `app/src/main/java/com/kipita/presentation/explore/ExploreScreen.kt` and `ExploreViewModel.kt`:
1. Two-tab flow:
   1. Destinations
   2. Places
2. Destination cards for nomad cities with:
   1. Proximity sort (when GPS granted)
   2. “Near You” badge for closest card
   3. Sorting modes (cost/safety/WiFi)
3. Destination detail sheet:
   1. Hero image
   2. Stats
   3. Share action
   4. Add-to-trips action
4. Places tab features:
   1. Category groups (travel/dining/safety/finance/culture/etc.)
   2. GPS fetch and manual location search
   3. Real-time Google Places results
   4. Save/Favorite heart toggle
   5. Uber/Lyft deep-link handoff (if installed)
5. BTCMap shortcut from finance category context.

### How to use each feature
1. Open `Explore`.
2. Allow location permission for distance-aware sorting and local search.
3. On Destinations tab:
   1. Scroll cards.
   2. Tap a card for detail sheet.
   3. Tap share to use Android share sheet.
   4. Tap add-to-trips to create an upcoming trip.
4. On Places tab:
   1. Enter city/address or use GPS.
   2. Tap category chip.
   3. Review results.
   4. Tap heart to save location.
   5. Tap Uber/Lyft if deep links available.

## 5. Places Section (Dedicated)

### What it includes
`PlacesScreen.kt` and `PlacesCategoryResultScreen.kt` provide category-first discovery:
1. Grouped chips by domain.
2. Dedicated BTCMap chip in Finance group.
3. Full-screen results page per category.
4. Emergency category behavior:
   1. Safety/Urgent Care/Pharmacies/Fitness results open in-app Google Maps search.
5. Non-emergency category behavior:
   1. Cards expand inline for details (phone, metadata).

### How to use
1. From Explore or routed places flow, tap a category.
2. Grant location permission for nearby fetch.
3. For emergency categories, tap result to open in-app map search.
4. For standard categories, tap card to expand/collapse details.
5. Tap BTCMap chip for direct in-app BTC merchant map.

## 6. Map Section

### What it includes
`MapScreen.kt` + `MapViewModel.kt`:
1. Google Map composable with current location support.
2. Location permission request on first load.
3. Address/city search bar with geocode recenter.
4. Overlay controls:
   1. BTC merchants
   2. Safety
   3. Health
   4. Infrastructure
   5. Nomad
5. BTC source filter (when BTC filter active):
   1. BTCMap
   2. Cash App
   3. Both
6. Place marker switching:
   1. Food
   2. Cafe
   3. Shops
7. Offline cache toggle (`cacheRegionOffline`).
8. AI navigation suggestion trigger.
9. Bottom-sheet lists and notice summaries.

### How to use
1. Open `Map`.
2. Accept location permission.
3. Type address/city in search bar and submit.
4. Toggle overlays via icon chips.
5. Tap BTC filter then choose source pill.
6. Tap Offline to cache current region marker data state.
7. Tap Navigate for AI-assisted route guidance prompt generation.

## 7. AI Section

### What it includes
`AiAssistantScreen.kt` + `AiViewModel.kt` + `KipitaAIManager.kt`:
1. Prompt input and send flow.
2. Voice dictation input (`RECORD_AUDIO`).
3. Quick action cards:
   1. Plan Trip
   2. Find Flights
   3. Nearby Places
   4. Travel Advisories
4. Typing indicator shared state.
5. Multi-model branding display.
6. AI responses with optional trip conversion:
   1. “Add to Trips” appears after planning context.
7. Pre-fill prompt support from other sections.

### How to use
1. Open `AI` tab.
2. Type prompt or tap mic and speak.
3. Optionally use quick action presets.
4. For trip plans, tap add-to-trips to create an upcoming trip.
5. Open generated trip from Trips section for further edits/invites.

### AI backend behavior
1. Native Gemini manager handles chat, planTrip, NLP parse, and image analysis.
2. Separate orchestration stack (`AiOrchestrator` + `LlmRouter`) exists for multi-LLM routing patterns.
3. Gemini usage limiter and small in-memory context cache are implemented.

## 8. Trips Section

### What it includes
`MyTripsScreen.kt`, `TripDetailScreen.kt`, `TripsViewModel.kt`, `TripDetailViewModel.kt`:
1. Upcoming/Past/Cancelled trip segmentation.
2. Manual trip creation sheet with date pickers.
3. AI quick prompt shortcuts in Trips header.
4. Trip detail “master record” page:
   1. Hero area with status.
   2. Book/manage chips (Flights/Hotels/Car/Uber/Lyft).
   3. Expandable itinerary days.
   4. Editable notes with save confirmation.
   5. Invite members by email.
   6. Invite lock messaging for group chat behavior.
   7. Mark Complete action.
   8. Cancel Trip action + reason + notify invites.
5. Cancelled trips section with recreate action.
6. Sample/onboarding trip seeding and auto-removal when real trip added.
7. Auto aging of expired trips to past status.

### How to use each feature
1. Open `Trips`.
2. Create trip:
   1. Tap plan/create action.
   2. Fill destination and logistics fields.
   3. Select start/end via date pickers.
   4. Save.
3. View trip detail:
   1. Tap card in upcoming/past/cancelled sections.
4. Notes:
   1. Tap Edit in notes section.
   2. Modify text.
   3. Save to persist.
5. Invites:
   1. Tap invite action.
   2. Enter email.
   3. Send.
6. Mark complete:
   1. In active/upcoming trip detail tap “Mark Complete”.
7. Cancel trip:
   1. Tap “Cancel Trip”.
   2. Confirm and optionally add reason.
   3. App prepares member notification email intent.
8. Recreate canceled trip:
   1. In Cancelled Trips tap “Recreate”.
   2. System clones details into new upcoming trip.

## 9. Wallet Section

### What it includes
`WalletScreen.kt` + `WalletViewModel.kt` + wallet/currency repos:
1. Unified travel wallet header.
2. Aggregated balances:
   1. Coinbase
   2. River/Cash App display path
   3. Gemini supported in repository layer
3. Live crypto prices (BTC/ETH/SOL) polled every 30 seconds.
4. Crypto/Currency tab split.
5. Currency converter supporting fiat plus BTC/ETH approximation paths.
6. Currency picker with large list of supported codes.
7. Kipita Perks brand tiles linking out to partner websites.
8. Refresh controls for balances and prices.

### How to use
1. Open `Wallet`.
2. Read aggregate BTC and source chips.
3. Tap refresh icon for latest wallet and price sync.
4. Switch to `Currency` tab for converter.
5. Enter amount, choose from/to currencies, run conversion.
6. Use perks tiles for partner offers and external services.

### Security model details
1. Repository maintains wallet data in memory-only cache.
2. No persistent balance storage by design (zero-persistence contract).
3. OAuth/API tokens are read from Keystore aliases.

## 10. Social Section

### What it includes
`SocialScreen.kt` + `SocialViewModel.kt` + `OfflineMessagingRepository.kt`:
1. Tabbed social hub:
   1. Groups
   2. Travelers
   3. Messages
2. Group and traveler search.
3. Connect cards:
   1. Find nearby travelers
   2. Join travel groups
4. Invite link sheet for groups.
5. Direct message thread UI.
6. Offline-first messaging storage in Room.
7. Messaging lock until invite acceptance for non-confirmed conversations.
8. HTTPS-only link validation in messages.
9. Seed sample messages for demo conversations.

### How to use
1. Open `Social`.
2. Pick tab:
   1. Groups to browse communities.
   2. Travelers to browse people.
   3. Messages for DMs.
3. Use search bar to filter.
4. Open group, then share invite link if needed.
5. Open conversation and send message.
6. If message blocked, ensure invite acceptance/confirmed conversation state.

## 11. Community Sub-Screens

### Nearby Travelers (`NearbyTravelersScreen.kt`)
Features:
1. List of traveler profiles by location.
2. Quick invite and detailed invite via email.
3. Bottom sheet with profile details and invite workflow.

How to use:
1. Open from Social connect card.
2. Tap traveler row for detail.
3. Use quick invite or send invite from detail sheet.

### Travel Groups (`TravelGroupsScreen.kt`)
Features:
1. Category-based group filtering.
2. Public/private group metadata.
3. Request-to-join flow with admin approval messaging.
4. Email-based request template generation.

How to use:
1. Open from Social connect card (requires non-guest profile).
2. Filter category chips.
3. Tap group.
4. Request join and send approval email template.

## 12. Translate Section

### What it includes
`TranslateScreen.kt`:
1. Large built-in phrase and language database.
2. 20 top global languages with travel phrase sets.
3. Category segmented phrases:
   1. Emergency
   2. Transport
   3. Housing
   4. Essentials
4. Mode toggle:
   1. Google Translate in-app mode
   2. Manual/offline phrase mode
5. In-app deep links to Google Translate pages.
6. Offline use path for local phrase cards.

### How to use
1. Open `Translate`.
2. Choose language.
3. Search phrase or browse category tabs.
4. For real-time translation:
   1. Switch to Google mode.
   2. Open Google Translate in in-app browser.
5. For offline travel:
   1. Stay in manual phrase mode.
   2. Use local phrase cards directly.

## 13. Auth and Identity

### What it includes
`AuthScreen.kt`, `AuthViewModel.kt`, `AccountRepository.kt`:
1. Sign in tab:
   1. Email/password login.
   2. Forgot password UX placeholder state.
2. Create account tab:
   1. Display name
   2. Username
   3. Email
   4. Password + confirm
3. Google Sign-In integration:
   1. Credential Manager
   2. FirebaseAuth credential exchange
4. Continue as guest option.
5. Local user persistence via Room `UserDao`.

### How to use
1. Tap avatar -> `Sign In / Create Profile`.
2. Choose tab:
   1. Sign in with email/password.
   2. Create account with required fields.
3. Optionally use Google button.
4. Use guest mode if account is not needed.

### Validation behavior
1. Username/email uniqueness checked locally.
2. Password minimum length enforced.
3. Auth errors surfaced in-screen via shared error state.

## 14. Profile Setup

### What it includes
`ProfileSetupScreen.kt`:
1. Individual vs Group profile type.
2. Avatar upload via image picker.
3. Core profile fields:
   1. Display name
   2. Username
   3. Home city
   4. Bio
   5. Group name when group profile selected
4. Travel style chip multiselect.
5. Save action returning name/avatar to app shell.
6. Built-in support form action path.

### How to use
1. Open profile setup from profile menu.
2. Select profile type.
3. Add/change photo.
4. Fill identity fields and travel styles.
5. Save to update top-right avatar and user display state.

## 15. Settings

### What it includes
`SettingsScreen.kt`, `SettingsViewModel.kt`:
1. Privacy and encryption information panel.
2. Partner/affiliate list links.
3. Share Kipita action.
4. Support contact email prefill with recent logs.
5. Error log flush action.
6. Account deletion flow (GDPR/CCPA style local wipe).
7. Keystore cleanup on account deletion.

### How to use
1. Open avatar menu -> Settings.
2. Use affiliate rows to open partner links.
3. Tap share panel to share app link.
4. Tap contact support to email `info@kipita.com` with log snippets.
5. Tap log sync/flush action for diagnostics.
6. Use delete account action to clear local identity and key material.

## 16. In-App Browser

### What it includes
`InAppBrowserScreen.kt`:
1. WebView wrapper used by transport, perks, emergency map links, and translation links.
2. HTTPS enforcement and `http -> https` upgrade behavior.
3. External intent handling for non-web schemes.
4. Toolbar actions:
   1. Back to app
   2. Refresh affordance
   3. Open in system browser
5. Secure/insecure status indicator.
6. Loading overlay.

### How to use
1. Trigger any external content from Home/Trips/Wallet/Translate/Places/SOS.
2. Content opens in Kipita browser screen.
3. Use toolbar to return or open in external browser if needed.

## 17. Error Boundary and Crash Handling

### What it includes
1. `KipitaErrorBoundary` wrapper around screen routes.
2. Fallback UI with retry action.
3. Error reporting mailto flow to `info@kipita.com`.
4. Global uncaught exception handler in `KipitaApplication` that composes crash report email.

### How to use
1. On screen-level failures, user sees fallback and can tap retry.
2. On unhandled crash, app attempts to open prefilled crash email draft.

## 18. Background Jobs and Startup Sync

### What it includes
1. `StartupDataAggregator`:
   1. Concurrent startup fetch for wallets + prices + POIs.
2. `DailyReconWorker`:
   1. 24-hour reconciliation around 2:00 AM.
   2. Refreshes wallets, merchants, nomad data, and places categories.
3. `MerchantTravelSyncWorker`:
   1. 6-hour periodic sync scheduled from `MainActivity`.
4. WorkManager initialization uses Hilt worker factory.

### How to use (operator/developer)
1. Launch app normally; startup aggregation auto-runs.
2. Allow app background execution/network for periodic workers.
3. Verify worker scheduling in Android Studio inspector or logs if testing reliability.

## 19. Data and Repository Layer Synopsis

### Trips and persistence
1. Room-backed `TripEntity` lifecycle with statuses:
   1. UPCOMING
   2. ACTIVE
   3. PAST
   4. CANCELLED
2. Invite list stored as JSON and parsed into email arrays.
3. Cancellation metadata persisted (`cancelledAt`, `cancellationReason`).

### Discovery and maps
1. Google Places API v1 category fetch by coordinates or text location.
2. In-memory cache for places (15 minutes).
3. Merchant repository merges BTCMap and optional Cash App source.
4. Map overlays combine notices, merchants, and nomad data.

### Finance
1. Coinbase/Gemini/River wallet aggregation.
2. CoinGecko live price ingestion.
3. Frankfurter ECB-powered fiat conversion.
4. Approximation bridge for BTC/ETH conversion paths.

### Safety and notices
1. TravelDataEngine fetches safety/health/advisory streams.
2. DataValidation layer normalizes incoming notices.
3. Safety scoring logic computes travel alert level.

### Messaging
1. Offline messaging repository with Room backing.
2. Pending sync/read state helpers.
3. Secure link validation (HTTPS-only).

## 20. Companion Web App (PWA) Synopsis

Primary file: `web/index.html`  
Support files: `web/sw.js`, `web/manifest.json`

### Web sections and features
1. Sticky nav with route anchors.
2. Hero section with download CTAs.
3. Live crypto section (CoinGecko).
4. Wallet connection section:
   1. MetaMask connect/disconnect
   2. Address display
   3. ETH and USD equivalent display
   4. Persisted wallet state in localStorage
5. BTC map section:
   1. Embedded BTCMap iframe
   2. Merchant count updates
6. Explore/places:
   1. City/address search
   2. GPS locate button
   3. 4x4 category grid
   4. Place cards
   5. Add-to-itinerary actions
7. Languages section:
   1. Multi-language phrase cards
   2. Search/filter
8. Itinerary section:
   1. Trip cards
   2. Place assignment to trips
9. Booking and affiliate sections:
   1. Booking tiles
   2. Crypto affiliate tiles
   3. BTCMap tile
10. SOS floating button + emergency modal.
11. Full-screen iframe modal viewer for outbound content.
12. Fallback handling when iframe is blocked by upstream headers.
13. Keyboard UX improvements (escape closes modals).

### How to use web features
1. Open `web/index.html` in browser.
2. Connect wallet from top nav button.
3. Use Places search or GPS locate.
4. Add places into itinerary trips.
5. Use SOS button for emergency panel.
6. Open booking/affiliate tiles; content loads in secure iframe viewer where allowed.
7. Install PWA from browser menu to run as standalone app shell.

### Web offline behavior
1. Service worker caches static resources cache-first.
2. API domains use network-first with cache fallback.
3. Supports resilient usage during unstable connectivity.

## 21. Build, Configuration, and Runtime Requirements

### Android runtime permissions used
1. `INTERNET`
2. `ACCESS_FINE_LOCATION`
3. `ACCESS_COARSE_LOCATION`
4. `ACCESS_NETWORK_STATE`
5. `RECORD_AUDIO`

### Key setup requirements
1. Google Maps key via `MAPS_API_KEY` in secrets plugin.
2. Google Places key via `GOOGLE_PLACES_API_KEY`.
3. Gemini key via `GEMINI_API_KEY`.
4. Firebase config files in flavor paths for Google auth and Firebase services.

### Firebase flavor file locations
1. `app/src/prod/google-services.json`
2. `app/src/dev/google-services.json`
3. `app/src/staging/google-services.json`

### Practical setup checklist
1. Place required secrets in `local.properties` and/or secure config pipeline.
2. Ensure Firebase Google Sign-In enabled and SHA fingerprints configured.
3. Build with target flavor (`dev`, `staging`, `prod`).
4. Test permissions on fresh install path.

## 22. Feature Access Matrix (Quick Operator Guide)

1. Home:
   1. Quick tools, bookings, SOS, AI entry.
2. Explore:
   1. Destinations + places + favorite/save + rideshare links.
3. Places:
   1. Category-centric results + emergency in-app map opens.
4. Map:
   1. Live map, overlays, search recenter, BTC source filtering.
5. AI:
   1. Freeform or quick-action prompts; add plans to trips.
6. Trips:
   1. Create/manage lifecycle, invites, cancel/recreate, completion.
7. Wallet:
   1. Balances, prices, conversion, perks.
8. Social:
   1. Groups/travelers/messages with invite-gated messaging.
9. Translate:
   1. Offline phrasebook + Google translate deep links.
10. Settings:
   1. Support, logs, privacy info, share, deletion.

## 23. Legacy/Secondary Modules Present

These modules exist in repo and may be non-primary in current navigation:
1. `ChatScreen` and `ChatViewModel`:
   1. Group trip chat sample flow.
   2. Enforces max 10 participants.
   3. Can inject AI planner responses into conversation.
2. `ExperienceScreen`:
   1. Simple expandable feature-card showcase.

## 24. End-to-End User Journey (Recommended)

1. Launch app and choose guest or sign-in/profile path.
2. Use Home quick tools to orient:
   1. AI prompt
   2. Map
   3. Wallet
3. Open Explore:
   1. Pick destination.
   2. Add to Trips.
4. In Trips:
   1. Confirm dates/logistics.
   2. Invite members.
5. During trip:
   1. Use Map for POIs and BTC merchants.
   2. Use Translate for local communication.
   3. Use SOS if needed.
6. Post-trip:
   1. Mark trip complete or cancel/recreate as required.

## 25. Current Constraints and Operational Notes

1. Several integrations are scaffolded and may require production keys/tokens.
2. Some UI labels still indicate placeholder/foundation behavior.
3. Messaging confirmation state is demo-seeded for certain conversations.
4. In-app browser fallback to external browser may occur for blocked iframe/content policies.
5. Crypto conversion for BTC/ETH in converter uses approximated rates in current implementation path; dedicated price feed is separate and present.

---

This document is intended as the authoritative section-by-section synopsis and usage guide for the current repository state as of February 28, 2026.
