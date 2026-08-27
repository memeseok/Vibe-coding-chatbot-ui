export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.17";
  };
  public: {
    Tables: {
      chat_messages: {
        Row: {
          content: string;
          created_at: string;
          id: string;
          role: string;
          room_id: string;
          sources: Json;
          user_id: string;
          web_search_used: boolean;
        };
        Insert: {
          content: string;
          created_at?: string;
          id: string;
          role: string;
          room_id: string;
          sources?: Json;
          user_id: string;
          web_search_used?: boolean;
        };
        Update: {
          content?: string;
          created_at?: string;
          id?: string;
          role?: string;
          room_id?: string;
          sources?: Json;
          user_id?: string;
          web_search_used?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "chat_messages_room_owner_fkey";
            columns: ["room_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "chat_rooms";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      chat_rooms: {
        Row: {
          created_at: string;
          id: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id: string;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string;
          email: string;
          id: string;
        };
        Insert: {
          created_at?: string;
          display_name: string;
          email: string;
          id: string;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          email?: string;
          id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
