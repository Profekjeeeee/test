"use client";

import { useClinic } from "@/contexts/ClinicProvider";

/** CSS-переменные брендинга клиники (--clinic-primary и т.д.). */
export default function ClinicBrandingStyles() {
  const { settings } = useClinic();
  const css = `
    :root {
      --clinic-primary: ${settings.primaryColor};
      --clinic-accent: ${settings.accentColor};
    }
  `;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
