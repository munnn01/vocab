import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const PASSWORD_LOWER = "abcdefghjkmnpqrstuvwxyz";
const PASSWORD_UPPER = "ABCDEFGHJKMNPQRSTUVWXYZ";
const PASSWORD_DIGITS = "23456789";

function randomFrom(alphabet) {
  return alphabet[randomBytes(1)[0] % alphabet.length];
}

function makePassword() {
  const all = PASSWORD_LOWER + PASSWORD_UPPER + PASSWORD_DIGITS;
  const characters = [randomFrom(PASSWORD_LOWER), randomFrom(PASSWORD_UPPER), randomFrom(PASSWORD_DIGITS)];
  while (characters.length < 10) characters.push(randomFrom(all));
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const other = randomBytes(1)[0] % (index + 1);
    [characters[index], characters[other]] = [characters[other], characters[index]];
  }
  return characters.join("");
}

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
    return response.status(403).json({ error: "Chỉ giáo viên mới được đặt lại mật khẩu học sinh." });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const studentIds = Array.isArray(request.body?.studentIds) ? request.body.studentIds : null;

  let query = admin
    .from("profiles")
    .select("user_id,username,display_name")
    .eq("instructor_id", userData.user.id);

  if (studentIds && studentIds.length > 0) {
    query = query.in("user_id", studentIds);
  }

  const { data: studentsToReset, error: fetchError } = await query;
  if (fetchError || !studentsToReset?.length) {
    return response.status(400).json({ error: "Không tìm thấy tài khoản học sinh cần đặt lại mật khẩu." });
  }

  const updated = [];
  for (const student of studentsToReset) {
    const newPassword = makePassword();
    try {
      const { error: authError } = await admin.auth.admin.updateUserById(student.user_id, {
        password: newPassword,
      });
      if (authError) {
        console.error("Lỗi cập nhật mật khẩu auth:", authError);
        continue;
      }

      const updatePayload = {
        initial_password: newPassword,
        current_password: null,
        has_changed_password: false,
      };
      let { error: updateError } = await admin
        .from("profiles")
        .update(updatePayload)
        .eq("user_id", student.user_id);

      if (updateError && (updateError.message?.includes("current_password") || updateError.message?.includes("has_changed_password"))) {
        await admin
          .from("profiles")
          .update({ initial_password: newPassword })
          .eq("user_id", student.user_id);
      }

      updated.push({
        studentId: student.user_id,
        username: student.username,
        password: newPassword,
        initialPassword: newPassword,
        currentPassword: null,
        hasChangedPassword: false,
      });
    } catch (err) {
      console.error("Lỗi đặt lại mật khẩu học sinh:", err);
    }
  }

  return response.status(200).json({
    message: `Đã đặt lại mật khẩu cho ${updated.length} học sinh.`,
    updated,
  });
}
