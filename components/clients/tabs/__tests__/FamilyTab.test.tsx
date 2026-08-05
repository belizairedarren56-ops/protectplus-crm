import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FamilyTab } from "@/components/clients/tabs/FamilyTab";
import type { FamilyMember } from "@/types";

describe("FamilyTab", () => {
  it("shows an empty state when there are no family members", () => {
    render(<FamilyTab familyMembers={[]} />);
    expect(screen.getByText("No family members on file")).toBeInTheDocument();
  });

  it("renders each family member passed in via props", () => {
    const members: FamilyMember[] = [
      { id: "1", clientId: "client-1", name: "Jane Doe", relationship: "Spouse" },
      { id: "2", clientId: "client-1", name: "Jack Doe", relationship: "Child" },
    ];
    render(<FamilyTab familyMembers={members} />);

    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("Spouse")).toBeInTheDocument();
    expect(screen.getByText("Jack Doe")).toBeInTheDocument();
    expect(screen.getByText("Child")).toBeInTheDocument();
  });
});
