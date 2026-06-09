import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { AuthProvider, useAuth } from "./auth/AuthContext";
import { LanguageBoundary, LanguageProvider } from "./i18n";
import { AdminLayout } from "./layouts/AdminLayout";
import { AllocationPage } from "./pages/AllocationPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DictionariesPage } from "./pages/DictionariesPage";
import { DormsPage } from "./pages/DormsPage";
import { LoginPage } from "./pages/LoginPage";
import { PeoplePage } from "./pages/PeoplePage";
import { RoomsPage } from "./pages/RoomsPage";
import { RoomAssetsPage } from "./pages/RoomAssetsPage";
import { StayPage } from "./pages/StayPage";
import { SystemPage } from "./pages/SystemPage";
import { UsersPage } from "./pages/UsersPage";
import { VehiclesPage } from "./pages/VehiclesPage";
import { CheckInRecordsPage } from "./pages/CheckInRecordsPage";

function ProtectedLayout() {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="min-h-screen bg-slate-100 px-6 py-8 text-slate-700">正在恢复登录状态...</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <AdminLayout />;
}

function AdminOnly({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/dorms" element={<DormsPage />} />
        <Route path="/rooms" element={<RoomsPage />} />
        <Route path="/room-assets" element={<RoomAssetsPage />} />
        <Route path="/people" element={<PeoplePage />} />
        <Route path="/stay" element={<StayPage />} />
        <Route path="/allocations" element={<AllocationPage />} />
        <Route
          path="/check-in-records"
          element={
            <AdminOnly>
              <CheckInRecordsPage />
            </AdminOnly>
          }
        />

        <Route path="/vehicles" element={<VehiclesPage />} />
        <Route
          path="/dictionaries"
          element={
            <AdminOnly>
              <DictionariesPage />
            </AdminOnly>
          }
        />
        <Route
          path="/users"
          element={
            <AdminOnly>
              <UsersPage />
            </AdminOnly>
          }
        />
        <Route
          path="/system"
          element={
            <AdminOnly>
              <SystemPage />
            </AdminOnly>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <LanguageBoundary>
          <AppRoutes />
        </LanguageBoundary>
      </AuthProvider>
    </LanguageProvider>
  );
}
