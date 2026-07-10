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
          stamps: number
          total_redeemed: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          last_birthday_bonus?: string | null
          stamps?: number
          total_redeemed?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          last_birthday_bonus?: string | null
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
          id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
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
          coupon_code: string | null
          created_at: string
          customer_name: string
          delivery_fee: number
          id: string
          mode: string
          note: string | null
          phone: string
          reference: string | null
          status: string
          subtotal: number
          total: number
          user_id: string
        }
        Insert: {
          address?: string | null
          coupon_code?: string | null
          created_at?: string
          customer_name: string
          delivery_fee?: number
          id?: string
          mode: string
          note?: string | null
          phone: string
          reference?: string | null
          status?: string
          subtotal: number
          total: number
          user_id: string
        }
        Update: {
          address?: string | null
          coupon_code?: string | null
          created_at?: string
          customer_name?: string
          delivery_fee?: number
          id?: string
          mode?: string
          note?: string | null
          phone?: string
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
          name: string
          option_groups: Json | null
          removable: Json | null
          sizes: Json
          sort_order: number
          updated_at: string
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
          name: string
          option_groups?: Json | null
          removable?: Json | null
          sizes?: Json
          sort_order?: number
          updated_at?: string
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
          name?: string
          option_groups?: Json | null
          removable?: Json | null
          sizes?: Json
          sort_order?: number
          updated_at?: string
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
        Relationships: []
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
          tagline: string
          texture_opacity: number
          texture_size: string
          texture_url: string | null
          tiktok: string
          title_font: string
          updated_at: string
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
          tagline?: string
          texture_opacity?: number
          texture_size?: string
          texture_url?: string | null
          tiktok?: string
          title_font?: string
          updated_at?: string
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
          tagline?: string
          texture_opacity?: number
          texture_size?: string
          texture_url?: string | null
          tiktok?: string
          title_font?: string
          updated_at?: string
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
    }
    Views: {
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
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
