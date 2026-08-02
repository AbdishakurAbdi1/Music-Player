interface LoginViewProps {
  status: string;
  onLogin: () => void;
}

export default function LoginView({ status, onLogin }: LoginViewProps) {
  return (
    <main className="view login-view">
      <h1>Abdi's Player</h1>
      <p>{status}</p>
      <button onClick={onLogin}>Logg inn med Spotify</button>
    </main>
  );
}