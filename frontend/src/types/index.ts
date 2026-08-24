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
  vehiclesInRepair: number;
  disabledVehicles: number;
  vehicleInsuranceExpiring30: number;
  vehicleInspectionExpiring30: number;
  vehicleRegistrationExpiring30: number;
  vehicleMaintenanceDue30: number;
  vehicleLeaseExpiring60: number;
  uninsuredVehicles: number;
  vehiclesWithoutDrivers: number;
  driverLicenseExpiring30: number;
  openClaims: number;
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

export type VehicleStatus = "available" | "in_repair" | "disabled" | "disposed";

export type PersonLicense = {
  person_id: number;
  license_number: string | null;
  license_state: string | null;
  license_class: string | null;
  issue_date: string | null;
  expire_date: string | null;
  note: string | null;
};

export type VehicleDriver = {
  id: number;
  vehicle_id: number;
  person_id: number;
  role: "primary" | "secondary";
  start_date: string | null;
  end_date: string | null;
  status: "active" | "removed";
  note: string | null;
  person: {
    id: number;
    chinese_name: string;
    english_name: string | null;
    department: string;
    person_type: string;
  } | null;
  license: PersonLicense | null;
};

export type Vehicle = {
  id: number;
  plate_number: string;
  vin: string | null;
  make: string | null;
  model: string | null;
  model_year: number | null;
  color: string | null;
  seat_count: number;
  vehicle_type: string | null;
  ownership_type: "owned" | "leased";
  purchase_date: string | null;
  purchase_price: number | null;
  lease_company: string | null;
  lease_start_date: string | null;
  lease_end_date: string | null;
  lease_monthly_fee: number | null;
  base_dorm_id: number | null;
  insurance_expire_date: string | null;
  inspection_expire_date: string | null;
  registration_expire_date: string | null;
  maintenance_due_date: string | null;
  maintenance_due_mileage: number | null;
  odometer: number | null;
  odometer_updated_on: string | null;
  maintenance_interval_miles: number | null;
  maintenance_interval_months: number | null;
  note: string | null;
  status: VehicleStatus;
  drivers?: VehicleDriver[];
};

export type InsurancePolicy = {
  id: number;
  vehicle_id: number;
  insurer: string;
  policy_number: string | null;
  coverage_type: string | null;
  coverage_amount: number | null;
  deductible: number | null;
  premium: number | null;
  premium_cycle: string | null;
  start_date: string;
  end_date: string;
  driver_snapshot: string | null;
  status: "active" | "expired" | "cancelled";
  attachment_note: string | null;
  note: string | null;
};

export type VehicleMaintenance = {
  id: number;
  vehicle_id: number;
  maintenance_date: string;
  odometer: number | null;
  items: string | null;
  vendor: string | null;
  cost: number | null;
  invoice_no: string | null;
  next_due_date: string | null;
  next_due_mileage: number | null;
  note: string | null;
};

export type VehicleRepair = {
  id: number;
  vehicle_id: number;
  accident_id: number | null;
  reported_date: string;
  repair_start_date: string | null;
  repair_end_date: string | null;
  fault_description: string | null;
  repair_content: string | null;
  vendor: string | null;
  cost: number | null;
  paid_by: "company" | "insurance" | "driver" | null;
  affects_availability: boolean;
  status: "reported" | "in_repair" | "done" | "cancelled";
  note: string | null;
};

export type VehicleAccident = {
  id: number;
  vehicle_id: number;
  accident_datetime: string;
  location: string | null;
  driver_person_id: number | null;
  driver_name_text: string | null;
  accident_type: string | null;
  liability: string | null;
  description: string | null;
  has_injury: boolean;
  injury_note: string | null;
  police_report_no: string | null;
  third_party_info: string | null;
  estimated_loss: number | null;
  policy_id: number | null;
  claim_no: string | null;
  claim_status: "not_filed" | "filed" | "surveying" | "approved" | "paid" | "rejected" | "closed";
  claim_amount: number | null;
  settled_amount: number | null;
  deductible_paid: number | null;
  claim_filed_date: string | null;
  claim_closed_date: string | null;
  note: string | null;
};

export type VehicleAssignment = {
  id: number;
  vehicle_id: number;
  dorm_id: number;
  start_date: string;
  end_date: string | null;
  status: "active" | "ended";
  note: string | null;
};

export type VehicleDetail = {
  vehicle: Vehicle & { effective_interval_miles: number; effective_interval_months: number };
  drivers: VehicleDriver[];
  driver_history: VehicleDriver[];
  driver_warnings: string[];
  policies: InsurancePolicy[];
  maintenances: VehicleMaintenance[];
  repairs: VehicleRepair[];
  accidents: VehicleAccident[];
  assignments: VehicleAssignment[];
};

export type VehicleAlertItem = {
  vehicle_id: number;
  plate_number: string;
  vehicle_label: string | null;
  dorm_id: number | null;
  dorm_name: string | null;
  kind: string;
  kind_label: string;
  due_date: string | null;
  days_left: number | null;
  extra: string | null;
  days_open?: number;
};

export type VehicleAlertsPayload = {
  missing: VehicleAlertItem[];
  overdue: VehicleAlertItem[];
  within7: VehicleAlertItem[];
  within30: VehicleAlertItem[];
  claimStalled: VehicleAlertItem[];
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
  receive_vehicle_reminders: boolean;
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
