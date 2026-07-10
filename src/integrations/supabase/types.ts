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
          created_at: string
          customer_name: string
          delivered_at: string | null
          delivery_fee: number
          dispatched_at: string | null
          id: string
          mode: string
          note: string | null
          paid_at: string | null
          phone: string
          preparing_at: string | null
          reference: string | null
          status: string
          subtotal: number
          total: number
          user_id: string
        }
        Insert: {
          address?: string | null
          canceled_at?: string | null
          coupon_code?: string | null
          created_at?: string
          customer_name: string
          delivered_at?: string | null
          delivery_fee?: number
          dispatched_at?: string | null
          id?: string
          mode: string
          note?: string | null
          paid_at?: string | null
          phone: string
          preparing_at?: string | null
          reference?: string | null
          status?: string
          subtotal: number
          total: number
          user_id: string
        }
        Update: {
          address?: string | null
          canceled_at?: string | null
          coupon_code?: string | null
          created_at?: string
          customer_name?: string
          delivered_at?: string | null
          delivery_fee?: number
          dispatched_at?: string | null
          id?: string
          mode?: string
          note?: string | null
          paid_at?: string | null
          phone?: string
          preparing_at?: string | null
          reference?: string | null
          status?: string
          subtotal?: number
          total?: number
          user_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          active: boolean
          badge: string | null
          base_price: number
          category: string
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
          removable: Json | null
          sizes: Json
          sort_order: number
          stock: number | null
          updated_at: string
          upsell_price: number | null
        }
        Insert: {
          active?: boolean
          badge?: string | null
          base_price?: number
          category: string
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
          removable?: Json | null
          sizes?: Json
          sort_order?: number
          stock?: number | null
          updated_at?: string
          upsell_price?: number | null
        }
        Update: {
          active?: boolean
          badge?: string | null
          base_price?: number
          category?: string
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
          removable?: Json | null
          sizes?: Json
          sort_order?: number
          stock?: number | null
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      loyalty_reward_value: { Args: { _tier: string }; Returns: number }
      loyalty_stamp_bonus: { Args: { _tier: string }; Returns: number }
      loyalty_tier: { Args: { _lifetime: number }; Returns: string }
      mark_push_opened: { Args: { _delivery_id: string }; Returns: undefined }
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
    },
  },
} as const
