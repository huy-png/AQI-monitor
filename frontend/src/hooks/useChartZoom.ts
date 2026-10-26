import { useEffect, useState } from "react";
import { zoomWindow, type TimeWindow } from "../utils/analysisTrend";

export function useChartZoom(start?: number, end?: number) {
  const [element, setElement] = useState<globalThis.HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState<{ start: number; end: number; window: TimeWindow } | null>(null);
  const window = start !== undefined && end !== undefined
    ? zoom?.start === start && zoom.end === end ? zoom.window : [start, end] as TimeWindow
    : null;
  function adjust(factor: number) {
    if (start === undefined || end === undefined) return;
    setZoom(previous => ({ start, end, window: zoomWindow(previous?.start === start && previous.end === end ? previous.window : [start, end], [start, end], factor) }));
  }
  useEffect(() => {
    if (!element || start === undefined || end === undefined) return;
    const handleWheel = (event: globalThis.WheelEvent) => {
      if (event.ctrlKey || !event.deltaY) return;
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      // Match the chart's 60px Y axis and 15px right margin.
      const anchor = Math.max(0, Math.min(1, (event.clientX - rect.left - 60) / Math.max(1, rect.width - 75)));
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1);
      setZoom(previous => ({ start, end, window: zoomWindow(previous?.start === start && previous.end === end ? previous.window : [start, end], [start, end], Math.exp(Math.max(-1, Math.min(1, delta * 0.002))), anchor) }));
    };
    element.addEventListener("wheel", handleWheel, { passive: false });
    return () => element.removeEventListener("wheel", handleWheel);
  }, [element, start, end]);
  return { window, ref: setElement, adjust, reset: () => setZoom(null) };
}
