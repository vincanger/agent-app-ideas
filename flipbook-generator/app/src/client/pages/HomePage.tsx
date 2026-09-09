import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import type { AuthUser } from "wasp/auth";
import { createFlipbook, deleteFlipbook, getFlipbooks, useQuery } from "wasp/client/operations";
import { DrawCanvas } from "../components/DrawCanvas";
import { Layout } from "../Layout";

export function HomePage({ user }: { user: AuthUser }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // poll while any flipbook is still generating so the cards' progress updates
  const [pollMs, setPollMs] = useState<number | false>(false);
  const { data: flipbooks } = useQuery(getFlipbooks, undefined, { refetchInterval: pollMs });
  useEffect(() => {
    setPollMs(flipbooks?.some((f) => f.status === "generating") ? 5000 : false);
  }, [flipbooks]);

  const onSubmit = async (args: { sketch: string; motion: string; frameCount: number }) => {
    setBusy(true);
    setError(null);
    try {
      const flipbook = await createFlipbook(args);
      navigate(`/flipbook/${flipbook.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this flipbook?")) return;
    await deleteFlipbook({ id });
  };

  return (
    <Layout user={user}>
      <h1>draw something, then tell it what happens</h1>
      <DrawCanvas onSubmit={onSubmit} busy={busy} error={error} />

      <h2>my flipbooks</h2>
      {!flipbooks ? (
        <p className="hint">loading…</p>
      ) : flipbooks.length === 0 ? (
        <p className="hint">nothing yet — your flipbooks will show up here</p>
      ) : (
        <div className="cards">
          {flipbooks.map((f) => (
            <div key={f.id} className={`card status-${f.status}`}>
              <Link to={`/flipbook/${f.id}`} className="card-link">
                <img src={f.sketch} alt="" draggable={false} />
                <span className="card-motion">{f.motion}</span>
                <span className="card-meta">
                  {f.status === "generating"
                    ? `generating ${f.framesDone}/${f.frameCount}…`
                    : f.status === "failed"
                      ? "failed"
                      : `${f.frameCount} pages`}
                </span>
              </Link>
              <button className="cell-x" title="delete" onClick={() => remove(f.id)}>✕</button>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
