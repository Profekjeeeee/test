import type { ToothStatus } from "@/types";
import { getCurrentUserId } from "@/lib/auth";

const BASE_KEY = "dental_formula";

// FDI two-digit notation, left-to-right display order
export const UPPER_ROW = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
export const LOWER_ROW = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

type ToothMeta = { jaw: ToothStatus["jaw"]; side: ToothStatus["side"] };

const TOOTH_META: Record<number, ToothMeta> = {
  18: { jaw: "upper", side: "right" }, 17: { jaw: "upper", side: "right" },
  16: { jaw: "upper", side: "right" }, 15: { jaw: "upper", side: "right" },
  14: { jaw: "upper", side: "right" }, 13: { jaw: "upper", side: "right" },
  12: { jaw: "upper", side: "right" }, 11: { jaw: "upper", side: "right" },
  21: { jaw: "upper", side: "left"  }, 22: { jaw: "upper", side: "left"  },
  23: { jaw: "upper", side: "left"  }, 24: { jaw: "upper", side: "left"  },
  25: { jaw: "upper", side: "left"  }, 26: { jaw: "upper", side: "left"  },
  27: { jaw: "upper", side: "left"  }, 28: { jaw: "upper", side: "left"  },
  48: { jaw: "lower", side: "right" }, 47: { jaw: "lower", side: "right" },
  46: { jaw: "lower", side: "right" }, 45: { jaw: "lower", side: "right" },
  44: { jaw: "lower", side: "right" }, 43: { jaw: "lower", side: "right" },
  42: { jaw: "lower", side: "right" }, 41: { jaw: "lower", side: "right" },
  31: { jaw: "lower", side: "left"  }, 32: { jaw: "lower", side: "left"  },
  33: { jaw: "lower", side: "left"  }, 34: { jaw: "lower", side: "left"  },
  35: { jaw: "lower", side: "left"  }, 36: { jaw: "lower", side: "left"  },
  37: { jaw: "lower", side: "left"  }, 38: { jaw: "lower", side: "left"  },
};

function buildHealthyTeeth(): ToothStatus[] {
  return [...UPPER_ROW, ...LOWER_ROW].map((num) => ({
    number: num,
    condition: "healthy" as const,
    jaw: TOOTH_META[num].jaw,
    side: TOOTH_META[num].side,
    hasNote: false,
  }));
}

/** Полный набор здоровых зубов по умолчанию (FDI). */
export function buildDefaultTeeth(): ToothStatus[] {
  return buildHealthyTeeth();
}

function formulaStorageKeyForUser(userId: string): string {
  return `${BASE_KEY}_${userId}`;
}

function storageKey(): string {
  const uid = getCurrentUserId();
  return uid ? `${BASE_KEY}_${uid}` : BASE_KEY;
}

export function initTeeth(): void {
  if (typeof window === "undefined") return;
  if (!localStorage.getItem(storageKey())) {
    localStorage.setItem(storageKey(), JSON.stringify(buildHealthyTeeth()));
  }
}

export function getTeeth(): ToothStatus[] {
  if (typeof window === "undefined") return buildHealthyTeeth();
  try {
    const stored = localStorage.getItem(storageKey());
    return stored ? (JSON.parse(stored) as ToothStatus[]) : buildHealthyTeeth();
  } catch {
    return buildHealthyTeeth();
  }
}

export function getTooth(number: number): ToothStatus | undefined {
  return getTeeth().find((t) => t.number === number);
}

export function saveTeeth(teeth: ToothStatus[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(), JSON.stringify(teeth));
  window.dispatchEvent(new CustomEvent("teethUpdated"));
}

export function getTeethSnapshotForUser(userId: string): ToothStatus[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(formulaStorageKeyForUser(userId));
    return raw ? (JSON.parse(raw) as ToothStatus[]) : [];
  } catch {
    return [];
  }
}

export function saveTeethSnapshotForUser(userId: string, teeth: ToothStatus[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(formulaStorageKeyForUser(userId), JSON.stringify(teeth));
  window.dispatchEvent(new CustomEvent("teethUpdated"));
}
