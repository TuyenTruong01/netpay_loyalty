import { useMemo, useState } from 'react';
import { LocateFixed, MapPin, Search } from 'lucide-react';

function percent(value, min, max) {
  if (!Number.isFinite(value) || max === min) return 50;
  return Math.max(7, Math.min(93, ((value - min) / (max - min)) * 86 + 7));
}

function addressLine(store = {}) {
  return [store.streetAddress, store.district, store.city, store.countryName].filter(Boolean).join(', ');
}

export default function StoreMapPage({ stores = [], onSelectStore }) {
  const [query, setQuery] = useState('');
  const mapStores = stores.filter(store =>
    store &&
    store.mapVisibility !== false &&
    store.isActive !== false &&
    store.status !== 'disabled' &&
    store.latitude !== null &&
    store.longitude !== null
  );

  const filtered = mapStores.filter(store => [store.name, store.city, store.countryName].join(' ').toLowerCase().includes(query.trim().toLowerCase()));
  const bounds = useMemo(() => {
    const lats = filtered.map(store => Number(store.latitude));
    const lngs = filtered.map(store => Number(store.longitude));
    return {
      minLat: Math.min(...lats, 0),
      maxLat: Math.max(...lats, 1),
      minLng: Math.min(...lngs, 0),
      maxLng: Math.max(...lngs, 1),
    };
  }, [filtered]);

  return (
    <main className="market-stage">
      <section className="market-shell map-shell">
        <header className="market-head">
          <div>
            <small>Public store map</small>
            <h1>Nearby NetPay stores</h1>
          </div>
          <a className="market-map-link" href="/explore">Explore</a>
        </header>
        <label className="market-search map-search"><Search size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Filter map markers" /></label>

        <section className="netpay-map-canvas">
          {filtered.map(store => {
            const left = percent(Number(store.longitude), bounds.minLng, bounds.maxLng);
            const top = 100 - percent(Number(store.latitude), bounds.minLat, bounds.maxLat);
            return (
              <a
                className="map-marker"
                href={`/s/${store.slug || store.id}?source=map`}
                key={store.id}
                style={{ left: `${left}%`, top: `${top}%` }}
                onClick={() => onSelectStore?.(store.id)}
                title={store.name}
              >
                <MapPin size={24} fill="currentColor" />
                <span>{store.name}</span>
              </a>
            );
          })}
          {!filtered.length && <div className="map-empty"><LocateFixed /><span>No mapped stores yet. Add latitude and longitude in store profile.</span></div>}
        </section>

        <div className="map-store-list">
          {filtered.map(store => (
            <article className="map-list-card" key={store.id}>
              <div><strong>{store.name}</strong><span>{addressLine(store) || store.branch}</span></div>
              <a href={`/s/${store.slug || store.id}?source=map`} onClick={() => onSelectStore?.(store.id)}>View Store</a>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
