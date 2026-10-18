import type { ReactNode } from "react";
import { SiteShell } from "./SiteShell";

/** Frame for the text pages: the site shell, an h1 and a short lead paragraph. */
export function StaticPage({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: ReactNode;
  children: ReactNode;
}) {
  return (
    <SiteShell>
      <article className="mx-auto max-w-2xl">
        <h1 className="font-display text-4xl sm:text-5xl tracking-tight">{title}</h1>
        {lead && <p className="mt-4 text-lg text-muted-foreground">{lead}</p>}
        <div className="mt-10 space-y-10">{children}</div>
      </article>
    </SiteShell>
  );
}

/** A titled block of prose inside a StaticPage. */
export function Section({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id ? `${id}-heading` : undefined} id={id}>
      <h2
        id={id ? `${id}-heading` : undefined}
        className="font-display text-2xl sm:text-3xl tracking-tight"
      >
        {title}
      </h2>
      <div className="mt-3 space-y-3 leading-relaxed text-foreground/90 [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-primary [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}
