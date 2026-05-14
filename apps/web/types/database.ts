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
      board_columns: {
        Row: {
          board_id: string
          color: string | null
          created_at: string | null
          id: string
          is_done_column: boolean | null
          name: string
          position: number
          updated_at: string | null
          wip_limit: number | null
        }
        Insert: {
          board_id: string
          color?: string | null
          created_at?: string | null
          id?: string
          is_done_column?: boolean | null
          name: string
          position: number
          updated_at?: string | null
          wip_limit?: number | null
        }
        Update: {
          board_id?: string
          color?: string | null
          created_at?: string | null
          id?: string
          is_done_column?: boolean | null
          name?: string
          position?: number
          updated_at?: string | null
          wip_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "board_columns_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      board_sectors: {
        Row: {
          board_id: string
          id: string
          sector_id: string
        }
        Insert: {
          board_id: string
          id?: string
          sector_id: string
        }
        Update: {
          board_id?: string
          id?: string
          sector_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_sectors_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_sectors_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      boards: {
        Row: {
          board_type: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          module_id: string | null
          name: string
          updated_at: string | null
          visibility: string | null
        }
        Insert: {
          board_type?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          module_id?: string | null
          name: string
          updated_at?: string | null
          visibility?: string | null
        }
        Update: {
          board_type?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          module_id?: string | null
          name?: string
          updated_at?: string | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "boards_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boards_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      canned_responses: {
        Row: {
          category: string | null
          content: string
          created_at: string | null
          created_by: string
          id: string
          is_active: boolean | null
          sector_id: string
          shortcut: string | null
          title: string
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string | null
          created_by: string
          id?: string
          is_active?: boolean | null
          sector_id: string
          shortcut?: string | null
          title: string
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string | null
          created_by?: string
          id?: string
          is_active?: boolean | null
          sector_id?: string
          shortcut?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "canned_responses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canned_responses_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      card_activity_log: {
        Row: {
          action: string
          card_id: string
          created_at: string | null
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          action: string
          card_id: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          action?: string
          card_id?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_activity_log_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_activity_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      card_assignees: {
        Row: {
          card_id: string
          user_id: string
        }
        Insert: {
          card_id: string
          user_id: string
        }
        Update: {
          card_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_assignees_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_assignees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      card_attachments: {
        Row: {
          card_id: string
          created_at: string | null
          file_name: string
          file_size: number
          file_url: string
          id: string
          mime_type: string
          uploaded_by: string
        }
        Insert: {
          card_id: string
          created_at?: string | null
          file_name: string
          file_size: number
          file_url: string
          id?: string
          mime_type: string
          uploaded_by: string
        }
        Update: {
          card_id?: string
          created_at?: string | null
          file_name?: string
          file_size?: number
          file_url?: string
          id?: string
          mime_type?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_attachments_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      card_checklists: {
        Row: {
          card_id: string
          id: string
          position: number
          title: string
        }
        Insert: {
          card_id: string
          id?: string
          position: number
          title: string
        }
        Update: {
          card_id?: string
          id?: string
          position?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_checklists_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      card_comments: {
        Row: {
          card_id: string
          content: string
          created_at: string | null
          id: string
          is_active: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          card_id: string
          content: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          card_id?: string
          content?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_comments_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      card_cross_references: {
        Row: {
          created_at: string | null
          created_by: string
          id: string
          reference_type: string
          source_card_id: string
          status: string | null
          target_card_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          id?: string
          reference_type: string
          source_card_id: string
          status?: string | null
          target_card_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          id?: string
          reference_type?: string
          source_card_id?: string
          status?: string | null
          target_card_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "card_cross_references_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_cross_references_source_card_id_fkey"
            columns: ["source_card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_cross_references_target_card_id_fkey"
            columns: ["target_card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      card_tags: {
        Row: {
          card_id: string
          tag_id: string
        }
        Insert: {
          card_id: string
          tag_id: string
        }
        Update: {
          card_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_tags_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      card_templates: {
        Row: {
          created_at: string | null
          created_by: string
          default_checklist: Json | null
          default_description: string | null
          default_priority: string | null
          default_title: string | null
          id: string
          is_active: boolean | null
          name: string
          sector_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          default_checklist?: Json | null
          default_description?: string | null
          default_priority?: string | null
          default_title?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sector_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          default_checklist?: Json | null
          default_description?: string | null
          default_priority?: string | null
          default_title?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sector_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "card_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_templates_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      cards: {
        Row: {
          board_id: string
          column_id: string
          completed_at: string | null
          created_at: string | null
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          is_active: boolean | null
          parent_card_id: string | null
          position: number
          priority: string | null
          sector_id: string
          start_date: string | null
          template_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          board_id: string
          column_id: string
          completed_at?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_active?: boolean | null
          parent_card_id?: string | null
          position: number
          priority?: string | null
          sector_id: string
          start_date?: string | null
          template_id?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          board_id?: string
          column_id?: string
          completed_at?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_active?: boolean | null
          parent_card_id?: string | null
          position?: number
          priority?: string | null
          sector_id?: string
          start_date?: string | null
          template_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cards_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "board_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_parent_card_id_fkey"
            columns: ["parent_card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "card_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          checklist_id: string
          completed_by: string | null
          content: string
          id: string
          is_completed: boolean | null
          position: number
        }
        Insert: {
          checklist_id: string
          completed_by?: string | null
          content: string
          id?: string
          is_completed?: boolean | null
          position: number
        }
        Update: {
          checklist_id?: string
          completed_by?: string | null
          content?: string
          id?: string
          is_completed?: boolean | null
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "card_checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_items_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_activities: {
        Row: {
          company_id: string | null
          completed_at: string | null
          contact_id: string | null
          created_at: string | null
          deal_id: string | null
          description: string | null
          duration_min: number | null
          id: string
          is_active: boolean | null
          performed_by: string
          scheduled_at: string | null
          sector_id: string
          subject: string
          type: string
        }
        Insert: {
          company_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          description?: string | null
          duration_min?: number | null
          id?: string
          is_active?: boolean | null
          performed_by: string
          scheduled_at?: string | null
          sector_id: string
          subject: string
          type: string
        }
        Update: {
          company_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          description?: string | null
          duration_min?: number | null
          id?: string
          is_active?: boolean | null
          performed_by?: string
          scheduled_at?: string | null
          sector_id?: string
          subject?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_activities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "crm_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_companies: {
        Row: {
          address: string | null
          city: string | null
          created_at: string | null
          domain: string | null
          email: string | null
          id: string
          industry: string | null
          is_active: boolean | null
          name: string
          notes: string | null
          owner_id: string | null
          phone: string | null
          sector_id: string
          size: string | null
          state: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string | null
          domain?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          is_active?: boolean | null
          name: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          sector_id: string
          size?: string | null
          state?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string | null
          domain?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          is_active?: boolean | null
          name?: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          sector_id?: string
          size?: string | null
          state?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_companies_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_companies_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_contacts: {
        Row: {
          company_id: string | null
          created_at: string | null
          email: string | null
          full_name: string
          id: string
          is_active: boolean | null
          is_primary: boolean | null
          notes: string | null
          owner_id: string | null
          phone: string | null
          position: string | null
          sector_id: string
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          position?: string | null
          sector_id: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          position?: string | null
          sector_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "crm_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_contacts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_contacts_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_deals: {
        Row: {
          actual_close_date: string | null
          card_id: string
          company_id: string | null
          contact_id: string | null
          created_at: string | null
          currency: string | null
          expected_close_date: string | null
          id: string
          is_active: boolean | null
          lost_reason: string | null
          sector_id: string
          source: string | null
          updated_at: string | null
          value: number | null
          win_probability: number | null
        }
        Insert: {
          actual_close_date?: string | null
          card_id: string
          company_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          currency?: string | null
          expected_close_date?: string | null
          id?: string
          is_active?: boolean | null
          lost_reason?: string | null
          sector_id: string
          source?: string | null
          updated_at?: string | null
          value?: number | null
          win_probability?: number | null
        }
        Update: {
          actual_close_date?: string | null
          card_id?: string
          company_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          currency?: string | null
          expected_close_date?: string | null
          id?: string
          is_active?: boolean | null
          lost_reason?: string | null
          sector_id?: string
          source?: string | null
          updated_at?: string | null
          value?: number | null
          win_probability?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_deals_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: true
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "crm_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_proposals: {
        Row: {
          content: string | null
          created_at: string | null
          created_by: string
          deal_id: string
          expires_at: string | null
          id: string
          is_active: boolean | null
          sector_id: string
          sent_at: string | null
          status: string | null
          title: string
          updated_at: string | null
          value: number | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          created_by: string
          deal_id: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          sector_id: string
          sent_at?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
          value?: number | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          created_by?: string
          deal_id?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          sector_id?: string
          sent_at?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_proposals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_proposals_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_proposals_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_candidates: {
        Row: {
          card_id: string
          created_at: string | null
          current_company: string | null
          current_position: string | null
          email: string
          expected_salary: number | null
          full_name: string
          id: string
          is_active: boolean | null
          job_opening_id: string
          linkedin_url: string | null
          notes: string | null
          phone: string | null
          rating: number | null
          rejection_reason: string | null
          resume_url: string | null
          sector_id: string
          source: string | null
          updated_at: string | null
        }
        Insert: {
          card_id: string
          created_at?: string | null
          current_company?: string | null
          current_position?: string | null
          email: string
          expected_salary?: number | null
          full_name: string
          id?: string
          is_active?: boolean | null
          job_opening_id: string
          linkedin_url?: string | null
          notes?: string | null
          phone?: string | null
          rating?: number | null
          rejection_reason?: string | null
          resume_url?: string | null
          sector_id: string
          source?: string | null
          updated_at?: string | null
        }
        Update: {
          card_id?: string
          created_at?: string | null
          current_company?: string | null
          current_position?: string | null
          email?: string
          expected_salary?: number | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          job_opening_id?: string
          linkedin_url?: string | null
          notes?: string | null
          phone?: string | null
          rating?: number | null
          rejection_reason?: string | null
          resume_url?: string | null
          sector_id?: string
          source?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_candidates_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: true
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_candidates_job_opening_id_fkey"
            columns: ["job_opening_id"]
            isOneToOne: false
            referencedRelation: "hr_job_openings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_candidates_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_employees: {
        Row: {
          birth_date: string | null
          created_at: string | null
          department: string | null
          email: string
          employment_type: string
          full_name: string
          hire_date: string
          id: string
          is_active: boolean | null
          manager_id: string | null
          notes: string | null
          phone: string | null
          position: string | null
          sector_id: string
          status: string
          termination_date: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          birth_date?: string | null
          created_at?: string | null
          department?: string | null
          email: string
          employment_type?: string
          full_name: string
          hire_date: string
          id?: string
          is_active?: boolean | null
          manager_id?: string | null
          notes?: string | null
          phone?: string | null
          position?: string | null
          sector_id: string
          status?: string
          termination_date?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          birth_date?: string | null
          created_at?: string | null
          department?: string | null
          email?: string
          employment_type?: string
          full_name?: string
          hire_date?: string
          id?: string
          is_active?: boolean | null
          manager_id?: string | null
          notes?: string | null
          phone?: string | null
          position?: string | null
          sector_id?: string
          status?: string
          termination_date?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "hr_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_employees_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_employees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_job_openings: {
        Row: {
          board_id: string | null
          created_at: string | null
          department: string | null
          description: string | null
          employment_type: string
          hiring_manager_id: string
          id: string
          is_active: boolean | null
          location: string | null
          max_candidates: number | null
          requirements: string | null
          salary_range: string | null
          sector_id: string
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          board_id?: string | null
          created_at?: string | null
          department?: string | null
          description?: string | null
          employment_type?: string
          hiring_manager_id: string
          id?: string
          is_active?: boolean | null
          location?: string | null
          max_candidates?: number | null
          requirements?: string | null
          salary_range?: string | null
          sector_id: string
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          board_id?: string | null
          created_at?: string | null
          department?: string | null
          description?: string | null
          employment_type?: string
          hiring_manager_id?: string
          id?: string
          is_active?: boolean | null
          location?: string | null
          max_candidates?: number | null
          requirements?: string | null
          salary_range?: string | null
          sector_id?: string
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_job_openings_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_job_openings_hiring_manager_id_fkey"
            columns: ["hiring_manager_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_job_openings_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_onboarding_instances: {
        Row: {
          completed_at: string | null
          created_at: string | null
          employee_id: string
          id: string
          sector_id: string
          start_date: string
          status: string
          template_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          employee_id: string
          id?: string
          sector_id: string
          start_date?: string
          status?: string
          template_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          employee_id?: string
          id?: string
          sector_id?: string
          start_date?: string
          status?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_onboarding_instances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "hr_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_onboarding_instances_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_onboarding_instances_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "hr_onboarding_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_onboarding_items: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          completed_by: string | null
          description: string | null
          due_date: string | null
          id: string
          is_completed: boolean | null
          onboarding_id: string
          position: number
          title: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_completed?: boolean | null
          onboarding_id: string
          position: number
          title: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          completed_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_completed?: boolean | null
          onboarding_id?: string
          position?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_onboarding_items_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_onboarding_items_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_onboarding_items_onboarding_id_fkey"
            columns: ["onboarding_id"]
            isOneToOne: false
            referencedRelation: "hr_onboarding_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_onboarding_templates: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          items: Json | null
          name: string
          position: string | null
          sector_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          items?: Json | null
          name: string
          position?: string | null
          sector_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          items?: Json | null
          name?: string
          position?: string | null
          sector_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_onboarding_templates_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_time_off_balances: {
        Row: {
          employee_id: string
          id: string
          pending_days: number
          policy_id: string
          total_days: number
          used_days: number
          year: number
        }
        Insert: {
          employee_id: string
          id?: string
          pending_days?: number
          policy_id: string
          total_days: number
          used_days?: number
          year: number
        }
        Update: {
          employee_id?: string
          id?: string
          pending_days?: number
          policy_id?: string
          total_days?: number
          used_days?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "hr_time_off_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "hr_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_time_off_balances_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "hr_time_off_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_time_off_policies: {
        Row: {
          created_at: string | null
          days_per_year: number
          id: string
          is_active: boolean | null
          max_consecutive_days: number | null
          name: string
          requires_approval: boolean | null
          sector_id: string
        }
        Insert: {
          created_at?: string | null
          days_per_year: number
          id?: string
          is_active?: boolean | null
          max_consecutive_days?: number | null
          name: string
          requires_approval?: boolean | null
          sector_id: string
        }
        Update: {
          created_at?: string | null
          days_per_year?: number
          id?: string
          is_active?: boolean | null
          max_consecutive_days?: number | null
          name?: string
          requires_approval?: boolean | null
          sector_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_time_off_policies_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_time_off_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          days_count: number
          employee_id: string
          end_date: string
          id: string
          is_active: boolean | null
          policy_id: string
          reason: string | null
          rejection_reason: string | null
          sector_id: string
          start_date: string
          status: string
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          days_count: number
          employee_id: string
          end_date: string
          id?: string
          is_active?: boolean | null
          policy_id: string
          reason?: string | null
          rejection_reason?: string | null
          sector_id: string
          start_date: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          days_count?: number
          employee_id?: string
          end_date?: string
          id?: string
          is_active?: boolean | null
          policy_id?: string
          reason?: string | null
          rejection_reason?: string | null
          sector_id?: string
          start_date?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_time_off_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_time_off_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "hr_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_time_off_requests_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "hr_time_off_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_time_off_requests_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          created_at: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string
          role_id: string
          sector_id: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          invited_by: string
          role_id: string
          sector_id: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role_id?: string
          sector_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_articles: {
        Row: {
          author_id: string
          category: string | null
          content: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          is_published: boolean | null
          sector_id: string
          tags: string[] | null
          title: string
          updated_at: string | null
          view_count: number | null
        }
        Insert: {
          author_id: string
          category?: string | null
          content?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_published?: boolean | null
          sector_id: string
          tags?: string[] | null
          title: string
          updated_at?: string | null
          view_count?: number | null
        }
        Update: {
          author_id?: string
          category?: string | null
          content?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_published?: boolean | null
          sector_id?: string
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_articles_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_articles_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
          settings_schema: Json | null
          slug: string
          status: string | null
          version: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          settings_schema?: Json | null
          slug: string
          status?: string | null
          version?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          settings_schema?: Json | null
          slug?: string
          status?: string | null
          version?: string | null
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          channel: string | null
          id: string
          type: string
          user_id: string
        }
        Insert: {
          channel?: string | null
          id?: string
          type: string
          user_id: string
        }
        Update: {
          channel?: string | null
          id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          resource_id: string
          resource_type: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          resource_id: string
          resource_type: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          resource_id?: string
          resource_type?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          action: string
          id: string
          module_id: string
          resource: string
        }
        Insert: {
          action: string
          id?: string
          module_id: string
          resource: string
        }
        Update: {
          action?: string
          id?: string
          module_id?: string
          resource?: string
        }
        Relationships: [
          {
            foreignKeyName: "permissions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      project_cards: {
        Row: {
          card_id: string
          project_id: string
        }
        Insert: {
          card_id: string
          project_id: string
        }
        Update: {
          card_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_cards_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_cards_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_sectors: {
        Row: {
          project_id: string
          sector_id: string
        }
        Insert: {
          project_id: string
          sector_id: string
        }
        Update: {
          project_id?: string
          sector_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_sectors_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_sectors_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          start_date: string | null
          status: string | null
          target_date: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          start_date?: string | null
          status?: string | null
          target_date?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          start_date?: string | null
          status?: string | null
          target_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          id: string
          permission_id: string
          role_id: string
        }
        Insert: {
          id?: string
          permission_id: string
          role_id: string
        }
        Update: {
          id?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string | null
          id: string
          is_system: boolean | null
          level: number
          name: string
          scope: string | null
          slug: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_system?: boolean | null
          level: number
          name: string
          scope?: string | null
          slug: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_system?: boolean | null
          level?: number
          name?: string
          scope?: string | null
          slug?: string
        }
        Relationships: []
      }
      saved_views: {
        Row: {
          board_id: string | null
          created_at: string | null
          filters: Json
          id: string
          is_default: boolean | null
          name: string
          sector_id: string | null
          user_id: string
        }
        Insert: {
          board_id?: string | null
          created_at?: string | null
          filters?: Json
          id?: string
          is_default?: boolean | null
          name: string
          sector_id?: string | null
          user_id: string
        }
        Update: {
          board_id?: string | null
          created_at?: string | null
          filters?: Json
          id?: string
          is_default?: boolean | null
          name?: string
          sector_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_views_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_views_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sector_modules: {
        Row: {
          config: Json | null
          id: string
          is_enabled: boolean | null
          module_id: string
          sector_id: string
        }
        Insert: {
          config?: Json | null
          id?: string
          is_enabled?: boolean | null
          module_id: string
          sector_id: string
        }
        Update: {
          config?: Json | null
          id?: string
          is_enabled?: boolean | null
          module_id?: string
          sector_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sector_modules_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sector_modules_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      sectors: {
        Row: {
          color: string | null
          created_at: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      sla_rules: {
        Row: {
          business_hours_only: boolean | null
          category: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          priority: string
          resolve_time_hours: number
          response_time_hours: number
          sector_id: string
        }
        Insert: {
          business_hours_only?: boolean | null
          category?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          priority: string
          resolve_time_hours: number
          response_time_hours: number
          sector_id: string
        }
        Update: {
          business_hours_only?: boolean | null
          category?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          priority?: string
          resolve_time_hours?: number
          response_time_hours?: number
          sector_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sla_rules_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          card_id: string
          category: string
          channel: string | null
          created_at: string | null
          csat_comment: string | null
          csat_rating: number | null
          csat_submitted_at: string | null
          first_response_at: string | null
          id: string
          is_active: boolean | null
          requester_email: string | null
          requester_id: string | null
          resolved_at: string | null
          sector_id: string
          sla_resolve_breached: boolean | null
          sla_resolve_due_at: string | null
          sla_response_breached: boolean | null
          sla_response_due_at: string | null
          sla_rule_id: string | null
          subcategory: string | null
          updated_at: string | null
        }
        Insert: {
          card_id: string
          category: string
          channel?: string | null
          created_at?: string | null
          csat_comment?: string | null
          csat_rating?: number | null
          csat_submitted_at?: string | null
          first_response_at?: string | null
          id?: string
          is_active?: boolean | null
          requester_email?: string | null
          requester_id?: string | null
          resolved_at?: string | null
          sector_id: string
          sla_resolve_breached?: boolean | null
          sla_resolve_due_at?: string | null
          sla_response_breached?: boolean | null
          sla_response_due_at?: string | null
          sla_rule_id?: string | null
          subcategory?: string | null
          updated_at?: string | null
        }
        Update: {
          card_id?: string
          category?: string
          channel?: string | null
          created_at?: string | null
          csat_comment?: string | null
          csat_rating?: number | null
          csat_submitted_at?: string | null
          first_response_at?: string | null
          id?: string
          is_active?: boolean | null
          requester_email?: string | null
          requester_id?: string | null
          resolved_at?: string | null
          sector_id?: string
          sla_resolve_breached?: boolean | null
          sla_resolve_due_at?: string | null
          sla_response_breached?: boolean | null
          sla_response_due_at?: string | null
          sla_rule_id?: string | null
          subcategory?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: true
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_sla_rule_id_fkey"
            columns: ["sla_rule_id"]
            isOneToOne: false
            referencedRelation: "sla_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string
          id: string
          is_active: boolean | null
          name: string
          sector_id: string | null
        }
        Insert: {
          color: string
          id?: string
          is_active?: boolean | null
          name: string
          sector_id?: string | null
        }
        Update: {
          color?: string
          id?: string
          is_active?: boolean | null
          name?: string
          sector_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tags_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sector_roles: {
        Row: {
          created_at: string | null
          id: string
          role_id: string
          sector_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role_id: string
          sector_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role_id?: string
          sector_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sector_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_sector_roles_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_sector_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean | null
          is_global_admin: boolean | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name: string
          id?: string
          is_active?: boolean | null
          is_global_admin?: boolean | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          is_global_admin?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_crm_dashboard_stats: { Args: { p_sector_id: string }; Returns: Json }
      get_crm_pipeline_stats: { Args: { p_sector_id: string }; Returns: Json }
      get_hr_dashboard_stats: { Args: { p_sector_id: string }; Returns: Json }
      get_support_dashboard_stats: {
        Args: { p_sector_id: string }
        Returns: {
          avg_csat: number
          sla_compliance_pct: number
          total_open: number
          total_resolved_today: number
        }[]
      }
      is_global_admin: { Args: never; Returns: boolean }
      reorder_cards: {
        Args: {
          p_board_id: string
          p_card_positions: Json
          p_column_id: string
          p_expected_board_updated_at: string
        }
        Returns: Json
      }
      user_has_permission: {
        Args: { p_action: string; p_resource: string; p_sector_id: string }
        Returns: boolean
      }
      user_has_sector_access: {
        Args: { p_sector_id: string }
        Returns: boolean
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
    Enums: {},
  },
} as const

