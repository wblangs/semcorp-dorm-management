import { Navigate, Route, Routes } from "react-router-dom";

import { AdminLayout } from "./layouts/AdminLayout";
import { AllocationPage } from "./pages/AllocationPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DormsPage } from "./pages/DormsPage";
import { PeoplePage } from "./pages/PeoplePage";
import { RoomsPage } from "./pages/RoomsPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/dorms" element={<DormsPage />} />
        <Route path="/rooms" element={<RoomsPage />} />
        <Route path="/people" element={<PeoplePage />} />
        <Route path="/allocations" element={<AllocationPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
