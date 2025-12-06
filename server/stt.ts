/**
 * Speech-to-Text (STT) helper functions
 * Integrates with Whisper API via Manus built-in voice transcription
 */

import { transcribeAudio } from "./_core/voiceTranscription";
import { storagePut } from "./storage";

/**
 * Transcribe audio file to text
 * @param audioData - Base64 encoded audio data
 * @param mimeType - Audio MIME type (e.g., "audio/webm", "audio/mp3")
 * @param language - Optional language code (e.g., "en", "pt")
 * @returns Transcribed text
 */
export async function transcribeAudioData(
  audioData: string,
  mimeType: string,
  language?: string
): Promise<string> {
  // Upload audio to S3 first
  const fileKey = `stt/${Date.now()}.${getExtensionFromMimeType(mimeType)}`;
  const buffer = Buffer.from(audioData, 'base64');
  const { url } = await storagePut(fileKey, buffer, mimeType);

  // Transcribe using Whisper API
  const result = await transcribeAudio({
    audioUrl: url,
    language,
  });

  // Check if transcription was successful
  if ('error' in result) {
    throw new Error(`Transcription failed: ${result.error}`);
  }

  return result.text;
}

/**
 * Get file extension from MIME type
 */
function getExtensionFromMimeType(mimeType: string): string {
  const map: Record<string, string> = {
    "audio/webm": "webm",
    "audio/mp3": "mp3",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/ogg": "ogg",
    "audio/m4a": "m4a",
  };
  return map[mimeType] || "webm";
}
