import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from 'fs';
import path from 'path';

function clamp(val: number, min: number, max: number) {
  return Math.min(Math.max(val, min), max);
}


export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'app', 'config.json');
    console.log('Archivo a leer:', filePath); 

    const fileContents = await fs.readFile(filePath, 'utf-8');
    
    const rawData = JSON.parse(fileContents);
    const { actuators, sensors } = rawData;
    console.log("Config cargada:", { actuators, sensors });

    const ACTUATOR_REGISTRY: ActuatorRegistry = Object.entries(actuators).map(
      ([key, data]: any ) => ({
        key,
        label: data.label,
        min: data.min,
        max: data.max,
        unit: data.unit,
        color: data.color,
        presets: data.presets || [],
        aiAction: data.aiAction || key,
      })
    );

    return NextResponse.json({
        ok: true,
        actuators: ACTUATOR_REGISTRY,
      });
  } catch (e) {
    return NextResponse.json(
      { error: "Error al envir actuadores", e },
      { status: 500 }
    );
  }
}



export async function POST(req: NextRequest) {
  try {
    const { key, value } = await req.json();

    const filePath = path.join(process.cwd(), 'app', 'config.json');
    console.log('Archivo a leer:', filePath); 

    const fileContents = await fs.readFile(filePath, 'utf-8');
    
    const rawData = JSON.parse(fileContents);
    const { actuators, sensors } = rawData;
    console.log("Config cargada:", { actuators, sensors });

    const ACTUATOR_REGISTRY: ActuatorRegistry = Object.entries(actuators).map(
      ([key, data]: any ) => ({
        key,
        label: data.label,
        min: data.min,
        max: data.max,
        unit: data.unit,
        color: data.color,
        presets: data.presets || [],
        aiAction: data.aiAction || key,
      })
    );

    const MCU_URL = process.env.MCU_URL!;

    const config = ACTUATOR_REGISTRY.find((a) => a.key === key);
    if (!config) {
      return NextResponse.json({ error: "Actuador no válido" }, { status: 400 });
    }

    const clampedValue = clamp(value, config.min, config.max);

    await fetch(`${MCU_URL}/${key}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ [key]: clampedValue }),
    });

    return NextResponse.json({
      ok: true,
      key,
      value: clampedValue,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Error al enviar al actuador", e },
      { status: 500 }
    );
  }
}
