import React, { useRef, useState, useCallback } from "react";
import { View, TouchableOpacity, Text, StyleSheet, Dimensions } from "react-native";
import { Video, ResizeMode } from "expo-av";
import { StatusBar } from "expo-status-bar";

const { width: SW, height: SH } = Dimensions.get("window");

interface Props {
  onFinish: () => void;
}

export function IntroVideoScreen({ onFinish }: Props) {
  const videoRef = useRef<Video>(null);
  const [ready, setReady] = useState(false);

  const handleFinish = useCallback(() => {
    onFinish();
  }, [onFinish]);

  return (
    <View style={s.container}>
      <StatusBar hidden />
      <Video
        ref={videoRef}
        source={require("../../assets/intro.mp4.mp4")}
        style={s.video}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping={false}
        isMuted={false}
        onReadyForDisplay={() => setReady(true)}
        onPlaybackStatusUpdate={(status) => {
          if (status.isLoaded && status.didJustFinish) {
            handleFinish();
          }
        }}
      />

      {/* Skip button — always visible so user is never stuck */}
      <TouchableOpacity style={s.skipBtn} onPress={handleFinish} activeOpacity={0.7}>
        <Text style={s.skipText}>Skip  ›</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    width: SW,
    height: SH,
    backgroundColor: "#000",
  },
  video: {
    position: "absolute",
    top: 0,
    left: 0,
    width: SW,
    height: SH,
  },
  skipBtn: {
    position: "absolute",
    bottom: 52,
    right: 24,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  skipText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
