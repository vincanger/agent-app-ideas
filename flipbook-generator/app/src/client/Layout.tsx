import { Link } from "react-router";
import { logout } from "wasp/client/auth";
import type { AuthUser } from "wasp/auth";
import "./Main.css";

export function Layout({ user, children }: { user?: AuthUser; children: React.ReactNode }) {
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">flipbook</Link>
        {user && (
          <span className="who">
            {user.identities.username?.id}
            <button className="mode-toggle" onClick={logout}>log out</button>
          </span>
        )}
      </header>
      {children}
    </div>
  );
}
