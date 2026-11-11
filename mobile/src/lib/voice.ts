import { requireOptionalNativeModule } from "expo";
import type { ExpoSpeechRecognitionModuleType } from "expo-speech-recognition/build/ExpoSpeechRecognitionModule.types";
import * as Speech from "expo-speech";
import { SPEECH_LANG } from "./extras";

/**
 * Speech input is best-effort. The recogniser is a native module, present in a development build
 * but not in Expo Go, so it's looked up optionally: when it's missing the mic button is hidden and
 * the family types instead.
 */
const recogniser = requireOptionalNativeModule<ExpoSpeechRecognitionModuleType>("ExpoSpeechRecognition");

export const canListen = () => {
  try {
    return Boolean(recogniser?.isRecognitionAvailable());
  } catch {
    return false;
  }
};

const VOICE_ERRORS: Record<string, string> = {
  "not-allowed": "Allow the microphone and speech recognition for KlimateX in Settings to ask by voice.",
  "service-not-allowed": "Speech recognition is turned off on this phone. You can type instead.",
  "language-not-supported": "This phone can't listen in that language yet. Try English or type your question.",
  "no-speech": "We didn't hear anything. Tap the microphone and speak.",
  "speech-timeout": "We didn't hear anything. Tap the microphone and speak.",
  "audio-capture": "The microphone isn't available right now. You can type instead.",
  network: "Voice needs a connection right now. You can type instead.",
};

/**
 * Listens once and reports the final transcript. Returns a function that stops listening.
 * `onEnd` always fires, after the result or the error.
 */
export async function listen(
  lang: string,
  handlers: { onResult: (text: string) => void; onError: (message: string) => void; onEnd: () => void },
  tag: string = SPEECH_LANG[lang] ?? "en-NG",
): Promise<() => void> {
  if (!recogniser) {
    handlers.onError("Voice isn't available in this build. You can type instead.");
    handlers.onEnd();
    return () => undefined;
  }
  const permission = await recogniser.requestPermissionsAsync();
  if (!permission.granted) {
    handlers.onError(VOICE_ERRORS["not-allowed"]);
    handlers.onEnd();
    return () => undefined;
  }
  let reported = false;
  let retry: string | null = null;
  const subs = [
    recogniser.addListener("result", (event) => {
      const text = event.results[0]?.transcript?.trim();
      if (event.isFinal && text) {
        reported = true;
        handlers.onResult(text);
      }
    }),
    recogniser.addListener("error", (event) => {
      reported = true;
      // Not every phone has a Nigerian English recogniser; plain English understands Nigerian speakers well enough.
      if (event.error === "language-not-supported" && tag.startsWith("en-") && tag !== "en-US") {
        retry = "en-US";
        return;
      }
      if (event.error !== "aborted") handlers.onError(VOICE_ERRORS[event.error] ?? "Voice isn't working right now. You can type instead.");
    }),
    recogniser.addListener("end", () => {
      subs.forEach((s) => s.remove());
      if (retry) {
        void listen(lang, handlers, retry);
        return;
      }
      // Never end silently: if nothing was heard and no error came, say so.
      if (!reported) handlers.onError(VOICE_ERRORS["no-speech"]);
      handlers.onEnd();
    }),
  ];
  recogniser.start({ lang: tag, interimResults: false, maxAlternatives: 1, continuous: false });
  return () => recogniser.stop();
}

/** Reads text aloud in the family's language, falling back to Nigerian or any English voice. */
export async function speak(text: string, lang: string) {
  const tag = SPEECH_LANG[lang] ?? "en-NG";
  let voice: string | undefined;
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    voice = (voices.find((v) => v.language === tag) ?? voices.find((v) => v.language.startsWith(tag.slice(0, 2))) ?? voices.find((v) => v.language === "en-NG"))?.identifier;
  } catch {
    voice = undefined;
  }
  Speech.stop();
  Speech.speak(text, { language: voice ? undefined : tag, voice, rate: 0.95 });
}

export const stopSpeaking = () => Speech.stop();
