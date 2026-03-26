import React, { useState, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Animated } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useRoom } from "../../contexts/RoomContext";

const HEADLINES = [
  { h: "Man Wins Marathon Running Backwards the Entire Race", real: false },
  { h: "Scientists Discover a New Color Visible Only to Shrimp", real: true },
  { h: "Town in Switzerland Bans Flushing Toilets After 10pm", real: true },
  { h: "Man Fined $600 for Playing Bagpipes in a Library", real: false },
  { h: "Cows Have Best Friends and Get Stressed When Separated", real: true },
  { h: "Japan Has a Theme Park Entirely Dedicated to Instant Noodles", real: true },
  { h: "Police Arrest Man for Walking Too Slowly on a Motorway", real: false },
  { h: "Crocodiles Cannot Stick Their Tongues Out", real: true },
  { h: "France Made It Illegal to Name Your Pig 'Napoleon'", real: true },
  { h: "NASA Discovers Alien Radio Broadcast Playing 'Bohemian Rhapsody'", real: false },
];

type Phase = "lobby" | "playing" | "results";

export default function FakeNewsScreen() {
  const router = useRouter();
  const { state, sendAction } = useRoom();
  const inRoom = !!state.room;
  const mpState = state.guestViewData as any;

  const [phase, setPhase] = useState<Phase>("lobby");
  const [idx, setIdx] = useState(0);
  const [choice, setChoice] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [localVoted, setLocalVoted] = React.useState(false);

  function startGame() { setPhase("playing"); setIdx(0); setScore(0); setStreak(0); setChoice(null); }

  function vote(real: boolean) {
    if (choice !== null) return;
    setChoice(real);
    const correct = real === HEADLINES[idx].real;
    const pts = correct ? (100 + streak * 50) : 0;
    if (correct) { setScore((s) => s + pts); setStreak((st) => st + 1); } else setStreak(0);
    Animated.spring(slideAnim, { toValue: 1, useNativeDriver: true, damping: 10 }).start();
    setTimeout(() => {
      slideAnim.setValue(0);
      if (idx + 1 >= HEADLINES.length) setPhase("results");
      else { setIdx((i) => i + 1); setChoice(null); }
    }, 1400);
  }

  // ─── Multiplayer block ────────────────────────────────────────────────────
  if (inRoom && mpState) {
    const mpPhase: string = mpState.phase ?? "waiting";
    const round: number = mpState.round ?? 1;
    const totalRounds: number = mpState.totalRounds ?? 10;
    const currentHeadline: { text: string; isReal: boolean } = mpState.currentHeadline ?? { text: "", isReal: false };
    const votes: Record<string, string> = mpState.votes ?? {};
    const streaks: Record<string, number> = mpState.streaks ?? {};
    const scores: Record<string, number> = mpState.scores ?? {};
    const myGuestId = state.guestId ?? "";
    const hasVoted = !!votes[myGuestId];

    if (mpPhase === "waiting") {
      return (
        <LinearGradient colors={["#03001c", "#1a0a00"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
            <View style={s.center}>
              <Text style={{ fontSize: 64 }}>📰</Text>
              <Text style={s.title}>Fake News?</Text>
              <Text style={s.sub}>Waiting for the host to start…</Text>
            </View>
          </SafeAreaView>
        </LinearGradient>
      );
    }

    if (mpPhase === "finished") {
      const sortedScores = Object.entries(scores).sort(([, a], [, b]) => b - a);
      return (
        <LinearGradient colors={["#03001c", "#1a0a00"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
            <View style={s.center}>
              <Text style={{ fontSize: 64 }}>📰</Text>
              <Text style={s.title}>Fact Check Complete!</Text>
              <View style={{ width: "100%", marginTop: 16 }}>
                {sortedScores.map(([id, pts], i) => (
                  <View key={id} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#1e1e3a" }}>
                    <Text style={{ color: id === myGuestId ? "#b5179e" : "#ccc", fontSize: 15, fontWeight: "700" }}>
                      {i + 1}. {id === myGuestId ? "You" : id}
                    </Text>
                    <Text style={{ color: "#a78bfa", fontWeight: "800" }}>{pts} pts</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity style={s.homeBtn} onPress={() => router.back()}>
                <Text style={s.homeBtnT}>Back to Home</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </LinearGradient>
      );
    }

    if (mpPhase === "reveal") {
      const myVote = votes[myGuestId];
      const correct = myVote === (currentHeadline.isReal ? "real" : "fake");
      const myStreak = streaks[myGuestId] ?? 0;
      return (
        <LinearGradient colors={["#03001c", "#1a0a00"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
            <View style={s.topBar}>
              <Text style={s.prog}>{round}/{totalRounds}</Text>
              <Text style={s.scoreC}>Score: {scores[myGuestId] ?? 0}</Text>
            </View>
            <View style={s.headlineSection}>
              <View style={s.headlinePaper}>
                <Text style={s.headlinePaperHeader}>📰 BREAKING NEWS</Text>
                <Text style={s.headlineText}>{currentHeadline.text}</Text>
              </View>
            </View>
            <View style={[s.verdict2, { backgroundColor: currentHeadline.isReal ? "rgba(22,163,74,0.2)" : "rgba(220,38,38,0.2)" }]}>
              <Text style={[s.verdictText, { color: currentHeadline.isReal ? "#4ade80" : "#f87171" }]}>
                It was {currentHeadline.isReal ? "REAL ✓" : "FAKE ✗"}
              </Text>
              {myVote && (
                <Text style={{ color: correct ? "#4ade80" : "#f87171", fontSize: 14, fontWeight: "700", marginTop: 4 }}>
                  {correct ? `✓ Correct! Streak: ${myStreak}x` : "✗ Wrong!"}
                </Text>
              )}
            </View>
            <View style={{ padding: 20, alignItems: "center" }}>
              {Object.entries(scores).sort(([, a], [, b]) => b - a).map(([id, pts], i) => (
                <Text key={id} style={{ color: id === myGuestId ? "#b5179e" : "#888", fontSize: 13, marginBottom: 4 }}>
                  {i + 1}. {id === myGuestId ? "You" : id}: {pts} pts
                </Text>
              ))}
            </View>
          </SafeAreaView>
        </LinearGradient>
      );
    }

    // question phase
    const voted = hasVoted || localVoted;
    return (
      <LinearGradient colors={["#03001c", "#1a0a00"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <View style={s.topBar}>
            <Text style={s.prog}>{round}/{totalRounds}</Text>
            {(streaks[myGuestId] ?? 0) >= 2 && <Text style={s.streakBadge}>🔥 {streaks[myGuestId]} streak!</Text>}
            <Text style={s.scoreC}>Score: {scores[myGuestId] ?? 0}</Text>
          </View>
          <View style={s.headlineSection}>
            <View style={s.headlinePaper}>
              <Text style={s.headlinePaperHeader}>📰 BREAKING NEWS</Text>
              <Text style={s.headlineText}>{currentHeadline.text}</Text>
            </View>
          </View>
          {voted && (
            <View style={[s.verdict2, { backgroundColor: "rgba(167,139,250,0.1)" }]}>
              <Text style={[s.verdictText, { color: "#a78bfa" }]}>
                ✓ Vote submitted — waiting for others… ({Object.keys(votes).length} voted)
              </Text>
            </View>
          )}
          <View style={s.btnRow}>
            <TouchableOpacity
              onPress={() => { if (voted) return; setLocalVoted(true); sendAction("vote", { choice: "real" }); }}
              disabled={voted}
              style={[s.realBtn, { opacity: voted ? 0.5 : 1 }]}
              activeOpacity={0.85}
            >
              <LinearGradient colors={["#166534", "#16a34a"]} style={s.choiceI}>
                <Text style={s.choiceT}>✓ REAL</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { if (voted) return; setLocalVoted(true); sendAction("vote", { choice: "fake" }); }}
              disabled={voted}
              style={[s.fakeBtn, { opacity: voted ? 0.5 : 1 }]}
              activeOpacity={0.85}
            >
              <LinearGradient colors={["#7f1d1d", "#dc2626"]} style={s.choiceI}>
                <Text style={s.choiceT}>✗ FAKE</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }
  // ─── End multiplayer block ────────────────────────────────────────────────

  if (phase === "lobby") return (
    <LinearGradient colors={["#03001c","#1a0a00"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}><Text style={s.backText}>← Back</Text></TouchableOpacity>
        <View style={s.center}>
          <Text style={{ fontSize: 64 }}>📰</Text>
          <Text style={s.title}>Fake News?</Text>
          <Text style={s.sub}>Real headline or total fabrication? Vote REAL or FAKE!</Text>
          <View style={s.rules}>{["10 wild headlines to judge","Build a streak for bonus points","Streak x50 bonus pts per correct"].map((r,i) => <Text key={i} style={s.rule}>• {r}</Text>)}</View>
          <TouchableOpacity style={s.btn} onPress={startGame}><LinearGradient colors={["#b5179e","#7209b7"]} style={s.btnI}><Text style={s.btnT}>START</Text></LinearGradient></TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );

  if (phase === "results") {
    const pct = Math.round((score / (HEADLINES.length * 200)) * 100);
    return (
      <LinearGradient colors={["#03001c","#1a0a00"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <View style={s.center}>
            <Text style={{ fontSize: 64 }}>📰</Text>
            <Text style={s.title}>Fact Check Complete!</Text>
            <Text style={s.bigScore}>{score}</Text>
            <Text style={s.label}>POINTS</Text>
            <Text style={s.verdict}>{pct >= 80 ? "🕵️ Master Detective!" : pct >= 60 ? "👀 Good Eye" : pct >= 40 ? "🤔 Decent" : "📰 Easily Fooled"}</Text>
            <TouchableOpacity style={s.btn} onPress={startGame}><LinearGradient colors={["#b5179e","#7209b7"]} style={s.btnI}><Text style={s.btnT}>PLAY AGAIN</Text></LinearGradient></TouchableOpacity>
            <TouchableOpacity style={s.homeBtn} onPress={() => router.back()}><Text style={s.homeBtnT}>Back to Home</Text></TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const h = HEADLINES[idx];
  const isCorrect = choice === h.real;
  return (
    <LinearGradient colors={["#03001c","#1a0a00"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <View style={s.topBar}>
          <Text style={s.prog}>{idx+1}/{HEADLINES.length}</Text>
          {streak >= 2 && <Text style={s.streakBadge}>🔥 {streak} streak!</Text>}
          <Text style={s.scoreC}>Score: {score}</Text>
        </View>
        <View style={s.headlineSection}>
          <View style={s.headlinePaper}>
            <Text style={s.headlinePaperHeader}>📰 BREAKING NEWS</Text>
            <Text style={s.headlineText}>{h.h}</Text>
          </View>
        </View>
        {choice !== null && (
          <Animated.View style={[s.verdict2, {
            backgroundColor: isCorrect ? "rgba(22,163,74,0.2)" : "rgba(220,38,38,0.2)",
            transform: [{ scale: slideAnim }],
          }]}>
            <Text style={[s.verdictText, { color: isCorrect ? "#4ade80" : "#f87171" }]}>
              {isCorrect ? "✓ Correct!" : "✗ Wrong!"} It was {h.real ? "REAL" : "FAKE"}
            </Text>
          </Animated.View>
        )}
        <View style={s.btnRow}>
          <TouchableOpacity onPress={() => vote(true)} disabled={choice !== null} style={s.realBtn} activeOpacity={0.85}>
            <LinearGradient colors={["#166534","#16a34a"]} style={s.choiceI}><Text style={s.choiceT}>✓ REAL</Text></LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => vote(false)} disabled={choice !== null} style={s.fakeBtn} activeOpacity={0.85}>
            <LinearGradient colors={["#7f1d1d","#dc2626"]} style={s.choiceI}><Text style={s.choiceT}>✗ FAKE</Text></LinearGradient>
          </TouchableOpacity>
        </View>
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
  bigScore:{color:"#b5179e",fontSize:64,fontWeight:"900"}, label:{color:"#555",fontSize:12,letterSpacing:2,marginBottom:12},
  verdict:{color:"#a78bfa",fontSize:16,fontWeight:"700",marginBottom:28},
  topBar:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",paddingHorizontal:20,paddingVertical:12},
  prog:{color:"#888",fontWeight:"700",fontSize:14}, streakBadge:{color:"#fbbf24",fontWeight:"900",fontSize:14},
  scoreC:{color:"#a78bfa",fontWeight:"800",fontSize:14},
  headlineSection:{flex:1,paddingHorizontal:20,justifyContent:"center"},
  headlinePaper:{backgroundColor:"#1a1500",borderRadius:16,padding:24,borderWidth:1,borderColor:"#333"},
  headlinePaperHeader:{color:"#666",fontSize:11,fontWeight:"900",letterSpacing:2,marginBottom:12},
  headlineText:{color:"#fff",fontSize:20,fontWeight:"800",lineHeight:28},
  verdict2:{marginHorizontal:20,borderRadius:14,padding:14,alignItems:"center",marginBottom:12},
  verdictText:{fontSize:16,fontWeight:"800"},
  btnRow:{flexDirection:"row",gap:12,paddingHorizontal:20,paddingBottom:32},
  realBtn:{flex:1,borderRadius:14,overflow:"hidden"}, fakeBtn:{flex:1,borderRadius:14,overflow:"hidden"},
  choiceI:{padding:20,alignItems:"center"}, choiceT:{color:"#fff",fontSize:17,fontWeight:"900"},
});
