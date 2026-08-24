import { apiRequest } from "./client";
import type {
  Allocation,
  AvailableRoom,
  AuthResponse,
  DashboardData,
  DictionaryState,
  Dorm,
  InsurancePolicy,
  Person,
  PersonLicense,
  Room,
  RoomItem,
  StayRecord,
  StayRiskPayload,
  SystemInfo,
  User,
  UtilityAccount,
  UtilityBill,
  UtilityBillRecipient,
  Vehicle,
  VehicleAccident,
  VehicleAlertsPayload,
  VehicleAssignment,
  VehicleDetail,
  VehicleDriver,
  VehicleMaintenance,
  VehicleRepair,
} from "../types";

type NewDorm = Omit<Dorm, "id">;
type NewRoom = Omit<Room, "id">;
// Assets (bed size, light, nightstand, trash can) are managed on the Room Assets page,
// not at room creation, so they are optional when creating a room.
type CreateRoomPayload = Omit<
  NewRoom,
  "bed_size" | "light_type" | "light_count" | "nightstand_count" | "trash_can_count"
>;
type NewPerson = Omit<Person, "id">;
// 派生缓存字段（保险到期/下次保养/常驻宿舍）不在建车/改车 payload 里；
// base_dorm_id 仅建车时可传，用于生成首条调拨记录。
export type VehiclePayload = {
  plate_number: string;
  vin?: string | null;
  make?: string | null;
  model?: string | null;
  model_year?: number | null;
  color?: string | null;
  seat_count: number;
  vehicle_type?: string | null;
  ownership_type?: "owned" | "leased";
  purchase_date?: string | null;
  purchase_price?: number | null;
  lease_company?: string | null;
  lease_start_date?: string | null;
  lease_end_date?: string | null;
  lease_monthly_fee?: number | null;
  base_dorm_id?: number | null;
  inspection_expire_date?: string | null;
  registration_expire_date?: string | null;
  odometer?: number | null;
  maintenance_interval_miles?: number | null;
  maintenance_interval_months?: number | null;
  note?: string | null;
  status?: Vehicle["status"];
};
// status stays backend-side (defaults to pending); the UI no longer sets it.
type NewUtilityBill = Omit<UtilityBill, "id" | "reminded_on" | "status">;
type NewUtilityAccount = Omit<UtilityAccount, "id">;

export const api = {
  login: (payload: { username: string; password: string }) =>
    apiRequest<AuthResponse>("/api/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  getDingtalkConfig: () => apiRequest<{ enabled: boolean; corp_id: string }>("/api/auth/dingtalk-config"),
  dingtalkLogin: (auth_code: string) =>
    apiRequest<AuthResponse>("/api/auth/dingtalk-login", { method: "POST", body: JSON.stringify({ auth_code }) }),
  logout: () => apiRequest<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  me: () => apiRequest<User>("/api/auth/me"),
  getSystemInfo: () => apiRequest<SystemInfo>("/api/system"),

  getUsers: () => apiRequest<User[]>("/api/users"),
  createUser: (payload: {
    username: string;
    password: string;
    display_name?: string | null;
    role: "admin" | "user" | "viewer";
    status: "active" | "disabled";
  }) => apiRequest<User>("/api/users", { method: "POST", body: JSON.stringify(payload) }),
  updateUser: (
    id: number,
    payload: {
      display_name?: string | null;
      role?: "admin" | "user" | "viewer";
      status?: "active" | "disabled";
      dingtalk_userid?: string | null;
      receive_bill_reminders?: boolean;
      receive_vehicle_reminders?: boolean;
    },
  ) => apiRequest<User>(`/api/users/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteUser: (id: number) => apiRequest<{ deleted: boolean }>(`/api/users/${id}`, { method: "DELETE" }),
  resetUserPassword: (id: number, password: string) =>
    apiRequest<{ updated: boolean }>(`/api/users/${id}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ password }),
    }),

  getDashboard: () => apiRequest<DashboardData>("/api/dashboard"),

  getDictionaries: () => apiRequest<DictionaryState>("/api/dictionaries"),
  replaceDictionary: (
    key: string,
    payload: { label?: string; items: { label: string; value: string; sort_order?: number }[] },
  ) =>
    apiRequest<DictionaryState>(`/api/dictionaries/${key}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  getDorms: () => apiRequest<Dorm[]>("/api/dorms"),
  createDorm: (payload: NewDorm) =>
    apiRequest<Dorm>("/api/dorms", { method: "POST", body: JSON.stringify(payload) }),
  updateDorm: (id: number, payload: NewDorm) =>
    apiRequest<Dorm>(`/api/dorms/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteDorm: (id: number) => apiRequest<{ deleted: boolean }>(`/api/dorms/${id}`, { method: "DELETE" }),

  getRooms: () => apiRequest<Room[]>("/api/rooms"),
  createRoom: (payload: CreateRoomPayload) =>
    apiRequest<Room>("/api/rooms", { method: "POST", body: JSON.stringify(payload) }),
  updateRoom: (id: number, payload: Partial<NewRoom>) =>
    apiRequest<Room>(`/api/rooms/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteRoom: (id: number) => apiRequest<{ deleted: boolean }>(`/api/rooms/${id}`, { method: "DELETE" }),

  getRoomItems: () => apiRequest<RoomItem[]>("/api/room-items"),
  createRoomItem: (payload: { room_id: number; name: string; item_type?: string | null; count: number }) =>
    apiRequest<RoomItem>("/api/room-items", { method: "POST", body: JSON.stringify(payload) }),
  updateRoomItem: (
    id: number,
    payload: { name?: string; item_type?: string | null; count?: number },
  ) => apiRequest<RoomItem>(`/api/room-items/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteRoomItem: (id: number) => apiRequest<{ deleted: boolean }>(`/api/room-items/${id}`, { method: "DELETE" }),

  getPeople: () => apiRequest<Person[]>("/api/people"),
  createPerson: (payload: NewPerson) =>
    apiRequest<Person>("/api/people", { method: "POST", body: JSON.stringify(payload) }),
  updatePerson: (id: number, payload: NewPerson) =>
    apiRequest<Person>(`/api/people/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deletePerson: (id: number) => apiRequest<{ deleted: boolean }>(`/api/people/${id}`, { method: "DELETE" }),

  getAllocations: () => apiRequest<Allocation[]>("/api/allocations"),
  getAllocationBackupHistory: () => apiRequest<Allocation[]>("/api/allocations/backup"),
  createAllocation: (payload: {
    person_id: number;
    dorm_id: number;
    room_id: number;
    check_in_date: string;
    expected_check_out_date?: string | null;
    note?: string | null;
  }) =>
    apiRequest<Allocation>("/api/allocations", { method: "POST", body: JSON.stringify(payload) }),
  updateAllocation: (
    id: number,
    payload: {
      dorm_id?: number;
      room_id?: number;
      check_in_date?: string;
      expected_check_out_date?: string | null;
      note?: string | null;
    },
  ) =>
    apiRequest<Allocation>(`/api/allocations/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteAllocation: (id: number) =>
    apiRequest<{ deleted: boolean }>(`/api/allocations/${id}`, { method: "DELETE" }),
  deleteAllocationBackup: (id: number) =>
    apiRequest<{ deleted: boolean }>(`/api/allocations/backup/${id}`, { method: "DELETE" }),
  recoverAllocationUserHistory: (id: number) =>
    apiRequest<Allocation>(`/api/allocations/backup/${id}/recover`, { method: "POST" }),
  setAllocationTempLeave: (id: number, payload: { start_date: string | null; end_date: string | null }) =>
    apiRequest<Allocation>(`/api/allocations/${id}/temp-leave`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  checkoutAllocation: (id: number, check_out_date: string) =>
    apiRequest<Allocation>(`/api/allocations/${id}/checkout`, {
      method: "POST",
      body: JSON.stringify({ check_out_date }),
    }),
  getAvailableRooms: (dorm_id: number, person_id: number) =>
    apiRequest<AvailableRoom[]>(`/api/rooms/available?dorm_id=${dorm_id}&person_id=${person_id}`),

  getStays: () => apiRequest<StayRecord[]>("/api/stays"),
  getStay: (person_id: number) => apiRequest<StayRecord>(`/api/stays/${person_id}`),
  upsertStay: (payload: {
    person_id: number;
    visa_type: string;
    arrival_date: string;
    planned_leave_date: string;
    max_stay_date?: string | null;
    actual_leave_date?: string | null;
    note?: string | null;
  }) => apiRequest<StayRecord>("/api/stays/upsert", { method: "POST", body: JSON.stringify(payload) }),
  deleteStay: (stay_id: number) => apiRequest<{ deleted: boolean }>(`/api/stays/${stay_id}`, { method: "DELETE" }),
  getStayRisks: () => apiRequest<StayRiskPayload>("/api/stays/risks"),

  getVehicles: () => apiRequest<Vehicle[]>("/api/vehicles"),
  getVehicleDetail: (id: number) => apiRequest<VehicleDetail>(`/api/vehicles/${id}`),
  createVehicle: (payload: VehiclePayload) =>
    apiRequest<Vehicle>("/api/vehicles", { method: "POST", body: JSON.stringify(payload) }),
  updateVehicle: (id: number, payload: Partial<Omit<VehiclePayload, "base_dorm_id" | "odometer">>) =>
    apiRequest<Vehicle>(`/api/vehicles/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteVehicle: (id: number) => apiRequest<{ deleted: boolean }>(`/api/vehicles/${id}`, { method: "DELETE" }),
  updateVehicleOdometer: (id: number, odometer: number, force = false) =>
    apiRequest<Vehicle>(`/api/vehicles/${id}/odometer`, {
      method: "PUT",
      body: JSON.stringify({ odometer, force }),
    }),
  getVehicleAlerts: () => apiRequest<VehicleAlertsPayload>("/api/vehicles/alerts"),
  runVehicleReminders: () =>
    apiRequest<{ sent: number; reason?: string; recipients?: number }>("/api/vehicles/reminders/run", {
      method: "POST",
    }),
  sendVehicleTestMessage: () =>
    apiRequest<{ sent: boolean }>("/api/vehicles/reminders/test", { method: "POST" }),

  assignVehicle: (id: number, payload: { dorm_id: number; start_date?: string | null; note?: string | null }) =>
    apiRequest<VehicleAssignment>(`/api/vehicles/${id}/assign`, { method: "POST", body: JSON.stringify(payload) }),

  addVehicleDriver: (
    vehicleId: number,
    payload: { person_id: number; role: "primary" | "secondary"; start_date?: string | null; note?: string | null },
  ) =>
    apiRequest<{ driver: VehicleDriver; warnings: string[] }>(`/api/vehicles/${vehicleId}/drivers`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateVehicleDriver: (
    driverId: number,
    payload: { role?: "primary" | "secondary"; start_date?: string | null; note?: string | null },
  ) => apiRequest<VehicleDriver>(`/api/vehicle-drivers/${driverId}`, { method: "PUT", body: JSON.stringify(payload) }),
  removeVehicleDriver: (driverId: number) =>
    apiRequest<{ removed: boolean }>(`/api/vehicle-drivers/${driverId}`, { method: "DELETE" }),

  getPersonLicense: (personId: number) => apiRequest<PersonLicense>(`/api/people/${personId}/license`),
  getPersonLicenses: () => apiRequest<PersonLicense[]>("/api/person-licenses"),
  upsertPersonLicense: (personId: number, payload: Omit<PersonLicense, "person_id">) =>
    apiRequest<PersonLicense>(`/api/people/${personId}/license`, {
      method: "POST",
      body: JSON.stringify({ person_id: personId, ...payload }),
    }),

  createVehiclePolicy: (
    vehicleId: number,
    payload: Omit<InsurancePolicy, "id" | "vehicle_id" | "driver_snapshot" | "status">,
  ) =>
    apiRequest<{ policy: InsurancePolicy; warnings: string[] }>(`/api/vehicles/${vehicleId}/policies`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateVehiclePolicy: (policyId: number, payload: Partial<Omit<InsurancePolicy, "id" | "vehicle_id" | "driver_snapshot">>) =>
    apiRequest<InsurancePolicy>(`/api/insurance-policies/${policyId}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteVehiclePolicy: (policyId: number) =>
    apiRequest<{ deleted: boolean }>(`/api/insurance-policies/${policyId}`, { method: "DELETE" }),

  createVehicleMaintenance: (vehicleId: number, payload: Omit<VehicleMaintenance, "id" | "vehicle_id">) =>
    apiRequest<VehicleMaintenance>(`/api/vehicles/${vehicleId}/maintenances`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateVehicleMaintenance: (id: number, payload: Partial<Omit<VehicleMaintenance, "id" | "vehicle_id">>) =>
    apiRequest<VehicleMaintenance>(`/api/vehicle-maintenances/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteVehicleMaintenance: (id: number) =>
    apiRequest<{ deleted: boolean }>(`/api/vehicle-maintenances/${id}`, { method: "DELETE" }),

  createVehicleRepair: (vehicleId: number, payload: Omit<VehicleRepair, "id" | "vehicle_id">) =>
    apiRequest<VehicleRepair>(`/api/vehicles/${vehicleId}/repairs`, { method: "POST", body: JSON.stringify(payload) }),
  updateVehicleRepair: (id: number, payload: Partial<Omit<VehicleRepair, "id" | "vehicle_id">>) =>
    apiRequest<VehicleRepair>(`/api/vehicle-repairs/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteVehicleRepair: (id: number) =>
    apiRequest<{ deleted: boolean }>(`/api/vehicle-repairs/${id}`, { method: "DELETE" }),

  createVehicleAccident: (vehicleId: number, payload: Omit<VehicleAccident, "id" | "vehicle_id">) =>
    apiRequest<{ accident: VehicleAccident; warnings: string[] }>(`/api/vehicles/${vehicleId}/accidents`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateVehicleAccident: (id: number, payload: Partial<Omit<VehicleAccident, "id" | "vehicle_id">>) =>
    apiRequest<{ accident: VehicleAccident; warnings: string[] }>(`/api/vehicle-accidents/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteVehicleAccident: (id: number) =>
    apiRequest<{ deleted: boolean }>(`/api/vehicle-accidents/${id}`, { method: "DELETE" }),

  getUtilityBills: () => apiRequest<UtilityBill[]>("/api/utility-bills"),
  createUtilityBill: (payload: NewUtilityBill) =>
    apiRequest<UtilityBill>("/api/utility-bills", { method: "POST", body: JSON.stringify(payload) }),
  updateUtilityBill: (id: number, payload: Partial<NewUtilityBill>) =>
    apiRequest<UtilityBill>(`/api/utility-bills/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteUtilityBill: (id: number) =>
    apiRequest<{ deleted: boolean }>(`/api/utility-bills/${id}`, { method: "DELETE" }),
  getUtilityAccounts: () => apiRequest<UtilityAccount[]>("/api/utility-accounts"),
  createUtilityAccount: (payload: NewUtilityAccount) =>
    apiRequest<UtilityAccount>("/api/utility-accounts", { method: "POST", body: JSON.stringify(payload) }),
  updateUtilityAccount: (id: number, payload: Partial<NewUtilityAccount>) =>
    apiRequest<UtilityAccount>(`/api/utility-accounts/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteUtilityAccount: (id: number) =>
    apiRequest<{ deleted: boolean }>(`/api/utility-accounts/${id}`, { method: "DELETE" }),
  getUtilityBillRecipients: () => apiRequest<UtilityBillRecipient[]>("/api/utility-bills/recipients/list"),
  runUtilityBillReminders: () =>
    apiRequest<{ sent: number; reason?: string; recipients?: number }>("/api/utility-bills/reminders/run", {
      method: "POST",
    }),
  sendUtilityBillTestMessage: () =>
    apiRequest<{ sent: boolean }>("/api/utility-bills/reminders/test", { method: "POST" }),
};
