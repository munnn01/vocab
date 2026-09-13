import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const USERNAME_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const PASSWORD_LOWER = "abcdefghjkmnpqrstuvwxyz";
const PASSWORD_UPPER = "ABCDEFGHJKMNPQRSTUVWXYZ";
const PASSWORD_DIGITS = "23456789";

function normalizePrefix(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 16) || "sv";
}

function randomFrom(alphabet) {
  return alphabet[randomBytes(1)[0] % alphabet.length];
}

function randomText(alphabet, length) {
  let result = "";
  for (let index = 0; index < length; index += 1) result += randomFrom(alphabet);
  return result;
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

async function createOneStudent(admin, instructor, className, prefix, index) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const username = `${prefix}-${randomText(USERNAME_ALPHABET, 6)}`;
    const password = makePassword();
    const displayName = `Sinh viên ${String(index + 1).padStart(2, "0")}`;
    const email = `${username}@students.vocab.local`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName, username },
    });
    if (error?.message?.toLowerCase().includes("already")) continue;
    if (error || !data.user) throw error || new Error("Không tạo được người dùng Supabase.");

    const { error: profileError } = await admin.from("profiles").upsert({
      user_id: data.user.id,
      role: "student",
      username,
      display_name: displayName,
      instructor_id: instructor.id,
      class_name: className,
    });
    if (profileError) {
      await admin.auth.admin.deleteUser(data.user.id);
      throw profileError;
    }
    return { id: data.user.id, username, password, displayName, className };
  }
  throw new Error("Không thể tạo tên đăng nhập duy nhất. Hãy thử lại.");
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Chỉ hỗ trợ POST." });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return response.status(503).json({ error: "Máy chủ chưa được cấu hình Supabase." });

  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return response.status(401).json({ error: "Bạn cần đăng nhập lại." });

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return response.status(401).json({ error: "Phiên đăng nhập không hợp lệ." });
  const { data: profile, error: profileError } = await admin.from("profiles").select("role").eq("user_id", userData.user.id).single();
  if (profileError || profile?.role !== "instructor") return response.status(403).json({ error: "Chỉ giảng viên mới được tạo tài khoản sinh viên." });

  const className = String(request.body?.className || "").trim().slice(0, 80);
  const prefix = normalizePrefix(request.body?.prefix || className);
  const count = Number(request.body?.count);
  if (!className) return response.status(400).json({ error: "Hãy nhập tên lớp." });
  if (!Number.isInteger(count) || count < 1 || count > 50) return response.status(400).json({ error: "Số lượng sinh viên phải từ 1 đến 50." });

  const accounts = [];
  try {
    for (let start = 0; start < count; start += 5) {
      const batch = Array.from({ length: Math.min(5, count - start) }, (_, offset) =>
        createOneStudent(admin, userData.user, className, prefix, start + offset));
      const results = await Promise.allSettled(batch);
      accounts.push(...results.filter((result) => result.status === "fulfilled").map((result) => result.value));
      const failed = results.find((result) => result.status === "rejected");
      if (failed) throw failed.reason;
    }
    return response.status(201).json({ accounts });
  } catch (error) {
    await Promise.allSettled(accounts.map((account) => admin.auth.admin.deleteUser(account.id)));
    console.error("create-students", error);
    return response.status(500).json({ error: error?.message || "Không thể tạo tài khoản sinh viên." });
  }
}
