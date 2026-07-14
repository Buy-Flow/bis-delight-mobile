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
      abandoned_carts: {
        Row: {
          created_at: string
          item_count: number
          items: Json
          notified_at: string | null
          recovered_at: string | null
          subtotal: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          item_count?: number
          items?: Json
          notified_at?: string | null
          recovered_at?: string | null
          subtotal?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          item_count?: number
          items?: Json
          notified_at?: string | null
          recovered_at?: string | null
          subtotal?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_campaigns: {
        Row: {
          channel: string
          dispatched_at: string
          dispatched_by: string | null
          id: string
          insight_id: string | null
          message: string
          recipients: Json
          recipients_count: number
          status: string
        }
        Insert: {
          channel?: string
          dispatched_at?: string
          dispatched_by?: string | null
          id?: string
          insight_id?: string | null
          message: string
          recipients?: Json
          recipients_count?: number
          status?: string
        }
        Update: {
          channel?: string
          dispatched_at?: string
          dispatched_by?: string | null
          id?: string
          insight_id?: string | null
          message?: string
          recipients?: Json
          recipients_count?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_campaigns_insight_id_fkey"
            columns: ["insight_id"]
            isOneToOne: false
            referencedRelation: "ai_insights"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversation_memory: {
        Row: {
          conversation_id: string
          summary: string
          turns_since_summary: number
          updated_at: string
        }
        Insert: {
          conversation_id: string
          summary?: string
          turns_since_summary?: number
          updated_at?: string
        }
        Update: {
          conversation_id?: string
          summary?: string
          turns_since_summary?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversation_memory_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_growth_chat: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          thread_id: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          thread_id?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          thread_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_growth_chat_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "ai_growth_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_growth_threads: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_insights: {
        Row: {
          category: string
          clientes: Json
          count: number
          created_at: string
          expires_at: string
          id: string
          impacto: number
          mensagem: string
          priority: string
          status: string
          title: string
        }
        Insert: {
          category?: string
          clientes?: Json
          count?: number
          created_at?: string
          expires_at?: string
          id?: string
          impacto?: number
          mensagem: string
          priority: string
          status?: string
          title: string
        }
        Update: {
          category?: string
          clientes?: Json
          count?: number
          created_at?: string
          expires_at?: string
          id?: string
          impacto?: number
          mensagem?: string
          priority?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
      automation_runs: {
        Row: {
          automation_id: string
          created_at: string
          id: string
          run_key: string
          user_id: string
        }
        Insert: {
          automation_id: string
          created_at?: string
          id?: string
          run_key: string
          user_id: string
        }
        Update: {
          automation_id?: string
          created_at?: string
          id?: string
          run_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "push_automations"
            referencedColumns: ["id"]
          },
        ]
      }
      birthday_gifts: {
        Row: {
          claimed_at: string
          coupon_code: string
          coupon_id: string | null
          granted_by: string | null
          id: string
          notes: string | null
          push_sent_at: string | null
          used_at: string | null
          user_id: string
          year: number
        }
        Insert: {
          claimed_at?: string
          coupon_code: string
          coupon_id?: string | null
          granted_by?: string | null
          id?: string
          notes?: string | null
          push_sent_at?: string | null
          used_at?: string | null
          user_id: string
          year: number
        }
        Update: {
          claimed_at?: string
          coupon_code?: string
          coupon_id?: string | null
          granted_by?: string | null
          id?: string
          notes?: string | null
          push_sent_at?: string | null
          used_at?: string | null
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "birthday_gifts_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "promo_coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      birthday_settings: {
        Row: {
          banner_cta: string
          banner_emoji: string
          banner_message: string
          banner_title: string
          coupon_prefix: string
          created_at: string
          discount_type: string
          discount_value: number
          enabled: boolean
          id: number
          min_order: number
          notify_days_before: number
          per_user_yearly: number
          push_auto: boolean
          push_body: string
          push_title: string
          updated_at: string
          validity_days: number
          validity_mode: string
        }
        Insert: {
          banner_cta?: string
          banner_emoji?: string
          banner_message?: string
          banner_title?: string
          coupon_prefix?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          enabled?: boolean
          id?: number
          min_order?: number
          notify_days_before?: number
          per_user_yearly?: number
          push_auto?: boolean
          push_body?: string
          push_title?: string
          updated_at?: string
          validity_days?: number
          validity_mode?: string
        }
        Update: {
          banner_cta?: string
          banner_emoji?: string
          banner_message?: string
          banner_title?: string
          coupon_prefix?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          enabled?: boolean
          id?: number
          min_order?: number
          notify_days_before?: number
          per_user_yearly?: number
          push_auto?: boolean
          push_body?: string
          push_title?: string
          updated_at?: string
          validity_days?: number
          validity_mode?: string
        }
        Relationships: []
      }
      cash_movements: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          order_id: string | null
          payment_method: string
          session_id: string
          type: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          order_id?: string | null
          payment_method?: string
          session_id: string
          type: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          order_id?: string | null
          payment_method?: string
          session_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_tracking_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_sessions: {
        Row: {
          closed_at: string | null
          closing_note: string | null
          counted_amount: number | null
          created_at: string
          difference: number | null
          expected_amount: number | null
          id: string
          opened_at: string
          opening_amount: number
          opening_note: string | null
          operator_id: string | null
          operator_name: string | null
          status: string
          terminal: string | null
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closing_note?: string | null
          counted_amount?: number | null
          created_at?: string
          difference?: number | null
          expected_amount?: number | null
          id?: string
          opened_at?: string
          opening_amount?: number
          opening_note?: string | null
          operator_id?: string | null
          operator_name?: string | null
          status?: string
          terminal?: string | null
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closing_note?: string | null
          counted_amount?: number | null
          created_at?: string
          difference?: number | null
          expected_amount?: number | null
          id?: string
          opened_at?: string
          opening_amount?: number
          opening_note?: string | null
          operator_id?: string | null
          operator_name?: string | null
          status?: string
          terminal?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          active: boolean
          created_at: string
          emoji: string
          extras: Json | null
          icon: string | null
          id: string
          image_pos_x: number
          image_pos_y: number
          image_scale: number
          image_url: string | null
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          emoji?: string
          extras?: Json | null
          icon?: string | null
          id: string
          image_pos_x?: number
          image_pos_y?: number
          image_scale?: number
          image_url?: string | null
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          emoji?: string
          extras?: Json | null
          icon?: string | null
          id?: string
          image_pos_x?: number
          image_pos_y?: number
          image_scale?: number
          image_url?: string | null
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      combos: {
        Row: {
          active: boolean
          created_at: string
          description: string
          discount_percent: number
          id: string
          image_url: string | null
          name: string
          rules: Json
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string
          discount_percent?: number
          id?: string
          image_url?: string | null
          name: string
          rules?: Json
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string
          discount_percent?: number
          id?: string
          image_url?: string | null
          name?: string
          rules?: Json
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      copilot_actions: {
        Row: {
          action_type: string
          created_at: string
          id: string
          params: Json
          result: Json | null
          reverted_at: string | null
          status: string
          target_id: string | null
          target_table: string | null
          thread_id: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          params?: Json
          result?: Json | null
          reverted_at?: string | null
          status?: string
          target_id?: string | null
          target_table?: string | null
          thread_id?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          params?: Json
          result?: Json | null
          reverted_at?: string | null
          status?: string
          target_id?: string | null
          target_table?: string | null
          thread_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "copilot_actions_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "copilot_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      copilot_messages: {
        Row: {
          created_at: string
          id: string
          parts: Json
          role: string
          thread_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          parts?: Json
          role: string
          thread_id: string
        }
        Update: {
          created_at?: string
          id?: string
          parts?: Json
          role?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "copilot_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "copilot_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      copilot_threads: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      courier_locations: {
        Row: {
          accuracy: number | null
          battery: number | null
          courier_id: string
          heading: number | null
          id: number
          lat: number
          lng: number
          order_id: string | null
          recorded_at: string
          speed: number | null
        }
        Insert: {
          accuracy?: number | null
          battery?: number | null
          courier_id: string
          heading?: number | null
          id?: number
          lat: number
          lng: number
          order_id?: string | null
          recorded_at?: string
          speed?: number | null
        }
        Update: {
          accuracy?: number | null
          battery?: number | null
          courier_id?: string
          heading?: number | null
          id?: number
          lat?: number
          lng?: number
          order_id?: string | null
          recorded_at?: string
          speed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "courier_locations_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_locations_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers_live"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_locations_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "order_tracking_public"
            referencedColumns: ["courier_id"]
          },
          {
            foreignKeyName: "courier_locations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_tracking_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courier_locations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      couriers: {
        Row: {
          accuracy: number | null
          active: boolean
          avatar_url: string | null
          created_at: string
          current_lat: number | null
          current_lng: number | null
          fee_per_delivery: number
          heading: number | null
          id: string
          last_seen_at: string | null
          location_updated_at: string | null
          max_concurrent: number
          name: string
          note: string | null
          phone: string | null
          plate: string | null
          rating: number | null
          rating_count: number
          speed: number | null
          status: string
          total_deliveries: number
          total_earnings: number
          updated_at: string
          user_id: string | null
          vehicle: string
        }
        Insert: {
          accuracy?: number | null
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          fee_per_delivery?: number
          heading?: number | null
          id?: string
          last_seen_at?: string | null
          location_updated_at?: string | null
          max_concurrent?: number
          name: string
          note?: string | null
          phone?: string | null
          plate?: string | null
          rating?: number | null
          rating_count?: number
          speed?: number | null
          status?: string
          total_deliveries?: number
          total_earnings?: number
          updated_at?: string
          user_id?: string | null
          vehicle?: string
        }
        Update: {
          accuracy?: number | null
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          fee_per_delivery?: number
          heading?: number | null
          id?: string
          last_seen_at?: string | null
          location_updated_at?: string | null
          max_concurrent?: number
          name?: string
          note?: string | null
          phone?: string | null
          plate?: string | null
          rating?: number | null
          rating_count?: number
          speed?: number | null
          status?: string
          total_deliveries?: number
          total_earnings?: number
          updated_at?: string
          user_id?: string | null
          vehicle?: string
        }
        Relationships: []
      }
      delivery_offers: {
        Row: {
          broadcast: boolean
          courier_id: string | null
          created_at: string
          distance_km: number | null
          expires_at: string
          fee: number | null
          id: string
          note: string | null
          offered_at: string
          order_id: string
          responded_at: string | null
          status: string
        }
        Insert: {
          broadcast?: boolean
          courier_id?: string | null
          created_at?: string
          distance_km?: number | null
          expires_at?: string
          fee?: number | null
          id?: string
          note?: string | null
          offered_at?: string
          order_id: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          broadcast?: boolean
          courier_id?: string | null
          created_at?: string
          distance_km?: number | null
          expires_at?: string
          fee?: number | null
          id?: string
          note?: string | null
          offered_at?: string
          order_id?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_offers_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_offers_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers_live"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_offers_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "order_tracking_public"
            referencedColumns: ["courier_id"]
          },
          {
            foreignKeyName: "delivery_offers_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_tracking_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_offers_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          active: boolean
          category: string | null
          cost_per_unit: number | null
          created_at: string
          id: string
          low_stock_threshold: number
          name: string
          notes: string | null
          sku: string | null
          stock: number
          supplier: string | null
          supplier_phone: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          cost_per_unit?: number | null
          created_at?: string
          id?: string
          low_stock_threshold?: number
          name: string
          notes?: string | null
          sku?: string | null
          stock?: number
          supplier?: string | null
          supplier_phone?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          cost_per_unit?: number | null
          created_at?: string
          id?: string
          low_stock_threshold?: number
          name?: string
          notes?: string | null
          sku?: string | null
          stock?: number
          supplier?: string | null
          supplier_phone?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_movements: {
        Row: {
          created_at: string
          id: string
          ingredient_id: string | null
          item_type: string
          movement_type: string
          product_id: string | null
          qty: number
          reason: string | null
          reference: string | null
          unit_cost: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ingredient_id?: string | null
          item_type: string
          movement_type: string
          product_id?: string | null
          qty: number
          reason?: string | null
          reference?: string | null
          unit_cost?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ingredient_id?: string | null
          item_type?: string
          movement_type?: string
          product_id?: string | null
          qty?: number
          reason?: string | null
          reference?: string | null
          unit_cost?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty: {
        Row: {
          created_at: string
          last_birthday_bonus: string | null
          lifetime_stamps: number
          stamps: number
          total_redeemed: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          last_birthday_bonus?: string | null
          lifetime_stamps?: number
          stamps?: number
          total_redeemed?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          last_birthday_bonus?: string | null
          lifetime_stamps?: number
          stamps?: number
          total_redeemed?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      loyalty_coupons: {
        Row: {
          code: string
          created_at: string
          discount_value: number
          id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          discount_value?: number
          id?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          discount_value?: number
          id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      loyalty_tiers: {
        Row: {
          coupon_value: number
          label: string
          min_lifetime: number
          min_order_value: number
          redeem_cost: number
          sort_order: number
          stamps_per_order: number
          tier: string
          updated_at: string
        }
        Insert: {
          coupon_value?: number
          label: string
          min_lifetime?: number
          min_order_value?: number
          redeem_cost?: number
          sort_order: number
          stamps_per_order?: number
          tier: string
          updated_at?: string
        }
        Update: {
          coupon_value?: number
          label?: string
          min_lifetime?: number
          min_order_value?: number
          redeem_cost?: number
          sort_order?: number
          stamps_per_order?: number
          tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      media_library: {
        Row: {
          alt_text: string | null
          bucket: string
          category: string | null
          created_at: string
          height: number | null
          id: string
          is_favorite: boolean
          mime_type: string | null
          name: string
          size_bytes: number | null
          storage_path: string
          tags: string[]
          updated_at: string
          uploaded_by: string | null
          url: string
          usage_count: number
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          bucket?: string
          category?: string | null
          created_at?: string
          height?: number | null
          id?: string
          is_favorite?: boolean
          mime_type?: string | null
          name: string
          size_bytes?: number | null
          storage_path: string
          tags?: string[]
          updated_at?: string
          uploaded_by?: string | null
          url: string
          usage_count?: number
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          bucket?: string
          category?: string | null
          created_at?: string
          height?: number | null
          id?: string
          is_favorite?: boolean
          mime_type?: string | null
          name?: string
          size_bytes?: number | null
          storage_path?: string
          tags?: string[]
          updated_at?: string
          uploaded_by?: string | null
          url?: string
          usage_count?: number
          width?: number | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          extras: Json
          flavor: string | null
          id: string
          name: string
          note: string | null
          order_id: string
          product_id: string | null
          quantity: number
          removed: Json
          size: string | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          extras?: Json
          flavor?: string | null
          id?: string
          name: string
          note?: string | null
          order_id: string
          product_id?: string | null
          quantity: number
          removed?: Json
          size?: string | null
          unit_price: number
        }
        Update: {
          created_at?: string
          extras?: Json
          flavor?: string | null
          id?: string
          name?: string
          note?: string | null
          order_id?: string
          product_id?: string | null
          quantity?: number
          removed?: Json
          size?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_tracking_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address: string | null
          canceled_at: string | null
          coupon_code: string | null
          courier_id: string | null
          courier_rating: number | null
          created_at: string
          customer_name: string
          customer_rating: number | null
          delivered_at: string | null
          delivery_contact_type: string | null
          delivery_fee: number
          delivery_lat: number | null
          delivery_lng: number | null
          delivery_photo_at: string | null
          delivery_photo_lat: number | null
          delivery_photo_lng: number | null
          delivery_photo_url: string | null
          delivery_proof_notes: string | null
          delivery_proof_skipped_reason: string | null
          delivery_signature_url: string | null
          delivery_started_at: string | null
          dispatched_at: string | null
          distance_km: number | null
          eta_minutes: number | null
          id: string
          mode: string
          note: string | null
          origin_lat: number | null
          origin_lng: number | null
          paid_at: string | null
          people_count: number | null
          phone: string
          picked_up_at: string | null
          preparing_at: string | null
          reference: string | null
          service_fee: number | null
          status: string
          subtotal: number
          table_id: string | null
          total: number
          tracking_token: string | null
          user_id: string
          waiter_id: string | null
        }
        Insert: {
          address?: string | null
          canceled_at?: string | null
          coupon_code?: string | null
          courier_id?: string | null
          courier_rating?: number | null
          created_at?: string
          customer_name: string
          customer_rating?: number | null
          delivered_at?: string | null
          delivery_contact_type?: string | null
          delivery_fee?: number
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_photo_at?: string | null
          delivery_photo_lat?: number | null
          delivery_photo_lng?: number | null
          delivery_photo_url?: string | null
          delivery_proof_notes?: string | null
          delivery_proof_skipped_reason?: string | null
          delivery_signature_url?: string | null
          delivery_started_at?: string | null
          dispatched_at?: string | null
          distance_km?: number | null
          eta_minutes?: number | null
          id?: string
          mode: string
          note?: string | null
          origin_lat?: number | null
          origin_lng?: number | null
          paid_at?: string | null
          people_count?: number | null
          phone: string
          picked_up_at?: string | null
          preparing_at?: string | null
          reference?: string | null
          service_fee?: number | null
          status?: string
          subtotal: number
          table_id?: string | null
          total: number
          tracking_token?: string | null
          user_id: string
          waiter_id?: string | null
        }
        Update: {
          address?: string | null
          canceled_at?: string | null
          coupon_code?: string | null
          courier_id?: string | null
          courier_rating?: number | null
          created_at?: string
          customer_name?: string
          customer_rating?: number | null
          delivered_at?: string | null
          delivery_contact_type?: string | null
          delivery_fee?: number
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_photo_at?: string | null
          delivery_photo_lat?: number | null
          delivery_photo_lng?: number | null
          delivery_photo_url?: string | null
          delivery_proof_notes?: string | null
          delivery_proof_skipped_reason?: string | null
          delivery_signature_url?: string | null
          delivery_started_at?: string | null
          dispatched_at?: string | null
          distance_km?: number | null
          eta_minutes?: number | null
          id?: string
          mode?: string
          note?: string | null
          origin_lat?: number | null
          origin_lng?: number | null
          paid_at?: string | null
          people_count?: number | null
          phone?: string
          picked_up_at?: string | null
          preparing_at?: string | null
          reference?: string | null
          service_fee?: number | null
          status?: string
          subtotal?: number
          table_id?: string | null
          total?: number
          tracking_token?: string | null
          user_id?: string
          waiter_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers_live"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "order_tracking_public"
            referencedColumns: ["courier_id"]
          },
          {
            foreignKeyName: "orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "restaurant_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_waiter_id_fkey"
            columns: ["waiter_id"]
            isOneToOne: false
            referencedRelation: "waiters"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_role_grants: {
        Row: {
          applied_at: string | null
          applied_user_id: string | null
          created_at: string
          email: string
          full_name: string | null
          granted_by: string | null
          id: string
          note: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          applied_at?: string | null
          applied_user_id?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          granted_by?: string | null
          id?: string
          note?: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          applied_at?: string | null
          applied_user_id?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          granted_by?: string | null
          id?: string
          note?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      prep_forecast_settings: {
        Row: {
          ai_context: string | null
          ai_model: string
          ai_temperature: number
          auto_notify: boolean
          auto_refresh_minutes: number
          categories_excluded: string[]
          categories_included: string[]
          created_at: string
          enabled: boolean
          history_days: number
          horizon_hours: number
          id: number
          include_paused: boolean
          min_batch_hint: number
          min_confidence_pct: number
          notify_channels: string[]
          round_up: boolean
          safety_stock_pct: number
          updated_at: string
          waste_target_pct: number
          weather_boost_pct: number
          weekend_boost_pct: number
        }
        Insert: {
          ai_context?: string | null
          ai_model?: string
          ai_temperature?: number
          auto_notify?: boolean
          auto_refresh_minutes?: number
          categories_excluded?: string[]
          categories_included?: string[]
          created_at?: string
          enabled?: boolean
          history_days?: number
          horizon_hours?: number
          id?: number
          include_paused?: boolean
          min_batch_hint?: number
          min_confidence_pct?: number
          notify_channels?: string[]
          round_up?: boolean
          safety_stock_pct?: number
          updated_at?: string
          waste_target_pct?: number
          weather_boost_pct?: number
          weekend_boost_pct?: number
        }
        Update: {
          ai_context?: string | null
          ai_model?: string
          ai_temperature?: number
          auto_notify?: boolean
          auto_refresh_minutes?: number
          categories_excluded?: string[]
          categories_included?: string[]
          created_at?: string
          enabled?: boolean
          history_days?: number
          horizon_hours?: number
          id?: number
          include_paused?: boolean
          min_batch_hint?: number
          min_confidence_pct?: number
          notify_channels?: string[]
          round_up?: boolean
          safety_stock_pct?: number
          updated_at?: string
          waste_target_pct?: number
          weather_boost_pct?: number
          weekend_boost_pct?: number
        }
        Relationships: []
      }
      print_jobs: {
        Row: {
          created_at: string
          id: string
          kind: string
          note: string | null
          order_id: string | null
          payload: Json | null
          printed_by: string | null
          printer_id: string | null
          retries: number
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          note?: string | null
          order_id?: string | null
          payload?: Json | null
          printed_by?: string | null
          printer_id?: string | null
          retries?: number
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          note?: string | null
          order_id?: string | null
          payload?: Json | null
          printed_by?: string | null
          printer_id?: string | null
          retries?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "print_jobs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_tracking_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_jobs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_jobs_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "print_printers"
            referencedColumns: ["id"]
          },
        ]
      }
      print_printers: {
        Row: {
          active: boolean
          bridge_url: string | null
          copies: number
          created_at: string
          id: string
          is_default: boolean
          kinds: string[]
          last_error: string | null
          last_ok_at: string | null
          name: string
          paper_width: number | null
          sort_index: number
          target: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          bridge_url?: string | null
          copies?: number
          created_at?: string
          id?: string
          is_default?: boolean
          kinds?: string[]
          last_error?: string | null
          last_ok_at?: string | null
          name: string
          paper_width?: number | null
          sort_index?: number
          target?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          bridge_url?: string | null
          copies?: number
          created_at?: string
          id?: string
          is_default?: boolean
          kinds?: string[]
          last_error?: string | null
          last_ok_at?: string | null
          name?: string
          paper_width?: number | null
          sort_index?: number
          target?: string
          updated_at?: string
        }
        Relationships: []
      }
      print_settings: {
        Row: {
          auto_delay_ms: number
          auto_print_new_orders: boolean
          beep_on_new: boolean
          beep_repeat: number
          beep_volume: number
          cnpj: string
          copies: number
          cut_after: boolean
          font_size: number
          footer_text: string
          header_text: string
          id: number
          kitchen_group_by_category: boolean
          max_retries: number
          only_paid_orders: boolean
          paper_width: number
          print_customer_copy: boolean
          print_delivery_label: boolean
          print_kitchen_copy: boolean
          show_cnpj: boolean
          show_logo: boolean
          show_pix: boolean
          show_qr: boolean
          silent_mode: boolean
          tax_note: string
          updated_at: string
        }
        Insert: {
          auto_delay_ms?: number
          auto_print_new_orders?: boolean
          beep_on_new?: boolean
          beep_repeat?: number
          beep_volume?: number
          cnpj?: string
          copies?: number
          cut_after?: boolean
          font_size?: number
          footer_text?: string
          header_text?: string
          id?: number
          kitchen_group_by_category?: boolean
          max_retries?: number
          only_paid_orders?: boolean
          paper_width?: number
          print_customer_copy?: boolean
          print_delivery_label?: boolean
          print_kitchen_copy?: boolean
          show_cnpj?: boolean
          show_logo?: boolean
          show_pix?: boolean
          show_qr?: boolean
          silent_mode?: boolean
          tax_note?: string
          updated_at?: string
        }
        Update: {
          auto_delay_ms?: number
          auto_print_new_orders?: boolean
          beep_on_new?: boolean
          beep_repeat?: number
          beep_volume?: number
          cnpj?: string
          copies?: number
          cut_after?: boolean
          font_size?: number
          footer_text?: string
          header_text?: string
          id?: number
          kitchen_group_by_category?: boolean
          max_retries?: number
          only_paid_orders?: boolean
          paper_width?: number
          print_customer_copy?: boolean
          print_delivery_label?: boolean
          print_kitchen_copy?: boolean
          show_cnpj?: boolean
          show_logo?: boolean
          show_pix?: boolean
          show_qr?: boolean
          silent_mode?: boolean
          tax_note?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_recipes: {
        Row: {
          created_at: string
          id: string
          ingredient_id: string
          notes: string | null
          product_id: string
          qty: number
          sort_order: number
          updated_at: string
          waste_pct: number
        }
        Insert: {
          created_at?: string
          id?: string
          ingredient_id: string
          notes?: string | null
          product_id: string
          qty: number
          sort_order?: number
          updated_at?: string
          waste_pct?: number
        }
        Update: {
          created_at?: string
          id?: string
          ingredient_id?: string
          notes?: string | null
          product_id?: string
          qty?: number
          sort_order?: number
          updated_at?: string
          waste_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_recipes_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_recipes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_templates: {
        Row: {
          base_price: number
          category: string | null
          cost_price: number | null
          created_at: string
          created_by: string | null
          description: string | null
          extras: Json | null
          flavors: Json | null
          id: string
          image_url: string | null
          ingredients: Json | null
          is_official: boolean
          name: string
          option_groups: Json | null
          packaging_cost: number | null
          removable: Json | null
          sizes: Json | null
          tags: string[] | null
          target_margin_pct: number | null
          updated_at: string
          usage_count: number
        }
        Insert: {
          base_price?: number
          category?: string | null
          cost_price?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          extras?: Json | null
          flavors?: Json | null
          id?: string
          image_url?: string | null
          ingredients?: Json | null
          is_official?: boolean
          name: string
          option_groups?: Json | null
          packaging_cost?: number | null
          removable?: Json | null
          sizes?: Json | null
          tags?: string[] | null
          target_margin_pct?: number | null
          updated_at?: string
          usage_count?: number
        }
        Update: {
          base_price?: number
          category?: string | null
          cost_price?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          extras?: Json | null
          flavors?: Json | null
          id?: string
          image_url?: string | null
          ingredients?: Json | null
          is_official?: boolean
          name?: string
          option_groups?: Json | null
          packaging_cost?: number | null
          removable?: Json | null
          sizes?: Json | null
          tags?: string[] | null
          target_margin_pct?: number | null
          updated_at?: string
          usage_count?: number
        }
        Relationships: []
      }
      products: {
        Row: {
          active: boolean
          badge: string | null
          base_price: number
          category: string
          cost_price: number | null
          created_at: string
          description: string
          extras: Json | null
          flavors: Json | null
          hero: boolean
          hero_image_pos_x: number
          hero_image_pos_y: number
          hero_image_scale: number
          hero_image_url: string | null
          id: string
          image_pos_x: number
          image_pos_y: number
          image_scale: number
          image_url: string | null
          ingredients: Json
          is_custom: boolean
          is_upsell: boolean
          low_stock_threshold: number
          max_batches: number
          min_batches: number
          name: string
          option_groups: Json | null
          original_price: number | null
          packaging_cost: number | null
          pause_reason: string | null
          paused_until: string | null
          prep_enabled: boolean
          prep_priority: number
          prep_time_min: number
          prep_yield_per_batch: number
          removable: Json | null
          shelf_life_min: number
          sizes: Json
          sort_order: number
          stock: number | null
          target_margin_pct: number | null
          updated_at: string
          upsell_price: number | null
        }
        Insert: {
          active?: boolean
          badge?: string | null
          base_price?: number
          category: string
          cost_price?: number | null
          created_at?: string
          description?: string
          extras?: Json | null
          flavors?: Json | null
          hero?: boolean
          hero_image_pos_x?: number
          hero_image_pos_y?: number
          hero_image_scale?: number
          hero_image_url?: string | null
          id: string
          image_pos_x?: number
          image_pos_y?: number
          image_scale?: number
          image_url?: string | null
          ingredients?: Json
          is_custom?: boolean
          is_upsell?: boolean
          low_stock_threshold?: number
          max_batches?: number
          min_batches?: number
          name: string
          option_groups?: Json | null
          original_price?: number | null
          packaging_cost?: number | null
          pause_reason?: string | null
          paused_until?: string | null
          prep_enabled?: boolean
          prep_priority?: number
          prep_time_min?: number
          prep_yield_per_batch?: number
          removable?: Json | null
          shelf_life_min?: number
          sizes?: Json
          sort_order?: number
          stock?: number | null
          target_margin_pct?: number | null
          updated_at?: string
          upsell_price?: number | null
        }
        Update: {
          active?: boolean
          badge?: string | null
          base_price?: number
          category?: string
          cost_price?: number | null
          created_at?: string
          description?: string
          extras?: Json | null
          flavors?: Json | null
          hero?: boolean
          hero_image_pos_x?: number
          hero_image_pos_y?: number
          hero_image_scale?: number
          hero_image_url?: string | null
          id?: string
          image_pos_x?: number
          image_pos_y?: number
          image_scale?: number
          image_url?: string | null
          ingredients?: Json
          is_custom?: boolean
          is_upsell?: boolean
          low_stock_threshold?: number
          max_batches?: number
          min_batches?: number
          name?: string
          option_groups?: Json | null
          original_price?: number | null
          packaging_cost?: number | null
          pause_reason?: string | null
          paused_until?: string | null
          prep_enabled?: boolean
          prep_priority?: number
          prep_time_min?: number
          prep_yield_per_batch?: number
          removable?: Json | null
          shelf_life_min?: number
          sizes?: Json
          sort_order?: number
          stock?: number | null
          target_margin_pct?: number | null
          updated_at?: string
          upsell_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_fkey"
            columns: ["category"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          birthday: string | null
          cpf: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          preferred_payment: string | null
          reference: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          birthday?: string | null
          cpf?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          preferred_payment?: string | null
          reference?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          birthday?: string | null
          cpf?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          preferred_payment?: string | null
          reference?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      promo_coupon_redemptions: {
        Row: {
          coupon_id: string
          id: string
          order_id: string | null
          redeemed_at: string
          user_id: string
        }
        Insert: {
          coupon_id: string
          id?: string
          order_id?: string | null
          redeemed_at?: string
          user_id: string
        }
        Update: {
          coupon_id?: string
          id?: string
          order_id?: string | null
          redeemed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "promo_coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          max_uses: number | null
          min_order: number
          note: string | null
          per_user_limit: number
          updated_at: string
          uses: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          discount_type: string
          discount_value: number
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          min_order?: number
          note?: string | null
          per_user_limit?: number
          updated_at?: string
          uses?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          min_order?: number
          note?: string | null
          per_user_limit?: number
          updated_at?: string
          uses?: number
        }
        Relationships: []
      }
      proof_of_delivery_settings: {
        Row: {
          alert_on_skip: boolean
          allow_skip: boolean
          allowed_skip_reasons: string[]
          block_completion_without_proof: boolean
          blur_faces: boolean
          contact_types: string[]
          enabled: boolean
          id: number
          max_photo_kb: number
          max_photos: number
          min_photos: number
          notify_channels: string[]
          notify_customer: boolean
          photo_quality: number
          require_gps: boolean
          require_notes: boolean
          require_photo: boolean
          require_signature: boolean
          require_skip_reason: boolean
          retention_days: number
          updated_at: string
          updated_by: string | null
          watermark: boolean
          watermark_show_courier: boolean
          watermark_show_order: boolean
          watermark_show_time: boolean
        }
        Insert: {
          alert_on_skip?: boolean
          allow_skip?: boolean
          allowed_skip_reasons?: string[]
          block_completion_without_proof?: boolean
          blur_faces?: boolean
          contact_types?: string[]
          enabled?: boolean
          id?: number
          max_photo_kb?: number
          max_photos?: number
          min_photos?: number
          notify_channels?: string[]
          notify_customer?: boolean
          photo_quality?: number
          require_gps?: boolean
          require_notes?: boolean
          require_photo?: boolean
          require_signature?: boolean
          require_skip_reason?: boolean
          retention_days?: number
          updated_at?: string
          updated_by?: string | null
          watermark?: boolean
          watermark_show_courier?: boolean
          watermark_show_order?: boolean
          watermark_show_time?: boolean
        }
        Update: {
          alert_on_skip?: boolean
          allow_skip?: boolean
          allowed_skip_reasons?: string[]
          block_completion_without_proof?: boolean
          blur_faces?: boolean
          contact_types?: string[]
          enabled?: boolean
          id?: number
          max_photo_kb?: number
          max_photos?: number
          min_photos?: number
          notify_channels?: string[]
          notify_customer?: boolean
          photo_quality?: number
          require_gps?: boolean
          require_notes?: boolean
          require_photo?: boolean
          require_signature?: boolean
          require_skip_reason?: boolean
          retention_days?: number
          updated_at?: string
          updated_by?: string | null
          watermark?: boolean
          watermark_show_courier?: boolean
          watermark_show_order?: boolean
          watermark_show_time?: boolean
        }
        Relationships: []
      }
      push_automations: {
        Row: {
          active: boolean
          body: string
          config: Json
          created_at: string
          filters: Json
          id: string
          image: string | null
          kind: string
          last_run_at: string | null
          name: string | null
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          active?: boolean
          body: string
          config?: Json
          created_at?: string
          filters?: Json
          id?: string
          image?: string | null
          kind: string
          last_run_at?: string | null
          name?: string | null
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          active?: boolean
          body?: string
          config?: Json
          created_at?: string
          filters?: Json
          id?: string
          image?: string | null
          kind?: string
          last_run_at?: string | null
          name?: string | null
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      push_campaigns: {
        Row: {
          audience: string
          audience_category: string | null
          body: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          failed_count: number
          id: string
          image: string | null
          opened_count: number
          scheduled_for: string | null
          sent_at: string | null
          sent_count: number
          status: string
          title: string
          url: string | null
        }
        Insert: {
          audience?: string
          audience_category?: string | null
          body: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          failed_count?: number
          id?: string
          image?: string | null
          opened_count?: number
          scheduled_for?: string | null
          sent_at?: string | null
          sent_count?: number
          status?: string
          title: string
          url?: string | null
        }
        Update: {
          audience?: string
          audience_category?: string | null
          body?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          failed_count?: number
          id?: string
          image?: string | null
          opened_count?: number
          scheduled_for?: string | null
          sent_at?: string | null
          sent_count?: number
          status?: string
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_campaigns_audience_category_fkey"
            columns: ["audience_category"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      push_deliveries: {
        Row: {
          campaign_id: string
          created_at: string
          id: string
          opened_at: string | null
          status: string
          subscription_id: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          id?: string
          opened_at?: string | null
          status?: string
          subscription_id?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          id?: string
          opened_at?: string | null
          status?: string
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_deliveries_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "push_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_deliveries_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "push_campaigns_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_deliveries_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "push_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_seen_at: string
          p256dh: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_seen_at?: string
          p256dh: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_seen_at?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          user_id: string
          uses_count: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          user_id: string
          uses_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          user_id?: string
          uses_count?: number
        }
        Relationships: []
      }
      referral_events: {
        Row: {
          code: string
          created_at: string
          id: string
          order_id: string | null
          referee_coupon_id: string | null
          referee_user_id: string | null
          referrer_coupon_id: string | null
          referrer_user_id: string
          rewarded_at: string | null
          status: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          order_id?: string | null
          referee_coupon_id?: string | null
          referee_user_id?: string | null
          referrer_coupon_id?: string | null
          referrer_user_id: string
          rewarded_at?: string | null
          status?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          order_id?: string | null
          referee_coupon_id?: string | null
          referee_user_id?: string | null
          referrer_coupon_id?: string | null
          referrer_user_id?: string
          rewarded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_tracking_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_events_referee_coupon_id_fkey"
            columns: ["referee_coupon_id"]
            isOneToOne: false
            referencedRelation: "promo_coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_events_referrer_coupon_id_fkey"
            columns: ["referrer_coupon_id"]
            isOneToOne: false
            referencedRelation: "promo_coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_settings: {
        Row: {
          enabled: boolean
          expires_days: number
          id: number
          max_referrals_per_user: number | null
          referee_discount_type: string
          referee_discount_value: number
          referee_min_order: number
          referrer_discount_type: string
          referrer_discount_value: number
          referrer_min_order: number
          require_first_order: boolean
          share_message: string
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          expires_days?: number
          id?: number
          max_referrals_per_user?: number | null
          referee_discount_type?: string
          referee_discount_value?: number
          referee_min_order?: number
          referrer_discount_type?: string
          referrer_discount_value?: number
          referrer_min_order?: number
          require_first_order?: boolean
          share_message?: string
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          expires_days?: number
          id?: number
          max_referrals_per_user?: number | null
          referee_discount_type?: string
          referee_discount_value?: number
          referee_min_order?: number
          referrer_discount_type?: string
          referrer_discount_value?: number
          referrer_min_order?: number
          require_first_order?: boolean
          share_message?: string
          updated_at?: string
        }
        Relationships: []
      }
      restaurant_tables: {
        Row: {
          created_at: string
          current_order_id: string | null
          id: string
          label: string | null
          notes: string | null
          number: number
          opened_at: string | null
          people_count: number | null
          pos_x: number | null
          pos_y: number | null
          seats: number
          status: string
          updated_at: string
          waiter_id: string | null
          zone: string
        }
        Insert: {
          created_at?: string
          current_order_id?: string | null
          id?: string
          label?: string | null
          notes?: string | null
          number: number
          opened_at?: string | null
          people_count?: number | null
          pos_x?: number | null
          pos_y?: number | null
          seats?: number
          status?: string
          updated_at?: string
          waiter_id?: string | null
          zone?: string
        }
        Update: {
          created_at?: string
          current_order_id?: string | null
          id?: string
          label?: string | null
          notes?: string | null
          number?: number
          opened_at?: string | null
          people_count?: number | null
          pos_x?: number | null
          pos_y?: number | null
          seats?: number
          status?: string
          updated_at?: string
          waiter_id?: string | null
          zone?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_tables_waiter_id_fkey"
            columns: ["waiter_id"]
            isOneToOne: false
            referencedRelation: "waiters"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          featured: boolean
          helpful_count: number
          id: string
          order_id: string | null
          order_mode: string | null
          photos: string[]
          product_id: string | null
          rating: number
          rating_delivery: number | null
          rating_food: number | null
          rating_packaging: number | null
          rating_service: number | null
          rating_value: number | null
          replied_at: string | null
          replied_by: string | null
          reply: string | null
          status: Database["public"]["Enums"]["review_status"]
          tags: string[]
          title: string | null
          updated_at: string
          user_id: string
          would_recommend: boolean | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          featured?: boolean
          helpful_count?: number
          id?: string
          order_id?: string | null
          order_mode?: string | null
          photos?: string[]
          product_id?: string | null
          rating: number
          rating_delivery?: number | null
          rating_food?: number | null
          rating_packaging?: number | null
          rating_service?: number | null
          rating_value?: number | null
          replied_at?: string | null
          replied_by?: string | null
          reply?: string | null
          status?: Database["public"]["Enums"]["review_status"]
          tags?: string[]
          title?: string | null
          updated_at?: string
          user_id: string
          would_recommend?: boolean | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          featured?: boolean
          helpful_count?: number
          id?: string
          order_id?: string | null
          order_mode?: string | null
          photos?: string[]
          product_id?: string | null
          rating?: number
          rating_delivery?: number | null
          rating_food?: number | null
          rating_packaging?: number | null
          rating_service?: number | null
          rating_value?: number | null
          replied_at?: string | null
          replied_by?: string | null
          reply?: string | null
          status?: Database["public"]["Enums"]["review_status"]
          tags?: string[]
          title?: string | null
          updated_at?: string
          user_id?: string
          would_recommend?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_tracking_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      route_optimization_settings: {
        Row: {
          auto_optimize: boolean
          avoid_ferries: boolean
          avoid_highways: boolean
          avoid_tolls: boolean
          created_at: string
          enabled: boolean
          extra_time_per_stop_min: number
          id: number
          max_stops: number
          min_stops: number
          notify_courier: boolean
          provider: string
          return_to_store: boolean
          traffic_mode: string
          travel_mode: string
          units: string
          updated_at: string
        }
        Insert: {
          auto_optimize?: boolean
          avoid_ferries?: boolean
          avoid_highways?: boolean
          avoid_tolls?: boolean
          created_at?: string
          enabled?: boolean
          extra_time_per_stop_min?: number
          id?: number
          max_stops?: number
          min_stops?: number
          notify_courier?: boolean
          provider?: string
          return_to_store?: boolean
          traffic_mode?: string
          travel_mode?: string
          units?: string
          updated_at?: string
        }
        Update: {
          auto_optimize?: boolean
          avoid_ferries?: boolean
          avoid_highways?: boolean
          avoid_tolls?: boolean
          created_at?: string
          enabled?: boolean
          extra_time_per_stop_min?: number
          id?: number
          max_stops?: number
          min_stops?: number
          notify_courier?: boolean
          provider?: string
          return_to_store?: boolean
          traffic_mode?: string
          travel_mode?: string
          units?: string
          updated_at?: string
        }
        Relationships: []
      }
      route_optimizations: {
        Row: {
          courier_id: string | null
          created_at: string
          encoded_polyline: string | null
          id: string
          legs: Json | null
          naive_distance_km: number | null
          order_ids: string[]
          origin_lat: number | null
          origin_lng: number | null
          provider_used: string | null
          return_to_store: boolean
          saved_km: number | null
          saved_min: number | null
          sequence: string[]
          total_distance_km: number | null
          total_duration_min: number | null
        }
        Insert: {
          courier_id?: string | null
          created_at?: string
          encoded_polyline?: string | null
          id?: string
          legs?: Json | null
          naive_distance_km?: number | null
          order_ids: string[]
          origin_lat?: number | null
          origin_lng?: number | null
          provider_used?: string | null
          return_to_store?: boolean
          saved_km?: number | null
          saved_min?: number | null
          sequence: string[]
          total_distance_km?: number | null
          total_duration_min?: number | null
        }
        Update: {
          courier_id?: string | null
          created_at?: string
          encoded_polyline?: string | null
          id?: string
          legs?: Json | null
          naive_distance_km?: number | null
          order_ids?: string[]
          origin_lat?: number | null
          origin_lng?: number | null
          provider_used?: string | null
          return_to_store?: boolean
          saved_km?: number | null
          saved_min?: number | null
          sequence?: string[]
          total_distance_km?: number | null
          total_duration_min?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "route_optimizations_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_optimizations_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "couriers_live"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_optimizations_courier_id_fkey"
            columns: ["courier_id"]
            isOneToOne: false
            referencedRelation: "order_tracking_public"
            referencedColumns: ["courier_id"]
          },
        ]
      }
      shared_carts: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          items: Json
          merged_order_id: string | null
          message: string
          owner_name: string
          owner_user_id: string | null
          participants: Json
          status: string
          title: string
          token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          items?: Json
          merged_order_id?: string | null
          message?: string
          owner_name?: string
          owner_user_id?: string | null
          participants?: Json
          status?: string
          title?: string
          token: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          items?: Json
          merged_order_id?: string | null
          message?: string
          owner_name?: string
          owner_user_id?: string | null
          participants?: Json
          status?: string
          title?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_carts_merged_order_id_fkey"
            columns: ["merged_order_id"]
            isOneToOne: false
            referencedRelation: "order_tracking_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_carts_merged_order_id_fkey"
            columns: ["merged_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      site_popups: {
        Row: {
          active: boolean
          audience: string
          audience_days: number | null
          body: string
          created_at: string
          cta: string
          days_of_week: number[]
          end_hour: number | null
          ends_at: string | null
          frequency: string
          id: string
          image_pos_x: number
          image_pos_y: number
          image_scale: number
          image_url: string
          kind: string
          link: string
          name: string
          priority: number
          start_hour: number | null
          starts_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          audience?: string
          audience_days?: number | null
          body?: string
          created_at?: string
          cta?: string
          days_of_week?: number[]
          end_hour?: number | null
          ends_at?: string | null
          frequency?: string
          id?: string
          image_pos_x?: number
          image_pos_y?: number
          image_scale?: number
          image_url?: string
          kind?: string
          link?: string
          name?: string
          priority?: number
          start_hour?: number | null
          starts_at?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          audience?: string
          audience_days?: number | null
          body?: string
          created_at?: string
          cta?: string
          days_of_week?: number[]
          end_hour?: number | null
          ends_at?: string | null
          frequency?: string
          id?: string
          image_pos_x?: number
          image_pos_y?: number
          image_scale?: number
          image_url?: string
          kind?: string
          link?: string
          name?: string
          priority?: number
          start_hour?: number | null
          starts_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          accent_color: string
          accepts_delivery: boolean
          accepts_pickup: boolean
          address: string
          announcement_active: boolean
          announcement_text: string
          bg_color: string
          card_border: boolean
          card_glow: boolean
          card_radius: number
          city: string
          delivery_fee: number
          delivery_zone_json: Json | null
          facebook: string
          free_delivery_threshold: number
          global_extras: Json
          hero_images: Json | null
          hours: string
          hours_json: Json
          id: number
          instagram: string
          logo_url: string | null
          map_embed: string
          maps_url: string
          min_order: number
          name: string
          news_active: boolean
          news_product_ids: Json
          news_subtitle: string | null
          news_ticker: string | null
          news_title: string
          open_override: string
          payment_methods: Json
          pix_key: string
          popup_active: boolean
          popup_body: string
          popup_cta: string
          popup_frequency: string
          popup_image_pos_x: number
          popup_image_pos_y: number
          popup_image_scale: number
          popup_image_url: string
          popup_link: string
          popup_title: string
          pricing_card_fee_pct: number | null
          pricing_expected_sales_monthly: number | null
          pricing_fixed_cost_monthly: number | null
          pricing_platform_fee_pct: number | null
          pricing_tax_pct: number | null
          store_lat: number | null
          store_lng: number | null
          tagline: string
          texture_opacity: number
          texture_size: string
          texture_url: string | null
          tiktok: string
          title_font: string
          updated_at: string
          urgency_active: boolean
          urgency_coupon_code: string | null
          urgency_ends_at: string | null
          urgency_text: string | null
          whatsapp: string
          whatsapp_display: string
        }
        Insert: {
          accent_color?: string
          accepts_delivery?: boolean
          accepts_pickup?: boolean
          address?: string
          announcement_active?: boolean
          announcement_text?: string
          bg_color?: string
          card_border?: boolean
          card_glow?: boolean
          card_radius?: number
          city?: string
          delivery_fee?: number
          delivery_zone_json?: Json | null
          facebook?: string
          free_delivery_threshold?: number
          global_extras?: Json
          hero_images?: Json | null
          hours?: string
          hours_json?: Json
          id?: number
          instagram?: string
          logo_url?: string | null
          map_embed?: string
          maps_url?: string
          min_order?: number
          name?: string
          news_active?: boolean
          news_product_ids?: Json
          news_subtitle?: string | null
          news_ticker?: string | null
          news_title?: string
          open_override?: string
          payment_methods?: Json
          pix_key?: string
          popup_active?: boolean
          popup_body?: string
          popup_cta?: string
          popup_frequency?: string
          popup_image_pos_x?: number
          popup_image_pos_y?: number
          popup_image_scale?: number
          popup_image_url?: string
          popup_link?: string
          popup_title?: string
          pricing_card_fee_pct?: number | null
          pricing_expected_sales_monthly?: number | null
          pricing_fixed_cost_monthly?: number | null
          pricing_platform_fee_pct?: number | null
          pricing_tax_pct?: number | null
          store_lat?: number | null
          store_lng?: number | null
          tagline?: string
          texture_opacity?: number
          texture_size?: string
          texture_url?: string | null
          tiktok?: string
          title_font?: string
          updated_at?: string
          urgency_active?: boolean
          urgency_coupon_code?: string | null
          urgency_ends_at?: string | null
          urgency_text?: string | null
          whatsapp?: string
          whatsapp_display?: string
        }
        Update: {
          accent_color?: string
          accepts_delivery?: boolean
          accepts_pickup?: boolean
          address?: string
          announcement_active?: boolean
          announcement_text?: string
          bg_color?: string
          card_border?: boolean
          card_glow?: boolean
          card_radius?: number
          city?: string
          delivery_fee?: number
          delivery_zone_json?: Json | null
          facebook?: string
          free_delivery_threshold?: number
          global_extras?: Json
          hero_images?: Json | null
          hours?: string
          hours_json?: Json
          id?: number
          instagram?: string
          logo_url?: string | null
          map_embed?: string
          maps_url?: string
          min_order?: number
          name?: string
          news_active?: boolean
          news_product_ids?: Json
          news_subtitle?: string | null
          news_ticker?: string | null
          news_title?: string
          open_override?: string
          payment_methods?: Json
          pix_key?: string
          popup_active?: boolean
          popup_body?: string
          popup_cta?: string
          popup_frequency?: string
          popup_image_pos_x?: number
          popup_image_pos_y?: number
          popup_image_scale?: number
          popup_image_url?: string
          popup_link?: string
          popup_title?: string
          pricing_card_fee_pct?: number | null
          pricing_expected_sales_monthly?: number | null
          pricing_fixed_cost_monthly?: number | null
          pricing_platform_fee_pct?: number | null
          pricing_tax_pct?: number | null
          store_lat?: number | null
          store_lng?: number | null
          tagline?: string
          texture_opacity?: number
          texture_size?: string
          texture_url?: string | null
          tiktok?: string
          title_font?: string
          updated_at?: string
          urgency_active?: boolean
          urgency_coupon_code?: string | null
          urgency_ends_at?: string | null
          urgency_text?: string | null
          whatsapp?: string
          whatsapp_display?: string
        }
        Relationships: []
      }
      sla_settings: {
        Row: {
          auto_notify_admin: boolean
          auto_notify_on: string
          created_at: string
          enabled: boolean
          green_max_entrega: number
          green_max_mesa: number
          green_max_retirada: number
          historical_green_factor: number
          historical_lookback_days: number
          historical_yellow_factor: number
          id: number
          mode: string
          singleton: boolean
          updated_at: string
          warn_before_red_pct: number
          yellow_max_entrega: number
          yellow_max_mesa: number
          yellow_max_retirada: number
        }
        Insert: {
          auto_notify_admin?: boolean
          auto_notify_on?: string
          created_at?: string
          enabled?: boolean
          green_max_entrega?: number
          green_max_mesa?: number
          green_max_retirada?: number
          historical_green_factor?: number
          historical_lookback_days?: number
          historical_yellow_factor?: number
          id?: number
          mode?: string
          singleton?: boolean
          updated_at?: string
          warn_before_red_pct?: number
          yellow_max_entrega?: number
          yellow_max_mesa?: number
          yellow_max_retirada?: number
        }
        Update: {
          auto_notify_admin?: boolean
          auto_notify_on?: string
          created_at?: string
          enabled?: boolean
          green_max_entrega?: number
          green_max_mesa?: number
          green_max_retirada?: number
          historical_green_factor?: number
          historical_lookback_days?: number
          historical_yellow_factor?: number
          id?: number
          mode?: string
          singleton?: boolean
          updated_at?: string
          warn_before_red_pct?: number
          yellow_max_entrega?: number
          yellow_max_mesa?: number
          yellow_max_retirada?: number
        }
        Relationships: []
      }
      sound_alert_settings: {
        Row: {
          created_at: string
          enabled: boolean
          id: number
          late_after_minutes: number
          master_volume: number
          quiet_end: string
          quiet_hours_enabled: boolean
          quiet_start: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: number
          late_after_minutes?: number
          master_volume?: number
          quiet_end?: string
          quiet_hours_enabled?: boolean
          quiet_start?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: number
          late_after_minutes?: number
          master_volume?: number
          quiet_end?: string
          quiet_hours_enabled?: boolean
          quiet_start?: string
          updated_at?: string
        }
        Relationships: []
      }
      sound_alerts: {
        Row: {
          created_at: string
          custom_url: string | null
          description: string | null
          duration_ms: number
          enabled: boolean
          event_key: string
          frequency: number
          interval_ms: number
          label: string
          preset: string
          repeats: number
          sort_index: number
          speak_enabled: boolean
          speak_text: string | null
          updated_at: string
          volume: number
          waveform: string
        }
        Insert: {
          created_at?: string
          custom_url?: string | null
          description?: string | null
          duration_ms?: number
          enabled?: boolean
          event_key: string
          frequency?: number
          interval_ms?: number
          label: string
          preset?: string
          repeats?: number
          sort_index?: number
          speak_enabled?: boolean
          speak_text?: string | null
          updated_at?: string
          volume?: number
          waveform?: string
        }
        Update: {
          created_at?: string
          custom_url?: string | null
          description?: string | null
          duration_ms?: number
          enabled?: boolean
          event_key?: string
          frequency?: number
          interval_ms?: number
          label?: string
          preset?: string
          repeats?: number
          sort_index?: number
          speak_enabled?: boolean
          speak_text?: string | null
          updated_at?: string
          volume?: number
          waveform?: string
        }
        Relationships: []
      }
      user_addresses: {
        Row: {
          address: string
          created_at: string
          id: string
          is_default: boolean
          label: string
          lat: number | null
          lng: number | null
          reference: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          lat?: number | null
          lng?: number | null
          reference?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          lat?: number | null
          lng?: number | null
          reference?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_role_audit: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          note: string | null
          role: Database["public"]["Enums"]["app_role"]
          target_user_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          role: Database["public"]["Enums"]["app_role"]
          target_user_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          target_user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      waiters: {
        Row: {
          active: boolean
          avatar_url: string | null
          code: string
          commission_pct: number
          created_at: string
          hired_at: string
          id: string
          name: string
          note: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          code: string
          commission_pct?: number
          created_at?: string
          hired_at?: string
          id?: string
          name: string
          note?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          code?: string
          commission_pct?: number
          created_at?: string
          hired_at?: string
          id?: string
          name?: string
          note?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_conversations: {
        Row: {
          ai_paused: boolean
          assigned_to: string | null
          contact_name: string | null
          created_at: string
          id: string
          last_message_at: string
          last_message_preview: string | null
          phone: string
          profile_pic_url: string | null
          unread_count: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ai_paused?: boolean
          assigned_to?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          last_message_at?: string
          last_message_preview?: string | null
          phone: string
          profile_pic_url?: string | null
          unread_count?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ai_paused?: boolean
          assigned_to?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          last_message_at?: string
          last_message_preview?: string | null
          phone?: string
          profile_pic_url?: string | null
          unread_count?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      whatsapp_ingest_logs: {
        Row: {
          created_at: string
          error: string | null
          event: string | null
          evolution_id: string | null
          from_me: boolean | null
          id: string
          message_type: string | null
          payload: Json | null
          phone: string | null
          preview: string | null
          source: string
          status: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          event?: string | null
          evolution_id?: string | null
          from_me?: boolean | null
          id?: string
          message_type?: string | null
          payload?: Json | null
          phone?: string | null
          preview?: string | null
          source?: string
          status: string
        }
        Update: {
          created_at?: string
          error?: string | null
          event?: string | null
          evolution_id?: string | null
          from_me?: boolean | null
          id?: string
          message_type?: string | null
          payload?: Json | null
          phone?: string | null
          preview?: string | null
          source?: string
          status?: string
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          direction: string
          error: string | null
          evolution_id: string | null
          id: string
          media_url: string | null
          operator_id: string | null
          raw: Json | null
          read_at: string | null
          sent_by: string
          status: string | null
          transcript: string | null
          type: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          direction: string
          error?: string | null
          evolution_id?: string | null
          id?: string
          media_url?: string | null
          operator_id?: string | null
          raw?: Json | null
          read_at?: string | null
          sent_by?: string
          status?: string | null
          transcript?: string | null
          type?: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          direction?: string
          error?: string | null
          evolution_id?: string | null
          id?: string
          media_url?: string | null
          operator_id?: string | null
          raw?: Json | null
          read_at?: string | null
          sent_by?: string
          status?: string | null
          transcript?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      couriers_live: {
        Row: {
          accuracy: number | null
          active: boolean | null
          avatar_url: string | null
          current_lat: number | null
          current_lng: number | null
          heading: number | null
          id: string | null
          last_seen_at: string | null
          location_updated_at: string | null
          name: string | null
          phone: string | null
          plate: string | null
          rating: number | null
          speed: number | null
          status: string | null
          total_deliveries: number | null
          vehicle: string | null
        }
        Insert: {
          accuracy?: number | null
          active?: boolean | null
          avatar_url?: string | null
          current_lat?: number | null
          current_lng?: number | null
          heading?: number | null
          id?: string | null
          last_seen_at?: string | null
          location_updated_at?: string | null
          name?: string | null
          phone?: string | null
          plate?: string | null
          rating?: number | null
          speed?: number | null
          status?: string | null
          total_deliveries?: number | null
          vehicle?: string | null
        }
        Update: {
          accuracy?: number | null
          active?: boolean | null
          avatar_url?: string | null
          current_lat?: number | null
          current_lng?: number | null
          heading?: number | null
          id?: string | null
          last_seen_at?: string | null
          location_updated_at?: string | null
          name?: string | null
          phone?: string | null
          plate?: string | null
          rating?: number | null
          speed?: number | null
          status?: string | null
          total_deliveries?: number | null
          vehicle?: string | null
        }
        Relationships: []
      }
      order_tracking_public: {
        Row: {
          address: string | null
          courier_avatar: string | null
          courier_heading: number | null
          courier_id: string | null
          courier_lat: number | null
          courier_lng: number | null
          courier_location_at: string | null
          courier_name: string | null
          courier_phone: string | null
          courier_rating: number | null
          courier_vehicle: string | null
          created_at: string | null
          customer_name: string | null
          delivered_at: string | null
          delivery_lat: number | null
          delivery_lng: number | null
          dispatched_at: string | null
          distance_km: number | null
          eta_minutes: number | null
          id: string | null
          mode: string | null
          origin_lat: number | null
          origin_lng: number | null
          paid_at: string | null
          picked_up_at: string | null
          preparing_at: string | null
          reference: string | null
          status: string | null
          total: number | null
          tracking_token: string | null
        }
        Relationships: []
      }
      push_campaigns_public: {
        Row: {
          body: string | null
          created_at: string | null
          expires_at: string | null
          id: string | null
          image: string | null
          title: string | null
          url: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string | null
          image?: string | null
          title?: string | null
          url?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string | null
          image?: string | null
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      site_settings_public: {
        Row: {
          accent_color: string | null
          accepts_delivery: boolean | null
          accepts_pickup: boolean | null
          address: string | null
          announcement_active: boolean | null
          announcement_text: string | null
          bg_color: string | null
          card_border: boolean | null
          card_glow: boolean | null
          card_radius: number | null
          city: string | null
          delivery_fee: number | null
          delivery_zone_json: Json | null
          facebook: string | null
          free_delivery_threshold: number | null
          global_extras: Json | null
          hero_images: Json | null
          hours: string | null
          hours_json: Json | null
          id: number | null
          instagram: string | null
          logo_url: string | null
          map_embed: string | null
          maps_url: string | null
          min_order: number | null
          name: string | null
          news_active: boolean | null
          news_product_ids: Json | null
          news_subtitle: string | null
          news_ticker: string | null
          news_title: string | null
          open_override: string | null
          payment_methods: Json | null
          popup_active: boolean | null
          popup_body: string | null
          popup_cta: string | null
          popup_frequency: string | null
          popup_image_pos_x: number | null
          popup_image_pos_y: number | null
          popup_image_scale: number | null
          popup_image_url: string | null
          popup_link: string | null
          popup_title: string | null
          pricing_card_fee_pct: number | null
          pricing_expected_sales_monthly: number | null
          pricing_fixed_cost_monthly: number | null
          pricing_platform_fee_pct: number | null
          pricing_tax_pct: number | null
          store_lat: number | null
          store_lng: number | null
          tagline: string | null
          texture_opacity: number | null
          texture_size: string | null
          texture_url: string | null
          tiktok: string | null
          title_font: string | null
          updated_at: string | null
          urgency_active: boolean | null
          urgency_coupon_code: string | null
          urgency_ends_at: string | null
          urgency_text: string | null
          whatsapp: string | null
          whatsapp_display: string | null
        }
        Insert: {
          accent_color?: string | null
          accepts_delivery?: boolean | null
          accepts_pickup?: boolean | null
          address?: string | null
          announcement_active?: boolean | null
          announcement_text?: string | null
          bg_color?: string | null
          card_border?: boolean | null
          card_glow?: boolean | null
          card_radius?: number | null
          city?: string | null
          delivery_fee?: number | null
          delivery_zone_json?: Json | null
          facebook?: string | null
          free_delivery_threshold?: number | null
          global_extras?: Json | null
          hero_images?: Json | null
          hours?: string | null
          hours_json?: Json | null
          id?: number | null
          instagram?: string | null
          logo_url?: string | null
          map_embed?: string | null
          maps_url?: string | null
          min_order?: number | null
          name?: string | null
          news_active?: boolean | null
          news_product_ids?: Json | null
          news_subtitle?: string | null
          news_ticker?: string | null
          news_title?: string | null
          open_override?: string | null
          payment_methods?: Json | null
          popup_active?: boolean | null
          popup_body?: string | null
          popup_cta?: string | null
          popup_frequency?: string | null
          popup_image_pos_x?: number | null
          popup_image_pos_y?: number | null
          popup_image_scale?: number | null
          popup_image_url?: string | null
          popup_link?: string | null
          popup_title?: string | null
          pricing_card_fee_pct?: number | null
          pricing_expected_sales_monthly?: number | null
          pricing_fixed_cost_monthly?: number | null
          pricing_platform_fee_pct?: number | null
          pricing_tax_pct?: number | null
          store_lat?: number | null
          store_lng?: number | null
          tagline?: string | null
          texture_opacity?: number | null
          texture_size?: string | null
          texture_url?: string | null
          tiktok?: string | null
          title_font?: string | null
          updated_at?: string | null
          urgency_active?: boolean | null
          urgency_coupon_code?: string | null
          urgency_ends_at?: string | null
          urgency_text?: string | null
          whatsapp?: string | null
          whatsapp_display?: string | null
        }
        Update: {
          accent_color?: string | null
          accepts_delivery?: boolean | null
          accepts_pickup?: boolean | null
          address?: string | null
          announcement_active?: boolean | null
          announcement_text?: string | null
          bg_color?: string | null
          card_border?: boolean | null
          card_glow?: boolean | null
          card_radius?: number | null
          city?: string | null
          delivery_fee?: number | null
          delivery_zone_json?: Json | null
          facebook?: string | null
          free_delivery_threshold?: number | null
          global_extras?: Json | null
          hero_images?: Json | null
          hours?: string | null
          hours_json?: Json | null
          id?: number | null
          instagram?: string | null
          logo_url?: string | null
          map_embed?: string | null
          maps_url?: string | null
          min_order?: number | null
          name?: string | null
          news_active?: boolean | null
          news_product_ids?: Json | null
          news_subtitle?: string | null
          news_ticker?: string | null
          news_title?: string | null
          open_override?: string | null
          payment_methods?: Json | null
          popup_active?: boolean | null
          popup_body?: string | null
          popup_cta?: string | null
          popup_frequency?: string | null
          popup_image_pos_x?: number | null
          popup_image_pos_y?: number | null
          popup_image_scale?: number | null
          popup_image_url?: string | null
          popup_link?: string | null
          popup_title?: string | null
          pricing_card_fee_pct?: number | null
          pricing_expected_sales_monthly?: number | null
          pricing_fixed_cost_monthly?: number | null
          pricing_platform_fee_pct?: number | null
          pricing_tax_pct?: number | null
          store_lat?: number | null
          store_lng?: number | null
          tagline?: string | null
          texture_opacity?: number | null
          texture_size?: string | null
          texture_url?: string | null
          tiktok?: string | null
          title_font?: string | null
          updated_at?: string | null
          urgency_active?: boolean | null
          urgency_coupon_code?: string | null
          urgency_ends_at?: string | null
          urgency_text?: string | null
          whatsapp?: string | null
          whatsapp_display?: string | null
        }
        Relationships: []
      }
      storefront_settings: {
        Row: {
          accepts_delivery: boolean | null
          accepts_pickup: boolean | null
          address: string | null
          announcement_active: boolean | null
          announcement_text: string | null
          city: string | null
          delivery_fee: number | null
          facebook: string | null
          free_delivery_threshold: number | null
          hours: string | null
          hours_json: Json | null
          id: number | null
          instagram: string | null
          logo_url: string | null
          map_embed: string | null
          maps_url: string | null
          min_order: number | null
          name: string | null
          open_override: string | null
          payment_methods: Json | null
          pix_key: string | null
          tagline: string | null
          texture_url: string | null
          tiktok: string | null
          updated_at: string | null
          whatsapp: string | null
          whatsapp_display: string | null
        }
        Insert: {
          accepts_delivery?: boolean | null
          accepts_pickup?: boolean | null
          address?: string | null
          announcement_active?: boolean | null
          announcement_text?: string | null
          city?: string | null
          delivery_fee?: number | null
          facebook?: string | null
          free_delivery_threshold?: number | null
          hours?: string | null
          hours_json?: Json | null
          id?: number | null
          instagram?: string | null
          logo_url?: string | null
          map_embed?: string | null
          maps_url?: string | null
          min_order?: number | null
          name?: string | null
          open_override?: string | null
          payment_methods?: Json | null
          pix_key?: string | null
          tagline?: string | null
          texture_url?: string | null
          tiktok?: string | null
          updated_at?: string | null
          whatsapp?: string | null
          whatsapp_display?: string | null
        }
        Update: {
          accepts_delivery?: boolean | null
          accepts_pickup?: boolean | null
          address?: string | null
          announcement_active?: boolean | null
          announcement_text?: string | null
          city?: string | null
          delivery_fee?: number | null
          facebook?: string | null
          free_delivery_threshold?: number | null
          hours?: string | null
          hours_json?: Json | null
          id?: number | null
          instagram?: string | null
          logo_url?: string | null
          map_embed?: string | null
          maps_url?: string | null
          min_order?: number | null
          name?: string | null
          open_override?: string | null
          payment_methods?: Json | null
          pix_key?: string | null
          tagline?: string | null
          texture_url?: string | null
          tiktok?: string | null
          updated_at?: string | null
          whatsapp?: string | null
          whatsapp_display?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_delivery_offer: { Args: { _offer_id: string }; Returns: Json }
      add_shared_cart_item: {
        Args: { _item: Json; _participant: string; _token: string }
        Returns: Json
      }
      admin_birthday_stats: { Args: never; Returns: Json }
      admin_cancel_pending_grant: { Args: { _id: string }; Returns: undefined }
      admin_get_birthday_settings: {
        Args: never
        Returns: {
          banner_cta: string
          banner_emoji: string
          banner_message: string
          banner_title: string
          coupon_prefix: string
          created_at: string
          discount_type: string
          discount_value: number
          enabled: boolean
          id: number
          min_order: number
          notify_days_before: number
          per_user_yearly: number
          push_auto: boolean
          push_body: string
          push_title: string
          updated_at: string
          validity_days: number
          validity_mode: string
        }[]
        SetofOptions: {
          from: "*"
          to: "birthday_settings"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_grant_role: {
        Args: {
          _note?: string
          _role: Database["public"]["Enums"]["app_role"]
          _target: string
        }
        Returns: undefined
      }
      admin_list_birthday_history: {
        Args: { _limit?: number }
        Returns: {
          coupon_code: string
          coupon_expires_at: string
          created_at: string
          email: string
          full_name: string
          gift_id: string
          granted_by_email: string
          push_sent_at: string
          used_at: string
          user_id: string
          year: number
        }[]
      }
      admin_list_pending_grants: {
        Args: never
        Returns: {
          created_at: string
          email: string
          full_name: string
          granted_by_email: string
          id: string
          note: string
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      admin_list_push_campaigns: {
        Args: { _limit?: number }
        Returns: {
          audience: string
          audience_category: string | null
          body: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          failed_count: number
          id: string
          image: string | null
          opened_count: number
          scheduled_for: string | null
          sent_at: string | null
          sent_count: number
          status: string
          title: string
          url: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "push_campaigns"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_list_referrals: {
        Args: { _limit?: number }
        Returns: {
          code: string
          created_at: string
          id: string
          referee_email: string
          referee_name: string
          referrer_email: string
          referrer_name: string
          rewarded_at: string
          status: string
        }[]
      }
      admin_list_role_audit: {
        Args: { _limit?: number }
        Returns: {
          action: string
          actor_email: string
          actor_name: string
          created_at: string
          id: string
          note: string
          role: string
          target_email: string
          target_name: string
        }[]
      }
      admin_list_upcoming_birthdays: {
        Args: { _days?: number }
        Returns: {
          birthday: string
          days_until: number
          email: string
          full_name: string
          gift_claimed: boolean
          gift_code: string
          phone: string
          push_sent: boolean
          user_id: string
        }[]
      }
      admin_list_users: {
        Args: never
        Returns: {
          avatar_url: string
          birthday: string
          cpf: string
          created_at: string
          email: string
          email_confirmed_at: string
          full_name: string
          id: string
          last_sign_in_at: string
          orders_count: number
          phone: string
          roles: string[]
          total_spent: number
        }[]
      }
      admin_revoke_role: {
        Args: {
          _note?: string
          _role: Database["public"]["Enums"]["app_role"]
          _target: string
        }
        Returns: undefined
      }
      admin_send_birthday_gift: {
        Args: { _note?: string; _user_id: string }
        Returns: {
          code: string
          expires_at: string
        }[]
      }
      admin_update_birthday_settings: {
        Args: { _patch: Json }
        Returns: {
          banner_cta: string
          banner_emoji: string
          banner_message: string
          banner_title: string
          coupon_prefix: string
          created_at: string
          discount_type: string
          discount_value: number
          enabled: boolean
          id: number
          min_order: number
          notify_days_before: number
          per_user_yearly: number
          push_auto: boolean
          push_body: string
          push_title: string
          updated_at: string
          validity_days: number
          validity_mode: string
        }
        SetofOptions: {
          from: "*"
          to: "birthday_settings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_update_referral_settings: {
        Args: { _payload: Json }
        Returns: {
          enabled: boolean
          expires_days: number
          id: number
          max_referrals_per_user: number | null
          referee_discount_type: string
          referee_discount_value: number
          referee_min_order: number
          referrer_discount_type: string
          referrer_discount_value: number
          referrer_min_order: number
          require_first_order: boolean
          share_message: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "referral_settings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      apply_referral_code: {
        Args: { _code: string }
        Returns: {
          coupon_code: string
          discount_type: string
          discount_value: number
          expires_at: string
        }[]
      }
      broadcast_delivery_offer: {
        Args: { _fee?: number; _order_id: string }
        Returns: Json
      }
      claim_birthday_gift: {
        Args: never
        Returns: {
          code: string
          discount_value: number
          expires_at: string
        }[]
      }
      clear_table: { Args: { _table_id: string }; Returns: undefined }
      close_cash_session: {
        Args: { _counted: number; _note?: string; _session_id: string }
        Returns: {
          closed_at: string | null
          closing_note: string | null
          counted_amount: number | null
          created_at: string
          difference: number | null
          expected_amount: number | null
          id: string
          opened_at: string
          opening_amount: number
          opening_note: string | null
          operator_id: string | null
          operator_name: string | null
          status: string
          terminal: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "cash_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      close_shared_cart: { Args: { _token: string }; Returns: Json }
      complete_delivery:
        | { Args: { _order_id: string }; Returns: Json }
        | {
            Args: {
              _contact_type?: string
              _lat?: number
              _lng?: number
              _notes?: string
              _order_id: string
              _photo_url?: string
              _signature_url?: string
              _skipped_reason?: string
            }
            Returns: Json
          }
      compute_expected_cash: { Args: { _session_id: string }; Returns: number }
      courier_heartbeat: {
        Args: {
          _accuracy?: number
          _battery?: number
          _heading?: number
          _lat: number
          _lng: number
          _speed?: number
        }
        Returns: Json
      }
      cpf_exists: { Args: { _cpf: string }; Returns: boolean }
      create_shared_cart: {
        Args: {
          _items: Json
          _message: string
          _owner_name: string
          _title: string
        }
        Returns: string
      }
      current_courier_id: { Args: never; Returns: string }
      get_birthday_gift_status: {
        Args: never
        Returns: {
          banner_cta: string
          banner_emoji: string
          banner_message: string
          banner_title: string
          birthday: string
          discount_type: string
          discount_value: number
          gift_code: string
          gift_expires_at: string
          gift_used: boolean
          is_birthday_month: boolean
          is_birthday_today: boolean
          min_order: number
          program_enabled: boolean
        }[]
      }
      get_loyalty_status: {
        Args: never
        Returns: {
          active_coupons: number
          current_stamps: number
          lifetime_stamps: number
          next_tier: string
          reward_value: number
          stamps_per_order: number
          stamps_to_next: number
          tier: string
        }[]
      }
      get_my_referrals: {
        Args: never
        Returns: {
          created_at: string
          id: string
          referee_email: string
          referee_name: string
          referrer_coupon_code: string
          rewarded_at: string
          status: string
        }[]
      }
      get_open_cash_session: {
        Args: never
        Returns: {
          closed_at: string | null
          closing_note: string | null
          counted_amount: number | null
          created_at: string
          difference: number | null
          expected_amount: number | null
          id: string
          opened_at: string
          opening_amount: number
          opening_note: string | null
          operator_id: string | null
          operator_name: string | null
          status: string
          terminal: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "cash_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_or_create_my_referral_code: { Args: never; Returns: string }
      get_pix_key: { Args: never; Returns: string }
      get_proof_of_delivery_stats: { Args: { _days?: number }; Returns: Json }
      get_shared_cart: { Args: { _token: string }; Returns: Json }
      get_sla_history: {
        Args: { lookback_days?: number }
        Returns: {
          avg_minutes: number
          mode: string
          p50_minutes: number
          p90_minutes: number
          sample_size: number
        }[]
      }
      get_tracking_by_token: { Args: { _token: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      link_courier_to_user: {
        Args: { _courier_id: string; _user_id: string }
        Returns: Json
      }
      list_delivery_proofs: {
        Args: { _limit?: number; _offset?: number; _only_skipped?: boolean }
        Returns: Json[]
      }
      loyalty_min_order: { Args: { _tier: string }; Returns: number }
      loyalty_reward_value: { Args: { _tier: string }; Returns: number }
      loyalty_stamp_bonus: { Args: { _tier: string }; Returns: number }
      loyalty_tier: { Args: { _lifetime: number }; Returns: string }
      mark_birthday_push_sent: {
        Args: { _gift_id: string }
        Returns: undefined
      }
      mark_push_opened: { Args: { _delivery_id: string }; Returns: undefined }
      merge_shared_cart: {
        Args: { _order_id: string; _token: string }
        Returns: Json
      }
      open_table: {
        Args: { _people?: number; _table_id: string; _waiter_id?: string }
        Returns: string
      }
      pickup_delivery: { Args: { _order_id: string }; Returns: Json }
      redeem_loyalty_coupon: {
        Args: { _code: string }
        Returns: {
          code: string
          id: string
        }[]
      }
      redeem_promo_coupon: {
        Args: { _code: string; _order_id?: string; _order_total: number }
        Returns: {
          code: string
          discount: number
          id: string
        }[]
      }
      reject_delivery_offer: { Args: { _offer_id: string }; Returns: Json }
      remove_shared_cart_item: {
        Args: { _participant: string; _token: string; _uid: string }
        Returns: Json
      }
      set_courier_status: { Args: { _status: string }; Returns: Json }
      set_pix_key: { Args: { _val: string }; Returns: undefined }
      transfer_table: {
        Args: { _from: string; _to: string }
        Returns: undefined
      }
      validate_loyalty_coupon: {
        Args: { _code: string }
        Returns: {
          code: string
          discount_value: number
          id: string
        }[]
      }
      validate_promo_coupon: {
        Args: { _code: string; _order_total: number }
        Returns: {
          code: string
          discount: number
          discount_type: string
          discount_value: number
          id: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user" | "manager" | "staff" | "kitchen" | "delivery"
      review_status: "published" | "hidden" | "pending"
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
      app_role: ["admin", "user", "manager", "staff", "kitchen", "delivery"],
      review_status: ["published", "hidden", "pending"],
    },
  },
} as const
