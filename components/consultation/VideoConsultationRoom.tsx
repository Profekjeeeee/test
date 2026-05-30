"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react";

import ConsultationFilePanel from "@/components/consultation/ConsultationFilePanel";
import XrayViewer from "@/components/consultation/XrayViewer";
import Header from "@/components/layout/Header";
import { getDentalSession } from "@/lib/auth";
import type { PatientFile } from "@/lib/patientFiles";
import { ConsultationPeer } from "@/lib/webrtc/consultationPeer";
import {
  fetchXrayAnnotations,
  joinConsultation,
  resolveSignalingRole,
  saveXrayAnnotations,
  updateConsultationStatus,
  type AnnotationStroke,
  type VideoConsultation,
} from "@/lib/videoConsultation";

interface VideoConsultationRoomProps {
  appointmentId: string;
  patientId: string;
  doctorName: string;
  serviceTitle: string;
}

type PanelTab = "video" | "xray" | "files";

export default function VideoConsultationRoom({
  appointmentId,
  patientId,
  doctorName,
  serviceTitle,
}: VideoConsultationRoomProps) {
  const router = useRouter();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<ConsultationPeer | null>(null);

  const [consultation, setConsultation] = useState<VideoConsultation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<string>("new");
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [tab, setTab] = useState<PanelTab>("video");
  const [selectedFile, setSelectedFile] = useState<PatientFile | null>(null);
  const [strokes, setStrokes] = useState<AnnotationStroke[]>([]);
  const [savingAnnotation, setSavingAnnotation] = useState(false);

  const role = resolveSignalingRole();
  const isStaff = role === "doctor";
  const session = getDentalSession();

  const init = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const c = await joinConsultation(appointmentId);
      setConsultation(c);
      if (c.status === "waiting") {
        await updateConsultationStatus(c.id, "active");
      }

      const peer = new ConsultationPeer({
        consultationId: c.id,
        role,
        onRemoteStream: (stream) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = stream;
          }
        },
        onConnectionState: setConnectionState,
        onError: (msg) => setError(msg),
      });
      peerRef.current = peer;

      const local = await peer.start();
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = local;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось начать консультацию");
    } finally {
      setLoading(false);
    }
  }, [appointmentId, role]);

  useEffect(() => {
    void init();
    return () => {
      peerRef.current?.dispose();
    };
  }, [init]);

  const handleEnd = async () => {
    if (consultation) {
      await updateConsultationStatus(consultation.id, "ended");
    }
    await peerRef.current?.hangup();
    router.back();
  };

  const handleSelectFile = async (file: PatientFile) => {
    setSelectedFile(file);
    setTab("xray");
    if (consultation) {
      const rows = await fetchXrayAnnotations(consultation.id);
      const found = rows.find((r) => r.file_id === file.id);
      setStrokes(found?.strokes ?? []);
      if (isStaff) {
        await updateConsultationStatus(consultation.id, "active", file.id);
      }
    }
  };

  const handleStrokesChange = async (next: AnnotationStroke[]) => {
    setStrokes(next);
    if (!consultation || !selectedFile || !isStaff) return;
    setSavingAnnotation(true);
    try {
      await saveXrayAnnotations(consultation.id, selectedFile.id, next);
    } finally {
      setSavingAnnotation(false);
    }
  };

  const connectionLabel =
    connectionState === "connected"
      ? "Соединено"
      : connectionState === "connecting"
        ? "Подключение…"
        : connectionState === "failed"
          ? "Ошибка связи"
          : "Ожидание собеседника";

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-app-canvas flex flex-col pb-safe">
      <Header title="Видеоконсультация" showBack />

      <main className="flex-1 flex flex-col px-4 py-3 gap-3 max-w-lg mx-auto w-full">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3">
          <p className="text-[15px] font-semibold text-[#0F172A] dark:text-white">{serviceTitle}</p>
          <p className="text-[13px] text-secondary mt-0.5">{doctorName}</p>
          <p className="text-[11px] font-medium text-primary mt-1">{connectionLabel}</p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-1.5">
          {(["video", "xray", "files"] as PanelTab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 h-9 rounded-lg text-[12px] font-semibold active:scale-95 ${
                tab === t
                  ? "bg-primary text-white"
                  : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-secondary"
              }`}
            >
              {t === "video" ? "Видео" : t === "xray" ? "Снимок" : "Файлы"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-secondary text-[14px]">
            Подключение камеры…
          </div>
        ) : tab === "video" ? (
          <div className="flex flex-col gap-2 flex-1">
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-slate-900">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="absolute bottom-3 right-3 w-24 h-32 rounded-xl object-cover border-2 border-white/80 shadow-lg"
              />
            </div>
          </div>
        ) : tab === "xray" ? (
          <div className="flex-1">
            {selectedFile?.signedUrl && selectedFile.mimeType.startsWith("image/") ? (
              <>
                <XrayViewer
                  imageUrl={selectedFile.signedUrl}
                  strokes={strokes}
                  readOnly={!isStaff}
                  onStrokesChange={handleStrokesChange}
                />
                {savingAnnotation && (
                  <p className="text-[11px] text-secondary text-center mt-1">Сохранение разметки…</p>
                )}
              </>
            ) : (
              <p className="text-[13px] text-secondary text-center py-8">
                Выберите снимок во вкладке «Файлы»
              </p>
            )}
          </div>
        ) : (
          <ConsultationFilePanel
            patientId={patientId}
            appointmentId={appointmentId}
            consultationId={consultation?.id ?? ""}
            selectedFileId={selectedFile?.id ?? null}
            onSelectFile={handleSelectFile}
            allowUpload
          />
        )}

        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => {
              const next = !audioEnabled;
              setAudioEnabled(next);
              peerRef.current?.toggleAudio(next);
            }}
            className="w-12 h-12 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 flex items-center justify-center active:scale-95"
            aria-label={audioEnabled ? "Выключить микрофон" : "Включить микрофон"}
          >
            {audioEnabled ? (
              <Mic className="w-5 h-5 text-primary" />
            ) : (
              <MicOff className="w-5 h-5 text-red-500" />
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              const next = !videoEnabled;
              setVideoEnabled(next);
              peerRef.current?.toggleVideo(next);
            }}
            className="w-12 h-12 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 flex items-center justify-center active:scale-95"
            aria-label={videoEnabled ? "Выключить камеру" : "Включить камеру"}
          >
            {videoEnabled ? (
              <Video className="w-5 h-5 text-primary" />
            ) : (
              <VideoOff className="w-5 h-5 text-red-500" />
            )}
          </button>
          <button
            type="button"
            onClick={() => void handleEnd()}
            className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center active:scale-95 shadow-[0_4px_14px_rgba(239,68,68,0.4)]"
            aria-label="Завершить консультацию"
          >
            <PhoneOff className="w-6 h-6 text-white" />
          </button>
        </div>

        {session?.role === "client" && (
          <p className="text-[11px] text-secondary text-center pb-2">
            Врач может размечать снимки — вы видите разметку в реальном времени после сохранения
          </p>
        )}
      </main>
    </div>
  );
}
