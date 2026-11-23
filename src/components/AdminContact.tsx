import { useEffect, useRef, useState } from "react";
import styles from "./AdminContact.module.css";

export const ADMIN_EMAIL = "info@forallages.org";

export function buildAdminMailto(userEmail?: string | null) {
  const subject = encodeURIComponent("Question about my program status");
  const body = userEmail
    ? encodeURIComponent(`Hi Admin Team,\n\nThis is ${userEmail}.`)
    : "";
  return `mailto:${ADMIN_EMAIL}?subject=${subject}${body ? `&body=${body}` : ""}`;
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!copied) throw new Error("Copy command failed");
}

export default function AdminContact({
  userEmail,
}: {
  userEmail?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) setCopyStatus("");
  }, [open]);

  const handleCopy = async () => {
    try {
      await copyText(ADMIN_EMAIL);
      setCopyStatus("Email copied");
    } catch {
      setCopyStatus("Unable to copy. Please select the email address.");
    }
  };

  return (
    <>
      <button
        type="button"
        className={styles.messageButton}
        onClick={() => setOpen(true)}
      >
        <span className={styles.messageIcon} aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false" role="presentation">
            <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v7A2.5 2.5 0 0 1 17.5 15H9.41l-4.2 3.36A.75.75 0 0 1 4 17.75z" fill="currentColor" />
          </svg>
        </span>
        <span>Message Admins</span>
      </button>

      {open && (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            className={styles.modalCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-contact-title"
          >
            <h2 id="admin-contact-title" className={styles.modalTitle}>
              Contact the Admin Team
            </h2>
            <p className={styles.modalText}>
              Email our team at{" "}
              <a className={styles.emailLink} href={`mailto:${ADMIN_EMAIL}`}>
                {ADMIN_EMAIL}
              </a>
              . You can copy the address or open your email app.
            </p>
            <div className={styles.actions}>
              <button
                ref={closeButtonRef}
                type="button"
                className={styles.secondaryButton}
                onClick={handleCopy}
              >
                Copy email
              </button>
              <a
                className={styles.primaryButton}
                href={buildAdminMailto(userEmail)}
              >
                Open email app
              </a>
            </div>
            {copyStatus && (
              <p className={styles.copyStatus} role="status">
                {copyStatus}
              </p>
            )}
            <button
              type="button"
              className={styles.closeButton}
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </>
  );
}
