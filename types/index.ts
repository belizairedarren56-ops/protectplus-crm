export type InsuranceType =
  | "Auto"
  | "Home"
  | "Commercial"
  | "Life"
  | "Health"
  | "Boat"
  | "Umbrella"
  | "Flood";

export type Priority = "Low" | "Medium" | "High";

export type FamilyMember = {
  id: string;
  name: string;
  relationship: string;
  dateOfBirth?: string;
};

// `id` is a string in both backends (Phase 3A): a real Supabase UUID in
// `supabase` mode, `String(Date.now())` in `demo` mode — one type regardless
// of active backend, so every clientId cross-reference below can also be a
// plain string instead of a `string | number` union.
export type Client = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  policyType: string;
  status: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  carrier?: string;
  policyNumber?: string;
  insuranceTypes?: InsuranceType[];
  createdAt?: string;
  familyMembers?: FamilyMember[];
  /** Real `profiles.id`, `supabase` mode only — the actual RLS-enforced
   * ownership column. Absent in `demo` mode (no real profiles exist). */
  assignedProducerId?: string;
  /** Denormalized display name, populated in both modes — joined from
   * `profiles.full_name` in `supabase` mode, picked from `PRODUCERS`
   * directly in `demo` mode. Every read-only consumer (tables, CSV export,
   * the Overview tab) uses this field regardless of backend. */
  assignedProducerName?: string;
  /** `supabase` mode only — the agency this record belongs to. */
  agencyId?: string;
  /** Set when archived via the Clients page; archived clients are hidden from
   * the default view but never cascade-deleted. Absent/undefined = active. */
  archivedAt?: string;
  /** True only for records created by `loadDemoData()` (`demo` mode) or
   * `createDemoBatch()` (`supabase` mode), so "Clear Demo Data" can remove
   * exactly those and never a real, user-entered record. */
  isDemo?: boolean;
};

export type LeadStage =
  | "New"
  | "Contacted"
  | "Quote Started"
  | "Quote Sent"
  | "Follow Up"
  | "Sold"
  | "Renewal"
  | "Lost";

export const LEAD_STAGES: LeadStage[] = [
  "New",
  "Contacted",
  "Quote Started",
  "Quote Sent",
  "Follow Up",
  "Sold",
  "Renewal",
  "Lost",
];

export type Lead = {
  id: number;
  /** References Client.id — a string in both backends since Phase 3A. */
  clientId?: string;
  clientName: string;
  insuranceType: InsuranceType;
  stage: LeadStage;
  producer: string;
  priority: Priority;
  lastContact: string;
  phone?: string;
  email?: string;
  isDemo?: boolean;
};

export type QuoteStatus = "Draft" | "Sent" | "Accepted" | "Declined" | "Expired";

export type Quote = {
  id: number;
  /** References Client.id — a string in both backends since Phase 3A. */
  clientId: string;
  clientName: string;
  carrier: string;
  premium: number;
  coverage: string;
  producer: string;
  insuranceType: InsuranceType;
  status: QuoteStatus;
  createdAt: string;
  isDemo?: boolean;
};

export type PolicyStatus = "Active" | "Renewal Due" | "Cancelled" | "Expired";

export type Policy = {
  id: number;
  /** References Client.id — a string in both backends since Phase 3A. */
  clientId: string;
  clientName: string;
  carrier: string;
  policyNumber: string;
  product: InsuranceType;
  effectiveDate: string;
  expirationDate: string;
  status: PolicyStatus;
  premium: number;
  producer: string;
  isDemo?: boolean;
};

export type TaskStatus = "Open" | "Complete";

export type Task = {
  id: number;
  title: string;
  description?: string;
  assignedTo: string;
  priority: Priority;
  dueDate: string;
  status: TaskStatus;
  /** References Client.id — a string in both backends since Phase 3A. */
  clientId?: string;
  clientName?: string;
  isDemo?: boolean;
};

export type DocumentFolder =
  | "Applications"
  | "Declarations"
  | "Driver Licenses"
  | "Vehicle Photos"
  | "Property Photos"
  | "Commercial Documents"
  | "Medical Documents";

export const DOCUMENT_FOLDERS: DocumentFolder[] = [
  "Applications",
  "Declarations",
  "Driver Licenses",
  "Vehicle Photos",
  "Property Photos",
  "Commercial Documents",
  "Medical Documents",
];

export type Document = {
  id: number;
  name: string;
  folder: DocumentFolder;
  /** References Client.id — a string in both backends since Phase 3A. */
  clientId?: string;
  clientName?: string;
  uploadedAt: string;
  fileType: string;
  isDemo?: boolean;
};

export type NotificationType = "renewal" | "task" | "lead" | "quote" | "policy";

export type Notification = {
  id: number;
  type: NotificationType;
  message: string;
  timestamp: string;
  read: boolean;
  isDemo?: boolean;
};
