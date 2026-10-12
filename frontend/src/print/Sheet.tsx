import { ReactNode } from "react";
import { CENTER } from "@/lib/center";
import type { ThemeColor } from "@/lib/types";

export const COLORS: Record<ThemeColor, { main: string; soft: string }> = {
  MARINE: { main: "#0C3C7A", soft: "#E8EFF8" },
  VERT: { main: "#1B8A4B", soft: "#E6F4EC" },
};

export type SheetSize = "A4P" | "A5L" | "A6L" | "STRIP";
export const SIZES: Record<SheetSize, { w: number; h: number; css: string }> = {
  A4P: { w: 210, h: 297, css: "210mm 297mm" },
  A5L: { w: 210, h: 148, css: "210mm 148mm" },
  A6L: { w: 148, h: 105, css: "148mm 105mm" },
  STRIP: { w: 210, h: 60, css: "210mm 60mm" },
};

/** Cachet rectangulaire : logo au centre, textes sur le bord, bandeau du département. Tout vient de l'API. */
export function Stamp({ name, color = "MARINE", scale = 1 }: { name?: string | null; color?: ThemeColor; scale?: number }) {
  const c = COLORS[color].main;
  return (
    <div style={{ width: `${58 * scale}mm`, height: `${36 * scale}mm`, border: `0.5mm solid ${c}`, borderRadius: `${3 * scale}mm`, color: c, fontSize: `${2.3 * scale}mm` }}
      className="relative flex flex-col overflow-hidden bg-white font-bold uppercase tracking-wider">
      <div className="pt-[1.2mm] text-center leading-none" style={{ fontSize: `${2.6 * scale}mm` }}>{CENTER.name}</div>
      <div className="relative flex flex-1 items-center justify-center">
        <img src={color === "VERT" ? "/brand/icone-vert.png" : "/brand/icone-marine.png"} alt="" style={{ height: `${15 * scale}mm` }} />
        <span className="absolute left-[1.5mm] top-1/2 origin-center -translate-y-1/2 whitespace-nowrap" style={{ writingMode: "vertical-rl", transform: "translateY(-50%) rotate(180deg)", fontSize: `${1.9 * scale}mm` }}>{CENTER.addressShort}</span>
        <span className="absolute right-[1.5mm] top-1/2 whitespace-nowrap" style={{ writingMode: "vertical-rl", transform: "translateY(-50%)", fontSize: `${1.9 * scale}mm` }}>{CENTER.phone}</span>
      </div>
      <div className="px-[2mm] py-[1.1mm] text-center leading-none text-white" style={{ background: c, fontSize: `${2.7 * scale}mm` }}>{name || CENTER.name}</div>
    </div>
  );
}

export function Sheet({ size, color = "MARINE", title, number, date, children, stampName, hideStamp, signature = "Signature", compact }: {
  size: SheetSize; color?: ThemeColor; title: string; number?: string; date?: string; children: ReactNode; stampName?: string | null; hideStamp?: boolean; signature?: string; compact?: boolean;
}) {
  const s = SIZES[size];
  const c = COLORS[color];
  const small = size === "A6L";
  return (
    <div className="sheet relative flex flex-col overflow-hidden bg-white text-[#0f1e34]" style={{ width: `${s.w}mm`, height: `${s.h}mm`, fontSize: small ? "3mm" : "3.4mm", lineHeight: 1.35 }}>
      <img src="/brand/logo.png" alt="" className="pointer-events-none absolute right-[8mm] top-1/2 -translate-y-1/2 opacity-[0.05]" style={{ width: small ? "55mm" : "80mm" }} />
      {/* En-tête */}
      <div className="relative flex items-start justify-between" style={{ padding: small ? "5mm 6mm 0" : "7mm 10mm 0" }}>
        <div className="flex items-center gap-[3mm]">
          <img src="/brand/logo.png" alt="" style={{ width: small ? "14mm" : "20mm", height: small ? "14mm" : "20mm" }} />
          <div>
            <div className="font-extrabold uppercase leading-none tracking-tight" style={{ fontSize: small ? "5.4mm" : "7.4mm", color: COLORS.MARINE.main }}>Medicare</div>
            <div className="font-semibold uppercase leading-none tracking-[0.35em]" style={{ fontSize: small ? "2.8mm" : "3.6mm", color: COLORS.VERT.main, marginTop: "1mm" }}>Hospital</div>
            <div className="italic text-[#51647A]" style={{ fontSize: small ? "2.2mm" : "2.9mm", marginTop: "1mm" }}>{CENTER.slogan}</div>
          </div>
        </div>
        <div className="text-right text-[#33475f]" style={{ fontSize: small ? "2.4mm" : "3mm", lineHeight: 1.5 }}>
          <div>{CENTER.address}</div><div>{CENTER.phone}</div><div>{CENTER.email}</div>
        </div>
      </div>
      {/* Titre */}
      <div className="relative flex items-center justify-between" style={{ padding: small ? "2.5mm 6mm 0" : "4mm 10mm 0" }}>
        <div className="rounded-full font-extrabold uppercase tracking-wider text-white" style={{ background: c.main, padding: small ? "1.2mm 5mm" : "1.8mm 7mm", fontSize: small ? "3.6mm" : "4.6mm" }}>{title}</div>
        <div className="text-right" style={{ fontSize: small ? "2.8mm" : "3.3mm" }}>
          {number && <div className="font-bold">N° {number}</div>}{date && <div className="text-[#51647A]">Date : {date}</div>}
        </div>
      </div>
      {/* Corps */}
      <div className="relative flex-1" style={{ padding: small ? "2.5mm 6mm 0" : (compact ? "3mm 10mm 0" : "4mm 10mm 0") }}>{children}</div>
      {/* Cachet + signature */}
      {!hideStamp && (
        <div className="relative flex items-end justify-between" style={{ padding: small ? "0 6mm 1.5mm" : "0 10mm 2mm" }}>
          <div className="w-[55mm] border-t border-[#8da2bd] pt-[1mm] text-[#51647A]" style={{ fontSize: "2.6mm" }}>{signature}</div>
          <Stamp name={stampName} color={color} scale={small ? 0.62 : size === "A4P" ? 0.9 : 0.75} />
        </div>
      )}
      {/* Pied */}
      <div className="relative flex items-center justify-center text-white" style={{ background: c.main, height: small ? "5mm" : "8mm", fontSize: small ? "2.4mm" : "3.2mm", letterSpacing: "0.04em" }}>
        <span className="italic">{CENTER.slogan}</span>
      </div>
    </div>
  );
}

export const Line = ({ k, children }: { k: string; children: ReactNode }) => (
  <div className="flex items-baseline gap-[2mm] border-b border-dotted border-[#9fb0c6] py-[0.8mm]">
    <span className="shrink-0 text-[#51647A]">{k} :</span><span className="font-semibold">{children}</span>
  </div>
);
