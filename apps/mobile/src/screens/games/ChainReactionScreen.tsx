import React, { useState, useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Animated, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useRoom } from "../../contexts/RoomContext";
import { PostGameCard } from "../../components/shared/PostGameCard";

// Chain Reaction: each word must start with the last letter of previous word
type Phase = "lobby" | "playing" | "results";

const CATEGORIES = ["Animals", "Countries", "Foods", "Movies", "Cities", "Sports", "Colors"];
const SEED_WORDS: Record<string, string> = {
  Animals: "Elephant", Countries: "Italy", Foods: "Nachos", Movies: "Inception",
  Cities: "Tokyo", Sports: "Rowing", Colors: "Yellow",
};
const BOT_WORDS: Record<string, string[]> = {
  Animals: ["Tiger","Rabbit","Turtle","Elephant","Narwhal","Lion","Newt","Toad","Dog","Gorilla"],
  Countries: ["Yemen","Nepal","Libya","Algeria","Argentina","Albania","Angola","Australia"],
  Foods: ["Spaghetti","Ice cream","Mango","Onion","Noodles","Salmon","Nectarine","Egg"],
  Movies: ["Nope","Elf","Frozen","Nomadland","Dune","Encanto","Oppenheimer","Rushmore"],
  Cities: ["Oslo","Osaka","Amsterdam","Moscow","Wellington","Nairobi","Istanbul"],
  Sports: ["Golf","Football","Tennis","Squash","Handball","Luge","Equestrian"],
  Colors: ["Red","Denim","Navy","Yellow","Walnut","Tan","Neon"],
};

export default function ChainReactionScreen() {
  const router = useRouter();
  const { state, sendAction } = useRoom();
  const startedInRoom = useRef(!!state.room);
  const inRoom = startedInRoom.current && !!state.room;
  const mpState = inRoom ? (state.guestViewData as any) : null;

  const [phase, setPhase] = useState<Phase>("lobby");
  const [category, setCategory] = useState("Animals");
  const [chain, setChain] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [timer, setTimer] = useState(8);
  const [score, setScore] = useState(0);
  const [error, setError] = useState("");
  const [turn, setTurn] = useState(0);
  const [botUsed, setBotUsed] = useState<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const barAnim = useRef(new Animated.Value(1)).current;
  const errorAnim = useRef(new Animated.Value(0)).current;
  const MAX_CHAIN = 12;
  const PLAYERS = ["You", "Alex", "Jordan"];

  function startGame(cat: string) {
    setPhase("playing"); setCategory(cat);
    const seed = SEED_WORDS[cat];
    setChain([seed]); setInput(""); setTurn(0); setScore(0); setBotUsed([]);
    setError(""); startTimer(0);
  }

  function startTimer(t: number) {
    setTimer(8); barAnim.setValue(1);
    Animated.timing(barAnim, { toValue: 0, duration: 8000, useNativeDriver: false }).start();
    clearInterval(timerRef.current!);
    timerRef.current = setInterval(() => {
      setTimer((tm) => {
        if (tm <= 1) { clearInterval(timerRef.current!); botPlay(t); return 0; }
        return tm - 1;
      });
    }, 1000);
  }

  function botPlay(t: number) {
    const lastChar = chain[chain.length - 1]?.slice(-1).toUpperCase() ?? "A";
    const available = (BOT_WORDS[category] ?? []).filter((w) => w[0].toUpperCase() === lastChar && !botUsed.includes(w));
    const word = available[0] ?? (lastChar + "uess");
    setBotUsed((b) => [...b, word]);
    addWord(word, t + 1);
  }

  function submit() {
    const word = input.trim();
    if (!word) return;
    const last = chain[chain.length - 1];
    const lastChar = last.slice(-1).toLowerCase();
    if (word[0].toLowerCase() !== lastChar) {
      showError(`"${word}" must start with "${lastChar.toUpperCase()}"`);
      return;
    }
    clearInterval(timerRef.current!); barAnim.stopAnimation();
    setScore((s) => s + 100 + timer * 15);
    setInput("");
    addWord(word, turn + 1);
  }

  function addWord(word: string, newTurn: number) {
    setChain((c) => {
      const next = [...c, word];
      if (next.length >= MAX_CHAIN) { setPhase("results"); return next; }
      return next;
    });
    setTurn(newTurn);
    if (newTurn % PLAYERS.length !== 0) setTimeout(() => botPlay(newTurn), 600);
    else startTimer(newTurn);
  }

  function showError(msg: string) {
    setError(msg);
    errorAnim.setValue(0);
    Animated.spring(errorAnim, { toValue: 1, useNativeDriver: true, damping: 10 }).start();
    setTimeout(() => setError(""), 2000);
  }

  useEffect(() => () => clearInterval(timerRef.current!), []);

  const [mpInput, setMpInput] = React.useState("");
  const [mpError, setMpError] = React.useState("");

  // ─── Multiplayer block ────────────────────────────────────────────────────
  if (inRoom && mpState) {
    const mpPhase: string = mpState.phase ?? "waiting";
    const mpChain: string[] = mpState.chain ?? [];
    const currentTurn: string = mpState.currentTurn ?? "";
    const mpCategory: string = mpState.category ?? "";
    const scores: Record<string, number> = mpState.scores ?? {};
    const myGuestId = state.guestId ?? "";
    const isMyTurn = myGuestId === currentTurn;
    const lastWord = mpChain[mpChain.length - 1] ?? "";
    const requiredLetter = lastWord.slice(-1).toUpperCase();

    if (mpPhase === "waiting") {
      return (
        <LinearGradient colors={["#03001c", "#002010"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
            <View style={s.center}>
              <Text style={{ fontSize: 64 }}>🔗⚡</Text>
              <Text style={s.title}>Chain Reaction</Text>
              <Text style={s.sub}>Waiting for the host to start…</Text>
            </View>
          </SafeAreaView>
        </LinearGradient>
      );
    }

    if (mpPhase === "finished") {
      const sortedScores = Object.entries(scores).sort(([, a], [, b]) => b - a);
      return (
        <LinearGradient colors={["#03001c", "#002010"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
            <View style={s.center}>
              <Text style={{ fontSize: 64 }}>🔗</Text>
              <Text style={s.title}>Chain Complete!</Text>
              <Text style={s.label}>{mpChain.length} word chain · {mpCategory}</Text>
              <View style={s.chainDisplay}>
                {mpChain.map((w, i) => (
                  <Text key={i} style={s.chainWord}>{w}{i < mpChain.length - 1 ? " → " : ""}</Text>
                ))}
              </View>
              <View style={{ width: "100%", marginTop: 16 }}>
                {sortedScores.map(([id, pts], i) => (
                  <View key={id} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#1e1e3a" }}>
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

    // playing phase
    return (
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.flex}>
        <LinearGradient colors={["#03001c", "#002010"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
            <View style={s.topBar}>
              <Text style={s.catLabel}>{mpCategory}</Text>
              <Text style={s.chainCount}>{mpChain.length}/{MAX_CHAIN}</Text>
              <Text style={s.scoreC}>{scores[myGuestId] ?? 0} pts</Text>
            </View>
            <View style={s.chainBox}>
              {mpChain.slice(-5).map((w, i) => (
                <Text key={i} style={[s.chainItem, i === mpChain.slice(-5).length - 1 && s.chainItemLast]}>{w}</Text>
              ))}
            </View>
            <View style={s.requiredBox}>
              <Text style={s.reqLabel}>Next word must start with:</Text>
              <Text style={s.reqLetter}>{requiredLetter}</Text>
            </View>
            {mpError ? (
              <View style={s.errorBox}><Text style={s.errorText}>{mpError}</Text></View>
            ) : null}
            {isMyTurn ? (
              <View style={s.inputRow}>
                <TextInput
                  style={s.input}
                  value={mpInput}
                  onChangeText={setMpInput}
                  placeholder={`${requiredLetter}…`}
                  placeholderTextColor="#333"
                  autoCapitalize="words"
                  autoCorrect={false}
                  autoFocus
                  onSubmitEditing={() => {
                    const word = mpInput.trim();
                    if (!word) return;
                    if (word[0].toUpperCase() !== requiredLetter) {
                      setMpError(`"${word}" must start with "${requiredLetter}"`);
                      setTimeout(() => setMpError(""), 2000);
                      return;
                    }
                    sendAction("submit_word", { word });
                    setMpInput("");
                  }}
                />
                <TouchableOpacity
                  style={s.goBtn}
                  onPress={() => {
                    const word = mpInput.trim();
                    if (!word) return;
                    if (word[0].toUpperCase() !== requiredLetter) {
                      setMpError(`"${word}" must start with "${requiredLetter}"`);
                      setTimeout(() => setMpError(""), 2000);
                      return;
                    }
                    sendAction("submit_word", { word });
                    setMpInput("");
                  }}
                >
                  <LinearGradient colors={["#b5179e", "#7209b7"]} style={s.goBtnI}>
                    <Text style={s.goBtnT}>→</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={s.waitRow}>
                <Text style={s.waitText}>⏳ Waiting for {currentTurn}…</Text>
              </View>
            )}
          </SafeAreaView>
        </LinearGradient>
      </KeyboardAvoidingView>
    );
  }
  // ─── End multiplayer block ────────────────────────────────────────────────

  const isMyTurn = turn % PLAYERS.length === 0;
  const lastWord = chain[chain.length - 1] ?? "";
  const requiredLetter = lastWord.slice(-1).toUpperCase();

  if (phase === "lobby") return (
    <LinearGradient colors={["#03001c","#002010"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}><Text style={s.backText}>← Back</Text></TouchableOpacity>
        <View style={s.center}>
          <Text style={{ fontSize: 64 }}>🔗⚡</Text>
          <Text style={s.title}>Chain Reaction</Text>
          <Text style={s.sub}>Each word must start with the last letter of the previous word. Pick a category!</Text>
          <View style={s.catGrid}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity key={cat} onPress={() => startGame(cat)} style={s.catBtn} activeOpacity={0.85}>
                <LinearGradient colors={["#1a1a3a","#2a1a4a"]} style={s.catBtnI}><Text style={s.catBtnT}>{cat}</Text></LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );

  if (phase === "results") return (
    <PostGameCard
      score={score}
      maxScore={800}
      gameEmoji="⚡"
      gameTitle="Chain Reaction"
      onPlayAgain={() => setPhase("lobby")}
    />
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.flex}>
      <LinearGradient colors={["#03001c","#002010"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <View style={s.topBar}>
            <Text style={s.catLabel}>{category}</Text>
            <Text style={s.chainCount}>{chain.length}/{MAX_CHAIN}</Text>
            <Text style={s.scoreC}>{score} pts</Text>
          </View>
          <View style={s.timerRow}>
            <View style={s.timerTrack}><Animated.View style={[s.timerFill, { width: barAnim.interpolate({ inputRange:[0,1], outputRange:["0%","100%"] }) }]} /></View>
          </View>
          <View style={s.chainBox}>
            {chain.slice(-5).map((w, i) => (
              <Text key={i} style={[s.chainItem, i === chain.slice(-5).length - 1 && s.chainItemLast]}>{w}</Text>
            ))}
          </View>
          <View style={s.requiredBox}>
            <Text style={s.reqLabel}>Next word must start with:</Text>
            <Text style={s.reqLetter}>{requiredLetter}</Text>
          </View>
          {error ? (
            <Animated.View style={[s.errorBox, { transform: [{ scale: errorAnim }] }]}>
              <Text style={s.errorText}>{error}</Text>
            </Animated.View>
          ) : null}
          {isMyTurn ? (
            <View style={s.inputRow}>
              <TextInput style={s.input} value={input} onChangeText={setInput} placeholder={`${requiredLetter}…`} placeholderTextColor="#333" autoCapitalize="words" autoCorrect={false} onSubmitEditing={submit} autoFocus />
              <TouchableOpacity style={s.goBtn} onPress={submit}><LinearGradient colors={["#b5179e","#7209b7"]} style={s.goBtnI}><Text style={s.goBtnT}>→</Text></LinearGradient></TouchableOpacity>
            </View>
          ) : (
            <View style={s.waitRow}><Text style={s.waitText}>⏳ {PLAYERS[turn % PLAYERS.length]} is thinking…</Text></View>
          )}
        </SafeAreaView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex:{flex:1}, back:{padding:16,paddingTop:8}, backText:{color:"#a78bfa",fontSize:16,fontWeight:"700"},
  center:{flex:1,alignItems:"center",justifyContent:"center",paddingHorizontal:24},
  title:{color:"#fff",fontSize:28,fontWeight:"900",marginBottom:8,textAlign:"center"},
  sub:{color:"#888",fontSize:13,textAlign:"center",marginBottom:20},
  catGrid:{flexDirection:"row",flexWrap:"wrap",gap:8,width:"100%",justifyContent:"center"},
  catBtn:{borderRadius:12,overflow:"hidden"},
  catBtnI:{paddingHorizontal:16,paddingVertical:12}, catBtnT:{color:"#fff",fontSize:14,fontWeight:"700"},
  btn:{width:"100%",borderRadius:14,overflow:"hidden",marginBottom:12},
  btnI:{padding:18,alignItems:"center"}, btnT:{color:"#fff",fontSize:17,fontWeight:"900"},
  homeBtn:{padding:12}, homeBtnT:{color:"#666",fontSize:15},
  bigScore:{color:"#b5179e",fontSize:64,fontWeight:"900"}, label:{color:"#555",fontSize:12,marginBottom:12},
  chainDisplay:{flexDirection:"row",flexWrap:"wrap",marginBottom:24,justifyContent:"center"},
  chainWord:{color:"#888",fontSize:13},
  topBar:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",paddingHorizontal:20,paddingVertical:10},
  catLabel:{color:"#a78bfa",fontWeight:"800"}, chainCount:{color:"#888",fontWeight:"700"}, scoreC:{color:"#a78bfa",fontWeight:"800"},
  timerRow:{paddingHorizontal:20,marginBottom:8},
  timerTrack:{height:4,backgroundColor:"#1e1e3a",borderRadius:2,overflow:"hidden"},
  timerFill:{height:"100%",backgroundColor:"#22d3ee"},
  chainBox:{flex:1,paddingHorizontal:20,justifyContent:"flex-end",paddingBottom:12},
  chainItem:{color:"#666",fontSize:20,textAlign:"center"}, chainItemLast:{color:"#fff",fontSize:28,fontWeight:"900"},
  requiredBox:{alignItems:"center",paddingBottom:8},
  reqLabel:{color:"#555",fontSize:12,fontWeight:"700"}, reqLetter:{color:"#b5179e",fontSize:32,fontWeight:"900"},
  errorBox:{marginHorizontal:20,backgroundColor:"rgba(220,38,38,0.2)",borderRadius:10,padding:10,marginBottom:8},
  errorText:{color:"#f87171",fontSize:13,fontWeight:"700",textAlign:"center"},
  inputRow:{flexDirection:"row",paddingHorizontal:20,gap:10,paddingBottom:16},
  input:{flex:1,backgroundColor:"#1a1a3a",borderRadius:14,paddingHorizontal:16,paddingVertical:12,color:"#fff",fontSize:18,fontWeight:"700"},
  goBtn:{borderRadius:14,overflow:"hidden"}, goBtnI:{width:48,height:48,alignItems:"center",justifyContent:"center"},
  goBtnT:{color:"#fff",fontSize:18,fontWeight:"900"},
  waitRow:{padding:16,alignItems:"center"}, waitText:{color:"#888",fontSize:15},
});
