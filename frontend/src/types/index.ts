export type Dorm = {
  id: number;
  name: string;
  type: string;
  address: string;
  lease_start_date: string | null;
  lease_end_date: string | null;
  status: string;
};

export type Room = {
  id: number;
  dorm_id: number;
  room_name: string;
  room_type: string;
  bed_count: number;
  gender_limit: "Male" | "Female" | "Any";
  status: string;
};

export type Person = {
  id: number;
  chinese_name: string;
  english_name: string;
  department: string;
  person_type: string;
  gender: "Male" | "Female";
  can_drive: boolean;
  can_be_driver: boolean;
};

export type Allocation = {
  id: number;
  person_id: number;
  dorm_id: number;
  room_id: number;
  check_in_date: string;
  expected_check_out_date: string | null;
  actual_check_out_date: string | null;
  note: string | null;
  check_out_date: string | null;
  status: "active" | "checked_out";
};

export type AvailableRoom = {
  id: number;
  dorm_id: number;
  room_name: string;
  room_type: string;
  bed_count: number;
  gender_limit: "Male" | "Female" | "Any";
  status: string;
  active_occupancy: number;
  available_beds: number;
};

export type DashboardData = {
  dormTotal: number;
  roomTotal: number;
  bedTotal: number;
  currentOccupancy: number;
  emptyBeds: number;
  occupancyRate: number;
  riskPeople: number;
  riskRed: number;
  riskYellow: number;
  riskGreen: number;
  leaseExpiring30: number;
  leaseExpiring60: number;
  availableVehicles: number;
};
