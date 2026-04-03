import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { useServicesStore } from "../../stores/services";
import styles from "./AtomicCanvas.module.css";
import { GalaxyEngine } from "./engine";

export interface AtomicCanvasHandle {
  startDemo: () => void;
  stopDemo: () => void;
  isDemoActive: () => boolean;
  isCameraSettled: () => boolean;
  getFocusedScreenPos: () => { x: number; y: number } | null;
  updateServiceStatus: (id: string, status: "online" | "degraded" | "offline" | "error") => void;
}

export const AtomicCanvas = forwardRef<AtomicCanvasHandle>((_, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GalaxyEngine | null>(null);

  const setTooltip = useServicesStore((s) => s.setTooltip);
  const setSelected = useServicesStore((s) => s.setSelected);

  useImperativeHandle(ref, () => ({
    startDemo: () => engineRef.current?.startDemo(),
    stopDemo: () => engineRef.current?.stopDemo(),
    isDemoActive: () => engineRef.current?.isDemoActive ?? false,
    isCameraSettled: () => engineRef.current?.isCameraSettled ?? false,
    getFocusedScreenPos: () => engineRef.current?.getFocusedScreenPos() ?? null,
    updateServiceStatus: (id, status) => engineRef.current?.updateServiceStatus(id, status),
  }));

  useEffect(() => {
    if (!canvasRef.current) return;

    engineRef.current = new GalaxyEngine(
      canvasRef.current,
      (_id) => {
        // hover callback — tooltip is handled via labels
      },
      (id) => {
        setSelected(id || null);
      }
    );

    return () => {
      engineRef.current?.dispose();
    };
  }, [setSelected]);

  return <canvas ref={canvasRef} className={styles.canvas} onMouseLeave={() => setTooltip(null)} />;
});

AtomicCanvas.displayName = "AtomicCanvas";
