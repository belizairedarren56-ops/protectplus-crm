"use client";

import { ReactNode } from "react";
import clsx from "clsx";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  maxWidth?: string;
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  maxWidth = "max-w-xl",
}: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
      <div
        className={clsx(
          "max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-yellow-500/50 bg-[#0b0d12] shadow-2xl shadow-yellow-500/10",
          maxWidth
        )}
      >
        <div className="h-1 bg-gradient-to-r from-red-600 via-yellow-400 to-blue-600" />

        <div className="p-8">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-yellow-500">
                ProtectPlus CRM
              </p>

              <h2 className="mt-2 text-3xl font-black text-white">{title}</h2>

              {description && <p className="mt-2 text-gray-400">{description}</p>}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="text-3xl text-gray-500 hover:text-white"
            >
              ×
            </button>
          </div>

          <div className="mt-7">{children}</div>
        </div>
      </div>
    </div>
  );
}
