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
  riskUnknown: number;
  leaseExpiring30: number;
  leaseExpiring60: number;
  availableVehicles: number;
  stayRiskSummary: {
    red: number;
    yellow: number;
    green: number;
    unknown: number;
  };
  stayExpiring30: StayRecord[];
  stayExpiring60: StayRecord[];
  stayOverstayed: StayRecord[];
};

export type StayPerson = {
  id: number;
  chinese_name: string;
  english_name: string;
  department: string;
  person_type: string;
  gender: "Male" | "Female";
};

export type StayRecord = {
  id: number | null;
  person_id: number;
  person: StayPerson;
  visa_type: string | null;
  arrival_date: string | null;
  planned_leave_date: string | null;
  max_stay_date: string | null;
  actual_leave_date: string | null;
  note: string | null;
  days_in_us: number | null;
  remaining_planned_days: number | null;
  remaining_legal_days: number | null;
  risk_level: "red" | "yellow" | "green" | "unknown";
};

export type StayRiskPayload = {
  riskSummary: {
    red: number;
    yellow: number;
    green: number;
    unknown: number;
  };
  expiring30: StayRecord[];
  expiring60: StayRecord[];
  overstayed: StayRecord[];
};
