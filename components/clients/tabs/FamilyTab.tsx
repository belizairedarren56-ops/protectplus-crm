import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Client } from "@/types";

export function FamilyTab({ client }: { client: Client }) {
  const members = client.familyMembers ?? [];

  if (members.length === 0) {
    return (
      <Card className="p-6">
        <EmptyState
          icon="👨‍👩‍👧"
          title="No family members on file"
          description="Add household members to include them on multi-life or bundled policies."
        />
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {members.map((member) => {
        const [firstName, ...rest] = member.name.split(" ");

        return (
          <Card key={member.id} className="flex items-center gap-4 p-5">
            <Avatar firstName={firstName} lastName={rest.join(" ")} size="sm" />
            <div>
              <p className="font-bold text-white">{member.name}</p>
              <p className="text-xs text-gray-500">{member.relationship}</p>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
