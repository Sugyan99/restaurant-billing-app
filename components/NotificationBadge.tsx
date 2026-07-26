"use client";

import React, { useEffect, useState } from "react";

type Props = {
  count?: number;
  showDot?: boolean;
  ariaLabel?: string;
  className?: string;
};

export default function NotificationBadge({ count, showDot, ariaLabel, className }: Props) {
  const [pulse, setPulse] = useState(false);
  const prev = React.useRef<number | undefined>(undefined);

  useEffect(() => {
    if (prev.current === undefined) {
      prev.current = count;
      return;
    }
    if (count !== prev.current) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 350);
      prev.current = count;
      return () => clearTimeout(t);
    }
  }, [count]);

  if ((count === undefined || count === 0) && !showDot) return null;

  if (count && count > 0) {
    return (
      <span
        className={`notif-badge ${pulse ? "pulse" : ""} ${className ?? ""}`}
        role="status"
        aria-label={ariaLabel ?? `${count} unread`}
      >
        {count}
      </span>
    );
  }

  return (
    <span
      className={`notif-dot ${pulse ? "pulse" : ""} ${className ?? ""}`}
      aria-hidden={false}
      aria-label={ariaLabel ?? "new"}
      role="status"
      title={ariaLabel ?? "new"}
    />
  );
}
