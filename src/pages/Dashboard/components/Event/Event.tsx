import styles from "./Event.module.css";

interface EventProps {
  name: string[];
  colorHex?: string;
  timeText?: string;
  locationText?: string;
  selected?: boolean;
  disabled?: boolean;
  className?: string;
  onClick?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
}

const hexToRgb = (hex?: string) => {
  const h = (hex ?? "#1a73e8").replace("#", "");
  if (h.length !== 6) return "26,115,232";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r},${g},${b}`;
};

export default function Event({
  name,
  colorHex = "#fbbc04",
  timeText = "All day",
  locationText,
  selected,
  disabled,
  className,
  onClick,
  onKeyDown,
}: EventProps) {
  const title = name.join(", ");
  const cssVars = { ["--ev-color" as any]: hexToRgb(colorHex) };

  return (
    <button
      type="button"
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      onKeyDown={onKeyDown}
      style={cssVars}
      className={[
        styles.event,
        selected ? styles.selected : "",
        disabled ? styles.disabled : "",
        className ?? "",
      ].join(" ")}
    >
      <div className={styles.content}>
        <div aria-hidden className={styles.bar} />
        <div className={styles.body}>
          <div className={styles.row}>
            <span className={styles.title} title={title}>
              {title}
            </span>
            {timeText && <span className={styles.time}>{timeText}</span>}
          </div>
          {locationText && (
            <div className={styles.loc} title={locationText}>
              {locationText}
            </div>
          )}
        </div>
      </div>

      <div className={styles.hoverCard}>
        <div className={styles.cardHead}>
          <div className={styles.dot} />
          <div className={styles.title} style={{ margin: 0 }}>
            {title}
          </div>
        </div>
        {timeText && <div className={styles.time}>{timeText}</div>}
        {locationText && <div className={styles.loc}>{locationText}</div>}
      </div>
    </button>
  );
}
