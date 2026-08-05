"use client";

import { useState } from "react";
import clsx from "clsx";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, TableColumn } from "@/components/ui/Table";
import { useDocuments } from "@/hooks/useDocuments";
import {
  isSensitiveDocumentFolder,
  sensitiveDocumentFoldersEnabled,
  visibleDocumentFolders,
} from "@/lib/config";
import { DOCUMENT_FOLDER_ICONS } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { Document, DocumentFolder } from "@/types";

export default function DocumentsPage() {
  const { documents, documentsLoaded, isError, error, createDocument } = useDocuments();
  const [selectedFolder, setSelectedFolder] = useState<DocumentFolder | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Filtered at the data level, not just the folder-picker UI — a hidden
  // folder must not leak its contents into "All Documents" either.
  const folders = visibleDocumentFolders();
  const accessibleDocuments = sensitiveDocumentFoldersEnabled()
    ? documents
    : documents.filter((document) => !isSensitiveDocumentFolder(document.folder));

  const visibleDocuments = selectedFolder
    ? accessibleDocuments.filter((document) => document.folder === selectedFolder)
    : accessibleDocuments;

  async function addPlaceholder(folder: DocumentFolder) {
    const extension = folder === "Driver Licenses" || folder.includes("Photos") ? "jpg" : "pdf";

    setIsCreating(true);
    setCreateError(null);
    const result = await createDocument({
      name: `New_${folder.replace(/\s+/g, "")}_${documents.length + 1}.${extension}`,
      folder,
      fileType: extension,
    });
    if (!result.ok) setCreateError(result.error.message);
    setIsCreating(false);
  }

  const columns: TableColumn<Document>[] = [
    {
      key: "name",
      header: "File",
      render: (document) => (
        <div className="flex items-center gap-3">
          <span className="text-xl">{DOCUMENT_FOLDER_ICONS[document.folder] ?? "📄"}</span>
          <span className="font-bold text-white">{document.name}</span>
        </div>
      ),
    },
    {
      key: "folder",
      header: "Folder",
      render: (document) => <span className="text-gray-300">{document.folder}</span>,
    },
    {
      key: "client",
      header: "Client",
      render: (document) => <span className="text-gray-300">{document.clientName ?? "—"}</span>,
    },
    {
      key: "uploaded",
      header: "Uploaded",
      render: (document) => <span className="text-gray-300">{formatDate(document.uploadedAt)}</span>,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-yellow-500">
            ProtectPlus CRM
          </p>
          <h1 className="mt-2 text-4xl font-black sm:text-5xl">Documents</h1>
          <p className="mt-2 text-gray-400">
            Local placeholders for now — cloud storage is coming in the next phase.
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <button
          onClick={() => setSelectedFolder(null)}
          className={clsx(
            "rounded-2xl border p-5 text-left transition",
            selectedFolder === null
              ? "border-yellow-400/60 bg-yellow-500/10"
              : "border-yellow-500/20 bg-black/70 hover:border-yellow-500/40"
          )}
        >
          <span className="text-2xl">🗂️</span>
          <p className="mt-3 font-bold text-white">All Documents</p>
          <p className="mt-1 text-sm text-gray-500">{accessibleDocuments.length} files</p>
        </button>

        {folders.map((folder) => {
          const count = accessibleDocuments.filter((document) => document.folder === folder).length;

          return (
            <button
              key={folder}
              onClick={() => setSelectedFolder(folder)}
              className={clsx(
                "rounded-2xl border p-5 text-left transition",
                selectedFolder === folder
                  ? "border-yellow-400/60 bg-yellow-500/10"
                  : "border-yellow-500/20 bg-black/70 hover:border-yellow-500/40"
              )}
            >
              <span className="text-2xl">{DOCUMENT_FOLDER_ICONS[folder]}</span>
              <p className="mt-3 font-bold text-white">{folder}</p>
              <p className="mt-1 text-sm text-gray-500">{count} files</p>
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-xl font-black text-yellow-400">
          {selectedFolder ?? "All Documents"}
        </h2>

        {selectedFolder && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => addPlaceholder(selectedFolder)}
            disabled={isCreating}
          >
            {isCreating ? "Adding..." : "+ Add Placeholder File"}
          </Button>
        )}
      </div>

      {createError && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {createError}
        </p>
      )}

      <div className="mt-4">
        {isError ? (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-6 py-16 text-center text-red-300">
            Could not load documents{error ? `: ${error.message}` : "."}
          </div>
        ) : !documentsLoaded ? (
          <div className="rounded-2xl border border-yellow-500/20 bg-black/75 px-6 py-16 text-center text-gray-500">
            Loading documents...
          </div>
        ) : visibleDocuments.length === 0 ? (
          <Card>
            <EmptyState icon="📁" title="No files in this folder yet" />
          </Card>
        ) : (
          <Table
            columns={columns}
            rows={visibleDocuments}
            rowKey={(document) => document.id}
            emptyMessage="No documents yet."
          />
        )}
      </div>
    </div>
  );
}
