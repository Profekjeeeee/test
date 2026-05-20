"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ConfirmDialogView,
  type ConfirmDialogOptions,
} from "@/components/ui/ConfirmDialog";

export function useConfirmDialog(defaultPlacement: ConfirmDialogOptions["placement"] = "staffPlain") {
  const resolveRef = useRef<((value: boolean) => void) | null>(null);
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [options, setOptions] = useState<ConfirmDialogOptions>({ message: "" });

  useEffect(() => {
    if (!open) {
      setVisible(false);
      return;
    }
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const confirm = useCallback(
    (opts: ConfirmDialogOptions): Promise<boolean> =>
      new Promise((resolve) => {
        resolveRef.current = resolve;
        setOptions({ placement: defaultPlacement, ...opts });
        setOpen(true);
      }),
    [defaultPlacement]
  );

  const finish = useCallback((result: boolean) => {
    setVisible(false);
    window.setTimeout(() => {
      resolveRef.current?.(result);
      resolveRef.current = null;
      setOpen(false);
    }, 280);
  }, []);

  const dialog = open ? (
    <ConfirmDialogView
      {...options}
      visible={visible}
      onCancel={() => finish(false)}
      onConfirm={() => finish(true)}
    />
  ) : null;

  return { confirm, dialog };
}
