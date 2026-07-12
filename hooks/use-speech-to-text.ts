import * as React from "react";

export type SpeechToTextErrorKind = "not-allowed" | "no-microphone" | "unknown";

type UseSpeechToTextOptions = {
  /** Called once per newly-finalized transcript chunk — never the full running transcript. */
  onFinalResult: (text: string) => void;
  /** Called for non-fatal, user-facing errors (permission denial, missing mic, etc). Not called for natural silence. */
  onError?: (kind: SpeechToTextErrorKind, message: string) => void;
  lang?: string;
};

type UseSpeechToTextResult = {
  isSupported: boolean;
  isListening: boolean;
  interimTranscript: string;
  start: () => void;
  stop: () => void;
};

function getSpeechRecognitionConstructor(): (new () => SpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

/**
 * Thin, reusable wrapper around the native Web Speech API. Deliberately
 * knows nothing about *where* transcribed text goes — callers own their own
 * text state and decide how to merge each finalized chunk (append, replace,
 * etc), which is what keeps this hook reusable across different textareas.
 */
export function useSpeechToText({
  onFinalResult,
  onError,
  lang,
}: UseSpeechToTextOptions): UseSpeechToTextResult {
  const [isSupported, setIsSupported] = React.useState(false);
  const [isListening, setIsListening] = React.useState(false);
  const [interimTranscript, setInterimTranscript] = React.useState("");

  const recognitionRef = React.useRef<SpeechRecognition | null>(null);
  const onFinalResultRef = React.useRef(onFinalResult);
  const onErrorRef = React.useRef(onError);

  React.useEffect(() => {
    onFinalResultRef.current = onFinalResult;
    onErrorRef.current = onError;
  }, [onFinalResult, onError]);

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setIsSupported(getSpeechRecognitionConstructor() !== null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  React.useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, []);

  const start = React.useCallback(() => {
    const SpeechRecognitionCtor = getSpeechRecognitionConstructor();
    if (!SpeechRecognitionCtor) {
      onErrorRef.current?.("unknown", "Voice input isn't supported in this browser. Try Chrome or Edge.");
      return;
    }
    if (recognitionRef.current) return; // already listening

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = lang ?? navigator.language ?? "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let interim = "";
      // event.results is cumulative/indexed — only results from resultIndex
      // onward are new since the last event, and only isFinal ones should
      // be handed off (interim ones are shown live, then superseded).
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) {
          const trimmed = transcript.trim();
          if (trimmed) onFinalResultRef.current(trimmed);
        } else {
          interim += transcript;
        }
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event) => {
      if (event.error === "no-speech") return; // natural silence, not a real error
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        onErrorRef.current?.(
          "not-allowed",
          "Microphone access was denied. Enable it in your browser's site settings to use voice input.",
        );
      } else if (event.error === "audio-capture") {
        onErrorRef.current?.("no-microphone", "No microphone was found.");
      } else {
        onErrorRef.current?.("unknown", "Voice input stopped unexpectedly.");
      }
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setIsListening(false);
      setInterimTranscript("");
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  }, [lang]);

  const stop = React.useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  return { isSupported, isListening, interimTranscript, start, stop };
}
