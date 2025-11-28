import React, { useState, useRef, useEffect } from 'react';
import { ICONS } from '../constants';
import { useBitacora } from '../context/BitacoraContext';
import { Attachment } from '../types';
import DocumentInsightsModal from './DocumentInsightsModal';
import AnalysisSummaryModal from './AnalysisSummaryModal';
import { DocumentInsight } from '../services/documentAnalysisService';

const CaptureInput: React.FC = () => {
  const [text, setText] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isPenMode, setIsPenMode] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const { addEntry, isLoading, updateTaskStatus, refreshData, confirmEntryWithEdits, entries, deleteEntry } = useBitacora();
  const [attachment, setAttachment] = useState<Attachment | undefined>(undefined);
  const [fileError, setFileError] = useState<string | null>(null);
  const [showInsightsModal, setShowInsightsModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
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
      
      reader.onloadend = () => {
        try {
          const base64String = reader.result as string;
          if (!base64String) {
            throw new Error('No se pudo leer el archivo');
          }
          
          const type = isImage ? 'image' : 'document';
          
          setAttachment({
            type,
            mimeType: file.type || (isPDF ? 'application/pdf' : 'image/jpeg'),
            data: base64String,
            fileName: file.name
          });
          setIsExpanded(true);
          setFileError(null);
        } catch (error) {
          console.error('Error processing file data:', error);
          setFileError('Error al procesar el archivo. Intenta de nuevo.');
          if (fileInputRef.current) fileInputRef.current.value = '';
          setTimeout(() => setFileError(null), 5000);
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
        
        // Reset UI
        clearCanvas();
        setIsPenMode(false);
        setIsExpanded(false);
        
        const result = await addEntry('', drawingAttachment, false);
        
        if (result && 'analysisSummary' in result && result.analysisSummary) {
          const summary = result.analysisSummary as any;
          if (summary.tempEntryId) {
            setTempEntryId(summary.tempEntryId);
            const { tempEntryId, ...summaryForModal } = summary;
            setAnalysisSummary(summaryForModal);
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
    
    // Reset UI immediately
    setText('');
    setAttachment(undefined);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsExpanded(false);
    setIsPenMode(false);
    clearCanvas();
    
    const result = await addEntry(contentText, contentAttachment, false);
    
    // If there's an analysis summary, show summary modal first
    if (result && 'analysisSummary' in result && result.analysisSummary) {
      const summary = result.analysisSummary as any;
      if (summary.tempEntryId) {
        setTempEntryId(summary.tempEntryId);
        // Remove tempEntryId from summary before passing to modal
        const { tempEntryId, ...summaryForModal } = summary;
        setAnalysisSummary(summaryForModal);
        setShowSummaryModal(true);
      }
    }
    
    // If there are insights, show modal after summary
    if (result && 'shouldShowModal' in result && result.shouldShowModal && result.insights) {
      setDocumentInsights(result.insights);
      setCurrentFileName(fileName);
      // Show insights modal after summary modal closes
    }
  };

  const handleConfirmSummary = async (editedData: any) => {
    if (tempEntryId) {
      await confirmEntryWithEdits(tempEntryId, editedData);
      setShowSummaryModal(false);
      setTempEntryId(null);
      setAnalysisSummary(null);
      
      // If there are insights, show them now
      if (documentInsights.length > 0) {
        setShowInsightsModal(true);
      }
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
            placeholder={isExpanded ? "Escribe o dicta... (ej: 'Acordamos con Juan revisar el proyecto mañana')" : "✨ ¿Qué tienes en mente?"}
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