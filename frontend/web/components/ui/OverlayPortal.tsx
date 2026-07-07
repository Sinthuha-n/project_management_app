'use client';

import { startTransition, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export default function OverlayPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    startTransition(() => {
      setMounted(true);
    });
  }, []);

  if (!mounted) return null;

  return createPortal(children, document.body);
}
