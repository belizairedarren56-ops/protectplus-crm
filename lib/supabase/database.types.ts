export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          agency_id: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          agency_id: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          agency_id?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_agency_fkey"
            columns: ["actor_id", "agency_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "agency_id"]
          },
          {
            foreignKeyName: "activity_log_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      agencies: {
        Row: {
          accent_color: string | null
          address: string | null
          carriers: string[]
          commission_rules: Json
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          primary_color: string | null
          secondary_color: string | null
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          address?: string | null
          carriers?: string[]
          commission_rules?: Json
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          address?: string | null
          carriers?: string[]
          commission_rules?: Json
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      client_notes: {
        Row: {
          agency_id: string
          body: string
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          note_type: Database["public"]["Enums"]["client_note_type"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          agency_id: string
          body?: string
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          note_type?: Database["public"]["Enums"]["client_note_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          agency_id?: string
          body?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          note_type?: Database["public"]["Enums"]["client_note_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_notes_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notes_client_id_agency_id_fkey"
            columns: ["client_id", "agency_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "agency_id"]
          },
          {
            foreignKeyName: "client_notes_created_by_agency_fkey"
            columns: ["created_by", "agency_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "agency_id"]
          },
          {
            foreignKeyName: "client_notes_updated_by_agency_fkey"
            columns: ["updated_by", "agency_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "agency_id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          agency_id: string
          archived_at: string | null
          assigned_producer_id: string | null
          carrier: string | null
          city: string | null
          created_at: string
          created_by: string | null
          email: string | null
          first_name: string
          id: string
          insurance_types: Database["public"]["Enums"]["insurance_type"][]
          is_demo: boolean
          last_name: string
          legacy_id: string | null
          phone: string | null
          policy_number: string | null
          state: string | null
          status: Database["public"]["Enums"]["client_status"]
          updated_at: string
          updated_by: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          agency_id: string
          archived_at?: string | null
          assigned_producer_id?: string | null
          carrier?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_name: string
          id?: string
          insurance_types?: Database["public"]["Enums"]["insurance_type"][]
          is_demo?: boolean
          last_name: string
          legacy_id?: string | null
          phone?: string | null
          policy_number?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
          updated_by?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          agency_id?: string
          archived_at?: string | null
          assigned_producer_id?: string | null
          carrier?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_name?: string
          id?: string
          insurance_types?: Database["public"]["Enums"]["insurance_type"][]
          is_demo?: boolean
          last_name?: string
          legacy_id?: string | null
          phone?: string | null
          policy_number?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
          updated_by?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_created_by_agency_fkey"
            columns: ["created_by", "agency_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "agency_id"]
          },
          {
            foreignKeyName: "clients_producer_same_agency"
            columns: ["assigned_producer_id", "agency_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "agency_id"]
          },
          {
            foreignKeyName: "clients_updated_by_agency_fkey"
            columns: ["updated_by", "agency_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "agency_id"]
          },
        ]
      }
      documents: {
        Row: {
          agency_id: string
          client_id: string | null
          created_at: string
          created_by: string | null
          file_type: string | null
          folder: Database["public"]["Enums"]["document_folder"]
          id: string
          name: string
          storage_path: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          agency_id: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          file_type?: string | null
          folder: Database["public"]["Enums"]["document_folder"]
          id?: string
          name: string
          storage_path?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          agency_id?: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          file_type?: string | null
          folder?: Database["public"]["Enums"]["document_folder"]
          id?: string
          name?: string
          storage_path?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_client_id_agency_id_fkey"
            columns: ["client_id", "agency_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "agency_id"]
          },
          {
            foreignKeyName: "documents_created_by_agency_fkey"
            columns: ["created_by", "agency_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "agency_id"]
          },
          {
            foreignKeyName: "documents_updated_by_agency_fkey"
            columns: ["updated_by", "agency_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "agency_id"]
          },
        ]
      }
      family_members: {
        Row: {
          agency_id: string
          client_id: string
          created_at: string
          created_by: string | null
          date_of_birth: string | null
          id: string
          legacy_id: string | null
          name: string
          relationship: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          agency_id: string
          client_id: string
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          id?: string
          legacy_id?: string | null
          name: string
          relationship: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          agency_id?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          id?: string
          legacy_id?: string | null
          name?: string
          relationship?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "family_members_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_members_client_id_agency_id_fkey"
            columns: ["client_id", "agency_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "agency_id"]
          },
          {
            foreignKeyName: "family_members_created_by_agency_fkey"
            columns: ["created_by", "agency_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "agency_id"]
          },
          {
            foreignKeyName: "family_members_updated_by_agency_fkey"
            columns: ["updated_by", "agency_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "agency_id"]
          },
        ]
      }
      leads: {
        Row: {
          agency_id: string
          client_id: string | null
          client_name: string
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          insurance_type: Database["public"]["Enums"]["insurance_type"]
          last_contact: string | null
          phone: string | null
          priority: Database["public"]["Enums"]["priority_level"]
          producer_id: string
          stage: Database["public"]["Enums"]["lead_stage"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          agency_id: string
          client_id?: string | null
          client_name: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          insurance_type: Database["public"]["Enums"]["insurance_type"]
          last_contact?: string | null
          phone?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          producer_id: string
          stage?: Database["public"]["Enums"]["lead_stage"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          agency_id?: string
          client_id?: string | null
          client_name?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          insurance_type?: Database["public"]["Enums"]["insurance_type"]
          last_contact?: string | null
          phone?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          producer_id?: string
          stage?: Database["public"]["Enums"]["lead_stage"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_client_id_agency_id_fkey"
            columns: ["client_id", "agency_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "agency_id"]
          },
          {
            foreignKeyName: "leads_created_by_agency_fkey"
            columns: ["created_by", "agency_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "agency_id"]
          },
          {
            foreignKeyName: "leads_producer_id_agency_id_fkey"
            columns: ["producer_id", "agency_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "agency_id"]
          },
          {
            foreignKeyName: "leads_updated_by_agency_fkey"
            columns: ["updated_by", "agency_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "agency_id"]
          },
        ]
      }
      notifications: {
        Row: {
          agency_id: string
          created_at: string
          id: string
          message: string
          read: boolean
          type: string
          user_id: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          id?: string
          message: string
          read?: boolean
          type: string
          user_id: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_agency_fkey"
            columns: ["user_id", "agency_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "agency_id"]
          },
        ]
      }
      policies: {
        Row: {
          agency_id: string
          carrier: string
          client_id: string
          client_name: string
          created_at: string
          created_by: string | null
          effective_date: string
          expiration_date: string
          id: string
          policy_number: string
          premium: number
          producer_id: string
          product: Database["public"]["Enums"]["insurance_type"]
          status: Database["public"]["Enums"]["policy_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          agency_id: string
          carrier: string
          client_id: string
          client_name: string
          created_at?: string
          created_by?: string | null
          effective_date: string
          expiration_date: string
          id?: string
          policy_number: string
          premium: number
          producer_id: string
          product: Database["public"]["Enums"]["insurance_type"]
          status?: Database["public"]["Enums"]["policy_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          agency_id?: string
          carrier?: string
          client_id?: string
          client_name?: string
          created_at?: string
          created_by?: string | null
          effective_date?: string
          expiration_date?: string
          id?: string
          policy_number?: string
          premium?: number
          producer_id?: string
          product?: Database["public"]["Enums"]["insurance_type"]
          status?: Database["public"]["Enums"]["policy_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "policies_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_client_id_agency_id_fkey"
            columns: ["client_id", "agency_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "agency_id"]
          },
          {
            foreignKeyName: "policies_created_by_agency_fkey"
            columns: ["created_by", "agency_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "agency_id"]
          },
          {
            foreignKeyName: "policies_producer_id_agency_id_fkey"
            columns: ["producer_id", "agency_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "agency_id"]
          },
          {
            foreignKeyName: "policies_updated_by_agency_fkey"
            columns: ["updated_by", "agency_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "agency_id"]
          },
        ]
      }
      profiles: {
        Row: {
          agency_id: string
          created_at: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          full_name: string
          id: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          agency_id: string
          carrier: string
          client_id: string
          client_name: string
          coverage: string | null
          created_at: string
          created_by: string | null
          id: string
          insurance_type: Database["public"]["Enums"]["insurance_type"]
          premium: number
          producer_id: string
          status: Database["public"]["Enums"]["quote_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          agency_id: string
          carrier: string
          client_id: string
          client_name: string
          coverage?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          insurance_type: Database["public"]["Enums"]["insurance_type"]
          premium: number
          producer_id: string
          status?: Database["public"]["Enums"]["quote_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          agency_id?: string
          carrier?: string
          client_id?: string
          client_name?: string
          coverage?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          insurance_type?: Database["public"]["Enums"]["insurance_type"]
          premium?: number
          producer_id?: string
          status?: Database["public"]["Enums"]["quote_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_client_id_agency_id_fkey"
            columns: ["client_id", "agency_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "agency_id"]
          },
          {
            foreignKeyName: "quotes_created_by_agency_fkey"
            columns: ["created_by", "agency_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "agency_id"]
          },
          {
            foreignKeyName: "quotes_producer_id_agency_id_fkey"
            columns: ["producer_id", "agency_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "agency_id"]
          },
          {
            foreignKeyName: "quotes_updated_by_agency_fkey"
            columns: ["updated_by", "agency_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "agency_id"]
          },
        ]
      }
      tasks: {
        Row: {
          agency_id: string
          assigned_to: string
          client_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string
          id: string
          priority: Database["public"]["Enums"]["priority_level"]
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          agency_id: string
          assigned_to: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date: string
          id?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          agency_id?: string
          assigned_to?: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string
          id?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_to_agency_id_fkey"
            columns: ["assigned_to", "agency_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "agency_id"]
          },
          {
            foreignKeyName: "tasks_client_id_agency_id_fkey"
            columns: ["client_id", "agency_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "agency_id"]
          },
          {
            foreignKeyName: "tasks_created_by_agency_fkey"
            columns: ["created_by", "agency_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "agency_id"]
          },
          {
            foreignKeyName: "tasks_updated_by_agency_fkey"
            columns: ["updated_by", "agency_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "agency_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_profile: {
        Args: never
        Returns: {
          agency_id: string
          created_at: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      clear_agency_demo_clients: { Args: never; Returns: number }
      current_agency_id: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      owns_or_admin: { Args: { owner: string }; Returns: boolean }
      upsert_client_profile_note: {
        Args: { p_body: string; p_client_id: string }
        Returns: {
          agency_id: string
          body: string
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          note_type: Database["public"]["Enums"]["client_note_type"]
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "client_notes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      client_note_type: "profile" | "timeline"
      client_status: "New Lead" | "Active" | "Prospect" | "Inactive" | "Lost"
      document_folder:
        | "Applications"
        | "Declarations"
        | "Driver Licenses"
        | "Vehicle Photos"
        | "Property Photos"
        | "Commercial Documents"
        | "Medical Documents"
      insurance_type:
        | "Auto"
        | "Home"
        | "Commercial"
        | "Life"
        | "Health"
        | "Boat"
        | "Umbrella"
        | "Flood"
      lead_stage:
        | "New"
        | "Contacted"
        | "Quote Started"
        | "Quote Sent"
        | "Follow Up"
        | "Sold"
        | "Renewal"
        | "Lost"
      policy_status: "Active" | "Renewal Due" | "Cancelled" | "Expired"
      priority_level: "Low" | "Medium" | "High"
      quote_status: "Draft" | "Sent" | "Accepted" | "Declined" | "Expired"
      task_status: "Open" | "Complete"
      user_role: "admin" | "producer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      client_note_type: ["profile", "timeline"],
      client_status: ["New Lead", "Active", "Prospect", "Inactive", "Lost"],
      document_folder: [
        "Applications",
        "Declarations",
        "Driver Licenses",
        "Vehicle Photos",
        "Property Photos",
        "Commercial Documents",
        "Medical Documents",
      ],
      insurance_type: [
        "Auto",
        "Home",
        "Commercial",
        "Life",
        "Health",
        "Boat",
        "Umbrella",
        "Flood",
      ],
      lead_stage: [
        "New",
        "Contacted",
        "Quote Started",
        "Quote Sent",
        "Follow Up",
        "Sold",
        "Renewal",
        "Lost",
      ],
      policy_status: ["Active", "Renewal Due", "Cancelled", "Expired"],
      priority_level: ["Low", "Medium", "High"],
      quote_status: ["Draft", "Sent", "Accepted", "Declined", "Expired"],
      task_status: ["Open", "Complete"],
      user_role: ["admin", "producer"],
    },
  },
} as const

