// components/views/Worksheet.tsx

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, BookOpen, Loader2, ChevronDown, ChevronUp, Save, Copy, Check, Sparkles, Code, Wand2, X, ImageIcon, Upload, Play, Pause, Volume2 } from 'lucide-react';
import { updateQuote, updateQuoteHashtag, updateQuoteHookText } from '@/lib/actions';

interface NotificationProps {
  message: string;
  type: string;
  onClose: () => void;
}

// Komponen notifikasi sederhana
const Notification = ({ message, type, onClose }: NotificationProps) => {
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

// Parse respons agent Hook Result menjadi array picture & transition.
// Toleran terhadap markdown code fence dan format lama (non-JSON).
const parseHookScript = (raw: string | null | undefined) => {
  if (!raw) return { picture: [], transition: [] };
  const cleaned = String(raw)
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();
  try {
    const parsed: any = JSON.parse(cleaned);
    const picture = Array.isArray(parsed?.picture)
      ? parsed.picture.map((p: any) => String(p).trim()).filter(Boolean)
      : [];
    const transition = Array.isArray(parsed?.transition)
      ? parsed.transition.map((t: any) => String(t).trim()).filter(Boolean)
      : [];
    return { picture, transition };
  } catch (error) {
    console.error('Error parsing hook script:', error);
    return { picture: [], transition: [] };
  }
};

interface WorksheetProps {
  quote: any;
  onBack: () => void;
  onUpdateQuote: (quote: any) => void;
}

export default function Worksheet({ quote, onBack, onUpdateQuote }: WorksheetProps) {
const [copiedField, setCopiedField] = useState<string | null>(null);
const [isHookExpanded, setIsHookExpanded] = useState(false);
const [hookCaption, setHookCaption] = useState('');
const [notification, setNotification] = useState<{ message: string; type: string } | null>(null);

// Input baru untuk payload
const [media, setMedia] = useState('');
const [hookInput, setHookInput] = useState('');
const [payloadPreview, setPayloadPreview] = useState('');

// Hasil agent ImageGenerator (disimpan ke quote.hook_text)
const [hookPictures, setHookPictures] = useState<string[]>([]);
const [hookTransitions, setHookTransitions] = useState<string[]>([]);
const [isGeneratingHook, setIsGeneratingHook] = useState(false);
const [copiedHookPictureIndex, setCopiedHookPictureIndex] = useState<number | null>(null);
const [copiedHookTransitionIndex, setCopiedHookTransitionIndex] = useState<number | null>(null);

// Suggestion (tombol wand)
const [generatedHookTexts, setGeneratedHookTexts] = useState<string[]>([]);
const [generatedHashtags, setGeneratedHashtags] = useState<string[]>([]);
const [isGeneratingCaptions, setIsGeneratingCaptions] = useState(false);
const [isSavingHookData, setIsSavingHookData] = useState(false);
const [isSaving, setIsSaving] = useState(false);
const [copiedHookIndex, setCopiedHookIndex] = useState<number | null>(null);
const [copiedAllHashtags, setCopiedAllHashtags] = useState(false);

// Generate gambar via Gemini -> S3
const [generatingImageIndex, setGeneratingImageIndex] = useState<number | null>(null);
const [uploadingImageIndex, setUploadingImageIndex] = useState<number | null>(null);
const [targetUploadIndex, setTargetUploadIndex] = useState<number | null>(null);
const fileInputRef = useRef<HTMLInputElement | null>(null);
const [imageVersions, setImageVersions] = useState<Record<number, number>>({});
const [missingImages, setMissingImages] = useState<Record<number, boolean>>({});
const [previewImageIndex, setPreviewImageIndex] = useState<number | null>(null);

const imageSrc = (index: number) =>
  `/api/gemini-image?quote_id=${quote.quote_id}&index=${index + 1}&v=${imageVersions[index] || 0}`;

const handleGenerateImage = async (prompt: string, index: number) => {
  setGeneratingImageIndex(index);
  try {
    const response = await fetch('/api/gemini-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quote_id: quote.quote_id, index: index + 1, prompt }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Gagal generate gambar');
    }
    setMissingImages(prev => ({ ...prev, [index]: false }));
    setImageVersions(prev => ({ ...prev, [index]: Date.now() }));
    showNotification(`Gambar #${index + 1} berhasil di-generate dan disimpan ke S3!`, 'success');
  } catch (error) {
    console.error('Error generating image:', error);
    showNotification(error instanceof Error ? error.message : 'Gagal generate gambar', 'error');
  } finally {
    setGeneratingImageIndex(null);
  }
};

const handleTriggerUpload = (index: number) => {
  setTargetUploadIndex(index);
  fileInputRef.current?.click();
};

const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file || targetUploadIndex === null) return;
  const index = targetUploadIndex;
  e.target.value = '';

  setUploadingImageIndex(index);
  try {
    const formData = new FormData();
    formData.append('quote_id', String(quote.quote_id));
    formData.append('index', String(index + 1));
    formData.append('file', file);

    const response = await fetch('/api/gemini-image', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Gagal upload gambar ke S3');
    }

    setMissingImages(prev => ({ ...prev, [index]: false }));
    setImageVersions(prev => ({ ...prev, [index]: Date.now() }));
    showNotification(`Gambar #${index + 1} berhasil diupload ke S3!`, 'success');
  } catch (error) {
    console.error('Error uploading image:', error);
    showNotification(error instanceof Error ? error.message : 'Gagal upload gambar ke S3', 'error');
  } finally {
    setUploadingImageIndex(null);
    setTargetUploadIndex(null);
  }
};

// Audio narration state (Transition Prompts)
const [uploadingAudioIndex, setUploadingAudioIndex] = useState<number | null>(null);
const [targetUploadAudioIndex, setTargetUploadAudioIndex] = useState<number | null>(null);
const audioFileInputRef = useRef<HTMLInputElement | null>(null);
const [hasAudios, setHasAudios] = useState<Record<number, boolean>>({});
const [audioVersions, setAudioVersions] = useState<Record<number, number>>({});
const [playingAudioIndex, setPlayingAudioIndex] = useState<number | null>(null);
const audioElementRef = useRef<HTMLAudioElement | null>(null);

const audioSrc = (index: number) =>
  `/api/gemini-image?quote_id=${quote.quote_id}&index=${index + 1}&media_type=audio&v=${audioVersions[index] || 0}`;

// Cek file gambar & audio yang sudah tersimpan di S3 saat quote dimuat
useEffect(() => {
  if (!quote?.quote_id) return;
  fetch(`/api/gemini-image?quote_id=${quote.quote_id}&action=list`)
    .then(res => res.json())
    .then(data => {
      if (Array.isArray(data.audios)) {
        const audioMap: Record<number, boolean> = {};
        data.audios.forEach((idx: number) => {
          audioMap[idx - 1] = true;
        });
        setHasAudios(audioMap);
      }
      if (Array.isArray(data.images)) {
        setMissingImages(prev => {
          const updated = { ...prev };
          data.images.forEach((idx: number) => {
            updated[idx - 1] = false;
          });
          return updated;
        });
      }
    })
    .catch(err => console.error('Error fetching asset list:', err));
}, [quote.quote_id]);

// Cleanup audio saat unmount
useEffect(() => {
  return () => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current = null;
    }
  };
}, []);

const handleTogglePlayAudio = (index: number) => {
  if (playingAudioIndex === index) {
    audioElementRef.current?.pause();
    setPlayingAudioIndex(null);
    return;
  }

  if (!audioElementRef.current) {
    audioElementRef.current = new Audio();
  }

  const audio = audioElementRef.current;
  audio.src = audioSrc(index);
  audio.onended = () => setPlayingAudioIndex(null);
  audio.onerror = () => {
    setPlayingAudioIndex(null);
    showNotification('Gagal memutar audio narator dari S3', 'error');
  };

  audio.play().then(() => {
    setPlayingAudioIndex(index);
  }).catch(err => {
    console.error('Audio play error:', err);
    setPlayingAudioIndex(null);
    showNotification('Tidak dapat memutar audio', 'error');
  });
};

const handleTriggerAudioUpload = (index: number) => {
  setTargetUploadAudioIndex(index);
  audioFileInputRef.current?.click();
};

const handleAudioFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file || targetUploadAudioIndex === null) return;
  const index = targetUploadAudioIndex;
  e.target.value = '';

  setUploadingAudioIndex(index);
  try {
    const formData = new FormData();
    formData.append('quote_id', String(quote.quote_id));
    formData.append('index', String(index + 1));
    formData.append('media_type', 'audio');
    formData.append('file', file);

    const response = await fetch('/api/gemini-image', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Gagal upload audio ke S3');
    }

    setHasAudios(prev => ({ ...prev, [index]: true }));
    setAudioVersions(prev => ({ ...prev, [index]: Date.now() }));
    showNotification(`Audio narator #${index + 1} berhasil diupload ke S3!`, 'success');
  } catch (error) {
    console.error('Error uploading audio:', error);
    showNotification(error instanceof Error ? error.message : 'Gagal upload audio ke S3', 'error');
  } finally {
    setUploadingAudioIndex(null);
    setTargetUploadAudioIndex(null);
  }
};

// Menandai apakah user sudah mengedit Payload Preview secara manual.
// Selama belum, preview tetap auto-sync dari Media/Hook Text/Quote.
const hasEditedPayloadRef = useRef(false);

  // Initialize states from quote data if available
  useEffect(() => {
    // Set hookCaption from quote_text
    if (quote.quote_text) {
      setHookCaption(quote.quote_text);
    }
    // Parse hook script (picture & transition) dari quote.hook_text
    const hookScript = parseHookScript(quote.hook_text);
    setHookPictures(hookScript.picture);
    setHookTransitions(hookScript.transition);
    // Parse hashtag data for suggestions
    if (quote.hashtag) {
      try {
        const parsedData = JSON.parse(quote.hashtag);
        
        if (parsedData && typeof parsedData === 'object') {
          // Handle suggestion format (array of objects)
          if (Array.isArray(parsedData.suggestion)) {
            const hookTexts: string[] = [];
            const hashtags: string[] = [];
            
            parsedData.suggestion.forEach((item: any) => {
              if (item.hook_text) {
                // Split hook_text by comma and add to array
                item.hook_text.split(',').forEach((text: string) => {
                  const trimmedText = text.trim();
                  if (trimmedText) hookTexts.push(trimmedText);
                });
              }
              if (Array.isArray(item.hashtag)) {
                item.hashtag.forEach((tag: any) => {
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
              const hookTexts = parsedData.hook_text.flatMap((text: any) => 
                String(text).split(',').map((t: string) => t.trim()).filter(Boolean)
              );
              setGeneratedHookTexts(hookTexts);
            }
            
            if (Array.isArray(parsedData.hashtag)) {
              setGeneratedHashtags(parsedData.hashtag.map((tag: any) => String(tag).trim()).filter(Boolean));
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
            const firstLine = lines[0].split(',').map((t: string) => t.trim()).filter(Boolean);
            const remainingLines = lines.slice(1).join(' ').split(/[\s,]+/).map((t: string) => t.trim()).filter(Boolean);
            setGeneratedHookTexts(firstLine);
            setGeneratedHashtags(remainingLines);
          }
        }
      }
    }
    // Reset generating state jika quote berubah
    setIsGeneratingHook(false);
  }, [quote]);

  // Auto-update payload preview ketika media/hookInput berubah,
  // tapi jangan menimpa editan manual user di card Payload Preview.
  useEffect(() => {
    if (!hasEditedPayloadRef.current) {
      setPayloadPreview(buildPayload());
    }
  }, [media, hookInput, quote]);

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

  // Build initial payload preview
  const buildPayload = () => {
  return [
    `Character Name: ${quote.public_figure ?? ''}`,
    `Media: ${media}`,
    `Hook text: ${hookInput}`,
    `Quote text: ${quote.quote_text ?? ''}`,
    `Inter text: ${quote.interpretation ?? ''}`,
    `Real life event: ${quote.real_life_event ?? ''}`,
    `Fun Fact: ${quote.fun_fact ?? ''}`,
  ].join('\n');
  };
    // Initialize payload preview when hookCaption changes
  const handleCaptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setHookCaption(e.target.value);
  };

  const collapseVariants = { 
    hidden: { height: 0, opacity: 0, overflow: 'hidden' }, 
    visible: { height: 'auto', opacity: 1, overflow: 'visible', transition: { duration: 0.3 } } 
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSaveStatus = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    const formData = new FormData(e.currentTarget);
    const status = formData.get('status') as string;
    
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

  // Call ImageGenerator agent to generate hook script, lalu simpan otomatis ke database
  const handleGenerateHookScript = async () => {
  if (!media.trim() || !hookInput.trim()) {
    setIsHookExpanded(true);
    showNotification('Mohon isi Media dan Hook Text terlebih dahulu.', 'error');
    return;
  }

  setIsGeneratingHook(true);
  try {
    const response = await fetch('/api/librechat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payload: payloadPreview || buildPayload(),
        type: 'image_generator_model'
      }),
    });
    if (!response.ok) throw new Error('Gagal memanggil ImageGenerator agent');

    const data = await response.json();
    const rawScript = data.char_desc;
    if (!rawScript) throw new Error('Agent tidak mengembalikan hasil');

    const hookScript = parseHookScript(rawScript);
    if (hookScript.picture.length === 0 && hookScript.transition.length === 0) {
      throw new Error('Agent tidak mengembalikan picture/transition');
    }
    setHookPictures(hookScript.picture);
    setHookTransitions(hookScript.transition);

    const updated = await updateQuoteHookText(quote.quote_id, rawScript);
    onUpdateQuote(updated);
    showNotification('Hook berhasil di-generate dan disimpan!', 'success');
  } catch (error) {
    console.error('Error generating hook:', error);
    showNotification('Gagal generate hook. Cek console untuk detail.', 'error');
  } finally {
    setIsGeneratingHook(false);
  }
};

const handleCopyPicturePrompt = (text: string, index: number) => {
  navigator.clipboard.writeText(text);
  setCopiedHookPictureIndex(index);
  setTimeout(() => setCopiedHookPictureIndex(null), 2000);
};

const handleCopyTransitionPrompt = (text: string, index: number) => {
  navigator.clipboard.writeText(text);
  setCopiedHookTransitionIndex(index);
  setTimeout(() => setCopiedHookTransitionIndex(null), 2000);
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
        
        {/* KOLOM KIRI */}
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

          {/* Thumbnail gambar hasil generate (dari S3) */}
          {hookPictures.length > 0 && (
            <div className="bg-white/5 backdrop-blur-md border border-white/20 shadow-lg rounded-2xl p-6 flex flex-col shrink-0">
              <h2 className="text-base font-bold mb-4 flex items-center gap-2 border-b border-white/10 pb-3 text-blue-300">
                <ImageIcon size={16} /> Generated Images
              </h2>
              <div className="flex flex-wrap gap-3">
                {hookPictures.map((_, index) => (
                  <div key={index} className="relative">
                    {generatingImageIndex === index || uploadingImageIndex === index ? (
                      <div className="w-20 h-20 rounded-lg border border-white/20 bg-black/30 flex items-center justify-center">
                        <Loader2 size={16} className="animate-spin text-white/60" />
                      </div>
                    ) : !missingImages[index] ? (
                      <button
                        type="button"
                        onClick={() => setPreviewImageIndex(index)}
                        className="block hover:scale-105 transition-transform"
                        title={`Lihat gambar #${index + 1}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imageSrc(index)}
                          alt={`Generated ${index + 1}`}
                          onError={() => setMissingImages(prev => ({ ...prev, [index]: true }))}
                          className="w-20 h-20 object-cover rounded-lg border border-white/20"
                        />
                        <span className="absolute bottom-1 left-1 text-[9px] bg-black/60 px-1 rounded">{index + 1}</span>
                      </button>
                    ) : null}
                  </div>
                ))}
                {hookPictures.every((_, i) => missingImages[i]) && generatingImageIndex === null && uploadingImageIndex === null && (
                  <p className="text-xs text-white/40">Belum ada gambar. Upload manual atau generate gambar di Hook Result.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* KOLOM KANAN: Bengkel Proses */}
        <div className="w-[65%] flex flex-col h-full overflow-y-auto pr-2 space-y-4 text-sm">
          
          <div className="bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl rounded-2xl p-6 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2 text-purple-300">
                Story Board Configuration
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
                          rows={2} 
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
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-white/80 mb-1.5 text-xs">Media</label>
                        <input
                          type="text"
                          value={media}
                          onChange={(e) => setMedia(e.target.value)}
                          placeholder="Contoh: Instagram Reels"
                          className="w-full bg-black/20 border border-white/20 rounded-lg px-3 py-2 text-white outline-none focus:border-purple-400/50 transition-colors text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-white/80 mb-1.5 text-xs">Hook Text</label>
                        <input
                          type="text"
                          value={hookInput}
                          onChange={(e) => setHookInput(e.target.value)}
                          placeholder="Tulis hook text..."
                          className="w-full bg-black/20 border border-white/20 rounded-lg px-3 py-2 text-white outline-none focus:border-purple-400/50 transition-colors text-sm"
                        />
                      </div>
                    </div>
                    {/* Payload Preview - editable */}
                    <div className="p-4 bg-black/40 border border-purple-500/30 rounded-xl relative flex flex-col">
                      <label className="flex items-center gap-2 text-purple-300/80 mb-2 text-xs font-semibold uppercase tracking-wider">
                        <Code size={14} /> Payload Preview (Editable)
                      </label>
                      <textarea 
                        value={payloadPreview} 
                        onChange={(e) => {
                          hasEditedPayloadRef.current = true;
                          setPayloadPreview(e.target.value);
                        }} 
                        rows={12} 
                        className="w-full bg-transparent text-white/80 outline-none resize-y text-xs italic border border-white/10 rounded-lg p-2 focus:border-purple-400/50 transition-colors"
                      ></textarea>
                    </div>
                    
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {(isGeneratingHook || hookPictures.length > 0 || hookTransitions.length > 0) && (
              <div className="mt-4 p-4 bg-black/40 border border-purple-500/30 rounded-xl flex flex-col">
                <label className="flex items-center gap-2 text-purple-300/80 mb-2 text-xs font-semibold uppercase tracking-wider">
                  <Sparkles size={14} /> Hook Result
                </label>
                {isGeneratingHook ? (
                  <div className="flex items-center gap-2 text-white/60 text-xs py-4">
                    <Loader2 size={14} className="animate-spin" /> Menunggu respon agent...
                  </div>
                ) : (
                  <>
                    {hookPictures.length > 0 && (
                      <div className="mb-4">
                        <label className="text-purple-300/60 text-xs mb-2 block">Picture Prompts ({hookPictures.length})</label>
                        <div className="space-y-2">
                          {hookPictures.map((text, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <span className="text-purple-300 text-xs font-bold w-4 text-right shrink-0">{index + 1}.</span>
                              <div className="relative flex-1">
                                <input
                                  type="text"
                                  value={text}
                                  readOnly
                                  className="w-full bg-black/20 border border-white/20 rounded-lg px-3 py-2 pr-24 text-white/90 text-xs outline-none focus:border-purple-400/50 transition-colors cursor-default"
                                />
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                  {/* 1. Generate Image (Gemini) */}
                                  <button
                                    type="button"
                                    onClick={() => handleGenerateImage(text, index)}
                                    disabled={generatingImageIndex !== null || uploadingImageIndex !== null}
                                    className="text-purple-300/70 hover:text-purple-100 transition-colors disabled:opacity-40 p-1"
                                    title="Generate image dengan Gemini"
                                  >
                                    {generatingImageIndex === index ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
                                  </button>

                                  {/* 2. Upload Manual ke S3 (DIANTARA generate image dan copy clipboard) */}
                                  <button
                                    type="button"
                                    onClick={() => handleTriggerUpload(index)}
                                    disabled={generatingImageIndex !== null || uploadingImageIndex !== null}
                                    className="text-blue-300/70 hover:text-blue-100 transition-colors disabled:opacity-40 p-1"
                                    title="Upload image manual ke S3 (quote-<id>-<index>.png)"
                                  >
                                    {uploadingImageIndex === index ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                                  </button>

                                  {/* 3. Copy Clipboard */}
                                  <button
                                    type="button"
                                    onClick={() => handleCopyPicturePrompt(text, index)}
                                    className="text-white/40 hover:text-white transition-colors p-1"
                                    title="Copy picture prompt"
                                  >
                                    {copiedHookPictureIndex === index ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {hookTransitions.length > 0 && (
                      <div>
                        <label className="text-purple-300/60 text-xs mb-2 block">Transition Prompts ({hookTransitions.length})</label>
                        <div className="space-y-2">
                          {hookTransitions.map((text, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <span className="text-purple-300 text-xs font-bold w-4 text-right shrink-0">{index + 1}.</span>
                              <div className="relative flex-1">
                                <input
                                  type="text"
                                  value={text}
                                  readOnly
                                  className="w-full bg-black/20 border border-white/20 rounded-lg px-3 py-2 pr-20 text-white/90 text-xs outline-none focus:border-purple-400/50 transition-colors cursor-default"
                                />
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                  {/* 1. Play / Pause preview audio dari S3 (jika sudah diupload) */}
                                  {hasAudios[index] && (
                                    <button
                                      type="button"
                                      onClick={() => handleTogglePlayAudio(index)}
                                      className={`p-1 rounded transition-colors ${
                                        playingAudioIndex === index
                                          ? 'text-green-400 hover:text-green-300 animate-pulse'
                                          : 'text-purple-300 hover:text-purple-100'
                                      }`}
                                      title={playingAudioIndex === index ? 'Pause audio narator' : 'Putar audio narator dari S3'}
                                    >
                                      {playingAudioIndex === index ? <Pause size={14} /> : <Play size={14} />}
                                    </button>
                                  )}

                                  {/* 2. Upload audio manual ke S3 (SEBELUM copy to clipboard) */}
                                  <button
                                    type="button"
                                    onClick={() => handleTriggerAudioUpload(index)}
                                    disabled={uploadingAudioIndex !== null}
                                    className="text-blue-300/70 hover:text-blue-100 transition-colors disabled:opacity-40 p-1"
                                    title="Upload file suara narator ke S3 (menimpa audio sebelumnya)"
                                  >
                                    {uploadingAudioIndex === index ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                                  </button>

                                  {/* 3. Copy Clipboard */}
                                  <button
                                    type="button"
                                    onClick={() => handleCopyTransitionPrompt(text, index)}
                                    className="text-white/40 hover:text-white transition-colors p-1"
                                    title="Copy transition prompt"
                                  >
                                    {copiedHookTransitionIndex === index ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
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
        </div>
      </div>

      {/* Hidden file input for manual image upload */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Hidden file input for manual audio upload */}
      <input
        type="file"
        ref={audioFileInputRef}
        accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac,.webm"
        className="hidden"
        onChange={handleAudioFileChange}
      />

      {/* IMAGE POPUP */}
      <AnimatePresence>
        {previewImageIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPreviewImageIndex(null)}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <div className="relative max-w-3xl max-h-full" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setPreviewImageIndex(null)}
                className="absolute -top-3 -right-3 bg-white/20 hover:bg-white/40 rounded-full p-1.5"
              >
                <X size={16} />
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageSrc(previewImageIndex)} alt={`Generated ${previewImageIndex + 1}`} className="max-h-[85vh] rounded-xl border border-white/20 shadow-2xl" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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