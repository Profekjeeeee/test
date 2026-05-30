"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ThemeToggleButton from "@/components/ui/ThemeToggleButton";
import {
  createMarketingCampaign,
  fetchCampaignDeliveries,
  fetchCrmPatients,
  fetchCrmSegmentStats,
  fetchMarketingCampaigns,
  refreshCrmMetrics,
  runCampaignFromAdmin,
  SEGMENT_LABELS,
  updateCampaignStatus,
} from "@/lib/admin/crm";
import type {
  CampaignDeliveryRow,
  CrmPatientRow,
  CrmSegmentStat,
  MarketingCampaignRow,
  PatientSegmentKey,
} from "@/lib/admin/types";
import { tgHapticSuccess } from "@/lib/telegramHaptic";

type Tab = "segments" | "patients" | "campaigns";

const SEGMENT_CLS: Record<PatientSegmentKey, string> = {
  new: "bg-slate-100 dark:bg-slate-800 text-[#0F172A] dark:text-white",
  active: "bg-primary-light text-primary",
  at_risk: "bg-primary/10 text-primary",
  dormant: "bg-slate-200 dark:bg-slate-700 text-[#0F172A] dark:text-white",
  high_value: "bg-sky-100 dark:bg-primary/15 text-primary",
  debtor: "bg-primary/15 text-primary",
};

const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  draft: "Черновик",
  active: "Активна",
  paused: "Пауза",
  completed: "Завершена",
};

function formatRub(n: number): string {
  return n.toLocaleString("ru-RU");
}

export default function AdminCrmPage() {
  const [tab, setTab] = useState<Tab>("segments");
  const [segments, setSegments] = useState<CrmSegmentStat[]>([]);
  const [totalPatients, setTotalPatients] = useState(0);
  const [withTelegram, setWithTelegram] = useState(0);
  const [patients, setPatients] = useState<CrmPatientRow[]>([]);
  const [campaigns, setCampaigns] = useState<MarketingCampaignRow[]>([]);
  const [deliveries, setDeliveries] = useState<CampaignDeliveryRow[]>([]);
  const [segmentFilter, setSegmentFilter] = useState<PatientSegmentKey | undefined>();
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [runningId, setRunningId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSegment, setNewSegment] = useState<PatientSegmentKey>("at_risk");
  const [newMessage, setNewMessage] = useState(
    "Здравствуйте, <b>{{name}}</b>!\n\nДавно не были у нас ({{days}} дн.). Запишитесь на приём — кнопка ниже.",
  );

  const load = useCallback(async () => {
    setLoading(true);
    const [segRes, patRes, campRes] = await Promise.all([
      fetchCrmSegmentStats(),
      fetchCrmPatients(segmentFilter),
      fetchMarketingCampaigns(),
    ]);
    setSegments(segRes.segments);
    setTotalPatients(segRes.totalPatients);
    setWithTelegram(segRes.withTelegram);
    setPatients(patRes.data);
    setCampaigns(campRes.data);
    setError(segRes.error ?? patRes.error ?? campRes.error ?? "");
    setLoading(false);
  }, [segmentFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedCampaignId) {
      setDeliveries([]);
      return;
    }
    void fetchCampaignDeliveries(selectedCampaignId).then((r) => setDeliveries(r.data));
  }, [selectedCampaignId, campaigns]);

  const dormantCount = useMemo(
    () => segments.find((s) => s.segment === "dormant")?.count ?? 0,
    [segments],
  );

  const handleRefreshMetrics = async () => {
    const res = await refreshCrmMetrics();
    if (res.error) {
      setError(res.error);
      return;
    }
    tgHapticSuccess();
    await load();
  };

  const handleRunCampaign = async (id: string) => {
    setRunningId(id);
    const res = await runCampaignFromAdmin(id);
    setRunningId(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    tgHapticSuccess();
    setError("");
    await load();
    setSelectedCampaignId(id);
  };

  const handleCreateCampaign = async () => {
    if (!newName.trim() || !newMessage.trim()) return;
    const res = await createMarketingCampaign({
      name: newName,
      segmentKey: newSegment,
      messageTemplate: newMessage,
      triggerType: "manual",
      minDaysSinceVisit: newSegment === "at_risk" ? 90 : newSegment === "dormant" ? 180 : undefined,
    });
    if (res.error) {
      setError(res.error);
      return;
    }
    setShowCreate(false);
    setNewName("");
    tgHapticSuccess();
    await load();
  };

  return (
    <main className="min-h-dvh bg-surface dark:bg-app-canvas pb-safe">
      <div className="px-5 pt-[calc(env(safe-area-inset-top,0px)+3rem)] pb-28">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <p className="text-[12px] font-medium text-secondary uppercase tracking-widest mb-1">CRM</p>
            <h1 className="text-[24px] font-bold text-[#0F172A] dark:text-white">Маркетинг</h1>
          </div>
          <ThemeToggleButton sizeClass="w-9 h-9" />
        </div>

        {error ? (
          <p className="mb-3 text-[13px] text-red-600 dark:text-red-400">{error}</p>
        ) : null}

        <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
          {(
            [
              ["segments", "Сегменты"],
              ["patients", "Пациенты"],
              ["campaigns", "Кампании"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[13px] font-medium ${
                tab === id
                  ? "bg-primary text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-secondary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => void handleRefreshMetrics()}
          disabled={loading}
          className="interactive-press w-full mb-4 py-2.5 rounded-xl bg-primary text-white text-[14px] font-semibold disabled:opacity-50"
        >
          Обновить метрики
        </button>

        {tab === "segments" && (
          <section className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900">
                <p className="text-[12px] text-secondary">Всего в CRM</p>
                <p className="text-[22px] font-bold text-[#0F172A] dark:text-white">{totalPatients}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900">
                <p className="text-[12px] text-secondary">С Telegram</p>
                <p className="text-[22px] font-bold text-primary">{withTelegram}</p>
              </div>
            </div>
            <p className="text-[13px] text-secondary">
              Спящих пациентов: <span className="font-semibold text-[#0F172A] dark:text-white">{dormantCount}</span>
              — цель авто-кампаний возврата
            </p>
            {loading ? (
              <div className="h-32 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
            ) : (
              segments.map((s) => (
                <button
                  key={s.segment}
                  type="button"
                  onClick={() => {
                    setSegmentFilter(s.segment);
                    setTab("patients");
                  }}
                  className="interactive-press w-full flex items-center justify-between rounded-2xl border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900 text-left"
                >
                  <span className={`text-[12px] font-medium px-2 py-0.5 rounded-full ${SEGMENT_CLS[s.segment]}`}>
                    {s.label}
                  </span>
                  <span className="text-[20px] font-bold text-[#0F172A] dark:text-white">{s.count}</span>
                </button>
              ))
            )}
          </section>
        )}

        {tab === "patients" && (
          <section className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setSegmentFilter(undefined)}
                className={`px-3 py-1 rounded-full text-[12px] ${!segmentFilter ? "bg-primary text-white" : "bg-slate-100 dark:bg-slate-800 text-secondary"}`}
              >
                Все
              </button>
              {(Object.keys(SEGMENT_LABELS) as PatientSegmentKey[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setSegmentFilter(k)}
                  className={`px-3 py-1 rounded-full text-[12px] ${segmentFilter === k ? "bg-primary text-white" : "bg-slate-100 dark:bg-slate-800 text-secondary"}`}
                >
                  {SEGMENT_LABELS[k]}
                </button>
              ))}
            </div>
            {patients.map((p) => (
              <div
                key={p.patientId}
                className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900"
              >
                <div className="flex justify-between gap-2 mb-1">
                  <p className="font-semibold text-[#0F172A] dark:text-white">{p.name}</p>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 ${SEGMENT_CLS[p.segment]}`}>
                    {SEGMENT_LABELS[p.segment]}
                  </span>
                </div>
                <p className="text-[12px] text-secondary mb-2">{p.phone}</p>
                <div className="grid grid-cols-2 gap-2 text-[12px]">
                  <span className="text-secondary">
                    Визитов: <b className="text-[#0F172A] dark:text-white">{p.totalVisits}</b>
                  </span>
                  <span className="text-secondary">
                    Без визита:{" "}
                    <b className="text-[#0F172A] dark:text-white">
                      {p.daysSinceVisit != null ? `${p.daysSinceVisit} дн.` : "—"}
                    </b>
                  </span>
                  <span className="text-secondary">
                    Оплачено: <b className="text-primary">{formatRub(p.totalPaid)} ₽</b>
                  </span>
                  <span className="text-secondary">
                    TG: <b>{p.hasTelegram ? "да" : "нет"}</b>
                  </span>
                </div>
              </div>
            ))}
            {!loading && patients.length === 0 ? (
              <p className="text-center text-secondary text-[14px] py-8">
                Нет данных. Нажмите «Обновить метрики».
              </p>
            ) : null}
          </section>
        )}

        {tab === "campaigns" && (
          <section className="space-y-3">
            <button
              type="button"
              onClick={() => setShowCreate((v) => !v)}
              className="interactive-press w-full py-2 rounded-xl border border-primary text-primary text-[14px] font-medium"
            >
              {showCreate ? "Скрыть форму" : "+ Новая кампания"}
            </button>

            {showCreate ? (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900 space-y-3">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Название кампании"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-600 px-3 py-2 text-[14px] bg-transparent"
                />
                <select
                  value={newSegment}
                  onChange={(e) => setNewSegment(e.target.value as PatientSegmentKey)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-600 px-3 py-2 text-[14px] bg-transparent"
                >
                  {(Object.keys(SEGMENT_LABELS) as PatientSegmentKey[]).map((k) => (
                    <option key={k} value={k}>
                      {SEGMENT_LABELS[k]}
                    </option>
                  ))}
                </select>
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  rows={5}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-600 px-3 py-2 text-[13px] bg-transparent font-mono"
                />
                <p className="text-[11px] text-secondary">Плейсхолдеры: {"{{name}}"}, {"{{days}}"}, {"{{last_visit}}"}</p>
                <button
                  type="button"
                  onClick={() => void handleCreateCampaign()}
                  className="w-full py-2 rounded-xl bg-primary text-white text-[14px] font-semibold"
                >
                  Сохранить черновик
                </button>
              </div>
            ) : null}

            {campaigns.map((c) => (
              <div
                key={c.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900"
              >
                <div className="flex justify-between gap-2 mb-2">
                  <p className="font-semibold text-[#0F172A] dark:text-white">{c.name}</p>
                  <span className="text-[11px] text-secondary">{CAMPAIGN_STATUS_LABELS[c.status]}</span>
                </div>
                <p className="text-[12px] text-secondary mb-2">
                  {c.segmentKey ? SEGMENT_LABELS[c.segmentKey] : "Все сегменты"} · {c.triggerType === "reactivation_auto" ? "авто" : "ручная"}
                  {c.lastRunAt ? ` · запуск ${new Date(c.lastRunAt).toLocaleString("ru-RU")}` : ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  {c.status === "draft" || c.status === "paused" ? (
                    <button
                      type="button"
                      onClick={() => void updateCampaignStatus(c.id, "active").then(() => load())}
                      className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[12px] font-medium"
                    >
                      Активировать
                    </button>
                  ) : null}
                  {c.status === "active" ? (
                    <button
                      type="button"
                      onClick={() => void updateCampaignStatus(c.id, "paused").then(() => load())}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[12px]"
                    >
                      Пауза
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={runningId === c.id}
                    onClick={() => void handleRunCampaign(c.id)}
                    className="px-3 py-1.5 rounded-lg bg-primary text-white text-[12px] font-medium disabled:opacity-50"
                  >
                    {runningId === c.id ? "Отправка…" : "Запустить в Telegram"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedCampaignId(selectedCampaignId === c.id ? null : c.id)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-[12px]"
                  >
                    История
                  </button>
                </div>
                {selectedCampaignId === c.id && deliveries.length > 0 ? (
                  <ul className="mt-3 space-y-1 border-t border-slate-100 dark:border-slate-800 pt-2">
                    {deliveries.map((d) => (
                      <li key={d.id} className="text-[12px] flex justify-between gap-2">
                        <span>{d.patientName}</span>
                        <span className="text-secondary">{d.status}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
