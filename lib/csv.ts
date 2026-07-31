import type { Client } from "@/types";

const CLIENT_CSV_COLUMNS = [
  "firstName",
  "lastName",
  "phone",
  "email",
  "policyType",
  "status",
  "carrier",
  "policyNumber",
] as const;

export function clientsToCsv(clients: Client[]): string {
  const rows = clients.map((client) =>
    CLIENT_CSV_COLUMNS.map((column) => escapeCsvField(String(client[column] ?? ""))).join(",")
  );

  return [CLIENT_CSV_COLUMNS.join(","), ...rows].join("\n");
}

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

export function parseClientsCsv(text: string): Omit<Client, "id">[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const header = parseCsvLine(lines[0]).map((column) => column.trim());

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const record: Record<string, string> = {};

    header.forEach((column, index) => {
      record[column] = values[index] ?? "";
    });

    return {
      firstName: record.firstName ?? "",
      lastName: record.lastName ?? "",
      phone: record.phone ?? "",
      email: record.email ?? "",
      policyType: record.policyType || "Auto",
      status: record.status || "New Lead",
      carrier: record.carrier || undefined,
      policyNumber: record.policyNumber || undefined,
    };
  });
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}
