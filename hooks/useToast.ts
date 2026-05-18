"use client";

import { useState, useCallback } from "react";

import type { ToastTone } from "@/components/ui/Toast";

export function useToast() {
  const [message, setMessage] = useState("");
  const [visible, setVisible] = useState(false);
  const [tone, setTone] = useState<ToastTone>("success");

  const showToast = useCallback((msg: string, nextTone: ToastTone = "success") => {
    setMessage(msg);
    setTone(nextTone);
    setVisible(true);
    setTimeout(() => setVisible(false), 2500);
  }, []);

  return {
    toastMessage: message,
    toastVisible: visible,
    toastTone: tone,
    showToast,
  };
}
