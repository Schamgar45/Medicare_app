import { ReactNode, Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { AppLayout } from '@/components/layout/AppLayout';
import { NAV, allowed } from '@/components/layout/nav';
import { Skeleton } from '@/components/ui';
import { ForgotPage, LoginPage, ResetPage } from '@/pages/AuthPages';

const L = <K extends string>(f: () => Promise<Record<K, React.ComponentType<any>>>, k: K) =>
  lazy(() => f().then((m) => ({ default: m[k] })));
const DashboardPage = lazy(() => import('@/pages/Dashboard'));
const PrintPage = lazy(() => import('@/print/PrintPage'));
const clinical = () => import('@/features/clinical');
const PatientsPage = L(clinical, 'PatientsPage'),
  PatientDetailPage = L(clinical, 'PatientDetailPage'),
  AppointmentsPage = L(clinical, 'AppointmentsPage'),
  ConsultationsPage = L(clinical, 'ConsultationsPage'),
  DoctorsPage = L(clinical, 'DoctorsPage');
const PrescriptionsPage = L(() => import('@/features/prescriptions'), 'PrescriptionsPage'),
  PrescriptionDetailPage = L(() => import('@/features/prescriptions'), 'PrescriptionDetailPage');
const LabPage = L(() => import('@/features/lab'), 'LabPage');
const PharmacyPage = L(() => import('@/features/pharmacy'), 'PharmacyPage');
const BillingPage = L(() => import('@/features/billing'), 'BillingPage'),
  InvoiceDetailPage = L(() => import('@/features/billing'), 'InvoiceDetailPage');
const AdminPage = L(() => import('@/features/admin'), 'AdminPage');
const ProfilePage = L(() => import('@/pages/ProfilePage'), 'ProfilePage');

const Fallback = () => (
  <div className="space-y-4 p-6" aria-busy="true">
    <Skeleton className="h-10 w-64" />
    <Skeleton className="h-64" />
  </div>
);

function Private({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading)
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <>{children}</>;
}

function Guard({ path, children }: { path: string; children: ReactNode }) {
  const { user } = useAuth();
  const item = NAV.find((n) => n.to === path);
  if (item && !allowed(item, user?.role))
    return (
      <div className="card mx-auto mt-10 max-w-md p-10 text-center">
        <p className="font-bold">Accès non autorisé</p>
        <p className="mt-1 text-sm text-sub">Votre rôle ne permet pas d'ouvrir cette page.</p>
      </div>
    );
  return <>{children}</>;
}

export default function App() {
  return (
    <Suspense fallback={<Fallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot" element={<ForgotPage />} />
        <Route path="/reset-password" element={<ResetPage />} />
        <Route
          path="/print/:type/:id"
          element={
            <Private>
              <PrintPage />
            </Private>
          }
        />
        <Route
          element={
            <Private>
              <AppLayout />
            </Private>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route
            path="patients"
            element={
              <Guard path="/patients">
                <PatientsPage />
              </Guard>
            }
          />
          <Route
            path="patients/:id"
            element={
              <Guard path="/patients">
                <PatientDetailPage />
              </Guard>
            }
          />
          <Route
            path="appointments"
            element={
              <Guard path="/appointments">
                <AppointmentsPage />
              </Guard>
            }
          />
          <Route
            path="consultations"
            element={
              <Guard path="/consultations">
                <ConsultationsPage />
              </Guard>
            }
          />
          <Route
            path="prescriptions"
            element={
              <Guard path="/prescriptions">
                <PrescriptionsPage />
              </Guard>
            }
          />
          <Route
            path="prescriptions/:id"
            element={
              <Guard path="/prescriptions">
                <PrescriptionDetailPage />
              </Guard>
            }
          />
          <Route
            path="lab"
            element={
              <Guard path="/lab">
                <LabPage />
              </Guard>
            }
          />
          <Route
            path="pharmacy"
            element={
              <Guard path="/pharmacy">
                <PharmacyPage />
              </Guard>
            }
          />
          <Route
            path="billing"
            element={
              <Guard path="/billing">
                <BillingPage />
              </Guard>
            }
          />
          <Route
            path="billing/invoices/:id"
            element={
              <Guard path="/billing">
                <InvoiceDetailPage />
              </Guard>
            }
          />
          <Route
            path="doctors"
            element={
              <Guard path="/doctors">
                <DoctorsPage />
              </Guard>
            }
          />
          <Route
            path="admin"
            element={
              <Guard path="/admin">
                <AdminPage />
              </Guard>
            }
          />
          <Route path="mon-profil" element={<ProfilePage />} />
          <Route
            path="*"
            element={
              <div className="card mx-auto mt-10 max-w-md p-10 text-center">
                <p className="font-bold">Page introuvable</p>
              </div>
            }
          />
        </Route>
      </Routes>
    </Suspense>
  );
}
