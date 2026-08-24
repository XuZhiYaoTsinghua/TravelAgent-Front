import { Navigation } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Place, PlanItemCategory } from '../types';
import { useI18n } from '../i18n/I18nContext';
import type { TranslationKey } from '../i18n/translations';

const categoryColors: Record<PlanItemCategory, string> = {
  transport: '#0ea5e9',
  food: '#ea580c',
  sightseeing: '#7c3aed',
  lodging: '#059669',
  activity: '#e11d48',
};

const CATEGORY_LABEL_KEY: Record<PlanItemCategory, TranslationKey> = {
  transport: 'catTransport',
  food: 'catFood',
  sightseeing: 'catSightseeing',
  lodging: 'catLodging',
  activity: 'catActivity',
};

function createIcon(category: PlanItemCategory): L.DivIcon {
  const color = categoryColors[category];
  return L.divIcon({
    className: 'voyageai-marker',
    html: `<div style="
      width: 28px; height: 28px; border-radius: 50%;
      background-color: ${color}; border: 2px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      display: flex; align-items: center; justify-content: center;
    ">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 10c0 4.9-9.3 11.8-9.8 12.2a1 1 0 0 1-1.2 0C8.5 21.8 0 14.9 0 10a10 10 0 0 1 20 0Z"/>
        <circle cx="10" cy="10" r="3"/>
      </svg>
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  });
}

interface MapViewProps {
  places: Place[];
}

export default function MapView({ places }: MapViewProps) {
  const { lang, t } = useI18n();

  if (!places || places.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Navigation className="w-4 h-4 text-teal-600" />
          <h3 className="text-sm font-semibold text-slate-800">{t('mapTitle')}</h3>
        </div>
        <div className="h-48 rounded-xl bg-slate-50 flex items-center justify-center">
          <p className="text-slate-400 text-sm">{t('mapEmpty')}</p>
        </div>
      </div>
    );
  }

  const lats = places.map((p) => p.lat);
  const lngs = places.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;
  const latPadding = Math.max((maxLat - minLat) * 0.15, 0.01);
  const lngPadding = Math.max((maxLng - minLng) * 0.15, 0.01);
  const bounds: L.LatLngBoundsExpression = [
    [maxLat + latPadding, maxLng + lngPadding],
    [minLat - latPadding, minLng - lngPadding],
  ];

  // 中文模式用高德瓦片（中文标注，GCJ-02 与 B 侧高德数据坐标一致）；英文模式用 OSM
  const useAmap = lang === 'zh';

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Navigation className="w-4 h-4 text-teal-600" />
        <h3 className="text-sm font-semibold text-slate-800">{t('mapTitle')}</h3>
      </div>

      <div className="h-64 rounded-xl overflow-hidden border border-slate-200 z-0">
        <MapContainer
          center={[centerLat, centerLng]}
          zoom={12}
          scrollWheelZoom={false}
          style={{ height: '100%', width: '100%' }}
        >
          {useAmap ? (
            <TileLayer
              attribution='&copy; 高德地图'
              url="https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}"
              subdomains={['1', '2', '3', '4']}
              maxZoom={18}
            />
          ) : (
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          )}
          {places.map((place) => (
            <Marker
              key={place.id}
              position={[place.lat, place.lng]}
              icon={createIcon(place.category)}
            >
              <Popup>
                <div className="space-y-1">
                  <strong className="text-sm text-slate-800">{place.name}</strong>
                  <div className="text-xs text-slate-500">{t(CATEGORY_LABEL_KEY[place.category])}</div>
                  {place.description && (
                    <p className="text-xs text-slate-600">{place.description}</p>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      <div className="flex flex-wrap gap-3 mt-3">
        {(Object.keys(categoryColors) as PlanItemCategory[]).map((cat) => (
          <div key={cat} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: categoryColors[cat] }} />
            <span className="text-xs text-slate-500">{t(CATEGORY_LABEL_KEY[cat])}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
