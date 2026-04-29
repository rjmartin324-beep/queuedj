import { useEffect, useState } from "react";

interface Props {
  delta: number;
}

export default function ScorePop({ delta }: Props) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 1400);
    return () => clearTimeout(t);
  }, [delta]);

  if (!visible || delta <= 0) return null;

  return <div className="score-pop">+{delta.toLocaleString()}</div>;
}
