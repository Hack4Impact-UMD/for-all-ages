import styles from "./Components.module.css";

interface ButtonProps {
    type: "Primary" | "Secondary" | "Danger" | "Danger Outline" | "Outline";
    disabled?: boolean;
    text: string;
    height: number;
    width: number;
    fontSize: number;
    icon?: React.ElementType;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
}

export default function Button({type, disabled = false, text, height, width, fontSize, icon: Icon, onClick}: ButtonProps) {
    const getClassName = () => {
        switch (type) {
            case "Primary": return styles.primary;
            case "Secondary": return styles.secondary;
            case "Danger": return styles.danger;
            case "Danger Outline": return styles.dangerOutline;
            case "Outline": return styles.outline;
            default: return "";
        }
    };

    return (
        <button
            className={`${styles.button} ${getClassName()} ${disabled ? styles.disabled : ""}`}
            style={{ height: `${height}px`, width: `${width}px`, fontSize: `${fontSize}px`}}
            disabled={disabled}
            onClick={onClick}
        >
            {Icon && <Icon className={styles.icon} />}
            <span>{text}</span>
        </button>
    );
}