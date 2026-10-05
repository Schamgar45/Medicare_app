import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Stethoscope,
  FileText,
  FlaskConical,
  Pill,
  Receipt,
  UserRound,
  Settings,
} from 'lucide-react';
import type { Role } from '@/lib/types';

export interface NavItem {
  to: string;
  label: string;
  icon: typeof Users;
  roles: Role[] | 'all';
}
export const NAV: NavItem[] = [
  { to: '/', label: 'Tableau de bord', icon: LayoutDashboard, roles: 'all' },
  { to: '/patients', label: 'Patients', icon: Users, roles: ['ADMIN', 'RECEPTIONIST', 'DOCTOR'] },
  {
    to: '/appointments',
    label: 'Rendez-vous',
    icon: CalendarDays,
    roles: ['ADMIN', 'RECEPTIONIST', 'DOCTOR'],
  },
  { to: '/consultations', label: 'Consultations', icon: Stethoscope, roles: ['ADMIN', 'DOCTOR'] },
  {
    to: '/prescriptions',
    label: 'Ordonnances',
    icon: FileText,
    roles: ['ADMIN', 'DOCTOR', 'PHARMACIST'],
  },
  { to: '/lab', label: 'Laboratoire', icon: FlaskConical, roles: ['ADMIN', 'DOCTOR', 'LABORANT'] },
  { to: '/pharmacy', label: 'Pharmacie', icon: Pill, roles: ['ADMIN', 'PHARMACIST'] },
  {
    to: '/billing',
    label: 'Facturation',
    icon: Receipt,
    roles: ['ADMIN', 'RECEPTIONIST', 'CASHIER'],
  },
  { to: '/doctors', label: 'Médecins', icon: UserRound, roles: ['ADMIN', 'RECEPTIONIST'] },
  { to: '/admin', label: 'Administration', icon: Settings, roles: ['ADMIN'] },
];
export const allowed = (item: { roles: Role[] | 'all' }, role?: Role) =>
  item.roles === 'all' || role === 'ADMIN' || (!!role && item.roles.includes(role));
