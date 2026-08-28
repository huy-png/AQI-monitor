import { Activity, LocateFixed, MapPin, Minus, Navigation, Plus, RadioTower, RotateCcw } from "lucide-react";
import type { ClimateReading, Device } from "@climasense/shared";
import { useEffect, useMemo, useRef, useState, type ComponentRef, type PointerEvent } from "react";
import { useDashboardData } from "../hooks/useDashboardData";
import { formatTime } from "../utils/format";

// This view keeps mainland Vietnam, Hoang Sa, and Truong Sa in the opening frame.
const VIETNAM_CENTER = { latitude: 14.2, longitude: 109.4 };
const DEFAULT_SIZE = { width: 900, height: 620 };
const TILE_SIZE = 256;
const MIN_ZOOM = 3;
const MAX_ZOOM = 18;
const INITIAL_ZOOM = 5;

interface MapDevice {
  device: Device;
  reading: ClimateReading | undefined;
  x: number;
  y: number;
  hasCoordinates: boolean;
}

interface TileInfo {
  x: number;
  y: number;
  z: number;
  left: number;
  top: number;
}

interface MapView {
  center: typeof VIETNAM_CENTER;
  zoom: number;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  centerX: number;
  centerY: number;
}

function hasCoordinates(reading: ClimateReading | undefined) {
  return Number.isFinite(reading?.latitude) && Number.isFinite(reading?.longitude);
}

function clampLatitude(latitude: number) {
  return Math.min(85.0511, Math.max(-85.0511, latitude));
}

function wrapLongitude(longitude: number) {
  return ((longitude + 180) % 360 + 360) % 360 - 180;
}

function fallbackPosition(index: number, total: number) {
  const angle = (index / Math.max(total, 1)) * Math.PI * 2 - Math.PI / 2;
  const radius = total > 1 ? 24 : 0;
  return { x: 50 + Math.cos(angle) * radius, y: 50 + Math.sin(angle) * radius };
}

function worldSize(zoom: number) {
  return TILE_SIZE * 2 ** zoom;
}

function lonToWorldX(longitude: number, zoom: number) {
  return ((wrapLongitude(longitude) + 180) / 360) * worldSize(zoom);
}

function latToWorldY(latitude: number, zoom: number) {
  const radians = clampLatitude(latitude) * Math.PI / 180;
  return ((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) * worldSize(zoom);
}

function worldToCoordinates(x: number, y: number, zoom: number) {
  const size = worldSize(zoom);
  const wrappedX = ((x % size) + size) % size;
  const longitude = wrappedX / size * 360 - 180;
  const mercator = Math.PI * (1 - 2 * Math.min(1, Math.max(0, y / size)));
  const latitude = 180 / Math.PI * Math.atan(Math.sinh(mercator));
  return { latitude: clampLatitude(latitude), longitude };
}

function tileUrlX(x: number, zoom: number) {
  const count = 2 ** zoom;
  return ((x % count) + count) % count;
}

function buildMap(devices: Device[], readings: Record<string, ClimateReading>, view: MapView, size: typeof DEFAULT_SIZE) {
  const centerX = lonToWorldX(view.center.longitude, view.zoom);
  const centerY = latToWorldY(view.center.latitude, view.zoom);
  const firstTileX = Math.floor((centerX - size.width / 2) / TILE_SIZE);
  const firstTileY = Math.floor((centerY - size.height / 2) / TILE_SIZE);
  const lastTileX = Math.floor((centerX + size.width / 2) / TILE_SIZE);
  const lastTileY = Math.floor((centerY + size.height / 2) / TILE_SIZE);
  const tileCount = 2 ** view.zoom;
  const tiles: TileInfo[] = [];

  for (let y = firstTileY; y <= lastTileY; y += 1) {
    if (y < 0 || y >= tileCount) continue;
    for (let x = firstTileX; x <= lastTileX; x += 1) {
      tiles.push({
        x,
        y,
        z: view.zoom,
        left: x * TILE_SIZE - (centerX - size.width / 2),
        top: y * TILE_SIZE - (centerY - size.height / 2)
      });
    }
  }

  const mappedDevices = devices.map<MapDevice>((device, index) => {
    const reading = readings[device.deviceId];
    if (!hasCoordinates(reading)) {
      const fallback = fallbackPosition(index, devices.length);
      return { device, reading, x: fallback.x / 100 * size.width, y: fallback.y / 100 * size.height, hasCoordinates: false };
    }

    let pointX = lonToWorldX(reading.longitude as number, view.zoom);
    const pointY = latToWorldY(reading.latitude as number, view.zoom);
    const sizeAtZoom = worldSize(view.zoom);
    if (pointX - centerX > sizeAtZoom / 2) pointX -= sizeAtZoom;
    if (centerX - pointX > sizeAtZoom / 2) pointX += sizeAtZoom;
    return { device, reading, x: size.width / 2 + pointX - centerX, y: size.height / 2 + pointY - centerY, hasCoordinates: true };
  });

  return { tiles, devices: mappedDevices };
}

export function MapPage() {
  const { data, isLoading, error } = useDashboardData("24h");
  const canvasRef = useRef<ComponentRef<"div">>(null);
  const dragRef = useRef<DragState | null>(null);
  const [mapSize, setMapSize] = useState(DEFAULT_SIZE);
  const [view, setView] = useState<MapView>({ center: VIETNAM_CENTER, zoom: INITIAL_ZOOM });
  const [selectedDeviceId, setSelectedDeviceId] = useState("");

  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return undefined;
    const updateSize = () => setMapSize({ width: element.clientWidth, height: element.clientHeight });
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const mapModel = useMemo(
    () => buildMap(data?.devices ?? [], data?.deviceReadings ?? {}, view, mapSize),
    [data?.devices, data?.deviceReadings, mapSize, view]
  );
  const selected = mapModel.devices.find((item) => item.device.deviceId === selectedDeviceId) ?? mapModel.devices[0];
  const onlineCount = mapModel.devices.filter((item) => item.device.status !== "offline").length;
  const coordinateCount = mapModel.devices.filter((item) => item.hasCoordinates).length;

  const updateZoom = (nextZoom: number, focalPoint?: { x: number; y: number }) => {
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
    if (zoom === view.zoom) return;
    setView((current) => {
      if (!focalPoint) return { ...current, zoom };
      const currentCenterX = lonToWorldX(current.center.longitude, current.zoom);
      const currentCenterY = latToWorldY(current.center.latitude, current.zoom);
      const scale = 2 ** (zoom - current.zoom);
      const nextCenterX = currentCenterX * scale + (focalPoint.x - mapSize.width / 2) * (scale - 1);
      const nextCenterY = currentCenterY * scale + (focalPoint.y - mapSize.height / 2) * (scale - 1);
      return { center: worldToCoordinates(nextCenterX, nextCenterY, zoom), zoom };
    });
  };

  const handlePointerDown = (event: PointerEvent<ComponentRef<"div">>) => {
    if (event.button !== 0) return;
    const centerX = lonToWorldX(view.center.longitude, view.zoom);
    const centerY = latToWorldY(view.center.latitude, view.zoom);
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, centerX, centerY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<ComponentRef<"div">>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setView((current) => ({
      ...current,
      center: worldToCoordinates(drag.centerX - (event.clientX - drag.startX), drag.centerY - (event.clientY - drag.startY), current.zoom)
    }));
  };

  const stopDragging = (event: PointerEvent<ComponentRef<"div">>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  if (isLoading) return <div className="grid min-h-[70vh] place-items-center p-6"><p className="text-muted">Dang tai ban do...</p></div>;

  if (error || !data) {
    return <div className="grid min-h-[70vh] place-items-center p-6"><div className="empty-state max-w-xl rounded-xl p-8 text-center"><MapPin className="mx-auto text-cyanCore" size={36} aria-hidden="true" /><h1 className="mt-4 text-2xl font-bold">Chua co du lieu ban do</h1><p className="text-muted mt-2">{error ?? "He thong chua nhan duoc du lieu thiet bi."}</p></div></div>;
  }

  return (
    <div className="dashboard-page grid gap-4 p-4 xl:p-5">
      <header className="page-heading"><div><p className="eyebrow">OpenStreetMap</p><h1 className="page-title">Ban do node quan trac</h1></div><span className="data-badge">{coordinateCount}/{mapModel.devices.length} co toa do</span></header>
      <section className="map-layout">
        <div
          ref={canvasRef}
          className="glass-card map-canvas osm-map-canvas"
          aria-label="Ban do OpenStreetMap cua Viet Nam va node quan trac"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDragging}
          onPointerCancel={stopDragging}
          onWheel={(event) => { event.preventDefault(); const rect = event.currentTarget.getBoundingClientRect(); updateZoom(view.zoom + (event.deltaY < 0 ? 1 : -1), { x: event.clientX - rect.left, y: event.clientY - rect.top }); }}
        >
          <div className="osm-tile-layer" aria-hidden="true">{mapModel.tiles.map((tile) => <img key={`${tile.z}-${tile.x}-${tile.y}`} className="osm-tile" draggable={false} src={`https://tile.openstreetmap.org/${tile.z}/${tileUrlX(tile.x, tile.z)}/${tile.y}.png`} alt="" style={{ left: tile.left, top: tile.top }} />)}</div>
          <div className="map-controls" role="group" aria-label="Dieu khien ban do">
            <button type="button" title="Phong to" aria-label="Phong to" onPointerDown={(event) => event.stopPropagation()} onClick={() => updateZoom(view.zoom + 1)}><Plus size={18} /></button>
            <button type="button" title="Thu nho" aria-label="Thu nho" onPointerDown={(event) => event.stopPropagation()} onClick={() => updateZoom(view.zoom - 1)}><Minus size={18} /></button>
            <button type="button" title="Ve toan canh Viet Nam" aria-label="Ve toan canh Viet Nam" onPointerDown={(event) => event.stopPropagation()} onClick={() => setView({ center: VIETNAM_CENTER, zoom: INITIAL_ZOOM })}><RotateCcw size={17} /></button>
          </div>
          <div className="map-compass"><Navigation size={18} aria-hidden="true" /> OSM · z{view.zoom}</div>
          <div className="map-attribution">© OpenStreetMap contributors</div>
          {mapModel.devices.map((item) => {
            if (item.hasCoordinates && (item.x < -30 || item.x > mapSize.width + 30 || item.y < -30 || item.y > mapSize.height + 30)) return null;
            const isSelected = item.device.deviceId === selected?.device.deviceId;
            const isOffline = item.device.status === "offline";
            return <button type="button" key={item.device.deviceId} className={`map-marker ${isSelected ? "is-selected" : ""} ${isOffline ? "is-offline" : ""}`} style={{ left: item.x, top: item.y }} onPointerDown={(event) => event.stopPropagation()} onClick={() => setSelectedDeviceId(item.device.deviceId)} title={item.device.name}><RadioTower size={18} aria-hidden="true" /></button>;
          })}
        </div>
        <aside className="glass-card map-detail p-5">
          <div className="mb-4 flex items-center justify-between gap-3"><div><p className="eyebrow">Tong quan</p><h2 className="section-title">Trang thai node</h2></div><LocateFixed className="text-cyanCore" size={22} aria-hidden="true" /></div>
          <div className="summary-grid"><div><span>Dang online</span><strong>{onlineCount}</strong></div><div><span>Tong node</span><strong>{mapModel.devices.length}</strong></div></div>
          {selected ? <div className="map-selected"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-lg font-semibold">{selected.device.name}</h3><p className="text-subtle truncate text-xs">{selected.device.deviceId}</p></div><span className={`soft-badge rounded-lg px-3 py-1 text-xs ${selected.device.status === "offline" ? "text-rose-300" : "text-limeCore"}`}>{selected.device.status === "offline" ? "Offline" : "Online"}</span></div><p className="text-muted mt-3 text-sm">{selected.device.location}</p>{selected.reading ? <div className="map-reading-grid"><span><Activity size={14} />{selected.reading.temperature.toFixed(1)}°C</span><span>{selected.reading.humidity.toFixed(0)}% RH</span><span>AQI {selected.reading.airQuality.toFixed(0)}</span><span>{formatTime(selected.reading.timestamp)}</span></div> : <p className="text-subtle mt-3 text-sm">Chua co ban ghi moi.</p>}{selected.hasCoordinates && selected.reading ? <p className="text-subtle mt-3 text-xs">{selected.reading.latitude?.toFixed(6)}, {selected.reading.longitude?.toFixed(6)}</p> : <p className="text-subtle mt-3 text-xs">Node chua gui latitude/longitude, dang hien thi theo vi tri tam.</p>}</div> : null}
        </aside>
      </section>
    </div>
  );
}
