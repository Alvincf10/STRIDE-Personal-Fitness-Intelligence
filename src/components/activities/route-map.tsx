"use client";

import { useEffect, useId, useRef } from "react";
import type { Map as LeafletMap, Polyline } from "leaflet";
import "leaflet/dist/leaflet.css";

type Point = { lat: number; lon: number };

function boundsPadding(points: Point[]) {
  if (points.length === 1) {
    return {
      south: points[0].lat - 0.01,
      west: points[0].lon - 0.01,
      north: points[0].lat + 0.01,
      east: points[0].lon + 0.01,
    };
  }
  let south = points[0].lat;
  let north = points[0].lat;
  let west = points[0].lon;
  let east = points[0].lon;
  for (const p of points) {
    south = Math.min(south, p.lat);
    north = Math.max(north, p.lat);
    west = Math.min(west, p.lon);
    east = Math.max(east, p.lon);
  }
  return { south, west, north, east };
}

export function RouteMap({
  points,
  source,
}: {
  points: Point[];
  source?: string;
}) {
  const mapId = useId().replace(/:/g, "");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const lineRef = useRef<Polyline | null>(null);

  useEffect(() => {
    if (!containerRef.current || points.length === 0) return;
    let cancelled = false;

    async function mount() {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;

      if (!mapRef.current) {
        const map = L.map(containerRef.current, {
          scrollWheelZoom: false,
          attributionControl: true,
        });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);
        mapRef.current = map;
      }

      const map = mapRef.current;
      if (lineRef.current) {
        map.removeLayer(lineRef.current);
        lineRef.current = null;
      }
      map.eachLayer((layer) => {
        // Keep tile layer; drop previous markers by checking CircleMarker.
        if (layer instanceof L.CircleMarker) map.removeLayer(layer);
      });

      const latLngs = points.map((p) => L.latLng(p.lat, p.lon));
      const dashed = source === "start_end";
      const line = L.polyline(latLngs, {
        color: "#B8FF3C",
        weight: points.length > 2 ? 4 : 3,
        opacity: 0.95,
        dashArray: dashed ? "8 8" : undefined,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);
      lineRef.current = line;

      L.circleMarker(latLngs[0], {
        radius: 7,
        color: "#07140F",
        weight: 2,
        fillColor: "#3D8F6A",
        fillOpacity: 1,
      })
        .bindTooltip("Start", { direction: "top" })
        .addTo(map);

      L.circleMarker(latLngs[latLngs.length - 1], {
        radius: 7,
        color: "#07140F",
        weight: 2,
        fillColor: "#B8FF3C",
        fillOpacity: 1,
      })
        .bindTooltip("Finish", { direction: "top" })
        .addTo(map);

      const b = boundsPadding(points);
      map.fitBounds(
        [
          [b.south, b.west],
          [b.north, b.east],
        ],
        { padding: [28, 28], maxZoom: 16 }
      );

      // Leaflet sometimes needs a kick after layout.
      requestAnimationFrame(() => map.invalidateSize());
    }

    void mount();
    return () => {
      cancelled = true;
    };
  }, [points, source]);

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        lineRef.current = null;
      }
    };
  }, []);

  if (!points.length) {
    return (
      <p className="text-sm text-[var(--muted)]">
        GPS route unavailable for this activity.
      </p>
    );
  }

  return (
    <div>
      <div
        id={`route-map-${mapId}`}
        ref={containerRef}
        className="h-72 w-full overflow-hidden rounded-[1rem] border border-[var(--border)] sm:h-96"
        role="img"
        aria-label="Activity route on OpenStreetMap"
      />
      <p className="mt-2 text-xs text-[var(--muted)]">
        {source === "start_end"
          ? "Start → end on OpenStreetMap (full track not in summary payload)."
          : source === "garmin_track"
            ? `OpenStreetMap · full track · ${points.length} points`
            : `OpenStreetMap · ${points.length} point(s)`}
      </p>
    </div>
  );
}
