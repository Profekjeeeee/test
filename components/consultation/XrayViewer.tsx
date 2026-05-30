"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { AnnotationStroke } from "@/lib/videoConsultation";

interface XrayViewerProps {
  imageUrl: string;
  strokes: AnnotationStroke[];
  readOnly?: boolean;
  onStrokesChange?: (strokes: AnnotationStroke[]) => void;
}

export default function XrayViewer({
  imageUrl,
  strokes,
  readOnly = false,
  onStrokesChange,
}: XrayViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [localStrokes, setLocalStrokes] = useState<AnnotationStroke[]>(strokes);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    setLocalStrokes(strokes);
  }, [strokes]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !img.complete) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";

    for (const s of localStrokes) {
      ctx.strokeStyle = s.color;
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
    }
  }, [localStrokes]);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      redraw();
    };
    img.src = imageUrl;
  }, [imageUrl, redraw]);

  useEffect(() => {
    redraw();
  }, [localStrokes, redraw]);

  const toCanvasCoords = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (readOnly) return;
    setDrawing(true);
    const p = toCanvasCoords(e.clientX, e.clientY);
    setStart(p);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (readOnly || !drawing || !start) return;
    const p = toCanvasCoords(e.clientX, e.clientY);
    const next: AnnotationStroke = {
      x1: start.x,
      y1: start.y,
      x2: p.x,
      y2: p.y,
      color: "#248bcf",
    };
    const updated = [...localStrokes, next];
    setLocalStrokes(updated);
    onStrokesChange?.(updated);
    setDrawing(false);
    setStart(null);
  };

  const handleClear = () => {
    setLocalStrokes([]);
    onStrokesChange?.([]);
  };

  return (
    <div ref={containerRef} className="flex flex-col gap-2">
      <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-black/5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="Снимок"
          className="w-full h-auto block opacity-0 absolute inset-0 pointer-events-none"
          onLoad={(e) => {
            imgRef.current = e.currentTarget;
            redraw();
          }}
        />
        <canvas
          ref={canvasRef}
          className="w-full h-auto touch-none"
          style={{
            backgroundImage: `url(${imageUrl})`,
            backgroundSize: "contain",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
          }}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => {
            setDrawing(false);
            setStart(null);
          }}
        />
      </div>
      {!readOnly && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleClear}
            className="flex-1 h-9 rounded-lg border border-slate-200 dark:border-slate-600 text-[12px] font-semibold text-secondary active:scale-95"
          >
            Очистить разметку
          </button>
        </div>
      )}
    </div>
  );
}
