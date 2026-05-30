"use client";

import PlatformNav from "@/components/platform/PlatformNav";

export default function PlatformScreensLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PlatformNav />
      {children}
    </>
  );
}
