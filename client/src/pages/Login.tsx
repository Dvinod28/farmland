import { FormEvent, useState } from 'react';
import { api, Role, User } from '../api';

type Props = { onLogin: (s: { token: string; user: User }) => void };

export default function Login({ onLogin }: Props) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [role, setRole] = useState<Exclude<Role, 'admin'>>('farmer');
  const [name, setName] = useState('');
  const [sent, setSent] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [error, setError] = useState('');

  const requestOtp = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const r = await api<{ devOtp?: string }>('/api/auth/request-otp', { method: 'POST', body: { phone } });
      setDevOtp(r.devOtp ?? null);
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      onLogin(await api('/api/auth/verify-otp', { method: 'POST', body: { phone, otp, role, name } }));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <form className="card" style={{ maxWidth: 420, margin: '0 auto' }} onSubmit={sent ? verify : requestOtp}>
      <h2>Login / Sign up</h2>
      <div className="field">
        <label>Mobile number</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="numeric" maxLength={10} placeholder="10-digit number" disabled={sent} />
      </div>
      {!sent && (
        <>
          <div className="field">
            <label>I am a (new users)</label>
            <select value={role} onChange={(e) => setRole(e.target.value as 'farmer' | 'buyer')}>
              <option value="farmer">Farmer / landowner</option>
              <option value="buyer">Food crop buyer</option>
            </select>
          </div>
          <div className="field">
            <label>Name (new users)</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        </>
      )}
      {sent && (
        <div className="field">
          <label>OTP</label>
          <input value={otp} onChange={(e) => setOtp(e.target.value)} inputMode="numeric" maxLength={6} />
          {devOtp && <p className="muted">Dev mode — your OTP is <b>{devOtp}</b></p>}
        </div>
      )}
      {error && <div className="error">{error}</div>}
      <button type="submit">{sent ? 'Verify & continue' : 'Send OTP'}</button>
    </form>
  );
}
