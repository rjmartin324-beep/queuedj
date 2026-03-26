import React, { useState, useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Animated, TextInput, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useRoom } from "../../contexts/RoomContext";

const STORY_STARTERS = [
  "Once upon a time in a city made of chocolate,",
  "The last spaceship left Earth carrying only",
  "Nobody believed the old man when he said the",
  "The detective opened the door and gasped — inside was",
  "Every Wednesday at midnight, the",
];

const AUTO_WORDS = ["mysterious", "exploded", "jumped", "quickly", "however", "suddenly", "purple", "enormous", "whispered", "laughed", "realized", "impossible", "backwards"];

type Phase = "lobby" | "playing" | "results";

export default function StoryTimeScreen() {
  const router = useRouter();
  const { state, sendAction } = useRoom();
  const inRoom = !!state.room;
  const mpState = state.guestViewData as any;
  const myGuestId = state.guestId;
  function memberName(gId: string) { return state.members.find(m => m.guestId === gId)?.displayName ?? (gId?.slice(0,6) ?? "?"); }
  const [mpWord, setMpWord] = useState("");
  const [phase, setPhase] = useState<Phase>("lobby");
  const [story, setStory] = useState<{ word: string; player: string }[]>([]);
  const [starter, setStarter] = useState("");
  const [word, setWord] = useState("");
  const [timer, setTimer] = useState(5);
  const [turn, setTurn] = useState(0);
  const [score, setScore] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const barAnim = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => () => clearInterval(timerRef.current!), []);

  if (inRoom && mpState) {
    const mp = mpState;

    if (mp.phase === "finished") {
      return (
        <LinearGradient colors={["#03001c","#0a0010"]} style={{flex:1}}>
          <SafeAreaView style={{flex:1}}>
            <ScrollView contentContainerStyle={{padding:24}}>
              {mp.story && (
                <View style={{backgroundColor:"rgba(255,255,255,0.06)",borderRadius:16,padding:20,marginBottom:24}}>
                  <Text style={{color:"#888",fontSize:11,fontWeight:"900",letterSpacing:2,marginBottom:10}}>THE FULL STORY</Text>
                  <Text style={{color:"#ccc",fontSize:16,lineHeight:26}}>{mp.story.join(" ")}</Text>
                </View>
              )}
              <Text style={{color:"#fff",fontSize:24,fontWeight:"900",marginBottom:20,textAlign:"center"}}>Final Scores</Text>
              {Object.entries(mp.scores||{}).sort(([,a],[,b])=>(b as number)-(a as number)).map(([gId,pts],i)=>(
                <View key={gId} style={{flexDirection:"row",justifyContent:"space-between",marginBottom:8}}>
                  <Text style={{color:"#ccc",fontSize:16}}>{i+1}. {memberName(gId)}</Text>
                  <Text style={{color:"#a78bfa",fontSize:16,fontWeight:"700"}}>{pts as number} pts</Text>
                </View>
              ))}
              <TouchableOpacity onPress={()=>router.back()} style={{marginTop:24,padding:12,alignItems:"center"}}>
                <Text style={{color:"#666"}}>← Back</Text>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </LinearGradient>
      );
    }

    if (mp.phase === "playing") {
      const isMyTurn = mp.currentTurn === myGuestId;
      const turnName = memberName(mp.currentTurn ?? "");
      return (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{flex:1}}>
          <LinearGradient colors={["#03001c","#001a10"]} style={{flex:1}}>
            <SafeAreaView style={{flex:1}}>
              <View style={{flexDirection:"row",justifyContent:"space-between",paddingHorizontal:20,paddingVertical:12}}>
                <Text style={{color:"#888",fontWeight:"700"}}>Story Time</Text>
                <Text style={{color:"#a78bfa",fontWeight:"800"}}>{mp.scores?.[myGuestId??""]} pts</Text>
              </View>
              <ScrollView style={{flex:1,paddingHorizontal:20}}>
                {mp.starter && <Text style={{color:"#888",fontSize:14,fontStyle:"italic",marginBottom:8}}>{mp.starter}</Text>}
                <View style={{flexDirection:"row",flexWrap:"wrap",gap:6}}>
                  {(mp.story??[]).map((w:string,i:number)=>(
                    <View key={i} style={{backgroundColor:"#1a1a3a",borderRadius:8,paddingHorizontal:10,paddingVertical:5}}>
                      <Text style={{color:"#aaa",fontSize:14}}>{w}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
              <View style={{padding:12,alignItems:"center"}}>
                <Text style={{color:isMyTurn?"#4ade80":"#888",fontSize:15,fontWeight:"900"}}>
                  {isMyTurn ? "YOUR TURN — add a word!" : `Waiting for ${turnName}…`}
                </Text>
              </View>
              {isMyTurn && (
                <View style={{flexDirection:"row",paddingHorizontal:20,gap:10,marginBottom:16}}>
                  <TextInput
                    style={{flex:1,backgroundColor:"#1a1a3a",borderRadius:14,paddingHorizontal:16,paddingVertical:12,color:"#fff",fontSize:16}}
                    value={mpWord} onChangeText={setMpWord}
                    placeholder="One word…" placeholderTextColor="#333"
                    autoCapitalize="none" autoCorrect={false}
                    onSubmitEditing={()=>{if(mpWord.trim()){sendAction("add_word",{word:mpWord.trim()});setMpWord("");}}}
                  />
                  <TouchableOpacity
                    onPress={()=>{if(mpWord.trim()){sendAction("add_word",{word:mpWord.trim()});setMpWord("");}}}
                    style={{borderRadius:14,overflow:"hidden"}}
                  >
                    <LinearGradient colors={["#b5179e","#7209b7"]} style={{width:48,height:48,alignItems:"center",justifyContent:"center"}}>
                      <Text style={{color:"#fff",fontSize:18,fontWeight:"900"}}>→</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}
            </SafeAreaView>
          </LinearGradient>
        </KeyboardAvoidingView>
      );
    }
  }

  const PLAYERS = ["You", "Alex", "Jordan", "Sam"];
  const MAX_WORDS = 20;

  function startGame() {
    const s = STORY_STARTERS[Math.floor(Math.random() * STORY_STARTERS.length)];
    setStarter(s);
    setStory([]);
    setWord("");
    setScore(0);
    setTurn(0);
    setPhase("playing");
    startTurnTimer(0);
  }

  function startTurnTimer(t: number) {
    setTimer(5);
    barAnim.setValue(1);
    clearInterval(timerRef.current!);
    Animated.timing(barAnim, { toValue: 0, duration: 5000, useNativeDriver: false }).start();
    timerRef.current = setInterval(() => {
      setTimer((tm) => {
        if (tm <= 1) {
          clearInterval(timerRef.current!);
          autoAddWord(t);
          return 5;
        }
        return tm - 1;
      });
    }, 1000);
  }

  function autoAddWord(t: number) {
    const w = AUTO_WORDS[Math.floor(Math.random() * AUTO_WORDS.length)];
    addWord(w, PLAYERS[(t % 4) === 0 ? 1 : t % 4], t);
  }

  function addWord(w: string, player: string, t: number) {
    setStory((s) => {
      const next = [...s, { word: w, player }];
      if (next.length >= MAX_WORDS) { setPhase("results"); clearInterval(timerRef.current!); return next; }
      return next;
    });
    const nextTurn = t + 1;
    setTurn(nextTurn);
    if ((nextTurn % 4) === 0) startTurnTimer(nextTurn);
    else { setTurn(nextTurn); startTurnTimer(nextTurn); }
    scrollRef.current?.scrollToEnd({ animated: true });
  }

  function submitWord() {
    if (!word.trim()) return;
    clearInterval(timerRef.current!);
    addWord(word.trim(), "You", turn);
    setScore((s) => s + 100);
    setWord("");
  }

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

    if (mpPhase === "playing") {
      const isMyTurnMp = myGuestId === mp.currentTurn;
      const storyText = mp.story ?? "";
      return (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.flex}>
          <LinearGradient colors={["#03001c", "#1a0040"]} style={s.flex}>
            <SafeAreaView style={s.flex}>
              <View style={{ flex: 1, padding: 20 }}>
                <Text style={{ color: "#888", fontSize: 13, fontStyle: "italic", marginBottom: 12 }}>Story so far:</Text>
                <ScrollView style={{ flex: 1, marginBottom: 12 }}>
                  <Text style={{ color: "#ccc", fontSize: 16, lineHeight: 26 }}>{storyText}</Text>
                </ScrollView>
                <Text style={{ color: isMyTurnMp ? "#4ade80" : "#888", fontWeight: "900", fontSize: 16, marginBottom: 8, textAlign: "center" }}>
                  {isMyTurnMp ? "🟢 YOUR TURN!" : `⏳ Waiting for ${memberName(mp.currentTurn)}…`}
                </Text>
                {isMyTurnMp && (
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <TextInput
                      style={s.input}
                      value={mpWord}
                      onChangeText={setMpWord}
                      placeholder="One word…"
                      placeholderTextColor="#333"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TouchableOpacity style={s.goBtn} onPress={() => { if (mpWord.trim()) { sendAction("add_word", { word: mpWord.trim() }); setMpWord(""); } }}>
                      <LinearGradient colors={["#b5179e", "#7209b7"]} style={s.goBtnI}><Text style={s.goBtnT}>→</Text></LinearGradient>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </SafeAreaView>
          </LinearGradient>
        </KeyboardAvoidingView>
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

  const isMyTurn = turn % 4 === 0;
  const fullStory = starter + " " + story.map((w) => w.word).join(" ");

  if (phase === "lobby") return (
    <LinearGradient colors={["#03001c","#001a10"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}><Text style={s.backText}>← Back</Text></TouchableOpacity>
        <View style={s.center}>
          <Text style={{ fontSize: 64 }}>📖</Text>
          <Text style={s.title}>Story Time</Text>
          <Text style={s.sub}>Build a story together — one word at a time! 5 seconds per turn.</Text>
          <TouchableOpacity style={s.btn} onPress={startGame}><LinearGradient colors={["#b5179e","#7209b7"]} style={s.btnI}><Text style={s.btnT}>BEGIN THE STORY</Text></LinearGradient></TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );

  if (phase === "results") return (
    <LinearGradient colors={["#03001c","#001a10"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <ScrollView contentContainerStyle={{ padding: 24, alignItems: "center" }}>
          <Text style={{ fontSize: 64 }}>📖</Text>
          <Text style={s.title}>The Full Story!</Text>
          <Text style={s.bigScore}>{score} pts</Text>
          <View style={s.storyBox}>
            <Text style={s.storyText}>{fullStory}</Text>
          </View>
          <TouchableOpacity style={s.btn} onPress={startGame}><LinearGradient colors={["#b5179e","#7209b7"]} style={s.btnI}><Text style={s.btnT}>NEW STORY</Text></LinearGradient></TouchableOpacity>
          <TouchableOpacity style={s.homeBtn} onPress={() => router.back()}><Text style={s.homeBtnT}>Back to Home</Text></TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.flex}>
      <LinearGradient colors={["#03001c","#001a10"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <View style={s.timerRow}>
            <View style={s.timerTrack}><Animated.View style={[s.timerFill, { width: barAnim.interpolate({ inputRange:[0,1], outputRange:["0%","100%"] }) }]} /></View>
            <Text style={s.timerNum}>{timer}s</Text>
          </View>
          <View style={s.storyContainer}>
            <Text style={s.starterText}>{starter}</Text>
            <ScrollView ref={scrollRef} style={{ flex: 1 }}>
              <View style={s.wordCloud}>
                {story.map((item, i) => (
                  <View key={i} style={[s.wordChip, item.player === "You" && s.myWordChip]}>
                    <Text style={[s.wordChipText, item.player === "You" && s.myWordChipText]}>{item.word}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
          <View style={s.turnIndicator}>
            <Text style={[s.turnText, { color: isMyTurn ? "#4ade80" : "#888" }]}>
              {isMyTurn ? "🟢 YOUR TURN!" : `⏳ ${PLAYERS[turn % 4]}'s turn…`}
            </Text>
          </View>
          {isMyTurn && (
            <View style={s.inputRow}>
              <TextInput style={s.input} value={word} onChangeText={setWord} placeholder="One word…" placeholderTextColor="#333" autoCapitalize="none" autoCorrect={false} onSubmitEditing={submitWord} autoFocus />
              <TouchableOpacity style={s.goBtn} onPress={submitWord}><LinearGradient colors={["#b5179e","#7209b7"]} style={s.goBtnI}><Text style={s.goBtnT}>→</Text></LinearGradient></TouchableOpacity>
            </View>
          )}
          <View style={s.scoreBar}><Text style={s.scoreText}>{story.length}/{MAX_WORDS} words · {score} pts</Text></View>
        </SafeAreaView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex:{flex:1}, back:{padding:16,paddingTop:8}, backText:{color:"#a78bfa",fontSize:16,fontWeight:"700"},
  center:{flex:1,alignItems:"center",justifyContent:"center",paddingHorizontal:24},
  title:{color:"#fff",fontSize:28,fontWeight:"900",marginBottom:8,textAlign:"center"},
  sub:{color:"#888",fontSize:13,textAlign:"center",marginBottom:24},
  btn:{width:"100%",borderRadius:14,overflow:"hidden",marginBottom:12},
  btnI:{padding:18,alignItems:"center"}, btnT:{color:"#fff",fontSize:17,fontWeight:"900"},
  homeBtn:{padding:12,alignItems:"center"}, homeBtnT:{color:"#666",fontSize:15},
  bigScore:{color:"#b5179e",fontSize:48,fontWeight:"900",marginBottom:16},
  storyBox:{backgroundColor:"rgba(255,255,255,0.06)",borderRadius:16,padding:20,width:"100%",marginBottom:24},
  storyText:{color:"#ccc",fontSize:16,lineHeight:26},
  timerRow:{flexDirection:"row",alignItems:"center",paddingHorizontal:20,paddingVertical:10,gap:12},
  timerTrack:{flex:1,height:6,backgroundColor:"#1e1e3a",borderRadius:3,overflow:"hidden"},
  timerFill:{height:"100%",backgroundColor:"#22d3ee",borderRadius:3},
  timerNum:{color:"#fff",fontSize:14,fontWeight:"900",width:28},
  storyContainer:{flex:1,paddingHorizontal:20,paddingTop:12},
  starterText:{color:"#888",fontSize:14,marginBottom:12,fontStyle:"italic"},
  wordCloud:{flexDirection:"row",flexWrap:"wrap",gap:6},
  wordChip:{backgroundColor:"#1a1a3a",borderRadius:8,paddingHorizontal:10,paddingVertical:5},
  myWordChip:{backgroundColor:"rgba(181,23,158,0.2)"},
  wordChipText:{color:"#aaa",fontSize:14}, myWordChipText:{color:"#e879f9",fontWeight:"700"},
  turnIndicator:{paddingHorizontal:20,paddingVertical:8,alignItems:"center"},
  turnText:{fontSize:16,fontWeight:"900"},
  inputRow:{flexDirection:"row",paddingHorizontal:20,gap:10,marginBottom:8},
  input:{flex:1,backgroundColor:"#1a1a3a",borderRadius:14,paddingHorizontal:16,paddingVertical:12,color:"#fff",fontSize:16},
  goBtn:{borderRadius:14,overflow:"hidden"}, goBtnI:{width:48,height:48,alignItems:"center",justifyContent:"center"},
  goBtnT:{color:"#fff",fontSize:18,fontWeight:"900"},
  scoreBar:{padding:12,alignItems:"center"}, scoreText:{color:"#555",fontSize:13},
});
