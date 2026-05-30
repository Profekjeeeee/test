"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import VideoConsultationRoom from "@/components/consultation/VideoConsultationRoom";
import Header from "@/components/layout/Header";
import {
  getAllClinicAppointments,
  getAppointments,
  initAppointments,
  type Appointment,
} from "@/lib/appointments";
import { getDentalSession } from "@/lib/auth";
import { canJoinVideoWindow } from "@/lib/videoConsultation";

function findAppointment(id: string): Appointment | undefined {
  const session = getDentalSession();
  const list =
    session?.role === "doctor" || session?.role === "admin"
      ? getAllClinicAppointments()
      : getAppointments();
  return list.find((a) => a.id === id);
}

export default function VideoConsultationPage() {
  const params = useParams();
  const router = useRouter();
  const appointmentId = typeof params.appointmentId === "string" ? params.appointmentId : "";
  const [ready, setReady] = useState(false);
  const [apt, setApt] = useState<Appointment | null>(null);

  useEffect(() => {
    void initAppointments().then(() => {
      const found = findAppointment(appointmentId);
      setApt(found ?? null);
      setReady(true);
    });
  }, [appointmentId]);

  if (!ready) {
    return (
      <div className="min-h-dvh bg-slate-50 flex items-center justify-center text-secondary">
        Загрузка…
      </div>
    );
  }

  if (!apt) {
    return (
      <div className="min-h-dvh bg-slate-50">
        <Header title="Консультация" showBack />
        <p className="text-center text-secondary py-16 text-[14px]">Запись не найдена</p>
      </div>
    );
  }

  if (apt.visitMode !== "video") {
    return (
      <div className="min-h-dvh bg-slate-50">
        <Header title="Консультация" showBack />
        <p className="text-center text-secondary py-16 px-6 text-[14px]">
          Эта запись не является онлайн-консультацией
        </p>
      </div>
    );
  }

  if (!canJoinVideoWindow(apt)) {
    return (
      <div className="min-h-dvh bg-slate-50">
        <Header title="Консультация" showBack />
        <p className="text-center text-secondary py-16 px-6 text-[14px]">
          Вход доступен за 15 минут до начала и в течение 2 часов после
        </p>
        <button
          type="button"
          onClick={() => router.back()}
          className="mx-auto block px-6 h-11 rounded-xl bg-primary text-white font-semibold text-[14px] active:scale-95"
        >
          Назад
        </button>
      </div>
    );
  }

  if (!apt.patientId) {
    return (
      <div className="min-h-dvh bg-slate-50">
        <Header title="Консультация" showBack />
        <p className="text-center text-secondary py-16 px-6 text-[14px]">
          Нет данных пациента для этой записи
        </p>
      </div>
    );
  }

  return (
    <VideoConsultationRoom
      appointmentId={apt.id}
      patientId={apt.patientId}
      doctorName={apt.doctor}
      serviceTitle={apt.service}
    />
  );
}
