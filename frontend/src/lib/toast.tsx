import { createContext, useCallback, useContext, useState, ReactNode } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";

type Toast = { id: number; kind: "ok" | "err"; text: string };
const Ctx = createContext<{ ok: (t: string) => void; err: (t: string) => void }>({ ok: () => {}, err: () => {} });
let n = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast["kind"], text: string) => {
    const id = ++n;
    setList((l) => [...l, { id, kind, text }]);
    setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), kind === "err" ? 6000 : 3500);
  }, []);
  return (
    <Ctx.Provider value={{ ok: (t) => push("ok", t), err: (t) => push("err", t) }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex w-[min(92vw,360px)] flex-col gap-2 print:hidden" role="status" aria-live="polite">
        {list.map((t) => (
          <div key={t.id} className="card flex animate-rise items-start gap-3 p-3 text-sm">
            {t.kind === "ok" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-bad" />}
            <span className="flex-1">{t.text}</span>
            <button onClick={() => setList((l) => l.filter((x) => x.id !== t.id))} aria-label="Fermer"><X className="h-4 w-4 text-mute" /></button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
export const useToast = () => useContext(Ctx);
