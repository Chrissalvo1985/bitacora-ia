import React, { useState, useRef, useEffect } from 'react';
import { ICONS } from '../constants';
import { useBitacora } from '../context/BitacoraContext';
import { Attachment, NoteType, TaskItem } from '../types';
import DocumentInsightsModal from './DocumentInsightsModal';
import AnalysisSummaryModal from './AnalysisSummaryModal';
import MultiTopicSummaryModal from './MultiTopicSummaryModal';
import { DocumentInsight } from '../services/documentAnalysisService';
import { motion, AnimatePresence } from 'framer-motion';
import { extractTextFromPDF } from '../services/pdfService';

// Multi-topic result type
interface MultiTopicModalData {
  isMultiTopic: boolean;
  topics: Array<{
    bookName: string;
    bookId: string;
    type: NoteType;
    summary: string;
    tasks: TaskItem[];
    entities: { name: string; type: string }[];
    isNewBook: boolean;
    entryId: string;
    taskActions: Array<{
      action: 'complete' | 'update';
      taskDescription: string;
      completionNotes?: string;
    }>;
  }>;
  overallContext: string;
  completedTasks: number;
}

// Analysis progress states
type AnalysisStep = 'idle' | 'reading' | 'analyzing' | 'classifying' | 'extracting' | 'complete';

const ANALYSIS_STEPS: Record<AnalysisStep, { label: string; progress: number; emoji: string }> = {
  idle: { label: '', progress: 0, emoji: '' },
  reading: { label: 'Leyendo contenido...', progress: 15, emoji: '📖' },
  analyzing: { label: 'Analizando con IA...', progress: 40, emoji: '🧠' },
  classifying: { label: 'Clasificando información...', progress: 70, emoji: '🏷️' },
  extracting: { label: 'Extrayendo tareas y entidades...', progress: 90, emoji: '✨' },
  complete: { label: '¡Listo!', progress: 100, emoji: '🎉' },
};

// Progress Bar Component
const AnalysisProgressBar: React.FC<{ step: AnalysisStep; hasAttachment: boolean }> = ({ step, hasAttachment }) => {
  const { label, progress, emoji } = ANALYSIS_STEPS[step];
  
  if (step === 'idle') return null;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="mb-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-100"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <motion.span 
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 1 }}
            className="text-xl"
          >
            {emoji}
          </motion.span>
          <span className="text-sm font-semibold text-gray-700">{label}</span>
        </div>
        <span className="text-xs font-bold text-indigo-600">{progress}%</span>
      </div>
      
      {/* Progress Bar */}
      <div className="h-2 bg-white/80 rounded-full overflow-hidden border border-indigo-100">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
        />
      </div>
      
      {/* Step indicators */}
      <div className="flex justify-between mt-2 px-1">
        {['reading', 'analyzing', 'classifying', 'extracting'].map((s, idx) => {
          const isActive = Object.keys(ANALYSIS_STEPS).indexOf(step) >= Object.keys(ANALYSIS_STEPS).indexOf(s as AnalysisStep);
          return (
            <div key={s} className="flex flex-col items-center">
              <div className={`w-2 h-2 rounded-full transition-colors ${isActive ? 'bg-indigo-500' : 'bg-gray-300'}`} />
              <span className={`text-[9px] mt-1 font-medium ${isActive ? 'text-indigo-600' : 'text-gray-400'}`}>
                {idx === 0 ? 'Leer' : idx === 1 ? 'Analizar' : idx === 2 ? 'Clasificar' : 'Extraer'}
              </span>
            </div>
          );
        })}
      </div>
      
      {hasAttachment && (
        <p className="text-[10px] text-gray-500 mt-2 text-center">
          📎 Procesando documento adjunto...
        </p>
      )}
    </motion.div>
  );
};

const CaptureInput: React.FC = () => {
  const [text, setText] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isPenMode, setIsPenMode] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState<AnalysisStep>('idle');
  const { addEntry, isLoading, updateTaskStatus, refreshData, confirmEntryWithEdits, entries, deleteEntry } = useBitacora();
  const [attachment, setAttachment] = useState<Attachment | undefined>(undefined);
  const [fileError, setFileError] = useState<string | null>(null);
  const [showInsightsModal, setShowInsightsModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showMultiTopicModal, setShowMultiTopicModal] = useState(false);
  const [multiTopicData, setMultiTopicData] = useState<MultiTopicModalData | null>(null);
  const [documentInsights, setDocumentInsights] = useState<DocumentInsight[]>([]);
  const [currentFileName, setCurrentFileName] = useState('');
  const [analysisSummary, setAnalysisSummary] = useState<any>(null);
  const [tempEntryId, setTempEntryId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      // @ts-ignore
      const recognition = new webkitSpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'es-ES'; // Set Spanish
      
      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setText(prev => prev + ' ' + finalTranscript);
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech error", event);
        setIsListening(false);
      };
      
      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Tu navegador no soporta reconocimiento de voz. Intenta con Chrome.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const [isExtractingText, setIsExtractingText] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError(null);

    // Increased limit to 50MB for better file support (especially PDFs)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      const errorMsg = `El archivo es muy grande (${(file.size / 1024 / 1024).toFixed(2)}MB). El límite es 50MB.`;
      setFileError(errorMsg);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setFileError(null), 5000);
      return;
    }

    // Check file type
    const isImage = file.type.startsWith('image/');
    const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    if (!isImage && !isPDF) {
      const errorMsg = 'Solo se permiten imágenes y archivos PDF.';
      setFileError(errorMsg);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setFileError(null), 5000);
      return;
    }

    try {
      const reader = new FileReader();
      
      reader.onloadend = async () => {
        try {
          const base64String = reader.result as string;
          if (!base64String) {
            throw new Error('No se pudo leer el archivo');
          }
          
          const type = isImage ? 'image' : 'document';
          
          // For PDFs, extract text content
          let extractedText: string | undefined;
          if (isPDF) {
            setIsExtractingText(true);
            try {
              console.log('Starting PDF text extraction...');
              extractedText = await extractTextFromPDF(base64String);
              console.log(`✅ PDF text extracted successfully: ${extractedText.length} characters`);
              console.log('First 200 chars:', extractedText.substring(0, 200));
              
              if (!extractedText || extractedText.trim().length === 0) {
                console.warn('⚠️ PDF text extraction returned empty string');
              }
            } catch (err) {
              console.error('❌ Could not extract PDF text:', err);
              // Continue without extracted text - the file will still be saved
            } finally {
              setIsExtractingText(false);
            }
          }
          
          setAttachment({
            type,
            mimeType: file.type || (isPDF ? 'application/pdf' : 'image/jpeg'),
            data: base64String,
            fileName: file.name,
            extractedText, // Include extracted text for PDFs
          });
          setIsExpanded(true);
          setFileError(null);
        } catch (error) {
          console.error('Error processing file data:', error);
          setFileError('Error al procesar el archivo. Intenta de nuevo.');
          if (fileInputRef.current) fileInputRef.current.value = '';
          setTimeout(() => setFileError(null), 5000);
          setIsExtractingText(false);
        }
      };

      reader.onerror = () => {
        setFileError('Error al leer el archivo. Intenta de nuevo.');
        if (fileInputRef.current) fileInputRef.current.value = '';
        setTimeout(() => setFileError(null), 5000);
      };

      reader.onabort = () => {
        setFileError('Lectura del archivo cancelada.');
        if (fileInputRef.current) fileInputRef.current.value = '';
        setTimeout(() => setFileError(null), 3000);
      };

      // For both PDFs and images, read as data URL
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error processing file:', error);
      setFileError('Error inesperado al procesar el archivo. Intenta con otro formato.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setFileError(null), 5000);
    }
  };

  const clearAttachment = () => {
    setAttachment(undefined);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Simulate progress steps during analysis
  const runAnalysisWithProgress = async (contentText: string, contentAttachment?: Attachment) => {
    const hasAttachment = !!contentAttachment;
    
    // Step 1: Reading
    setAnalysisStep('reading');
    await new Promise(r => setTimeout(r, 400));
    
    // Step 2: Analyzing
    setAnalysisStep('analyzing');
    
    // Start the actual analysis
    const resultPromise = addEntry(contentText, contentAttachment, false);
    
    // Step 3: Classifying (after a delay)
    setTimeout(() => setAnalysisStep('classifying'), 1500);
    
    // Step 4: Extracting (after more delay)
    setTimeout(() => setAnalysisStep('extracting'), 3000);
    
    // Wait for actual result
    const result = await resultPromise;
    
    // Step 5: Complete
    setAnalysisStep('complete');
    await new Promise(r => setTimeout(r, 500));
    
    // Reset progress
    setAnalysisStep('idle');
    
    return result;
  };

  const handleSubmit = async () => {
    // If in pen mode, convert canvas to image
    if (isPenMode && canvasRef.current) {
      const imageData = convertCanvasToImage();
      if (imageData) {
        const drawingAttachment: Attachment = {
          type: 'image',
          mimeType: 'image/png',
          data: imageData,
          fileName: 'dibujo.png'
        };
        
        // Reset UI but keep expanded for progress
        clearCanvas();
        setIsPenMode(false);
        
        const result = await runAnalysisWithProgress('', drawingAttachment);
        setIsExpanded(false);
        
        // Handle multi-topic result
        if (result && 'multiTopicResult' in result && result.multiTopicResult) {
          setMultiTopicData(result.multiTopicResult);
          setShowMultiTopicModal(true);
          return;
        }
        
        if (result && 'analysisSummary' in result && result.analysisSummary) {
          const summary = result.analysisSummary as any;
          if (summary.tempEntryId) {
            setTempEntryId(summary.tempEntryId);
            const { tempEntryId, ...summaryForModal } = summary;
            const enrichedSummary = {
              ...summaryForModal,
              documentInsights: result.insights || [],
            };
            setAnalysisSummary(enrichedSummary);
            setShowSummaryModal(true);
          }
        }
        
        if (result && 'shouldShowModal' in result && result.shouldShowModal && result.insights) {
          setDocumentInsights(result.insights);
          setCurrentFileName('dibujo.png');
        }
        return;
      }
    }
    
    if (!text.trim() && !attachment) return;
    
    const contentText = text;
    const contentAttachment = attachment;
    const fileName = attachment?.fileName || '';
    
    // Reset input but keep expanded for progress
    setText('');
    setAttachment(undefined);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsPenMode(false);
    clearCanvas();
    
    const result = await runAnalysisWithProgress(contentText, contentAttachment);
    setIsExpanded(false);
    
    // Handle multi-topic result (new flow)
    if (result && 'multiTopicResult' in result && result.multiTopicResult) {
      setMultiTopicData(result.multiTopicResult);
      setShowMultiTopicModal(true);
      return;
    }
    
    // Legacy: If there's an analysis summary, show summary modal first
    if (result && 'analysisSummary' in result && result.analysisSummary) {
      const summary = result.analysisSummary as any;
      if (summary.tempEntryId) {
        setTempEntryId(summary.tempEntryId);
        // Remove tempEntryId from summary before passing to modal
        const { tempEntryId, ...summaryForModal } = summary;
        
        // Include document insights in the summary modal (attachment only used for AI context)
        const enrichedSummary = {
          ...summaryForModal,
          documentInsights: result.insights || [],
        };
        
        setAnalysisSummary(enrichedSummary);
        setShowSummaryModal(true);
        
        // Store insights for reference but don't show separate modal
        if (result.insights) {
          setDocumentInsights(result.insights);
          setCurrentFileName(fileName);
        }
      }
    }
  };

  const handleConfirmSummary = async (editedData: any) => {
    if (tempEntryId) {
      await confirmEntryWithEdits(tempEntryId, editedData);
      setShowSummaryModal(false);
      setTempEntryId(null);
      setAnalysisSummary(null);
      // Clear document insights - they were already shown in the summary modal
      setDocumentInsights([]);
      setCurrentFileName('');
    }
  };

  const handleCancelSummary = () => {
    // Delete the temp entry if user cancels
    if (tempEntryId) {
      deleteEntry(tempEntryId);
    }
    setShowSummaryModal(false);
    setTempEntryId(null);
    setAnalysisSummary(null);
  };

  const handleInsightAction = async (insight: DocumentInsight) => {
    if (insight.action) {
      switch (insight.action.type) {
        case 'create_task':
          // Task will be created automatically by the entry
          break;
        case 'update_task':
          if (insight.action.data?.entryId && insight.action.data?.taskIndex !== undefined) {
            await updateTaskStatus(insight.action.data.entryId, insight.action.data.taskIndex, true);
            await refreshData();
          }
          break;
        case 'update_entry':
          // Entry update logic
          break;
      }
    }
    // Remove this insight from the list
    setDocumentInsights(prev => prev.filter(i => i !== insight));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.metaKey) {
      handleSubmit();
    }
  };

  // Canvas drawing functions
  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const drawOnCanvas = (x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    if (!ctx) return;

    // Better settings for smooth drawing
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1f2937';
    ctx.globalCompositeOperation = 'source-over';

    if (lastPointRef.current) {
      ctx.beginPath();
      ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    } else {
      // Draw a dot if it's the first point
      ctx.beginPath();
      ctx.arc(x, y, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fill();
    }
    lastPointRef.current = { x, y };
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Only draw if pen mode is explicitly enabled
    if (isPenMode) {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.setPointerCapture(e.pointerId);
      }
      setIsDrawing(true);
      const coords = getCanvasCoordinatesFromPointer(e);
      if (coords) {
        lastPointRef.current = coords;
        const ctx = canvas?.getContext('2d');
        if (ctx) {
          ctx.beginPath();
          ctx.moveTo(coords.x, coords.y);
        }
      }
    }
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDrawing && isPenMode) {
      e.preventDefault();
      const coords = getCanvasCoordinatesFromPointer(e);
      if (coords) {
        drawOnCanvas(coords.x, coords.y);
      }
    }
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isPenMode) {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.releasePointerCapture(e.pointerId);
      }
      setIsDrawing(false);
      lastPointRef.current = null;
    }
  };

  const getCanvasCoordinatesFromPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    // Get coordinates in CSS pixels (canvas is already scaled internally)
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    return { x, y };
  };

  // Legacy mouse handlers for desktop
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPenMode && e.pointerType !== 'pen' && e.pointerType !== 'touch') {
      setIsDrawing(true);
      const coords = getCanvasCoordinates(e);
      if (coords) {
        lastPointRef.current = coords;
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.beginPath();
            ctx.moveTo(coords.x, coords.y);
          }
        }
      }
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDrawing && isPenMode && e.pointerType !== 'pen' && e.pointerType !== 'touch') {
      const coords = getCanvasCoordinates(e);
      if (coords) {
        drawOnCanvas(coords.x, coords.y);
      }
    }
  };

  const handleCanvasMouseUp = () => {
    setIsDrawing(false);
    lastPointRef.current = null;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    lastPointRef.current = null;
  };

  const convertCanvasToImage = (): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.toDataURL('image/png');
  };

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    if (!ctx) return;

    // Set canvas size with proper scaling for high DPI displays
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      
      // Set actual size in memory (scaled for high DPI)
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      
      // Scale the drawing context so everything draws at the correct size
      ctx.scale(dpr, dpr);
      
      // Set display size (CSS pixels)
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      
      // Configure drawing settings
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [isPenMode]);

  // Toggle pen mode manually
  const togglePenMode = () => {
    if (isPenMode) {
      setIsPenMode(false);
      clearCanvas();
    } else {
      setIsPenMode(true);
      setIsExpanded(true);
    }
  };

  return (
    <div className={`
      relative bg-white rounded-2xl shadow-xl shadow-indigo-100/50 border border-indigo-50 transition-all duration-300 overflow-hidden
      ${isExpanded ? 'p-4 md:p-5' : 'p-2.5 md:p-3 flex items-center gap-2'}
    `}>
      {/* Analysis Progress Bar */}
      <AnimatePresence>
        {analysisStep !== 'idle' && (
          <AnalysisProgressBar step={analysisStep} hasAttachment={!!attachment} />
        )}
      </AnimatePresence>

      {/* File Error Message */}
      {fileError && (
        <div className="mb-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-base text-rose-700 flex items-center gap-2">
          <ICONS.AlertOctagon size={18} />
          <span>{fileError}</span>
        </div>
      )}

      {/* Attachment Preview */}
      {isExpanded && attachment && (
        <div className="mb-3 relative inline-block group">
            {attachment.type === 'image' ? (
                <img src={attachment.data} alt="Preview" className="h-20 w-auto rounded-xl border border-gray-200 object-cover shadow-sm" />
            ) : (
                <div className="h-20 w-32 bg-gray-50 rounded-xl border border-gray-200 flex flex-col items-center justify-center p-2 text-center">
                    <ICONS.FileText className="text-gray-400 mb-1" size={22} />
                    <span className="text-xs text-gray-500 font-medium line-clamp-2 leading-tight">{attachment.fileName}</span>
                    {attachment.mimeType === 'application/pdf' && (
                      <span className="text-[10px] text-indigo-600 font-bold mt-0.5">PDF</span>
                    )}
                </div>
            )}
            <button 
                onClick={clearAttachment}
                className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-1 shadow-md hover:bg-rose-600 transition-colors"
            >
                <ICONS.X size={12} />
            </button>
        </div>
      )}

      <div className={`flex-1 ${isExpanded ? 'mb-3' : ''}`}>
        {isPenMode && isExpanded ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <button
                onClick={clearCanvas}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
              >
                <ICONS.Eraser size={14} />
                Limpiar
              </button>
              <button
                onClick={() => {
                  setIsPenMode(false);
                  clearCanvas();
                }}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
              >
                <ICONS.X size={14} />
                Modo texto
              </button>
            </div>
            <div className="relative">
              <canvas
                ref={canvasRef}
                onPointerDown={handleCanvasPointerDown}
                onPointerMove={handleCanvasPointerMove}
                onPointerUp={handleCanvasPointerUp}
                onPointerCancel={handleCanvasPointerUp}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
                className="w-full h-64 md:h-80 border-2 border-gray-200 rounded-xl cursor-crosshair bg-white"
                style={{ 
                  touchAction: 'none',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  msUserSelect: 'none'
                }}
              />
            </div>
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setIsExpanded(true)}
            onKeyDown={handleKeyDown}
            placeholder={isExpanded ? "Escribe o dicta... (ej: 'Acordamos con Juan revisar el proyecto mañana') 🎤✨" : "✨ ¿Qué tienes en mente, crack?"}
            className={`
              w-full resize-none outline-none bg-transparent placeholder-gray-400 text-gray-800 font-medium
              ${isExpanded ? 'h-24 md:h-28 text-base leading-relaxed' : 'h-7 md:h-8 py-0.5 overflow-hidden text-sm md:text-base'}
            `}
            style={{ fontSize: '16px' }} // Prevents iOS zoom on focus
          />
        )}
      </div>

      <div className={`flex items-center justify-between ${!isExpanded ? 'flex-shrink-0' : ''}`}>
        <div className="flex items-center gap-2">
           {isExpanded && (
             <>
                <button 
                    onClick={toggleListening}
                    className={`p-3 md:p-3.5 lg:p-4 rounded-full transition-all duration-300 ${isListening ? 'bg-rose-500 text-white shadow-lg animate-pulse scale-110' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                    title="Dictar"
                >
                    <ICONS.Mic size={22} className="md:w-[24px] md:h-[24px] lg:w-[26px] lg:h-[26px]" />
                </button>

                <button 
                    onClick={togglePenMode}
                    className={`p-3 md:p-3.5 lg:p-4 rounded-full transition-all duration-300 ${isPenMode ? 'bg-indigo-500 text-white shadow-lg' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                    title={isPenMode ? "Desactivar modo dibujo" : "Activar modo dibujo"}
                >
                    <ICONS.PenTool size={22} className="md:w-[24px] md:h-[24px] lg:w-[26px] lg:h-[26px]" />
                </button>

                <div className="relative">
                    <input 
                        type="file" 
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden" 
                        accept="image/*,application/pdf,.pdf"
                    />
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className={`p-3 md:p-3.5 lg:p-4 rounded-full transition-all duration-300 ${attachment ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                        title="Adjuntar imagen o PDF"
                    >
                        <ICONS.Paperclip size={22} className="md:w-[24px] md:h-[24px] lg:w-[26px] lg:h-[26px]" />
                    </button>
                </div>
             </>
           )}
        </div>
        
        <div className="flex items-center gap-2">
            {isExpanded && (
                <span className="text-xs text-gray-400 mr-2 hidden md:inline font-medium">⌘ + Enter</span>
            )}
            <button
                onClick={handleSubmit}
                disabled={(!text.trim() && !attachment && !isPenMode) || isLoading}
                className={`
                    flex items-center justify-center gap-2 rounded-2xl font-bold transition-all duration-300 active:scale-95
                    ${isExpanded ? 'px-6 py-3 md:px-8 md:py-3.5 lg:px-10 lg:py-4 text-base md:text-lg' : 'p-3 md:p-4'}
                    ${(text.trim() || attachment || isPenMode)
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-lg hover:shadow-indigo-500/30 transform hover:-translate-y-0.5' 
                        : 'bg-gray-100 text-gray-300 cursor-not-allowed'}
                `}
            >
                {isLoading ? <ICONS.Loader2 className="animate-spin md:w-[24px] md:h-[24px] lg:w-[26px] lg:h-[26px]" size={22} /> : <ICONS.Send size={22} className="md:w-[24px] md:h-[24px] lg:w-[26px] lg:h-[26px]" />}
                {isExpanded && <span>Guardar</span>}
            </button>
        </div>
      </div>

      {analysisSummary && (
        <AnalysisSummaryModal
          isOpen={showSummaryModal}
          onClose={handleCancelSummary}
          onConfirm={handleConfirmSummary}
          analysis={analysisSummary}
        />
      )}

      {/* Multi-Topic Summary Modal */}
      {showMultiTopicModal && multiTopicData && (
        <MultiTopicSummaryModal
          isOpen={showMultiTopicModal}
          onClose={() => {
            setShowMultiTopicModal(false);
            setMultiTopicData(null);
          }}
          isMultiTopic={multiTopicData.isMultiTopic}
          topics={multiTopicData.topics}
          overallContext={multiTopicData.overallContext}
          completedTasks={multiTopicData.completedTasks}
        />
      )}

      <DocumentInsightsModal
        isOpen={showInsightsModal}
        onClose={() => {
          setShowInsightsModal(false);
          setDocumentInsights([]);
        }}
        insights={documentInsights}
        onAction={handleInsightAction}
        fileName={currentFileName}
      />
    </div>
  );
};

export default CaptureInput;