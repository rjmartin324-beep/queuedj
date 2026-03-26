import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRoom } from "../../../contexts/RoomContext";

// ─────────────────────────────────────────────────────────────────────────────
// NightShift — Guest View
// Tabs: Role → Scene → Accuse → Verdict
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  Killer:   "#ef4444",
  Detective:"#3b82f6",
  Oracle:   "#8b5cf6",
  Janitor:  "#6b7280",
  Spy:      "#f59e0b",
  Witness:  "#10b981",
};

export function NightShiftView() {
  const { state, sendAction } = useRoom();
  const data = state.guestViewData as any ?? {};
  const myRole = state.experienceState?.role as string | undefined;
  const myRoleDesc = state.experienceState?.description as string | undefined;
  const isKiller = state.experienceState?.isKiller as boolean | undefined;
  const oracleReveal = state.experienceState?.oracleReveal as any;

  const [tab, setTab] = useState<"role" | "scene" | "accuse" | "verdict">("role");
  const [accused, setAccused] = useState<string | null>(null);
  const [accuseLocked, setAccuseLocked] = useState(false);
  const [oraclePeeked, setOraclePeeked] = useState<string | null>(null);

  const phase = data.phase ?? "waiting";
  const evidence = (data.evidence ?? []) as any[];
  const suspectList = (data.suspectList ?? []) as any[];

  const TABS = ["role", "scene", "accuse", "verdict"] as const;

  function submitAccuse() {
    if (!accused || accuseLocked) return;
    setAccuseLocked(true);
    sendAction("accuse", { suspectId: accused });
  }

  function oraclePeek(evidenceId: string) {
    if (myRole !== "Oracle" || oraclePeeked) return;
    setOraclePeeked(evidenceId);
    sendAction("oracle_peek", { evidenceId });
  }

  // ── WAITING ────────────────────────────────────────────────────────────────
  if (phase === "waiting" && !myRole) {
    return (
      <LinearGradient colors={["#0a0a08", "#181816"]} style={styles.center}>
        <Text style={{ fontSize: 56, marginBottom: 16 }}>🕯️</Text>
        <Text style={styles.bigTitle}>NightShift</Text>
        <Text style={styles.subtitle}>Waiting for the host to begin…</Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={["#0a0a08", "#181816"]} style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>// NightShift</Text>
        <View style={[styles.rolePill, { borderColor: ROLE_COLORS[myRole ?? ""] + "55" }]}>
          <Text style={[styles.rolePillText, { color: ROLE_COLORS[myRole ?? ""] ?? "#fff" }]}>
            {myRole ?? "?"}
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {TABS.map(t => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>

        {/* ── ROLE TAB ── */}
        {tab === "role" && (
          <>
            <View style={styles.caseFile}>
              <View style={styles.caseFileBar} />
              <View style={styles.caseHeader}>
                <Text style={styles.caseTitle}>Your Assignment</Text>
                <View style={styles.stamp}><Text style={styles.stampText}>TOP SECRET</Text></View>
              </View>
              <View style={styles.caseBody}>
                <View style={[styles.roleBadgeLarge, { backgroundColor: ROLE_COLORS[myRole ?? ""] + "20", borderColor: ROLE_COLORS[myRole ?? ""] + "44" }]}>
                  <Text style={[styles.roleBadgeName, { color: ROLE_COLORS[myRole ?? ""] ?? "#fff" }]}>{myRole}</Text>
                </View>
                <Text style={styles.roleDescText}>{myRoleDesc}</Text>

                {isKiller && (
                  <View style={styles.killerBox}>
                    <Text style={styles.killerBoxText}>🗡️ You are the killer. Your goal: avoid accusation.</Text>
                  </View>
                )}
              </View>
            </View>
          </>
        )}

        {/* ── SCENE TAB ── */}
        {tab === "scene" && (
          <>
            {data.caseTitle && (
              <View style={styles.crimeScene}>
                <Text style={styles.crimeEyebrow}>// INCIDENT REPORT</Text>
                <Text style={styles.crimeTitle}>{data.caseTitle}</Text>
                <Text style={styles.crimeBody}>{data.scenario}</Text>
              </View>
            )}

            <Text style={styles.sectionLabel}>EVIDENCE FILE</Text>
            {evidence.map((ev: any) => (
              <View key={ev.id} style={[styles.evidenceItem, ev.erased && styles.evidenceErased]}>
                <Text style={styles.evidenceNum}>{ev.id?.toUpperCase()}</Text>
                <Text style={[styles.evidenceText, ev.erased && { textDecorationLine: "line-through", opacity: 0.4 }]}>{ev.text}</Text>
                {myRole === "Oracle" && !oraclePeeked && !ev.erased && (
                  <TouchableOpacity style={styles.peekBtn} onPress={() => oraclePeek(ev.id)}>
                    <Text style={styles.peekText}>Peek</Text>
                  </TouchableOpacity>
                )}
                {oraclePeeked === ev.id && oracleReveal && (
                  <View style={[styles.oracleTag, oracleReveal.isPlanted ? styles.tagPlanted : styles.tagReal]}>
                    <Text style={styles.oracleTagText}>{oracleReveal.isPlanted ? "PLANTED" : "GENUINE"}</Text>
                  </View>
                )}
              </View>
            ))}

            {suspectList.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { marginTop: 16 }]}>SUSPECTS</Text>
                {suspectList.map((s: any) => (
                  <View key={s.id} style={styles.suspectRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.suspectName}>{s.name}</Text>
                      <Text style={styles.suspectRole}>{s.role}</Text>
                      <Text style={styles.suspectAlibi}>"{s.alibi}"</Text>
                    </View>
                  </View>
                ))}
              </>
            )}
          </>
        )}

        {/* ── ACCUSE TAB ── */}
        {tab === "accuse" && (
          <>
            <Text style={styles.bigTitle}>File an Accusation</Text>
            <Text style={styles.subtitle}>Choose who you believe is responsible.</Text>

            {suspectList.map((s: any) => (
              <TouchableOpacity
                key={s.id}
                style={[styles.accuseRow, accused === s.id && styles.accuseRowSelected]}
                onPress={() => !accuseLocked && setAccused(s.id)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.suspectName}>{s.name}</Text>
                  <Text style={styles.suspectRole}>{s.role}</Text>
                </View>
                <View style={[styles.selectRing, accused === s.id && styles.selectRingFilled]}>
                  {accused === s.id && <Text style={{ color: "#fff", fontSize: 12 }}>✓</Text>}
                </View>
              </TouchableOpacity>
            ))}

            {accuseLocked ? (
              <View style={styles.lockedBox}>
                <Text style={styles.lockedText}>Accusation filed — awaiting verdict</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.dangerBtn, !accused && { opacity: 0.4 }]}
                onPress={submitAccuse}
                disabled={!accused}
              >
                <Text style={styles.dangerBtnText}>FILE ACCUSATION →</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {/* ── VERDICT TAB ── */}
        {tab === "verdict" && phase === "verdict" && (
          <>
            <View style={styles.verdictCard}>
              <Text style={styles.verdictTitle}>Case Closed</Text>
            </View>
            <View style={styles.verdictBody}>
              {[
                ["Accused", suspectList.find((s: any) => s.id === data.verdictSuspectId)?.name ?? "?"],
                ["Verdict", data.correct ? "GUILTY ✓" : "WRONG ✗"],
                ["Killer was", suspectList.find((s: any) => s.id === data.killerSuspectId)?.name ?? "?"],
              ].map(([label, val]) => (
                <View key={label} style={styles.verdictRow}>
                  <Text style={styles.verdictLabel}>{label}</Text>
                  <Text style={[styles.verdictVal, label === "Verdict" && { color: data.correct ? "#22c55e" : "#ef4444" }]}>{val}</Text>
                </View>
              ))}
            </View>

            {data.scores && (
              <>
                <Text style={[styles.sectionLabel, { marginTop: 16 }]}>SCORES</Text>
                {Object.entries(data.scores as Record<string, number>)
                  .sort((a, b) => b[1] - a[1])
                  .map(([gid, pts], i) => (
                    <View key={gid} style={styles.scoreRow}>
                      <Text style={styles.scoreRank}>{i + 1}</Text>
                      <Text style={styles.scoreName}>{gid}</Text>
                      <Text style={styles.scorePts}>+{pts}</Text>
                    </View>
                  ))}
              </>
            )}
          </>
        )}

        {tab === "verdict" && phase !== "verdict" && (
          <View style={styles.center}>
            <Text style={styles.subtitle}>Verdict not yet revealed…</Text>
          </View>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },

  header:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: "rgba(200,180,120,0.12)" },
  headerTitle: { color: "#c8a84b", fontFamily: "monospace", fontSize: 13, fontWeight: "700", letterSpacing: 2 },
  rolePill:  { borderWidth: 1, borderRadius: 4, paddingHorizontal: 10, paddingVertical: 4 },
  rolePillText: { fontSize: 11, fontWeight: "800", letterSpacing: 2 },

  tabs:        { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "rgba(200,180,120,0.12)" },
  tab:         { flex: 1, paddingVertical: 10, alignItems: "center" },
  tabActive:   { borderBottomWidth: 2, borderBottomColor: "#c8a84b" },
  tabText:     { color: "rgba(232,228,216,0.35)", fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  tabTextActive: { color: "#c8a84b" },

  bigTitle: { color: "#e8e4d8", fontSize: 22, fontWeight: "800", marginBottom: 8 },
  subtitle: { color: "rgba(232,228,216,0.4)", fontSize: 14, lineHeight: 22, marginBottom: 16 },

  sectionLabel: { color: "rgba(232,228,216,0.3)", fontSize: 10, fontWeight: "800", letterSpacing: 3, marginBottom: 10 },

  caseFile:    { backgroundColor: "#181816", borderRadius: 4, borderWidth: 1, borderColor: "rgba(200,180,120,0.12)", overflow: "hidden", marginBottom: 16, position: "relative" },
  caseFileBar: { position: "absolute", left: 0, top: 0, bottom: 0, width: 3, backgroundColor: "#c8a84b" },
  caseHeader:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14, paddingLeft: 20, borderBottomWidth: 1, borderBottomColor: "rgba(200,180,120,0.12)" },
  caseTitle:   { color: "#e8e4d8", fontWeight: "700", fontSize: 15 },
  stamp:       { backgroundColor: "rgba(232,69,60,0.15)", borderWidth: 1, borderColor: "rgba(232,69,60,0.3)", borderRadius: 2, paddingHorizontal: 8, paddingVertical: 3 },
  stampText:   { color: "#e8453c", fontSize: 9, fontWeight: "800", letterSpacing: 2 },
  caseBody:    { padding: 16, paddingLeft: 20 },

  roleBadgeLarge: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 16, paddingVertical: 12, alignSelf: "flex-start", marginBottom: 12 },
  roleBadgeName:  { fontWeight: "900", fontSize: 18, letterSpacing: 1 },
  roleDescText:   { color: "rgba(232,228,216,0.7)", fontSize: 14, lineHeight: 22 },
  killerBox:      { backgroundColor: "rgba(239,68,68,0.08)", borderRadius: 4, borderWidth: 1, borderColor: "rgba(239,68,68,0.2)", padding: 12, marginTop: 12 },
  killerBoxText:  { color: "#fca5a5", fontSize: 13 },

  crimeScene:    { backgroundColor: "#181816", borderRadius: 4, borderWidth: 1, borderColor: "rgba(200,180,120,0.12)", padding: 20, marginBottom: 16 },
  crimeEyebrow:  { color: "#e8453c", fontSize: 10, fontWeight: "800", letterSpacing: 3, marginBottom: 8, fontFamily: "monospace" },
  crimeTitle:    { color: "#e8e4d8", fontSize: 18, fontWeight: "700", marginBottom: 10, lineHeight: 26 },
  crimeBody:     { color: "rgba(232,228,216,0.55)", fontSize: 13, lineHeight: 22 },

  evidenceItem:   { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "rgba(200,180,120,0.04)", borderRadius: 4, borderWidth: 1, borderColor: "rgba(200,180,120,0.1)", padding: 12, marginBottom: 8 },
  evidenceErased: { opacity: 0.5 },
  evidenceNum:    { color: "rgba(200,168,75,0.5)", fontFamily: "monospace", fontSize: 11, width: 28, paddingTop: 1 },
  evidenceText:   { color: "#e8e4d8", fontSize: 13, lineHeight: 20, flex: 1 },
  peekBtn:        { backgroundColor: "rgba(200,168,75,0.12)", borderRadius: 4, borderWidth: 1, borderColor: "rgba(200,168,75,0.25)", paddingHorizontal: 8, paddingVertical: 3 },
  peekText:       { color: "#c8a84b", fontSize: 11, fontWeight: "800" },
  oracleTag:      { borderRadius: 3, paddingHorizontal: 8, paddingVertical: 2 },
  tagReal:        { backgroundColor: "rgba(60,184,120,0.12)", borderWidth: 1, borderColor: "rgba(60,184,120,0.3)" },
  tagPlanted:     { backgroundColor: "rgba(232,69,60,0.12)", borderWidth: 1, borderColor: "rgba(232,69,60,0.3)" },
  oracleTagText:  { fontSize: 9, fontWeight: "800", letterSpacing: 1.5, color: "#e8e4d8" },

  suspectRow:   { backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 4, borderWidth: 1, borderColor: "rgba(200,180,120,0.1)", padding: 14, marginBottom: 8 },
  suspectName:  { color: "#e8e4d8", fontWeight: "700", fontSize: 16 },
  suspectRole:  { color: "rgba(232,228,216,0.4)", fontSize: 12, marginTop: 2 },
  suspectAlibi: { color: "rgba(232,228,216,0.6)", fontSize: 12, marginTop: 6, fontStyle: "italic" },

  accuseRow:         { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 4, borderWidth: 1, borderColor: "rgba(200,180,120,0.1)", padding: 14, marginBottom: 10 },
  accuseRowSelected: { borderColor: "#e8453c", backgroundColor: "rgba(232,69,60,0.05)" },
  selectRing:        { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
  selectRingFilled:  { borderColor: "#e8453c", backgroundColor: "#e8453c" },

  lockedBox:  { backgroundColor: "rgba(200,168,75,0.08)", borderRadius: 4, borderWidth: 1, borderColor: "rgba(200,168,75,0.2)", padding: 14, alignItems: "center", marginTop: 8 },
  lockedText: { color: "#c8a84b", fontWeight: "700", fontSize: 14 },

  dangerBtn:     { backgroundColor: "transparent", borderWidth: 1, borderColor: "rgba(232,69,60,0.4)", borderRadius: 4, paddingVertical: 14, alignItems: "center", marginTop: 12 },
  dangerBtnText: { color: "#e8453c", fontFamily: "monospace", fontWeight: "700", fontSize: 13, letterSpacing: 2 },

  verdictCard: { backgroundColor: "rgba(232,69,60,0.1)", borderWidth: 1, borderColor: "rgba(232,69,60,0.2)", borderRadius: 4, padding: 20, alignItems: "center", marginBottom: 12 },
  verdictTitle:{ color: "#e8453c", fontSize: 22, fontWeight: "900" },
  verdictBody: { backgroundColor: "#181816", borderRadius: 4, borderWidth: 1, borderColor: "rgba(200,180,120,0.12)" },
  verdictRow:  { flexDirection: "row", justifyContent: "space-between", padding: 14, borderBottomWidth: 1, borderBottomColor: "rgba(200,180,120,0.1)" },
  verdictLabel:{ color: "rgba(232,228,216,0.4)", fontSize: 13 },
  verdictVal:  { color: "#e8e4d8", fontWeight: "700", fontSize: 13 },

  scoreRow:  { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 4, padding: 12, marginBottom: 6 },
  scoreRank: { color: "rgba(255,255,255,0.3)", fontWeight: "800", width: 20 },
  scoreName: { flex: 1, color: "#e8e4d8", fontWeight: "700" },
  scorePts:  { color: "#c8a84b", fontWeight: "900", fontSize: 15 },
});
