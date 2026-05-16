"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isAdminMode } from "@/lib/auth";
import AdminBottomBar from "@/components/layout/AdminBottomBar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (!isAdminMode()) {
      router.replace("/auth");
    }
  }, [router]);

  return (
    <>
      {children}
      <AdminBottomBar />
    </>
  );
}
