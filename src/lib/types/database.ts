export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: "client" | "worker" | "admin";
          full_name: string;
          phone: string | null;
          city: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          role?: "client" | "worker" | "admin";
          full_name: string;
          phone?: string | null;
          city?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          role?: "client" | "worker" | "admin";
          full_name?: string;
          phone?: string | null;
          city?: string | null;
          created_at?: string;
        };
      };
      worker_profiles: {
        Row: {
          profile_id: string;
          kyc_status: "pending" | "verified" | "rejected";
          aadhaar_last4: string | null;
          pan_last4: string | null;
          selfie_url: string | null;
          categories: string[];
          skill_tags: string[];
          trust_tier: "bronze" | "silver" | "gold";
          rating: number;
          jobs_completed: number;
          created_at: string;
        };
        Insert: {
          profile_id: string;
          kyc_status?: "pending" | "verified" | "rejected";
          aadhaar_last4?: string | null;
          pan_last4?: string | null;
          selfie_url?: string | null;
          categories?: string[];
          skill_tags?: string[];
          trust_tier?: "bronze" | "silver" | "gold";
          rating?: number;
          jobs_completed?: number;
          created_at?: string;
        };
        Update: {
          profile_id?: string;
          kyc_status?: "pending" | "verified" | "rejected";
          aadhaar_last4?: string | null;
          pan_last4?: string | null;
          selfie_url?: string | null;
          categories?: string[];
          skill_tags?: string[];
          trust_tier?: "bronze" | "silver" | "gold";
          rating?: number;
          jobs_completed?: number;
          created_at?: string;
        };
      };
      jobs: {
        Row: {
          id: string;
          client_id: string;
          worker_id: string | null;
          title: string;
          description: string | null;
          category: string;
          location_text: string | null;
          lat: number | null;
          lng: number | null;
          total_budget: number;
          status: "draft" | "open" | "assigned" | "in_progress" | "completed" | "cancelled" | "disputed";
          created_at: string;
          accepted_at: string | null;
        };
        Insert: {
          id?: string;
          client_id: string;
          worker_id?: string | null;
          title: string;
          description?: string | null;
          category: string;
          location_text?: string | null;
          lat?: number | null;
          lng?: number | null;
          total_budget: number;
          status?: "draft" | "open" | "assigned" | "in_progress" | "completed" | "cancelled" | "disputed";
          created_at?: string;
          accepted_at?: string | null;
        };
        Update: {
          id?: string;
          client_id?: string;
          worker_id?: string | null;
          title?: string;
          description?: string | null;
          category?: string;
          location_text?: string | null;
          lat?: number | null;
          lng?: number | null;
          total_budget?: number;
          status?: "draft" | "open" | "assigned" | "in_progress" | "completed" | "cancelled" | "disputed";
          created_at?: string;
          accepted_at?: string | null;
        };
      };
      milestones: {
        Row: {
          id: string;
          job_id: string;
          sequence: number;
          title: string;
          description: string | null;
          amount: number;
          status: "pending" | "funded" | "submitted" | "approved" | "disputed" | "released" | "refunded";
          auto_release_at: string | null;
          submitted_at: string | null;
          approved_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          sequence: number;
          title: string;
          description?: string | null;
          amount: number;
          status?: "pending" | "funded" | "submitted" | "approved" | "disputed" | "released" | "refunded";
          auto_release_at?: string | null;
          submitted_at?: string | null;
          approved_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          job_id?: string;
          sequence?: number;
          title?: string;
          description?: string | null;
          amount?: number;
          status?: "pending" | "funded" | "submitted" | "approved" | "disputed" | "released" | "refunded";
          auto_release_at?: string | null;
          submitted_at?: string | null;
          approved_at?: string | null;
          created_at?: string;
        };
      };
      materials: {
        Row: {
          id: string;
          job_id: string;
          vendor_name: string;
          item_name: string;
          qty: number;
          amount: number;
          status: "requested" | "paid" | "delivered";
          invoice_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          vendor_name: string;
          item_name: string;
          qty: number;
          amount: number;
          status?: "requested" | "paid" | "delivered";
          invoice_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          job_id?: string;
          vendor_name?: string;
          item_name?: string;
          qty?: number;
          amount?: number;
          status?: "requested" | "paid" | "delivered";
          invoice_url?: string | null;
          created_at?: string;
        };
      };
      job_applications: {
        Row: {
          id: string;
          job_id: string;
          worker_id: string;
          bid_amount: number;
          eta_days: number;
          message: string | null;
          status: "pending" | "shortlisted" | "accepted" | "rejected" | "withdrawn";
          created_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          worker_id: string;
          bid_amount: number;
          eta_days: number;
          message?: string | null;
          status?: "pending" | "shortlisted" | "accepted" | "rejected" | "withdrawn";
          created_at?: string;
        };
        Update: {
          id?: string;
          job_id?: string;
          worker_id?: string;
          bid_amount?: number;
          eta_days?: number;
          message?: string | null;
          status?: "pending" | "shortlisted" | "accepted" | "rejected" | "withdrawn";
          created_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          recipient_id: string;
          type: string;
          title: string;
          body: string;
          data: Json;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          recipient_id: string;
          type: string;
          title: string;
          body: string;
          data?: Json;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          recipient_id?: string;
          type?: string;
          title?: string;
          body?: string;
          data?: Json;
          read_at?: string | null;
          created_at?: string;
        };
      };
      wallets: {
        Row: {
          profile_id: string;
          locked_balance: number;
          available_balance: number;
          currency: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          profile_id: string;
          locked_balance?: number;
          available_balance?: number;
          currency?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          profile_id?: string;
          locked_balance?: number;
          available_balance?: number;
          currency?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      escrow_ledger: {
        Row: {
          id: string;
          job_id: string;
          milestone_id: string | null;
          from_wallet: string | null;
          to_wallet: string | null;
          amount: number;
          type: "fund" | "release" | "refund" | "topup" | "withdraw";
          reference_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          milestone_id?: string | null;
          from_wallet?: string | null;
          to_wallet?: string | null;
          amount: number;
          type: "fund" | "release" | "refund" | "topup" | "withdraw";
          reference_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          job_id?: string;
          milestone_id?: string | null;
          from_wallet?: string | null;
          to_wallet?: string | null;
          amount?: number;
          type?: "fund" | "release" | "refund" | "topup" | "withdraw";
          reference_id?: string | null;
          created_at?: string;
        };
      };
      disputes: {
        Row: {
          id: string;
          job_id: string;
          milestone_id: string | null;
          raised_by: string;
          reason: string;
          status: "open" | "mediating" | "resolved_client" | "resolved_worker" | "split";
          resolution_notes: string | null;
          resolved_by: string | null;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          job_id: string;
          milestone_id?: string | null;
          raised_by: string;
          reason: string;
          status?: "open" | "mediating" | "resolved_client" | "resolved_worker" | "split";
          resolution_notes?: string | null;
          resolved_by?: string | null;
          created_at?: string;
          resolved_at?: string | null;
        };
        Update: {
          id?: string;
          job_id?: string;
          milestone_id?: string | null;
          raised_by?: string;
          reason?: string;
          status?: "open" | "mediating" | "resolved_client" | "resolved_worker" | "split";
          resolution_notes?: string | null;
          resolved_by?: string | null;
          created_at?: string;
          resolved_at?: string | null;
        };
      };
      proofs: {
        Row: {
          id: string;
          milestone_id: string;
          type: "photo" | "video";
          storage_path: string;
          caption: string | null;
          geo_lat: number | null;
          geo_lng: number | null;
          taken_at: string | null;
          uploaded_at: string;
        };
        Insert: {
          id?: string;
          milestone_id: string;
          type: "photo" | "video";
          storage_path: string;
          caption?: string | null;
          geo_lat?: number | null;
          geo_lng?: number | null;
          taken_at?: string | null;
          uploaded_at?: string;
        };
        Update: {
          id?: string;
          milestone_id?: string;
          type?: "photo" | "video";
          storage_path?: string;
          caption?: string | null;
          geo_lat?: number | null;
          geo_lng?: number | null;
          taken_at?: string | null;
          uploaded_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: {
      fund_escrow: {
        Args: { p_milestone_id: string };
        Returns: string;
      };
      approve_milestone: {
        Args: { p_milestone_id: string };
        Returns: string;
      };
      submit_milestone: {
        Args: { p_milestone_id: string };
        Returns: string;
      };
      dispute_milestone: {
        Args: { p_milestone_id: string; p_reason: string };
        Returns: string;
      };
      admin_force_release: {
        Args: { p_milestone_id: string; p_resolution_notes?: string | null };
        Returns: string;
      };
      admin_refund: {
        Args: { p_milestone_id: string; p_resolution_notes?: string | null };
        Returns: string;
      };
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_worker: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_job_participant: {
        Args: { p_job_id: string };
        Returns: boolean;
      };
      admin_approve_kyc: {
        Args: { p_profile_id: string; p_notes?: string | null };
        Returns: string;
      };
      admin_reject_kyc: {
        Args: { p_profile_id: string; p_notes?: string | null };
        Returns: string;
      };
    };
    Enums: {
      app_role: "client" | "worker" | "admin";
      kyc_status: "pending" | "verified" | "rejected";
      trust_tier: "bronze" | "silver" | "gold";
      job_status:
        | "draft"
        | "open"
        | "assigned"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "disputed";
      milestone_status:
        | "pending"
        | "funded"
        | "submitted"
        | "approved"
        | "disputed"
        | "released"
        | "refunded";
      ledger_type: "fund" | "release" | "refund" | "topup" | "withdraw";
      proof_type: "photo" | "video";
      dispute_status:
        | "open"
        | "mediating"
        | "resolved_client"
        | "resolved_worker"
        | "split";
      material_status: "requested" | "paid" | "delivered";
      application_status: "pending" | "shortlisted" | "accepted" | "rejected" | "withdrawn";
    };
    CompositeTypes: Record<string, never>;
  };
};

