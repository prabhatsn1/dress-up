import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { Colors } from "@/constants/theme";

// ─── Expo-router per-route ErrorBoundary (function component) ─────────────────
// Export this as `ErrorBoundary` from any route file and expo-router will
// automatically render it instead of crashing when the route throws.

interface RouteErrorBoundaryProps {
  error: Error;
  retry: () => void;
}

export function RouteErrorBoundary({ error, retry }: RouteErrorBoundaryProps) {
  const colors = Colors.light;
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <MaterialIcons
        name="error-outline"
        size={52}
        color={colors.danger}
        style={styles.icon}
      />
      <Text style={[styles.heading, { color: colors.text }]}>
        Something went wrong
      </Text>
      <Text style={[styles.detail, { color: colors.muted }]}>
        {error.message ?? "An unexpected error occurred. Please try again."}
      </Text>
      <TouchableOpacity
        onPress={retry}
        style={[styles.button, { backgroundColor: colors.tint }]}
        activeOpacity={0.8}
      >
        <Text style={styles.buttonText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  children: React.ReactNode;
  /** Optional label shown beneath the icon (e.g. "Today", "Closet"). */
  screenName?: string;
}

interface State {
  hasError: boolean;
  message: string | null;
}

/**
 * Class-based React Error Boundary.
 * Catches errors thrown by AI, Supabase, or any child component and renders
 * a graceful fallback instead of crashing the whole app.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: null };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    // Non-PII safe log — avoid logging user data
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, message: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    // Use light palette as a safe default (no hooks in class components)
    const colors = Colors.light;

    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <MaterialIcons
          name="error-outline"
          size={52}
          color={colors.danger}
          style={styles.icon}
        />
        <Text style={[styles.heading, { color: colors.text }]}>
          Something went wrong
          {this.props.screenName ? ` on ${this.props.screenName}` : ""}
        </Text>
        <Text style={[styles.detail, { color: colors.muted }]}>
          {this.state.message ??
            "An unexpected error occurred. Please try again."}
        </Text>
        <TouchableOpacity
          onPress={this.handleRetry}
          style={[styles.button, { backgroundColor: colors.tint }]}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 60,
  },
  icon: {
    marginBottom: 20,
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 10,
  },
  detail: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginBottom: 32,
  },
  button: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 36,
  },
  buttonText: {
    color: "#fff9f3",
    fontSize: 16,
    fontWeight: "700",
  },
});
