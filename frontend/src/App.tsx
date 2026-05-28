import { Navigate, Route, Routes } from "react-router-dom";

import { AdminLayout } from "./layouts/AdminLayout";
import { AllocationPage } from "./pages/AllocationPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DictionariesPage } from "./pages/DictionariesPage";
import { DormsPage } from "./pages/DormsPage";
import { PeoplePage } from "./pages/PeoplePage";
import { RoomsPage } from "./pages/RoomsPage";
import { StayPage } from "./pages/StayPage";
import { VehiclesPage } from "./pages/VehiclesPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/dorms" element={<DormsPage />} />
        <Route path="/rooms" element={<RoomsPage />} />
        <Route path="/people" element={<PeoplePage />} />
        <Route path="/stay" element={<StayPage />} />
        <Route path="/allocations" element={<AllocationPage />} />
        <Route path="/vehicles" element={<VehiclesPage />} />
        <Route path="/dictionaries" element={<DictionariesPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
