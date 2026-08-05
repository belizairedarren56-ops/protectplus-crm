import { CARRIERS, CLIENT_STATUSES, INSURANCE_TYPES, PRODUCERS } from "@/lib/constants";
import type { NewDocumentInput } from "@/lib/repositories/documentsRepository";
import type { NewFamilyMemberInput } from "@/lib/repositories/familyMembersRepository";
import type { NewTaskInput } from "@/lib/repositories/tasksRepository";
import { LEAD_STAGES, DOCUMENT_FOLDERS } from "@/types";
import type {
  Client,
  InsuranceType,
  Lead,
  Notification,
  Policy,
  PolicyStatus,
  Priority,
  Quote,
  QuoteStatus,
} from "@/types";

// Pure generator functions only — nothing in this file touches localStorage,
// a repository, or any hook's state. `hooks/useDemoData.ts` is the only
// thing allowed to call these and feed the results into the real entity
// hooks/repositories, so demo data flows through the same path as any other
// mutation.
//
// Split into two stages (client drafts, then everything else given the
// RESOLVED clients): in `supabase` mode, client UUIDs aren't known until
// Postgres assigns them via clientsRepository.createDemoBatch(), so the
// other six entities' generators can't predict ids up front the way a
// single combined pass could when everything lived in one localStorage
// array.

function mulberry32(seed: number) {
  let state = seed;
  return function random() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;

function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

function pickMany<T>(rng: Rng, items: readonly T[], count: number): T[] {
  const pool = [...items];
  const result: T[] = [];
  const total = Math.min(count, pool.length);

  for (let i = 0; i < total; i++) {
    const index = Math.floor(rng() * pool.length);
    result.push(pool[index]);
    pool.splice(index, 1);
  }

  return result;
}

function randomInt(rng: Rng, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function isoDaysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

const FIRST_NAMES = [
  "James", "Maria", "Robert", "Linda", "Michael", "Patricia", "David", "Jennifer",
  "Carlos", "Sofia", "Daniel", "Ashley", "Kevin", "Michelle", "Brian", "Amanda",
  "Marcus", "Jessica", "Anthony", "Nicole", "Luis", "Gabriela", "Steven", "Rachel",
  "Andre", "Vanessa", "Eric", "Stephanie", "Jorge", "Melissa", "Tyler", "Courtney",
  "Malik", "Priya", "Wei", "Fatima", "Sean", "Diana", "Victor", "Elena",
];

const LAST_NAMES = [
  "Rodriguez", "Smith", "Johnson", "Martinez", "Williams", "Brown", "Garcia", "Davis",
  "Hernandez", "Lopez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson",
  "Perez", "Thompson", "White", "Sanchez", "Ramirez", "Clark", "Lewis", "Robinson",
  "Walker", "Young", "Allen", "King", "Wright", "Torres", "Nguyen", "Diaz",
  "Patel", "Cruz", "Reyes", "Morgan", "Bell", "Murphy", "Bailey", "Rivera",
];

const CITIES: { city: string; state: string }[] = [
  { city: "Fort Lauderdale", state: "FL" },
  { city: "Miami", state: "FL" },
  { city: "Boca Raton", state: "FL" },
  { city: "Hollywood", state: "FL" },
  { city: "Pembroke Pines", state: "FL" },
  { city: "Coral Springs", state: "FL" },
  { city: "West Palm Beach", state: "FL" },
  { city: "Davie", state: "FL" },
  { city: "Plantation", state: "FL" },
  { city: "Weston", state: "FL" },
];

const EMAIL_DOMAINS = ["gmail.com", "yahoo.com", "outlook.com", "icloud.com"];

const TASK_TITLES = [
  "Follow up on renewal quote",
  "Send signed application to carrier",
  "Collect declarations page",
  "Verify VIN for auto policy",
  "Schedule home inspection",
  "Call client about lapsed payment",
  "Review umbrella coverage options",
  "Confirm mortgagee clause on home policy",
  "Send birthday greeting",
  "Prepare renewal comparison",
  "Follow up on outstanding quote",
  "Update client contact information",
  "Request loss history report",
  "Discuss bundling discount",
  "Confirm flood zone determination",
];

function randomPhone(rng: Rng): string {
  return `954-555-${String(randomInt(rng, 1000, 9999)).padStart(4, "0")}`;
}

function randomPolicyNumber(rng: Rng, carrier: string): string {
  const prefix = carrier
    .split(" ")
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();
  return `${prefix}-${randomInt(rng, 1000000, 9999999)}`;
}

function coverageForType(insuranceType: InsuranceType): string {
  switch (insuranceType) {
    case "Auto":
      return "100/300/100 liability, $500 deductible";
    case "Home":
      return "$350k dwelling / $100k liability";
    case "Commercial":
      return "$1M general liability";
    case "Life":
      return "$250k term, 20-year";
    case "Health":
      return "Silver PPO, $2,500 deductible";
    case "Boat":
      return "$50k hull / $300k liability";
    case "Umbrella":
      return "$1M excess liability";
    case "Flood":
      return "$250k building / $100k contents";
  }
}

function premiumForType(rng: Rng, insuranceType: InsuranceType): number {
  const ranges: Record<InsuranceType, [number, number]> = {
    Auto: [900, 2600],
    Home: [1200, 4200],
    Commercial: [2500, 12000],
    Life: [400, 1800],
    Health: [3000, 9000],
    Boat: [500, 1800],
    Umbrella: [250, 700],
    Flood: [600, 2200],
  };
  const [min, max] = ranges[insuranceType];
  return randomInt(rng, min, max);
}

// A generated client, not yet assigned an id — the caller (demo/localStorage
// backend or the Supabase repository) is responsible for that, since only it
// knows how ids are actually minted for the active backend.
export type DemoClientDraft = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  policyType: string;
  status: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  carrier: string;
  policyNumber: string;
  insuranceTypes: InsuranceType[];
  createdAt: string;
  /** demo-mode display only — the Supabase repository ignores this. */
  assignedProducerName: string;
  isDemo: true;
};

function generateClientDraft(rng: Rng): DemoClientDraft {
  const firstName = pick(rng, FIRST_NAMES);
  const lastName = pick(rng, LAST_NAMES);
  const location = pick(rng, CITIES);
  const insuranceTypes = pickMany(rng, INSURANCE_TYPES, randomInt(rng, 1, 3));
  const carrier = pick(rng, CARRIERS);

  return {
    firstName,
    lastName,
    phone: randomPhone(rng),
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${pick(rng, EMAIL_DOMAINS)}`,
    policyType: insuranceTypes[0],
    status: pick(rng, CLIENT_STATUSES),
    address: `${randomInt(rng, 100, 9999)} ${pick(rng, LAST_NAMES)} St`,
    city: location.city,
    state: location.state,
    zip: String(randomInt(rng, 33000, 33999)),
    carrier,
    policyNumber: randomPolicyNumber(rng, carrier),
    insuranceTypes,
    createdAt: isoDaysFromNow(-randomInt(rng, 5, 700)),
    assignedProducerName: pick(rng, PRODUCERS),
    isDemo: true,
  };
}

/** Stage 1: generate client drafts only — no ids, no cross-references. */
export function generateDemoClientDrafts(count = 50): DemoClientDraft[] {
  const rng = mulberry32(20260730);
  return Array.from({ length: count }, () => generateClientDraft(rng));
}

function policyStatusFor(rng: Rng, expirationIso: string): PolicyStatus {
  const daysToExpiration = Math.round(
    (new Date(expirationIso).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  if (rng() < 0.06) return "Cancelled";
  if (daysToExpiration < 0) return "Expired";
  if (daysToExpiration <= 45) return "Renewal Due";
  return "Active";
}

export type DemoDataSet = {
  policies: Policy[];
  leads: Lead[];
  quotes: Quote[];
  /** No numeric id of its own — tasks is Supabase/repository-backed from
   * Phase 3B on (see tasksRepository.ts), so the caller (useDemoData)
   * creates each one through the real repository. */
  tasks: NewTaskInput[];
  /** No numeric id of its own — documents is Supabase/repository-backed
   * from Phase 3B on (see documentsRepository.ts), so the caller
   * (useDemoData) creates each one through the real repository. */
  documents: NewDocumentInput[];
  notifications: Notification[];
  /** No numeric id of its own yet — family_members is Supabase/repository-
   * backed from day one this phase (see familyMembersRepository.ts), so the
   * caller (useDemoData) creates each one through the real repository,
   * exactly like resolving client ids through createDemoBatch(). */
  familyMembers: NewFamilyMemberInput[];
};

/**
 * Stage 2: generate the six still-local entities against a RESOLVED clients
 * array — real ids already assigned, whether by `demoClientsRepository`
 * (`String(Date.now())`-based) or by Postgres (real UUIDs, after
 * `clientsRepository.createDemoBatch()` returns). `startId` seeds these
 * entities' own numeric ids (unaffected by the client id-format change).
 * `familyMembers` moved here from `generateClientDraft()` for the same
 * reason: it needs a resolved `clientId` to reference, which doesn't exist
 * until stage 1's client drafts have actually been created.
 */
export function generateDemoDataForClients(startId: number, clients: Client[]): DemoDataSet {
  const rng = mulberry32(20260731);
  let nextId = startId;

  if (clients.length === 0) {
    return { policies: [], leads: [], quotes: [], tasks: [], documents: [], notifications: [], familyMembers: [] };
  }

  const policies: Policy[] = Array.from({ length: 25 }, (_, index) => {
    const client = pick(rng, clients);
    const product = pick(rng, INSURANCE_TYPES);
    const carrier = pick(rng, CARRIERS);
    const effectiveDate = isoDaysFromNow(-randomInt(rng, 30, 360));
    const expirationDate = isoDaysFromNow(randomInt(rng, -60, 300));

    return {
      id: nextId + index,
      clientId: client.id,
      clientName: `${client.firstName} ${client.lastName}`,
      carrier,
      policyNumber: randomPolicyNumber(rng, carrier),
      product,
      effectiveDate,
      expirationDate,
      status: policyStatusFor(rng, expirationDate),
      premium: premiumForType(rng, product),
      producer: pick(rng, PRODUCERS),
      isDemo: true,
    };
  });
  nextId += policies.length;

  const leads: Lead[] = Array.from({ length: 20 }, (_, index) => {
    const client = rng() > 0.4 ? pick(rng, clients) : null;
    const firstName = client?.firstName ?? pick(rng, FIRST_NAMES);
    const lastName = client?.lastName ?? pick(rng, LAST_NAMES);

    return {
      id: nextId + index,
      clientId: client?.id,
      clientName: `${firstName} ${lastName}`,
      insuranceType: pick(rng, INSURANCE_TYPES),
      stage: pick(rng, LEAD_STAGES),
      producer: pick(rng, PRODUCERS),
      priority: pick(rng, ["Low", "Medium", "High"] satisfies Priority[]),
      lastContact: isoDaysFromNow(-randomInt(rng, 0, 30)),
      phone: randomPhone(rng),
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${pick(rng, EMAIL_DOMAINS)}`,
      isDemo: true,
    };
  });
  nextId += leads.length;

  const quotes: Quote[] = Array.from({ length: 15 }, (_, index) => {
    const client = pick(rng, clients);
    const insuranceType = pick(rng, INSURANCE_TYPES);

    return {
      id: nextId + index,
      clientId: client.id,
      clientName: `${client.firstName} ${client.lastName}`,
      carrier: pick(rng, CARRIERS),
      premium: premiumForType(rng, insuranceType),
      coverage: coverageForType(insuranceType),
      producer: pick(rng, PRODUCERS),
      insuranceType,
      status: pick(rng, [
        "Draft",
        "Sent",
        "Accepted",
        "Declined",
        "Expired",
      ] satisfies QuoteStatus[]),
      createdAt: isoDaysFromNow(-randomInt(rng, 0, 60)),
      isDemo: true,
    };
  });
  nextId += quotes.length;

  const tasks: NewTaskInput[] = Array.from({ length: 30 }, () => {
    const client = rng() > 0.3 ? pick(rng, clients) : null;
    const dueDate = isoDaysFromNow(randomInt(rng, -10, 30));
    const status = rng() > 0.65 ? "Complete" : "Open";

    return {
      title: pick(rng, TASK_TITLES),
      assignedToName: pick(rng, PRODUCERS),
      priority: pick(rng, ["Low", "Medium", "High"] satisfies Priority[]),
      dueDate,
      status,
      clientId: client?.id,
      clientName: client ? `${client.firstName} ${client.lastName}` : undefined,
      isDemo: true,
    };
  });
  nextId += tasks.length;

  const documents: NewDocumentInput[] = [];
  const fileTypeByFolder: Record<string, string> = {
    Applications: "pdf",
    Declarations: "pdf",
    "Driver Licenses": "jpg",
    "Vehicle Photos": "jpg",
    "Property Photos": "jpg",
    "Commercial Documents": "pdf",
    "Medical Documents": "pdf",
  };
  for (const folder of DOCUMENT_FOLDERS) {
    const count = randomInt(rng, 2, 4);

    for (let i = 0; i < count; i++) {
      const client = pick(rng, clients);
      const fileType = fileTypeByFolder[folder];

      documents.push({
        name: `${client.lastName}_${folder.replace(/\s+/g, "")}_${i + 1}.${fileType}`,
        folder,
        clientId: client.id,
        clientName: `${client.firstName} ${client.lastName}`,
        fileType,
        isDemo: true,
      });
    }
  }
  nextId += documents.length;

  const sampleClient = pick(rng, clients);
  const notifications: Notification[] = [
    {
      id: nextId,
      type: "renewal",
      message: `${sampleClient.firstName} ${sampleClient.lastName}'s policy renews in 12 days.`,
      timestamp: isoDaysFromNow(-1),
      read: false,
      isDemo: true,
    },
    {
      id: nextId + 1,
      type: "task",
      message: `New task assigned: "${pick(rng, TASK_TITLES)}"`,
      timestamp: isoDaysFromNow(-1),
      read: false,
      isDemo: true,
    },
    {
      id: nextId + 2,
      type: "lead",
      message: "New lead received from the website contact form.",
      timestamp: isoDaysFromNow(-2),
      read: true,
      isDemo: true,
    },
    {
      id: nextId + 3,
      type: "quote",
      message: `${pick(rng, clients).firstName} accepted their auto quote.`,
      timestamp: isoDaysFromNow(-3),
      read: true,
      isDemo: true,
    },
    {
      id: nextId + 4,
      type: "policy",
      message: `A policy for ${pick(rng, clients).lastName} was cancelled.`,
      timestamp: isoDaysFromNow(-4),
      read: true,
      isDemo: true,
    },
  ];

  // Roughly half of clients get 1-2 family members — same odds
  // generateClientDraft() used to apply before this generation step moved
  // here to reference a resolved clientId.
  const familyMembers: NewFamilyMemberInput[] = clients.flatMap((client) =>
    rng() > 0.5
      ? pickMany(rng, FIRST_NAMES, randomInt(rng, 1, 2)).map((name) => ({
          clientId: client.id,
          name: `${name} ${client.lastName}`,
          relationship: pick(rng, ["Spouse", "Child", "Parent"]),
        }))
      : []
  );

  return { policies, leads, quotes, tasks, documents, notifications, familyMembers };
}
