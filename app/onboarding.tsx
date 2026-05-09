import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

import { Chip } from "@/components/wardrobe-ui";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { markOnboardingCompleted, saveProfile } from "@/lib/profile";
import type {
  BodyShape,
  GenderIdentity,
  StylePreference,
  UserProfile,
} from "@/lib/wardrobe";
import { useAppData } from "@/providers/app-data-provider";

// ─── Quiz data ────────────────────────────────────────────────────────────────

const GENDER_OPTIONS: GenderIdentity[] = ["Woman", "Man", "Non-binary"];

const HEIGHT_OPTIONS = [
  "Under 5′",
  "5′0″–5′3″",
  "5′4″–5′7″",
  "5′8″–5′11″",
  "6′ and above",
];

const BODY_SHAPE_OPTIONS: { value: BodyShape; label: string; hint: string }[] =
  [
    { value: "slim", label: "Slim", hint: "Lean frame, less defined curves" },
    {
      value: "athletic",
      label: "Athletic",
      hint: "Broad shoulders, muscular build",
    },
    {
      value: "pear",
      label: "Pear",
      hint: "Hips wider than shoulders",
    },
    {
      value: "apple",
      label: "Apple",
      hint: "Fuller midsection, slimmer legs",
    },
    {
      value: "hourglass",
      label: "Hourglass",
      hint: "Balanced shoulders and hips, defined waist",
    },
    {
      value: "rectangle",
      label: "Rectangle",
      hint: "Shoulders, waist, and hips roughly equal",
    },
  ];

const STYLE_OPTIONS: StylePreference[] = [
  "casual",
  "formal",
  "street",
  "ethnic",
  "minimal",
];

const OCCASION_OPTIONS: {
  value: UserProfile["occasionPreference"];
  label: string;
  hint: string;
}[] = [
  {
    value: "office-heavy",
    label: "Office-heavy",
    hint: "Weekdays in professional or smart-casual settings",
  },
  {
    value: "social-heavy",
    label: "Social-heavy",
    hint: "Evenings out, parties, and casual socialising",
  },
  {
    value: "travel-heavy",
    label: "Travel-heavy",
    hint: "Frequently on the move or outdoors",
  },
];

const TOTAL_STEPS = 7; // 0 = welcome, 1–6 = quiz steps

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepHeader({
  step,
  title,
  subtitle,
}: {
  step: number;
  title: string;
  subtitle?: string;
}) {
  const text = useThemeColor({}, "text");
  const muted = useThemeColor({}, "muted");
  const tint = useThemeColor({}, "tint");
  const border = useThemeColor({}, "border");
  const filled = step; // number of filled segments

  return (
    <View style={styles.stepHeader}>
      {/* progress bar */}
      <View style={[styles.progressTrack, { backgroundColor: border }]}>
        <View
          style={[
            styles.progressFill,
            {
              backgroundColor: tint,
              width: `${(filled / (TOTAL_STEPS - 1)) * 100}%`,
            },
          ]}
        />
      </View>
      <Text style={[styles.stepTitle, { color: text }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.stepSubtitle, { color: muted }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

function OptionCard({
  label,
  hint,
  selected,
  onPress,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const surface = useThemeColor({}, "surface");
  const text = useThemeColor({}, "text");
  const muted = useThemeColor({}, "muted");
  const tint = useThemeColor({}, "tint");
  const border = useThemeColor({}, "border");

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.optionCard,
        {
          backgroundColor: selected ? `${tint}18` : surface,
          borderColor: selected ? tint : border,
        },
      ]}
    >
      <View style={styles.optionCardInner}>
        <Text style={[styles.optionLabel, { color: text }]}>{label}</Text>
        {hint ? (
          <Text style={[styles.optionHint, { color: muted }]}>{hint}</Text>
        ) : null}
      </View>
      <View
        style={[styles.radioOuter, { borderColor: selected ? tint : muted }]}
      >
        {selected ? (
          <View style={[styles.radioInner, { backgroundColor: tint }]} />
        ) : null}
      </View>
    </Pressable>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isEditMode = mode === "edit";
  const { width } = useWindowDimensions();
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];
  const scrollRef = useRef<ScrollView>(null);
  const { profile, updateProfile } = useAppData();

  // ── State: quiz answers ──
  const [step, setStep] = useState(isEditMode ? 1 : 0);
  const [name, setName] = useState(isEditMode ? profile.name : "");
  const [gender, setGender] = useState<GenderIdentity>(
    isEditMode ? profile.gender : "Woman",
  );
  const [height, setHeight] = useState<string>(
    isEditMode ? (profile.height ?? "") : "",
  );
  const [bodyShape, setBodyShape] = useState<BodyShape | "">(
    isEditMode ? (profile.bodyShape ?? "") : "",
  );
  const [stylePrefs, setStylePrefs] = useState<StylePreference[]>(
    isEditMode ? profile.stylePreferences : [],
  );
  const [occasion, setOccasion] = useState<UserProfile["occasionPreference"]>(
    isEditMode ? profile.occasionPreference : "office-heavy",
  );
  const [saving, setSaving] = useState(false);

  // Scroll to active step whenever it changes
  useEffect(() => {
    scrollRef.current?.scrollTo({ x: step * width, animated: true });
  }, [step, width]);

  function canProceed(): boolean {
    switch (step) {
      case 0:
        return true;
      case 1:
        return name.trim().length > 0;
      case 2:
        return true; // gender always has a default
      case 3:
        return height.length > 0;
      case 4:
        return bodyShape.length > 0;
      case 5:
        return stylePrefs.length > 0;
      case 6:
        return true;
      default:
        return true;
    }
  }

  function toggleStyle(pref: StylePreference) {
    setStylePrefs((prev) =>
      prev.includes(pref) ? prev.filter((p) => p !== pref) : [...prev, pref],
    );
  }

  async function finish() {
    setSaving(true);
    const built: UserProfile = {
      name: name.trim() || profile.name,
      gender,
      height: height || undefined,
      bodyShape: (bodyShape as BodyShape) || undefined,
      skinTone: profile.skinTone,
      stylePreferences: stylePrefs.length > 0 ? stylePrefs : ["casual"],
      occasionPreference: occasion,
    };
    await saveProfile(built);
    await updateProfile(built);
    if (!isEditMode) {
      await markOnboardingCompleted();
    }
    setSaving(false);
    if (isEditMode) {
      router.back();
    } else {
      router.replace("/(tabs)");
    }
  }

  const isLastStep = step === TOTAL_STEPS - 1;

  // ── Slide content ────────────────────────────────────────────────────────────

  function renderWelcome() {
    return (
      <View style={[styles.slide, { width }]}>
        <View style={styles.welcomeContent}>
          {/* Logo */}
          <View style={styles.welcomeLogoRow}>
            <View style={styles.welcomeLogo}>
              <Text style={styles.welcomeLogoIcon}>✦</Text>
            </View>
            <View style={styles.welcomeAIBadge}>
              <Text style={styles.welcomeAIText}>AI</Text>
            </View>
          </View>

          <Text style={[styles.welcomeTitle, { color: colors.text }]}>
            AI Wardrobe{"\n"}
            <Text style={{ color: colors.accentCool }}>Expo</Text>
          </Text>
          <Text style={[styles.welcomeBody, { color: colors.muted }]}>
            Your smart wardrobe companion, designed for how you actually live.
          </Text>

          {/* Privacy badge */}
          <View style={styles.privacyBadge}>
            <Text style={styles.privacyBadgeText}>
              🛡 Your data stays on your device
            </Text>
          </View>

          {/* Features */}
          <View style={styles.featureList}>
            {[
              { emoji: "🌤", text: "Weather-aware outfit recommendations" },
              { emoji: "✦", text: "AI-powered style analysis" },
              { emoji: "📅", text: "Capsule wardrobe planning" },
            ].map((f, i) => (
              <View
                key={i}
                style={[
                  styles.featureCard,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                  },
                ]}
              >
                <Text style={styles.featureEmoji}>{f.emoji}</Text>
                <Text style={[styles.featureText, { color: colors.text }]}>
                  {f.text}
                </Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.text }]}
            onPress={() => setStep(1)}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Get Started →</Text>
          </TouchableOpacity>
          <Text style={[styles.welcomeDisclaimer, { color: colors.muted }]}>
            No account needed. No data shared.
          </Text>
        </View>
      </View>
    );
  }

  function renderNameStep() {
    return (
      <View style={[styles.slide, { width }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.slideInner}
        >
          <StepHeader
            step={1}
            title="What's your name?"
            subtitle="We'll use this to personalise your AI briefings."
          />
          <TextInput
            style={[
              styles.textInput,
              {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.surface,
              },
            ]}
            placeholder="Your name"
            placeholderTextColor={colors.muted}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={Keyboard.dismiss}
          />
        </KeyboardAvoidingView>
      </View>
    );
  }

  function renderGenderStep() {
    return (
      <View style={[styles.slide, { width }]}>
        <View style={styles.slideInner}>
          <StepHeader step={2} title="How do you identify?" />
          {GENDER_OPTIONS.map((option) => (
            <OptionCard
              key={option}
              label={option}
              selected={gender === option}
              onPress={() => setGender(option)}
            />
          ))}
        </View>
      </View>
    );
  }

  function renderHeightStep() {
    return (
      <View style={[styles.slide, { width }]}>
        <View style={styles.slideInner}>
          <StepHeader
            step={3}
            title="What's your height range?"
            subtitle="Helps suggest proportional fits and lengths."
          />
          {HEIGHT_OPTIONS.map((option) => (
            <OptionCard
              key={option}
              label={option}
              selected={height === option}
              onPress={() => setHeight(option)}
            />
          ))}
        </View>
      </View>
    );
  }

  function renderBodyShapeStep() {
    return (
      <View style={[styles.slide, { width }]}>
        <View style={styles.slideInner}>
          <StepHeader
            step={4}
            title="What's your body shape?"
            subtitle="Used to tailor silhouette and fit recommendations."
          />
          {BODY_SHAPE_OPTIONS.map(({ value, label, hint }) => (
            <OptionCard
              key={value}
              label={label}
              hint={hint}
              selected={bodyShape === value}
              onPress={() => setBodyShape(value)}
            />
          ))}
        </View>
      </View>
    );
  }

  function renderStyleStep() {
    return (
      <View style={[styles.slide, { width }]}>
        <View style={styles.slideInner}>
          <StepHeader
            step={5}
            title="Pick your style vibes"
            subtitle="Choose all that apply. You can update these later."
          />
          <View style={styles.chipGrid}>
            {STYLE_OPTIONS.map((pref) => (
              <Chip
                key={pref}
                label={pref}
                active={stylePrefs.includes(pref)}
                onPress={() => toggleStyle(pref)}
              />
            ))}
          </View>
        </View>
      </View>
    );
  }

  function renderOccasionStep() {
    return (
      <View style={[styles.slide, { width }]}>
        <View style={styles.slideInner}>
          <StepHeader
            step={6}
            title="What best describes your lifestyle?"
            subtitle="Sets the default weighting for outfit suggestions."
          />
          {OCCASION_OPTIONS.map(({ value, label, hint }) => (
            <OptionCard
              key={value}
              label={label}
              hint={hint}
              selected={occasion === value}
              onPress={() => setOccasion(value)}
            />
          ))}
        </View>
      </View>
    );
  }

  const slides = [
    { key: "welcome", node: renderWelcome() },
    { key: "name", node: renderNameStep() },
    { key: "gender", node: renderGenderStep() },
    { key: "height", node: renderHeightStep() },
    { key: "body-shape", node: renderBodyShapeStep() },
    { key: "style", node: renderStyleStep() },
    { key: "occasion", node: renderOccasionStep() },
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1 }}
      >
        {slides.map((slide) => (
          <View key={slide.key} style={{ width }}>
            {slide.node}
          </View>
        ))}
      </ScrollView>

      {/* Navigation footer — hidden on welcome slide */}
      {step > 0 ? (
        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <TouchableOpacity
            onPress={() => setStep((s) => s - 1)}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Text style={[styles.backButtonText, { color: colors.muted }]}>
              Back
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={isLastStep ? finish : () => setStep((s) => s + 1)}
            disabled={!canProceed() || saving}
            style={[
              styles.nextButton,
              {
                backgroundColor: canProceed() ? colors.tint : colors.border,
              },
            ]}
            activeOpacity={0.8}
          >
            <Text style={styles.nextButtonText}>
              {saving
                ? "Saving…"
                : isLastStep
                  ? isEditMode
                    ? "Save changes"
                    : "Finish setup"
                  : "Next"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  slide: {
    flex: 1,
  },
  slideInner: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
  },
  // Welcome
  welcomeContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  welcomeLogoRow: {
    marginBottom: 20,
    position: "relative",
  },
  welcomeLogo: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: "#1A1826",
    alignItems: "center",
    justifyContent: "center",
  },
  welcomeLogoIcon: {
    fontSize: 36,
    color: "#7B9E87",
  },
  welcomeAIBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#C4714F",
    alignItems: "center",
    justifyContent: "center",
  },
  welcomeAIText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: "600",
    lineHeight: 36,
    textAlign: "center",
    marginBottom: 8,
  },
  welcomeBody: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 16,
    maxWidth: 260,
  },
  privacyBadge: {
    backgroundColor: "#EBF3EE",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    marginBottom: 20,
  },
  privacyBadgeText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#3D6B50",
  },
  featureList: {
    width: "100%",
    gap: 10,
    marginBottom: 28,
  },
  featureCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  featureEmoji: {
    fontSize: 18,
  },
  featureText: {
    fontSize: 13,
  },
  welcomeDisclaimer: {
    fontSize: 12,
    marginTop: 12,
    textAlign: "center",
  },
  primaryButton: {
    width: "100%",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  // Step header
  stepHeader: {
    marginBottom: 28,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    marginBottom: 28,
    overflow: "hidden",
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: "600",
    lineHeight: 28,
    marginBottom: 6,
  },
  stepSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  // Text input
  textInput: {
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: "600",
    marginTop: 4,
  },
  // Option card
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 12,
  },
  optionCardInner: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 2,
  },
  optionHint: {
    fontSize: 12,
    lineHeight: 17,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 12,
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  // Chip grid
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4,
  },
  // Footer
  footer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
    paddingBottom: Platform.OS === "ios" ? 36 : 16,
    borderTopWidth: 1,
    gap: 12,
  },
  backButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  nextButton: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
  },
  nextButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
});
