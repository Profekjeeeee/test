export type AuthLookupByPhoneResult =
  | {
      ok: true;
      employee: Record<string, unknown> | null;
      client: Record<string, unknown> | null;
    }
  | { ok: false; error: string; network?: boolean };

export async function lookupAuthByPhoneViaApi(
  cleanPhone: string,
): Promise<AuthLookupByPhoneResult> {
  try {
    const res = await fetch("/api/auth/lookup-by-phone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: cleanPhone }),
      cache: "no-store",
    });

    const json = (await res.json()) as {
      ok?: boolean;
      employee?: Record<string, unknown> | null;
      client?: Record<string, unknown> | null;
      error?: string;
    };

    if (!res.ok || !json.ok) {
      return {
        ok: false,
        error: json.error ?? `HTTP ${res.status}`,
        network: res.status === 502 || res.status === 503,
      };
    }

    return {
      ok: true,
      employee: json.employee ?? null,
      client: json.client ?? null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg, network: true };
  }
}
