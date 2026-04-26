type ActuatorKey = (typeof ACTUATOR_REGISTRY)[number]["key"];

type TelemetryPoint = { t: number; value: number };
type TelemetryValues = Partial<Record<SensorKey, number>>;
type TelemetryHistories = Partial<Record<SensorKey, TelemetryPoint[]>>;
//type TelemetryStats = Partial<Record<SensorKey, { min: number; max: number }>>;

type TelemetryAction = {
  type: "UPDATE";
  payload: TelemetryValues;
};

type TelemetryState = {
  values: TelemetryValues;
  histories: TelemetryHistories;
 // stats: TelemetryStats;
};

const initialTelemetryState: TelemetryState = {
  values: {},
  histories: {},
};

type ActuatorValues = Partial<Record<ActuatorKey, number>>;
type AIResponse = { act: string; inst: string; mess: string };
type LogEntry = { time: string; type: "info" | "warn" | "error" | "ai"; message: string };

interface Sensor {
    key: string;
    label: string;
    unit: string;
    icon: string;
    color: string;
    decimals: number;
    subtext: string;
  };

type SensorRegistry = Sensor[];

interface ActuatorPreset {
    label: string;
    value: number;
  }
  
  interface Actuator {
    key: string;
    label: string;
    min: number;
    max: number;
    unit: string;
    color: string;
    presets: ActuatorPreset[];
    aiAction: string;
  }
  
  type ActuatorRegistry =  Actuator[];
