import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Html5QrcodeCtor = new (elementId: string) => {
  start: (
    cameraIdOrConfig: unknown,
    config: { fps: number; qrbox?: { width: number; height: number } },
    onSuccess: (decodedText: string) => void,
    onError?: (err: string) => void,
  ) => Promise<void>;
  stop: () => Promise<void>;
  clear: () => void;
};

export function BarcodeScannerDialog({
  open,
  onOpenChange,
  onDetected,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetected: (code: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const scannerRef = useRef<InstanceType<Html5QrcodeCtor> | null>(null);
  const containerId = "barcode-scanner-region";

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    setStarting(true);

    (async () => {
      try {
        const mod = await import("html5-qrcode");
        const Html5Qrcode = mod.Html5Qrcode as unknown as Html5QrcodeCtor;
        if (cancelled) return;
        const scanner = new Html5Qrcode(containerId);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 160 } },
          (decodedText) => {
            onDetected(decodedText);
          },
          () => {},
        );
        if (cancelled) {
          await scanner.stop().catch(() => {});
        }
      } catch (err) {
        console.error(err);
        setError(
          "Não foi possível aceder à câmara. Autoriza o acesso nas definições de privacidade do sistema (Câmara) e volta a tentar.",
        );
      } finally {
        if (!cancelled) setStarting(false);
      }
    })();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        s.stop()
          .then(() => s.clear())
          .catch(() => {});
      }
    };
  }, [open, onDetected]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bipar produto</DialogTitle>
          <DialogDescription>
            Aponta a câmara ao código de barras EAN-13 da embalagem.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-hidden rounded-lg border border-border bg-black">
          <div id={containerId} className="min-h-[240px] w-full" />
        </div>

        {starting && (
          <p className="text-center text-xs text-muted-foreground">
            A iniciar câmara…
          </p>
        )}
        {error && <p className="text-center text-xs text-destructive">{error}</p>}

        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          className="h-12 w-full"
        >
          Cancelar
        </Button>
      </DialogContent>
    </Dialog>
  );
}
