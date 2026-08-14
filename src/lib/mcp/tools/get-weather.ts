import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "get_weather_forecast",
  title: "Get weather forecast",
  description: "Current conditions plus a multi-day forecast (high/low, precipitation chance) for a latitude/longitude.",
  inputSchema: {
    lat: z.number().describe("Latitude."),
    lng: z.number().describe("Longitude."),
    days: z.number().optional().describe("Forecast days, 1-7. Defaults to 7."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ lat, lng, days }) => {
    const span = Math.min(Math.max(Math.round(days ?? 7), 1), 7);
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&current=temperature_2m,weather_code,wind_speed_10m` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code` +
      `&forecast_days=${span}&timezone=auto&temperature_unit=fahrenheit`;
    const res = await fetch(url);
    if (!res.ok) throw new ToolError(`Weather lookup failed (${res.status})`);
    const j = (await res.json()) as any;

    const daily = (j.daily?.time ?? []).map((date: string, i: number) => ({
      date,
      highF: j.daily.temperature_2m_max?.[i] ?? null,
      lowF: j.daily.temperature_2m_min?.[i] ?? null,
      precipChance: j.daily.precipitation_probability_max?.[i] ?? null,
    }));
    const current = {
      temperatureF: j.current?.temperature_2m ?? null,
      windMph: j.current?.wind_speed_10m ?? null,
    };

    const text = [
      `Now: ${current.temperatureF ?? "?"}°F, wind ${current.windMph ?? "?"} mph`,
      ...daily.map(
        (d: any) => `${d.date}: ${d.lowF ?? "?"}–${d.highF ?? "?"}°F, precip ${d.precipChance ?? 0}%`,
      ),
    ].join("\n");

    return { content: [{ type: "text", text }], structuredContent: { current, daily } };
  },
});
