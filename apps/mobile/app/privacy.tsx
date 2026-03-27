import React from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";

const ACCENT = "#a78bfa";
const EFFECTIVE_DATE = "March 27, 2026";
const CONTACT_EMAIL  = "privacy@partyglue.app";

export default function PrivacyPolicyScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Text style={s.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Privacy Policy</Text>
        <View style={{ width: 64 }} />
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <Text style={s.meta}>Effective date: {EFFECTIVE_DATE}</Text>

        <Section title="1. Who We Are">
          PartyGlue ("we", "us", "our") operates the QueueDJ mobile application. We built the app so
          anyone can host or join a party room without needing an account. Your privacy matters — we
          collect only what is necessary to run the service.
        </Section>

        <Section title="2. What We Collect">
          <BulletItem label="Anonymous device ID">
            A randomly generated UUID created on first launch and stored only on your device. It is
            never tied to your name, email, or any real-world identity.
          </BulletItem>
          <BulletItem label="Display name">
            Optional. You choose it — it is only stored locally and shared with the room you join.
            We do not require a real name.
          </BulletItem>
          <BulletItem label="Room activity">
            Votes, track requests, game answers, and vibe credits earned during a session. This data
            is associated with your anonymous device ID only.
          </BulletItem>
          <BulletItem label="Avatar customisation">
            Your avatar appearance choices (colors, outfit, expression) are stored locally on your
            device.
          </BulletItem>
          <BulletItem label="Push notification token">
            If you allow notifications, we store an Expo push token to send session reminders and
            streak alerts. You can disable this at any time in your device settings.
          </BulletItem>
          <BulletItem label="Spotify OAuth token">
            If you connect Spotify, we receive a temporary access token to search tracks and retrieve
            30-second previews. We do not store your Spotify credentials, email, or listening history.
            The token is used only during your active session.
          </BulletItem>
          <BulletItem label="Session feedback signals">
            Anonymised signals (track skips, upvotes, downvotes) are logged to improve the AI
            recommendation engine. These signals contain no personal identifiers — only track IDs and
            crowd state labels. They are automatically deleted after 90 days.
          </BulletItem>
          <BulletItem label="Crash reports">
            If the app crashes, Sentry may capture a stack trace including device type and OS version.
            No personal data or room content is included in crash reports.
          </BulletItem>
        </Section>

        <Section title="3. What We Do Not Collect">
          We do not collect your real name, email address, phone number, payment details, location, or
          any biometric data. We do not use tracking pixels, advertising SDKs, or sell your data to
          third parties.
        </Section>

        <Section title="4. How We Use Your Data">
          <BulletItem label="To run the service">
            Your anonymous ID lets you rejoin rooms, keep your credits balance, and maintain your streak.
          </BulletItem>
          <BulletItem label="To improve recommendations">
            Anonymised session signals train the AI transition model to suggest better tracks over time.
          </BulletItem>
          <BulletItem label="To send notifications">
            With your permission, we send streak reminders and party invites. We never send marketing
            emails because we do not have your email.
          </BulletItem>
          <BulletItem label="To fix crashes">
            Crash reports help us find and fix bugs quickly.
          </BulletItem>
        </Section>

        <Section title="5. Third-Party Services">
          <BulletItem label="Railway">Hosts our backend servers (EU/US regions).</BulletItem>
          <BulletItem label="Sentry">Crash and error reporting. sentry.io/privacy</BulletItem>
          <BulletItem label="Expo (Expensify)">Push notification delivery. expo.dev/privacy</BulletItem>
          <BulletItem label="Spotify AB">Track search and preview. spotify.com/privacy</BulletItem>
          <BulletItem label="AcoustID / MusicBrainz">
            Anonymous audio fingerprinting to identify track ISRCs. acoustid.org
          </BulletItem>
          We do not share your data with any other third parties.
        </Section>

        <Section title="6. Data Retention">
          {[
            ["Session activity", "90 days"],
            ["AI feedback signals", "90 days, then auto-deleted"],
            ["Push notification token", "Until you disable notifications or uninstall"],
            ["Anonymous device ID", "Lives on your device only — deleted when you clear app data"],
            ["Spotify token", "Cleared at end of session — not persisted"],
            ["Crash reports", "30 days (Sentry default)"],
          ].map(([k, v]) => (
            <Text key={k} style={s.tableRow}>
              <Text style={s.tableKey}>{k}:{" "}</Text>
              <Text style={s.tableVal}>{v}</Text>
            </Text>
          ))}
        </Section>

        <Section title="7. Your Rights">
          Because we do not hold an account linked to your identity, most data lives on your device
          and you can clear it by uninstalling the app. If you want to request deletion of any
          server-side data associated with your anonymous device ID, email us at{" "}
          <Text style={{ color: ACCENT }}>{CONTACT_EMAIL}</Text> with the subject line "Data Deletion
          Request" and include your device ID (found in Settings → About).{"\n\n"}
          If you are in the EU or UK, you have the right to access, rectify, and erase your data
          under GDPR. Contact us at the email above.
        </Section>

        <Section title="8. Children">
          QueueDJ is not directed at children under 13. We do not knowingly collect data from anyone
          under 13. If you believe a child has used the app, contact us and we will delete associated
          server-side data immediately.
        </Section>

        <Section title="9. Changes to This Policy">
          If we make material changes, we will update the effective date above. Continued use of the
          app after changes means you accept the updated policy.
        </Section>

        <Section title="10. Contact">
          Questions? Email us at{" "}
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
      <Text style={s.body2}>{children}</Text>
    </View>
  );
}

function BulletItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Text style={s.bullet}>
      <Text style={s.bulletLabel}>{label}: </Text>
      {children}{"\n"}
    </Text>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: "#0a0a0a" },
  header:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#1a1a2e" },
  back:         { width: 64 },
  backText:     { color: ACCENT, fontSize: 15, fontWeight: "600" },
  title:        { color: "#fff", fontSize: 17, fontWeight: "800" },
  body:         { padding: 20, paddingBottom: 60 },
  meta:         { color: "#555", fontSize: 12, marginBottom: 24 },
  section:      { marginBottom: 28 },
  sectionTitle: { color: ACCENT, fontSize: 13, fontWeight: "800", letterSpacing: 0.5, marginBottom: 10, textTransform: "uppercase" },
  body2:        { color: "#ccc", fontSize: 14, lineHeight: 22 },
  bullet:       { color: "#ccc", fontSize: 14, lineHeight: 22 },
  bulletLabel:  { color: "#e5e7eb", fontWeight: "700" },
  tableRow:     { color: "#ccc", fontSize: 13, lineHeight: 22 },
  tableKey:     { color: "#e5e7eb", fontWeight: "600" },
  tableVal:     { color: "#888" },
  footer:       { color: "#333", fontSize: 12, textAlign: "center", marginTop: 32 },
});
