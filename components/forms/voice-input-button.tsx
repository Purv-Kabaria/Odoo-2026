"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Mic, MicOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSpeechToText } from "@/hooks/use-speech-to-text";
import { cn } from "@/lib/utils";

type VoiceInputButtonProps = {
  /** Called once per finalized transcript chunk — caller decides how to merge it into its own text state. */
  onFinalResult: (text: string) => void;
  className?: string;
  /** Overrides the default aria-label/tooltip, e.g. "Dictate condition notes". */
  label?: string;
};

/**
 * Self-contained mic toggle: owns speech recognition, permission/compat
 * errors (as toasts), and the recording-state animation. Drop it next to any
 * textarea's label to add voice input — it never touches the textarea's
 * value directly, so it composes with any controlled text field.
 */
export function VoiceInputButton({ onFinalResult, className, label }: VoiceInputButtonProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);

  React.useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const frame = window.requestAnimationFrame(() => setPrefersReducedMotion(query.matches));
    const onChange = () => setPrefersReducedMotion(query.matches);
    query.addEventListener("change", onChange);
    return () => {
      window.cancelAnimationFrame(frame);
      query.removeEventListener("change", onChange);
    };
  }, []);

  const { isSupported, isListening, start, stop } = useSpeechToText({
    onFinalResult,
    onError: (_kind, message) => toast.error(message),
  });

  const handleClick = () => {
    if (!isSupported) {
      toast.error("Voice input isn't supported in this browser. Try Chrome or Edge.");
      return;
    }
    if (isListening) {
      stop();
    } else {
      start();
    }
  };

  const tooltipLabel = !isSupported
    ? "Voice input not supported in this browser"
    : isListening
      ? "Stop dictation"
      : (label ?? "Start dictation");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("relative inline-flex", className)}>
          {isListening && (
            <motion.span
              aria-hidden="true"
              className="absolute inset-0 rounded-lg bg-destructive/40"
              animate={
                prefersReducedMotion
                  ? { opacity: 0.35 }
                  : { opacity: [0.35, 0, 0.35], scale: [1, 1.6, 1] }
              }
              transition={
                prefersReducedMotion
                  ? undefined
                  : { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
              }
            />
          )}
          <Button
            type="button"
            variant={isListening ? "destructive" : "outline"}
            size="icon-sm"
            disabled={!isSupported}
            onClick={handleClick}
            aria-pressed={isListening}
            aria-label={tooltipLabel}
            className="relative cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSupported ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{tooltipLabel}</TooltipContent>
    </Tooltip>
  );
}
