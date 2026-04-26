import { NextResponse } from "next/server";
import { promises as fs } from 'fs';
import path from 'path';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'app', 'config.json');
    console.log('Archivo a leer:', filePath); 

    const fileContents = await fs.readFile(filePath, 'utf-8');
    
    const rawData = JSON.parse(fileContents);
    const { actuators, sensors } = rawData;
    console.log("Config cargada:", { actuators, sensors });

    const SENSOR_REGISTRY: SensorRegistry = Object.entries(sensors || {}).map(
      ([key, data]: any) => ({
        key,
        label: data.label,
        unit: data.unit,
        icon: data.icon,
        color: data.color,
        decimals: data.decimals,
        subtext: data.subtext
      })
    );

    console.log("Sensores cargados:", SENSOR_REGISTRY);

    return NextResponse.json({
        ok: true,
        sensors: SENSOR_REGISTRY,
      });
  } catch (e) {
    return NextResponse.json(
      { error: "Error al enviar al actuador", e },
      { status: 500 }
    );
  }
}
