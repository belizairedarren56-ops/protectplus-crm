import { afterEach, describe, expect, it } from "vitest";
import { isSensitiveDocumentFolder, sensitiveDocumentFoldersEnabled, visibleDocumentFolders } from "@/lib/config";

const ENV_KEY = "NEXT_PUBLIC_ENABLE_SENSITIVE_DOCUMENT_FOLDERS";

describe("sensitive document folder flag", () => {
  afterEach(() => {
    delete process.env[ENV_KEY];
  });

  it("is disabled by default (unset env var)", () => {
    delete process.env[ENV_KEY];
    expect(sensitiveDocumentFoldersEnabled()).toBe(false);
  });

  it("excludes Driver Licenses and Medical Documents from the visible list by default", () => {
    delete process.env[ENV_KEY];
    const folders = visibleDocumentFolders();
    expect(folders).not.toContain("Driver Licenses");
    expect(folders).not.toContain("Medical Documents");
    // Everything else stays visible — this isn't hiding the whole feature.
    expect(folders).toContain("Applications");
    expect(folders).toContain("Declarations");
  });

  it("shows every folder once explicitly enabled", () => {
    process.env[ENV_KEY] = "true";
    const folders = visibleDocumentFolders();
    expect(folders).toContain("Driver Licenses");
    expect(folders).toContain("Medical Documents");
  });

  it("isSensitiveDocumentFolder correctly classifies both flagged folders", () => {
    expect(isSensitiveDocumentFolder("Driver Licenses")).toBe(true);
    expect(isSensitiveDocumentFolder("Medical Documents")).toBe(true);
    expect(isSensitiveDocumentFolder("Applications")).toBe(false);
  });
});
