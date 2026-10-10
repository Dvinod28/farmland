import { useState } from 'react';
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { getSession, setSession } from './api';
import AddPlot from './pages/AddPlot';
import Browse from './pages/Browse';
import Login from './pages/Login';
import MyLand from './pages/MyLand';
import PlotDetail from './pages/PlotDetail';

export default function App() {
  const [session, setLocalSession] = useState(getSession());
  const navigate = useNavigate();
  const user = session?.user;

  const onLogin = (s: NonNullable<typeof session>) => {
    setSession(s);
    setLocalSession(s);
    navigate(s.user.role === 'farmer' ? '/my-land' : '/');
  };
  const logout = () => {
    setSession(null);
    setLocalSession(null);
    navigate('/');
  };

  return (
    <>
      <header className="nav">
        <Link to="/" className="brand">🌾 Farmland Registry</Link>
        <Link to="/">Find land</Link>
        {user?.role === 'farmer' && <Link to="/my-land">My land</Link>}
        {user?.role === 'farmer' && <Link to="/add">Add plot</Link>}
        {user ? (
          <>
            <span>{user.name || user.role}</span>
            <a href="#" onClick={(e) => { e.preventDefault(); logout(); }}>Logout</a>
          </>
        ) : (
          <Link to="/login">Login / Sign up</Link>
        )}
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Browse />} />
          <Route path="/plots/:id" element={<PlotDetail />} />
          <Route path="/login" element={<Login onLogin={onLogin} />} />
          <Route path="/my-land" element={user?.role === 'farmer' ? <MyLand /> : <Navigate to="/login" />} />
          <Route path="/add" element={user?.role === 'farmer' ? <AddPlot /> : <Navigate to="/login" />} />
        </Routes>
      </main>
    </>
  );
}
