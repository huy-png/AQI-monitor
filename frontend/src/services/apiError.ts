import axios from "axios";
import { env } from "../config/env";

export function describeApiError(error: unknown, action: string): string {
  if (!axios.isAxiosError(error)) return `${action}. Vui lòng thử lại.`;
  if (error.response) {
    const status = error.response.status;
    if (status === 401 || status === 403) return `${action}: máy chủ từ chối truy cập (HTTP ${status}).`;
    return `${action}: máy chủ trả lỗi HTTP ${status}. Kiểm tra dịch vụ backend.`;
  }
  const tunnel = /^https?:\/\/(localhost|127\.0\.0\.1):3001(?:\/|$)/.test(env.apiUrl);
  const reason = error.code === "ECONNABORTED" ? "Máy chủ phản hồi quá thời gian chờ" : "Không kết nối được API";
  return `${action}. ${reason} tại ${env.apiUrl}.${tunnel ? " Mở kết nối máy chủ bằng npm run connect:server và giữ phiên SSH hoạt động." : " Kiểm tra kết nối mạng và địa chỉ API."}`;
}
