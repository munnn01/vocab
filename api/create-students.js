import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const USERNAME_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const PASSWORD_LOWER = "abcdefghjkmnpqrstuvwxyz";
const PASSWORD_UPPER = "ABCDEFGHJKMNPQRSTUVWXYZ";
const PASSWORD_DIGITS = "23456789";
const MAX_STUDENTS = 100;
const MAX_BASE64_LENGTH = 3_500_000;

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

function cleanWorkbook(value) {
  const workbook = value && typeof value === "object" ? value : {};
  const originalFileName = String(workbook.originalFileName || "").trim().slice(0, 180);
  const originalFileBase64 = String(workbook.originalFileBase64 || "");
  const sheetName = String(workbook.sheetName || "").trim().slice(0, 120);
  const worksheetPath = String(workbook.worksheetPath || "").trim().slice(0, 240);
  const headerRow = Number(workbook.headerRow);
  const nameColumn = Number(workbook.nameColumn);
  const classColumn = workbook.classColumn == null ? null : Number(workbook.classColumn);
  if (!/\.xlsx$/i.test(originalFileName)) throw new Error("Tên file danh sách không hợp lệ.");
  if (!originalFileBase64 || originalFileBase64.length > MAX_BASE64_LENGTH) throw new Error("File Excel vượt quá dung lượng cho phép.");
  if (!sheetName || !/^xl\/worksheets\/[a-z0-9_.-]+\.xml$/i.test(worksheetPath)) throw new Error("Thông tin trang tính không hợp lệ.");
  if (!Number.isInteger(headerRow) || headerRow < 1 || !Number.isInteger(nameColumn) || nameColumn < 1) throw new Error("Vị trí cột Họ và tên không hợp lệ.");
  if (classColumn != null && (!Number.isInteger(classColumn) || classColumn < 1)) throw new Error("Vị trí cột Lớp không hợp lệ.");
  return { originalFileName, originalFileBase64, sheetName, worksheetPath, headerRow, nameColumn, classColumn };
}

function cleanStudents(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_STUDENTS) {
    throw new Error(`Danh sách phải có từ 1 đến ${MAX_STUDENTS} sinh viên.`);
  }
  return value.map((student) => {
    const displayName = String(student?.displayName || "").trim().slice(0, 120);
    const className = String(student?.className || "").trim().slice(0, 80);
    const rowNumber = Number(student?.rowNumber);
    if (!displayName || !className || !Number.isInteger(rowNumber) || rowNumber < 2) {
      throw new Error("Mỗi sinh viên cần có họ tên, lớp và dòng tương ứng trong file Excel.");
    }
    return { displayName, className, rowNumber };
  });
}

async function createOneStudent(admin, instructor, rosterId, student) {
  const prefix = normalizePrefix(student.className);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const username = `${prefix}-${randomText(USERNAME_ALPHABET, 6)}`;
    const password = makePassword();
    const email = `${username}@students.vocab.local`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: student.displayName, username },
    });
    if (error?.message?.toLowerCase().includes("already")) continue;
    if (error || !data.user) throw error || new Error("Không tạo được người dùng Supabase.");

    const { error: profileError } = await admin.from("profiles").upsert({
      user_id: data.user.id,
      role: "student",
      username,
      display_name: student.displayName,
      instructor_id: instructor.id,
      class_name: student.className,
      roster_id: rosterId,
      roster_row: student.rowNumber,
    });
    if (profileError) {
      await admin.auth.admin.deleteUser(data.user.id);
      throw profileError;
    }
    return {
      id: data.user.id,
      username,
      password,
      displayName: student.displayName,
      className: student.className,
      rosterId,
      rosterRow: student.rowNumber,
    };
  }
  throw new Error("Không thể tạo tên đăng nhập duy nhất. Hãy thử lại.");
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
    return response.status(503).json({ error: "Máy chủ chưa được cấu hình Supabase (thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trên Vercel)." });
  }

  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return response.status(401).json({ error: "Bạn cần đăng nhập lại (không tìm thấy token)." });

  // 1. Dùng token của người dùng để xác minh danh tính và đọc hồ sơ trong ngữ cảnh authenticated user
  const userClient = createClient(supabaseUrl, anonKey || serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) {
    return response.status(401).json({ error: `Phiên đăng nhập không hợp lệ: ${userError?.message || "Không xác minh được người dùng."}` });
  }

  // 2. Kiểm tra vai trò của người dùng
  let profile = null;
  const { data: userProfile, error: userProfileError } = await userClient
    .from("profiles")
    .select("role")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (userProfile) {
    profile = userProfile;
  } else {
    // Thử truy vấn bằng admin client nếu client người dùng chưa đọc được
    const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: adminProfile, error: adminProfileError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (adminProfile) {
      profile = adminProfile;
    } else {
      console.error("Profile check error:", { userProfileError, adminProfileError, userId: userData.user.id });
      const detail = userProfileError?.message || adminProfileError?.message || "Không tìm thấy hồ sơ người dùng trong bảng profiles.";
      return response.status(403).json({ error: `Không thể xác minh vai trò: ${detail}` });
    }
  }

  if (profile.role !== "instructor") {
    return response.status(403).json({ error: `Tài khoản của bạn có vai trò "${profile.role}", chỉ giảng viên mới được tạo tài khoản sinh viên.` });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

  let workbook;
  let students;
  try {
    workbook = cleanWorkbook(request.body?.workbook);
    students = cleanStudents(request.body?.students);
  } catch (error) {
    return response.status(400).json({ error: error.message });
  }

  const uniqueClasses = [...new Set(students.map((student) => student.className))];
  const className = uniqueClasses.length === 1 ? uniqueClasses[0] : `${uniqueClasses.length} lớp`;
  const rosterPayload = {
    instructor_id: userData.user.id,
    class_name: className,
    original_file_name: workbook.originalFileName,
    original_file_base64: workbook.originalFileBase64,
    sheet_name: workbook.sheetName,
    worksheet_path: workbook.worksheetPath,
    header_row: workbook.headerRow,
    name_column: workbook.nameColumn,
    class_column: workbook.classColumn,
    student_count: students.length,
  };

  let roster = null;
  let rosterError = null;

  const { data: userRoster, error: userRosterError } = await userClient
    .from("student_rosters")
    .insert(rosterPayload)
    .select("id,class_name,original_file_name,sheet_name,student_count,created_at")
    .single();

  if (userRoster) {
    roster = userRoster;
  } else {
    const { data: adminRoster, error: adminRosterError } = await admin
      .from("student_rosters")
      .insert(rosterPayload)
      .select("id,class_name,original_file_name,sheet_name,student_count,created_at")
      .single();

    if (adminRoster) {
      roster = adminRoster;
    } else {
      rosterError = adminRosterError || userRosterError;
    }
  }

  if (rosterError || !roster) {
    console.error("create-students roster", { userRosterError, rosterError });
    return response.status(500).json({ error: `Chưa lưu được file danh sách: ${rosterError?.message || "Lỗi quyền truy cập bảng student_rosters."}` });
  }

  const accounts = [];
  try {
    for (let start = 0; start < students.length; start += 5) {
      const batch = students.slice(start, start + 5).map((student) =>
        createOneStudent(admin, userData.user, roster.id, student));
      const results = await Promise.allSettled(batch);
      accounts.push(...results.filter((result) => result.status === "fulfilled").map((result) => result.value));
      const failed = results.find((result) => result.status === "rejected");
      if (failed) throw failed.reason;
    }
    return response.status(201).json({
      accounts,
      roster: {
        id: roster.id,
        className: roster.class_name,
        originalFileName: roster.original_file_name,
        sheetName: roster.sheet_name,
        studentCount: roster.student_count,
        createdAt: roster.created_at,
      },
    });
  } catch (error) {
    await Promise.allSettled(accounts.map((account) => admin.auth.admin.deleteUser(account.id)));
    await admin.from("student_rosters").delete().eq("id", roster.id);
    console.error("create-students accounts", error);
    return response.status(500).json({ error: error?.message || "Không thể tạo tài khoản sinh viên." });
  }
}
