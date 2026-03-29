import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

interface State { hasError: boolean; error: string | null }

// ─────────────────────────────────────────────────────────────────────────────
// ExperienceErrorBoundary
//
// Wraps ExperiencePlayerView so a render crash in any single experience
// component can't take down the entire guest session.
//
// Guests see a recovery prompt rather than a blank screen. The session
// (socket, room state, chat) remains intact — only the experience view crashed.
// ─────────────────────────────────────────────────────────────────────────────

export class ExperienceErrorBoundary extends React.Component<
  React.PropsWithChildren<{ onReset?: () => void }>,
  State
> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(err: unknown): State {
    const msg = err instanceof Error ? err.message : String(err);
    return { hasError: true, error: msg };
  }

  componentDidCatch(err: unknown, info: React.ErrorInfo) {
    console.error("[ExperienceErrorBoundary] render crash:", err, info.componentStack);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={s.container}>
        <Text style={s.emoji}>⚠️</Text>
        <Text style={s.title}>Something went wrong</Text>
        <Text style={s.sub}>This game hit a render error. Your session is still active.</Text>
        {__DEV__ && this.state.error ? (
          <Text style={s.devError} numberOfLines={4}>{this.state.error}</Text>
        ) : null}
        <TouchableOpacity style={s.btn} onPress={this.reset} activeOpacity={0.8}>
          <Text style={s.btnText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const s = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#08081a", padding: 32, gap: 12 },
  emoji:     { fontSize: 52 },
  title:     { color: "#fff", fontSize: 22, fontWeight: "900", textAlign: "center" },
  sub:       { color: "#6b7280", fontSize: 14, textAlign: "center", lineHeight: 20 },
  devError:  { color: "#f87171", fontSize: 11, fontFamily: "monospace", backgroundColor: "rgba(239,68,68,0.1)", padding: 12, borderRadius: 8, width: "100%", marginTop: 8 },
  btn:       { marginTop: 16, backgroundColor: "#7c3aed", borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14 },
  btnText:   { color: "#fff", fontSize: 16, fontWeight: "800" },
});
