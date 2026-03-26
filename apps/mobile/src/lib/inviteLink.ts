import { Share } from "react-native"
import * as Clipboard from "expo-clipboard"

export function generateInviteLink(roomCode: string): string {
  return `https://queuedj.app/join/${roomCode}`
}

export async function shareInviteLink(roomCode: string): Promise<void> {
  const link = generateInviteLink(roomCode)
  await Share.share({
    message: `Join my QueueDJ party! Room code: ${roomCode}\n${link}`,
    url:     link,
    title:   "Join my QueueDJ party",
  })
}

export async function copyInviteLink(roomCode: string): Promise<void> {
  const link = generateInviteLink(roomCode)
  await Clipboard.setStringAsync(link)
}
