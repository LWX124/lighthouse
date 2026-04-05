export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          role: "user" | "admin";
          preferences: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["profiles"]["Row"],
          "created_at" | "updated_at"
        >;
        Update: Partial<
          Database["public"]["Tables"]["profiles"]["Insert"]
        >;
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          plan: "free" | "pro";
          status: "active" | "canceled" | "past_due";
          stripe_sub_id: string | null;
          current_period_start: string | null;
          current_period_end: string | null;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["subscriptions"]["Row"],
          "id" | "created_at"
        >;
        Update: Partial<
          Database["public"]["Tables"]["subscriptions"]["Insert"]
        >;
      };
      categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          icon: string | null;
          parent_id: string | null;
          order: number;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["categories"]["Row"],
          "id" | "created_at"
        >;
        Update: Partial<
          Database["public"]["Tables"]["categories"]["Insert"]
        >;
      };
      tutorials: {
        Row: {
          id: string;
          category_id: string | null;
          title: string;
          slug: string;
          content: string;
          summary: string | null;
          order: number;
          is_free: boolean;
          status: "draft" | "published";
          read_time_minutes: number;
          view_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["tutorials"]["Row"],
          "id" | "created_at" | "updated_at" | "view_count"
        >;
        Update: Partial<
          Database["public"]["Tables"]["tutorials"]["Insert"]
        >;
      };
      tutorial_progress: {
        Row: {
          id: string;
          user_id: string;
          tutorial_id: string;
          progress_pct: number;
          completed_at: string | null;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["tutorial_progress"]["Row"],
          "id" | "updated_at"
        >;
        Update: Partial<
          Database["public"]["Tables"]["tutorial_progress"]["Insert"]
        >;
      };
      user_usage: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          ai_requests: number;
          plan_generations: number;
          tool_searches: number;
        };
        Insert: Omit<
          Database["public"]["Tables"]["user_usage"]["Row"],
          "id"
        >;
        Update: Partial<
          Database["public"]["Tables"]["user_usage"]["Insert"]
        >;
      };
    };
  };
};