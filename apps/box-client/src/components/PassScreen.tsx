interface Props {
  playerName: string;
}

export default function PassScreen({ playerName }: Props) {
  return (
    <div className="pass-screen">
      <div className="pass-icon">📱</div>
      <h2 className="pass-title">Hand it over</h2>
      <p className="pass-name">{playerName}</p>
      <p className="pass-hint">It's your turn</p>
    </div>
  );
}
