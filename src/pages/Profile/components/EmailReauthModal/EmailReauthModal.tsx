import React from "react";
import styles from "../../Profile.module.css";

interface EmailReauthModalProps {
  open: boolean;
  loading: boolean;
  error: string | null;
  password: string;
  onPasswordChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

const EmailReauthModal: React.FC<EmailReauthModalProps> = ({
  open,
  loading,
  error,
  password,
  onPasswordChange,
  onCancel,
  onConfirm,
}) => {
  if (!open) return null;

  const handleBackdropClick = () => {
    if (!loading) {
      onCancel();
    }
  };

  const handleContentClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
    e.stopPropagation();
  };

  return (
    <div className={styles.modalBackdrop} onClick={handleBackdropClick}>
      <div className={styles.modal} onClick={handleContentClick}>
        <div className={styles.modalHeader}>
          <h3>Confirm Your Password</h3>
          <button
            type="button"
            className={styles.modalCloseButton}
            onClick={onCancel}
            disabled={loading}
          >
            ✕
          </button>
        </div>

        <div className={styles.modalBody}>
          <p>
            To change your email, please enter your current password for
            security.
          </p>

          <input
            type="password"
            className={styles.input}
            placeholder="Current password"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            disabled={loading}
          />

          {error && <span className={styles.error}>{error}</span>}

          <div className={styles.buttons}>
            <button
              type="button"
              className={styles.save}
              disabled={loading || !password}
              onClick={onConfirm}
            >
              {loading ? "Saving..." : "Confirm & Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailReauthModal;
