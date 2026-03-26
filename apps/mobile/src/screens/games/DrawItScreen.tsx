import React, { useState, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Animated, PanResponder, Dimensions, TextInput, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { useRoom } from "../../contexts/RoomContext";

const { width: SW } = Dimensions.get("window");
const CANVAS_H = 320;

const PROMPTS = ["Pizza", "Elephant", "Guitar", "Rainbow", "Castle", "Submarine", "Sunflower", "Skateboard", "Volcano", "Cactus", "Lighthouse", "Rollercoaster"];
const GUESSES = ["Pizza", "Elephant", "Guitar", "Rainbow", "Castle", "Submarine", "Sunflower", "Skateboard", "Volcano", "Cactus", "Lighthouse", "Rollercoaster"];

type Phase = "lobby" | "drawing" | "guessing" | "results";

interface Stroke { points: string; color: string }

export default function DrawItScreen() {
  const router = useRouter();
  const { state, sendAction } = useRoom();
  const inRoom = !!state.room;
  const mpState = state.guestViewData as any;
  const myGuestId = state.guestId;
  function memberName(gId: string) { return state.members.find(m => m.guestId === gId)?.displayName ?? (gId?.slice(0,6) ?? "?"); }

  const [phase, setPhase] = useState<Phase>("lobby");
  const [promptIdx, setPromptIdx] = useState(0);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentPath, setCurrentPath] = useState("");
  const [brushColor, setBrushColor] = useState("#ffffff");
  const [timer, setTimer] = useState(60);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(0);
  const [chosenGuess, setChosenGuess] = useState<string|null>(null);
  const [mpGuess, setMpGuess] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const barAnim = useRef(new Animated.Value(1)).current;
  const MAX_ROUNDS = 4;
  const COLORS = ["#ffffff","#ef4444","#3b82f6","#22c55e","#fbbf24","#a855f7","#f97316","#000000"];

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
      const guessedRight: string[] = mp.correctGuessers ?? [];
      return (
        <LinearGradient colors={["#03001c","#001a20"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
            <ScrollView contentContainerStyle={{ padding: 24, alignItems: "center" }}>
              <Text style={{ color: "#888", fontSize: 12, fontWeight: "900", letterSpacing: 2, marginBottom: 8 }}>ANSWER WAS</Text>
              <Text style={{ color: "#e879f9", fontSize: 32, fontWeight: "900", marginBottom: 20 }}>{mp.correctAnswer}</Text>
              {guessedRight.length > 0 && (
                <Text style={{ color: "#4ade80", fontSize: 14, fontWeight: "700", marginBottom: 16 }}>
                  ✓ {guessedRight.map(memberName).join(", ")} got it!
                </Text>
              )}
              <Text style={{ color: "#888", fontSize: 12, fontWeight: "900", letterSpacing: 2, marginBottom: 12 }}>SCORES</Text>
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

    if (mp.phase === "guessing") {
      const isDrawer = myGuestId === mp.currentDrawer;
      const guessCount = mp.guessCount ?? 0;
      return (
        <LinearGradient colors={["#03001c","#001a20"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
            <View style={s.topBar}><Text style={s.topLabel}>What did they draw?</Text><Text style={s.scoreC}>{mp.scores?.[myGuestId ?? ""] ?? 0} pts</Text></View>
            {isDrawer ? (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "#888", fontSize: 18, fontWeight: "700" }}>👀 {guessCount} guesses so far…</Text>
              </View>
            ) : (
              <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
                <View style={{ flex: 1, justifyContent: "center", padding: 20 }}>
                  <TextInput
                    style={[s.guessCard, { color: "#fff", fontSize: 16, padding: 14, marginBottom: 12 }]}
                    value={mpGuess}
                    onChangeText={setMpGuess}
                    placeholder="Type your guess…"
                    placeholderTextColor="#333"
                    autoCorrect={false}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={s.guessWrap}
                    onPress={() => { if (mpGuess.trim()) { sendAction("guess", { guess: mpGuess.trim() }); setMpGuess(""); } }}
                  >
                    <LinearGradient colors={["#b5179e","#7209b7"]} style={s.guessCard}>
                      <Text style={s.guessText}>GUESS →</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            )}
          </SafeAreaView>
        </LinearGradient>
      );
    }

    if (mp.phase === "drawing") {
      const isDrawer = myGuestId === mp.currentDrawer;
      return (
        <LinearGradient colors={["#03001c","#001a20"]} style={s.flex}>
          <SafeAreaView style={s.flex}>
            <View style={s.topBar}>
              {isDrawer
                ? <View style={s.promptPill}><Text style={s.promptText}>Draw: {mp.prompt}</Text></View>
                : <Text style={s.topLabel}>🎨 {memberName(mp.currentDrawer)} is drawing…</Text>
              }
            </View>
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              {isDrawer ? (
                <>
                  <Text style={{ color: "#888", fontSize: 16, fontWeight: "700", marginBottom: 20 }}>Draw your prompt for the group!</Text>
                  <TouchableOpacity style={[s.guessWrap, { width: "80%" }]} onPress={() => sendAction("drawing_done", {})}>
                    <LinearGradient colors={["#b5179e","#7209b7"]} style={s.guessCard}>
                      <Text style={s.guessText}>DONE DRAWING →</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={{ color: "#888", fontSize: 18, fontWeight: "700" }}>⏳ Waiting for drawing…</Text>
              )}
            </View>
          </SafeAreaView>
        </LinearGradient>
      );
    }
  }

  function startGame() {
    setPhase("drawing"); setRound(0); setScore(0);
    setPromptIdx(Math.floor(Math.random() * PROMPTS.length));
    startDrawingTimer();
  }

  function startDrawingTimer() {
    setStrokes([]); setCurrentPath(""); setTimer(60);
    barAnim.setValue(1);
    Animated.timing(barAnim, { toValue: 0, duration: 60000, useNativeDriver: false }).start();
    clearInterval(timerRef.current!);
    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) { clearInterval(timerRef.current!); setPhase("guessing"); return 0; }
        return t - 1;
      });
    }, 1000);
  }

  function submitDrawing() {
    clearInterval(timerRef.current!); barAnim.stopAnimation();
    setPhase("guessing");
    setChosenGuess(null);
  }

  function makeGuess(guess: string) {
    setChosenGuess(guess);
    const correct = guess === PROMPTS[promptIdx];
    if (correct) setScore((s) => s + 400);
    setTimeout(() => {
      const nextRound = round + 1;
      setRound(nextRound);
      if (nextRound >= MAX_ROUNDS) setPhase("results");
      else {
        setPromptIdx(Math.floor(Math.random() * PROMPTS.length));
        setPhase("drawing");
        startDrawingTimer();
      }
    }, 1400);
  }

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      const { locationX, locationY } = e.nativeEvent;
      setCurrentPath(`M ${locationX} ${locationY}`);
    },
    onPanResponderMove: (e) => {
      const { locationX, locationY } = e.nativeEvent;
      setCurrentPath((p) => `${p} L ${locationX} ${locationY}`);
    },
    onPanResponderRelease: () => {
      setStrokes((s) => [...s, { points: currentPath, color: brushColor }]);
      setCurrentPath("");
    },
  })).current;

  const guessOptions = [PROMPTS[promptIdx], ...PROMPTS.filter((_, i) => i !== promptIdx).slice(0, 3)].sort(() => Math.random() - 0.5);

  if (phase === "lobby") return (
    <LinearGradient colors={["#03001c","#001a20"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}><Text style={s.backText}>← Back</Text></TouchableOpacity>
        <View style={s.center}>
          <Text style={{ fontSize: 64 }}>🎨✏️</Text>
          <Text style={s.title}>Draw It!</Text>
          <Text style={s.sub}>Draw a secret prompt in 60 seconds. Others pick from 4 options — will they guess it?</Text>
          <TouchableOpacity style={s.btn} onPress={startGame}><LinearGradient colors={["#b5179e","#7209b7"]} style={s.btnI}><Text style={s.btnT}>START DRAWING</Text></LinearGradient></TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );

  if (phase === "results") return (
    <LinearGradient colors={["#03001c","#001a20"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <View style={s.center}>
          <Text style={{ fontSize: 64 }}>🎨</Text>
          <Text style={s.title}>Gallery Complete!</Text>
          <Text style={s.bigScore}>{score}</Text>
          <Text style={s.label}>ART POINTS</Text>
          <Text style={s.verdict}>{score >= 1200 ? "🖼️ Picasso Award!" : score >= 800 ? "🎨 Great Artist" : "✏️ Keep Practicing"}</Text>
          <TouchableOpacity style={s.btn} onPress={startGame}><LinearGradient colors={["#b5179e","#7209b7"]} style={s.btnI}><Text style={s.btnT}>DRAW AGAIN</Text></LinearGradient></TouchableOpacity>
          <TouchableOpacity style={s.homeBtn} onPress={() => router.back()}><Text style={s.homeBtnT}>Back to Home</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );

  if (phase === "drawing") return (
    <LinearGradient colors={["#03001c","#001a20"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <View style={s.topBar}>
          <View style={s.promptPill}><Text style={s.promptText}>Draw: {PROMPTS[promptIdx]}</Text></View>
          <Text style={[s.timerText, { color: timer <= 15 ? "#dc2626" : "#fff" }]}>{timer}s</Text>
        </View>
        <View style={s.timerTrack}><Animated.View style={[s.timerFill, { width: barAnim.interpolate({ inputRange:[0,1], outputRange:["0%","100%"] }) }]} /></View>
        <View style={s.canvas} {...panResponder.panHandlers}>
          <Svg width={SW} height={CANVAS_H}>
            {strokes.map((stroke, i) => (
              <Path key={i} d={stroke.points} stroke={stroke.color} strokeWidth={3} fill="none" strokeLinecap="round" />
            ))}
            {currentPath ? <Path d={currentPath} stroke={brushColor} strokeWidth={3} fill="none" strokeLinecap="round" /> : null}
          </Svg>
        </View>
        <View style={s.toolsRow}>
          <TouchableOpacity onPress={() => setStrokes([])} style={s.clearBtn}><Text style={s.clearText}>🗑️ Clear</Text></TouchableOpacity>
          <View style={s.colorsRow}>
            {COLORS.map((c) => (
              <TouchableOpacity key={c} onPress={() => setBrushColor(c)} style={[s.colorDot, { backgroundColor: c }, brushColor === c && s.colorDotActive]} />
            ))}
          </View>
        </View>
        <View style={{ padding: 12 }}>
          <TouchableOpacity style={s.btn} onPress={submitDrawing}><LinearGradient colors={["#b5179e","#7209b7"]} style={s.btnI}><Text style={s.btnT}>DONE — Let them Guess!</Text></LinearGradient></TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );

  return (
    <LinearGradient colors={["#03001c","#001a20"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <View style={s.topBar}><Text style={s.topLabel}>What did they draw?</Text><Text style={s.scoreC}>{score} pts</Text></View>
        <View style={s.drawingPreview}>
          <Svg width={SW - 32} height={240} style={{ backgroundColor: "#0a0a1a", borderRadius: 16 }}>
            {strokes.map((stroke, i) => (
              <Path key={i} d={stroke.points} stroke={stroke.color} strokeWidth={3} fill="none" strokeLinecap="round" />
            ))}
          </Svg>
        </View>
        <View style={s.guessOptions}>
          {guessOptions.map((g) => {
            const isChosen = chosenGuess === g;
            const isCorrect = g === PROMPTS[promptIdx];
            let colors: string[] = ["#1a1a3a","#2a1a4a"];
            if (chosenGuess) { if (isCorrect) colors = ["#166534","#16a34a"]; else if (isChosen) colors = ["#7f1d1d","#991b1b"]; }
            return (
              <TouchableOpacity key={g} onPress={() => makeGuess(g)} disabled={!!chosenGuess} activeOpacity={0.85} style={s.guessWrap}>
                <LinearGradient colors={colors as any} style={s.guessCard}><Text style={s.guessText}>{g}</Text></LinearGradient>
              </TouchableOpacity>
            );
          })}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  flex:{flex:1}, back:{padding:16,paddingTop:8}, backText:{color:"#a78bfa",fontSize:16,fontWeight:"700"},
  center:{flex:1,alignItems:"center",justifyContent:"center",paddingHorizontal:24},
  title:{color:"#fff",fontSize:28,fontWeight:"900",marginBottom:8,textAlign:"center"},
  sub:{color:"#888",fontSize:13,textAlign:"center",marginBottom:24},
  btn:{borderRadius:14,overflow:"hidden",marginBottom:8},
  btnI:{padding:18,alignItems:"center"}, btnT:{color:"#fff",fontSize:16,fontWeight:"900"},
  homeBtn:{padding:12}, homeBtnT:{color:"#666",fontSize:15},
  bigScore:{color:"#b5179e",fontSize:64,fontWeight:"900"}, label:{color:"#555",fontSize:12,marginBottom:12},
  verdict:{color:"#a78bfa",fontSize:16,fontWeight:"700",marginBottom:28},
  topBar:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",paddingHorizontal:16,paddingVertical:8},
  promptPill:{backgroundColor:"rgba(181,23,158,0.2)",borderRadius:10,paddingHorizontal:14,paddingVertical:6},
  promptText:{color:"#e879f9",fontSize:15,fontWeight:"800"},
  timerText:{fontSize:20,fontWeight:"900"},
  timerTrack:{height:4,backgroundColor:"#1e1e3a",overflow:"hidden"},
  timerFill:{height:"100%",backgroundColor:"#b5179e"},
  canvas:{height:CANVAS_H,backgroundColor:"#0a0a1a",marginHorizontal:0},
  toolsRow:{flexDirection:"row",alignItems:"center",paddingHorizontal:12,paddingVertical:8,gap:12},
  clearBtn:{padding:8}, clearText:{color:"#888",fontSize:13},
  colorsRow:{flexDirection:"row",gap:8,flex:1,justifyContent:"flex-end"},
  colorDot:{width:24,height:24,borderRadius:12},
  colorDotActive:{borderWidth:2,borderColor:"#fff"},
  topLabel:{color:"#fff",fontSize:16,fontWeight:"800"},
  scoreC:{color:"#a78bfa",fontWeight:"800"},
  drawingPreview:{marginHorizontal:16,marginBottom:12},
  guessOptions:{paddingHorizontal:16,gap:8},
  guessWrap:{borderRadius:14,overflow:"hidden"},
  guessCard:{padding:16,alignItems:"center"},
  guessText:{color:"#fff",fontSize:16,fontWeight:"700"},
});
