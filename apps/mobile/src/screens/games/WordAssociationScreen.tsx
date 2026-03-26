import React, { useState, useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Animated, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useRoom } from "../../contexts/RoomContext";

const SEED_WORDS = ["OCEAN", "FIRE", "CASTLE", "MUSIC", "CLOUD", "THUNDER", "PIZZA", "DREAM", "MIRROR", "JUNGLE"];

type Phase = "lobby" | "playing" | "results";

export default function WordAssociationScreen() {
  const router = useRouter();
  const { state, sendAction } = useRoom();
  const inRoom = !!state.room;
  const mpState = state.guestViewData as any;

  const [phase, setPhase] = useState<Phase>("lobby");
  const [seed, setSeed] = useState("");
  const [chain, setChain] = useState<{ word: string; player: string }[]>([]);
  const [input, setInput] = useState("");
  const [score, setScore] = useState(0);
  const [timer, setTimer] = useState(5);
  const [round, setRound] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const barAnim = useRef(new Animated.Value(1)).current;

  const PLAYERS = ["You", "Alex", "Jordan", "Sam"];
  const RESPONSES = ["Mountain", "Hot", "King", "Beat", "Rain", "Storm", "Cheese", "Night", "Dark", "Wild"];

  function startGame() {
    const s = SEED_WORDS[Math.floor(Math.random() * SEED_WORDS.length)];
    setSeed(s);
    setChain([{ word: s, player: "HOST" }]);
    setInput("");
    setScore(0);
    setRound(0);
    setPhase("playing");
    startTimer();
  }

  function startTimer() {
    setTimer(5);
    barAnim.setValue(1);
    clearInterval(timerRef.current!);
    Animated.timing(barAnim, { toValue: 0, duration: 5000, useNativeDriver: false }).start();
    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) { clearInterval(timerRef.current!); addAutoResponse(); return 5; }
        return t - 1;
      });
    }, 1000);
  }

  function addAutoResponse() {
    const resp = RESPONSES[Math.floor(Math.random() * RESPONSES.length)];
    const pl = PLAYERS[Math.floor(Math.random() * (PLAYERS.length - 1)) + 1];
    setChain((c) => [...c, { word: resp, player: pl }]);
    setRound((r) => {
      if (r + 1 >= 8) { setPhase("results"); return r + 1; }
      return r + 1;
    });
    startTimer();
  }

  function submitWord() {
    if (!input.trim()) return;
    clearInterval(timerRef.current!);
    setChain((c) => [...c, { word: input.trim().toUpperCase(), player: "You" }]);
    setScore((s) => s + 150);
    setInput("");
    setRound((r) => {
      if (r + 1 >= 8) { setPhase("results"); return r + 1; }
      return r + 1;
    });
    startTimer();
  }

  useEffect(() => () => clearInterval(timerRef.current!), []);

  const [mpInput, setMpInput] = React.useState("");

  // ─── Multiplayer block ────────────────────────────────────────────────────
  if (inRoom && mpState) {
    const mpPhase: string = mpState.phase ?? "waiting";
    const mpChain: { word: string; playerId: string; playerName?: string }[] = mpState.chain ?? [];
    const currentTurn: string = mpState.currentTurn ?? "";
    const scores: Record<string, number> = mpState.scores ?? {};
    const myGuestId = state.guestId ?? "";
    const isMyTurn = myGuestId === currentTurn;

    if (mpPhase === "waiting") {
      return (
        <LinearGradient colors={["#03001c", "#001020"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
            <View style={s.center}>
              <Text style={{ fontSize: 64 }}>💬</Text>
              <Text style={s.title}>Word Association</Text>
              <Text style={s.sub}>Waiting for the host to start…</Text>
            </View>
          </SafeAreaView>
        </LinearGradient>
      );
    }

    if (mpPhase === "finished") {
      const sortedScores = Object.entries(scores).sort(([, a], [, b]) => b - a);
      return (
        <LinearGradient colors={["#03001c", "#001020"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
            <View style={s.center}>
              <Text style={{ fontSize: 64 }}>🏆</Text>
              <Text style={s.title}>Chain Complete!</Text>
              <View style={s.chainBox}>
                {mpChain.slice(-6).map((c, i) => (
                  <Text key={i} style={s.chainItem}>
                    {c.word} <Text style={s.chainPlayer}>({c.playerName ?? c.playerId})</Text>
                  </Text>
                ))}
              </View>
              <View style={{ width: "100%", marginTop: 16 }}>
                {sortedScores.map(([id, pts], i) => (
                  <View key={id} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#1e1e3a" }}>
                    <Text style={{ color: id === myGuestId ? "#b5179e" : "#ccc", fontSize: 15, fontWeight: "700" }}>
                      {i + 1}. {id === myGuestId ? "You" : (id)}
                    </Text>
                    <Text style={{ color: "#a78bfa", fontWeight: "800" }}>{pts} pts</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity style={s.homeBtn} onPress={() => router.back()}>
                <Text style={s.homeBtnText}>Back to Home</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </LinearGradient>
      );
    }

    // playing phase
    const lastWord = mpChain[mpChain.length - 1];
    return (
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.flex}>
        <LinearGradient colors={["#03001c", "#001020"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
            <View style={s.chainScroll}>
              {mpChain.slice(-5).map((c, i) => (
                <View key={i} style={[s.chainRow, i === mpChain.slice(-5).length - 1 && s.chainRowActive]}>
                  <Text style={[s.chainWord, i === mpChain.slice(-5).length - 1 && s.chainWordActive]}>{c.word}</Text>
                  <Text style={s.chainWho}>{c.playerName ?? c.playerId}</Text>
                </View>
              ))}
            </View>
            {isMyTurn ? (
              <View style={s.inputRow}>
                <TextInput
                  style={s.input}
                  value={mpInput}
                  onChangeText={setMpInput}
                  placeholder="Your word…"
                  placeholderTextColor="#333"
                  autoCapitalize="characters"
                  autoFocus
                  onSubmitEditing={() => {
                    if (!mpInput.trim()) return;
                    sendAction("submit_word", { word: mpInput.trim() });
                    setMpInput("");
                  }}
                />
                <TouchableOpacity
                  style={s.goBtn}
                  onPress={() => {
                    if (!mpInput.trim()) return;
                    sendAction("submit_word", { word: mpInput.trim() });
                    setMpInput("");
                  }}
                >
                  <LinearGradient colors={["#b5179e", "#7209b7"]} style={s.goBtnInner}>
                    <Text style={s.goBtnText}>→</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={s.waitBox}>
                <Text style={s.waitText}>⏳ Waiting for {currentTurn === "" ? "next player" : currentTurn}…</Text>
              </View>
            )}
            <View style={s.scoreBar}>
              <Text style={s.scoreText}>Your score: {scores[myGuestId] ?? 0}</Text>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </KeyboardAvoidingView>
    );
  }
  // ─── End multiplayer block ────────────────────────────────────────────────

  if (phase === "lobby") return (
    <LinearGradient colors={["#03001c", "#001020"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}><Text style={s.backText}>← Back</Text></TouchableOpacity>
        <View style={s.center}>
          <Text style={{ fontSize: 64 }}>💬</Text>
          <Text style={s.title}>Word Association</Text>
          <Text style={s.sub}>A word appears. Respond with the first word that comes to mind — build a chain. 5 seconds each!</Text>
          <TouchableOpacity style={s.btn} onPress={startGame}><LinearGradient colors={["#b5179e","#7209b7"]} style={s.btnInner}><Text style={s.btnText}>START</Text></LinearGradient></TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );

  if (phase === "results") return (
    <LinearGradient colors={["#03001c","#001020"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <View style={s.center}>
          <Text style={{ fontSize: 64 }}>💬</Text>
          <Text style={s.title}>Chain Complete!</Text>
          <Text style={s.bigScore}>{score}</Text>
          <Text style={s.label}>POINTS</Text>
          <View style={s.chainBox}>{chain.map((c,i) => <Text key={i} style={s.chainItem}>{c.word} <Text style={s.chainPlayer}>({c.player})</Text></Text>)}</View>
          <TouchableOpacity style={s.btn} onPress={startGame}><LinearGradient colors={["#b5179e","#7209b7"]} style={s.btnInner}><Text style={s.btnText}>PLAY AGAIN</Text></LinearGradient></TouchableOpacity>
          <TouchableOpacity style={s.homeBtn} onPress={() => router.back()}><Text style={s.homeBtnText}>Back to Home</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );

  const currentWord = chain[chain.length - 1];
  const isMyTurn = round % 4 === 0;
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.flex}>
      <LinearGradient colors={["#03001c","#001020"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <View style={s.timerRow}>
            <View style={s.timerTrack}><Animated.View style={[s.timerFill, { width: barAnim.interpolate({ inputRange:[0,1], outputRange:["0%","100%"] }) }]} /></View>
            <Text style={s.timerNum}>{timer}s</Text>
          </View>
          <View style={s.chainScroll}>
            {chain.slice(-5).map((c, i) => (
              <View key={i} style={[s.chainRow, i === chain.slice(-5).length - 1 && s.chainRowActive]}>
                <Text style={[s.chainWord, i === chain.slice(-5).length - 1 && s.chainWordActive]}>{c.word}</Text>
                <Text style={s.chainWho}>{c.player}</Text>
              </View>
            ))}
          </View>
          {isMyTurn ? (
            <View style={s.inputRow}>
              <TextInput style={s.input} value={input} onChangeText={setInput} placeholder="Your word…" placeholderTextColor="#333" autoCapitalize="characters" onSubmitEditing={submitWord} autoFocus />
              <TouchableOpacity style={s.goBtn} onPress={submitWord}><LinearGradient colors={["#b5179e","#7209b7"]} style={s.goBtnInner}><Text style={s.goBtnText}>→</Text></LinearGradient></TouchableOpacity>
            </View>
          ) : (
            <View style={s.waitBox}><Text style={s.waitText}>⏳ Waiting for {PLAYERS[(round % 4)]}…</Text></View>
          )}
          <View style={s.scoreBar}><Text style={s.scoreText}>Score: {score}</Text></View>
        </SafeAreaView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex:{flex:1}, back:{padding:16,paddingTop:8}, backText:{color:"#a78bfa",fontSize:16,fontWeight:"700"},
  center:{flex:1,alignItems:"center",justifyContent:"center",paddingHorizontal:24},
  title:{color:"#fff",fontSize:30,fontWeight:"900",marginBottom:8,textAlign:"center"},
  sub:{color:"#888",fontSize:13,textAlign:"center",marginBottom:24},
  btn:{width:"100%",borderRadius:14,overflow:"hidden",marginBottom:12},
  btnInner:{padding:18,alignItems:"center"}, btnText:{color:"#fff",fontSize:17,fontWeight:"900"},
  homeBtn:{padding:12}, homeBtnText:{color:"#666",fontSize:15},
  bigScore:{color:"#b5179e",fontSize:64,fontWeight:"900"}, label:{color:"#555",fontSize:12,letterSpacing:2,marginBottom:16},
  chainBox:{width:"100%",marginBottom:24},
  chainItem:{color:"#ccc",fontSize:14,textAlign:"center",marginBottom:4},
  chainPlayer:{color:"#555",fontSize:12},
  timerRow:{flexDirection:"row",alignItems:"center",paddingHorizontal:20,paddingVertical:12,gap:12},
  timerTrack:{flex:1,height:6,backgroundColor:"#1e1e3a",borderRadius:3,overflow:"hidden"},
  timerFill:{height:"100%",backgroundColor:"#b5179e",borderRadius:3},
  timerNum:{color:"#fff",fontSize:15,fontWeight:"900",width:32},
  chainScroll:{flex:1,paddingHorizontal:20,justifyContent:"flex-end",paddingBottom:16},
  chainRow:{flexDirection:"row",justifyContent:"space-between",paddingVertical:8,borderBottomWidth:1,borderBottomColor:"#1e1e3a"},
  chainRowActive:{backgroundColor:"rgba(181,23,158,0.1)",borderRadius:8,paddingHorizontal:8},
  chainWord:{color:"#888",fontSize:18,fontWeight:"700"}, chainWordActive:{color:"#fff",fontSize:24,fontWeight:"900"},
  chainWho:{color:"#555",fontSize:12,alignSelf:"center"},
  inputRow:{flexDirection:"row",paddingHorizontal:20,gap:10,marginBottom:8},
  input:{flex:1,backgroundColor:"#1a1a3a",borderRadius:14,paddingHorizontal:16,paddingVertical:14,color:"#fff",fontSize:18,fontWeight:"900"},
  goBtn:{borderRadius:14,overflow:"hidden"}, goBtnInner:{width:52,height:52,alignItems:"center",justifyContent:"center"},
  goBtnText:{color:"#fff",fontSize:20,fontWeight:"900"},
  waitBox:{padding:20,alignItems:"center"}, waitText:{color:"#888",fontSize:15},
  scoreBar:{padding:16,alignItems:"center"}, scoreText:{color:"#a78bfa",fontSize:15,fontWeight:"800"},
});
