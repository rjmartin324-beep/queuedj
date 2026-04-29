import { useEffect, useState } from "react";

interface Scene {
  name: string;
  seq: number;
}

interface Props {
  scene: Scene | null;
  onDone: () => void;
}

export default function CutScene({ scene, onDone }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!scene) return;
    setVisible(true);
    let inner: ReturnType<typeof setTimeout>;
    const t = setTimeout(() => {
      setVisible(false);
      inner = setTimeout(onDone, 350);
    }, 2200);  // longer so multi-word callouts like "LANE 9 IS BURNING" actually read
    return () => { clearTimeout(t); clearTimeout(inner); };
  }, [scene?.seq]);

  if (!scene) return null;

  return (
    <div className={`cutscene-overlay ${visible ? "cs-in" : "cs-out"}`}>
      <div className="cutscene-pulse" />
      <div className="cutscene-text">{scene.name}</div>
    </div>
  );
}
