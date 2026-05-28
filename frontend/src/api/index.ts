import { apiRequest } from "./client";
import type { Allocation, AvailableRoom, DashboardData, Dorm, Person, Room } from "../types";

type NewDorm = Omit<Dorm, "id">;
type NewRoom = Omit<Room, "id">;
type NewPerson = Omit<Person, "id">;

export const api = {
  getDashboard: () => apiRequest<DashboardData>("/api/dashboard"),

  getDorms: () => apiRequest<Dorm[]>("/api/dorms"),
  createDorm: (payload: NewDorm) =>
    apiRequest<Dorm>("/api/dorms", { method: "POST", body: JSON.stringify(payload) }),

  getRooms: () => apiRequest<Room[]>("/api/rooms"),
  createRoom: (payload: NewRoom) =>
    apiRequest<Room>("/api/rooms", { method: "POST", body: JSON.stringify(payload) }),

  getPeople: () => apiRequest<Person[]>("/api/people"),
  createPerson: (payload: NewPerson) =>
    apiRequest<Person>("/api/people", { method: "POST", body: JSON.stringify(payload) }),

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
  checkoutAllocation: (id: number, check_out_date: string) =>
    apiRequest<Allocation>(`/api/allocations/${id}/checkout`, {
      method: "POST",
      body: JSON.stringify({ check_out_date }),
    }),
  getAvailableRooms: (dorm_id: number, person_id: number) =>
    apiRequest<AvailableRoom[]>(`/api/rooms/available?dorm_id=${dorm_id}&person_id=${person_id}`),
};
