"use client";

import { useState } from "react";
import { Star } from "lucide-react";

interface Props {
  value: number; // 0 – 5 in 0.5 steps
  onChange?: (v: number) => void;
  size?: number;
}

/** Letterboxd-style half-star control. Click the same value again to clear. */
export default function StarRating({ value, onChange, size = 32 }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value;
  const interactive = Boolean(onChange);

  return (
    <div
      className="inline-flex items-center gap-1"
      onMouseLeave={() => setHover(null)}
      role={interactive ? "slider" : "img"}
      aria-label={`Rating ${value} out of 5`}
      aria-valuemin={0}
      aria-valuemax={5}
      aria-valuenow={value}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const fill = Math.max(0, Math.min(1, shown - (star - 1))); // 0, 0.5 or 1
        return (
          <span key={star} className="relative inline-block" style={{ width: size, height: size }}>
            <Star size={size} className="absolute inset-0 text-line" strokeWidth={1.5} />
            <span
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${fill * 100}%` }}
            >
              <Star
                size={size}
                className="text-emerald"
                fill="currentColor"
                strokeWidth={1.5}
              />
            </span>
            {interactive && (
              <>
                {[0.5, 1].map((half) => {
                  const v = star - 1 + half;
                  return (
                    <button
                      key={half}
                      type="button"
                      aria-label={`${v} stars`}
                      className="absolute top-0 h-full"
                      style={half === 0.5 ? { left: 0, width: "50%" } : { right: 0, width: "50%" }}
                      onMouseEnter={() => setHover(v)}
                      onClick={() => onChange!(v === value ? 0 : v)}
                    />
                  );
                })}
              </>
            )}
          </span>
        );
      })}
    </div>
  );
}
