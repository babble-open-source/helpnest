import { Room, RoomEvent } from 'livekit-client'
import { setVoiceState } from '../state'
import { appendTranscript, setSourceChips } from '../views/voice'
import type { VoiceState } from '../types'

interface VoiceTokenResponse {
  token: string
  livekitUrl: string
  roomName: string
  participantIdentity: string
  conversationId: string
}

type DataMessage =
  | { type: 'transcript_user'; text: string; isFinal: boolean }
  | { type: 'transcript_agent'; text: string; isFinal: boolean }
  | {
      type: 'sources'
      sources: { id: string; title: string; slug: string; collectionSlug: string }[]
    }
  | { type: 'state'; state: VoiceState }
  | { type: 'error'; message: string; fallbackToText: boolean }
  | { type: 'session_end'; reason: 'timeout' | 'escalated' | 'completed' }

let currentRoom: Room | null = null
let currentPanel: HTMLElement | null = null

export async function startVoiceSession(tokenData: VoiceTokenResponse, panel: HTMLElement) {
  currentPanel = panel

  const room = new Room()
  currentRoom = room

  room.on(RoomEvent.DataReceived, (payload: Uint8Array) => {
    try {
      const text = new TextDecoder().decode(payload)
      const msg = JSON.parse(text) as DataMessage
      handleDataMessage(msg)
    } catch {}
  })

  room.on(RoomEvent.Disconnected, () => {
    setVoiceState('idle')
    currentRoom = null
  })

  room.on(RoomEvent.ParticipantConnected, () => {
    setVoiceState('listening')
  })

  try {
    await room.connect(tokenData.livekitUrl, tokenData.token)
    await room.localParticipant.setMicrophoneEnabled(true)
    setVoiceState('listening')
  } catch (err) {
    setVoiceState('error')
    throw err
  }
}

export function stopVoiceSession() {
  if (currentRoom) {
    currentRoom.disconnect()
    currentRoom = null
  }
  setVoiceState('idle')
}

export function isSessionActive(): boolean {
  return currentRoom !== null && currentRoom.state === 'connected'
}

function handleDataMessage(msg: DataMessage) {
  if (!currentPanel) return

  switch (msg.type) {
    case 'transcript_user':
      if (msg.isFinal) {
        appendTranscript(currentPanel, 'user', msg.text)
      }
      break

    case 'transcript_agent':
      if (msg.isFinal) {
        appendTranscript(currentPanel, 'agent', msg.text)
      }
      break

    case 'sources':
      setSourceChips(currentPanel, msg.sources)
      break

    case 'state':
      setVoiceState(msg.state)
      break

    case 'error':
      setVoiceState('error')
      appendTranscript(currentPanel, 'agent', msg.message)
      break

    case 'session_end':
      setVoiceState('idle')
      stopVoiceSession()
      break
  }
}
