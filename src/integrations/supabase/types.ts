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
          created_at: string
          evidence: Json
          id: string
          owner_id: string
          status: string
          symbol: string
          thesis: string
          title: string
          token_decimals: number | null
          token_supply: number | null
          treasury_address: string | null
          updated_at: string
        }
        Insert: {
          category: string
          cluster?: string
          created_at?: string
          evidence?: Json
          id?: string
          owner_id: string
          status?: string
          symbol: string
          thesis: string
          title: string
          token_decimals?: number | null
          token_supply?: number | null
          treasury_address?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          cluster?: string
          created_at?: string
          evidence?: Json
          id?: string
          owner_id?: string
          status?: string
          symbol?: string
          thesis?: string
          title?: string
          token_decimals?: number | null
          token_supply?: number | null
          treasury_address?: string | null
          updated_at?: string
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
      [_ in never]: never
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
