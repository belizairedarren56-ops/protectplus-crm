import { DOCUMENT_FOLDERS } from "@/types";
import type { DocumentFolder } from "@/types";

// Driver Licenses and Medical Documents stay hidden until agency counsel/
// compliance confirms the applicable storage and retention requirements —
// see the Phase 2 plan's compliance gate. Default OFF in every environment;
// there is no separate "production" branch of this flag, it's just off
// until someone with compliance authority turns it on. Read at call time
// (not module load) so both the real app and tests can toggle it.
const SENSITIVE_DOCUMENT_FOLDERS: DocumentFolder[] = ["Driver Licenses", "Medical Documents"];

export function sensitiveDocumentFoldersEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_SENSITIVE_DOCUMENT_FOLDERS === "true";
}

export function isSensitiveDocumentFolder(folder: DocumentFolder): boolean {
  return SENSITIVE_DOCUMENT_FOLDERS.includes(folder);
}

export function visibleDocumentFolders(): DocumentFolder[] {
  if (sensitiveDocumentFoldersEnabled()) return DOCUMENT_FOLDERS;
  return DOCUMENT_FOLDERS.filter((folder) => !isSensitiveDocumentFolder(folder));
}
