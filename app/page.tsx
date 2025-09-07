"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { MapPin, Satellite, RefreshCcw, Play, Square } from "lucide-react";
import dynamic from "next/dynamic";

import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";

const MapView = dynamic(() => import("../components/MapView"), { ssr: false });

const firebaseConfig = {
  apiKey: "AIzaSyCKHQoavsNA68ge4g6FfaT92H3p4184VHk",
  authDomain: "hikiyama-map.firebaseapp.com",
  projectId: "hikiyama-map",
  storageBucket: "hikiyama-map.firebasestorage.app",
  messagingSenderId: "542550449015",
  appId: "1:542550449015:web:cfdce8580620d4434b1f72",
  measurementId: "G-00WFHBG1F4"
};

function useFirebase() {
  const app = useMemo(() => (getApps().length ? getApps()[0] : initializeApp(firebaseConfig)), []);
  const db = useMemo(() => getFirestore(app), [app]);
  return { db };
}

const KAKUNODATE_CENTER = { lat: 39.5932, lng: 140.5639 };
const DEFAULT_ZOOM = 15;

const FLOAT_IDS = Array.from({ length: 18 }, (_, i) => `yama${String(i + 1).padStart(2, "0")}`);
const FLOAT_NAMES: string[] = [
  "岩瀬","西部","駅前","菅沢","本町","駅通り","西勝楽","桜美町","七日町","中央","横町","山根","北部","上新町","下岩瀬","東部","大塚","川原町"
];

function BasemapToggle({ type, onToggle }: { type: "osm" | "sat"; onToggle: () => void }) {
  return (
    <Button variant="outline" className="gap-2" onClick={onToggle}>
      {type === "osm" ? <Satellite className="h-4 w-4" /> : <MapPin className="h-4 w-4" />} {type === "osm" ? "衛星に切替" : "地図に切替"}
    </Button>
  );
}

type FloatDoc = {
  id: string;
  name: string;
  lat?: number;
  lng?: number;
  speed?: number | null;
  heading?: number | null;
  angleDeg?: number | null;
  updatedAt?: number | null;
  battery?: number | null;
  device?: string | null;
};

type FloatDocFS =
  | {
      lat?: number;
      lng?: number;
      speed?: number | null;
      heading?: number | null;
      angleDeg?: number | null;
      updatedAt?: { toMillis?: () => number } | number | null;
      battery?: number | null;
      device?: string | null;
    }
  | undefined;

export default function Page() {
  const { db } = useFirebase();
  const [floats, setFloats] = useState<Record<string, FloatDoc>>(() =>
    Object.fromEntries(FLOAT_IDS.map((id, i) => [id, { id, name: FLOAT_NAMES[i] }]))
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [basemap, setBasemap] = useState<"osm" | "sat">("osm");
  const [center, setCenter] = useState(KAKUNODATE_CENTER);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [editMove, setEditMove] = useState(false);

  useEffect(() => {
    const unsubs = FLOAT_IDS.map((id, idx) =>
      onSnapshot(doc(db, "floats", id), (snap) => {
        const d = snap.data() as FloatDocFS;
        setFloats((prev) => ({
          ...prev,
          [id]: {
            id,
            name: FLOAT_NAMES[idx],
            lat: d?.lat,
            lng: d?.lng,
            speed: d?.speed ?? null,
            heading: d?.heading ?? null,
            angleDeg: d?.angleDeg ?? null,
            updatedAt:
              typeof d?.updatedAt === "number"
                ? d?.updatedAt
                : d?.updatedAt && typeof d.updatedAt === "object" && "toMillis" in d.updatedAt && typeof d.updatedAt.toMillis === "function"
                ? d.updatedAt.toMillis()
                : null,
            battery: d?.battery ?? null,
            device: d?.device ?? null,
          },
        }));
      })
    );
    return () => unsubs.forEach((u) => u());
  }, [db]);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">角館の祭典 曳山ライブマップ（MVP）</h1>

        <Tabs defaultValue="map" className="mt-4">
          <TabsList>
            <TabsTrigger value="map">マップ表示</TabsTrigger>
            <TabsTrigger value="tracker">トラッカーモード（位置共有）</TabsTrigger>
          </TabsList>

          <TabsContent value="map" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <CardTitle className="text-lg">マップ</CardTitle>
                <div className="flex gap-2">
                  <Button variant={editMove ? "default" : "outline"} className="gap-2" onClick={() => setEditMove((v) => !v)}>
                    {editMove ? "位置移動：ON（ドラッグで駒を移動）" : "位置移動：OFF"}
                  </Button>
                  <Button variant="outline" className="gap-2" onClick={() => { setCenter(KAKUNODATE_CENTER); setZoom(DEFAULT_ZOOM); }}>
                    <RefreshCcw className="h-4 w-4" /> 初期表示
                  </Button>
                  <BasemapToggle type={basemap} onToggle={() => setBasemap((t) => (t === "osm" ? "sat" : "osm"))} />
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="p-0">
                <div className="h-[72vh] w-full">
                  <MapView
                    db={db}
                    floats={floats}
                    floatNames={FLOAT_NAMES}
                    floatIds={FLOAT_IDS}
                    basemap={basemap}
                    center={center}
                    zoom={zoom}
                    editMove={editMove}
                    selectedId={selectedId}
                    setSelectedId={(id) => setSelectedId(id)}
                    setCenter={(c) => setCenter(c)}
                    setZoom={(z) => setZoom(z)}
                    RotateEditor={RotateEditor}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tracker" className="mt-4">
            <TrackerPanel db={db} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function RotateEditor({ id, db, current, fallbackHeading }: { id: string; db: ReturnType<typeof getFirestore>; current?: number; fallbackHeading?: number }) {
  const [angle, setAngle] = useState<number>(current ?? Math.round(fallbackHeading ?? 0));

  async function save() {
    await setDoc(doc(db, "floats", id), { angleDeg: angle }, { merge: true });
  }

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAngle(parseInt(e.target.value, 10));
  };

  return (
    <div className="space-y-2">
      <input type="range" min={-180} max={180} step={1} value={angle} onChange={onChange} className="w-full" />
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={() => setAngle((a) => a - 15)}>−15°</Button>
        <Button variant="outline" onClick={() => setAngle(0)}>0°</Button>
        <Button variant="outline" onClick={() => setAngle((a) => a + 15)}>＋15°</Button>
        <div className="text-sm ml-auto">{angle}°</div>
        <Button onClick={save}>保存</Button>
      </div>
    </div>
  );
}

function TrackerPanel({ db }: { db: ReturnType<typeof getFirestore> }) {
  const [id, setId] = useState<string>(FLOAT_IDS[0]);
  const [device, setDevice] = useState("");
  const [passcode, setPasscode] = useState("");
  const [running, setRunning] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  const VALID_PASS = "kakunodate2025";

  async function start() {
    if (passcode !== VALID_PASS) {
      alert("パスコードが違います");
      return;
    }
    if (!device) {
      alert("端末名を入力してください");
      return;
    }
    if (!("geolocation" in navigator)) {
      alert("位置情報に対応していません");
      return;
    }

    await setDoc(doc(db, "floats", id), { device, updatedAt: serverTimestamp() }, { merge: true });

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos: GeolocationPosition) => {
        const { latitude, longitude, heading, speed } = pos.coords;
        await setDoc(
          doc(db, "floats", id),
          {
            lat: latitude,
            lng: longitude,
            heading: typeof heading === "number" ? heading : null,
            speed: typeof speed === "number" ? speed : null,
            device,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      },
      (err: GeolocationPositionError) => {
        console.error(err);
        alert("位置共有に失敗しました: " + err.message);
        stop();
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 }
    );

    setRunning(true);
  }

  function stop() {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setRunning(false);
  }

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-lg">トラッカーモード</CardTitle>
      </CardHeader>
      <Separator />
      <CardContent className="space-y-4 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <div className="text-xs">曳山ID</div>
            <Select value={id} onValueChange={setId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FLOAT_IDS.map((fid, i) => (
                  <SelectItem key={fid} value={fid}>{FLOAT_NAMES[i]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="text-xs">端末名</div>
            <Input value={device} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDevice(e.target.value)} />
          </div>

          <div>
            <div className="text-xs">パスコード</div>
            <Input type="password" value={passcode} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPasscode(e.target.value)} />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!running ? (
            <Button onClick={start} className="gap-2"><Play className="h-4 w-4" /> 共有開始</Button>
          ) : (
            <Button onClick={stop} variant="destructive" className="gap-2"><Square className="h-4 w-4" /> 停止</Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
