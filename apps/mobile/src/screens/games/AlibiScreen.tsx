import React, { useState, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Animated, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useRoom } from "../../contexts/RoomContext";

const CRIMES = [
  { crime: "Someone ate the last slice of pizza at 3am", time: "3:07 AM", clue: "Pizza crumbs found near Player 3's phone" },
  { crime: "The TV remote has been hidden for 2 weeks", time: "9:15 PM", clue: "Netflix was paused mid-show on Player 1's profile" },
  { crime: "Someone told your mom about the party", time: "Saturday 4 PM", clue: "Mom's contact was recently called from the house phone" },
  { crime: "The WiFi password was changed without telling anyone", time: "Tuesday 11 AM", clue: "Router admin page accessed from bedroom 2" },
  { crime: "The group playlist was deleted from Spotify", time: "Last Friday", clue: "A playlist called 'new plan' was created same day" },
];

const SUSPECTS = ["Alex", "Jordan", "Sam", "Riley"];
const ALIBIS: string[][] = [
  ["I was asleep — I have a 23:00 bedtime app set", "I was in the kitchen making tea, ask the kettle", "I was FaceTiming my gran — check the logs", "I was doing yoga — my app has the timestamp"],
  ["I was watching the game — different TV entirely", "My hands were busy building IKEA furniture all night", "I was reorganising my sock drawer (alphabetically)", "I was on a call with work — they can confirm"],
];

type Phase = "lobby" | "crime" | "alibis" | "vote" | "reveal" | "results";

export default function AlibiScreen() {
  const router = useRouter();
  const { state, sendAction } = useRoom();
  const inRoom = !!state.room;
  const mpState = state.guestViewData as any;
  const myGuestId = state.guestId;
  function memberName(gId: string) { return state.members.find(m => m.guestId === gId)?.displayName ?? (gId?.slice(0,6) ?? "?"); }
  const [phase, setPhase] = useState<Phase>("lobby");
  const [caseIdx, setCaseIdx] = useState(0);
  const [alibiIdx, setAlibiIdx] = useState(0);
  const [vote, setVote] = useState<number|null>(null);
  const [score, setScore] = useState(0);
  const [log, setLog] = useState<boolean[]>([]);
  const GUILTY_IDX = [2, 0, 3, 1, 2];
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ── Multiplayer block ──────────────────────────────────────────────────────
  if (inRoom && mpState) {
    const mp = mpState;
    const mpPhase: string = mp.phase ?? "waiting";

    if (mpPhase === "finished") {
      return (
        <LinearGradient colors={["#03001c", "#1a0040"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
            <ScrollView contentContainerStyle={{ padding: 24, alignItems: "center" }}>
              <Text style={{ fontSize: 48, marginBottom: 12 }}>🏆</Text>
              <Text style={{ color: "#fff", fontSize: 24, fontWeight: "900", marginBottom: 20 }}>Final Leaderboard</Text>
              {Object.entries(mpState.scores ?? {}).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([gid, pts], i) => (
                <View key={gid} style={{ flexDirection: "row", justifyContent: "space-between", width: "100%", marginBottom: 8 }}>
                  <Text style={{ color: "#ccc", fontSize: 16 }}>#{i + 1} {memberName(gid)}{gid === myGuestId ? " (you)" : ""}</Text>
                  <Text style={{ color: "#a78bfa", fontSize: 16, fontWeight: "700" }}>{pts as number} pts</Text>
                </View>
              ))}
              <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 24, padding: 12 }}>
                <Text style={{ color: "#666" }}>Back to Home</Text>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </LinearGradient>
      );
    }

    if (mpPhase === "waiting") {
      return (
        <LinearGradient colors={["#03001c", "#1a0040"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
            <View style={s.center}>
              <Text style={{ fontSize: 48, marginBottom: 16 }}>⏳</Text>
              <Text style={{ color: "#fff", fontSize: 22, fontWeight: "900", textAlign: "center" }}>Waiting for game to start…</Text>
            </View>
          </SafeAreaView>
        </LinearGradient>
      );
    }

    if (mpPhase === "reading") {
      const crime = mp.crime ?? {};
      const suspects = mp.suspects ?? [];
      const alibis = mp.alibis ?? [];
      return (
        <LinearGradient colors={["#03001c", "#1a0040"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <Text style={s.caseNum}>🚨 THE CRIME</Text>
              <View style={s.caseCard}><LinearGradient colors={["#1a0010","#2d0020"]} style={s.caseCardInner}>
                <Text style={s.crimeText}>{crime.crime ?? crime.description ?? mp.crimeText}</Text>
                {crime.time && <Text style={s.crimeTime}>Time: {crime.time}</Text>}
                {crime.clue && <Text style={s.crimeClue}>Evidence: {crime.clue}</Text>}
              </LinearGradient></View>
              <Text style={{ color: "#a78bfa", fontSize: 13, fontWeight: "900", letterSpacing: 1, marginBottom: 8 }}>SUSPECTS & ALIBIS</Text>
              {suspects.map((sp: string, i: number) => (
                <View key={i} style={{ marginBottom: 12, borderRadius: 14, overflow: "hidden" }}>
                  <LinearGradient colors={["#1a1a3a","#2a1a4a"]} style={{ padding: 16 }}>
                    <Text style={{ color: "#a78bfa", fontWeight: "700", marginBottom: 4 }}>{sp}</Text>
                    <Text style={{ color: "#fff", fontSize: 14 }}>"{alibis[i] ?? "No alibi"}"</Text>
                  </LinearGradient>
                </View>
              ))}
            </ScrollView>
          </SafeAreaView>
        </LinearGradient>
      );
    }

    if (mpPhase === "voting") {
      const suspects: string[] = mp.suspects ?? [];
      const myVoteMp = mp.votes?.[myGuestId ?? ""];
      return (
        <LinearGradient colors={["#03001c", "#1a0040"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
            <View style={s.topBar}><Text style={s.voteTitle}>WHO DID IT?</Text></View>
            <View style={s.voteList}>
              {suspects.map((sp, i) => (
                <TouchableOpacity key={i} onPress={() => { if (!myVoteMp) sendAction("vote", { suspectIndex: i }); }} disabled={!!myVoteMp} activeOpacity={0.85} style={s.voteWrap}>
                  <LinearGradient colors={myVoteMp === i ? ["#7f1d1d","#dc2626"] : ["#1a1a3a","#2a1a4a"]} style={s.voteCard}>
                    <Text style={s.voteEmoji}>🧑</Text>
                    <Text style={s.voteName}>{sp}</Text>
                    {myVoteMp === i && <Text style={{ color: "#fca5a5" }}>← ACCUSED</Text>}
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </View>
            {myVoteMp !== undefined && <Text style={{ color: "#888", textAlign: "center", padding: 12 }}>⏳ Waiting for others…</Text>}
          </SafeAreaView>
        </LinearGradient>
      );
    }

    if (mpPhase === "reveal") {
      const guiltySuspect = mp.guiltySuspect ?? "Unknown";
      return (
        <LinearGradient colors={["#03001c", "#1a0040"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
            <ScrollView contentContainerStyle={{ padding: 24, alignItems: "center" }}>
              <Text style={{ fontSize: 48, marginBottom: 12 }}>🚨</Text>
              <Text style={{ color: "#888", fontSize: 12, fontWeight: "900", letterSpacing: 2, marginBottom: 8 }}>THE ACTUAL CULPRIT</Text>
              <View style={s.revealBox}><Text style={s.revealName}>{guiltySuspect}</Text></View>
              {Object.entries(mp.scores ?? {}).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([gid, pts], i) => (
                <View key={gid} style={{ flexDirection: "row", justifyContent: "space-between", width: "100%", marginBottom: 8 }}>
                  <Text style={{ color: "#ccc", fontSize: 15 }}>#{i + 1} {memberName(gid)}</Text>
                  <Text style={{ color: "#a78bfa", fontSize: 15, fontWeight: "700" }}>{pts as number} pts</Text>
                </View>
              ))}
            </ScrollView>
          </SafeAreaView>
        </LinearGradient>
      );
    }

    return (
      <LinearGradient colors={["#03001c", "#1a0040"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <View style={s.center}>
            <Text style={{ color: "#888", fontSize: 16 }}>Phase: {mpPhase}</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }
  // ── End multiplayer block ──────────────────────────────────────────────────

  function startGame() { setPhase("crime"); setCaseIdx(0); setScore(0); setLog([]); setVote(null); animateIn(); }
  function animateIn() { fadeAnim.setValue(0); Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start(); }
  function goAlibi() { setPhase("alibis"); setAlibiIdx(0); }
  function nextAlibi() { if (alibiIdx + 1 >= SUSPECTS.length) setPhase("vote"); else setAlibiIdx((i) => i + 1); }
  function castVote(idx: number) { setVote(idx); }
  function revealCrime() {
    if (vote === null) return;
    const correct = vote === GUILTY_IDX[caseIdx];
    if (correct) setScore((s) => s + 400);
    setLog((l) => [...l, correct]);
    setPhase("reveal");
  }
  function nextCase() {
    if (caseIdx + 1 >= 3) setPhase("results");
    else { setCaseIdx((c) => c + 1); setVote(null); setPhase("crime"); animateIn(); }
  }

  if (phase === "lobby") return (
    <LinearGradient colors={["#03001c","#1a0010"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}><Text style={s.backText}>← Back</Text></TouchableOpacity>
        <View style={s.center}>
          <Text style={{ fontSize: 64 }}>🕵️</Text>
          <Text style={s.title}>Alibi</Text>
          <Text style={s.sub}>A crime has been committed. Each suspect gives their alibi. Vote on who's lying!</Text>
          <View style={s.rules}>{["A silly 'crime' is revealed","Each suspect defends themselves","Vote for the guilty party","400 pts per correct accusation"].map((r,i)=><Text key={i} style={s.rule}>• {r}</Text>)}</View>
          <TouchableOpacity style={s.btn} onPress={startGame}><LinearGradient colors={["#b5179e","#7209b7"]} style={s.btnI}><Text style={s.btnT}>INVESTIGATE</Text></LinearGradient></TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );

  if (phase === "results") {
    const correct = log.filter(Boolean).length;
    return (
      <LinearGradient colors={["#03001c","#1a0010"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <View style={s.center}>
            <Text style={{ fontSize: 64 }}>🕵️</Text>
            <Text style={s.title}>Case Closed!</Text>
            <Text style={s.bigScore}>{score}</Text>
            <Text style={s.label}>{correct}/{log.length} criminals caught</Text>
            <Text style={s.verdict}>{correct === log.length ? "🏆 Master Detective!" : correct >= 2 ? "🔍 Good Investigator" : "😵 Fooled Every Time"}</Text>
            <TouchableOpacity style={s.btn} onPress={startGame}><LinearGradient colors={["#b5179e","#7209b7"]} style={s.btnI}><Text style={s.btnT}>NEW CASES</Text></LinearGradient></TouchableOpacity>
            <TouchableOpacity style={s.homeBtn} onPress={() => router.back()}><Text style={s.homeBtnT}>Back to Home</Text></TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const cas = CRIMES[caseIdx];

  if (phase === "crime") return (
    <LinearGradient colors={["#03001c","#1a0010"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <View style={s.caseHeader}><Text style={s.caseNum}>CASE #{caseIdx+1}</Text></View>
        <Animated.View style={[s.caseCard, { opacity: fadeAnim }]}>
          <LinearGradient colors={["#1a0010","#2d0020"]} style={s.caseCardInner}>
            <Text style={s.crimeLabel}>🚨 THE CRIME</Text>
            <Text style={s.crimeText}>{cas.crime}</Text>
            <Text style={s.crimeTime}>Time: {cas.time}</Text>
            <Text style={s.crimeClue}>Evidence: {cas.clue}</Text>
          </LinearGradient>
        </Animated.View>
        <View style={s.suspects}>{SUSPECTS.map((sp,i) => <View key={i} style={s.suspectChip}><Text style={s.suspectName}>🧑 {sp}</Text></View>)}</View>
        <View style={{ padding: 20 }}><TouchableOpacity style={s.btn} onPress={goAlibi}><LinearGradient colors={["#b5179e","#7209b7"]} style={s.btnI}><Text style={s.btnT}>HEAR THE ALIBIS →</Text></LinearGradient></TouchableOpacity></View>
      </SafeAreaView>
    </LinearGradient>
  );

  if (phase === "alibis") {
    const suspect = SUSPECTS[alibiIdx];
    const alibi = ALIBIS[alibiIdx % 2][alibiIdx % 4];
    return (
      <LinearGradient colors={["#03001c","#1a0010"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <View style={s.topBar}><Text style={s.prog}>Alibi {alibiIdx+1}/{SUSPECTS.length}</Text></View>
          <View style={s.alibiCard}>
            <LinearGradient colors={["#1a1a3a","#2a1a4a"]} style={s.alibiInner}>
              <Text style={s.alibiSuspect}>{suspect} says:</Text>
              <Text style={s.alibiText}>"{alibi}"</Text>
            </LinearGradient>
          </View>
          <View style={{ padding: 20 }}>
            <TouchableOpacity style={s.btn} onPress={nextAlibi}>
              <LinearGradient colors={["#b5179e","#7209b7"]} style={s.btnI}>
                <Text style={s.btnT}>{alibiIdx+1 >= SUSPECTS.length ? "VOTE NOW →" : "NEXT ALIBI →"}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (phase === "vote") return (
    <LinearGradient colors={["#03001c","#1a0010"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <View style={s.topBar}><Text style={s.voteTitle}>WHO DID IT?</Text></View>
        <View style={s.voteList}>
          {SUSPECTS.map((sp, i) => (
            <TouchableOpacity key={i} onPress={() => castVote(i)} activeOpacity={0.85} style={s.voteWrap}>
              <LinearGradient colors={vote===i ? ["#7f1d1d","#dc2626"] : ["#1a1a3a","#2a1a4a"]} style={s.voteCard}>
                <Text style={s.voteEmoji}>🧑</Text>
                <Text style={s.voteName}>{sp}</Text>
                {vote===i && <Text style={{ color: "#fca5a5" }}>← ACCUSED</Text>}
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>
        {vote !== null && (
          <View style={{ padding: 20 }}>
            <TouchableOpacity style={s.btn} onPress={revealCrime}><LinearGradient colors={["#dc2626","#7f1d1d"]} style={s.btnI}><Text style={s.btnT}>REVEAL THE CRIMINAL 🚨</Text></LinearGradient></TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </LinearGradient>
  );

  if (phase === "reveal") {
    const guilty = SUSPECTS[GUILTY_IDX[caseIdx]];
    const correct = vote === GUILTY_IDX[caseIdx];
    return (
      <LinearGradient colors={["#03001c","#1a0010"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <View style={s.center}>
            <Text style={{ fontSize: 64 }}>{correct ? "✅" : "❌"}</Text>
            <Text style={[s.title, { color: correct ? "#4ade80" : "#f87171" }]}>{correct ? "Got 'em!" : "Wrong suspect!"}</Text>
            <View style={s.revealBox}>
              <Text style={s.revealLabel}>THE ACTUAL CULPRIT:</Text>
              <Text style={s.revealName}>{guilty}</Text>
            </View>
            <Text style={s.ptsText}>{correct ? "+400 pts" : "+0 pts"}</Text>
            <TouchableOpacity style={s.btn} onPress={nextCase}><LinearGradient colors={["#b5179e","#7209b7"]} style={s.btnI}><Text style={s.btnT}>{caseIdx+1 >= 3 ? "See Results" : "Next Case →"}</Text></LinearGradient></TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }
  return null;
}

const s = StyleSheet.create({
  flex:{flex:1}, back:{padding:16,paddingTop:8}, backText:{color:"#a78bfa",fontSize:16,fontWeight:"700"},
  center:{flex:1,alignItems:"center",justifyContent:"center",paddingHorizontal:24},
  title:{color:"#fff",fontSize:28,fontWeight:"900",marginBottom:8,textAlign:"center"},
  sub:{color:"#888",fontSize:13,textAlign:"center",marginBottom:20},
  rules:{backgroundColor:"rgba(255,255,255,0.06)",borderRadius:14,padding:14,width:"100%",marginBottom:28},
  rule:{color:"#ccc",fontSize:13,marginBottom:5},
  btn:{borderRadius:14,overflow:"hidden",marginBottom:12},
  btnI:{padding:18,alignItems:"center"}, btnT:{color:"#fff",fontSize:17,fontWeight:"900"},
  homeBtn:{padding:12,alignItems:"center"}, homeBtnT:{color:"#666",fontSize:15},
  bigScore:{color:"#b5179e",fontSize:64,fontWeight:"900"}, label:{color:"#555",fontSize:12,marginBottom:12},
  verdict:{color:"#a78bfa",fontSize:15,fontWeight:"700",marginBottom:28,textAlign:"center"},
  caseHeader:{paddingHorizontal:20,paddingVertical:12},
  caseNum:{color:"#dc2626",fontSize:11,fontWeight:"900",letterSpacing:2},
  caseCard:{margin:20}, caseCardInner:{borderRadius:18,padding:24},
  crimeLabel:{color:"#dc2626",fontSize:11,fontWeight:"900",letterSpacing:1.5,marginBottom:8},
  crimeText:{color:"#fff",fontSize:20,fontWeight:"800",marginBottom:12},
  crimeTime:{color:"#888",fontSize:13,marginBottom:6},crimeClue:{color:"#fbbf24",fontSize:13},
  suspects:{flexDirection:"row",flexWrap:"wrap",paddingHorizontal:20,gap:8},
  suspectChip:{backgroundColor:"rgba(255,255,255,0.06)",borderRadius:10,paddingHorizontal:12,paddingVertical:6},
  suspectName:{color:"#ccc",fontSize:13},
  topBar:{paddingHorizontal:20,paddingVertical:12},
  prog:{color:"#888",fontWeight:"700"},
  voteTitle:{color:"#fff",fontSize:22,fontWeight:"900"},
  alibiCard:{margin:20,borderRadius:18,overflow:"hidden"},
  alibiInner:{padding:24},
  alibiSuspect:{color:"#a78bfa",fontSize:14,fontWeight:"700",marginBottom:12},
  alibiText:{color:"#fff",fontSize:18,fontWeight:"600",lineHeight:26},
  voteList:{paddingHorizontal:20,gap:10,flex:1,justifyContent:"center"},
  voteWrap:{borderRadius:14,overflow:"hidden"},
  voteCard:{flexDirection:"row",alignItems:"center",padding:16,gap:12},
  voteEmoji:{fontSize:24}, voteName:{color:"#fff",fontSize:17,fontWeight:"700",flex:1},
  revealBox:{backgroundColor:"rgba(220,38,38,0.15)",borderRadius:14,padding:20,width:"100%",marginBottom:16,alignItems:"center"},
  revealLabel:{color:"#dc2626",fontSize:11,fontWeight:"900",letterSpacing:1.5,marginBottom:8},
  revealName:{color:"#fff",fontSize:28,fontWeight:"900"},
  ptsText:{color:"#b5179e",fontSize:24,fontWeight:"900",marginBottom:32},
});
