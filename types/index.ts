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

// The original app shape kept intact (id, firstName, lastName, phone, email,
// policyType, status) so existing localStorage data keeps working. Everything
// else is optional and backfilled by the seeder / new UI.
export type Client = {
  id: number;
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
  clientId?: number;
  clientName: string;
  insuranceType: InsuranceType;
  stage: LeadStage;
  producer: string;
  priority: Priority;
  lastContact: string;
  phone?: string;
  email?: string;
};

export type QuoteStatus = "Draft" | "Sent" | "Accepted" | "Declined" | "Expired";

export type Quote = {
  id: number;
  clientId?: number;
  clientName: string;
  carrier: string;
  premium: number;
  coverage: string;
  producer: string;
  insuranceType: InsuranceType;
  status: QuoteStatus;
  createdAt: string;
};

export type PolicyStatus = "Active" | "Renewal Due" | "Cancelled" | "Expired";

export type Policy = {
  id: number;
  clientId?: number;
  clientName: string;
  carrier: string;
  policyNumber: string;
  product: InsuranceType;
  effectiveDate: string;
  expirationDate: string;
  status: PolicyStatus;
  premium: number;
  producer: string;
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
  clientId?: number;
  clientName?: string;
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
  clientId?: number;
  clientName?: string;
  uploadedAt: string;
  fileType: string;
};

export type NotificationType = "renewal" | "task" | "lead" | "quote" | "policy";

export type Notification = {
  id: number;
  type: NotificationType;
  message: string;
  timestamp: string;
  read: boolean;
};
