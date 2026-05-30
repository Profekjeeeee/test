"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchPatientFilesForPatient,
  uploadPatientFile,
  type PatientFile,
} from "@/lib/patientFiles";
import { supabase } from "@/lib/supabaseClient";
import { removeSupabaseChannel, uniqueRealtimeChannelName } from "@/lib/supabaseRealtime";

interface ConsultationFilePanelProps {
  patientId: string;
  appointmentId: string;
  consultationId: string;
  selectedFileId: string | null;
  onSelectFile: (file: PatientFile) => void;
  allowUpload?: boolean;
}

export default function ConsultationFilePanel({
  patientId,
  appointmentId,
  consultationId,
  selectedFileId,
  onSelectFile,
  allowUpload = true,
}: ConsultationFilePanelProps) {
  const [files, setFiles] = useState<PatientFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    const list = await fetchPatientFilesForPatient(patientId, true);
    const forAppt = list.filter(
      (f) => f.appointmentId === appointmentId || f.fileCategory === "xray" || f.fileCategory === "photo",
    );
    setFiles(forAppt);
  }, [patientId, appointmentId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const ch = supabase
      .channel(uniqueRealtimeChannelName(`consultation-files:${consultationId}`))
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "patient_files" },
        () => {
          void reload();
        },
      )
      .subscribe();

    return () => {
      removeSupabaseChannel(ch);
    };
  }, [consultationId, reload]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const created = await uploadPatientFile({
        patientId,
        file,
        appointmentId,
        fileCategory: file.type.startsWith("image/") ? "xray" : "document",
        visibleToPatient: true,
      });
      if (created) {
        await reload();
        onSelectFile(created);
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {allowUpload && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleUpload(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="h-10 rounded-xl bg-primary text-white text-[13px] font-semibold active:scale-95 disabled:opacity-60"
          >
            {uploading ? "Загрузка…" : "+ Отправить файл"}
          </button>
        </>
      )}

      <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
        {files.length === 0 ? (
          <p className="text-[12px] text-secondary text-center py-3">Нет файлов для разбора</p>
        ) : (
          files.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => onSelectFile(f)}
              className={`text-left px-3 py-2 rounded-lg border text-[12px] font-medium transition-all active:scale-[0.98] ${
                selectedFileId === f.id
                  ? "border-primary bg-primary-light text-primary"
                  : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
              }`}
            >
              {f.fileName}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
