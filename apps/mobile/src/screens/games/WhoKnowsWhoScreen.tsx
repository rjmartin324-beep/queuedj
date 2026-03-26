import React, { useState, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Animated, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useRoom } from "../../contexts/RoomContext";

const QUESTIONS = [
  { q: "Who in this group would survive a zombie apocalypse?", opts: ["Alex", "Jordan", "Sam", "Me"] },
  { q: "Who most likely binge-watches shows all weekend?", opts: ["Alex", "Jordan", "Sam", "Me"] },
  { q: "Who would win a trivia contest?", opts: ["Alex", "Jordan", "Sam", "Me"] },
  { q: "Who would eat the most unusual food on a dare?", opts: ["Alex", "Jordan", "Sam", "Me"] },
  { q: "Who would be most likely to accidentally start a viral trend?", opts: ["Alex", "Jordan", "Sam", "Me"] },
  { q: "Who has the best dance moves?", opts: ["Alex", "Jordan", "Sam", "Me"] },
  { q: "Who would forget their own birthday?", opts: ["Alex", "Jordan", "Sam", "Me"] },
  { q: "Who has the most embarrassing story to tell?", opts: ["Alex", "Jordan", "Sam", "Me"] },
];

// "Majority" answers (simulated group consensus)
const MAJORITY = [1, 0, 2, 3, 1, 0, 2, 3];

type Phase = "lobby" | "playing" | "results";

export default function WhoKnowsWhoScreen() {
  const router = useRouter();
  const { state, sendAction } = useRoom();
  const inRoom = !!state.room;
  const mpState = state.guestViewData as any;
  const myGuestId = state.guestId;
  function memberName(gId: string) { return state.members.find(m => m.guestId === gId)?.displayName ?? (gId?.slice(0,6) ?? "?"); }

  const [phase, setPhase] = useState<Phase>("lobby");
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;

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

    if (mpPhase === "question") {
      const myVoteMp = mp.votes?.[myGuestId ?? ""];
      const members = state.members;
      return (
        <LinearGradient colors={["#03001c", "#1a0040"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
            <View style={s.topBar}><Text style={s.prog}>Question {(mp.questionIndex ?? 0) + 1}</Text><Text style={s.scoreC}>{mp.scores?.[myGuestId ?? ""] ?? 0} pts</Text></View>
            <View style={s.qSection}><Text style={s.questionText}>{mp.questionText}</Text></View>
            <View style={s.optsSection}>
              {members.map((m) => (
                <TouchableOpacity
                  key={m.guestId}
                  onPress={() => { if (!myVoteMp) sendAction("vote", { targetId: m.guestId }); }}
                  disabled={!!myVoteMp}
                  activeOpacity={0.8}
                  style={s.optWrap}
                >
                  <LinearGradient colors={myVoteMp === m.guestId ? ["#7209b7","#b5179e"] : ["#1a1a3a","#2a1a4a"]} style={s.optCard}>
                    <Text style={s.optText}>{m.displayName}</Text>
                    {myVoteMp === m.guestId && <Text style={{ color: "#e879f9" }}>← Your vote</Text>}
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </View>
            {myVoteMp && <Text style={s.groupVote}>⏳ Waiting for others…</Text>}
          </SafeAreaView>
        </LinearGradient>
      );
    }

    if (mpPhase === "reveal") {
      const winner = mp.winner;
      const members = state.members;
      return (
        <LinearGradient colors={["#03001c", "#1a0040"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
            <ScrollView contentContainerStyle={{ padding: 24, alignItems: "center" }}>
              <Text style={{ color: "#888", fontSize: 14, fontWeight: "700", marginBottom: 8 }}>{mp.questionText}</Text>
              <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900", marginBottom: 16 }}>
                Group voted: {winner ? memberName(winner) : "?"}
              </Text>
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

  function startGame() { setPhase("playing"); setIdx(0); setScore(0); setSelected(null); setRevealed(false); }

  function pick(optIdx: number) {
    if (revealed) return;
    setSelected(optIdx);
    setRevealed(true);
    const correct = optIdx === MAJORITY[idx];
    if (correct) setScore((s) => s + 250);
    Animated.spring(slideAnim, { toValue: 1, useNativeDriver: true, damping: 10 }).start();
    setTimeout(() => {
      slideAnim.setValue(0);
      if (idx + 1 >= QUESTIONS.length) setPhase("results");
      else { setIdx((i) => i + 1); setSelected(null); setRevealed(false); }
    }, 1400);
  }

  if (phase === "lobby") return (
    <LinearGradient colors={["#03001c","#0a1a00"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}><Text style={s.backText}>← Back</Text></TouchableOpacity>
        <View style={s.center}>
          <Text style={{ fontSize: 64 }}>🧑‍🤝‍🧑</Text>
          <Text style={s.title}>Who Knows Who?</Text>
          <Text style={s.sub}>Questions about your group — match the majority vote to score!</Text>
          <View style={s.rules}>{["8 questions about your friends","Match the group's consensus to score","250 pts per correct match"].map((r,i) => <Text key={i} style={s.rule}>• {r}</Text>)}</View>
          <TouchableOpacity style={s.btn} onPress={startGame}><LinearGradient colors={["#b5179e","#7209b7"]} style={s.btnI}><Text style={s.btnT}>START</Text></LinearGradient></TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );

  if (phase === "results") return (
    <LinearGradient colors={["#03001c","#0a1a00"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <View style={s.center}>
          <Text style={{ fontSize: 64 }}>🏆</Text>
          <Text style={s.title}>Group Synced!</Text>
          <Text style={s.big}>{score}</Text>
          <Text style={s.label}>POINTS</Text>
          <Text style={s.verdict}>{score >= 1500 ? "🧠 You know your crew!" : score >= 1000 ? "👍 Pretty connected" : "🤷 Meet your friends"}</Text>
          <TouchableOpacity style={s.btn} onPress={startGame}><LinearGradient colors={["#b5179e","#7209b7"]} style={s.btnI}><Text style={s.btnT}>PLAY AGAIN</Text></LinearGradient></TouchableOpacity>
          <TouchableOpacity style={s.homeBtn} onPress={() => router.back()}><Text style={s.homeBtnT}>Back to Home</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );

  const q = QUESTIONS[idx];
  return (
    <LinearGradient colors={["#03001c","#0a1a00"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <View style={s.topBar}><Text style={s.prog}>{idx+1}/{QUESTIONS.length}</Text><Text style={s.scoreC}>Score: {score}</Text></View>
        <View style={s.qSection}>
          <Text style={s.questionText}>{q.q}</Text>
        </View>
        <View style={s.optsSection}>
          {q.opts.map((opt, i) => {
            const isSelected = selected === i;
            const isCorrect = i === MAJORITY[idx];
            let colors: string[] = ["#1a1a3a", "#2a1a4a"];
            if (revealed) { if (isCorrect) colors = ["#166534","#16a34a"]; else if (isSelected) colors = ["#7f1d1d","#991b1b"]; }
            return (
              <TouchableOpacity key={i} onPress={() => pick(i)} disabled={revealed} activeOpacity={0.8} style={s.optWrap}>
                <LinearGradient colors={colors as any} style={s.optCard}>
                  <Text style={s.optText}>{opt}</Text>
                  {revealed && isCorrect && <Text style={{ color: "#4ade80", fontSize: 18 }}>✓</Text>}
                </LinearGradient>
              </TouchableOpacity>
            );
          })}
        </View>
        {revealed && <Text style={s.groupVote}>👥 Group voted: {q.opts[MAJORITY[idx]]}</Text>}
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  flex:{flex:1}, back:{padding:16,paddingTop:8}, backText:{color:"#a78bfa",fontSize:16,fontWeight:"700"},
  center:{flex:1,alignItems:"center",justifyContent:"center",paddingHorizontal:24},
  title:{color:"#fff",fontSize:30,fontWeight:"900",marginBottom:8,textAlign:"center"},
  sub:{color:"#888",fontSize:13,textAlign:"center",marginBottom:20},
  rules:{backgroundColor:"rgba(255,255,255,0.06)",borderRadius:14,padding:14,width:"100%",marginBottom:28},
  rule:{color:"#ccc",fontSize:13,marginBottom:5},
  btn:{width:"100%",borderRadius:14,overflow:"hidden",marginBottom:12},
  btnI:{padding:18,alignItems:"center"}, btnT:{color:"#fff",fontSize:17,fontWeight:"900"},
  homeBtn:{padding:12}, homeBtnT:{color:"#666",fontSize:15},
  big:{color:"#b5179e",fontSize:64,fontWeight:"900"}, label:{color:"#555",fontSize:12,letterSpacing:2,marginBottom:12},
  verdict:{color:"#a78bfa",fontSize:16,fontWeight:"700",marginBottom:28},
  topBar:{flexDirection:"row",justifyContent:"space-between",paddingHorizontal:20,paddingVertical:12},
  prog:{color:"#888",fontWeight:"700",fontSize:14}, scoreC:{color:"#a78bfa",fontWeight:"800",fontSize:14},
  qSection:{flex:1,paddingHorizontal:20,justifyContent:"center"},
  questionText:{color:"#fff",fontSize:22,fontWeight:"800",textAlign:"center",lineHeight:30},
  optsSection:{paddingHorizontal:20,gap:10,paddingBottom:8},
  optWrap:{borderRadius:14,overflow:"hidden"},
  optCard:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",padding:16,borderRadius:14},
  optText:{color:"#fff",fontSize:16,fontWeight:"600",flex:1},
  groupVote:{color:"#a78bfa",fontSize:14,fontWeight:"700",textAlign:"center",padding:16},
});
