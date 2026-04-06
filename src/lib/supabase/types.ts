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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
      };
      tool_categories: {
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
          Database["public"]["Tables"]["tool_categories"]["Row"],
          "id" | "created_at"
        >;
        Update: Partial<
          Database["public"]["Tables"]["tool_categories"]["Insert"]
        >;
        Relationships: [];
      };
      ai_tools: {
        Row: {
          id: string;
          name: string;
          slug: string;
          url: string;
          description: string | null;
          logo_url: string | null;
          category_id: string | null;
          pricing_model: "free" | "freemium" | "paid" | "open_source";
          features: unknown[];
          tags: string[];
          verified: boolean;
          status: "draft" | "published";
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["ai_tools"]["Row"],
          "id" | "created_at" | "updated_at"
        >;
        Update: Partial<
          Database["public"]["Tables"]["ai_tools"]["Insert"]
        >;
        Relationships: [];
      };
      tool_rankings: {
        Row: {
          id: string;
          tool_id: string;
          period: string;
          monthly_visits: number;
          growth_rate: number;
          rank: number | null;
          category_rank: number | null;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["tool_rankings"]["Row"],
          "id" | "created_at"
        >;
        Update: Partial<
          Database["public"]["Tables"]["tool_rankings"]["Insert"]
        >;
        Relationships: [];
      };
      tool_bookmarks: {
        Row: {
          id: string;
          user_id: string;
          tool_id: string;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["tool_bookmarks"]["Row"],
          "id" | "created_at"
        >;
        Update: Partial<
          Database["public"]["Tables"]["tool_bookmarks"]["Insert"]
        >;
        Relationships: [];
      };
      sources: {
        Row: {
          id: string;
          name: string;
          type: "hn" | "ph" | "reddit" | "rss" | "x";
          config: Record<string, unknown>;
          fetch_interval: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["sources"]["Row"],
          "id" | "created_at"
        >;
        Update: Partial<
          Database["public"]["Tables"]["sources"]["Insert"]
        >;
        Relationships: [];
      };
      news_items: {
        Row: {
          id: string;
          source_id: string;
          title: string;
          url: string;
          summary: string | null;
          content: string | null;
          ai_tags: string[];
          ai_summary: string | null;
          engagement_score: number;
          published_at: string;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["news_items"]["Row"],
          "id" | "created_at"
        >;
        Update: Partial<
          Database["public"]["Tables"]["news_items"]["Insert"]
        >;
        Relationships: [];
      };
      demand_signals: {
        Row: {
          id: string;
          news_item_id: string;
          signal_type: "pain_point" | "solution_req" | "trending";
          score: number;
          market_size_est: string | null;
          competition_lvl: "low" | "medium" | "high" | null;
          ai_analysis: string | null;
          status: "active" | "archived" | "dismissed";
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["demand_signals"]["Row"],
          "id" | "created_at"
        >;
        Update: Partial<
          Database["public"]["Tables"]["demand_signals"]["Insert"]
        >;
        Relationships: [];
      };
      practice_plans: {
        Row: {
          id: string;
          user_id: string | null;
          title: string;
          input_prompt: string | null;
          status: "pending" | "generating" | "done";
          result: Record<string, unknown> | null;
          model_used: string;
          is_public: boolean;
          download_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["practice_plans"]["Row"],
          "id" | "created_at" | "updated_at" | "download_count" | "input_prompt" | "result" | "is_public"
        > & {
          input_prompt?: string | null;
          result?: Record<string, unknown> | null;
          is_public?: boolean;
        };
        Update: Partial<
          Database["public"]["Tables"]["practice_plans"]["Insert"]
        >;
        Relationships: [];
      };
      plan_messages: {
        Row: {
          id: string;
          plan_id: string;
          role: "user" | "assistant";
          content: string;
          created_at: string;
        };
        Insert: Omit<
          Database["public"]["Tables"]["plan_messages"]["Row"],
          "id" | "created_at"
        >;
        Update: Partial<
          Database["public"]["Tables"]["plan_messages"]["Insert"]
        >;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};