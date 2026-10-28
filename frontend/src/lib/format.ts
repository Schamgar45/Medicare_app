import { CENTER } from './center';
import { getLanguage, t } from './i18n';

export const money = (v: string | number | null | undefined) =>
  `${new Intl.NumberFormat(getLanguage() === 'en' ? 'en-US' : 'fr-FR', { maximumFractionDigits: 0 }).format(Number(v ?? 0))} ${CENTER.currency}`;
export const num = (v: string | number | null | undefined) =>
  new Intl.NumberFormat(getLanguage() === 'en' ? 'en-US' : 'fr-FR', {
    maximumFractionDigits: 0,
  }).format(Number(v ?? 0));

export function fmtDate(v?: string | null) {
  if (!v) return '—';
  const d = new Date(v.length === 10 ? v + 'T00:00:00' : v);
  return d.toLocaleDateString(getLanguage() === 'en' ? 'en-US' : 'fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
export function fmtDateTime(v?: string | null) {
  if (!v) return '—';
  const d = new Date(v);
  const locale = getLanguage() === 'en' ? 'en-US' : 'fr-FR';
  return `${d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })} ${d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`;
}
export const fmtTime = (v?: string | null) => (v ? v.slice(0, 5) : '—');
export function monthLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1)
    .toLocaleDateString(getLanguage() === 'en' ? 'en-US' : 'fr-FR', { month: 'short' })
    .replace('.', '');
}
export function ageOf(dob?: string | null) {
  if (!dob) return null;
  const b = new Date(dob),
    n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate()))
    a--;
  return a;
}
/** Date du jour au format YYYY-MM-DD en heure locale (pas UTC : décalage possible d'un jour). */
export const todayISO = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
};
export const fullName = (p?: { first_name?: string; last_name?: string } | null) =>
  p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() : '';
/**
 * Salutation selon l'heure locale d'un instant donné (pas celle de l'appareil) :
 * matin (5h–12h), après-midi (12h–18h), soir (18h–5h).
 */
export function greeting(date: Date): string {
  const h = date.getHours();
  if (h >= 5 && h < 12) return t('Bonjour');
  if (h >= 12 && h < 18) return t('Bonne après-midi');
  return t('Bonsoir');
}
export const initials = (s: string) =>
  s
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

const U = [
  'zéro',
  'un',
  'deux',
  'trois',
  'quatre',
  'cinq',
  'six',
  'sept',
  'huit',
  'neuf',
  'dix',
  'onze',
  'douze',
  'treize',
  'quatorze',
  'quinze',
  'seize',
  'dix-sept',
  'dix-huit',
  'dix-neuf',
];
const T = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];
function below100(n: number): string {
  if (n < 20) return U[n];
  if (n < 70) {
    const t = Math.floor(n / 10),
      u = n % 10;
    return T[t] + (u === 1 ? ' et un' : u ? '-' + U[u] : '');
  }
  if (n < 80) {
    const r = n - 60;
    return 'soixante' + (r === 11 ? ' et onze' : '-' + U[r]);
  }
  const r = n - 80;
  return r === 0 ? 'quatre-vingts' : 'quatre-vingt-' + U[r];
}
function below1000(n: number): string {
  const c = Math.floor(n / 100),
    r = n % 100;
  let s = c === 0 ? '' : c === 1 ? 'cent' : U[c] + ' cent';
  if (c > 1 && r === 0) s += 's';
  if (r) s += (s ? ' ' : '') + below100(r);
  return s;
}

const EN_UNITS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const EN_SCALES = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion'];

function englishBelow1000(n: number): string {
  const hundreds = Math.floor(n / 100);
  const remainder = n % 100;
  const parts: string[] = [];
  if (hundreds) parts.push(`${EN_UNITS[hundreds]} hundred`);
  if (remainder < 20 && remainder > 0) parts.push(EN_UNITS[remainder]);
  else if (remainder >= 20) {
    const tens = EN_TENS[Math.floor(remainder / 10)];
    parts.push(remainder % 10 ? `${tens}-${EN_UNITS[remainder % 10]}` : tens);
  }
  return parts.join(' ');
}

function englishInWords(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  let remainder = Math.abs(Math.round(value));
  if (remainder === 0) return 'zero';
  const parts: string[] = [];
  let scale = 0;
  while (remainder > 0) {
    const group = remainder % 1000;
    if (group) {
      if (scale >= EN_SCALES.length) return new Intl.NumberFormat('en-US').format(value);
      parts.unshift(
        [englishBelow1000(group), EN_SCALES[scale]].filter(Boolean).join(' '),
      );
    }
    remainder = Math.floor(remainder / 1000);
    scale += 1;
  }
  return `${value < 0 ? 'minus ' : ''}${parts.join(' ')}`;
}

/** Montant en lettres (français), ex. 12500 -> « douze mille cinq cents ». */
export function inWords(n: number): string {
  if (getLanguage() === 'en') return englishInWords(n);
  n = Math.round(n);
  if (n === 0) return 'zéro';
  const parts: string[] = [];
  const mil = Math.floor(n / 1_000_000),
    th = Math.floor((n % 1_000_000) / 1000),
    rest = n % 1000;
  if (mil) parts.push(mil === 1 ? 'un million' : below1000(mil) + ' millions');
  if (th) parts.push(th === 1 ? 'mille' : below1000(th).replace(/(vingt|cent)s$/, '$1') + ' mille');
  if (rest) parts.push(below1000(rest));
  return parts.join(' ');
}

export const LABELS: Record<string, string> = {
  ADMIN: 'Administrateur',
  DOCTOR: 'Médecin',
  RECEPTIONIST: 'Réception',
  LABORANT: 'Laborantin',
  PHARMACIST: 'Pharmacien',
  CASHIER: 'Caisse',
  MALE: 'Homme',
  FEMALE: 'Femme',
  OTHER: 'Autre',
  MASCULIN: 'Masculin',
  FEMININ: 'Féminin',
  ACTIVE: 'Actif',
  INACTIVE: 'Inactif',
  ARCHIVED: 'Archivé',
  SUSPENDED: 'Suspendu',
  SCHEDULED: 'Planifié',
  CONFIRMED: 'Confirmé',
  WAITING: 'En attente',
  IN_PROGRESS: 'En cours',
  COMPLETED: 'Terminé',
  CANCELLED: 'Annulé',
  NO_SHOW: 'Absent',
  OPEN: 'Ouverte',
  DRAFT: 'Brouillon',
  VALIDATED: 'Validée',
  PARTIALLY_DISPENSED: 'Partiellement délivrée',
  DISPENSED: 'Délivrée',
  UNPAID: 'Impayée',
  PARTIALLY_PAID: 'Partiellement payée',
  PAID: 'Payée',
  PENDING: 'En attente',
  CASH: 'Espèces',
  MOBILE_MONEY: 'Mobile Money',
  BANK: 'Banque',
  CARD: 'Carte',
  INSURANCE: 'Assurance',
  REQUESTED: 'Demandé',
  SAMPLE_COLLECTED: 'Prélevé',
  RESULT_AVAILABLE: 'Résultat saisi',
  NORMAL: 'Normal',
  URGENT: 'Urgent',
  CRITICAL: 'Critique',
  IN: 'Entrée',
  OUT: 'Sortie',
  ADJUSTMENT: 'Ajustement',
  RETURN: 'Retour',
  EXPIRED: 'Expiré',
  DAMAGED: 'Endommagé',
  MARINE: 'Marine',
  VERT: 'Vert',
};
export const label = (v?: string | null) => (v ? t(LABELS[v] ?? v) : '—');
export const opts = (keys: string[]) => keys.map((k) => ({ value: k, label: label(k) }));

/** Téléphone international générique : + optionnel puis 8 à 15 chiffres (espaces/tirets/points tolérés). */
export const PHONE_MESSAGE =
  'Numéro invalide : utilisez le format international, ex. +25779987654.';
export const normalizePhone = (v: string) => (v ?? '').replace(/[\s\-().]/g, '');
export const isValidPhone = (v?: string | null) => {
  if (!v) return true; // vide autorisé (champ non requis) — le back refuse aussi les formats invalides
  return /^\+?\d{8,15}$/.test(normalizePhone(v));
};
