import { useEffect, useMemo } from 'react';
import { Navigation } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
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

// 小号圆点标记（16px 纯色圆 + 白描边），类别靠颜色区分，避免大面积遮挡地图
function createIcon(category: PlanItemCategory): L.DivIcon {
  const color = categoryColors[category];
  return L.divIcon({
    className: 'voyageai-marker',
    html: `<div style="
      width: 16px; height: 16px; border-radius: 50%;
      background-color: ${color}; border: 1.5px solid white;
      box-shadow: 0 1px 4px rgba(0,0,0,0.35);
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -8],
  });
}

// 自动缩放：行程点变化后 fitBounds，右上方预留标签空间；单点收敛在 maxZoom
function FitBounds({ bounds }: { bounds: L.LatLngBoundsExpression }) {
  const map = useMap();
  useEffect(() => {
    try {
      map.fitBounds(bounds, {
        paddingTopLeft: [24, 24],
        paddingBottomRight: [120, 24],
        maxZoom: 16,
        animate: true,
      });
    } catch {
      // 边界异常时保持当前视野
    }
  }, [map, bounds]);
  return null;
}

interface MapViewProps {
  places: Place[];
}

export default function MapView({ places: allPlaces }: MapViewProps) {
  const { lang, t } = useI18n();

  // B 侧 timeline 的 food/transport/hotel 项坐标常为 0，混入中心点计算会把地图
  // 拖到 (0,0) 与目的地的中点（公海区域），高德瓦片在高缩放级别无数据 → 整片空白
  const places = useMemo(
    () => (allPlaces ?? []).filter(
      (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && (p.lat !== 0 || p.lng !== 0)
    ),
    [allPlaces],
  );

  // 以地点 id 序列做签名：App 每次渲染都会生成新的 places 数组（如轮询事件到达），
  // 签名不变则 bounds 不重建，避免视野被反复重置（用户平移后不被拉回）
  const boundsSignature = places.map((p) => p.id).join('|');
  const bounds = useMemo<L.LatLngBoundsExpression>(() => {
    const lats = places.map((p) => p.lat);
    const lngs = places.map((p) => p.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const latPadding = Math.max((maxLat - minLat) * 0.15, 0.01);
    const lngPadding = Math.max((maxLng - minLng) * 0.15, 0.01);
    return [
      [maxLat + latPadding, maxLng + lngPadding],
      [minLat - latPadding, minLng - lngPadding],
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundsSignature]);

  if (places.length === 0) {
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

  const centerLat = (Math.min(...places.map((p) => p.lat)) + Math.max(...places.map((p) => p.lat))) / 2;
  const centerLng = (Math.min(...places.map((p) => p.lng)) + Math.max(...places.map((p) => p.lng))) / 2;

  // 中文模式用高德瓦片（中文标注，GCJ-02 与 B 侧高德数据坐标一致）；英文模式用 OSM
  const useAmap = lang === 'zh';

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Navigation className="w-4 h-4 text-teal-600" />
        <h3 className="text-sm font-semibold text-slate-800">{t('mapTitle')}</h3>
      </div>

      <div className="h-72 rounded-xl overflow-hidden border border-slate-200 z-0">
        <MapContainer
          center={[centerLat, centerLng]}
          zoom={12}
          scrollWheelZoom={false}
          style={{ height: '100%', width: '100%' }}
        >
          <FitBounds bounds={bounds} />
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
          {/* 常驻文字标注改为全类别显示（此前仅观光类，餐饮/住宿等要点标记才看到名字）。
              去重：酒店按天重复、相同站点多次出现时只保留一个标签（标记本身已重叠在一点），
              否则相同坐标会叠出多层重影标签 */}
          {(() => {
            const labeled = new Set<string>();
            return places.map((place) => {
              const labelKey = `${place.category}|${place.name}|${place.lat.toFixed(5)},${place.lng.toFixed(5)}`;
              const showLabel = !labeled.has(labelKey);
              if (showLabel) labeled.add(labelKey);
              return (
                <Marker
                  key={place.id}
                  position={[place.lat, place.lng]}
                  icon={createIcon(place.category)}
                >
                  {showLabel && (
                    <Tooltip permanent direction="right" offset={[10, 0]} className="voyageai-place-label">
                      <span className="voyageai-label-inner">
                        <span className="voyageai-label-dot" style={{ backgroundColor: categoryColors[place.category] }} />
                        <span className="voyageai-label-text">{place.name}</span>
                      </span>
                    </Tooltip>
                  )}
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
              );
            });
          })()}
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
