export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          display_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          role?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      plant_checks: {
        Row: {
          id: string;
          user_id: string;
          plant_name: string | null;
          image_path: string;
          analysis: string | null;
          health_score: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plant_name?: string | null;
          image_path: string;
          analysis?: string | null;
          health_score?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          plant_name?: string | null;
          image_path?: string;
          analysis?: string | null;
          health_score?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      ai_usage: {
        Row: {
          id: string;
          user_id: string | null;
          endpoint: string;
          tokens: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          endpoint: string;
          tokens?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          endpoint?: string;
          tokens?: number;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
