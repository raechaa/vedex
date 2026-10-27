'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Image as ImageIcon,
  Shirt,
  Sliders,
  Download,
  Save,
  Check,
  AlertCircle,
  ExternalLink,
  Eye,
  RefreshCw,
  Upload,
  Maximize2,
  Layers,
  Crop,
  CheckCircle2,
  Trash2,
  Code,
  Loader2,
  ArrowRight,
  Info,
  Cloud,
  CloudUpload,
  Copy
} from 'lucide-react';
import { getBaseUrl, saveBaseUrl, callGenerateImage, saveImageToS3, checkModelHealth } from '@/lib/t2i-actions';
import { GlassButton } from '@/components/ui/glass-button';

interface Text2ImageViewProps {
  fadeVariants: any;
}

// Aspect ratio mapping dengan patokan 9:16 (720 : 1280)
const ASPECT_RATIOS = [
  { id: '9:16', label: '9:16', width: 720, height: 1280, icon: '▯' },
  { id: '1:1', label: '1:1', width: 720, height: 720, icon: '■' },
  { id: '3:4', label: '3:4', width: 720, height: 960, icon: '▯' },
  { id: '4:3', label: '4:3', width: 960, height: 720, icon: '▭' },
  { id: '16:9', label: '16:9', width: 1280, height: 720, icon: '▭' },
];

// Kategori Try On (tops, bottoms, one-pieces)
const TRYON_CATEGORIES = [
  { id: 'tops', label: 'Tops (Atasan)', desc: 'Kemeja, Kaos, Jaket, Blazer' },
  { id: 'bottoms', label: 'Bottoms (Bawahan)', desc: 'Celana, Rok, Jeans' },
  { id: 'one-pieces', label: 'One-Pieces (Terusan)', desc: 'Gaun, Dress, Jumpsuit' },
];

// Photo Types untuk Garment (model, flat-lay)
const GARMENT_PHOTO_TYPES = [
  { id: 'model', label: 'Model', desc: 'Foto pakaian dikenakan oleh model' },
  { id: 'flat-lay', label: 'Flat-Lay', desc: 'Foto pakaian dibentangkan datar / gantungan' },
];

// Opsi Negative Prompt / Style (Realistic, 3D Animation, 2D Cartoon)
const NEGATIVE_PROMPT_STYLES = [
  {
    id: '3d_animation',
    name: '3D Animation',
    negative_prompt: 'photograph, photorealistic human skin, 2d drawing, flat illustration, anime, low-poly model, plastic clothing, distorted face, malformed hands, extra fingers, text, watermark',
  },
  {
    id: 'realistic',
    name: 'Realistic',
    negative_prompt: '3d render, cartoon, anime, illustration, plastic skin, wax figure, doll-like face, overly smooth skin, unrealistic anatomy, extra fingers, deformed hands, blurry, watermark,',
  },
  {
    id: '2d_cartoon',
    name: '2D Cartoon',
    negative_prompt: 'photograph, photorealistic, 3d render, CGI, realistic skin pores, complex painterly texture, blurry outlines, malformed hands, extra fingers, text, watermark',
  },
];

// Helper untuk konversi dataURL ke File jika file asli tidak tersimpan di state
function dataURLtoFile(dataurl: string, filename: string): File {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

export default function Text2ImageView({ fadeVariants }: Text2ImageViewProps) {
  // Base URL state
  const [baseUrl, setBaseUrl] = useState('');
  const [isSavingUrl, setIsSavingUrl] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isUrlLoading, setIsUrlLoading] = useState(true);

  // Server Model Health Status (GET /health every 5 mins)
  const [isServerOnline, setIsServerOnline] = useState<boolean | null>(null);
  const [isCheckingServer, setIsCheckingServer] = useState<boolean>(false);

  // Active Tab inside T-2-I (1 = Generate Image, 2 = Try On)
  const [activeTab, setActiveTab] = useState<'generate' | 'tryon' | 'future3' | 'future4'>('generate');

  // FUNCTION 1: Generate Image States
  const [prompt, setPrompt] = useState('A cinematic shot of a futuristic cyberpunk city with neon lights');
  const [selectedRatio, setSelectedRatio] = useState(ASPECT_RATIOS[0]); // default 9:16 (720x1280)
  const [selectedStyle, setSelectedStyle] = useState(NEGATIVE_PROMPT_STYLES[0]); // default 3D Animation
  const [steps, setSteps] = useState(30); // default 30
  const [seed, setSeed] = useState(42); // default 42
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string>(''); // Fokus 1 picture saja per generate
  const [generatedFilename, setGeneratedFilename] = useState<string | null>(null);
  const [generatedSeed, setGeneratedSeed] = useState<number | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateDebug, setGenerateDebug] = useState<any>(null);

  // S3 Save States for Generate Image
  const [isSavingS3, setIsSavingS3] = useState(false);
  const [s3Notification, setS3Notification] = useState<{
    type: 'success' | 'error';
    message: string;
    filename?: string;
    url?: string;
  } | null>(null);

  // FUNCTION 2: Try On States
  const [humanFile, setHumanFile] = useState<File | null>(null);
  const [garmentFile, setGarmentFile] = useState<File | null>(null);
  const [humanImg, setHumanImg] = useState<string>('');
  const [garmentImg, setGarmentImg] = useState<string>('');
  const [tryonCategory, setTryonCategory] = useState<'tops' | 'bottoms' | 'one-pieces'>('tops');
  const [garmentPhotoType, setGarmentPhotoType] = useState<'model' | 'flat-lay'>('model');
  const [tryonSeed, setTryonSeed] = useState<number>(42);
  const [numTimesteps, setNumTimesteps] = useState<number>(20);
  const [isTryingOn, setIsTryingOn] = useState(false);
  const [tryonSeconds, setTryonSeconds] = useState(0);
  const [tryonResultImage, setTryonResultImage] = useState<string>('');
  const [tryonResultFilename, setTryonResultFilename] = useState<string | null>(null);
  const [tryonResultSeed, setTryonResultSeed] = useState<number | null>(null);
  const [tryonError, setTryonError] = useState<string | null>(null);
  const [tryonDebug, setTryonDebug] = useState<any>(null);

  // S3 Save States for Try On
  const [isSavingTryonS3, setIsSavingTryonS3] = useState(false);
  const [tryonS3Notification, setTryonS3Notification] = useState<{
    type: 'success' | 'error';
    message: string;
    filename?: string;
    url?: string;
  } | null>(null);

  // Modal Preview Image
  const [previewModalImg, setPreviewModalImg] = useState<string | null>(null);
  const [showDebugJson, setShowDebugJson] = useState(false);

  // Fungsi pengecekan status server model (GET /health)
  const checkHealth = async (targetUrl?: string) => {
    const url = (targetUrl ?? baseUrl).trim();
    if (!url) {
      setIsServerOnline(false);
      return;
    }
    setIsCheckingServer(true);
    try {
      const ok = await checkModelHealth(url);
      setIsServerOnline(ok);
    } catch {
      setIsServerOnline(false);
    } finally {
      setIsCheckingServer(false);
    }
  };

  // Load Base URL dari database saat reload / buka halaman & jalankan checkHealth awal
  useEffect(() => {
    let isMounted = true;
    setIsUrlLoading(true);
    getBaseUrl()
      .then((url) => {
        if (isMounted) {
          setBaseUrl(url || '');
          if (url) {
            checkHealth(url);
          } else {
            setIsServerOnline(false);
          }
        }
      })
      .catch((err) => {
        console.error('Error fetching base_url:', err);
      })
      .finally(() => {
        if (isMounted) setIsUrlLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Periode pengecekan server model setiap 5 menit
  useEffect(() => {
    if (!baseUrl.trim()) return;

    const intervalId = setInterval(() => {
      checkHealth(baseUrl);
    }, 5 * 60 * 1000); // 5 menit

    return () => clearInterval(intervalId);
  }, [baseUrl]);

  // Stopwatch timer untuk memantau durasi Try On (proses 6-10 menit)
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isTryingOn) {
      setTryonSeconds(0);
      timer = setInterval(() => {
        setTryonSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setTryonSeconds(0);
    }
    return () => clearInterval(timer);
  }, [isTryingOn]);

  // Simpan Base URL ke database
  const handleSaveBaseUrl = async () => {
    if (!baseUrl.trim()) {
      setSaveStatus({ type: 'error', text: 'Url Model tidak boleh kosong.' });
      return;
    }
    setIsSavingUrl(true);
    setSaveStatus(null);
    try {
      const res = await saveBaseUrl(baseUrl);
      setSaveStatus({ type: 'success', text: res.message || 'Url Model berhasil disimpan!' });
      checkHealth(baseUrl);
      setTimeout(() => setSaveStatus(null), 3500);
    } catch (err: any) {
      setSaveStatus({ type: 'error', text: err.message || 'Gagal menyimpan Url Model.' });
    } finally {
      setIsSavingUrl(false);
    }
  };

  // Handler Upload Foto Model (person_image)
  const handleHumanUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setHumanFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setHumanImg(reader.result as string);
        setTryonError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handler Upload Foto Garment / Pakaian (garment_image)
  const handleGarmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setGarmentFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setGarmentImg(reader.result as string);
        setTryonError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handler Generate Image (Fungsi 1)
  const handleGenerateImage = async () => {
    if (!baseUrl.trim()) {
      setGenerateError('Harap tentukan dan simpan "Url Model" terlebih dahulu.');
      return;
    }
    if (!prompt.trim()) {
      setGenerateError('Prompt deskripsi gambar tidak boleh kosong.');
      return;
    }

    setIsGenerating(true);
    setGenerateError(null);
    setGenerateDebug(null);
    setS3Notification(null);

    const payload = {
      prompt: prompt.trim(),
      negative_prompt: selectedStyle.negative_prompt,
      width: selectedRatio.width,
      height: selectedRatio.height,
      steps: Number(steps) || 30,
      seed: typeof seed === 'number' ? seed : 42,
    };

    setGenerateDebug({ endpoint: `${baseUrl.replace(/\/+$/, '')}/generate`, payload });

    try {
      const res = await callGenerateImage(baseUrl, payload);
      const img = res.image || (res.images && res.images[0]) || '';
      if (img) {
        setGeneratedImage(img);
        setGeneratedFilename(res.filename || null);
        setGeneratedSeed(res.seed ?? payload.seed);
        setGenerateDebug((prev: any) => ({ ...prev, response: res.raw }));
      } else {
        setGenerateError(res.message || 'Model tidak mengembalikan gambar.');
        setGenerateDebug((prev: any) => ({ ...prev, response: res.raw }));
      }
    } catch (err: any) {
      setGenerateError(err.message || 'Terjadi kesalahan saat memproses generate image.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Handler Save Image ke S3
  const handleSaveToS3 = async () => {
    if (!generatedImage) return;
    setIsSavingS3(true);
    setS3Notification(null);
    try {
      const res = await saveImageToS3(generatedImage);
      setS3Notification({
        type: 'success',
        message: 'Gambar berhasil disimpan ke S3!',
        filename: res.filename,
        url: res.url,
      });
      // Auto-dismiss setelah 7 detik
      setTimeout(() => {
        setS3Notification((curr) => (curr?.filename === res.filename ? null : curr));
      }, 7000);
    } catch (err: any) {
      setS3Notification({
        type: 'error',
        message: err.message || 'Gagal menyimpan gambar ke S3.',
      });
    } finally {
      setIsSavingS3(false);
    }
  };

  // Handler Try On (Fungsi 2)
  const handleTryOn = async () => {
    if (!baseUrl.trim()) {
      setTryonError('Harap tentukan dan simpan "Url Model" terlebih dahulu.');
      return;
    }
    if (!humanImg) {
      setTryonError('Silakan unggah foto model (person_image) terlebih dahulu.');
      return;
    }
    if (!garmentImg) {
      setTryonError('Silakan unggah foto pakaian (garment_image) terlebih dahulu.');
      return;
    }

    setIsTryingOn(true);
    setTryonError(null);
    setTryonDebug(null);
    setTryonS3Notification(null);

    const personFile = humanFile || (humanImg ? dataURLtoFile(humanImg, 'person_image.png') : null);
    const garmentImgFile = garmentFile || (garmentImg ? dataURLtoFile(garmentImg, 'garment_image.png') : null);

    if (!personFile || !garmentImgFile) {
      setTryonError('Gagal memproses file gambar untuk dikirim.');
      setIsTryingOn(false);
      return;
    }

    const formData = new FormData();
    formData.append('base_url', baseUrl.trim());
    formData.append('person_image', personFile);
    formData.append('garment_image', garmentImgFile);
    formData.append('category', tryonCategory);
    formData.append('garment_photo_type', garmentPhotoType);
    formData.append('seed', String(typeof tryonSeed === 'number' ? tryonSeed : 42));
    formData.append('num_timesteps', String(Number(numTimesteps) || 20));

    setTryonDebug({
      endpoint: `${baseUrl.replace(/\/+$/, '')}/tryon (via /api/t2i/tryon streaming)`,
      payloadPreview: {
        person_image: personFile.name || 'person_image.png',
        garment_image: garmentImgFile.name || 'garment_image.png',
        category: tryonCategory,
        garment_photo_type: garmentPhotoType,
        seed: typeof tryonSeed === 'number' ? tryonSeed : 42,
        num_timesteps: Number(numTimesteps) || 20,
      },
    });

    try {
      // Panggil streaming API route dengan byte keep-alive (bebas timeout Cloudflare 100 detik)
      const response = await fetch('/api/t2i/tryon', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`API error (${response.status}): ${errText || response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Respons tidak memiliki body stream.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let receivedComplete = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) {
            // Byte keep-alive heartbeat dari server (Cloudflare tetap buka koneksi)
            continue;
          }
          if (trimmed.startsWith('data:')) {
            const jsonStr = trimmed.slice(5).trim();
            if (jsonStr) {
              try {
                const event = JSON.parse(jsonStr);
                if (event.type === 'progress') {
                  // Keep-alive data diterima
                } else if (event.type === 'completed') {
                  receivedComplete = true;
                  if (event.image) {
                    setTryonResultImage(event.image);
                    setTryonResultFilename(event.filename || null);
                    setTryonResultSeed(event.seed ?? tryonSeed);
                    setTryonDebug((prev: any) => ({ ...prev, response: event.raw || event }));
                  } else {
                    setTryonError(event.message || 'Model tidak mengembalikan gambar try-on.');
                  }
                } else if (event.type === 'error') {
                  throw new Error(event.message || 'Terjadi kesalahan pada model.');
                }
              } catch (parseErr: any) {
                if (parseErr.message && !parseErr.message.includes('JSON')) {
                  throw parseErr;
                }
              }
            }
          }
        }
      }

      if (!receivedComplete && !tryonError) {
        // Jika stream selesai tanpa event completed dan belum ada error
        setTryonDebug((prev: any) => ({ ...prev, streamClosed: true }));
      }
    } catch (err: any) {
      setTryonError(err.message || 'Terjadi kesalahan saat memproses try on.');
    } finally {
      setIsTryingOn(false);
    }
  };

  // Handler Save Try On Image ke S3
  const handleSaveTryonToS3 = async () => {
    if (!tryonResultImage) return;
    setIsSavingTryonS3(true);
    setTryonS3Notification(null);
    try {
      const res = await saveImageToS3(tryonResultImage);
      setTryonS3Notification({
        type: 'success',
        message: 'Gambar Try On berhasil disimpan ke S3!',
        filename: res.filename,
        url: res.url,
      });
      setTimeout(() => {
        setTryonS3Notification((curr) => (curr?.filename === res.filename ? null : curr));
      }, 7000);
    } catch (err: any) {
      setTryonS3Notification({
        type: 'error',
        message: err.message || 'Gagal menyimpan gambar Try On ke S3.',
      });
    } finally {
      setIsSavingTryonS3(false);
    }
  };

  // Download Image Helper
  const downloadImage = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <motion.div
      variants={fadeVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="w-full max-w-7xl mx-auto flex flex-col gap-6 text-white pb-12"
    >
      {/* ============================================================== */}
      {/* TOP BAR: URL MODEL CONFIGURATION (Saved to database text2image) */}
      {/* ============================================================== */}
      <div className="w-full bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-5 md:p-6 transition-all">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border border-indigo-400/40 rounded-xl shadow-inner">
              <Sparkles size={22} className="text-indigo-300" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold tracking-tight flex items-center gap-2 flex-wrap">
                Text-to-Image AI Studio
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 font-medium">
                  T-2-I Engine
                </span>
                {/* Oval Badge Status Server Model */}
                {isCheckingServer && isServerOnline === null ? (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/10 text-white/60 border border-white/20 font-medium flex items-center gap-1.5">
                    <Loader2 size={10} className="animate-spin text-white/50" />
                    Server: Checking...
                  </span>
                ) : isServerOnline ? (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-medium flex items-center gap-1.5 shadow-sm shadow-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Server: ON
                  </span>
                ) : (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-400/30 font-medium flex items-center gap-1.5 shadow-sm shadow-rose-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                    Server: OFF
                  </span>
                )}
              </h2>
              <p className="text-xs text-white/60">
                Konfigurasi Base URL model server dan jalankan tugas komputasi AI
              </p>
            </div>
          </div>

          {/* Input Box: Url Model & Tombol Save */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1 max-w-2xl md:ml-6">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/40 text-xs font-semibold">
                Url Model:
              </div>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://your-model-api.example.com atau http://localhost:8000"
                disabled={isUrlLoading}
                className="w-full bg-black/30 border border-white/20 focus:border-indigo-400 rounded-xl pl-24 pr-4 py-2.5 text-xs md:text-sm text-white placeholder-white/30 outline-none transition-all shadow-inner backdrop-blur-md"
              />
              {isUrlLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 size={16} className="animate-spin text-indigo-400" />
                </div>
              )}
            </div>

            <GlassButton
              onClick={handleSaveBaseUrl}
              disabled={isSavingUrl || isUrlLoading}
              variant="primary"
              size="default"
              glow
              className="shrink-0"
            >
              {isSavingUrl ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Menyimpan...
                </>
              ) : (
                <>
                  <Save size={16} /> Save
                </>
              )}
            </GlassButton>
          </div>
        </div>

        {/* Feedback Alert for Base URL */}
        <AnimatePresence>
          {saveStatus && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className={`mt-3 px-4 py-2 rounded-lg text-xs flex items-center gap-2 border ${saveStatus.type === 'success'
                ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/30'
                : 'bg-rose-500/20 text-rose-200 border-rose-500/30'
                }`}
            >
              {saveStatus.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
              {saveStatus.text}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ============================================================== */}
      {/* FUNCTION TABS: 1. Generate Image | 2. Try On | Coming Soon     */}
      {/* ============================================================== */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <GlassButton
          onClick={() => setActiveTab('generate')}
          variant={activeTab === 'generate' ? 'active' : 'default'}
          size="default"
          className="whitespace-nowrap"
        >
          <ImageIcon size={16} />
          <span>1. Generate Image</span>
        </GlassButton>

        <GlassButton
          onClick={() => setActiveTab('tryon')}
          variant={activeTab === 'tryon' ? 'active' : 'default'}
          size="default"
          className="whitespace-nowrap"
        >
          <Shirt size={16} />
          <span>2. Try On</span>
        </GlassButton>

        <GlassButton
          onClick={() => setActiveTab('future3')}
          variant={activeTab === 'future3' ? 'default' : 'subtle'}
          size="default"
          className="whitespace-nowrap opacity-60"
        >
          <span>3. Fungsi 3</span>
          <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-white/50">Soon</span>
        </GlassButton>

        <GlassButton
          onClick={() => setActiveTab('future4')}
          variant={activeTab === 'future4' ? 'default' : 'subtle'}
          size="default"
          className="whitespace-nowrap opacity-60"
        >
          <span>4. Fungsi 4</span>
          <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-white/50">Soon</span>
        </GlassButton>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: GENERATE IMAGE                                          */}
      {/* ============================================================== */}
      {activeTab === 'generate' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Form Input (Left Column) */}
          <div className="lg:col-span-5 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-6 flex flex-col gap-5">
            <div>
              <h3 className="text-base font-semibold flex items-center gap-2">
                <ImageIcon size={18} className="text-purple-300" />
                Parameter Generate Image
              </h3>
              <p className="text-xs text-white/60">
                Endpoint:<br />
                <code className="text-purple-200 bg-white/10 px-1.5 py-0.5 rounded">{baseUrl ? `${baseUrl.replace(/\/+$/, '')}/generate` : '/generate'}</code>
              </p>
            </div>

            {/* Input 1: Prompt Deskripsi Image (Panjang) */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-medium text-white/90">Text Deskripsi Image (Prompt):</label>
                <span className="text-white/40 text-[11px]">{prompt.length} karakter</span>
              </div>
              <textarea
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Tuliskan deskripsi detail gambar yang diinginkan (misal: A cinematic shot of a futuristic cyberpunk city with neon lights, 8k resolution)..."
                className="w-full bg-black/30 border border-white/20 focus:border-purple-400 rounded-xl p-3 text-xs md:text-sm text-white placeholder-white/30 outline-none transition-all resize-y shadow-inner"
              />
              <div className="flex items-center gap-2">
                <GlassButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPrompt('A cinematic shot of a futuristic cyberpunk city with neon lights, 8k resolution')}
                  className="text-[11px] text-purple-300 hover:text-purple-200 py-0.5 px-2.5 h-auto"
                >
                  Gunakan sample prompt
                </GlassButton>
                <span className="text-white/20">•</span>
                <GlassButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPrompt('')}
                  className="text-[11px] text-white/50 hover:text-white/80 py-0.5 px-2.5 h-auto"
                >
                  Bersihkan
                </GlassButton>
              </div>
            </div>

            {/* Input 2: Kualitas & Style (Negative Prompt) - Radio Buttons */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-medium text-white/90 flex items-center gap-1.5">
                  <Sliders size={14} className="text-purple-300" />
                  Kualitas & Style (Negative Prompt):
                </label>
                <span className="text-[11px] text-purple-300 font-medium">
                  {selectedStyle.name}
                </span>
              </div>

              {/* Radio Button Options: Realistic, 3D Animation (default), 2D Cartoon */}
              <div className="grid grid-cols-3 gap-2">
                {NEGATIVE_PROMPT_STYLES.map((style) => {
                  const isSelected = selectedStyle.id === style.id;
                  return (
                    <GlassButton
                      key={style.id}
                      type="button"
                      onClick={() => setSelectedStyle(style)}
                      variant={isSelected ? 'active' : 'subtle'}
                      className="p-2.5 h-auto flex-col items-center justify-center text-center cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span
                          className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all ${isSelected
                            ? 'border-white bg-white/20 shadow-[0_0_8px_rgba(255,255,255,0.4)]'
                            : 'border-white/30 bg-black/40'
                            }`}
                        >
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </span>
                        <span className="text-xs font-bold">{style.name}</span>
                      </div>
                      {style.desc && <span className="text-[10px] text-white/50">{style.desc}</span>}
                    </GlassButton>
                  );
                })}
              </div>
            </div>

            {/* Input 3: Pilihan Ratio Ukuran Image (1:1, 3:4, 4:3, 9:16, 16:9) */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-medium text-white/90">Ukuran Image (Ratio):</label>
                <span className="text-purple-300 font-mono text-[11px]">
                  width: {selectedRatio.width}px, height: {selectedRatio.height}px
                </span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {ASPECT_RATIOS.map((ratio) => {
                  const isSelected = selectedRatio.id === ratio.id;
                  return (
                    <GlassButton
                      key={ratio.id}
                      type="button"
                      onClick={() => setSelectedRatio(ratio)}
                      variant={isSelected ? 'active' : 'subtle'}
                      className="p-2.5 h-auto flex-col items-center justify-center"
                    >
                      <span className="text-lg leading-none mb-1 opacity-80">{ratio.icon}</span>
                      <span className="text-xs font-bold">{ratio.label}</span>
                      {ratio.name && <span className="text-[10px] text-white/50">{ratio.name}</span>}
                    </GlassButton>
                  );
                })}
              </div>
            </div>

            {/* Parameter Tambahan: Steps & Seed */}
            <div className="flex flex-col gap-3 bg-black/20 p-3.5 rounded-xl border border-white/10 text-xs">
              <div className="flex items-center justify-between text-white/90 font-medium">
                <span className="flex items-center gap-1.5">
                  <Sliders size={14} className="text-purple-300" />
                  Pengaturan Generasi (Steps & Seed):
                </span>
                <GlassButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSteps(30);
                    setSeed(Math.floor(Math.random() * 1000000));
                  }}
                  className="text-[11px] text-purple-300 hover:text-purple-200 py-0.5 px-2 h-auto"
                >
                  <RefreshCw size={11} className="mr-1" /> Acak Seed
                </GlassButton>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Steps */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-white/60">Steps (Sampling):</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={steps}
                    onChange={(e) => setSteps(parseInt(e.target.value, 10) || 30)}
                    className="w-full bg-black/40 border border-white/15 focus:border-purple-400 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none font-mono"
                  />
                </div>

                {/* Seed */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-white/60">Seed:</label>
                  <input
                    type="number"
                    value={seed}
                    onChange={(e) => setSeed(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-black/40 border border-white/15 focus:border-purple-400 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Error Message */}
            {generateError && (
              <div className="p-3 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-200 text-xs flex items-start gap-2">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <div className="flex-1 break-words">{generateError}</div>
              </div>
            )}

            {/* Tombol Generate Image */}
            <GlassButton
              onClick={handleGenerateImage}
              disabled={isGenerating}
              variant="primary"
              size="lg"
              glow
              className="w-full shadow-2xl"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Sedang Memproses Generate Image...
                </>
              ) : (
                <>
                  <Sparkles size={18} /> Generate Image
                </>
              )}
            </GlassButton>
          </div>

          {/* Result Card (Right Column) - Fokus 1 Picture Saja */}
          <div className="lg:col-span-7 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-6 flex flex-col gap-4 min-h-[520px]">
            {/* Header Card Hasil Gambar dengan Tombol Save to S3 di Pojok Atas */}
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Layers size={18} className="text-indigo-300" />
                <h3 className="text-base font-semibold">Hasil Gambar</h3>
                {generatedImage && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    Siap
                  </span>
                )}
              </div>

              {/* Action Buttons di Pojok Atas Card */}
              {generatedImage && (
                <div className="flex items-center gap-2">
                  {/* Tombol Save to S3 */}
                  <GlassButton
                    onClick={handleSaveToS3}
                    disabled={isSavingS3}
                    variant="success"
                    size="sm"
                    title="Simpan gambar ke S3 bucket (format t2i_ddmmyyy_hhmmdd.png)"
                  >
                    {isSavingS3 ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Menyimpan ke S3...</span>
                      </>
                    ) : (
                      <>
                        <CloudUpload size={14} />
                        <span>Save to S3</span>
                      </>
                    )}
                  </GlassButton>

                  <GlassButton
                    onClick={() => setPreviewModalImg(generatedImage)}
                    title="Perbesar Gambar"
                    variant="default"
                    size="icon"
                  >
                    <Maximize2 size={15} />
                  </GlassButton>

                  <GlassButton
                    onClick={() => downloadImage(generatedImage, generatedFilename || `t2i-image-${Date.now()}.png`)}
                    title="Download Gambar"
                    variant="active"
                    size="icon"
                  >
                    <Download size={15} />
                  </GlassButton>

                  <GlassButton
                    onClick={() => {
                      setGeneratedImage('');
                      setGeneratedFilename(null);
                      setGeneratedSeed(null);
                      setS3Notification(null);
                    }}
                    title="Bersihkan Hasil"
                    variant="ghost"
                    size="icon"
                    className="text-white/50 hover:text-rose-300 hover:bg-rose-500/20"
                  >
                    <Trash2 size={15} />
                  </GlassButton>
                </div>
              )}
            </div>

            {/* Notifikasi S3 Save */}
            <AnimatePresence>
              {s3Notification && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className={`p-3.5 rounded-xl text-xs flex items-center justify-between gap-3 border shadow-xl ${s3Notification.type === 'success'
                    ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40 backdrop-blur-md'
                    : 'bg-rose-500/20 text-rose-200 border-rose-500/40 backdrop-blur-md'
                    }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {s3Notification.type === 'success' ? (
                      <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle size={18} className="text-rose-400 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="font-semibold">{s3Notification.message}</div>
                      {s3Notification.filename && (
                        <div className="text-[11px] text-emerald-300/80 font-mono mt-0.5 truncate">
                          Nama File: <span className="font-bold underline">{s3Notification.filename}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {s3Notification.url && (
                    <a
                      href={s3Notification.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 bg-emerald-600/40 hover:bg-emerald-600/70 border border-emerald-400/40 rounded-lg text-[11px] font-medium flex items-center gap-1 shrink-0 text-white transition-all shadow-sm"
                    >
                      <ExternalLink size={12} /> Buka di S3
                    </a>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Empty state / Loading / Single Image Display */}
            {isGenerating ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-4 border-purple-500/20 border-t-purple-400 animate-spin" />
                  <Sparkles className="absolute inset-0 m-auto text-purple-300" size={24} />
                </div>
                <div>
                  <h4 className="font-semibold text-white">Memproses Image AI...</h4>
                  <p className="text-xs text-white/60 max-w-sm mt-1">
                    Mengirim prompt ke {baseUrl}/generate dengan dimensi {selectedRatio.width}x{selectedRatio.height}, steps {steps}, seed {seed}. Harap tunggu sebentar.
                  </p>
                </div>
              </div>
            ) : !generatedImage ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-white/15 rounded-xl">
                <ImageIcon size={48} className="text-white/20 mb-3" />
                <h4 className="font-medium text-white/80 text-sm">Belum Ada Gambar yang Dibuat</h4>
                <p className="text-xs text-white/50 max-w-sm mt-1">
                  Masukkan deskripsi prompt, pilih rasio ukuran (patokan 9:16), lalu klik tombol "Generate Image" untuk memanggil API backend.
                </p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col gap-3">
                {/* Single Image Container */}
                <div className="group relative bg-black/40 border border-white/15 rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center min-h-[380px] max-h-[560px]">
                  <img
                    src={generatedImage}
                    alt="Generated single result"
                    className="w-full h-full max-h-[560px] object-contain transition-transform duration-300"
                  />

                  {/* Tombol Pojok Atas Gambar (Perbesar) */}
                  <div className="absolute top-3 right-3 flex items-center gap-2">
                    <GlassButton
                      onClick={() => setPreviewModalImg(generatedImage)}
                      variant="default"
                      size="icon"
                      title="Perbesar"
                    >
                      <Maximize2 size={14} />
                    </GlassButton>
                  </div>
                </div>

                {/* Info Bar Detail Gambar */}
                <div className="p-3 bg-black/30 border border-white/10 rounded-xl flex items-center justify-between flex-wrap gap-2 text-xs">
                  <div className="flex items-center gap-3 text-white/70">
                    <span className="font-mono bg-white/10 px-2 py-0.5 rounded text-[11px] text-purple-300">
                      {selectedRatio.label} ({selectedRatio.width}x{selectedRatio.height})
                    </span>
                    <span className="font-mono bg-purple-500/20 text-purple-200 border border-purple-400/30 px-2 py-0.5 rounded text-[11px]">
                      {selectedStyle.name}
                    </span>
                    <span className="font-mono text-[11px]">
                      Seed: <strong className="text-white">{generatedSeed ?? seed}</strong>
                    </span>
                    {generatedFilename && (
                      <span className="font-mono text-[11px] text-white/50 truncate max-w-[200px]" title={generatedFilename}>
                        File: {generatedFilename}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <GlassButton
                      onClick={() => downloadImage(generatedImage, generatedFilename || `t2i-image-${Date.now()}.png`)}
                      variant="ghost"
                      size="sm"
                      className="text-xs text-purple-300 hover:text-purple-200 py-1 px-2.5 h-auto flex items-center gap-1"
                    >
                      <Download size={12} /> Unduh File
                    </GlassButton>
                  </div>
                </div>
              </div>
            )}

            {/* Debug & Payload Viewer Toggle */}
            {generateDebug && (
              <div className="mt-auto pt-4 border-t border-white/10">
                <GlassButton
                  onClick={() => setShowDebugJson(!showDebugJson)}
                  variant="ghost"
                  size="sm"
                  className="text-xs text-white/60 hover:text-white flex items-center gap-1.5 py-1 px-2 h-auto"
                >
                  <Code size={14} /> {showDebugJson ? 'Sembunyikan Payload Debug' : 'Lihat Payload & Detail Respons'}
                </GlassButton>
                {showDebugJson && (
                  <div className="mt-2 p-3 bg-black/50 border border-white/10 rounded-xl font-mono text-[11px] text-white/80 overflow-x-auto max-h-48">
                    <pre>{JSON.stringify(generateDebug, null, 2)}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: TRY ON                                                  */}
      {/* ============================================================== */}
      {activeTab === 'tryon' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Form Input Upload (Left Column) */}
          <div className="lg:col-span-6 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-6 flex flex-col gap-5">
            <div>
              <h3 className="text-base font-semibold flex items-center gap-2">
                <Shirt size={18} className="text-indigo-300" />
                Parameter Try On
              </h3>
              <p className="text-xs text-white/60">
                Endpoint: <br />
                <code className="text-indigo-200 bg-white/10 px-1.5 py-0.5 rounded">{baseUrl ? `${baseUrl.replace(/\/+$/, '')}/tryon` : '/tryon'}</code>
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Upload Foto Model (person_image) */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-white/90">
                  Foto Model (<code className="text-purple-300">person_image</code>):
                </label>
                <div className="relative border-2 border-dashed border-white/20 hover:border-purple-400/50 rounded-xl aspect-[3/4] flex flex-col items-center justify-center p-3 text-center bg-black/20 overflow-hidden transition-all group">
                  {humanImg ? (
                    <>
                      <img src={humanImg} alt="Model preview" className="w-full h-full object-cover rounded-lg" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-2 transition-opacity p-2">
                        <GlassButton
                          onClick={() => {
                            setHumanImg('');
                            setHumanFile(null);
                          }}
                          variant="danger"
                          size="sm"
                        >
                          <Trash2 size={13} /> Ganti Foto
                        </GlassButton>
                      </div>
                    </>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center justify-center w-full h-full p-2">
                      <Upload size={28} className="text-purple-300 mb-2 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-semibold text-white">Upload Foto Model</span>
                      <span className="text-[10px] text-white/50 mt-1">PNG, JPG atau WEBP</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleHumanUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Upload Foto Pakaian/Garment (garment_image) */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-white/90">
                  Foto Pakaian (<code className="text-purple-300">garment_image</code>):
                </label>
                <div className="relative border-2 border-dashed border-white/20 hover:border-purple-400/50 rounded-xl aspect-[3/4] flex flex-col items-center justify-center p-3 text-center bg-black/20 overflow-hidden transition-all group">
                  {garmentImg ? (
                    <>
                      <img src={garmentImg} alt="Garment preview" className="w-full h-full object-cover rounded-lg" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-2 transition-opacity p-2">
                        <GlassButton
                          onClick={() => {
                            setGarmentImg('');
                            setGarmentFile(null);
                          }}
                          variant="danger"
                          size="sm"
                        >
                          <Trash2 size={13} /> Ganti Pakaian
                        </GlassButton>
                      </div>
                    </>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center justify-center w-full h-full p-2">
                      <Shirt size={28} className="text-indigo-300 mb-2 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-semibold text-white">Upload Foto Pakaian</span>
                      <span className="text-[10px] text-white/50 mt-1">PNG, JPG atau WEBP</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleGarmentUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>

            {/* Kategori Pakaian (category: tops, bottoms, one-pieces) */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-white/90">
                Kategori Pakaian :
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {TRYON_CATEGORIES.map((cat) => {
                  const isSelected = tryonCategory === cat.id;
                  return (
                    <GlassButton
                      key={cat.id}
                      type="button"
                      onClick={() => setTryonCategory(cat.id as any)}
                      variant={isSelected ? 'active' : 'subtle'}
                      className="p-3 h-auto text-left flex-col items-start block"
                    >
                      <div className="text-xs font-bold mb-0.5">{cat.label}</div>
                      <div className="text-[10px] text-white/50">{cat.desc}</div>
                    </GlassButton>
                  );
                })}
              </div>
            </div>

            {/* Photo Types (garment_photo_type: model, flat-lay) */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-white/90">
                Photo Types Pakaian:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {GARMENT_PHOTO_TYPES.map((pt) => {
                  const isSelected = garmentPhotoType === pt.id;
                  return (
                    <GlassButton
                      key={pt.id}
                      type="button"
                      onClick={() => setGarmentPhotoType(pt.id as any)}
                      variant={isSelected ? 'active' : 'subtle'}
                      className="p-3 h-auto text-left flex items-start gap-2.5"
                    >
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${isSelected ? 'border-white bg-white/20 shadow-[0_0_8px_rgba(255,255,255,0.4)]' : 'border-white/30 bg-black/40'
                        }`}>
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div>
                        <div className="text-xs font-bold">{pt.label}</div>
                        <div className="text-[10px] text-white/50">{pt.desc}</div>
                      </div>
                    </GlassButton>
                  );
                })}
              </div>
            </div>

            {/* Parameter Timesteps & Seed */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-white/90 flex items-center justify-between">
                  <span>Timesteps :</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={numTimesteps}
                  onChange={(e) => setNumTimesteps(Number(e.target.value) || 20)}
                  className="px-3 py-2 bg-black/30 border border-white/20 rounded-xl text-white text-xs font-mono focus:border-purple-400 focus:outline-none transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-white/90 flex items-center justify-between">
                  <span>Seed :</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    value={tryonSeed}
                    onChange={(e) => setTryonSeed(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-black/30 border border-white/20 rounded-xl text-white text-xs font-mono focus:border-purple-400 focus:outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Error Message */}
            {tryonError && (
              <div className="p-3 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-200 text-xs flex items-start gap-2">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <div className="flex-1 break-words">{tryonError}</div>
              </div>
            )}

            {/* Tombol Generate Try On */}
            <GlassButton
              onClick={handleTryOn}
              disabled={isTryingOn || !humanImg || !garmentImg}
              variant="primary"
              size="lg"
              glow
              className="w-full shadow-2xl"
            >
              {isTryingOn ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>
                    Sedang Memproses Try On ({Math.floor(tryonSeconds / 60).toString().padStart(2, '0')}:{(tryonSeconds % 60).toString().padStart(2, '0')})...
                  </span>
                </>
              ) : (
                <>
                  <Sparkles size={18} /> Generate Try On
                </>
              )}
            </GlassButton>
          </div>

          {/* Result Column (Right Column) */}
          <div className="lg:col-span-6 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-6 flex flex-col gap-4 min-h-[500px]">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <Eye size={18} className="text-purple-300" />
                Hasil Try On
              </h3>
              {tryonResultImage && (
                <div className="flex items-center gap-2">
                  {/* Button Save to S3 di card luar */}
                  <GlassButton
                    onClick={handleSaveTryonToS3}
                    disabled={isSavingTryonS3}
                    variant="success"
                    size="sm"
                    title="Simpan gambar Try On ke S3 bucket"
                  >
                    {isSavingTryonS3 ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      <>
                        <CloudUpload size={14} />
                        <span>Save to S3</span>
                      </>
                    )}
                  </GlassButton>

                  <GlassButton
                    onClick={() => setPreviewModalImg(tryonResultImage)}
                    variant="default"
                    size="sm"
                  >
                    <Maximize2 size={14} /> Perbesar
                  </GlassButton>
                  <GlassButton
                    onClick={() => downloadImage(tryonResultImage, tryonResultFilename || 'tryon-result.png')}
                    variant="active"
                    size="sm"
                  >
                    <Download size={14} /> Download
                  </GlassButton>
                </div>
              )}
            </div>

            {/* S3 Notification Alert Banner */}
            <AnimatePresence>
              {tryonS3Notification && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className={`p-3 rounded-xl text-xs flex items-center justify-between border ${tryonS3Notification.type === 'success'
                    ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-200 border-rose-500/30'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    {tryonS3Notification.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                    <span>{tryonS3Notification.message}</span>
                    {tryonS3Notification.filename && (
                      <code className="text-[10px] bg-black/40 px-1.5 py-0.5 rounded font-mono text-emerald-300">
                        {tryonS3Notification.filename}
                      </code>
                    )}
                  </div>
                  {tryonS3Notification.url && (
                    <a
                      href={tryonS3Notification.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[11px] underline hover:text-white"
                    >
                      <span>Buka</span> <ExternalLink size={12} />
                    </a>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Visualizer */}
            {isTryingOn ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-4 border-indigo-500/20 border-t-indigo-400 animate-spin" />
                  <Shirt className="absolute inset-0 m-auto text-indigo-300" size={24} />
                </div>
                <div>
                  <h4 className="font-semibold text-white">Memproses Virtual Try-On...</h4>
                  <div className="inline-flex items-center gap-2 mt-2 px-3 py-1 bg-black/40 border border-purple-400/30 rounded-full font-mono text-xs text-purple-300">
                    <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                    <span>Waktu: {Math.floor(tryonSeconds / 60).toString().padStart(2, '0')}:{(tryonSeconds % 60).toString().padStart(2, '0')}</span>
                    <span className="text-white/40 text-[10px]">(Estimasi ~6-10 mnt)</span>
                  </div>
                  <p className="text-xs text-white/60 max-w-sm mt-3">
                    Sedang memasangkan pakaian ke foto model via <code className="text-indigo-200">{baseUrl ? `${baseUrl.replace(/\/+$/, '')}/tryon` : '/tryon'}</code> (kategori: "{tryonCategory}", photo type: "{garmentPhotoType}"). Koneksi tetap aktif menunggu respon model.
                  </p>
                </div>
              </div>
            ) : tryonResultImage ? (
              <div className="flex-1 flex flex-col gap-4">
                {/* Result Image (tidak ada button save s3 di dalam gambar) */}
                <div className="relative w-full aspect-[3/4] max-h-[480px] bg-black/40 rounded-xl overflow-hidden border border-white/20 flex items-center justify-center">
                  <img
                    src={tryonResultImage}
                    alt="Tryon Result"
                    className="w-full h-full object-contain"
                  />
                </div>

                {/* Comparison Thumbnail strip */}
                <div className="flex items-center justify-center gap-3 p-3 bg-black/20 rounded-xl border border-white/10">
                  <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-14 rounded-lg overflow-hidden border border-white/20 bg-black/40">
                      {humanImg && <img src={humanImg} className="w-full h-full object-cover" />}
                    </div>
                    <span className="text-[10px] text-white/60 mt-1">Model</span>
                  </div>

                  <span className="text-white/40 font-bold">+</span>

                  <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-14 rounded-lg overflow-hidden border border-white/20 bg-black/40">
                      {garmentImg && <img src={garmentImg} className="w-full h-full object-cover" />}
                    </div>
                    <span className="text-[10px] text-white/60 mt-1">Garment</span>
                  </div>

                  <ArrowRight size={16} className="text-purple-400" />

                  <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-14 rounded-lg overflow-hidden border-2 border-purple-400 bg-black/40">
                      <img src={tryonResultImage} className="w-full h-full object-cover" />
                    </div>
                    <span className="text-[10px] text-purple-300 font-semibold mt-1">Hasil</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-white/15 rounded-xl">
                <Shirt size={48} className="text-white/20 mb-3" />
                <h4 className="font-medium text-white/80 text-sm">Belum Ada Hasil Try On</h4>
                <p className="text-xs text-white/50 max-w-sm mt-1">
                  Upload foto model dan foto pakaian di sebelah kiri, lalu tekan tombol "Generate Try On" untuk melihat hasilnya.
                </p>
              </div>
            )}

            {/* Debug & Payload Viewer Toggle */}
            {tryonDebug && (
              <div className="mt-auto pt-4 border-t border-white/10">
                <GlassButton
                  onClick={() => setShowDebugJson(!showDebugJson)}
                  variant="ghost"
                  size="sm"
                  className="text-xs text-white/60 hover:text-white flex items-center gap-1.5 py-1 px-2 h-auto"
                >
                  <Code size={14} /> {showDebugJson ? 'Sembunyikan Payload Debug' : 'Lihat Payload & Detail Respons'}
                </GlassButton>
                {showDebugJson && (
                  <div className="mt-2 p-3 bg-black/50 border border-white/10 rounded-xl font-mono text-[11px] text-white/80 overflow-x-auto max-h-48">
                    <pre>{JSON.stringify(tryonDebug, null, 2)}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* PLACEHOLDER TAB 3 & 4 (Menyusul)                               */}
      {/* ============================================================== */}
      {(activeTab === 'future3' || activeTab === 'future4') && (
        <div className="w-full bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-12 text-center flex flex-col items-center justify-center gap-4">
          <div className="p-4 bg-purple-500/20 border border-purple-400/30 rounded-full">
            <Sparkles size={36} className="text-purple-300" />
          </div>
          <div>
            <h3 className="text-lg font-bold">
              {activeTab === 'future3' ? 'Fungsi 3: Segera Hadir' : 'Fungsi 4: Segera Hadir'}
            </h3>
            <p className="text-sm text-white/60 max-w-md mt-1">
              Fungsi ini sedang dipersiapkan dan akan diaktifkan setelah pengujian sample Generate Image & Try On selesai.
            </p>
          </div>
          <GlassButton
            onClick={() => setActiveTab('generate')}
            variant="primary"
            size="default"
          >
            Kembali ke Generate Image
          </GlassButton>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL PREVIEW IMAGE FULLSCREEN                                 */}
      {/* ============================================================== */}
      <AnimatePresence>
        {previewModalImg && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            onClick={() => setPreviewModalImg(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="relative max-w-4xl max-h-[90vh] bg-black/80 border border-white/20 rounded-2xl p-3 shadow-2xl flex flex-col items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={previewModalImg}
                alt="Enlarged preview"
                className="max-h-[80vh] w-auto object-contain rounded-lg"
              />
              <div className="flex items-center justify-between w-full mt-3 px-2">
                <span className="text-xs text-white/60 font-mono">Image Preview</span>
                <div className="flex gap-2">
                  <GlassButton
                    onClick={() => downloadImage(previewModalImg, 'preview-image.png')}
                    variant="primary"
                    size="sm"
                  >
                    <Download size={14} /> Download
                  </GlassButton>
                  <GlassButton
                    onClick={() => setPreviewModalImg(null)}
                    variant="default"
                    size="sm"
                  >
                    Tutup
                  </GlassButton>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
