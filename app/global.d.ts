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