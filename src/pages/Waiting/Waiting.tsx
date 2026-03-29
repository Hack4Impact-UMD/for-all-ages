import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { useAuth } from "../../auth/AuthProvider";
import { db } from "../../firebase";
import {
  getMatchesByParticipant,
  getPartnerId,
  updateMatchDayOfWeek,
} from "../../services/matches";
import type { Match, PartnerInfo, ParticipantDoc } from "../../types";
import ProfilePicture from "../Profile/components/ProfilePicture/ProfilePicture";
import styles from "./Waiting.module.css";

const ADMIN_EMAIL = "info@forallages.org";

const DAYS_OF_WEEK = [
  { value: 7, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

function buildGreetingName(
  participant: ParticipantDoc | null,
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
  } = useAuth();

  const navigate = useNavigate();

  const [match, setMatch] = useState<(Match & { id: string }) | null>(null);
  const [partner, setPartner] = useState<PartnerInfo | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number>(-1);

  const isStudent = participant?.user_type === "student";

  const greetingName = useMemo(
    () =>
      buildGreetingName(participant, user?.displayName ?? user?.email ?? null),
    [participant, user?.displayName, user?.email],
  );

  const handleMessageAdmins = () => {
    if (typeof window === "undefined") return;
    const subject = encodeURIComponent("Question about my program status");
    const body = user?.email
      ? encodeURIComponent(`Hi Admin Team,\n\nThis is ${user.email}.`)
      : "";
    const mailto = `mailto:${ADMIN_EMAIL}?subject=${subject}${
      body ? `&body=${body}` : ""
    }`;
    window.location.href = mailto;
  };

  const isLoading = loading || participantLoading || programStateLoading;

  useEffect(() => {
    if (!programState || isLoading) return;

    if (programState.matches_final && programState.started) {
      navigate("/user/dashboard", { replace: true });
    }
  }, [programState, isLoading, navigate]);

  useEffect(() => {
    async function loadMatchData() {
      if (!user?.uid || isLoading || !programState?.matches_final) return;

      try {
        setMatchLoading(true);
        const matches = await getMatchesByParticipant(user.uid);

        if (matches.length === 0) {
          return;
        }

        const userMatch = matches[0];
        setMatch(userMatch);
        setSelectedDay(userMatch.day_of_call >= 1 ? userMatch.day_of_call : -1);

        const partnerId = getPartnerId(userMatch, user.uid);
        const participantRef = doc(db, "participants", partnerId);
        const participantDoc = await getDoc(participantRef);

        if (participantDoc.exists()) {
          const data = participantDoc.data();
          setPartner({
            id: participantDoc.id,
            name: data.name || data.displayName || "Unknown",
            displayName: data.displayName || data.name || "Unknown",
            email: data.email || "Not provided",
            phone_number: data.phone_number || data.phoneNumber || "Not provided",
            user_type: data.user_type || "adult",
          });
        } else {
          setPartner({
            id: partnerId,
            name: "Unknown",
            displayName: "Unknown",
            email: "Not provided",
            phone_number: "Not provided",
            user_type: "adult",
          });
        }
      } catch (error) {
        console.error("Error loading match data:", error);
      } finally {
        setMatchLoading(false);
      }
    }

    loadMatchData();
  }, [user, isLoading, programState?.matches_final]);

  const [updatingDay, setUpdatingDay] = useState(false);

  const handleDayChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (updatingDay) return;
    const dayValue = Number(e.target.value);
    const previousDay = selectedDay;
    setSelectedDay(dayValue);

    if (match && dayValue !== -1) {
      try {
        setUpdatingDay(true);
        await updateMatchDayOfWeek(match.id, dayValue);
      } catch (error) {
        setSelectedDay(previousDay);
        console.error("Error updating day of call:", error);
      } finally {
        setUpdatingDay(false);
      }
    }
  };

  let statusTitle = "";
  let statusBody = "";

  if (programState) {
    const { matches_final, started } = programState;

    if (!matches_final && !started) {
      statusTitle = "We’re still finalizing matches";
      statusBody =
        "Thank you for filling out the registration form! We’re still working on finalizing everyone’s matches. You’ll receive an update as soon as your match is ready.";
    } else if (!matches_final && started) {
      statusTitle = "We’re still finalizing matches";
      statusBody =
        "Thank you for filling out the registration form! We’re still working on finalizing everyone’s matches. You’ll receive an update as soon as your match is ready.";
    } else if (matches_final && !started) {
      statusTitle = "Your match has been set!";
      statusBody =
        "Your match has been finalized. You’ll get full access to the program once it officially starts. Keep an eye on your email for the start date and next steps.";
    } else if (matches_final && started) {
      statusTitle = "Redirecting you to your dashboard…";
      statusBody = "";
    }
  } else {
    statusTitle = "Program information unavailable";
    statusBody =
      "We’re unable to load program details right now. Please try again or contact support.";
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

            {programState?.matches_final && !programState?.started && (
              <>
                {matchLoading ? (
                  <div className={styles.loadingMessage}>
                    Loading match info…
                  </div>
                ) : partner ? (
                  <section className={styles.matchInfoSection}>
                    <div className={styles.matchInfoCard}>
                      <h2 className={styles.matchInfoTitle}>Your Match</h2>
                      <div className={styles.matchInfoContent}>
                        <ProfilePicture uid={partner.id} size={100} />
                        <h3 className={styles.matchName}>
                          {partner.displayName}
                        </h3>
                        <p className={styles.matchPhone}>
                          {partner.phone_number}
                        </p>
                      </div>

                      {isStudent && (
                        <div className={styles.daySelectorWrap}>
                          <label
                            htmlFor="day-of-call"
                            className={styles.dayLabel}
                          >
                            Preferred Day for Call
                          </label>
                          <select
                            id="day-of-call"
                            className={styles.daySelect}
                            value={selectedDay}
                            onChange={handleDayChange}
                            disabled={updatingDay}
                          >
                            <option value={-1} disabled>
                              Select Day for call
                            </option>
                            {DAYS_OF_WEEK.map((day) => (
                              <option key={day.value} value={day.value}>
                                {day.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </section>
                ) : (
                  <div className={styles.loadingMessage}>
                    Match info unavailable. Please contact admins at{" "}
                    <a href={`mailto:${ADMIN_EMAIL}`}>{ADMIN_EMAIL}</a>.
                  </div>
                )}
              </>
            )}

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
