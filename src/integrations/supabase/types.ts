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
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
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
          id: string
          used_at: string | null
          user_id: string
          year: number
        }
        Insert: {
          claimed_at?: string
          coupon_code: string
          coupon_id?: string | null
          id?: string
          used_at?: string | null
          user_id: string
          year: number
        }
        Update: {
          claimed_at?: string
          coupon_code?: string
          coupon_id?: string | null
          id?: string
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
      couriers: {
        Row: {
          active: boolean
          avatar_url: string | null
          created_at: string
          fee_per_delivery: number
          id: string
          name: string
          note: string | null
          phone: string | null
          plate: string | null
          updated_at: string
          vehicle: string
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          fee_per_delivery?: number
          id?: string
          name: string
          note?: string | null
          phone?: string | null
          plate?: string | null
          updated_at?: string
          vehicle?: string
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          fee_per_delivery?: number
          id?: string
          name?: string
          note?: string | null
          phone?: string | null
          plate?: string | null
          updated_at?: string
          vehicle?: string
        }
        Relationships: []
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
          created_at: string
          customer_name: string
          delivered_at: string | null
          delivery_fee: number
          delivery_lat: number | null
          delivery_lng: number | null
          delivery_started_at: string | null
          dispatched_at: string | null
          distance_km: number | null
          id: string
          mode: string
          note: string | null
          paid_at: string | null
          people_count: number | null
          phone: string
          preparing_at: string | null
          reference: string | null
          service_fee: number | null
          status: string
          subtotal: number
          table_id: string | null
          total: number
          user_id: string
          waiter_id: string | null
        }
        Insert: {
          address?: string | null
          canceled_at?: string | null
          coupon_code?: string | null
          courier_id?: string | null
          created_at?: string
          customer_name: string
          delivered_at?: string | null
          delivery_fee?: number
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_started_at?: string | null
          dispatched_at?: string | null
          distance_km?: number | null
          id?: string
          mode: string
          note?: string | null
          paid_at?: string | null
          people_count?: number | null
          phone: string
          preparing_at?: string | null
          reference?: string | null
          service_fee?: number | null
          status?: string
          subtotal: number
          table_id?: string | null
          total: number
          user_id: string
          waiter_id?: string | null
        }
        Update: {
          address?: string | null
          canceled_at?: string | null
          coupon_code?: string | null
          courier_id?: string | null
          created_at?: string
          customer_name?: string
          delivered_at?: string | null
          delivery_fee?: number
          delivery_lat?: number | null
          delivery_lng?: number | null
          delivery_started_at?: string | null
          dispatched_at?: string | null
          distance_km?: number | null
          id?: string
          mode?: string
          note?: string | null
          paid_at?: string | null
          people_count?: number | null
          phone?: string
          preparing_at?: string | null
          reference?: string | null
          service_fee?: number | null
          status?: string
          subtotal?: number
          table_id?: string | null
          total?: number
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
      print_jobs: {
        Row: {
          created_at: string
          id: string
          kind: string
          note: string | null
          order_id: string | null
          printed_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          note?: string | null
          order_id?: string | null
          printed_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          note?: string | null
          order_id?: string | null
          printed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "print_jobs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      print_settings: {
        Row: {
          auto_print_new_orders: boolean
          beep_on_new: boolean
          cnpj: string
          copies: number
          cut_after: boolean
          font_size: number
          footer_text: string
          header_text: string
          id: number
          kitchen_group_by_category: boolean
          paper_width: number
          print_customer_copy: boolean
          print_delivery_label: boolean
          print_kitchen_copy: boolean
          show_cnpj: boolean
          show_logo: boolean
          show_pix: boolean
          show_qr: boolean
          tax_note: string
          updated_at: string
        }
        Insert: {
          auto_print_new_orders?: boolean
          beep_on_new?: boolean
          cnpj?: string
          copies?: number
          cut_after?: boolean
          font_size?: number
          footer_text?: string
          header_text?: string
          id?: number
          kitchen_group_by_category?: boolean
          paper_width?: number
          print_customer_copy?: boolean
          print_delivery_label?: boolean
          print_kitchen_copy?: boolean
          show_cnpj?: boolean
          show_logo?: boolean
          show_pix?: boolean
          show_qr?: boolean
          tax_note?: string
          updated_at?: string
        }
        Update: {
          auto_print_new_orders?: boolean
          beep_on_new?: boolean
          cnpj?: string
          copies?: number
          cut_after?: boolean
          font_size?: number
          footer_text?: string
          header_text?: string
          id?: number
          kitchen_group_by_category?: boolean
          paper_width?: number
          print_customer_copy?: boolean
          print_delivery_label?: boolean
          print_kitchen_copy?: boolean
          show_cnpj?: boolean
          show_logo?: boolean
          show_pix?: boolean
          show_qr?: boolean
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
          name: string
          option_groups: Json | null
          packaging_cost: number | null
          pause_reason: string | null
          paused_until: string | null
          removable: Json | null
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
          name: string
          option_groups?: Json | null
          packaging_cost?: number | null
          pause_reason?: string | null
          paused_until?: string | null
          removable?: Json | null
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
          name?: string
          option_groups?: Json | null
          packaging_cost?: number | null
          pause_reason?: string | null
          paused_until?: string | null
          removable?: Json | null
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
          photos: string[]
          product_id: string | null
          rating: number
          replied_at: string | null
          replied_by: string | null
          reply: string | null
          status: Database["public"]["Enums"]["review_status"]
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          featured?: boolean
          helpful_count?: number
          id?: string
          order_id?: string | null
          photos?: string[]
          product_id?: string | null
          rating: number
          replied_at?: string | null
          replied_by?: string | null
          reply?: string | null
          status?: Database["public"]["Enums"]["review_status"]
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          featured?: boolean
          helpful_count?: number
          id?: string
          order_id?: string | null
          photos?: string[]
          product_id?: string | null
          rating?: number
          replied_at?: string | null
          replied_by?: string | null
          reply?: string | null
          status?: Database["public"]["Enums"]["review_status"]
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
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
      compute_expected_cash: { Args: { _session_id: string }; Returns: number }
      get_birthday_gift_status: {
        Args: never
        Returns: {
          birthday: string
          discount_value: number
          gift_code: string
          gift_expires_at: string
          gift_used: boolean
          is_birthday_month: boolean
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
      get_pix_key: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      loyalty_min_order: { Args: { _tier: string }; Returns: number }
      loyalty_reward_value: { Args: { _tier: string }; Returns: number }
      loyalty_stamp_bonus: { Args: { _tier: string }; Returns: number }
      loyalty_tier: { Args: { _lifetime: number }; Returns: string }
      mark_push_opened: { Args: { _delivery_id: string }; Returns: undefined }
      open_table: {
        Args: { _people?: number; _table_id: string; _waiter_id?: string }
        Returns: string
      }
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
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
      review_status: ["published", "hidden", "pending"],
    },
  },
} as const
