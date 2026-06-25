import { Link, NavLink } from 'react-router-dom';
import { LogIn, ShieldCheck, UserRound } from 'lucide-react';
import { arcusImages } from '../lib/assets';
import { useAuth } from '../lib/auth';

export function Nav() {
  const { user } = useAuth();
  return (
    <header className="nav">
      <Link to="/" className="brand" aria-label="Arcus Investments home">
        <img src={arcusImages.logo} alt="" />
        <span>Arcus Investments</span>
      </Link>
      <nav>
        <a href="/#services">Services</a>
        <a href="/#workshops">Workshops</a>
        <NavLink to="/green-engineering-2026">Events</NavLink>
        <NavLink to="/arcus-innovation-hub-enrollment-manager">Innovation Hub</NavLink>
        {user ? (
          <NavLink to={user.role === 'student' ? '/student' : '/admin'} className="icon-link">
            {user.role === 'student' ? <UserRound size={18} /> : <ShieldCheck size={18} />}
            Portal
          </NavLink>
        ) : (
          <NavLink to="/login" className="icon-link"><LogIn size={18} /> Login</NavLink>
        )}
      </nav>
    </header>
  );
}
