import { useMemo, useState } from 'react';
import { Compass, MapPin, Navigation, Search, Store } from 'lucide-react';
import { formatLocalCurrency } from '../services/exchangeRateService.js';

function text(value) {
  return String(value || '').trim();
}

function addressLine(store = {}) {
  return [store.streetAddress, store.ward, store.district, store.city, store.countryName].map(text).filter(Boolean).join(', ');
}

function toRad(value) {
  return Number(value || 0) * Math.PI / 180;
}

function distanceKm(a, b) {
  if (!a || !b || a.latitude === null || a.longitude === null || b.latitude === null || b.longitude === null) return null;
  const earth = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earth * Math.asin(Math.sqrt(h));
}

export default function ExplorePage({ stores = [], onSelectStore }) {
  const [query, setQuery] = useState('');
  const [country, setCountry] = useState('all');
  const [city, setCity] = useState('all');
  const [near, setNear] = useState(null);
  const [geoMessage, setGeoMessage] = useState('');

  const activeStores = stores.filter(store => store && store.isActive !== false && store.status !== 'disabled');
  const countries = useMemo(() => [...new Set(activeStores.map(store => store.countryName || store.countryCode || 'Unknown'))], [activeStores]);
  const cities = useMemo(() => [...new Set(activeStores.filter(store => country === 'all' || [store.countryName, store.countryCode].includes(country)).map(store => store.city || 'Unknown'))], [activeStores, country]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return activeStores
      .map(store => ({ ...store, distanceKm: distanceKm(near, store) }))
      .filter(store => country === 'all' || [store.countryName, store.countryCode].includes(country))
      .filter(store => city === 'all' || (store.city || 'Unknown') === city)
      .filter(store => {
        if (!keyword) return true;
        const productText = (store.products || []).map(product => product.name).join(' ');
        return [store.name, store.type, store.city, store.countryName, productText].join(' ').toLowerCase().includes(keyword);
      })
      .sort((a, b) => {
        if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
        return String(a.countryName || '').localeCompare(String(b.countryName || '')) || String(a.city || '').localeCompare(String(b.city || ''));
      });
  }, [activeStores, city, country, near, query]);

  const grouped = filtered.reduce((acc, store) => {
    const key = `${store.countryName || store.countryCode || 'Unknown'} -> ${store.city || 'Unknown'}`;
    acc[key] = [...(acc[key] || []), store];
    return acc;
  }, {});

  function requestNearMe() {
    setGeoMessage('');
    if (!navigator.geolocation) {
      setGeoMessage('Location is not supported by this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      position => setNear({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => setGeoMessage('Location permission was not granted. You can still browse by city.')
    );
  }

  return (
    <main className="market-stage">
      <section className="market-shell">
        <header className="market-head">
          <div>
            <small>Paynet Loyalty marketplace</small>
            <h1>Explore stores</h1>
          </div>
          <a className="market-map-link" href="/map"><MapPin size={18} />Map</a>
        </header>

        <section className="market-filters">
          <label className="market-search"><Search size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search stores or products" /></label>
          <select value={country} onChange={event => { setCountry(event.target.value); setCity('all'); }}>
            <option value="all">All countries</option>
            {countries.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={city} onChange={event => setCity(event.target.value)}>
            <option value="all">All cities</option>
            {cities.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
          <button type="button" onClick={requestNearMe}><Compass size={17} />Near me</button>
        </section>
        {geoMessage && <p className="market-note">{geoMessage}</p>}

        {Object.entries(grouped).map(([group, groupStores]) => (
          <section className="market-group" key={group}>
            <h2>{group.replace(' -> ', ' / ')}</h2>
            <div className="market-grid">
              {groupStores.map(store => {
                const firstProduct = (store.products || [])[0];
                const storeUrl = `/s/${store.slug || store.id}?source=explore`;
                const directions = store.latitude !== null && store.longitude !== null
                  ? `https://www.google.com/maps/search/?api=1&query=${store.latitude},${store.longitude}`
                  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLine(store) || store.name)}`;
                return (
                  <article className="market-card" key={store.id}>
                    <div className="market-card-mark"><Store size={22} /></div>
                    <div>
                      <small>{store.type} - {store.currencyCode}</small>
                      <strong>{store.name}</strong>
                      <span>{addressLine(store) || store.branch}</span>
                      {store.distanceKm !== null && <em>{store.distanceKm.toFixed(1)} km away</em>}
                      {firstProduct && <p>From {formatLocalCurrency(firstProduct.localPrice ?? firstProduct.localPriceMinor, store)}</p>}
                    </div>
                    <div className="market-actions">
                      <a href={storeUrl} onClick={() => onSelectStore?.(store.id)}>View Store</a>
                      <a href={directions} target="_blank" rel="noreferrer"><Navigation size={15} />Directions</a>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}

        {!filtered.length && <div className="empty-mobile">No active stores match this search.</div>}
      </section>
    </main>
  );
}
