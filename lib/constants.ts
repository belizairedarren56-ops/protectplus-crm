import type {
  InsuranceType,
  LeadStage,
  PolicyStatus,
  Priority,
  QuoteStatus,
} from "@/types";

export const INSURANCE_TYPES: InsuranceType[] = [
  "Auto",
  "Home",
  "Commercial",
  "Life",
  "Health",
  "Boat",
  "Umbrella",
  "Flood",
];

export const CARRIERS = [
  "State Farm",
  "Progressive",
  "Allstate",
  "Liberty Mutual",
  "Travelers",
  "Nationwide",
  "GEICO",
  "Foremost",
  "Citizens Property",
  "Universal Property",
  "Safepoint",
  "Chubb",
];

export const PRODUCERS = [
  "Darren Belizaire",
  "Maria Gonzalez",
  "James Whitfield",
  "Priya Patel",
  "Chris Okafor",
  "Ana Silva",
];

export const CLIENT_STATUSES = [
  "New Lead",
  "Active",
  "Prospect",
  "Inactive",
  "Lost",
];

export const INSURANCE_TYPE_ICONS: Record<InsuranceType, string> = {
  Auto: "🚗",
  Home: "🏠",
  Commercial: "🏢",
  Life: "❤️",
  Health: "🩺",
  Boat: "⛵",
  Umbrella: "☂️",
  Flood: "🌊",
};

export const STATUS_BADGE_STYLES: Record<string, string> = {
  "New Lead": "border-blue-500/40 bg-blue-500/10 text-blue-400",
  Active: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  Prospect: "border-yellow-500/40 bg-yellow-500/10 text-yellow-400",
  Inactive: "border-gray-500/40 bg-gray-500/10 text-gray-400",
  Lost: "border-red-500/40 bg-red-500/10 text-red-400",
};

export const PRIORITY_BADGE_STYLES: Record<Priority, string> = {
  Low: "border-gray-500/40 bg-gray-500/10 text-gray-400",
  Medium: "border-yellow-500/40 bg-yellow-500/10 text-yellow-400",
  High: "border-red-500/40 bg-red-500/10 text-red-400",
};

export const QUOTE_STATUS_STYLES: Record<QuoteStatus, string> = {
  Draft: "border-gray-500/40 bg-gray-500/10 text-gray-400",
  Sent: "border-blue-500/40 bg-blue-500/10 text-blue-400",
  Accepted: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  Declined: "border-red-500/40 bg-red-500/10 text-red-400",
  Expired: "border-gray-500/40 bg-gray-500/10 text-gray-500",
};

export const POLICY_STATUS_STYLES: Record<PolicyStatus, string> = {
  Active: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  "Renewal Due": "border-yellow-500/40 bg-yellow-500/10 text-yellow-400",
  Cancelled: "border-red-500/40 bg-red-500/10 text-red-400",
  Expired: "border-gray-500/40 bg-gray-500/10 text-gray-400",
};

export const LEAD_STAGE_STYLES: Record<LeadStage, string> = {
  New: "border-blue-500/40 bg-blue-500/10 text-blue-400",
  Contacted: "border-cyan-500/40 bg-cyan-500/10 text-cyan-400",
  "Quote Started": "border-yellow-500/40 bg-yellow-500/10 text-yellow-400",
  "Quote Sent": "border-amber-500/40 bg-amber-500/10 text-amber-400",
  "Follow Up": "border-orange-500/40 bg-orange-500/10 text-orange-400",
  Sold: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  Renewal: "border-purple-500/40 bg-purple-500/10 text-purple-400",
  Lost: "border-red-500/40 bg-red-500/10 text-red-400",
};

// Validated (dataviz skill, dark categorical palette) against this app's
// dark surface (#06080c) — see validate_palette.js output before use.
export const CHART_COLORS = {
  blue: "#3987e5",
  orange: "#d95926",
  aqua: "#199e70",
  yellow: "#c98500",
  magenta: "#d55181",
  green: "#008300",
  violet: "#9085e9",
  red: "#e66767",
};

// Ordinal ramp (one hue, light -> dark) for the 8 lead stages, in stage order.
export const LEAD_STAGE_ORDINAL_RAMP = [
  "#9ec5f4",
  "#6da7ec",
  "#5598e7",
  "#3987e5",
  "#2a78d6",
  "#256abf",
  "#1c5cab",
  "#184f95",
];

export const CHART_GRID_COLOR = "#2c2c2a";
export const CHART_AXIS_COLOR = "#898781";
export const CHART_SURFACE_COLOR = "#0b0d12";

export const DOCUMENT_FOLDER_ICONS: Record<string, string> = {
  Applications: "📝",
  Declarations: "📄",
  "Driver Licenses": "🪪",
  "Vehicle Photos": "🚙",
  "Property Photos": "🏡",
  "Commercial Documents": "💼",
  "Medical Documents": "🏥",
};
