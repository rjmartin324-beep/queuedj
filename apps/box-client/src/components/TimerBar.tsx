import { useEffect, useRef, useState } from "react";
import { playSound } from "../sounds";

interface Props {
  deadline: number | null;
  timeLimit: number;
  onExpire?: () => void;
}

export default function TimerBar({ deadline, timeLimit, onExpire }: Props) {
  const [pct, setPct] = useState(100);
  const warnedRef = useRef(false);
  const expiredRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    warnedRef.current = false;
    expiredRef.current = false;

    function tick() {
      if (!deadline) return;
      const remaining = (deadline - Date.now()) / 1000;
      const p = Math.max(0, Math.min(100, (remaining / timeLimit) * 100));
      setPct(p);

      if (!warnedRef.current && remaining <= timeLimit * 0.25) {
        warnedRef.current = true;
        playSound("timer-warning");
      }

      if (remaining <= 0) {
        if (!expiredRef.current) {
          expiredRef.current = true;
          onExpire?.();
        }
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [deadline, timeLimit]);

  const color = pct > 50 ? "green" : pct > 20 ? "yellow" : "red";

  return (
    <div className="timer-bar-wrap">
      <div
        className={`timer-bar ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
