import React, { useState } from "react";
import { KeyRound, Eye, EyeOff, ShieldCheck, Check, LogOut, LoaderCircle, CircleAlert } from "lucide-react";

export function FirstLoginPasswordModal({ isOpen, student, onSave, onSignOut, isSaving }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen || !student) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    const trimmedNew = newPassword.trim();
    const trimmedConfirm = confirmPassword.trim();

    if (!trimmedNew) {
      setError("Vui lòng nhập mật khẩu mới.");
      return;
    }
    if (trimmedNew.length < 6) {
      setError("Mật khẩu mới phải có ít nhất 6 ký tự để bảo mật tài khoản.");
      return;
    }
    if (trimmedNew !== trimmedConfirm) {
      setError("Mật khẩu xác nhận không khớp. Vui lòng kiểm tra lại.");
      return;
    }

    onSave(trimmedNew);
  };

  return (
    <div className="modal-backdrop force-modal" role="presentation">
      <div
        className="modal-dialog first-login-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="first-login-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          <div className="first-login-head">
            <div className="first-login-icon">
              <KeyRound size={28} />
            </div>
            <div className="eyebrow text-amber">Lần đầu đăng nhập</div>
            <h2 id="first-login-title">Thiết lập mật khẩu mới</h2>
            <p className="first-login-desc">
              Chào mừng <strong>{student.displayName || student.username}</strong> ({student.className ? `Lớp ${student.className}` : "Học sinh"})!
              <br />
              Mật khẩu giáo viên cấp cho bạn là <b>mật khẩu 1 lần</b>. Hãy đổi sang mật khẩu riêng của bạn để bảo mật bài thi và tiếp tục vào học.
            </p>
          </div>

          {error && (
            <div className="login-error" role="alert">
              <CircleAlert size={16} /> {error}
            </div>
          )}

          <div className="first-login-fields">
            <div className="field-group">
              <label className="field-label" htmlFor="first-new-password">
                Mật khẩu mới (tối thiểu 6 ký tự)
              </label>
              <div className="password-field">
                <input
                  id="first-new-password"
                  className="auth-input"
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nhập mật khẩu mới của bạn..."
                  required
                  disabled={isSaving}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNew((s) => !s)}
                  aria-label={showNew ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  tabIndex={-1}
                >
                  {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="first-confirm-password">
                Xác nhận lại mật khẩu mới
              </label>
              <div className="password-field">
                <input
                  id="first-confirm-password"
                  className="auth-input"
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới để xác nhận..."
                  required
                  disabled={isSaving}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((s) => !s)}
                  aria-label={showConfirm ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="pwd-guidance-box">
              <ShieldCheck size={16} className="guidance-icon" />
              <span>
                Mật khẩu mới sẽ được dùng cho mọi lần đăng nhập tiếp theo. Giáo viên vẫn có thể hỗ trợ nếu bạn quên mật khẩu.
              </span>
            </div>
          </div>

          <div className="first-login-actions">
            <button
              className="primary-button full-width"
              type="submit"
              disabled={isSaving || !newPassword || !confirmPassword}
            >
              {isSaving ? <LoaderCircle className="spin" size={18} /> : <Check size={18} />}
              <span>{isSaving ? "Đang cập nhật…" : "Lưu mật khẩu & Bắt đầu học"}</span>
            </button>
            <button
              className="secondary-button compact cancel-first-login-btn"
              type="button"
              onClick={onSignOut}
              disabled={isSaving}
            >
              <LogOut size={15} /> Đăng xuất (đổi sau)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}