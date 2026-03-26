import React, { useState, useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Animated, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useRoom } from "../../contexts/RoomContext";
import { PostGameCard } from "../../components/shared/PostGameCard";

const SONGS = [
  { title: "Happy Birthday", artist: "Traditional", emoji: "🎂" },
  { title: "Twinkle Twinkle Little Star", artist: "Traditional", emoji: "⭐" },
  { title: "Jingle Bells", artist: "Traditional", emoji: "🔔" },
  { title: "We Will Rock You", artist: "Queen", emoji: "🎸" },
  { title: "Happy", artist: "Pharrell Williams", emoji: "😊" },
  { title: "Bohemian Rhapsody", artist: "Queen", emoji: "👑" },
  { title: "Shape of You", artist: "Ed Sheeran", emoji: "💪" },
  { title: "Baby Shark", artist: "Pinkfong", emoji: "🦈" },
  { title: "Smells Like Teen Spirit", artist: "Nirvana", emoji: "⚡" },
  { title: "Can't Stop the Feeling", artist: "Justin Timberlake", emoji: "🕺" },
];

type Phase = "lobby" | "humming" | "guessing" | "results";

export default function HumItScreen() {
  const router = useRouter();
  const { state, sendAction } = useRoom();
  const startedInRoom = useRef(!!state.room);
  const inRoom = startedInRoom.current && !!state.room;
  const mpState = inRoom ? (state.guestViewData as any) : null;
  const myGuestId = state.guestId;
  function memberName(gId: string) { return state.members.find(m => m.guestId === gId)?.displayName ?? (gId?.slice(0,6) ?? "?"); }
  const [mpGuessed, setMpGuessed] = useState(false);
  const [phase, setPhase] = useState<Phase>("lobby");
  const [songIdx, setSongIdx] = useState(0);
  const [humTimer, setHumTimer] = useState(10);
  const [guessTimer, setGuessTimer] = useState(20);
  const [score, setScore] = useState(0);
  const [guessedCorrect, setGuessedCorrect] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [round, setRound] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseRef = useRef<Animated.CompositeAnimation|null>(null);

  useEffect(() => () => { clearInterval(timerRef.current!); pulseRef.current?.stop(); }, []);

  if (inRoom && mpState) {
    const mp = mpState;
    const isHummer = mp.hummer === myGuestId;

    if (mp.phase === "finished") {
      return (
        <LinearGradient colors={["#03001c","#0a0010"]} style={{flex:1}}>
          <SafeAreaView style={{flex:1}}>
            <ScrollView contentContainerStyle={{padding:24,alignItems:"center"}}>
              <Text style={{fontSize:48,marginBottom:12}}>🎵</Text>
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

    if (mp.phase === "humming") {
      return (
        <LinearGradient colors={["#03001c","#002020"]} style={{flex:1}}>
          <SafeAreaView style={{flex:1}}>
            <View style={{flexDirection:"row",justifyContent:"space-between",paddingHorizontal:20,paddingVertical:12}}>
              <Text style={{color:"#888",fontWeight:"700"}}>Round {(mp.round??0)+1}/{mp.maxRounds??5}</Text>
              <Text style={{color:"#a78bfa",fontWeight:"800"}}>{mp.scores?.[myGuestId??""]} pts</Text>
            </View>
            <View style={{flex:1,alignItems:"center",justifyContent:"center",paddingHorizontal:20}}>
              {isHummer ? (
                <>
                  <Text style={{color:"#fbbf24",fontSize:12,fontWeight:"800",marginBottom:20}}>🤫 HUMMER ONLY</Text>
                  <LinearGradient colors={["#1a0a3a","#2d1060"]} style={{borderRadius:18,padding:28,alignItems:"center",width:"100%",marginBottom:24}}>
                    <Text style={{fontSize:48,marginBottom:10}}>{mp.songEmoji}</Text>
                    <Text style={{color:"#fff",fontSize:24,fontWeight:"900",textAlign:"center"}}>{mp.songTitle}</Text>
                    <Text style={{color:"rgba(255,255,255,0.5)",fontSize:14,marginTop:4}}>{mp.songArtist}</Text>
                  </LinearGradient>
                  <Text style={{fontSize:64}}>🎤</Text>
                  <Text style={{color:"#b5179e",fontSize:24,fontWeight:"900"}}>{mp.timeLeft??10}s — HUM IT!</Text>
                </>
              ) : (
                <>
                  <Text style={{fontSize:64}}>🎵</Text>
                  <Text style={{color:"#fff",fontSize:22,fontWeight:"800",textAlign:"center",marginTop:16}}>Listen carefully…</Text>
                  <Text style={{color:"#888",fontSize:15,marginTop:8}}>{memberName(mp.hummer??"")} is humming!</Text>
                  <Text style={{color:"#b5179e",fontSize:18,fontWeight:"900",marginTop:12}}>{mp.timeLeft??10}s</Text>
                </>
              )}
            </View>
          </SafeAreaView>
        </LinearGradient>
      );
    }

    if (mp.phase === "guessing") {
      return (
        <LinearGradient colors={["#03001c","#002020"]} style={{flex:1}}>
          <SafeAreaView style={{flex:1}}>
            <View style={{flexDirection:"row",justifyContent:"space-between",paddingHorizontal:20,paddingVertical:12}}>
              <Text style={{color:"#888",fontWeight:"700"}}>Round {(mp.round??0)+1}/{mp.maxRounds??5}</Text>
              <Text style={{color:"#a78bfa",fontWeight:"800"}}>{mp.timeLeft??20}s left</Text>
            </View>
            <View style={{flex:1,alignItems:"center",justifyContent:"center",paddingHorizontal:20}}>
              <Text style={{color:"#fff",fontSize:22,fontWeight:"800",textAlign:"center",marginBottom:20}}>Did you figure out the song?</Text>
            </View>
            {!isHummer && !mpGuessed ? (
              <View style={{flexDirection:"row",gap:12,paddingHorizontal:20,paddingBottom:24}}>
                <TouchableOpacity onPress={()=>{setMpGuessed(true);sendAction("guess",{correct:false});}} style={{flex:1,borderRadius:14,overflow:"hidden"}}>
                  <LinearGradient colors={["#7f1d1d","#dc2626"]} style={{padding:20,alignItems:"center"}}>
                    <Text style={{color:"#fff",fontSize:16,fontWeight:"900"}}>✗ NO IDEA</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity onPress={()=>{setMpGuessed(true);sendAction("guess",{correct:true});}} style={{flex:1,borderRadius:14,overflow:"hidden"}}>
                  <LinearGradient colors={["#166534","#16a34a"]} style={{padding:20,alignItems:"center"}}>
                    <Text style={{color:"#fff",fontSize:16,fontWeight:"900"}}>✓ GOT IT!</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={{color:"#a78bfa",fontSize:14,fontWeight:"700",textAlign:"center",padding:24}}>⏳ Waiting…</Text>
            )}
          </SafeAreaView>
        </LinearGradient>
      );
    }

    if (mp.phase === "reveal") {
      return (
        <LinearGradient colors={["#03001c","#002020"]} style={{flex:1}}>
          <SafeAreaView style={{flex:1}}>
            <ScrollView contentContainerStyle={{padding:24,alignItems:"center"}}>
              <Text style={{color:"#888",fontSize:11,fontWeight:"900",letterSpacing:2,marginBottom:8}}>IT WAS:</Text>
              <Text style={{color:"#fff",fontSize:24,fontWeight:"900",marginBottom:20}}>{mp.songTitle}</Text>
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

    return (
      <LinearGradient colors={["#03001c","#002020"]} style={{flex:1}}>
        <SafeAreaView style={{flex:1}}>
          <View style={{flex:1,alignItems:"center",justifyContent:"center"}}>
            <Text style={{color:"#888",fontSize:16}}>Waiting…</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const MAX_ROUNDS = 5;

  function startGame() { setPhase("humming"); setSongIdx(0); setRound(0); setScore(0); showHumPhase(0); }

  function showHumPhase(rIdx: number) {
    setSongIdx(rIdx);
    setHumTimer(10);
    setGuessedCorrect(false);
    setShowAnswer(false);
    pulseRef.current = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.2, duration: 400, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]));
    pulseRef.current.start();
    clearInterval(timerRef.current!);
    timerRef.current = setInterval(() => {
      setHumTimer((t) => {
        if (t <= 1) { clearInterval(timerRef.current!); pulseRef.current?.stop(); pulseAnim.setValue(1); startGuessing(); return 0; }
        return t - 1;
      });
    }, 1000);
  }

  function startGuessing() {
    setPhase("guessing");
    setGuessTimer(20);
    clearInterval(timerRef.current!);
    timerRef.current = setInterval(() => {
      setGuessTimer((t) => {
        if (t <= 1) { clearInterval(timerRef.current!); advanceRound(false); return 0; }
        return t - 1;
      });
    }, 1000);
  }

  function guess(correct: boolean) {
    clearInterval(timerRef.current!);
    setGuessedCorrect(correct);
    setShowAnswer(true);
    if (correct) setScore((s) => s + 200 + guessTimer * 10);
    setTimeout(() => advanceRound(correct), 1400);
  }

  function advanceRound(correct: boolean) {
    const nextRound = round + 1;
    setRound(nextRound);
    if (nextRound >= MAX_ROUNDS) setPhase("results");
    else { setPhase("humming"); showHumPhase(nextRound % SONGS.length); }
  }

  useEffect(() => () => { clearInterval(timerRef.current!); pulseRef.current?.stop(); }, []);

  const song = SONGS[songIdx % SONGS.length];

  if (phase === "lobby") return (
    <LinearGradient colors={["#03001c","#002020"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}><Text style={s.backText}>← Back</Text></TouchableOpacity>
        <View style={s.center}>
          <Text style={{ fontSize: 64 }}>🎵😶</Text>
          <Text style={s.title}>Hum It</Text>
          <Text style={s.sub}>One player sees the song and hums it for 10 seconds. Others guess what it is!</Text>
          <View style={s.rules}>{["The hummer sees the song title","10 seconds to hum the melody","Others vote if they got it right","200+ pts for correct guesses"].map((r,i)=><Text key={i} style={s.rule}>• {r}</Text>)}</View>
          <TouchableOpacity style={s.btn} onPress={startGame}><LinearGradient colors={["#b5179e","#7209b7"]} style={s.btnI}><Text style={s.btnT}>START HUMMING</Text></LinearGradient></TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );

  if (phase === "results") return (
    <PostGameCard
      score={score}
      maxScore={1000}
      gameEmoji="🎵"
      gameTitle="Hum It"
      onPlayAgain={startGame}
    />
  );

  if (phase === "humming") return (
    <LinearGradient colors={["#03001c","#002020"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <View style={s.topBar}><Text style={s.prog}>Round {round+1}/{MAX_ROUNDS}</Text><Text style={s.scoreC}>{score} pts</Text></View>
        <View style={s.hummingSection}>
          <Text style={s.hummingLabel}>🤫 HUMMER ONLY — don't show others!</Text>
          <LinearGradient colors={["#1a0a3a","#2d1060"]} style={s.songReveal}>
            <Text style={s.songEmoji}>{song.emoji}</Text>
            <Text style={s.songTitle}>{song.title}</Text>
            <Text style={s.songArtist}>{song.artist}</Text>
          </LinearGradient>
          <Animated.View style={[s.micPulse, { transform: [{ scale: pulseAnim }] }]}>
            <Text style={s.micEmoji}>🎤</Text>
          </Animated.View>
          <Text style={s.humTimer}>{humTimer}s — HUM IT!</Text>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );

  // Guessing phase
  return (
    <LinearGradient colors={["#03001c","#002020"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <View style={s.topBar}><Text style={s.prog}>Round {round+1}/{MAX_ROUNDS}</Text><Text style={s.scoreC}>{guessTimer}s left</Text></View>
        <View style={s.guessingSection}>
          <Text style={s.guessingQ}>Did you figure out the song? 🎵</Text>
          {showAnswer && (
            <View style={s.answerReveal}>
              <Text style={s.answerLabel}>IT WAS:</Text>
              <Text style={s.answerTitle}>{song.title}</Text>
            </View>
          )}
        </View>
        {!showAnswer && (
          <View style={s.guessButtons}>
            <TouchableOpacity onPress={() => guess(false)} style={s.noBtn} activeOpacity={0.85}>
              <LinearGradient colors={["#7f1d1d","#dc2626"]} style={s.guessBtnI}><Text style={s.guessBtnT}>✗ NO IDEA</Text></LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => guess(true)} style={s.yesBtn} activeOpacity={0.85}>
              <LinearGradient colors={["#166534","#16a34a"]} style={s.guessBtnI}><Text style={s.guessBtnT}>✓ GOT IT!</Text></LinearGradient>
            </TouchableOpacity>
          </View>
        )}
        <View style={s.scoreBar}><Text style={s.scoreText}>Score: {score}</Text></View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  flex:{flex:1}, back:{padding:16,paddingTop:8}, backText:{color:"#a78bfa",fontSize:16,fontWeight:"700"},
  center:{flex:1,alignItems:"center",justifyContent:"center",paddingHorizontal:24},
  title:{color:"#fff",fontSize:28,fontWeight:"900",marginBottom:8,textAlign:"center"},
  sub:{color:"#888",fontSize:13,textAlign:"center",marginBottom:20},
  rules:{backgroundColor:"rgba(255,255,255,0.06)",borderRadius:14,padding:14,width:"100%",marginBottom:28},
  rule:{color:"#ccc",fontSize:13,marginBottom:5},
  btn:{width:"100%",borderRadius:14,overflow:"hidden",marginBottom:12},
  btnI:{padding:18,alignItems:"center"}, btnT:{color:"#fff",fontSize:17,fontWeight:"900"},
  homeBtn:{padding:12}, homeBtnT:{color:"#666",fontSize:15},
  bigScore:{color:"#b5179e",fontSize:64,fontWeight:"900"}, label:{color:"#555",fontSize:12,marginBottom:24},
  topBar:{flexDirection:"row",justifyContent:"space-between",paddingHorizontal:20,paddingVertical:12},
  prog:{color:"#888",fontWeight:"700"}, scoreC:{color:"#a78bfa",fontWeight:"800"},
  hummingSection:{flex:1,alignItems:"center",justifyContent:"center",paddingHorizontal:20},
  hummingLabel:{color:"#fbbf24",fontSize:12,fontWeight:"800",marginBottom:20,textAlign:"center"},
  songReveal:{borderRadius:18,padding:28,alignItems:"center",width:"100%",marginBottom:24},
  songEmoji:{fontSize:48,marginBottom:10},
  songTitle:{color:"#fff",fontSize:24,fontWeight:"900",textAlign:"center"},
  songArtist:{color:"rgba(255,255,255,0.5)",fontSize:14,marginTop:4},
  micPulse:{marginBottom:12},
  micEmoji:{fontSize:64},
  humTimer:{color:"#b5179e",fontSize:24,fontWeight:"900"},
  guessingSection:{flex:1,alignItems:"center",justifyContent:"center",paddingHorizontal:20},
  guessingQ:{color:"#fff",fontSize:22,fontWeight:"800",textAlign:"center",marginBottom:20},
  answerReveal:{backgroundColor:"rgba(167,139,250,0.15)",borderRadius:16,padding:20,alignItems:"center"},
  answerLabel:{color:"#888",fontSize:11,fontWeight:"900",letterSpacing:2,marginBottom:8},
  answerTitle:{color:"#fff",fontSize:24,fontWeight:"900"},
  guessButtons:{flexDirection:"row",gap:12,paddingHorizontal:20,paddingBottom:24},
  noBtn:{flex:1,borderRadius:14,overflow:"hidden"}, yesBtn:{flex:1,borderRadius:14,overflow:"hidden"},
  guessBtnI:{padding:20,alignItems:"center"}, guessBtnT:{color:"#fff",fontSize:16,fontWeight:"900"},
  scoreBar:{padding:12,alignItems:"center"}, scoreText:{color:"#a78bfa",fontSize:14,fontWeight:"800"},
});
