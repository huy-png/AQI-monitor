import { isModuleSource } from "../config/data-source";
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectConnection } from "@nestjs/mongoose";
import { Connection } from "mongoose";
import { createHash } from "node:crypto";
import { initializeApp, deleteApp, FirebaseApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getDatabase, goOffline, goOnline, onValue, ref, Unsubscribe } from "firebase/database";

interface ArchiveRow { _id: string; deviceId: string; fingerprint: string; timestamp: Date; receivedAt: Date; [key: string]: unknown }
const fields = ["temperature", "humidity", "pressure", "pm1", "pm25", "pm10", "latitude", "longitude", "so2", "co", "no2", "o3", "tsp"];
export function archivePayload(raw: Record<string, unknown>) {
  const values: Record<string, number | null> = {};
  for (const key of fields) {
    const value = raw[key];
    const valid = typeof value === "number" && Number.isFinite(value)
      && (key !== "humidity" || (value >= 0 && value <= 100))
      && (key !== "latitude" || Math.abs(value) <= 90)
      && (key !== "longitude" || Math.abs(value) <= 180)
      && (!/^(pm|so2|co|no2|o3|tsp)/.test(key) || value >= 0);
    values[key] = valid ? value as number : null;
  }
  return values;
}
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

@Injectable()
export class ArchiveService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ArchiveService.name);
  private app?: FirebaseApp;
  private unsubscribe?: Unsubscribe;
  private connectionUnsubscribe?: Unsubscribe;
  private timer?: ReturnType<typeof setTimeout>;
  private stopped = false;
  private pending = new Map<string, Record<string, unknown>>();
  private connected = false;
  private writes = Promise.resolve();
  private seen = new Map<string, string>();
  private lastSavedAt: string | null = null;
  private lastError: string | null = null;
  private lastSnapshotAt: string | null = null;
  private lastVerifiedAt: string | null = null;
  private verificationError: string | null = null;
  private nextVerification = 0;
  private snapshotRevision = 0;
  private recoveryCount = 0;

  constructor(@InjectConnection() private readonly connection: Connection, private readonly config: ConfigService) {}
  private get collection() { return this.connection.db!.collection<ArchiveRow>("firebase_readings"); }
  status() { return { connected: this.connected, pendingDevices: this.pending.size, lastSavedAt: this.lastSavedAt,
    lastSnapshotAt: this.lastSnapshotAt, lastVerifiedAt: this.lastVerifiedAt, recoveryCount: this.recoveryCount,
    error: this.lastError ?? this.verificationError }; }
  onModuleInit() {
    if (isModuleSource(this.config.get<string>("DATA_SOURCE"))) void this.tick();
  }
  private async connect() {
    this.app ??= initializeApp({ apiKey: this.config.get("FIREBASE_API_KEY"), databaseURL: this.config.get("FIREBASE_DATABASE_URL") }, "backend-archive");
    await signInWithEmailAndPassword(getAuth(this.app), this.config.get("FIREBASE_AUTH_EMAIL", ""), this.config.get("FIREBASE_AUTH_PASSWORD", ""));
    if (this.stopped) return;
    await this.collection.createIndex({ deviceId: 1, timestamp: -1, _id: -1 });
    await this.collection.createIndex({ deviceId: 1, receivedAt: -1, _id: -1 });
    this.connectionUnsubscribe?.();
    this.connectionUnsubscribe = onValue(ref(getDatabase(this.app), ".info/connected"), snapshot => { this.connected = snapshot.val() === true; });
    this.unsubscribe = onValue(ref(getDatabase(this.app), "devices"), snapshot => {
      this.snapshotRevision++;
      this.lastSnapshotAt = new Date().toISOString();
      this.acceptSnapshot(snapshot.val());
    }, () => {
      this.connected = false;
      this.lastError = "Không đọc được dữ liệu thiết bị; kiểm tra tài khoản và rules.";
      this.unsubscribe?.();
      this.unsubscribe = undefined;
    });
  }
  private acceptSnapshot(value: unknown): number {
    if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
    let changed = 0;
    for (const [deviceId, device] of Object.entries(value)) {
      if (!device || typeof device !== "object") continue;
      const latest = (device as { latest?: unknown }).latest;
      if (!latest || typeof latest !== "object" || Array.isArray(latest)) continue;
      const raw = latest as Record<string, unknown>;
      if (Object.values(archivePayload(raw)).every(v => v === null)) continue;
      const signature = hash([archivePayload(raw), raw.timestampIso ?? raw.timestamp ?? null]);
      if (this.seen.get(deviceId) === signature) continue;
      this.seen.set(deviceId, signature);
      this.enqueue(deviceId, raw);
      changed++;
    }
    return changed;
  }
  private async verifySource() {
    if (!this.app || Date.now() < this.nextVerification) return;
    this.nextVerification = Date.now() + 30000;
    const revision = this.snapshotRevision;
    let tokenTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      const user = getAuth(this.app).currentUser;
      if (!user) throw new Error("No Firebase session");
      const token = await Promise.race([
        user.getIdToken(),
        new Promise<never>((_, reject) => { tokenTimer = setTimeout(() => reject(new Error("Firebase token timeout")), 8000); })
      ]);
      clearTimeout(tokenTimer);
      if (this.stopped) return;
      const base = this.config.get<string>("FIREBASE_DATABASE_URL", "").replace(/\/$/, "");
      // REST bypasses the realtime SDK cache. Never log the authenticated URL.
      const response = await fetch(`${base}/devices.json?auth=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(8000), cache: "no-store" });
      if (!response.ok) throw new Error(`Firebase HTTP ${response.status}`);
      const snapshot: unknown = await response.json();
      if (this.stopped) return;
      this.lastVerifiedAt = new Date().toISOString();
      this.verificationError = null;
      // A realtime event during the request may already contain newer data.
      if (revision !== this.snapshotRevision) return;
      const recovered = this.acceptSnapshot(snapshot);
      if (recovered > 0) {
        this.recoveryCount++;
        this.logger.warn(`Firebase verification recovered changed readings for ${recovered} device(s); reconnecting realtime transport.`);
        goOffline(getDatabase(this.app));
        goOnline(getDatabase(this.app));
      }
    } catch {
      this.verificationError = "Không đối chiếu được dữ liệu Firebase; kiểm tra mạng và quyền đọc của bộ thu thập.";
      this.logger.warn(this.verificationError);
    } finally {
      clearTimeout(tokenTimer);
    }
  }
  private enqueue(deviceId: string, raw: Record<string, unknown>) {
    this.pending.set(deviceId, raw);
    this.writes = this.writes.then(async () => {
      await this.capture(deviceId, raw);
      if (this.pending.get(deviceId) === raw) this.pending.delete(deviceId);
      this.lastError = null;
    }).catch(() => { this.lastError = "Chưa lưu được lịch sử vào database; sẽ thử lại."; });
  }
  private async tick() {
    try {
      if (!this.unsubscribe) await this.connect();
      await this.verifySource();
      await this.writes;
      for (const [deviceId, raw] of this.pending) this.enqueue(deviceId, raw);
    } catch {
      this.lastError = "Chưa lưu được lịch sử; kiểm tra kết nối database và cấu hình Firebase backend.";
      this.logger.warn(this.lastError);
    } finally {
      if (!this.stopped) this.timer = setTimeout(() => void this.tick(), 2000);
    }
  }
  async capture(deviceId: string, raw: Record<string, unknown>) {
    const values = archivePayload(raw);
    if (Object.values(values).every(value => value === null)) return;
    const sourceTimestamp = raw.timestampIso ?? raw.timestamp;
    const fingerprint = hash([values, sourceTimestamp ?? null]);
    const previous = await this.collection.findOne({ deviceId }, { sort: { receivedAt: -1, _id: -1 } });
    if (previous?.fingerprint === fingerprint) return;
    const receivedAt = new Date();
    const parsed = typeof sourceTimestamp === "number" ? new Date(sourceTimestamp < 1e11 ? sourceTimestamp * 1000 : sourceTimestamp) : typeof sourceTimestamp === "string" ? new Date(sourceTimestamp) : null;
    const measured = parsed && Number.isFinite(parsed.getTime());
    const recordId = hash([deviceId, previous?._id ?? null, fingerprint]);
    await this.collection.updateOne({ _id: recordId }, { $setOnInsert: {
      deviceId, fingerprint, ...values, timestamp: measured ? parsed : receivedAt,
      receivedAt, timestampSource: measured ? "device" : "backend_received", source: "module"
    } }, { upsert: true });
    this.lastSavedAt = receivedAt.toISOString();
  }
  async dashboard() {
    const ids = await this.collection.distinct("deviceId");
    const rows = (await Promise.all(ids.map(deviceId => this.collection.findOne({ deviceId }, { sort: { receivedAt: -1, _id: -1 } })))).filter((row): row is ArchiveRow => row !== null);
    rows.sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());
    const readings = rows.map(row => ({ ...row, id: row._id, _id: undefined, fingerprint: undefined, timestamp: row.timestamp.toISOString(), receivedAt: row.receivedAt.toISOString() }));
    return {
      stationName: "Quan trắc môi trường", location: "Dữ liệu đã lưu trên máy chủ",
      latest: readings[0] ?? null,
      deviceReadings: Object.fromEntries(readings.map(row => [row.deviceId, row])),
      devices: rows.map(row => ({ deviceId: row.deviceId, name: row.deviceId, location: "", status: Date.now() - row.receivedAt.getTime() <= 15000 ? "online" : "offline", lastSeen: row.receivedAt.toISOString() })),
      history: [], alerts: [], connected: true, lastUpdated: readings[0]?.receivedAt ?? null
    };
  }
  async history(deviceId: string, query: { from?: string; to?: string; limit?: number; before?: string }) {
    const filter: Record<string, unknown> = { deviceId };
    const timestamp: Record<string, Date> = {};
    if (query.from) timestamp.$gte = new Date(query.from);
    if (query.to) timestamp.$lte = new Date(query.to);
    if (Object.keys(timestamp).length) filter.timestamp = timestamp;
    if (query.before) {
      const cursor = await this.collection.findOne({ _id: query.before, deviceId });
      if (!cursor) return [];
      filter.$or = [{ timestamp: { $lt: cursor.timestamp } }, { timestamp: cursor.timestamp, _id: { $lt: cursor._id } }];
    }
    const rows = await this.collection.find(filter).sort({ timestamp: -1, _id: -1 }).limit(query.limit ?? 1000).toArray();
    return rows.map(row => ({ ...row, id: row._id, timestamp: row.timestamp.toISOString(), receivedAt: row.receivedAt.toISOString(), fingerprint: undefined, _id: undefined }));
  }
  async onModuleDestroy() {
    this.stopped = true;
    clearTimeout(this.timer);
    this.unsubscribe?.();
    this.connectionUnsubscribe?.();
    await this.writes;
    if (this.app) await deleteApp(this.app);
  }
}
