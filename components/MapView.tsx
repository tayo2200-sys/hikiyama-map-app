"use client";

import React, { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L, { LatLngExpression, Marker as LMarker, DragEndEvent } from "leaflet";
import "leaflet/dist/leaflet.css";
import { getFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";

type FloatDoc = {
  id: string;
  name: string;
  lat?: number | null;
  lng?: number | null;
  speed?: number | null;
  heading?: number | null;
  angleDeg?: number | null;
  updatedAt?: number | null;
  battery?: number | null;
  device?: string | null;
};

function createShogiIcon(label: string, angleDeg: number = 0) {
  return L.divIcon({
    className: "custom-shogi-icon",
    html: `
      <div style="
        width:44px;
        height:50px;
        background:#f9e4b7;
        border:2px solid #000;
        clip-path: polygon(20% 0%, 80% 0%, 100% 25%, 100% 100%, 0% 100%, 0% 25%);
        display:flex;
        align-items:center;
        justify-content:center;
        transform: rotate(${angleDeg}deg);
      ">
        <div style="
          writing-mode: vertical-rl;
          text-orientation: upright;
          font-size:13px;
          font-weight:700;
          font-family:'Noto Sans JP', sans-serif;
          line-height:1;
          letter-spacing:1px;
          user-select:none;
          -webkit-user-select:none;
        ">${label}</div>
      </div>`
  });
}

function FlyTo({ center, zoom }: { center: { lat: number; lng: number }; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    map.flyTo([center.lat, center.lng], zoom, { duration: 0.7 });
  }, [map, center.lat, center.lng, zoom]);
  return null;
}

export default function MapView(props: {
  db: ReturnType<typeof getFirestore>;
  floats: Record<string, FloatDoc>;
  floatNames: string[];
  floatIds: string[];
  basemap: "osm" | "sat";
  center: { lat: number; lng: number };
  zoom: number;
  editMove: boolean;
  selectedId: string | null;
  setSelectedId: (id: string) => void;
  setCenter: (c: { lat: number; lng: number }) => void;
  setZoom: (z: number) => void;
  RotateEditor: React.ComponentType<{
    id: string;
    db: ReturnType<typeof getFirestore>;
    current?: number;
    fallbackHeading?: number;
  }>;
}) {
  const {
    db, floats, floatNames, floatIds, basemap, center, zoom, editMove,
    selectedId, setSelectedId, setCenter, setZoom, RotateEditor
  } = props;

  return (
    <MapContainer center={center} zoom={zoom} scrollWheelZoom className="h-full w-full z-0">
      <FlyTo center={center} zoom={zoom} />

      {basemap === "osm" ? (
        <TileLayer attribution="&copy; OSM" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      ) : (
        <TileLayer
          attribution="&copy; Imagery providers"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />
      )}

      {floatIds.map((id, idx) => {
        const f = floats[id];
        if (f?.lat == null || f?.lng == null) return null;

        const angle = f?.angleDeg ?? (Number.isFinite(f?.heading) ? (f!.heading as number) : 0);
        const pos: LatLngExpression = [f.lat, f.lng];

        const onClickMarker = () => {
          setSelectedId(id);
          setCenter({ lat: f.lat!, lng: f.lng! });
          setZoom(17);
        };

        const onDragEnd = async (e: DragEndEvent) => {
          if (!(editMove && selectedId === id)) return;
          const marker = e.target as LMarker;
          const ll = marker.getLatLng();
          await setDoc(
            doc(db, "floats", id),
            { lat: ll.lat, lng: ll.lng, updatedAt: serverTimestamp() },
            { merge: true }
          );
        };

        return (
          <Marker
            key={id}
            position={pos}
            icon={createShogiIcon(floatNames[idx], angle)}
            draggable={editMove && selectedId === id}
            eventHandlers={{ click: onClickMarker, dragend: onDragEnd }}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-semibold mb-1">{f.name}</div>
                <RotateEditor id={id} db={db} current={f.angleDeg ?? undefined} fallbackHeading={f.heading ?? undefined} />
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
