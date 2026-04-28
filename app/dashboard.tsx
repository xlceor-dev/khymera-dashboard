"use client"; 
import { useEffect, useState, useRef, useReducer, useCallback } from "react"; 
import { useRef as useMediaRef } from "react";
import MetricCard from "./components/metricCard";
import SparklineChart from "./components/sparklineChart";
import AssistantPanel from "./components/asistantPanel";


function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "dark";
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
  
    const handler = (e: MediaQueryListEvent) => {
      const saved = localStorage.getItem("theme");
      if (!saved) {
        setTheme(e.matches ? "dark" : "light");
      }
    };
  
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  return { theme, setTheme };
  
}


const MAX_HISTORY = 60;  

const initialTelemetryState: TelemetryState = {
  values: {},
  histories: {},
};
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

    for (const key in action.payload) {
      const raw = action.payload[key];
      if (raw === undefined) continue;
    
      const value = Number(raw);
    
      newValues[key] = value;
      const prevHistories = newHistories[key] ?? [];
    
      newHistories[key] = [
        ...prevHistories.slice(-(MAX_HISTORY - 1)),
        { t, value }
      ];
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
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [actuators, setActuators] = useState<any[]>([]);
  const [telemetry, dispatchTelemetry] = useReducer(telemetryReducer, initialTelemetryState)


  const [actuatorValues, setActuatorValues] = useState<ActuatorValues>(() =>
    Object.fromEntries(actuators.map((a) => [a.key, Math.round((a.max - a.min) / 2)]))
  );

  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);

  const { theme, setTheme } = useTheme();

  const addLog = useCallback((type: LogEntry["type"], message: string) => {
    setLog((prev) => [...prev.slice(-99), { time: now(), type, message }]);
  }, []);

  const sendActuator = useCallback(
   async (key: ActuatorKey, value: number) => {
     await fetch("/api/actuator", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ key, value }),
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
        const res = await fetch("/api/assistant", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ input: userText }),
        });
  
        const data: AIResponse = await res.json();
  
        setResponse(data);
        addLog("ai", `IA: "${data.mess?.slice(0, 60)}${(data.mess?.length ?? 0) > 60 ? "…" : ""}"`);
  
        const matchedActuator = actuators.find((a) => a.aiAction === data.act);
        if (matchedActuator && data.inst !== "") {
          sendActuator(matchedActuator.key, Number(data.inst));
        }
      } catch {
        addLog("error", "Error en la API del asistente");
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
        const formData = new FormData();
        formData.append("file", file);
        
        const res = await fetch("/api/assistant/voice", {
          method: "POST",
          body: formData,
        });
        
        const data = await res.json();
        
        setInput(data.transcript || "");
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

  useEffect(() => {
    fetch("/api/sensor")
      .then(res => res.json())
      .then(data => setSensors(data.sensors))
      .catch(() => console.error("Error cargando sensores"));
  }, []);


  useEffect(() => {
    fetch("/api/actuator")
      .then(res => res.json())
      .then(data => setActuators(data.actuators || []))
      .catch(() => console.error("Error cargando actuadores"));
  }, []);

useEffect(() => {
    let active = true;
  
    const connect = () => {
      sseRef.current?.close();
      const es = new EventSource(`http://192.168.4.1/events`);
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
  <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-white text-sm font-sans transition-colors">

    <StatusBar connected={connected} latency={0} theme={theme} setTheme={setTheme} />

    <div className="grid grid-cols-1 md:grid-cols-2 px-4 gap-6">

    <div className="grid gap-3">
      <div className="rounded-xl  p-4 ">
          <div className="grid grid-cols-2 gap-4 ">
          {sensors.map((sensor) => {
            const val = telemetry.values[sensor.key];

            return (
              <MetricCard
                key={sensor.key}
                label={sensor.label}
                value={val !== undefined ? val.toFixed(sensor.decimals ?? 0) : "—"}
                unit={sensor.unit}
                icon={sensor.icon}
                color={sensor.color}
                subtext={sensor.subtext}
              />
            );
          })}
          </div>
        </div>

        <div className="grid gap-4 rounded-xl p-4">
            {sensors.map((sensor) => (
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
      <div className=" rounded-xl  shadow-lg pt-4">
        {actuators.map((actuator) => (
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
function StatusBar({
  connected,
  latency,
  theme,
  setTheme,
}: {
  connected: boolean;
  latency: number;
  theme: "light" | "dark";
  setTheme: (t: "light" | "dark") => void;
}) {
  return (
    <div
      className={`flex items-center justify-between px-5 py-2.5 border-b mb-5 font-mono ${
        connected
          ? "bg-green-100 dark:bg-[#0d3320] border-green-300 dark:border-[#1a6b44]"
          : "bg-red-100 dark:bg-[#3a0d0d] border-red-300 dark:border-[#6b1a1a]"
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
          className={` font-semibold tracking-[0.05em] ${
            connected ? "text-green-300" : "text-red-300"
          }`}
        >
          <h1 className="text-xl font-bold tracking-tight">Khymera Dashboard</h1>
          {connected ? "ESP32 CONECTADO" : "SIN CONEXIÓN — REINTENTANDO..."}
        </span>
      </div>
      <div className="flex gap-5 text-xs text-slate-400">
        {connected && (
          <span>
            LATENCIA: <span className="text-sky-400">—</span>
          </span>
        )}
        <span className="text-gray-500 dark:text-slate-500">{now()}</span>
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="ml-4 px-3 py-1 rounded-md border text-xs font-mono transition"
        >
          {theme === "dark" ? "🌙 Dark" : "☀️ Light"}
        </button>
      </div>
    </div>
  );
}

function ActuatorPanel({
  config,
  currentValue,
  onSend,
}: {
  config: (ActuatorRegistry)[number];
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
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl flex flex-col overflow-hidden min-h-48">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-800 flex justify-between">
        <span className="text-[11px] text-gray-500 dark:text-slate-500 tracking-[0.08em] uppercase font-mono">
          Log de actividad
        </span>
        <span className="text-[10px] text-gray-400 dark:text-slate-700 font-mono">{entries.length} entradas</span>
      </div>
      <div ref={ref} className="max-h-45 overflow-y-auto py-2">
        {entries.length === 0 && (
          <div className="px-4 py-3 text-gray-400 dark:text-slate-700 text-xs font-mono">
            Esperando eventos...
          </div>
        )}
        {entries.map((e, i) => (
          <div
            key={i}
            className="flex gap-2.5 px-4 py-1 text-xs font-mono"
            style={{ borderLeft: `2px solid ${borderColorMap[e.type]}` }}
          >
            <span className="text-gray-400 dark:text-slate-700 min-w-17.5 shrink-0">{e.time}</span>
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
