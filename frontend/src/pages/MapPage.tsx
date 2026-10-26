import { usePageState } from "../hooks/usePageState";
import {
  LocateFixed,
  Minus,
  Navigation,
  Plus,
  RadioTower,
  RotateCcw,
} from "lucide-react";
import type { ClimateReading, Device } from "@climasense/shared";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
  type PointerEvent,
} from "react";
import { useDashboardData } from "../hooks/useDashboardData";
import { formatTime } from "../utils/format";
import {
  concentrationUnit,
  formatConcentration,
  pollutants,
  pollutantValue,
} from "../config/pollutants";

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
  return (
    Number.isFinite(reading?.latitude) && Number.isFinite(reading?.longitude)
    && Math.abs(reading?.latitude as number) <= 90 && Math.abs(reading?.longitude as number) <= 180
  );
}

function clampLatitude(latitude: number) {
  return Math.min(85.0511, Math.max(-85.0511, latitude));
}

function wrapLongitude(longitude: number) {
  return ((((longitude + 180) % 360) + 360) % 360) - 180;
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
  const radians = (clampLatitude(latitude) * Math.PI) / 180;
  return (
    ((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) *
    worldSize(zoom)
  );
}

function worldToCoordinates(x: number, y: number, zoom: number) {
  const size = worldSize(zoom);
  const wrappedX = ((x % size) + size) % size;
  const longitude = (wrappedX / size) * 360 - 180;
  const mercator = Math.PI * (1 - 2 * Math.min(1, Math.max(0, y / size)));
  const latitude = (180 / Math.PI) * Math.atan(Math.sinh(mercator));
  return { latitude: clampLatitude(latitude), longitude };
}

function tileUrlX(x: number, zoom: number) {
  const count = 2 ** zoom;
  return ((x % count) + count) % count;
}

function buildMap(
  devices: Device[],
  readings: Record<string, ClimateReading>,
  view: MapView,
  size: typeof DEFAULT_SIZE,
) {
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
        top: y * TILE_SIZE - (centerY - size.height / 2),
      });
    }
  }

  const mappedDevices = devices.map<MapDevice>((device, index) => {
    const reading = readings[device.deviceId];
    if (!hasCoordinates(reading)) {
      const fallback = fallbackPosition(index, devices.length);
      return {
        device,
        reading,
        x: (fallback.x / 100) * size.width,
        y: (fallback.y / 100) * size.height,
        hasCoordinates: false,
      };
    }

    let pointX = lonToWorldX(reading.longitude as number, view.zoom);
    const pointY = latToWorldY(reading.latitude as number, view.zoom);
    const sizeAtZoom = worldSize(view.zoom);
    if (pointX - centerX > sizeAtZoom / 2) pointX -= sizeAtZoom;
    if (centerX - pointX > sizeAtZoom / 2) pointX += sizeAtZoom;
    return {
      device,
      reading,
      x: size.width / 2 + pointX - centerX,
      y: size.height / 2 + pointY - centerY,
      hasCoordinates: true,
    };
  });

  return { tiles, devices: mappedDevices };
}

export function MapPage() {
  const { data, isLoading, error } = useDashboardData("24h");
  const canvasRef = useRef<ComponentRef<"div">>(null);
  const dragRef = useRef<DragState | null>(null);
  const [mapSize, setMapSize] = useState(DEFAULT_SIZE);
  const [view, setView] = useState<MapView>({
    center: VIETNAM_CENTER,
    zoom: INITIAL_ZOOM,
  });
  const [selectedDeviceId, setSelectedDeviceId] = usePageState("device", "");
  const [query, setQuery] = usePageState("map-search", "");
  const [tileSource, setTileSource] = useState<"osm" | "esri">("osm");
  const [tileAttempt, setTileAttempt] = useState(0);
  const [failedTiles, setFailedTiles] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return undefined;
    const updateSize = () =>
      setMapSize({ width: element.clientWidth, height: element.clientHeight });
    updateSize();
    const observer = new window.ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const mapModel = useMemo(
    () =>
      buildMap(data?.devices ?? [], data?.deviceReadings ?? {}, view, mapSize),
    [data?.devices, data?.deviceReadings, mapSize, view],
  );
  const selected =
    mapModel.devices.find(
      (item) => item.device.deviceId === selectedDeviceId,
    ) ?? mapModel.devices[0];
  const tileKey = (tile: TileInfo) => `${tileSource}-${tileAttempt}-${tile.z}-${tile.x}-${tile.y}`;
  const hasTileErrors = mapModel.tiles.some(tile => failedTiles[tileKey(tile)]);
  const retryTiles = () => {
    setFailedTiles({});
    setTileAttempt(attempt => attempt + 1);
    setTileSource("osm");
  };
  const onlineCount = mapModel.devices.filter(
    (item) => item.device.status !== "offline",
  ).length;
  const coordinateCount = mapModel.devices.filter(
    (item) => item.hasCoordinates,
  ).length;

  const updateZoom = (
    nextZoom: number,
    focalPoint?: { x: number; y: number },
  ) => {
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
    if (zoom === view.zoom) return;
    setView((current) => {
      if (!focalPoint) return { ...current, zoom };
      const currentCenterX = lonToWorldX(
        current.center.longitude,
        current.zoom,
      );
      const currentCenterY = latToWorldY(current.center.latitude, current.zoom);
      const scale = 2 ** (zoom - current.zoom);
      const nextCenterX =
        currentCenterX * scale +
        (focalPoint.x - mapSize.width / 2) * (scale - 1);
      const nextCenterY =
        currentCenterY * scale +
        (focalPoint.y - mapSize.height / 2) * (scale - 1);
      return {
        center: worldToCoordinates(nextCenterX, nextCenterY, zoom),
        zoom,
      };
    });
  };

  const handlePointerDown = (event: PointerEvent<ComponentRef<"div">>) => {
    if (event.button !== 0) return;
    const centerX = lonToWorldX(view.center.longitude, view.zoom);
    const centerY = latToWorldY(view.center.latitude, view.zoom);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      centerX,
      centerY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<ComponentRef<"div">>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setView((current) => ({
      ...current,
      center: worldToCoordinates(
        drag.centerX - (event.clientX - drag.startX),
        drag.centerY - (event.clientY - drag.startY),
        current.zoom,
      ),
    }));
  };

  const stopDragging = (event: PointerEvent<ComponentRef<"div">>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  return (
    <div className="monitor-dashboard monitor-subpage map-workspace">
      <header className="page-heading">
        <div>
          <p className="eyebrow">{tileSource === "osm" ? "OpenStreetMap" : "Esri World Street Map"}</p>
          <h1 className="page-title">Bản đồ trạm quan trắc</h1>
        </div>
        <span className="data-badge">
          {coordinateCount}/{mapModel.devices.length} có tọa độ
        </span>
      </header>
      <section className="map-layout">
        <div
          ref={canvasRef}
          className="map-canvas osm-map-canvas"
          aria-label="Bản đồ Việt Nam và trạm quan trắc"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDragging}
          onPointerCancel={stopDragging}
          onWheel={(event) => {
            event.preventDefault();
            const rect = event.currentTarget.getBoundingClientRect();
            updateZoom(view.zoom + (event.deltaY < 0 ? 1 : -1), {
              x: event.clientX - rect.left,
              y: event.clientY - rect.top,
            });
          }}
        >
          <div className="osm-tile-layer" aria-hidden="true">
            {mapModel.tiles.map((tile) => (
              <img
                key={tileKey(tile)}
                className="osm-tile"
                draggable={false}
                src={tileSource === "osm"
                  ? `https://tile.openstreetmap.org/${tile.z}/${tileUrlX(tile.x, tile.z)}/${tile.y}.png`
                  : `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${tile.z}/${tile.y}/${tileUrlX(tile.x, tile.z)}`}
                referrerPolicy="strict-origin-when-cross-origin"
                onError={() => {
                  if (tileSource === "osm") setTileSource("esri");
                  else setFailedTiles(current => ({ ...current, [tileKey(tile)]: true }));
                }}
                alt=""
                style={{ left: tile.left, top: tile.top, visibility: failedTiles[tileKey(tile)] ? "hidden" : "visible" }}
              />
            ))}
          </div>
          {(tileSource === "esri" || hasTileErrors) && <div className="map-source-notice" role="status" onPointerDown={event => event.stopPropagation()} onWheel={event => event.stopPropagation()}>
            <span>{hasTileErrors ? "Chưa tải được một số ô bản đồ. Kiểm tra kết nối Internet." : "Đang dùng bản đồ dự phòng vì nguồn chính tải lỗi."}</span>
            <button type="button" onClick={retryTiles}>Thử lại</button>
          </div>}
          <div
            className="map-controls"
            role="group"
            aria-label="Điều khiển bản đồ"
          >
            <button
              type="button"
              title="Phóng to"
              aria-label="Phóng to"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => updateZoom(view.zoom + 1)}
            >
              <Plus size={18} />
            </button>
            <button
              type="button"
              title="Thu nhỏ"
              aria-label="Thu nhỏ"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => updateZoom(view.zoom - 1)}
            >
              <Minus size={18} />
            </button>
            <button
              type="button"
              title="Về toàn cảnh Việt Nam"
              aria-label="Về toàn cảnh Việt Nam"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() =>
                setView({ center: VIETNAM_CENTER, zoom: INITIAL_ZOOM })
              }
            >
              <RotateCcw size={17} />
            </button>
          </div>
          <div className="map-compass">
            <Navigation size={18} aria-hidden="true" /> {tileSource === "osm" ? "OSM" : "Esri"} · z{view.zoom}
          </div>
          <div className="map-attribution" onPointerDown={event => event.stopPropagation()}>
            {tileSource === "osm" ? <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
              : <a href="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer" target="_blank" rel="noreferrer">Sources: Esri, HERE, Garmin, USGS, Intermap, INCREMENT P, NRCan, Esri Japan, METI, Esri China (Hong Kong), Esri Korea, Esri (Thailand), NGCC, © OpenStreetMap contributors, GIS User Community</a>}
          </div>
          {mapModel.devices.map((item) => {
            if (!item.hasCoordinates) return null;
            if (
              item.hasCoordinates &&
              (item.x < -30 ||
                item.x > mapSize.width + 30 ||
                item.y < -30 ||
                item.y > mapSize.height + 30)
            )
              return null;
            const isSelected =
              item.device.deviceId === selected?.device.deviceId;
            const isOffline = item.device.status === "offline";
            return (
              <button
                type="button"
                key={item.device.deviceId}
                className={`map-marker ${isSelected ? "is-selected" : ""} ${isOffline ? "is-offline" : ""}`}
                style={{ left: item.x, top: item.y }}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => setSelectedDeviceId(item.device.deviceId)}
                title={item.device.deviceId}
              >
                <RadioTower size={18} aria-hidden="true" />
              </button>
            );
          })}
        </div>
        <aside className="map-detail p-5" aria-label="Thiết bị trên bản đồ">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Mạng lưới trạm</p>
              <h2 className="section-title">Thiết bị</h2>
            </div>
            <LocateFixed
              className="text-cyanCore"
              size={22}
              aria-hidden="true"
            />
          </div>
          <div className="summary-grid">
            <div>
              <span>Đang kết nối</span>
              <strong>{onlineCount}</strong>
            </div>
            <div>
              <span>Tổng thiết bị</span>
              <strong>{mapModel.devices.length}</strong>
            </div>
          </div>
          {isLoading && <p role="status" className="text-muted text-sm">Đang tải thiết bị…</p>}
          {error && <p role="alert" className="monitor-notice">{error}</p>}
          <label className="map-device-search">
            <span>Tìm thiết bị</span>
            <input type="search" placeholder="Tên hoặc mã thiết bị" value={query} onChange={event => setQuery(event.target.value)} />
          </label>
          <div className="map-device-list" aria-label="Danh sách thiết bị">
            {mapModel.devices.filter(item => `${item.device.name} ${item.device.deviceId}`.toLowerCase().includes(query.toLowerCase())).map(item => (
              <button type="button" key={item.device.deviceId}
                className={`map-device-option ${selected?.device.deviceId === item.device.deviceId ? "is-selected" : ""}`}
                aria-pressed={selected?.device.deviceId === item.device.deviceId}
                onClick={() => {
                  setSelectedDeviceId(item.device.deviceId);
                  if (item.hasCoordinates && item.reading) setView({ center: { latitude: item.reading.latitude as number, longitude: item.reading.longitude as number }, zoom: 14 });
                }}>
                <RadioTower size={18} aria-hidden="true" />
                <span><strong>{item.device.name}</strong><small>{item.device.deviceId}</small><small>{item.hasCoordinates ? "Xem vị trí trên bản đồ" : "Chưa có tọa độ"}</small></span>
              </button>
            ))}
            {!isLoading && !mapModel.devices.some(item => `${item.device.name} ${item.device.deviceId}`.toLowerCase().includes(query.toLowerCase())) && <p className="text-muted text-sm">Không có thiết bị phù hợp.</p>}
          </div>
          {selected ? (
            <div className="map-selected">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-semibold">
                    {selected.device.name}
                  </h3>
                  <p className="text-subtle truncate text-xs">
                    {selected.device.deviceId}
                  </p>
                </div>
                <span
                  className={`soft-badge rounded-lg px-3 py-1 text-xs ${selected.device.status === "offline" ? "text-rose-300" : "text-limeCore"}`}
                >
                  {selected.device.status === "offline" ? "Offline" : "Online"}
                </span>
              </div>
              <p className="text-muted mt-3 text-sm">
                {selected.device.location}
              </p>
              {selected.reading ? (
                <div className="map-reading-grid">
                  {pollutants.map((item) => (
                    <span key={item.key}>
                      {item.symbol}:{" "}
                      {formatConcentration(
                        pollutantValue(selected.reading, item.key),
                      )}{" "}
                      {concentrationUnit}
                    </span>
                  ))}
                  <span>{formatTime(selected.reading.timestamp)}</span>
                </div>
              ) : (
                <p className="text-subtle mt-3 text-sm">Chưa có bản ghi mới.</p>
              )}
              {selected.hasCoordinates && selected.reading ? (
                <p className="text-subtle mt-3 text-xs">
                  {selected.reading.latitude?.toFixed(6)},{" "}
                  {selected.reading.longitude?.toFixed(6)}
                </p>
              ) : (
                <p className="text-subtle mt-3 text-xs">
                  Thiết bị chưa có tọa độ hợp lệ nên chưa hiển thị trên bản đồ.
                </p>
              )}
            </div>
          ) : null}
        </aside>
      </section>
    </div>
  );
}
