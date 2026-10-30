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
      accounts: {
        Row: {
          archived: boolean
          created_at: string
          household_id: string
          id: string
          name: string
          opening_cents: number
          owner_user_id: string
          updated_at: string
          version: number
        }
        Insert: {
          archived?: boolean
          created_at?: string
          household_id: string
          id: string
          name: string
          opening_cents?: number
          owner_user_id?: string
          updated_at?: string
          version?: number
        }
        Update: {
          archived?: boolean
          created_at?: string
          household_id?: string
          id?: string
          name?: string
          opening_cents?: number
          owner_user_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "accounts_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          acquired_on: string | null
          archived: boolean
          created_at: string
          household_id: string
          id: string
          name: string
          notes: string
          owner_user_id: string
          scope: string
          updated_at: string
          value_cents: number
          version: number
        }
        Insert: {
          acquired_on?: string | null
          archived?: boolean
          created_at?: string
          household_id: string
          id: string
          name: string
          notes?: string
          owner_user_id?: string
          scope?: string
          updated_at?: string
          value_cents: number
          version?: number
        }
        Update: {
          acquired_on?: string | null
          archived?: boolean
          created_at?: string
          household_id?: string
          id?: string
          name?: string
          notes?: string
          owner_user_id?: string
          scope?: string
          updated_at?: string
          value_cents?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "assets_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          created_at: string
          details: Json
          entity_id: string
          household_id: string
          id: string
          owner_user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details: Json
          entity_id: string
          household_id: string
          id?: string
          owner_user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json
          entity_id?: string
          household_id?: string
          id?: string
          owner_user_id?: string
        }
        Relationships: []
      }
      budgets: {
        Row: {
          archived: boolean
          category: string
          created_at: string
          household_id: string
          id: string
          limit_cents: number
          month: string
          owner_user_id: string
          scope: string
          updated_at: string
          version: number
        }
        Insert: {
          archived?: boolean
          category: string
          created_at?: string
          household_id: string
          id: string
          limit_cents: number
          month: string
          owner_user_id?: string
          scope?: string
          updated_at?: string
          version?: number
        }
        Update: {
          archived?: boolean
          category?: string
          created_at?: string
          household_id?: string
          id?: string
          limit_cents?: number
          month?: string
          owner_user_id?: string
          scope?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "budgets_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      card_installments: {
        Row: {
          amount_cents: number
          card_id: string
          due_on: string
          id: string
          number: number
          transaction_id: string
        }
        Insert: {
          amount_cents: number
          card_id: string
          due_on: string
          id?: string
          number: number
          transaction_id: string
        }
        Update: {
          amount_cents?: number
          card_id?: string
          due_on?: string
          id?: string
          number?: number
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_installments_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_installments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      cards: {
        Row: {
          archived: boolean
          closing_day: number
          created_at: string
          due_day: number
          household_id: string
          id: string
          limit_cents: number
          name: string
          owner_user_id: string
          updated_at: string
          version: number
        }
        Insert: {
          archived?: boolean
          closing_day: number
          created_at?: string
          due_day: number
          household_id: string
          id: string
          limit_cents: number
          name: string
          owner_user_id?: string
          updated_at?: string
          version?: number
        }
        Update: {
          archived?: boolean
          closing_day?: number
          created_at?: string
          due_day?: number
          household_id?: string
          id?: string
          limit_cents?: number
          name?: string
          owner_user_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "cards_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          archived: boolean
          created_at: string
          household_id: string
          id: string
          name: string
          owner_user_id: string
          parent_name: string
          scope: string
          updated_at: string
          version: number
        }
        Insert: {
          archived?: boolean
          created_at?: string
          household_id: string
          id: string
          name: string
          owner_user_id?: string
          parent_name?: string
          scope?: string
          updated_at?: string
          version?: number
        }
        Update: {
          archived?: boolean
          created_at?: string
          household_id?: string
          id?: string
          name?: string
          owner_user_id?: string
          parent_name?: string
          scope?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "categories_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          archived: boolean
          checksum: string
          created_at: string
          filename: string
          household_id: string
          id: string
          mime_type: string
          notes: string
          owner_user_id: string
          scope: string
          size_bytes: number
          transaction_id: string | null
          updated_at: string
          upload_status: string
          version: number
          warranty_until: string | null
        }
        Insert: {
          archived?: boolean
          checksum: string
          created_at?: string
          filename: string
          household_id: string
          id: string
          mime_type: string
          notes?: string
          owner_user_id?: string
          scope?: string
          size_bytes: number
          transaction_id?: string | null
          updated_at?: string
          upload_status?: string
          version?: number
          warranty_until?: string | null
        }
        Update: {
          archived?: boolean
          checksum?: string
          created_at?: string
          filename?: string
          household_id?: string
          id?: string
          mime_type?: string
          notes?: string
          owner_user_id?: string
          scope?: string
          size_bytes?: number
          transaction_id?: string | null
          updated_at?: string
          upload_status?: string
          version?: number
          warranty_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      due_items: {
        Row: {
          amount_cents: number
          archived: boolean
          category: string
          created_at: string
          description: string
          due_on: string
          household_id: string
          id: string
          owner_user_id: string
          paid_transaction_id: string | null
          recurring_rule_id: string | null
          scope: string
          updated_at: string
          version: number
        }
        Insert: {
          amount_cents: number
          archived?: boolean
          category?: string
          created_at?: string
          description: string
          due_on: string
          household_id: string
          id: string
          owner_user_id?: string
          paid_transaction_id?: string | null
          recurring_rule_id?: string | null
          scope?: string
          updated_at?: string
          version?: number
        }
        Update: {
          amount_cents?: number
          archived?: boolean
          category?: string
          created_at?: string
          description?: string
          due_on?: string
          household_id?: string
          id?: string
          owner_user_id?: string
          paid_transaction_id?: string | null
          recurring_rule_id?: string | null
          scope?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "due_items_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "due_items_paid_transaction_id_fkey"
            columns: ["paid_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "due_items_recurring_rule_id_fkey"
            columns: ["recurring_rule_id"]
            isOneToOne: false
            referencedRelation: "recurring_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_operations: {
        Row: {
          created_at: string
          id: string
          payload: Json
          result_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id: string
          payload: Json
          result_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
          result_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_operations_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_contributions: {
        Row: {
          amount_cents: number
          archived: boolean
          created_at: string
          goal_id: string
          household_id: string
          id: string
          occurred_on: string
          owner_user_id: string
          scope: string
          updated_at: string
          version: number
        }
        Insert: {
          amount_cents: number
          archived?: boolean
          created_at?: string
          goal_id: string
          household_id: string
          id: string
          occurred_on: string
          owner_user_id?: string
          scope?: string
          updated_at?: string
          version?: number
        }
        Update: {
          amount_cents?: number
          archived?: boolean
          created_at?: string
          goal_id?: string
          household_id?: string
          id?: string
          occurred_on?: string
          owner_user_id?: string
          scope?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "goal_contributions_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_contributions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          archived: boolean
          created_at: string
          due_on: string | null
          household_id: string
          id: string
          name: string
          owner_user_id: string
          scope: string
          target_cents: number
          updated_at: string
          version: number
        }
        Insert: {
          archived?: boolean
          created_at?: string
          due_on?: string | null
          household_id: string
          id: string
          name: string
          owner_user_id?: string
          scope?: string
          target_cents: number
          updated_at?: string
          version?: number
        }
        Update: {
          archived?: boolean
          created_at?: string
          due_on?: string | null
          household_id?: string
          id?: string
          name?: string
          owner_user_id?: string
          scope?: string
          target_cents?: number
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "goals_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      invoice_payments: {
        Row: {
          amount_cents: number
          card_id: string
          due_on: string
          transaction_id: string
        }
        Insert: {
          amount_cents: number
          card_id: string
          due_on: string
          transaction_id: string
        }
        Update: {
          amount_cents?: number
          card_id?: string
          due_on?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          account_id: string
          amount_cents: number
          created_at: string
          id: string
          transaction_id: string
        }
        Insert: {
          account_id: string
          amount_cents: number
          created_at?: string
          id?: string
          transaction_id: string
        }
        Update: {
          account_id?: string
          amount_cents?: number
          created_at?: string
          id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          household_id: string
          role: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          household_id: string
          role: string
          status: string
          user_id: string
        }
        Update: {
          created_at?: string
          household_id?: string
          role?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string
          created_at: string
          display_name: string
          user_id: string
        }
        Insert: {
          avatar_path?: string
          created_at?: string
          display_name: string
          user_id: string
        }
        Update: {
          avatar_path?: string
          created_at?: string
          display_name?: string
          user_id?: string
        }
        Relationships: []
      }
      receipt_items: {
        Row: {
          archived: boolean
          brand: string
          created_at: string
          document_id: string
          household_id: string
          id: string
          merchant: string
          owner_user_id: string
          product_key: string
          purchased_on: string
          quantity: number
          scope: string
          total_cents: number
          unit: string
          updated_at: string
          version: number
        }
        Insert: {
          archived?: boolean
          brand?: string
          created_at?: string
          document_id: string
          household_id: string
          id: string
          merchant?: string
          owner_user_id?: string
          product_key: string
          purchased_on: string
          quantity: number
          scope?: string
          total_cents: number
          unit: string
          updated_at?: string
          version?: number
        }
        Update: {
          archived?: boolean
          brand?: string
          created_at?: string
          document_id?: string
          household_id?: string
          id?: string
          merchant?: string
          owner_user_id?: string
          product_key?: string
          purchased_on?: string
          quantity?: number
          scope?: string
          total_cents?: number
          unit?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "receipt_items_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_items_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_rules: {
        Row: {
          amount_cents: number
          archived: boolean
          category: string
          created_at: string
          day: number
          description: string
          end_on: string | null
          household_id: string
          id: string
          owner_user_id: string
          scope: string
          start_on: string
          updated_at: string
          version: number
        }
        Insert: {
          amount_cents: number
          archived?: boolean
          category?: string
          created_at?: string
          day: number
          description: string
          end_on?: string | null
          household_id: string
          id: string
          owner_user_id?: string
          scope?: string
          start_on: string
          updated_at?: string
          version?: number
        }
        Update: {
          amount_cents?: number
          archived?: boolean
          category?: string
          created_at?: string
          day?: number
          description?: string
          end_on?: string | null
          household_id?: string
          id?: string
          owner_user_id?: string
          scope?: string
          start_on?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "recurring_rules_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_items: {
        Row: {
          archived: boolean
          created_at: string
          household_id: string
          id: string
          name: string
          owner_user_id: string
          purchased: boolean
          quantity: number
          scope: string
          unit: string
          updated_at: string
          version: number
        }
        Insert: {
          archived?: boolean
          created_at?: string
          household_id: string
          id: string
          name: string
          owner_user_id?: string
          purchased?: boolean
          quantity?: number
          scope?: string
          unit?: string
          updated_at?: string
          version?: number
        }
        Update: {
          archived?: boolean
          created_at?: string
          household_id?: string
          id?: string
          name?: string
          owner_user_id?: string
          purchased?: boolean
          quantity?: number
          scope?: string
          unit?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "shopping_items_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount_cents: number
          category: string
          created_at: string
          description: string
          household_id: string
          id: string
          kind: string
          merchant: string
          method: string
          occurred_on: string
          owner_user_id: string
          scope: string
          status: string
          version: number
        }
        Insert: {
          amount_cents: number
          category?: string
          created_at?: string
          description: string
          household_id: string
          id: string
          kind: string
          merchant?: string
          method: string
          occurred_on: string
          owner_user_id: string
          scope: string
          status?: string
          version?: number
        }
        Update: {
          amount_cents?: number
          category?: string
          created_at?: string
          description?: string
          household_id?: string
          id?: string
          kind?: string
          merchant?: string
          method?: string
          occurred_on?: string
          owner_user_id?: string
          scope?: string
          status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "transactions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      post_transaction: {
        Args: { operation_id: string; payload: Json }
        Returns: string
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

