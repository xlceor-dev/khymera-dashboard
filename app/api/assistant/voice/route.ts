import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

function buildAIInstructions() {
  return `Eres un asistente en un dashboard que controla hardware embebido. Sé amable y útil. Puedes responder dudas o controlar actuadores. Responde SOLO en este JSON válido: {"act":"", "inst":"", "mess":""}.`;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
    });

    const text = transcription.text;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: buildAIInstructions() },
        { role: "user", content: text },
      ],
    });

    const content = completion.choices[0].message.content || "{}";
    const data = JSON.parse(content);

    return NextResponse.json({ ...data, transcript: text });
  } catch {
    return NextResponse.json(
      { act: "none", inst: "", mess: "Error en voz" },
      { status: 500 }
    );
  }
}