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
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          title: string
          updated_at: string | null
          user_id: string
          year: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          title: string
          updated_at?: string | null
          user_id: string
          year?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          title?: string
          updated          user_id?: string
          year?: number | null
        }
        Relationships: []
      }
      albums: {
        Row: {
          cover_image_url: string | null
          created_at: string | null
          description: string | null
          id: string
          title: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          title: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          title?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "albums_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics: {
        Row: {
          created_at: string
          data: Json | null
          event_type: string
          id: string
          track_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          data?: Json | null
          event_type: string
          id?: string
          track_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          data?: Json | null
          event_type?: string
          id?: string
          track_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          created_at: string
          event_category: string
          event_name: string
          event_value: number | null
          id: string
          ip_address: string | null
          metadata: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_category: string
          event_name: string
          event_value?: number | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_category?: string
          event_name?: string
          event_value?: number | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      audio_tracks: {
        Row: {
          allow_download: boolean | null
          artist: string | null
          audio_url: string
          duration: number | null
          duration_seconds: number | null
          id: string
          price: number | null
          project_id: string
          title: string
          uploaded_at: string | null
          user_id: string
        }
        Insert: {
          allow_download?: boolean | null
          artist?: string | null
          audio_url: string
          duration?: number | null
          duration_seconds?: number | null
          id?: string
          price?: number | null
          project_id: string
          title: string
          uploaded_at?: string | null
          user_id: string
        }
        Update: {
          allow_download?: boolean | null
          artist?: string | null
          audio_url?: string
          duration?: number | null
          duration_seconds?: number | null
          id?: string
          price?: number | null
          project_id?: string
          title?: string
          uploaded_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_tracks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      badges: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
        }
        Relationships: []
      }
      bookmarks: {
        Row: {
          created_at: string | null
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmarks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          cart_id: string | null
          created_at: string
          id: string
          is_saved_for_later: boolean
          playlist_id: string | null
          project_id: string | null
          quantity: number
          selected_file_types: string[] | null
          service_id: string | null
          track_id: string | null
          updated_at: string
        }
        Insert: {
          cart_id?: string | null
          created_at?: string
          id?: string
          is_saved_for_later?: boolean
          playlist_id?: string | null
          project_id?: string | null
          quantity?: number
          selected_file_types?: string[] | null
          service_id?: string | null
          track_id?: string | null
          updated_at?: string
        }
        Update: {
          cart_id?: string | null
          created_at?: string
          id?: string
          is_saved_for_later?: boolean
          playlist_id?: string | null
          project_id?: string | null
          quantity?: number
          selected_file_types?: string[] | null
          service_id?: string | null
          track_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "audio_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      contracts: {
        Row: {
          created_at: string
          distribution_notes: string | null
          distribution_platforms: string | null
          distribution_territories: string | null
          expires_at: string | null
          id: string
          pro_affiliation: string | null
          publisher_name: string | null
          publishing_notes: string | null
          revenue_split: number | null
          royalty_split: number | null
          split_notes: string | null
          status: Database["public"]["Enums"]["contract_status"]
          terms_conditions: string | null
          title: string
          type: Database["public"]["Enums"]["contract_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          distribution_notes?: string | null
          distribution_platforms?: string | null
          distribution_territories?: string | null
          expires_at?: string | null
          id?: string
          pro_affiliation?: string | null
          publisher_name?: string | null
          publishing_notes?: string | null
          revenue_split?: number | null
          royalty_split?: number | null
          split_notes?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          terms_conditions?: string | null
          title: string
          type: Database["public"]["Enums"]["contract_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          distribution_notes?: string | null
          distribution_platforms?: string | null
          distribution_territories?: string | null
          expires_at?: string | null
          id?: string
          pro_affiliation?: string | null
          publisher_name?: string | null
          publishing_notes?: string | null
          revenue_split?: number | null
          royalty_split?: number | null
          split_notes?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          terms_conditions?: string | null
          title?: string
          type?: Database["public"]["Enums"]["contract_type"]
          user_id?: string
        }
        Relationships: []
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          created_at: string | null
          id: string
          is_pinned: boolean | null
          joined_at: string | null
          last_read_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string | null
          id?: string
          is_pinned?: boolean | null
          joined_at?: string | null
          last_read_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string | null
          id?: string
          is_pinned?: boolean | null
          joined_at?: string | null
          last_read_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_user_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      dashboard_metrics: {
        Row: {
          end_date: string | null
          id: string
          metric_name: string
          metric_value: number
          start_date: string | null
          time_period: string
          updated_at: string
          user_id: string
        }
        Insert: {
          end_date?: string | null
          id?: string
          metric_name: string
          metric_value: number
          start_date?: string | null
          time_period: string
          updated_at?: string
          user_id: string
        }
        Update: {
          end_date?: string | null
          id?: string
          metric_name?: string
          metric_value?: number
          start_date?: string | null
          time_period?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dispute_evidence: {
        Row: {
          description: string | null
          dispute_id: string
          file_name: string
          file_size: number | null
          file_type: string
          file_url: string
          id: string
          uploaded_at: string
          user_id: string
        }
        Insert: {
          description?: string | null
          dispute_id: string
          file_name: string
          file_size?: number | null
          file_type: string
          file_url: string
          id?: string
          uploaded_at?: string
          user_id: string
        }
        Update: {
          description?: string | null
          dispute_id?: string
          file_name?: string
          file_size?: number | null
          file_type?: string
          file_url?: string
          id?: string
          uploaded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispute_evidence_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "disputes"
            referencedColumns: ["id"]
          },
        ]
      }
      dispute_messages: {
        Row: {
          created_at: string | null
          dispute_id: string
          id: string
          is_admin: boolean
          message: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          dispute_id: string
          id?: string
          is_admin?: boolean
          message: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          dispute_id?: string
          id?: string
          is_admin?: boolean
          message?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispute_messages_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "disputes"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          amount_disputed: number
          created_at: string | null
          description: string
          dispute_type: string
          id: string
          priority: string
          resolution: string | null
          resolved_at: string | null
          status: string
          title: string
          transaction_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount_disputed: number
          created_at?: string | null
          description: string
          dispute_type: string
          id?: string
          priority?: string
          resolution?: string | null
          resolved_at?: string | null
          status?: string
          title: string
          transaction_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount_disputed?: number
          created_at?: string | null
          description?: string
          dispute_type?: string
          id?: string
          priority?: string
          resolution?: string | null
          resolved_at?: string | null
          status?: string
          title?: string
          transaction_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      files: {
        Row: {
          album: string | null
          allow_download: boolean | null
          artist: string | null
          bpm: number | null
          created_at: string | null
          description: string | null
          duration_seconds: number | null
          file_path: string
          file_type: string
          file_url: string
          folder_id: string | null
          genre: string | null
          id: string
          key: string | null
          mood: string | null
          name: string
          size: number
          starred: boolean | null
          tags: string[] | null
          updated_at: string | null
          user_id: string
          year: number | null
        }
        Insert: {
          album?: string | null
          allow_download?: boolean | null
          artist?: string | null
          bpm?: number | null
          created_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          file_path: string
          file_type: string
          file_url: string
          folder_id?: string | null
          genre?: string | null
          id: string
          key?: string | null
          mood?: string | null
          name: string
          size: number
          starred?: boolean | null
          tags?: string[] | null
          updated_at?: string | null
          user_id: string
          year?: number | null
        }
        Update: {
          album?: string | null
          allow_download?: boolean | null
          artist?: string | null
          bpm?: number | null
          created_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          file_path?: string
          file_type?: string
          file_url?: string
          folder_id?: string | null
          genre?: string | null
          id?: string
          key?: string | null
          mood?: string | null
          name?: string
          size?: number
          starred?: boolean | null
          tags?: string[] | null
          updated_at?: string | null
          user_id?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "files_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      folders: {
        Row: {
          created_at: string | null
          id: string
          name: string
          parent_id: string | null
          starred: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          parent_id?: string | null
          starred?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          starred?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      followers: {
        Row: {
          created_at: string | null
          followed_id: string
          follower_id: string
        }
        Insert: {
          created_at?: string | null
          followed_id: string
          follower_id: string
        }
        Update: {
          created_at?: string | null
          followed_id?: string
          follower_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "followers_followed_id_fkey"
            columns: ["followed_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followers_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gems_transactions: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          id: string
          transaction_type: string
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          description?: string | null
          id?: string
          transaction_type: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          transaction_type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gems_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      given_gems: {
        Row: {
          amount: number
          created_at: string | null
          given_at: string | null
          giver_id: string | null
          id: string
          receiver_id: string | null
          revoked_at: string | null
          status: string
          track_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          given_at?: string | null
          giver_id?: string | null
          id?: string
          receiver_id?: string | null
          revoked_at?: string | null
          status?: string
          track_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          given_at?: string | null
          giver_id?: string | null
          id?: string
          receiver_id?: string | null
          revoked_at?: string | null
          status?: string
          track_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "given_gems_giver_id_fkey"
            columns: ["giver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "given_gems_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "given_gems_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "audio_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      history: {
        Row: {
          duration_played: number
          id: string
          played_at: string
          track_id: string | null
          user_id: string | null
        }
        Insert: {
          duration_played: number
          id?: string
          played_at?: string
          track_id?: string | null
          user_id?: string | null
        }
        Update: {
          duration_played?: number
          id?: string
          played_at?: string
          track_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      likes: {
        Row: {
          liked_at: string
          track_id: string
          user_id: string
        }
        Insert: {
          liked_at?: string
          track_id: string
          user_id: string
        }
        Update: {
          liked_at?: string
          track_id?: string
          user_id?: string
        }
        Relationships: []
      }
      listening_sessions: {
        Row: {
          created_at: string
          id: number
          last_active_at: string
          track_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          last_active_at?: string
          track_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: number
          last_active_at?: string
          track_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listening_sessions_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "audio_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      message_attachments: {
        Row: {
          created_at: string | null
          file_name: string
          file_size: number | null
          file_type: string
          file_url: string
          id: string
          message_id: string | null
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_size?: number | null
          file_type: string
          file_url: string
          id?: string
          message_id?: string | null
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string
          file_url?: string
          id?: string
          message_id?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string | null
          id: string
          is_read: boolean | null
          metadata: Json | null
          sender_id: string
          updated_at: string | null
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          metadata?: Json | null
          sender_id: string
          updated_at?: string | null
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          metadata?: Json | null
          sender_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_conversation_id"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_sender_id"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      note_files: {
        Row: {
          created_at: string | null
          file_id: string
          id: string
          note_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          file_id: string
          id?: string
          note_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          file_id?: string
          id?: string
          note_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_note_files_file_id"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_note_files_note_id"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          project_id: string | null
          title: string
          track_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          project_id?: string | null
          title: string
          track_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          project_id?: string | null
          title?: string
          track_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "audio_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          data: Json | null
          id: string
          message: string
          read: boolean | null
          title: string
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          id?: string
          message: string
          read?: boolean | null
          title: string
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          id?: string
          message?: string
          read?: boolean | null
          title?: string
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          created_at: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          id: string
          items: Json | null
          order_date: string | null
          payment_method: string | null
          processing_fee: number | null
          shipping_address: string | null
          status: string | null
          subtotal: number | null
          tax: number | null
          title: string
          total: number
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          items?: Json | null
          order_date?: string | null
          payment_method?: string | null
          processing_fee?: number | null
          shipping_address?: string | null
          status?: string | null
          subtotal?: number | null
          tax?: number | null
          title: string
          total: number
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          items?: Json | null
          order_date?: string | null
          payment_method?: string | null
          processing_fee?: number | null
          shipping_address?: string | null
          status?: string | null
          subtotal?: number | null
          tax?: number | null
          title?: string
          total?: number
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      playlist_tracks: {
        Row: {
          added_at: string
          playlist_id: string
          position: number
          track_id: string
        }
        Insert: {
          added_at?: string
          playlist_id: string
          position: number
          track_id: string
        }
        Update: {
          added_at?: string
          playlist_id?: string
          position?: number
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_tracks_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      playlists: {
        Row: {
          allow_downloads: boolean | null
          contract_url: string | null
          cover_art_url: string | null
          created_at: string
          description: string | null
          id: string
          is_public: boolean
          price: number | null
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          allow_downloads?: boolean | null
          contract_url?: string | null
          cover_art_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          price?: number | null
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          allow_downloads?: boolean | null
          contract_url?: string | null
          cover_art_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          price?: number | null
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "playlists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      popular_searches: {
        Row: {
          count: number
          query: string
        }
        Insert: {
          count?: number
          query: string
        }
        Update: {
          count?: number
          query?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banner_url: string | null
          bio: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          gems_balance: number | null
          genres: string[] | null
          id: string
          instruments: string[] | null
          is_onboarded: boolean | null
          last_daily_gem_claimed: string | null
          location: string | null
          professional_title: string | null
          profile_url: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          social_links: Json | null
          updated_at: string | null
          username: string
          website_url: string | null
        }
        Insert: {
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          gems_balance?: number | null
          genres?: string[] | null
          id: string
          instruments?: string[] | null
          is_onboarded?: boolean | null
          last_daily_gem_claimed?: string | null
          location?: string | null
          professional_title?: string | null
          profile_url?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          social_links?: Json | null
          updated_at?: string | null
          username: string
          website_url?: string | null
        }
        Update: {
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          gems_balance?: number | null
          genres?: string[] | null
          id?: string
          instruments?: string[] | null
          is_onboarded?: boolean | null
          last_daily_gem_claimed?: string | null
          location?: string | null
          professional_title?: string | null
          profile_url?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          social_links?: Json | null
          updated_at?: string | null
          username?: string
          website_url?: string | null
        }
        Relationships: []
      }
      project_contracts: {
        Row: {
          contract_id: string | null
          created_at: string | null
          id: string
          project_id: string | null
          user_id: string
        }
        Insert: {
          contract_id?: string | null
          created_at?: string | null
          id?: string
          project_id?: string | null
          user_id: string
        }
        Update: {
          contract_id?: string | null
          created_at?: string | null
          id?: string
          project_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_contracts_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_files: {
        Row: {
          allow_downloads: boolean
          file_extension: string | null
          file_id: string | null
          file_name: string | null
          file_size: number | null
          file_type: string | null
          file_url: string | null
          folder_id: string | null
          id: string
          position: number
          price: number | null
          project_id: string
          user_id: string | null
        }
        Insert: {
          allow_downloads?: boolean
          file_extension?: string | null
          file_id?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          folder_id?: string | null
          id?: string
          position: number
          price?: number | null
          project_id: string
          user_id?: string | null
        }
        Update: {
          allow_downloads?: boolean
          file_extension?: string | null
          file_id?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          folder_id?: string | null
          id?: string
          position?: number
          price?: number | null
          project_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_folder_id"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_files_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
      project_pricing: {
        Row: {
          created_at: string | null
          file_id: string | null
          id: string
          license_type: string | null
          price: number
          project_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          file_id?: string | null
          id?: string
          license_type?: string | null
          price: number
          project_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          file_id?: string | null
          id?: string
          license_type?: string | null
          price?: number
          project_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_pricing_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          allow_downloads: boolean | null
          contract_url: string | null
          cover_image_url: string | null
          created_at: string | null
          description: string | null
          gems: number | null
          genre: string | null
          id: string
          is_public: boolean | null
          linked_project_id: string | null
          price: number | null
          sub_genre: string[] | null
          tags: string[] | null
          title: string
          type: string | null
          updated_at: string | null
          user_id: string
          visibility: Database["public"]["Enums"]["project_visibility"]
        }
        Insert: {
          allow_downloads?: boolean | null
          contract_url?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          gems?: number | null
          genre?: string | null
          id?: string
          is_public?: boolean | null
          linked_project_id?: string | null
          price?: number | null
          sub_genre?: string[] | null
          tags?: string[] | null
          title: string
          type?: string | null
          updated_at?: string | null
          user_id: string
          visibility?: Database["public"]["Enums"]["project_visibility"]
        }
        Update: {
          allow_downloads?: boolean | null
          contract_url?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          gems?: number | null
          genre?: string | null
          id?: string
          is_public?: boolean | null
          linked_project_id?: string | null
          price?: number | null
          sub_genre?: string[] | null
          tags?: string[] | null
          title?: string
          type?: string | null
          updated_at?: string | null
          user_id?: string
          visibility?: Database["public"]["Enums"]["project_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "fk_profiles"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_linked_project_id_fkey"
            columns: ["linked_project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          id: string
          order_id: string | null
          price: number
          product_name: string
          quantity: number
          sale_date: string
        }
        Insert: {
          id?: string
          order_id?: string | null
          price: number
          product_name: string
          quantity: number
          sale_date?: string
        }
        Update: {
          id?: string
          order_id?: string | null
          price?: number
          product_name?: string
          quantity?: number
          sale_date?: string
        }
        Relationships: []
      }
      saved_projects: {
        Row: {
          created_at: string
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_tracks: {
        Row: {
          created_at: string | null
          id: string
          track_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          track_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          track_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_tracks_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "audio_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order_deliverables: {
        Row: {
          approved_at: string | null
          attachments: Json | null
          comment: string | null
          created_at: string
          id: string
          order_id: string
          revision_reason: string | null
          stage: string
          status: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          attachments?: Json | null
          comment?: string | null
          created_at?: string
          id?: string
          order_id: string
          revision_reason?: string | null
          stage: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          attachments?: Json | null
          comment?: string | null
          created_at?: string
          id?: string
          order_id?: string
          revision_reason?: string | null
          stage?: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_order_deliverables_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "service_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      service_orders: {
        Row: {
          conversation_id: string | null
          created_at: string
          customer_id: string
          delivery_deadline: string | null
          denial_reason: string | null
          description: string
          id: string
          price: number
          requirements: string | null
          revisions_allowed: number
          revisions_remaining: number
          service_id: string
          service_provider_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          customer_id: string
          delivery_deadline?: string | null
          denial_reason?: string | null
          description: string
          id?: string
          price: number
          requirements?: string | null
          revisions_allowed?: number
          revisions_remaining?: number
          service_id: string
          service_provider_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          customer_id?: string
          delivery_deadline?: string | null
          denial_reason?: string | null
          description?: string
          id?: string
          price?: number
          requirements?: string | null
          revisions_allowed?: number
          revisions_remaining?: number
          service_id?: string
          service_provider_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_orders_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_orders_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          created_at: string | null
          delivery_time: string | null
          delivery_time_custom: string | null
          delivery_time_unit: string | null
          delivery_time_value: number | null
          description: string
          id: string
          is_active: boolean | null
          is_featured: boolean | null
          is_set_price: boolean | null
          price: number | null
          revisions: number | null
          title: string
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          delivery_time?: string | null
          delivery_time_custom?: string | null
          delivery_time_unit?: string | null
          delivery_time_value?: number | null
          description: string
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          is_set_price?: boolean | null
          price?: number | null
          revisions?: number | null
          title: string
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          delivery_time?: string | null
          delivery_time_custom?: string | null
          delivery_time_unit?: string | null
          delivery_time_value?: number | null
          description?: string
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          is_set_price?: boolean | null
          price?: number | null
          revisions?: number | null
          title?: string
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      track_streams: {
        Row: {
          id: number
          streamed_at: string
          streams: number | null
          track_id: string
          user_id: string | null
        }
        Insert: {
          id?: number
          streamed_at?: string
          streams?: number | null
          track_id: string
          user_id?: string | null
        }
        Update: {
          id?: number
          streamed_at?: string
          streams?: number | null
          track_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "track_streams_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "audio_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      track_variants: {
        Row: {
          created_at: string | null
          file_id: string
          id: string
          track_id: string
          updated_at: string | null
          variant_name: string | null
          variant_type: string
        }
        Insert: {
          created_at?: string | null
          file_id: string
          id?: string
          track_id: string
          updated_at?: string | null
          variant_name?: string | null
          variant_type: string
        }
        Update: {
          created_at?: string | null
          file_id?: string
          id?: string
          track_id?: string
          updated_at?: string | null
          variant_name?: string | null
          variant_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "track_variants_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "track_variants_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "audio_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      tracks: {
        Row: {
          artist: string | null
          audio_url: string
          duration_seconds: number | null
          id: string
          project_id: string
          title: string
          uploaded_at: string | null
          user_id: string
        }
        Insert: {
          artist?: string | null
          audio_url: string
          duration_seconds?: number | null
          id?: string
          project_id: string
          title: string
          uploaded_at?: string | null
          user_id: string
        }
        Update: {
          artist?: string | null
          audio_url?: string
          duration_seconds?: number | null
          id?: string
          project_id?: string
          title?: string
          uploaded_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          layout: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          layout: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          layout?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_stats: {
        Row: {
          collaborations: number | null
          created_at: string | null
          followers_count: number | null
          following_count: number | null
          gems: number | null
          projects_created: number | null
          total_plays: number | null
          tracks_uploaded: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          collaborations?: number | null
          created_at?: string | null
          followers_count?: number | null
          following_count?: number | null
          gems?: number | null
          projects_created?: number | null
          total_plays?: number | null
          tracks_uploaded?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          collaborations?: number | null
          created_at?: string | null
          followers_count?: number | null
          following_count?: number | null
          gems?: number | null
          projects_created?: number | null
          total_plays?: number | null
          tracks_uploaded?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_wallets: {
        Row: {
          balance: number
          created_at: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          metadata: Json | null
          status: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description: string
          id?: string
          metadata?: Json | null
          status?: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          metadata?: Json | null
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number | null
          created_at: string | null
          id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          balance?: number | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          balance?: number | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
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
      add_dispute_message: {
        Args: {
          p_content: string
          p_dispute_id: string
          p_is_internal?: boolean
          p_message_type?: string
          p_user_id: string
        }
        Returns: string
      }
      calculate_dashboard_metrics: {
        Args: { user_id_param: string }
        Returns: undefined
      }
      check_daily_gems_eligibility: { Args: { user_id: string }; Returns: Json }
      claim_daily_gems: { Args: { user_id: string }; Returns: Json }
      create_conversation_with_participants: {
        Args: { participant_ids: string[] }
        Returns: string
      }
      create_dispute: {
        Args: {
          p_amount_disputed: number
          p_description: string
          p_dispute_type: string
          p_title: string
          p_transaction_id: string
          p_user_id: string
        }
        Returns: string
      }
      create_profile: {
        Args: {
          full_name: string
          user_email: string
          user_id: string
          username: string
        }
        Returns: undefined
      }
      create_profile_if_not_exists: {
        Args: { profile_data: Json; profile_id: string }
        Returns: undefined
      }
      create_user_profile: {
        Args: { user_email: string; user_id: string; user_name: string }
        Returns: undefined
      }
      create_user_with_profile_v2: {
        Args: { email: string; password: string; username: string }
        Returns: Json
      }
      crypt: { Args: { password: string; salt: string }; Returns: string }
      delete_user_account: { Args: never; Returns: undefined }
      delete_user_profile: {
        Args: { user_id_to_delete: string }
        Returns: undefined
      }
      follow: { Args: { profile_id_to_follow: string }; Returns: undefined }
      gen_salt: { Args: { type: string }; Returns: string }
      get_dispute_stats: {
        Args: { p_user_id: string }
        Returns: {
          open_disputes: number
          resolved_disputes: number
          total_disputes: number
          urgent_disputes: number
        }[]
      }
      get_followers_count: {
        Args: { profile_id_to_check: string }
        Returns: number
      }
      get_following_count: {
        Args: { profile_id_to_check: string }
        Returns: number
      }
      get_full_project_id: { Args: { short_id: string }; Returns: string }
      get_listener_count: { Args: { p_track_id: string }; Returns: number }
      get_profile_with_stats: { Args: { p_user_id: string }; Returns: Json }
      get_public_profile: {
        Args: { p_username: string }
        Returns: {
          full_name: string
          id: string
          profile_url: string
          username: string
        }[]
      }
      get_total_listeners_for_user: {
        Args: { p_user_id: string }
        Returns: number
      }
      get_total_plays_for_user: { Args: { p_user_id: string }; Returns: number }
      get_track_stream_count: { Args: { p_track_id: string }; Returns: number }
      get_user_conversation_ids: { Args: never; Returns: string[] }
      get_user_total_streams: {
        Args: { user_id_input: string }
        Returns: number
      }
      give_gem: {
        Args: { from_user_id: string; to_user_id: string; track_id: string }
        Returns: boolean
      }
      give_gems:
        | {
            Args: { gem_amount: number; giver_id: string; receiver_id: string }
            Returns: Json
          }
        | {
            Args: {
              gem_amount: number
              giver_id: string
              receiver_id: string
              track_id?: string
            }
            Returns: Json
          }
      increment_track_plays: {
        Args: { p_track_id: string; p_user_id?: string }
        Returns: undefined
      }
      is_following: { Args: { profile_id_to_check: string }; Returns: boolean }
      mark_all_notifications_read: { Args: never; Returns: number }
      mark_notification_read: {
        Args: { notification_id: string }
        Returns: boolean
      }
      remove_stale_listening_sessions: { Args: never; Returns: undefined }
      revoke_gems: {
        Args: { given_gems_id: string; revoker_id: string }
        Returns: Json
      }
      search_all: {
        Args: { search_term: string }
        Returns: {
          title: string
          type: string
        }[]
      }
      search_profiles_and_projects: {
        Args: { search_term: string }
        Returns: {
          allow_downloads: boolean
          bio: string
          cover_image_url: string
          created_at: string
          description: string
          full_name: string
          gems: number
          id: string
          is_public: boolean
          location: string
          price: number
          tags: string[]
          title: string
          type: string
          updated_at: string
          user_id: string
          username: string
          website_url: string
        }[]
      }
      toggle_bookmark: {
        Args: { project_uuid: string; user_uuid: string }
        Returns: boolean
      }
      unfollow: { Args: { profile_id_to_unfollow: string }; Returns: undefined }\n      update_audio_duration: {\n        Args: { p_duration_seconds: number; p_track_id: string }\n        Returns: undefined\n      }\n      update_file_duration_seconds: {\n        Args: { p_duration_seconds: number; p_file_id: string }\n        Returns: undefined\n      }\n      update_user_total_plays: {\n        Args: { p_user_id: string }\n        Returns: undefined\n      }\n    }\n    Enums: {\n      contract_status: "draft" | "pending" | "active" | "expired"\n      contract_type: "service" | "audio"\n      project_visibility: "public" | "unlisted" | "private"\n      user_role: "Free" | "Basic" | "Pro" | "Admin"\n    }\n    CompositeTypes: {\n      [_ in never]: never\n    }\n  }\n}\n\ntype DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">\n\ntype DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]\n\nexport type Tables<\n  DefaultSchemaTableNameOrOptions extends\n    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])\n    | { schema: keyof DatabaseWithoutInternals },\n  TableName extends DefaultSchemaTableNameOrOptions extends {\n    schema: keyof DatabaseWithoutInternals\n  }\n    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &\n        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])\n    : never = never,\n> = DefaultSchemaTableNameOrOptions extends {\n  schema: keyof DatabaseWithoutInternals\n}\n  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &\n      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {\n      Row: infer R\n    }\n    ? R\n    : never\n  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &\n        DefaultSchema["Views"])\n    ? (DefaultSchema["Tables"] &\n        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {\n        Row: infer R\n      }\n      ? R\n      : never\n    : never\n\nexport type TablesInsert<\n  DefaultSchemaTableNameOrOptions extends\n    | keyof DefaultSchema["Tables"]\n    | { schema: keyof DatabaseWithoutInternals },\n  TableName extends DefaultSchemaTableNameOrOptions extends {\n    schema: keyof DatabaseWithoutInternals\n  }\n    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]\n    : never = never,\n> = DefaultSchemaTableNameOrOptions extends {\n  schema: keyof DatabaseWithoutInternals\n}\n  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {\n      Insert: infer I\n    }\n    ? I\n    : never\n  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]\n    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {\n        Insert: infer I\n      }\n      ? I\n      : never\n    : never\n\nexport type TablesUpdate<\n  DefaultSchemaTableNameOrOptions extends\n    | keyof DefaultSchema["Tables"]\n    | { schema: keyof DatabaseWithoutInternals },\n  TableName extends DefaultSchemaTableNameOrOptions extends {\n    schema: keyof DatabaseWithoutInternals\n  }\n    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]\n    : never = never,\n> = DefaultSchemaTableNameOrOptions extends {\n  schema: keyof DatabaseWithoutInternals\n}\n  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {\n      Update: infer U\n    }\n    ? U\n    : never\n  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]\n    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {\n        Update: infer U\n      }\n      ? U\n      : never\n    : never\n\nexport type Enums<\n  DefaultSchemaEnumNameOrOptions extends\n    | keyof DefaultSchema["Enums"]\n    | { schema: keyof DatabaseWithoutInternals },\n  EnumName extends DefaultSchemaEnumNameOrOptions extends {\n    schema: keyof DatabaseWithoutInternals\n  }\n    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]\n    : never = never,\n> = DefaultSchemaEnumNameOrOptions extends {\n  schema: keyof DatabaseWithoutInternals\n}\n  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]\n  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]\n    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]\n    : never\n\nexport type CompositeTypes<\n  PublicCompositeTypeNameOrOptions extends\n    | keyof DefaultSchema["CompositeTypes"]\n    | { schema: keyof DatabaseWithoutInternals },\n  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {\n    schema: keyof DatabaseWithoutInternals\n  }\n    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]\n    : never = never,\n> = PublicCompositeTypeNameOrOptions extends {\n  schema: keyof DatabaseWithoutInternals\n}\n  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]\n  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]\n    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]\n    : never\n\nexport const Constants = {\n  public: {\n    Enums: {\n      contract_status: ["draft", "pending", "active", "expired"],\n      contract_type: ["service", "audio"],\n      project_visibility: ["public", "unlisted", "private"],\n      user_role: ["Free", "Basic", "Pro", "Admin"],\n    },\n  },\n} as const\n
