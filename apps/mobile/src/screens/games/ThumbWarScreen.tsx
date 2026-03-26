import React, { useState, useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Animated, PanResponder, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useRoom } from "../../contexts/RoomContext";

type Phase = "lobby" | "playing" | "results";

export default function ThumbWarScreen() {
  const router = useRouter();
  const { state, sendAction } = useRoom();
  const inRoom = !!state.room;
  const mpState = state.guestViewData as any;
  const myGuestId = state.guestId;
  function memberName(gId: string) { return state.members.find(m => m.guestId === gId)?.displayName ?? (gId?.slice(0,6) ?? "?"); }
  const [phase, setPhase] = useState<Phase>("lobby");
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [countdown, setCountdown] = useState(3);
  const [capturing, setCapturing] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const [timer, setTimer] = useState(5);
  const [botTaps, setBotTaps] = useState(0);
  const [winner, setWinner] = useState<"you"|"bot"|null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const countRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const buttonAnim = useRef(new Animated.Value(1)).current;
  const MAX_ROUNDS = 5;

  useEffect(() => () => { clearInterval(timerRef.current!); clearInterval(countRef.current!); }, []);

  if (inRoom && mpState) {
    const mp = mpState;

    if (mp.phase === "finished") {
      return (
        <LinearGradient colors={["#03001c","#0a0010"]} style={{flex:1}}>
          <SafeAreaView style={{flex:1}}>
            <ScrollView contentContainerStyle={{padding:24,alignItems:"center"}}>
              <Text style={{fontSize:48,marginBottom:12}}>👍</Text>
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

    if (mp.phase === "playing") {
      return (
        <LinearGradient colors={["#03001c","#1a0a00"]} style={{flex:1}}>
          <SafeAreaView style={{flex:1}}>
            <View style={{flexDirection:"row",justifyContent:"space-between",paddingHorizontal:20,paddingVertical:12}}>
              <Text style={{color:"#888",fontWeight:"700"}}>Round {mp.round}/{mp.maxRounds}</Text>
              <Text style={{color:"#a78bfa",fontWeight:"800"}}>{mp.scores?.[myGuestId??""]} pts</Text>
            </View>
            <View style={{flex:1,alignItems:"center",justifyContent:"center"}}>
              {mp.status === "countdown" && (
                <>
                  <Text style={{color:"#b5179e",fontSize:100,fontWeight:"900"}}>{mp.countdown}</Text>
                  <Text style={{color:"#888",fontSize:16,fontWeight:"700"}}>Get ready…</Text>
                </>
              )}
              {mp.status === "go" && (
                <>
                  <Text style={{color:"#fff",fontSize:60,fontWeight:"900"}}>{mp.timeLeft}</Text>
                  <Text style={{color:"#dc2626",fontSize:20,fontWeight:"900",marginBottom:12}}>TAP TAP TAP!</Text>
                  <Text style={{color:"#a78bfa",fontSize:18,fontWeight:"800"}}>Your taps: {mp.taps?.[myGuestId??""]??0}</Text>
                </>
              )}
              {mp.status === "result" && (
                <View style={{alignItems:"center"}}>
                  <Text style={{color:mp.roundWinner===myGuestId?"#4ade80":"#f87171",fontSize:28,fontWeight:"900",marginBottom:8}}>
                    {mp.roundWinner===myGuestId ? "YOU WIN! 🏆" : `${memberName(mp.roundWinner??"")} wins!`}
                  </Text>
                  <Text style={{color:"#888",fontSize:14}}>Your taps: {mp.taps?.[myGuestId??""]??0}</Text>
                </View>
              )}
            </View>
            {mp.status === "go" && (
              <View style={{paddingHorizontal:24,paddingBottom:48,alignItems:"center"}}>
                <TouchableOpacity onPress={()=>sendAction("tap",{})} activeOpacity={0.7} style={{width:160,height:160,borderRadius:80,overflow:"hidden"}}>
                  <LinearGradient colors={["#b5179e","#7209b7"]} style={{flex:1,alignItems:"center",justifyContent:"center"}}>
                    <Text style={{color:"#fff",fontSize:28,fontWeight:"900"}}>TAP!</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </SafeAreaView>
        </LinearGradient>
      );
    }

    if (mp.phase === "round_end") {
      return (
        <LinearGradient colors={["#03001c","#1a0a00"]} style={{flex:1}}>
          <SafeAreaView style={{flex:1}}>
            <ScrollView contentContainerStyle={{padding:24,alignItems:"center"}}>
              <Text style={{color:"#fff",fontSize:22,fontWeight:"900",marginBottom:16}}>Round Over!</Text>
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
      <LinearGradient colors={["#03001c","#1a0a00"]} style={{flex:1}}>
        <SafeAreaView style={{flex:1}}>
          <View style={{flex:1,alignItems:"center",justifyContent:"center"}}>
            <Text style={{color:"#888",fontSize:16}}>Waiting…</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  function startGame() { setPhase("playing"); setRound(1); setScore(0); setWinner(null); startCountdown(); }

  function startCountdown() {
    setCountdown(3); setCapturing(false); setTapCount(0); setBotTaps(0); setWinner(null);
    clearInterval(countRef.current!);
    countRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(countRef.current!); startCapture(); return 0; }
        return c - 1;
      });
    }, 1000);
  }

  function startCapture() {
    setCapturing(true);
    setTimer(5);
    clearInterval(timerRef.current!);
    timerRef.current = setInterval(() => {
      setTimer((t) => {
        // Bot taps randomly
        setBotTaps((b) => b + (Math.random() > 0.5 ? 1 : 0));
        if (t <= 1) {
          clearInterval(timerRef.current!);
          endRound();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }

  function tap() {
    if (!capturing) return;
    setTapCount((c) => c + 1);
    Animated.sequence([
      Animated.timing(buttonAnim, { toValue: 0.88, duration: 50, useNativeDriver: true }),
      Animated.spring(buttonAnim, { toValue: 1, useNativeDriver: true }),
    ]).start();
  }

  function endRound() {
    setCapturing(false);
    setTapCount((myTaps) => {
      setBotTaps((bt) => {
        const bot = bt + Math.floor(Math.random() * 5) + 10; // bot baseline
        const w = myTaps > bot ? "you" : "bot";
        setWinner(w);
        if (w === "you") setScore((s) => s + 300);
        setTimeout(() => {
          if (round >= MAX_ROUNDS) setPhase("results");
          else { setRound((r) => r + 1); startCountdown(); }
        }, 1500);
        return bot;
      });
      return myTaps;
    });
  }

  if (phase === "lobby") return (
    <LinearGradient colors={["#03001c","#1a0a00"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}><Text style={s.backText}>← Back</Text></TouchableOpacity>
        <View style={s.center}>
          <Text style={{ fontSize: 64 }}>👍</Text>
          <Text style={s.title}>Thumb War</Text>
          <Text style={s.sub}>Tap your button as fast as you can in 5 seconds — more taps than your opponent wins!</Text>
          <View style={s.rules}>{[`${MAX_ROUNDS} rounds of rapid tapping`, "3-second countdown then GO!", "300 pts per round won"].map((r,i)=><Text key={i} style={s.rule}>• {r}</Text>)}</View>
          <TouchableOpacity style={s.btn} onPress={startGame}><LinearGradient colors={["#b5179e","#7209b7"]} style={s.btnI}><Text style={s.btnT}>FIGHT!</Text></LinearGradient></TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );

  if (phase === "results") return (
    <LinearGradient colors={["#03001c","#1a0a00"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <View style={s.center}>
          <Text style={{ fontSize: 64 }}>{score >= MAX_ROUNDS * 150 ? "🏆" : "👍"}</Text>
          <Text style={s.title}>{score >= MAX_ROUNDS * 150 ? "Thumb Champion!" : "Close match!"}</Text>
          <Text style={s.bigScore}>{score}</Text>
          <Text style={s.label}>POINTS FROM {MAX_ROUNDS} ROUNDS</Text>
          <TouchableOpacity style={s.btn} onPress={startGame}><LinearGradient colors={["#b5179e","#7209b7"]} style={s.btnI}><Text style={s.btnT}>REMATCH</Text></LinearGradient></TouchableOpacity>
          <TouchableOpacity style={s.homeBtn} onPress={() => router.back()}><Text style={s.homeBtnT}>Back to Home</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );

  return (
    <LinearGradient colors={["#03001c","#1a0a00"]} style={s.flex}>
      <SafeAreaView style={s.flex}>
        <View style={s.topBar}><Text style={s.prog}>Round {round}/{MAX_ROUNDS}</Text><Text style={s.scoreC}>{score} pts</Text></View>
        <View style={s.arenaSection}>
          {countdown > 0 ? (
            <View style={s.countdownBox}>
              <Text style={s.countdownNum}>{countdown}</Text>
              <Text style={s.countdownLabel}>Get ready…</Text>
            </View>
          ) : winner ? (
            <View style={s.resultBox}>
              <Text style={[s.resultText, { color: winner === "you" ? "#4ade80" : "#f87171" }]}>
                {winner === "you" ? "YOU WIN! 🏆" : "BOT WINS 🤖"}
              </Text>
              <Text style={s.tapsText}>Your taps: {tapCount} · Bot: {botTaps}</Text>
            </View>
          ) : (
            <View style={s.timerBox}>
              <Text style={s.timerBig}>{timer}</Text>
              <Text style={s.timerLabel}>TAP TAP TAP!</Text>
              <Text style={s.tapsLive}>Your taps: {tapCount}</Text>
            </View>
          )}
        </View>
        <View style={s.tapArea}>
          <Animated.View style={{ transform: [{ scale: buttonAnim }] }}>
            <TouchableOpacity onPress={tap} disabled={!capturing} activeOpacity={0.7} style={[s.tapBtn, !capturing && s.tapBtnDisabled]}>
              <LinearGradient colors={capturing ? ["#b5179e","#7209b7"] : ["#1a1a3a","#2a1a4a"]} style={s.tapBtnInner}>
                <Text style={s.tapBtnText}>{capturing ? "TAP!" : "⏳"}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>
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
  arenaSection:{flex:1,alignItems:"center",justifyContent:"center"},
  countdownBox:{alignItems:"center"}, countdownNum:{color:"#b5179e",fontSize:120,fontWeight:"900"},
  countdownLabel:{color:"#888",fontSize:16,fontWeight:"700"},
  resultBox:{alignItems:"center"}, resultText:{fontSize:32,fontWeight:"900",marginBottom:12},
  tapsText:{color:"#888",fontSize:14},
  timerBox:{alignItems:"center"}, timerBig:{color:"#fff",fontSize:80,fontWeight:"900"},
  timerLabel:{color:"#dc2626",fontSize:20,fontWeight:"900",marginBottom:12},
  tapsLive:{color:"#a78bfa",fontSize:18,fontWeight:"800"},
  tapArea:{paddingHorizontal:24,paddingBottom:48,alignItems:"center"},
  tapBtn:{width:160,height:160,borderRadius:80,overflow:"hidden"},
  tapBtnDisabled:{opacity:0.5},
  tapBtnInner:{flex:1,alignItems:"center",justifyContent:"center"},
  tapBtnText:{color:"#fff",fontSize:28,fontWeight:"900"},
});
