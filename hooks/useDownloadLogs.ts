"use client";

import { useCallback } from "react";
import type { DentalLog } from "@/lib/logger";

export type LogsDownloadFormat = "json" | "txt";

function logsToTxt(logs: DentalLog[]): string {
  return logs
    .map((row) => {
      const time = new Date(row.timestamp).toISOString();
      const details = row.details ? ` | ${row.details}` : "";
      return `[${time}] [${row.level}] [${row.role}] ${row.action}${details}`;
    })
    .join("\n");
}

function triggerFileDownload(content: string, mime: string, filename: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function useDownloadLogs(logs: DentalLog[], format: LogsDownloadFormat = "json") {
  const download = useCallback(() => {
    if (logs.length === 0) return;

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    if (format === "json") {
      triggerFileDownload(
        JSON.stringify(logs, null, 2),
        "application/json;charset=utf-8",
        `dental-logs-${stamp}.json`
      );
      return;
    }

    triggerFileDownload(
      logsToTxt(logs),
      "text/plain;charset=utf-8",
      `dental-logs-${stamp}.txt`
    );
  }, [logs, format]);

  return { download, canDownload: logs.length > 0 };
}
