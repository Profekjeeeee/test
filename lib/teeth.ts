import type { ToothStatus } from "@/types";

const STORAGE_KEY = "dental_formula";

// FDI two-digit notation, left-to-right display order
export const UPPER_ROW = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
export const LOWER_ROW = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

const DEFAULT_TEETH: ToothStatus[] = [
  // Upper right (18→11)
  { number: 18, condition: "healthy",  jaw: "upper", side: "right", hasNote: false },
  { number: 17, condition: "treated",  jaw: "upper", side: "right", hasNote: false, lastTreatmentDate: "2024-03-15", materials: ["Composite A2"] },
  { number: 16, condition: "treated",  jaw: "upper", side: "right", hasNote: false, lastTreatmentDate: "2023-11-20", materials: ["Amalgam"] },
  { number: 15, condition: "caries",   jaw: "upper", side: "right", hasNote: true,  notes: "Требует срочного лечения" },
  { number: 14, condition: "healthy",  jaw: "upper", side: "right", hasNote: false },
  { number: 13, condition: "healthy",  jaw: "upper", side: "right", hasNote: false },
  { number: 12, condition: "healthy",  jaw: "upper", side: "right", hasNote: false },
  { number: 11, condition: "healthy",  jaw: "upper", side: "right", hasNote: false },
  // Upper left (21→28)
  { number: 21, condition: "healthy",  jaw: "upper", side: "left",  hasNote: false },
  { number: 22, condition: "healthy",  jaw: "upper", side: "left",  hasNote: false },
  { number: 23, condition: "crown",    jaw: "upper", side: "left",  hasNote: false, lastTreatmentDate: "2022-06-10" },
  { number: 24, condition: "healthy",  jaw: "upper", side: "left",  hasNote: false },
  { number: 25, condition: "healthy",  jaw: "upper", side: "left",  hasNote: false },
  { number: 26, condition: "treated",  jaw: "upper", side: "left",  hasNote: false, lastTreatmentDate: "2024-01-08", materials: ["Composite B1"] },
  { number: 27, condition: "healthy",  jaw: "upper", side: "left",  hasNote: false },
  { number: 28, condition: "removed",  jaw: "upper", side: "left",  hasNote: false },
  // Lower right (48→41)
  { number: 48, condition: "removed",  jaw: "lower", side: "right", hasNote: false },
  { number: 47, condition: "treated",  jaw: "lower", side: "right", hasNote: false, lastTreatmentDate: "2023-09-14", materials: ["Amalgam"] },
  { number: 46, condition: "caries",   jaw: "lower", side: "right", hasNote: true,  notes: "Кариес средний, K02.1" },
  { number: 45, condition: "healthy",  jaw: "lower", side: "right", hasNote: false },
  { number: 44, condition: "healthy",  jaw: "lower", side: "right", hasNote: false },
  { number: 43, condition: "healthy",  jaw: "lower", side: "right", hasNote: false },
  { number: 42, condition: "healthy",  jaw: "lower", side: "right", hasNote: false },
  { number: 41, condition: "healthy",  jaw: "lower", side: "right", hasNote: false },
  // Lower left (31→38)
  { number: 31, condition: "healthy",  jaw: "lower", side: "left",  hasNote: false },
  { number: 32, condition: "healthy",  jaw: "lower", side: "left",  hasNote: false },
  { number: 33, condition: "healthy",  jaw: "lower", side: "left",  hasNote: false },
  { number: 34, condition: "healthy",  jaw: "lower", side: "left",  hasNote: false },
  { number: 35, condition: "treated",  jaw: "lower", side: "left",  hasNote: false, lastTreatmentDate: "2024-04-22", materials: ["Composite A3"] },
  { number: 36, condition: "treated",  jaw: "lower", side: "left",  hasNote: false, lastTreatmentDate: "2024-04-22" },
  { number: 37, condition: "healthy",  jaw: "lower", side: "left",  hasNote: false },
  { number: 38, condition: "healthy",  jaw: "lower", side: "left",  hasNote: false },
];

export function initTeeth(): void {
  if (typeof window === "undefined") return;
  if (!localStorage.getItem(STORAGE_KEY)) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_TEETH));
  }
}

export function getTeeth(): ToothStatus[] {
  if (typeof window === "undefined") return DEFAULT_TEETH;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as ToothStatus[]) : DEFAULT_TEETH;
  } catch {
    return DEFAULT_TEETH;
  }
}

export function getTooth(number: number): ToothStatus | undefined {
  return getTeeth().find((t) => t.number === number);
}

export function saveTeeth(teeth: ToothStatus[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(teeth));
  window.dispatchEvent(new CustomEvent("teethUpdated"));
}
