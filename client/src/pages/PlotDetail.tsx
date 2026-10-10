import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, getSession, Plot } from '../api';
import { PlotsMap, VerifiedBadge } from '../components';

export default function PlotDetail() {
  const { id } = useParams();
  const session = getSession();
  const [plot, setPlot] = useState<Plot | null>(null);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const load = () => api<Plot>(`/api/plots/${id}`).then(setPlot).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [id]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    setError(''); setStatus('');
    try {
      await api(`/api/plots/${id}/enquiries`, { method: 'POST', body: { message } });
      setStatus('Enquiry sent. The farmer will contact you.');
      setMessage('');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const toggleVerify = async () => {
    await api(`/api/plots/${id}/verify`, { method: 'PATCH', body: { verified: !plot!.verified } });
    load();
  };

  if (!plot) return <p>{error || 'Loading…'}</p>;
  const rows: [string, string | number | null][] = [
    ['Location', [plot.village, plot.district, plot.state].filter(Boolean).join(', ')],
    ['Survey number', plot.surveyNumber],
    ['Area', `${plot.areaAcres} acres`],
    ['Soil', plot.soilType],
    ['Water source', plot.waterSource],
    ['Crops', plot.crops.join(', ')],
    ['Expected harvest', plot.expectedHarvest],
    ['Expected quantity', plot.expectedQuantityQtl != null ? `${plot.expectedQuantityQtl} quintal` : null],
    ['Owner', plot.ownerName],
  ];

  return (
    <>
      <h2>{plot.title} <VerifiedBadge verified={plot.verified} /></h2>
      <PlotsMap plots={[plot]} />
      <div className="card">
        {rows.filter(([, v]) => v).map(([k, v]) => (
          <p key={k} style={{ margin: '6px 0' }}><b>{k}:</b> {v}</p>
        ))}
      </div>
      {session?.user.role === 'admin' && (
        <button className="secondary" onClick={toggleVerify}>{plot.verified ? 'Remove verification' : 'Mark as verified'}</button>
      )}
      {session?.user.role === 'buyer' && (
        <form className="card" onSubmit={send}>
          <h3>Contact the farmer</h3>
          <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Quantity needed, price, delivery location…" />
          {error && <div className="error">{error}</div>}
          {status && <p>{status}</p>}
          <p><button type="submit">Send enquiry</button></p>
        </form>
      )}
      {!session && <p className="muted"><Link to="/login">Login as a buyer</Link> to contact the owner. Contact details stay private until you send an enquiry.</p>}
    </>
  );
}
