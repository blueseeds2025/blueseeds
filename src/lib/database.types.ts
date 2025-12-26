export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string
          name: string
          display_name: string
          settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          display_name: string
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          display_name?: string
          settings?: Json
          created_at?: string
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          tenant_id: string
          role: 'owner' | 'teacher' | 'manager'
          name: string
          display_name: string
          permissions: Json
          flags: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          tenant_id: string
          role: 'owner' | 'teacher' | 'manager'
          name: string
          display_name: string
          permissions?: Json
          flags?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          role?: 'owner' | 'teacher' | 'manager'
          name?: string
          display_name?: string
          permissions?: Json
          flags?: Json
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}