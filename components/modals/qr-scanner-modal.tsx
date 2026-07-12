"use client";

import * as React from "react";
import { Camera, Upload, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type QrScannerModalProps = {
  onScanSuccess: (decodedText: string) => void;
};

const SCANNER_ELEMENT_ID = "qr-scanner-region";

/**
 * Distinct, non-technical messages per real-world failure mode — a raw
 * `getUserMedia` rejection (e.g. "NotFoundError: Requested device not
 * found") is meaningless to a user, and every one of these cases still
 * leaves the upload-a-photo fallback available, so the feature works
 * regardless of whether the device even has a camera.
 */
function messageForCameraError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  const msg = err instanceof Error ? err.message : String(err);

  if (name === "NotAllowedError" || name === "PermissionDeniedError" || /NotAllowedError|Permission/.test(msg)) {
    return "Camera permission was denied. Allow camera access in your browser's site settings, or upload a photo of the code instead.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError" || /NotFoundError/.test(msg)) {
    return "No camera was found on this device. Upload a photo of the code instead.";
  }
  if (name === "NotReadableError" || name === "TrackStartError" || /NotReadableError/.test(msg)) {
    return "Your camera couldn't be started — it may be in use by another app. Upload a photo of the code instead.";
  }
  if (name === "OverconstrainedError") {
    return "Your camera doesn't support the requested settings. Upload a photo of the code instead.";
  }
  return "Camera scanning isn't available right now. Upload a photo of the code instead.";
}

/** Live camera capture needs a secure context (HTTPS or localhost) and browser support — neither is guaranteed, so this is checked before ever attempting to open the camera. */
function isCameraCaptureSupported(): boolean {
  if (typeof window === "undefined") return false;
  return window.isSecureContext && Boolean(navigator.mediaDevices?.getUserMedia);
}

export function QrScannerModal({ onScanSuccess }: QrScannerModalProps) {
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isScanningFile, setIsScanningFile] = React.useState(false);
  // Camera support is a device/browser capability, not React state that
  // changes mid-session — computed lazily on first render to stay
  // hydration-safe (it depends on `window`, unavailable during SSR).
  const [cameraSupported, setCameraSupported] = React.useState<boolean | null>(null);
  // Use a ref to hold the scanner instance so we can stop it on cleanup
  // without depending on React state (avoids stale-closure issues).
  const scannerRef = React.useRef<import("html5-qrcode").Html5Qrcode | null>(null);
  const mountedRef = React.useRef(true);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Track mount/unmount for the whole component
  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => setCameraSupported(isCameraCaptureSupported()));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  // Start/stop the camera scanner when the dialog opens/closes.
  React.useEffect(() => {
    if (!open || cameraSupported !== true) return;

    let cancelled = false;
    const clearErrorFrame = window.requestAnimationFrame(() => setError(null));

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
            const currentScanner = scannerRef.current;
            if (currentScanner) {
              try {
                if (currentScanner.isScanning) {
                  void currentScanner.stop().catch(() => undefined);
                }
              } catch {}
              scannerRef.current = null;
            }
            if (mountedRef.current) {
              setOpen(false);
              onScanSuccess(decodedText);
            }
          },
          // Ignore per-frame "no QR found" errors — this callback fires constantly.
          () => undefined,
        );
      } catch (err) {
        if (!cancelled && mountedRef.current) {
          setError(messageForCameraError(err));
        }
      }
    })();

    // Cleanup: stop the scanner when the dialog closes or the component unmounts.
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(clearErrorFrame);
      const scanner = scannerRef.current;
      if (scanner) {
        try {
          if (scanner.isScanning) {
            void scanner.stop().catch(() => undefined);
          }
        } catch {}
        scannerRef.current = null;
      }
    };
  }, [open, cameraSupported, onScanSuccess]);

  const stopCamera = () => {
    const scanner = scannerRef.current;
    if (scanner) {
      try {
        if (scanner.isScanning) {
          void scanner.stop().catch(() => undefined);
        }
      } catch {}
      scannerRef.current = null;
    }
  };

  const handleFileChosen = async (file: File | undefined) => {
    if (!file) return;
    setIsScanningFile(true);
    setError(null);
    try {
      stopCamera();
      const { Html5Qrcode } = await import("html5-qrcode");
      // scanFile is an instance method — it still needs a container element
      // (even though showImage=false means nothing is rendered into it),
      // so a fresh scanner is created against the same always-mounted
      // region used for live camera scanning.
      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, false);
      const decodedText = await scanner.scanFile(file, false);
      if (!mountedRef.current) return;
      setOpen(false);
      onScanSuccess(decodedText);
    } catch {
      if (mountedRef.current) {
        setError("No QR code was found in that photo. Try a clearer, well-lit photo of just the code.");
      }
    } finally {
      if (mountedRef.current) setIsScanningFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const showUploadOnly = cameraSupported === false;

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
          if (!next) stopCamera();
          setOpen(next);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Scan QR Code</DialogTitle>
            <DialogDescription>
              {showUploadOnly
                ? "Upload a photo of the QR code on the asset to search for it instantly."
                : "Point your camera at the QR code on the asset, or upload a photo of it instead."}
            </DialogDescription>
          </DialogHeader>

          {/* Always mounted while the dialog is open — scanFile() (used by the
              upload fallback below) needs this container to exist even when
              the live camera view itself isn't the visible state. */}
          <div
            id={SCANNER_ELEMENT_ID}
            className={cn(
              "mx-auto w-full overflow-hidden rounded-md",
              (showUploadOnly || error) && "hidden",
            )}
            style={{ minHeight: 280 }}
          />

          {error ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <XCircle className="size-10 text-destructive" />
              <p className="text-sm text-muted-foreground">{error}</p>
              {!showUploadOnly && (
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
                  Retry camera
                </Button>
              )}
            </div>
          ) : null}

          <div className="flex flex-col items-center gap-2 border-t border-border pt-3">
            {!showUploadOnly && !error && (
              <p className="text-xs text-muted-foreground">No camera, or scanning not working?</p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => void handleFileChosen(e.target.files?.[0])}
            />
            <Button
              type="button"
              variant="secondary"
              className="w-full cursor-pointer gap-2"
              disabled={isScanningFile}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-4" />
              {isScanningFile ? "Reading photo..." : "Upload a photo instead"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
