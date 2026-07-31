"use client";

import { SearchInput } from "@/components/ui/SearchInput";
import { CLIENT_STATUSES, INSURANCE_TYPES } from "@/lib/constants";

export type ClientSortKey = "newest" | "name" | "status";

type ClientFiltersProps = {
  search: string;
  onSearchChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  insuranceType: string;
  onInsuranceTypeChange: (value: string) => void;
  sortKey: ClientSortKey;
  onSortKeyChange: (value: ClientSortKey) => void;
};

const SELECT_CLASSES =
  "rounded-xl border border-gray-700 bg-black px-4 py-3 text-white outline-none focus:border-yellow-500";

export function ClientFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
  insuranceType,
  onInsuranceTypeChange,
  sortKey,
  onSortKeyChange,
}: ClientFiltersProps) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
      <SearchInput
        wrapperClassName="flex-1"
        placeholder="Search by name, phone, email, policy #, or carrier..."
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
      />

      <select
        value={status}
        onChange={(event) => onStatusChange(event.target.value)}
        className={SELECT_CLASSES}
      >
        <option value="">All Statuses</option>
        {CLIENT_STATUSES.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>

      <select
        value={insuranceType}
        onChange={(event) => onInsuranceTypeChange(event.target.value)}
        className={SELECT_CLASSES}
      >
        <option value="">All Insurance Types</option>
        {INSURANCE_TYPES.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>

      <select
        value={sortKey}
        onChange={(event) => onSortKeyChange(event.target.value as ClientSortKey)}
        className={SELECT_CLASSES}
      >
        <option value="newest">Sort: Newest</option>
        <option value="name">Sort: Name A–Z</option>
        <option value="status">Sort: Status</option>
      </select>
    </div>
  );
}
