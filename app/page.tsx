"use client"; 
import { useEffect, useState, useRef } from "react"; 
import { useRef as useMediaRef } from "react";
import OpenAI from "openai";


export default function Home() {
  const ws = useRef<WebSocket | null>(null);
  const [servo, setServo] = useState(90);
  const [temp, setTemp] = useState(0);
  const [adc, setAdc] = useState(0);
  const [input, setInput] = useState('Mueve el servo a 90 grados');
  const [response, setResponse] = useState<any | null>(null);
  // const [inst, setInst] = useState(90)

  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const instructions = 'Eres un asistente en un dashboard que controla un sistema de servos. Se amable, servicial, y util. Puedes responder dudas generales, dudas relacionadas al sistema, o controlar los servomotores. Debes responder en este formato: {"act":"", "inst":"", "mess":""}. En act, puedes usar "none" para no realizar una accion, o "servo" para controlar el servomotor. si usas "servo", en inst:"" debes poner el angulo deseado entre 0 y 180 grados. Si el usuario desea un valor que no entre en ese rango, debes usar "none" y informar que la accion es imposible de realizar, y por que. Al usar "none", puedes dejar inst vacio. Por ultimo, en mess:"" debes dejar un comentario, ya sea respondiendo una consulta o informando lo que se hizo de elegir "servo". Responde solo en JSON valido'

  const openai = new OpenAI({ apiKey: "", dangerouslyAllowBrowser: true });
  
  const sendMessage = async () => {
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
    ws.current = new WebSocket(`ws://192.168.1.75/ws`);


    ws.current.onopen = () => {
      console.log("WebSocket conectado");
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
      console.log("WebSocket cerrado");
    };

    return () => {
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
    <div style={{ padding: 20, fontFamily: "sans-serif" }}>
      <h1>Servos + telemetry</h1>

      <h2>Servo: {servo}°</h2>
      <input
        type="range"
        min="0"
        max="180"
        value={servo}
        onChange={(e) => sendServo(Number(e.target.value))}
        style={{ width: "100%" }}
      />

      <hr />

      <h2>Temperatura: {temp.toFixed(1)} °C</h2>
      <h2>ADC: {adc}</h2>

      <hr />

      <h2>Asistente</h2>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Escribe una instrucción..."
        style={{
          width: "100%",
          height: "100px",
          padding: "10px",
          marginBottom: "10px",
          fontFamily: "monospace"
        }}
      />

      <button
        onClick={sendMessage}
        style={{
          padding: "10px 20px",
          backgroundColor: "#2563eb",
          color: "white",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer"
        }}
      >
        Enviar al asistente
      </button>
      <button
        onClick={handleVoice}
        style={{
          padding: "10px 20px",
          backgroundColor: recording ? "#dc2626" : "#16a34a",
          color: "white",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
          marginLeft: "10px"
        }}
      >
        {recording ? "Detener grabación" : "Hablar"}
      </button>

      <div style={{
        background: "#1f2937",
        padding: "10px",
        borderRadius: "8px",
        color: "white",
        fontFamily: "monospace",
        gap:"40px"
      }}>
        <div className=" flex w-full justify-around gap-2">  
          <p className="w-full h-full bg-emerald-500/70 p-5"><strong>act:</strong> {response?.act ?? "—"}</p>
          <p className="w-full h-full bg-amber-600/70 p-5"><strong>inst:</strong> {response?.inst ?? "—"}</p>
        </div>
        <div className="flex w-full justify-center mt-2">
          <p className="w-full h-full bg-blue-500/70 p-8"><strong>mess:</strong> {response?.mess ?? "—"}</p>
        </div>
      </div>
    </div>
  );
}
