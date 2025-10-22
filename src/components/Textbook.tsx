// src/components/Textbook.tsx
import React, { useRef, useCallback, useEffect, useState } from 'react';
import { UploadIcon, PenIcon, EraserIcon, HighlighterIcon, ZoomInIcon, ZoomOutIcon, TrashIcon } from './Icons';
import type { Annotation, AnnotationStore, Tool, TextbookFile, AnnotationPoint } from '../types';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

if (typeof window !== 'undefined' && 'Worker' in window) {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

interface TextbookProps {
    textbooks: TextbookFile[];
    selectedTextbook: TextbookFile | null;
    onSelectTextbook: (name: string | null) => void;
    onAddTextbook: (file: File) => void;
    numPages: number;
    setNumPages: (count: number) => void;
    currentPage: number;
    setCurrentPage: (page: number) => void;
    tool: Tool;
    setTool: (tool: Tool) => void;
    color: string;
    setColor: (color: string) => void;
    annotations: AnnotationStore;
    onUpdateAnnotations: (annotations: AnnotationStore) => void;
}

const Textbook: React.FC<TextbookProps> = ({
    textbooks, selectedTextbook, onSelectTextbook, onAddTextbook,
    numPages, setNumPages, currentPage, setCurrentPage,
    tool, setTool, color, setColor,
    annotations, onUpdateAnnotations
}) => {
    const [zoom, setZoom] = useState(1.2);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>('');
    const [pdfRendered, setPdfRendered] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const annotationCanvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    
    const [isDrawing, setIsDrawing] = useState(false);
    const currentDrawingRef = useRef<Annotation | null>(null);
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

    const getContext = (canvas: HTMLCanvasElement | null) => canvas?.getContext('2d');
    
    const getPointFromEvent = (e: React.MouseEvent<HTMLCanvasElement>): AnnotationPoint => {
        const canvas = annotationCanvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / zoom;
        const y = (e.clientY - rect.top) / zoom;
        
        return { x, y };
    };

    const drawAllAnnotations = useCallback(() => {
        const canvas = annotationCanvasRef.current;
        const ctx = getContext(canvas);
        if (!ctx || !canvas || !pdfRendered) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const pageAnnotations = annotations[currentPage] || [];

        pageAnnotations.forEach(ann => {
            ctx.beginPath();
            ctx.strokeStyle = ann.color;
            ctx.lineWidth = ann.tool === 'highlighter' ? 15 : (ann.tool === 'eraser' ? 20 : 3);
            ctx.globalAlpha = ann.tool === 'highlighter' ? 0.4 : 1.0;
            ctx.globalCompositeOperation = ann.tool === 'eraser' ? 'destination-out' : 'source-over';
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            
            ann.points.forEach((p, i) => {
                const x = p.x * zoom;
                const y = p.y * zoom;
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });
            ctx.stroke();
        });
        
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;
    }, [annotations, currentPage, zoom, pdfRendered]);

    useEffect(() => {
        if (pdfRendered) {
            drawAllAnnotations();
        }
    }, [zoom, currentPage, annotations, drawAllAnnotations, pdfRendered]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type === 'application/pdf') {
            setError('');
            setLoading(true);
            onAddTextbook(file);
        } else {
            setError('Пожалуйста, выберите PDF файл');
        }
    };
    
    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!selectedTextbook) return;
        
        setIsDrawing(true);
        const startPoint = getPointFromEvent(e);
        
        currentDrawingRef.current = { 
            tool, 
            color, 
            points: [startPoint]
        };
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing || !selectedTextbook || !currentDrawingRef.current) return;
        
        const canvas = annotationCanvasRef.current;
        const ctx = getContext(canvas);
        if (!ctx || !canvas) return;
        
        const currentAnn = currentDrawingRef.current;
        const newPoint = getPointFromEvent(e);
        currentAnn.points.push(newPoint);

        const prevPoint = currentAnn.points[currentAnn.points.length - 2];
        
        ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
        ctx.strokeStyle = currentAnn.color;
        ctx.lineWidth = tool === 'highlighter' ? 15 : (tool === 'eraser' ? 20 : 3);
        ctx.globalAlpha = tool === 'highlighter' ? 0.4 : 1.0;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.beginPath();
        ctx.moveTo(prevPoint.x * zoom, prevPoint.y * zoom);
        ctx.lineTo(newPoint.x * zoom, newPoint.y * zoom);
        ctx.stroke();
    };
    
    const stopDrawing = () => {
        if (!isDrawing || !currentDrawingRef.current) return;
        
        setIsDrawing(false);
        
        const finishedAnnotation = currentDrawingRef.current;
        currentDrawingRef.current = null;

        if (finishedAnnotation.points.length < 2) {
            drawAllAnnotations();
            return;
        }

        const pageAnns = annotations[currentPage] || [];
        const newStore = {
            ...annotations,
            [currentPage]: [...pageAnns, finishedAnnotation]
        };
        onUpdateAnnotations(newStore);
    };

    const onDocumentLoadSuccess = ({ numPages: nextNumPages }: { numPages: number }) => {
        console.log('📄 PDF loaded successfully:', nextNumPages, 'pages');
        setNumPages(nextNumPages);
        setLoading(false);
        setError('');
        setPdfRendered(false);
        
        if(currentPage > nextNumPages) {
            setCurrentPage(nextNumPages);
        }
    };

    const onDocumentLoadError = (error: Error) => {
        console.error('❌ PDF load error:', error);
        setLoading(false);
        setError('Не удалось загрузить PDF. Проверьте файл или попробуйте другой.');
    };

    const onPageRenderSuccess = () => {
        console.log('✅ Page rendered successfully');
        setPdfRendered(true);
        
        const pdfContainer = containerRef.current;
        if (pdfContainer) {
            const pdfCanvas = pdfContainer.querySelector('canvas');
            if (pdfCanvas) {
                const { width, height } = pdfCanvas.getBoundingClientRect();
                setCanvasSize({ width, height });
                
                setTimeout(() => drawAllAnnotations(), 50);
            }
        }
    };

    const clearCurrentPageAnnotations = () => {
        if (!window.confirm('Удалить все аннотации на этой странице?')) return;
        
        const newStore = { ...annotations };
        delete newStore[currentPage];
        onUpdateAnnotations(newStore);
    };

    const ToolbarButton: React.FC<{
        label: string;
        active: boolean;
        onClick: () => void;
        icon: React.ReactNode;
        disabled?: boolean;
    }> = ({ label, active, onClick, icon, disabled = false }) => (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`p-3 rounded-xl transition-all duration-200 ${
                active 
                    ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg scale-105' 
                    : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            aria-label={label}
            title={label}
        >
            {icon}
        </button>
    );

    const Toolbar: React.FC = () => (
        <div className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700">
            {/* Инструменты рисования */}
            <div className="flex items-center gap-2 px-2">
                <ToolbarButton 
                    label="Ручка" 
                    active={tool === 'pen'} 
                    onClick={() => setTool('pen')}
                    icon={
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                    }
                />
                <ToolbarButton 
                    label="Маркер" 
                    active={tool === 'highlighter'} 
                    onClick={() => setTool('highlighter')}
                    icon={
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                    }
                />
                <ToolbarButton 
                    label="Ластик" 
                    active={tool === 'eraser'} 
                    onClick={() => setTool('eraser')}
                    icon={
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    }
                />
            </div>

            <div className="w-px h-8 bg-gray-300 dark:bg-gray-600"></div>

            {/* Цвет */}
            <div className="flex items-center gap-2 px-2">
                <label className="flex items-center gap-2 cursor-pointer">
                    <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                    </svg>
                    <input 
                        type="color" 
                        value={color} 
                        onChange={e => setColor(e.target.value)} 
                        disabled={tool === 'eraser'}
                        className="w-12 h-10 cursor-pointer rounded-lg border-2 border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                </label>
            </div>

            <div className="w-px h-8 bg-gray-300 dark:bg-gray-600"></div>

            {/* Зум */}
            <div className="flex items-center gap-2 px-2">
                <button 
                    onClick={() => setZoom(z => Math.max(0.5, z - 0.2))} 
                    className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    title="Уменьшить"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                    </svg>
                </button>
                <span className="w-16 text-center font-semibold text-sm text-gray-700 dark:text-gray-300 px-2">
                    {Math.round(zoom * 100)}%
                </span>
                <button 
                    onClick={() => setZoom(z => Math.min(3, z + 0.2))} 
                    className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    title="Увеличить"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                    </svg>
                </button>
            </div>

            <div className="w-px h-8 bg-gray-300 dark:bg-gray-600"></div>

            {/* Очистка */}
            <button
                onClick={clearCurrentPageAnnotations}
                disabled={!annotations[currentPage] || annotations[currentPage].length === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mx-2"
                title="Очистить аннотации на странице"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span className="text-sm font-medium">Очистить</span>
            </button>
        </div>
    );
    
    const Pagination: React.FC = () => (
        <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700">
            <button 
                onClick={() => setCurrentPage(1)} 
                disabled={currentPage === 1}
                className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                title="Первая страница"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
            </button>

            <button 
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} 
                disabled={currentPage === 1}
                className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                title="Предыдущая"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
            </button>

            <div className="flex items-center gap-2 px-3">
                <input
                    type="number"
                    min={1}
                    max={numPages}
                    value={currentPage}
                    onChange={(e) => {
                        const page = parseInt(e.target.value);
                        if (page >= 1 && page <= numPages) {
                            setCurrentPage(page);
                        }
                    }}
                    className="w-20 px-3 py-2 text-center border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white font-medium focus:border-blue-500 focus:outline-none"
                />
                <span className="text-gray-600 dark:text-gray-400 font-medium">из {numPages || 0}</span>
            </div>

            <button 
                onClick={() => setCurrentPage(Math.min(numPages, currentPage + 1))} 
                disabled={currentPage === numPages || numPages === 0}
                className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                title="Следующая"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
            </button>

            <button 
                onClick={() => setCurrentPage(numPages)} 
                disabled={currentPage === numPages || numPages === 0}
                className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                title="Последняя страница"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
            </button>
        </div>
    );

    return (
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 rounded-xl shadow-lg h-full flex flex-col">
            {/* Хедер с выбором учебника */}
            <div className="flex-shrink-0 mb-3 flex items-center gap-3">
                <div className="flex-1 relative">
                    <select
                        value={selectedTextbook?.name || ''}
                        onChange={(e) => {
                            const value = e.target.value;
                            console.log('📚 Textbook selected:', value);
                            onSelectTextbook(value || null);
                            setPdfRendered(false);
                            setError('');
                        }}
                        className="w-full bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-xl py-3 px-4 pr-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none shadow-sm"
                        disabled={textbooks.length === 0}
                    >
                        {textbooks.length === 0 && <option value="">Загрузите учебник</option>}
                        {textbooks.length > 0 && <option value="">-- Выберите учебник --</option>}
                        {textbooks.map(tb => <option key={tb.name} value={tb.name}>{tb.name}</option>)}
                    </select>
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </div>
                
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span>Загрузить PDF</span>
                </button>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    className="hidden" 
                    accept=".pdf" 
                />
            </div>

            {selectedTextbook ? (
                <>
                    {/* Тулбар */}
                    <div className="flex justify-center mb-3">
                        <Toolbar />
                    </div>
                    
                    {/* PDF Viewer - УВЕЛИЧЕНА ВЫСОТА */}
                    <div className="flex-grow overflow-auto bg-gray-200 dark:bg-gray-900 rounded-xl p-4 flex justify-center items-start" style={{ minHeight: '75vh' }}>
                        <div 
                            ref={containerRef}
                            className="relative shadow-2xl rounded-lg overflow-hidden"
                            style={{ 
                                width: canvasSize.width || 'auto',
                                height: canvasSize.height || 'auto'
                            }}
                        >
                            {loading && (
                                <div className="flex flex-col items-center justify-center p-12">
                                    <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent"></div>
                                    <p className="mt-4 text-gray-600 dark:text-gray-400 font-medium">Загрузка PDF...</p>
                                </div>
                            )}
                            
                            {error && (
                                <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-800 rounded-xl p-6 m-4">
                                    <div className="flex items-center gap-3">
                                        <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <p className="text-red-600 dark:text-red-400 font-medium">{error}</p>
                                    </div>
                                </div>
                            )}

                            <Document
                                file={selectedTextbook.url}
                                onLoadSuccess={onDocumentLoadSuccess}
                                onLoadError={onDocumentLoadError}
                                loading={null}
                                error={null}
                            >
                                <Page
                                    pageNumber={currentPage}
                                    scale={zoom}
                                    onRenderSuccess={onPageRenderSuccess}
                                    renderAnnotationLayer={false}
                                    renderTextLayer={false}
                                    className="shadow-2xl rounded-lg"
                                />
                            </Document>
                            
                            {pdfRendered && (
                                <canvas 
                                    ref={annotationCanvasRef}
                                    width={canvasSize.width}
                                    height={canvasSize.height}
                                    className="absolute top-0 left-0"
                                    style={{
                                        cursor: tool === 'pen' ? 'crosshair' : tool === 'highlighter' ? 'cell' : tool === 'eraser' ? 'not-allowed' : 'default'
                                    }}
                                    onMouseDown={startDrawing}
                                    onMouseMove={draw}
                                    onMouseUp={stopDrawing}
                                    onMouseLeave={stopDrawing}
                                />
                            )}
                        </div>
                    </div>
                    
                    {/* Пагинация */}
                    {numPages > 1 && (
                        <div className="flex justify-center mt-3">
                            <Pagination />
                        </div>
                    )}
                </>
            ) : (
                <div className="flex-grow flex flex-col items-center justify-center text-center p-8">
                    <div className="bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-full p-12 mb-6 shadow-lg">
                        <svg className="w-24 h-24 text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                    </div>
                    <h3 className="text-3xl font-bold text-gray-800 dark:text-white mb-3">
                        Учебник не выбран
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 max-w-md mb-8 text-lg">
                        Загрузите PDF-файл учебника и выберите его из списка
                    </p>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold py-4 px-8 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <span>Загрузить первый учебник</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default Textbook;