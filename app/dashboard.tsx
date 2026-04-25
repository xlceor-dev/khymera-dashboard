"use client"; 
import { useEffect, useState, useRef, useReducer, useCallback } from "react"; 
import { useRef as useMediaRef } from "react";
import MetricCard from "./components/metricCard";
import OpenAI from "openai";
import SparklineChart from "./components/sparklineChart";
import AssistantPanel from "./components/asistantPanel";


const OPENAI_API_KEY = ""; 
const MAX_HISTORY = 60;  

const initialTelemetryState: TelemetryState = {
  values: {},
  histories: {},
};

const SENSOR_REGISTRY = [
  {
    key: "temp",
    label: "Temperatura",
    unit: "°C",
    icon: "🌡",
    color: "#f97316",
    decimals: 1,
    subtext: undefined as string | undefined,
  },
  {
    key: "adc",
    label: "ADC",
    unit: "",
    icon: "⚡",
    color: "#38bdf8",
    decimals: 0,
    subtext: "0 – 4095",
  },
] as const;

type SensorKey = (typeof SENSOR_REGISTRY)[number]["key"];

const ACTUATOR_REGISTRY = [
    {
      key: "servo",
      label: "Servo",
      min: 0,
      max: 180,
      unit: "°",
      color: "#a78bfa",
      presets: [
        { label: "0°", value: 0 },
        { label: "45°", value: 45 },
        { label: "90°", value: 90 },
        { label: "135°", value: 135 },
        { label: "180°", value: 180 },
      ],
      aiAction: "servo",
    },
  ] as const;
  

  function now() {
    return new Date().toLocaleTimeString("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

function telemetryReducer(state:TelemetryState, action:TelemetryAction) : TelemetryState{
    if(action.type != "UPDATE") return state

    const t = Date.now();
    const newValues = { ...state.values }
    const newHistories = { ...state.histories }

    for(const sensor of  SENSOR_REGISTRY){
        const raw = action.payload[sensor.key]
        if (raw == undefined) continue

        const value = Number(raw)

        newValues[sensor.key] = value
        const prevHistories = newHistories[sensor.key] ?? []

        newHistories[sensor.key] = [
            ...prevHistories.slice(-(MAX_HISTORY - 1)),
            {t, value}
        ]
    }
    return {values:newValues, histories: newHistories}
}


  function clamp(val: number, min: number, max: number) {
    return Math.min(Math.max(val, min), max);
  }


export default function Dashboard() {
    const sseRef = useRef<EventSource | null>(null);
    const lastSentRef = useRef(0);
  const [input, setInput] = useState('');
  const [response, setResponse] = useState<any | null>(null);
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(true)
  const [telemetry, dispatchTelemetry] = useReducer(telemetryReducer, initialTelemetryState)
  // const [inst, setInst] = useState(90)

  const [actuatorValues, setActuatorValues] = useState<ActuatorValues>(() =>
    Object.fromEntries(ACTUATOR_REGISTRY.map((a) => [a.key, Math.round((a.max - a.min) / 2)]))
  );

  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);

  function buildAIInstructions(): string {
    const actuatorDescriptions = ACTUATOR_REGISTRY.map(
      (a) => `"${a.aiAction}" para controlar ${a.label} (rango ${a.min}–${a.max}${a.unit})`
    ).join(", ");
  
    return `Eres un asistente en un dashboard que controla hardware embebido. Sé amable y útil. Puedes responder dudas o controlar actuadores. Responde SOLO en este JSON válido: {"act":"", "inst":"", "mess":""}. En "act" usa: "none" para no actuar, o uno de estos valores para controlar un actuador: ${actuatorDescriptions}. En "inst" pon el valor numérico deseado (deja vacío si act es "none"). En "mess" deja un comentario breve. Si el valor está fuera de rango, usa "none" e informa por qué.`;
  }
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY, dangerouslyAllowBrowser: true });

  const addLog = useCallback((type: LogEntry["type"], message: string) => {
    setLog((prev) => [...prev.slice(-99), { time: now(), type, message }]);
  }, []);

  const sendActuator = useCallback(
    (key: ActuatorKey, rawValue: number) => {
      const config = ACTUATOR_REGISTRY.find((a) => a.key === key);
      if (!config) return;
      const value = clamp(rawValue, config.min, config.max);

      setActuatorValues((prev) => ({ ...prev, [key]: value }));

      fetch(`${ESP32_URL}/${key}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ [key]: value }),
      })
        .then(() => {
          console.log("info", `${config.label} → ${value}${config.unit}`);
        })
        .catch(() => {
          console.log("error", `${config.label} fallo al enviarse`);
        });
    },
    []
  );

  const sendServo = (value: number) => {
    const now = Date.now();
    if (now - lastSentRef.current < 100) return;
    lastSentRef.current = now;
    sendActuator("servo", value);
  };

  const processAIResponse = useCallback(
    async (userText: string) => {
      setLoading(true);
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: buildAIInstructions() },
            { role: "user", content: userText },
          ],
        });
        const content = completion.choices[0].message.content;
        if (!content) return;

        const data: AIResponse = JSON.parse(content);
        setResponse(data);
        addLog("ai", `IA: "${data.mess?.slice(0, 60)}${(data.mess?.length ?? 0) > 60 ? "…" : ""}"`);

        const matchedActuator = ACTUATOR_REGISTRY.find((a) => a.aiAction === data.act);
        if (matchedActuator && data.inst !== "") {
          sendActuator(matchedActuator.key, Number(data.inst));
        }
      } catch {
        addLog("error", "Error en la llamada a la IA");
      } finally {
        setLoading(false);
      }
    },
    [sendActuator, addLog]
  );

  const sendMessage = () => {
    if (!input.trim()) return;
    processAIResponse(input);
  };
  

  const handleVoice = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    audioChunksRef.current = [];

    mediaRecorder.ondataavailable = (event) => {
      audioChunksRef.current.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      const file = new File([audioBlob], "voice.webm", { type: "audio/webm" });

      try {
        const transcription = await openai.audio.transcriptions.create({
          file,
          model: "whisper-1",
        });

        const text = transcription.text;
        setInput(text);

        const completion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: buildAIInstructions() },
            { role: "user", content: text },
          ],
        });

        const res = completion.choices[0].message;
        if (!res.content) return;

        let data;
        try {
          data = JSON.parse(res.content);
        } catch (e) {
          console.error("Whisper Error", res.content);
          return;
        }

        setResponse(data);

        if (data.act === "servo" && data.inst !== "") {
          sendServo(Number(data.inst));
        }
      } catch (err) {
        console.error("Error con Whisper o Chat:", err);
      }
    };

    mediaRecorder.start();
    setRecording(true);
  };

const ESP32_URL = "http://192.168.0.159";


useEffect(() => {
    let active = true;
  
    const connect = () => {
      sseRef.current?.close();
      const es = new EventSource(`${ESP32_URL}/events`);
      sseRef.current = es;
  
      es.onopen = () => {
        if (active) setConnected(true);
      };
  
      es.addEventListener("telemetry", (e) => {
        try {
          const data = JSON.parse(e.data);
          dispatchTelemetry({ type: "UPDATE", payload: data });
        } catch (err) {
          console.error("SSE parse error", err);
        }
      });
  
      es.onerror = () => {
        if (active) {
          setConnected(false); 
          es.close();
          setTimeout(connect, 3000); 
        }
      };
    };
  
    connect();
  
    return () => {
      active = false;
      sseRef.current?.close();
    };
  }, []);

  

  return (
  <div className="min-h-screen bg-gray-950 text-white  font-sans">

    <StatusBar connected={connected} latency={0} />

    <div className="grid grid-cols-1 md:grid-cols-2 px-4 gap-6">

    <div className="grid gap-3">
      <div className="rounded-xl bg-gray-900/70 p-4 ">
          <div className="grid grid-cols-2 gap-4 ">
          {SENSOR_REGISTRY.map((sensor) => {
              const val = telemetry.values[sensor.key];
              return (
                <MetricCard
                  key={sensor.key}
                  label={sensor.label}
                  value={val !== undefined ? val.toFixed(sensor.decimals) : "—"}
                  unit={sensor.unit}
                  icon={sensor.icon}
                  color={sensor.color}
                  subtext={sensor.subtext}
                />
              );
            })}
          </div>
        </div>
        
        <div className="grid gap-4 rounded-xl bg-gray-900/70 p-4">
            {SENSOR_REGISTRY.map((sensor) => (
              <SparklineChart
              key={sensor.key}
              data={telemetry.histories[sensor.key] ?? []}
              color={sensor.color}
              label={`${sensor.label} histórico`}
              unit={sensor.unit}
              height={80}
            />
          ))}
          </div>
    </div>
    <div className="grid items-start gap-5">
      <div className="bg-gray-900 rounded-xl border border-gray-800 shadow-lg p-4">
        {ACTUATOR_REGISTRY.map((actuator) => (
          <ActuatorPanel
            key={actuator.key}
            config={actuator}
            currentValue={actuatorValues[actuator.key] ?? actuator.min}
            onSend={sendActuator}
          />
        ))}
      </div>
      <LogPanel entries={log} />
    </div>
    <button className=" flex p-5 bg-black rounded-full w-14 h-14 items-center justify-center fixed bottom-10 right-10 border border-white/20" onClick={() => setVisible(!visible)}>
      o
    </button>

    </div>
      {visible &&     
      <div className=" transform-cpu transition-all duration-300">
        <div className="fixed bottom-28 right-20 w-xl shadow-2xl">
          <AssistantPanel
            onSendText={sendMessage}
            onVoice={handleVoice}
            recording={recording}
            response={response}
            loading={loading}
            input={input}
            setInput={setInput}
          />
      </div>
      </div>}
  </div>
);
}
function StatusBar({ connected, latency }: { connected: boolean; latency: number }) {
  return (
    <div
      className={`flex items-center justify-between px-5 py-2.5 border-b mb-5 font-mono ${
        connected
          ? "bg-[#0d3320] border-[#1a6b44]"
          : "bg-[#3a0d0d] border-[#6b1a1a]"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <div
          className={`w-2.5 h-2.5 rounded-full ${
            connected
              ? "bg-green-500 shadow-[0_0_8px_#22c55e]"
              : "bg-red-500 shadow-[0_0_8px_#ef4444]"
          }`}
        />
        
        <span
          className={`text-[13px] font-semibold tracking-[0.05em] ${
            connected ? "text-green-300" : "text-red-300"
          }`}
        >
            <h1 className="text-3xl font-bold tracking-tight">Khymera Dashboard</h1>
          {connected ? "ESP32 CONECTADO" : "SIN CONEXIÓN — REINTENTANDO..."}
        </span>
        
      </div>
      <div className="flex gap-5 text-xs text-slate-400">
        {connected && (
          <span>
            LATENCIA: <span className="text-sky-400">—</span>
          </span>
        )}
        <span className="text-slate-500">{now()}</span>
      </div>
    </div>
  );
}

function ActuatorPanel({
  config,
  currentValue,
  onSend,
}: {
  config: (typeof ACTUATOR_REGISTRY)[number];
  currentValue: number;
  onSend: (key: ActuatorKey, value: number) => void;
}) {
  const [localVal, setLocalVal] = useState(currentValue);
  useEffect(() => setLocalVal(currentValue), [currentValue]);

  const { key, label, min, max, unit, color, presets } = config;
  const normalized = (clamp(currentValue, min, max) - min) / (max - min);

  const isArc = min === 0 && max === 180;

  const cx = 60;
  const cy = 65;
  const r = 45;
  const servoThumbAngle = ((clamp(localVal, min, max) - min) / (max - min) * Math.PI) - Math.PI;
  const stx = cx + r * Math.cos(servoThumbAngle);
  const sty = cy + r * Math.sin(servoThumbAngle);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-4.5 flex flex-col gap-3.5">
      <div className="flex justify-between items-center">
        <span className="text-[11px] text-slate-500 tracking-[0.08em] uppercase font-mono">
          Control — {label}
        </span>
        <span className="text-[22px] font-extrabold font-mono" style={{ color }}>
          {currentValue}
          {unit}
        </span>
      </div>

      {isArc ? (
        <div className="flex justify-center">
          <svg width={120} height={75} viewBox="0 0 120 75">
            <path
              d="M 15 65 A 45 45 0 0 1 105 65"
              stroke="#1e293b"
              strokeWidth={8}
              fill="none"
              strokeLinecap="round"
            />
            <path
              d={`M 15 65 A 45 45 0 0 1 ${stx} ${sty}`}
              stroke={color}
              strokeWidth={4}
              fill="none"
              strokeLinecap="round"
            />
            <circle cx={stx} cy={sty} r={6} fill={color} />
            <circle cx={60} cy={65} r={5} fill="#334155" />
            <text x={10} y={75} fontSize={9} fill="#334155">
              {min}°
            </text>
            <text x={96} y={75} fontSize={9} fill="#334155">
              {max}°
            </text>
          </svg>
        </div>
      ) : (
        <div className="h-2 bg-slate-800 rounded overflow-hidden">
          <div
            className="h-full rounded transition-[width] duration-200"
            style={{ width: `${normalized * 100}%`, background: color }}
          />
        </div>
      )}

      <input
        type="range"
        min={min}
        max={max}
        value={localVal}
        onChange={(e) => {
          const v = Number(e.target.value);
          setLocalVal(v);
          onSend(key, v);
        }}
        className="w-full"
        style={{ accentColor: color }}
      />

      <div className="flex gap-1.5 flex-wrap">
        {presets.map((p) => (
          <button
            key={p.value}
            onClick={() => {
              setLocalVal(p.value);
              onSend(key, p.value);
            }}
            className="flex-1 py-1.5 rounded-lg text-xs font-mono cursor-pointer transition-colors"
            style={{
              background: currentValue === p.value ? `${color}22` : "transparent",
              border: `1px solid ${currentValue === p.value ? color : "#1e293b"}`,
              color: currentValue === p.value ? color : "#64748b",
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="number"
          min={min}
          max={max}
          value={localVal}
          onChange={(e) => setLocalVal(Number(e.target.value))}
          className="flex-1 bg-[#020617] border border-slate-800 rounded-lg px-3 py-2 font-mono text-[15px] outline-none"
          style={{ color }}
        />
        <button
          onClick={() => onSend(key, localVal)}
          className="px-4 py-2 rounded-lg font-semibold cursor-pointer text-[13px] transition-opacity hover:opacity-80"
          style={{
            background: color + "33",
            border: `1px solid ${color}66`,
            color,
          }}
        >
          Enviar
        </button>
      </div>
    </div>
  );
}

function LogPanel({ entries }: { entries: LogEntry[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [entries]);

  const colorMap = {
    info: "#38bdf8",
    warn: "#f59e0b",
    error: "#ef4444",
    ai: "#a78bfa",
  };

  const borderColorMap = {
    info: "#38bdf822",
    warn: "#f59e0b22",
    error: "#ef444422",
    ai: "#a78bfa22",
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col overflow-hidden min-h-48">
      <div className="px-4 py-3 border-b border-slate-800 flex justify-between">
        <span className="text-[11px] text-slate-500 tracking-[0.08em] uppercase font-mono">
          Log de actividad
        </span>
        <span className="text-[10px] text-slate-700 font-mono">{entries.length} entradas</span>
      </div>
      <div ref={ref} className="max-h-45 overflow-y-auto py-2">
        {entries.length === 0 && (
          <div className="px-4 py-3 text-slate-700 text-xs font-mono">
            Esperando eventos...
          </div>
        )}
        {entries.map((e, i) => (
          <div
            key={i}
            className="flex gap-2.5 px-4 py-1 text-xs font-mono"
            style={{ borderLeft: `2px solid ${borderColorMap[e.type]}` }}
          >
            <span className="text-slate-700 min-w-17.5 shrink-0">{e.time}</span>
            <span className="min-w-10 shrink-0" style={{ color: colorMap[e.type] }}>
              [{e.type.toUpperCase()}]
            </span>
            <span className="text-slate-400 leading-relaxed">{e.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
