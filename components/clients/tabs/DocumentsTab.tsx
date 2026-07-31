import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { DOCUMENT_FOLDER_ICONS } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { Document } from "@/types";

export function DocumentsTab({ documents }: { documents: Document[] }) {
  if (documents.length === 0) {
    return (
      <Card className="p-6">
        <EmptyState
          icon="📁"
          title="No documents on file"
          description="Documents uploaded for this client will appear here."
        />
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {documents.map((document) => (
        <Card key={document.id} className="flex items-center gap-4 p-5">
          <span className="text-2xl">{DOCUMENT_FOLDER_ICONS[document.folder] ?? "📄"}</span>
          <div>
            <p className="font-bold text-white">{document.name}</p>
            <p className="text-xs text-gray-500">
              {document.folder} • {formatDate(document.uploadedAt)}
            </p>
          </div>
        </Card>
      ))}
    </div>
  );
}
