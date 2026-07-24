export type Dorm = {
  id: number;
  name: string;
  type: string;
  address: string;
  lease_start_date: string | null;
  lease_end_date: string | null;
  status: string;
};

export type RenewalNeededDorm = {
  id: number;
  name: string;
  address: string | null;
  type: string | null;
  status: string | null;
  lease_start_date: string | null;
  lease_end_date: string | null;
  days_left: number;
};

export type Room = {
  id: number;
  dorm_id: number;
  room_name: string;
  room_type: string;
  bed_count: number;
  gender_limit: "Male" | "Female" | "Any";
  status: string;
  bed_size: string | null;
  light_type: string | null;
  light_count: number;
  nightstand_count: number;
  trash_can_count: number;
};

export type RoomItem = {
  id: number;
  room_id: number;
  name: string;
  item_type: string | null;
  count: number;
};

export type Person = {
  id: number;
  chinese_name: string;
  english_name: string | null;
  department: string;
  person_type: string;
  gender: "Male" | "Female";
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
  temp_leave_start: string | null;
  temp_leave_end: string | null;
  status: "active" | "checked_out";
  hidden_from_user_history: boolean;
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
  leaseExpiring90: number;
  renewalNeededDorms: RenewalNeededDorm[];
  availableVehicles: number;
  maintenanceVehicles: number;
  disabledVehicles: number;
  vehicleInsuranceExpiring30: number;
  vehicleInspectionExpiring30: number;
  vehicleMaintenanceDue30: number;
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

export type Vehicle = {
  id: number;
  plate_number: string;
  seat_count: number;
  vehicle_type: string | null;
  base_dorm_id: number | null;
  insurance_expire_date: string | null;
  inspection_expire_date: string | null;
  maintenance_due_date: string | null;
  note: string | null;
  status: string;
};

export type UtilityBill = {
  id: number;
  dorm_id: number;
  fee_type: string;
  due_date: string;
  account: string | null;
  amount: number | null;
  note: string | null;
  status: "pending" | "paid";
  remind_enabled: boolean;
  reminded_on: string | null;
};

export type UtilityAccount = {
  id: number;
  dorm_id: number;
  fee_type: string;
  provider: string | null;
  account_number: string;
  login_username: string | null;
  login_password: string | null;
  website: string | null;
  note: string | null;
};

export type UtilityBillRecipient = {
  user_id: number;
  username: string;
  display_name: string | null;
  has_dingtalk: boolean;
};

export type StayPerson = {
  id: number;
  chinese_name: string;
  english_name: string | null;
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

export type DictionaryOption = {
  label: string;
  value: string;
  sort_order?: number;
};

export type DictionaryState = Record<string, DictionaryOption[]>;

export type User = {
  id: number;
  username: string;
  display_name: string | null;
  role: "admin" | "user" | "viewer";
  status: "active" | "disabled";
  last_login_at: string | null;
  dingtalk_userid: string | null;
  receive_bill_reminders: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type AuthResponse = {
  token: string;
  user: User;
};

export type SystemInfo = {
  version: string;
  database: string;
  environment: string;
  current_user: User;
};
