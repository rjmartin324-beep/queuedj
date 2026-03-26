import React, { useState, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  Animated, TextInput, KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useRoom } from "../../contexts/RoomContext";
import { PostGameCard } from "../../components/shared/PostGameCard";

type Phase = "lobby" | "submit" | "vote" | "reveal" | "results";

const CONTENT_BANK = [
  { name: "Riley",  facts: ["I once texted my boss a meme meant for my friend", "I have visited all 50 US states", "I used to sleepwalk as a teenager"],           lie: 1 },
  { name: "Jordan", facts: ["I've never seen a single Star Wars film", "I can wiggle my ears independently", "I once accidentally called the fire brigade"],        lie: 1 },
  { name: "Sam",    facts: ["I broke my nose learning to skateboard", "I've won a pub quiz three times in a row", "I can hold my breath for 4 minutes"],            lie: 2 },
  { name: "Alex",   facts: ["I once got a standing ovation at karaoke", "I have a fear of escalators", "I can name every country in the world"],                    lie: 2 },
  { name: "Taylor", facts: ["I've never had a cavity in my life", "I once slept for 18 hours straight after a festival", "I can do a backflip"],                    lie: 2 },
  { name: "Morgan", facts: ["I was once bitten by a penguin at a zoo", "I can solve a Rubik's cube in under two minutes", "I've been to 30 countries"],              lie: 2 },
  { name: "Casey",  facts: ["I was ranked top 500 in my country at a video game", "I've never been on a plane", "I once cooked Christmas dinner for 20 people"],    lie: 1 },
  { name: "Drew",   facts: ["I once drove a forklift at a warehouse job", "I can speak three languages fluently", "I got a hole-in-one my first time playing golf"], lie: 1 },
  { name: "Avery",  facts: ["I have an unusual fear of buttons on clothes", "I once found a wallet with £200 and returned it", "I've met the same celebrity twice"], lie: 2 },
  { name: "Blake",  facts: ["I won a local spelling bee as a child", "I've never eaten a burger in my life", "I once appeared as an extra in a TV show"],            lie: 1 },
  { name: "Quinn",  facts: ["I once fainted at a magic show in front of the audience", "I can type over 110 words per minute", "I have a photographic memory"],      lie: 2 },
  { name: "Reese",  facts: ["I grew up living in four different countries", "I failed my driving test five times", "I can hold my breath for 5 minutes"],             lie: 2 },
  { name: "Finley", facts: ["I broke my collarbone twice before the age of 12", "I once won a radio call-in competition", "I've appeared in a documentary film"],   lie: 2 },
  { name: "Emery",  facts: ["I once lived next door to a famous athlete", "I've been struck by lightning", "I used to collect vintage stamps as a kid"],              lie: 1 },
  { name: "Rowan",  facts: ["I ate a ghost chili pepper on a dare and finished it", "I've climbed a mountain over 4,000m", "I once went viral on social media"],     lie: 1 },
];

function pickRounds() {
  const shuffled = [...CONTENT_BANK].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3).map(p => {
    // Shuffle fact order so the lie isn't always in the same position
    const order = [0, 1, 2].sort(() => Math.random() - 0.5);
    const facts  = order.map(i => p.facts[i]);
    const lie    = order.indexOf(p.lie);
    return { name: p.name, facts, lie };
  });
}

export default function TwoTruthsOneLieScreen() {
  const router = useRouter();
  const { state, sendAction } = useRoom();
  const startedInRoom = useRef(!!state.room);
  const inRoom = startedInRoom.current && !!state.room;
  const mpState = inRoom ? (state.guestViewData as any) : null;
  const myGuestId = state.guestId;
  function memberName(gId: string) { return state.members.find(m => m.guestId === gId)?.displayName ?? (gId?.slice(0,6) ?? "?"); }

  const [phase, setPhase] = useState<Phase>("lobby");
  const [playerIdx, setPlayerIdx] = useState(0);
  const [fact1, setFact1] = useState("");
  const [fact2, setFact2] = useState("");
  const [lie, setLie] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [voteIdx, setVoteIdx] = useState<number | null>(null);
  const [roundIdx, setRoundIdx] = useState(0);
  const [rounds, setRounds] = useState<{ name: string; facts: string[]; lie: number }[]>([]);
  const [log, setLog] = useState<{ correct: boolean; lieWas: string }[]>([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [mpFacts, setMpFacts] = useState(["", "", ""]);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  if (inRoom && mpState) {
    const mp = mpState;

    if (mp.phase === "finished") {
      return (
        <LinearGradient colors={["#03001c","#0a0010"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
            <ScrollView contentContainerStyle={{ padding: 24 }}>
              <View style={{alignItems:"center",padding:24}}>
                <Text style={{fontSize:48}}>🏆</Text>
                <Text style={{color:"#fff",fontSize:24,fontWeight:"900",marginBottom:20}}>Final Scores</Text>
                {Object.entries(mp.scores||{}).sort(([,a],[,b])=>(b as number)-(a as number)).map(([gId,pts],i)=>(
                  <View key={gId} style={{flexDirection:"row",justifyContent:"space-between",width:"100%",marginBottom:8}}>
                    <Text style={{color:"#ccc",fontSize:16}}>{i+1}. {memberName(gId)}</Text>
                    <Text style={{color:"#a78bfa",fontSize:16,fontWeight:"700"}}>{pts as number} pts</Text>
                  </View>
                ))}
                <TouchableOpacity onPress={()=>router.back()} style={{marginTop:24,padding:12}}>
                  <Text style={{color:"#666"}}>← Back</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </SafeAreaView>
        </LinearGradient>
      );
    }

    if (mp.phase === "reveal") {
      const lieIndex = mp.lieIndex ?? 0;
      const facts = mp.facts ?? [];
      return (
        <LinearGradient colors={["#03001c","#0a001a"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
            <ScrollView contentContainerStyle={{ padding: 24, alignItems: "center" }}>
              <Text style={{ color: "#a78bfa", fontSize: 14, fontWeight: "700", marginBottom: 8 }}>{memberName(mp.currentSubmitter)}'s facts</Text>
              {facts.map((fact: string, i: number) => (
                <View key={i} style={[s.factCard, { borderRadius: 14, overflow: "hidden", width: "100%", marginBottom: 10 }]}>
                  <LinearGradient colors={i === lieIndex ? ["#7f1d1d","#dc2626"] : ["#166534","#16a34a"]} style={s.factCardInner}>
                    <Text style={s.factLetter}>{["A","B","C"][i]}</Text>
                    <Text style={s.factText}>{fact}</Text>
                    {i === lieIndex && <Text style={{ color: "#fca5a5", fontSize: 12, fontWeight: "900" }}>🤥 LIE</Text>}
                  </LinearGradient>
                </View>
              ))}
              <Text style={{ color: "#888", fontSize: 12, fontWeight: "900", letterSpacing: 2, marginBottom: 12, marginTop: 16 }}>SCORES</Text>
              {Object.entries(mp.scores||{}).sort(([,a],[,b])=>(b as number)-(a as number)).map(([gId,pts],i)=>(
                <View key={gId} style={{flexDirection:"row",justifyContent:"space-between",width:"100%",marginBottom:8}}>
                  <Text style={{color:"#ccc",fontSize:15}}>{i+1}. {memberName(gId)}</Text>
                  <Text style={{color:"#a78bfa",fontSize:15,fontWeight:"700"}}>{pts as number} pts</Text>
                </View>
              ))}
            </ScrollView>
          </SafeAreaView>
        </LinearGradient>
      );
    }

    if (mp.phase === "voting") {
      const facts = mp.facts ?? [];
      return (
        <LinearGradient colors={["#03001c","#0a001a"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
            <View style={s.voteHeader}>
              <Text style={s.votePlayerName}>{memberName(mp.currentSubmitter)}'s facts:</Text>
              <Text style={s.voteInstruction}>Which one is the LIE?</Text>
            </View>
            <View style={s.voteOptions}>
              {facts.map((fact: string, i: number) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => { if (!hasVoted) { setHasVoted(true); sendAction("vote", { index: i }); } }}
                  disabled={hasVoted}
                  activeOpacity={0.85}
                  style={[s.factCard, hasVoted && s.selectedFact]}
                >
                  <LinearGradient
                    colors={["#1a1a3a","#2a1a4a"]}
                    style={s.factCardInner}
                  >
                    <Text style={s.factLetter}>{["A","B","C"][i]}</Text>
                    <Text style={s.factText}>{fact}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </View>
            {hasVoted && (
              <View style={{ padding: 20, alignItems: "center" }}>
                <Text style={{ color: "#a78bfa", fontSize: 15, fontWeight: "700" }}>⏳ Waiting for others…</Text>
              </View>
            )}
          </SafeAreaView>
        </LinearGradient>
      );
    }

    if (mp.phase === "submitting") {
      const isMyTurn = myGuestId === mp.currentSubmitter;
      if (isMyTurn) {
        return (
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.flex}>
            <LinearGradient colors={["#03001c","#0a001a"]} style={s.flex}>
              <SafeAreaView style={s.flex}>
                <Text style={s.submitTitle}>Your Turn!</Text>
                <Text style={s.submitSub}>Write 2 true facts and 1 convincing lie</Text>
                <View style={s.inputGroup}>
                  <Text style={s.inputLabel}>TRUTH #1</Text>
                  <TextInput style={s.input} value={mpFacts[0]} onChangeText={v => setMpFacts(f => [v, f[1], f[2]])} placeholder="A true fact…" placeholderTextColor="#333" multiline />
                </View>
                <View style={s.inputGroup}>
                  <Text style={s.inputLabel}>TRUTH #2</Text>
                  <TextInput style={s.input} value={mpFacts[1]} onChangeText={v => setMpFacts(f => [f[0], v, f[2]])} placeholder="Another true fact…" placeholderTextColor="#333" multiline />
                </View>
                <View style={s.inputGroup}>
                  <Text style={[s.inputLabel, { color: "#dc2626" }]}>🤥 THE LIE</Text>
                  <TextInput style={[s.input, { borderColor: "rgba(220,38,38,0.3)" }]} value={mpFacts[2]} onChangeText={v => setMpFacts(f => [f[0], f[1], v])} placeholder="A convincing lie…" placeholderTextColor="#333" multiline />
                </View>
                {!hasSubmitted ? (
                  <TouchableOpacity
                    style={[s.startBtn, { marginHorizontal: 20 }]}
                    onPress={() => {
                      if (mpFacts[0].trim() && mpFacts[1].trim() && mpFacts[2].trim()) {
                        setHasSubmitted(true);
                        sendAction("submit_facts", { facts: mpFacts });
                      }
                    }}
                  >
                    <LinearGradient colors={["#b5179e","#7209b7"]} style={s.startBtnInner}>
                      <Text style={s.startBtnText}>SUBMIT →</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                ) : (
                  <Text style={s.waitText}>Waiting for others to vote…</Text>
                )}
              </SafeAreaView>
            </LinearGradient>
          </KeyboardAvoidingView>
        );
      }
      return (
        <LinearGradient colors={["#03001c","#0a001a"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
            <View style={s.center}>
              <Text style={{ fontSize: 64 }}>🤥</Text>
              <Text style={{ color: "#fff", fontSize: 20, fontWeight: "800", textAlign: "center", marginBottom: 12 }}>
                Waiting for {memberName(mp.currentSubmitter)} to submit facts…
              </Text>
            </View>
          </SafeAreaView>
        </LinearGradient>
      );
    }
  }

  function startGame() {
    setRounds(pickRounds());
    setPhase("submit");
    setFact1(""); setFact2(""); setLie("");
    setSubmitted(false);
    setScore(0);
    setRoundIdx(0);
    setLog([]);
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }

  function submitFacts() {
    if (!fact1.trim() || !fact2.trim() || !lie.trim()) return;
    setSubmitted(true);
    setTimeout(() => {
      setPhase("vote");
      setVoteIdx(null);
    }, 800);
  }

  function castVote(idx: number) {
    setVoteIdx(idx);
  }

  function revealAnswer() {
    if (voteIdx === null) return;
    const player = rounds[roundIdx];
    const correct = voteIdx === player.lie;
    setScore((s) => s + (correct ? 300 : 0));
    setLog((l) => [...l, { correct, lieWas: player.facts[player.lie] }]);
    setPhase("reveal");
  }

  function nextRound() {
    if (roundIdx + 1 >= rounds.length) {
      setPhase("results");
    } else {
      setRoundIdx((r) => r + 1);
      setVoteIdx(null);
      setPhase("vote");
    }
  }

  if (phase === "lobby") {
    return (
      <LinearGradient colors={["#03001c", "#0a001a"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <TouchableOpacity style={s.back} onPress={() => router.back()}>
            <Text style={s.backText}>← Back</Text>
          </TouchableOpacity>
          <View style={s.center}>
            <Text style={{ fontSize: 72, marginBottom: 16 }}>🤥</Text>
            <Text style={s.title}>2 Truths 1 Lie</Text>
            <Text style={s.sub}>Submit three "facts" about yourself — two true, one fake. Others vote on which is the lie.</Text>
            <View style={s.rulesBox}>
              <Text style={s.ruleItem}>• Write 2 truths + 1 convincing lie</Text>
              <Text style={s.ruleItem}>• +300 pts for spotting someone else's lie</Text>
              <Text style={s.ruleItem}>• +200 pts if no one spots your lie</Text>
              <Text style={s.ruleItem}>• 3 rounds total</Text>
            </View>
            <TouchableOpacity style={s.startBtn} onPress={startGame}>
              <LinearGradient colors={["#b5179e", "#7209b7"]} style={s.startBtnInner}>
                <Text style={s.startBtnText}>START</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (phase === "results") {
    return (
      <PostGameCard
        score={score}
        maxScore={300}
        gameEmoji="🤥"
        gameTitle="Two Truths One Lie"
        onPlayAgain={startGame}
      />
    );
  }

  if (phase === "submit") {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.flex}>
        <LinearGradient colors={["#03001c", "#0a001a"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
            <Animated.View style={[{ flex: 1, opacity: fadeAnim }]}>
              <Text style={s.submitTitle}>Your Turn!</Text>
              <Text style={s.submitSub}>Write 2 true facts and 1 convincing lie about yourself</Text>
              <View style={s.inputGroup}>
                <Text style={s.inputLabel}>TRUTH #1</Text>
                <TextInput style={s.input} value={fact1} onChangeText={setFact1} placeholder="A true fact about you…" placeholderTextColor="#333" multiline />
              </View>
              <View style={s.inputGroup}>
                <Text style={s.inputLabel}>TRUTH #2</Text>
                <TextInput style={s.input} value={fact2} onChangeText={setFact2} placeholder="Another true fact…" placeholderTextColor="#333" multiline />
              </View>
              <View style={s.inputGroup}>
                <Text style={[s.inputLabel, { color: "#dc2626" }]}>🤥 THE LIE</Text>
                <TextInput style={[s.input, { borderColor: "rgba(220,38,38,0.3)" }]} value={lie} onChangeText={setLie} placeholder="A convincing lie…" placeholderTextColor="#333" multiline />
              </View>
              {!submitted ? (
                <TouchableOpacity style={[s.startBtn, { marginHorizontal: 20 }]} onPress={submitFacts}>
                  <LinearGradient colors={["#b5179e", "#7209b7"]} style={s.startBtnInner}>
                    <Text style={s.startBtnText}>SUBMIT →</Text>
                  </LinearGradient>
                </TouchableOpacity>
              ) : (
                <Text style={s.waitText}>Waiting for others…</Text>
              )}
            </Animated.View>
          </SafeAreaView>
        </LinearGradient>
      </KeyboardAvoidingView>
    );
  }

  if (phase === "vote") {
    const player = rounds[roundIdx] ?? rounds[0];
    return (
      <LinearGradient colors={["#03001c", "#0a001a"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <View style={s.voteHeader}>
            <Text style={s.votePlayerName}>{player.name}'s facts:</Text>
            <Text style={s.voteInstruction}>Which one is the LIE?</Text>
          </View>
          <View style={s.voteOptions}>
            {player.facts.map((fact, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => castVote(i)}
                activeOpacity={0.85}
                style={[s.factCard, voteIdx === i && s.selectedFact]}
              >
                <LinearGradient
                  colors={voteIdx === i ? ["#7f1d1d", "#991b1b"] : ["#1a1a3a", "#2a1a4a"]}
                  style={s.factCardInner}
                >
                  <Text style={s.factLetter}>{["A", "B", "C"][i]}</Text>
                  <Text style={s.factText}>{fact}</Text>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
          {voteIdx !== null && (
            <View style={{ padding: 20 }}>
              <TouchableOpacity style={s.startBtn} onPress={revealAnswer}>
                <LinearGradient colors={["#b5179e", "#7209b7"]} style={s.startBtnInner}>
                  <Text style={s.startBtnText}>REVEAL →</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </SafeAreaView>
      </LinearGradient>
    );
  }

  if (phase === "reveal") {
    const player = rounds[roundIdx] ?? rounds[0];
    const correct = voteIdx === player.lie;
    return (
      <LinearGradient colors={["#03001c", "#0a001a"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <View style={s.center}>
            <Text style={{ fontSize: 64 }}>{correct ? "✓" : "✗"}</Text>
            <Text style={[s.title, { color: correct ? "#4ade80" : "#f87171" }]}>
              {correct ? "You caught it!" : "Fooled!"}
            </Text>
            <View style={s.lieReveal}>
              <Text style={s.lieRevealLabel}>THE LIE WAS:</Text>
              <Text style={s.lieRevealText}>"{player.facts[player.lie]}"</Text>
            </View>
            <Text style={s.ptsEarned}>{correct ? "+300 pts" : "+0 pts"}</Text>
            <TouchableOpacity style={s.startBtn} onPress={nextRound}>
              <LinearGradient colors={["#b5179e", "#7209b7"]} style={s.startBtnInner}>
                <Text style={s.startBtnText}>{roundIdx + 1 >= rounds.length ? "See Results" : "Next Round →"}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return null;
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  back: { padding: 16, paddingTop: 8 },
  backText: { color: "#a78bfa", fontSize: 16, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  title: { color: "#fff", fontSize: 32, fontWeight: "900", marginBottom: 8, textAlign: "center" },
  sub: { color: "#888", fontSize: 13, textAlign: "center", marginBottom: 24 },
  rulesBox: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 16, padding: 16, width: "100%", marginBottom: 32 },
  ruleItem: { color: "#ccc", fontSize: 14, marginBottom: 6 },
  startBtn: { borderRadius: 14, overflow: "hidden", marginBottom: 12 },
  startBtnInner: { padding: 18, alignItems: "center" },
  startBtnText: { color: "#fff", fontSize: 17, fontWeight: "900", letterSpacing: 1 },
  homeBtn: { padding: 12, alignItems: "center" },
  homeBtnText: { color: "#666", fontSize: 15 },

  submitTitle: { color: "#fff", fontSize: 24, fontWeight: "900", padding: 20, paddingBottom: 4 },
  submitSub: { color: "#888", fontSize: 13, paddingHorizontal: 20, marginBottom: 20 },
  inputGroup: { paddingHorizontal: 20, marginBottom: 16 },
  inputLabel: { color: "#16a34a", fontSize: 10, fontWeight: "900", letterSpacing: 1.5, marginBottom: 6 },
  input: { backgroundColor: "#1a1a3a", borderRadius: 12, padding: 14, color: "#fff", fontSize: 15, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  waitText: { color: "#888", fontSize: 15, textAlign: "center", padding: 20 },

  voteHeader: { padding: 20, paddingBottom: 12 },
  votePlayerName: { color: "#fff", fontSize: 22, fontWeight: "900" },
  voteInstruction: { color: "#dc2626", fontSize: 14, fontWeight: "700", marginTop: 4 },
  voteOptions: { paddingHorizontal: 20, gap: 12, flex: 1 },
  factCard: { borderRadius: 16, overflow: "hidden" },
  selectedFact: { shadowColor: "#dc2626", shadowRadius: 12, shadowOpacity: 0.5, elevation: 8 },
  factCardInner: { flexDirection: "row", padding: 18, alignItems: "center", gap: 12 },
  factLetter: { color: "#a78bfa", fontSize: 18, fontWeight: "900", width: 28 },
  factText: { color: "#fff", fontSize: 15, fontWeight: "600", flex: 1, lineHeight: 22 },

  lieReveal: { backgroundColor: "rgba(220,38,38,0.15)", borderRadius: 14, padding: 20, width: "100%", marginBottom: 16 },
  lieRevealLabel: { color: "#dc2626", fontSize: 11, fontWeight: "900", letterSpacing: 1.5, marginBottom: 6 },
  lieRevealText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  ptsEarned: { color: "#b5179e", fontSize: 24, fontWeight: "900", marginBottom: 32 },

  resultsScroll: { padding: 24, alignItems: "center" },
  resultsTitle: { color: "#fff", fontSize: 28, fontWeight: "900", marginBottom: 12 },
  bigScore: { color: "#b5179e", fontSize: 72, fontWeight: "900" },
  scoreLabel: { color: "#555", fontSize: 12, letterSpacing: 2, marginBottom: 12 },
  verdict: { color: "#a78bfa", fontSize: 16, fontWeight: "700", marginBottom: 24 },
  logRow: { borderLeftWidth: 3, paddingLeft: 12, marginBottom: 12, flexDirection: "row", gap: 8, width: "100%" },
  logEmoji: { fontSize: 16 },
  logText: { color: "#ccc", fontSize: 13, flex: 1 },
});
