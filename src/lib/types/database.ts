export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      disputes: {
        Row: {
          created_at: string
          id: string
          job_id: string
          milestone_id: string | null
          raised_by: string
          reason: string
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["dispute_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          milestone_id?: string | null
          raised_by: string
          reason: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          milestone_id?: string | null
          raised_by?: string
          reason?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
        }
        Relationships: [
          {
            foreignKeyName: "disputes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_raised_by_fkey"
            columns: ["raised_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      escrow_ledger: {
        Row: {
          amount: number
          created_at: string
          from_wallet: string | null
          id: string
          job_id: string | null
          milestone_id: string | null
          reference_id: string | null
          to_wallet: string | null
          type: Database["public"]["Enums"]["ledger_type"]
        }
        Insert: {
          amount: number
          created_at?: string
          from_wallet?: string | null
          id?: string
          job_id?: string | null
          milestone_id?: string | null
          reference_id?: string | null
          to_wallet?: string | null
          type: Database["public"]["Enums"]["ledger_type"]
        }
        Update: {
          amount?: number
          created_at?: string
          from_wallet?: string | null
          id?: string
          job_id?: string | null
          milestone_id?: string | null
          reference_id?: string | null
          to_wallet?: string | null
          type?: Database["public"]["Enums"]["ledger_type"]
        }
        Relationships: [
          {
            foreignKeyName: "escrow_ledger_from_wallet_fkey"
            columns: ["from_wallet"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "escrow_ledger_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escrow_ledger_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escrow_ledger_to_wallet_fkey"
            columns: ["to_wallet"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      idempotency_keys: {
        Row: {
          action: string
          created_at: string
          key: string
          result: Json | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          key: string
          result?: Json | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          key?: string
          result?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      job_applications: {
        Row: {
          bid_amount: number
          created_at: string
          eta_days: number
          id: string
          job_id: string
          message: string | null
          status: Database["public"]["Enums"]["application_status"]
          worker_id: string
        }
        Insert: {
          bid_amount: number
          created_at?: string
          eta_days: number
          id?: string
          job_id: string
          message?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          worker_id: string
        }
        Update: {
          bid_amount?: number
          created_at?: string
          eta_days?: number
          id?: string
          job_id?: string
          message?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_applications_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          accepted_at: string | null
          area: string | null
          category: string
          city: string | null
          client_id: string
          created_at: string
          description: string | null
          id: string
          lat: number | null
          lng: number | null
          location_text: string | null
          status: Database["public"]["Enums"]["job_status"]
          title: string
          total_budget: number
          worker_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          area?: string | null
          category: string
          city?: string | null
          client_id: string
          created_at?: string
          description?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          location_text?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          title: string
          total_budget: number
          worker_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          area?: string | null
          category?: string
          city?: string | null
          client_id?: string
          created_at?: string
          description?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          location_text?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          title?: string
          total_budget?: number
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_url: string | null
          item_name: string
          job_id: string
          qty: number
          status: Database["public"]["Enums"]["material_status"]
          vendor_name: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_url?: string | null
          item_name: string
          job_id: string
          qty: number
          status?: Database["public"]["Enums"]["material_status"]
          vendor_name: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_url?: string | null
          item_name?: string
          job_id?: string
          qty?: number
          status?: Database["public"]["Enums"]["material_status"]
          vendor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "materials_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          amount: number
          approved_at: string | null
          auto_release_at: string | null
          created_at: string
          description: string | null
          id: string
          job_id: string
          sequence: number
          status: Database["public"]["Enums"]["milestone_status"]
          submitted_at: string | null
          title: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          auto_release_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          job_id: string
          sequence: number
          status?: Database["public"]["Enums"]["milestone_status"]
          submitted_at?: string | null
          title: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          auto_release_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          job_id?: string
          sequence?: number
          status?: Database["public"]["Enums"]["milestone_status"]
          submitted_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestones_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          data: Json
          id: string
          read_at: string | null
          recipient_id: string
          title: string
          type: string
        }
        Insert: {
          body: string
          created_at?: string
          data?: Json
          id?: string
          read_at?: string | null
          recipient_id: string
          title: string
          type: string
        }
        Update: {
          body?: string
          created_at?: string
          data?: Json
          id?: string
          read_at?: string | null
          recipient_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          city: string | null
          created_at: string
          deletion_reason: string | null
          deletion_requested_at: string | null
          full_name: string
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          city?: string | null
          created_at?: string
          deletion_reason?: string | null
          deletion_requested_at?: string | null
          full_name: string
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          city?: string | null
          created_at?: string
          deletion_reason?: string | null
          deletion_requested_at?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      proofs: {
        Row: {
          caption: string | null
          geo_lat: number | null
          geo_lng: number | null
          id: string
          milestone_id: string
          storage_path: string
          taken_at: string | null
          type: Database["public"]["Enums"]["proof_type"]
          uploaded_at: string
        }
        Insert: {
          caption?: string | null
          geo_lat?: number | null
          geo_lng?: number | null
          id?: string
          milestone_id: string
          storage_path: string
          taken_at?: string | null
          type: Database["public"]["Enums"]["proof_type"]
          uploaded_at?: string
        }
        Update: {
          caption?: string | null
          geo_lat?: number | null
          geo_lng?: number | null
          id?: string
          milestone_id?: string
          storage_path?: string
          taken_at?: string | null
          type?: Database["public"]["Enums"]["proof_type"]
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proofs_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          available_balance: number
          created_at: string
          currency: string
          locked_balance: number
          profile_id: string
          updated_at: string
        }
        Insert: {
          available_balance?: number
          created_at?: string
          currency?: string
          locked_balance?: number
          profile_id: string
          updated_at?: string
        }
        Update: {
          available_balance?: number
          created_at?: string
          currency?: string
          locked_balance?: number
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_profiles: {
        Row: {
          aadhaar_last4: string | null
          categories: string[]
          created_at: string
          jobs_completed: number
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          pan_last4: string | null
          profile_id: string
          rating: number
          selfie_url: string | null
          skill_tags: string[]
          trust_tier: Database["public"]["Enums"]["trust_tier"]
        }
        Insert: {
          aadhaar_last4?: string | null
          categories?: string[]
          created_at?: string
          jobs_completed?: number
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          pan_last4?: string | null
          profile_id: string
          rating?: number
          selfie_url?: string | null
          skill_tags?: string[]
          trust_tier?: Database["public"]["Enums"]["trust_tier"]
        }
        Update: {
          aadhaar_last4?: string | null
          categories?: string[]
          created_at?: string
          jobs_completed?: number
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          pan_last4?: string | null
          profile_id?: string
          rating?: number
          selfie_url?: string | null
          skill_tags?: string[]
          trust_tier?: Database["public"]["Enums"]["trust_tier"]
        }
        Relationships: [
          {
            foreignKeyName: "worker_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_approve_kyc: {
        Args: { p_notes?: string; p_profile_id: string }
        Returns: string
      }
      admin_force_release: {
        Args: { p_milestone_id: string; p_resolution_notes?: string }
        Returns: string
      }
      admin_refund: {
        Args: { p_milestone_id: string; p_resolution_notes?: string }
        Returns: string
      }
      admin_reject_kyc: {
        Args: { p_notes?: string; p_profile_id: string }
        Returns: string
      }
      approve_milestone: {
        Args: { p_idempotency_key: string; p_milestone_id: string }
        Returns: string
      }
      auto_release_milestones: { Args: never; Returns: number }
      dispute_milestone: {
        Args: {
          p_idempotency_key: string
          p_milestone_id: string
          p_reason: string
        }
        Returns: string
      }
      fund_escrow: {
        Args: { p_idempotency_key: string; p_milestone_id: string }
        Returns: string
      }
      get_application_worker_summary: {
        Args: { worker_ids: string[] }
        Returns: {
          full_name: string
          id: string
          jobs_completed: number
          rating: number
          trust_tier: Database["public"]["Enums"]["trust_tier"]
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_job_participant: { Args: { p_job_id: string }; Returns: boolean }
      is_worker: { Args: never; Returns: boolean }
      request_account_deletion: { Args: { reason: string }; Returns: undefined }
      submit_milestone: {
        Args: { p_idempotency_key: string; p_milestone_id: string }
        Returns: string
      }
      topup_wallet: {
        Args: { p_amount: number; p_idempotency_key: string }
        Returns: {
          available_balance: number
          ledger_id: string
        }[]
      }
      withdraw_wallet: {
        Args: { p_amount: number; p_idempotency_key: string }
        Returns: {
          available_balance: number
          ledger_id: string
        }[]
      }
    }
    Enums: {
      app_role: "client" | "worker" | "admin"
      application_status:
        | "pending"
        | "shortlisted"
        | "accepted"
        | "rejected"
        | "withdrawn"
      dispute_status:
        | "open"
        | "mediating"
        | "resolved_client"
        | "resolved_worker"
        | "split"
      job_status:
        | "draft"
        | "open"
        | "assigned"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "disputed"
      kyc_status: "pending" | "verified" | "rejected"
      ledger_type: "fund" | "release" | "refund" | "topup" | "withdraw"
      material_status: "requested" | "paid" | "delivered"
      milestone_status:
        | "pending"
        | "funded"
        | "submitted"
        | "approved"
        | "disputed"
        | "released"
        | "refunded"
      proof_type: "photo" | "video"
      trust_tier: "bronze" | "silver" | "gold"
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
  public: {
    Enums: {
      app_role: ["client", "worker", "admin"],
      application_status: [
        "pending",
        "shortlisted",
        "accepted",
        "rejected",
        "withdrawn",
      ],
      dispute_status: [
        "open",
        "mediating",
        "resolved_client",
        "resolved_worker",
        "split",
      ],
      job_status: [
        "draft",
        "open",
        "assigned",
        "in_progress",
        "completed",
        "cancelled",
        "disputed",
      ],
      kyc_status: ["pending", "verified", "rejected"],
      ledger_type: ["fund", "release", "refund", "topup", "withdraw"],
      material_status: ["requested", "paid", "delivered"],
      milestone_status: [
        "pending",
        "funded",
        "submitted",
        "approved",
        "disputed",
        "released",
        "refunded",
      ],
      proof_type: ["photo", "video"],
      trust_tier: ["bronze", "silver", "gold"],
    },
  },
} as const
