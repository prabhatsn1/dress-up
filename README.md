# AI Wardrobe Expo - Technical Documentation

## 1. Project Overview

### Problem Statement

Managing a personal wardrobe effectively requires remembering what you own, understanding how items work together, and making context-aware outfit decisions based on weather, occasion, and style preferences. Most people lack a systematic way to:

- Track and search their wardrobe digitally
- Get weather-appropriate outfit suggestions
- Understand which clothing combinations work well together
- Build engagement with their existing wardrobe before buying new items

### Solution

**AI Wardrobe Expo** is a privacy-first, mobile wardrobe assistant that combines:

- **Digital wardrobe management** with camera/gallery import and AI-powered auto-tagging
- **Context-aware outfit recommendations** using local rule-based algorithms
- **Weather integration** to suggest appropriate clothing for current conditions
- **Gamification mechanics** (streaks, badges, challenges) to encourage consistent usage
- **Optional cloud sync** via Supabase for cross-device access and advanced AI features

### Target Users

1. **Fashion-conscious individuals** who want to maximize their existing wardrobe
2. **Minimalists** seeking to build capsule wardrobes with high versatility
3. **Busy professionals** needing quick, weather-appropriate outfit decisions
4. **Users concerned about privacy** who want local-first data storage with optional cloud features

### Key Use Cases

- **Daily outfit planning**: Get AI-recommended outfits based on weather, occasion, and personal style
- **Wardrobe digitization**: Quickly capture and organize clothing with AI-assisted tagging
- **Outfit logging**: Track what you wear to avoid repetition and build style insights
- **Capsule wardrobe building**: Create focused collections (10×10 challenge) for travel or seasonal wear
- **Cost-per-wear tracking**: Understand wardrobe value by monitoring item usage
- **Laundry management**: Track dirty items and get reminders

---

## 2. Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    React Native Mobile App                   │
│                     (Expo + Expo Router)                     │
├─────────────────────────────────────────────────────────────┤
│  UI Layer:                                                   │
│  ┌─────────────┬──────────────┬─────────────┬─────────────┐ │
│  │ Today Screen│ Closet Screen│ Planner     │ Profile     │ │
│  │ (index)     │ (explore)    │ (planner)   │ (profile)   │ │
│  └─────────────┴──────────────┴─────────────┴─────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  State Management:                                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         AppDataProvider (React Context)               │   │
│  │  - Wardrobe state, Weather state, Profile            │   │
│  │  - Gamification state, Outfit logs                   │   │
│  └──────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  Domain Logic Layer (lib/):                                 │
│  ┌──────────────┬────────────────┬────────────────────┐    │
│  │ wardrobe.ts  │ weather.ts     │ ai.ts              │    │
│  │ (core logic) │ (location+API) │ (AI integration)   │    │
│  ├──────────────┼────────────────┼────────────────────┤    │
│  │ outfit-log.ts│ gamification.ts│ capsule.ts         │    │
│  │ (tracking)   │ (XP/badges)    │ (10×10 challenge)  │    │
│  ├──────────────┼────────────────┼────────────────────┤    │
│  │ local-db.ts  │ supabase-      │ colour-analysis.ts │    │
│  │ (SQLite)     │ wardrobe.ts    │ (seasonal palette) │    │
│  └──────────────┴────────────────┴────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│               Local Storage (Device)                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ SQLite Database (wardrobe.db)                        │   │
│  │  - wardrobe_items  - outfit_logs                     │   │
│  │  - capsules        - gamification_state              │   │
│  │  - earned_badges   - weekly_challenges               │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ AsyncStorage (KV Store)                              │   │
│  │  - User profile    - Notification settings           │   │
│  │  - Supabase auth session                             │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↕ (optional)
┌─────────────────────────────────────────────────────────────┐
│            Cloud Services (Supabase Backend)                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Supabase PostgreSQL                                  │   │
│  │  - profiles  - wardrobe_items  - outfit_logs         │   │
│  │  (RLS enabled for user-scoped data security)         │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Supabase Storage (wardrobe-images bucket)            │   │
│  │  - User-uploaded clothing images                     │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Edge Functions (Deno)                                │   │
│  │  wardrobe-ai:                                        │   │
│  │   - analyze-item: HuggingFace + OpenAI tagging      │   │
│  │   - generate-outfit: OpenAI stylist recommendations │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│              External APIs                                   │
│  ┌──────────────────┬──────────────────┬─────────────────┐  │
│  │ Open-Meteo API   │ Hugging Face API │ OpenAI API      │  │
│  │ (weather data)   │ (segmentation)   │ (structured AI) │  │
│  └──────────────────┴──────────────────┴─────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

#### Mobile App Layer

- **App Screens**: Tab-based navigation with Today, Closet, Planner, and Profile screens
- **Components**: Reusable UI widgets (outfit cards, rating sheets, gamification displays)
- **Providers**: React Context for global state management
- **Hooks**: Theme management and color scheme utilities

#### Domain Logic Layer

- **Wardrobe Management** (`wardrobe.ts`): Core types, filtering, recommendation algorithm
- **Weather Integration** (`weather.ts`): Location services, Open-Meteo API client
- **AI Services** (`ai.ts`): Client-side wrapper for Supabase Edge Functions
- **Outfit Logging** (`outfit-log.ts`): Persistence, repeat detection, rating system
- **Gamification** (`gamification.ts`): XP calculation, badge awards, streak tracking
- **Capsule Wardrobe** (`capsule.ts`): Coverage scoring, versatility metrics, 10×10 challenge
- **Colour Analysis** (`colour-analysis.ts`): Seasonal palette matching, outfit scoring

#### Persistence Layer

- **Local Database** (`local-db.ts`): SQLite operations for offline-first data
- **Supabase Integration** (`supabase-wardrobe.ts`): Cloud sync helpers (optional)
- **AsyncStorage**: Session persistence, user preferences

#### Backend Layer (Supabase)

- **PostgreSQL**: User profiles, wardrobe items, outfit logs with Row-Level Security (RLS)
- **Storage**: Image hosting with user-scoped access policies
- **Edge Functions**: Server-side AI processing (Deno runtime)

### Data Flow

#### Wardrobe Item Upload Flow

```
User taps "Add" → Camera/Gallery Picker → Image selected
   ↓
Local SQLite insert (with temp ID, source='camera'/'library')
   ↓
AppDataProvider state update (immediate UI feedback)
   ↓
[If Supabase configured]
   ↓
Upload image to Supabase Storage
   ↓
Insert wardrobe_item row in Supabase (with storage path)
   ↓
Mark item as synced in local SQLite
```

#### AI Tagging Flow

```
User taps "Analyze with AI" on item
   ↓
Client calls supabase.functions.invoke('wardrobe-ai')
   ↓
Edge Function fetches image from Storage
   ↓
Parallel calls:
   - Hugging Face RMBG-2.0 (segmentation)
   - OpenAI Responses API (structured tagging)
   ↓
Merge results, return WardrobeAiAnalysis
   ↓
Update item in SQLite + Supabase
   ↓
UI shows updated tags
```

#### Outfit Recommendation Flow

```
User selects occasion + weather auto-loaded
   ↓
Filter wardrobe items:
   - Exclude dirty items (is_dirty=true)
   - Match season to weather.temperatureC
   - Match formality to occasion
   ↓
Build combinations (Top + Bottom, optionally + Outerwear)
   ↓
Score each outfit:
   - Weather appropriateness (temp range, rain)
   - Colour harmony (palette scoring)
   - Freshness (penalize recent wears)
   - Versatility (item rarity bonus)
   ↓
Sort by score, return top 4 recommendations
   ↓
Render cards with items, reasons, confidence
```

#### Outfit Logging Flow

```
User taps "Mark as Worn" → Select items
   ↓
Check for repeat outfit (same item_ids within 14 days)
   ↓
[If repeat detected] Show warning modal → User confirms/cancels
   ↓
Save to local SQLite outfit_logs table
   ↓
Update wardrobe_items: increment wear_count, update last_worn_days_ago
   ↓
Gamification engine processes event:
   - Award XP (10 base + bonuses)
   - Check/update streak
   - Evaluate badge conditions
   - Update weekly challenge progress
   ↓
[If Supabase configured] Push log to cloud
   ↓
Trigger rating sheet (pendingRatingLog)
   ↓
User rates outfit (1-5 stars) → Update outfit_log
```

### Key Architectural Patterns

#### 1. Offline-First Architecture

- **Local SQLite** is the source of truth for reads
- **Supabase** is treated as an optional sync layer
- App remains fully functional without network connectivity
- Cloud writes are fire-and-forget (non-blocking, failures logged but not fatal)

#### 2. Dependency Injection for External Services

- All external API clients check for configuration before executing
- `isSupabaseConfigured` flag enables graceful degradation
- Sample/fallback data provided when APIs unavailable

#### 3. Provider Pattern for State Management

- Single `AppDataProvider` wraps entire app tree
- Encapsulates data fetching, mutations, and side effects
- Exposes clean API via `useAppData()` hook

#### 4. Event-Driven Gamification

- Outfit logging and rating trigger gamification updates
- Updates returned synchronously to UI for instant feedback
- Decoupled from core wardrobe logic (separate module)

#### 5. Rule-Based Recommendations + Optional AI Enhancement

- Local algorithm provides instant results without network
- AI stylist available when Supabase configured for enhanced reasoning
- Hybrid approach: rule-based baseline + AI augmentation

### External Dependencies

| Service            | Purpose                                         | Required? | Fallback                        |
| ------------------ | ----------------------------------------------- | --------- | ------------------------------- |
| **Expo**           | React Native framework, routing, native modules | ✅ Yes    | None (core dependency)          |
| **Supabase**       | Auth, PostgreSQL, Storage, Edge Functions       | ❌ No     | Local-only mode with seed data  |
| **Open-Meteo API** | Live weather data                               | ❌ No     | Sample weather snapshot         |
| **Hugging Face**   | Background removal, segmentation                | ❌ No     | Manual tagging only             |
| **OpenAI**         | Structured AI tagging and stylist               | ❌ No     | Rule-based recommendations only |

---

## 3. Repository Structure

```
dress-up/
├── app/                          # Expo Router screens (file-based routing)
│   ├── _layout.tsx               # Root layout with navigation setup
│   ├── onboarding.tsx            # First-run onboarding flow
│   ├── modal.tsx                 # Generic modal screen
│   ├── (auth)/                   # Auth-gated screens
│   │   ├── _layout.tsx           # Auth navigation wrapper
│   │   └── sign-in.tsx           # Email OTP authentication
│   └── (tabs)/                   # Bottom tab navigation
│       ├── _layout.tsx           # Tab bar configuration
│       ├── index.tsx             # Today screen (outfit recommendations)
│       ├── explore.tsx           # Closet screen (wardrobe management)
│       ├── planner.tsx           # Weekly planner + capsule wardrobes
│       ├── profile.tsx           # User settings + integrations
│       ├── laundry.tsx           # Laundry pile management
│       ├── capsule.tsx           # Capsule wardrobe builder
│       └── inspiration.tsx       # Outfit gallery (future feature)
│
├── lib/                          # Domain logic and services (framework-agnostic)
│   ├── wardrobe.ts               # Core types, filtering, recommendation engine
│   ├── weather.ts                # Location + Open-Meteo integration
│   ├── ai.ts                     # AI service client (Supabase Edge Functions)
│   ├── outfit-log.ts             # Outfit tracking, repeat detection, ratings
│   ├── gamification.ts           # XP model, badges, streaks, challenges
│   ├── capsule.ts                # Capsule wardrobe coverage + versatility
│   ├── colour-analysis.ts        # Seasonal palette theory + outfit scoring
│   ├── local-db.ts               # SQLite operations (expo-sqlite)
│   ├── supabase.ts               # Supabase client initialization
│   ├── supabase-wardrobe.ts      # Cloud sync helpers for wardrobe
│   ├── auth.ts                   # Authentication helpers
│   ├── profile.ts                # User profile persistence (AsyncStorage)
│   ├── notifications.ts          # Morning briefing + laundry reminders
│   ├── share-outfit.ts           # Social sharing (view-shot + expo-sharing)
│   └── expo-location-shim.ts     # Graceful location permission handling
│
├── providers/                    # React Context providers
│   └── app-data-provider.tsx     # Global state: wardrobe, weather, gamification
│
├── components/                   # Reusable UI components
│   ├── wardrobe-ui.tsx           # Base UI primitives (cards, chips, buttons)
│   ├── outfit-calendar.tsx       # Monthly outfit log calendar view
│   ├── outfit-share-card.tsx     # Social media share card renderer
│   ├── rating-sheet.tsx          # Post-outfit rating modal
│   ├── streak-banner.tsx         # Gamification streak display
│   ├── weekly-challenges.tsx     # Challenge progress cards
│   ├── wear-stats.tsx            # Cost-per-wear analytics widget
│   ├── badge-shelf.tsx           # Badge collection display
│   └── ui/                       # Generic UI components (collapsible, icons)
│
├── supabase/                     # Backend schema and functions
│   ├── schema.sql                # PostgreSQL table definitions + RLS policies
│   └── functions/
│       └── wardrobe-ai/
│           └── index.ts          # Deno Edge Function (AI tagging + stylist)
│
├── types/                        # TypeScript type definitions
│   ├── supabase.ts               # Generated Supabase database types
│   └── deno-edge.d.ts            # Deno runtime type augmentation
│
├── constants/                    # App-wide constants
│   └── theme.ts                  # Color palette, typography, spacing
│
├── hooks/                        # React hooks
│   ├── use-color-scheme.ts       # Dark/light mode detection
│   ├── use-color-scheme.web.ts   # Web-specific color scheme
│   └── use-theme-color.ts        # Theme-aware color resolution
│
├── assets/                       # Static resources
│   └── images/                   # App icons, splash screens
│
├── __tests__/                    # Jest test suite
│   ├── wardrobe.test.ts          # Recommendation engine tests
│   ├── weather.test.ts           # Weather service tests
│   └── ai.test.ts                # AI integration tests
│
├── scripts/                      # Automation scripts
│   └── reset-project.js          # Clean slate for Expo template
│
├── app.json                      # Expo configuration (plugins, permissions)
├── eas.json                      # EAS Build configuration
├── package.json                  # Dependencies and scripts
├── tsconfig.json                 # TypeScript configuration
├── eslint.config.js              # ESLint rules
└── README.md                     # Quick start guide
```

### Entry Points

1. **Mobile App Entry**: `app/_layout.tsx` → Initializes providers, loads fonts, sets up navigation
2. **Main Screen**: `app/(tabs)/index.tsx` (Today screen) → Primary user interface
3. **Database Init**: `lib/local-db.ts` → SQLite schema setup on first launch
4. **State Provider**: `providers/app-data-provider.tsx` → Data layer initialization

### Critical Modules

- **`lib/wardrobe.ts`**: Contains the core recommendation algorithm (`buildRecommendations`), filtering logic, and type definitions for the entire wardrobe domain
- **`lib/local-db.ts`**: SQLite abstraction layer; all persistence flows through here
- **`providers/app-data-provider.tsx`**: Orchestrates data loading, mutations, and synchronization between local and cloud storage
- **`supabase/schema.sql`**: Defines cloud database structure and security policies
- **`supabase/functions/wardrobe-ai/index.ts`**: Server-side AI processing endpoint

### Organization Rationale

- **`lib/` separation**: Domain logic is pure TypeScript (no React dependencies), enabling:
  - Easier unit testing
  - Potential reuse in CLI tools or backend services
  - Clear separation of concerns
- **`app/` file-based routing**: Expo Router convention; folder structure maps directly to URL routes

- **`providers/` for state**: Single source of truth pattern; avoids prop drilling

- **`supabase/` for backend**: Co-located with client code for easy reference, deployed separately

---

## 4. Key Design Decisions

### Decision 1: Offline-First with Optional Cloud Sync

**Rationale**:

- Fashion apps deal with personal, sensitive data (body measurements, photos)
- Users should retain full functionality without account creation
- Network conditions vary (travel, commute, home)

**Trade-offs**:

- ✅ **Pros**: Privacy-preserving, works everywhere, instant UI updates
- ❌ **Cons**: Sync complexity, potential data conflicts, no cross-device by default

**Implementation**:

- SQLite as single source of truth for reads
- Supabase writes are fire-and-forget with `syncedToCloud` flag tracking
- Conflict resolution: last-write-wins on cloud sync

**Constraints**:

- Local-only mode limits AI features (requires cloud Edge Function)
- Users must explicitly opt into cloud features via sign-in

---

### Decision 2: Rule-Based Recommendations + Optional AI

**Rationale**:

- AI APIs add latency, cost, and privacy concerns
- Many outfit decisions follow predictable patterns (weather, formality, freshness)
- Hybrid approach balances instant results with advanced reasoning

**Trade-offs**:

- ✅ **Pros**: Fast local recommendations, graceful degradation, cost control
- ❌ **Cons**: Local algorithm lacks nuance, may miss creative combinations

**Implementation**:

- `buildRecommendations()` scores outfits using:
  - Weather appropriateness (temperature ranges, rain protection)
  - Formality matching (occasion → formality mapping)
  - Freshness penalty (exponential decay on `lastWornDaysAgo`)
  - Colour harmony (seasonal palette scoring)
- AI stylist (`generateAiStylistRecommendation()`) provides enhanced reasoning as opt-in

**Constraints**:

- Rule-based algorithm requires curated enum mappings (e.g., `formalityTargets`)
- AI stylist requires Supabase + OpenAI configuration

---

### Decision 3: Gamification for Engagement

**Rationale**:

- Wardrobe apps face low retention; users stop after initial capture
- Gamification (XP, streaks, badges) proven to drive habit formation
- Fashion is inherently social/competitive; leaderboards future consideration

**Trade-offs**:

- ✅ **Pros**: Increased engagement, data richness (more outfit logs), user delight
- ❌ **Cons**: Adds complexity, risk of "gaming the system", not for everyone

**Implementation**:

- XP awarded for: logging outfits (10), rating outfits (5), streak bonuses (15-60)
- Badges for: streaks (3/7/14/30 days), variety (occasions, formality)
- Weekly challenges rotate every Monday, stored in SQLite

**Constraints**:

- No server-side leaderboard (offline-first conflicts with real-time rankings)
- Badge definitions hardcoded in `gamification.ts` (not user-extensible)

---

### Decision 4: Expo + Expo Router for Development Velocity

**Rationale**:

- Expo provides managed workflow for React Native (OTA updates, build service)
- Expo Router enables file-based routing (Next.js-like developer experience)
- Extensive native module support without manual linking

**Trade-offs**:

- ✅ **Pros**: Faster development, cross-platform by default, robust ecosystem
- ❌ **Cons**: SDK version lock-in, bundle size overhead, ejection complexity

**Implementation**:

- Expo SDK ~54.0, React 19.1, React Native 0.81
- New Architecture enabled (`"newArchEnabled": true`)
- Plugins: expo-router, expo-location, expo-image-picker, expo-notifications

**Constraints**:

- Requires Expo Go for development testing
- EAS Build required for production releases

---

### Decision 5: Supabase for Backend (PostgreSQL + Storage + Edge Functions)

**Rationale**:

- Open-source, self-hostable alternative to Firebase
- Row-Level Security (RLS) provides built-in authorization
- Edge Functions (Deno) enable server-side AI without separate backend

**Trade-offs**:

- ✅ **Pros**: Fast setup, generous free tier, real-time subscriptions, familiar PostgreSQL
- ❌ **Cons**: Vendor lock-in (custom RLS syntax), cold-start latency on Edge Functions

**Implementation**:

- RLS policies enforce `auth.uid() = user_id` for all tables
- Storage bucket `wardrobe-images` with user-scoped policies
- Edge Function `wardrobe-ai` proxies Hugging Face + OpenAI

**Constraints**:

- Free tier limits: 500 MB database, 1 GB storage, 2 GB Edge Function bandwidth/month
- Edge Functions have 30s timeout (sufficient for AI calls)

---

### Decision 6: Colour Analysis via Seasonal Palette Theory

**Rationale**:

- Color harmony significantly impacts outfit aesthetics
- Seasonal palette theory (Spring/Summer/Autumn/Winter) is accessible, non-technical
- Provides actionable guidance without complex color science

**Trade-offs**:

- ✅ **Pros**: Simple user input (skin tone), interpretable scores, culturally familiar
- ❌ **Cons**: Oversimplified color theory, not universally accurate, Western-centric

**Implementation**:

- User selects skin tone during onboarding → mapped to seasonal palette
- Each palette has `bestColours`, `goodColours`, `avoidColours`
- Outfit scoring: `+6` for best, `+3` for good, `-5` for avoid (top/outerwear only)

**Constraints**:

- Palette mappings hardcoded in `colour-analysis.ts`
- No machine learning for color extraction (relies on AI tagging)

---

### Decision 7: SQLite for Local Persistence

**Rationale**:

- Relational data model (wardrobe items, outfit logs) benefits from SQL
- Expo provides `expo-sqlite` with good performance on mobile
- Enables complex queries (repeat detection, analytics) without manual indexing

**Trade-offs**:

- ✅ **Pros**: Mature, queryable, transactional, well-tested
- ❌ **Cons**: Schema migrations manual, no ORM, async API only

**Implementation**:

- Tables: `wardrobe_items`, `outfit_logs`, `capsules`, `gamification_state`, `earned_badges`, `weekly_challenges`
- Indexes on: `(user_id, worn_date)`, `(user_id, outfit_key)`
- Schema migrations via `ALTER TABLE` with `try/catch` (additive only)

**Constraints**:

- No foreign key enforcement (SQLite limitation in Expo)
- JSON columns serialized as strings (parsed on read)

---

## 5. Core Workflows

### Workflow 1: New User Onboarding

```
User opens app for first time
   ↓
Check onboarding_completed in AsyncStorage
   ↓
[Not completed] → Navigate to /onboarding
   ↓
Step 1: Enter name, gender
   ↓
Step 2: Select style preferences (casual, formal, street, ethnic, minimal)
   ↓
Step 3: Select occasion preference (office-heavy, social-heavy, travel-heavy)
   ↓
Step 4: Optional: Enter body shape, skin tone (for colour analysis)
   ↓
Save profile to AsyncStorage
Mark onboarding_completed = true
   ↓
Initialize SQLite database (create tables)
   ↓
[Supabase not configured] Load seed wardrobe data
[Supabase configured] Prompt: "Sign in to enable cloud sync?"
   ↓
Navigate to /(tabs)/index (Today screen)
```

**State Management**:

- Profile stored in AsyncStorage (`profile.ts`)
- Onboarding status checked in `_layout.tsx`
- Seed data loaded by `AppDataProvider` on first render

---

### Workflow 2: Daily Outfit Recommendation

```
User opens Today screen
   ↓
AppDataProvider loads:
   - wardrobe items from SQLite
   - weather from Open-Meteo (or sample data)
   - user profile from AsyncStorage
   ↓
User selects occasion (Office/Party/Date/etc.)
User adjusts day part (Morning/Afternoon/Evening) if needed
   ↓
buildRecommendations(items, profile, {occasion, weather}) called
   ↓
Filter items:
   - category IN (Top, Bottom, Outerwear, Shoes)
   - is_dirty = false
   - seasons matches weather.temperatureC
   - occasions includes selected occasion
   ↓
Generate outfit combinations:
   - Top + Bottom (required)
   - + Outerwear (if temp < 25°C or rain)
   - + Accessory (optional)
   ↓
Score each outfit:
   score = 50 (base)
   + weatherScore (temp match: +10, rain protection: +5)
   + formalityScore (+15 if perfect match, +5 if good)
   + freshnessScore (-1 per day since last worn, max -20)
   + colourScore (seasonal palette: +6 best, +3 good, -5 avoid)
   ↓
Sort outfits by score descending
Return top 4 recommendations
   ↓
Render outfit cards with:
   - Item images in stack
   - Outfit name (e.g., "Smart Office Look")
   - Confidence badge (score/100)
   - Reasons (bullet points)
   - "Mark as Worn" button
```

**Error Handling**:

- Weather API failure → fallback to sample weather (25°C, Sunny)
- No matching items → show "wardrobe gap" insight
- Empty wardrobe → prompt to add first item

---

### Workflow 3: Wardrobe Item Capture + AI Tagging

```
User taps "+" button in Closet screen
   ↓
Permission check: Camera/Photo Library
[Not granted] → Request permission → [Denied] Show error
   ↓
[Camera] Launch camera → Capture photo
[Library] Open gallery → Select photo
   ↓
Infer category from filename (e.g., "shoe" → Shoes)
Generate temp ID (UUID)
   ↓
Insert to local SQLite:
   id: UUID
   name: "Untitled [Category]"
   category: inferred
   imageUrl: local asset URI
   aiStatus: 'idle'
   syncedToCloud: 0
   ↓
Update AppDataProvider state (immediate UI update)
   ↓
[Supabase configured]
   ↓
   Upload image to Storage:
      bucket: wardrobe-images
      path: {userId}/{itemId}.jpg
      ↓
   Insert to wardrobe_items table:
      image_storage_path: {userId}/{itemId}.jpg
      image_url: public CDN URL
      ↓
   Mark syncedToCloud = 1 in SQLite
   ↓
User taps "Analyze with AI" on item card
   ↓
Set aiStatus = 'pending' (show loading spinner)
   ↓
Call supabase.functions.invoke('wardrobe-ai', {
   action: 'analyze-item',
   itemId,
   imageUrl,
   itemName
})
   ↓
Edge Function:
   Fetch image from Storage
   ↓
   Parallel:
      - Hugging Face RMBG-2.0 → segmentation labels
      - OpenAI Responses API → structured JSON:
         {name, category, fit, colours[], pattern, seasons[],
          occasions[], formality, material, confidence, summary}
   ↓
   Return WardrobeAiAnalysis
   ↓
Client receives analysis
   ↓
Update item in SQLite + Supabase:
   aiStatus = 'completed'
   aiConfidence = analysis.confidence
   aiSummary = analysis.summary
   aiTags = {styleNotes, segmentationLabels, backgroundRemovalSuggested}
   name = analysis.name (if non-empty)
   colours = analysis.colours (override manual entry)
   ...all other fields
   ↓
UI shows updated card with AI-generated tags
```

**Error Handling**:

- Permission denied → show inline error + retry button
- Upload failure → item stays local-only, can retry sync later
- AI analysis failure → set `aiStatus = 'failed'`, allow manual tagging

---

### Workflow 4: Outfit Logging + Gamification

```
User taps "Mark as Worn" on recommended outfit
   ↓
Extract itemIds from outfit.items
   ↓
Check for repeat outfit:
   outfitKey = itemIds.sort().join('|')
   Query outfit_logs WHERE user_id = ? AND outfit_key = ?
      AND worn_date >= (today - 14 days)
   ↓
[Repeat found]
   ↓
   Show modal: "You wore this [X] days ago. Log again?"
   [User cancels] → Abort
   [User confirms] → Continue
   ↓
Generate log ID (UUID)
Build item snapshots: [{id, name, category, colours, formality, imageUrl}]
Extract color palette (deduped union of item colours)
Determine dominant formality (highest rank: festive > formal > smart > athleisure > casual)
   ↓
Save to local SQLite outfit_logs:
   id, user_id, worn_date (today), item_ids, outfit_key,
   occasion, temperature_c (from weather),
   weather_condition, location_name,
   item_snapshot, color_palette, formality,
   syncedToCloud: 0
   ↓
Update wardrobe_items for each worn item:
   wear_count += 1
   last_worn_days_ago = 0
   ↓
Gamification processing:
   Award base XP (10)
   ↓
   Update streak:
      IF (last_log_date = yesterday) → current_streak += 1
      ELSE IF (last_log_date < yesterday) → current_streak = 1
      ↓
      IF (current_streak > longest_streak) → longest_streak = current_streak
      ↓
      Award streak bonus XP:
         3 days: +15
         7 days: +25
         14 days: +40
         30 days: +60
   ↓
   Check badge conditions:
      "First Step" (streak_1): IF total logs = 1 → award
      "Three's a Charm" (streak_3): IF current_streak = 3 → award
      ...
      "Occasion Pro" (variety_occasions_4): IF distinct occasions >= 4 → award
   ↓
   For each new badge: award +30 XP
   ↓
   Update weekly challenges:
      "Log 5 outfits this week": progress += 1
      IF (progress >= target) → mark completed, award +50 XP
   ↓
   Recalculate level from total XP:
      level = xpToLevel(xp)
   ↓
   Return GamificationUpdate: {
      xpGained, oldLevel, newLevel,
      newBadges[], completedChallenges[]
   }
   ↓
AppDataProvider sets lastGamificationUpdate (triggers reward modal)
   ↓
[If Supabase configured]
   Push outfit_log to cloud (non-blocking)
   ↓
Set pendingRatingLog = log
   ↓
Render RatingSheet modal:
   "How did you feel in this outfit?"
   Stars: 1-5 (1=hate, 3=neutral, 5=love)
   Optional note field
   ↓
User submits rating
   ↓
Update outfit_log:
   rating = selected stars
   rating_note = user text
   ↓
Award rating XP (+5)
   ↓
[If rating >= 4] Add outfit to "Top Rated" collection for inspiration
   ↓
Dismiss rating sheet
Show reward modal (XP gained, new badges, level up)
```

**State Management**:

- `repeatWarning` state triggers modal
- `pendingRatingLog` state triggers rating sheet
- `lastGamificationUpdate` state triggers reward modal (one render cycle)

---

### Workflow 5: Capsule Wardrobe Creation (10×10 Challenge)

```
User navigates to Planner screen → "New Capsule" button
   ↓
Modal: Select purpose (work/travel/weekend/evening/seasonal/custom)
Enter name and description
   ↓
Item selection UI:
   - Show all wardrobe items
   - Tap to add to capsule (max 40 items)
   - Filter by category
   ↓
User adds 10-15 items
   ↓
Real-time coverage calculation:
   Build valid pairs:
      FOR each Top in capsule
         FOR each Bottom in capsule
            IF formalities compatible (via FORMALITY_COMPAT)
               AND occasions overlap
               → Add (top, bottom) to pairs[]
   ↓
   Build valid triples:
      FOR each (top, bottom) pair
         FOR each Outerwear in capsule
            IF outerwear formality compatible with pair
               → Add (top, bottom, outerwear) to triples[]
   ↓
   totalCombos = pairs.length + triples.length
   coverageScore = min(totalCombos / 30, 1) × 100
   ↓
   Versatility scoring:
      FOR each item
         distinctTops = count unique tops it pairs with
         distinctBottoms = count unique bottoms it pairs with
         itemVersatility = (distinctTops + distinctBottoms) / totalItems
      ↓
      capsuleVersatility = avg(itemVersatility) × 100
   ↓
Display metrics card:
   Coverage: [coverageScore]% (XX outfits possible)
   Versatility: [capsuleVersatility]%
   Occasions covered: [list]
   ↓
[Optional] User toggles "10×10 Challenge" mode
   ↓
   Validation: Exactly 10 items + at least 10 combos possible
   [Failed] → Show error
   [Passed] → Set isChallenge = true, challengeEndDate = today + 10 days
   ↓
Save capsule to SQLite:
   id (UUID), name, purpose, description,
   item_ids (JSON array), is_challenge, challenge_end_date
   ↓
Challenge tracking:
   When user logs outfit → Check if all items in outfit ∈ capsule
   IF yes → Add outfit_key to challengeLoggedOutfitKeys
   ↓
   Challenge progress:
      logged_outfits = challengeLoggedOutfitKeys.length
      target_outfits = 10
      days_remaining = challengeEndDate - today
   ↓
   [Challenge completed] → Award badge "Capsule Champion" (+50 XP)
```

**Suggestions Engine**:

- **Add suggestions**: Items that would increase `coverageScore` most (e.g., neutral bottoms)
- **Remove suggestions**: Items with low `itemVersatility` (e.g., formal dress shoes in casual capsule)

---

### Workflow 6: Weekly Planning

```
User opens Planner screen
   ↓
buildWeeklyPlan(items, profile, weather) called
   ↓
Generate 7-day forecast:
   FOR day in [today...today+6]
      Rotate occasion based on profile.occasionPreference:
         office-heavy: [Office, Office, Office, Casual, Office, Casual, Party]
         social-heavy: [Office, Party, Date, Casual, Party, Casual, Party]
         travel-heavy: [Travel, Casual, Office, Travel, Casual, Casual, Party]
      ↓
      Predict weather (simplified: ±2°C from today, same condition)
      ↓
      Generate top recommendation for (day, occasion, weather)
      ↓
      Add to plan: {day, context, outfit}
   ↓
Render calendar view with outfit cards per day
   ↓
User can:
   - Tap to view details
   - Swap to alternate recommendation
   - Mark as planned (saves to outfit_logs with future worn_date)
```

**Limitations**:

- Weather forecast simplified (no API integration for 7-day forecast)
- Occasion rotation is deterministic (no calendar integration)

---

## 6. Configuration & Environment

### Environment Variables

The app uses environment variables prefixed with `EXPO_PUBLIC_` (exposed to client) or accessed server-side in Edge Functions.

#### Client-Side (Mobile App)

| Variable                        | Purpose                | Required? | Example                   |
| ------------------------------- | ---------------------- | --------- | ------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`      | Supabase project URL   | Optional  | `https://xxx.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous JWT | Optional  | `eyJhbGci...`             |

**Notes**:

- If Supabase variables missing → app runs in local-only mode
- Variables read in `lib/supabase.ts` via `process.env.EXPO_PUBLIC_*`

#### Server-Side (Edge Functions)

| Variable         | Purpose                   | Required for         | Example       |
| ---------------- | ------------------------- | -------------------- | ------------- |
| `OPENAI_API_KEY` | OpenAI API authentication | AI tagging + stylist | `sk-proj-...` |
| `HF_TOKEN`       | Hugging Face API token    | Background removal   | `hf_...`      |

**Notes**:

- Set via Supabase Dashboard → Edge Functions → Secrets
- Missing `HF_TOKEN` → segmentation skipped (non-fatal)
- Missing `OPENAI_API_KEY` → AI features fail with error

### Build Configuration

#### Development

```bash
npm start                # Start Metro bundler
npm run ios              # iOS simulator
npm run android          # Android emulator
npm run web              # Web browser (limited native features)
```

#### Testing

```bash
npm test                 # Run Jest test suite
npm run test:watch       # Watch mode
npm run test:coverage    # Generate coverage report
```

#### Production Build (EAS)

```bash
# Prerequisites: eas-cli installed, logged in
npx eas-cli login
npx eas-cli build --platform ios --profile production
npx eas-cli build --platform android --profile production
```

**EAS Profiles** (from `eas.json`):

- `development`: Development client with internal distribution
- `preview`: Internal testing build
- `production`: App Store/Play Store release (auto-increment version)

### Deployment

#### Supabase Schema Deployment

```bash
# Option 1: Supabase Dashboard
# Paste schema.sql into SQL Editor → Run

# Option 2: Supabase CLI
supabase db reset            # Apply schema.sql
supabase db push             # Push local changes
```

#### Edge Function Deployment

```bash
supabase functions deploy wardrobe-ai
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set HF_TOKEN=hf_...
```

#### Mobile App Deployment

```bash
# iOS: Submit to App Store via EAS
npx eas-cli submit --platform ios

# Android: Submit to Google Play via EAS
npx eas-cli submit --platform android

# Over-The-Air (OTA) Updates (minor changes only)
npx expo publish
```

---

## 7. Development Guide

### Local Setup

#### Prerequisites

- Node.js 18+ (check: `node --version`)
- npm or yarn
- Expo CLI (via npx)
- iOS: Xcode + iOS Simulator (macOS only)
- Android: Android Studio + Android Emulator

#### Installation Steps

```bash
# 1. Clone repository
git clone <repo-url>
cd dress-up

# 2. Install dependencies
npm install

# 3. Create environment file (optional)
cp .env.example .env
# Edit .env with your Supabase credentials (if using cloud features)

# 4. Start development server
npm start

# 5. Press 'i' for iOS simulator, 'a' for Android emulator
```

#### First-Time Database Setup

Local SQLite database auto-initializes on first launch. No manual steps required.

For **Supabase** (optional):

```bash
# 1. Create Supabase project at supabase.com
# 2. Copy Project URL and anon key to .env
# 3. Run schema.sql in Supabase SQL Editor
# 4. Create wardrobe-images storage bucket (if not auto-created)
# 5. Deploy Edge Function (see Deployment section)
```

---

### Testing

#### Running Tests

```bash
# All tests
npm test

# Watch mode (re-run on file change)
npm run test:watch

# Coverage report
npm run test:coverage
```

#### Test Structure

```
__tests__/
├── wardrobe.test.ts          # Core recommendation logic
├── weather.test.ts           # Weather API client
└── ai.test.ts                # AI service integration
```

**Testing Strategy**:

- **Unit tests**: Domain logic (`lib/` modules)
- **Mocks**: External APIs (Supabase, OpenAI) mocked via `jest.mock()`
- **Coverage target**: 70%+ for `lib/` modules

#### Adding a New Test

```typescript
// __tests__/capsule.test.ts
import { buildPairs, computeCoverageScore } from "@/lib/capsule";
import type { WardrobeItem } from "@/lib/wardrobe";

describe("Capsule Coverage", () => {
  it("should calculate correct pair count", () => {
    const items: WardrobeItem[] = [
      { category: "Top", formality: "casual", occasions: ["Casual"] },
      { category: "Bottom", formality: "casual", occasions: ["Casual"] },
    ];

    const pairs = buildPairs(items);
    expect(pairs).toHaveLength(1);
  });
});
```

---

### Debugging

#### React Native Debugger

```bash
# Enable remote debugging
# Shake device → "Debug" → Opens Chrome DevTools

# OR use standalone React Native Debugger app
brew install --cask react-native-debugger
open "rndebugger://set-debugger-loc?host=localhost&port=8081"
```

#### Logging Best Practices

```typescript
// Development logging
if (__DEV__) {
  console.log("[Weather] Fetched data:", data);
}

// Production error tracking (future: integrate Sentry)
try {
  await riskyOperation();
} catch (error) {
  console.error("[AI] Analysis failed:", error);
  // TODO: Send to error tracking service
}
```

#### Common Issues

| Issue                          | Solution                      |
| ------------------------------ | ----------------------------- |
| "Metro bundler not found"      | Run `npm start` first         |
| "Database locked"              | Close app completely, restart |
| "Supabase RLS policy violated" | Check auth token is valid     |
| "Image upload fails silently"  | Check Storage bucket policies |

---

### Coding Conventions

#### TypeScript

- **Strict mode enabled** (`"strict": true` in tsconfig.json)
- Use `type` for object shapes, `interface` for extensible contracts
- Avoid `any`; use `unknown` with type guards

#### File Naming

- **Screens**: PascalCase (`ProfileScreen.tsx` → exported from `profile.tsx`)
- **Lib modules**: kebab-case (`outfit-log.ts`)
- **Components**: PascalCase (`OutfitCard.tsx`)

#### Component Structure

```typescript
// 1. Imports (external → internal → types)
import { useState } from 'react';
import { View, Text } from 'react-native';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { WardrobeItem } from '@/lib/wardrobe';

// 2. Types (interfaces, types, constants)
interface Props {
  item: WardrobeItem;
  onPress: () => void;
}

// 3. Component
export function ItemCard({ item, onPress }: Props) {
  const [expanded, setExpanded] = useState(false);
  const textColor = useThemeColor({}, 'text');

  return (
    <View>
      <Text style={{ color: textColor }}>{item.name}</Text>
    </View>
  );
}

// 4. Styles (StyleSheet at bottom)
const styles = StyleSheet.create({
  container: { padding: 16 },
});
```

#### State Management

- **Local state**: `useState` for component-specific UI state
- **Global state**: `AppDataProvider` for cross-screen data
- **Derived state**: Prefer memoization (`useMemo`) over storing in state

---

### Adding a New Feature

#### Example: Add "Favorite Outfits" Collection

**Step 1: Update Database Schema**

```typescript
// lib/local-db.ts
await dbInstance.execAsync(`
  CREATE TABLE IF NOT EXISTS favorite_outfits (
    outfit_key TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);
```

**Step 2: Add Domain Logic**

```typescript
// lib/outfit-log.ts
export async function toggleFavoriteOutfit(outfitKey: string) {
  const db = await initDb();
  const existing = await db.getFirstAsync(
    "SELECT * FROM favorite_outfits WHERE outfit_key = ?",
    [outfitKey],
  );

  if (existing) {
    await db.runAsync("DELETE FROM favorite_outfits WHERE outfit_key = ?", [
      outfitKey,
    ]);
  } else {
    await db.runAsync("INSERT INTO favorite_outfits (outfit_key) VALUES (?)", [
      outfitKey,
    ]);
  }
}
```

**Step 3: Update Provider**

```typescript
// providers/app-data-provider.tsx
const [favoriteOutfits, setFavoriteOutfits] = useState<string[]>([]);

const loadFavorites = async () => {
  const db = await initDb();
  const rows = await db.getAllAsync('SELECT outfit_key FROM favorite_outfits');
  setFavoriteOutfits(rows.map(r => r.outfit_key));
};

// Expose in context value
favoriteOutfits,
toggleFavorite: async (key: string) => {
  await toggleFavoriteOutfit(key);
  await loadFavorites();
},
```

**Step 4: Update UI**

```typescript
// app/(tabs)/index.tsx
const { favoriteOutfits, toggleFavorite } = useAppData();

<Pressable onPress={() => toggleFavorite(heroOutfit.id)}>
  <MaterialIcons
    name={favoriteOutfits.includes(heroOutfit.id) ? 'favorite' : 'favorite-border'}
    size={24}
  />
</Pressable>
```

**Step 5: Add Tests**

```typescript
// __tests__/outfit-log.test.ts
describe("toggleFavoriteOutfit", () => {
  it("should add outfit to favorites", async () => {
    await toggleFavoriteOutfit("outfit_123");
    const favorites = await getFavoriteOutfits();
    expect(favorites).toContain("outfit_123");
  });
});
```

---

## 8. Non-Functional Aspects

### Performance Considerations

#### Recommendation Engine

- **Optimization**: Combinations generated lazily (don't build full cartesian product)
- **Bottleneck**: Large wardrobes (100+ items) → O(n²) for pairs
- **Mitigation**:
  - Pre-filter by season/occasion before pairing
  - Limit to top 50 most-worn items for daily recommendations
  - Future: Memoize scores for unchanged items

#### Image Handling

- **Optimization**: `expo-image` provides automatic caching + lazy loading
- **Bottleneck**: Large images (> 2MB) slow uploads
- **Mitigation**:
  - Compress images client-side before upload (ImageManipulator)
  - Future: Generate thumbnails via Edge Function

#### SQLite Queries

- **Optimization**: Indexes on `(user_id, worn_date)` and `(user_id, outfit_key)`
- **Bottleneck**: Outfit calendar queries (scanning full month)
- **Mitigation**:
  - Paginate calendar (load month on demand)
  - Consider materialized view for analytics

---

### Security Considerations

#### Data Privacy

- **Threat**: Sensitive photos (body images) leaked via insecure storage
- **Mitigation**:
  - Local SQLite encrypted at device level (OS-managed)
  - Supabase Storage uses RLS: `owner = auth.uid()`
  - Images never shared with 3rd parties (OpenAI receives URLs, not direct data)

#### Authentication

- **Threat**: Account hijacking via weak passwords
- **Mitigation**:
  - Passwordless OTP (magic link) via Supabase Auth
  - JWT tokens auto-refresh (15min expiry, 7-day refresh window)
  - No password storage required

#### API Key Exposure

- **Threat**: API keys leaked in client bundle
- **Mitigation**:
  - OpenAI/Hugging Face keys stored in Supabase Edge Function secrets (server-side only)
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY` is rate-limited + RLS-protected (safe to expose)

#### Row-Level Security (RLS)

All Supabase tables enforce:

```sql
-- Example: wardrobe_items table
CREATE POLICY "Users can view their own items"
  ON wardrobe_items FOR SELECT
  USING (auth.uid() = user_id);
```

**Coverage**:

- ✅ `profiles`, `wardrobe_items`, `outfit_logs` protected
- ✅ Storage bucket `wardrobe-images` protected
- ⚠️ Local SQLite has no user isolation (single-device assumption)

---

### Scalability & Reliability

#### Current Limitations

- **Wardrobe size**: Algorithm degrades above ~200 items per user
- **Offline logs**: No conflict resolution (last-write-wins on sync)
- **Edge Function**: 30s timeout insufficient for batch AI operations

#### Scaling Strategies (Future)

| Bottleneck             | Solution                                         |
| ---------------------- | ------------------------------------------------ |
| Large wardrobes        | Implement pagination + virtual scrolling         |
| Recommendation latency | Pre-compute top outfits nightly (background job) |
| Image storage costs    | CDN with aggressive caching (Cloudflare R2)      |
| Edge Function timeouts | Queue-based processing (Redis + worker threads)  |

#### Reliability Measures

- **Offline-first**: App functional without network
- **Graceful degradation**: Missing APIs → fallback to local data
- **Error boundaries**: React Error Boundary wraps all screens
- **Retry logic**: Failed Supabase writes retried on next app launch

---

### Logging & Monitoring

#### Current State

- **Client logging**: `console.log` in development, suppressed in production
- **Server logging**: Edge Function logs in Supabase Dashboard
- **Analytics**: None (future: Expo Analytics or PostHog)

#### Future Enhancements

- **Error tracking**: Integrate Sentry for crash reporting
- **Performance monitoring**: Expo Performance API + Firebase Performance
- **User analytics**: Track feature usage (outfit logs, AI requests) for product insights

---

## 9. Limitations & Known Gaps

### Technical Limitations

1. **No multi-device sync conflict resolution**
   - Last-write-wins approach; simultaneous edits from 2 devices → data loss
   - **Workaround**: Show "last synced" timestamp, warn on stale data

2. **Weather forecast limited to current day**
   - Weekly planner uses extrapolated weather (±2°C from today)
   - **Fix**: Integrate OpenWeatherMap 7-day forecast API

3. **AI tagging requires cloud configuration**
   - Local-only mode has no AI features (manual tagging only)
   - **Alternative**: Run local LLM (too resource-intensive for mobile)

4. **No social features**
   - Outfit sharing exports image only (no in-app feed)
   - **Future**: Add social graph, outfit likes, style inspiration feed

5. **Limited accessibility**
   - No VoiceOver/TalkBack optimization for vision-impaired users
   - **Fix**: Add ARIA labels, test with accessibility scanner

---

### Functional Gaps

1. **Capsule wardrobe suggestions incomplete**
   - Coverage algorithm doesn't account for color blocking or texture mixing
   - **Enhancement**: Add visual similarity scoring (ML-based)

2. **Gamification lacks social proof**
   - No leaderboards or friend comparisons
   - **Blocker**: Conflicts with offline-first architecture (needs real-time sync)

3. **Outfit calendar missing edit functionality**
   - Logged outfits can't be modified (delete + re-add only)
   - **Fix**: Add "Edit Outfit" modal on calendar tap

4. **No budget tracking**
   - `purchasePrice` field exists but no cost-per-wear analytics UI
   - **Enhancement**: Add "Wardrobe Value" screen with ROI charts

5. **Weather API fallback too simplistic**
   - Sample weather (25°C, Sunny) doesn't reflect user's actual climate
   - **Fix**: Prompt user to set default location in onboarding

---

### Technical Debt

1. **Database migrations are manual**
   - Schema changes require `ALTER TABLE` in `initDb()` with try/catch
   - **Risk**: Silent failures; old clients on outdated schema
   - **Solution**: Adopt migration library (e.g., Expo SQLite Migrations)

2. **Type definitions out of sync with Supabase schema**
   - `types/supabase.ts` generated manually, not auto-updated
   - **Risk**: Runtime errors on schema changes
   - **Solution**: Auto-generate types via Supabase CLI in pre-commit hook

3. **Hard-coded enum mappings**
   - Formality targets, season temp ranges, palette colors baked into code
   - **Maintenance burden**: Changes require code deploy
   - **Solution**: Move to config JSON or Supabase tables

4. **No integration tests**
   - Only unit tests for `lib/` modules; no E2E tests
   - **Risk**: UI regressions undetected until manual QA
   - **Solution**: Add Detox or Maestro for E2E flows

---

### Missing Documentation

1. **Edge Function API contract undefined**
   - No OpenAPI spec for `wardrobe-ai` endpoint
   - **Impact**: Client-server assumptions can drift
   - **Fix**: Add JSDoc comments + generate docs

2. **Supabase RLS policies not audited**
   - No formal security review of policy logic
   - **Risk**: Data leaks via policy bugs
   - **Fix**: Security checklist + penetration test

3. **Expo OTA update strategy undocumented**
   - No guidelines on when to use OTA vs full build
   - **Impact**: Accidental breaking changes via OTA
   - **Fix**: Add release process doc

---

### Open Questions for Maintainers

1. **Should we support web platform long-term?**
   - Current web support limited (no camera, location)
   - Decision: PWA with fallbacks OR mobile-only

2. **How to handle GDPR right-to-deletion?**
   - Users can delete Supabase account, but local SQLite persists
   - Decision: Add "Clear All Data" button + privacy policy update

3. **Should capsule wardrobes sync to Supabase?**
   - Currently local-only (`capsules` table not in schema.sql)
   - Decision: Add cloud sync OR document as local-only feature

4. **What's the AI cost ceiling per user?**
   - OpenAI Responses API ~$0.01 per item analysis
   - Decision: Rate limit (X analyses/day) OR charge subscription

5. **Should we support multiple profiles per device?**
   - Currently single-user assumption (no login on local-only mode)
   - Decision: Add profile switcher OR stay single-user

---

## 10. Appendix

### Glossary

| Term                         | Definition                                                                         |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| **Wardrobe Item**            | A single piece of clothing with metadata (category, colors, formality, etc.)       |
| **Outfit**                   | A combination of 2-4 wardrobe items (Top + Bottom + optional Outerwear/Accessory)  |
| **Outfit Log**               | A record of wearing an outfit on a specific date (used for tracking and analytics) |
| **Capsule Wardrobe**         | A curated collection of 10-40 items designed to maximize outfit variety            |
| **10×10 Challenge**          | A capsule wardrobe challenge: create 10 outfits from 10 items in 10 days           |
| **Formality**                | Style level of clothing (casual, smart, formal, festive, athleisure)               |
| **Seasonal Palette**         | Color theory categorization (Spring/Summer/Autumn/Winter) based on skin tone       |
| **Cost-Per-Wear (CPW)**      | Purchase price divided by wear count (lower = better value)                        |
| **Repeat Warning**           | Alert shown when logging an outfit worn within past 14 days                        |
| **XP (Experience Points)**   | Gamification currency earned through app engagement                                |
| **Streak**                   | Consecutive days with outfit logs (resets if a day is skipped)                     |
| **Badge**                    | One-time achievement award (e.g., "3-Day Streak", "Occasion Pro")                  |
| **Weekly Challenge**         | Time-limited goal that resets every Monday (e.g., "Log 5 outfits this week")       |
| **RLS (Row-Level Security)** | Supabase PostgreSQL feature enforcing user-scoped data access                      |
| **Edge Function**            | Server-side Deno function (runs on Supabase infrastructure)                        |
| **OTA Update**               | Over-The-Air update (JavaScript bundle pushed without app store review)            |

---

### Key Assumptions

1. **Single-user per device**: Local SQLite has no user_id filtering (assumes device = user)
2. **English-only**: No i18n support; all strings hardcoded in English
3. **Temperature in Celsius**: No Fahrenheit option (assumes global audience outside US)
4. **Static seasonal palette**: No machine learning for color extraction; relies on AI tagging
5. **No multi-region support**: Weather API uses device location (no manual city override)
6. **Supabase is optional**: All core features work without cloud backend

---

### Technology Stack Summary

| Layer                  | Technology                          | Version    |
| ---------------------- | ----------------------------------- | ---------- |
| **Frontend Framework** | React Native                        | 0.81.5     |
| **React**              | React                               | 19.1.0     |
| **Metaframework**      | Expo                                | ~54.0      |
| **Routing**            | Expo Router                         | ~6.0       |
| **UI Components**      | React Native                        | 0.81.5     |
| **Icons**              | @expo/vector-icons                  | ^15.0      |
| **Image Handling**     | expo-image                          | ~3.0       |
| **Navigation**         | @react-navigation                   | ^7.1       |
| **Backend (Optional)** | Supabase                            | SDK ^2.104 |
| **Database (Local)**   | SQLite (expo-sqlite)                | 14.x       |
| **Storage (Local)**    | AsyncStorage                        | 2.2.0      |
| **Location Services**  | expo-location                       | ~19.0      |
| **Camera/Gallery**     | expo-image-picker                   | ~17.0      |
| **Notifications**      | expo-notifications                  | ~0.32      |
| **AI (Server)**        | OpenAI Responses API                | Latest     |
| **Image AI (Server)**  | Hugging Face RMBG-2.0               | Latest     |
| **Weather API**        | Open-Meteo                          | Free tier  |
| **Language**           | TypeScript                          | ~5.9.2     |
| **Testing**            | Jest + React Native Testing Library | ^29.5      |
| **Build Service**      | EAS Build                           | Latest     |

---

### File Size Statistics

| Category         | Count | Notes                                                |
| ---------------- | ----- | ---------------------------------------------------- |
| Screens          | 11    | Tab screens + auth + onboarding                      |
| Lib Modules      | 16    | Domain logic (framework-agnostic)                    |
| Components       | 15    | Reusable UI widgets                                  |
| Database Tables  | 6     | SQLite local schema                                  |
| Supabase Tables  | 3     | Cloud schema (profiles, wardrobe_items, outfit_logs) |
| TypeScript Types | 40+   | Interfaces + type aliases across codebase            |

---

### API Endpoints Reference

#### Supabase Edge Functions

##### POST `/functions/v1/wardrobe-ai`

**Action: analyze-item**

Request:

```json
{
  "action": "analyze-item",
  "itemId": "uuid",
  "imageUrl": "https://...",
  "itemName": "Blue shirt"
}
```

Response:

```json
{
  "name": "Navy Cotton Dress Shirt",
  "category": "Top",
  "subcategory": "Shirt",
  "fit": "slim",
  "sleeve": "long",
  "colours": ["navy", "white"],
  "pattern": "solid",
  "seasons": ["all-season"],
  "occasions": ["Office", "Date"],
  "formality": "smart",
  "material": "cotton",
  "confidence": 0.92,
  "summary": "A classic navy dress shirt with a modern slim fit...",
  "styleNotes": ["Versatile office staple", "Pair with chinos or dress pants"],
  "segmentationLabels": ["shirt", "collar"],
  "backgroundRemovalSuggested": true
}
```

**Action: generate-outfit**

Request:

```json
{
  "action": "generate-outfit",
  "profile": { "name": "...", "gender": "Woman", ... },
  "items": [ { "id": "...", "name": "...", ... } ],
  "occasion": "Office",
  "weather": { "temperatureC": 22, "condition": "Sunny", ... }
}
```

Response:

```json
{
  "headline": "Smart Casual Office Look",
  "confidence": 0.88,
  "summary": "This outfit balances professionalism with comfort...",
  "reasons": [
    "Weather-appropriate for 22°C",
    "Formality matches office setting",
    "Color palette is harmonious"
  ],
  "primaryItemIds": ["uuid1", "uuid2", "uuid3"],
  "backupOptions": [
    {
      "itemIds": ["uuid4", "uuid2", "uuid5"],
      "reason": "Slightly more formal alternative"
    }
  ],
  "accessorySuggestion": "Add a leather belt to elevate the look",
  "stylistNote": "This combination is perfect for client meetings."
}
```

---

### Database Schema Diagrams

#### SQLite (Local)

```
┌─────────────────────────┐
│   wardrobe_items        │
├─────────────────────────┤
│ id (PK)                 │
│ name                    │
│ category                │
│ subcategory             │
│ fit                     │
│ colours (JSON array)    │
│ seasons (JSON array)    │
│ formality               │
│ last_worn_days_ago      │
│ wear_count              │
│ is_dirty                │
│ ai_status               │
│ synced_to_cloud         │
└─────────────────────────┘
           │
           │ worn in
           ↓
┌─────────────────────────┐
│   outfit_logs           │
├─────────────────────────┤
│ id (PK)                 │
│ user_id                 │
│ worn_date               │
│ item_ids (JSON array)   │
│ outfit_key (computed)   │
│ occasion                │
│ temperature_c           │
│ item_snapshot (JSON)    │
│ rating                  │
│ synced_to_cloud         │
└─────────────────────────┘
           │
           │ tracked in
           ↓
┌─────────────────────────┐
│   gamification_state    │
├─────────────────────────┤
│ id (singleton)          │
│ xp                      │
│ level                   │
│ current_streak          │
│ longest_streak          │
│ last_log_date           │
└─────────────────────────┘
```

#### Supabase (Cloud)

```
┌─────────────────────────┐
│   auth.users (managed)  │
├─────────────────────────┤
│ id (PK)                 │
│ email                   │
└─────────────────────────┘
           │
           │ owns
           ↓
┌─────────────────────────┐      ┌─────────────────────────┐
│   profiles              │      │   wardrobe_items        │
├─────────────────────────┤      ├─────────────────────────┤
│ id (PK, FK)             │      │ id (PK)                 │
│ name                    │      │ user_id (FK)            │
│ gender                  │      │ name                    │
│ style_preferences       │◄────┤ category                │
│ occasion_preference     │      │ image_storage_path      │
│ onboarding_completed    │      │ ai_tags (JSONB)         │
└─────────────────────────┘      └─────────────────────────┘
                                            │
                                            │ logged in
                                            ↓
                                 ┌─────────────────────────┐
                                 │   outfit_logs           │
                                 ├─────────────────────────┤
                                 │ id (PK)                 │
                                 │ user_id (FK)            │
                                 │ worn_date               │
                                 │ item_ids (array)        │
                                 │ item_snapshot (JSONB)   │
                                 │ rating                  │
                                 └─────────────────────────┘
```

---

### Related Resources

- **Expo Documentation**: https://docs.expo.dev
- **Supabase Documentation**: https://supabase.com/docs
- **React Navigation**: https://reactnavigation.org
- **Open-Meteo API**: https://open-meteo.com
- **OpenAI Responses API**: https://platform.openai.com/docs/api-reference/responses
- **Seasonal Color Theory**: https://theconceptwardrobe.com/colour-analysis-comprehensive-guides

---

### License & Attribution

**Project**: AI Wardrobe Expo (Private/Commercial)  
**Stack**: Expo, Supabase, OpenAI, Hugging Face  
**No external code dependencies requiring attribution** (all open-source licenses MIT/Apache-2.0 compatible)

---

**Document Version**: 1.0  
**Last Updated**: 2 May 2026  
**Authors**: Technical Documentation Team  
**Maintained By**: Engineering Team
