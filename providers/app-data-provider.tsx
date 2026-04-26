import * as ImagePicker from 'expo-image-picker';
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';

import { analyzeWardrobeItemWithAi, mergeAiAnalysisIntoWardrobeItem } from '@/lib/ai';
import { isSupabaseConfigured } from '@/lib/supabase';
import {
  listWardrobeItemsFromSupabase,
  updateWardrobeItemInSupabase,
  uploadWardrobeItemToSupabase,
} from '@/lib/supabase-wardrobe';
import { getCurrentWeather } from '@/lib/weather';
import { todayWeather, wardrobeItems, type Category, type WardrobeItem, type WeatherSnapshot } from '@/lib/wardrobe';

type UploadSource = 'camera' | 'library';
type WardrobeSource = 'seed' | 'supabase' | 'local-fallback';

interface AppDataContextValue {
  items: WardrobeItem[];
  weather: WeatherSnapshot;
  isWeatherLoading: boolean;
  weatherError: string | null;
  isWardrobeLoading: boolean;
  isUploading: boolean;
  analyzingItemId: string | null;
  wardrobeSource: WardrobeSource;
  supabaseConfigured: boolean;
  lastSyncMessage: string | null;
  refreshWeather: () => Promise<void>;
  refreshWardrobe: () => Promise<void>;
  addItemFromCamera: () => Promise<void>;
  addItemFromLibrary: () => Promise<void>;
  analyzeItemWithAi: (itemId: string) => Promise<void>;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

function inferCategoryFromName(filename: string): {
  category: Category;
  subcategory: string;
  occasions: WardrobeItem['occasions'];
  formality: WardrobeItem['formality'];
} {
  const normalized = filename.toLowerCase();

  if (normalized.includes('shoe') || normalized.includes('sneaker')) {
    return {
      category: 'Shoes',
      subcategory: 'Shoes',
      occasions: ['Casual', 'Travel'],
      formality: 'casual',
    };
  }

  if (normalized.includes('jacket') || normalized.includes('blazer')) {
    return {
      category: 'Outerwear',
      subcategory: 'Jacket',
      occasions: ['Office', 'Travel'],
      formality: 'smart',
    };
  }

  if (normalized.includes('pant') || normalized.includes('jean') || normalized.includes('trouser')) {
    return {
      category: 'Bottom',
      subcategory: 'Trousers',
      occasions: ['Office', 'Casual', 'Travel'],
      formality: 'smart',
    };
  }

  return {
    category: 'Top',
    subcategory: normalized.includes('kurta') ? 'Kurta' : 'Shirt',
    occasions: ['Office', 'Casual', 'Travel'],
    formality: 'smart',
  };
}

function createDraftWardrobeItem(
  asset: ImagePicker.ImagePickerAsset,
  source: UploadSource
): WardrobeItem {
  const filename = asset.fileName ?? asset.uri.split('/').pop() ?? `upload-${Date.now()}.jpg`;
  const inferred = inferCategoryFromName(filename);
  const fallbackLabel = filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
  const title = fallbackLabel
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  return {
    id: `local-${Date.now()}`,
    name: title || 'New wardrobe upload',
    category: inferred.category,
    subcategory: inferred.subcategory,
    fit: 'regular',
    sleeve: inferred.category === 'Top' || inferred.category === 'Outerwear' ? 'long' : undefined,
    colours: ['beige'],
    pattern: 'solid',
    seasons: ['all-season'],
    occasions: inferred.occasions,
    formality: inferred.formality,
    material: inferred.category === 'Outerwear' ? 'cotton blend' : 'cotton',
    lastWornDaysAgo: 99,
    wearCount: 0,
    favorite: false,
    imageUrl: asset.uri,
    source,
    aiStatus: 'idle',
  };
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<WardrobeItem[]>(wardrobeItems);
  const [weather, setWeather] = useState<WeatherSnapshot>(todayWeather);
  const [isWeatherLoading, setIsWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [isWardrobeLoading, setIsWardrobeLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [analyzingItemId, setAnalyzingItemId] = useState<string | null>(null);
  const [wardrobeSource, setWardrobeSource] = useState<WardrobeSource>('seed');
  const [lastSyncMessage, setLastSyncMessage] = useState<string | null>(null);

  const refreshWeather = async () => {
    setIsWeatherLoading(true);
    setWeatherError(null);

    try {
      const liveWeather = await getCurrentWeather();
      setWeather(liveWeather);
    } catch (error) {
      setWeather({
        ...todayWeather,
        source: 'Sample',
        lastUpdated: 'Fallback sample weather',
      });
      setWeatherError(error instanceof Error ? error.message : 'Unable to fetch live weather.');
    } finally {
      setIsWeatherLoading(false);
    }
  };

  const refreshWardrobe = async () => {
    setIsWardrobeLoading(true);

    if (!isSupabaseConfigured) {
      setItems(wardrobeItems);
      setWardrobeSource('seed');
      setLastSyncMessage('Supabase keys not set, using local sample wardrobe.');
      setIsWardrobeLoading(false);
      return;
    }

    try {
      const remoteItems = await listWardrobeItemsFromSupabase();
      setItems(remoteItems.length > 0 ? remoteItems : wardrobeItems);
      setWardrobeSource(remoteItems.length > 0 ? 'supabase' : 'seed');
      setLastSyncMessage(
        remoteItems.length > 0
          ? 'Wardrobe loaded from Supabase.'
          : 'Supabase is connected, but no saved wardrobe items were found yet.'
      );
    } catch (error) {
      setItems(wardrobeItems);
      setWardrobeSource('local-fallback');
      setLastSyncMessage(
        error instanceof Error
          ? `Supabase sync failed, using local sample wardrobe. ${error.message}`
          : 'Supabase sync failed, using local sample wardrobe.'
      );
    } finally {
      setIsWardrobeLoading(false);
    }
  };

  async function pickAndAddItem(source: UploadSource) {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setLastSyncMessage(
        source === 'camera'
          ? 'Camera permission denied. Please allow camera access to upload items.'
          : 'Photo library permission denied. Please allow photo access to upload items.'
      );
      return;
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.8,
            allowsEditing: true,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.8,
            allowsEditing: true,
            selectionLimit: 1,
          });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    const asset = result.assets[0];
    const draft = createDraftWardrobeItem(asset, source);

    setIsUploading(true);

    try {
      if (!isSupabaseConfigured) {
        setItems((current) => [draft, ...current]);
        setWardrobeSource('local-fallback');
        setLastSyncMessage('Saved locally. Add Supabase env keys to enable cloud sync.');
        return;
      }

      const savedItem = await uploadWardrobeItemToSupabase(draft, asset);
      setItems((current) => [savedItem, ...current]);
      setWardrobeSource('supabase');
      setLastSyncMessage(
        source === 'camera'
          ? 'Camera upload saved to Supabase.'
          : 'Gallery upload saved to Supabase.'
      );
    } catch (error) {
      setItems((current) => [draft, ...current]);
      setWardrobeSource('local-fallback');
      setLastSyncMessage(
        error instanceof Error
          ? `Upload fell back to local-only mode. ${error.message}`
          : 'Upload fell back to local-only mode.'
      );
    } finally {
      setIsUploading(false);
    }
  }

  async function analyzeItemWithAi(itemId: string) {
    const item = items.find((entry) => entry.id === itemId);

    if (!item) {
      setLastSyncMessage('Unable to find the selected item for AI analysis.');
      return;
    }

    if (!isSupabaseConfigured) {
      setLastSyncMessage('Supabase must be configured before OpenAI and Hugging Face analysis can run.');
      return;
    }

    if (!item.imageUrl) {
      setLastSyncMessage('This item needs an image before AI analysis can run.');
      return;
    }

    setAnalyzingItemId(itemId);
    setItems((current) =>
      current.map((entry) =>
        entry.id === itemId
          ? {
              ...entry,
              aiStatus: 'pending',
            }
          : entry
      )
    );

    try {
      const analysis = await analyzeWardrobeItemWithAi(item);
      const enrichedItem = mergeAiAnalysisIntoWardrobeItem(item, analysis);
      let persistedItem = enrichedItem;

      if (item.source === 'supabase') {
        try {
          persistedItem = await updateWardrobeItemInSupabase(enrichedItem);
        } catch {
          persistedItem = enrichedItem;
        }
      }

      setItems((current) =>
        current.map((entry) => (entry.id === itemId ? persistedItem : entry))
      );
      setLastSyncMessage('AI tags generated with Hugging Face and OpenAI.');
    } catch (error) {
      setItems((current) =>
        current.map((entry) =>
          entry.id === itemId
            ? {
                ...entry,
                aiStatus: 'failed',
              }
            : entry
        )
      );
      setLastSyncMessage(
        error instanceof Error
          ? `AI analysis failed. ${error.message}`
          : 'AI analysis failed.'
      );
    } finally {
      setAnalyzingItemId(null);
    }
  }

  useEffect(() => {
    void refreshWeather();
    void refreshWardrobe();
  }, []);

  const value: AppDataContextValue = {
    items,
    weather,
    isWeatherLoading,
    weatherError,
    isWardrobeLoading,
    isUploading,
    analyzingItemId,
    wardrobeSource,
    supabaseConfigured: isSupabaseConfigured,
    lastSyncMessage,
    refreshWeather,
    refreshWardrobe,
    addItemFromCamera: async () => pickAndAddItem('camera'),
    addItemFromLibrary: async () => pickAndAddItem('library'),
    analyzeItemWithAi,
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const context = useContext(AppDataContext);

  if (!context) {
    throw new Error('useAppData must be used inside AppDataProvider.');
  }

  return context;
}
