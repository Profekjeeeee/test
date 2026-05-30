"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { DEFAULT_CLINIC_SETTINGS, DEFAULT_CLINIC_SLUG } from "@/lib/clinic/defaults";
import type { ClinicPublicSettings } from "@/lib/clinic/types";
import { dentalApiFetch } from "@/lib/api/fetchApi";

type ClinicContextValue = {
  settings: ClinicPublicSettings;
  loading: boolean;
  refresh: () => Promise<void>;
};

const ClinicContext = createContext<ClinicContextValue | null>(null);

export function ClinicProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<ClinicPublicSettings>(DEFAULT_CLINIC_SETTINGS);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const slug = DEFAULT_CLINIC_SLUG;
      const data = await dentalApiFetch<ClinicPublicSettings>(
        `/api/clinic/settings?slug=${encodeURIComponent(slug)}`,
      );
      setSettings(data);
    } catch {
      setSettings(DEFAULT_CLINIC_SETTINGS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ settings, loading, refresh }),
    [settings, loading, refresh],
  );

  return <ClinicContext.Provider value={value}>{children}</ClinicContext.Provider>;
}

export function useClinic(): ClinicContextValue {
  const ctx = useContext(ClinicContext);
  if (!ctx) {
    return {
      settings: DEFAULT_CLINIC_SETTINGS,
      loading: false,
      refresh: async () => {},
    };
  }
  return ctx;
}
