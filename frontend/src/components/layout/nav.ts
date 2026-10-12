import { LayoutDashboard, Users, CalendarDays, Stethoscope, FileText, FlaskConical, Pill, Receipt, UserRound, Settings } from "lucide-react";
import type { Role } from "@/lib/types";

export type NavGroup = "Navigation" | "Soins médicaux" | "Pharmacie & caisse" | "Administration";
export interface NavItem { to: string; label: string; icon: typeof Users; roles: Role[] | "all"; group: NavGroup; countKey?: "patients" | "appointments" | "lab" | "stock" | "invoices" }
export const NAV: NavItem[] = [
  { to: "/", label: "Tableau de bord", icon: LayoutDashboard, roles: "all", group: "Navigation" },
  { to: "/patients", label: "Patients", icon: Users, roles: ["ADMIN", "RECEPTIONIST", "DOCTOR"], group: "Navigation", countKey: "patients" },
  { to: "/appointments", label: "Rendez-vous", icon: CalendarDays, roles: ["ADMIN", "RECEPTIONIST", "DOCTOR"], group: "Navigation", countKey: "appointments" },
  { to: "/consultations", label: "Consultations", icon: Stethoscope, roles: ["ADMIN", "DOCTOR"], group: "Soins médicaux" },
  { to: "/prescriptions", label: "Ordonnances", icon: FileText, roles: ["ADMIN", "DOCTOR", "PHARMACIST"], group: "Soins médicaux" },
  { to: "/lab", label: "Laboratoire", icon: FlaskConical, roles: ["ADMIN", "DOCTOR", "LABORANT"], group: "Soins médicaux", countKey: "lab" },
  { to: "/pharmacy", label: "Pharmacie", icon: Pill, roles: ["ADMIN", "PHARMACIST"], group: "Pharmacie & caisse", countKey: "stock" },
  { to: "/billing", label: "Facturation", icon: Receipt, roles: ["ADMIN", "RECEPTIONIST", "CASHIER"], group: "Pharmacie & caisse", countKey: "invoices" },
  { to: "/doctors", label: "Médecins", icon: UserRound, roles: ["ADMIN", "RECEPTIONIST"], group: "Administration" },
  { to: "/admin", label: "Administration", icon: Settings, roles: ["ADMIN"], group: "Administration" },
];
export const allowed = (item: { roles: Role[] | "all" }, role?: Role) => item.roles === "all" || role === "ADMIN" || (!!role && item.roles.includes(role));

/** Parcours d'un patient dans l'établissement : raccourcis dans la barre « circuit ». */
export const CIRCUIT = [
  { to: "/patients", label: "1. Admission & dossier", icon: "users" },
  { to: "/appointments", label: "2. Rendez-vous", icon: "calendar" },
  { to: "/consultations", label: "3. Consultation", icon: "stetho" },
  { to: "/lab", label: "4. Laboratoire", icon: "flask" },
  { to: "/pharmacy", label: "5. Pharmacie", icon: "pill" },
  { to: "/billing", label: "6. Facturation", icon: "receipt" },
] as const;
