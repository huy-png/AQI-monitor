export const env = {
  apiUrl: import.meta.env.VITE_API_URL ?? "http://localhost:3000/api",
  socketUrl: import.meta.env.VITE_SOCKET_URL ?? "http://localhost:3000",
  dataSource: (import.meta.env.VITE_DATA_SOURCE ?? "mock") as "mock" | "api" | "firebase",
  firebase: {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "",
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL ?? "",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "",
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? ""
  },
  firebaseAuth: {
    email: import.meta.env.VITE_FIREBASE_AUTH_EMAIL ?? "",
    password: import.meta.env.VITE_FIREBASE_AUTH_PASSWORD ?? ""
  },
  firebasePaths: {
    deviceId: import.meta.env.VITE_FIREBASE_DEVICE_ID ?? "esp32-587B04D9B4DC",
    deviceIds: (import.meta.env.VITE_FIREBASE_DEVICE_IDS ?? import.meta.env.VITE_FIREBASE_DEVICE_ID ?? "esp32-587B04D9B4DC").split(",").map((value: string) => value.trim()).filter(Boolean),
    latest: import.meta.env.VITE_FIREBASE_LATEST_PATH ?? "readings/esp32-garden-01/latest",
    history: import.meta.env.VITE_FIREBASE_HISTORY_PATH ?? "readings/esp32-garden-01/history",
    devices: import.meta.env.VITE_FIREBASE_DEVICES_PATH ?? "devices",
    alerts: import.meta.env.VITE_FIREBASE_ALERTS_PATH ?? "alerts"
  }
};
