import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, Enquiry, Plot } from '../api';
import { PlotCard } from '../components';

export default function MyLand() {
  const [plots, setPlots] = useState<Plot[]>([]);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);

  useEffect(() => {
    api<Plot[]>('/api/my/plots').then(setPlots);
    api<Enquiry[]>('/api/my/enquiries').then(setEnquiries);
  }, []);

  return (
    <>
      <h2>My land</h2>
      {plots.length === 0 && <p>You have not added any plots yet. <Link to="/add">Add your first plot</Link>.</p>}
      {plots.map((p) => <PlotCard key={p.id} plot={p} />)}
      <h2>Buyer enquiries</h2>
      {enquiries.length === 0 && <p className="muted">No enquiries yet.</p>}
      {enquiries.map((e) => (
        <div key={e.id} className="card">
          <b>{e.plotTitle}</b> — {e.buyerName || 'Buyer'} (<a href={`tel:${e.buyerPhone}`}>{e.buyerPhone}</a>)
          <p>{e.message}</p>
          <span className="muted">{e.createdAt}</span>
        </div>
      ))}
    </>
  );
}
