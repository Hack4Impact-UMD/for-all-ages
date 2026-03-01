import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import styles from "./Waiting.module.css";

const ADMIN_EMAIL = "info@forallages.org";

type ParticipantProfile = {
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

type ProgramState = {
  matches_final: boolean;
  started: boolean;
};

function buildGreetingName(
  participant: ParticipantProfile | null,
  fallbackEmail?: string | null,
) {
  const candidate =
    participant?.displayName?.trim() ||
    [participant?.firstName, participant?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    fallbackEmail?.split("@")[0] ||
    "there";

  const trimmed = candidate.trim();
  if (!trimmed) return "there";
  const firstWord = trimmed.split(/\s+/)[0] ?? trimmed;
  return firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
}

export default function Waiting() {
  const {
    user,
    participant,
    loading,
    participantLoading,
    programState,
    programStateLoading,
  } = useAuth() as {
    user: any;
    participant: ParticipantProfile | null;
    loading: boolean;
    participantLoading: boolean;
    programState: ProgramState | null;
    programStateLoading: boolean;
  };

  const navigate = useNavigate();

  const participantProfile = (participant as ParticipantProfile | null) ?? null;

  const greetingName = useMemo(
    () =>
      buildGreetingName(
        participantProfile,
        user?.displayName ?? user?.email ?? null,
      ),
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

  const isLoading = loading || participantLoading || programStateLoading;

  // 🔒 If program has fully started, waiting page should not be accessible.
  useEffect(() => {
    if (!programState || isLoading) return;

    if (programState.matches_final && programState.started) {
      // Change "/dashboard" to whatever your main app route is.
      navigate("/dashboard", { replace: true });
    }
  }, [programState, isLoading, navigate]);

  // Decide which message to show based on programState
  let statusTitle = "";
  let statusBody = "";

  if (programState) {
    const { matches_final, started } = programState;

    if (!matches_final && !started) {
      // State 1: waiting, match NOT revealed yet
      statusTitle = "We’re still finalizing matches";
      statusBody =
        "Thank you for filling out the registration form! We’re still working on finalizing everyone’s matches. You’ll receive an update as soon as your match is ready.";
    } else if (!matches_final && started) {
      // State 1: waiting, match NOT revealed yet
      statusTitle = "We’re still finalizing matches";
      statusBody =
        "Thank you for filling out the registration form! We’re still working on finalizing everyone’s matches. You’ll receive an update as soon as your match is ready.";
    } else if (matches_final && !started) {
      // State 2: match revealed, program not started
      statusTitle = "Your match has been set!";
      statusBody =
        "Your match has been finalized. You’ll get full access to the program once it officially starts. Keep an eye on your email for the start date and next steps.";
    } else if (matches_final && started) {
      // State 3: should be handled by
      statusTitle = "Redirecting you to your dashboard…";
      statusBody = "";
    }
  }

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
                {statusTitle && (
                  <h2 className={styles.statusTitle}>{statusTitle}</h2>
                )}
                <p className={styles.messageText}>{statusBody}</p>
              </div>
            </section>
          </>
        )}
        <button
          type="button"
          className={styles.messageButton}
          onClick={handleMessageAdmins}
        >
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
