"use client";

import { useState, useEffect } from "react";
import Header from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import BottomBar from "@/components/layout/BottomBar";
import {
  initPatientFilesForViewer,
  getPatientFiles,
  formatFileDate,
  formatFileSize,
  FILE_CATEGORY_LABELS,
  type PatientFile,
} from "@/lib/patientFiles";

function FileIcon({ mime }: { mime: string }) {
  if (mime === "application/pdf") {
    return (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" className="text-primary shrink-0">
        <rect x="4" y="2" width="14" height="18" rx="2" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8 7H14M8 10H12M8 13H10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" className="text-primary shrink-0">
      <rect x="3" y="4" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="8" cy="9" r="1.2" fill="currentColor" />
      <path d="M3 15L8 10L12 14L19 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FileCard({ file }: { file: PatientFile }) {
  const isImage = file.mimeType.startsWith("image/");

  return (
    <Card padding="sm" className="border border-slate-200/80 dark:border-slate-800">
      <div className="flex gap-3">
        {isImage && file.signedUrl ? (
          <a
            href={file.signedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="interactive-press-sm shrink-0 w-16 h-16 rounded-xl overflow-hidden border border-primary/20 bg-slate-100 dark:bg-slate-800"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={file.signedUrl}
              alt={file.fileName}
              className="w-full h-full object-cover"
            />
          </a>
        ) : (
          <div className="w-16 h-16 rounded-xl bg-primary-light/60 dark:bg-primary/10 flex items-center justify-center shrink-0">
            <FileIcon mime={file.mimeType} />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
            {FILE_CATEGORY_LABELS[file.fileCategory]}
          </p>
          <p className="text-[15px] font-semibold text-[#0F172A] dark:text-white mt-0.5 leading-snug truncate">
            {file.fileName}
          </p>
          <p className="text-[12px] text-secondary mt-1">
            {formatFileDate(file.createdAt)} · {formatFileSize(file.fileSize)}
          </p>
          {file.description && (
            <p className="text-[12px] text-secondary mt-1 leading-snug">{file.description}</p>
          )}
          {file.signedUrl && (
            <a
              href={file.signedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="interactive-press-sm inline-flex mt-2 text-[12px] font-semibold text-primary"
            >
              {file.mimeType === "application/pdf" ? "Открыть PDF" : "Открыть файл"} →
            </a>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function PatientDocumentsPage() {
  const [files, setFiles] = useState<PatientFile[]>([]);
  const [loading, setLoading] = useState(true);

  const sync = () => setFiles(getPatientFiles());

  useEffect(() => {
    void initPatientFilesForViewer().then(() => {
      sync();
      setLoading(false);
    });

    const onUpdate = () => sync();
    window.addEventListener("patientFilesUpdated", onUpdate);
    return () => window.removeEventListener("patientFilesUpdated", onUpdate);
  }, []);

  const xrays = files.filter((f) => f.fileCategory === "xray" || f.fileCategory === "photo");
  const docs = files.filter((f) => f.fileCategory !== "xray" && f.fileCategory !== "photo");

  return (
    <div className="min-h-dvh bg-surface dark:bg-app-canvas pb-safe">
      <Header title="Мои документы" showBack />

      <main className="px-5 pt-2 pb-28 flex flex-col gap-5 max-w-[480px] mx-auto">
        <p className="text-[13px] text-secondary leading-snug -mt-1">
          Снимки, заключения и документы из клиники. Форматы: JPG, PNG, PDF.
        </p>

        {loading ? (
          <p className="text-[13px] text-secondary text-center py-10">Загрузка…</p>
        ) : files.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#E2E8F0] dark:border-slate-700 px-4 py-10 text-center">
            <p className="text-[14px] font-medium text-[#0F172A] dark:text-white">
              Документов пока нет
            </p>
            <p className="text-[13px] text-secondary mt-2 leading-snug">
              После приёма врач может прикрепить рентген, снимки или PDF — они появятся здесь.
            </p>
          </div>
        ) : (
          <>
            {xrays.length > 0 && (
              <section>
                <h2 className="text-[12px] font-bold uppercase tracking-widest text-secondary mb-3">
                  Снимки и фото
                </h2>
                <div className="flex flex-col gap-3">
                  {xrays.map((f) => (
                    <FileCard key={f.id} file={f} />
                  ))}
                </div>
              </section>
            )}

            {docs.length > 0 && (
              <section>
                <h2 className="text-[12px] font-bold uppercase tracking-widest text-secondary mb-3">
                  Документы
                </h2>
                <div className="flex flex-col gap-3">
                  {docs.map((f) => (
                    <FileCard key={f.id} file={f} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <BottomBar />
    </div>
  );
}
