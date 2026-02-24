import React from "react";
import styles from "../../Profile.module.css";

interface MatchInterestsModalProps {
  open: boolean;
  matchName?: string;
  matchInterests?: string;
  onClose: () => void;
}

const MatchInterestsModal: React.FC<MatchInterestsModalProps> = ({
  open,
  matchName,
  matchInterests,
  onClose,
}) => {
  if (!open) return null;

  const handleBackdropClick = () => {
    onClose();
  };

  const handleContentClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
    e.stopPropagation();
  };

  const displayName =
    matchName && matchName.trim().length > 0 ? matchName : "Your match";

  const displayInterests =
    matchInterests && matchInterests.trim().length > 0
      ? matchInterests
      : "No interests response available.";

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
          <p>{displayInterests}</p>
        </div>
      </div>
    </div>
  );
};

export default MatchInterestsModal;
