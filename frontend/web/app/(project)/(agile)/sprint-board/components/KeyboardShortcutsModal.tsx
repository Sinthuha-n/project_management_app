'use client';

import { Keyboard } from 'lucide-react';
import OverlayPortal from '@/components/ui/OverlayPortal';

interface KeyboardShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

export default function KeyboardShortcutsModal({ open, onClose }: KeyboardShortcutsModalProps) {
  if (!open) return null;
  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-[var(--cu-z-modal)] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-cu-border bg-cu-bg p-5 shadow-cu-xl">
        <h3 className="flex items-center gap-2 text-base font-bold text-cu-text-primary"><Keyboard size={16} />Keyboard shortcuts</h3>
        <ul className="mt-3 space-y-2 text-sm text-cu-text-secondary">
          <li><strong>Cmd/Ctrl + K</strong>: Open/close this dialog</li>
          <li><strong>Cmd/Ctrl + B</strong>: Toggle density mode</li>
          <li><strong>Esc</strong>: Close dialogs</li>
        </ul>
        <button onClick={onClose} className="mt-4 rounded-lg border border-cu-border px-3 py-1.5 text-sm font-semibold text-cu-text-primary transition-colors hover:bg-cu-hover">Close</button>
      </div>
      </div>
    </OverlayPortal>
  );
}
