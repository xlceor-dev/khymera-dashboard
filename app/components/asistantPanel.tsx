
  export default function AssistantPanel({
    onSendText,
    onVoice,
    recording,
    response,
    loading,
    input,
    setInput,
  }: {
    onSendText: () => void;
    onVoice: () => void;
    recording: boolean;
    response: AIResponse | null;
    loading: boolean;
    input: string;
    setInput: (v: string) => void;
  }) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-4.5 flex flex-col gap-3.5">
        <span className="text-[11px] text-slate-500 tracking-[0.08em] uppercase font-mono">
          Asistente IA
        </span>
  
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSendText();
            }
          }}
          placeholder="Escribe una instrucción... (Enter para enviar)"
          rows={3}
          className="bg-[#020617] border border-slate-800 rounded-lg text-slate-200 px-3.5 py-2.5 font-mono text-[13px] resize-y outline-none"
        />
  
        <div className="flex gap-2">
          <button
            onClick={onSendText}
            disabled={loading}
            className={`flex-1 py-2.5 rounded-lg font-semibold text-[13px] transition-colors ${
              loading
                ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                : "bg-blue-700 text-white cursor-pointer hover:bg-blue-600"
            }`}
          >
            {loading ? "Procesando..." : "Enviar"}
          </button>
          <button
            onClick={onVoice}
            className={`px-4 py-2.5 rounded-lg font-semibold cursor-pointer text-[13px] min-w-22.5 transition-colors ${
              recording
                ? "bg-red-700 border border-red-500 text-red-300"
                : "bg-emerald-950 border border-emerald-800 text-emerald-300"
            }`}
          >
            {recording ? "◼ Stop" : "◉ Voz"}
          </button>
        </div>
  
        {response && (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <div className="flex-1 bg-[#022c22] border border-emerald-900 rounded-lg px-3 py-2">
                <span className="text-[10px] text-emerald-600 block mb-0.5 font-mono">ACT</span>
                <span className="text-emerald-300 font-mono text-[13px]">
                  {response.act || "—"}
                </span>
              </div>
              <div className="flex-1 bg-[#2d1b00] border border-amber-900 rounded-lg px-3 py-2">
                <span className="text-[10px] text-amber-500 block mb-0.5 font-mono">INST</span>
                <span className="text-yellow-300 font-mono text-[13px]">
                  {response.inst !== undefined && response.inst !== "" ? response.inst : "—"}
                </span>
              </div>
            </div>
            <div className="bg-[#0c1a2e] border border-blue-900 rounded-lg px-3.5 py-2.5">
              <span className="text-[10px] text-sky-400 block mb-1 font-mono">RESPUESTA</span>
              <span className="text-sky-200 text-[13px] leading-relaxed">
                {response.mess || "—"}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }