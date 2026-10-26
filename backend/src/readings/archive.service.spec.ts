import { ConfigService } from "@nestjs/config";
import { Connection } from "mongoose";
import { ArchiveService, archivePayload } from "./archive.service";
import { getAuth } from "firebase/auth";
import { goOffline, goOnline } from "firebase/database";
import type { FirebaseApp } from "firebase/app";

jest.mock("firebase/auth", () => ({ getAuth: jest.fn(), signInWithEmailAndPassword: jest.fn() }));
jest.mock("firebase/database", () => ({ getDatabase: jest.fn(() => ({})), goOffline: jest.fn(), goOnline: jest.fn(), onValue: jest.fn(), ref: jest.fn() }));

describe("Firebase history archive", () => {
  it("loads archived devices including inactive ones without requiring a Firebase connection", async () => {
    const row = { _id: "saved", deviceId: "esp32-archived", receivedAt: new Date("2020-01-01"), timestamp: new Date("2020-01-01"), temperature: 27, humidity: null, fingerprint: "private" };
    const collection = { distinct: jest.fn(async () => [row.deviceId]), findOne: jest.fn(async () => row) };
    const service = new ArchiveService({ db: { collection: () => collection } } as unknown as Connection, new ConfigService());
    const result = await service.dashboard();
    expect(result.devices[0]).toMatchObject({ deviceId: row.deviceId, status: "offline" });
    expect(result.latest).toMatchObject({ temperature: 27, humidity: null, timestamp: "2020-01-01T00:00:00.000Z" });
    expect(result.latest?.fingerprint).toBeUndefined();
    expect(result.connected).toBe(true);
  });
  it("returns an empty dashboard for a database with no readings", async () => {
    const service = new ArchiveService({ db: { collection: () => ({ distinct: async () => [] }) } } as unknown as Connection, new ConfigService());
    expect(await service.dashboard()).toMatchObject({ latest: null, devices: [], deviceReadings: {}, lastUpdated: null });
  });
  function setup() {
    let previous: Record<string, unknown> | null = null;
    const collection = {
      findOne: jest.fn(async () => previous),
      updateOne: jest.fn(async (filter, update) => { previous = { ...filter, ...update.$setOnInsert }; })
    };
    const connection = { db: { collection: () => collection } } as unknown as Connection;
    const service = new ArchiveService(connection, new ConfigService());
    return { service, collection, connection };
  }
  it("keeps missing/invalid fields null instead of inventing zero readings", () => {
    expect(archivePayload({ temperature: -5, humidity: 101, pm25: -1, latitude: 91, pressure: "1000" })).toMatchObject({ temperature: -5, humidity: null, pm25: null, latitude: null, pressure: null });
    expect(archivePayload({ humidity: 0, pm25: 0 })).toMatchObject({ humidity: 0, pm25: 0 });
  });
  it("deduplicates initial snapshots after restart, but saves changed values and later returns to old values", async () => {
    const { service, collection, connection } = setup();
    await service.capture("esp32-test", { pm25: 10 });
    const restarted = new ArchiveService(connection, new ConfigService());
    await restarted.capture("esp32-test", { pm25: 10 });
    expect(collection.updateOne).toHaveBeenCalledTimes(1);
    await restarted.capture("esp32-test", { pm25: 11 });
    await restarted.capture("esp32-test", { pm25: 10 });
    expect(collection.updateOne).toHaveBeenCalledTimes(3);
    const ids = collection.updateOne.mock.calls.map(call => call[0]._id);
    expect(new Set(ids).size).toBe(3);
  });
  it("labels receive time explicitly and preserves valid device timestamps", async () => {
    const { service, collection } = setup();
    await service.capture("esp32-test", { temperature: 25 });
    expect(collection.updateOne.mock.calls[0][1].$setOnInsert.timestampSource).toBe("backend_received");
    await service.capture("esp32-test", { temperature: 25, timestamp: 1700000000 });
    expect(collection.updateOne.mock.calls[1][1].$setOnInsert).toMatchObject({ timestampSource: "device", timestamp: new Date(1700000000000), humidity: null });
  });
  it("does not write empty sensor payloads, and propagates DB failures for retry", async () => {
    const { service, collection } = setup();
    await service.capture("esp32-test", {});
    expect(collection.updateOne).not.toHaveBeenCalled();
    collection.updateOne.mockRejectedValueOnce(new Error("offline"));
    await expect(service.capture("esp32-test", { pm10: 10 })).rejects.toThrow("offline");
  });
  function setupVerification() {
    const state = setup();
    state.service["app"] = {} as FirebaseApp;
    jest.mocked(getAuth).mockReturnValue({ currentUser: { getIdToken: async () => "test-token" } } as unknown as ReturnType<typeof getAuth>);
    jest.mocked(goOffline).mockClear();
    jest.mocked(goOnline).mockClear();
    return state;
  }
  it("recovers a missed realtime update via REST and reconnects without duplicating unchanged readings", async () => {
    const { service, collection } = setupVerification();
    service["acceptSnapshot"]({ station: { latest: { pm25: 10 } } });
    await service["writes"];
    const request = jest.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, json: async () => ({ station: { latest: { pm25: 20 } } }) } as Response);
    try {
      await service["verifySource"]();
      await service["writes"];
      expect(collection.updateOne).toHaveBeenCalledTimes(2);
      expect(service.status()).toMatchObject({ recoveryCount: 1, error: null });
      expect(service.status().lastVerifiedAt).not.toBeNull();
      expect(goOffline).toHaveBeenCalledTimes(1);
      expect(goOnline).toHaveBeenCalledTimes(1);
      await service["verifySource"]();
      expect(request).toHaveBeenCalledTimes(1);
      service["nextVerification"] = 0;
      await service["verifySource"]();
      await service["writes"];
      expect(collection.updateOne).toHaveBeenCalledTimes(2);
      expect(goOnline).toHaveBeenCalledTimes(1);
    } finally { request.mockRestore(); }
  });
  it("does not overwrite a newer realtime snapshot with an older REST response", async () => {
    const { service, collection } = setupVerification();
    const request = jest.spyOn(globalThis, "fetch").mockImplementation(async () => {
      service["snapshotRevision"]++;
      service["acceptSnapshot"]({ station: { latest: { pm25: 30 } } });
      return { ok: true, json: async () => ({ station: { latest: { pm25: 20 } } }) } as Response;
    });
    try {
      await service["verifySource"]();
      await service["writes"];
      expect(collection.updateOne).toHaveBeenCalledTimes(1);
      expect(collection.updateOne.mock.calls[0][1].$setOnInsert.pm25).toBe(30);
      expect(goOnline).not.toHaveBeenCalled();
    } finally { request.mockRestore(); }
  });
  it("reports verification failures even if a realtime database write succeeds", async () => {
    const { service } = setupVerification();
    const request = jest.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, status: 401 } as Response);
    try {
      await service["verifySource"]();
      service["acceptSnapshot"]({ station: { latest: { pm25: 30 } } });
      await service["writes"];
      expect(service.status().error).toContain("Không đối chiếu");
      expect(service.status().lastVerifiedAt).toBeNull();
      expect(goOnline).not.toHaveBeenCalled();
    } finally { request.mockRestore(); }
  });
});
