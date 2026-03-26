import React, { useState, useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Animated, TextInput, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useRoom } from "../../contexts/RoomContext";
import { PostGameCard } from "../../components/shared/PostGameCard";

// Cropped look puzzles - each is described as an emoji grid representing a zoomed portion
const PUZZLES = [
  { clue: "🟡🟡🟡\n🟡⬜🟡\n🟡🟡🟡", answer: "sun", desc: "Zoom on the center of a bright yellow circle", hint: "It rises in the east" },
  { clue: "⬛⬛⬛\n⬛🔲⬛\n⬛⬛⬛", answer: "keyboard", desc: "Extreme close-up of black squares with letters", hint: "You type on this" },
  { clue: "🟫🟫🟫\n🟫🍫🟫\n🟫🟫🟫", answer: "chocolate", desc: "Close-up of brown square grid texture", hint: "Sweet, melts in your mouth" },
  { clue: "🔵🔵🔵\n🔵🌀🔵\n🔵🔵🔵", answer: "whirlpool", desc: "Spiraling blue pattern from above", hint: "Water spinning in circles" },
  { clue: "🟢🟢🟢\n🟢🌿🟢\n🟢🟢🟢", answer: "leaf", desc: "Extreme close-up of green veins", hint: "Found on trees" },
  { clue: "⬜⬛⬜\n⬛⬜⬛\n⬜⬛⬜", answer: "zebra", desc: "Black and white stripes close up", hint: "African animal" },
  { clue: "🔴🔴🔴\n🔴❤️🔴\n🔴🔴🔴", answer: "strawberry", desc: "Red textured surface with tiny seeds", hint: "Red fruit with seeds on outside" },
  { clue: "🟤🟤🟤\n🟤🕳️🟤\n🟤🟤🟤", answer: "doughnut", desc: "Close-up of the hole in the middle", hint: "A circular pastry" },
  { clue: "🌑🌑🌑\n🌑⭐🌑\n🌑🌑🌑", answer: "night sky", desc: "Black background with one tiny bright dot", hint: "Look up at midnight" },
  { clue: "🟡🟡🟡\n🟡🍕🟡\n🟡🟡🟡", answer: "pizza", desc: "Yellow-orange texture with red specks", hint: "Italian food, circular" },
];

type Phase = "lobby" | "playing" | "results";

export default function CroppedLookScreen() {
  const router = useRouter();
  const { state, sendAction } = useRoom();
  const startedInRoom = useRef(!!state.room);
  const inRoom = startedInRoom.current && !!state.room;
  const mpState = inRoom ? (state.guestViewData as any) : null;
  const myGuestId = state.guestId;
  function memberName(gId: string) { return state.members.find(m => m.guestId === gId)?.displayName ?? (gId?.slice(0,6) ?? "?"); }
  const [mpGuess, setMpGuess] = useState("");
  const [mpGuessed, setMpGuessed] = useState(false);

  if (inRoom && mpState) {
    const mp = mpState;

    if (mp.phase === "finished") {
      return (
        <LinearGradient colors={["#03001c","#0a0010"]} style={{flex:1}}>
          <SafeAreaView style={{flex:1}}>
            <ScrollView contentContainerStyle={{padding:24,alignItems:"center"}}>
              <Text style={{fontSize:48,marginBottom:12}}>🔍</Text>
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
            </ScrollView>
          </SafeAreaView>
        </LinearGradient>
      );
    }

    if (mp.phase === "question") {
      return (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{flex:1}}>
          <LinearGradient colors={["#03001c","#001020"]} style={{flex:1}}>
            <SafeAreaView style={{flex:1}}>
              <View style={{flexDirection:"row",justifyContent:"space-between",paddingHorizontal:20,paddingVertical:12}}>
                <Text style={{color:"#888",fontWeight:"700"}}>Cropped Look</Text>
                <Text style={{color:"#a78bfa",fontWeight:"800"}}>{mp.scores?.[myGuestId??""]} pts</Text>
              </View>
              <View style={{flex:1,alignItems:"center",justifyContent:"center",paddingHorizontal:20}}>
                {mp.clue && (
                  <View style={{backgroundColor:"#111",borderRadius:16,padding:16,marginBottom:16}}>
                    <Text style={{fontSize:36,textAlign:"center",lineHeight:50}}>{mp.clue}</Text>
                  </View>
                )}
                {mp.desc && <Text style={{color:"#555",fontSize:12,textAlign:"center",marginBottom:16}}>{mp.desc}</Text>}
                {mp.hint && <Text style={{color:"#fbbf24",fontSize:14,textAlign:"center",marginBottom:16}}>Hint: {mp.hint}</Text>}
              </View>
              {mpGuessed ? (
                <Text style={{color:"#a78bfa",fontSize:14,fontWeight:"700",textAlign:"center",padding:16}}>⏳ Waiting for reveal…</Text>
              ) : (
                <View style={{flexDirection:"row",paddingHorizontal:20,gap:10,marginBottom:16}}>
                  <TextInput
                    style={{flex:1,backgroundColor:"#1a1a3a",borderRadius:14,paddingHorizontal:16,paddingVertical:12,color:"#fff",fontSize:16}}
                    value={mpGuess} onChangeText={setMpGuess}
                    placeholder="What is it?" placeholderTextColor="#333"
                    autoCorrect={false}
                    onSubmitEditing={()=>{if(mpGuess.trim()){setMpGuessed(true);sendAction("guess",{guess:mpGuess.trim()});}}}
                  />
                  <TouchableOpacity onPress={()=>{if(mpGuess.trim()){setMpGuessed(true);sendAction("guess",{guess:mpGuess.trim()});}}} style={{borderRadius:14,overflow:"hidden"}}>
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

    return (
      <LinearGradient colors={["#03001c","#001020"]} style={{flex:1}}>
        <SafeAreaView style={{flex:1}}>
          <View style={{flex:1,alignItems:"center",justifyContent:"center"}}>
            <Text style={{color:"#888",fontSize:16}}>Waiting…</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const [phase, setPhase] = useState<Phase>("lobby");
  const [idx, setIdx] = useState(0);
  const [guess, setGuess] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [score, setScore] = useState(0);
  const [timer, setTimer] = useState(20);
  const [hintUsed, setHintUsed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const barAnim = useRef(new Animated.Value(1)).current;
  const zoomAnim = useRef(new Animated.Value(3)).current;

  function startGame() { setPhase("playing"); setIdx(0); setScore(0); loadPuzzle(0); }

  function loadPuzzle(i: number) {
    setGuess(""); setRevealed(false); setCorrect(false); setTimer(20); setHintUsed(false);
    barAnim.setValue(1); zoomAnim.setValue(3);
    Animated.timing(barAnim, { toValue: 0, duration: 20000, useNativeDriver: false }).start();
    Animated.timing(zoomAnim, { toValue: 1, duration: 18000, useNativeDriver: true }).start();
    clearInterval(timerRef.current!);
    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) { clearInterval(timerRef.current!); doReveal(i, false); return 0; }
        return t - 1;
      });
    }, 1000);
  }

  function checkGuess(i: number) {
    clearInterval(timerRef.current!);
    barAnim.stopAnimation(); zoomAnim.stopAnimation();
    const isCorrect = guess.trim().toLowerCase().includes(PUZZLES[i].answer.toLowerCase());
    doReveal(i, isCorrect);
  }

  function doReveal(i: number, isCorrect: boolean) {
    setCorrect(isCorrect); setRevealed(true);
    if (isCorrect) setScore((s) => s + (hintUsed ? 100 : 200) + timer * 10);
    setTimeout(() => { if (i+1 >= PUZZLES.length) setPhase("results"); else { setIdx(i+1); loadPuzzle(i+1); } }, 1600);
  }

  useEffect(() => () => clearInterval(timerRef.current!), []);

  if (phase === "lobby") return (
    <LinearGradient colors={["#03001c","#001020"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}><Text style={s.backText}>← Back</Text></TouchableOpacity>
        <View style={s.center}>
          <Text style={{ fontSize: 64 }}>🔍</Text>
          <Text style={s.title}>Cropped Look</Text>
          <Text style={s.sub}>You see an extreme close-up of a common object. The image slowly zooms out. Guess before time runs out!</Text>
          <TouchableOpacity style={s.btn} onPress={startGame}><LinearGradient colors={["#b5179e","#7209b7"]} style={s.btnI}><Text style={s.btnT}>START GUESSING</Text></LinearGradient></TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );

  if (phase === "results") {
    return (
      <PostGameCard
        score={score}
        maxScore={1000}
        gameEmoji="🔎"
        gameTitle="Cropped Look"
        onPlayAgain={startGame}
      />
    );
  }

  const puzzle = PUZZLES[idx];
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.flex}>
      <LinearGradient colors={["#03001c","#001020"]} style={s.flex}>
        <SafeAreaView style={s.flex}>
          <View style={s.topRow}>
            <Text style={s.prog}>{idx+1}/{PUZZLES.length}</Text>
            <View style={s.timerTrack}><Animated.View style={[s.timerFill, { width: barAnim.interpolate({ inputRange:[0,1], outputRange:["0%","100%"] }) }]} /></View>
            <Text style={s.timerNum}>{timer}s</Text>
          </View>
          <View style={s.zoomSection}>
            <Animated.View style={[s.clueBox, { transform: [{ scale: zoomAnim }] }]}>
              <Text style={s.clueEmojis}>{puzzle.clue}</Text>
            </Animated.View>
            <Text style={s.descText}>{puzzle.desc}</Text>
          </View>
          {!hintUsed && (
            <TouchableOpacity style={s.hintBtn} onPress={() => setHintUsed(true)}>
              <Text style={s.hintBtnText}>💡 Show Hint (-100pts)</Text>
            </TouchableOpacity>
          )}
          {hintUsed && <Text style={s.hintText}>Hint: {puzzle.hint}</Text>}
          {revealed ? (
            <View style={[s.revealBox, { backgroundColor: correct ? "rgba(22,163,74,0.2)" : "rgba(220,38,38,0.2)" }]}>
              <Text style={[s.revealText, { color: correct ? "#4ade80" : "#f87171" }]}>
                {correct ? `✓ Correct! It's "${puzzle.answer}"` : `✗ It was "${puzzle.answer}"`}
              </Text>
            </View>
          ) : (
            <View style={s.inputRow}>
              <TextInput style={s.input} value={guess} onChangeText={setGuess} placeholder="What is it?" placeholderTextColor="#333" autoCorrect={false} onSubmitEditing={() => checkGuess(idx)} />
              <TouchableOpacity style={s.goBtn} onPress={() => checkGuess(idx)}><LinearGradient colors={["#b5179e","#7209b7"]} style={s.goBtnI}><Text style={s.goBtnT}>→</Text></LinearGradient></TouchableOpacity>
            </View>
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
  title:{color:"#fff",fontSize:28,fontWeight:"900",marginBottom:8,textAlign:"center"},
  sub:{color:"#888",fontSize:13,textAlign:"center",marginBottom:24},
  btn:{width:"100%",borderRadius:14,overflow:"hidden",marginBottom:12},
  btnI:{padding:18,alignItems:"center"}, btnT:{color:"#fff",fontSize:17,fontWeight:"900"},
  homeBtn:{padding:12,alignItems:"center"}, homeBtnT:{color:"#666",fontSize:15},
  bigScore:{color:"#b5179e",fontSize:64,fontWeight:"900"}, label:{color:"#555",fontSize:12,marginBottom:12},
  verdict:{color:"#a78bfa",fontSize:16,fontWeight:"700",marginBottom:28},
  topRow:{flexDirection:"row",alignItems:"center",paddingHorizontal:20,paddingVertical:12,gap:10},
  prog:{color:"#888",fontSize:13,fontWeight:"700",width:50},
  timerTrack:{flex:1,height:6,backgroundColor:"#1e1e3a",borderRadius:3,overflow:"hidden"},
  timerFill:{height:"100%",backgroundColor:"#22d3ee",borderRadius:3},
  timerNum:{color:"#fff",fontSize:14,fontWeight:"900",width:28},
  zoomSection:{flex:1,alignItems:"center",justifyContent:"center",overflow:"hidden"},
  clueBox:{backgroundColor:"#111",borderRadius:16,padding:16},
  clueEmojis:{fontSize:36,textAlign:"center",lineHeight:50},
  descText:{color:"#555",fontSize:12,textAlign:"center",marginTop:16,paddingHorizontal:20},
  hintBtn:{alignSelf:"center",backgroundColor:"rgba(251,191,36,0.1)",borderRadius:12,paddingHorizontal:16,paddingVertical:8,marginBottom:8},
  hintBtnText:{color:"#fbbf24",fontSize:13,fontWeight:"700"},
  hintText:{color:"#fbbf24",fontSize:14,textAlign:"center",paddingHorizontal:20,marginBottom:8},
  revealBox:{marginHorizontal:20,borderRadius:14,padding:14,alignItems:"center",marginBottom:8},
  revealText:{fontSize:16,fontWeight:"800"},
  inputRow:{flexDirection:"row",paddingHorizontal:20,gap:10,marginBottom:8},
  input:{flex:1,backgroundColor:"#1a1a3a",borderRadius:14,paddingHorizontal:16,paddingVertical:12,color:"#fff",fontSize:16},
  goBtn:{borderRadius:14,overflow:"hidden"}, goBtnI:{width:48,height:48,alignItems:"center",justifyContent:"center"},
  goBtnT:{color:"#fff",fontSize:18,fontWeight:"900"},
  scoreBar:{padding:12,alignItems:"center"}, scoreText:{color:"#a78bfa",fontSize:14,fontWeight:"800"},
});
