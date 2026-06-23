"use client";

import { useEffect, useState } from "react";

/** Aviso en iPhone/iPad dentro del iframe de Notion (pantalla negra conocida). */
export function IosEmbedHint() {
  const [href, setHref] = useState<string | null>(null);

  useEffect(() => {
    const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const embedded = window.self !== window.top;
    if (ios && embedded) {
      setHref(window.location.href);
    }
  }, []);

  if (!href) return null;

  return (
    <div className="mx-auto mb-3 max-w-xl px-4 pt-3 sm:px-0">
      <p className="rounded-md border border-[#e8e8e8] bg-[#f7f7f5] px-3 py-2 text-center text-xs text-[#787774]">
        Si el recuadro se ve negro en iPhone,{" "}
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-[#2383e2] underline"
        >
          ábrelo en Safari
        </a>
        .
      </p>
    </div>
  );
}
