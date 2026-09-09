import { Link } from "react-router";
import { LoginForm, SignupForm } from "wasp/client/auth";
import { Layout } from "../Layout";

export function LoginPage() {
  return (
    <Layout>
      <div className="auth-box">
        <LoginForm />
        <p className="hint">
          Don't have an account yet? <Link to="/signup">sign up</Link>.
        </p>
      </div>
    </Layout>
  );
}

export function SignupPage() {
  return (
    <Layout>
      <div className="auth-box">
        <SignupForm />
        <p className="hint">
          Already have an account? <Link to="/login">log in</Link>.
        </p>
      </div>
    </Layout>
  );
}
