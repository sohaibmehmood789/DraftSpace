// Matches the checked-in SQL migration. Regenerate from Supabase after schema changes.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; display_name: string; created_at: string };
        Insert: { id: string; display_name: string; created_at?: string };
        Update: { display_name?: string };
        Relationships: [];
      };
      documents: {
        Row: { id: string; owner_id: string; title: string; content: Json; created_at: string; updated_at: string };
        Insert: { id?: string; owner_id: string; title?: string; content?: Json };
        Update: { title?: string; content?: Json };
        Relationships: [{ foreignKeyName: "documents_owner_id_fkey"; columns: ["owner_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      document_shares: {
        Row: { document_id: string; shared_with: string; created_at: string };
        Insert: never;
        Update: never;
        Relationships: [
          { foreignKeyName: "document_shares_document_id_fkey"; columns: ["document_id"]; isOneToOne: false; referencedRelation: "documents"; referencedColumns: ["id"] },
          { foreignKeyName: "document_shares_shared_with_fkey"; columns: ["shared_with"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      list_document_shares: { Args: { target_document_id: string }; Returns: { shared_with: string; display_name: string; email: string }[] };
      share_document: { Args: { target_document_id: string; recipient_email: string }; Returns: undefined };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
