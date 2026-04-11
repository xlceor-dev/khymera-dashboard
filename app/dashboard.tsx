"use client"; 
import { useEffect, useState, useRef } from "react"; 
import { useRef as useMediaRef } from "react";
import OpenAI from "openai";


const WS_URL = "ws://192.168.1.75/ws";
const OPENAI_API_KEY = ""; 

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
  
  type ActuatorKey = (typeof ACTUATOR_REGISTRY)[number]["key"];

const sendMessage = async ({instructions, input, openai, setResponse, sendServo}:{instructions:string, input:string, openai: OpenAI, setResponse(response:string):void, sendServo(value: number): void }) => {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o", 
      messages: [{ role: "system", content: instructions }, { role: "user", content: input }],
    });
    const res = completion.choices[0].message;
    if (!res.content) return;
    
    console.log(res);

    let data;
    
    try {
      data = JSON.parse(res.content);
    } catch (e) {
      console.error("AI error", res.content);
      return;
    }
    
    setResponse(data);
    
    if (data.act === "servo") {
      if (data.inst !== "") {
        sendServo(Number(data.inst));
      }
    }
  };


export default function Dashboard() {
  const ws = useRef<WebSocket | null>(null);
  const [servo, setServo] = useState(90);
  const [temp, setTemp] = useState(0);
  const [adc, setAdc] = useState(0);
  const [input, setInput] = useState('Mueve el servo a 90 grados');
  const [response, setResponse] = useState<any | null>(null);
  const [connected, setConnected] = useState(false)
  // const [inst, setInst] = useState(90)

  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const instructions = 'Eres un asistente en un dashboard que controla un sistema de servos. Se amable, servicial, y util. Puedes responder dudas generales, dudas relacionadas al sistema, o controlar los servomotores. Debes responder en este formato: {"act":"", "inst":"", "mess":""}. En act, puedes usar "none" para no realizar una accion, o "servo" para controlar el servomotor. si usas "servo", en inst:"" debes poner el angulo deseado entre 0 y 180 grados. Si el usuario desea un valor que no entre en ese rango, debes usar "none" y informar que la accion es imposible de realizar, y por que. Al usar "none", puedes dejar inst vacio. Por ultimo, en mess:"" debes dejar un comentario, ya sea respondiendo una consulta o informando lo que se hizo de elegir "servo". Responde solo en JSON valido'

  const openai = new OpenAI({ apiKey: OPENAI_API_KEY, dangerouslyAllowBrowser: true });
  

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
            { role: "system", content: instructions },
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

  useEffect(() => {
    let retryTimeout: any;
  
    const connect = () => {
      ws.current = new WebSocket(WS_URL);
  
      ws.current.onopen = () => {
        console.log("WebSocket conectado");
        setConnected(true);
      };
  
      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.temp !== undefined) setTemp(data.temp);
          if (data.adc !== undefined) setAdc(data.adc);
        } catch (e) {
          console.error("Error parseando JSON", e);
        }
      };
  
      ws.current.onclose = () => {
        console.log("WebSocket cerrado, reintentando...");
        setConnected(false);
        retryTimeout = setTimeout(connect, 2000); // reintenta cada 2s
      };
  
      ws.current.onerror = () => {
        setConnected(false);
        ws.current?.close(); // fuerza onclose → retry
      };
    };
  
    connect();
  
    return () => {
      clearTimeout(retryTimeout);
      ws.current?.close();
    };
  }, []);

  const sendServo = (value: number) => {
    setServo(value);
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ servo: value }));
    }
  };

  return (
  <div className="min-h-screen bg-gray-950 text-white p-6 font-sans">
    {/* Header */}
    <div className="flex items-center justify-between mb-6">
      <h1 className="text-3xl font-bold tracking-tight">Khymera Dashboard</h1>
      <div className={`px-4 py-2 rounded-full text-sm font-semibold ${connected ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
        {connected ? "● En línea" : "● Sin conexión"}
      </div>
    </div>

    {/* Grid Layout */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

      {/* Sensors Card */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 shadow-lg p-4">
        <h2 className="text-lg font-semibold mb-4 text-blue-400">Sensores</h2>
        <div className="grid grid-cols-2 gap-4">
          {SENSOR_REGISTRY.map((sensor) => {
            let value: number | string = "—";
            if (sensor.key === "temp") value = temp.toFixed(sensor.decimals);
            if (sensor.key === "adc") value = adc;

            return (
              <div key={sensor.key} className="bg-gray-800 rounded-lg p-4 flex flex-col gap-2">
                <div className="text-sm opacity-70">{sensor.icon} {sensor.label}</div>
                <div className="text-2xl font-bold">
                  {value} {sensor.unit}
                </div>
                {sensor.subtext && (
                  <div className="text-xs opacity-50">{sensor.subtext}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Actuators Card */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 shadow-lg p-4">
        <h2 className="text-lg font-semibold mb-4 text-purple-400">Actuadores</h2>
        {ACTUATOR_REGISTRY.map((actuator) => (
          <div key={actuator.key} className="bg-gray-800 rounded-lg p-4 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">{actuator.label}</h3>
              <span className="text-lg">{servo}{actuator.unit}</span>
            </div>

            <input
              type="range"
              min={actuator.min}
              max={actuator.max}
              value={servo}
              onChange={(e) => sendServo(Number(e.target.value))}
              className="w-full accent-purple-500"
            />

            <div className="flex flex-wrap gap-2">
              {actuator.presets.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => sendServo(preset.value)}
                  className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded transition"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Assistant Card */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 shadow-lg p-4 md:col-span-2">
        <h2 className="text-lg font-semibold mb-4 text-cyan-400">Asistente</h2>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe una instrucción..."
          className="w-full h-28 p-3 bg-gray-800 rounded-lg font-mono mb-3 resize-none outline-none focus:ring-2 focus:ring-cyan-500"
        />

        <div className="flex gap-3 mb-4">
          <button
            onClick={() => sendMessage({instructions, input, openai, setResponse, sendServo})}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded transition"
          >
            Enviar
          </button>

          <button
            onClick={handleVoice}
            className={`px-4 py-2 rounded transition ${recording ? "bg-red-600 hover:bg-red-500" : "bg-green-600 hover:bg-green-500"}`}
          >
            {recording ? "Detener" : "Hablar"}
          </button>
        </div>

        {/* Response */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-sm">
          <div className="bg-emerald-500/10 p-3 rounded">
            <strong>act:</strong> {response?.act ?? "—"}
          </div>
          <div className="bg-amber-500/10 p-3 rounded">
            <strong>inst:</strong> {response?.inst ?? "—"}
          </div>
          <div className="bg-blue-500/10 p-3 rounded md:col-span-3">
            <strong>mess:</strong> {response?.mess ?? "—"}
          </div>
        </div>
      </div>

    </div>
  </div>
);
}
