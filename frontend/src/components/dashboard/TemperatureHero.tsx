import { Thermometer } from "lucide-react";
import type { ClimateReading } from "@climasense/shared";

interface TemperatureHeroProps {
  latest: ClimateReading;
  min: number;
  max: number;
}

export function TemperatureHero({ latest, min, max }: TemperatureHeroProps) {
  return (
    <section className="temperature-hero relative min-h-[28rem] overflow-hidden rounded-lg p-6">
      <div className="absolute inset-0 opacity-80">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,17,31,0.38),rgba(7,17,31,0.92)),url('https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_22%,rgba(25,199,243,0.20),transparent_28rem)]" />
      </div>
      <div className="relative z-10 flex h-full flex-col justify-between">
        <div>
          <p className="text-xl font-semibold text-slate-100">Nhiệt độ</p>
          <div className="mt-6 flex items-end gap-4">
            <span className="text-[clamp(5rem,14vw,9rem)] font-bold leading-none text-white drop-shadow-[0_0_24px_rgba(25,199,243,0.65)]">
              {latest.temperature.toFixed(1)}
            </span>
            <span className="pb-5 text-5xl font-bold text-white">°C</span>
          </div>
        </div>
        <div className="grid gap-4 border-t border-white/18 pt-6 sm:grid-cols-2">
          <div className="flex items-center gap-4">
            <Thermometer className="text-cyanCore" size={34} aria-hidden="true" />
            <div>
              <p className="text-sm text-slate-300">Thấp nhất</p>
              <p className="text-2xl font-semibold text-white">{min.toFixed(1)}°C</p>
            </div>
          </div>
          <div className="flex items-center gap-4 sm:border-l sm:border-white/20 sm:pl-8">
            <Thermometer className="text-cyanCore" size={34} aria-hidden="true" />
            <div>
              <p className="text-sm text-slate-300">Cao nhất</p>
              <p className="text-2xl font-semibold text-white">{max.toFixed(1)}°C</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
