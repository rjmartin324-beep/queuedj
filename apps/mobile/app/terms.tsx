import React from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";

const ACCENT = "#a78bfa";
const EFFECTIVE_DATE = "March 27, 2026";
const CONTACT_EMAIL  = "support@partyglue.app";

export default function TermsOfServiceScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Terms of Service</Text>
        <View style={{ width: 64 }} />
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <Text style={s.meta}>Effective date: {EFFECTIVE_DATE}</Text>

        <Text style={s.intro}>
          By downloading or using QueueDJ ("the app"), you agree to these Terms of Service.
          If you do not agree, do not use the app.
        </Text>

        <Section title="1. The Service">
          QueueDJ is a social music and party experience app that lets one person host a room and
          invite others to vote on music, play games, and interact in real time. The service is
          provided by PartyGlue ("we", "us", "our").
        </Section>

        <Section title="2. No Account Required">
          You do not need to create an account to use QueueDJ. The app assigns you an anonymous
          device ID on first launch. You can optionally choose a display name. This anonymous
          identity is stored locally on your device.
        </Section>

        <Section title="3. Acceptable Use">
          You agree not to:{"\n\n"}
          {"  "}• Use the app for any unlawful purpose{"\n"}
          {"  "}• Submit offensive, hateful, or sexually explicit content in shout-outs or display names{"\n"}
          {"  "}• Attempt to reverse-engineer, hack, or disrupt the service{"\n"}
          {"  "}• Use bots, scripts, or automated tools to interact with the app{"\n"}
          {"  "}• Impersonate another person or entity{"\n"}
          {"  "}• Interfere with other users' experience of the service
        </Section>

        <Section title="4. Music & Content">
          QueueDJ enables track search and 30-second audio previews via the Spotify API. Full
          playback of tracks through the app is subject to your own music licenses and the terms of
          any connected streaming service.{"\n\n"}
          If you use local audio files, you are solely responsible for ensuring you have the right
          to play those files. We are not responsible for any copyright infringement resulting from
          your use of the playback features.
        </Section>

        <Section title="5. Vibe Credits">
          Vibe Credits are an in-app reward currency with no monetary value. They cannot be
          transferred, exchanged for cash, or used outside the app. We reserve the right to adjust
          credit balances or the credit system at any time without notice.
        </Section>

        <Section title="6. User-Generated Content">
          Any display names, shout-out messages, or custom game prompts you submit are your
          responsibility. By submitting content, you grant us a non-exclusive, royalty-free licence
          to display that content to other users in the same room session. We do not claim ownership
          of your content.{"\n\n"}
          We reserve the right to remove content or suspend users who violate these terms.
        </Section>

        <Section title="7. Intellectual Property">
          The QueueDJ app, including its code, design, graphics, and AI models, is owned by
          PartyGlue. You may not copy, distribute, or create derivative works from any part of the
          app without our written permission.{"\n\n"}
          All third-party trademarks (including Spotify) remain the property of their respective
          owners.
        </Section>

        <Section title="8. Disclaimer of Warranties">
          THE APP IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR
          IMPLIED. WE DO NOT WARRANT THAT THE APP WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF
          VIRUSES. YOUR USE OF THE APP IS AT YOUR OWN RISK.
        </Section>

        <Section title="9. Limitation of Liability">
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, PARTYGLUE SHALL NOT BE LIABLE FOR ANY INDIRECT,
          INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE APP,
          INCLUDING LOSS OF DATA, LOSS OF PROFITS, OR ANY OTHER INTANGIBLE LOSSES, EVEN IF WE HAVE
          BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.{"\n\n"}
          OUR TOTAL LIABILITY TO YOU FOR ANY CLAIM ARISING FROM THESE TERMS SHALL NOT EXCEED $10 USD.
        </Section>

        <Section title="10. Termination">
          We may suspend or terminate your access to the app at any time, without notice, if you
          violate these terms or if we discontinue the service. Upon termination, your right to use
          the app ceases immediately.
        </Section>

        <Section title="11. Changes to These Terms">
          We may update these terms from time to time. We will update the effective date above. Your
          continued use of the app after changes constitutes acceptance of the updated terms.
        </Section>

        <Section title="12. Governing Law">
          These terms are governed by the laws of the United States. Any disputes shall be resolved
          in the courts of the United States, and you consent to personal jurisdiction there.
        </Section>

        <Section title="13. Contact">
          Questions about these terms? Email us at{" "}
          <Text style={{ color: ACCENT }}>{CONTACT_EMAIL}</Text>
        </Section>

        <Text style={s.footer}>PartyGlue · {EFFECTIVE_DATE}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      <Text style={s.bodyText}>{children}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: "#0a0a0a" },
  header:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#1a1a2e" },
  back:         { width: 64 },
  backText:     { color: ACCENT, fontSize: 15, fontWeight: "600" },
  title:        { color: "#fff", fontSize: 17, fontWeight: "800" },
  body:         { padding: 20, paddingBottom: 60 },
  meta:         { color: "#555", fontSize: 12, marginBottom: 12 },
  intro:        { color: "#aaa", fontSize: 14, lineHeight: 22, marginBottom: 28, fontStyle: "italic" },
  section:      { marginBottom: 28 },
  sectionTitle: { color: ACCENT, fontSize: 13, fontWeight: "800", letterSpacing: 0.5, marginBottom: 10, textTransform: "uppercase" },
  bodyText:     { color: "#ccc", fontSize: 14, lineHeight: 22 },
  footer:       { color: "#333", fontSize: 12, textAlign: "center", marginTop: 32 },
});
