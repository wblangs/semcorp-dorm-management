import { apiRequest } from "./client";
import type {
  Allocation,
  AvailableRoom,
  AuthResponse,
  DashboardData,
  DictionaryState,
  Dorm,
  Person,
  Room,
  RoomItem,
  StayRecord,
  StayRiskPayload,
  SystemInfo,
  User,
  Vehicle,
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
type NewVehicle = Omit<Vehicle, "id">;

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
    },
  ) => apiRequest<User>(`/api/users/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
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
  createVehicle: (payload: NewVehicle) =>
    apiRequest<Vehicle>("/api/vehicles", { method: "POST", body: JSON.stringify(payload) }),
  updateVehicle: (id: number, payload: NewVehicle) =>
    apiRequest<Vehicle>(`/api/vehicles/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteVehicle: (id: number) => apiRequest<{ deleted: boolean }>(`/api/vehicles/${id}`, { method: "DELETE" }),
};
