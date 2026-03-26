import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal } from "react-native";
import { getStreak, isStreakAlive, type StreakData } from "../../lib/streak";
import { tapLight } from "../../lib/haptics";

// ─────────────────────────────────────────────────────────────────────────────
// StreakBadge
//
// Compact flame badge shown on the Home tab hero area.
// Tapping opens a modal with full streak stats.
// ─────────────────────────────────────────────────────────────────────────────

export function StreakBadge() {
  const [streak,    setStreak]    = useState<StreakData | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    getStreak().then(setStreak);
  }, []);

  if (!streak || streak.currentStreak === 0) return null;

  const alive  = isStreakAlive(streak);
  const flame  = streak.currentStreak >= 30 ? "🌋"
               : streak.currentStreak >= 14 ? "⚡"
               : streak.currentStreak >= 7  ? "🔥"
               : "🕯️";

  return (
    <>
      <TouchableOpacity style={[styles.badge, !alive && styles.badgeAtRisk]} onPress={() => { tapLight(); setModalOpen(true); }} activeOpacity={0.8}>
        <Text style={styles.flame}>{flame}</Text>
        <Text style={styles.count}>{streak.currentStreak}</Text>
        <Text style={styles.label}>day streak</Text>
        {!alive && <Text style={styles.atRiskLabel}>⚠️ at risk</Text>}
      </TouchableOpacity>

      <Modal transparent animationType="fade" visible={modalOpen} onRequestClose={() => setModalOpen(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setModalOpen(false)}>
          <View style={styles.modal}>
            <Text style={styles.modalFlame}>{flame}</Text>
            <Text style={styles.modalStreak}>{streak.currentStreak} Day Streak</Text>
            {!alive && (
              <Text style={styles.atRisk}>⚠️ At risk — party tonight to keep it alive!</Text>
            )}

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statVal}>{streak.longestStreak}</Text>
                <Text style={styles.statLabel}>Best Streak</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statVal}>{streak.totalActiveDays}</Text>
                <Text style={styles.statLabel}>Total Active Days</Text>
              </View>
            </View>

            {/* Mini calendar — last 7 days */}
            <View style={styles.calRow}>
              {Array.from({ length: 7 }).map((_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - (6 - i));
                const dateStr = d.toISOString().slice(0, 10);
                const label = d.toLocaleDateString([], { weekday: "short" }).slice(0, 1);
                const active = streak.lastActiveDate
                  ? dateStr <= streak.lastActiveDate &&
                    dateStr >= new Date(new Date(streak.lastActiveDate).getTime() - (streak.currentStreak - 1) * 86_400_000).toISOString().slice(0, 10)
                  : false;
                return (
                  <View key={i} style={styles.calDay}>
                    <View style={[styles.calDot, active && styles.calDotActive]} />
                    <Text style={styles.calLabel}>{label}</Text>
                  </View>
                );
              })}
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={() => setModalOpen(false)}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row", alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(239,68,68,0.15)",
    borderRadius: 20, borderWidth: 1, borderColor: "rgba(239,68,68,0.35)",
    paddingHorizontal: 12, paddingVertical: 6,
    alignSelf: "center", marginTop: 8,
  },
  badgeAtRisk: {
    borderColor: "rgba(245,158,11,0.6)",
    backgroundColor: "rgba(245,158,11,0.12)",
  },
  atRiskLabel: { color: "#f59e0b", fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },
  flame:    { fontSize: 18 },
  count:    { color: "#fca5a5", fontSize: 16, fontWeight: "900" },
  label:    { color: "#9ca3af", fontSize: 11, fontWeight: "600" },

  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center", padding: 32 },

  modal: {
    backgroundColor: "#141414",
    borderRadius: 24, padding: 28,
    alignItems: "center", gap: 12,
    borderWidth: 1, borderColor: "#2a2a2a", width: "100%",
  },
  modalFlame:  { fontSize: 56 },
  modalStreak: { color: "#fff", fontSize: 24, fontWeight: "900" },
  atRisk:      { color: "#f59e0b", fontSize: 13, textAlign: "center" },

  statsRow:    { flexDirection: "row", width: "100%", backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 14, paddingVertical: 14 },
  statItem:    { flex: 1, alignItems: "center", gap: 3 },
  statVal:     { color: "#fff", fontSize: 22, fontWeight: "900" },
  statLabel:   { color: "#6b7280", fontSize: 10, fontWeight: "700" },
  statDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.06)" },

  calRow:     { flexDirection: "row", gap: 8, marginTop: 4 },
  calDay:     { alignItems: "center", gap: 4 },
  calDot:     { width: 28, height: 28, borderRadius: 14, backgroundColor: "#1f1f1f", borderWidth: 1, borderColor: "#2a2a2a" },
  calDotActive: { backgroundColor: "#ef4444", borderColor: "#fca5a5" },
  calLabel:   { color: "#6b7280", fontSize: 10, fontWeight: "600" },

  closeBtn:     { marginTop: 4, paddingVertical: 12, paddingHorizontal: 32, backgroundColor: "#7c3aed", borderRadius: 14 },
  closeBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
