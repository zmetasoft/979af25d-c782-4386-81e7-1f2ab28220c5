import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  WidgetHost,
  assetUrl,
  useDataset,
  useDatasets,
} from '@zmeta/ai-board-sdk';
import * as echarts from 'https://esm.sh/echarts@5.5.1';
import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Color3,
  GlowLayer,
  Color4,
  HemisphericLight,
  ParticleSystem,
  Texture,
} from 'https://esm.sh/@babylonjs/core@9.3.0?bundle';
import {
  GeoJsonLayer,
  ScatterplotLayer,
  PathLayer,
  ArcLayer,
} from 'https://esm.sh/@deck.gl/layers@9.3.0?bundle';
import { PathStyleExtension } from 'https://esm.sh/@deck.gl/extensions@9.3.0?bundle';
import MaplibreMap, { type MapHandle } from './components/MaplibreMap';
import {
  Plus,
  CaretUp,
  CaretDown,
  Network,
  Globe,
  MapPin,
  Database,
  Ruler,
  Lightning,
  Ticket,
  Fire,
  Warning,
  RiskWarning,
  EtrClock,
  Hourglass,
  ImpactUsers,
  StatusPanel,
  LatencyGauge,
  type Icon,
} from './components/Icons';

// react-map-gl MapRef shim — we now use a raw maplibre-gl Map instance via MaplibreMap.
type MapRef = MapHandle;

// Static asset URLs (served from site/assets/ by the AI board runtime).
const cardBg = './assets/card-bg.svg';
const cardTitleArrow = './assets/card-title-arrow.svg';
const cardDivider = './assets/card-divider.svg';
const metricCardBg = './assets/metric-card-bg.svg';
const metricCardBgCoral = './assets/metric-card-bg-coral.svg';
const metricCardBgOrange = './assets/metric-card-bg-orange.svg';
const legendBg = './assets/legend-bg.svg';
const alertPopupBg = './assets/alert-popup-bg.svg';
const alertPopupBgOrange = './assets/alert-popup-bg-orange.svg';
const center3Logo = './assets/center3logo.svg';
const AI_BOARD_VISDOC_ID = '979af25d-c782-4386-81e7-1f2ab28220c5';
const AI_BOARD_WIDGET_UPDATE_EVENT = 'zmeta-ai-board-widget:update';
const ALERT_POPUP_TRANSITION_MS = 800;
const ALERT_CAMERA_PULL_BACK_MS = 1800;
const ALERT_CAMERA_PUSH_IN_MS = 2600;
const ALERT_ROTATION_INTERVAL_MS = 9000;
const ALERT_POPUP_REVEAL_DELAY_MS =
  ALERT_CAMERA_PULL_BACK_MS - ALERT_POPUP_TRANSITION_MS;
const MIDDLE_EAST_3D_MAP_CAMERA_VIEW = {
  center: { lon: 49.765794, lat: 9.467088 },
  cameraDistance: 1404.8,
  bearing: 86.7,
  pitch: 36.8,
} as const;
const MIDDLE_EAST_3D_MAP_DATA_CONFIG = [
  {
    datasetId: '1941c631-34fd-42f4-bec7-fbfb25bde290',
    fields: [
      { id: '29ebd619-6fe7-4aba-90be-7e221911f3b6', name: 'longitude', type: 'number' },
      { id: '9dfa780d-9434-46fd-9988-29a1e17b4a7e', name: 'latitude', type: 'number' },
      { id: 'af5ad011-b643-4895-9ddb-ea9fec255ce7', name: 'cable_name', type: 'string' },
    ],
    config: {
      layerType: 'connection',
      layerName: '连线图层',
      visible: true,
      position: {
        type: 'geographic',
        lonField: { name: 'longitude' },
        latField: { name: 'latitude' },
      },
      path: {
        orderDirection: 'asc',
        groupField: { name: 'cable_name' },
        smoothing: {
          enabled: true,
          sampleStep: 1,
          subdivisions: 4,
          curvature: 0,
        },
      },
      style: {
        color: '#3CC0E2',
        opacity: 0.1,
        thicknessScale: 0.002,
        effectPreset: 'comet',
        flowDirection: 'reverse',
        flowSpeed: 0.4,
        glowIntensity: 20,
      },
      heightOffset: 0.035,
    },
    filters: [],
    sorts: [],
  },
  {
    datasetId: '683dea89-f65d-4ae5-a0df-5c0578ac4afe',
    fields: [
      { id: '0700a019-e7db-4f4e-806d-ec30b46bb89a', name: 'Longitude', type: 'number' },
      { id: '81526c16-1fc2-4fd6-99a1-6db82b92ab8f', name: 'Latitude', type: 'number' },
    ],
    config: {
      layerType: 'marker',
      layerName: '标记点图层',
      visible: true,
      position: {
        type: 'geographic',
        lonField: { name: 'Longitude' },
        latField: { name: 'Latitude' },
      },
      markerModelId: 'custom:红色标点.glb',
      size: { scale: 0.08, randomness: 0.02 },
      label: { fields: [] },
      animation: {
        enabled: true,
        appearMs: 1000,
        disappearMs: 1000,
        clips: [{ clipName: '报警点位动画', enabled: true }],
      },
      heightOffset: 0.03,
    },
    filters: [],
    sorts: [],
  },
  {
    datasetId: '24f7ad6b-050e-416f-9cd9-4c89b328fa52',
    fields: [{ id: 'f04e5f74-bff0-4838-9db3-4c910bc1ae51', name: 'region_name', type: 'string' }],
    config: {
      layerType: 'region',
      layerName: '区域图层',
      visible: true,
      position: {
        type: 'nameMatching',
        nameField: { name: 'region_name' },
      },
      style: {
        color: '#E4F8E3',
        opacity: 0.2,
        effectPreset: 'stripe-flow',
        flowSpeed: 30,
        flowDensity: 5000,
        flowAngle: 45,
      },
      match: {
        strategy: 'firstMatch',
        includeDescendants: true,
      },
    },
    filters: [],
    sorts: [],
  },
  {
    datasetId: '1941c631-34fd-42f4-bec7-fbfb25bde290',
    fields: [
      { id: 'cae649f5-fdd8-43b8-ae8b-0e273f0cc1e5', name: 'longitude', type: 'number' },
      { id: '91f2892a-dee1-4848-a4cf-bc51342de1e0', name: 'latitude', type: 'number' },
    ],
    config: {
      layerType: 'marker',
      layerName: '拓扑点',
      visible: true,
      position: {
        type: 'geographic',
        lonField: { name: 'longitude' },
        latField: { name: 'latitude' },
      },
      heightOffset: 0.035,
      size: { scale: 0.015, randomness: 0 },
      label: { fields: [] },
      animation: {
        enabled: true,
        appearMs: 260,
        disappearMs: 220,
      },
      markerModelId: 'custom:小型点位.glb',
    },
    filters: [],
    sorts: [],
  },
  {
    datasetId: '41cb8e07-da93-465a-99d7-571c2cc5412a',
    fields: [
      { id: '5744b298-16aa-4900-80a4-1dde99c1df3b', name: 'longitude', type: 'number' },
      { id: 'dccd6a8b-dcdb-47e6-80ae-9ac7cd7f08de', name: 'latitude', type: 'number' },
    ],
    config: {
      layerType: 'marker',
      layerName: '数据中心',
      visible: true,
      position: {
        type: 'geographic',
        lonField: { name: 'longitude' },
        latField: { name: 'latitude' },
      },
      heightOffset: 0.035,
      size: { scale: 0.02, randomness: 0.02 },
      label: { fields: [] },
      animation: {
        enabled: true,
        appearMs: 260,
        disappearMs: 220,
      },
      markerModelId: 'custom:数据中心.glb',
    },
    filters: [],
    sorts: [],
  },
] as const;

function buildMiddleEast3dMapWidget(runtimeCameraCommand?: {
  type: 'fly-to';
  commandId: string;
  issuedAt: number;
  lon: number;
  lat: number;
  targetOffsetLon?: number;
  targetOffsetLat?: number;
  bearing?: number;
  pitch?: number;
  cameraDistance?: number;
  pullBackDistance?: number;
  durationMs?: number;
  pullBackDurationMs?: number;
  pushInDurationMs?: number;
}) {
  return {
    id: 'middle-east-3d-map',
    type: 'extruded-map',
    name: 'Middle East 3D Map',
    config: {
      level: 'world',
      code: 'WORLD',
      modelConfig: {
        id: 'world-default',
      },
      styleConfig: {
        styleId: 'default',
        styleOverride: {},
      },
      cameraView: MIDDLE_EAST_3D_MAP_CAMERA_VIEW,
      ...(runtimeCameraCommand ? { runtimeCameraCommand } : {}),
    },
    dataConfig: MIDDLE_EAST_3D_MAP_DATA_CONFIG,
    layout: {
      minHeight: 900,
    },
  };
}

function cubicBezierAt(
  t: number,
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number
) {
  const cx = 3 * p1x;
  const bx = 3 * (p2x - p1x) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * p1y;
  const by = 3 * (p2y - p1y) - cy;
  const ay = 1 - cy - by;

  const sampleX = (u: number) => ((ax * u + bx) * u + cx) * u;
  const sampleY = (u: number) => ((ay * u + by) * u + cy) * u;
  const sampleDerivativeX = (u: number) => (3 * ax * u + 2 * bx) * u + cx;

  let u = t;
  for (let i = 0; i < 6; i += 1) {
    const x = sampleX(u) - t;
    const dx = sampleDerivativeX(u);
    if (Math.abs(x) < 1e-5 || Math.abs(dx) < 1e-5) {
      break;
    }
    u -= x / dx;
  }

  u = Math.max(0, Math.min(1, u));
  return sampleY(u);
}

// ----------------------------------------------------
// Art / Editorial Brand Colors (Generative Aesthetics based on Brand GL)
// ----------------------------------------------------
const ART = {
  void: '#05050F', // New Dark Base
  gossamer: '#FFFFFF', // Air (Primary)
  gold: '#A54EE1', // Moon (Secondary)
  crimson: '#FF375E', // Coral (Primary - Outage pulse)
  faintWire: '#3A1066', // Dark purple
  dimText: '#8E9AA0', // Silver (Secondary)
  darkPurple: '#3A1066', // Dark purple
  border: '#4F008C', // Purple (Primary)
};

const BRAND = {
  air: '#FFFFFF',
  purple: '#4F008C',
  coral: '#FF375E',
  silver: '#8E9AA0',
  lightSilver: '#DDDFE2',
  moon: '#A54EE1',
  darkPurple: '#3A1066',
  lightPurple: '#7333A3',
  onyx: '#1D252D',
} as const;

// ----------------------------------------------------
// Mock Data
// ----------------------------------------------------
const MOCK_DATACENTERS = [
  {
    id: 'RDC103',
    name: 'Riyadh Core',
    coordinates: [46.884, 24.829] as [number, number],
    value: 100,
    status: 'normal',
  },
  {
    id: 'MDC20',
    name: 'Medina Node',
    coordinates: [39.524, 24.416] as [number, number],
    value: 80,
    status: 'warning',
  },
  {
    id: 'JDC04',
    name: 'Jeddah Gateway',
    coordinates: [39.212, 21.464] as [number, number],
    value: 90,
    status: 'critical',
  },
  {
    id: 'DDC52',
    name: 'Dammam Edge',
    coordinates: [50.084, 26.41] as [number, number],
    value: 60,
    status: 'normal',
  },
];

const MOCK_TICKETS = [
  {
    id: 'EVT-7653.01',
    cable: 'SMW4_MAIN',
    severity: 'CRITICAL',
    desc: 'STRUCTURAL SEVERANCE DETECTED AT EGYPTIAN CROSSING.',
    eta: 'T-04:00:00',
    subject: 'Structural severance at Egyptian Crossing',
    caseType: 'Infrastructure',
    location: 'Jeddah Gateway',
    status: 'Active',
  },
  {
    id: 'EVT-7654.12',
    cable: 'NODE_MDC20',
    severity: 'WARNING',
    desc: 'THERMAL ANOMALY IN COOLING ARRAY.',
    eta: 'PENDING',
    subject: 'Cooling array thermal spike',
    caseType: 'Thermal',
    location: 'Singapore Landing',
    status: 'Pending',
  },
  {
    id: 'EVT-7655.88',
    cable: 'EIG_SPLINE',
    severity: 'WARNING',
    desc: 'SIGNAL DEGRADATION / ATTENUATION.',
    eta: 'T-12:00:00',
    subject: 'Signal degradation on EIG spline',
    caseType: 'Signal',
    location: 'Red Sea Corridor',
    status: 'Investigating',
  },
  {
    id: 'EVT-7656.90',
    cable: '2AFRICA_SUB',
    severity: 'LOG',
    desc: 'SCHEDULED METAMORPHOSIS / MAINTENANCE.',
    eta: 'T-48:00:00',
    subject: 'Planned maintenance on 2Africa subspline',
    caseType: 'Maintenance',
    location: 'Cape Town Hub',
    status: 'Scheduled',
  },
];

const LEDGER_STATUS_COLORS: Record<string, string> = {
  'In Progress': '#B441E8',
  Done: '#5FE3A1',
};

const LEDGER_VISIBLE_STATUSES = new Set(['In Progress', 'Done']);
const ALERT_CARD_ENTER_MS = 800;
const LEDGER_HIGHLIGHT_SYNC_MS = 300;
const LEDGER_CLICK_PAUSE_MS = 5000;

type AlertSequenceItem = {
  ticketId: string;
  nodeId: string;
  location: string;
  lon: number;
  lat: number;
  severity: 'CRITICAL' | 'WARNING';
  title: string;
  desc: string;
  eta: string;
  region: string;
  owner: string;
  signal: string;
  impact: string;
  status: string;
  command: string;
  metrics: { label: string; value: string }[];
  timeline: { time: string; label: string }[];
  actions: string[];
  // ① Identity Layer
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  regionPath: string;
  // ② Structured Title
  failureType: string;
  affectedObject: string;
  // ③ Location + Network
  country: string;
  network: string;
  routeType: 'Main' | 'Protection';
  cableName?: string;
  createdName?: string;
  createdAt?: string;
  closedAt?: string;
  alarmClearedAt?: string;
  pointIndex?: string;
  datasetStatus?: string;
  latitude?: number;
  longitude?: number;
  // ④ Context Layer
  phenomenon: string;
  advisory: string;
  // ⑤ Time Layer
  startTime: string;
  duration: string;
  etr: string;
  etaTime: string;
  // ⑥ Snapshot Metric
  snapshotMetricLabel: string;
  snapshotMetricValue: string;
  snapshotTrend: 'up' | 'down' | 'flat';
  // ⑦ Progress
  progressStage:
    | 'Open'
    | 'Investigating'
    | 'Repairing'
    | 'Monitoring'
    | 'Resolved';
  progressPct: number;
  // ⑧ Impact Scope
  affectedCustomers: number;
  affectedCircuits: number;
  affectedCables: number;
  // ⑨ Risk
  dualRouteImpact: boolean;
  riskScore: number;
};

const ALERT_SEQUENCE: AlertSequenceItem[] = [
  {
    ticketId: 'EVT-7653.01',
    nodeId: 'JDC04',
    location: 'Jeddah Gateway',
    lon: 32.5,
    lat: 28.0,
    severity: 'CRITICAL',
    title: 'BACKBONE CABLE FAILURE',
    desc: 'Structural severance detected on the western landing route. Traffic rerouting initiated.',
    eta: 'T-04:00:00',
    region: 'Western Corridor / Red Sea Landing',
    owner: 'Marine Transport Ops',
    signal: 'Latency surge +142 ms',
    impact: '4 routes affected',
    status: 'Traffic rerouted to surviving path',
    command: 'Dispatch field crew',
    metrics: [
      { label: 'Affected routes', value: '4' },
      { label: 'Traffic shifted', value: '72%' },
      { label: 'Service risk', value: 'P0' },
      { label: 'Recovery window', value: '45-60 min' },
    ],
    timeline: [
      { time: '14:02', label: 'Severance detected' },
      { time: '14:05', label: 'Traffic rerouted' },
      { time: '14:12', label: 'Field team dispatched' },
    ],
    actions: [
      'Isolate failed span',
      'Verify surviving path',
      'Publish customer notice',
    ],
    priority: 'P1',
    regionPath: 'Egypt Crossing / Red Sea',
    failureType: 'Fiber Cut',
    affectedObject: 'SMW4 Main Link',
    country: 'Egypt / Red Sea',
    network: 'SMW4',
    routeType: 'Main',
    phenomenon: 'Latency surge +142 ms on western landing segment.',
    advisory: 'Activate surviving path, dispatch marine repair crew.',
    startTime: '14:02 UTC',
    duration: '01h 24m',
    etr: '18:00 UTC',
    etaTime: '17:30 UTC',
    snapshotMetricLabel: 'Latency',
    snapshotMetricValue: '+142 ms',
    snapshotTrend: 'up',
    progressStage: 'Investigating',
    progressPct: 35,
    affectedCustomers: 12,
    affectedCircuits: 48,
    affectedCables: 2,
    dualRouteImpact: true,
    riskScore: 92,
  },
  {
    ticketId: 'EVT-7654.12',
    nodeId: 'MDC20',
    location: 'Singapore Landing',
    lon: 103.82,
    lat: 1.35,
    severity: 'WARNING',
    title: 'COOLING ARRAY THERMAL SPIKE',
    desc: 'Cooling efficiency has dropped below the warning threshold. Manual inspection recommended.',
    eta: 'PENDING',
    region: 'North Cluster / Facility Hall B',
    owner: 'Facilities Control',
    signal: 'Latency drift +28 ms',
    impact: '2 cabinets under watch',
    status: 'Load stable, cooling margin reduced',
    command: 'Schedule inspection',
    metrics: [
      { label: 'Sensors flagged', value: '12' },
      { label: 'Cabinets at risk', value: '2' },
      { label: 'Priority', value: 'P2' },
      { label: 'Recovery window', value: 'Pending' },
    ],
    timeline: [
      { time: '15:14', label: 'Thermal threshold crossed' },
      { time: '15:17', label: 'Fan array checked' },
      { time: '15:22', label: 'Inspection queued' },
    ],
    actions: ['Check fan bank', 'Balance cooling load', 'Confirm sensor drift'],
    priority: 'P2',
    regionPath: 'North Cluster / Facility Hall B',
    failureType: 'Cooling System',
    affectedObject: 'Thermal Spike',
    country: 'Singapore / Strait',
    network: 'NODE_MDC20',
    routeType: 'Main',
    phenomenon: 'Service latency drift +28 ms on cabinet array links.',
    advisory: 'Manual inspection required; balance cooling load.',
    startTime: '15:14 UTC',
    duration: '00h 46m',
    etr: '16:30 UTC',
    etaTime: '16:15 UTC',
    snapshotMetricLabel: 'Latency',
    snapshotMetricValue: '+28 ms',
    snapshotTrend: 'up',
    progressStage: 'Monitoring',
    progressPct: 62,
    affectedCustomers: 3,
    affectedCircuits: 12,
    affectedCables: 0,
    dualRouteImpact: false,
    riskScore: 54,
  },
];

type AlarmLandmarkPoint = {
  number: string;
  numberRaw: unknown;
  refId: string;
  refIdRaw: unknown;
  lon: number;
  lat: number;
  severity: 'P1' | 'P2';
  rootCause: string;
  faultArea: string;
  network: string;
  cableName: string;
  createdName: string;
  createdTime: string;
  closedOn: string;
  alarmClearTime: string;
  pointIndex: string;
  status: string;
};

const GLOBE_WIDGET_ID = 'middle-east-globe';
const GLOBE_CAMERA_NEAR_RADIUS = 1300;
const GLOBE_CAMERA_FAR_RADIUS = 3100;
const GLOBE_CAMERA_ZOOM_OUT_MS = 700;
const GLOBE_CAMERA_MOVE_MS = 1800;
const GLOBE_CAMERA_ZOOM_IN_MS = 900;
const GLOBE_TRANSITION_TOTAL_MS =
  GLOBE_CAMERA_ZOOM_OUT_MS + GLOBE_CAMERA_MOVE_MS + GLOBE_CAMERA_ZOOM_IN_MS;
const LANDMARK_PLAY_HOLD_MS = 2200;
const POPUP_HIDE_LEAD_MS = 260;
const GLOBE_ACTIVE_LANDMARK_LAYER_NAME = '故障点位（Active）';
const AI_BOARD_WIDGET_EVENT_MESSAGE_TYPE = 'zmeta-ai-board-widget:event';
const DEBUG_GLOBE_CLICK = true;

function resolveCurrentVisdocId(): string {
  const previewMatch = window.location.pathname.match(/^\/preview\/([^/]+)/);
  if (previewMatch) {
    return decodeURIComponent(previewMatch[1]);
  }

  const apiMatch = window.location.pathname.match(/\/api\/visdocs\/([^/]+)/);
  return apiMatch ? decodeURIComponent(apiMatch[1]) : '';
}

function resolveWidgetsManifestUrl(): string {
  const visdocId = resolveCurrentVisdocId();
  const cacheToken = String(Date.now());
  if (!visdocId) {
    return `./widgets.json?ts=${encodeURIComponent(cacheToken)}`;
  }

  return `/api/visdocs/${encodeURIComponent(
    visdocId
  )}/ai-board-preview/widgets.json?ts=${encodeURIComponent(cacheToken)}`;
}

function deepClone<T>(value: T): T {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function logGlobeClickDebug(...args: unknown[]) {
  if (!DEBUG_GLOBE_CLICK) {
    return;
  }
  console.debug('[ai-board][globe-click]', ...args);
}

function resolveLandmarkLayerSeverity(
  layerConfig: Record<string, any>
): 'P1' | 'P2' | null {
  const categoryValue = String(layerConfig.categoryValue ?? '')
    .trim()
    .toUpperCase();
  if (categoryValue === 'P1' || categoryValue === 'P2') {
    return categoryValue;
  }

  const layerName = String(layerConfig.layerName ?? '')
    .trim()
    .toUpperCase();
  if (layerName.includes('P1')) {
    return 'P1';
  }
  if (layerName.includes('P2')) {
    return 'P2';
  }

  const iconId = String(layerConfig.iconId ?? '').trim();
  if (iconId.includes('红')) {
    return 'P1';
  }
  if (iconId.includes('蓝')) {
    return 'P2';
  }

  return null;
}

function formatSentenceHeadline(value: unknown): string {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!text) {
    return '--';
  }

  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatCoordinate(value: unknown): string {
  const numericValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numericValue)) {
    return '--';
  }

  return numericValue.toFixed(3);
}

function formatElapsedDuration(
  startValue: unknown,
  endValue: unknown,
  fallbackNow: Date
): string {
  const startTime = new Date(String(startValue ?? '')).getTime();
  if (!Number.isFinite(startTime)) {
    return '--';
  }

  const explicitEndTime = new Date(String(endValue ?? '')).getTime();
  const endTime = Number.isFinite(explicitEndTime)
    ? explicitEndTime
    : fallbackNow.getTime();
  const totalMinutes = Math.max(0, Math.floor((endTime - startTime) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) {
    return `${minutes}m`;
  }

  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}
function renderAlertCardContent(
  item: AlertSequenceItem,
  ticket: any,
  _isCritical: boolean
) {
  const isP2 = item.eta === 'PENDING' || item.severity === 'WARNING';
  const accentColor = isP2 ? '#FF5F1D' : BRAND.coral;
  const accentSoft = isP2 ? 'rgba(255,95,29,0.2)' : 'rgba(255,55,94,0.15)';
  const cardBgSrc = isP2 ? alertPopupBgOrange : alertPopupBg;
  const cardBgTint = isP2 ? 'rgba(24,14,6,0.08)' : 'rgba(20,8,18,0.40)';
  const durationPct = Math.max(
    0,
    Math.min(100, Number.isFinite(item.progressPct) ? item.progressPct : 0)
  );

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      style={{ ['--alert-accent' as any]: accentColor }}
    >
      <div
        className="absolute inset-[16px] rounded-[16px] backdrop-blur-[32px] pointer-events-none"
        style={{ backgroundColor: cardBgTint }}
      />
      <div
        className="absolute inset-0 pointer-events-none box-border"
        style={{
          borderStyle: 'solid',
          borderColor: 'transparent',
          borderWidth: '24px 16px 24px 16px',
          borderImageSource: `url(${cardBgSrc})`,
          borderImageSlice: '27 18 42 18 fill',
          borderImageWidth: '24px 16px 32px 16px',
          borderImageRepeat: 'stretch',
        }}
      />
      <div className="absolute inset-y-[34px] left-[20px] w-[24px] pointer-events-none z-[2] overflow-hidden">
        <div
          className="alert-side-stripe-flow absolute inset-y-0 left-0 w-[18px]"
          style={{
            ['--stripe-accent' as any]: accentColor,
            ['--stripe-angle' as any]: '30deg',
            boxShadow: `0 0 10px ${withAlpha(accentColor, 0.55)}`,
          }}
        />
      </div>
      <div className="absolute inset-y-[34px] right-[20px] w-[24px] pointer-events-none z-[2] overflow-hidden">
        <div
          className="alert-side-stripe-flow absolute inset-y-0 right-0 w-[18px]"
          style={{
            ['--stripe-accent' as any]: accentColor,
            ['--stripe-angle' as any]: '150deg',
            boxShadow: `0 0 10px ${withAlpha(accentColor, 0.55)}`,
          }}
        />
      </div>
      <div className="relative pl-[80px] pr-[96px] pt-[72px] pb-[60px] h-full flex flex-col">
        {/* ───────── Header: severity + location + priority ───────── */}
        <div className="flex items-center justify-between gap-[20px] shrink-0 mb-[22px]">
          <div className="flex items-center gap-[16px] min-w-0">
            <div
              className="inline-flex items-center rounded-full px-[18px] py-[7px] text-[18px] font-bold tracking-normal shrink-0"
              style={{ backgroundColor: accentColor, color: '#1A0712' }}
            >
              {item.severity}
            </div>
            <div className="flex items-center gap-[10px] min-w-0">
              <MapPin size={20} weight="fill" style={{ color: accentColor }} />
              <span className="text-[22px] font-semibold text-white truncate">
                {item.location}
              </span>
            </div>
          </div>
          <div
            className="flex items-center gap-[10px] rounded-full px-[18px] py-[6px] shrink-0"
            style={{
              backgroundColor: accentSoft,
              border: `1px solid ${withAlpha(accentColor, 0.55)}`,
            }}
          >
            <div
              className="w-[7px] h-[7px] rounded-full"
              style={{
                backgroundColor: accentColor,
                boxShadow: `0 0 10px ${accentColor}`,
              }}
            />
            <div
              className="text-[20px] font-bold tracking-normal"
              style={{ color: accentColor }}
            >
              {item.priority}
            </div>
          </div>
        </div>

        {/* ───────── Big title ───────── */}
        <div className="shrink-0 mb-[14px]">
          <div className="text-[44px] font-bold leading-[1.08] tracking-normal text-white normal-case truncate whitespace-nowrap">
            {formatSentenceHeadline(item.phenomenon)}
          </div>
        </div>

        {/* ───────── One-line identifiers ───────── */}
        <div className="shrink-0 mb-[28px] flex items-center gap-[14px] text-[24px] text-[rgba(221,223,226,0.78)] font-light">
          <span
            className="font-art-mono uppercase tracking-normal text-[22px] font-semibold"
            style={{ color: accentColor }}
          >
            {item.ticketId}
          </span>
          <span className="text-[rgba(221,223,226,0.28)]">·</span>
          <span className="font-art-mono uppercase tracking-normal text-[22px] truncate">{item.ticketId}</span>
        </div>

        {/* ───────── Divider ───────── */}
        <div
          className="h-px w-full shrink-0 mb-[12px]"
          style={{
            background:
              'linear-gradient(90deg, rgba(255,255,255,0.22), rgba(255,255,255,0))',
          }}
        />

        {/* ───────── Unified metric rows ───────── */}
        <div className="flex-1 min-h-0 flex flex-col justify-between py-[8px]">
          {(() => {
            const createdAt = item.createdAt || item.startTime;
            const statusText = item.datasetStatus || item.advisory || '--';
            const statusAccentColor = LEDGER_STATUS_COLORS[statusText] ?? accentColor;
            const isDone = statusText === 'Done';
            const statusSegments = 5;
            const activeStatusSegments = isDone ? statusSegments : statusText === 'In Progress' ? 2 : 1;
            const durationPct = Math.max(
              8,
              Math.min(100, Number.isFinite(item.progressPct) ? item.progressPct : 35)
            );
            const rows: {
              label: string;
              icon: ReactNode;
              visual: ReactNode;
              value: ReactNode;
              valueColor: string;
            }[] = [
              {
                label: 'Duration',
                icon: <Hourglass size={24} color={accentColor} />,
                visual: (
                  <div
                    className="relative h-[9px] w-full overflow-hidden"
                    style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
                  >
                    <div
                      className="h-full"
                      style={{
                        width: `${durationPct}%`,
                        background: `linear-gradient(90deg, ${accentColor}, ${withAlpha(
                          accentColor,
                          0.55
                        )})`,
                        boxShadow: `0 0 10px ${withAlpha(accentColor, 0.7)}`,
                      }}
                    />
                  </div>
                ),
                value: item.duration,
                valueColor: accentColor,
              },
              {
                label: 'Status',
                icon: <StatusPanel size={24} color={accentColor} />,
                visual: (() => {
                  const STAGES = [
                    'Open',
                    'Investigating',
                    'Repairing',
                    'Monitoring',
                    'Resolved',
                  ] as const;
                  const currentIdx = STAGES.indexOf(item.progressStage);
                  return (
                    <div className="flex items-center gap-[6px] w-full">
                      {STAGES.map((stage, i) => {
                        const reached = i <= currentIdx;
                        const isCurrent = i === currentIdx;
                        return (
                          <div
                            key={stage}
                            className="flex-1 h-[7px]"
                            style={{
                              backgroundColor: reached
                                ? accentColor
                                : 'rgba(255,255,255,0.08)',
                              boxShadow: isCurrent
                                ? `0 0 10px ${accentColor}`
                                : 'none',
                              opacity: reached ? (isCurrent ? 1 : 0.55) : 1,
                            }}
                          />
                        );
                      })}
                    </div>
                  );
                })(),
                value: item.progressStage,
                valueColor: '#FFFFFF',
              },
              {
                label: 'Cable',
                icon: <Ticket size={24} color={accentColor} />,
                visual: (
                  <div className="flex items-center gap-[10px]">
                    <span className="font-art-mono text-[22px] uppercase tracking-normal truncate text-white">
                      {ticket?.cable ?? item.nodeId}
                    </span>
                  </div>
                ),
                value: item.cableName || '--',
                valueColor: '#FFFFFF',
              },
              {
                label: 'Created By',
                icon: <ImpactUsers size={24} color={accentColor} />,
                visual: (
                  <span className="text-[22px] uppercase tracking-normal text-white">
                    {item.affectedCustomers} Customers · {item.affectedCircuits}{' '}
                    Circuits
                  </span>
                ),
                value: item.createdName || '--',
                valueColor: '#FFFFFF',
              },
              {
                label: 'Position',
                icon: <MapPin size={24} weight="fill" color={accentColor} />,
                visual: (
                  <span className="text-[22px] uppercase tracking-normal text-white">
                    Lat / Lon Position
                  </span>
                ),
                value: `${formatCoordinate(item.latitude)}, ${formatCoordinate(item.longitude)}`,
                valueColor: '#FFFFFF',
              },
            ];
            return rows.map((row, idx) => (
              <div
                key={row.label}
                className="grid grid-cols-[168px_42px_1fr_320px] items-center gap-[20px] py-[28px]"
                style={{
                  borderTop:
                    idx === 0 ? 'none' : '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div className="flex items-center gap-[12px] min-w-0">
                  <span className="text-[24px] uppercase tracking-normal text-[rgba(221,223,226,0.72)] truncate">
                    {row.label}
                  </span>
                </div>
                <div className="flex items-center justify-center">
                  {row.icon}
                </div>
                <div className="min-w-0 flex items-center">{row.visual}</div>
                <div
                  className="font-art-mono text-[30px] font-semibold tabular-nums text-right whitespace-nowrap overflow-visible"
                  style={{ color: row.valueColor }}
                >
                  {row.value}
                </div>
              </div>
            ));
          })()}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// Story Configuration
// ----------------------------------------------------
type StoryMode = 'GLOBAL' | 'CABLE_FOCUS' | 'DC_FOCUS' | 'ALARM_EVENT';

const STORY_CONFIG = {
  GLOBAL: {
    leftPanelWidth: '10%',
    earthWidth: '40%',
    mapWidth: '50%',
    leftCard: 'globalLeft',
    rightCard: 'globalRight',
  },
  CABLE_FOCUS: {
    leftPanelWidth: '10%',
    earthWidth: '40%',
    mapWidth: '50%',
    leftCard: 'cableEarthStats',
    rightCard: 'cableMapStats',
  },
  DC_FOCUS: {
    leftPanelWidth: '10%',
    earthWidth: '40%',
    mapWidth: '50%',
    leftCard: 'dcEarthStats',
    rightCard: 'dcMapStats',
  },
  ALARM_EVENT: {
    leftPanelWidth: '10%',
    earthWidth: '40%',
    mapWidth: '50%',
    leftCard: 'alarmEarthStats',
    rightCard: 'alarmRight',
  },
};

// ----------------------------------------------------
// Helpers
// ----------------------------------------------------
const EARTH_RADIUS = 10;

function latLonToVector3(lat: number, lon: number, radius: number): Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new Vector3(
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

function withAlpha(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  const value =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => char + char)
          .join('')
      : normalized;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getArtColor3(status: string, isNetwork = false): Color3 {
  if (status === 'critical') return Color3.FromHexString(ART.crimson);
  if (status === 'warning') return Color3.FromHexString(ART.gold);
  if (isNetwork) return Color3.FromHexString(ART.gossamer);
  return Color3.FromHexString(ART.gossamer);
}

function getArtColorRGB(
  status: string,
  isNetwork = false
): [number, number, number, number] {
  if (status === 'critical') return [255, 55, 94, 255]; // Coral (#FF375E)
  if (status === 'warning') return [165, 78, 225, 255]; // Moon Light (#A54EE1)
  if (isNetwork) return [255, 255, 255, 180]; // Air (#FFFFFF)
  return [255, 255, 255, 180];
}

// ----------------------------------------------------
// ECharts Components
// ----------------------------------------------------
function StatusRingChart({
  percent,
  accent,
}: // duration = 2600,
{
  percent: number;
  accent: string;
  duration?: number;
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  // Track previously-rendered percent so we only pulse on real value changes.
  const prevPercentRef = useRef<number | null>(null);
  const prevAccentRef = useRef<string | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    chartInstanceRef.current =
      echarts.getInstanceByDom(chartRef.current) ??
      echarts.init(chartRef.current, null, { renderer: 'canvas' });
    resizeObserverRef.current = new ResizeObserver(() => {
      chartInstanceRef.current?.resize();
    });
    resizeObserverRef.current.observe(chartRef.current);
    const firstFrame = window.requestAnimationFrame(() => {
      chartInstanceRef.current?.resize();
      window.requestAnimationFrame(() => chartInstanceRef.current?.resize());
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      chartInstanceRef.current?.dispose();
      chartInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!chartInstanceRef.current) return;

    // Engine-loader style: segmented ring. A one-shot charging pulse plays
    // whenever `percent` (or `accent`) changes, then settles into a static look.
    const chart = chartInstanceRef.current;
    const N = 56;
    const filled = Math.max(0, Math.min(N, Math.round((percent / 100) * N)));

    // Only play the charge pulse on a true value change (not on first mount or
    // when the same prop re-arrives unchanged).
    const roundedPercent = Math.round(percent);
    const isFirstRun = prevPercentRef.current === null;
    const percentChanged =
      !isFirstRun && prevPercentRef.current !== roundedPercent;
    const accentChanged = !isFirstRun && prevAccentRef.current !== accent;
    const shouldAnimate = percentChanged || accentChanged;
    prevPercentRef.current = roundedPercent;
    prevAccentRef.current = accent;

    type SegmentStyle = {
      color: string;
      borderRadius: number;
      shadowBlur: number;
      shadowColor: string;
      opacity: number;
    };

    // Resting item style (used when no animation is running).
    const restingItem = (i: number): SegmentStyle => {
      const isFilled = i < filled;
      return {
        color: isFilled ? accent : withAlpha(BRAND.lightSilver, 0.14),
        borderRadius: 1.5,
        shadowBlur: isFilled ? 6 : 0,
        shadowColor: isFilled ? withAlpha(accent, 0.75) : 'transparent',
        opacity: isFilled ? 1 : 0.5,
      };
    };

    // Animated item style while the charge pulse is sweeping.
    const animatedItem = (
      i: number,
      t: number,
      settleT: number
    ): SegmentStyle => {
      const isFilled = i < filled;
      // Wave charge-in timing: every segment starts lighting at its own time.
      const chargeFraction = 0.75; // portion of animation spent charging-in
      const segFadeIn = 0.1;
      const segStart = (N <= 1 ? 0 : i / (N - 1)) * chargeFraction;
      let waveIntensity = 0;
      if (t >= segStart) {
        waveIntensity = Math.min(1, (t - segStart) / segFadeIn);
      }
      const peak = isFilled ? 1 : 0.35;
      const eff = waveIntensity * peak;
      const waveOpacity = Math.min(1, (isFilled ? 0.12 : 0.14) + eff * 0.9);
      const waveShadow = eff * (isFilled ? 14 : 4);

      // Settle: blend from the wave peak toward the resting look.
      const rest = restingItem(i);
      const opacity = waveOpacity * (1 - settleT) + rest.opacity * settleT;
      const shadowBlur = waveShadow * (1 - settleT) + rest.shadowBlur * settleT;
      return {
        color: rest.color,
        borderRadius: 1.5,
        shadowBlur,
        shadowColor: isFilled ? withAlpha(accent, 0.85) : 'transparent',
        opacity,
      };
    };

    const buildData = (fn: (i: number) => SegmentStyle) =>
      Array.from({ length: N }, (_, i) => ({
        value: 1,
        name: String(i),
        itemStyle: fn(i),
      }));

    // Initial setOption with full data + animations disabled, so ECharts
    // locks a stable sector layout (radius/padAngle).
    chart.setOption(
      {
        animation: false,
        backgroundColor: 'transparent',
        series: [
          {
            type: 'pie',
            radius: ['72%', '94%'],
            center: ['50%', '50%'],
            startAngle: 90,
            endAngle: -270,
            clockwise: true,
            silent: true,
            avoidLabelOverlap: false,
            padAngle: 2.2,
            label: { show: false },
            labelLine: { show: false },
            animation: false,
            animationDurationUpdate: 0,
            universalTransition: false,
            data: buildData(restingItem),
          },
        ],
      },
      true
    );

    // No value change → stay static, skip the animation loop entirely.
    if (!shouldAnimate) return;

    // One-shot pulse: play charge wave, then settle to resting state.
    const pulseMs = 1400;
    const settleMs = 350;
    const totalMs = pulseMs + settleMs;
    const start = performance.now();

    let raf = 0;
    const tick = () => {
      const elapsed = performance.now() - start;
      if (elapsed >= totalMs) {
        chart.setOption({ series: [{ data: buildData(restingItem) }] });
        return;
      }
      const t = Math.min(1, elapsed / pulseMs);
      const settleT =
        elapsed <= pulseMs ? 0 : Math.min(1, (elapsed - pulseMs) / settleMs);
      chart.setOption({
        series: [{ data: buildData((i) => animatedItem(i, t, settleT)) }],
      });
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => cancelAnimationFrame(raf);
  }, [percent, accent]);

  return (
    <div className="relative w-[112px] h-[112px] shrink-0 flex items-center justify-center">
      {/* Outer halo ring */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: '100%',
          height: '100%',
          border: `1px solid ${withAlpha(accent, 0.35)}`,
        }}
      />
      {/* Inner glow ring — the soft neon band inside the segmented arc */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: '54%',
          height: '54%',
          border: `1px solid ${withAlpha(accent, 0.45)}`,
          boxShadow: `inset 0 0 12px ${withAlpha(
            accent,
            0.55
          )}, 0 0 10px ${withAlpha(accent, 0.35)}`,
        }}
      />
      <div ref={chartRef} className="absolute inset-0 z-10" />
      {/* Center percent — flips over when the value changes */}
      <FlipPercent value={percent} accent={accent} />
    </div>
  );
}

// One-time keyframes injection for the flip-number animation.
let __ringFlipKeyframesInstalled = false;
function installRingFlipKeyframes() {
  if (__ringFlipKeyframesInstalled || typeof document === 'undefined') return;
  const style = document.createElement('style');
  style.textContent = `
@keyframes ringFlipOut {
  0%   { transform: rotateX(0deg); opacity: 1; }
  100% { transform: rotateX(90deg) translateY(-4px); opacity: 0; }
}
@keyframes ringFlipIn {
  0%   { transform: rotateX(-90deg) translateY(4px); opacity: 0; }
  60%  { opacity: 1; }
  100% { transform: rotateX(0deg) translateY(0); opacity: 1; }
}
`;
  document.head.appendChild(style);
  __ringFlipKeyframesInstalled = true;
}

function FlipPercent({ value, accent }: { value: number; accent: string }) {
  installRingFlipKeyframes();
  const rounded = Math.round(value);
  const [current, setCurrent] = useState(rounded);
  const [outgoing, setOutgoing] = useState<number | null>(null);
  const prevRef = useRef<number | null>(null);

  useEffect(() => {
    // First render: just render the initial number, no flip.
    if (prevRef.current === null) {
      prevRef.current = rounded;
      setCurrent(rounded);
      return;
    }
    if (rounded === prevRef.current) return;
    setOutgoing(prevRef.current);
    setCurrent(rounded);
    prevRef.current = rounded;
    const id = window.setTimeout(() => setOutgoing(null), 500);
    return () => window.clearTimeout(id);
  }, [rounded]);

  const baseStyle: CSSProperties = {
    fontSize: 22,
    fontStyle: 'italic',
    letterSpacing: 0.5,
    textShadow: `0 0 10px ${withAlpha(accent, 0.6)}`,
    color: '#FFFFFF',
    fontWeight: 600,
    fontFamily: 'Montserrat',
    display: 'inline-block',
    transformOrigin: 'center center',
    backfaceVisibility: 'hidden',
    willChange: 'transform, opacity',
  };

  return (
    <div
      className="absolute z-20 pointer-events-none select-none"
      style={{ perspective: 300 }}
    >
      <span
        key={`cur-${current}`}
        style={{
          ...baseStyle,
          animation:
            outgoing !== null
              ? 'ringFlipIn 420ms cubic-bezier(0.22, 1, 0.36, 1) 80ms both'
              : undefined,
        }}
      >
        {current}%
      </span>
      {outgoing !== null && (
        <span
          key={`out-${outgoing}`}
          style={{
            ...baseStyle,
            position: 'absolute',
            inset: 0,
            textAlign: 'center',
            animation: 'ringFlipOut 260ms cubic-bezier(0.4, 0, 1, 1) both',
          }}
        >
          {outgoing}%
        </span>
      )}
    </div>
  );
}

type GlobalStatusCardItem = {
  label: string;
  percent: number;
  value: string;
  rawValue: number;
  accent: string;
  duration?: number;
  trend: number[];
  trendDirection?: 'up' | 'down';
};

function StatusSparkline({ data, accent }: { data: number[]; accent: string }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    const chart =
      echarts.getInstanceByDom(chartRef.current) ??
      echarts.init(chartRef.current, null, { renderer: 'canvas' });
    chartInstanceRef.current = chart;

    const resizeObserver = new ResizeObserver(() => {
      chart.resize();
    });
    resizeObserver.observe(chartRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.dispose();
      chartInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartInstanceRef.current;
    if (!chart) return;

    chart.setOption(
      {
        animation: true,
        animationDuration: 1000,
        animationEasing: 'cubicOut',
        grid: { top: 12, right: 12, bottom: 4, left: 0 },
        xAxis: {
          type: 'category',
          show: false,
          boundaryGap: false,
          data: data.map((_, index) => index),
        },
        yAxis: {
          type: 'value',
          show: false,
          scale: true,
        },
        series: [
          {
            type: 'line',
            data,
            smooth: false,
            symbol: 'none',
            clip: false,
            lineStyle: {
              color: accent,
              width: 2,
            },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: withAlpha(accent, 0.4) },
                { offset: 1, color: withAlpha(accent, 0) },
              ]),
            },
          },
          {
            type: 'effectScatter',
            coordinateSystem: 'cartesian2d',
            data: [[data.length - 1, data[data.length - 1]]],
            symbolSize: 6,
            clip: false,
            itemStyle: {
              color: accent,
            },
            rippleEffect: {
              brushType: 'stroke',
              scale: 4,
            },
            zlevel: 1,
          },
        ],
      },
      true
    );
  }, [data, accent]);

  return <div ref={chartRef} className="h-full w-full" />;
}

function AnimatedNumber({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(value);
  const displayValueRef = useRef(displayValue);
  displayValueRef.current = displayValue;

  useEffect(() => {
    let startTimestamp: number | null = null;
    const duration = 1000;

    // Capture the current displayValue as the starting point for this animation
    const startValue = displayValueRef.current;

    if (startValue === value) return;

    let animationId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);

      // easeOutQuart
      const easeProgress = 1 - Math.pow(1 - progress, 4);

      const current = startValue + (value - startValue) * easeProgress;
      setDisplayValue(current);

      if (progress < 1) {
        animationId = requestAnimationFrame(step);
      } else {
        setDisplayValue(value);
      }
    };

    animationId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationId);
  }, [value]); // ONLY depend on value to trigger new animation

  return <>{Math.round(displayValue).toLocaleString()}</>;
}

function GlobalStatusRingCard({
  item,
  className = '',
}: {
  item: GlobalStatusCardItem;
  className?: string;
}) {
  return (
    <div className={`relative flex flex-col items-center h-full ${className}`}>
      <div className="mt-[2px]">
        <StatusRingChart
          percent={item.percent}
          accent={item.accent}
          duration={item.duration}
        />
      </div>
      <div className="flex flex-col items-center mt-auto mb-auto pt-[16px]">
        <div
          className="text-[20px] uppercase tracking-normal whitespace-nowrap text-center mb-[8px]"
          style={{ color: BRAND.silver }}
        >
          {item.label}
        </div>
        <div className="flex items-center justify-center gap-2">
          <div className="text-[42px] text-white font-medium leading-none tracking-tight whitespace-nowrap text-center">
            <AnimatedNumber value={item.rawValue} />
          </div>
          {item.trendDirection && (
            <div
              className="flex items-center justify-center"
              style={{
                color: item.trendDirection === 'up' ? '#4ade80' : '#fb7185',
              }}
            >
              {item.trendDirection === 'up' ? (
                <CaretUp weight="fill" size={14} />
              ) : (
                <CaretDown weight="fill" size={14} />
              )}
            </div>
          )}
        </div>
      </div>
      <div className="w-full px-[10px] h-[80px] mt-auto mb-0">
        <StatusSparkline data={item.trend} accent={item.accent} />
      </div>
    </div>
  );
}

function BusinessStatusChart() {
  const [statusCards, setStatusCards] = useState<GlobalStatusCardItem[]>([
    {
      label: 'Outage',
      percent: 27,
      value: '92,980',
      rawValue: 92980,
      accent: BRAND.coral,
      duration: 2400,
      trend: [36, 42, 39, 48, 52, 58, 54, 61, 67, 63, 70, 76],
    },
    {
      label: 'Degradation',
      percent: 18,
      value: '41,260',
      rawValue: 41260,
      accent: '#BF89EF',
      duration: 2900,
      trend: [28, 31, 29, 34, 38, 35, 41, 39, 44, 42, 46, 49],
    },
    {
      label: 'Non-Outage',
      percent: 55,
      value: '188,430',
      rawValue: 188430,
      accent: BRAND.moon,
      duration: 3400,
      trend: [120, 126, 124, 129, 132, 136, 134, 141, 145, 149, 153, 158],
    },
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setStatusCards((prevCards) => {
        let total = 0;
        const newCards = prevCards.map((card) => {
          // Generate a random change between -2.5% and +2.5% of the current value
          const change = (Math.random() - 0.5) * 0.05 * card.rawValue;
          const newRawValue = Math.max(0, Math.round(card.rawValue + change));
          total += newRawValue;

          // Update the trend array for the sparkline
          const lastTrend = card.trend[card.trend.length - 1];
          const newTrendValue = Math.max(
            0,
            lastTrend + (Math.random() - 0.5) * 10
          );

          return {
            ...card,
            rawValue: newRawValue,
            value: newRawValue.toLocaleString(),
            trendDirection: change >= 0 ? 'up' : 'down',
            trend: [...card.trend.slice(1), newTrendValue],
          } as GlobalStatusCardItem;
        });

        // Recalculate percentages based on the new total
        return newCards.map((card) => ({
          ...card,
          percent: total > 0 ? (card.rawValue / total) * 100 : 0,
        }));
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative h-full px-[18px] flex justify-between gap-4">
      {statusCards.map((item) => (
        <div key={item.label} className="flex-1 min-w-0">
          <GlobalStatusRingCard item={item} />
        </div>
      ))}
    </div>
  );
}

function GlobalAlertSummary() {
  const pieRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const pieChartRef = useRef<echarts.ECharts | null>(null);
  const barChartRef = useRef<echarts.ECharts | null>(null);

  const [alertData, setAlertData] = useState({
    total: 1634,
    pie: [
      {
        value: 124,
        name: 'Critical',
        itemStyle: {
          color: BRAND.coral,
          shadowBlur: 15,
          shadowColor: BRAND.coral,
        },
      },
      {
        value: 356,
        name: 'Warning',
        itemStyle: {
          color: BRAND.moon,
          shadowBlur: 10,
          shadowColor: BRAND.moon,
        },
      },
      {
        value: 1154,
        name: 'Normal',
        itemStyle: { color: '#BF89EF', shadowBlur: 10, shadowColor: '#BF89EF' },
      },
    ],
    bar: {
      critical: [45, 30, 49],
      warning: [120, 150, 86],
      normal: [350, 420, 484],
    },
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setAlertData((prev) => {
        // Randomly fluctuate the bar chart data (East, Central, West)
        const fluctuate = (val: number, volatility: number) =>
          Math.max(0, Math.round(val + (Math.random() - 0.5) * volatility));

        const newBar = {
          critical: prev.bar.critical.map((v) => fluctuate(v, 6)),
          warning: prev.bar.warning.map((v) => fluctuate(v, 15)),
          normal: prev.bar.normal.map((v) => fluctuate(v, 30)),
        };

        // Recalculate totals for the pie chart
        const totalCritical = newBar.critical.reduce((a, b) => a + b, 0);
        const totalWarning = newBar.warning.reduce((a, b) => a + b, 0);
        const totalNormal = newBar.normal.reduce((a, b) => a + b, 0);

        return {
          total: totalCritical + totalWarning + totalNormal,
          pie: [
            { ...prev.pie[0], value: totalCritical },
            { ...prev.pie[1], value: totalWarning },
            { ...prev.pie[2], value: totalNormal },
          ],
          bar: newBar,
        };
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!pieRef.current || !barRef.current) return;

    pieChartRef.current =
      echarts.getInstanceByDom(pieRef.current) ??
      echarts.init(pieRef.current, null, { renderer: 'canvas' });
    barChartRef.current =
      echarts.getInstanceByDom(barRef.current) ??
      echarts.init(barRef.current, null, { renderer: 'canvas' });

    const pieChart = pieChartRef.current;
    const barChart = barChartRef.current;

    const handleResize = () => {
      pieChart.resize();
      barChart.resize();
    };
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    resizeObserver.observe(pieRef.current);
    resizeObserver.observe(barRef.current);

    const firstFrame = window.requestAnimationFrame(() => {
      handleResize();
      window.requestAnimationFrame(handleResize);
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      resizeObserver.disconnect();
      // StrictMode in editor mounts/unmounts once before the real mount.
      // Always dispose so the next mount binds to the current DOM node.
      pieChart.dispose();
      barChart.dispose();
      pieChartRef.current = null;
      barChartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const pieEl = pieRef.current;
    const barEl = barRef.current;

    if (!pieEl || !barEl) return;

    if (!pieChartRef.current) {
      pieChartRef.current =
        echarts.getInstanceByDom(pieEl) ??
        echarts.init(pieEl, null, { renderer: 'canvas' });
    }
    if (!barChartRef.current) {
      barChartRef.current =
        echarts.getInstanceByDom(barEl) ??
        echarts.init(barEl, null, { renderer: 'canvas' });
    }

    const pieChart = pieChartRef.current;
    const barChart = barChartRef.current;

    if (!pieChart || !barChart) return;

    const resizeCharts = () => {
      pieChart.resize();
      barChart.resize();
    };

    // --- Pie Chart (Global Severity Distribution) ---
    const ghostPieData = alertData.pie.map((item) => ({
      ...item,
      itemStyle: {
        ...item.itemStyle,
        color: withAlpha(String(item.itemStyle?.color ?? BRAND.moon), 0.26),
        shadowBlur: 0,
        shadowColor: 'transparent',
      },
    }));

    let retryFrame = 0;
    let settleFrame1 = 0;
    let settleFrame2 = 0;
    let disposed = false;

    const hasUsableSize = () => {
      const pieRect = pieEl.getBoundingClientRect();
      const barRect = barEl.getBoundingClientRect();
      return (
        pieRect.width >= 2 &&
        pieRect.height >= 2 &&
        barRect.width >= 2 &&
        barRect.height >= 2
      );
    };

    const applyCharts = () => {
      if (disposed) return;
      resizeCharts();

      pieChart.setOption({
        animation: true,
        animationDuration: 1000,
        animationEasing: 'cubicOut',
        backgroundColor: 'transparent',
        textStyle: { fontFamily: 'Montserrat' },
        tooltip: {
          trigger: 'item',
          backgroundColor: withAlpha(BRAND.onyx, 0.95),
          borderColor: BRAND.purple,
          textStyle: {
            color: BRAND.air,
            fontSize: 14,
            fontFamily: 'Montserrat',
          },
          padding: [12, 16],
          borderRadius: 8,
        },
        series: [
          {
            type: 'pie',
            radius: ['70%', '76%'],
            center: ['46%', '54%'],
            avoidLabelOverlap: false,
            silent: true,
            label: { show: false },
            itemStyle: {
              borderRadius: 20,
              borderWidth: 0,
            },
            data: ghostPieData,
            z: 0,
          },
          {
            type: 'pie',
            radius: ['70%', '76%'],
            center: ['50%', '50%'],
            avoidLabelOverlap: false,
            label: { show: false },
            itemStyle: {
              borderRadius: 20,
              borderWidth: 0,
            },
            data: alertData.pie,
          },
          {
            type: 'pie',
            radius: ['70%', '76%'],
            center: ['50%', '50%'],
            silent: true,
            z: -1,
            itemStyle: {
              color: 'rgba(255, 255, 255, 0.05)',
              borderWidth: 0,
            },
            label: { show: false },
            data: [{ value: 1 }],
          },
        ],
      });

      barChart.setOption({
        animation: true,
        animationDuration: 1000,
        animationEasing: 'cubicOut',
        backgroundColor: 'transparent',
        textStyle: { fontFamily: 'Montserrat' },
        grid: { top: 60, right: 20, bottom: 0, left: 10, containLabel: true },
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          backgroundColor: withAlpha(BRAND.onyx, 0.95),
          borderColor: BRAND.purple,
          textStyle: {
            color: BRAND.air,
            fontSize: 14,
            fontFamily: 'Montserrat',
          },
          padding: [12, 16],
          borderRadius: 8,
        },
        xAxis: {
          type: 'value',
          show: false,
        },
        yAxis: {
          type: 'category',
          data: ['East', 'Central', 'West'],
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: BRAND.air,
            fontSize: 24,
            fontWeight: 500,
            margin: 16,
            fontFamily: 'Montserrat',
          },
        },
        series: [
          {
            name: 'Critical',
            type: 'bar',
            stack: 'total',
            barWidth: 20,
            data: alertData.bar.critical,
            itemStyle: {
              color: BRAND.coral,
              shadowBlur: 10,
              shadowColor: BRAND.coral,
            },
          },
          {
            name: 'Spacer1',
            type: 'bar',
            stack: 'total',
            barWidth: 20,
            data: [6, 6, 6],
            itemStyle: { color: 'transparent' },
            tooltip: { show: false },
          },
          {
            name: 'Warning',
            type: 'bar',
            stack: 'total',
            barWidth: 20,
            data: alertData.bar.warning,
            itemStyle: {
              color: BRAND.moon,
              shadowBlur: 10,
              shadowColor: BRAND.moon,
            },
          },
          {
            name: 'Spacer2',
            type: 'bar',
            stack: 'total',
            barWidth: 20,
            data: [6, 6, 6],
            itemStyle: { color: 'transparent' },
            tooltip: { show: false },
          },
          {
            name: 'Normal',
            type: 'bar',
            stack: 'total',
            barWidth: 20,
            itemStyle: { borderRadius: 0, color: '#BF89EF' },
            data: alertData.bar.normal,
          },
        ],
      });

      settleFrame1 = window.requestAnimationFrame(() => {
        resizeCharts();
        settleFrame2 = window.requestAnimationFrame(resizeCharts);
      });
    };

    const waitForLayoutAndApply = () => {
      if (disposed) return;
      if (!hasUsableSize()) {
        retryFrame = window.requestAnimationFrame(waitForLayoutAndApply);
        return;
      }
      applyCharts();
    };

    waitForLayoutAndApply();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(retryFrame);
      window.cancelAnimationFrame(settleFrame1);
      window.cancelAnimationFrame(settleFrame2);
    };
  }, [alertData]);

  const alertLegendItems = [
    { label: 'Critical', color: BRAND.coral },
    { label: 'Warning', color: BRAND.moon },
    { label: 'Normal', color: '#BF89EF' },
  ];

  return (
    <div className="w-full h-full relative flex items-center gap-8">
      <div className="absolute left-1/2 -translate-x-1/2 top-[8px] z-20 pointer-events-none">
        <div className="flex items-center gap-[34px]">
          {alertLegendItems.map((item) => (
            <div key={item.label} className="flex items-center gap-[8px]">
              <span
                className="inline-block w-[9px] h-[9px] rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-[20px] font-medium text-[#8E9AA0] font-montserrat leading-none">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div
        className="w-[40%] h-full relative flex flex-col items-center justify-center"
        style={{ transform: 'translateY(18px) scale(0.82)' }}
      >
        <div className="relative w-full h-full min-h-[200px]">
          <div
            ref={pieRef}
            className="absolute inset-0 z-[1]"
            style={{ transform: 'skew(5deg, 14deg)' }}
          />
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <span className="text-[36px] font-medium text-white font-montserrat">
              <AnimatedNumber value={alertData.total} />
            </span>
          </div>
        </div>
      </div>
      <div className="w-[60%] h-full flex flex-col justify-center">
        <div ref={barRef} className="w-full h-full min-h-[200px]" />
      </div>
    </div>
  );
}

type KPIPeriod = 'today' | 'week' | 'month' | 'all';

const KPI_TABS: { id: KPIPeriod; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'all', label: 'All Time' },
];

const KPI_PERIOD_DATA: Record<
  KPIPeriod,
  { x: string[]; alert: number[]; resolved: number[]; max: number }
> = {
  today: {
    x: ['00', '03', '06', '09', '12', '15', '18', '21'],
    alert: [24, 31, 22, 38, 29, 42, 34, 46],
    resolved: [17, 19, 15, 28, 21, 26, 23, 35],
    max: 60,
  },
  week: {
    x: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    alert: [92, 118, 104, 136, 115, 148, 122],
    resolved: [68, 79, 85, 96, 72, 113, 88],
    max: 180,
  },
  month: {
    x: ['W1', 'W2', 'W3', 'W4'],
    alert: [480, 612, 534, 680],
    resolved: [362, 418, 455, 524],
    max: 800,
  },
  all: {
    x: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'],
    alert: [92, 118, 104, 142, 125, 158, 137, 176, 152, 188],
    resolved: [71, 83, 89, 102, 94, 128, 106, 142, 118, 149],
    max: 220,
  },
};

function HistoricalKPIChart() {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);
  const [period, setPeriod] = useState<KPIPeriod>('all');

  useEffect(() => {
    if (!chartRef.current) return;
    const chart = echarts.init(chartRef.current, null, { renderer: 'svg' });
    chartInstanceRef.current = chart;
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(chartRef.current);
    const firstFrame = window.requestAnimationFrame(() => {
      chart.resize();
      window.requestAnimationFrame(() => chart.resize());
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      ro.disconnect();
      chart.dispose();
      chartInstanceRef.current = null;
    };
  }, []);

  // Auto-rotate tabs every 5s
  useEffect(() => {
    const interval = setInterval(() => {
      setPeriod((prev) => {
        const idx = KPI_TABS.findIndex((t) => t.id === prev);
        return KPI_TABS[(idx + 1) % KPI_TABS.length].id;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const chart = chartInstanceRef.current;
    if (!chart) return;

    const {
      x,
      alert: ALERT_VOLUME,
      resolved: RESOLVED,
      max,
    } = KPI_PERIOD_DATA[period];

    chart.setOption(
      {
        backgroundColor: 'transparent',
        textStyle: { fontFamily: 'Montserrat' },
        grid: { top: 20, right: 30, bottom: 30, left: 60 },
        xAxis: {
          type: 'category',
          boundaryGap: false,
          data: x,
          axisLine: {
            lineStyle: { color: withAlpha(BRAND.lightSilver, 0.28) },
          },
          axisTick: { show: false },
          axisLabel: {
            color: '#FFFFFF',
            fontSize: 18,
            fontFamily: 'Montserrat',
            fontStyle: 'italic',
            rotate: -14,
            margin: 14,
            interval: 0,
          },
          splitLine: { show: false },
        },
        yAxis: {
          type: 'value',
          min: 0,
          max,
          interval: max / 4,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: '#FFFFFF',
            fontSize: 18,
            fontFamily: 'Montserrat',
            fontStyle: 'italic',
            margin: 14,
          },
          splitLine: { show: false },
        },
        series: [
          // Alert Volume — single line with same-hue glow
          {
            name: 'Alert Volume',
            type: 'line',
            smooth: false,
            data: ALERT_VOLUME,
            lineStyle: {
              width: 2.5,
              color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                { offset: 0, color: withAlpha(BRAND.coral, 0) },
                { offset: 0.5, color: BRAND.coral },
                { offset: 1, color: withAlpha(BRAND.coral, 0) },
              ]),
              shadowColor: withAlpha(BRAND.coral, 0.85),
              shadowBlur: 18,
            },
            itemStyle: { color: BRAND.coral },
            symbol: 'none',
            z: 3,
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: withAlpha(BRAND.coral, 0.22) },
                { offset: 1, color: withAlpha(BRAND.coral, 0) },
              ]),
            },
          },
          // Resolved — single line with same-hue glow
          {
            name: 'Resolved',
            type: 'line',
            smooth: false,
            data: RESOLVED,
            lineStyle: {
              width: 2.5,
              color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                { offset: 0, color: withAlpha(BRAND.moon, 0) },
                { offset: 0.5, color: BRAND.moon },
                { offset: 1, color: withAlpha(BRAND.moon, 0) },
              ]),
              shadowColor: withAlpha(BRAND.moon, 0.85),
              shadowBlur: 18,
            },
            itemStyle: { color: BRAND.moon },
            symbol: 'none',
            z: 3,
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: withAlpha(BRAND.moon, 0.22) },
                { offset: 1, color: withAlpha(BRAND.moon, 0) },
              ]),
            },
          },
        ],
        tooltip: {
          trigger: 'axis',
          backgroundColor: withAlpha(BRAND.onyx, 0.92),
          borderColor: BRAND.purple,
          textStyle: {
            color: BRAND.lightSilver,
            fontSize: 16,
            fontFamily: 'Montserrat',
          },
        },
        legend: { show: false },
      },
      true
    );
  }, [period]);

  return (
    <div className="w-full h-full flex flex-col">
      {/* Top bar: tab left edge aligned with Y-axis label left, legend right edge aligned with X-axis right end */}
      <div
        className="flex items-center justify-between shrink-0 mb-[14px]"
        style={{ paddingLeft: 24, paddingRight: 30 }}
      >
        {/* Period tab switcher */}
        <div className="inline-flex h-[32px] border border-[#A54EE1]/30">
          {KPI_TABS.map((tab, idx) => {
            const active = period === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setPeriod(tab.id)}
                className={`px-[24px] text-[16px] uppercase tracking-normal transition-colors font-montserrat whitespace-nowrap ${
                  idx < KPI_TABS.length - 1 ? 'border-r' : ''
                } ${
                  active
                    ? 'bg-[#A54EE1]/15 text-white font-bold'
                    : 'text-[#DDDFE2]/70 hover:text-white hover:bg-[#A54EE1]/8 font-normal'
                }`}
                style={{ borderRightColor: 'rgba(165,78,225,0.3)' }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Custom legend */}
        <div className="flex items-center gap-[24px] font-montserrat text-[20px] text-[#DDDFE2]/85">
          <div className="flex items-center gap-[10px]">
            <span
              className="w-[20px] h-[3px] rounded-full shrink-0"
              style={{
                backgroundColor: BRAND.coral,
                boxShadow: `0 0 8px ${withAlpha(BRAND.coral, 0.6)}`,
              }}
            />
            <span>Alert Volume</span>
          </div>
          <div className="flex items-center gap-[10px]">
            <span
              className="w-[20px] h-[3px] rounded-full shrink-0"
              style={{
                backgroundColor: BRAND.moon,
                boxShadow: `0 0 8px ${withAlpha(BRAND.moon, 0.6)}`,
              }}
            />
            <span>Resolved</span>
          </div>
        </div>
      </div>
      <div ref={chartRef} className="w-full flex-1 min-h-0" />
    </div>
  );
}

const ROOT_CAUSE_REGIONS = ['APAC', 'EMEA', 'Americas', 'Africa'] as const;
type RootCauseRegion = (typeof ROOT_CAUSE_REGIONS)[number];

const ROOT_CAUSE_TYPES = [
  { key: 'hardware', label: 'Hardware Failure' },
  { key: 'fiber', label: 'Fiber Cut' },
  { key: 'power', label: 'Power Failure' },
  { key: 'other', label: 'Other' },
] as const;
type RootCauseTypeKey = (typeof ROOT_CAUSE_TYPES)[number]['key'];

const ROOT_CAUSE_DATA: Record<
  RootCauseRegion,
  Record<RootCauseTypeKey, number>
> = {
  APAC: { hardware: 18, fiber: 6, power: 4, other: 2 },
  EMEA: { hardware: 10, fiber: 12, power: 3, other: 1 },
  Americas: { hardware: 8, fiber: 4, power: 8, other: 2 },
  Africa: { hardware: 4, fiber: 3, power: 2, other: 1 },
};

function rootCauseTypeBaseHex(key: RootCauseTypeKey): string {
  if (key === 'hardware') return BRAND.coral;
  if (key === 'fiber') return BRAND.moon;
  return BRAND.silver;
}

function rootCauseTypeColor(key: RootCauseTypeKey): any {
  const baseHex = rootCauseTypeBaseHex(key);
  const topAlpha = key === 'other' ? 0.55 : 1;
  return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
    { offset: 0, color: withAlpha(baseHex, topAlpha) },
    { offset: 1, color: withAlpha(baseHex, 0) },
  ]);
}

function rootCauseTypeSwatch(key: RootCauseTypeKey): string {
  if (key === 'hardware') return BRAND.coral;
  if (key === 'fiber') return BRAND.moon;
  if (key === 'power') return BRAND.silver;
  return withAlpha(BRAND.silver, 0.55);
}

function RootCauseChart() {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    const chart = echarts.init(chartRef.current, null, { renderer: 'canvas' });
    const categories = [...ROOT_CAUSE_REGIONS];
    chart.setOption({
      backgroundColor: 'transparent',
      textStyle: { fontFamily: 'Montserrat' },
      grid: { top: 24, right: 20, bottom: 0, left: 20, containLabel: true },
      legend: { show: false },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: withAlpha(BRAND.onyx, 0.92),
        borderColor: BRAND.purple,
        textStyle: {
          color: BRAND.lightSilver,
          fontSize: 16,
          fontFamily: 'Montserrat',
        },
      },
      xAxis: {
        type: 'category',
        data: categories,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#FFFFFF', fontSize: 18, fontFamily: 'Montserrat' },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#FFFFFF', fontSize: 18, fontFamily: 'Montserrat' },
        splitLine: {
          lineStyle: {
            color: withAlpha(BRAND.lightSilver, 0.14),
            type: 'dashed',
          },
        },
      },
      series: ROOT_CAUSE_TYPES.map((t) => ({
        name: t.label,
        type: 'bar',
        data: categories.map((region) => ({
          value: ROOT_CAUSE_DATA[region as RootCauseRegion][t.key],
          itemStyle: {
            color: rootCauseTypeColor(t.key),
            borderRadius: 0,
          },
        })),
        barWidth: 18,
        barGap: '20%',
        barCategoryGap: '35%',
        emphasis: { focus: 'series' },
      })),
    });
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(chartRef.current);
    const firstFrame = window.requestAnimationFrame(() => {
      chart.resize();
      window.requestAnimationFrame(() => chart.resize());
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      ro.disconnect();
      chart.dispose();
    };
  }, []);

  const topCombos = useMemo(() => {
    return ROOT_CAUSE_TYPES.map((t) => ({
      type: t,
      value: ROOT_CAUSE_REGIONS.reduce(
        (sum, region) => sum + ROOT_CAUSE_DATA[region][t.key],
        0
      ),
    }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 3);
  }, []);

  const topMax = topCombos[0]?.value ?? 1;

  return (
    <div
      className="w-full h-full flex items-stretch gap-[28px]"
      style={{ letterSpacing: 0 }}
    >
      {/* Left: stacked bar chart — region × failure type */}
      <div className="flex-1 min-w-0 h-full flex flex-col">
        <div className="flex items-center gap-[14px] flex-nowrap justify-center mb-[8px] overflow-hidden">
          {ROOT_CAUSE_TYPES.map((t) => (
            <div
              key={t.key}
              className="flex items-center gap-[6px] text-[15px] text-white whitespace-nowrap shrink-0"
            >
              <span
                className="w-[9px] h-[9px] rounded-[2px] shrink-0"
                style={{ background: rootCauseTypeSwatch(t.key) }}
              />
              <span>{t.label}</span>
            </div>
          ))}
        </div>
        <div ref={chartRef} className="flex-1 min-h-0 w-full" />
      </div>

      {/* Right: Top combinations */}
      <div className="w-[340px] shrink-0 h-full flex flex-col">
        <div className="flex-1 min-h-0 flex flex-col gap-[10px] overflow-hidden">
          {topCombos.map((combo, idx) => {
            const swatch = rootCauseTypeSwatch(combo.type.key);
            const barPct = Math.max(
              6,
              Math.round((combo.value / topMax) * 100)
            );
            return (
              <div
                key={combo.type.key}
                className="flex-1 min-h-0 flex items-center gap-[16px] px-[16px]"
                style={{
                  background: `linear-gradient(90deg, ${swatch}14 0%, rgba(20,12,40,0.35) 80%)`,
                  border: `1px solid ${withAlpha(BRAND.lightSilver, 0.08)}`,
                }}
              >
                <span
                  className="font-art-mono text-[22px] shrink-0"
                  style={{ color: withAlpha(BRAND.lightSilver, 0.55) }}
                >
                  {String(idx + 1).padStart(2, '0')}
                </span>

                <div className="flex-1 min-w-0 flex flex-col gap-[8px]">
                  <div className="flex items-center gap-[10px] min-w-0">
                    <span
                      className="w-[8px] h-[8px] rounded-full shrink-0"
                      style={{
                        background: swatch,
                        boxShadow: `0 0 8px ${swatch}`,
                      }}
                    />
                    <span className="text-[18px] text-white truncate">
                      {combo.type.label}
                    </span>
                  </div>
                  <div className="h-[7px] w-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full"
                      style={{
                        width: `${barPct}%`,
                        background: `linear-gradient(90deg, ${swatch}, ${withAlpha(
                          swatch,
                          0.5
                        )})`,
                        boxShadow: `0 0 6px ${withAlpha(swatch, 0.7)}`,
                      }}
                    />
                  </div>
                </div>

                <div className="font-art-mono text-[26px] text-white shrink-0">
                  {combo.value}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// Metric Icon Badge — circular container matching Figma design
// ----------------------------------------------------
type MetricBadgePalette = {
  ring: string;
  innerRing: string;
  fillFrom: string;
  fillTo: string;
  sweepSoft: string;
  sweepBright: string;
  sweepCore: string;
  iconGlow: string;
};

const METRIC_BADGE_PURPLE: MetricBadgePalette = {
  ring: '#BF89EF',
  innerRing: 'rgba(191,137,239,0.18)',
  fillFrom: '#B441E8',
  fillTo: '#BF89EF',
  sweepSoft: '#C87EFF',
  sweepBright: '#E8AAFF',
  sweepCore: '#FFFFFF',
  iconGlow: 'rgba(180,65,232,0.95)',
};

const METRIC_BADGE_CORAL: MetricBadgePalette = {
  ring: '#FF5E7E',
  innerRing: 'rgba(255,55,94,0.28)',
  fillFrom: '#FF1F4B',
  fillTo: '#FF6F8A',
  sweepSoft: '#FF4A6E',
  sweepBright: '#FF90A8',
  sweepCore: '#FFFFFF',
  iconGlow: 'rgba(255,55,94,1)',
};

const METRIC_BADGE_ORANGE: MetricBadgePalette = {
  ring: '#FF9470',
  innerRing: 'rgba(255,95,29,0.25)',
  fillFrom: '#E84812',
  fillTo: '#FF9470',
  sweepSoft: '#FF8050',
  sweepBright: '#FFBA9A',
  sweepCore: '#FFFFFF',
  iconGlow: 'rgba(255,95,29,1)',
};

function MetricIconBadge({
  IconComp,
  id,
  palette = METRIC_BADGE_PURPLE,
}: {
  IconComp: Icon;
  id: string;
  palette?: MetricBadgePalette;
}) {
  const ringId = `ring-${id}`;
  const fillId = `fill-${id}`;
  const scopeClass = `mi-${id}`;

  return (
    <div
      className="shrink-0 relative w-[84px] h-[84px]"
      style={{ transform: 'rotate(25deg) skewX(8deg) skewY(-15deg)' }}
    >
      {/* Scoped CSS: icon gradient fill only */}
      <style>{`.${scopeClass} svg path { fill: url(#${fillId}); }`}</style>

      {/* SVG layer */}
      <svg
        className="absolute inset-0 pointer-events-none"
        width="84"
        height="84"
      >
        <defs>
          <linearGradient id={ringId} x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={palette.ring} stopOpacity="1" />
            <stop offset="50%" stopColor={palette.ring} stopOpacity="0" />
            <stop offset="100%" stopColor={palette.ring} stopOpacity="1" />
          </linearGradient>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={palette.fillFrom} />
            <stop offset="100%" stopColor={palette.fillTo} stopOpacity="0.5" />
          </linearGradient>
          {/* 光斑渐变：集中在右侧（x≈82），其余透明 */}
          <linearGradient
            id={`sweep-${id}`}
            x1="2"
            y1="42"
            x2="82"
            y2="42"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor={palette.sweepSoft} stopOpacity="0" />
            <stop offset="72%" stopColor={palette.sweepSoft} stopOpacity="0" />
            <stop
              offset="84%"
              stopColor={palette.sweepSoft}
              stopOpacity="0.4"
            />
            <stop
              offset="93%"
              stopColor={palette.sweepBright}
              stopOpacity="0.85"
            />
            <stop offset="98%" stopColor={palette.sweepCore} stopOpacity="1" />
            <stop
              offset="100%"
              stopColor={palette.sweepBright}
              stopOpacity="0.3"
            />
          </linearGradient>
          {/* 宽软发光滤镜 */}
          <filter
            id={`fGlow-${id}`}
            x="-120%"
            y="-120%"
            width="340%"
            height="340%"
          >
            <feGaussianBlur stdDeviation="6" />
          </filter>
          {/* 紧致亮核滤镜 */}
          <filter
            id={`fCore-${id}`}
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
          >
            <feGaussianBlur stdDeviation="1" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* 外圈 */}
        <circle
          cx="42"
          cy="42"
          r="40"
          fill="none"
          stroke={`url(#${ringId})`}
          strokeWidth="1.5"
        />
        {/* 内圈 */}
        <circle
          cx="42"
          cy="42"
          r="29"
          fill="none"
          stroke={palette.innerRing}
          strokeWidth="4"
        />

        {/* 流光：整圆描边 + 渐变光斑 + 旋转 */}
        <g>
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 42 42"
            to="360 42 42"
            dur="2.4s"
            repeatCount="indefinite"
          />
          {/* 宽软发光层 */}
          <circle
            cx="42"
            cy="42"
            r="36"
            fill="none"
            stroke={`url(#sweep-${id})`}
            strokeWidth="4"
            opacity="0.6"
            filter={`url(#fGlow-${id})`}
          />
          {/* 紧致亮核层 */}
          <circle
            cx="42"
            cy="42"
            r="36"
            fill="none"
            stroke={`url(#sweep-${id})`}
            strokeWidth="0.8"
            opacity="1"
            filter={`url(#fCore-${id})`}
          />
        </g>
      </svg>

      {/* Icon */}
      <div
        className={`absolute inset-0 flex items-center justify-center z-10 ${scopeClass}`}
      >
        <IconComp
          weight="fill"
          size={32}
          style={{ filter: `drop-shadow(0 0 8px ${palette.iconGlow})` }}
        />
      </div>
    </div>
  );
}

// ----------------------------------------------------
// Main Art Component
// ----------------------------------------------------
export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<MapRef | null>(null);
  const cameraRef = useRef<ArcRotateCamera | null>(null);

  const runtimeDatasets = useDatasets();
  const fallbackFaultDataset = useDataset('submarine_cable_fault_points_mock');
  const [dataLoaded, setDataLoaded] = useState(false);
  const [cablesData, setNetworksData] = useState<any[]>([]);
  const [popsData, setPopsData] = useState<any>({ features: [] });
  const [countriesData, setCountriesData] = useState<any>(null);
  const [globeWidgetTemplate, setGlobeWidgetTemplate] = useState<any | null>(
    null
  );
  const alarmSourceDatasets = useMemo(() => {
    const configuredLandmarkDatasetIds = new Set<string>();
    const dataConfigs = Array.isArray(globeWidgetTemplate?.dataConfig)
      ? (globeWidgetTemplate.dataConfig as Array<Record<string, unknown>>)
      : [];

    dataConfigs.forEach((item) => {
      const layerConfig =
        (item?.config as Record<string, unknown> | undefined) ?? {};
      if (layerConfig.layerType !== 'landmark') {
        return;
      }
      const datasetId = String(item?.datasetId ?? '').trim();
      if (datasetId) {
        configuredLandmarkDatasetIds.add(datasetId);
      }
    });

    if (configuredLandmarkDatasetIds.size > 0) {
      return Array.from(configuredLandmarkDatasetIds)
        .map((datasetId) =>
          runtimeDatasets.find((dataset) => dataset.id === datasetId)
        )
        .filter((dataset): dataset is NonNullable<typeof dataset> =>
          Boolean(dataset)
        );
    }

    return fallbackFaultDataset ? [fallbackFaultDataset] : [];
  }, [fallbackFaultDataset, globeWidgetTemplate, runtimeDatasets]);
  const alarmLandmarks = useMemo<AlarmLandmarkPoint[]>(() => {
    const rows = alarmSourceDatasets.flatMap((dataset) =>
      Array.isArray(dataset.data) ? dataset.data : []
    );

    return rows
      .map((row): AlarmLandmarkPoint | null => {
        const record = row as Record<string, unknown>;
        const severityText = String(record['Severity'] ?? '')
          .trim()
          .toUpperCase();
        if (severityText !== 'P1' && severityText !== 'P2') {
          return null;
        }

        const lon = Number(record['Longitude']);
        const lat = Number(record['Latitude']);
        if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
          return null;
        }

        const rawNumber = record['Number'];
        const number = String(rawNumber ?? '').trim();
        const refId = String(record['Ref Id'] ?? '').trim();
        if (!number && !refId) {
          return null;
        }

        return {
          number: number || refId,
          numberRaw: rawNumber,
          refId: refId || number,
          refIdRaw: record['Ref Id'],
          lon,
          lat,
          severity: severityText,
          rootCause: String(record['Root cause'] ?? '').trim(),
          faultArea: String(record['Fault area'] ?? '').trim(),
          network: String(record['Network'] ?? '').trim(),
          cableName: String(record['cable_name'] ?? '').trim(),
          createdName: String(record['Created_Name'] ?? '').trim(),
          createdTime: String(record['Created_Time'] ?? '').trim(),
          closedOn: String(record['Closed on'] ?? '').trim(),
          alarmClearTime: String(record['Alarm clear time'] ?? '').trim(),
          pointIndex: String(record['point_index'] ?? '').trim(),
          status: String(record['Status'] ?? '').trim(),
        };
      })
      .filter((item): item is AlarmLandmarkPoint => item !== null);
  }, [alarmSourceDatasets]);

  // const [targetLonLat, setTargetLonLat] = useState<{lon: number, lat: number}>({ lon: 40, lat: 25 });
  const [viewState2D, setViewState2D] = useState({
    longitude: 40,
    latitude: 25,
    zoom: 3.5,
    pitch: 0,
    bearing: 0,
  });

  const [scale, setScale] = useState(1);
  const [currentStory, setCurrentStory] = useState<StoryMode>('GLOBAL');
  const [activeLandmarkIndex, setActiveLandmarkIndex] = useState(0);
  const [cycleStartIndex, setCycleStartIndex] = useState(0);
  const [isAutoCycleEnabled, setIsAutoCycleEnabled] = useState(true);
  const [manualPlaybackRequest, setManualPlaybackRequest] = useState<{
    id: number;
    index: number;
  } | null>(null);
  const [alertPopupPhase, setAlertPopupPhase] = useState<'hidden' | 'visible'>(
    'hidden'
  );
  const [now, setNow] = useState(() => new Date());
  const ledgerViewportRef = useRef<HTMLDivElement | null>(null);
  const ledgerResumeTimerRef = useRef<number | null>(null);
  const [visibleLedgerNumber, setVisibleLedgerNumber] = useState('');
  const ledgerItemRefs = useRef<Array<HTMLDivElement | null>>([]);
  const manualPlaybackRequestIdRef = useRef(0);
  const lastHandledManualPlaybackRequestIdRef = useRef(0);
  const [centerLedgerIndex, setCenterLedgerIndex] = useState(0);
  const requestManualPlayback = useCallback((index: number) => {
    manualPlaybackRequestIdRef.current += 1;
    setManualPlaybackRequest({
      id: manualPlaybackRequestIdRef.current,
      index,
    });
  }, []);
  const config = STORY_CONFIG[currentStory];
  const enableRight3DMapWidget = false;
  const activeLandmark = alarmLandmarks[activeLandmarkIndex] ?? null;
  const activeAlertTemplate =
    ALERT_SEQUENCE[activeLandmark?.severity === 'P2' ? 1 : 0] ??
    ALERT_SEQUENCE[0];
  const activeAlert = useMemo<AlertSequenceItem>(() => {
    if (!activeLandmark) {
      return activeAlertTemplate;
    }

    const isP2 = activeLandmark.severity === 'P2';
    const resolvedTime = activeLandmark.closedOn || activeLandmark.alarmClearTime;
    const durationEnd = activeLandmark.status === 'Done' ? resolvedTime : '';
    return {
      ...activeAlertTemplate,
      ticketId: activeLandmark.number,
      nodeId: activeLandmark.refId || activeAlertTemplate.nodeId,
      location: activeLandmark.faultArea || activeAlertTemplate.location,
      lon: activeLandmark.lon,
      lat: activeLandmark.lat,
      severity: isP2 ? 'WARNING' : 'CRITICAL',
      priority: activeLandmark.severity,
      title: isP2 ? 'SUBMARINE ROUTE DEGRADED' : 'SUBMARINE ROUTE INCIDENT',
      desc: activeLandmark.rootCause || activeAlertTemplate.desc,
      eta: isP2 ? 'PENDING' : activeAlertTemplate.eta,
      region: activeLandmark.faultArea || activeAlertTemplate.region,
      signal: activeLandmark.refId || activeAlertTemplate.signal,
      network: activeLandmark.network || activeAlertTemplate.network,
      cableName: activeLandmark.cableName,
      createdName: activeLandmark.createdName,
      createdAt: activeLandmark.createdTime,
      closedAt: activeLandmark.closedOn,
      alarmClearedAt: activeLandmark.alarmClearTime,
      pointIndex: activeLandmark.pointIndex,
      datasetStatus: activeLandmark.status,
      latitude: activeLandmark.lat,
      longitude: activeLandmark.lon,
      affectedObject:
        activeLandmark.refId || activeAlertTemplate.affectedObject,
      phenomenon: activeLandmark.rootCause || activeAlertTemplate.phenomenon,
      advisory: activeLandmark.status || activeAlertTemplate.advisory,
      startTime: activeLandmark.createdTime || activeAlertTemplate.startTime,
      duration: formatElapsedDuration(activeLandmark.createdTime, durationEnd, now),
      snapshotMetricValue:
        activeLandmark.refId || activeAlertTemplate.snapshotMetricValue,
      metrics: [
        { label: 'Severity', value: activeLandmark.severity },
        { label: 'Ref ID', value: activeLandmark.refId || '--' },
        { label: 'Cable', value: activeLandmark.cableName || '--' },
        { label: 'Status', value: activeLandmark.status || '--' },
      ],
    };
  }, [activeAlertTemplate, activeLandmark, now]);
  const isP1AlarmTone =
    currentStory === 'ALARM_EVENT' &&
    alertPopupPhase === 'visible' &&
    activeAlert.priority === 'P1';

  const storyRef = useRef(currentStory);
  const activeAlertRef = useRef(activeAlert);
  useEffect(() => {
    storyRef.current = currentStory;
  }, [currentStory]);

  useEffect(() => {
    activeAlertRef.current = activeAlert;
  }, [activeAlert]);

  useEffect(() => {
    const postWidgetUpdate = (
      runtimeCameraCommand?: Parameters<typeof buildMiddleEast3dMapWidget>[0]
    ) => {
      window.postMessage(
        {
          type: AI_BOARD_WIDGET_UPDATE_EVENT,
          visdocId: AI_BOARD_VISDOC_ID,
          widget: buildMiddleEast3dMapWidget(runtimeCameraCommand),
        },
        window.location.origin
      );
    };

    if (currentStory !== 'ALARM_EVENT') {
      const issuedAt = Date.now();
      postWidgetUpdate({
        type: 'fly-to',
        commandId: `map-reset-${currentStory}-${issuedAt}`,
        issuedAt,
        lon: MIDDLE_EAST_3D_MAP_CAMERA_VIEW.center.lon,
        lat: MIDDLE_EAST_3D_MAP_CAMERA_VIEW.center.lat,
        bearing: MIDDLE_EAST_3D_MAP_CAMERA_VIEW.bearing,
        pitch: MIDDLE_EAST_3D_MAP_CAMERA_VIEW.pitch,
        cameraDistance: MIDDLE_EAST_3D_MAP_CAMERA_VIEW.cameraDistance,
        durationMs: 1800,
      });
      return;
    }

    const issuedAt = Date.now();
    postWidgetUpdate({
      type: 'fly-to',
      commandId: `alert-focus-${activeAlert.ticketId}-${issuedAt}`,
      issuedAt,
      lon: activeAlert.lon,
      lat: activeAlert.lat,
      bearing: 90,
      pitch: 48,
      pullBackDistance: 500,
      cameraDistance: 200,
      durationMs: ALERT_CAMERA_PULL_BACK_MS + ALERT_CAMERA_PUSH_IN_MS,
      pullBackDurationMs: ALERT_CAMERA_PULL_BACK_MS,
      pushInDurationMs: ALERT_CAMERA_PUSH_IN_MS,
    });

    return undefined;
  }, [currentStory, activeAlert.ticketId, activeAlert.lon, activeAlert.lat]);

  useEffect(() => {
    const handleResize = () => {
      // Fit the full ultra-wide board into the preview frame without cropping.
      setScale(Math.min(window.innerWidth / 7680, window.innerHeight / 1350));
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(resolveWidgetsManifestUrl(), {
          cache: 'no-store',
        });
        if (!response.ok) {
          throw new Error(
            `widgets manifest request failed: ${response.status}`
          );
        }

        const manifest = (await response.json()) as {
          widgets?: Array<Record<string, unknown>>;
        };
        const widget =
          manifest.widgets?.find((item) => item.id === GLOBE_WIDGET_ID) ?? null;
        if (cancelled) return;
        setGlobeWidgetTemplate(widget);
      } catch (error) {
        console.error('[dashboard] failed to load globe widget config', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (alarmLandmarks.length === 0) {
      setActiveLandmarkIndex(0);
      setCycleStartIndex(0);
      return;
    }

    setActiveLandmarkIndex((prev) => prev % alarmLandmarks.length);
    setCycleStartIndex((prev) => prev % alarmLandmarks.length);
  }, [alarmLandmarks.length]);

  useEffect(() => {
    const handleWidgetEvent = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return;
      }

      const message = event.data as {
        type?: string;
        visdocId?: string;
        widgetId?: string;
        eventType?: string;
        payload?: {
          layer?: {
            type?: string;
          };
          datum?: Record<string, unknown>;
        };
      };

      if (message.type !== AI_BOARD_WIDGET_EVENT_MESSAGE_TYPE) {
        return;
      }

      const currentVisdocId = resolveCurrentVisdocId();
      if (!currentVisdocId || message.visdocId !== currentVisdocId) {
        return;
      }

      if (
        message.widgetId !== GLOBE_WIDGET_ID ||
        message.eventType !== 'data-layer:click'
      ) {
        return;
      }

      const layerType = String(message.payload?.layer?.type ?? '')
        .trim()
        .toLowerCase();
      if (layerType !== 'landmark') {
        return;
      }

      const datum = message.payload?.datum ?? {};
      const clickedNumber = String(datum['Number'] ?? '').trim();
      const clickedRefId = String(datum['Ref Id'] ?? '').trim();
      const clickedLon = Number(datum['Longitude']);
      const clickedLat = Number(datum['Latitude']);

      let targetIndex = -1;
      if (clickedNumber) {
        targetIndex = alarmLandmarks.findIndex(
          (landmark) => landmark.number === clickedNumber
        );
      }

      if (targetIndex < 0 && clickedRefId) {
        targetIndex = alarmLandmarks.findIndex(
          (landmark) => landmark.refId === clickedRefId
        );
      }

      if (
        targetIndex < 0 &&
        Number.isFinite(clickedLon) &&
        Number.isFinite(clickedLat)
      ) {
        targetIndex = alarmLandmarks.findIndex(
          (landmark) =>
            Math.abs(landmark.lon - clickedLon) < 1e-6 &&
            Math.abs(landmark.lat - clickedLat) < 1e-6
        );
      }

      if (targetIndex < 0) {
        logGlobeClickDebug('ignore landmark click: no matching point', {
          clickedNumber,
          clickedRefId,
          clickedLon,
          clickedLat,
          landmarksCount: alarmLandmarks.length,
        });
        return;
      }

      logGlobeClickDebug('manual landmark click playback', {
        targetIndex,
        clickedNumber,
        clickedRefId,
      });

      setCurrentStory('ALARM_EVENT');
      setIsAutoCycleEnabled(false);
      setCycleStartIndex(targetIndex);
      requestManualPlayback(targetIndex);
    };

    window.addEventListener('message', handleWidgetEvent);
    return () => {
      window.removeEventListener('message', handleWidgetEvent);
    };
  }, [alarmLandmarks, requestManualPlayback]);

  useEffect(() => {
    if (currentStory !== 'ALARM_EVENT') {
      setAlertPopupPhase('hidden');
      return;
    }

    if (alarmLandmarks.length === 0) {
      setAlertPopupPhase('hidden');
      return;
    }
    if (!globeWidgetTemplate) {
      logGlobeClickDebug('skip cycle effect: globe widget template not ready');
      return;
    }

    const hasManualPlaybackRequest =
      manualPlaybackRequest !== null &&
      manualPlaybackRequest.id !==
        lastHandledManualPlaybackRequestIdRef.current;

    if (!isAutoCycleEnabled && !hasManualPlaybackRequest) {
      logGlobeClickDebug('skip cycle effect: auto cycle disabled', {
        hasManualPlaybackRequest,
      });
      return;
    }

    let cancelled = false;
    const timers = new Set<number>();
    const postGlobeUpdate = (widget: Record<string, unknown>) => {
      const visdocId = resolveCurrentVisdocId();
      if (!visdocId) {
        logGlobeClickDebug('skip widget update: visdoc id not found');
        return;
      }
      logGlobeClickDebug('post widget update', {
        visdocId,
      });
      window.postMessage(
        {
          type: 'zmeta-ai-board-widget:update',
          visdocId,
          widget,
        },
        window.location.origin
      );
    };

    const buildPlaybackWidget = (
      point: AlarmLandmarkPoint,
      animationEnabled: boolean
    ): Record<string, unknown> => {
      const widget = deepClone(globeWidgetTemplate) as Record<string, any>;
      const currentConfig =
        (widget.config as Record<string, unknown> | undefined) ?? {};

      widget.config = {
        ...currentConfig,
        cameraAnimationEnabled: false,
        cameraConfig: {
          ...((currentConfig.cameraConfig as Record<string, unknown>) ?? {}),
          viewLon: point.lon,
          viewLat: point.lat,
          radius: GLOBE_CAMERA_NEAR_RADIUS,
        },
        cameraTransition: {
          enabled: true,
          steps: [
            {
              type: 'tweenCamera',
              to: {
                radius: GLOBE_CAMERA_FAR_RADIUS,
              },
              durationMs: GLOBE_CAMERA_ZOOM_OUT_MS,
            },
            {
              type: 'tweenCamera',
              to: {
                viewLon: point.lon,
                viewLat: point.lat,
                radius: GLOBE_CAMERA_FAR_RADIUS,
              },
              durationMs: GLOBE_CAMERA_MOVE_MS,
            },
            {
              type: 'tweenCamera',
              to: '@final',
              durationMs: GLOBE_CAMERA_ZOOM_IN_MS,
            },
          ],
        },
      };

      if (Array.isArray(widget.dataConfig)) {
        const sourceDataConfig = widget.dataConfig as Record<string, any>[];
        const baseDataConfig = sourceDataConfig.filter((item) => {
          const layerConfig = item?.config as Record<string, any> | undefined;
          return !(
            layerConfig?.layerType === 'landmark' &&
            layerConfig?.layerName === GLOBE_ACTIVE_LANDMARK_LAYER_NAME
          );
        });

        const hasNumberRawValue =
          point.numberRaw !== null &&
          point.numberRaw !== undefined &&
          (typeof point.numberRaw !== 'string' ||
            point.numberRaw.trim().length > 0);
        const activeCategoryField = hasNumberRawValue ? 'Number' : 'Ref Id';
        const activeCategoryValue =
          activeCategoryField === 'Number' ? point.number : point.refId;
        const activeCategoryRawValue =
          activeCategoryField === 'Number' ? point.numberRaw : point.refIdRaw;
        const activeCategoryFilterValue =
          activeCategoryRawValue === null ||
          activeCategoryRawValue === undefined ||
          (typeof activeCategoryRawValue === 'string' &&
            activeCategoryRawValue.trim().length === 0)
            ? activeCategoryValue
            : activeCategoryRawValue;
        const canActivateSinglePoint =
          typeof activeCategoryValue === 'string' &&
          activeCategoryValue.trim().length > 0;

        let activeLayerTemplate: Record<string, any> | null = null;

        const normalizedDataConfig = baseDataConfig.map(
          (item: Record<string, any>) => {
            const layerConfig = item?.config as Record<string, any> | undefined;
            if (!layerConfig || layerConfig.layerType !== 'landmark') {
              return item;
            }

            const layerSeverity = resolveLandmarkLayerSeverity(layerConfig);
            if (layerSeverity === point.severity && !activeLayerTemplate) {
              activeLayerTemplate = item;
            }

            const style = (layerConfig.style as Record<string, any>) ?? {};
            const isActiveSeverityLayer =
              animationEnabled &&
              canActivateSinglePoint &&
              layerSeverity === point.severity;
            const nextFields = Array.isArray(item.fields)
              ? (item.fields as Array<Record<string, any>>).map((field) => ({
                  ...field,
                }))
              : [];
            const hasActiveCategoryField = nextFields.some(
              (field) =>
                String(field?.name ?? '')
                  .trim()
                  .toLowerCase() === activeCategoryField.toLowerCase()
            );
            if (isActiveSeverityLayer && !hasActiveCategoryField) {
              nextFields.push({
                name: activeCategoryField,
                type: 'string',
              });
            }
            const nextFilters = Array.isArray(item.filters)
              ? (item.filters as Array<Record<string, any>>).map((filter) => ({
                  ...filter,
                }))
              : [];
            if (isActiveSeverityLayer) {
              nextFilters.push({
                field: activeCategoryField,
                operator: '!=',
                value: activeCategoryFilterValue,
              });
            }
            return {
              ...item,
              fields: nextFields,
              filters: nextFilters,
              config: {
                ...layerConfig,
                enabled: true,
                style: {
                  ...style,
                  animationEnabled: false,
                },
              },
            };
          }
        );

        if (activeLayerTemplate && animationEnabled && canActivateSinglePoint) {
          const activeConfig = activeLayerTemplate.config as Record<
            string,
            any
          >;
          const activeStyle = (activeConfig.style as Record<string, any>) ?? {};
          const activeFields = Array.isArray(activeLayerTemplate.fields)
            ? (activeLayerTemplate.fields as Array<Record<string, any>>).map(
                (field) => ({ ...field })
              )
            : [];
          const hasActiveCategoryField = activeFields.some(
            (field) =>
              String(field?.name ?? '')
                .trim()
                .toLowerCase() === activeCategoryField.toLowerCase()
          );
          if (!hasActiveCategoryField) {
            activeFields.push({
              name: activeCategoryField,
              type: 'string',
            });
          }
          const activeLayerFilters = Array.isArray(activeLayerTemplate.filters)
            ? (activeLayerTemplate.filters as Array<Record<string, any>>).map(
                (filter) => ({ ...filter })
              )
            : [];
          activeLayerFilters.push({
            field: activeCategoryField,
            operator: '=',
            value: activeCategoryFilterValue,
          });
          normalizedDataConfig.push({
            ...activeLayerTemplate,
            fields: activeFields,
            filters: activeLayerFilters,
            config: {
              ...activeConfig,
              layerName: GLOBE_ACTIVE_LANDMARK_LAYER_NAME,
              enabled: true,
              categoryField: activeCategoryField,
              categoryValue: activeCategoryValue,
              style: {
                ...activeStyle,
                animationEnabled: true,
              },
            },
          });
        } else if (animationEnabled && !canActivateSinglePoint) {
          logGlobeClickDebug(
            'skip active landmark layer: empty category value',
            {
              activeCategoryField,
              activeCategoryValue,
              point,
            }
          );
        }

        widget.dataConfig = normalizedDataConfig;
      }

      return widget;
    };

    const playCycle = (
      index: number,
      options: { allowLoop: boolean; source: 'auto' | 'click' }
    ) => {
      if (cancelled) {
        return;
      }

      const point = alarmLandmarks[index];
      if (!point) {
        logGlobeClickDebug('playCycle abort: point not found', {
          index,
          landmarksCount: alarmLandmarks.length,
        });
        return;
      }
      logGlobeClickDebug('playCycle start', {
        index,
        point,
        source: options.source,
        allowLoop: options.allowLoop,
      });

      setActiveLandmarkIndex(index);
      setAlertPopupPhase('hidden');
      postGlobeUpdate(buildPlaybackWidget(point, false));

      const animateTimer = window.setTimeout(() => {
        if (cancelled) {
          return;
        }
        postGlobeUpdate(buildPlaybackWidget(point, true));
      }, GLOBE_TRANSITION_TOTAL_MS);
      timers.add(animateTimer);

      const revealTimer = window.setTimeout(() => {
        if (cancelled) {
          return;
        }
        setAlertPopupPhase('visible');
      }, POPUP_HIDE_LEAD_MS + GLOBE_TRANSITION_TOTAL_MS);
      timers.add(revealTimer);

      if (options.allowLoop) {
        const nextTimer = window.setTimeout(() => {
          if (cancelled) return;
          const nextIndex = (index + 1) % alarmLandmarks.length;
          logGlobeClickDebug('playCycle schedule next', {
            index,
            nextIndex,
          });
          playCycle(nextIndex, options);
        }, POPUP_HIDE_LEAD_MS + GLOBE_TRANSITION_TOTAL_MS + LANDMARK_PLAY_HOLD_MS);
        timers.add(nextTimer);
      }
    };

    const startIndexSeed =
      hasManualPlaybackRequest && manualPlaybackRequest
        ? manualPlaybackRequest.index
        : cycleStartIndex;
    const normalizedStartIndex =
      ((startIndexSeed % alarmLandmarks.length) + alarmLandmarks.length) %
      alarmLandmarks.length;
    if (hasManualPlaybackRequest && manualPlaybackRequest) {
      lastHandledManualPlaybackRequestIdRef.current = manualPlaybackRequest.id;
    }
    const playbackOptions = {
      allowLoop: !hasManualPlaybackRequest && isAutoCycleEnabled,
      source: hasManualPlaybackRequest ? 'click' : 'auto',
    } as const;
    logGlobeClickDebug('cycle effect start', {
      normalizedStartIndex,
      cycleStartIndex,
      isAutoCycleEnabled,
      hasManualPlaybackRequest,
      source: playbackOptions.source,
    });
    playCycle(normalizedStartIndex, playbackOptions);

    return () => {
      cancelled = true;
      timers.forEach((timerId) => window.clearTimeout(timerId));
    };
  }, [
    currentStory,
    globeWidgetTemplate,
    alarmLandmarks,
    cycleStartIndex,
    isAutoCycleEnabled,
    manualPlaybackRequest,
  ]);

  useEffect(() => {
    if (currentStory !== 'ALARM_EVENT') return;

    let rafId = 0;
    let prevCenterIdx = -1;

    const updateCenterHighlight = () => {
      const viewport = ledgerViewportRef.current;
      if (!viewport) {
        rafId = window.requestAnimationFrame(updateCenterHighlight);
        return;
      }

      const viewportRect = viewport.getBoundingClientRect();
      const viewportCenterY = viewportRect.top + viewportRect.height / 2;
      let closestIdx = -1;
      let closestDistance = Number.POSITIVE_INFINITY;

      ledgerItemRefs.current.forEach((item, idx) => {
        if (!item) return;
        const rect = item.getBoundingClientRect();
        if (rect.bottom <= viewportRect.top || rect.top >= viewportRect.bottom)
          return;
        const itemCenterY = rect.top + rect.height / 2;
        const distance = Math.abs(itemCenterY - viewportCenterY);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIdx = idx;
        }
      });

      if (closestIdx >= 0 && closestIdx !== prevCenterIdx) {
        prevCenterIdx = closestIdx;
        setCenterLedgerIndex(closestIdx);
      }

      rafId = window.requestAnimationFrame(updateCenterHighlight);
    };

    rafId = window.requestAnimationFrame(updateCenterHighlight);
    return () => window.cancelAnimationFrame(rafId);
  }, [currentStory]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cables, pops, world] = await Promise.all([
          fetch('./assets/cables.json').then((r) => r.json()),
          fetch('./assets/pops.geojson').then((r) => r.json()),
          fetch('./assets/world.geojson').then((r) => r.json()),
        ]);
        if (cancelled) return;
        setNetworksData(cables as any[]);
        setPopsData(pops);
        setCountriesData(world);
        setDataLoaded(true);
      } catch (err) {
        console.error('[dashboard] failed to load geo data', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Babylon.js (The 3D Joystick / Generative Sculpture)
  useEffect(() => {
    if (!canvasRef.current || !dataLoaded) return;

    const engine = new Engine(canvasRef.current, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      antialias: true,
    });
    const scene = new Scene(engine);
    scene.clearColor = Color4.FromHexString(ART.void + 'FF'); // Brand Dark Base

    // Camera (Zoomed in for monolithic feel)
    const camera = new ArcRotateCamera(
      'camera',
      -Math.PI / 4,
      Math.PI / 2.5,
      EARTH_RADIUS * 1.6,
      Vector3.Zero(),
      scene
    );
    camera.attachControl(canvasRef.current, true);
    camera.wheelPrecision = 100;
    camera.lowerRadiusLimit = EARTH_RADIUS * 1.1;
    camera.upperRadiusLimit = EARTH_RADIUS * 3;
    cameraRef.current = camera;

    // Lighting — raised for visibility
    const hemiLight = new HemisphericLight(
      'hemiLight',
      new Vector3(0, 1, 0),
      scene
    );
    hemiLight.intensity = 0.28;
    hemiLight.diffuse = Color3.FromHexString('#C0A0FF');
    hemiLight.groundColor = Color3.FromHexString('#1A0840');

    // Ethereal Glow — stronger
    const gl = new GlowLayer('glow', scene, {
      mainTextureFixedSize: 1024,
      blurKernelSize: 64,
    });
    gl.intensity = 1.6;

    // The Void Sphere (Invisible Earth, only grid shows)
    const earth = MeshBuilder.CreateSphere(
      'earth',
      { segments: 128, diameter: EARTH_RADIUS * 2 },
      scene
    );
    const earthMat = new StandardMaterial('earthMat', scene);
    earthMat.diffuseColor = Color3.FromHexString(ART.void);
    earthMat.emissiveColor = Color3.FromHexString(ART.void);
    earthMat.alpha = 0.95;
    earth.material = earthMat;

    // ── Atmospheric glow layers (light purple halo around the earth) ──
    // Inner atmosphere — dense, warm lavender
    const atmo1 = MeshBuilder.CreateSphere(
      'atmo1',
      { segments: 64, diameter: EARTH_RADIUS * 2.06 },
      scene
    );
    const atmo1Mat = new StandardMaterial('atmo1Mat', scene);
    atmo1Mat.emissiveColor = Color3.FromHexString('#7B30C8');
    atmo1Mat.alpha = 0.025;
    atmo1Mat.backFaceCulling = false;
    atmo1Mat.disableLighting = true;
    atmo1.material = atmo1Mat;
    gl.addIncludedOnlyMesh(atmo1);

    // Mid atmosphere — lighter, wider
    const atmo2 = MeshBuilder.CreateSphere(
      'atmo2',
      { segments: 48, diameter: EARTH_RADIUS * 2.18 },
      scene
    );
    const atmo2Mat = new StandardMaterial('atmo2Mat', scene);
    atmo2Mat.emissiveColor = Color3.FromHexString('#9050D0');
    atmo2Mat.alpha = 0.015;
    atmo2Mat.backFaceCulling = false;
    atmo2Mat.disableLighting = true;
    atmo2.material = atmo2Mat;
    gl.addIncludedOnlyMesh(atmo2);

    // Outer corona — very diffuse, barely visible
    const atmo3 = MeshBuilder.CreateSphere(
      'atmo3',
      { segments: 32, diameter: EARTH_RADIUS * 2.38 },
      scene
    );
    const atmo3Mat = new StandardMaterial('atmo3Mat', scene);
    atmo3Mat.emissiveColor = Color3.FromHexString('#8040C0');
    atmo3Mat.alpha = 0.008;
    atmo3Mat.backFaceCulling = false;
    atmo3Mat.disableLighting = true;
    atmo3.material = atmo3Mat;
    gl.addIncludedOnlyMesh(atmo3);

    // Architectural Constellation Grid — brighter
    const grid = MeshBuilder.CreateSphere(
      'grid',
      { segments: 48, diameter: EARTH_RADIUS * 2 + 0.01 },
      scene
    );
    const gridMat = new StandardMaterial('gridMat', scene);
    gridMat.wireframe = true;
    gridMat.emissiveColor = Color3.FromHexString('#6A00BB');
    gridMat.alpha = 0.55;
    grid.material = gridMat;

    // ── Galaxy / Star field — enhanced ──
    const particleSystem = new ParticleSystem('particles', 10000, scene);
    particleSystem.particleTexture = new Texture(
      'https://playground.babylonjs.com/textures/flare.png',
      scene
    );

    const sphereEmitter = particleSystem.createSphereEmitter(
      EARTH_RADIUS * 4.5,
      0
    );
    particleSystem.particleEmitterType = sphereEmitter;
    particleSystem.emitter = Vector3.Zero();

    // Richer star palette: bright white + lavender + soft blue-purple
    particleSystem.color1 = new Color4(1.0, 1.0, 1.0, 0.9); // pure white stars
    particleSystem.color2 = new Color4(0.72, 0.45, 1.0, 0.75); // lavender stars
    particleSystem.colorDead = Color4.FromHexString(ART.void + '00');

    // Varied sizes: tiny pinpoints + occasional larger glows
    particleSystem.minSize = 0.02;
    particleSystem.maxSize = 0.45;

    // Longer lifetime = denser field
    particleSystem.minLifeTime = 6.0;
    particleSystem.maxLifeTime = 20.0;

    // Higher emission rate
    particleSystem.emitRate = 1400;

    particleSystem.blendMode = ParticleSystem.BLENDMODE_ADD;

    particleSystem.gravity = new Vector3(0, 0, 0);
    particleSystem.minEmitPower = 0.005;
    particleSystem.maxEmitPower = 0.03;
    particleSystem.updateSpeed = 0.004;

    particleSystem.start();

    // ── Second particle system for brighter accent stars ──
    const starAccent = new ParticleSystem('starAccent', 2000, scene);
    starAccent.particleTexture = new Texture(
      'https://playground.babylonjs.com/textures/flare.png',
      scene
    );
    const accentEmitter = starAccent.createSphereEmitter(EARTH_RADIUS * 4.2, 0);
    starAccent.particleEmitterType = accentEmitter;
    starAccent.emitter = Vector3.Zero();
    starAccent.color1 = new Color4(0.95, 0.85, 1.0, 1.0); // bright white-lavender
    starAccent.color2 = new Color4(0.8, 0.6, 1.0, 0.85);
    starAccent.colorDead = Color4.FromHexString(ART.void + '00');
    starAccent.minSize = 0.15;
    starAccent.maxSize = 0.55;
    starAccent.minLifeTime = 8.0;
    starAccent.maxLifeTime = 25.0;
    starAccent.emitRate = 150;
    starAccent.blendMode = ParticleSystem.BLENDMODE_ADD;
    starAccent.gravity = new Vector3(0, 0, 0);
    starAccent.minEmitPower = 0.003;
    starAccent.maxEmitPower = 0.015;
    starAccent.updateSpeed = 0.003;
    starAccent.start();

    // Glowing Pillars (Nodes)
    const alertNodes = new globalThis.Map<
      string,
      { pillar: any; material: StandardMaterial; baseColor: Color3 }
    >();
    MOCK_DATACENTERS.forEach((dc, i) => {
      const pos = latLonToVector3(
        dc.coordinates[1],
        dc.coordinates[0],
        EARTH_RADIUS
      );
      const height = 0.15; // uniform small pillars
      const pillar = MeshBuilder.CreateCylinder(
        `dc-${i}`,
        { diameter: 0.02, height },
        scene
      );
      pillar.position = pos.add(pos.normalizeToNew().scale(height / 2));
      pillar.lookAt(Vector3.Zero());
      pillar.rotate(Vector3.Right(), Math.PI / 2);

      const mat = new StandardMaterial(`dcMat-${i}`, scene);
      mat.emissiveColor = getArtColor3(dc.status);
      mat.disableLighting = true;
      pillar.material = mat;
      gl.addIncludedOnlyMesh(pillar);

      alertNodes.set(dc.id, {
        pillar,
        material: mat,
        baseColor: getArtColor3(dc.status),
      });
    });

    // Hairline Gossamer Threads (Networks)
    cablesData.forEach((cable: any, i: number) => {
      const points = cable.coordinates.map((coord: number[]) => {
        return latLonToVector3(coord[1], coord[0], EARTH_RADIUS + 0.02);
      });
      if (points.length < 2) return;

      let isOutage = cable.name === 'SMW4 main';
      let isProtection =
        cable.isProtection || cable.name.toLowerCase().includes('protection');

      // Extremely thin tubes
      let tubeRadius = isOutage ? 0.015 : isProtection ? 0.002 : 0.005;

      const tube = MeshBuilder.CreateTube(
        `cable-${i}`,
        { path: points, radius: tubeRadius, updatable: false },
        scene
      );
      const mat = new StandardMaterial(`cableMat-${i}`, scene);

      if (isOutage) {
        mat.emissiveColor = getArtColor3('critical', true);
      } else {
        mat.emissiveColor = isProtection
          ? Color3.FromHexString('#333333')
          : getArtColor3('normal', true);
      }

      mat.disableLighting = true;
      if (isProtection && !isOutage) mat.alpha = 0.3;
      tube.material = mat;

      if (isOutage) {
        let alpha = 0;
        scene.onBeforeRenderObservable.add(() => {
          alpha += 0.05;
          mat.emissiveColor = Color3.FromHexString(ART.crimson).scale(
            0.4 + Math.abs(Math.sin(alpha)) * 0.6
          );
        });
        gl.addIncludedOnlyMesh(tube);
      } else if (!isProtection) {
        gl.addIncludedOnlyMesh(tube);
        mat.emissiveColor = mat.emissiveColor.scale(0.75); // brighter cables
      }
    });

    // Marker for Focus Points
    const marker = MeshBuilder.CreateSphere(
      'focusMarker',
      { diameter: 0.15 },
      scene
    );
    const markerMat = new StandardMaterial('markerMat', scene);
    markerMat.emissiveColor = Color3.FromHexString(ART.crimson);
    markerMat.disableLighting = true;
    marker.material = markerMat;
    gl.addIncludedOnlyMesh(marker);
    marker.isVisible = false;
    let pulseAlpha = 0;

    const TARGET_LOCATIONS = {
      CABLE_FOCUS: { lon: 35.0, lat: 25.0 },
      DC_FOCUS: { lon: 46.884, lat: 24.829 },
      ALARM_EVENT: { lon: 32.0, lat: 28.0 },
    };

    // Map each alert to its geographic coordinates (so the Earth can fly
    // to the active alert in ALARM_EVENT mode). Uses the alert's explicit
    // lon/lat if provided, otherwise falls back to its node coordinates.
    const ALERT_NODE_COORDS: Record<string, { lon: number; lat: number }> =
      ALERT_SEQUENCE.reduce((acc, item) => {
        acc[item.nodeId] = { lon: item.lon, lat: item.lat };
        return acc;
      }, {} as Record<string, { lon: number; lat: number }>);

    const ACTIVE_ALERT_NODES = ALERT_SEQUENCE.reduce<Record<string, string>>(
      (acc, item) => {
        acc[item.nodeId] = item.severity;
        return acc;
      },
      {}
    );

    // Joystick Tracker
    let lastLon = 0;
    let alertAnimationTick = 0;
    scene.onBeforeRenderObservable.add(() => {
      const story = storyRef.current;
      alertAnimationTick += 0.08;

      alertNodes.forEach(({ material, baseColor }, nodeId) => {
        if (story === 'GLOBAL' && ACTIVE_ALERT_NODES[nodeId]) {
          const currentAlert = activeAlertRef.current;
          const severity = ACTIVE_ALERT_NODES[nodeId];
          const highlight = getArtColor3(severity.toLowerCase());
          if (nodeId === currentAlert.nodeId) {
            const blinkOn = Math.sin(alertAnimationTick * 2.8) > 0;
            material.emissiveColor = blinkOn
              ? highlight.scale(1.8)
              : highlight.scale(0.18);
          } else {
            material.emissiveColor = highlight.scale(0.22);
          }
        } else {
          material.emissiveColor = baseColor.clone();
        }
      });

      if (story === 'GLOBAL') {
        marker.isVisible = false;

        const globalRadius = EARTH_RADIUS * 2.5;
        camera.radius += (globalRadius - camera.radius) * 0.04;
        camera.beta += (Math.PI / 2.15 - camera.beta) * 0.02;
        camera.alpha -= 0.0038;

        let lon = -((camera.alpha * 180) / Math.PI) - 90;
        lon = lon % 360;
        if (lon > 180) lon -= 360;
        if (lon < -180) lon += 360;
        // let lat = 90 - ((camera.beta * 180) / Math.PI);
        if (Math.abs(lon - lastLon) > 0.5) {
          lastLon = lon;
          // setTargetLonLat({ lon, lat });
        }
      } else {
        // In ALARM_EVENT, the Earth follows whichever alert is currently
        // highlighted in the popup carousel.
        let target: { lon: number; lat: number } | undefined;
        if (story === 'ALARM_EVENT') {
          const alertNodeId = activeAlertRef.current?.nodeId;
          target =
            (alertNodeId && ALERT_NODE_COORDS[alertNodeId]) ||
            TARGET_LOCATIONS.ALARM_EVENT;
        } else {
          target = TARGET_LOCATIONS[story as keyof typeof TARGET_LOCATIONS];
        }
        if (target) {
          marker.isVisible = true;
          marker.position = latLonToVector3(
            target.lat,
            target.lon,
            EARTH_RADIUS + 0.05
          );

          pulseAlpha += 0.1;
          const scale = 1 + Math.sin(pulseAlpha) * 0.5;
          marker.scaling.set(scale, scale, scale);

          // Zoom in close to alarm point (ALARM uses a larger radius so the globe is smaller)
          const focusRadius =
            story === 'ALARM_EVENT' ? EARTH_RADIUS * 1.9 : EARTH_RADIUS * 1.55;
          camera.radius += (focusRadius - camera.radius) * 0.04;

          // Camera look-at offset: for ALARM_EVENT, shift camera target to the east
          // so the alert marker ends up on the right half of the Earth viewport,
          // away from the overlaid metric cards on the left.
          const cameraLonOffset = story === 'ALARM_EVENT' ? 38 : 0;
          const cameraLatOffset = story === 'ALARM_EVENT' ? 6 : 0;
          const cameraLon = target.lon + cameraLonOffset;
          const cameraLat = target.lat + cameraLatOffset;

          // Fly Earth camera to target (with optional offset)
          let targetAlphaRad = -((cameraLon + 90) * Math.PI) / 180;
          let targetBetaRad = ((90 - cameraLat) * Math.PI) / 180;

          // Normalize alpha for shortest path
          while (targetAlphaRad - camera.alpha > Math.PI)
            targetAlphaRad -= Math.PI * 2;
          while (targetAlphaRad - camera.alpha < -Math.PI)
            targetAlphaRad += Math.PI * 2;

          camera.alpha += (targetAlphaRad - camera.alpha) * 0.05;
          camera.beta += (targetBetaRad - camera.beta) * 0.05;
        }
      }
    });

    engine.runRenderLoop(() => scene.render());
    const resizeObserver = new ResizeObserver(() => engine.resize());
    resizeObserver.observe(canvasRef.current);
    return () => {
      resizeObserver.disconnect();
      scene.dispose();
      engine.dispose();
    };
  }, [dataLoaded, cablesData]);

  useEffect(() => {
    let zoom = 3.5;
    let pitch = 0;

    if (currentStory === 'GLOBAL') {
      zoom = 3.5;
      pitch = 0;
      setViewState2D((prev) => ({
        ...prev,
        longitude: 45,
        latitude: 24,
        zoom,
        pitch,
        transitionDuration: 1500,
      }));
    } else if (currentStory === 'ALARM_EVENT') {
      // Use the imperative flyTo so the map arcs between alert regions,
      // producing a cinematic "crossing continents" effect that tracks
      // the popup carousel.
      const map = mapRef.current;
      if (map) {
        map.flyTo({
          center: [activeAlert.lon, activeAlert.lat],
          zoom: 3.8,
          pitch: 35,
          duration: 3200,
          curve: 1.6,
          speed: 1.1,
          essential: true,
        });
      } else {
        setViewState2D((prev) => ({
          ...prev,
          longitude: activeAlert.lon,
          latitude: activeAlert.lat,
          zoom: 3.8,
          pitch: 35,
          transitionDuration: 3000,
        }));
      }
    } else {
      let target = { lon: 40, lat: 25 };
      if (currentStory === 'CABLE_FOCUS') {
        zoom = 4.2;
        pitch = 20;
        target = { lon: 35.0, lat: 25.0 };
      } else if (currentStory === 'DC_FOCUS') {
        zoom = 5.0;
        pitch = 35;
        target = { lon: 46.884, lat: 24.829 };
      }

      setViewState2D((prev) => ({
        ...prev,
        longitude: target.lon,
        latitude: target.lat,
        zoom,
        pitch,
        transitionDuration: 1500,
      }));
    }
  }, [currentStory, activeAlert.lon, activeAlert.lat]);

  // Deck.gl Art Layers
  const deckLayers = [
    // Ghostly Wireframe Countries with subtle fill for landmass
    new GeoJsonLayer({
      id: 'countries-ghost',
      data: countriesData,
      stroked: true,
      filled: true,
      lineWidthMinPixels: 1,
      getLineColor: [79, 0, 140, 150], // ART.border (opacity reduced to make base map less intrusive)
      getFillColor: [85, 35, 130, 255], // Brighter purple for the base map landmass
    }),

    // Hairline Constellation Data
    new PathLayer({
      id: 'cables-art',
      data: cablesData,
      pickable: true,
      widthScale: 1,
      widthMinPixels: currentStory === 'CABLE_FOCUS' ? 3 : 2, // keep global cables clearly visible
      widthMaxPixels: currentStory === 'CABLE_FOCUS' ? 6 : 3,
      getPath: (d) => d.coordinates,
      getColor: (d) => {
        if (currentStory === 'CABLE_FOCUS') {
          if (d.name === 'SMW4 main') return getArtColorRGB('critical');
          return [165, 78, 225, 255]; // Highlight all cables in purple
        }
        if (currentStory === 'DC_FOCUS') {
          return [255, 255, 255, 30]; // Dim cables in DC_FOCUS
        }
        if (d.name === 'SMW4 main') return getArtColorRGB('critical');
        if (d.isProtection || d.name.toLowerCase().includes('protection'))
          return [142, 154, 160, 255]; // Silver
        return [255, 255, 255, 220]; // brighter default network lines
      },
      getWidth: (d: any) => (d.name === 'SMW4 main' ? 3 : 1.8),
      getDashArray: (d: any) =>
        d.isProtection && d.name !== 'SMW4 main' ? [2, 4] : [0, 0],
      dashJustified: true,
      extensions: [new PathStyleExtension({ dash: true })],
      updateTriggers: {
        widthMinPixels: [currentStory],
        widthMaxPixels: [currentStory],
        getColor: [currentStory],
      },
    }),

    // Star-like Nodes
    new ScatterplotLayer({
      id: 'pops-art',
      data: popsData?.features || [],
      pickable: true,
      stroked: false,
      filled: true,
      radiusScale: currentStory === 'DC_FOCUS' ? 12 : 6,
      radiusMinPixels: currentStory === 'DC_FOCUS' ? 3 : 1.5,
      radiusMaxPixels: currentStory === 'DC_FOCUS' ? 6 : 3,
      getPosition: (d) => d.geometry.coordinates,
      getFillColor:
        currentStory === 'DC_FOCUS'
          ? [165, 78, 225, 255]
          : [255, 255, 255, 200],
      updateTriggers: {
        radiusScale: [currentStory],
        radiusMinPixels: [currentStory],
        radiusMaxPixels: [currentStory],
        getFillColor: [currentStory],
      },
    }),

    // Data Flows / Light Beams between nodes in DC FOCUS
    new ArcLayer({
      id: 'arcs-art',
      data:
        currentStory === 'DC_FOCUS' || currentStory === 'ALARM_EVENT'
          ? MOCK_DATACENTERS.filter((d) => d.id !== 'RDC103')
          : [],
      getSourcePosition: () => MOCK_DATACENTERS[0].coordinates, // Riyadh Core as hub
      getTargetPosition: (d: any) => d.coordinates,
      getSourceColor: [165, 78, 225, 255], // Moon Light
      getTargetColor: [255, 55, 94, 255], // Coral
      getWidth: 4,
      getHeight: 1.5,
      getTilt: 15,
      updateTriggers: {
        data: [currentStory],
      },
    }),
  ];

  const mapStyle = {
    version: 8,
    sources: {},
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: {
          'background-color': '#05050F',
        },
      },
    ],
  } as const;

  const TAB_ITEMS: { id: StoryMode; label: string }[] = [
    { id: 'GLOBAL', label: 'GLOBAL VIEW' },
    { id: 'ALARM_EVENT', label: 'ALERTS' },
  ];

  const CARD_TITLE =
    'text-[24px] text-white font-semibold leading-[29px] tracking-[0.01em]';
  const dateText = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(now.getDate()).padStart(2, '0')}`;
  const timeText = `${String(now.getHours()).padStart(2, '0')} : ${String(
    now.getMinutes()
  ).padStart(2, '0')} : ${String(now.getSeconds()).padStart(2, '0')}`;

  const renderRightCardShell = (
    title: string,
    body: ReactNode,
    cardHeightClass: string,
    extraClass = ''
  ) => (
    <div
      className={`relative w-full ${cardHeightClass} ${extraClass} overflow-hidden`}
    >
      <div className="absolute inset-[8px] rounded-[10px] bg-[rgba(20,12,40,0.28)] backdrop-blur-[22px] pointer-events-none" />
      <div
        className="absolute inset-0 pointer-events-none box-border"
        style={{
          border: '18px solid transparent',
          borderImageSource: `url(${cardBg})`,
          borderImageSlice: '18 fill',
          borderImageWidth: '18px',
          borderImageRepeat: 'stretch',
        }}
      />
      <div className="absolute inset-x-[30px] top-[22px] h-[29px] flex items-center justify-center">
        <div className="grid grid-cols-[13px_auto_13px] items-center justify-items-center gap-x-[56px]">
          <img
            src={cardTitleArrow}
            alt=""
            className="w-[13px] h-[17px] shrink-0 pointer-events-none select-none"
          />
          <div className="whitespace-nowrap text-center">
            <div
              className={`${CARD_TITLE} drop-shadow-[0_2px_10px_rgba(255,255,255,0.12)]`}
            >
              {title}
            </div>
          </div>
          <img
            src={cardTitleArrow}
            alt=""
            className="w-[13px] h-[17px] shrink-0 rotate-180 pointer-events-none select-none"
          />
        </div>
      </div>
      <div className="absolute left-[18px] right-[18px] top-[58px] h-[7px] flex items-center justify-center pointer-events-none">
        <img
          src={cardDivider}
          alt=""
          className="w-full max-w-[720px] h-[7px] select-none"
        />
      </div>
      <div className="absolute left-[24px] right-[24px] top-[79px] bottom-[24px] z-[1]">
        {body}
      </div>
    </div>
  );

  const renderLeftMetricCard = (
    label: string,
    value: ReactNode,
    IconComp?: Icon,
    variant: 'default' | 'coral' | 'orange' = 'default'
  ) => {
    const iconId = label.toLowerCase().replace(/\s+/g, '-');
    const bgSrc =
      variant === 'coral'
        ? metricCardBgCoral
        : variant === 'orange'
        ? metricCardBgOrange
        : metricCardBg;
    const badgePalette =
      variant === 'coral'
        ? METRIC_BADGE_CORAL
        : variant === 'orange'
        ? METRIC_BADGE_ORANGE
        : METRIC_BADGE_PURPLE;
    return (
      <div className="relative w-[940px] h-[200px] ml-auto">
        <div
          className="absolute inset-0 pointer-events-none box-border"
          style={{
            border: '24px solid transparent',
            borderImageSource: `url(${bgSrc})`,
            borderImageSlice: '24 fill',
            borderImageWidth: '24px',
            borderImageRepeat: 'stretch',
          }}
        />
        <div className="absolute inset-0 px-[86px] flex items-center justify-between gap-[32px]">
          <div className="flex items-center gap-[28px] min-w-0">
            {IconComp && (
              <MetricIconBadge
                IconComp={IconComp}
                id={iconId}
                palette={badgePalette}
              />
            )}
            <div className="text-[44px] text-white font-normal leading-[1.05]">
              {label}
            </div>
          </div>
          <div className="text-white text-[76px] font-medium whitespace-nowrap shrink-0">
            {value}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-screen h-screen bg-[#05050F] flex items-center justify-center overflow-hidden font-montserrat">
      <div
        className="flex bg-[#05050F] overflow-hidden text-white relative"
        style={{
          width: '7680px',
          height: '1350px',
          position: 'absolute',
          backgroundImage: isP1AlarmTone
            ? `
              radial-gradient(ellipse at 50% 50%, rgba(255,55,94,0) 0%, rgba(255,55,94,0) 46%, rgba(255,55,94,0.06) 70%, rgba(255,55,94,0.16) 100%),
              linear-gradient(180deg, rgba(255,55,94,0.14) 0%, rgba(255,55,94,0) 24%, rgba(255,55,94,0) 76%, rgba(255,55,94,0.14) 100%),
              linear-gradient(90deg, rgba(255,55,94,0.14) 0%, rgba(255,55,94,0) 20%, rgba(255,55,94,0) 80%, rgba(255,55,94,0.14) 100%)
            `
            : 'none',
          boxShadow: isP1AlarmTone
            ? `0 0 40px ${withAlpha(
                BRAND.coral,
                0.32
              )}, inset 0 0 140px ${withAlpha(BRAND.coral, 0.12)}`
            : 'none',
          transform: `scale(${scale})`,
          transformOrigin: 'top left', // Scale from the top left corner
          top: '50%',
          left: '50%',
          marginTop: `-${(1350 * scale) / 2}px`, // Manually center it taking scale into account
          marginLeft: `-${(7680 * scale) / 2}px`, // Manually center it taking scale into account
        }}
      >
        {/* Left gutter aligned with Figma */}
        <div
          className="h-full shrink-0 border-r border-white/10 relative"
          style={{ width: '540px' }}
        />

        {/* ========================================================= */}
        {/* ART PIECE 1: THE MONOLITH (3D GLOBE)                      */}
        {/* ========================================================= */}
        <div
          className="h-full relative shrink-0 transition-all duration-700 ease-in-out z-10"
          style={{ width: config.earthWidth, transform: 'translateX(430px)' }}
        >
          {/* Radial backdrop glow — lighter halo behind earth */}
          <div className="absolute inset-0 z-0 pointer-events-none flex items-center justify-center">
            <div
              style={{
                width: '900px',
                height: '900px',
                borderRadius: '50%',
                background:
                  'radial-gradient(ellipse at 50% 40%, rgba(90,20,160,0.38) 0%, rgba(55,12,110,0.22) 38%, rgba(20,5,55,0.10) 62%, transparent 75%)',
                filter: 'blur(18px)',
              }}
            />
          </div>

          <div
            className="absolute inset-0 overflow-hidden pointer-events-auto"
            style={{
              maskImage:
                'linear-gradient(to right, transparent 0%, black 12%, black 82%, transparent 100%)',
              WebkitMaskImage:
                '-webkit-linear-gradient(left, transparent 0%, black 12%, black 82%, transparent 100%)',
              filter: 'saturate(1.46) contrast(1.8) brightness(0.78) hue-rotate(24deg)',
            }}
          >
            <WidgetHost
              id="middle-east-globe"
              className="absolute left-0 top-0 z-0 overflow-hidden bg-transparent"
              minHeight="100%"
              style={{
                width: '100%',
                height: '100%',
                transformOrigin: 'top left',
              }}
            />
            <div
              className="absolute inset-0 z-[2] pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle at 48% 48%, rgba(190,112,255,0.34) 0%, rgba(140,70,230,0.24) 42%, rgba(64,38,160,0.42) 100%)',
                mixBlendMode: 'color',
              }}
            />
            <div
              className="absolute inset-0 z-[3] pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle at 50% 44%, rgba(226,185,255,0.22) 0%, rgba(165,78,225,0.14) 34%, rgba(5,5,15,0) 72%)',
                mixBlendMode: 'screen',
              }}
            />
            <div
              className="absolute inset-0 z-[4] pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle at 46% 42%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.08) 48%, rgba(0,0,0,0.42) 100%)',
                mixBlendMode: 'multiply',
              }}
            />
          </div>

          {/* Aesthetic Center Target / Crosshair */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 opacity-20">
            <div className="w-[300px] h-[300px] border border-[#333] rounded-full transition-all duration-700"></div>
            <div className="absolute w-[320px] h-[1px] bg-[#222]"></div>
            <div className="absolute w-[1px] h-[320px] bg-[#222]"></div>
            <Plus size={16} className="text-white absolute" strokeWidth={1} />
          </div>
        </div>

        {/* ========================================================= */}
        {/* ART PIECE 2: THE CONSTELLATION MAP (2D RIGHT)             */}
        {/* ========================================================= */}
        <div
          className="h-full relative shrink-0 transition-all duration-700 ease-in-out z-10"
          style={{
            width: config.mapWidth,
            maskImage:
              'linear-gradient(to right, transparent 0%, black 20%, black 80%, transparent 100%)',
            WebkitMaskImage:
              '-webkit-linear-gradient(left, transparent 0%, black 20%, black 80%, transparent 100%)',
          }}
        >
          {/* Subtle Grid Background for that "Blueprint" feel */}
          <div
            className="absolute inset-0 z-0 opacity-10"
            style={{
              backgroundImage:
                'linear-gradient(#A54EE1 1px, transparent 1px), linear-gradient(90deg, #A54EE1 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          ></div>

          <div
            className="absolute inset-0 z-[1] overflow-hidden pointer-events-auto"
            style={{
              maskImage:
                'linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)',
              WebkitMaskImage:
                '-webkit-linear-gradient(left, transparent 0%, black 12%, black 88%, transparent 100%)',
              filter: 'saturate(1.25) contrast(1.12) brightness(0.92) hue-rotate(18deg)',
            }}
          >
            <WidgetHost
              id="middle-east-3d-map"
              className="absolute left-0 top-0 z-[1] overflow-hidden bg-transparent"
              minHeight="100%"
              style={{
                width: '100%',
                height: '100%',
                transformOrigin: 'top left',
              }}
            />
            <div
              className="absolute inset-0 z-[2] pointer-events-none"
              style={{
                background:
                  'linear-gradient(90deg, rgba(96,48,180,0.28) 0%, rgba(165,78,225,0.24) 48%, rgba(92,64,210,0.34) 100%)',
                mixBlendMode: 'color',
              }}
            />
            <div
              className="absolute inset-0 z-[3] pointer-events-none"
              style={{
                background:
                  'radial-gradient(ellipse at 50% 50%, rgba(178,104,255,0.16) 0%, rgba(120,60,220,0.08) 46%, rgba(5,5,15,0) 78%)',
                mixBlendMode: 'screen',
              }}
            />
          </div>

          {/* 边缘过渡黑边 */}
          <div className="absolute inset-0 z-10 pointer-events-none shadow-[inset_0_0_200px_100px_#05050F]"></div>

          {/* Minimalist Map Label (Top Right) */}
          <div className="absolute top-10 right-10 pointer-events-none z-10 text-right opacity-0">
            {/* 隐藏之前的Cartography 01 */}
            <h3 className="font-art-title text-[48px] tracking-[0.2em] uppercase text-white transition-opacity">
              Cartography 01
            </h3>
            <div className="font-art-mono text-[24px] text-[#555] tracking-[0.3em] mt-2">
              PLANAR PROJECTION
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* CENTER ALERT POPUP                                          */}
        {/* ========================================================= */}
        <div
          className={`absolute left-[50%] top-[54%] z-[70] ${
            currentStory === 'ALARM_EVENT'
              ? 'pointer-events-none'
              : 'opacity-0 pointer-events-none'
          }`}
          style={{ transform: 'translate(-50%, -50%)' }}
        >
          <div
            className={`relative w-[1020px] h-[960px] transition-all duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)] origin-[0%_50%] ${
              alertPopupPhase === 'hidden'
                ? 'opacity-0 scale-[0.02] -translate-x-[1000px] blur-[12px]'
                : 'opacity-100 scale-100 translate-x-0 blur-0'
            }`}
          >
            <div className="absolute inset-0">
              {renderAlertCardContent(
                activeAlert,
                MOCK_TICKETS.find(
                  (ticketItem) => ticketItem.id === activeAlert.ticketId
                ),
                activeAlert.severity === 'CRITICAL'
              )}
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* TOP RIGHT WIDGET: TIME AND WEATHER                        */}
        {/* ========================================================= */}
        <div className="absolute top-[33px] right-[95px] z-50 flex items-center gap-[58px] font-montserrat text-[#DDDFE2] text-[28px] font-normal leading-none tracking-normal">
          <div>Cloudy</div>
          <div>{dateText}</div>
          <div>{timeText}</div>
        </div>

        {/* Title / Brand aligned to Figma node positions */}
        <div className="absolute left-[26px] top-[0px] z-50">
          <img src={center3Logo} alt="center3" className="h-[100px] w-auto" />
        </div>
        <div className="absolute left-[373px] top-[11px] z-50 text-white text-[64px] font-bold leading-none tracking-normal">
          DATA CENTER MONITORING
        </div>
        {/* 霓虹折角 — smooth sweep via animated gradient stop offsets (no dasharray gap) */}
        <div className="absolute left-[600px] top-[19px] z-50 pointer-events-none">
          <svg
            width="784"
            height="100"
            viewBox="-4 -5 784 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              {/* ── Static base: vivid throughout, peak at corner (~92%) ── */}
              <linearGradient
                id="nBase"
                x1="0"
                y1="81"
                x2="768"
                y2="0"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%" stopColor="#7B2FBE" stopOpacity="0" />
                <stop offset="15%" stopColor="#8B35D0" stopOpacity="0.55" />
                <stop offset="45%" stopColor="#9D40E0" stopOpacity="0.7" />
                <stop offset="72%" stopColor="#B555F5" stopOpacity="0.82" />
                <stop offset="85%" stopColor="#D068FF" stopOpacity="0.93" />
                <stop offset="92%" stopColor="#E87FFF" stopOpacity="1" />
                <stop offset="97%" stopColor="#C060F0" stopOpacity="0.65" />
                <stop offset="100%" stopColor="#9030D0" stopOpacity="0" />
              </linearGradient>

              {/* ── Animated sweep: bright band sliding along gradient ── */}
              <linearGradient
                id="nSweep"
                x1="0"
                y1="81"
                x2="768"
                y2="0"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#E8AAFF" stopOpacity="0">
                  <animate
                    attributeName="offset"
                    values="-0.25;1.05"
                    dur="3s"
                    repeatCount="indefinite"
                    calcMode="linear"
                  />
                </stop>
                <stop stopColor="#FFFFFF" stopOpacity="1">
                  <animate
                    attributeName="offset"
                    values="-0.15;1.15"
                    dur="3s"
                    repeatCount="indefinite"
                    calcMode="linear"
                  />
                </stop>
                <stop stopColor="#E8AAFF" stopOpacity="0">
                  <animate
                    attributeName="offset"
                    values="-0.05;1.25"
                    dur="3s"
                    repeatCount="indefinite"
                    calcMode="linear"
                  />
                </stop>
              </linearGradient>

              {/* ── Filters ── */}
              <filter id="fBase" x="-6%" y="-80%" width="112%" height="260%">
                <feGaussianBlur stdDeviation="7" />
              </filter>
              <filter
                id="fSweepGlow"
                x="-8%"
                y="-120%"
                width="116%"
                height="340%"
              >
                <feGaussianBlur stdDeviation="10" />
              </filter>
              <filter
                id="fSweepCore"
                x="-4%"
                y="-40%"
                width="108%"
                height="180%"
              >
                <feGaussianBlur stdDeviation="2" />
              </filter>
            </defs>

            {/* ── Layer 1: static ambient tube glow ── */}
            <path
              d="M0,81 L713.786,81 C721.624,81 728.81,77.635 732.422,70.678 L768,0"
              stroke="url(#nBase)"
              strokeWidth="10"
              strokeLinecap="round"
              fill="none"
              filter="url(#fBase)"
              opacity="0.85"
            />
            {/* ── Layer 2: static sharp hairline ── */}
            <path
              d="M0,81 L713.786,81 C721.624,81 728.81,77.635 732.422,70.678 L768,0"
              stroke="url(#nBase)"
              strokeWidth="1.5"
              strokeLinecap="round"
              fill="none"
              opacity="1"
            />

            {/* ── Layer 3: sweep — wide soft glow ── */}
            <path
              d="M0,81 L713.786,81 C721.624,81 728.81,77.635 732.422,70.678 L768,0"
              stroke="url(#nSweep)"
              strokeWidth="10"
              strokeLinecap="round"
              fill="none"
              filter="url(#fSweepGlow)"
              opacity="0.6"
            />
            {/* ── Layer 4: sweep — tight bright core ── */}
            <path
              d="M0,81 L713.786,81 C721.624,81 728.81,77.635 732.422,70.678 L768,0"
              stroke="url(#nSweep)"
              strokeWidth="1.5"
              strokeLinecap="round"
              fill="none"
              filter="url(#fSweepCore)"
              opacity="1"
            />
          </svg>
        </div>
        {/* Global / Alerts rail */}
        <div className="absolute left-[40px] top-[450px] z-50">
          <div className="absolute left-0 top-[0px] w-[4px] h-[450px] bg-[#B441E8]/20" />
          <div
            className="absolute left-0 w-[4px] h-[225px] bg-[#8150D7] transition-transform duration-500"
            style={{
              transform: `translateY(${currentStory === 'GLOBAL' ? 0 : 225}px)`,
            }}
          />
          <div className="ml-[50px] mt-[93px] flex flex-col gap-[185px]">
            {TAB_ITEMS.map((tab) => {
              const isActive = currentStory === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setCurrentStory(tab.id)}
                  className={`text-left text-[40px] font-medium leading-none tracking-normal transition-colors ${
                    isActive
                      ? 'text-white drop-shadow-[0_2px_7.3px_rgba(255,255,255,0.5)]'
                      : 'text-[#DDDFE280]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ========================================================= */}
        {/* DATA CARDS (LEFT OF EARTH & RIGHT OF MAP)                 */}
        {/* ========================================================= */}

        {/* --- LEFT CARD --- */}
        <div
          className={`absolute top-1/2 left-[660px] w-[900px] z-40 transition-all duration-700 ease-in-out pointer-events-none flex flex-col ${
            config.leftCard
              ? 'opacity-100 translate-x-0 -translate-y-1/2'
              : 'opacity-0 -translate-x-10 -translate-y-1/2'
          }`}
        >
          <div className="w-full pointer-events-auto flex flex-col gap-0">
            {config.leftCard === 'globalLeft' && (
              <div className="flex flex-col gap-[40px]">
                {renderLeftMetricCard(
                  'Network Count',
                  <AnimatedNumber value={124} />,
                  Network
                )}
                {renderLeftMetricCard(
                  'Countries Covered',
                  <AnimatedNumber value={32} />,
                  Globe
                )}
                {renderLeftMetricCard(
                  'Total PoPs',
                  <AnimatedNumber value={45} />,
                  MapPin
                )}
                {renderLeftMetricCard(
                  'Data Center Count',
                  <AnimatedNumber value={86} />,
                  Database
                )}
              </div>
            )}

            {config.leftCard === 'cableEarthStats' && (
              <div className="flex flex-col gap-[40px]">
                {renderLeftMetricCard(
                  'Total Networks',
                  <AnimatedNumber value={124} />,
                  Network
                )}
                {renderLeftMetricCard(
                  'Total Length',
                  <span className="text-[#A54EE1]">
                    <AnimatedNumber value={1.2} />M{' '}
                    <span className="text-[32px]">km</span>
                  </span>,
                  Ruler
                )}
              </div>
            )}

            {config.leftCard === 'dcEarthStats' && (
              <div className="flex flex-col gap-[40px]">
                {renderLeftMetricCard(
                  'Active PoPs',
                  <AnimatedNumber value={45} />,
                  MapPin
                )}
                {renderLeftMetricCard(
                  'Global Avg PUE',
                  <span className="text-[#A54EE1]">
                    <AnimatedNumber value={1.24} />
                  </span>,
                  Lightning
                )}
              </div>
            )}

            {config.leftCard === 'alarmEarthStats' && (
              <div className="flex flex-col gap-[40px]">
                {renderLeftMetricCard(
                  'Outage Capacity',
                  <span className="inline-flex items-baseline gap-[10px]">
                    <AnimatedNumber value={842} />
                    <span className="text-[32px] font-light">Gbps</span>
                  </span>,
                  Network
                )}
                {renderLeftMetricCard(
                  'Critical',
                  <span className="text-[#FF375E]">
                    <AnimatedNumber value={1} />
                  </span>,
                  Warning,
                  'coral'
                )}
                {renderLeftMetricCard(
                  'Warning',
                  <span className="text-[#FF5F1D]">
                    <AnimatedNumber value={2} />
                  </span>,
                  Warning,
                  'orange'
                )}
              </div>
            )}
          </div>
        </div>

        {/* --- CENTER OVERLAY (Global view only) --- */}
        {false && currentStory === 'GLOBAL' && (
          <div className="absolute top-[116px] bottom-[40px] left-1/2 -translate-x-1/2 z-[35] pointer-events-auto flex flex-col gap-[20px] w-[980px]">
            {/* Card 1 — Impacted Capacity Top N (moved from right panel) */}
            <div className="w-full flex-1 min-h-0">
              {renderRightCardShell(
                'Impacted Capacity Top N',
                <div className="flex flex-col justify-center gap-[22px] h-full px-[26px]">
                  <div className="flex flex-col gap-[12px]">
                    <div className="flex justify-between text-[#DDDFE2] text-[22px] font-light">
                      <span>SMW4_MAIN</span>
                      <span>12.5 Tbps</span>
                    </div>
                    <div className="w-full h-[10px] bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#FF0059] to-[#FF0059]/50 w-[80%]"></div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-[12px]">
                    <div className="flex justify-between text-[#DDDFE2] text-[22px] font-light">
                      <span>EIG_SPLINE</span>
                      <span>8.2 Tbps</span>
                    </div>
                    <div className="w-full h-[10px] bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#A54EE1] to-[#A54EE1]/50 w-[60%]"></div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-[12px]">
                    <div className="flex justify-between text-[#DDDFE2] text-[22px] font-light">
                      <span>NODE_MDC20</span>
                      <span>3.8 Tbps</span>
                    </div>
                    <div className="w-full h-[10px] bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#8E9AA0] to-[#8E9AA0]/50 w-[30%]"></div>
                    </div>
                  </div>
                </div>,
                'h-full'
              )}
            </div>

            {/* Card 2 — Alert Velocity (last 24h) */}
            <div className="w-full flex-1 min-h-0">
              {renderRightCardShell(
                'Alert Velocity · 24H',
                <div className="flex flex-col h-full justify-between gap-[18px] px-[26px]">
                  <div className="flex items-baseline justify-between">
                    <div className="flex items-baseline gap-[16px]">
                      <span className="font-montserrat text-[68px] font-semibold text-white tabular-nums leading-none">
                        27
                      </span>
                      <span className="font-art-mono text-[18px] uppercase tracking-[0.2em] text-[#8E9AA0]">
                        events / day
                      </span>
                    </div>
                    <div className="flex items-center gap-[8px] font-art-mono text-[18px] uppercase tracking-[0.2em] text-[#FF375E]">
                      <span className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[10px] border-b-[#FF375E]" />
                      <span>+34%</span>
                    </div>
                  </div>
                  {/* Tiny sparkline-like bars */}
                  <div className="flex items-end gap-[6px] h-[110px]">
                    {[
                      30, 42, 28, 55, 38, 62, 48, 72, 40, 58, 66, 88, 70, 52,
                      80, 95, 74, 58, 62, 70, 55, 82, 66, 90,
                    ].map((v, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-[2px]"
                        style={{
                          height: `${v}%`,
                          background:
                            v > 80
                              ? 'linear-gradient(180deg,#FF375E,#FF375E88)'
                              : v > 55
                              ? 'linear-gradient(180deg,#A54EE1,#A54EE188)'
                              : 'linear-gradient(180deg,#8E9AA0,#8E9AA088)',
                        }}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between font-art-mono text-[14px] uppercase tracking-[0.2em] text-[#8E9AA0]">
                    <span>00:00</span>
                    <span>06:00</span>
                    <span>12:00</span>
                    <span>18:00</span>
                    <span>NOW</span>
                  </div>
                </div>,
                'h-full'
              )}
            </div>

            {/* Card 3 — Response Team Activity */}
            <div className="w-full flex-1 min-h-0">
              {renderRightCardShell(
                'Response Team Activity',
                <div className="flex flex-col gap-[18px] h-full justify-center px-[26px]">
                  {[
                    {
                      team: 'NOC · Alpha',
                      role: 'Physical Repair',
                      status: 'DISPATCHED',
                      pct: 72,
                      color: '#FF375E',
                    },
                    {
                      team: 'NOC · Beta',
                      role: 'Signal Recovery',
                      status: 'ON SITE',
                      pct: 48,
                      color: '#A54EE1',
                    },
                    {
                      team: 'NOC · Gamma',
                      role: 'Traffic Reroute',
                      status: 'STANDBY',
                      pct: 20,
                      color: '#8E9AA0',
                    },
                  ].map((t) => (
                    <div key={t.team} className="flex flex-col gap-[8px]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-baseline gap-[14px]">
                          <span className="font-art-sans font-light text-[24px] text-white tracking-wide">
                            {t.team}
                          </span>
                          <span className="font-art-mono text-[14px] uppercase tracking-[0.2em] text-[#8E9AA0]">
                            {t.role}
                          </span>
                        </div>
                        <span
                          className="font-art-mono text-[14px] uppercase tracking-[0.25em]"
                          style={{ color: t.color }}
                        >
                          [{t.status}]
                        </span>
                      </div>
                      <div className="relative w-full h-[8px] bg-white/10 overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0"
                          style={{
                            width: `${t.pct}%`,
                            background: `linear-gradient(90deg, ${t.color}, ${t.color}66)`,
                            boxShadow: `0 0 12px ${t.color}`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>,
                'h-full'
              )}
            </div>
          </div>
        )}

        {/* --- MAP LEGEND (Global view only) --- */}
        {currentStory === 'GLOBAL' && (
          <div className="absolute bottom-[40px] left-1/2 -translate-x-1/2 z-[35] pointer-events-none">
            <div className="relative w-[680px]">
              {/* Nine-slice legend background */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  border: '10px solid transparent',
                  borderImageSource: `url(${legendBg})`,
                  borderImageSlice: '10 73 10 72 fill',
                  borderImageWidth: '10px 73px 10px 72px',
                  borderImageRepeat: 'stretch',
                }}
              />

              <div className="relative px-[28px] py-[28px]">
                <div className="flex flex-col gap-[22px]">
                  <div className="flex items-center gap-[16px]">
                    <div className="w-[36px] h-[2px] bg-white shrink-0" />
                    <span className="text-[18px] uppercase tracking-normal text-white/85">
                      Submarine Networks
                    </span>
                  </div>
                  <div className="flex items-center gap-[16px]">
                    <div className="w-[36px] flex justify-center shrink-0">
                      <div className="w-[10px] h-[10px] rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
                    </div>
                    <span className="text-[18px] uppercase tracking-normal text-white/85">
                      PoP Locations
                    </span>
                  </div>
                  <div className="flex items-center gap-[16px]">
                    <div className="w-[36px] flex justify-center shrink-0">
                      <div className="w-[14px] h-[14px] rotate-45 border-[2px] border-[#A54EE1] bg-[rgba(165,78,225,0.25)] shadow-[0_0_10px_#A54EE1]" />
                    </div>
                    <span className="text-[18px] uppercase tracking-normal text-white/85">
                      Data Centers
                    </span>
                  </div>
                  <div className="flex items-center gap-[16px]">
                    <div className="w-[36px] flex justify-center shrink-0">
                      <div className="w-[22px] h-[14px] border border-[rgba(165,78,225,0.7)] bg-[rgba(165,78,225,0.15)]" />
                    </div>
                    <span className="text-[18px] uppercase tracking-normal text-white/85">
                      Countries Covered
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- RIGHT CARD --- */}
        <div
          className={`absolute top-[116px] right-[40px] w-[980px] h-[calc(100%-156px)] z-40 transition-all duration-700 ease-in-out pointer-events-none flex flex-col overflow-hidden ${
            config.rightCard
              ? 'opacity-100 translate-x-0'
              : 'opacity-0 translate-x-10'
          }`}
        >
          <div className="w-full pointer-events-auto flex flex-col gap-0 h-full min-h-0 box-border">
            {config.rightCard === 'globalRight' && (
              <div className="flex flex-col gap-[20px] h-full min-h-0">
                {/* 业务状态概览 */}
                <div className="flex-1 min-h-0">
                  {renderRightCardShell(
                    'Business Status Overview',
                    <BusinessStatusChart />,
                    'h-full'
                  )}
                </div>

                {/* 全球告警态势摘要 (从左下角图片推测) */}
                <div className="flex-1 min-h-0">
                  {renderRightCardShell(
                    'Global Alert Summary',
                    <GlobalAlertSummary />,
                    'h-full'
                  )}
                </div>

                {/* 关键指标历史趋势 */}
                <div className="flex-1 min-h-0">
                  {renderRightCardShell(
                    'Historical KPI Trends',
                    <HistoricalKPIChart />,
                    'h-full'
                  )}
                </div>
              </div>
            )}

            {config.rightCard === 'alarmRight' && (
              <>
                {/* 受损原因分析 */}
                {renderRightCardShell(
                  'Root Cause Distribution',
                  <RootCauseChart />,
                  'h-[380px]',
                  'mb-[20px]'
                )}

                {/* 故障明细 */}
                <div className="flex-1 min-h-0">
                  {renderRightCardShell(
                    'Event Ledger',
                    <div
                      ref={ledgerViewportRef}
                      className="relative h-full w-full overflow-hidden event-ledger-marquee"
                    >
                      <div className="flex flex-col gap-[14px] pr-[8px] animate-ledger-scroll">
                        {[...MOCK_TICKETS, ...MOCK_TICKETS].map((t, idx) => {
                          const accent =
                            t.severity === 'CRITICAL'
                              ? '#FF375E'
                              : t.severity === 'WARNING'
                              ? '#FF5F1D'
                              : '#8E9AA0';
                          const statusColor =
                            LEDGER_STATUS_COLORS[t.status] ?? '#8E9AA0';
                          const isHighlighted = idx === centerLedgerIndex;
                          return (
                            <div
                              key={`${t.id}-${idx}`}
                              ref={(el) => {
                                ledgerItemRefs.current[idx] = el;
                              }}
                              className="relative grid items-center shrink-0 px-[32px] py-[40px] min-h-[240px]"
                              style={{
                                gridTemplateColumns: '3px 1fr auto',
                                columnGap: 32,
                                background: isHighlighted
                                  ? `linear-gradient(90deg, ${accent}2E 0%, rgba(36,22,72,0.72) 55%, rgba(20,12,40,0.5) 100%)`
                                  : `linear-gradient(90deg, ${accent}1A 0%, rgba(20,12,40,0.45) 55%, rgba(20,12,40,0.25) 100%)`,
                                border: isHighlighted
                                  ? `1px solid ${accent}8C`
                                  : `1px solid ${accent}26`,
                                boxShadow: isHighlighted
                                  ? `inset 0 0 0 1px ${withAlpha(
                                      accent,
                                      0.35
                                    )}, 0 0 22px ${withAlpha(accent, 0.35)}`
                                  : `inset 0 0 0 1px transparent, 0 0 0 transparent`,
                                letterSpacing: 0,
                                animation: isHighlighted
                                  ? 'ledgerCardBreath 2.4s ease-in-out infinite'
                                  : 'none',
                              }}
                            >
                              {/* Severity rail */}
                              <div
                                className="self-stretch"
                                style={{
                                  background: accent,
                                  boxShadow: isHighlighted
                                    ? `0 0 20px ${accent}`
                                    : `0 0 14px ${accent}`,
                                }}
                              />

                              {/* Content (stacked: meta + subject) */}
                              <div className="flex flex-col justify-center gap-[30px] min-w-0">
                                {/* Meta row: ID · Location */}
                                <div className="flex items-center gap-[20px] font-art-mono text-[20px] uppercase min-w-0">
                                  <span className="text-white shrink-0">
                                    {t.id}
                                  </span>
                                  <span
                                    className="h-[20px] w-px shrink-0"
                                    style={{
                                      background: 'rgba(255,255,255,0.18)',
                                    }}
                                  />
                                  <span className="inline-flex items-center gap-[8px] text-[#8E9AA0] min-w-0">
                                    <MapPin
                                      size={22}
                                      weight="fill"
                                      className="shrink-0"
                                      style={{ color: '#8E9AA0' }}
                                    />
                                    <span className="truncate">
                                      {t.location}
                                    </span>
                                  </span>
                                </div>

                                {/* Subject (full sentence, may wrap) */}
                                <div className="font-art-sans text-[34px] font-light text-white leading-[1.3]">
                                  {t.subject}
                                </div>
                              </div>

                              {/* Status pill — vertically centered */}
                              <div
                                className="inline-flex items-center gap-[10px] shrink-0 self-center font-art-mono text-[16px] uppercase rounded-full px-[20px] py-[10px]"
                                style={{
                                  backgroundColor: `${statusColor}1F`,
                                  border: isHighlighted
                                    ? `1px solid ${statusColor}AA`
                                    : `1px solid ${statusColor}66`,
                                  color: statusColor,
                                  boxShadow: isHighlighted
                                    ? `0 0 14px ${withAlpha(statusColor, 0.45)}`
                                    : 'none',
                                }}
                              >
                                <span
                                  className="w-[8px] h-[8px] rounded-full"
                                  style={{
                                    background: statusColor,
                                    boxShadow: `0 0 10px ${statusColor}`,
                                  }}
                                />
                                <span>{t.status}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>,
                    'h-full'
                  )}
                </div>
              </>
            )}

            {config.rightCard === 'cableMapStats' && (
              <div className="w-full h-[437px] p-[24px] flex flex-col gap-8 bg-[rgba(56,55,110,0.3)] backdrop-blur-[25px] border border-[rgba(161,115,202,0.2)]">
                <div className="flex items-center gap-4">
                  <div className="w-[8px] h-[8px] bg-[#FF0059] shrink-0" />
                  <h2 className={CARD_TITLE}>Active Routing.</h2>
                </div>
                <div className="w-full h-px bg-white/10 -mt-2" />
                <div className="flex flex-col gap-10 text-[#8E9AA0] text-[24px] tracking-widest">
                  <div>
                    <div className="mb-2 text-white/80 font-light">
                      ACTIVE ROUTES
                    </div>
                    <div className="text-[64px] text-[#A54EE1]">118</div>
                  </div>
                  <div>
                    <div className="mb-2 text-white/80 font-light">
                      REGIONAL FAULTS
                    </div>
                    <div className="text-[64px] text-[#FF375E]">02</div>
                  </div>
                </div>
              </div>
            )}

            {config.rightCard === 'dcMapStats' && (
              <div className="w-full h-[437px] p-[24px] flex flex-col gap-8 bg-[rgba(56,55,110,0.3)] backdrop-blur-[25px] border border-[rgba(161,115,202,0.2)]">
                <div className="flex items-center gap-4">
                  <div className="w-[8px] h-[8px] bg-[#FF0059] shrink-0" />
                  <h2 className={CARD_TITLE}>Regional Metrics.</h2>
                </div>
                <div className="w-full h-px bg-white/10 -mt-2" />
                <div className="flex flex-col gap-10 text-[#8E9AA0] text-[24px] tracking-widest">
                  <div>
                    <div className="mb-2 text-white/80 font-light">
                      NETWORK LATENCY
                    </div>
                    <div className="text-[64px] text-[#FFFFFF]">
                      12<span className="text-[32px]">ms</span>
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 text-white/80 font-light">
                      TRAFFIC LOAD
                    </div>
                    <div className="text-[64px] text-[#A54EE1]">
                      144 <span className="text-[32px]">Tbps</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <style>{`
          .alert-side-stripe-flow {
            background-image: repeating-linear-gradient(
              var(--stripe-angle, -34deg),
              transparent 0 10px,
              var(--stripe-accent) 10px 20px,
              transparent 20px 34px
            );
            background-size: 100% 120px;
            background-position: 0 0;
            animation: alertStripeFlow 1.7s linear infinite, alertStripeBreath 2.6s ease-in-out infinite;
            mask-image: linear-gradient(to bottom, transparent 0%, black 6%, black 94%, transparent 100%);
            -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 6%, black 94%, transparent 100%);
          }
          @keyframes alertStripeFlow {
            0% { background-position: 0 0; }
            100% { background-position: 0 120px; }
          }
          @keyframes alertStripeBreath {
            0%, 100% { opacity: 0.45; filter: saturate(0.95) brightness(0.9); }
            50% { opacity: 1; filter: saturate(1.18) brightness(1.12); }
          }
          @keyframes ledgerCardBreath {
            0%, 100% {
              filter: brightness(1);
            }
            50% {
              filter: brightness(1.16);
            }
          }
          @keyframes p1AlarmBreath {
            0%, 100% {
              opacity: 0.6;
              transform: scale(1);
            }
            50% {
              opacity: 1;
              transform: scale(1.03);
            }
          }
        `}</style>
      </div>
    </div>
  );
}
