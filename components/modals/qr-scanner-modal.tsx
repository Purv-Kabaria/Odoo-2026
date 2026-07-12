"use client";

import * as React from "react";
import { Camera, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type QrScannerModalProps = {
  onScanSuccess: (decodedText: string) => void;
};

const SCANNER_ELEMENT_ID = "qr-scanner-region";

export function QrScannerModal({ onScanSuccess }: QrScannerModalProps) {
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Use a ref to hold the scanner instance so we can stop it on cleanup
  // without depending on React state (avoids stale-closure issues).
  const scannerRef = React.useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const mountedRef = React.useRef(true);

  // Track mount/unmount for the whole component
  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Start/stop the camera scanner when the dialog opens/closes.
  React.useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setError(null);

    // Dynamically import html5-qrcode so it never runs on the server.
    void (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");

        // Small delay to let the dialog DOM mount the target div.
        await new Promise((r) => setTimeout(r, 150));
        if (cancelled || !mountedRef.current) return;

        const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, /* verbose= */ false);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            // Successful scan — stop scanning immediately, then notify parent.
            void scanner
              .stop()
              .catch(() => undefined)
              .then(() => {
                scannerRef.current = null;
                if (mountedRef.current) {
                  setOpen(false);
                  onScanSuccess(decodedText);
                }
              });
          },
          // Ignore per-frame "no QR found" errors — this callback fires constantly.
          () => undefined,
        );
      } catch (err) {
        if (!cancelled && mountedRef.current) {
          const msg =
            err instanceof Error ? err.message : "Camera access denied";
          if (msg.includes("NotAllowedError") || msg.includes("Permission")) {
            setError(
              "Camera permission was denied. Please allow camera access in your browser settings and try again.",
            );
          } else {
            setError(msg);
          }
        }
      }
    })();

    // Cleanup: stop the scanner when the dialog closes or the component unmounts.
    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      if (scanner) {
        void scanner.stop().catch(() => undefined);
        scannerRef.current = null;
      }
    };
  }, [open, onScanSuccess]);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="shrink-0 cursor-pointer"
        onClick={() => setOpen(true)}
        aria-label="Scan QR code"
      >
        <Camera className="size-4" />
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) {
            // Ensure camera stops before React unmounts the dialog content.
            const scanner = scannerRef.current;
            if (scanner) {
              void scanner.stop().catch(() => undefined);
              scannerRef.current = null;
            }
          }
          setOpen(next);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Scan QR Code</DialogTitle>
            <DialogDescription>
              Point your camera at the QR code on the asset to search for it instantly.
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <XCircle className="size-10 text-destructive" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button
                variant="outline"
                className="cursor-pointer"
                onClick={() => {
                  setError(null);
                  // Re-trigger the scanner by toggling open.
                  setOpen(false);
                  window.requestAnimationFrame(() => setOpen(true));
                }}
              >
                Retry
              </Button>
            </div>
          ) : (
            <div
              id={SCANNER_ELEMENT_ID}
              className="mx-auto w-full overflow-hidden rounded-md"
              style={{ minHeight: 280 }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
