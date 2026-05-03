import type { Bill } from "@/types";
export type { Bill };

const BILLS_KEY = "dental_bills";

const DEFAULT_BILLS: Bill[] = [
  {
    id: "bill-1",
    number: "№ 2023-8842",
    patientId: "p1",
    items: [
      {
        id: "item-1-1",
        service: "Профессиональная гигиена",
        quantity: 1,
        unitPrice: 4500,
        total: 4500,
        date: "2023-10-14",
      },
    ],
    totalAmount: 4500,
    paidAmount: 0,
    status: "pending",
    issuedAt: "2023-10-14",
    canPayOnline: true,
  },
  {
    id: "bill-2",
    number: "№ 2023-9104",
    patientId: "p1",
    items: [
      {
        id: "item-2-1",
        service: "Лечение кариеса (зуб 16)",
        quantity: 1,
        unitPrice: 7950,
        total: 7950,
        date: "2023-11-03",
      },
    ],
    totalAmount: 7950,
    paidAmount: 0,
    status: "pending",
    issuedAt: "2023-11-03",
    canPayOnline: true,
  },
  {
    id: "bill-3",
    number: "№ 2023-8715",
    patientId: "p1",
    items: [
      {
        id: "item-3-1",
        service: "Консультация стоматолога",
        quantity: 1,
        unitPrice: 1500,
        total: 1500,
        date: "2023-09-20",
      },
    ],
    totalAmount: 1500,
    paidAmount: 1500,
    status: "paid",
    issuedAt: "2023-09-20",
    paidAt: "2023-09-20",
    canPayOnline: false,
  },
  {
    id: "bill-4",
    number: "№ 2023-8634",
    patientId: "p1",
    items: [
      {
        id: "item-4-1",
        service: "Профессиональное отбеливание",
        quantity: 1,
        unitPrice: 12000,
        total: 12000,
        date: "2023-08-15",
      },
    ],
    totalAmount: 12000,
    paidAmount: 12000,
    status: "paid",
    issuedAt: "2023-08-15",
    paidAt: "2023-08-22",
    canPayOnline: false,
  },
];

export function initBills(): Bill[] {
  if (typeof window === "undefined") return DEFAULT_BILLS;
  const stored = localStorage.getItem(BILLS_KEY);
  if (!stored) {
    localStorage.setItem(BILLS_KEY, JSON.stringify(DEFAULT_BILLS));
    return DEFAULT_BILLS;
  }
  return JSON.parse(stored) as Bill[];
}

export function getBills(): Bill[] {
  if (typeof window === "undefined") return DEFAULT_BILLS;
  const stored = localStorage.getItem(BILLS_KEY);
  return stored ? (JSON.parse(stored) as Bill[]) : DEFAULT_BILLS;
}

export function saveBills(bills: Bill[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(BILLS_KEY, JSON.stringify(bills));
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
    patientId: "p1",
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
