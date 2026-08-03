// Hand-derived from supabase/migrations/*.sql, matching the shape
// `supabase gen types typescript --local` would produce.
//
// IMPORTANT: this file is NOT machine-generated in this environment — there
// is no Docker/local Supabase available to run the CLI against. It must be
// regenerated (`supabase gen types typescript --local > lib/supabase/database.types.ts`)
// and diffed against this file once a local Supabase instance is available;
// the `supabase` CI job's new "generated types drift check" step is the
// authoritative check going forward. Treat this file as a best-effort
// starting point, not a verified-correct artifact.
//
// Every table below satisfies @supabase/postgrest-js's `GenericTable` shape
// exactly (Row/Insert/Update/Relationships) — a table missing any of these
// breaks the whole `Tables` map's conformance to `Record<string,
// GenericTable>` and silently degrades unrelated tables' type inference to
// `never`, which is not obvious from the error message alone.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type EmptyTable = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      agencies: {
        Row: {
          id: string;
          name: string;
          phone: string | null;
          email: string | null;
          address: string | null;
          primary_color: string | null;
          secondary_color: string | null;
          accent_color: string | null;
          carriers: string[];
          commission_rules: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["agencies"]["Row"]> & { name: string };
        Update: Partial<Database["public"]["Tables"]["agencies"]["Row"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          agency_id: string;
          role: "admin" | "producer";
          full_name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & {
          id: string;
          agency_id: string;
          full_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      clients: {
        Row: {
          id: string;
          agency_id: string;
          assigned_producer_id: string | null;
          first_name: string;
          last_name: string;
          phone: string | null;
          email: string | null;
          status: "New Lead" | "Active" | "Prospect" | "Inactive" | "Lost";
          address: string | null;
          city: string | null;
          state: string | null;
          zip: string | null;
          carrier: string | null;
          policy_number: string | null;
          insurance_types: string[];
          archived_at: string | null;
          is_demo: boolean;
          legacy_id: string | null;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["clients"]["Row"]> & {
          agency_id: string;
          first_name: string;
          last_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["clients"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "clients_producer_same_agency";
            columns: ["assigned_producer_id", "agency_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id", "agency_id"];
          },
        ];
      };
      family_members: {
        Row: {
          id: string;
          agency_id: string;
          client_id: string;
          name: string;
          relationship: string;
          date_of_birth: string | null;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["family_members"]["Row"]> & {
          agency_id: string;
          client_id: string;
          name: string;
          relationship: string;
        };
        Update: Partial<Database["public"]["Tables"]["family_members"]["Row"]>;
        Relationships: [];
      };
      // Not migrated this phase (still localStorage) — minimal placeholder
      // shape only, satisfying GenericTable so the map as a whole type-checks.
      leads: EmptyTable;
      quotes: EmptyTable;
      policies: EmptyTable;
      tasks: EmptyTable;
      documents: EmptyTable;
      client_notes: {
        Row: {
          id: string;
          agency_id: string;
          client_id: string;
          body: string;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["client_notes"]["Row"]> & {
          agency_id: string;
          client_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["client_notes"]["Row"]>;
        Relationships: [];
      };
      notifications: EmptyTable;
      activity_log: EmptyTable;
    };
    Views: Record<string, never>;
    Functions: {
      auth_profile: {
        Args: Record<string, never>;
        Returns: Database["public"]["Tables"]["profiles"]["Row"];
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      current_agency_id: {
        Args: Record<string, never>;
        Returns: string;
      };
      owns_or_admin: {
        Args: { owner: string };
        Returns: boolean;
      };
      clear_agency_demo_clients: {
        Args: Record<string, never>;
        Returns: number;
      };
    };
    Enums: {
      user_role: "admin" | "producer";
      client_status: "New Lead" | "Active" | "Prospect" | "Inactive" | "Lost";
    };
  };
};
