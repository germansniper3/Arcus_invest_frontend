import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Nav } from '../components/Nav';
import { useAuth } from '../lib/auth';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const user = await login(form.email, form.password);
      navigate(user.role === 'student' ? '/student' : '/admin');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Login failed');
    }
  }

  return (
    <>
      <Nav />
      <main className="auth-screen">
        <section>
          <p className="eyebrow">Secure workspace</p>
          <h1>Sign in to your Arcus portal.</h1>
          <p>Admins manage enrollment and quotes. Students manage capstone progress after approval.</p>
        </section>
        <form className="login-card" onSubmit={submit}>
          <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input required type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <button className="primary">Sign in</button>
        </form>
      </main>
    </>
  );
}
