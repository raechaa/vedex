// components/views/Worksheet.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, BookOpen, Loader2, ChevronDown, ChevronUp, Save, Copy, Check, Sparkles, FileText, PlaySquare, Code, Wand2, X } from 'lucide-react';
import { updateQuote, updateQuoteHashtag, updateQuoteHookText } from '@/lib/actions';

// Komponen notifikasi sederhana
const Notification = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, x: 100 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      exit={{ opacity: 0, y: -20, x: 100 }}
      className={`fixed top-20 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-2xl backdrop-blur-md border ${
        type === 'success' 
          ? 'bg-green-500/90 border-green-400 text-white' 
          : 'bg-red-500/90 border-red-400 text-white'
      }`}
    >
      {type === 'success' ? (
        <Check size={20} className="shrink-0" />
      ) : (
        <X size={20} className="shrink-0" />
      )}
      <p className="text-sm font-medium">{message}</p>
    </motion.div>
  );
};

export default function Worksheet({ quote, onBack, onUpdateQuote }) {
  const [copiedField, setCopiedField] = useState(null);
  const [isHookExpanded, setIsHookExpanded] = useState(true);
  const [isPointVideoExpanded, setIsPointVideoExpanded] = useState(true);
  const [isCtaExpanded, setIsCtaExpanded] = useState(true);
  
  const [hookCaption, setHookCaption] = useState('');
  const [payloadPreview, setPayloadPreview] = useState('');
  
  // State untuk menyimpan hasil dari agent
  const [generatedHookTexts, setGeneratedHookTexts] = useState<string[]>([]);
  const [generatedHashtags, setGeneratedHashtags] = useState<string[]>([]);
  
  const [isGeneratingCaptions, setIsGeneratingCaptions] = useState(false);
  const [isGeneratingHook, setIsGeneratingHook] = useState(false);
  const [isSavingHookData, setIsSavingHookData] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedCaptionIndex, setCopiedCaptionIndex] = useState(null);
  const [notification, setNotification] = useState(null);

  // Initialize states from quote data if available
  useEffect(() => {
    // Set hookCaption from quote_text
    if (quote.quote_text) {
      setHookCaption(quote.quote_text);
    }

    // Parse hashtag data for suggestions
    if (quote.hashtag) {
      // Cek apakah hashtag berisi JSON valid
      const trimmedHashtag = quote.hashtag.trim();
      const isJson = trimmedHashtag.startsWith('{') || trimmedHashtag.startsWith('[');
      
      if (isJson) {
        try {
          const parsedData = JSON.parse(trimmedHashtag);
          
          if (parsedData && typeof parsedData === 'object') {
            // Handle suggestion format
            if (Array.isArray(parsedData.suggestion)) {
              const hookTexts = [];
              const hashtags = [];
              
              parsedData.suggestion.forEach((item) => {
                if (item.hook_text) {
                  hookTexts.push(item.hook_text);
                }
                if (Array.isArray(item.hashtag)) {
                  hashtags.push(...item.hashtag);
                }
              });
              
              setGeneratedHookTexts(hookTexts);
              setGeneratedHashtags(hashtags);
            }
            // Handle direct format
            else {
              if (Array.isArray(parsedData.hook_text)) {
                setGeneratedHookTexts(parsedData.hook_text);
              }
              
              if (Array.isArray(parsedData.hashtag)) {
                setGeneratedHashtags(parsedData.hashtag);
              }
            }
          }
        } catch (error) {
          console.error('Error parsing hashtag data:', error);
        }
      }
    }
  }, [quote]);

  // Build initial payload preview
  const buildPayload = () => {
    return `Buatkan gambar ratio 9:16 Instagram reels, digunakan untuk hook reels dengan tema "${quote.main_topic}". Lengkapi foto "${quote.public_figure}" dengan pose ikonik dari tokoh tersebut. Masukkan kalimat "${hookCaption || '....'}" di area kotak template. Buat video selama 2 detik dengan gambar hook dan quote.`;
  };

  // Initialize payload preview when hookCaption changes
  const handleCaptionChange = (e) => {
    setHookCaption(e.target.value);
    // Auto-update payload preview only if it matches the auto-generated pattern
    if (!payloadPreview || payloadPreview === buildPayload()) {
      setPayloadPreview(buildPayload());
    }
  };

  const collapseVariants = { 
    hidden: { height: 0, opacity: 0, overflow: 'hidden' }, 
    visible: { height: 'auto', opacity: 1, overflow: 'visible', transition: { duration: 0.3 } } 
  };

  const handleCopy = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleCopyCaption = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedCaptionIndex(index);
    setTimeout(() => setCopiedCaptionIndex(null), 2000);
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSaveStatus = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    const formData = new FormData(e.target);
    const status = formData.get('status');
    
    try {
      const updated = await updateQuote(quote.quote_id, { status });
      onUpdateQuote(updated);
      onBack();
    } catch (error) {
      console.error('Error saving status:', error);
      showNotification('Gagal menyimpan status', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Call LibreChat agent to generate hook texts and hashtags (suggestions)
  const handleWandClick = async () => {
    setIsGeneratingCaptions(true);
    setGeneratedHookTexts([]); // Clear previous results
    setGeneratedHashtags([]);
    
    try {
      const response = await fetch('/api/librechat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          payload: hookCaption,
          type: 'suggestion' // Default type
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error('Gagal memanggil agent');
      }
      
      const data = await response.json();
      
      // Data dari API route sudah di-parse oleh librechat.ts
      const { hook_text, hashtag } = data; 
      
      // Validasi data
      if (!hook_text || hook_text.length === 0) {
        throw new Error('Agent tidak mengembalikan hook_text');
      }
      
      setGeneratedHookTexts(hook_text || []);
      setGeneratedHashtags(hashtag || []);

      // Save raw data to database
      const rawData = JSON.stringify({ hook_text, hashtag });
      await handleSaveGeneratedData(rawData);

    } catch (error) {
      console.error('Error generating captions:', error);
      showNotification('Gagal generate caption. Cek console untuk detail.', 'error');
    } finally {
      setIsGeneratingCaptions(false);
    }
  };

  // Save raw agent data to the database
  const handleSaveGeneratedData = async (rawData: string) => {
    setIsSavingHookData(true);
    try {
      // Validasi rawData sebelum disimpan
      if (!rawData || rawData === '{}' || rawData === '[]') {
        throw new Error('Data kosong atau tidak valid');
      }
      
      const updated = await updateQuoteHashtag(quote.quote_id, rawData);
      onUpdateQuote(updated); // Update state in parent component
      showNotification('Suggestion berhasil disimpan ke database!', 'success');
    } catch (error) {
      console.error('Error saving hook data:', error);
      showNotification('Gagal menyimpan data ke database.', 'error');
    } finally {
      setIsSavingHookData(false);
    }
  };

  // Call PromptEngineer agent to generate final hook script
  const handleGenerateHookScript = async () => {
    setIsGeneratingHook(true);
    
    try {
      const response = await fetch('/api/librechat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          payload: hookCaption,
          type: 'prompt_engineer' // Panggil PromptEngineer agent
        }),
      });
      
      if (!response.ok) {
        throw new Error('Gagal memanggil PromptEngineer');
      }
      
      const data = await response.json();
      const hookText = data.hook_text;
      
      // Update quote with generated hook text
      const updated = await updateQuoteHookText(quote.quote_id, hookText);
      onUpdateQuote(updated);
      
      showNotification('Hook script berhasil di-generate dan disimpan!', 'success');
    } catch (error) {
      console.error('Error generating hook:', error);
      showNotification('Gagal generate hook. Cek console untuk detail.', 'error');
    } finally {
      setIsGeneratingHook(false);
    }
  };

  return (
    <motion.div 
      key="worksheet" 
      initial={{ opacity: 0, x: 20 }} 
      animate={{ opacity: 1, x: 0 }} 
      exit={{ opacity: 0, x: -20 }} 
      className="w-full max-w-[1400px] flex flex-col h-full mx-auto overflow-hidden text-white"
    >
      <motion.div layoutId="main-container" className="inline-flex items-center gap-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-3 mb-4 shadow-lg self-start">
        <button onClick={onBack} className="hover:bg-white/20 p-2 rounded-lg transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex text-sm items-center gap-2 pr-4">
          <span className="text-white/60">Quotes</span>
          <span>/</span>
          <span className="font-semibold text-yellow-300">Bengkel: {quote.quote_id}</span>
        </div>
      </motion.div>

      <div className="flex-1 flex gap-6 overflow-hidden h-full pb-4">
        
        {/* KOLOM KIRI: Data Source & Resume */}
        <div className="w-[35%] flex flex-col gap-4 overflow-y-auto pr-2 h-full text-sm">
          <form onSubmit={handleSaveStatus} className="bg-white/5 backdrop-blur-md border border-white/20 shadow-lg rounded-2xl p-6 flex flex-col shrink-0">
            <h2 className="text-base font-bold mb-4 flex items-center gap-2 border-b border-white/10 pb-3 text-blue-300">
              <BookOpen size={16} /> Data Source
            </h2>
            <div className="space-y-4">
              <div className="group">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-white/50 text-xs uppercase tracking-wider">Public Figure & Topic</label>
                </div>
                <div className="text-white bg-white/5 p-3 rounded-lg border border-white/10">
                  <span className="font-semibold">{quote.public_figure}</span> — {quote.main_topic}
                </div>
              </div>
              
              <div className="group">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-white/50 text-xs uppercase tracking-wider">Quote Text</label>
                  <button 
                    type="button" 
                    onClick={() => handleCopy(quote.quote_text, 'quote')} 
                    className="text-white/40 hover:text-white transition-colors"
                  >
                    {copiedField === 'quote' ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                  </button>
                </div>
                <div className="text-white bg-white/5 p-3 rounded-lg border border-white/10">
                  {quote.quote_text}
                </div>
              </div>
              
              <div className="group">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-white/50 text-xs uppercase tracking-wider">Interpretation</label>
                  <button 
                    type="button" 
                    onClick={() => handleCopy(quote.interpretation, 'interp')} 
                    className="text-white/40 hover:text-white transition-colors"
                  >
                    {copiedField === 'interp' ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                  </button>
                </div>
                <div className="text-white/90 bg-white/5 p-3 rounded-lg border border-white/10">
                  {quote.interpretation || '-'}
                </div>
              </div>
              
              <div className="group">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-white/50 text-xs uppercase tracking-wider">Real Life Event</label>
                  <button 
                    type="button" 
                    onClick={() => handleCopy(quote.real_life_event, 'event')} 
                    className="text-white/40 hover:text-white transition-colors"
                  >
                    {copiedField === 'event' ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                  </button>
                </div>
                <div className="text-white/90 bg-white/5 p-3 rounded-lg border border-white/10">
                  {quote.real_life_event || '-'}
                </div>
              </div>
              
              <div className="group">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-white/50 text-xs uppercase tracking-wider">Fun Fact</label>
                  <button 
                    type="button" 
                    onClick={() => handleCopy(quote.fun_fact, 'funfact')} 
                    className="text-white/40 hover:text-white transition-colors"
                  >
                    {copiedField === 'funfact' ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                  </button>
                </div>
                <div className="text-white/90 bg-white/5 p-3 rounded-lg border border-white/10">
                  {quote.fun_fact || '-'}
                </div>
              </div>
              
              <div className="pt-2">
                <label className="block text-white/50 mb-1 text-xs uppercase tracking-wider">Update Status</label>
                <div className="relative">
                  <select 
                    name="status" 
                    defaultValue={quote.status} 
                    className="w-full bg-black/40 border border-white/20 rounded-lg px-3 py-2 text-white outline-none appearance-none focus:border-blue-400/50 transition-colors"
                  >
                    <option value="Draft" className="bg-gray-900 text-white">Draft</option>
                    <option value="Published" className="bg-gray-900 text-white">Published</option>
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
                </div>
              </div>
              
              <button 
                type="submit" 
                disabled={isSaving}
                className="w-full flex justify-center items-center gap-2 px-6 py-2 bg-green-500/60 hover:bg-green-500/80 border border-green-400/50 rounded-lg transition-colors font-medium disabled:opacity-50"
              >
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Simpan Status
              </button>
            </div>
          </form>

          <div className="bg-blue-900/20 backdrop-blur-md border border-blue-400/30 shadow-lg rounded-2xl p-6 flex flex-col flex-1 min-h-[300px]">
            <h2 className="text-base font-bold mb-4 flex items-center gap-2 border-b border-white/10 pb-3 text-blue-200">
              <FileText size={16} /> Resume Script (Ready for Video)
            </h2>
            <div className="flex-1 space-y-3 overflow-y-auto pr-2 bg-black/20 rounded-xl p-4 border border-white/5 text-white/80 leading-relaxed font-serif text-sm">
              {quote.hook_text ? (
                <p>
                  <span className="text-purple-300 text-xs uppercase font-sans tracking-wider block mb-1">-- Hook --</span>
                  {quote.hook_text}
                </p>
              ) : (
                <p className="text-white/30 italic">Hook script belum di-generate...</p>
              )}
              
              {quote.main_text ? (
                <p className="mt-4">
                  <span className="text-blue-300 text-xs uppercase font-sans tracking-wider block mb-1">-- Point Video --</span>
                  {quote.main_text}
                </p>
              ) : (
                <p className="text-white/30 italic mt-4">Point video script belum di-generate...</p>
              )}
              
              {quote.cta_text ? (
                <p className="mt-4">
                  <span className="text-green-300 text-xs uppercase font-sans tracking-wider block mb-1">-- CTA --</span>
                  {quote.cta_text}
                </p>
              ) : (
                <p className="text-white/30 italic mt-4">CTA script belum di-generate...</p>
              )}
            </div>
            
            <div className="mt-4 pt-4 border-t border-white/10">
              <button 
                disabled={!quote.hook_text || !quote.main_text || !quote.cta_text} 
                className={`w-full flex justify-center items-center gap-2 px-6 py-3 rounded-lg transition-colors font-medium shadow-lg backdrop-blur-sm ${
                  quote.hook_text && quote.main_text && quote.cta_text 
                    ? 'bg-blue-600 hover:bg-blue-500 border border-blue-400 text-white' 
                    : 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'
                }`}
              >
                <PlaySquare size={18} /> Generate Final Video via n8n
              </button>
            </div>
          </div>
        </div>

        {/* KOLOM KANAN: Bengkel Proses */}
        <div className="w-[65%] flex flex-col h-full overflow-y-auto pr-2 space-y-4 text-sm">
          
          <div className="bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl rounded-2xl p-6 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2 text-purple-300">
                <span className="bg-purple-500/30 px-2 py-0.5 rounded text-sm">01</span> 
                Hook Configuration (4 Detik)
              </h3>
              <button 
                onClick={() => setIsHookExpanded(!isHookExpanded)} 
                className="text-white/50 hover:text-white transition-colors p-1 bg-white/5 rounded-full"
              >
                {isHookExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>
            </div>
            
            <AnimatePresence>
              {isHookExpanded && (
                <motion.div variants={collapseVariants} initial="hidden" animate="visible" exit="hidden">
                  <div className="flex flex-col gap-4 mb-2 border-t border-white/10 pt-4">
                    
                    {/* Caption dengan icon tongkat sihir */}
                    <div>
                      <label className="block text-white/80 mb-1.5 text-xs">Caption (Teks visual video)</label>
                      <div className="relative">
                        <textarea 
                          value={hookCaption} 
                          onChange={handleCaptionChange} 
                          rows="2" 
                          placeholder="Contoh: Tahukah kamu rahasia sukses Steve Jobs?" 
                          className="w-full bg-black/20 border border-white/20 rounded-lg px-3 py-2 pr-12 text-white outline-none focus:border-purple-400/50 transition-colors resize-none text-sm"
                        ></textarea>
                        <button 
                          onClick={handleWandClick}
                          disabled={isGeneratingCaptions || isSavingHookData}
                          title="Generate suggestion dengan AI"
                          className={`absolute right-2 top-2 p-2 rounded-lg transition-all ${
                            isGeneratingCaptions || isSavingHookData
                              ? 'bg-purple-500/30 text-purple-200 cursor-wait' 
                              : 'bg-purple-500/40 hover:bg-purple-500/70 border border-purple-400/50 text-white shadow-[0_0_10px_rgba(168,85,247,0.3)]'
                          }`}
                        >
                          {isGeneratingCaptions || isSavingHookData ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* Card Suggestion */}
                    {(generatedHookTexts.length > 0 || generatedHashtags.length > 0) && (
                      <div className="p-4 bg-black/30 border border-purple-500/30 rounded-xl">
                        <label className="flex items-center gap-2 text-purple-300/80 mb-3 text-xs font-semibold uppercase tracking-wider">
                          <Sparkles size={14} /> Suggestions
                        </label>
                        
                        {/* Suggestion Hook Texts */}
                        {generatedHookTexts.length > 0 && (
                          <div className="mb-4">
                            <label className="text-purple-300/60 text-xs mb-2 block">Hook Suggestions ({generatedHookTexts.length})</label>
                            <div className="space-y-2">
                              {generatedHookTexts.map((text, index) => (
                                <div key={index} className="flex items-start gap-2 bg-white/5 border border-white/10 rounded-lg p-3 group hover:bg-white/10 transition-colors">
                                  <span className="text-purple-300 text-xs font-bold mt-0.5 shrink-0">{index + 1}.</span>
                                  <p className="flex-1 text-white/90 text-xs leading-relaxed">{text}</p>
                                  <button 
                                    onClick={() => handleCopyCaption(text, index)}
                                    className="text-white/40 hover:text-white transition-colors shrink-0 mt-0.5"
                                    title="Copy hook text"
                                  >
                                    {copiedCaptionIndex === index ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Suggestion Hashtags */}
                        {generatedHashtags.length > 0 && (
                          <div>
                            <label className="text-purple-300/60 text-xs mb-2 block">Hashtag Suggestions ({generatedHashtags.length})</label>
                            <div className="flex flex-wrap gap-2">
                              {generatedHashtags.map((tag, index) => (
                                <span key={index} className="text-xs text-purple-200 bg-purple-500/20 border border-purple-500/30 px-2 py-0.5 rounded-md">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Payload Preview - editable */}
                    <div className="p-4 bg-black/40 border border-purple-500/30 rounded-xl relative flex flex-col">
                      <label className="flex items-center gap-2 text-purple-300/80 mb-2 text-xs font-semibold uppercase tracking-wider">
                        <Code size={14} /> Payload Preview (Editable)
                      </label>
                      <textarea 
                        value={payloadPreview || buildPayload()} 
                        onChange={(e) => setPayloadPreview(e.target.value)} 
                        rows="4" 
                        className="w-full bg-transparent text-white/80 outline-none resize-y text-xs italic min-h-[80px] border border-white/10 rounded-lg p-2 focus:border-purple-400/50 transition-colors"
                      ></textarea>
                    </div>
                    
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            
            <div className="flex justify-end pt-4 border-t border-white/10 mt-2">
              <button 
                onClick={handleGenerateHookScript}
                disabled={isGeneratingHook || quote.hook_text !== ''} 
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg transition-colors font-medium shadow-lg backdrop-blur-sm ${
                  quote.hook_text !== '' 
                    ? 'bg-green-500/30 border border-green-500/50 text-green-200 cursor-not-allowed' 
                    : isGeneratingHook 
                      ? 'bg-purple-900/60 border border-purple-700/50 text-white/60 cursor-not-allowed' 
                      : 'bg-purple-500/60 hover:bg-purple-500/80 border border-purple-400/50 shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                }`}
              >
                {quote.hook_text !== '' ? (
                  <><Check size={16} /> Hook Completed</>
                ) : isGeneratingHook ? (
                  <><Loader2 size={16} className="animate-spin" /> Generating Hook...</>
                ) : (
                  <><Sparkles size={16} /> Generate Hook Script</>
                )}
              </button>
            </div>
          </div>

          {/* CARD 2: POINT VIDEO */}
          <div className="bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl rounded-2xl p-6 flex flex-col opacity-70">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold flex items-center gap-2 text-blue-300">
                <span className="bg-blue-500/30 px-2 py-0.5 rounded text-sm">02</span> 
                Point Configuration (10 Detik)
              </h3>
              <button 
                onClick={() => setIsPointVideoExpanded(!isPointVideoExpanded)} 
                className="text-white/50 hover:text-white transition-colors p-1 bg-white/5 rounded-full"
              >
                {isPointVideoExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>
            </div>
            <AnimatePresence>
              {isPointVideoExpanded && (
                <motion.div variants={collapseVariants} initial="hidden" animate="visible" exit="hidden">
                  <div className="pt-4 mt-4 border-t border-white/10 text-white/50">
                    <p className="text-xs">Konfigurasi Point Video akan diletakkan di sini pada checkpoint selanjutnya.</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="flex justify-end pt-4 border-t border-white/10 mt-4">
              <button disabled className="px-6 py-2.5 rounded-lg bg-blue-900/60 border border-blue-700/50 text-white/60 cursor-not-allowed shadow-lg backdrop-blur-sm flex items-center gap-2">
                <Sparkles size={16} /> Susun Script Point Video
              </button>
            </div>
          </div>

          {/* CARD 3: CTA */}
          <div className="bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl rounded-2xl p-6 flex flex-col opacity-70">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold flex items-center gap-2 text-green-300">
                <span className="bg-green-500/30 px-2 py-0.5 rounded text-sm">03</span> 
                Call to Action (4 Detik)
              </h3>
              <button 
                onClick={() => setIsCtaExpanded(!isCtaExpanded)} 
                className="text-white/50 hover:text-white transition-colors p-1 bg-white/5 rounded-full"
              >
                {isCtaExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>
            </div>
            <AnimatePresence>
              {isCtaExpanded && (
                <motion.div variants={collapseVariants} initial="hidden" animate="visible" exit="hidden">
                  <div className="pt-4 mt-4 border-t border-white/10 text-white/50">
                    <p className="text-xs">Konfigurasi CTA akan diletakkan di sini pada checkpoint selanjutnya.</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="flex justify-end pt-4 border-t border-white/10 mt-4">
              <button disabled className="px-6 py-2.5 rounded-lg bg-green-900/60 border border-green-700/50 text-white/60 cursor-not-allowed shadow-lg backdrop-blur-sm flex items-center gap-2">
                <Sparkles size={16} /> Susun Script CTA
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* NOTIFICATION */}
      <AnimatePresence>
        {notification && (
          <Notification 
            message={notification.message} 
            type={notification.type} 
            onClose={() => setNotification(null)} 
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}