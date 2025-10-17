import styles from './PersonTag.module.css'

type PersonTagVariant = 'rose' | 'green' | 'gold'

interface PersonTagProps {
    names: string[] | string
    variant?: PersonTagVariant
    className?: string
}

const variantClassNames: Record<PersonTagVariant, string> = {
    rose: styles.rose,
    green: styles.green,
    gold: styles.gold
}

export default function PersonTag ({ names, variant = 'gold', className }: PersonTagProps) {
    const label = Array.isArray(names) ? names.join(', ') : names
    const variantClass = variantClassNames[variant] ?? styles.gold

    return (
        <span className={`${styles.tag} ${variantClass} ${className ?? ''}`.trim()}>
            {label}
        </span>
    )
}
