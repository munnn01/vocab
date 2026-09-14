import { createClient } from "@supabase/supabase-js";

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Chỉ hỗ trợ POST." });
  }

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const anonKey = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "").trim();

  if (!supabaseUrl || !serviceRoleKey) {
    return response.status(503).json({ error: "Máy chủ chưa được cấu hình Supabase." });
  }

  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return response.status(401).json({ error: "Bạn cần đăng nhập lại." });

  const userClient = createClient(supabaseUrl, anonKey || serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) {
    return response.status(401).json({ error: "Phiên đăng nhập không hợp lệ." });
  }

  const { data: profile } = await userClient
    .from("profiles")
    .select("role")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (profile?.role !== "instructor") {
    return response.status(403).json({ error: "Chỉ giảng viên mới được xóa danh sách sinh viên." });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const rosterId = request.body?.rosterId;
  const deleteOrphaned = Boolean(request.body?.deleteOrphaned);

  try {
    if (deleteOrphaned) {
      const { data: allRosters } = await admin
        .from("student_rosters")
        .select("id")
        .eq("instructor_id", userData.user.id);

      const { data: allStudents } = await admin
        .from("profiles")
        .select("roster_id")
        .eq("instructor_id", userData.user.id);

      const activeRosterIds = new Set((allStudents || []).map((s) => s.roster_id).filter(Boolean));
      const orphanedIds = (allRosters || []).filter((r) => !activeRosterIds.has(r.id)).map((r) => r.id);

      if (orphanedIds.length > 0) {
        await admin
          .from("student_rosters")
          .delete()
          .in("id", orphanedIds)
          .eq("instructor_id", userData.user.id);
      }
      return response.status(200).json({ success: true, deletedCount: orphanedIds.length });
    }

    if (!rosterId) {
      return response.status(400).json({ error: "Thiếu mã danh sách (rosterId)." });
    }

    // 1. Tìm các sinh viên thuộc roster này
    const { data: students } = await admin
      .from("profiles")
      .select("user_id")
      .eq("roster_id", rosterId)
      .eq("instructor_id", userData.user.id);

    // 2. Xóa các tài khoản auth và profiles của sinh viên
    if (students && students.length > 0) {
      for (const s of students) {
        try {
          await admin.auth.admin.deleteUser(s.user_id);
        } catch {
          // Bỏ qua nếu user auth không còn tồn tại
        }
      }
      await admin.from("profiles").delete().eq("roster_id", rosterId).eq("instructor_id", userData.user.id);
    }

    // 3. Xóa file roster
    const { error: deleteError } = await admin
      .from("student_rosters")
      .delete()
      .eq("id", rosterId)
      .eq("instructor_id", userData.user.id);

    if (deleteError) throw deleteError;

    return response.status(200).json({ success: true });
  } catch (err) {
    console.error("delete-roster error", err);
    return response.status(500).json({ error: err.message || "Không thể xóa file danh sách." });
  }
}
