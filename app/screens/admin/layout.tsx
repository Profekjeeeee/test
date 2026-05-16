"use client";

import AdminBottomBar from "@/components/layout/AdminBottomBar";

export default function AdminScreensLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <AdminBottomBar />
    </>
  );
}
