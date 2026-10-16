import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, BookOpen, Loader2, ChevronDown, ChevronUp, Save, Copy, Check, Sparkles, FileText, PlaySquare, Code } from 'lucide-react';

export default function Worksheet({ project, draft, onBack, onUpdateQuote }) {
  const [copiedField, setCopiedField] = useState(null);
  const [isHookExpanded, setIsHookExpanded] = useState(true);
  const [isPointVideoExpanded, setIsPointVideoExpanded] = useState(true);
  const [isCtaExpanded, setIsCtaExpanded] = useState(true);
  
  const [hookCaption, setHookCaption] = useState('');
  const [hookPitch, setHookPitch] = useState('');
  const [hookText, setHookText] = useState('');
  const [isPollingHook, setIsPollingHook] = useState(false);

  // New Dynamic Payload Predictability
  const computedPayload = `Buatkan gambar ratio 9:16 Instagram reels, digunakan untuk hook reels dengan tema "${draft.main_topic}". Lengkapi foto "${draft.public_figure}" dengan pose ikonik dari tokoh tersebut. Masukkan kalimat "${hookCaption || '....'}" di area kotak template. Buat video selama 2 detik dengan gambar hook dan quote. diiringi oleh Narator berbicara "${hookText || '....'}" dengan nada bicara "${hookPitch || '....'}".`;
  
  const collapseVariants = { hidden: { height: 0, opacity: 0, overflow: 'hidden' }, visible: { height: 'auto', opacity: 1, overflow: 'visible', transition: { duration: 0.3 } } };

  const handleCopy = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSaveStatus = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    onUpdateQuote({ ...draft, status: formData.get('status') });
    onBack();
  };

  const handleGenerateHookScript = () => {
    setIsPollingHook(true);
    // Di aplikasi nyata, payload ini yang akan dikirim ke n8n
    console.log("Mengirim Payload Hook ke n8n:", computedPayload);
    
    setTimeout(() => {
      setIsPollingHook(false);
      onUpdateQuote({
        ...draft,
        worksheet_status: 'hook_complete',
        hook_text: `[Narrator - ${hookPitch || 'Default'}]: ${hookText || 'Generated text from n8n based on payload.'}`
      });
    }, 3000);
  };

  return (
    <motion.div key="worksheet" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="w-full max-w-[1400px] flex flex-col h-full mx-auto overflow-hidden text-white">
      <motion.div layoutId="main-container" className="inline-flex items-center gap-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-3 mb-4 shadow-lg self-start">
        <button onClick={onBack} className="hover:bg-white/20 p-2 rounded-lg transition-colors"><ArrowLeft size={18} /></button>
        <div className="flex text-sm items-center gap-2 pr-4">
          <span className="text-white/60">Projects</span><span>/</span><span className="text-white/60">{project?.project_name}</span><span>/</span><span className="font-semibold text-yellow-300">Bengkel: {draft.quote_id}</span>
        </div>
      </motion.div>

      <div className="flex-1 flex gap-6 overflow-hidden h-full pb-4">
        
        {/* KOLOM KIRI: Data Source & Resume */}
        <div className="w-[35%] flex flex-col gap-4 overflow-y-auto pr-2 h-full text-sm">
          <form onSubmit={handleSaveStatus} className="bg-white/5 backdrop-blur-md border border-white/20 shadow-lg rounded-2xl p-6 flex flex-col shrink-0">
            <h2 className="text-base font-bold mb-4 flex items-center gap-2 border-b border-white/10 pb-3 text-blue-300"><BookOpen size={16} /> Data Source</h2>
            <div className="space-y-4">
              <div className="group">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-white/50 text-xs uppercase tracking-wider">Public Figure & Topic</label>
                </div>
                <div className="text-white bg-white/5 p-3 rounded-lg border border-white/10">
                  <span className="font-semibold">{draft.public_figure}</span> — {draft.main_topic}
                </div>
              </div>
              <div className="group">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-white/50 text-xs uppercase tracking-wider">Quote Text</label>
                  <button type="button" onClick={() => handleCopy(draft.quote_text, 'quote')} className="text-white/40 hover:text-white transition-colors">{copiedField === 'quote' ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}</button>
                </div>
                <div className="text-white bg-white/5 p-3 rounded-lg border border-white/10">{draft.quote_text}</div>
              </div>
              <div className="group">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-white/50 text-xs uppercase tracking-wider">Interpretation</label>
                  <button type="button" onClick={() => handleCopy(draft.interpretation, 'interp')} className="text-white/40 hover:text-white transition-colors">{copiedField === 'interp' ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}</button>
                </div>
                <div className="text-white/90 bg-white/5 p-3 rounded-lg border border-white/10">{draft.interpretation || '-'}</div>
              </div>
              <div className="group">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-white/50 text-xs uppercase tracking-wider">Real Life Event</label>
                  <button type="button" onClick={() => handleCopy(draft.real_life_event, 'event')} className="text-white/40 hover:text-white transition-colors">{copiedField === 'event' ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}</button>
                </div>
                <div className="text-white/90 bg-white/5 p-3 rounded-lg border border-white/10">{draft.real_life_event || '-'}</div>
              </div>
              <div className="pt-2">
                <label className="block text-white/50 mb-1 text-xs uppercase tracking-wider">Update Status</label>
                <div className="relative">
                  <select name="status" defaultValue={draft.status} className="w-full bg-black/40 border border-white/20 rounded-lg px-3 py-2 text-white outline-none appearance-none focus:border-blue-400/50 transition-colors">
                    <option value="Draft" className="bg-gray-900 text-white">Draft</option>
                    <option value="Published" className="bg-gray-900 text-white">Published</option>
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
                </div>
              </div>
              <button type="submit" className="w-full flex justify-center items-center gap-2 px-6 py-2 bg-green-500/60 hover:bg-green-500/80 border border-green-400/50 rounded-lg transition-colors font-medium">
                <Save size={14} /> Simpan Status
              </button>
            </div>
          </form>

          <div className="bg-blue-900/20 backdrop-blur-md border border-blue-400/30 shadow-lg rounded-2xl p-6 flex flex-col flex-1 min-h-[300px]">
            <h2 className="text-base font-bold mb-4 flex items-center gap-2 border-b border-white/10 pb-3 text-blue-200"><FileText size={16} /> Resume Script (Ready for Video)</h2>
            <div className="flex-1 space-y-3 overflow-y-auto pr-2 bg-black/20 rounded-xl p-4 border border-white/5 text-white/80 leading-relaxed font-serif text-sm">
              {draft.hook_text ? <p><span className="text-purple-300 text-xs uppercase font-sans tracking-wider block mb-1">-- Hook --</span>{draft.hook_text}</p> : <p className="text-white/30 italic">Hook script belum di-generate...</p>}
              {draft.video_text ? <p className="mt-4"><span className="text-blue-300 text-xs uppercase font-sans tracking-wider block mb-1">-- Point Video --</span>{draft.video_text}</p> : <p className="text-white/30 italic mt-4">Point video script belum di-generate...</p>}
              {draft.cta_text ? <p className="mt-4"><span className="text-green-300 text-xs uppercase font-sans tracking-wider block mb-1">-- CTA --</span>{draft.cta_text}</p> : <p className="text-white/30 italic mt-4">CTA script belum di-generate...</p>}
            </div>
            <div className="mt-4 pt-4 border-t border-white/10">
              <button disabled={!draft.hook_text || !draft.video_text || !draft.cta_text} className={`w-full flex justify-center items-center gap-2 px-6 py-3 rounded-lg transition-colors font-medium shadow-lg backdrop-blur-sm ${draft.hook_text && draft.video_text && draft.cta_text ? 'bg-blue-600 hover:bg-blue-500 border border-blue-400 text-white' : 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'}`}>
                <PlaySquare size={18} /> Generate Final Video via n8n
              </button>
            </div>
          </div>
        </div>

        {/* KOLOM KANAN: Bengkel Proses */}
        <div className="w-[65%] flex flex-col h-full overflow-y-auto pr-2 space-y-4 text-sm">
          
          <div className="bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl rounded-2xl p-6 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2 text-purple-300"><span className="bg-purple-500/30 px-2 py-0.5 rounded text-sm">01</span> Hook Configuration (2 Detik)</h3>
              <button onClick={() => setIsHookExpanded(!isHookExpanded)} className="text-white/50 hover:text-white transition-colors p-1 bg-white/5 rounded-full">{isHookExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</button>
            </div>
            
            <AnimatePresence>
              {isHookExpanded && (
                <motion.div variants={collapseVariants} initial="hidden" animate="visible" exit="hidden">
                  <div className="flex flex-col gap-4 mb-2 border-t border-white/10 pt-4">
                    
                    {/* Karena gambar dihapus, input boxes mengambil full width secara grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-white/80 mb-1.5 text-xs">Caption (Teks visual video)</label>
                        <textarea value={hookCaption} onChange={(e) => setHookCaption(e.target.value)} rows="2" placeholder="Contoh: Tahukah kamu rahasia sukses Steve Jobs?" className="w-full bg-black/20 border border-white/20 rounded-lg px-3 py-2 text-white outline-none focus:border-purple-400/50 transition-colors resize-none text-sm"></textarea>
                      </div>
                      <div>
                        <label className="block text-white/80 mb-1.5 text-xs">Narator Pitch (Karakter Suara)</label>
                        <input value={hookPitch} onChange={(e) => setHookPitch(e.target.value)} type="text" placeholder="Contoh: Suara pria berumur 30 tahun, antusias" className="w-full bg-black/20 border border-white/20 rounded-lg px-3 py-2 text-white outline-none focus:border-purple-400/50 transition-colors text-sm" />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-white/80 mb-1.5 text-xs">Narator Text (Script bahasa Indonesia)</label>
                      <textarea value={hookText} onChange={(e) => setHookText(e.target.value)} rows="2" placeholder="Contoh: Pernah denger cerita gimana Apple dibikin? Tonton video ini sampai habis!" className="w-full bg-black/20 border border-white/20 rounded-lg px-3 py-2 text-white outline-none focus:border-purple-400/50 transition-colors resize-none text-sm"></textarea>
                    </div>

                    <div className="p-4 bg-black/40 border border-purple-500/30 rounded-xl relative flex flex-col">
                      <label className="flex items-center gap-2 text-purple-300/80 mb-2 text-xs font-semibold uppercase tracking-wider"><Code size={14} /> Payload Preview</label>
                      <textarea readOnly value={computedPayload} className="w-full bg-transparent text-white/80 outline-none resize-none text-xs italic h-auto min-h-[50px]"></textarea>
                    </div>
                    
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            
            <div className="flex justify-end pt-4 border-t border-white/10 mt-2">
              <button onClick={handleGenerateHookScript} disabled={isPollingHook || draft.hook_text !== ''} className={`flex items-center gap-2 px-6 py-2.5 rounded-lg transition-colors font-medium shadow-lg backdrop-blur-sm ${draft.hook_text !== '' ? 'bg-green-500/30 border border-green-500/50 text-green-200 cursor-not-allowed' : isPollingHook ? 'bg-purple-900/60 border border-purple-700/50 text-white/60 cursor-not-allowed' : 'bg-purple-500/60 hover:bg-purple-500/80 border border-purple-400/50 shadow-[0_0_15px_rgba(168,85,247,0.4)]'}`}>
                {draft.hook_text !== '' ? <><Check size={16} /> Hook Completed</> : isPollingHook ? <><Loader2 size={16} className="animate-spin" /> Mengirim Payload...</> : <><Sparkles size={16} /> Susun Script Hook (n8n)</>}
              </button>
            </div>
          </div>

          {/* CARD 2: POINT VIDEO */}
          <div className="bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl rounded-2xl p-6 flex flex-col opacity-70">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold flex items-center gap-2 text-blue-300"><span className="bg-blue-500/30 px-2 py-0.5 rounded text-sm">02</span> Point Video (5 Detik)</h3>
              <button onClick={() => setIsPointVideoExpanded(!isPointVideoExpanded)} className="text-white/50 hover:text-white transition-colors p-1 bg-white/5 rounded-full">{isPointVideoExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</button>
            </div>
            <AnimatePresence>
              {isPointVideoExpanded && (
                <motion.div variants={collapseVariants} initial="hidden" animate="visible" exit="hidden"><div className="pt-4 mt-4 border-t border-white/10 text-white/50"><p className="text-xs">Konfigurasi Point Video akan diletakkan di sini pada checkpoint selanjutnya.</p></div></motion.div>
              )}
            </AnimatePresence>
            <div className="flex justify-end pt-4 border-t border-white/10 mt-4">
              <button disabled className="px-6 py-2.5 rounded-lg bg-blue-900/60 border border-blue-700/50 text-white/60 cursor-not-allowed shadow-lg backdrop-blur-sm flex items-center gap-2"><Sparkles size={16} /> Susun Script Point Video</button>
            </div>
          </div>

          {/* CARD 3: CTA */}
          <div className="bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl rounded-2xl p-6 flex flex-col opacity-70">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold flex items-center gap-2 text-green-300"><span className="bg-green-500/30 px-2 py-0.5 rounded text-sm">03</span> Call to Action (2 Detik)</h3>
              <button onClick={() => setIsCtaExpanded(!isCtaExpanded)} className="text-white/50 hover:text-white transition-colors p-1 bg-white/5 rounded-full">{isCtaExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</button>
            </div>
            <AnimatePresence>
              {isCtaExpanded && (
                <motion.div variants={collapseVariants} initial="hidden" animate="visible" exit="hidden"><div className="pt-4 mt-4 border-t border-white/10 text-white/50"><p className="text-xs">Konfigurasi CTA akan diletakkan di sini pada checkpoint selanjutnya.</p></div></motion.div>
              )}
            </AnimatePresence>
            <div className="flex justify-end pt-4 border-t border-white/10 mt-4">
              <button disabled className="px-6 py-2.5 rounded-lg bg-green-900/60 border border-green-700/50 text-white/60 cursor-not-allowed shadow-lg backdrop-blur-sm flex items-center gap-2"><Sparkles size={16} /> Susun Script CTA</button>
            </div>
          </div>

        </div>
      </div>
    </motion.div>
  );
}