import { apiRequest } from "./client";
import type {
  Allocation,
  AvailableRoom,
  DashboardData,
  DictionaryState,
  Dorm,
  Person,
  Room,
  StayRecord,
  StayRiskPayload,
} from "../types";

type NewDorm = Omit<Dorm, "id">;
type NewRoom = Omit<Room, "id">;
type NewPerson = Omit<Person, "id">;

export const api = {
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
  createRoom: (payload: NewRoom) =>
    apiRequest<Room>("/api/rooms", { method: "POST", body: JSON.stringify(payload) }),
  updateRoom: (id: number, payload: NewRoom) =>
    apiRequest<Room>(`/api/rooms/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteRoom: (id: number) => apiRequest<{ deleted: boolean }>(`/api/rooms/${id}`, { method: "DELETE" }),

  getPeople: () => apiRequest<Person[]>("/api/people"),
  createPerson: (payload: NewPerson) =>
    apiRequest<Person>("/api/people", { method: "POST", body: JSON.stringify(payload) }),
  updatePerson: (id: number, payload: NewPerson) =>
    apiRequest<Person>(`/api/people/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deletePerson: (id: number) => apiRequest<{ deleted: boolean }>(`/api/people/${id}`, { method: "DELETE" }),

  getAllocations: () => apiRequest<Allocation[]>("/api/allocations"),
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
};
