export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type Role = "client" | "worker" | "admin";
export type KycStatus = "pending" | "approved" | "rejected";
export type TrustTier = "bronze" | "silver" | "gold";
export type JobStatus = "open" | "assigned" | "in_progress" | "completed" | "disputed" | "cancelled";
export type MilestoneStatus = "pending" | "funded" | "released" | "disputed";
export type ApplicationStatus = "pending" | "accepted" | "rejected";
export type TxnType = "credit" | "debit" | "hold" | "release";

export interface Profile {
  id: string;
  phone: string;
  name: string | null;
  role: Role | null;
  kyc_status: KycStatus | null;
  trust_tier: TrustTier | null;
  wallet_balance: number;
  selfie_url: string | null;
  aadhaar_last4: string | null;
  onboarding_done: boolean | null;
  created_at: string;
}

export interface Job {
  id: string;
  title: string;
  description: string | null;
  category: string;
  budget: number;
  lat: number | null;
  lng: number | null;
  location_text: string | null;
  status: JobStatus;
  client_id: string;
  worker_id: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface Milestone {
  id: string;
  job_id: string;
  title: string;
  amount: number;
  status: MilestoneStatus;
  due_date: string | null;
  paid_at: string | null;
  seq: number | null;
  created_at: string;
}

export interface Application {
  id: string;
  job_id: string;
  worker_id: string;
  note: string | null;
  status: ApplicationStatus;
  created_at: string;
}

export interface WalletTxn {
  id: string;
  user_id: string;
  type: TxnType;
  amount: number;
  ref_id: string | null;
  ref_type: string | null;
  description: string | null;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string };
        Update: Partial<Profile>;
      };
      jobs: {
        Row: Job;
        Insert: Omit<Job, "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Job>;
      };
      milestones: {
        Row: Milestone;
        Insert: Omit<Milestone, "id" | "created_at"> & { id?: string };
        Update: Partial<Milestone>;
      };
      applications: {
        Row: Application;
        Insert: Omit<Application, "id" | "created_at"> & { id?: string };
        Update: Partial<Application>;
      };
      wallet_txns: {
        Row: WalletTxn;
        Insert: Omit<WalletTxn, "id" | "created_at"> & { id?: string };
        Update: Partial<WalletTxn>;
      };
    };
  };
}
