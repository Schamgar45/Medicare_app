import { useEffect, useLayoutEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { useOne, useOptions } from '@/lib/queries';
import { SIZES, SheetSize } from './Sheet';
import {
  consultationDoc,
  DocDef,
  invoiceDoc,
  labDoc,
  patientDoc,
  prescriptionDoc,
  receiptDoc,
} from './docs';
import type {
  Consultation,
  Invoice,
  LabResult,
  Patient,
  Payment,
  Prescription,
  Service,
} from '@/lib/types';
import { Skeleton } from '@/components/ui';
import { t, useLanguage } from '@/lib/i18n';

const PATHS: Record<string, string> = {
  invoice: 'invoices',
  receipt: 'payments',
  prescription: 'prescriptions',
  consultation: 'consultations',
  lab: 'lab/results',
  patient: 'patients',
};

function useBuild(type: string, id?: string): { doc?: DocDef; loading: boolean; error: boolean } {
  const q = useOne<any>(PATHS[type] ?? 'patients', id, !!PATHS[type]);
  // Le cachet du laboratoire vient de l'API : le département dont le nom contient « labo ».
  const services = useOptions<Service>('services', {}, type === 'lab');
  if (!PATHS[type]) return { loading: false, error: true };
  if (q.isLoading || (type === 'lab' && services.isLoading)) return { loading: true, error: false };
  if (!q.data) return { loading: false, error: true };
  const d = q.data;
  switch (type) {
    case 'invoice':
      return { doc: invoiceDoc(d as Invoice), loading: false, error: false };
    case 'receipt':
      return { doc: receiptDoc(d as Payment), loading: false, error: false };
    case 'prescription':
      return { doc: prescriptionDoc(d as Prescription), loading: false, error: false };
    case 'consultation':
      return { doc: consultationDoc(d as Consultation), loading: false, error: false };
    case 'patient':
      return { doc: patientDoc(d as Patient), loading: false, error: false };
    case 'lab': {
      const dept = services.data?.find((s) => /labo/i.test(s.name));
      return {
        doc: labDoc(
          d as LabResult,
          dept ? { id: dept.id, name: dept.name, theme_color: dept.theme_color } : null,
        ),
        loading: false,
        error: false,
      };
    }
  }
  return { loading: false, error: true };
}

export default function PrintPage() {
  useLanguage();
  const { type = '', id } = useParams();
  const nav = useNavigate();
  const { doc, loading, error } = useBuild(type, id);
  const [two, setTwo] = useState(false);
  const [scale, setScale] = useState(1);

  const size: SheetSize | undefined = doc?.size;
  const doubled = two && size === 'A5L';
  const page = doubled ? { w: 210, h: 296, css: '210mm 296mm' } : size ? SIZES[size] : SIZES.A4P;

  useEffect(() => {
    const el = document.createElement('style');
    el.id = 'page-size';
    el.textContent = `@page { size: ${page.css}; margin: 0 }`;
    document.head.appendChild(el);
    return () => el.remove();
  }, [page.css]);

  useLayoutEffect(() => {
    const fit = () => setScale(Math.min(1, (window.innerWidth - 32) / (page.w * 3.7795)));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [page.w]);

  return (
    <div className="min-h-screen bg-sunken print:bg-white">
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b bg-surface px-4 py-2.5 print:hidden">
        <button className="btn btn-ghost btn-sm" onClick={() => nav(-1)}>
          <ArrowLeft className="h-4 w-4" />
          {t('Retour')}
        </button>
        <div className="flex-1" />
        {size === 'A5L' && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={two}
              onChange={(e) => setTwo(e.target.checked)}
            />
            {t('2 par feuille A4')}
          </label>
        )}
        {size && (
          <span className="hidden text-xs text-sub sm:inline">
            {t('Format')}:{' '}
            {size === 'A4P' ? 'A4' : size === 'A5L' ? 'A5' : size === 'A6L' ? 'A6' : 'Bandeau'}
          </span>
        )}
        <button className="btn btn-primary btn-sm" disabled={!doc} onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          {t('Imprimer')}
        </button>
      </div>

      <div className="flex justify-center p-4 print:p-0">
        {loading && <Skeleton className="h-[500px] w-full max-w-3xl" />}
        {error && !loading && <p className="card p-10 text-sm text-sub">{t('Document introuvable.')}</p>}
        {doc && (
          <div
            className="print-area origin-top shadow-card print:shadow-none"
            style={{
              width: `${page.w}mm`,
              height: `${page.h}mm`,
              transform: `scale(${scale})`,
              marginBottom: `${-(1 - scale) * page.h * 3.7795}px`,
            }}
          >
            {doubled ? (
              <div className="flex h-full flex-col bg-white">
                {doc.node({})}
                <div className="border-t border-dashed border-[#8da2bd]" />
                {doc.node({})}
              </div>
            ) : (
              doc.node({})
            )}
          </div>
        )}
      </div>
      <style>{`@media print { body { background: #fff !important; } .print-area { transform: none !important; margin: 0 !important; } * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`}</style>
    </div>
  );
}
