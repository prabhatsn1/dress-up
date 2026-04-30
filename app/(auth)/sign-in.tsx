import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { signInWithEmail } from "@/lib/auth";

export default function SignInScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSendLink() {
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);
    setError(null);

    const { error: authError } = await signInWithEmail(trimmed);

    setLoading(false);

    if (authError) {
      setError(authError);
    } else {
      setSent(true);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ThemedText type="title" style={styles.title}>
          dress-up
        </ThemedText>
        <ThemedText
          type="default"
          style={[styles.subtitle, { color: colors.muted }]}
        >
          Your AI-powered wardrobe
        </ThemedText>

        {sent ? (
          <ThemedView
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <ThemedText type="defaultSemiBold" style={styles.cardTitle}>
              Check your inbox
            </ThemedText>
            <ThemedText
              type="default"
              style={[styles.cardBody, { color: colors.muted }]}
            >
              We sent a magic link to{" "}
              <ThemedText type="defaultSemiBold">{email.trim()}</ThemedText>.
              Tap it to sign in — no password needed.
            </ThemedText>
          </ThemedView>
        ) : (
          <ThemedView style={styles.form}>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              placeholder="you@example.com"
              placeholderTextColor={colors.muted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              returnKeyType="send"
              onSubmitEditing={handleSendLink}
              editable={!loading}
            />

            {error ? (
              <ThemedText
                type="default"
                style={[styles.errorText, { color: colors.danger }]}
              >
                {error}
              </ThemedText>
            ) : null}

            <TouchableOpacity
              style={[
                styles.button,
                { backgroundColor: colors.tint },
                loading && styles.buttonDisabled,
              ]}
              onPress={handleSendLink}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText type="defaultSemiBold" style={styles.buttonText}>
                  Send Magic Link
                </ThemedText>
              )}
            </TouchableOpacity>
          </ThemedView>
        )}
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 8,
  },
  title: {
    textAlign: "center",
    marginBottom: 4,
  },
  subtitle: {
    textAlign: "center",
    marginBottom: 32,
  },
  form: {
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  errorText: {
    fontSize: 14,
  },
  button: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 20,
    gap: 8,
  },
  cardTitle: {
    fontSize: 18,
  },
  cardBody: {
    lineHeight: 22,
  },
});
