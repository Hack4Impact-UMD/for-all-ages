import { useMemo } from "react";
import { useAuth } from "../../auth/AuthProvider";
import styles from "./Waiting.module.css";

const ADMIN_EMAIL = "info@forallages.org";

type ParticipantProfile = {
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

function buildGreetingName(participant: ParticipantProfile | null, fallbackEmail?: string | null) {
  const candidate =
    participant?.displayName?.trim() ||
    [participant?.firstName, participant?.lastName].filter(Boolean).join(" ").trim() ||
    fallbackEmail?.split("@")[0] ||
    "there";

  const trimmed = candidate.trim();
  if (!trimmed) return "there";
  const firstWord = trimmed.split(/\s+/)[0] ?? trimmed;
  return firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
}

export default function Waiting() {
  const { user, participant, loading, participantLoading } = useAuth();

  const participantProfile = (participant as ParticipantProfile | null) ?? null;

  const greetingName = useMemo(
    () => buildGreetingName(participantProfile, user?.displayName ?? user?.email ?? null),
    [participantProfile, user?.displayName, user?.email],
  );

  const handleMessageAdmins = () => {
    if (typeof window === "undefined") return;
    const subject = encodeURIComponent("Question about my program status");
    const body = user?.email
      ? encodeURIComponent(`Hi Admin Team,\n\nThis is ${user.email}.`)
      : "";
    const mailto = `mailto:${ADMIN_EMAIL}?subject=${subject}${body ? `&body=${body}` : ""}`;
    window.location.href = mailto;
  };

  const isLoading = loading || participantLoading;

  return (
    <div className={styles.page}>
      <div className={styles.waitingSurface}>
        {isLoading ? (
          <div className={styles.loadingMessage}>Loading your dashboard…</div>
        ) : (
          <>
            <div className={styles.welcomeWrap}>
              <h1 className={styles.welcomeLink}>Welcome, {greetingName}!</h1>
            </div>
            <section className={styles.messageWrapper}>
              <div className={styles.messageCard}>
                <p className={styles.messageText}>
                  Thank you for filling out the registration form!
                  <br />
                  We will get back to you soon regarding further details on the program!
                </p>
              </div>
            </section>
          </>
        )}
        <button type="button" className={styles.messageButton} onClick={handleMessageAdmins}>
          <span className={styles.messageIcon} aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false" role="presentation">
              <path
                d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v7A2.5 2.5 0 0 1 17.5 15H9.41l-4.2 3.36A.75.75 0 0 1 4 17.75z"
                fill="currentColor"
              />
            </svg>
          </span>
          <span>Message Admins</span>
        </button>
      </div>
    </div>
  );
}
