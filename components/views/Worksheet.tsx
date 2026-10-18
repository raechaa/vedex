// components/views/Worksheet.tsx

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, BookOpen, Loader2, ChevronDown, ChevronUp, Save, Copy, Check, Sparkles, FileText, PlaySquare, Code, Wand2, X, Plus, Minus, AlertTriangle } from 'lucide-react';
import { updateQuote, updateQuoteHashtag, updateQuoteHookText, updateQuoteMainText } from '@/lib/actions';

// Komponen notifikasi sederhana
const Notification = ({ message, type, onClose }) => {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const timer = setTimeout(() => {
      onCloseRef.current();
    }, 3000);
    return () => clearTimeout(timer);
  }, []);  // ← Empty dependency, hanya trigger sekali saat mount

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
  const [isHookExpanded, setIsHookExpanded] = useState(false);
  const [isPointVideoExpanded, setIsPointVideoExpanded] = useState(false);
  const [isCtaExpanded, setIsCtaExpanded] = useState(false);
  
  const [hookCaption, setHookCaption] = useState('');
  const [hookWords, setHookWords] = useState(''); 
  const [payloadPreview, setPayloadPreview] = useState('');
  
  // State untuk menyimpan hasil dari agent
  const [generatedHookTexts, setGeneratedHookTexts] = useState<string[]>([]);
  const [generatedHashtags, setGeneratedHashtags] = useState<string[]>([]);
  const [isGeneratingCaptions, setIsGeneratingCaptions] = useState(false);
  const [isGeneratingHook, setIsGeneratingHook] = useState(false);
  const [isHookWordsWarningOpen, setIsHookWordsWarningOpen] = useState(false);

  const [isSavingHookData, setIsSavingHookData] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedCaptionIndex, setCopiedCaptionIndex] = useState(null);
  const [notification, setNotification] = useState(null);

  const [pointVideoText, setPointVideoText] = useState('');
  const [ctaText, setCtaText] = useState('');
  const [isGeneratingPoint, setIsGeneratingPoint] = useState(false);
  const [isGeneratingCTA, setIsGeneratingCTA] = useState(false);
  const [isSavingPoint, setIsSavingPoint] = useState(false);
  const [isSavingCTA, setIsSavingCTA] = useState(false);
  const [copiedHookIndex, setCopiedHookIndex] = useState<number | null>(null);
  const [copiedAllHashtags, setCopiedAllHashtags] = useState(false);


  const [pointTime, setPointTime] = useState('pagi');
  const [pointWeather, setPointWeather] = useState('terang');
  const [pointCrowd, setPointCrowd] = useState('1-3');
  const [pointLandscape, setPointLandscape] = useState('sawah');
  const [narratorLines, setNarratorLines] = useState<string[]>(['']);
  const [pointPayloadPreview, setPointPayloadPreview] = useState('');

  const [isExtendOpen, setIsExtendOpen] = useState(false);
  const [narratorTextExtend, setNarratorTextExtend] = useState('');
  const [extendLines, setExtendLines] = useState<string[]>(['']);

  const [copiedResumeField, setCopiedResumeField] = useState(null);

  // Initialize states from quote data if available
  useEffect(() => {
    // Set hookCaption from quote_text
    if (quote.quote_text) {
      setHookCaption(quote.quote_text);
    }

    // Parse hashtag data for suggestions
    if (quote.hashtag) {
      try {
        const parsedData = JSON.parse(quote.hashtag);
        
        if (parsedData && typeof parsedData === 'object') {
          // Handle suggestion format (array of objects)
          if (Array.isArray(parsedData.suggestion)) {
            const hookTexts = [];
            const hashtags = [];
            
            parsedData.suggestion.forEach((item) => {
              if (item.hook_text) {
                // Split hook_text by comma and add to array
                item.hook_text.split(',').forEach(text => {
                  const trimmedText = text.trim();
                  if (trimmedText) hookTexts.push(trimmedText);
                });
              }
              if (Array.isArray(item.hashtag)) {
                item.hashtag.forEach((tag) => {
                  if (typeof tag === 'string') hashtags.push(tag.trim());
                });
              }
            });
            
            setGeneratedHookTexts(hookTexts);
            setGeneratedHashtags(hashtags);
          } 
          // Handle direct format (object with hook_text and hashtag arrays)
          else {
            if (Array.isArray(parsedData.hook_text)) {
              // Split each hook_text by comma and flatten
              const hookTexts = parsedData.hook_text.flatMap(text => 
                String(text).split(',').map(t => t.trim()).filter(Boolean)
              );
              setGeneratedHookTexts(hookTexts);
            }
            
            if (Array.isArray(parsedData.hashtag)) {
              setGeneratedHashtags(parsedData.hashtag.map(tag => String(tag).trim()).filter(Boolean));
            }
          }
        }
      } catch (error) {
        console.error('Error parsing hashtag data:', error);
        // Fallback jika parsing JSON gagal, coba split manual jika formatnya string biasa
        if (typeof quote.hashtag === 'string') {
          const lines = quote.hashtag.split('\n').filter(Boolean);
          if (lines.length > 0) {
            // Asumsikan baris pertama adalah hook text, sisanya hashtag
            const firstLine = lines[0].split(',').map(t => t.trim()).filter(Boolean);
            const remainingLines = lines.slice(1).join(' ').split(/[\s,]+/).map(t => t.trim()).filter(Boolean);
            setGeneratedHookTexts(firstLine);
            setGeneratedHashtags(remainingLines);
          }
        }
      }
    }
    // Reset generating state jika quote berubah
    setIsGeneratingHook(false);
  }, [quote]);

  // Auto-update payload preview ketika hookWords atau hookCaption berubah
  useEffect(() => {
    setPayloadPreview(buildPayload());
  }, [hookWords, hookCaption]);

  // Initialize payload preview saat pertama kali
  useEffect(() => {
    setPayloadPreview(buildPayload());
  }, []);

  // Fungsi copy untuk hook text individual
  const handleCopyHookText = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedHookIndex(index);
    setTimeout(() => setCopiedHookIndex(null), 2000);
  };

  // Fungsi copy untuk semua hashtag
  const handleCopyAllHashtags = () => {
    const allTags = generatedHashtags.join(' '); // Gabungkan semua hashtag dengan spasi
    navigator.clipboard.writeText(allTags);
    setCopiedAllHashtags(true);
    setTimeout(() => setCopiedAllHashtags(false), 2000);
  };

  useEffect(() => {
    setPointPayloadPreview(buildPointPayload());
    if (quote.main_text) setPointVideoText(quote.main_text);
    if (quote.cta_text) setCtaText(quote.cta_text);
  }, [quote, pointTime, pointWeather, pointCrowd, pointLandscape, narratorLines, extendLines, isExtendOpen]);

  const addNarratorLine = () => {
    setNarratorLines([...narratorLines, '']);
  };
  
  const updateNarratorLine = (index: number, value: string) => {
    const newLines = [...narratorLines];
    newLines[index] = value;
    setNarratorLines(newLines);
  };

  const removeNarratorLine = (index: number) => {
    if (narratorLines.length <= 1) return;
    const newLines = narratorLines.filter((_, i) => i !== index);
    setNarratorLines(newLines);
  };

  // Hitung total kata dari semua narratorLines
  const totalNarratorWords = narratorLines
    .flatMap(line => line.trim().split(/\s+/))
    .filter(word => word.length > 0)
    .length;

  // Batas maksimal kata untuk 10 detik
  const MAX_WORDS = 22;
  const isOverLimit = totalNarratorWords > MAX_WORDS;

  // Hitung total kata dari extendLines
  const totalExtendWords = extendLines
    .flatMap(line => line.trim().split(/\s+/))
    .filter(word => word.length > 0)
    .length;
  
  const isExtendOverLimit = totalExtendWords > MAX_WORDS;

  // Build Point Payload Preview
  const buildPointPayload = () => {
    const timeMap = { pagi: 'pagi', sore: 'sore', malam: 'malam' };
    const weatherMap = { terang: 'terang', berkabut: 'berkabut', hujan: 'hujan' };
    const crowdMap = { '1-3': '1 sampai 3', '4-8': '4 sampai 8', '10+': '10+' };
    const landscapeMap = { sawah: 'sawah', pantai: 'pantai', gunung: 'gunung', kota: 'kota' };
    
    const narratorText = narratorLines.filter(line => line.trim()).join('.. ');
    const extendText = extendLines.filter(line => line.trim()).join('.. ');
    
    // Hitung total kata
    const totalWords = narratorLines
      .flatMap(line => line.trim().split(/\s+/))
      .filter(word => word.length > 0)
      .length;
    
    // Instruksi otomatis berdasarkan jumlah kata
    let wordInstruction = '';
    if (totalWords > MAX_WORDS) {
      wordInstruction = `\nPENTING: Narasi saat ini ${totalWords} kata, terlalu panjang untuk durasi 10 detik. Ringkas dan sederhanakan menjadi maksimal ${MAX_WORDS} kata tanpa mengubah makna dan emosi utama. Prioritaskan kalimat pertama dan kedua.`;
    } else if (totalWords > 18) {
      wordInstruction = `\nCATATAN: Narasi ${totalWords} kata mendekati batas. Baca dengan kecepatan normal 150 kata per menit agar selesai tepat di detik ke-10.`;
    }
    
    // Bagian Extend Prompt
    let extendInstruction = '';
    if (isExtendOpen) {
      extendInstruction = `
      
EXTEND PROMPT (untuk video lanjutan 10 detik berikutnya):
Masih dalam kegiatan yang sama, Bomba melakukan ${quote.main_topic} didukung oleh suasana video.
Narator melanjutkan pembacaan ${extendText || '...'}.
Gunakan fitur extend untuk melanjutkan video dari detik 10 sampai 20 dengan gaya dan suasana yang konsisten.`;
    }
    
    return `Bomba beralih ke video dengan latar suasana pada ${timeMap[pointTime]} hari didaerah ${landscapeMap[pointLandscape]}. Kondisi cuaca saat itu ${weatherMap[pointWeather]}, kamera dilayar menangkap ada sekitar ${crowdMap[pointCrowd]} orang disekitar ini.
video bergerak pelan, lembut menyisir area ${landscapeMap[pointLandscape]} itu. Bomba yang sedang ${quote.main_topic} tampak bersemangat beraksi di pojok kanan atas video.
detik 0 sampai 1 buatkan animasi bomba melompat dari halaman sebelumnya ke pojok kanan atas video ini.
detik 1 sampai 10 narator berbicara dengan gaya penyampaian khas penyiar radio FM disekitar tahun 2000. Narator berbicara ${narratorText || '...'}.
text yang dibacakan narator dimunculkan kata perkata dengan format font Cormorant Garamond berukuran 18 pixel, warna font text kontrak menyesuaikan latar video.
lokasi text ada di bagian bawah tengah video, kemunculan kata maksimal 4 kata dalam satu baris.
Narator membacakan cerita dengan berwibawa dan tidak tergesa-gesa.${wordInstruction}${extendInstruction}`;
  };
  
  // Fungsi untuk toggle Extend Prompt
  const toggleExtendPrompt = () => {
    setIsExtendOpen(!isExtendOpen);
    // Reset extend lines saat toggle
    if (!isExtendOpen) {
      setExtendLines(['']);
      setNarratorTextExtend('');
    }
  };
  // Fungsi untuk menambah line extend
  const addExtendLine = () => {
    setExtendLines([...extendLines, '']);
  };
  // Fungsi untuk update line extend
  const updateExtendLine = (index: number, value: string) => {
    const newLines = [...extendLines];
    newLines[index] = value;
    setExtendLines(newLines);
  // Update narratorTextExtend
    setNarratorTextExtend(newLines.filter(line => line.trim()).join('.. '));
  };
  // Fungsi untuk menghapus line extend
  const removeExtendLine = (index: number) => {
    if (extendLines.length <= 1) return;
    const newLines = extendLines.filter((_, i) => i !== index);
    setExtendLines(newLines);
    setNarratorTextExtend(newLines.filter(line => line.trim()).join('.. '));
  };

  // Fungsi generate Point Video
  const handleGeneratePointVideo = async () => {
    // VALIDASI: cek narasi narator tidak kosong
    if (totalNarratorWords === 0) {
      showNotification('Mohon isi narasi narator terlebih dahulu.', 'error');
      return;
    }
    
    setIsGeneratingPoint(true);
    
    try {
      const payloadToSend = pointPayloadPreview || buildPointPayload();
      
      const response = await fetch('/api/librechat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          payload: payloadToSend,
          type: 'point_video'
        }),
      });
      
      if (!response.ok) {
        throw new Error('Gagal memanggil PromptEngineer untuk Point Video');
      }
      
      const data = await response.json();
      const pointText = data.point_text || data.hook_text || '';
      
      // Update quote dengan main_text + agent_stat = "Main Video - DONE"
      const updated = await updateQuoteMainText(quote.quote_id, pointText);
      onUpdateQuote(updated);
      
      showNotification('Point video script berhasil di-generate dan disimpan!', 'success');
      
    } catch (error) {
      console.error('Error generating point video:', error);
      showNotification('Gagal generate point video. Cek console untuk detail.', 'error');
    } finally {
      setIsGeneratingPoint(false);
    }
  };

  // Fungsi generate CTA
  const handleGenerateCTA = async () => {
    setIsGeneratingCTA(true);
    try {
      const response = await fetch('/api/librechat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          payload: `Buatkan script CTA (Call to Action) untuk video reels dengan tema "${quote.main_topic}". Buat ajakan yang menarik untuk follow, like, dan share.`,
          type: 'cta'
        }),
      });
      
      if (!response.ok) throw new Error('Gagal memanggil agent');
      
      const data = await response.json();
      const ctaResult = data.cta_text || data.hook_text || '';
      
      // Update quote di database
      const updated = await updateQuote(quote.quote_id, { cta_text: ctaResult });
      onUpdateQuote(updated);
      setCtaText(ctaResult);
      
      showNotification('CTA script berhasil di-generate!', 'success');
    } catch (error) {
      console.error('Error generating CTA:', error);
      showNotification('Gagal generate CTA.', 'error');
    } finally {
      setIsGeneratingCTA(false);
    }
  };

  // Build initial payload preview
  const buildPayload = () => {
    return `Buatkan gambar ratio 9:16 untuk Instagram reels, buatkan juga area yang nantinya diisi oleh kalimat hook dengan hiasan atau tampilan mencolok namun tetap selaras dengan gambar yang kamu buat. Gambar ini digunakan sebagai hook reels dengan tema "${quote.main_topic}". Lengkapi gambar ini dengan foto "${quote.public_figure}" sedang berpose ikonik dari tokoh tersebut, kita sebut karakter ini adalah Bomba. Masukkan kalimat "${hookWords || '....'}" di area kotak kalimat hook menggunakan font Poppins cetak tebal dengan warna yang kontras dengan gambar, agar terbaca dengan mudah. Di akhir kalimat hook, masukkan kalimat footer "by: ${quote.public_figure}" dengan menggunakan font Italiana warna dan ukuran font sama dengan kalimat hook. Buat video selama 4 detik menggunakan gambar dan kalimat hook yang sudah dibuat, narator membaca kalimat hook seperti dengan pembawaan penyiar berita FM tahun 2000an yang santai namun bersemangat`;
  };

  // Initialize payload preview when hookCaption changes
  const handleCaptionChange = (e) => {
    setHookCaption(e.target.value);
    // Auto-update payload preview only if it matches the auto-generated pattern --> tutup dulu karena useEffect akan auto-update payload preview
    //if (!payloadPreview || payloadPreview === buildPayload()) {
    //  setPayloadPreview(buildPayload());
    //}
  };

  // Handler untuk hookWords
  const handleHookWordsChange = (e) => {
    setHookWords(e.target.value);
    // Auto-update payload preview only if it matches the auto-generated pattern --> tutup dulu karena useEffect akan auto-update payload preview
    //if (!payloadPreview || payloadPreview === buildPayload()) {
    //  setPayloadPreview(buildPayload());
    //}
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
          payload: hookWords || hookCaption,
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

      // Save raw data to database (updateQuoteHashtag sekarang set agent_stat = "Hashtag - DONE")
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
    // VALIDASI: cek hookWords terlebih dahulu
    if (!hookWords.trim()) {
      setIsHookWordsWarningOpen(true);
      return;
    }
    
    setIsGeneratingHook(true);
    
    try {
      // Gunakan payloadPreview sebagai payload (bukan hookCaption)
      const payloadToSend = payloadPreview || buildPayload();
      
      const response = await fetch('/api/librechat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          payload: payloadToSend,
          type: 'prompt_engineer' // Panggil PromptEngineer agent
        }),
      });
      
      if (!response.ok) {
        throw new Error('Gagal memanggil PromptEngineer');
      }
      
      const data = await response.json();
      const hookText = data.hook_text;
      
      // Update quote with generated hook text (updateQuoteHookText sekarang set agent_stat = "Hook - DONE")
      const updated = await updateQuoteHookText(quote.quote_id, hookText);
      onUpdateQuote(updated);
      
      // Notifikasi sukses
      showNotification('Hook script berhasil di-generate dan disimpan!', 'success');
      
    } catch (error) {
      console.error('Error generating hook:', error);
      showNotification('Gagal generate hook. Cek console untuk detail.', 'error');
    } finally {
      setIsGeneratingHook(false);
    }
  };

  // Fungsi copy untuk Resume Script
  const handleCopyResume = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedResumeField(field);
    setTimeout(() => setCopiedResumeField(null), 2000);
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
            <div className="flex-1 space-y-4 overflow-y-auto pr-2">
              
              {/* SECTION HOOK */}
              <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-purple-300 text-xs uppercase font-sans tracking-wider font-bold">-- Hook --</span>
                  {quote.hook_text ? (
                    <button 
                      onClick={() => handleCopyResume(quote.hook_text, 'hook')}
                      className="text-white/40 hover:text-white transition-colors"
                      title="Copy hook script"
                    >
                      {copiedResumeField === 'hook' ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                    </button>
                  ) : (
                    <span className="text-white/20 text-[10px]">Belum tersedia</span>
                  )}
                </div>
                {quote.hook_text ? (
                  <p className="text-white/80 leading-relaxed font-serif text-sm">{quote.hook_text}</p>
                ) : (
                  <p className="text-white/30 italic text-xs">Hook script belum di-generate...</p>
                )}
              </div>
              
              {/* SECTION POINT VIDEO */}
              <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-blue-300 text-xs uppercase font-sans tracking-wider font-bold">-- Point Video --</span>
                  {quote.main_text ? (
                    <button 
                      onClick={() => handleCopyResume(quote.main_text, 'point')}
                      className="text-white/40 hover:text-white transition-colors"
                      title="Copy point video script"
                    >
                      {copiedResumeField === 'point' ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                    </button>
                  ) : (
                    <span className="text-white/20 text-[10px]">Belum tersedia</span>
                  )}
                </div>
                {quote.main_text ? (
                  <p className="text-white/80 leading-relaxed font-serif text-sm">{quote.main_text}</p>
                ) : (
                  <p className="text-white/30 italic text-xs">Point video script belum di-generate...</p>
                )}
              </div>
              
              {/* SECTION CTA */}
              <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-green-300 text-xs uppercase font-sans tracking-wider font-bold">-- CTA --</span>
                  {quote.cta_text ? (
                    <button 
                      onClick={() => handleCopyResume(quote.cta_text, 'cta')}
                      className="text-white/40 hover:text-white transition-colors"
                      title="Copy CTA script"
                    >
                      {copiedResumeField === 'cta' ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                    </button>
                  ) : (
                    <span className="text-white/20 text-[10px]">Belum tersedia</span>
                  )}
                </div>
                {quote.cta_text ? (
                  <p className="text-white/80 leading-relaxed font-serif text-sm">{quote.cta_text}</p>
                ) : (
                  <p className="text-white/30 italic text-xs">CTA script belum di-generate...</p>
                )}
              </div>
              
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

                    {/* HOOK WORDS */}
                    <div>
                      <label className="block text-white/80 mb-1.5 text-xs">Hook Words</label>
                      <input 
                        type="text"
                        value={hookWords}
                        onChange={handleHookWordsChange}
                        placeholder="Contoh: Rahasia Sukses Steve Jobs!"
                        className="w-full bg-black/20 border border-white/20 rounded-lg px-3 py-2 text-white outline-none focus:border-purple-400/50 transition-colors text-sm"
                      />
                    </div>

                    {/* Card Suggestion */}
                    {(generatedHookTexts.length > 0 || generatedHashtags.length > 0) && (
                      <div className="p-4 bg-black/30 border border-purple-500/30 rounded-xl">
                        <label className="flex items-center gap-2 text-purple-300/80 mb-2 text-xs font-semibold uppercase tracking-wider">
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
                                    onClick={() => handleCopyHookText(text, index)}
                                    className="text-white/40 hover:text-white transition-colors shrink-0 mt-0.5"
                                    title="Copy hook text"
                                  >
                                    {copiedHookIndex === index ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
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
                                <span key={index} className="text-xs text-purple-200 bg-purple-500/20 border border-purple-500/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                                  {tag}
                                  <button 
                                    onClick={() => {
                                      navigator.clipboard.writeText(tag);
                                      // Anda bisa menambahkan state untuk menandai tag yang dicopy jika perlu
                                    }}
                                    className="text-purple-300/50 hover:text-purple-100 transition-colors"
                                    title="Copy hashtag"
                                  >
                                    <Copy size={12} />
                                  </button>
                                </span>
                              ))}
                              {/* Tombol untuk copy semua hashtag */}
                              <button 
                                onClick={handleCopyAllHashtags}
                                className="text-xs text-purple-200 bg-purple-500/20 border border-purple-500/30 px-2 py-0.5 rounded-md hover:bg-purple-500/40 transition-colors flex items-center gap-1"
                              >
                                {copiedAllHashtags ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                                Copy All
                              </button>
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
                disabled={isGeneratingHook} 
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg transition-colors font-medium shadow-lg backdrop-blur-sm ${
                  isGeneratingHook 
                    ? 'bg-purple-900/60 border border-purple-700/50 text-white/60 cursor-not-allowed' 
                    : 'bg-purple-500/60 hover:bg-purple-500/80 border border-purple-400/50 shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                }`}
              >
                {isGeneratingHook ? (
                  <><Loader2 size={16} className="animate-spin" /> Generating Hook...</>
                ) : (
                  <><Sparkles size={16} /> Generate Hook Script</>
                )}
              </button>
            </div>
          </div>

          {/* CARD 2: POINT VIDEO */}
          <div className="bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl rounded-2xl p-6 flex flex-col">
            <div className="flex justify-between items-center mb-4">
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
                  <div className="pt-4 mt-4 border-t border-white/10 flex flex-col gap-4">
                    
                    {/* Line 1: Input read-only */}
                    <div>
                      <input 
                        type="text"
                        readOnly
                        value="Buatkan video dengan aspek ratio 9:16 untuk Instagram Reels, detail latar video sebagai berikut"
                        className="w-full bg-black/20 border border-white/20 rounded-lg px-3 py-2 text-white/80 outline-none cursor-not-allowed text-xs"
                      />
                    </div>
                    
										{/* Line 2: Dropdown waktu & cuaca */}
										<div className="grid grid-cols-2 gap-3">
										<div>
											<label className="block text-white/60 mb-1 text-xs uppercase tracking-wider">Waktu</label>
											<select 
											value={pointTime}
											onChange={(e) => setPointTime(e.target.value)}  // ← SIMPLIFIKASI
											className="w-full bg-black/40 border border-white/20 rounded-lg px-3 py-2 text-white outline-none appearance-none focus:border-blue-400/50 transition-colors text-xs"
											>
											<option value="pagi" className="bg-gray-900 text-white">Pagi</option>
											<option value="sore" className="bg-gray-900 text-white">Sore</option>
											<option value="malam" className="bg-gray-900 text-white">Malam</option>
											</select>
										</div>
										<div>
											<label className="block text-white/60 mb-1 text-xs uppercase tracking-wider">Cuaca</label>
											<select 
											value={pointWeather}
											onChange={(e) => setPointWeather(e.target.value)}  // ← SIMPLIFIKASI
											className="w-full bg-black/40 border border-white/20 rounded-lg px-3 py-2 text-white outline-none appearance-none focus:border-blue-400/50 transition-colors text-xs"
											>
											<option value="terang" className="bg-gray-900 text-white">Terang</option>
											<option value="berkabut" className="bg-gray-900 text-white">Berkabut</option>
											<option value="hujan" className="bg-gray-900 text-white">Hujan</option>
											</select>
										</div>
										</div>
                    
                   	{/* Line 3: Dropdown keramaian & landscape */}
							        <div className="grid grid-cols-2 gap-3">
								          <div>
									          <label className="block text-white/60 mb-1 text-xs uppercase tracking-wider">Keramaian</label>
									          <select 
									          value={pointCrowd}
									        onChange={(e) => setPointCrowd(e.target.value)}  // ← SIMPLIFIKASI
									        className="w-full bg-black/40 border border-white/20 rounded-lg px-3 py-2 text-white outline-none appearance-none focus:border-blue-400/50 transition-colors text-xs"
									      >
									        <option value="1-3" className="bg-gray-900 text-white">1 s/d 3 orang</option>
									        <option value="4-8" className="bg-gray-900 text-white">4 s/d 8 orang</option>
									        <option value="10+" className="bg-gray-900 text-white">10++</option>
									    </select>
								          </div>
								          <div>
									        <label className="block text-white/60 mb-1 text-xs uppercase tracking-wider">Landscape</label>
									    <select 
									        value={pointLandscape}
									        onChange={(e) => setPointLandscape(e.target.value)}  // ← SIMPLIFIKASI
									        className="w-full bg-black/40 border border-white/20 rounded-lg px-3 py-2 text-white outline-none appearance-none focus:border-blue-400/50 transition-colors text-xs"
									      >
									        <option value="sawah" className="bg-gray-900 text-white">Sawah</option>
									        <option value="pantai" className="bg-gray-900 text-white">Pantai</option>
									        <option value="gunung" className="bg-gray-900 text-white">Gunung</option>
									            <option value="kota" className="bg-gray-900 text-white">Kota</option>
									        </select>
								      </div>
							      </div>
                    
                    {/* Line 4+: Narrator input boxes */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-white/60 text-xs uppercase tracking-wider">Narator</label>
                        {/* COUNTER KATA */}
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                            isOverLimit 
                              ? 'bg-red-500/20 text-red-300 border-red-400/40' 
                              : totalNarratorWords > 18 
                                ? 'bg-yellow-500/20 text-yellow-300 border-yellow-400/40' 
                                : 'bg-green-500/20 text-green-300 border-green-400/40'
                          }`}>
                            {totalNarratorWords}/{MAX_WORDS} kata
                          </span>
                        </div>
                      </div>
                      
                      {/* WARNING jika melebihi batas */}
                      {isOverLimit && (
                        <div className="mb-2 flex items-start gap-2 bg-red-500/10 border border-red-400/30 rounded-lg px-3 py-2">
                          <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
                          <p className="text-red-300 text-[11px] leading-relaxed">
                            Narasi terlalu panjang ({totalNarratorWords} kata) untuk durasi 10 detik. 
                            Maksimal {MAX_WORDS} kata agar selesai dibaca tepat waktu. 
                            AI akan otomatis meringkas saat generate.
                          </p>
                        </div>
                      )}
                      
                      {/* WARNING jika mendekati batas */}
                      {!isOverLimit && totalNarratorWords > 18 && (
                        <div className="mb-2 flex items-start gap-2 bg-yellow-500/10 border border-yellow-400/30 rounded-lg px-3 py-2">
                          <AlertTriangle size={14} className="text-yellow-400 shrink-0 mt-0.5" />
                          <p className="text-yellow-300 text-[11px] leading-relaxed">
                            Narasi mendekati batas ({totalNarratorWords}/{MAX_WORDS} kata). 
                            Disarankan menambah 1-2 detik durasi atau meringkas kalimat.
                          </p>
                        </div>
                      )}
                      
                      <div className="space-y-2">
                        {narratorLines.map((line, index) => (
                          <div key={index} className="relative flex items-center gap-2">
                            <input 
                              type="text"
                              value={line}
                              onChange={(e) => updateNarratorLine(index, e.target.value)}
                              placeholder={`Kata-kata narator ${index + 1}...`}
                              className={`flex-1 w-full bg-black/20 border rounded-lg px-3 py-2 text-white outline-none transition-colors text-xs ${
                                isOverLimit 
                                  ? 'border-red-400/40 focus:border-red-400/60' 
                                  : 'border-white/20 focus:border-blue-400/50'
                              }`}
                            />
                            {index === narratorLines.length - 1 ? (
                              <button 
                                onClick={addNarratorLine}
                                className="p-2 bg-blue-500/40 hover:bg-blue-500/70 border border-blue-400/50 rounded-lg text-white transition-colors shrink-0"
                                title="Tambahkan line narator"
                              >
                                <Plus size={16} />
                              </button>
                            ) : (
                              <button 
                                onClick={() => removeNarratorLine(index)}
                                className="p-2 bg-red-500/30 hover:bg-red-500/50 border border-red-400/40 rounded-lg text-red-200 transition-colors shrink-0"
                                title="Hapus line narator"
                              >
                                <Minus size={16} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Payload Preview Point */}
                    <div className="p-4 bg-black/40 border border-blue-500/30 rounded-xl relative flex flex-col">
                      <label className="flex items-center gap-2 text-blue-300/80 mb-2 text-xs font-semibold uppercase tracking-wider">
                        <Code size={14} /> Payload Preview (Editable)
                      </label>
                      <textarea 
                        value={pointPayloadPreview || buildPointPayload()} 
                        onChange={(e) => setPointPayloadPreview(e.target.value)} 
                        rows="8" 
                        className="w-full bg-transparent text-white/80 outline-none resize-y text-xs italic min-h-[150px] border border-white/10 rounded-lg p-2 focus:border-blue-400/50 transition-colors"
                      ></textarea>
                    </div>

                    {/* BUTTON EXTEND PROMPT */}
                    <div className="flex justify-end">
                      <button 
                        onClick={toggleExtendPrompt}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-xs font-medium border ${
                          isExtendOpen 
                            ? 'bg-blue-500/30 border-blue-400/50 text-blue-200' 
                            : 'bg-white/5 border-white/20 text-white/70 hover:bg-white/15'
                        }`}
                      >
                        {isExtendOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        {isExtendOpen ? 'Tutup Extend Prompt' : 'Extend Prompt'}
                      </button>
                    </div>
                    {/* EXTEND PROMPT SECTION */}
                    <AnimatePresence>
                      {isExtendOpen && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }} 
                          animate={{ height: 'auto', opacity: 1 }} 
                          exit={{ height: 0, opacity: 0 }} 
                          className="overflow-hidden"
                        >
                          <div className="p-4 bg-blue-900/20 border border-blue-400/30 rounded-xl flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                              <label className="flex items-center gap-2 text-blue-300/80 text-xs font-semibold uppercase tracking-wider">
                                <Sparkles size={14} /> Extend Prompt (Video 2 - 10 Detik)
                              </label>
                              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                                isExtendOverLimit 
                                  ? 'bg-red-500/20 text-red-300 border-red-400/40' 
                                  : totalExtendWords > 18 
                                    ? 'bg-yellow-500/20 text-yellow-300 border-yellow-400/40' 
                                    : 'bg-green-500/20 text-green-300 border-green-400/40'
                              }`}>
                                {totalExtendWords}/{MAX_WORDS} kata
                              </span>
                            </div>
                            
                            {/* Info bridging */}
                            <div className="bg-black/20 border border-blue-400/20 rounded-lg px-3 py-2 text-[11px] text-blue-200/80 leading-relaxed">
                              <p className="font-semibold mb-1">Bridging Text:</p>
                              <p className="italic">"Masih dalam kegiatan yang sama, Bomba melakukan {quote.main_topic} didukung oleh suasana video."</p>
                            </div>
                            
                            {/* Warning jika over limit */}
                            {isExtendOverLimit && (
                              <div className="flex items-start gap-2 bg-red-500/10 border border-red-400/30 rounded-lg px-3 py-2">
                                <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
                                <p className="text-red-300 text-[11px] leading-relaxed">
                                  Narasi extend terlalu panjang ({totalExtendWords} kata) untuk durasi 10 detik. 
                                  Maksimal {MAX_WORDS} kata agar selesai dibaca tepat waktu.
                                </p>
                              </div>
                            )}
                            
                            {/* Input extend lines */}
                            <div className="space-y-2">
                              {extendLines.map((line, index) => (
                                <div key={index} className="relative flex items-center gap-2">
                                  <input 
                                    type="text"
                                    value={line}
                                    onChange={(e) => updateExtendLine(index, e.target.value)}
                                    placeholder={`Kata-kata narator extend ${index + 1}...`}
                                    className={`flex-1 w-full bg-black/20 border rounded-lg px-3 py-2 text-white outline-none transition-colors text-xs ${
                                      isExtendOverLimit 
                                        ? 'border-red-400/40 focus:border-red-400/60' 
                                        : 'border-white/20 focus:border-blue-400/50'
                                    }`}
                                  />
                                  {index === extendLines.length - 1 ? (
                                    <button 
                                      onClick={addExtendLine}
                                      className="p-2 bg-blue-500/40 hover:bg-blue-500/70 border border-blue-400/50 rounded-lg text-white transition-colors shrink-0"
                                      title="Tambahkan line extend"
                                    >
                                      <Plus size={16} />
                                    </button>
                                  ) : (
                                    <button 
                                      onClick={() => removeExtendLine(index)}
                                      className="p-2 bg-red-500/30 hover:bg-red-500/50 border border-red-400/40 rounded-lg text-red-200 transition-colors shrink-0"
                                      title="Hapus line extend"
                                    >
                                      <Minus size={16} />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                            
                            {/* Preview extend text */}
                            <div className="bg-black/20 border border-white/10 rounded-lg px-3 py-2">
                              <p className="text-[10px] text-blue-300/60 uppercase tracking-wider mb-1 font-semibold">Preview Extend:</p>
                              <p className="text-[11px] text-white/70 italic leading-relaxed">
                                "Masih dalam kegiatan yang sama, Bomba melakukan {quote.main_topic} didukung oleh suasana video. Narator melanjutkan pembacaan {narratorTextExtend || '...'}."
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* Button Generate Point Video */}
            <div className="flex justify-end pt-4 border-t border-white/10 mt-4">
              <button 
                onClick={handleGeneratePointVideo}
                disabled={isGeneratingPoint}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg transition-colors font-medium shadow-lg backdrop-blur-sm ${
                  isGeneratingPoint 
                    ? 'bg-blue-900/60 border border-blue-700/50 text-white/60 cursor-not-allowed' 
                    : 'bg-blue-500/60 hover:bg-blue-500/80 border border-blue-400/50 shadow-[0_0_15px_rgba(59,130,246,0.4)]'
                }`}
              >
                {isGeneratingPoint ? (
                  <><Loader2 size={16} className="animate-spin" /> Generating Point Video...</>
                ) : (
                  <><Sparkles size={16} /> Generate Point Video Script</>
                )}
              </button>
            </div>
          </div>

					{/* CARD 3: CTA */}
					<div className="bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl rounded-2xl p-6 flex flex-col">
					<div className="flex justify-between items-center mb-4">
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
							<div className="pt-4 mt-4 border-t border-white/10 flex flex-col gap-4">
							{/* Textarea untuk CTA */}
							<div>
								<label className="block text-white/80 mb-1.5 text-xs">Script CTA</label>
								<textarea 
								value={ctaText}
								onChange={(e) => setCtaText(e.target.value)}
								rows="3" 
								placeholder="Tulis atau generate script CTA di sini..."
								className="w-full bg-black/20 border border-white/20 rounded-lg px-3 py-2 text-white outline-none focus:border-green-400/50 transition-colors resize-y text-sm"
								></textarea>
							</div>
							
							{/* Tombol Generate */}
							<div className="flex justify-end">
								<button 
								onClick={handleGenerateCTA}
								disabled={isGeneratingCTA}
								className={`flex items-center gap-2 px-6 py-2.5 rounded-lg transition-colors font-medium shadow-lg backdrop-blur-sm ${
									isGeneratingCTA 
									? 'bg-green-900/60 border border-green-700/50 text-white/60 cursor-not-allowed' 
									: 'bg-green-500/60 hover:bg-green-500/80 border border-green-400/50 shadow-[0_0_15px_rgba(34,197,94,0.4)]'
								}`}
								>
								{isGeneratingCTA ? (
									<><Loader2 size={16} className="animate-spin" /> Generating...</>
								) : (
									<><Sparkles size={16} /> Generate CTA Script</>
								)}
								</button>
							</div>
							</div>
						</motion.div>
						)}
					</AnimatePresence>

          {/* MODAL PERINGATAN HOOK WORDS */}
          <AnimatePresence>
            {isHookWordsWarningOpen && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            >
              <motion.div 
              initial={{ scale: 0.9, y: 20 }} 
              animate={{ scale: 1, y: 0 }} 
              exit={{ scale: 0.9, y: 20 }} 
              className="relative w-full max-w-sm bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-2xl p-8 text-center text-white"
              >
              <button 
                onClick={() => setIsHookWordsWarningOpen(false)} 
                className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/20 border border-white/10 rounded-full transition-colors"
              >
                <X size={18} />
              </button>
					
					    <div className="flex justify-center mb-4">
						    <div className="p-3 bg-yellow-500/20 border border-yellow-400/30 rounded-full">
					    	<AlertTriangle size={32} className="text-yellow-300" />
					    	</div>
					    </div>
					
					    <h2 className="text-xl font-bold mb-2">Hook Words Kosong</h2>
					    <p className="text-white/70 text-sm mb-6">
					    	Mohon isi input <span className="font-semibold text-yellow-300">Hook Words</span> terlebih dahulu sebelum generate hook script.
					    </p>
					
					    <div className="flex justify-center gap-3">
					    	<button 
					    	onClick={() => setIsHookWordsWarningOpen(false)} 
					    	className="px-5 py-2.5 bg-yellow-500/40 hover:bg-yellow-500/60 border border-yellow-400/50 rounded-lg transition-colors text-sm font-medium"
					    	>
					    	Mengerti
					    	</button>
					    </div>
					    </motion.div>
				    </motion.div>
				    )}
			    </AnimatePresence>

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