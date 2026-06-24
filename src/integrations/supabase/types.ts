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
      active_sessions: {
        Row: {
          created_at: string
          device_label: string | null
          ip: string | null
          session_token: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_label?: string | null
          ip?: string | null
          session_token: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_label?: string | null
          ip?: string | null
          session_token?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      admin_emails: {
        Row: {
          created_at: string
          email: string
          note: string | null
        }
        Insert: {
          created_at?: string
          email: string
          note?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          note?: string | null
        }
        Relationships: []
      }
      badges: {
        Row: {
          code: string
          color: string
          created_at: string
          description: string | null
          icon: string
          id: string
          name: string
          tenant_id: string | null
        }
        Insert: {
          code: string
          color?: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          name: string
          tenant_id?: string | null
        }
        Update: {
          code?: string
          color?: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          name?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "badges_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          account_holder: string
          account_number: string | null
          bank_name: string
          created_at: string
          iban: string | null
          id: string
          is_active: boolean
          notes: string | null
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          account_holder: string
          account_number?: string | null
          bank_name: string
          created_at?: string
          iban?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          account_holder?: string
          account_number?: string | null
          bank_name?: string
          created_at?: string
          iban?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bundle_courses: {
        Row: {
          bundle_id: string
          course_id: string
          sort_order: number
        }
        Insert: {
          bundle_id: string
          course_id: string
          sort_order?: number
        }
        Update: {
          bundle_id?: string
          course_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "bundle_courses_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "course_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      certificates: {
        Row: {
          certificate_number: string
          course_id: string
          course_title: string
          enrollment_id: string
          final_score: number | null
          id: string
          issued_at: string
          student_id: string
          student_name: string
          tenant_id: string
          tenant_name: string
        }
        Insert: {
          certificate_number: string
          course_id: string
          course_title: string
          enrollment_id: string
          final_score?: number | null
          id?: string
          issued_at?: string
          student_id: string
          student_name: string
          tenant_id: string
          tenant_name: string
        }
        Update: {
          certificate_number?: string
          course_id?: string
          course_title?: string
          enrollment_id?: string
          final_score?: number | null
          id?: string
          issued_at?: string
          student_id?: string
          student_name?: string
          tenant_id?: string
          tenant_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      colleges: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          name_en: string | null
          sort_order: number
          tenant_id: string
          university_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          name_en?: string | null
          sort_order?: number
          tenant_id: string
          university_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          name_en?: string | null
          sort_order?: number
          tenant_id?: string
          university_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "colleges_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colleges_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_redemptions: {
        Row: {
          coupon_id: string
          created_at: string
          discount_amount: number
          id: string
          payment_request_id: string | null
          user_id: string
        }
        Insert: {
          coupon_id: string
          created_at?: string
          discount_amount: number
          id?: string
          payment_request_id?: string | null
          user_id: string
        }
        Update: {
          coupon_id?: string
          created_at?: string
          discount_amount?: number
          id?: string
          payment_request_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_redemptions_payment_request_id_fkey"
            columns: ["payment_request_id"]
            isOneToOne: false
            referencedRelation: "payment_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          bundle_id: string | null
          code: string
          course_id: string | null
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          min_amount: number
          per_user_limit: number
          scope: Database["public"]["Enums"]["coupon_scope"]
          tenant_id: string
          type: Database["public"]["Enums"]["coupon_type"]
          updated_at: string
          used_count: number
          value: number
        }
        Insert: {
          bundle_id?: string | null
          code: string
          course_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_amount?: number
          per_user_limit?: number
          scope?: Database["public"]["Enums"]["coupon_scope"]
          tenant_id: string
          type?: Database["public"]["Enums"]["coupon_type"]
          updated_at?: string
          used_count?: number
          value: number
        }
        Update: {
          bundle_id?: string | null
          code?: string
          course_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_amount?: number
          per_user_limit?: number
          scope?: Database["public"]["Enums"]["coupon_scope"]
          tenant_id?: string
          type?: Database["public"]["Enums"]["coupon_type"]
          updated_at?: string
          used_count?: number
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "coupons_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "course_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      course_bundles: {
        Row: {
          cover_url: string | null
          created_at: string
          description: string | null
          discount_percent: number
          id: string
          is_active: boolean
          name: string
          price: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          discount_percent?: number
          id?: string
          is_active?: boolean
          name: string
          price?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          discount_percent?: number
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_bundles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          ad_style: number
          ai_image_prompt: string | null
          allow_installments: boolean
          approved_at: string | null
          approved_by: string | null
          college_id: string | null
          cover_url: string | null
          created_at: string
          description: string | null
          id: string
          instructor_id: string
          is_free: boolean
          major_id: string | null
          min_installment_amount: number | null
          price: number
          qr_code_url: string | null
          rejection_reason: string | null
          requires_approval: boolean
          semester: string | null
          short_description: string | null
          slug: string
          status: Database["public"]["Enums"]["course_status"]
          students_count: number
          tenant_id: string
          title: string
          total_duration_seconds: number
          university_id: string | null
          updated_at: string
          year_number: number | null
        }
        Insert: {
          ad_style?: number
          ai_image_prompt?: string | null
          allow_installments?: boolean
          approved_at?: string | null
          approved_by?: string | null
          college_id?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          instructor_id: string
          is_free?: boolean
          major_id?: string | null
          min_installment_amount?: number | null
          price?: number
          qr_code_url?: string | null
          rejection_reason?: string | null
          requires_approval?: boolean
          semester?: string | null
          short_description?: string | null
          slug: string
          status?: Database["public"]["Enums"]["course_status"]
          students_count?: number
          tenant_id: string
          title: string
          total_duration_seconds?: number
          university_id?: string | null
          updated_at?: string
          year_number?: number | null
        }
        Update: {
          ad_style?: number
          ai_image_prompt?: string | null
          allow_installments?: boolean
          approved_at?: string | null
          approved_by?: string | null
          college_id?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          instructor_id?: string
          is_free?: boolean
          major_id?: string | null
          min_installment_amount?: number | null
          price?: number
          qr_code_url?: string | null
          rejection_reason?: string | null
          requires_approval?: boolean
          semester?: string | null
          short_description?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["course_status"]
          students_count?: number
          tenant_id?: string
          title?: string
          total_duration_seconds?: number
          university_id?: string | null
          updated_at?: string
          year_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_college_id_fkey"
            columns: ["college_id"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_major_id_fkey"
            columns: ["major_id"]
            isOneToOne: false
            referencedRelation: "majors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          completed_at: string | null
          course_id: string
          created_at: string
          id: string
          paid_amount: number
          progress: number
          source: string
          status: string
          student_id: string
          tenant_id: string
          total_amount: number
        }
        Insert: {
          completed_at?: string | null
          course_id: string
          created_at?: string
          id?: string
          paid_amount?: number
          progress?: number
          source?: string
          status?: string
          student_id: string
          tenant_id: string
          total_amount?: number
        }
        Update: {
          completed_at?: string | null
          course_id?: string
          created_at?: string
          id?: string
          paid_amount?: number
          progress?: number
          source?: string
          status?: string
          student_id?: string
          tenant_id?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          completed: boolean
          enrollment_id: string
          id: string
          lesson_id: string
          updated_at: string
          watched_seconds: number
        }
        Insert: {
          completed?: boolean
          enrollment_id: string
          id?: string
          lesson_id: string
          updated_at?: string
          watched_seconds?: number
        }
        Update: {
          completed?: boolean
          enrollment_id?: string
          id?: string
          lesson_id?: string
          updated_at?: string
          watched_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          content_data: Json
          content_text: string | null
          content_url: string | null
          created_at: string
          duration_seconds: number | null
          id: string
          is_preview: boolean
          order_index: number
          section_id: string
          tenant_id: string | null
          title: string
          type: Database["public"]["Enums"]["lesson_type"]
          video_asset_id: string | null
        }
        Insert: {
          content_data?: Json
          content_text?: string | null
          content_url?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          is_preview?: boolean
          order_index?: number
          section_id: string
          tenant_id?: string | null
          title: string
          type?: Database["public"]["Enums"]["lesson_type"]
          video_asset_id?: string | null
        }
        Update: {
          content_data?: Json
          content_text?: string | null
          content_url?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          is_preview?: boolean
          order_index?: number
          section_id?: string
          tenant_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["lesson_type"]
          video_asset_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_video_asset_id_fkey"
            columns: ["video_asset_id"]
            isOneToOne: false
            referencedRelation: "video_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      majors: {
        Row: {
          college_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          name_en: string | null
          sort_order: number
          tenant_id: string
          updated_at: string
          years_count: number
        }
        Insert: {
          college_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          name_en?: string | null
          sort_order?: number
          tenant_id: string
          updated_at?: string
          years_count?: number
        }
        Update: {
          college_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          name_en?: string | null
          sort_order?: number
          tenant_id?: string
          updated_at?: string
          years_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "majors_college_id_fkey"
            columns: ["college_id"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "majors_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_requests: {
        Row: {
          admin_notes: string | null
          amount: number
          bank_account_id: string | null
          bundle_id: string | null
          coupon_id: string | null
          course_id: string | null
          created_at: string
          currency: string
          discount_amount: number
          enrollment_id: string | null
          id: string
          original_amount: number | null
          receipt_url: string | null
          referral_code_used: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["payment_request_status"]
          student_id: string
          student_notes: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          bank_account_id?: string | null
          bundle_id?: string | null
          coupon_id?: string | null
          course_id?: string | null
          created_at?: string
          currency?: string
          discount_amount?: number
          enrollment_id?: string | null
          id?: string
          original_amount?: number | null
          receipt_url?: string | null
          referral_code_used?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["payment_request_status"]
          student_id: string
          student_notes?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          bank_account_id?: string | null
          bundle_id?: string | null
          coupon_id?: string | null
          course_id?: string | null
          created_at?: string
          currency?: string
          discount_amount?: number
          enrollment_id?: string | null
          id?: string
          original_amount?: number | null
          receipt_url?: string | null
          referral_code_used?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["payment_request_status"]
          student_id?: string
          student_notes?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_requests_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "course_bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          allow_signups: boolean
          created_at: string
          custom_settings: Json
          default_commission_pct: number
          enable_referrals: boolean
          id: string
          maintenance_message: string | null
          maintenance_mode: boolean
          marquee_color: string | null
          marquee_enabled: boolean
          marquee_text: string | null
          playback_token_secret: string
          r2_public_worker_url: string | null
          referral_commission_percent: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          allow_signups?: boolean
          created_at?: string
          custom_settings?: Json
          default_commission_pct?: number
          enable_referrals?: boolean
          id?: string
          maintenance_message?: string | null
          maintenance_mode?: boolean
          marquee_color?: string | null
          marquee_enabled?: boolean
          marquee_text?: string | null
          playback_token_secret?: string
          r2_public_worker_url?: string | null
          referral_commission_percent?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          allow_signups?: boolean
          created_at?: string
          custom_settings?: Json
          default_commission_pct?: number
          enable_referrals?: boolean
          id?: string
          maintenance_message?: string | null
          maintenance_mode?: boolean
          marquee_color?: string | null
          marquee_enabled?: boolean
          marquee_text?: string | null
          playback_token_secret?: string
          r2_public_worker_url?: string | null
          referral_commission_percent?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          college_id: string | null
          created_at: string
          full_name: string | null
          global_logout_at: string
          id: string
          major_id: string | null
          phone: string | null
          phone_country_code: string | null
          referral_balance: number
          referral_code: string | null
          referred_by: string | null
          research_consent: boolean
          study_year: string | null
          study_year_number: number | null
          university_id: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          college_id?: string | null
          created_at?: string
          full_name?: string | null
          global_logout_at?: string
          id: string
          major_id?: string | null
          phone?: string | null
          phone_country_code?: string | null
          referral_balance?: number
          referral_code?: string | null
          referred_by?: string | null
          research_consent?: boolean
          study_year?: string | null
          study_year_number?: number | null
          university_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          college_id?: string | null
          created_at?: string
          full_name?: string | null
          global_logout_at?: string
          id?: string
          major_id?: string | null
          phone?: string | null
          phone_country_code?: string | null
          referral_balance?: number
          referral_code?: string | null
          referred_by?: string | null
          research_consent?: boolean
          study_year?: string | null
          study_year_number?: number | null
          university_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_college_id_fkey"
            columns: ["college_id"]
            isOneToOne: false
            referencedRelation: "colleges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_major_id_fkey"
            columns: ["major_id"]
            isOneToOne: false
            referencedRelation: "majors"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          answers: Json
          enrollment_id: string | null
          id: string
          max_score: number
          passed: boolean
          percent: number
          quiz_id: string
          score: number
          started_at: string
          student_id: string
          submitted_at: string | null
        }
        Insert: {
          answers?: Json
          enrollment_id?: string | null
          id?: string
          max_score?: number
          passed?: boolean
          percent?: number
          quiz_id: string
          score?: number
          started_at?: string
          student_id: string
          submitted_at?: string | null
        }
        Update: {
          answers?: Json
          enrollment_id?: string | null
          id?: string
          max_score?: number
          passed?: boolean
          percent?: number
          quiz_id?: string
          score?: number
          started_at?: string
          student_id?: string
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_choices: {
        Row: {
          id: string
          is_correct: boolean
          order_index: number
          question_id: string
          text: string
        }
        Insert: {
          id?: string
          is_correct?: boolean
          order_index?: number
          question_id: string
          text: string
        }
        Update: {
          id?: string
          is_correct?: boolean
          order_index?: number
          question_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_choices_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          created_at: string
          explanation: string | null
          id: string
          order_index: number
          points: number
          quiz_id: string
          text: string
          type: Database["public"]["Enums"]["quiz_question_type"]
        }
        Insert: {
          created_at?: string
          explanation?: string | null
          id?: string
          order_index?: number
          points?: number
          quiz_id: string
          text: string
          type?: Database["public"]["Enums"]["quiz_question_type"]
        }
        Update: {
          created_at?: string
          explanation?: string | null
          id?: string
          order_index?: number
          points?: number
          quiz_id?: string
          text?: string
          type?: Database["public"]["Enums"]["quiz_question_type"]
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          attempts_limit: number | null
          course_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_final: boolean
          passing_score: number
          tenant_id: string
          time_limit_minutes: number | null
          title: string
          updated_at: string
        }
        Insert: {
          attempts_limit?: number | null
          course_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_final?: boolean
          passing_score?: number
          tenant_id: string
          time_limit_minutes?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          attempts_limit?: number | null
          course_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_final?: boolean
          passing_score?: number
          tenant_id?: string
          time_limit_minutes?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          commission_amount: number
          course_id: string | null
          created_at: string
          id: string
          paid_at: string | null
          payment_request_id: string | null
          referred_user_id: string
          referrer_id: string
          status: string
          tenant_id: string
        }
        Insert: {
          commission_amount: number
          course_id?: string | null
          created_at?: string
          id?: string
          paid_at?: string | null
          payment_request_id?: string | null
          referred_user_id: string
          referrer_id: string
          status?: string
          tenant_id: string
        }
        Update: {
          commission_amount?: number
          course_id?: string | null
          created_at?: string
          id?: string
          paid_at?: string | null
          payment_request_id?: string | null
          referred_user_id?: string
          referrer_id?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_payment_request_id_fkey"
            columns: ["payment_request_id"]
            isOneToOne: false
            referencedRelation: "payment_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sections: {
        Row: {
          course_id: string
          created_at: string
          description: string | null
          id: string
          is_locked: boolean
          order_index: number
          title: string
        }
        Insert: {
          course_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_locked?: boolean
          order_index?: number
          title: string
        }
        Update: {
          course_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_locked?: boolean
          order_index?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "sections_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_members: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["tenant_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["tenant_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["tenant_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_secrets: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          tenant_id: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          tenant_id: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          tenant_id?: string
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_secrets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          activated_at: string | null
          created_at: string
          currency: string
          description: string | null
          id: string
          logo_url: string | null
          name: string
          owner_id: string
          plan: Database["public"]["Enums"]["tenant_plan"]
          primary_color: string
          secondary_color: string
          slug: string
          status: Database["public"]["Enums"]["tenant_status"]
          suspended_at: string | null
          suspension_reason: string | null
          updated_at: string
          welcome_message: string | null
        }
        Insert: {
          activated_at?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          owner_id: string
          plan?: Database["public"]["Enums"]["tenant_plan"]
          primary_color?: string
          secondary_color?: string
          slug: string
          status?: Database["public"]["Enums"]["tenant_status"]
          suspended_at?: string | null
          suspension_reason?: string | null
          updated_at?: string
          welcome_message?: string | null
        }
        Update: {
          activated_at?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string
          plan?: Database["public"]["Enums"]["tenant_plan"]
          primary_color?: string
          secondary_color?: string
          slug?: string
          status?: Database["public"]["Enums"]["tenant_status"]
          suspended_at?: string | null
          suspension_reason?: string | null
          updated_at?: string
          welcome_message?: string | null
        }
        Relationships: []
      }
      universities: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          name_en: string | null
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          name_en?: string | null
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          name_en?: string | null
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "universities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          awarded_at: string
          badge_id: string
          id: string
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          awarded_at?: string
          badge_id: string
          id?: string
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          awarded_at?: string
          badge_id?: string
          id?: string
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
      video_assets: {
        Row: {
          created_at: string
          duration_seconds: number | null
          error_message: string | null
          height: number | null
          id: string
          mime_type: string | null
          original_filename: string | null
          r2_key: string
          size_bytes: number | null
          status: Database["public"]["Enums"]["video_status"]
          tenant_id: string
          thumbnail_key: string | null
          updated_at: string
          upload_id: string | null
          uploaded_by: string | null
          width: number | null
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          error_message?: string | null
          height?: number | null
          id?: string
          mime_type?: string | null
          original_filename?: string | null
          r2_key: string
          size_bytes?: number | null
          status?: Database["public"]["Enums"]["video_status"]
          tenant_id: string
          thumbnail_key?: string | null
          updated_at?: string
          upload_id?: string | null
          uploaded_by?: string | null
          width?: number | null
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          error_message?: string | null
          height?: number | null
          id?: string
          mime_type?: string | null
          original_filename?: string | null
          r2_key?: string
          size_bytes?: number | null
          status?: Database["public"]["Enums"]["video_status"]
          tenant_id?: string
          thumbnail_key?: string | null
          updated_at?: string
          upload_id?: string | null
          uploaded_by?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "video_assets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      quiz_choices_public: {
        Row: {
          id: string | null
          order_index: number | null
          question_id: string | null
          text: string | null
        }
        Insert: {
          id?: string | null
          order_index?: number | null
          question_id?: string | null
          text?: string | null
        }
        Update: {
          id?: string | null
          order_index?: number | null
          question_id?: string | null
          text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_choices_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      approve_course: { Args: { _course_id: string }; Returns: undefined }
      approve_payment_request: {
        Args: { _notes?: string; _req_id: string }
        Returns: undefined
      }
      award_badge: {
        Args: { _code: string; _tenant_id?: string; _user_id: string }
        Returns: string
      }
      bump_global_logout: { Args: { _user_id: string }; Returns: undefined }
      course_tenant: { Args: { _course_id: string }; Returns: string }
      enrollment_student: { Args: { _enrollment_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_tenant_role: {
        Args: {
          _roles: Database["public"]["Enums"]["tenant_role"][]
          _tenant_id: string
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_email: { Args: { _email: string }; Returns: boolean }
      is_tenant_member: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      is_tenant_owner: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      issue_certificate: { Args: { _enrollment_id: string }; Returns: string }
      reject_course: {
        Args: { _course_id: string; _reason: string }
        Returns: undefined
      }
      reject_payment_request: {
        Args: { _notes?: string; _req_id: string }
        Returns: undefined
      }
      section_course: { Args: { _section_id: string }; Returns: string }
      submit_quiz_attempt: {
        Args: { _answers: Json; _quiz_id: string }
        Returns: string
      }
      validate_coupon: {
        Args: {
          _amount: number
          _bundle_id?: string
          _code: string
          _course_id?: string
          _tenant_id: string
        }
        Returns: {
          coupon_id: string
          discount: number
          final_amount: number
          message: string
        }[]
      }
    }
    Enums: {
      app_role: "super_admin"
      coupon_scope: "all" | "course" | "bundle"
      coupon_type: "percent" | "fixed"
      course_status: "draft" | "published" | "archived" | "pending_approval"
      lesson_type: "video" | "text" | "pdf"
      payment_request_status: "pending" | "approved" | "rejected" | "cancelled"
      quiz_question_type: "mcq" | "true_false"
      tenant_plan: "free" | "starter" | "pro" | "enterprise"
      tenant_role: "owner" | "instructor" | "student" | "admin"
      tenant_status: "active" | "suspended" | "trial"
      video_status: "pending" | "uploading" | "processing" | "ready" | "failed"
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
      app_role: ["super_admin"],
      coupon_scope: ["all", "course", "bundle"],
      coupon_type: ["percent", "fixed"],
      course_status: ["draft", "published", "archived", "pending_approval"],
      lesson_type: ["video", "text", "pdf"],
      payment_request_status: ["pending", "approved", "rejected", "cancelled"],
      quiz_question_type: ["mcq", "true_false"],
      tenant_plan: ["free", "starter", "pro", "enterprise"],
      tenant_role: ["owner", "instructor", "student", "admin"],
      tenant_status: ["active", "suspended", "trial"],
      video_status: ["pending", "uploading", "processing", "ready", "failed"],
    },
  },
} as const
