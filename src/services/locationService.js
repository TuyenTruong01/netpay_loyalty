import { hasSupabaseConfig, supabase } from '../lib/supabaseClient.js';

const FALLBACK_COUNTRIES = [
  {
    id: 'country-vn',
    code: 'VN',
    name: 'Vietnam',
    normalizedName: 'vietnam',
    currencyCode: 'VND',
    currencySymbol: 'd',
    currencyDecimals: 0,
    phoneCode: '+84',
  },
];

const FALLBACK_DIVISIONS = [
  { id: 'vn-da-nang', countryCode: 'VN', parentId: null, divisionType: 'municipality', code: 'VN-DN', name: 'Da Nang', normalizedName: 'da nang', level: 1, latitude: 16.0678, longitude: 108.2208, timezone: 'Asia/Ho_Chi_Minh' },
  { id: 'vn-dn-hai-chau', countryCode: 'VN', parentId: 'vn-da-nang', divisionType: 'district', code: 'VN-DN-HC', name: 'Hai Chau', normalizedName: 'hai chau', level: 2, latitude: 16.0675, longitude: 108.22, timezone: 'Asia/Ho_Chi_Minh' },
  { id: 'vn-dn-thanh-khe', countryCode: 'VN', parentId: 'vn-da-nang', divisionType: 'district', code: 'VN-DN-TK', name: 'Thanh Khe', normalizedName: 'thanh khe', level: 2, latitude: 16.0642, longitude: 108.1873, timezone: 'Asia/Ho_Chi_Minh' },
  { id: 'vn-dn-son-tra', countryCode: 'VN', parentId: 'vn-da-nang', divisionType: 'district', code: 'VN-DN-ST', name: 'Son Tra', normalizedName: 'son tra', level: 2, latitude: 16.1061, longitude: 108.2522, timezone: 'Asia/Ho_Chi_Minh' },
  { id: 'vn-dn-ngu-hanh-son', countryCode: 'VN', parentId: 'vn-da-nang', divisionType: 'district', code: 'VN-DN-NHS', name: 'Ngu Hanh Son', normalizedName: 'ngu hanh son', level: 2, latitude: 16.0036, longitude: 108.2644, timezone: 'Asia/Ho_Chi_Minh' },
  { id: 'vn-dn-lien-chieu', countryCode: 'VN', parentId: 'vn-da-nang', divisionType: 'district', code: 'VN-DN-LC', name: 'Lien Chieu', normalizedName: 'lien chieu', level: 2, latitude: 16.0718, longitude: 108.1503, timezone: 'Asia/Ho_Chi_Minh' },
  { id: 'vn-dn-cam-le', countryCode: 'VN', parentId: 'vn-da-nang', divisionType: 'district', code: 'VN-DN-CL', name: 'Cam Le', normalizedName: 'cam le', level: 2, latitude: 16.0154, longitude: 108.1996, timezone: 'Asia/Ho_Chi_Minh' },
  { id: 'vn-dn-hoa-vang', countryCode: 'VN', parentId: 'vn-da-nang', divisionType: 'district', code: 'VN-DN-HV', name: 'Hoa Vang', normalizedName: 'hoa vang', level: 2, latitude: 15.9996, longitude: 107.9972, timezone: 'Asia/Ho_Chi_Minh' },
  { id: 'vn-dn-hoang-sa', countryCode: 'VN', parentId: 'vn-da-nang', divisionType: 'district', code: 'VN-DN-HS', name: 'Hoang Sa', normalizedName: 'hoang sa', level: 2, latitude: null, longitude: null, timezone: 'Asia/Ho_Chi_Minh' },
  { id: 'vn-dn-hc-thach-thang', countryCode: 'VN', parentId: 'vn-dn-hai-chau', divisionType: 'ward', code: 'VN-DN-HC-TT', name: 'Thach Thang', normalizedName: 'thach thang', level: 3, latitude: 16.0757, longitude: 108.2203, timezone: 'Asia/Ho_Chi_Minh' },
  { id: 'vn-dn-hc-hai-chau-i', countryCode: 'VN', parentId: 'vn-dn-hai-chau', divisionType: 'ward', code: 'VN-DN-HC-HD1', name: 'Hai Chau I', normalizedName: 'hai chau i', level: 3, latitude: 16.0682, longitude: 108.2209, timezone: 'Asia/Ho_Chi_Minh' },
  { id: 'vn-dn-hc-hai-chau-ii', countryCode: 'VN', parentId: 'vn-dn-hai-chau', divisionType: 'ward', code: 'VN-DN-HC-HD2', name: 'Hai Chau II', normalizedName: 'hai chau ii', level: 3, latitude: 16.0627, longitude: 108.2193, timezone: 'Asia/Ho_Chi_Minh' },
  { id: 'vn-dn-hc-nam-duong', countryCode: 'VN', parentId: 'vn-dn-hai-chau', divisionType: 'ward', code: 'VN-DN-HC-NB', name: 'Nam Duong', normalizedName: 'nam duong', level: 3, latitude: 16.0645, longitude: 108.2149, timezone: 'Asia/Ho_Chi_Minh' },
  { id: 'vn-dn-hc-binh-thuan', countryCode: 'VN', parentId: 'vn-dn-hai-chau', divisionType: 'ward', code: 'VN-DN-HC-BT', name: 'Binh Thuan', normalizedName: 'binh thuan', level: 3, latitude: 16.0549, longitude: 108.2172, timezone: 'Asia/Ho_Chi_Minh' },
  { id: 'vn-dn-hc-phuoc-ninh', countryCode: 'VN', parentId: 'vn-dn-hai-chau', divisionType: 'ward', code: 'VN-DN-HC-PT', name: 'Phuoc Ninh', normalizedName: 'phuoc ninh', level: 3, latitude: 16.0666, longitude: 108.2172, timezone: 'Asia/Ho_Chi_Minh' },
];

export function normalizeSearchText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function rankMatch(item, query) {
  const normalized = item.normalizedName || normalizeSearchText(item.name);
  if (!query) return 10;
  if (normalized.startsWith(query)) return 0;
  if (normalized.split(' ').some(part => part.startsWith(query))) return 1;
  if (normalized.includes(query)) return 2;
  return 9;
}

function sortAndLimit(items, query, limit = 20) {
  const normalized = normalizeSearchText(query);
  return items
    .filter(item => !normalized || (item.normalizedName || normalizeSearchText(item.name)).includes(normalized))
    .sort((a, b) => rankMatch(a, normalized) - rankMatch(b, normalized) || a.name.localeCompare(b.name))
    .slice(0, limit);
}

function mapCountry(row = {}) {
  return {
    id: row.id,
    code: row.code || row.country_code,
    name: row.name || row.country_name,
    normalizedName: row.normalized_name || normalizeSearchText(row.name || row.country_name),
    currencyCode: row.currency_code || 'VND',
    currencySymbol: row.currency_symbol || 'd',
    currencyDecimals: Number(row.currency_decimals ?? 0),
    phoneCode: row.phone_code || '',
  };
}

function mapDivision(row = {}) {
  return {
    id: row.id,
    countryCode: row.country_code,
    parentId: row.parent_id,
    divisionType: row.division_type,
    code: row.code || '',
    name: row.name,
    normalizedName: row.normalized_name || normalizeSearchText(row.name),
    level: Number(row.level || 0),
    latitude: row.latitude === null || row.latitude === undefined ? null : Number(row.latitude),
    longitude: row.longitude === null || row.longitude === undefined ? null : Number(row.longitude),
    timezone: row.timezone || '',
  };
}

export async function searchCountries(query = '') {
  const normalized = normalizeSearchText(query);
  if (hasSupabaseConfig && supabase) {
    const request = supabase
      .from('countries')
      .select('id, code, country_code, name, country_name, normalized_name, currency_code, currency_symbol, currency_decimals, phone_code')
      .eq('is_active', true)
      .or(`normalized_name.ilike.%${normalized}%,name.ilike.%${query}%,country_name.ilike.%${query}%`)
      .limit(20);
    const { data, error } = await request;
    if (!error && data?.length) return sortAndLimit(data.map(mapCountry), query);
  }
  return sortAndLimit(FALLBACK_COUNTRIES, query);
}

export async function getChildren(parentId, type) {
  if (!parentId) return [];
  if (hasSupabaseConfig && supabase) {
    let request = supabase
      .from('administrative_divisions')
      .select('*')
      .eq('parent_id', parentId)
      .eq('is_active', true)
      .order('name')
      .limit(50);
    if (type) request = request.eq('division_type', type);
    const { data, error } = await request;
    if (!error) return (data || []).map(mapDivision);
  }
  return FALLBACK_DIVISIONS.filter(item => item.parentId === parentId && (!type || item.divisionType === type));
}

export async function searchDivisions({ countryCode, parentId = null, level = null, query = '' }) {
  const normalized = normalizeSearchText(query);
  if (hasSupabaseConfig && supabase) {
    let request = supabase
      .from('administrative_divisions')
      .select('*')
      .eq('country_code', countryCode)
      .eq('is_active', true)
      .limit(30);

    if (parentId) request = request.eq('parent_id', parentId);
    if (!parentId && level !== null) request = request.eq('level', level);
    if (normalized) request = request.ilike('normalized_name', `%${normalized}%`);

    const { data, error } = await request;
    if (!error && data) return sortAndLimit(data.map(mapDivision), query, 30);
  }

  return sortAndLimit(
    FALLBACK_DIVISIONS.filter(item =>
      item.countryCode === countryCode &&
      (parentId ? item.parentId === parentId : level === null || item.level === level)
    ),
    query,
    30
  );
}

export function buildFullAddress(store = {}) {
  return [
    store.streetAddress,
    store.ward,
    store.district,
    store.city,
    store.stateProvince,
    store.postalCode,
    store.countryName,
  ].map(value => String(value || '').trim()).filter(Boolean).join(', ');
}
