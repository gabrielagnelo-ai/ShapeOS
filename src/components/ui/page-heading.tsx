import type { ReactNode } from "react";
import styles from "./page-heading.module.css";

/** Large title of a page (iOS), with one optional line below it and the page actions. */
export function PageHeading({ title, description, children }: { title: string; description?: ReactNode; children?: ReactNode }) {
  return <header className={styles.heading}>
    <div><h1>{title}</h1>{description ? <p>{description}</p> : null}</div>
    {children ? <div className={styles.aside}>{children}</div> : null}
  </header>;
}
