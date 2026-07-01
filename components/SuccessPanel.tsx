import type { CreatedIncidentSummary } from "@/lib/types";

interface SuccessPanelProps {
  title: string;
  items: CreatedIncidentSummary[];
  onReset: () => void;
  resetLabel?: string;
}

export function SuccessPanel({ title, items, onReset, resetLabel = "Enviar otro reporte" }: SuccessPanelProps) {
  return (
    <div className="rounded-lg border border-[#efefef] bg-white p-6">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#edf7ee]">
          <svg className="h-5 w-5 text-[#448361]" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 111.42-1.42l2.79 2.79 6.79-6.79a1 1 0 011.42 0z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <h2 className="text-base font-semibold text-[#37352f]">{title}</h2>
        <p className="mt-1 text-sm text-[#787774]">
          El ticket padre y sus subtareas se crearon en Notion con sprint y fechas del día.
        </p>
      </div>

      {items.length > 0 && (
        <ul className="mt-4 space-y-3 border-t border-[#efefef] pt-4">
          {items.map((item) => (
            <li key={item.pageId} className="rounded-md bg-[#f7f7f5] px-3 py-2 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#9b9a97]">Ticket padre</p>
              <p className="font-medium text-[#37352f]">{item.taskTitle}</p>
              {item.pageUrl && (
                <a
                  href={item.pageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-[#2383e2] hover:underline"
                >
                  Ver ticket en Notion
                </a>
              )}
              {item.subtasks && item.subtasks.length > 0 && (
                <ul className="mt-2 space-y-1.5 border-t border-[#efefef] pt-2">
                  <li className="text-xs font-semibold uppercase tracking-wide text-[#9b9a97]">
                    Subtareas ({item.subtasks.length})
                  </li>
                  {item.subtasks.map((sub) => (
                    <li key={sub.pageId} className="pl-2">
                      <p className="text-[#37352f]">{sub.title}</p>
                      {sub.pageUrl && (
                        <a
                          href={sub.pageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#2383e2] hover:underline"
                        >
                          Ver subtarea
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 text-center">
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center justify-center rounded-md border border-[#efefef] bg-white px-4 py-2 text-sm font-medium text-[#37352f] transition hover:bg-[#f7f7f5]"
        >
          {resetLabel}
        </button>
      </div>
    </div>
  );
}
