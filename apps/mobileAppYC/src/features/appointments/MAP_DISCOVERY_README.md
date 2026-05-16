# Map Discovery Feature — Yosemite Crew Mobile

> Find nearby vet clinics on a live map, filter by category or availability, and book directly from a draggable bottom sheet.

**Demo:** [View on Google Drive](https://drive.google.com/file/d/1JMsHznwqVuTMx_QINakOc8687U2Yim0E/view?usp=sharing)

---

## Table of Contents

1. [Map SDK Justification](#map-sdk-justification)
2. [Map Style Approach](#map-style-approach)
3. [Architecture](#architecture)
4. [File Structure](#file-structure)
5. [Setup](#setup)
6. [Feature Walkthrough](#feature-walkthrough)
7. [Acceptance Criteria Status](#acceptance-criteria-status)

---

## Map SDK Justification

**Chosen SDK:** `react-native-maps` with `PROVIDER_GOOGLE`

| Factor                  | Decision                                                                                                                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Custom map styles**   | Google Maps JSON styling API (`customMapStyle`) — the only cross-platform option that supports full visual theming (road colors, POI suppression, water tint) without a tile-server |
| **Marker flexibility**  | `react-native-maps` renders arbitrary React Native views as markers, enabling the branded bubble pins (`ClinicMapPin`) with category color, clinic name, and live rating            |
| **Camera control**      | `MapView.animateToRegion()` provides the smooth 350 ms camera animation on pin tap                                                                                                  |
| **Ecosystem maturity**  | `react-native-maps` is the de-facto standard for RN mapping — well-maintained, large community, compatible with Expo and bare RN                                                    |
| **No tile-server cost** | `PROVIDER_GOOGLE` uses the Google Maps SDK directly; no self-hosted or third-party tile costs during prototype/MVP                                                                  |

**Alternatives considered:**

- **Mapbox RN SDK** — richer styling engine but requires a separate Mapbox token, heavier native binary, and adds ~4 MB to the app bundle. Overkill for the current feature scope.
- **Apple Maps (default provider)** — no JSON style API; can't suppress POIs or set custom road colors. Ruled out for design requirements.

---

## Map Style Approach

The custom style is defined in [`utils/mapStyle.ts`](utils/mapStyle.ts) as `YC_MAP_STYLE` — a Google Maps JSON style array passed to `MapView`'s `customMapStyle` prop.

### Design goals

- **Suppress noise** — all POI labels hidden (`visibility: 'off'`), keeping only park labels at `simplified` visibility. This ensures vet-clinic pins are the only points of interest on screen.
- **Brand palette** — surface colors pulled from the Yosemite Crew design token set:

  | Element        | Color                 | Token reference         |
  | -------------- | --------------------- | ----------------------- |
  | Land surface   | `#F5F7FA`             | `colors.background`     |
  | Water fill     | `#C8DCF0`             | blue-tinted neutral     |
  | Water label    | `#247AED`             | `colors.primary`        |
  | Highway stroke | `#247AED`             | `colors.primary`        |
  | Parks          | `#D4EDDA` / `#008F5D` | `colors.success` family |
  | Road labels    | `#747473`             | `colors.textSecondary`  |
  | City labels    | `#302F2E`             | `colors.text`           |

- **Readable roads** — local roads white, arterials a light blue-tint, highways outlined in primary blue so navigation context is preserved without dominating the view.
- **High-contrast text stroke** — all labels get a `#FFFFFF` stroke at weight 2, preventing any label from being lost against the light background.

---

## Architecture

The feature follows a **screen → view → hooks** split to keep logic testable and the view purely presentational.

```
BrowseBusinessesScreen          ← orchestrator: Redux, location, Places API, navigation
│
├── useLocationPermission       ← geolocation + permission request; fallback to SF default
├── useClinicMapDiscovery       ← merges Redux businesses + mock clinics; manages map state
│   └── useMapRegionFilter      ← pure filter: region bounds · category · openNow · search
│
└── MapDiscoveryView            ← pure presentational; renders map + bottom sheet + overlays
    ├── MapView (PROVIDER_GOOGLE)
    │   ├── ClinicMapPin        ← branded bubble pin, category color + scale on selection
    │   └── ClusterMapPin       ← blue circle + count badge for clustered pins
    └── ClinicBottomSheet       ← @gorhom/bottom-sheet; snap 22% ↔ 88%; imperative scroll ref
        └── BusinessCard        ← single clinic card with distance, rating, photo, Book CTA
```

### Data flow

```
Redux (fetchBusinesses API)
        +
MOCK_CLINICS (clinicMocks.ts)
        │
        ▼
mergeAndDeduplicate()           ← Redux results take priority; mocks fill gaps by ID
        │
enrichWithDistance(userCoords)  ← Haversine formula; converts to km or mi per user prefs
        │
useMapRegionFilter()            ← filters by: map viewport · category · openNow · searchQuery
        │
        ▼
MapDiscoveryView (clinics prop) ─── pins on map + cards in bottom sheet stay in sync
```

### Pin tap interaction

```
handlePinPress(clinicId)
  ├── onSelectClinic(id)              → highlights pin (1.18× scale)
  ├── bottomSheetRef.scrollToClinic() → scrolls FlatList to matching card + snaps to index 0
  └── mapRef.animateToRegion()        → 350 ms camera animation, offset -15% lat so pin sits above fold
```

### Location denial path

`useLocationPermission` wraps the native permission request in a try-catch with a `cancelled` guard. On any failure (denied, error, timeout) it sets `hasPermission: false` and falls back to `DEFAULT_CENTER` (San Francisco). The map always renders; `showsUserLocation` is conditionally false so no user-dot appears when permission is absent.

### Clustering

`clusterClinics()` in [`utils/clusterClinics.ts`](utils/clusterClinics.ts) runs a lightweight grid-based algorithm:

- Activates only when `latitudeDelta ≥ 0.08` (zoomed out) **and** ≥ 2 visible clinics
- Divides the current map region into a 5 × 5 grid
- Cells with 1 clinic → individual `ClinicMapPin`; cells with 2+ → `ClusterMapPin` (centroid + count)
- Recalculates on every `onRegionChangeComplete` event via `useMemo`

---

## File Structure

```
features/appointments/
├── components/
│   ├── MapDiscovery/
│   │   ├── MapDiscoveryView.tsx      ← full-screen map + overlays
│   │   ├── ClinicBottomSheet.tsx     ← draggable sheet with filter header + FlatList
│   │   ├── ClinicMapPin.tsx          ← category-colored bubble pin
│   │   ├── ClusterMapPin.tsx         ← zoom-out cluster badge
│   │   └── index.ts
│   └── BusinessCard/
│       └── BusinessCard.tsx          ← card shown in sheet and list
├── hooks/
│   ├── useLocationPermission.ts      ← geolocation + permission; fallback coords
│   ├── useClinicMapDiscovery.ts      ← state management: selection, region, filters
│   └── useMapRegionFilter.ts         ← pure memoized filter function
├── mocks/
│   └── clinicMocks.ts                ← 13 realistic Bay Area clinics
├── screens/
│   ├── BrowseBusinessesScreen.tsx    ← orchestrator screen
│   └── BusinessDetailsScreen.tsx     ← detail view with distance, directions CTA
└── utils/
    ├── mapStyle.ts                   ← YC_MAP_STYLE JSON array
    ├── clusterClinics.ts             ← grid-based pin clustering
    └── distanceCalc.ts               ← Haversine distance (km / mi)
```

---

## Setup

### Prerequisites

| Requirement    | Version             |
| -------------- | ------------------- |
| Node.js        | ≥ 18                |
| pnpm           | ≥ 8                 |
| React Native   | 0.73+               |
| Xcode          | 15+ (iOS)           |
| Android Studio | Hedgehog+ (Android) |

### 1. Install dependencies

```bash
pnpm install
```

### 2. Google Maps API key

**iOS** — add to `apps/mobileAppYC/ios/mobileAppYC/AppDelegate.mm`:

```objc
#import <GoogleMaps/GoogleMaps.h>

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:... {
  [GMSServices provideAPIKey:@"YOUR_IOS_GOOGLE_MAPS_KEY"];
  ...
}
```

**Android** — add to `apps/mobileAppYC/android/app/src/main/AndroidManifest.xml`:

```xml
<meta-data
  android:name="com.google.android.geo.API_KEY"
  android:value="YOUR_ANDROID_GOOGLE_MAPS_KEY" />
```

Required Google Cloud APIs: **Maps SDK for iOS**, **Maps SDK for Android**, **Places API**.

### 3. iOS pod install

```bash
cd apps/mobileAppYC/ios && pod install && cd -
```

### 4. Location permissions

**iOS** — `Info.plist` must contain:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Allow Yosemite Crew to show clinics near you.</string>
```

**Android** — `AndroidManifest.xml` must contain:

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

### 5. Run

```bash
# iOS
pnpm --filter mobileAppYC run ios

# Android
pnpm --filter mobileAppYC run android
```

### 6. Navigate to the feature

From the Appointments tab → **Find a Clinic** — this opens `BrowseBusinessesScreen`.

---

## Feature Walkthrough

### Full-screen map

`MapDiscoveryView` sets `MapView` to `StyleSheet.absoluteFillObject` so the map bleeds edge-to-edge. The search bar and header float in a glass-effect card anchored to the safe-area top with `pointerEvents="box-none"` so map gestures pass through.

### Draggable bottom sheet

`ClinicBottomSheet` uses `@gorhom/bottom-sheet` with snap points `['22%', '88%']`. Collapsed state (22%) shows roughly one card as a peek. Expanded state (88%) shows a full scrollable list. `enablePanDownToClose={false}` keeps the sheet always visible.

### Pan → card sync

`MapView.onRegionChangeComplete` fires `handleRegionChange` → `setMapRegion`. `useMapRegionFilter` recomputes the visible set using `isInRegion()` (lat/lng bounds check). The filtered array flows into both the map pins and the `ClinicBottomSheet` data.

### Pin tap → card focus

`handlePinPress` calls three operations atomically: selects the clinic ID (pin scales up), calls `bottomSheetRef.scrollToClinic()` (FlatList scrolls to the matching index), and calls `mapRef.animateToRegion()` (350 ms camera pan with 0.5× zoom).

### Search

The search bar drives two parallel systems: the local `useMapRegionFilter` (name / address / specialties match) and the Google Places `usePlacesBusinessSearch` (dropdown overlay for adding new businesses). Both update on every keystroke via `handleUnifiedSearchChange`.

### Filter chips

Above the bottom sheet card list: an **Open Now** toggle chip and **category filter pills** (All / Hospital / Groomer / Breeder / Boarder). Both wire into `useClinicMapDiscovery` state and feed `useMapRegionFilter`.

### Distance

`useClinicMapDiscovery.enrichWithDistance()` runs the Haversine formula (`distanceCalc.ts`) against the user's current coords for every clinic, attaching `distanceMi` and `distanceMeters`. `ClinicBottomSheet` converts to the user's preferred unit (km / mi) via `resolveDistanceText`. `BusinessDetailsScreen` exposes the same value with a unit toggle.

### Open in native maps

`BusinessDetailsScreen` → **Get Directions** calls `openMapsToPlaceId()` / `openMapsToAddress()` from `@/shared/utils/openMaps`. On iOS this tries the `maps://` scheme first, then `maps.apple.com`, then Google Maps. On Android it opens Google Maps with a `geo:` intent.
