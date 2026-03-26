import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

// ─────────────────────────────────────────────────────────────────────────────
// ErrorBoundary — catches render errors and shows a friendly fallback
// ─────────────────────────────────────────────────────────────────────────────

interface State {
  hasError: boolean;
  error:    Error | null;
}

interface Props {
  children:  React.ReactNode;
  fallback?: React.ReactNode;
  onReset?:  () => void;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error.message, info.componentStack);
  }

  reset() {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <View style={styles.container}>
          <Text style={styles.emoji}>😵</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message} numberOfLines={3}>
            {this.state.error?.message ?? "An unexpected error occurred."}
          </Text>
          <TouchableOpacity style={styles.btn} onPress={() => this.reset()}>
            <Text style={styles.btnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emoji:   { fontSize: 52, marginBottom: 16 },
  title:   { color: "#fff", fontSize: 20, fontWeight: "800", marginBottom: 8 },
  message: { color: "#6b7280", fontSize: 13, textAlign: "center", lineHeight: 20, marginBottom: 24 },
  btn:     { backgroundColor: "#7c3aed", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 36 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
