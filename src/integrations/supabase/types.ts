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
      machine_runners: {
        Row: {
          active: boolean
          created_at: string
          id: string
          label: string
          owner_id: string
          public_key: string
          role: string
          token_hash: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          label: string
          owner_id: string
          public_key: string
          role: string
          token_hash: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          label?: string
          owner_id?: string
          public_key?: string
          role?: string
          token_hash?: string
        }
        Relationships: []
      }
      machines: {
        Row: {
          created_at: string
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
      lease_machine_job: {
        Args: { p_runner: string }
        Returns: {
          attempts: number
          created_at: string
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
