import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import DocumentsPage from "@/app/documents/page";
import { renderWithProviders as render } from "@/test-utils/renderWithProviders";
import { __resetMigrationStateForTests } from "@/lib/localDataMigrations";
import { STORAGE_KEYS } from "@/lib/storage";
import type { Document } from "@/types";

const ENV_KEY = "NEXT_PUBLIC_ENABLE_SENSITIVE_DOCUMENT_FOLDERS";

const documents: Document[] = [
  {
    id: 1,
    name: "license.jpg",
    folder: "Driver Licenses",
    uploadedAt: new Date().toISOString(),
    fileType: "jpg",
  },
  {
    id: 2,
    name: "medical-form.pdf",
    folder: "Medical Documents",
    uploadedAt: new Date().toISOString(),
    fileType: "pdf",
  },
  {
    id: 3,
    name: "application.pdf",
    folder: "Applications",
    uploadedAt: new Date().toISOString(),
    fileType: "pdf",
  },
];

describe("Documents page — sensitive folder flag", () => {
  beforeEach(() => {
    window.localStorage.clear();
    __resetMigrationStateForTests();
    window.localStorage.setItem(STORAGE_KEYS.documents, JSON.stringify(documents));
  });

  afterEach(() => {
    delete process.env[ENV_KEY];
  });

  it("hides Driver Licenses and Medical Documents folder cards by default", async () => {
    delete process.env[ENV_KEY];
    render(<DocumentsPage />);

    expect((await screen.findAllByText("Applications")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Driver Licenses")).not.toBeInTheDocument();
    expect(screen.queryByText("Medical Documents")).not.toBeInTheDocument();
  });

  it("excludes hidden-folder documents from the 'All Documents' count and table", async () => {
    delete process.env[ENV_KEY];
    render(<DocumentsPage />);

    // Only the one non-sensitive document should be counted/visible, even
    // though three exist in storage.
    expect(await screen.findByText("application.pdf")).toBeInTheDocument();
    expect(screen.queryByText("license.jpg")).not.toBeInTheDocument();
    expect(screen.queryByText("medical-form.pdf")).not.toBeInTheDocument();
    // Both the "All Documents" card and the "Applications" folder card
    // should agree there's exactly one accessible document.
    expect(screen.getAllByText("1 files")).toHaveLength(2);
  });

  it("shows the sensitive folders once explicitly enabled", async () => {
    process.env[ENV_KEY] = "true";
    render(<DocumentsPage />);

    // Matches both the folder card and, now that sensitive documents are no
    // longer filtered out of the table, the document row's folder column.
    expect((await screen.findAllByText("Driver Licenses")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Medical Documents").length).toBeGreaterThan(0);
  });

  it("includes hidden-folder documents in 'All Documents' once explicitly enabled", async () => {
    process.env[ENV_KEY] = "true";
    render(<DocumentsPage />);

    expect(await screen.findByText("license.jpg")).toBeInTheDocument();
    expect(screen.getByText("medical-form.pdf")).toBeInTheDocument();
    expect(screen.getByText("application.pdf")).toBeInTheDocument();
    // The "All Documents" card should report all three, not just the
    // non-sensitive one.
    expect(screen.getByText("3 files")).toBeInTheDocument();
  });
});
