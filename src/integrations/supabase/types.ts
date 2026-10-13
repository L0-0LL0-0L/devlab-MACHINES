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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      chain_transactions: {
        Row: {
          cluster: string
          created_at: string
          detail: Json
          id: string
          kind: string
          project_id: string | null
          signature: string
          wallet: string
        }
        Insert: {
          cluster: string
          created_at?: string
          detail?: Json
          id?: string
          kind: string
          project_id?: string | null
          signature: string
          wallet: string
        }
        Update: {
          cluster?: string
          created_at?: string
          detail?: Json
          id?: string
          kind?: string
          project_id?: string | null
          signature?: string
          wallet?: string
        }
        Relationships: [
          {
            foreignKeyName: "chain_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_author_attempts: {
        Row: {
          created_at: string
          id: string
          job_id: string
          owner_id: string
          request_digest: string
          result: Json | null
          status: string
          token_reservation: number
        }
        Insert: {
          created_at?: string
          id: string
          job_id: string
          owner_id: string
          request_digest: string
          result?: Json | null
          status?: string
          token_reservation?: number
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          owner_id?: string
          request_digest?: string
          result?: Json | null
          status?: string
          token_reservation?: number
        }
        Relationships: [
          {
            foreignKeyName: "machine_author_attempts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "machine_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_callback_receipts: {
        Row: {
          created_at: string
          job_id: string
          payload_bytes: string
          payload_digest: string
          result: Json
          runner_id: string
        }
        Insert: {
          created_at?: string
          job_id: string
          payload_bytes: string
          payload_digest: string
          result: Json
          runner_id: string
        }
        Update: {
          created_at?: string
          job_id?: string
          payload_bytes?: string
          payload_digest?: string
          result?: Json
          runner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "machine_callback_receipts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "machine_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_candidates: {
        Row: {
          author_id: string
          baseline_commit: string
          candidate_commit: string | null
          created_at: string
          id: string
          job_id: string | null
          machine_id: string
          owner_id: string
          patch: string
          patch_digest: string
          provenance: Json
          recipe_digest: string
          status: string
        }
        Insert: {
          author_id: string
          baseline_commit: string
          candidate_commit?: string | null
          created_at?: string
          id?: string
          job_id?: string | null
          machine_id: string
          owner_id: string
          patch: string
          patch_digest: string
          provenance?: Json
          recipe_digest: string
          status?: string
        }
        Update: {
          author_id?: string
          baseline_commit?: string
          candidate_commit?: string | null
          created_at?: string
          id?: string
          job_id?: string | null
          machine_id?: string
          owner_id?: string
          patch?: string
          patch_digest?: string
          provenance?: Json
          recipe_digest?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "machine_candidates_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "machine_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_candidates_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_desks: {
        Row: {
          machine_id: string | null
          owner_id: string
          panel: string
          updated_at: string
        }
        Insert: {
          machine_id?: string | null
          owner_id: string
          panel?: string
          updated_at?: string
        }
        Update: {
          machine_id?: string | null
          owner_id?: string
          panel?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "machine_desks_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_events: {
        Row: {
          created_at: string
          id: string
          job_id: string | null
          kind: string
          machine_id: string
          message: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id?: string | null
          kind: string
          machine_id: string
          message: string
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string | null
          kind?: string
          machine_id?: string
          message?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "machine_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "machine_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_events_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_follows: {
        Row: {
          created_at: string
          machine_id: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          machine_id: string
          owner_id: string
        }
        Update: {
          created_at?: string
          machine_id?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "machine_follows_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_funding_receipts: {
        Row: {
          amount_lamports: number
          cluster: string
          created_at: string
          id: string
          kind: string
          machine_id: string
          owner_id: string
          provenance: Json
          recipient: string
          sender: string
          signature: string
          slot: number
        }
        Insert: {
          amount_lamports: number
          cluster: string
          created_at?: string
          id?: string
          kind: string
          machine_id: string
          owner_id: string
          provenance: Json
          recipient: string
          sender: string
          signature: string
          slot: number
        }
        Update: {
          amount_lamports?: number
          cluster?: string
          created_at?: string
          id?: string
          kind?: string
          machine_id?: string
          owner_id?: string
          provenance?: Json
          recipient?: string
          sender?: string
          signature?: string
          slot?: number
        }
        Relationships: [
          {
            foreignKeyName: "machine_funding_receipts_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_generations: {
        Row: {
          baseline_commit: string
          candidate_commit: string
          candidate_id: string
          created_at: string
          decision: Json
          id: string
          machine_id: string
          parent_id: string | null
        }
        Insert: {
          baseline_commit: string
          candidate_commit: string
          candidate_id: string
          created_at?: string
          decision: Json
          id?: string
          machine_id: string
          parent_id?: string | null
        }
        Update: {
          baseline_commit?: string
          candidate_commit?: string
          candidate_id?: string
          created_at?: string
          decision?: Json
          id?: string
          machine_id?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machine_generations_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: true
            referencedRelation: "machine_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_generations_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_generations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "machine_generations"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_jobs: {
        Row: {
          attempts: number
          created_at: string
          deadline_at: string
          error: string | null
          finished_at: string | null
          id: string
          kind: string
          lease_token: string | null
          lease_until: string | null
          machine_id: string
          owner_id: string
          runner_id: string | null
          snapshot: Json
          status: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          deadline_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          kind?: string
          lease_token?: string | null
          lease_until?: string | null
          machine_id: string
          owner_id: string
          runner_id?: string | null
          snapshot: Json
          status?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          deadline_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          kind?: string
          lease_token?: string | null
          lease_until?: string | null
          machine_id?: string
          owner_id?: string
          runner_id?: string | null
          snapshot?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "machine_jobs_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_ledger: {
        Row: {
          amount_sol: number
          created_at: string
          detail: Json
          id: string
          kind: string
          machine_id: string
          owner_id: string
          signature: string | null
        }
        Insert: {
          amount_sol: number
          created_at?: string
          detail?: Json
          id?: string
          kind: string
          machine_id: string
          owner_id: string
          signature?: string | null
        }
        Update: {
          amount_sol?: number
          created_at?: string
          detail?: Json
          id?: string
          kind?: string
          machine_id?: string
          owner_id?: string
          signature?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machine_ledger_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_replays: {
        Row: {
          baseline_commit: string
          candidate_commit: string
          candidate_id: string
          created_at: string
          evidence: Json
          evidence_digest: string
          id: string
          machine_id: string
          owner_id: string
          patch_digest: string
          recipe_digest: string
          runner_id: string
          signature: string
          signed_bytes: string | null
          signed_payload: Json
          status: string
        }
        Insert: {
          baseline_commit: string
          candidate_commit: string
          candidate_id: string
          created_at?: string
          evidence: Json
          evidence_digest: string
          id?: string
          machine_id: string
          owner_id: string
          patch_digest: string
          recipe_digest: string
          runner_id: string
          signature: string
          signed_bytes?: string | null
          signed_payload?: Json
          status: string
        }
        Update: {
          baseline_commit?: string
          candidate_commit?: string
          candidate_id?: string
          created_at?: string
          evidence?: Json
          evidence_digest?: string
          id?: string
          machine_id?: string
          owner_id?: string
          patch_digest?: string
          recipe_digest?: string
          runner_id?: string
          signature?: string
          signed_bytes?: string | null
          signed_payload?: Json
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "machine_replays_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "machine_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_replays_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_replays_runner_id_fkey"
            columns: ["runner_id"]
            isOneToOne: false
            referencedRelation: "machine_runners"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_runner_challenges: {
        Row: {
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          label: string
          message: string
          nonce: string
          owner_id: string
          public_key: string
          replace_runner: string | null
          role: string
          signing_key_norm: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          label: string
          message: string
          nonce: string
          owner_id: string
          public_key: string
          replace_runner?: string | null
          role: string
          signing_key_norm: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          label?: string
          message?: string
          nonce?: string
          owner_id?: string
          public_key?: string
          replace_runner?: string | null
          role?: string
          signing_key_norm?: string
        }
        Relationships: []
      }
      machine_runners: {
        Row: {
          active: boolean
          created_at: string
          id: string
          key_verified_at: string | null
          label: string
          owner_id: string
          public_key: string
          replaced_by: string | null
          role: string
          signing_key_norm: string | null
          token_hash: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          key_verified_at?: string | null
          label: string
          owner_id: string
          public_key: string
          replaced_by?: string | null
          role: string
          signing_key_norm?: string | null
          token_hash: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          key_verified_at?: string | null
          label?: string
          owner_id?: string
          public_key?: string
          replaced_by?: string | null
          role?: string
          signing_key_norm?: string | null
          token_hash?: string
        }
        Relationships: []
      }
      machines: {
        Row: {
          created_at: string
          funding_config: Json | null
          head_commit: string | null
          id: string
          model: string
          name: string
          owner_id: string
          recipe: Json
          repository: Json
          runtime: string
          soul: string
          status: string
          symbol: string
          token_project_id: string | null
          updated_at: string
          visibility: string
        }
        Insert: {
          created_at?: string
          funding_config?: Json | null
          head_commit?: string | null
          id?: string
          model?: string
          name: string
          owner_id: string
          recipe: Json
          repository: Json
          runtime?: string
          soul?: string
          status?: string
          symbol?: string
          token_project_id?: string | null
          updated_at?: string
          visibility?: string
        }
        Update: {
          created_at?: string
          funding_config?: Json | null
          head_commit?: string | null
          id?: string
          model?: string
          name?: string
          owner_id?: string
          recipe?: Json
          repository?: Json
          runtime?: string
          soul?: string
          status?: string
          symbol?: string
          token_project_id?: string | null
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "machines_token_project_id_fkey"
            columns: ["token_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          preferred_cluster: string
          updated_at: string
          wallet_address: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          preferred_cluster?: string
          updated_at?: string
          wallet_address?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          preferred_cluster?: string
          updated_at?: string
          wallet_address?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          category: string
          cluster: string
          config_address: string | null
          created_at: string
          creator_wallet: string | null
          evidence: Json
          id: string
          image_url: string | null
          initial_market_cap_sol: number | null
          launch_signature: string | null
          launched_at: string | null
          migrated_at: string | null
          migration_market_cap_sol: number | null
          migration_signature: string | null
          mint_address: string | null
          owner_id: string
          pending_config: string | null
          pending_mint: string | null
          pool_address: string | null
          status: string
          symbol: string
          thesis: string
          title: string
          token_decimals: number | null
          token_supply: number | null
          treasury_address: string | null
          updated_at: string
          website_url: string | null
          x_url: string | null
        }
        Insert: {
          category: string
          cluster?: string
          config_address?: string | null
          created_at?: string
          creator_wallet?: string | null
          evidence?: Json
          id?: string
          image_url?: string | null
          initial_market_cap_sol?: number | null
          launch_signature?: string | null
          launched_at?: string | null
          migrated_at?: string | null
          migration_market_cap_sol?: number | null
          migration_signature?: string | null
          mint_address?: string | null
          owner_id: string
          pending_config?: string | null
          pending_mint?: string | null
          pool_address?: string | null
          status?: string
          symbol: string
          thesis: string
          title: string
          token_decimals?: number | null
          token_supply?: number | null
          treasury_address?: string | null
          updated_at?: string
          website_url?: string | null
          x_url?: string | null
        }
        Update: {
          category?: string
          cluster?: string
          config_address?: string | null
          created_at?: string
          creator_wallet?: string | null
          evidence?: Json
          id?: string
          image_url?: string | null
          initial_market_cap_sol?: number | null
          launch_signature?: string | null
          launched_at?: string | null
          migrated_at?: string | null
          migration_market_cap_sol?: number | null
          migration_signature?: string | null
          mint_address?: string | null
          owner_id?: string
          pending_config?: string | null
          pending_mint?: string | null
          pool_address?: string | null
          status?: string
          symbol?: string
          thesis?: string
          title?: string
          token_decimals?: number | null
          token_supply?: number | null
          treasury_address?: string | null
          updated_at?: string
          website_url?: string | null
          x_url?: string | null
        }
        Relationships: []
      }
      research_findings: {
        Row: {
          citations: Json
          created_at: string
          id: string
          kind: string
          owner_id: string
          role: string
          run_id: string
          statement: string
          step_id: string | null
          support_confidence: number | null
          support_prob: number | null
        }
        Insert: {
          citations?: Json
          created_at?: string
          id?: string
          kind: string
          owner_id: string
          role: string
          run_id: string
          statement: string
          step_id?: string | null
          support_confidence?: number | null
          support_prob?: number | null
        }
        Update: {
          citations?: Json
          created_at?: string
          id?: string
          kind?: string
          owner_id?: string
          role?: string
          run_id?: string
          statement?: string
          step_id?: string | null
          support_confidence?: number | null
          support_prob?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "research_findings_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "research_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_findings_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "research_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      research_runs: {
        Row: {
          cancel_requested: boolean
          checklist: Json | null
          created_at: string
          depth: string
          domain: Json | null
          error: string | null
          id: string
          owner_id: string
          paper_query: string | null
          prompt_version: string | null
          question: string
          result: string | null
          roles: string[]
          source_text: string | null
          stage: string
          stance: string
          status: string
          updated_at: string
          upload_path: string | null
          usage: Json
        }
        Insert: {
          cancel_requested?: boolean
          checklist?: Json | null
          created_at?: string
          depth?: string
          domain?: Json | null
          error?: string | null
          id?: string
          owner_id: string
          paper_query?: string | null
          prompt_version?: string | null
          question: string
          result?: string | null
          roles?: string[]
          source_text?: string | null
          stage?: string
          stance?: string
          status?: string
          updated_at?: string
          upload_path?: string | null
          usage?: Json
        }
        Update: {
          cancel_requested?: boolean
          checklist?: Json | null
          created_at?: string
          depth?: string
          domain?: Json | null
          error?: string | null
          id?: string
          owner_id?: string
          paper_query?: string | null
          prompt_version?: string | null
          question?: string
          result?: string | null
          roles?: string[]
          source_text?: string | null
          stage?: string
          stance?: string
          status?: string
          updated_at?: string
          upload_path?: string | null
          usage?: Json
        }
        Relationships: []
      }
      research_sources: {
        Row: {
          authors: string | null
          body: string | null
          created_at: string
          external_id: string | null
          id: string
          included: boolean
          owner_id: string
          provider: string
          ref: string
          relevance: number | null
          run_id: string
          text_kind: string
          title: string
          url: string | null
          year: number | null
        }
        Insert: {
          authors?: string | null
          body?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          included?: boolean
          owner_id: string
          provider: string
          ref: string
          relevance?: number | null
          run_id: string
          text_kind: string
          title: string
          url?: string | null
          year?: number | null
        }
        Update: {
          authors?: string | null
          body?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          included?: boolean
          owner_id?: string
          provider?: string
          ref?: string
          relevance?: number | null
          run_id?: string
          text_kind?: string
          title?: string
          url?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "research_sources_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "research_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      research_steps: {
        Row: {
          error: string | null
          finished_at: string | null
          id: string
          kind: string
          model: string | null
          output: Json | null
          owner_id: string
          prompt_version: string | null
          provider: string | null
          role: string | null
          run_id: string
          seq: number
          started_at: string | null
          status: string
          summary: string | null
          usage: Json | null
        }
        Insert: {
          error?: string | null
          finished_at?: string | null
          id?: string
          kind: string
          model?: string | null
          output?: Json | null
          owner_id: string
          prompt_version?: string | null
          provider?: string | null
          role?: string | null
          run_id: string
          seq: number
          started_at?: string | null
          status?: string
          summary?: string | null
          usage?: Json | null
        }
        Update: {
          error?: string | null
          finished_at?: string | null
          id?: string
          kind?: string
          model?: string | null
          output?: Json | null
          owner_id?: string
          prompt_version?: string | null
          provider?: string | null
          role?: string | null
          run_id?: string
          seq?: number
          started_at?: string | null
          status?: string
          summary?: string | null
          usage?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "research_steps_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "research_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_auth_challenges: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          message: string
          nonce: string
          used_at: string | null
          wallet: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          message: string
          nonce: string
          used_at?: string | null
          wallet: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          message?: string
          nonce?: string
          used_at?: string | null
          wallet?: string
        }
        Relationships: []
      }
      watchlist: {
        Row: {
          address: string
          cluster: string
          created_at: string
          id: string
          label: string
          owner_id: string
        }
        Insert: {
          address: string
          cluster?: string
          created_at?: string
          id?: string
          label: string
          owner_id: string
        }
        Update: {
          address?: string
          cluster?: string
          created_at?: string
          id?: string
          label?: string
          owner_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cancel_machine_jobs: {
        Args: { p_machine: string; p_owner: string }
        Returns: undefined
      }
      commit_machine_callback: {
        Args: {
          p_bytes: string
          p_digest: string
          p_evidence_digest: string
          p_fail?: boolean
          p_job: string
          p_lease: string
          p_patch_digest: string
          p_payload: Json
          p_recipe_digest: string
          p_runner: string
          p_signature: string
        }
        Returns: Json
      }
      enroll_machine_runner: {
        Args: {
          p_challenge: string
          p_key_norm: string
          p_owner: string
          p_token_hash: string
        }
        Returns: Json
      }
      finish_machine_job: {
        Args: {
          p_job: string
          p_lease: string
          p_runner: string
          p_status: string
        }
        Returns: {
          attempts: number
          created_at: string
          deadline_at: string
          error: string | null
          finished_at: string | null
          id: string
          kind: string
          lease_token: string | null
          lease_until: string | null
          machine_id: string
          owner_id: string
          runner_id: string | null
          snapshot: Json
          status: string
        }[]
        SetofOptions: {
          from: "*"
          to: "machine_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      heartbeat_machine_job: {
        Args: { p_job: string; p_lease: string; p_runner: string }
        Returns: string
      }
      lease_machine_job: {
        Args: { p_runner: string }
        Returns: {
          attempts: number
          created_at: string
          deadline_at: string
          error: string | null
          finished_at: string | null
          id: string
          kind: string
          lease_token: string | null
          lease_until: string | null
          machine_id: string
          owner_id: string
          runner_id: string | null
          snapshot: Json
          status: string
        }[]
        SetofOptions: {
          from: "*"
          to: "machine_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      publish_machine_generation: {
        Args: { p_candidate: string; p_decision: Json; p_replays: string[] }
        Returns: Json
      }
      queue_machine_author: {
        Args: { p_machine: string; p_owner: string }
        Returns: Json
      }
      record_machine_funding: {
        Args: {
          p_amount: string
          p_cluster: string
          p_machine: string
          p_owner: string
          p_provenance: Json
          p_recipient: string
          p_sender: string
          p_signature: string
          p_slot: number
        }
        Returns: Json
      }
      reserve_author_attempt: {
        Args: {
          p_digest: string
          p_id: string
          p_job: string
          p_lease: string
          p_runner: string
        }
        Returns: Json
      }
      test_machine_head_and_receipts: { Args: never; Returns: Json }
      test_machine_pipeline_atomicity: { Args: never; Returns: Json }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
