import Image from "next/image";
import styles from "./ambient-backdrop.module.css";

/**
 * The ground of the app pages: the real ShapeOS mark at three sizes, seen through one
 * pane of frosted glass. It gives the floating glass something to pick up.
 */
export function AmbientBackdrop() {
  return (
    <div className={styles.scene} aria-hidden="true">
      {["78vmin", "44vmin", "32vmin"].map((size) => (
        <span key={size} className={styles.mark}>
          <Image src="/shapeos-mark.png" alt="" width={1254} height={1254} sizes={size} draggable={false} />
        </span>
      ))}
      <div className={`brand-glass ${styles.pane}`} />
    </div>
  );
}
