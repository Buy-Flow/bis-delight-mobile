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
      categories: {
        Row: {
          active: boolean
          created_at: string
          emoji: string
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
          id: string
          image_pos_x: number
          image_pos_y: number
          image_scale: number
          image_url: string | null
          ingredients: Json
          name: string
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
          id: string
          image_pos_x?: number
          image_pos_y?: number
          image_scale?: number
          image_url?: string | null
          ingredients?: Json
          name: string
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
          id?: string
          image_pos_x?: number
          image_pos_y?: number
          image_scale?: number
          image_url?: string | null
          ingredients?: Json
          name?: string
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
      site_settings: {
        Row: {
          accepts_delivery: boolean
          accepts_pickup: boolean
          address: string
          announcement_active: boolean
          announcement_text: string
          city: string
          delivery_fee: number
          facebook: string
          free_delivery_threshold: number
          hours: string
          hours_json: Json
          id: number
          instagram: string
          logo_url: string | null
          map_embed: string
          maps_url: string
          min_order: number
          name: string
          open_override: string
          payment_methods: Json
          pix_key: string
          tagline: string
          texture_url: string | null
          tiktok: string
          updated_at: string
          whatsapp: string
          whatsapp_display: string
        }
        Insert: {
          accepts_delivery?: boolean
          accepts_pickup?: boolean
          address?: string
          announcement_active?: boolean
          announcement_text?: string
          city?: string
          delivery_fee?: number
          facebook?: string
          free_delivery_threshold?: number
          hours?: string
          hours_json?: Json
          id?: number
          instagram?: string
          logo_url?: string | null
          map_embed?: string
          maps_url?: string
          min_order?: number
          name?: string
          open_override?: string
          payment_methods?: Json
          pix_key?: string
          tagline?: string
          texture_url?: string | null
          tiktok?: string
          updated_at?: string
          whatsapp?: string
          whatsapp_display?: string
        }
        Update: {
          accepts_delivery?: boolean
          accepts_pickup?: boolean
          address?: string
          announcement_active?: boolean
          announcement_text?: string
          city?: string
          delivery_fee?: number
          facebook?: string
          free_delivery_threshold?: number
          hours?: string
          hours_json?: Json
          id?: number
          instagram?: string
          logo_url?: string | null
          map_embed?: string
          maps_url?: string
          min_order?: number
          name?: string
          open_override?: string
          payment_methods?: Json
          pix_key?: string
          tagline?: string
          texture_url?: string | null
          tiktok?: string
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
