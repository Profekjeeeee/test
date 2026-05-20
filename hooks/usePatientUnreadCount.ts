"use client";

import { useState, useEffect } from "react";
import { DENTAL_SESSION_CHANGED_EVENT, getCurrentUserId } from "@/lib/auth";
import {
  CHAT_UPDATED_EVENT,
  acquireDentalMessagesRealtime,
  getPatientTotalUnreadCount,
  hydrateDentalMessages,
} from "@/lib/supportChat";

export function usePatientUnreadCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const update = () => {
      const uid = getCurrentUserId();
      setCount(uid ? getPatientTotalUnreadCount(uid) : 0);
    };

    void hydrateDentalMessages().then(update);
    const releaseRealtime = acquireDentalMessagesRealtime(update);

    window.addEventListener(CHAT_UPDATED_EVENT, update);
    window.addEventListener(DENTAL_SESSION_CHANGED_EVENT, update);
    window.addEventListener("storage", update);

    return () => {
      releaseRealtime();
      window.removeEventListener(CHAT_UPDATED_EVENT, update);
      window.removeEventListener(DENTAL_SESSION_CHANGED_EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, []);

  return count;
}
