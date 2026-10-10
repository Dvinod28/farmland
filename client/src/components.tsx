import { Link } from 'react-router-dom';
import { MapContainer, Polygon, TileLayer } from 'react-leaflet';
import { Plot } from './api';

export const INDIA_CENTER: [number, number] = [22.5, 79];

export function Tiles() {
  return (
    <TileLayer
      attribution="&copy; OpenStreetMap contributors"
      url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
    />
  );
}

export function VerifiedBadge({ verified }: { verified: boolean }) {
  return <span className={verified ? 'badge' : 'badge pending'}>{verified ? '✔ Verified' : 'Unverified'}</span>;
}

export function PlotCard({ plot }: { plot: Plot }) {
  return (
    <div className="card">
      <div className="row" style={{ alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}><Link to={`/plots/${plot.id}`}>{plot.title}</Link></h3>
        <div style={{ textAlign: 'right' }}><VerifiedBadge verified={plot.verified} /></div>
      </div>
      <p className="muted">
        {[plot.village, plot.district, plot.state].filter(Boolean).join(', ')} · {plot.areaAcres} acres
      </p>
      <div>{plot.crops.map((c) => <span key={c} className="tag">{c}</span>)}</div>
      {plot.expectedHarvest && (
        <p className="muted">
          Harvest: {plot.expectedHarvest}
          {plot.expectedQuantityQtl != null && ` · ~${plot.expectedQuantityQtl} qtl`}
        </p>
      )}
    </div>
  );
}

export function PlotsMap({ plots, height = 360 }: { plots: Plot[]; height?: number }) {
  const center = plots.length === 1 ? plots[0].center : INDIA_CENTER;
  const zoom = plots.length === 1 ? 16 : 5;
  return (
    <div className="map" style={{ height }}>
      <MapContainer key={plots.map((p) => p.id).join(',')} center={center} zoom={zoom} style={{ height: '100%' }}>
        <Tiles />
        {plots.map((p) => (
          <Polygon key={p.id} positions={p.boundary} pathOptions={{ color: p.verified ? '#2e7d32' : '#e0a000' }} />
        ))}
      </MapContainer>
    </div>
  );
}
