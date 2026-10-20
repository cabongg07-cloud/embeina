/**
 * Cấu hình kết nối Supabase cho "Góc Nhỏ Lấp Lánh".
 *
 * LƯU Ý BẢO MẬT:
 * - Chỉ sử dụng Publishable / Anon Key ở phía trình duyệt (client-side).
 * - TUYỆT ĐỐI KHÔNG BAO GIỜ đặt service_role key hoặc secret key trong mã nguồn frontend.
 * - Mọi phân quyền dữ liệu thực sự được bảo vệ bởi Row Level Security (RLS) và các hàm RPC trên Supabase.
 */

import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://rrmlnrzdkgxugjnmwbku.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_jvs5FeANv7t4e2GYyDm38A_aB0aufaN';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
