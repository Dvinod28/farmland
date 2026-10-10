import { FormEvent, useState } from 'react';
import { MapContainer, Polygon, Polyline, CircleMarker, useMapEvents } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { INDIA_CENTER, Tiles } from '../components';

function Clicker({ onAdd }: { onAdd: (p: [number, number]) => void }) {
  useMapEvents({ click: (e) => onAdd([e.latlng.lat, e.latlng.lng]) });
  return null;
}

// Geodesic-ish area estimate (acres) from boundary points, to prefill the area field.
function areaAcres(points: [number, number][]) {
  if (points.length < 3) return 0;
  const lat0 = points.reduce((s, p) => s + p[0], 0) / points.length;
  const mx = 111320 * Math.cos((lat0 * Math.PI) / 180);
  const my = 110540;
  const xy = points.map((p) => [p[1] * mx, p[0] * my]);
  let a = 0;
  for (let i = 0; i < xy.length; i++) {
    const [x1, y1] = xy[i];
    const [x2, y2] = xy[(i + 1) % xy.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a / 2) / 4046.856;
}

export default function AddPlot() {
  const navigate = useNavigate();
  const [points, setPoints] = useState<[number, number][]>([]);
  const [f, setF] = useState({
    title: '', state: '', district: '', village: '', surveyNumber: '', areaAcres: '',
    soilType: '', waterSource: '', crops: '', expectedHarvest: '', expectedQuantityQtl: '',
  });
  const [error, setError] = useState('');
  const set = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  const addPoint = (p: [number, number]) => {
    const next = [...points, p];
    setPoints(next);
    if (next.length >= 3) set('areaAcres', areaAcres(next).toFixed(2));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const r = await api<{ id: number }>('/api/plots', {
        method: 'POST',
        body: {
          ...f,
          areaAcres: Number(f.areaAcres),
          crops: f.crops.split(',').map((c) => c.trim()).filter(Boolean),
          expectedQuantityQtl: f.expectedQuantityQtl,
          boundary: points,
        },
      });
      navigate(`/plots/${r.id}`);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const input = (k: keyof typeof f, label: string, type = 'text', placeholder = '') => (
    <div className="field">
      <label>{label}</label>
      <input type={type} value={f[k]} placeholder={placeholder} onChange={(e) => set(k, e.target.value)} />
    </div>
  );

  return (
    <form onSubmit={submit}>
      <h2>Add a plot</h2>
      <div className="card">
        <p className="muted">Click on the map to mark each corner of your plot, in order.</p>
        <div className="map">
          <MapContainer center={INDIA_CENTER} zoom={5} style={{ height: '100%' }}>
            <Tiles />
            <Clicker onAdd={addPoint} />
            {points.length >= 3 ? <Polygon positions={points} /> : <Polyline positions={points} />}
            {points.map((p, i) => <CircleMarker key={i} center={p} radius={4} />)}
          </MapContainer>
        </div>
        <button type="button" className="secondary" onClick={() => setPoints((p) => p.slice(0, -1))} disabled={!points.length}>Undo last point</button>{' '}
        <button type="button" className="secondary" onClick={() => setPoints([])} disabled={!points.length}>Clear</button>
        <span className="muted"> {points.length} point(s)</span>
      </div>
      <div className="card">
        {input('title', 'Plot name', 'text', 'e.g. North paddy field')}
        <div className="row">{input('state', 'State')}{input('district', 'District')}{input('village', 'Village')}</div>
        <div className="row">{input('surveyNumber', 'Survey / Khasra number')}{input('areaAcres', 'Area (acres)', 'number')}</div>
        <div className="row">{input('soilType', 'Soil type', 'text', 'e.g. black cotton')}{input('waterSource', 'Water source', 'text', 'e.g. borewell, canal')}</div>
        {input('crops', 'Crops (comma separated)', 'text', 'rice, maize')}
        <div className="row">{input('expectedHarvest', 'Expected harvest date', 'date')}{input('expectedQuantityQtl', 'Expected quantity (quintal)', 'number')}</div>
        <p className="muted">Document upload (7/12, Khasra/Khatauni) and verification are coming next.</p>
        {error && <div className="error">{error}</div>}
        <button type="submit">Save plot</button>
      </div>
    </form>
  );
}
