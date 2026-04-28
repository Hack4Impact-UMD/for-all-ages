import React from "react";
import styles from "../../Profile.module.css";
import type { MatchableProfileResponseForDisplay } from "../../Profile";

interface MatchInterestsModalProps {
  open: boolean;
  matchName?: string;
  matchableResponses: MatchableProfileResponseForDisplay[];
  onClose: () => void;
}

const MatchInterestsModal: React.FC<MatchInterestsModalProps> = ({
  open,
  matchName,
  matchableResponses,
  onClose,
}) => {
  React.useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  const handleBackdropClick = () => {
    onClose();
  };

  const handleContentClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
    e.stopPropagation();
  };

  const displayName =
    matchName && matchName.trim().length > 0 ? matchName : "Your match";

  return (
    <div className={styles.modalBackdrop} onClick={handleBackdropClick}>
      <div className={styles.modal} onClick={handleContentClick}>
        <div className={styles.modalHeader}>
          <h3>{displayName}&apos;s Interests</h3>
          <button
            type="button"
            className={styles.modalCloseButton}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className={styles.modalBody}>
          {matchableResponses.length > 0 ? (
            <div className={styles.matchableResponses}>
              {matchableResponses.map((response) => (
                <article
                  key={response.title}
                  className={styles.matchableResponseCard}
                >
                  <div className={styles.matchableResponseHeader}>
                    <h4 className={styles.matchableQuestion}>
                      {response.title}
                    </h4>
                  </div>

                  {response.type === "slider" ? (
                    <div className={styles.sliderResponse}>
                      <span className={styles.sliderValue}>
                        {response.answer}
                      </span>
                    </div>
                  ) : (
                    <textarea
                      className={styles.matchableTextResponse}
                      value={String(response.answer)}
                      readOnly
                    />
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.emptyMatchableResponses}>
              <span>No matchable responses available.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MatchInterestsModal;
