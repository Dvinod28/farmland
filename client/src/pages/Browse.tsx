import { FormEvent, useEffect, useState } from 'react';
import { api, Plot } from '../api';
import { PlotCard, PlotsMap } from '../components';

export default function Browse() {
  const [plots, setPlots] = useState<Plot[]>([]);
  const [filters, setFilters] = useState({ crop: '', state: '', district: '', harvestBefore: '', verified: false });
  const [error, setError] = useState('');

  const load = async (f = filters) => {
    const q = new URLSearchParams();
    if (f.crop) q.set('crop', f.crop);
    if (f.state) q.set('state', f.state);
    if (f.district) q.set('district', f.district);
    if (f.harvestBefore) q.set('harvestBefore', f.harvestBefore);
    if (f.verified) q.set('verified', 'true');
    try {
      setPlots(await api<Plot[]>(`/api/plots?${q}`));
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => { load(); }, []);

  const set = (k: string, v: string | boolean) => setFilters((f) => ({ ...f, [k]: v }));
  const submit = (e: FormEvent) => { e.preventDefault(); load(); };

  return (
    <>
      <form className="card" onSubmit={submit}>
        <div className="row">
          <div><label>Crop</label><input value={filters.crop} onChange={(e) => set('crop', e.target.value)} placeholder="e.g. rice" /></div>
          <div><label>State</label><input value={filters.state} onChange={(e) => set('state', e.target.value)} /></div>
          <div><label>District</label><input value={filters.district} onChange={(e) => set('district', e.target.value)} /></div>
          <div><label>Harvest before</label><input type="date" value={filters.harvestBefore} onChange={(e) => set('harvestBefore', e.target.value)} /></div>
        </div>
        <p>
          <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={filters.verified} onChange={(e) => set('verified', e.target.checked)} />
            Verified plots only
          </label>{' '}
          <button type="submit">Search</button>
        </p>
      </form>
      {error && <div className="error">{error}</div>}
      <PlotsMap plots={plots} />
      <p className="muted">{plots.length} plot(s) found</p>
      {plots.map((p) => <PlotCard key={p.id} plot={p} />)}
    </>
  );
}
