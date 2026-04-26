# AI Wardrobe Expo

AI Wardrobe Expo is an Expo Router mobile app for building a privacy-first wardrobe assistant. It combines:

- wardrobe capture from camera or gallery
- live location-aware weather
- rule-based local outfit recommendations
- optional Supabase-backed wardrobe storage
- server-side AI tagging and styling with Hugging Face and OpenAI

The app is designed to keep working even when the backend is not configured. In that case, it falls back to local sample wardrobe data and local-only uploads.

## Product Scope

Current app experience includes:

- `Today`
  Weather-aware outfit recommendations
  AI stylist trigger for structured outfit reasoning

- `Closet`
  Search and filter wardrobe items
  Camera and gallery import
  AI tagging trigger per item

- `Planner`
  Weekly planning and trip packing preview

- `Profile`
  Profile, integration, and privacy states

## Tech Stack

- `Expo` / `React Native`
- `Expo Router`
- `Supabase`
  Postgres
  Storage
  Edge Functions
- `Open-Meteo`
  live weather
- `Hugging Face Inference API`
  segmentation/background-removal signals
- `OpenAI Responses API`
  structured wardrobe tagging and AI stylist output

## Project Structure

- [app/(tabs)/index.tsx](/Users/psoni24/Documents/Practice/ReactNative/dress-up/app/(tabs)/index.tsx)
  Today screen
- [app/(tabs)/explore.tsx](/Users/psoni24/Documents/Practice/ReactNative/dress-up/app/(tabs)/explore.tsx)
  Closet screen
- [app/(tabs)/planner.tsx](/Users/psoni24/Documents/Practice/ReactNative/dress-up/app/(tabs)/planner.tsx)
  Planner screen
- [app/(tabs)/profile.tsx](/Users/psoni24/Documents/Practice/ReactNative/dress-up/app/(tabs)/profile.tsx)
  Profile screen
- [providers/app-data-provider.tsx](/Users/psoni24/Documents/Practice/ReactNative/dress-up/providers/app-data-provider.tsx)
  shared state for wardrobe, weather, uploads, and AI calls
- [lib/wardrobe.ts](/Users/psoni24/Documents/Practice/ReactNative/dress-up/lib/wardrobe.ts)
  core wardrobe models and local recommendation logic
- [lib/weather.ts](/Users/psoni24/Documents/Practice/ReactNative/dress-up/lib/weather.ts)
  location and weather integration
- [lib/ai.ts](/Users/psoni24/Documents/Practice/ReactNative/dress-up/lib/ai.ts)
  client-side AI calls
- [lib/supabase.ts](/Users/psoni24/Documents/Practice/ReactNative/dress-up/lib/supabase.ts)
  Supabase client setup
- [lib/supabase-wardrobe.ts](/Users/psoni24/Documents/Practice/ReactNative/dress-up/lib/supabase-wardrobe.ts)
  wardrobe persistence helpers
- [supabase/schema.sql](/Users/psoni24/Documents/Practice/ReactNative/dress-up/supabase/schema.sql)
  database and storage policies
- [supabase/functions/wardrobe-ai/index.ts](/Users/psoni24/Documents/Practice/ReactNative/dress-up/supabase/functions/wardrobe-ai/index.ts)
  Hugging Face + OpenAI Edge Function
- [.env.example](/Users/psoni24/Documents/Practice/ReactNative/dress-up/.env.example)
  environment template

## Prerequisites

Before running the full stack, make sure you have:

- Node.js installed
- npm installed
- Expo CLI support through `npx expo`
- a Supabase project
- optionally, Supabase CLI if you want to deploy functions locally or from terminal
- an OpenAI API key
- a Hugging Face token with inference access

## Environment Variables

Copy the example file:

```bash
cp .env.example .env
```

The project currently references these variables:

### Expo public client variables

These are read in the mobile app:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
EXPO_PUBLIC_WEATHERAPI_KEY=your-weatherapi-key
```

`EXPO_PUBLIC_WEATHERAPI_KEY` is optional. If it is present, the app uses `WeatherAPI.com` as the primary real-time provider. If it is missing or the request fails, the app falls back to `Open-Meteo`.

### Supabase Edge Function secrets

These are not read from the mobile app directly. They should be configured as Supabase Edge Function secrets:

```env
OPENAI_API_KEY=your-openai-api-key
HF_TOKEN=your-huggingface-token
OPENAI_VISION_MODEL=gpt-5.4-mini
OPENAI_STYLIST_MODEL=gpt-5.4-mini
```

Notes:

- `EXPO_OS` appears in the codebase, but Expo injects it automatically at runtime.
- Do not expose `OPENAI_API_KEY` or `HF_TOKEN` to the mobile client.

## Local App Setup

1. Install dependencies

```bash
npm install
```

2. Copy env values

```bash
cp .env.example .env
```

3. Fill in:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

4. Start the app

```bash
npx expo start
```

If you stop here, the app will still run. Weather and uploads work, and the app falls back to local wardrobe data when the Supabase setup is incomplete.

## Supabase Setup

### 1. Apply the schema

Open the Supabase SQL editor and run:

- [supabase/schema.sql](/Users/psoni24/Documents/Practice/ReactNative/dress-up/supabase/schema.sql)

This creates:

- `public.wardrobe_items`
- row-level security policies
- `wardrobe-images` storage bucket
- storage access policies
- AI metadata columns such as `ai_status`, `ai_confidence`, `ai_summary`, and `ai_tags`

### 2. Configure Edge Function secrets

Set the function secrets in your Supabase project:

```bash
supabase secrets set OPENAI_API_KEY=your-openai-key
supabase secrets set HF_TOKEN=your-huggingface-token
supabase secrets set OPENAI_VISION_MODEL=gpt-5.4-mini
supabase secrets set OPENAI_STYLIST_MODEL=gpt-5.4-mini
```

### 3. Deploy the AI function

```bash
supabase functions deploy wardrobe-ai
```

If you use the Supabase CLI locally, you can also serve functions during development using your normal Supabase workflow.

## AI Integration Flow

### Closet item AI tagging

When a user uploads an item and taps `AI tag`:

1. The mobile app sends the selected wardrobe item to the Supabase Edge Function.
2. The Edge Function sends the image to Hugging Face for segmentation/background-removal signals.
3. The same function sends the image to OpenAI using the Responses API with image input.
4. OpenAI returns structured metadata using a strict JSON schema.
5. The client merges the AI result into the wardrobe item.
6. If the item exists in Supabase, the enriched item is written back to `wardrobe_items`.

The AI result currently enriches:

- name
- category
- subcategory
- fit
- sleeve
- colours
- pattern
- seasons
- occasions
- formality
- material
- AI confidence
- AI summary
- AI style notes
- Hugging Face segmentation labels

### AI stylist recommendations

When a user taps `Run AI stylist` on the Today screen:

1. The mobile app sends:
   profile
   wardrobe items
   selected occasion
   current weather
2. The Supabase Edge Function calls OpenAI with structured output constraints.
3. OpenAI returns:
   headline
   confidence
   summary
   reasons
   primary wardrobe item ids
   backup combinations
   accessory suggestion
   stylist note
4. The app renders the structured recommendation on the Today screen.

## Weather Integration

Weather uses:

- `expo-location` for device coordinates
- reverse geocoding for a readable location name
- `WeatherAPI.com` as the primary provider when `EXPO_PUBLIC_WEATHERAPI_KEY` is configured
- `Open-Meteo` as the fallback provider when no key is present or the primary request fails

The app uses current weather to influence:

- warm-weather fabric preference
- rain-safe shoe suggestions
- layering guidance
- daily outfit recommendation context

## Upload Flow

Closet uploads currently support:

- camera capture
- photo library import

When a photo is selected:

1. the app asks for permission
2. it creates a draft wardrobe item locally
3. if Supabase is configured, it uploads the image to storage and inserts the metadata row
4. if Supabase is unavailable, it keeps the item locally in the running app session

## What Works Today

- location-based weather refresh
- provider fallback from `WeatherAPI.com` to `Open-Meteo`
- camera and gallery wardrobe capture
- Supabase storage upload for wardrobe images
- Supabase wardrobe item persistence
- local rule-based recommendation engine
- Hugging Face plus OpenAI AI analysis trigger from Closet
- OpenAI AI stylist trigger from Today
- fallback behavior when remote services are unavailable

## Current Limitations

- The app does not yet implement full Supabase authentication.
- The current RLS/storage policies assume authenticated users, so true per-user cloud persistence is not complete yet.
- Without auth or env keys, uploads fall back to local-only session state.
- The Edge Function must be deployed before AI buttons work.
- Hugging Face signals are used for metadata enrichment, but the app does not yet render an extracted transparent cutout image.
- AI tagging currently updates metadata, but there is no manual review/edit form yet.
- AI outfit recommendations are additive to the local rule engine, not a full replacement.

## Recommended Next Steps

Best next implementation steps:

1. Add Supabase auth for real signed-in user storage.
2. Add item edit forms so users can correct AI tags.
3. Render background-removed cutout previews in the Closet UI.
4. Persist feedback signals and use them in AI stylist prompts or ranking.
5. Add batch upload and batch AI analysis.

## Troubleshooting

### App runs but cloud sync does not

Check:

- `.env` exists
- `EXPO_PUBLIC_SUPABASE_URL` is correct
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` is correct
- if you want the keyed provider, `EXPO_PUBLIC_WEATHERAPI_KEY` is correct

### AI buttons fail

Check:

- the Supabase Edge Function is deployed
- `OPENAI_API_KEY` is set in Supabase secrets
- `HF_TOKEN` is set in Supabase secrets
- the item has an `imageUrl`

### Weather falls back to sample data

Check:

- location permissions are granted
- device networking is available
- `WeatherAPI.com` is reachable when the key is configured
- `Open-Meteo` is reachable for fallback

### Upload works locally but not in Supabase

Check:

- storage bucket exists
- schema has been applied
- your current auth model matches the RLS policies

## Verification

Last verified in this repo with:

```bash
npm run lint
npx tsc --noEmit
```

## References

- OpenAI Responses API
  https://platform.openai.com/docs/api-reference/responses/retrieve
- OpenAI Structured Outputs
  https://platform.openai.com/docs/guides/structured-outputs
- OpenAI Images and Vision
  https://platform.openai.com/docs/guides/images-vision
- OpenAI model guide
  https://developers.openai.com/api/docs/models
- WeatherAPI docs
  https://www.weatherapi.com/docs/
- Hugging Face image segmentation
  https://huggingface.co/docs/api-inference/tasks/image-segmentation
