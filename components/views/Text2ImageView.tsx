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
  Copy,
  ScanFace,
  Power,
  PowerOff
} from 'lucide-react';
import {
  getBaseUrl,
  saveBaseUrl,
  callGenerateImage,
  saveImageToS3,
  checkModelHealth,
  startKaggleNotebook,
  stopKaggleNotebook,
  getKaggleNotebookStatus
} from '@/lib/t2i-actions';
import { GlassButton } from '@/components/ui/glass-button';

interface Text2ImageViewProps {
  fadeVariants: any;
}

// Helper untuk membersihkan dan memformat pesan error API (mencegah HTML / string panjang meluap)
function cleanUiError(message: string): string {
  if (!message) return 'Terjadi kesalahan.';
  let str = String(message).trim();

  // Bersihkan [object Object] jika ada
  str = str.replace(/\[object Object\]/g, 'Validation Error');

  // Jika pesan mengandung HTML raw (seperti respon halaman ngrok / Cloudflare / Nginx 404/502)
  if (str.includes('<!DOCTYPE') || str.includes('<html') || str.includes('<body') || str.includes('</')) {
    const statusMatch = str.match(/(\d{3})/);
    if (statusMatch) {
      return `API ${statusMatch[1]} ERROR`;
    }
    return 'API ERROR';
  }

  // Jika format error API dengan detail teks setelahnya
  const apiErrMatch = str.match(/^API\s+(?:error|ERROR)\s*\(?(\d{3})[^)]*\)?\s*:\s*(.*)$/i);
  if (apiErrMatch) {
    const code = apiErrMatch[1];
    const rest = apiErrMatch[2].trim();
    if (!rest || rest.includes('<!DOCTYPE') || rest.includes('<html')) {
      return `API ${code} ERROR`;
    }
    return `API ${code} ERROR: ${rest.length > 250 ? rest.substring(0, 247) + '...' : rest}`;
  }

  // Batasi panjang jika ada pesan lain yang terlalu panjang
  if (str.length > 250) {
    return str.substring(0, 247) + '...';
  }
  return str;
}

// Aspect ratio mapping dengan patokan 9:16 (720 : 1024)
const ASPECT_RATIOS = [
  { id: '9:16', label: '9:16', width: 720, height: 1024, icon: '▯' },
  { id: '1:1', label: '1:1', width: 1024, height: 1024, icon: '■' },
  { id: '3:4', label: '3:4', width: 768, height: 1024, icon: '▯' },
  { id: '4:3', label: '4:3', width: 1024, height: 768, icon: '▭' },
  { id: '16:9', label: '16:9', width: 1024, height: 576, icon: '▭' },
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

export type ModelEngineType = 'RealVis XL' | 'Stabble Dif 3.5';

interface ModelEngineOption {
  id: ModelEngineType;
  label: string;
  endpoint: string;
  defaultNegative: string;
}

const MODEL_ENGINES: ModelEngineOption[] = [
  {
    id: 'RealVis XL',
    label: 'RealVis XL',
    endpoint: '/generate',
    defaultNegative: 'face asymmetry, eyes asymmetry, deformed eyes, open mouth.',
  },
  {
    id: 'Stabble Dif 3.5',
    label: 'Stabble Dif 3.5',
    endpoint: '/generate2',
    defaultNegative: 'blurry, low quality, distorted anatomy, text, watermark',
  },
];

/**
 * Menghitung perkiraan CLIP tokens untuk Text Prompt (SDXL / RealVis XL).
 * Model SDXL / CLIP memiliki context window 77 token (1 BOS + 75 token teks + 1 EOS).
 * Batas rekomendasi adalah 75 token teks untuk memberi spare pada header & footer BOS/EOS.
 */
function countClipTokens(text: string): number {
  if (!text || !text.trim()) return 0;
  const clean = text.trim();
  const words = clean.split(/\s+/);
  let tokenCount = 0;

  for (const word of words) {
    const parts = word.match(/([a-zA-Z]+|[0-9]+|[^\s\w]+)/g);
    if (!parts) continue;

    for (const part of parts) {
      if (/^[a-zA-Z]+$/.test(part)) {
        const len = part.length;
        if (len <= 4) {
          tokenCount += 1;
        } else if (len <= 7) {
          tokenCount += 1;
        } else if (len <= 11) {
          tokenCount += 2;
        } else {
          tokenCount += Math.ceil(len / 4);
        }
      } else if (/^[0-9]+$/.test(part)) {
        tokenCount += Math.max(1, Math.ceil(part.length / 2));
      } else {
        tokenCount += part.length;
      }
    }
  }

  return tokenCount;
}

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

  // Kaggle Notebook Management
  const [isStartingNotebook, setIsStartingNotebook] = useState(false);
  const [isStoppingNotebook, setIsStoppingNotebook] = useState(false);
  const [kaggleModal, setKaggleModal] = useState<'start' | 'stop' | null>(null);
  const [kaggleNotification, setKaggleNotification] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Active Tab inside T-2-I (1 = Generate Image, 2 = Try On, 3 = Face Swap)
  const [activeTab, setActiveTab] = useState<'generate' | 'tryon' | 'faceswap' | 'future4'>('generate');

  // FUNCTION 1: Generate Image States
  const [modelEngine, setModelEngine] = useState<ModelEngineType>('RealVis XL');
  const [prompt, setPrompt] = useState('A cinematic shot of a futuristic cyberpunk city with neon lights');
  const [negativePrompt, setNegativePrompt] = useState<string>(
    'face asymmetry, eyes asymmetry, deformed eyes, open mouth.'
  );
  const [selectedRatio, setSelectedRatio] = useState(ASPECT_RATIOS[0]); // default 9:16 (720x1280)
  const [generateSeconds, setGenerateSeconds] = useState(0);
  const [lastDurationSeconds, setLastDurationSeconds] = useState<number | null>(null);
  const [steps, setSteps] = useState(30); // default 30
  const [cfg, setCfg] = useState(6); // default 6
  const [seed, setSeed] = useState(42); // default 42
  const [isGenerating, setIsGenerating] = useState(false);

  // Perhitungan token CLIP prompt (aktif untuk RealVis XL)
  const promptTokens = countClipTokens(prompt);

  // Handler pergantian Model Engine (menyesuaikan default negative prompt)
  const handleModelEngineChange = (newEngine: ModelEngineType) => {
    if (newEngine === modelEngine) return;
    const oldEngineObj = MODEL_ENGINES.find((m) => m.id === modelEngine);
    const newEngineObj = MODEL_ENGINES.find((m) => m.id === newEngine);

    if (!oldEngineObj || !newEngineObj) {
      setModelEngine(newEngine);
      return;
    }

    const oldDefault = oldEngineObj.defaultNegative.trim();
    const currentNeg = negativePrompt.trim();

    if (!currentNeg || currentNeg === oldDefault) {
      setNegativePrompt(newEngineObj.defaultNegative);
    } else if (currentNeg.startsWith(oldDefault)) {
      const extra = currentNeg.slice(oldDefault.length).trim().replace(/^,\s*/, '');
      if (extra) {
        setNegativePrompt(`${newEngineObj.defaultNegative}, ${extra}`);
      } else {
        setNegativePrompt(newEngineObj.defaultNegative);
      }
    } else {
      setNegativePrompt(`${newEngineObj.defaultNegative}, ${currentNeg}`);
    }

    setModelEngine(newEngine);
  };
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

  // FUNCTION 3: Face Swap States
  const [sourceImageFile, setSourceImageFile] = useState<File | null>(null);
  const [targetImageFile, setTargetImageFile] = useState<File | null>(null);
  const [sourceImagePreview, setSourceImagePreview] = useState<string>('');
  const [targetImagePreview, setTargetImagePreview] = useState<string>('');
  const [faceRestore, setFaceRestore] = useState<boolean>(true);
  const [restoreVisibility, setRestoreVisibility] = useState<number>(0.6);
  const [isFaceSwapping, setIsFaceSwapping] = useState<boolean>(false);
  const [faceSwapSeconds, setFaceSwapSeconds] = useState<number>(0);
  const [faceSwapLastDurationSeconds, setFaceSwapLastDurationSeconds] = useState<number | null>(null);
  const [faceSwapResultImage, setFaceSwapResultImage] = useState<string>('');
  const [faceSwapResultFilename, setFaceSwapResultFilename] = useState<string | null>(null);
  const [faceSwapError, setFaceSwapError] = useState<string | null>(null);
  const [faceSwapDebug, setFaceSwapDebug] = useState<any>(null);

  // S3 Save States for Face Swap
  const [isSavingFaceSwapS3, setIsSavingFaceSwapS3] = useState<boolean>(false);
  const [faceSwapS3Notification, setFaceSwapS3Notification] = useState<{
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

  // Stopwatch timer untuk memantau durasi Face Swap
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isFaceSwapping) {
      setFaceSwapSeconds(0);
      timer = setInterval(() => {
        setFaceSwapSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setFaceSwapSeconds(0);
    }
    return () => clearInterval(timer);
  }, [isFaceSwapping]);

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

  // Handler Menyalakan Kaggle Notebook (notebook-t2i-fix)
  const handleStartNotebook = async () => {
    setIsStartingNotebook(true);
    setKaggleModal(null);
    setKaggleNotification(null);
    try {
      const res = await startKaggleNotebook();
      setKaggleNotification({ type: 'success', text: res.message });

      // Polling status Kaggle setiap 8 detik untuk memantau status 'queued' -> 'running'
      let pollCount = 0;
      const pollInterval = setInterval(async () => {
        pollCount += 1;
        try {
          const statusRes = await getKaggleNotebookStatus();
          if (statusRes.status === 'running') {
            setKaggleNotification({
              type: 'success',
              text: 'Kaggle Notebook sedang berjalan (running)! Memeriksa endpoint model server...',
            });
            if (baseUrl.trim()) {
              checkHealth(baseUrl);
            }
          }
        } catch {}
        if (pollCount >= 10) {
          clearInterval(pollInterval);
        }
      }, 8000);

      // Cek kesehatan server model setelah 25 detik
      setTimeout(() => {
        if (baseUrl.trim()) {
          checkHealth(baseUrl);
        }
      }, 25000);
    } catch (err: any) {
      setKaggleNotification({
        type: 'error',
        text: err?.message || 'Gagal menyalakan notebook di Kaggle.',
      });
    } finally {
      setIsStartingNotebook(false);
    }
  };

  // Handler Mematikan Kaggle Notebook (notebook-t2i-fix via /shutdown)
  const handleStopNotebook = async () => {
    setIsStoppingNotebook(true);
    setKaggleModal(null);
    setKaggleNotification(null);
    try {
      const res = await stopKaggleNotebook(baseUrl);
      setIsServerOnline(false);
      setKaggleNotification({ type: 'success', text: res.message });
    } catch (err: any) {
      setKaggleNotification({
        type: 'error',
        text: err?.message || 'Gagal mematikan notebook di Kaggle.',
      });
    } finally {
      setIsStoppingNotebook(false);
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

  // Handler Upload Foto Referensi (source_image)
  const handleSourceImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSourceImageFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setSourceImagePreview(reader.result as string);
        setFaceSwapError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handler Upload Face Referensi (target_image)
  const handleTargetImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setTargetImageFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setTargetImagePreview(reader.result as string);
        setFaceSwapError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handler Generate Image (Fungsi 1) dengan Streaming SSE & Keep-Alive
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
    setGenerateSeconds(0);
    setLastDurationSeconds(null);
    setGenerateError(null);
    setGenerateDebug(null);
    setS3Notification(null);

    const activeEngineObj = MODEL_ENGINES.find((m) => m.id === modelEngine) || MODEL_ENGINES[0];
    const defaultNeg = activeEngineObj.defaultNegative.trim();

    // Nilai negative prompt: default value model engine ditambah inputan tambahan user jika ada
    let finalNegativePrompt = negativePrompt.trim();
    if (!finalNegativePrompt) {
      finalNegativePrompt = defaultNeg;
    } else if (!finalNegativePrompt.includes(defaultNeg)) {
      finalNegativePrompt = `${defaultNeg}, ${finalNegativePrompt}`;
    }

    // Payload murni model AI (tanpa base_url, engine, endpoint)
    const payload = {
      prompt: prompt.trim(),
      negative_prompt: finalNegativePrompt,
      width: selectedRatio.width,
      height: selectedRatio.height,
      steps: Number(steps) || 30,
      seed: typeof seed === 'number' ? seed : 42,
      cfg: Number(cfg) || 6,
    };

    setGenerateDebug({
      endpoint: `${baseUrl.replace(/\/+$/, '')}${activeEngineObj.endpoint}`,
      payload,
    });

    let currentSeconds = 0;
    const timer = setInterval(() => {
      currentSeconds += 1;
      setGenerateSeconds(currentSeconds);
    }, 1000);

    try {
      const response = await fetch(`/api/t2i/generate?endpoint=${encodeURIComponent(activeEngineObj.endpoint)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-base-url': baseUrl.trim(),
          'x-model-engine': modelEngine,
          'x-endpoint': activeEngineObj.endpoint,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        let errMsg = `API ${response.status} ERROR`;
        if (errText) {
          try {
            const j = JSON.parse(errText);
            const detail = j.error || j.message || j.detail;
            if (detail) errMsg += `: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`;
          } catch {
            errMsg += `: ${errText.slice(0, 150)}`;
          }
        }
        throw new Error(errMsg);
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
            continue;
          }
          if (trimmed.startsWith('data:')) {
            const jsonStr = trimmed.slice(5).trim();
            if (jsonStr) {
              try {
                const event = JSON.parse(jsonStr);
                if (event.type === 'connected' && event.payload) {
                  setFaceSwapDebug((prev: any) => ({
                    ...prev,
                    endpoint: `${baseUrl.replace(/\/+$/, '')}/faceswap`,
                    payloadPreview: event.payload,
                  }));
                } else if (event.type === 'progress') {
                  // Keep-alive data diterima
                } else if (event.type === 'completed') {
                  receivedComplete = true;
                  if (event.image) {
                    setGeneratedImage(event.image);
                    setGeneratedFilename(event.filename || null);
                    setGeneratedSeed(event.seed ?? payload.seed);
                    setLastDurationSeconds(currentSeconds);
                    setGenerateDebug((prev: any) => ({ ...prev, response: event.raw || event }));
                  } else {
                    setGenerateError(event.message || 'Model tidak mengembalikan gambar.');
                    setGeneratedImage('');
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

      if (!receivedComplete && !generateError) {
        setGenerateDebug((prev: any) => ({ ...prev, streamClosed: true }));
      }
    } catch (err: any) {
      setGenerateError(cleanUiError(err.message || 'Terjadi kesalahan saat memproses generate image.'));
    } finally {
      clearInterval(timer);
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
        let errMsg = `API ${response.status} ERROR`;
        if (errText) {
          try {
            const j = JSON.parse(errText);
            const detail = j.error || j.message || j.detail;
            if (detail) errMsg += `: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`;
          } catch {
            errMsg += `: ${errText.slice(0, 150)}`;
          }
        }
        throw new Error(errMsg);
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
                if (event.type === 'connected' && event.payload) {
                  setFaceSwapDebug((prev: any) => ({
                    ...prev,
                    endpoint: `${baseUrl.replace(/\/+$/, '')}/faceswap`,
                    payloadPreview: event.payload,
                  }));
                } else if (event.type === 'progress') {
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
      setTryonError(cleanUiError(err.message || 'Terjadi kesalahan saat memproses try on.'));
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

  // Handler Generate Face Swap (Fungsi 3) dengan Streaming SSE & Keep-Alive
  const handleFaceSwap = async () => {
    if (!baseUrl.trim()) {
      setFaceSwapError('Harap tentukan dan simpan "Url Model" terlebih dahulu.');
      return;
    }
    if (!sourceImagePreview) {
      setFaceSwapError('Silakan unggah Foto Referensi (source_image) terlebih dahulu.');
      return;
    }
    if (!targetImagePreview) {
      setFaceSwapError('Silakan unggah Face Referensi (target_image) terlebih dahulu.');
      return;
    }

    setIsFaceSwapping(true);
    setFaceSwapSeconds(0);
    setFaceSwapLastDurationSeconds(null);
    setFaceSwapError(null);
    setFaceSwapDebug(null);
    setFaceSwapS3Notification(null);

    const sourceFile = sourceImageFile || (sourceImagePreview ? dataURLtoFile(sourceImagePreview, 'source_image.png') : null);
    const targetFile = targetImageFile || (targetImagePreview ? dataURLtoFile(targetImagePreview, 'target_image.png') : null);

    if (!sourceFile || !targetFile) {
      setFaceSwapError('Gagal memproses file gambar untuk dikirim.');
      setIsFaceSwapping(false);
      return;
    }

    const formData = new FormData();
    formData.append('base_url', baseUrl.trim());
    formData.append('source_image', sourceFile);
    formData.append('target_image', targetFile);
    formData.append('face_restore', String(faceRestore));
    formData.append('restore_visibility', String(restoreVisibility));

    setFaceSwapDebug({
      endpoint: `${baseUrl.replace(/\/+$/, '')}/faceswap (via /api/t2i/faceswap streaming)`,
      payloadPreview: {
        source_image: sourceFile.name || 'source_image.png',
        target_image: targetFile.name || 'target_image.png',
        face_restore: faceRestore,
        restore_visibility: restoreVisibility,
      },
    });

    let currentSeconds = 0;
    const timer = setInterval(() => {
      currentSeconds += 1;
      setFaceSwapSeconds(currentSeconds);
    }, 1000);

    try {
      const response = await fetch('/api/t2i/faceswap', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        let errMsg = `API ${response.status} ERROR`;
        if (errText) {
          try {
            const j = JSON.parse(errText);
            const detail = j.error || j.message || j.detail;
            if (detail) errMsg += `: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`;
          } catch {
            errMsg += `: ${errText.slice(0, 150)}`;
          }
        }
        throw new Error(errMsg);
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
            continue;
          }
          if (trimmed.startsWith('data:')) {
            const jsonStr = trimmed.slice(5).trim();
            if (jsonStr) {
              try {
                const event = JSON.parse(jsonStr);
                if (event.type === 'connected' && event.payload) {
                  setFaceSwapDebug((prev: any) => ({
                    ...prev,
                    endpoint: `${baseUrl.replace(/\/+$/, '')}/faceswap`,
                    payloadPreview: event.payload,
                  }));
                } else if (event.type === 'progress') {
                  // Keep-alive data diterima
                } else if (event.type === 'completed') {
                  receivedComplete = true;
                  if (event.image) {
                    setFaceSwapResultImage(event.image);
                    setFaceSwapResultFilename(event.filename || null);
                    setFaceSwapLastDurationSeconds(currentSeconds);
                    const safeResponse = event.raw || {
                      status: 'success',
                      filename: event.filename || null,
                      duration: `${currentSeconds}s`,
                      face_restore: faceRestore,
                      restore_visibility: restoreVisibility,
                      message: event.message,
                    };
                    setFaceSwapDebug((prev: any) => ({ ...prev, response: safeResponse }));
                  } else {
                    setFaceSwapError(event.message || 'Model tidak mengembalikan gambar.');
                    setFaceSwapResultImage('');
                  }
                } else if (event.type === 'error') {
                  throw new Error(event.message || 'Terjadi kesalahan pada model Face Swap.');
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

      if (!receivedComplete && !faceSwapError) {
        setFaceSwapDebug((prev: any) => ({ ...prev, streamClosed: true }));
      }
    } catch (err: any) {
      setFaceSwapError(cleanUiError(err.message || 'Terjadi kesalahan saat memproses face swap.'));
      setFaceSwapResultImage('');
    } finally {
      clearInterval(timer);
      setIsFaceSwapping(false);
    }
  };

  // Handler Save Face Swap Result ke S3
  const handleSaveFaceSwapToS3 = async () => {
    if (!faceSwapResultImage) return;
    setIsSavingFaceSwapS3(true);
    setFaceSwapS3Notification(null);
    try {
      const res = await saveImageToS3(faceSwapResultImage);
      setFaceSwapS3Notification({
        type: 'success',
        message: 'Gambar Face Swap berhasil disimpan ke S3!',
        filename: res.filename,
        url: res.url,
      });
      setTimeout(() => {
        setFaceSwapS3Notification((curr) => (curr?.filename === res.filename ? null : curr));
      }, 7000);
    } catch (err: any) {
      setFaceSwapS3Notification({
        type: 'error',
        message: err.message || 'Gagal menyimpan gambar Face Swap ke S3.',
      });
    } finally {
      setIsSavingFaceSwapS3(false);
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
                {/* Tombol Status Server Model (Klik untuk Cek Ulang) */}
                <button
                  type="button"
                  onClick={() => checkHealth(baseUrl)}
                  disabled={isCheckingServer || !baseUrl.trim()}
                  title="Klik untuk cek ulang status server model"
                  className={`text-xs px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1.5 transition-all cursor-pointer disabled:cursor-not-allowed ${
                    isCheckingServer
                      ? 'bg-white/10 text-white/70 border border-white/20'
                      : isServerOnline
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 hover:bg-emerald-500/30 shadow-sm shadow-emerald-500/20 active:scale-95'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-400/40 hover:bg-rose-500/30 shadow-sm shadow-rose-500/20 active:scale-95'
                  }`}
                >
                  {isCheckingServer ? (
                    <>
                      <Loader2 size={11} className="animate-spin text-white/60" />
                      <span>Server: Checking...</span>
                    </>
                  ) : isServerOnline ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Server: ON</span>
                      <RefreshCw size={10} className="text-emerald-300/70 ml-0.5 opacity-60 hover:opacity-100" />
                    </>
                  ) : (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                      <span>Server: OFF</span>
                      <RefreshCw size={10} className="text-rose-300/70 ml-0.5 opacity-60 hover:opacity-100" />
                    </>
                  )}
                </button>

                {/* Tombol Nyalakan / Matikan Kaggle Notebook */}
                {isServerOnline ? (
                  <button
                    type="button"
                    onClick={() => setKaggleModal('stop')}
                    disabled={isStoppingNotebook}
                    title="Matikan notebook-t2i-fix di Kaggle untuk menghemat kuota GPU"
                    className="text-xs px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1.5 transition-all cursor-pointer bg-rose-500/20 text-rose-300 border border-rose-400/40 hover:bg-rose-500/30 active:scale-95 shadow-sm"
                  >
                    {isStoppingNotebook ? (
                      <>
                        <Loader2 size={11} className="animate-spin text-rose-300" />
                        <span>Mematikan...</span>
                      </>
                    ) : (
                      <>
                        <PowerOff size={11} className="text-rose-300" />
                        <span>Matikan Notebook</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setKaggleModal('start')}
                    disabled={isStartingNotebook}
                    title="Nyalakan notebook notebook-t2i-fix di Kaggle"
                    className="text-xs px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1.5 transition-all cursor-pointer bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 hover:bg-emerald-500/30 active:scale-95 shadow-sm"
                  >
                    {isStartingNotebook ? (
                      <>
                        <Loader2 size={11} className="animate-spin text-emerald-300" />
                        <span>Menyalakan...</span>
                      </>
                    ) : (
                      <>
                        <Power size={11} className="text-emerald-300" />
                        <span>Nyalakan Notebook</span>
                      </>
                    )}
                  </button>
                )}
              </h2>
              <p className="text-xs text-white/60">
                Konfigurasi Base URL model server dan jalankan tugas komputasi AI
              </p>

              {/* Notifikasi feedback Kaggle Notebook Action */}
              <AnimatePresence>
                {kaggleNotification && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className={`mt-2 px-3 py-1.5 rounded-lg text-xs flex items-center justify-between border ${
                      kaggleNotification.type === 'success'
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200'
                        : 'bg-rose-500/20 border-rose-500/40 text-rose-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {kaggleNotification.type === 'success' ? (
                        <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                      ) : (
                        <AlertCircle size={13} className="text-rose-400 shrink-0" />
                      )}
                      <span>{kaggleNotification.text}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setKaggleNotification(null)}
                      className="text-white/60 hover:text-white text-xs ml-3 font-bold cursor-pointer"
                    >
                      ✕
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
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
          onClick={() => setActiveTab('faceswap')}
          variant={activeTab === 'faceswap' ? 'active' : 'default'}
          size="default"
          className="whitespace-nowrap"
        >
          <ScanFace size={16} />
          <span>3. Face Swap</span>
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
              <p className="text-xs text-white/60 mt-1">
                <code className="text-purple-200 bg-white/10 px-1.5 py-0.5 rounded">
                  {baseUrl ? `${baseUrl.replace(/\/+$/, '')}${modelEngine === 'Stabble Dif 3.5' ? '/generate2' : '/generate'}` : (modelEngine === 'Stabble Dif 3.5' ? '/generate2' : '/generate')}
                </code>
              </p>
            </div>

            {/* Input 1: Prompt Deskripsi Image (Panjang) */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-medium text-white/90">Text Deskripsi Image (Prompt):</label>
                {modelEngine === 'RealVis XL' ? (
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`font-mono text-[11px] font-semibold px-2 py-0.5 rounded-md border transition-all ${
                        promptTokens > 75
                          ? 'bg-rose-500/25 text-rose-300 border-rose-500/50 shadow-[0_0_8px_rgba(244,63,94,0.3)]'
                          : promptTokens > 60
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                      }`}
                      title="Token CLIP (Batas rekomendasi 75 token, dari 77 context window SDXL CLIP minus 2 token BOS & EOS)"
                    >
                      {promptTokens} / 75 token
                    </span>
                    <span className="text-white/40 text-[11px]">({prompt.length} karakter)</span>
                  </div>
                ) : (
                  <span className="text-white/40 text-[11px]">{prompt.length} karakter</span>
                )}
              </div>
              <textarea
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Tuliskan deskripsi detail gambar yang diinginkan (misal: A cinematic shot of a futuristic cyberpunk city with neon lights, 8k resolution)..."
                className="w-full bg-black/30 border border-white/20 focus:border-purple-400 rounded-xl p-3 text-xs text-white placeholder-white/30 outline-none transition-all resize-y shadow-inner"
              />
              {modelEngine === 'RealVis XL' && promptTokens > 75 && (
                <div className="flex items-center gap-1.5 text-[11px] text-rose-300 bg-rose-500/15 border border-rose-500/30 px-2.5 py-1.5 rounded-lg">
                  <AlertCircle size={13} className="shrink-0 text-rose-400" />
                  <span>
                    Prompt mencapai <strong>{promptTokens} token</strong> (melebihi rekomendasi 75 token). Token di atas 75 berisiko tidak diproses oleh CLIP encoder.
                  </span>
                </div>
              )}
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

            {/* Opsi Model Engine: 2 Radio Button (RealVis XL & Stabble Dif 3.5) */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-medium text-white/90 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-purple-300" />
                  Model Engine:
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {MODEL_ENGINES.map((engine) => {
                  const isSelected = modelEngine === engine.id;
                  return (
                    <GlassButton
                      key={engine.id}
                      type="button"
                      onClick={() => handleModelEngineChange(engine.id)}
                      variant={isSelected ? 'active' : 'subtle'}
                      className="p-2.5 h-auto flex-col items-center justify-center text-center cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span
                          className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all ${
                            isSelected
                              ? 'border-white bg-white/20 shadow-[0_0_8px_rgba(255,255,255,0.4)]'
                              : 'border-white/30 bg-black/40'
                          }`}
                        >
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </span>
                        <span className="text-xs font-bold">{engine.label}</span>
                      </div>
                    </GlassButton>
                  );
                })}
              </div>
            </div>

            {/* Input 2: Kualitas & Style (Negative Prompt) - Input Box */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-medium text-white/90 flex items-center gap-1.5">
                  <Sliders size={14} className="text-purple-300" />
                  Kualitas & Style (Negative Prompt):
                </label>
                <GlassButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const defaultForEngine = MODEL_ENGINES.find((m) => m.id === modelEngine)?.defaultNegative || '';
                    setNegativePrompt(defaultForEngine);
                  }}
                  className="text-[11px] text-purple-300 hover:text-purple-200 py-0.5 px-2 h-auto"
                  title="Kembalikan ke negative prompt default untuk model ini"
                >
                  <RefreshCw size={11} className="mr-1" /> Reset Default
                </GlassButton>
              </div>

              <textarea
                rows={2}
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                placeholder={MODEL_ENGINES.find((m) => m.id === modelEngine)?.defaultNegative}
                className="w-full bg-black/30 border border-white/20 focus:border-purple-400 rounded-xl p-3 text-xs text-white placeholder-white/30 outline-none transition-all resize-y shadow-inner font-mono"
              />
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
                    </GlassButton>
                  );
                })}
              </div>
            </div>

            {/* Pengaturan General: Steps, Seed & CFG */}
            <div className="flex flex-col gap-3 bg-black/20 p-3.5 rounded-xl border border-white/10 text-xs">
              <div className="flex items-center justify-between text-white/90 font-medium">
                <span className="flex items-center gap-1.5">
                  <Sliders size={14} className="text-purple-300" />
                  Pengaturan General (Steps, Seed & CFG):
                </span>
                <GlassButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSteps(30);
                    setCfg(6);
                    setSeed(Math.floor(Math.random() * 1000000));
                  }}
                  className="text-[11px] text-purple-300 hover:text-purple-200 py-0.5 px-2 h-auto"
                >
                  <RefreshCw size={11} className="mr-1" /> Acak Seed & Reset
                </GlassButton>
              </div>

              <div className="grid grid-cols-3 gap-3">
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

                {/* CFG */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-white/60">CFG Scale:</label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="30"
                    value={cfg}
                    onChange={(e) => setCfg(parseFloat(e.target.value) || 6)}
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
                  <Loader2 size={18} className="animate-spin" /> Sedang Memproses Generate Image (${Math.floor(generateSeconds / 60).toString().padStart(2, '0')}:${(generateSeconds % 60).toString().padStart(2, '0')})...
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

            {/* Empty state / Loading / Single Image Display / Error State */}
            {isGenerating ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-4 border-purple-500/20 border-t-purple-400 animate-spin" />
                  <Sparkles className="absolute inset-0 m-auto text-purple-300" size={24} />
                </div>
                <div>
                  <h4 className="font-semibold text-white flex items-center justify-center gap-2">
                    <span>Memproses Image AI...</span>
                    <span className="text-purple-300 font-mono text-xs px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-400/30">
                      {Math.floor(generateSeconds / 60).toString().padStart(2, '0')}:{(generateSeconds % 60).toString().padStart(2, '0')}
                    </span>
                  </h4>
                  <p className="text-xs text-white/60 max-w-sm mt-1">
                    Sedang me-render gambar AI melalui model server ({selectedRatio.width}x{selectedRatio.height}, steps {steps}, seed {seed}, cfg {cfg}). Koneksi tetap aktif menunggu komputasi GPU selesai.
                  </p>
                </div>
              </div>
            ) : generateError ? (
              <div className="flex-1 flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-rose-500/40 bg-rose-500/10 rounded-2xl p-6">
                <div className="w-14 h-14 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-300 mb-3 shadow-[0_0_15px_rgba(244,63,94,0.3)]">
                  <AlertCircle size={28} />
                </div>
                <h4 className="font-semibold text-rose-200 text-base mb-1">Gagal Generate Image</h4>
                <p className="text-xs text-rose-300/90 max-w-md break-words select-text mb-4 leading-relaxed font-medium">
                  {generateError}
                </p>
                <div className="flex items-center gap-2">
                  <GlassButton
                    onClick={handleGenerateImage}
                    variant="primary"
                    size="sm"
                    className="text-xs flex items-center gap-1.5"
                  >
                    <RefreshCw size={13} /> Coba Generate Ulang
                  </GlassButton>
                  <GlassButton
                    onClick={() => setGenerateError(null)}
                    variant="ghost"
                    size="sm"
                    className="text-xs text-white/50 hover:text-white"
                  >
                    Tutup
                  </GlassButton>
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
                  <div className="flex items-center gap-3 text-white/70 flex-wrap">
                    <span className="font-mono bg-white/10 px-2 py-0.5 rounded text-[11px] text-purple-300">
                      {selectedRatio.label} ({selectedRatio.width}x{selectedRatio.height})
                    </span>
                    <span className="font-mono bg-purple-500/20 text-purple-200 border border-purple-400/30 px-2 py-0.5 rounded text-[11px]">
                      {modelEngine}
                    </span>
                    <span className="font-mono text-[11px]">
                      CFG: <strong className="text-white">{cfg}</strong>
                    </span>
                    <span className="font-mono text-[11px]">
                      Seed: <strong className="text-white">{generatedSeed ?? seed}</strong>
                    </span>
                    {lastDurationSeconds !== null && (
                      <span className="font-mono text-[11px] text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded flex items-center gap-1">
                        Durasi: <strong>{lastDurationSeconds} detik</strong>
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
              <div className="p-3 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-200 text-xs flex items-start gap-2 max-w-full overflow-hidden">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0 break-words line-clamp-3 select-text font-medium">{tryonError}</div>
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
      {/* TAB 3: FACE SWAP                                               */}
      {/* ============================================================== */}
      {activeTab === 'faceswap' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Form Input (Left Column) */}
          <div className="lg:col-span-5 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-6 flex flex-col gap-5">
            <div>
              <h3 className="text-base font-semibold flex items-center gap-2">
                <ScanFace size={18} className="text-purple-300" />
                Parameter Face Swap
              </h3>
              <p className="text-xs text-white/60 mt-1">
                <code className="text-purple-200 bg-white/10 px-1.5 py-0.5 rounded">
                  {baseUrl ? `${baseUrl.replace(/\/+$/, '')}/faceswap` : '/faceswap'}
                </code>
              </p>
            </div>

            {/* 2 Input File Gambar: Foto Referensi (kiri) & Face Referensi (kanan) */}
            <div className="grid grid-cols-2 gap-3">
              {/* Foto Referensi (source_image) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-white/90">
                  Foto Referensi :
                </label>
                <div className="relative border-2 border-dashed border-white/20 hover:border-purple-400/50 rounded-xl aspect-[3/4] flex flex-col items-center justify-center p-3 text-center bg-black/20 overflow-hidden transition-all group">
                  {sourceImagePreview ? (
                    <>
                      <img src={sourceImagePreview} alt="Foto Referensi" className="w-full h-full object-cover rounded-lg" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-2 transition-opacity p-2">
                        <GlassButton
                          onClick={() => {
                            setSourceImagePreview('');
                            setSourceImageFile(null);
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
                      <ImageIcon size={28} className="text-purple-300 mb-2 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-semibold text-white">Upload Foto Referensi</span>
                      <span className="text-[10px] text-white/50 mt-1">PNG atau JPG</span>
                      <input
                        type="file"
                        accept="image/png, image/jpeg, image/jpg"
                        onChange={handleSourceImageUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Face Referensi (target_image) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-white/90">
                  Face Referensi :
                </label>
                <div className="relative border-2 border-dashed border-white/20 hover:border-purple-400/50 rounded-xl aspect-[3/4] flex flex-col items-center justify-center p-3 text-center bg-black/20 overflow-hidden transition-all group">
                  {targetImagePreview ? (
                    <>
                      <img src={targetImagePreview} alt="Face Referensi" className="w-full h-full object-cover rounded-lg" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-2 transition-opacity p-2">
                        <GlassButton
                          onClick={() => {
                            setTargetImagePreview('');
                            setTargetImageFile(null);
                          }}
                          variant="danger"
                          size="sm"
                        >
                          <Trash2 size={13} /> Ganti Wajah
                        </GlassButton>
                      </div>
                    </>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center justify-center w-full h-full p-2">
                      <ScanFace size={28} className="text-purple-300 mb-2 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-semibold text-white">Upload Face Referensi</span>
                      <span className="text-[10px] text-white/50 mt-1">PNG atau JPG</span>
                      <input
                        type="file"
                        accept="image/png, image/jpeg, image/jpg"
                        onChange={handleTargetImageUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>

            {/* Opsi face_restore (true/false) */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-medium text-white/90 flex items-center gap-1.5">
                  <Sliders size={14} className="text-purple-300" />
                  Face Restore:
                </label>
                <span className="text-[11px] text-purple-300 font-mono">
                  {faceRestore ? 'Aktif (true)' : 'Non-aktif (false)'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <GlassButton
                  type="button"
                  onClick={() => setFaceRestore(true)}
                  variant={faceRestore ? 'active' : 'subtle'}
                  className="p-2.5 h-auto flex-col items-center justify-center text-center cursor-pointer"
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all ${
                        faceRestore
                          ? 'border-white bg-white/20 shadow-[0_0_8px_rgba(255,255,255,0.4)]'
                          : 'border-white/30 bg-black/40'
                      }`}
                    >
                      {faceRestore && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </span>
                    <span className="text-xs font-bold">True</span>
                  </div>
                </GlassButton>
                <GlassButton
                  type="button"
                  onClick={() => setFaceRestore(false)}
                  variant={!faceRestore ? 'active' : 'subtle'}
                  className="p-2.5 h-auto flex-col items-center justify-center text-center cursor-pointer"
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all ${
                        !faceRestore
                          ? 'border-white bg-white/20 shadow-[0_0_8px_rgba(255,255,255,0.4)]'
                          : 'border-white/30 bg-black/40'
                      }`}
                    >
                      {!faceRestore && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </span>
                    <span className="text-xs font-bold">False</span>
                  </div>
                </GlassButton>
              </div>
            </div>

            {/* Opsi restore_visibility (0.0 - 1.0, default 0.6) */}
            <div className="flex flex-col gap-2 bg-black/20 p-3.5 rounded-xl border border-white/10 text-xs">
              <div className="flex items-center justify-between text-white/90 font-medium">
                <span className="flex items-center gap-1.5">
                  <Sliders size={14} className="text-purple-300" />
                  Restore Visibility (0.0 - 1.0):
                </span>
                <span className="text-purple-300 font-mono font-bold text-xs bg-purple-500/20 px-2 py-0.5 rounded border border-purple-400/30">
                  {restoreVisibility}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={restoreVisibility}
                  onChange={(e) => setRestoreVisibility(parseFloat(e.target.value))}
                  className="flex-1 accent-purple-400 cursor-pointer"
                />
                <input
                  type="number"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={restoreVisibility}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) {
                      setRestoreVisibility(Math.min(1.0, Math.max(0.0, val)));
                    }
                  }}
                  className="w-16 bg-black/40 border border-white/15 focus:border-purple-400 rounded-lg px-2 py-1 text-xs text-white text-center font-mono outline-none"
                />
              </div>
            </div>

            {/* Tombol Generate Face Swap */}
            <GlassButton
              onClick={handleFaceSwap}
              disabled={isFaceSwapping || !sourceImagePreview || !targetImagePreview}
              variant="primary"
              size="lg"
              glow
              className="w-full shadow-2xl"
            >
              {isFaceSwapping ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Sedang Memproses Face Swap (${Math.floor(faceSwapSeconds / 60).toString().padStart(2, '0')}:${(faceSwapSeconds % 60).toString().padStart(2, '0')})...
                </>
              ) : (
                <>
                  <ScanFace size={18} /> Generate Face Swap
                </>
              )}
            </GlassButton>
          </div>

          {/* Result Card (Right Column) - Sesuai dengan menu Generate Image */}
          <div className="lg:col-span-7 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-6 flex flex-col gap-4 min-h-[520px]">
            {/* Header Card Hasil Gambar dengan Tombol Save to S3 di Pojok Atas */}
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Layers size={18} className="text-indigo-300" />
                <h3 className="text-base font-semibold">Hasil Face Swap</h3>
                {faceSwapResultImage && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    Siap
                  </span>
                )}
              </div>

              {/* Action Buttons di Pojok Atas Card */}
              {faceSwapResultImage && (
                <div className="flex items-center gap-2">
                  {/* Tombol Save to S3 */}
                  <GlassButton
                    onClick={handleSaveFaceSwapToS3}
                    disabled={isSavingFaceSwapS3}
                    variant="success"
                    size="sm"
                    title="Simpan gambar ke S3 bucket"
                  >
                    {isSavingFaceSwapS3 ? (
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
                    onClick={() => setPreviewModalImg(faceSwapResultImage)}
                    title="Perbesar Gambar"
                    variant="default"
                    size="icon"
                  >
                    <Maximize2 size={15} />
                  </GlassButton>

                  <GlassButton
                    onClick={() => downloadImage(faceSwapResultImage, faceSwapResultFilename || `faceswap-${Date.now()}.png`)}
                    title="Download Gambar"
                    variant="active"
                    size="icon"
                  >
                    <Download size={15} />
                  </GlassButton>

                  <GlassButton
                    onClick={() => {
                      setFaceSwapResultImage('');
                      setFaceSwapResultFilename(null);
                      setFaceSwapS3Notification(null);
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
              {faceSwapS3Notification && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className={`p-3.5 rounded-xl text-xs flex items-center justify-between gap-3 border shadow-xl ${
                    faceSwapS3Notification.type === 'success'
                      ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40 backdrop-blur-md'
                      : 'bg-rose-500/20 text-rose-200 border-rose-500/40 backdrop-blur-md'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {faceSwapS3Notification.type === 'success' ? (
                      <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle size={18} className="text-rose-400 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="font-semibold">{faceSwapS3Notification.message}</div>
                      {faceSwapS3Notification.filename && (
                        <div className="text-[11px] text-emerald-300/80 font-mono mt-0.5 truncate">
                          Nama File: <span className="font-bold underline">{faceSwapS3Notification.filename}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {faceSwapS3Notification.url && (
                    <a
                      href={faceSwapS3Notification.url}
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

            {/* Empty state / Loading / Single Image Display / Error State */}
            {isFaceSwapping ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-center gap-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full border-4 border-purple-500/20 border-t-purple-400 animate-spin" />
                  <ScanFace className="absolute inset-0 m-auto text-purple-300" size={24} />
                </div>
                <div>
                  <h4 className="font-semibold text-white flex items-center justify-center gap-2">
                    <span>Memproses Face Swap...</span>
                    <span className="text-purple-300 font-mono text-xs px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-400/30">
                      {Math.floor(faceSwapSeconds / 60).toString().padStart(2, '0')}:{(faceSwapSeconds % 60).toString().padStart(2, '0')}
                    </span>
                  </h4>
                  <p className="text-xs text-white/60 max-w-sm mt-1">
                    Sedang menukar wajah pada Foto Referensi dengan Face Referensi (restore: {faceRestore ? 'true' : 'false'}, visibility: {restoreVisibility}). Koneksi tetap aktif menunggu komputasi GPU selesai.
                  </p>
                </div>
              </div>
            ) : faceSwapError ? (
              <div className="flex-1 flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-rose-500/40 bg-rose-500/10 rounded-2xl p-6">
                <div className="w-14 h-14 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-300 mb-3 shadow-[0_0_15px_rgba(244,63,94,0.3)]">
                  <AlertCircle size={28} />
                </div>
                <h4 className="font-semibold text-rose-200 text-base mb-1">Gagal Face Swap</h4>
                <p className="text-xs text-rose-300/90 max-w-md break-words select-text mb-4 leading-relaxed font-medium">
                  {faceSwapError}
                </p>
                <div className="flex items-center gap-2">
                  <GlassButton
                    onClick={handleFaceSwap}
                    variant="primary"
                    size="sm"
                    className="text-xs flex items-center gap-1.5"
                  >
                    <RefreshCw size={13} /> Coba Generate Ulang
                  </GlassButton>
                  <GlassButton
                    onClick={() => setFaceSwapError(null)}
                    variant="ghost"
                    size="sm"
                    className="text-xs text-white/50 hover:text-white"
                  >
                    Tutup
                  </GlassButton>
                </div>
              </div>
            ) : !faceSwapResultImage ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-white/15 rounded-xl">
                <ScanFace size={48} className="text-white/20 mb-3" />
                <h4 className="font-medium text-white/80 text-sm">Belum Ada Gambar yang Dibuat</h4>
                <p className="text-xs text-white/50 max-w-sm mt-1">
                  Unggah Foto Referensi (pose) dan Face Referensi (wajah), atur opsi restorasi, lalu klik tombol "Generate Face Swap".
                </p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col gap-3">
                {/* Single Image Container */}
                <div className="group relative bg-black/40 border border-white/15 rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center min-h-[380px] max-h-[560px]">
                  <img
                    src={faceSwapResultImage}
                    alt="Face swap result"
                    className="w-full h-full max-h-[560px] object-contain transition-transform duration-300"
                  />

                  {/* Tombol Pojok Atas Gambar (Perbesar) */}
                  <div className="absolute top-3 right-3 flex items-center gap-2">
                    <GlassButton
                      onClick={() => setPreviewModalImg(faceSwapResultImage)}
                      variant="default"
                      size="icon"
                      title="Perbesar"
                    >
                      <Maximize2 size={14} />
                    </GlassButton>
                  </div>
                </div>

                {/* Info Bar Detail Gambar (Sama seperti Generate Image) */}
                <div className="p-3 bg-black/30 border border-white/10 rounded-xl flex items-center justify-between flex-wrap gap-2 text-xs">
                  <div className="flex items-center gap-3 text-white/70 flex-wrap">
                    <span className="font-mono bg-purple-500/20 text-purple-200 border border-purple-400/30 px-2 py-0.5 rounded text-[11px]">
                      Face Swap
                    </span>
                    <span className="font-mono text-[11px]">
                      Face Restore: <strong className="text-white">{faceRestore ? 'True' : 'False'}</strong>
                    </span>
                    <span className="font-mono text-[11px]">
                      Visibility: <strong className="text-white">{restoreVisibility}</strong>
                    </span>
                    {faceSwapLastDurationSeconds !== null && (
                      <span className="font-mono text-[11px] text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded flex items-center gap-1">
                        Durasi: <strong>{faceSwapLastDurationSeconds} detik</strong>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <GlassButton
                      onClick={() => downloadImage(faceSwapResultImage, faceSwapResultFilename || `faceswap-${Date.now()}.png`)}
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
            {faceSwapDebug && (
              <div className="mt-auto pt-4 border-t border-white/10">
                <GlassButton
                  onClick={() => setShowDebugJson(!showDebugJson)}
                  variant="ghost"
                  size="sm"
                  className="text-xs text-white/50 hover:text-white flex items-center gap-1.5"
                >
                  <Code size={13} />
                  <span>{showDebugJson ? 'Sembunyikan Debug Data' : 'Lihat Payload & API Response'}</span>
                </GlassButton>
                {showDebugJson && (
                  <div className="mt-2 p-3 bg-black/50 border border-white/10 rounded-xl font-mono text-[11px] text-white/80 overflow-x-auto max-h-48">
                    <pre>{JSON.stringify(faceSwapDebug, null, 2)}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* PLACEHOLDER TAB 4 (Menyusul)                                   */}
      {/* ============================================================== */}
      {activeTab === 'future4' && (
        <div className="w-full bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-12 text-center flex flex-col items-center justify-center gap-4">
          <div className="p-4 bg-purple-500/20 border border-purple-400/30 rounded-full">
            <Sparkles size={36} className="text-purple-300" />
          </div>
          <div>
            <h3 className="text-lg font-bold">
              Fungsi 4: Segera Hadir
            </h3>
            <p className="text-sm text-white/60 max-w-md mt-1">
              Fungsi ini sedang dipersiapkan dan akan diaktifkan setelah pengujian sample selesai.
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
      {/* ============================================================== */}
      {/* MODAL KONFIRMASI START / STOP KAGGLE NOTEBOOK                  */}
      {/* ============================================================== */}
      <AnimatePresence>
        {kaggleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md bg-slate-900/95 border border-white/20 rounded-2xl p-6 shadow-2xl text-white flex flex-col gap-4 backdrop-blur-xl"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`p-3 rounded-xl ${
                    kaggleModal === 'start'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {kaggleModal === 'start' ? <Power size={22} /> : <PowerOff size={22} />}
                </div>
                <div>
                  <h3 className="text-base font-semibold">
                    {kaggleModal === 'start' ? 'Nyalakan Kaggle Notebook?' : 'Matikan Kaggle Notebook?'}
                  </h3>
                  <p className="text-xs text-white/60">
                    Notebook Target: <span className="font-mono text-emerald-400">notebook-t2i-fix</span>
                  </p>
                </div>
              </div>

              <p className="text-xs text-white/80 leading-relaxed">
                {kaggleModal === 'start'
                  ? 'Notebook akan dijalankan di akun Kaggle Anda dengan GPU aktif. Proses alokasi GPU, setup environment, dan pembukaan tunnel ngrok membutuhkan waktu sekitar 1-2 menit hingga status Server menjadi ON.'
                  : 'Perintah mematikan server model akan dikirim via /shutdown. Proses server di Kaggle notebook akan berhenti dan container GPU akan dilepas otomatis untuk menghemat kuota Kaggle Anda.'}
              </p>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
                <GlassButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setKaggleModal(null)}
                >
                  Batal
                </GlassButton>
                {kaggleModal === 'start' ? (
                  <GlassButton
                    type="button"
                    variant="active"
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-500 border-emerald-400 text-white"
                    onClick={handleStartNotebook}
                  >
                    Ya, Nyalakan
                  </GlassButton>
                ) : (
                  <GlassButton
                    type="button"
                    variant="active"
                    size="sm"
                    className="bg-rose-600 hover:bg-rose-500 border-rose-400 text-white"
                    onClick={handleStopNotebook}
                  >
                    Ya, Matikan
                  </GlassButton>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
