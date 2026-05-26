import { Link } from "react-router-dom";
import styles from "./EmptyState.module.css";

interface Props {
  title: string;
  description?: string;
  ctaLabel?: string;
  ctaTo?: string;
}

export function EmptyState({ title, description, ctaLabel, ctaTo }: Props) {
  return (
    <div className={styles.wrap}>
      <div className={styles.title}>{title}</div>
      {description && <div className={styles.sub}>{description}</div>}
      {ctaLabel && ctaTo && (
        <Link className={styles.cta} to={ctaTo}>
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}
