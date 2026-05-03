import type { Bill } from "@/types";
import { getCurrentUserId } from "@/lib/auth";

export type { Bill };

const BASE_KEY = "dental_bills";

function storageKey(): string {
  const uid = getCurrentUserId();
  return uid ? `${BASE_KEY}_${uid}` : BASE_KEY;
}

export function initBills(): Bill[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(storageKey());
  if (!stored) {
    localStorage.setItem(storageKey(), JSON.stringify([]));
    return [];
  }
  return JSON.parse(stored) as Bill[];
}

export function getBills(): Bill[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(storageKey());
  return stored ? (JSON.parse(stored) as Bill[]) : [];
}

export function saveBills(bills: Bill[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(), JSON.stringify(bills));
  window.dispatchEvent(new Event("billsUpdated"));
}

export function addBillForAppointment(
  appointmentId: string,
  serviceName: string,
  price: number
): Bill {
  const bills = getBills();
  const now = new Date().toISOString().split("T")[0];
  const num = String(1000 + bills.length + 1).padStart(4, "0");
  const newBill: Bill = {
    id: `bill-apt-${appointmentId}`,
    number: `№ ${new Date().getFullYear()}-${num}`,
    patientId: getCurrentUserId() ?? "guest",
    appointmentId,
    items: [
      {
        id: `item-apt-${appointmentId}`,
        service: serviceName,
        quantity: 1,
        unitPrice: price,
        total: price,
        date: now,
      },
    ],
    totalAmount: price,
    paidAmount: 0,
    status: "pending",
    issuedAt: now,
    canPayOnline: true,
  };
  saveBills([newBill, ...bills]);
  return newBill;
}

export function removeBillByAppointmentId(appointmentId: string): boolean {
  const bills = getBills();
  const filtered = bills.filter(
    (b) =>
      !(
        b.appointmentId === appointmentId &&
        (b.status === "pending" || b.status === "overdue")
      )
  );
  if (filtered.length < bills.length) {
    saveBills(filtered);
    return true;
  }
  return false;
}

export function payBillById(bills: Bill[], id: string): Bill[] {
  return bills.map((b) =>
    b.id === id
      ? {
          ...b,
          status: "paid" as const,
          paidAmount: b.totalAmount,
          paidAt: new Date().toISOString(),
          canPayOnline: false,
        }
      : b
  );
}

export function payAllPendingBills(bills: Bill[]): Bill[] {
  return bills.map((b) =>
    b.status === "pending" || b.status === "overdue"
      ? {
          ...b,
          status: "paid" as const,
          paidAmount: b.totalAmount,
          paidAt: new Date().toISOString(),
          canPayOnline: false,
        }
      : b
  );
}

export function getTotalPending(bills: Bill[]): number {
  return bills
    .filter((b) => b.status === "pending" || b.status === "overdue")
    .reduce((sum, b) => sum + (b.totalAmount - b.paidAmount), 0);
}

const MONTHS_RU = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

export function formatBillDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS_RU[d.getMonth()]} ${d.getFullYear()}`;
}
